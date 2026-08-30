/**
 * Geïsoleerde test voor stap 2 (STATUS.md sectie 11/12, Route B):
 * add_authorized_recipient - los van create_poison_token/attach_transfer_hook/
 * poison_transfer_hook, die in latere stappen komen.
 *
 * Test:
 * 1. init_wallet (spankwallet-testfixture, zelfde als activeDefenseFull.ts)
 * 2. add_authorized_recipient voor een willekeurige (mint, recipient) - geen
 *    echte Token-2022-mint nodig, token_mint is een UncheckedAccount (zelfde
 *    patroon als create_poison_token's eigen token_mint-veld) - alleen de key
 *    is relevant voor de PDA-seed/opgeslagen data.
 * 3. AuthorizedRecipient-PDA teruglezen, velden (mint/recipient/bump) verifiëren.
 * 4. NEGATIEF: een tweede add_authorized_recipient voor DEZELFDE (mint,
 *    recipient) moet falen (init-constraint - account bestaat al).
 *
 * Gebruik: npx ts-node tests/addAuthorizedRecipientIsolated.ts
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

// --- Helpers (zelfde als activeDefenseFull.ts) ---

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

function anchorDisc(ix: string): Buffer {
  return createHash("sha256").update(`global:${ix}`).digest().subarray(0, 8);
}

function u64Le(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }
function borshVecU8(data: Buffer): Buffer { const l = Buffer.alloc(4); l.writeUInt32LE(data.length); return Buffer.concat([l, data]); }
function borshOptionI64(value: number | null): Buffer { if (value === null) return Buffer.from([0]); const b = Buffer.alloc(9); b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); return b; }
function encodeOptionalI64Challenge(value: number | null): Buffer { const b = Buffer.alloc(9); if (value !== null) { b[0] = 1; b.writeBigInt64LE(BigInt(value), 1); } return b; }

// --- Main ---

async function main() {
  console.log("=== add_authorized_recipient - geïsoleerde test (STATUS.md sectie 11/12) ===\n");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const homeDir = process.env.HOME || "/home/michel";
  const kpJson = JSON.parse(fs.readFileSync(`${homeDir}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(kpJson));
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Balance: ${(await connection.getBalance(payer.publicKey) / 1e9).toFixed(4)} SOL\n`);

  // ============================================================
  // STAP A: init_wallet (identiek aan activeDefenseFull.ts STAP 1)
  // ============================================================
  console.log("STAP A: init_wallet...");

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
  const actionNonce = walletInfo.data.readBigUInt64LE(nonceOff);
  console.log(`  Action nonce: ${actionNonce}\n`);

  // ============================================================
  // STAP B: add_authorized_recipient (POSITIEF pad)
  // ============================================================
  console.log("STAP B: add_authorized_recipient...");

  // Geen echte Token-2022-mint nodig - token_mint is een UncheckedAccount
  // (zelfde patroon als create_poison_token), alleen de key is relevant.
  const mint = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;
  console.log(`  Mint (kale pubkey, geen on-chain account): ${mint.toBase58()}`);
  console.log(`  Recipient: ${recipient.toBase58()}`);

  const [authorizedRecipientPda, expectedBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("poison_authorized"), mint.toBuffer(), recipient.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  console.log(`  AuthorizedRecipient PDA: ${authorizedRecipientPda.toBase58()} (bump ${expectedBump})`);

  const addPayload = Buffer.concat([u64Le(actionNonce), mint.toBuffer(), recipient.toBuffer()]);
  const addChallenge = buildChallenge(ACTIVE_DEFENSE_ID, walletPda, "add_authorized_recipient", addPayload);
  const addSigned = signChallenge(passkey, addChallenge);

  const addDisc = anchorDisc("add_authorized_recipient");
  const addData = Buffer.concat([
    addDisc,
    recipient.toBuffer(),
    u64Le(actionNonce),
    borshVecU8(addSigned.clientDataJSON),
  ]);

  function buildAddIx(): TransactionInstruction {
    return new TransactionInstruction({
      programId: ACTIVE_DEFENSE_ID,
      keys: [
        { pubkey: walletPda, isSigner: false, isWritable: false },
        // passkeys: Option<UncheckedAccount> = None -> program_id als placeholder
        { pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: authorizedRecipientPda, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: addData,
    });
  }

  const addTx = new Transaction().add(secp256r1Ix(seedKey, addSigned.signedMessage, addSigned.rawSignature), buildAddIx());
  try {
    await sendAndConfirmTransaction(connection, addTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ add_authorized_recipient succeeded\n");
  } catch (e: any) {
    console.log(`  ✗ add_authorized_recipient failed: ${e.message}`);
    if (e.getLogs) console.log(await e.getLogs(connection));
    process.exit(1);
  }

  // ============================================================
  // STAP C: AuthorizedRecipient-PDA teruglezen en velden verifiëren
  // ============================================================
  console.log("STAP C: AuthorizedRecipient-PDA teruglezen...");
  const arInfo = await connection.getAccountInfo(authorizedRecipientPda, "confirmed");
  if (!arInfo) {
    console.log("  ✗ FOUT: AuthorizedRecipient-PDA bestaat niet na bevestigde transactie.");
    process.exit(1);
  }
  console.log(`  Owner: ${arInfo.owner.toBase58()} (moet ${ACTIVE_DEFENSE_ID.toBase58()} zijn)`);
  console.log(`  Data length: ${arInfo.data.length} (moet 73 zijn: 8 disc + 32 mint + 32 recipient + 1 bump)`);

  const readMint = new PublicKey(arInfo.data.subarray(8, 40));
  const readRecipient = new PublicKey(arInfo.data.subarray(40, 72));
  const readBump = arInfo.data[72];

  console.log(`  mint (gelezen):      ${readMint.toBase58()}`);
  console.log(`  recipient (gelezen): ${readRecipient.toBase58()}`);
  console.log(`  bump (gelezen):      ${readBump}`);

  let ok = true;
  if (!arInfo.owner.equals(ACTIVE_DEFENSE_ID)) { console.log("  ✗ FOUT: owner klopt niet."); ok = false; }
  if (arInfo.data.length !== 73) { console.log("  ✗ FOUT: data length klopt niet."); ok = false; }
  if (!readMint.equals(mint)) { console.log("  ✗ FOUT: mint klopt niet."); ok = false; }
  if (!readRecipient.equals(recipient)) { console.log("  ✗ FOUT: recipient klopt niet."); ok = false; }
  if (readBump !== expectedBump) { console.log("  ✗ FOUT: bump klopt niet."); ok = false; }
  if (!ok) process.exit(1);
  console.log("  ✓ alle velden kloppen (mint, recipient, bump) - GEEN 'allowed'-veld, bestaan = autorisatie.\n");

  // ============================================================
  // STAP D: NEGATIEF - dezelfde (mint, recipient) nogmaals toevoegen moet falen
  // ============================================================
  console.log("STAP D: NEGATIEF - add_authorized_recipient nogmaals voor dezelfde (mint, recipient)...");
  // Nieuwe challenge/signature nodig - action_nonce is niet veranderd door
  // add_authorized_recipient (geen wallet-mutatie), dus dezelfde nonce hergebruiken,
  // maar wel een verse passkey-handtekening (challenge bevat geen nonce-afhankelijke
  // wijziging die dat zou vereisen, maar clientDataJSON/signature worden hier voor
  // de duidelijkheid opnieuw opgebouwd i.p.v. hergebruikt).
  const addSigned2 = signChallenge(passkey, addChallenge);
  const addData2 = Buffer.concat([
    addDisc,
    recipient.toBuffer(),
    u64Le(actionNonce),
    borshVecU8(addSigned2.clientDataJSON),
  ]);
  const addIx2 = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: authorizedRecipientPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: addData2,
  });
  const addTx2 = new Transaction().add(secp256r1Ix(seedKey, addSigned2.signedMessage, addSigned2.rawSignature), addIx2);
  let duplicateRejected = false;
  try {
    await sendAndConfirmTransaction(connection, addTx2, [payer], { commitment: "confirmed" });
    console.log("  ✗ FOUT: tweede add_authorized_recipient voor dezelfde (mint, recipient) SLAAGDE (moest falen!).");
  } catch (e: any) {
    duplicateRejected = true;
    console.log(`  ✓ correct geweigerd (init-constraint, account bestaat al): ${e.message.split("\n")[0]}`);
  }
  if (!duplicateRejected) process.exit(1);

  console.log("\n✓✓✓ ALLE STAPPEN GESLAAGD ✓✓✓");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
