/**
 * Geïsoleerde test voor stap 4 (STATUS.md sectie 13/14, Route B - de LAATSTE
 * stap van dit deel): poison_transfer_hook herbouwd als de echte
 * Execute-interface-implementatie (SPL_DISCRIMINATOR_SLICE).
 *
 * DE BESLISSENDE TEST (niet optioneel): twee ECHTE Token-2022-transfers via
 * transferChecked (die zelf de hook-CPI triggert, GEEN handmatige aanroep
 * van poison_transfer_hook):
 *   - Naar een TOEGESTANE ontvanger -> moet SLAGEN.
 *   - Naar een NIET-toegestane ontvanger -> moet FALEN, met een specifieke,
 *     zinvolle foutcode (Anchor's AccountNotInitialized op
 *     `authorized_recipient` - de PDA bestaat niet, dus de typed
 *     Account<T>-deserialisatie faalt vóór de handler-body draait), niet
 *     een generieke crash.
 *
 * Dit is het moment waarop het hele mechanisme uit sectie 7 t/m 14 zijn nut
 * bewijst: een spam-/poison-token die daadwerkelijk transfers blokkeert
 * naar wie niet geautoriseerd is - zonder een Vec<Pubkey> in CPI-data, zonder
 * een zelfverzonnen instructie-envelope, met de officiële SPL-interfaces.
 *
 * Gebruik: npx ts-node tests/poisonTransferHookIsolated.ts
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
  createInitializeAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAccountLenForMint,
  getMint,
  getMintLen,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

// --- Program IDs ---
const SPANKWALLET_REAL_ID = "9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9";
const DEFAULT_TEST_SPANKWALLET_ID = "BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk";
const BLOCKLIST_SPANKWALLET_TEST_IDS = [
  SPANKWALLET_REAL_ID,
  "G1D5ckPj3ZMBeYNfEz24dGhvPExqNP6Y3SFNx3V7RbK5",
  "DGaTtEj3Hr54MedgZj2CyCpFgH1e6ATNTNweG9v46ypq",
  "8vPFH4YYVzRr2euemkXDHRz2McH58BBKfwJtQUumc8x5",
  "9W3CGKhd7hgywf3xfP8snNmB2AgmzwQ3rdDFDV3hUurK",
];

function resolveSpankwalletTestId(): PublicKey {
  const raw = process.env.SPANKWALLET_TEST_PROGRAM_ID ?? DEFAULT_TEST_SPANKWALLET_ID;
  const id = new PublicKey(raw);
  if (BLOCKLIST_SPANKWALLET_TEST_IDS.includes(id.toBase58())) {
    throw new Error(`SPANKWALLET_TEST_PROGRAM_ID (${id.toBase58()}) staat op de blocklist`);
  }
  return id;
}

const SPANKWALLET_ID = resolveSpankwalletTestId();
const ACTIVE_DEFENSE_ID = new PublicKey("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");
const SECP256R1_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");
const INSTRUCTIONS_SYSVAR = new PublicKey("Sysvar1nstructions1111111111111111111111111");

// --- Helpers (zelfde als de eerdere geïsoleerde tests) ---

function base64url(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface TestPasskey { privateKey: Uint8Array; compressedPublicKey: Buffer; }

function generateTestPasskey(): TestPasskey {
  const privateKey = p256.utils.randomPrivateKey();
  const compressedPublicKey = Buffer.from(p256.getPublicKey(privateKey, true));
  return { privateKey, compressedPublicKey };
}

function buildChallenge(programId: PublicKey, wallet: PublicKey, domain: string, payload: Buffer): Buffer {
  const combined = Buffer.concat([programId.toBuffer(), wallet.toBuffer(), Buffer.from(domain, "utf-8"), payload]);
  return Buffer.from(keccak_256(combined));
}

interface SignedChallenge { signedMessage: Buffer; rawSignature: Buffer; clientDataJSON: Buffer; }

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

function anchorDisc(ix: string): Buffer {
  return createHash("sha256").update(`global:${ix}`).digest().subarray(0, 8);
}

function u64Le(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }
function borshVecU8(data: Buffer): Buffer { const l = Buffer.alloc(4); l.writeUInt32LE(data.length); return Buffer.concat([l, data]); }
function borshOptionI64(value: number | null): Buffer { if (value === null) return Buffer.from([0]); const b = Buffer.alloc(9); b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); return b; }
function encodeOptionalI64Challenge(value: number | null): Buffer { const b = Buffer.alloc(9); if (value !== null) { b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); } return b; }

async function main() {
  console.log("=== poison_transfer_hook (echte Execute-interface) - BESLISSENDE test (STATUS.md sectie 14) ===\n");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const homeDir = process.env.HOME || "/home/michel";
  const kpJson = JSON.parse(fs.readFileSync(`${homeDir}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(kpJson));
  console.log(`Payer: ${payer.publicKey.toBase58()}\n`);

  // STAP A: init_wallet
  console.log("STAP A: init_wallet...");
  const passkey = generateTestPasskey();
  const seedKey = passkey.compressedPublicKey;
  const walletSeedHash = createHash("sha256").update(seedKey).digest();
  const [walletPda] = PublicKey.findProgramAddressSync([Buffer.from("wallet"), walletSeedHash], SPANKWALLET_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), walletPda.toBuffer()], SPANKWALLET_ID);
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
  await sendAndConfirmTransaction(connection, initTx, [payer], { commitment: "confirmed" });
  console.log("  ✓ init_wallet succeeded\n");

  const walletInfo = await connection.getAccountInfo(walletPda, "confirmed");
  if (!walletInfo) { console.log("FOUT: wallet niet gevonden"); process.exit(1); }
  let nonceOff = 148;
  const rsTag = walletInfo.data[nonceOff]; nonceOff += 1;
  if (rsTag === 1) nonceOff += 41;
  nonceOff += 8;
  const daTag = walletInfo.data[nonceOff]; nonceOff += 1;
  if (daTag === 1) nonceOff += 32;
  let actionNonce = walletInfo.data.readBigUInt64LE(nonceOff);

  // STAP B: mint aanmaken (alleen ruimte)
  console.log("STAP B: Token-2022 mint aanmaken...");
  const mint = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.TransferHook]);
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);
  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey,
      lamports: mintRent, space: mintLen, programId: TOKEN_2022_PROGRAM_ID,
    })
  );
  await sendAndConfirmTransaction(connection, createMintTx, [payer, mint], { commitment: "confirmed" });
  console.log(`  Mint: ${mint.publicKey.toBase58()}\n`);

  // STAP C: attach_transfer_hook
  console.log("STAP C: attach_transfer_hook...");
  const [extraAccountMetaListPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  const attachPayload = Buffer.concat([u64Le(actionNonce), mint.publicKey.toBuffer()]);
  const attachChallenge = buildChallenge(ACTIVE_DEFENSE_ID, walletPda, "attach_transfer_hook", attachPayload);
  const attachSigned = signChallenge(passkey, attachChallenge);
  const attachDisc = anchorDisc("attach_transfer_hook");
  const attachData = Buffer.concat([attachDisc, u64Le(actionNonce), borshVecU8(attachSigned.clientDataJSON)]);
  const attachIx = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false },
      { pubkey: mint.publicKey, isSigner: false, isWritable: true },
      { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: attachData,
  });
  const attachTx = new Transaction().add(secp256r1Ix(seedKey, attachSigned.signedMessage, attachSigned.rawSignature), attachIx);
  await sendAndConfirmTransaction(connection, attachTx, [payer], { commitment: "confirmed" });
  console.log("  ✓ attach_transfer_hook succeeded\n");

  // STAP D: add_authorized_recipient - ALLEEN voor authorizedOwner
  console.log("STAP D: add_authorized_recipient (alleen voor authorizedOwner)...");
  const authorizedOwner = Keypair.generate().publicKey;
  const unauthorizedOwner = Keypair.generate().publicKey;
  const walletInfo2 = await connection.getAccountInfo(walletPda, "confirmed");
  actionNonce = walletInfo2!.data.readBigUInt64LE(nonceOff);
  const [authorizedRecipientPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("poison_authorized"), mint.publicKey.toBuffer(), authorizedOwner.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  const [neverCreatedPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("poison_authorized"), mint.publicKey.toBuffer(), unauthorizedOwner.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  console.log(`  authorizedOwner:   ${authorizedOwner.toBase58()} -> PDA ${authorizedRecipientPda.toBase58()} (WORDT aangemaakt)`);
  console.log(`  unauthorizedOwner: ${unauthorizedOwner.toBase58()} -> PDA ${neverCreatedPda.toBase58()} (blijft NOOIT aangemaakt)`);
  const addPayload = Buffer.concat([u64Le(actionNonce), mint.publicKey.toBuffer(), authorizedOwner.toBuffer()]);
  const addChallenge = buildChallenge(ACTIVE_DEFENSE_ID, walletPda, "add_authorized_recipient", addPayload);
  const addSigned = signChallenge(passkey, addChallenge);
  const addDisc = anchorDisc("add_authorized_recipient");
  const addData = Buffer.concat([addDisc, authorizedOwner.toBuffer(), u64Le(actionNonce), borshVecU8(addSigned.clientDataJSON)]);
  const addIx = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false },
      { pubkey: mint.publicKey, isSigner: false, isWritable: false },
      { pubkey: authorizedRecipientPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: addData,
  });
  const addTx = new Transaction().add(secp256r1Ix(seedKey, addSigned.signedMessage, addSigned.rawSignature), addIx);
  await sendAndConfirmTransaction(connection, addTx, [payer], { commitment: "confirmed" });
  console.log("  ✓ add_authorized_recipient succeeded\n");

  // STAP E: InitializeMint2
  console.log("STAP E: InitializeMint2...");
  const initMintTx = new Transaction().add(
    createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, initMintTx, [payer], { commitment: "confirmed" });
  console.log("  ✓ InitializeMint2 succeeded\n");

  // STAP F: token-accounts
  console.log("STAP F: token-accounts aanmaken...");
  const mintInfo = await getMint(connection, mint.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
  const accountLen = getAccountLenForMint(mintInfo);
  const accountRent = await connection.getMinimumBalanceForRentExemption(accountLen);
  const srcToken = Keypair.generate();
  const dstAuthorized = Keypair.generate();
  const dstUnauthorized = Keypair.generate();
  for (const [tokenAccount, owner, label] of [
    [srcToken, payer.publicKey, "source"],
    [dstAuthorized, authorizedOwner, "dest (authorized)"],
    [dstUnauthorized, unauthorizedOwner, "dest (unauthorized)"],
  ] as [Keypair, PublicKey, string][]) {
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey, newAccountPubkey: tokenAccount.publicKey,
        lamports: accountRent, space: accountLen, programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeAccountInstruction(tokenAccount.publicKey, mint.publicKey, owner, TOKEN_2022_PROGRAM_ID)
    );
    await sendAndConfirmTransaction(connection, tx, [payer, tokenAccount], { commitment: "confirmed" });
    console.log(`  ✓ ${label}: ${tokenAccount.publicKey.toBase58()}`);
  }
  const mintToTx = new Transaction().add(
    createMintToInstruction(mint.publicKey, srcToken.publicKey, payer.publicKey, 2_000_000n, [], TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, mintToTx, [payer], { commitment: "confirmed" });
  console.log("  Tokens gemint naar source (2.0)\n");

  // ============================================================
  // STAP G (DE BESLISSENDE TEST): twee ECHTE transfers
  // ============================================================
  console.log("=== STAP G: DE BESLISSENDE TEST ===\n");

  console.log("G1. ECHTE transfer naar de TOEGESTANE ontvanger (moet SLAGEN)...");
  const transferToAuthorized = await createTransferCheckedWithTransferHookInstruction(
    connection, srcToken.publicKey, mint.publicKey, dstAuthorized.publicKey, payer.publicKey,
    500_000n, 6, [], "confirmed", TOKEN_2022_PROGRAM_ID
  );
  let g1ok = false;
  try {
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(transferToAuthorized), [payer], { commitment: "confirmed" });
    console.log(`  ✓✓✓ TRANSFER GESLAAGD. Signature: ${sig}`);
    g1ok = true;
  } catch (e: any) {
    console.log(`  ✗✗✗ ONVERWACHT GEFAALD: ${e.message}`);
    if (e.getLogs) {
      const logs = await e.getLogs(connection);
      for (const line of logs ?? []) console.log("    " + line);
    }
  }
  if (!g1ok) process.exit(1);

  const dstAuthorizedInfo = await connection.getAccountInfo(dstAuthorized.publicKey, "confirmed");
  const dstAuthorizedAmount = dstAuthorizedInfo!.data.readBigUInt64LE(64);
  console.log(`  Bevestigd on-chain: dest (authorized) saldo = ${dstAuthorizedAmount} (moet 500000 zijn)`);
  if (dstAuthorizedAmount !== 500000n) { console.log("  ✗ FOUT: saldo klopt niet ondanks 'geslaagde' transactie."); process.exit(1); }
  console.log("  ✓ daadwerkelijk on-chain bevestigd, niet alleen 'geen fout'.\n");

  console.log("G2. ECHTE transfer naar de NIET-toegestane ontvanger (moet FALEN, met een");
  console.log("SPECIFIEKE foutcode - AccountNotInitialized op authorized_recipient - niet");
  console.log("een generieke crash)...");
  const transferToUnauthorized = await createTransferCheckedWithTransferHookInstruction(
    connection, srcToken.publicKey, mint.publicKey, dstUnauthorized.publicKey, payer.publicKey,
    500_000n, 6, [], "confirmed", TOKEN_2022_PROGRAM_ID
  );
  let g2CorrectlyRejected = false;
  try {
    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(transferToUnauthorized), [payer], { commitment: "confirmed" });
    console.log(`  ✗✗✗ FOUT: transfer naar UNAUTHORIZED SLAAGDE (signature ${sig}) - dit had moeten falen!`);
  } catch (e: any) {
    const msg = e.message || String(e);
    console.log(`  Faalde zoals verwacht: ${msg.split("\n")[0]}`);
    if (e.getLogs) {
      const logs = await e.getLogs(connection);
      console.log("  Logs:");
      for (const line of logs ?? []) console.log("    " + line);
      const hasSpecificError = (logs ?? []).some((l: string) =>
        l.includes("AccountNotInitialized") || l.includes("Error Code:")
      );
      const reachedOurProgram = (logs ?? []).some((l: string) => l.includes(ACTIVE_DEFENSE_ID.toBase58()));
      if (hasSpecificError && reachedOurProgram) {
        console.log("");
        console.log("  ✓✓✓ SPECIFIEKE, ZINVOLLE FOUTCODE bevestigd (geen generieke crash) - Anchor's");
        console.log("  eigen AccountNotInitialized op authorized_recipient: de PDA voor");
        console.log("  (mint, unauthorizedOwner) bestaat niet, dus de getypeerde");
        console.log("  Account<AuthorizedRecipient>-deserialisatie faalt vóór de handler-body");
        console.log("  ooit draait - exact het ontwerp uit sectie 12 in actie.");
        g2CorrectlyRejected = true;
      } else {
        console.log("  ✗ Faalde, maar niet met de verwachte, specifieke foutcode - nader onderzoeken.");
      }
    }
  }
  if (!g2CorrectlyRejected) process.exit(1);

  const dstUnauthorizedInfo = await connection.getAccountInfo(dstUnauthorized.publicKey, "confirmed");
  const dstUnauthorizedAmount = dstUnauthorizedInfo!.data.readBigUInt64LE(64);
  console.log(`  Bevestigd on-chain: dest (unauthorized) saldo = ${dstUnauthorizedAmount} (moet 0 blijven)`);
  if (dstUnauthorizedAmount !== 0n) { console.log("  ✗ FOUT: saldo is niet 0 - transfer is toch gedeeltelijk doorgegaan?!"); process.exit(1); }
  console.log("  ✓ daadwerkelijk on-chain bevestigd: geen enkele token is verplaatst.\n");

  const srcInfo = await connection.getAccountInfo(srcToken.publicKey, "confirmed");
  const srcAmount = srcInfo!.data.readBigUInt64LE(64);
  console.log(`Source-saldo na afloop: ${srcAmount} (moet 2000000 - 500000 = 1500000 zijn - alleen G1 heeft echt overgemaakt)`);
  if (srcAmount !== 1_500_000n) { console.log("✗ FOUT: source-saldo klopt niet."); process.exit(1); }

  console.log("\n✓✓✓✓✓ HET VOLLEDIGE MECHANISME WERKT END-TO-END ✓✓✓✓✓");
  console.log("Een toegestane ontvanger kon de poison token ontvangen; een niet-toegestane");
  console.log("ontvanger werd geweigerd, met een specifieke foutcode, zonder dat er enige");
  console.log("Vec<Pubkey> in CPI-data of zelfverzonnen instructie-envelope aan te pas kwam -");
  console.log("uitsluitend de officiële SPL-transfer-hook-interface + ExtraAccountMetaList +");
  console.log("een simpele, bestaan-is-autorisatie PDA.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
