/**
 * Client-library E2E-test — dezelfde Route B-flow als activeDefenseFull.ts,
 * maar ALLES wat de library (client/src/poisonToken.ts) dekt, via haar
 * EIGEN publieke exports:
 *
 *   - generateTestPasskey / buildChallenge / signChallenge / secp256r1Ix
 *     (passkey-flow + WebAuthn-envelope)
 *   - anchorDisc (discriminators, ook voor spankwallet's init_wallet)
 *   - createMintForPoisonToken + POISON_MINT_LEN (mint-aanmaak)
 *   - buildAttachTransferHookIx / buildAddAuthorizedRecipientIx
 *   - deriveAuthorizedRecipientPda (PDA-afleiding)
 *   - buildPoisonTransferIx (echte transferChecked met library-resolutie)
 *   - readAuthorizedRecipient (on-chain verificatie)
 *
 * Blijft bewust inline (buiten de library's scope — die dekt
 * active-defense, niet spankwallet of de Token-2022-client):
 *   - init_wallet zelf (spankwallet's eigen instructie + PDA-seedrecept)
 *   - action-nonce-uitlezen uit het WalletAccount (variabele offset)
 *   - InitializeMint2 / token-accounts / mintTo (Token-2022's eigen client)
 *
 * Doel (STATUS.md §19's "natuurlijk vervolg"): activeDefenseFull.ts bewijst
 * dat de FLOW werkt met inline-bouw; deze test bewijst dat de LIBRARY zelf
 * on-chain bruikbaar is via haar publieke API. Als activeDefenseFull slaagt
 * en deze test faalt, zit de bug in de library — niet in de flow.
 *
 * Doelprogramma's: de canonieke active-defense (ACTIVE_DEFENSE_PROGRAM_ID
 * uit de library, Route B sinds STATUS.md §20) + de spankwallet-testfixture
 * voor init_wallet (zelfde blocklist als activeDefenseFull.ts).
 *
 * Gebruik: npx ts-node tests/clientLibraryE2E.ts
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
import { createHash } from "crypto";
import * as fs from "fs";
import {
  createInitializeMint2Instruction,
  createInitializeAccountInstruction,
  createMintToInstruction,
  getAccount,
  getAccountLenForMint,
  getMint,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

// --- ALLES wat de library dekt: via de library ---
import {
  ACTIVE_DEFENSE_PROGRAM_ID,
  POISON_MINT_LEN,
  INSTRUCTIONS_SYSVAR,
  anchorDisc,
  generateTestPasskey,
  buildChallenge,
  signChallenge,
  secp256r1Ix,
  deriveAuthorizedRecipientPda,
  createMintForPoisonToken,
  buildAttachTransferHookIx,
  buildAddAuthorizedRecipientIx,
  buildPoisonTransferIx,
  readAuthorizedRecipient,
  TOKEN_2022_ID,
} from "../client/src/poisonToken";

// --- Spankwallet testfixture (zelfde blocklist-patroon als activeDefenseFull.ts) ---
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
    throw new Error(
      `SPANKWALLET_TEST_PROGRAM_ID (${id.toBase58()}) staat op de blocklist — ` +
      `gebruik een verse wegwerp-deploy van spankwallet (zie STATUS.md sectie 5)`
    );
  }
  return id;
}

const SPANKWALLET_ID = resolveSpankwalletTestId();

// --- Kleine lokale encoding-helpers (alleen voor de INLINE-blijvende
// spankwallet-init_wallet-bouw; behoren niet tot de active-defense-library) ---
function u64Le(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }
function borshVecU8(data: Buffer): Buffer { const l = Buffer.alloc(4); l.writeUInt32LE(data.length); return Buffer.concat([l, data]); }
function borshOptionI64(value: number | null): Buffer { if (value === null) return Buffer.from([0]); const b = Buffer.alloc(9); b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); return b; }
// Spankwallet-specifiek (activeDefenseFull.ts): de CHALLENGE-payload gebruikt een
// FIXED-width 9-byte encoding voor het Optional<i64>-challenge-veld, NIET de
// variabele Borsh-Option (1 byte bij None) die de instructie-DATA gebruikt.
// Die onderscheiding vergeten → WebAuthnChallengeMismatch.
function encodeOptionalI64Challenge(value: number | null): Buffer { const b = Buffer.alloc(9); if (value !== null) { b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); } return b; }

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name} ${detail}`); failures++; }
}

async function main() {
  console.log("=== Active-Defense Client-Library E2E Test (Route B) ===\n");
  console.log(`Active-defense (uit library): ${ACTIVE_DEFENSE_PROGRAM_ID.toBase58()}`);
  console.log(`Spankwallet-testfixture:      ${SPANKWALLET_ID.toBase58()}\n`);

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const homeDir = process.env.HOME || "/home/michel";
  const kpJson = JSON.parse(fs.readFileSync(`${homeDir}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(kpJson));
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Balance: ${(await connection.getBalance(payer.publicKey) / 1e9).toFixed(4)} SOL\n`);

  // ============================================================
  // STAP 1: init_wallet (spankwallet-testfixture)
  // Passkey/challenge/signing/envelope: LIBRARY. Alleen de init_wallet-
  // instructie zelf + PDA-seedrecept blijft inline (spankwallet's eigen API).
  // ============================================================
  console.log("STAP 1: init_wallet...");

  const passkey = generateTestPasskey(); // LIBRARY
  const seedKey = passkey.compressedPublicKey;
  const walletSeedHash = createHash("sha256").update(seedKey).digest();
  const [walletPda] = PublicKey.findProgramAddressSync([Buffer.from("wallet"), walletSeedHash], SPANKWALLET_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), walletPda.toBuffer()], SPANKWALLET_ID);
  console.log(`  Wallet PDA: ${walletPda.toBase58()}`);

  const backupAuthority = Keypair.generate().publicKey;
  const initPayload = Buffer.concat([backupAuthority.toBuffer(), encodeOptionalI64Challenge(null)]);
  const initChallenge = buildChallenge(SPANKWALLET_ID, walletPda, "init_wallet", initPayload); // LIBRARY
  const initSigned = signChallenge(passkey, initChallenge); // LIBRARY

  const initIx = new TransactionInstruction({
    programId: SPANKWALLET_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false }, // LIBRARY-constante
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      anchorDisc("init_wallet"), // LIBRARY
      seedKey, walletSeedHash, backupAuthority.toBuffer(),
      borshOptionI64(null), borshVecU8(initSigned.clientDataJSON),
    ]),
  });

  const initTx = new Transaction().add(secp256r1Ix(seedKey, initSigned.signedMessage, initSigned.rawSignature), initIx); // LIBRARY
  try {
    await sendAndConfirmTransaction(connection, initTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ init_wallet succeeded\n");
  } catch (e: any) {
    console.log(`  ✗ init_wallet failed: ${e.message}`);
    process.exit(1);
  }

  // ============================================================
  // STAP 2: action-nonce uitlezen (WalletAccount-layout — inline,
  // spankwallet-externe dependency; zelfde variabel-offset-patroon als
  // activeDefenseFull.ts / [H1-FIX] in instructions.rs)
  // ============================================================
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
  // STAP 3: Token-2022 mint — LIBRARY (createMintForPoisonToken +
  // POISON_MINT_LEN). Alleen ruimte, GEEN extensie-init, GEEN
  // InitializeMint2 (die is allerlaatste stap, STAP 5b).
  // ============================================================
  console.log("STAP 3: Token-2022 mint (library-createMintForPoisonToken)...");
  const mintRent = await connection.getMinimumBalanceForRentExemption(POISON_MINT_LEN);
  const { mintKeypair, tx: createMintTx } = createMintForPoisonToken(payer.publicKey, mintRent); // LIBRARY
  await sendAndConfirmTransaction(connection, createMintTx, [payer, mintKeypair], { commitment: "confirmed" });
  const mint = mintKeypair.publicKey;
  console.log(`  Mint: ${mint.toBase58()} (POISON_MINT_LEN=${POISON_MINT_LEN})\n`);

  const unauthorizedOwner = Keypair.generate().publicKey;
  const authorizedOwner = Keypair.generate().publicKey;

  // ============================================================
  // STAP 4: attach_transfer_hook — LIBRARY (buildAttachTransferHookIx +
  // challenge-helpers). De ECHTE InitializeTransferHook + ExtraAccountMetaList.
  // ============================================================
  console.log("STAP 4: attach_transfer_hook (library-builder)...");
  const attachPayload = Buffer.concat([u64Le(actionNonce), mint.toBuffer()]);
  const attachChallenge = buildChallenge(ACTIVE_DEFENSE_PROGRAM_ID, walletPda, "attach_transfer_hook", attachPayload); // LIBRARY
  const attachSigned = signChallenge(passkey, attachChallenge); // LIBRARY
  const attachIx = buildAttachTransferHookIx(walletPda, mint, payer.publicKey, actionNonce, attachSigned.clientDataJSON); // LIBRARY
  const attachTx = new Transaction().add(secp256r1Ix(seedKey, attachSigned.signedMessage, attachSigned.rawSignature), attachIx); // LIBRARY
  try {
    await sendAndConfirmTransaction(connection, attachTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ attach_transfer_hook succeeded (InitializeTransferHook + ExtraAccountMetaList)\n");
  } catch (e: any) {
    console.log(`  ✗ attach_transfer_hook failed: ${e.message}`);
    process.exit(1);
  }

  // ============================================================
  // STAP 4a: add_authorized_recipient — LIBRARY (builder + PDA-afleiding).
  // unauthorizedOwner krijgt bewust GEEN PDA.
  // ============================================================
  console.log("STAP 4a: add_authorized_recipient (library-builder)...");
  const [authorizedRecipientPda] = deriveAuthorizedRecipientPda(mint, authorizedOwner); // LIBRARY
  const addPayload = Buffer.concat([u64Le(actionNonce), mint.toBuffer(), authorizedOwner.toBuffer()]);
  const addChallenge = buildChallenge(ACTIVE_DEFENSE_PROGRAM_ID, walletPda, "add_authorized_recipient", addPayload); // LIBRARY
  const addSigned = signChallenge(passkey, addChallenge); // LIBRARY
  const addIx = buildAddAuthorizedRecipientIx(walletPda, mint, authorizedOwner, payer.publicKey, actionNonce, addSigned.clientDataJSON); // LIBRARY
  const addTx = new Transaction().add(secp256r1Ix(seedKey, addSigned.signedMessage, addSigned.rawSignature), addIx); // LIBRARY
  try {
    await sendAndConfirmTransaction(connection, addTx, [payer], { commitment: "confirmed" });
    console.log(`  ✓ add_authorized_recipient succeeded (PDA ${authorizedRecipientPda.toBase58()})\n`);
  } catch (e: any) {
    console.log(`  ✗ add_authorized_recipient failed: ${e.message}`);
    process.exit(1);
  }

  // ============================================================
  // STAP 5b: InitializeMint2 — Token-2022's eigen client (buiten de
  // library's scope), ALLERLAATSTE stap (STATUS.md §7).
  // ============================================================
  console.log("STAP 5b: InitializeMint2 (afronden mint-initialisatie)...");
  const initMintTx = new Transaction().add(
    createInitializeMint2Instruction(mint, 6, payer.publicKey, null, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, initMintTx, [payer], { commitment: "confirmed" });
  console.log("  ✓ InitializeMint2 succeeded\n");

  // ============================================================
  // STAP 6: Token accounts — Token-2022's eigen client (getAccountLenForMint,
  // NIET de kale 165 — STATUS.md §21).
  // ============================================================
  console.log("STAP 6: Token accounts...");
  const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  const accountLen = getAccountLenForMint(mintInfo);
  console.log(`  accountLen: ${accountLen} (via getAccountLenForMint, niet de kale 165)`);

  const srcToken = Keypair.generate();
  const dstUnauthorized = Keypair.generate();
  const dstAuthorized = Keypair.generate();
  const tokenRent = await connection.getMinimumBalanceForRentExemption(accountLen);

  const createSrcTx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: srcToken.publicKey, lamports: tokenRent, space: accountLen, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeAccountInstruction(srcToken.publicKey, mint, payer.publicKey, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, createSrcTx, [payer, srcToken], { commitment: "confirmed" });

  const createDstUnauthTx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: dstUnauthorized.publicKey, lamports: tokenRent, space: accountLen, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeAccountInstruction(dstUnauthorized.publicKey, mint, unauthorizedOwner, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, createDstUnauthTx, [payer, dstUnauthorized], { commitment: "confirmed" });

  const createDstAuthTx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer.publicKey, newAccountPubkey: dstAuthorized.publicKey, lamports: tokenRent, space: accountLen, programId: TOKEN_2022_PROGRAM_ID }),
    createInitializeAccountInstruction(dstAuthorized.publicKey, mint, authorizedOwner, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, createDstAuthTx, [payer, dstAuthorized], { commitment: "confirmed" });

  console.log(`  Source: ${srcToken.publicKey.toBase58()}`);
  console.log(`  Dest (unauthorized): ${dstUnauthorized.publicKey.toBase58()} → owner: ${unauthorizedOwner.toBase58()}`);
  console.log(`  Dest (authorized):   ${dstAuthorized.publicKey.toBase58()} → owner: ${authorizedOwner.toBase58()}\n`);

  // ============================================================
  // STAP 7: Mint tokens — Token-2022's eigen client.
  // ============================================================
  console.log("STAP 7: Mint tokens (1.0)...");
  const mintTx = new Transaction().add(
    createMintToInstruction(mint, srcToken.publicKey, payer.publicKey, 1_000_000n, [], TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, mintTx, [payer], { commitment: "confirmed" });
  console.log("  ✓ Tokens gemint\n");

  // ============================================================
  // STAP 8: Transfer tests — LIBRARY (buildPoisonTransferIx, de library's
  // eigen Token-2022-resolutie die de AuthorizedRecipient-PDA zelf vindt).
  // ============================================================
  console.log("STAP 8: Transfer tests (library-buildPoisonTransferIx)...");

  // Test A: naar UNAUTHORIZED → moet falen (AccountNotInitialized op de
  // niet-bestaande AuthorizedRecipient-PDA — STATUS.md §14).
  const transferUnauthIx = await buildPoisonTransferIx(connection, srcToken.publicKey, mint, dstUnauthorized.publicKey, payer.publicKey, 500_000n, 6); // LIBRARY
  let unauthBlocked = false;
  try {
    await sendAndConfirmTransaction(connection, new Transaction().add(transferUnauthIx), [payer], { commitment: "confirmed" });
    console.log("  ✗ Transfer naar unauthorized SLAGDE (moest falen!)");
  } catch (e: any) {
    const msg = e.message || String(e);
    if (msg.includes("AccountNotInitialized") || msg.includes("3012") || msg.includes("0xbc4")) {
      unauthBlocked = true;
      console.log("  ✓ Transfer naar unauthorized GEBLOKKEERD (AccountNotInitialized op AuthorizedRecipient-PDA)");
    } else {
      console.log(`  ✗ Onverwachte fout: ${msg}`);
    }
  }
  const dstUnauthorizedInfo = await getAccount(connection, dstUnauthorized.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
  check("Balance-check: dstUnauthorized nog steeds 0", dstUnauthorizedInfo.amount === 0n, `${dstUnauthorizedInfo.amount}`);
  if (dstUnauthorizedInfo.amount !== 0n) unauthBlocked = false;

  // Test B: naar AUTHORIZED → moet slagen.
  const transferAuthIx = await buildPoisonTransferIx(connection, srcToken.publicKey, mint, dstAuthorized.publicKey, payer.publicKey, 500_000n, 6); // LIBRARY
  let authAllowed = false;
  try {
    await sendAndConfirmTransaction(connection, new Transaction().add(transferAuthIx), [payer], { commitment: "confirmed" });
    console.log("  ✓ Transfer naar authorized GESLAAGD");
  } catch (e: any) {
    console.log(`  ✗ Transfer naar authorized FALDE: ${e.message}`);
  }
  const dstAuthorizedInfo = await getAccount(connection, dstAuthorized.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
  check("Balance-check: dstAuthorized heeft 500000", dstAuthorizedInfo.amount === 500_000n, `${dstAuthorizedInfo.amount}`);
  if (dstAuthorizedInfo.amount === 500_000n) authAllowed = true;

  // ============================================================
  // STAP 9: On-chain verificatie van de authorisatiestate — LIBRARY
  // (readAuthorizedRecipient).
  // ============================================================
  console.log("\nSTAP 9: On-chain verificatie (library-readAuthorizedRecipient)...");
  const authInfo = await readAuthorizedRecipient(connection, mint, authorizedOwner);
  check(
    "readAuthorizedRecipient(authorized) → bestaat, correcte mint+recipient",
    authInfo !== null && authInfo.mint.equals(mint) && authInfo.recipient.equals(authorizedOwner),
    authInfo === null ? "null" : `mint=${authInfo.mint.toBase58().slice(0, 8)}... recipient=${authInfo.recipient.toBase58().slice(0, 8)}...`
  );
  const unauthInfo = await readAuthorizedRecipient(connection, mint, unauthorizedOwner);
  check("readAuthorizedRecipient(unauthorized) → null (niet toegestaan)", unauthInfo === null);

  // ============================================================
  // RESULTAAT
  // ============================================================
  console.log("\n═══════════════════════════════════════");
  const passed = unauthBlocked && authAllowed && failures === 0;
  if (passed) {
    console.log("  ✓✓✓ CLIENT-LIBRARY E2E PASSED — ALLE STAPPEN GROEN ✓✓✓");
    console.log("═══════════════════════════════════════");
    console.log("  ✓ Passkey-flow (generateTestPasskey/buildChallenge/signChallenge/secp256r1Ix) on-chain");
    console.log("  ✓ createMintForPoisonToken + POISON_MINT_LEN on-chain");
    console.log("  ✓ buildAttachTransferHookIx on-chain (InitializeTransferHook + ExtraAccountMetaList)");
    console.log("  ✓ buildAddAuthorizedRecipientIx + deriveAuthorizedRecipientPda on-chain");
    console.log("  ✓ buildPoisonTransferIx on-chain (library-resolutie van de PDA)");
    console.log("  ✓ readAuthorizedRecipient on-chain (state-lezen)");
    console.log("  ✓ Route B poison-token flow via de library's publieke API");
  } else {
    console.log("  ✗✗✗ CLIENT-LIBRARY E2E FAILED ✗✗✗");
    console.log("═══════════════════════════════════════");
    console.log(`  unauthBlocked=${unauthBlocked}, authAllowed=${authAllowed}, extraFailures=${failures}`);
  }
  process.exit(passed ? 0 : 1);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
