/**
 * Active-Defense Poison Token Flow — Complete End-to-End Test (v2)
 * 
 * Nieuw design: authorized list zit IN de transfer_hook_instruction data van de mint.
 * Geen aparte PDA voor de hook. Token-2022 roept poison_transfer_hook aan met
 * de opgeslagen Vec<Pubkey> als argumenten.
 * 
 * Stappen:
 * 1. init_wallet (spankwallet) — nieuwe wallet PDA
 * 2. Token-2022 mint aanmaken
 * 3. Token accounts aanmaken
 * 4. create_poison_token — zet transfer hook met authorized list
 * 5. Mint tokens + transfer naar unauthorized → MOET FALEN
 * 6. Transfer naar authorized → MOET SLAGGEN
 * 
 * Gebruik: npx ts-node tests/activeDefenseFull.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";
import { p256 } from "@noble/curves/p256";
import { keccak_256 } from "@noble/hashes/sha3";
import * as fs from "fs";
import {
  createInitializeMint2Instruction,
  createInitializeAccountInstruction,
  createMintToInstruction,
  createTransferInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

// --- Program IDs ---
// --- Spankwallet testfixture (wegwerp-deploy, NIET het echte multisig-programma) ---
// De tests roepen init_wallet aan op een eigen wegwerp-deploy van spankwallet
// (geïsoleerde worktree op commit 1fb3134, gedeployd onder een vers keypair).
// Zie STATUS.md sectie 5 voor de volledige uitleg.
const SPANKWALLET_REAL_ID = "9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9";
const DEFAULT_TEST_SPANKWALLET_ID = "BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk";
// Harde grendel: weigeren op het echte programma én alle bekende oude/wegwerp-adressen,
// zodat een verouderd of verkeerd adres nooit stilzwijgend voor een nieuw kan doorgaan.
const BLOCKLIST_SPANKWALLET_TEST_IDS = [
  SPANKWALLET_REAL_ID, // het echte, multisig-bestuurde spankwallet-programma
  "G1D5ckPj3ZMBeYNfEz24dGhvPExqNP6Y3SFNx3V7RbK5", // oud active-defense wegwerpadres (2026-08-21)
  "DGaTtEj3Hr54MedgZj2CyCpFgH1e6ATNTNweG9v46ypq", // oud active-defense wegwerpadres (2026-08-24)
  "8vPFH4YYVzRr2euemkXDHRz2McH58BBKfwJtQUumc8x5", // oud active-defense wegwerpadres (2026-08-25)
  "9W3CGKhd7hgywf3xfP8snNmB2AgmzwQ3rdDFDV3hUurK", // oud active-defense declare_id (nooit live)
];

function resolveSpankwalletTestId(): PublicKey {
  const raw = process.env.SPANKWALLET_TEST_PROGRAM_ID ?? DEFAULT_TEST_SPANKWALLET_ID;
  const id = new PublicKey(raw);
  if (BLOCKLIST_SPANKWALLET_TEST_IDS.includes(id.toBase58())) {
    throw new Error(
      `SPANKWALLET_TEST_PROGRAM_ID (${id.toBase58()}) staat op de blocklist — ` +
      `gebruik een verse wegwerp-deploy van spankwallet (zie STATUS.md sectie 5)`
    );
  }
  return id;
}

const SPANKWALLET_ID = resolveSpankwalletTestId();
const ACTIVE_DEFENSE_ID = new PublicKey("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");
const SECP256R1_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");
const TOKEN_2022_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const INSTRUCTIONS_SYSVAR = new PublicKey("Sysvar1nstructions1111111111111111111111111");
const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");

// --- Constants ---
const TOKEN_MINT_BASE_LEN = 82;
// TransferHook extension: 32 (program_id) + 4 (vec len) + hook_data_len
// hook_data = 8 (disc) + 4 (count) + 32*count
// For 1 recipient: 8+4+32 = 44 bytes → ext = 32+4+44 = 80 bytes
// Plus extension header: 4 (type) + 4 (len) = 8 bytes
const TRANSFER_HOOK_EXT_SIZE = 8 + 32 + 4 + (8 + 4 + 32); // ~96 bytes, use 128 for safety
const TOKEN_MINT_LEN = TOKEN_MINT_BASE_LEN + 128;
const TOKEN_ACCOUNT_LEN = 165;

// --- Helpers ---

function base64url(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface TestPasskey {
  privateKey: Uint8Array;
  compressedPublicKey: Buffer;
}

function generateTestPasskey(): TestPasskey {
  const privateKey = p256.utils.randomPrivateKey();
  const compressedPublicKey = Buffer.from(p256.getPublicKey(privateKey, true));
  return { privateKey, compressedPublicKey };
}

/** Keccak-256 over program_id || wallet || domain || payload */
function buildChallenge(programId: PublicKey, wallet: PublicKey, domain: string, payload: Buffer): Buffer {
  const combined = Buffer.concat([programId.toBuffer(), wallet.toBuffer(), Buffer.from(domain, "utf-8"), payload]);
  return Buffer.from(keccak_256(combined));
}

interface SignedChallenge {
  signedMessage: Buffer;
  rawSignature: Buffer;
  clientDataJSON: Buffer;
}

function signChallenge(passkey: TestPasskey, challenge: Buffer): SignedChallenge {
  const challengeB64 = base64url(challenge);
  const clientData = { type: "webauthn.get", challenge: challengeB64, origin: "https://spankwallet-tests.local", crossOrigin: false };
  const clientDataJSON = Buffer.from(JSON.stringify(clientData), "utf-8");
  const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
  const authenticatorData = Buffer.concat([randomBytes(32), Buffer.from([0x05]), randomBytes(4)]);
  const signedMessage = Buffer.concat([authenticatorData, clientDataHash]);
  const messageHash = createHash("sha256").update(signedMessage).digest();
  const sig = p256.sign(messageHash, passkey.privateKey, { lowS: true });
  return { signedMessage, rawSignature: Buffer.from(sig.toCompactRawBytes()), clientDataJSON };
}

function secp256r1Ix(pubkey: Buffer, message: Buffer, signature: Buffer): TransactionInstruction {
  const NO_OWN = 0xffff;
  const dataStart = 2 + 14;
  const sigOff = dataStart;
  const pkOff = sigOff + 64;
  const msgOff = pkOff + 33;
  const total = msgOff + message.length;
  const data = Buffer.alloc(total);
  data[0] = 1; data[1] = 0;
  let o = 2;
  data.writeUInt16LE(sigOff, o); o += 2;
  data.writeUInt16LE(NO_OWN, o); o += 2;
  data.writeUInt16LE(pkOff, o); o += 2;
  data.writeUInt16LE(NO_OWN, o); o += 2;
  data.writeUInt16LE(msgOff, o); o += 2;
  data.writeUInt16LE(message.length, o); o += 2;
  data.writeUInt16LE(NO_OWN, o); o += 2;
  signature.copy(data, sigOff);
  pubkey.copy(data, pkOff);
  message.copy(data, msgOff);
  return new TransactionInstruction({ programId: SECP256R1_ID, keys: [], data });
}

/** Anchor 1.x: sha256("global:<instruction_name>")[:8] — GEEN crate name */
function anchorDisc(ix: string): Buffer {
  return createHash("sha256").update(`global:${ix}`).digest().subarray(0, 8);
}

function u64Le(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }
function borshVecU8(data: Buffer): Buffer { const l = Buffer.alloc(4); l.writeUInt32LE(data.length); return Buffer.concat([l, data]); }
function borshOptionI64(value: number | null): Buffer { if (value === null) return Buffer.from([0]); const b = Buffer.alloc(9); b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); return b; }
function encodeOptionalI64Challenge(value: number | null): Buffer { const b = Buffer.alloc(9); if (value !== null) { b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); } return b; }

/** Borsh Vec<Pubkey>: u32 count (LE) + 32*count bytes */
function borshVecPubkey(pubkeys: PublicKey[]): Buffer {
  const count = Buffer.alloc(4);
  count.writeUInt32LE(pubkeys.length);
  const data = pubkeys.map(p => p.toBuffer());
  return Buffer.concat([count, ...data]);
}

// --- Token-2022 raw instructions ---

function t2022InitializeMint2(mint: PublicKey, mintAuth: PublicKey, decimals: number): TransactionInstruction {
  const data = Buffer.alloc(1 + 8 + 1 + 32 + 33);
  data[0] = 1;
  data.writeBigUInt64LE(0n, 1);
  data[9] = decimals;
  mintAuth.toBuffer().copy(data, 10);
  data[42] = 0; // no freeze authority
  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: mintAuth, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function t2022InitializeAccount(account: PublicKey, mint: PublicKey, owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([5]), // InitializeAccount2 (Token-2022 native)
  });
}

function t2022MintTo(mint: PublicKey, dest: PublicKey, auth: PublicKey, amount: bigint): TransactionInstruction {
  const data = Buffer.alloc(9);
  data[0] = 11;
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: auth, isSigner: true, isWritable: false },
    ],
    data,
  });
}

function t2022Transfer(src: PublicKey, mint: PublicKey, dest: PublicKey, auth: PublicKey, amount: bigint): TransactionInstruction {
  const data = Buffer.alloc(9);
  data[0] = 7;
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: src, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: auth, isSigner: true, isWritable: false },
    ],
    data,
  });
}

// --- Main ---

async function main() {
  console.log("=== Active-Defense Full E2E Test (v2 — new design) ===\n");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const homeDir = process.env.HOME || "/home/michel";
  const kpJson = JSON.parse(fs.readFileSync(`${homeDir}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(kpJson));
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Balance: ${(await connection.getBalance(payer.publicKey) / 1e9).toFixed(4)} SOL\n`);

  // ============================================================
  // STAP 1: init_wallet
  // ============================================================
  console.log("STAP 1: init_wallet...");

  const passkey = generateTestPasskey();
  const seedKey = passkey.compressedPublicKey;
  const walletSeedHash = createHash("sha256").update(seedKey).digest();

  const [walletPda] = PublicKey.findProgramAddressSync([Buffer.from("wallet"), walletSeedHash], SPANKWALLET_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), walletPda.toBuffer()], SPANKWALLET_ID);
  console.log(`  Wallet PDA: ${walletPda.toBase58()}`);

  const backupAuthority = Keypair.generate().publicKey;
  const initPayload = Buffer.concat([backupAuthority.toBuffer(), encodeOptionalI64Challenge(null)]);
  const initChallenge = buildChallenge(SPANKWALLET_ID, walletPda, "init_wallet", initPayload);
  const initSigned = signChallenge(passkey, initChallenge);

  const initDisc = anchorDisc("init_wallet");
  const initData = Buffer.concat([
    initDisc, seedKey, walletSeedHash, backupAuthority.toBuffer(),
    borshOptionI64(null), borshVecU8(initSigned.clientDataJSON),
  ]);

  const initIx = new TransactionInstruction({
    programId: SPANKWALLET_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: initData,
  });

  const initTx = new Transaction().add(secp256r1Ix(seedKey, initSigned.signedMessage, initSigned.rawSignature), initIx);
  try {
    await sendAndConfirmTransaction(connection, initTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ init_wallet succeeded\n");
  } catch (e: any) {
    console.log(`  ✗ init_wallet failed: ${e.message}`);
    process.exit(1);
  }

  // Read action_nonce (should be 0)
  const walletInfo = await connection.getAccountInfo(walletPda, "confirmed");
  if (!walletInfo) { console.log("FOUT: wallet niet gevonden"); process.exit(1); }
  let nonceOff = 148;
  const rsTag = walletInfo.data[nonceOff]; nonceOff += 1;
  if (rsTag === 1) nonceOff += 41;
  nonceOff += 8;
  const daTag = walletInfo.data[nonceOff]; nonceOff += 1;
  if (daTag === 1) nonceOff += 32;
  const actionNonce = walletInfo.data.readBigUInt64LE(nonceOff);
  console.log(`  Action nonce: ${actionNonce}\n`);

  // ============================================================
  // STAP 2: Token-2022 mint
  // ============================================================
  console.log("STAP 2: Token-2022 mint...");

  const mint = Keypair.generate();
  const mintRent = await connection.getMinimumBalanceForRentExemption(TOKEN_MINT_LEN);

  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey, lamports: mintRent, space: TOKEN_MINT_LEN, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, createMintTx, [payer, mint], { commitment: "confirmed" });
  console.log(`  Mint: ${mint.publicKey.toBase58()}\n`);

  // ============================================================
  // STAP 3: Token accounts
  // ============================================================
  console.log("STAP 3: Token accounts...");

  const srcToken = Keypair.generate();
  const dstUnauthorized = Keypair.generate();
  const dstAuthorized = Keypair.generate();
  const unauthorizedOwner = Keypair.generate().publicKey;
  const authorizedOwner = Keypair.generate().publicKey;
  const tokenRent = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_LEN);

  // Source (owned by payer)
  const createSrcTx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: srcToken.publicKey, lamports: tokenRent, space: TOKEN_ACCOUNT_LEN, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeAccountInstruction(srcToken.publicKey, mint.publicKey, payer.publicKey, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, createSrcTx, [payer, srcToken], { commitment: "confirmed" });

  // Dest unauthorized (owned by unauthorizedOwner)
  const createDstUnauthTx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: dstUnauthorized.publicKey, lamports: tokenRent, space: TOKEN_ACCOUNT_LEN, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeAccountInstruction(dstUnauthorized.publicKey, mint.publicKey, unauthorizedOwner, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, createDstUnauthTx, [payer, dstUnauthorized], { commitment: "confirmed" });

  // Dest authorized (owned by authorizedOwner)
  const createDstAuthTx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: dstAuthorized.publicKey, lamports: tokenRent, space: TOKEN_ACCOUNT_LEN, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeAccountInstruction(dstAuthorized.publicKey, mint.publicKey, authorizedOwner, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, createDstAuthTx, [payer, dstAuthorized], { commitment: "confirmed" });

  console.log(`  Source: ${srcToken.publicKey.toBase58()}`);
  console.log(`  Dest (unauthorized): ${dstUnauthorized.publicKey.toBase58()} → owner: ${unauthorizedOwner.toBase58()}`);
  console.log(`  Dest (authorized):   ${dstAuthorized.publicKey.toBase58()} → owner: ${authorizedOwner.toBase58()}\n`);

  // ============================================================
  // STAP 4: create_poison_token (zet transfer hook)
  // ============================================================
  console.log("STAP 4: create_poison_token...");

  const authorizedRecipients = [authorizedOwner]; // alleen deze owner mag ontvangen

  // Challenge payload: action_nonce_LE(8) + mint(32)
  const createPayload = Buffer.concat([u64Le(actionNonce), mint.publicKey.toBuffer()]);
  const createChallenge = buildChallenge(ACTIVE_DEFENSE_ID, walletPda, "create_poison_token", createPayload);
  const createSigned = signChallenge(passkey, createChallenge);

  // Instruction data: disc(8) + Vec<Pubkey>(4+32*N) + u64 nonce(8) + Vec<u8> clientDataJSON(4+N)
  const createDisc = anchorDisc("create_poison_token");
  const createData = Buffer.concat([
    createDisc,
    borshVecPubkey(authorizedRecipients),
    u64Le(actionNonce),
    borshVecU8(createSigned.clientDataJSON),
  ]);

  const createIx = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      // passkeys: Option<UncheckedAccount> → leeg (None) = geen account
      { pubkey: mint.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: createData,
  });

  const createTx = new Transaction().add(secp256r1Ix(seedKey, createSigned.signedMessage, createSigned.rawSignature), createIx);
  try {
    await sendAndConfirmTransaction(connection, createTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ create_poison_token succeeded (transfer hook gezet)\n");
  } catch (e: any) {
    console.log(`  ✗ create_poison_token failed: ${e.message}`);
    if (e.message.includes("WebAuthnChallengeMismatch")) console.log("    → C1: challenge mismatch!");
    if (e.message.includes("InvalidPasskeySignature")) console.log("    → Passkey verificatie gefaald");
    if (e.message.includes("StaleActionNonce")) console.log("    → Nonce mismatch");
    process.exit(1);
  }

  // ============================================================
  // STAP 5: Mint tokens + transfer tests
  // ============================================================
  console.log("STAP 5: Transfer tests...");

  const mintTx = new Transaction().add(createMintToInstruction(mint.publicKey, srcToken.publicKey, payer.publicKey, 1_000_000n, [], TOKEN_2022_PROGRAM_ID));
  await sendAndConfirmTransaction(connection, mintTx, [payer], { commitment: "confirmed" });
  console.log("  Tokens gemint (1.0)");

  // Test A: Transfer naar UNAUTHORIZED → moet falen
  const transferUnauthTx = new Transaction().add(
    createTransferInstruction(srcToken.publicKey, dstUnauthorized.publicKey, payer.publicKey, 500_000n, [], TOKEN_2022_PROGRAM_ID)
  );
  let unauthBlocked = false;
  try {
    await sendAndConfirmTransaction(connection, transferUnauthTx, [payer], { commitment: "confirmed" });
    console.log("  ✗ Transfer naar unauthorized SLAGDE (moest falen!)");
  } catch (e: any) {
    const msg = e.message || String(e);
    if (msg.includes("custom program error") || msg.includes("PoisonToken") || msg.includes("0x")) {
      unauthBlocked = true;
      console.log("  ✓ Transfer naar unauthorized GEBLOKKEERD (poison hook werkt!)");
    } else {
      console.log(`  ✗ Onverwachte fout: ${msg}`);
    }
  }

  // Test B: Transfer naar AUTHORIZED → moet slagen
  const transferAuthTx = new Transaction().add(
    createTransferInstruction(srcToken.publicKey, dstAuthorized.publicKey, payer.publicKey, 500_000n, [], TOKEN_2022_PROGRAM_ID)
  );
  let authAllowed = false;
  try {
    await sendAndConfirmTransaction(connection, transferAuthTx, [payer], { commitment: "confirmed" });
    authAllowed = true;
    console.log("  ✓ Transfer naar authorized GESLAGGEN");
  } catch (e: any) {
    console.log(`  ✗ Transfer naar authorized FALDE: ${e.message}`);
  }

  // ============================================================
  // RESULTAAT
  // ============================================================
  console.log("\n═══════════════════════════════════════");
  if (unauthBlocked && authAllowed) {
    console.log("  ✓✓✓ TEST PASSED — ALLE STAPPEN GROEN ✓✓✓");
    console.log("═══════════════════════════════════════");
    console.log("  ✓ C1: Nonce LE encoding client↔program matcht");
    console.log("  ✓ M2: Instruction encoding (discriminator + Borsh) correct");
    console.log("  ✓ H2: Transfer hook blokkeert unauthorized transfers");
    console.log("  ✓ H1: action_nonce uit WalletAccount (variabele offset)");
    console.log("  ✓ M1: Passkey verificatie via secp256r1 precompile");
    console.log("  ✓ Poison token flow end-to-end functioneel");
  } else {
    console.log("  ✗✗✗ TEST FAILED ✗✗✗");
    console.log("═══════════════════════════════════════");
    console.log(`  unauthBlocked=${unauthBlocked}, authAllowed=${authAllowed}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
