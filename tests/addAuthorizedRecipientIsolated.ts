/**
 * add_authorized_recipient — negatieve test op de koppeling (STATUS §45 + §64).
 *
 * Dit script bestond al vóór §45 en toetste `add` op een kale pubkey als
 * token_mint, bewust los van attach_transfer_hook. Sinds §45 eist `add` een
 * MintOwner-PDA met `mint_owner.wallet == wallet`, en die kan uitsluitend door
 * attach_transfer_hook geschreven zijn. De oude positieve verwachting was daardoor
 * onwaar geworden; gemeten 2026-10-01: hoofdstuk B faalde op `mint_owner`
 * AccountNotInitialized (3012). Wat hier nu staat, is wat het programma doet:
 *
 *   NEG 1  add zonder koppeling wordt GEWEIGERD, geattribueerd aan mint_owner,
 *          en laat géén autorisatie-PDA en géén consumed-account achter.
 *   POS    na attach_transfer_hook op een echte Token-2022-mint slaat dezelfde
 *          add wél — zonder deze controle is NEG 1 waardeloos (§49: een test die
 *          niet rood kan worden, is geen test).
 *   NEG 2  dezelfde getekende actie opnieuw in een andere omhullende transactie
 *          wordt geweigerd. Let op de attributie: bij `add` botst eerst
 *          authorized_recipient (declaratie-index 3), pas daarna consumed_action
 *          (als laatste). Dit script bewijst dus de afwijzing, niet de
 *          consumed-attributie — die staat in de harness (coverage.rs M1d).
 *
 * Gebruik: npx ts-node tests/addAuthorizedRecipientIsolated.ts   (localnet)
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

import { zorgVoorVertrouwensConfig, deriveWalletConfigPda } from "./lib/vertrouwensconfig";
// Eén definitie van de verbruik-identiteit met programma en client (STATUS §64)
import {
  actieHash,
  deriveConsumedActionPda,
  deriveMintOwnerPda,
  TAG_ADD,
  TAG_ATTACH,
} from "../client/src/poisonToken";
import {
  createInitializeMint2Instruction,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash, randomBytes } from "crypto";
import { p256 } from "@noble/curves/p256";
import { keccak_256 } from "@noble/hashes/sha3";
import * as fs from "fs";
import { rpcUrl, loadPayer } from "./lib/env";

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
  // Endpoint en fee-betaler uit de omgeving; de defaults zijn exact wat
  // hier eerder hardcoded stond (zie tests/lib/env.ts). Gemeten gevolg van
  // die hardcode: elke run schreef echte accounts op devnet.
  const connection = new Connection(rpcUrl(), "confirmed");

  const payer = loadPayer();
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
  // STAP B: vertrouwensconfig zetten + lees-bevestigen (STATUS §43)
  // ============================================================
  await zorgVoorVertrouwensConfig(connection, payer, SPANKWALLET_ID, "CONFIG");

  const recipient = Keypair.generate().publicKey;
  console.log(`  Recipient: ${recipient.toBase58()}\n`);

  /** add_authorized_recipient, klaar voor welke omhullende transactie dan ook. */
  function bouwAdd(m: PublicKey, s: SignedChallenge) {
    const [arPda, arBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("poison_authorized"), m.toBuffer(), recipient.toBuffer()], ACTIVE_DEFENSE_ID);
    const hash = actieHash(TAG_ADD, walletPda, [recipient.toBuffer(), u64Le(actionNonce), s.clientDataJSON]);
    const [consumedPda] = deriveConsumedActionPda(walletPda, TAG_ADD, hash);
    const data = Buffer.concat([
      anchorDisc("add_authorized_recipient"), recipient.toBuffer(),
      u64Le(actionNonce), borshVecU8(s.clientDataJSON),
    ]);
    const ix = new TransactionInstruction({
      programId: ACTIVE_DEFENSE_ID,
      keys: [
        { pubkey: walletPda, isSigner: false, isWritable: false },
        { pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false },   // passkeys: None
        { pubkey: m, isSigner: false, isWritable: false },
        { pubkey: arPda, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        // declaratievolgorde instructions.rs: config, mint_owner, consumed als allerlaatste
        { pubkey: deriveWalletConfigPda()[0], isSigner: false, isWritable: false },
        { pubkey: deriveMintOwnerPda(m)[0], isSigner: false, isWritable: false },
        { pubkey: consumedPda, isSigner: false, isWritable: true },
      ],
      data,
    });
    return { ix, arPda, arBump, consumedPda };
  }

  function tekenAdd(m: PublicKey): SignedChallenge {
    const payload = Buffer.concat([u64Le(actionNonce), m.toBuffer(), recipient.toBuffer()]);
    return signChallenge(passkey, buildChallenge(ACTIVE_DEFENSE_ID, walletPda, "add_authorized_recipient", payload));
  }

  async function logsVan(e: any): Promise<string> {
    try { return (await e.getLogs(connection)).join(" / "); } catch { return ""; }
  }

  // ============================================================
  // NEG 1: add ZONDER koppeling moet falen op mint_owner
  // ============================================================
  console.log("NEG 1: add zonder koppeling (verwacht: geweigerd op mint_owner)...");
  const losseMint = Keypair.generate().publicKey;          // bewust géén on-chain account
  const neg1Signed = tekenAdd(losseMint);
  const neg1 = bouwAdd(losseMint, neg1Signed);
  let neg1Tekst = "";
  try {
    await sendAndConfirmTransaction(connection,
      new Transaction().add(secp256r1Ix(seedKey, neg1Signed.signedMessage, neg1Signed.rawSignature), neg1.ix),
      [payer], { commitment: "confirmed" });
    console.log("  ✗ FOUT: add zonder koppeling SLAAGDE — de binding uit §45 wordt niet afgedwongen.");
    process.exit(1);
  } catch (e: any) {
    neg1Tekst = `${e.message} ${await logsVan(e)}`;
  }
  if (!/3012|AccountNotInitialized/.test(neg1Tekst)) {
    console.log(`  ✗ FOUT: verwachting was 3012 op mint_owner, got: ${neg1Tekst.slice(0, 220)}`);
    process.exit(1);
  }
  if (!/mint_owner/.test(neg1Tekst)) {
    console.log(`  ✗ FOUT: afwijzing niet aan mint_owner toegeschreven: ${neg1Tekst.slice(0, 220)}`);
    process.exit(1);
  }
  console.log("  ✓ geweigerd en aan mint_owner toegeschreven (3012)");

  // Een geweigerde actie laat niets na: noch autorisatie, noch verbruik. Dat is
  // geen bijzaak — consumed staat als ALLERLAATSTE in de accounts-struct, dus een
  // eerdere constraint-faalt vóórdat er rent voor verbruik wordt uitgegeven.
  if (await connection.getAccountInfo(neg1.arPda)) {
    console.log("  ✗ FOUT: er ontstond tóch een AuthorizedRecipient-PDA."); process.exit(1);
  }
  if (await connection.getAccountInfo(neg1.consumedPda)) {
    console.log("  ✗ FOUT: een geweigerde actie liet een consumed-account achter (rent-griefing)."); process.exit(1);
  }
  console.log("  ✓ geen autorisatie-PDA en geen consumed-account achtergelaten\n");

  // ============================================================
  // POS-controle: mét koppeling moet dezelfde add slagen. Zonder deze stap is
  // NEG 1 geen bewijs: dan kan add gewoon kapot zijn en blijft alles groen (§49).
  // ============================================================
  console.log("POS: echte mint + attach_transfer_hook, dan dezelfde add...");
  const mint = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.TransferHook]);
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);
  await sendAndConfirmTransaction(connection, new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey,
      lamports: mintRent, space: mintLen, programId: TOKEN_2022_PROGRAM_ID,
    })), [payer, mint], { commitment: "confirmed" });

  const attachSigned = signChallenge(passkey, buildChallenge(ACTIVE_DEFENSE_ID, walletPda,
    "attach_transfer_hook", Buffer.concat([u64Le(actionNonce), mint.publicKey.toBuffer()])));
  const [emlPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()], ACTIVE_DEFENSE_ID);
  const attachConsumedHash = actieHash(TAG_ATTACH, walletPda, [u64Le(actionNonce), attachSigned.clientDataJSON]);
  const [attachConsumedPda] = deriveConsumedActionPda(walletPda, TAG_ATTACH, attachConsumedHash);
  const attachIx = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false },   // passkeys: None
      { pubkey: mint.publicKey, isSigner: false, isWritable: true },
      { pubkey: emlPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // attach: mint_owner vóór config (declaratievolgorde, zie §64)
      { pubkey: deriveMintOwnerPda(mint.publicKey)[0], isSigner: false, isWritable: true },
      { pubkey: deriveWalletConfigPda()[0], isSigner: false, isWritable: false },
      { pubkey: attachConsumedPda, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([anchorDisc("attach_transfer_hook"), u64Le(actionNonce), borshVecU8(attachSigned.clientDataJSON)]),
  });
  await sendAndConfirmTransaction(connection,
    new Transaction().add(secp256r1Ix(seedKey, attachSigned.signedMessage, attachSigned.rawSignature), attachIx),
    [payer], { commitment: "confirmed" });
  console.log(`  ✓ attach_transfer_hook geslaagd (MintOwner + ExtraAccountMetaList), mint ${mint.publicKey.toBase58()}`);

  const posSigned = tekenAdd(mint.publicKey);
  const pos = bouwAdd(mint.publicKey, posSigned);
  await sendAndConfirmTransaction(connection,
    new Transaction().add(secp256r1Ix(seedKey, posSigned.signedMessage, posSigned.rawSignature), pos.ix),
    [payer], { commitment: "confirmed" });
  console.log("  ✓ dezelfde add is ná de koppeling wél toegestaan");

  const arInfo = await connection.getAccountInfo(pos.arPda, "confirmed");
  if (!arInfo) { console.log("  ✗ FOUT: AuthorizedRecipient-PDA bestaat niet na geslaagde add."); process.exit(1); }
  const leesMint = new PublicKey(arInfo.data.subarray(8, 40));
  const leesRecip = new PublicKey(arInfo.data.subarray(40, 72));
  const leesBump = arInfo.data[72];
  if (arInfo.data.length !== 73 || !leesMint.equals(mint.publicKey) || !leesRecip.equals(recipient) || leesBump !== pos.arBump) {
    console.log(`  ✗ FOUT: gelezen velden kloppen niet (len=${arInfo.data.length}, mint=${leesMint.equals(mint.publicKey)}, recip=${leesRecip.equals(recipient)}, bump=${leesBump} vs ${pos.arBump})`);
    process.exit(1);
  }
  console.log("  ✓ PDA-velden kloppen (mint, recipient, bump)\n");

  // ============================================================
  // NEG 2: dezelfde getekende actie, andere omhullende transactie.
  // Verse blockhash geeft een andere transactiesignatuur; de instructiebytes
  // blijven identiek — dat is de replay uit §57, niet LiteSVM-signatuurdedup.
  // ============================================================
  console.log("NEG 2: exact dezelfde getekende actie opnieuw (andere omhullende transactie)...");
  let neg2Tekst = "";
  try {
    await sendAndConfirmTransaction(connection,
      new Transaction().add(secp256r1Ix(seedKey, posSigned.signedMessage, posSigned.rawSignature), pos.ix),
      [payer], { commitment: "confirmed" });
    console.log("  ✗ FOUT: herhaling van een verbruikte actie SLAAGDE."); process.exit(1);
  } catch (e: any) {
    neg2Tekst = `${e.message} ${await logsVan(e)}`;
  }
  if (!/already in use|Custom\(0\)|0x0/.test(neg2Tekst)) {
    console.log(`  ✗ FOUT: verwachting was een init-botsing, got: ${neg2Tekst.slice(0, 220)}`);
    process.exit(1);
  }
  // Attributie, en de eerlijke grens ervan: bij add botst EERST
  // authorized_recipient (declaratie-index 3); consumed_action staat als laatste
  // en wordt bij deze replay nooit bereikt. Dit script bewijst de afwijzing, niet
  // het consumed-mechanisme — dat doet coverage.rs M1d op de harness (§51).
  const botsOpAr = neg2Tekst.includes(pos.arPda.toBase58());
  const botsOpConsumed = neg2Tekst.includes(pos.consumedPda.toBase58());
  if (!botsOpAr && !botsOpConsumed) {
    console.log(`  ✗ FOUT: botsing niet aan een van beide PDAs toe te schrijven: ${neg2Tekst.slice(0, 260)}`);
    process.exit(1);
  }
  console.log(`  ✓ geweigerd op init-botsing; botsende account is ${botsOpAr ? "authorized_recipient (consumed wordt niet bereikt)" : "consumed_action"}`);

  console.log("\n✓✓✓ GESLAAGD: add heeft de koppeling nodig (NEG 1), werkt mét koppeling (POS), en is niet herhaalbaar (NEG 2) ✓✓✓");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
