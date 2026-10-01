/**
 * mark_malicious / unmark_malicious — replay op een ECHTE validator (STATUS §64).
 *
 * Waarom dit script bestaat: het consumed-mechanisme uit §64 was tot nu toe alleen
 * bewezen in LiteSVM (`coverage.rs` M1d). LiteSVM is niet de runtime waarop dit
 * programma draait; Agave is dat. Dit script zet dezelfde aanval op een echte
 * validator en gebruikt daarbij de CLIËNT-builders, niet een handbouw-kopie — dus
 * wat getest wordt is precies wat een wallet of dApp zou verzenden.
 *
 *   POS 1  mark_malicious(adres) slaagt; count 0 -> 1.
 *   POS 2  unmark_malicious(adres) slaagt; count 1 -> 0. Dit is de staat-terug-zet
 *          die in §57 het gat opende: zonder verbruikbewijs is de oude handtekening
 *          daarna weer geldig.
 *   NEG    exact dezelfde getekende mark-bytes opnieuw, in een ANDERE omhullende
 *          transactie (verse blockhash -> andere transactiesignatuur, identieke
 *          instructiebytes). Moet geweigerd worden. Attributie is hier de kern:
 *          count staat op 0, dus 6006 AddressAlreadyMalicious kan het niet zijn;
 *          de enige create_account in dit pad is die van het consumed-account.
 *
 * Bijkomend vastgelegd: beide geslaagde acties laten elk een eigen
 * consumed-account na. Dat is de afweging uit §64 (rent per actie, geen close-pad)
 * zichtbaar gemaakt, niet verborgen.
 *
 * Gebruik (localnet vereist):
 *   AD_RPC_URL=http://127.0.0.1:13399 \
 *   AD_PAYER=~/.config/active-defense/localnet-payer-keypair.json \
 *   npx ts-node tests/markUnmarkReplayIsolated.ts
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

import {
  ACTIVE_DEFENSE_PROGRAM_ID,
  INSTRUCTIONS_SYSVAR,
  buildChallenge,
  buildMarkMaliciousIx,
  buildUnmarkMaliciousIx,
  deriveConsumedActionPda,
  deriveMaliciousPda,
  generateTestPasskey,
  actieHash,
  secp256r1Ix,
  signChallenge,
  TAG_MARK,
  TAG_UNMARK,
} from "../client/src/poisonToken";
import { rpcUrl, loadPayer, isLocalnet } from "./lib/env";
import { zorgVoorVertrouwensConfig } from "./lib/vertrouwensconfig";

// Zelfde blocklist als de andere geïsoleerde tests: de echte spankwallet-ID mag
// nooit een test-ontvanger zijn (STATUS §36).
const DEFAULT_TEST_SPANKWALLET_ID = "BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk";
const BLOKLIJST = [
  "9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9", // echte spankwallet
  "G1D5ckPj3ZMBeYNfEz24dGhvPExqNP6Y3SFNx3V7RbK5",
  "DGaTtEjHr54MedgZj2CyCpFgH1e6ATNTNweG9v46ypq",
  "8vPFH4YYVzRr2euemkXDHRz2McH58BBKfwJtQUumc8x5",
  "9W3CGKhd7hgywf3xfP8snNmB2AgmzwQ3rdDFDV3hUurK",
];
if (BLOKLIJST.includes(DEFAULT_TEST_SPANKWALLET_ID)) {
  console.log("FOUT: test-fixture valt op de blocklist");
  process.exit(1);
}
const SPANKWALLET_ID = new PublicKey(DEFAULT_TEST_SPANKWALLET_ID);

// --- helpers voor het spankwallet-init-datagram (lokale kopieën, zoals de
// andere geïsoleerde tests die ook lokaal hebben) ---
function anchorDisc(ix: string): Buffer {
  return createHash("sha256").update(`global:${ix}`).digest().subarray(0, 8);
}
function u64Le(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v));
  return b;
}
function borshVecU8(data: Buffer): Buffer {
  const l = Buffer.alloc(4);
  l.writeUInt32LE(data.length);
  return Buffer.concat([l, data]);
}
function borshOptionI64(value: number | null): Buffer {
  if (value === null) return Buffer.from([0]);
  const b = Buffer.alloc(9);
  b[0] = 1;
  b.writeBigInt64LE(BigInt(value), 1);
  return b;
}
function encodeOptionalI64Challenge(value: number | null): Buffer {
  const b = Buffer.alloc(9);
  if (value !== null) b.writeBigInt64LE(BigInt(value), 1);
  return b;
}

/** Leest count en entries uit een MaliciousAddressesAccount.
 *  Layout (state.rs): disc(8) + wallet(32) + bump(1) + count(1) + 32 x Pubkey. */
function leesMarkering(data: Buffer): { wallet: PublicKey; count: number; entries: PublicKey[] } {
  const wallet = new PublicKey(data.subarray(8, 40));
  const count = data[41];
  const entries: PublicKey[] = [];
  for (let i = 0; i < count; i++) entries.push(new PublicKey(data.subarray(42 + 32 * i, 74 + 32 * i)));
  return { wallet, count, entries };
}

async function logsVan(e: any): Promise<string> {
  try {
    const l = await e.getLogs();
    return Array.isArray(l) ? l.join(" / ") : String(l ?? "");
  } catch {
    return "";
  }
}

function faal(m: string): never {
  console.log(`  ✗ FOUT: ${m}`);
  process.exit(1);
}

async function main() {
  console.log("=== mark/unmark replay op een echte validator (STATUS §64) ===\n");
  if (!isLocalnet()) {
    faal("dit script schrijft accounts; het draait alleen tegen localnet (AD_RPC_URL)");
  }
  const connection = new Connection(rpcUrl(), "confirmed");
  const payer = loadPayer();
  console.log(`  RPC      : ${rpcUrl()}`);
  console.log(`  Payer    : ${payer.publicKey.toBase58()}`);
  console.log(`  Balance  : ${(await connection.getBalance(payer.publicKey) / 1e9).toFixed(4)} SOL\n`);

  // ============================================================
  // STAP A: eigen wallet op de spankwallet-testfixture
  // ============================================================
  const passkey = generateTestPasskey();
  const seedKey = passkey.compressedPublicKey;
  const walletSeedHash = createHash("sha256").update(seedKey).digest();
  const [walletPda] = PublicKey.findProgramAddressSync([Buffer.from("wallet"), walletSeedHash], SPANKWALLET_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), walletPda.toBuffer()], SPANKWALLET_ID);

  const backupAuthority = Keypair.generate().publicKey;
  const initPayload = Buffer.concat([backupAuthority.toBuffer(), encodeOptionalI64Challenge(null)]);
  const initSigned = signChallenge(passkey, buildChallenge(SPANKWALLET_ID, walletPda, "init_wallet", initPayload));
  const initIx = new TransactionInstruction({
    programId: SPANKWALLET_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      anchorDisc("init_wallet"), seedKey, walletSeedHash, backupAuthority.toBuffer(),
      borshOptionI64(null), borshVecU8(initSigned.clientDataJSON),
    ]),
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(secp256r1Ix(seedKey, initSigned.signedMessage, initSigned.rawSignature), initIx),
    [payer],
    { commitment: "confirmed" }
  );
  console.log(`STAP A: wallet ${walletPda.toBase58()} geïnitialiseerd`);

  const walletInfo = await connection.getAccountInfo(walletPda, "confirmed");
  if (!walletInfo) faal("wallet-PDA bestaat niet na init_wallet");
  // action-nonce uitlezen op dezelfde wijze als de andere geïsoleerde tests
  let off = 148;
  const rsTag = walletInfo.data[off]; off += 1;
  if (rsTag === 1) off += 41;
  off += 8;
  const daTag = walletInfo.data[off]; off += 1;
  if (daTag === 1) off += 32;
  const actionNonce = walletInfo.data.readBigUInt64LE(off);
  console.log(`         action nonce = ${actionNonce}\n`);

  await zorgVoorVertrouwensConfig(connection, payer, SPANKWALLET_ID, "CONFIG");

  const [malPda] = deriveMaliciousPda(walletPda);
  const doel = Keypair.generate().publicKey;

  const teken = (ixNaam: string) => {
    const payload = Buffer.concat([u64Le(actionNonce), doel.toBuffer()]);
    return signChallenge(passkey, buildChallenge(ACTIVE_DEFENSE_PROGRAM_ID, walletPda, ixNaam, payload));
  };

  // ============================================================
  // POS 1: mark_malicious
  // ============================================================
  console.log("POS 1: mark_malicious via de cliënt-builder ...");
  const markSigned = teken("mark_malicious");
  const markIx = buildMarkMaliciousIx(walletPda, doel, payer.publicKey, actionNonce, markSigned.clientDataJSON);
  const markTx = new Transaction().add(secp256r1Ix(seedKey, markSigned.signedMessage, markSigned.rawSignature), markIx);
  await sendAndConfirmTransaction(connection, markTx, [payer], { commitment: "confirmed" });

  const naMark = await connection.getAccountInfo(malPda, "confirmed");
  if (!naMark) faal("MaliciousAddresses-PDA bestaat niet na mark");
  let s = leesMarkering(naMark.data);
  if (s.count !== 1 || !s.entries[0].equals(doel)) faal(`verwacht count 1 met ${doel.toBase58()}, got count=${s.count}`);
  console.log(`  ✓ count 0 -> 1, entry = ${doel.toBase58()}`);

  // ============================================================
  // POS 2: unmark_malicious — dit zet de staat terug en opende in §57 het gat
  // ============================================================
  console.log("POS 2: unmark_malicious (staat terugzetten) ...");
  const unmarkSigned = teken("unmark_malicious");
  const unmarkIx = buildUnmarkMaliciousIx(walletPda, doel, payer.publicKey, actionNonce, unmarkSigned.clientDataJSON);
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(secp256r1Ix(seedKey, unmarkSigned.signedMessage, unmarkSigned.rawSignature), unmarkIx),
    [payer],
    { commitment: "confirmed" }
  );
  const naUnmark = await connection.getAccountInfo(malPda, "confirmed");
  if (!naUnmark) faal("MaliciousAddresses-PDA verdween na unmark");
  s = leesMarkering(naUnmark.data);
  if (s.count !== 0) faal(`verwacht count 0 na unmark, got ${s.count}`);
  console.log("  ✓ count 1 -> 0; de oude handtekening is hiermee in principe weer 'geldig'");

  // Verbruik-identiteiten van beide geslaagde acties. De bijbehorende accounts worden
  // PAS ná NEG opgeëist: wie eerst controleert of het verbruikaccount bestaat, struikelt
  // over een pre-§64-programma vóórdat de replay zelf is uitgeprobeerd — en mist dan
  // precies het gat uit §57. Meten wat je wilt weerleggen, niet wat handig uitkomt.
  const [markConsumed] = deriveConsumedActionPda(
    walletPda, TAG_MARK, actieHash(TAG_MARK, walletPda, [doel.toBuffer(), u64Le(actionNonce), markSigned.clientDataJSON]));
  const [unmarkConsumed] = deriveConsumedActionPda(
    walletPda, TAG_UNMARK, actieHash(TAG_UNMARK, walletPda, [doel.toBuffer(), u64Le(actionNonce), unmarkSigned.clientDataJSON]));

  // ============================================================
  // NEG: dezelfde bytes, andere omhullende transactie
  // ============================================================
  console.log("NEG: exact dezelfde getekende mark-bytes, nieuwe omhullende transactie ...");
  let tekst = "";
  try {
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(secp256r1Ix(seedKey, markSigned.signedMessage, markSigned.rawSignature), markIx),
      [payer],
      { commitment: "confirmed" }
    );
    faal("replay van een verbruikte mark werd TOEGESTAAN op een echte validator — §64 faalt daar");
  } catch (e: any) {
    tekst = `${e.message} ${await logsVan(e)}`;
  }

  // 1. niet de verkeerde reden: count staat op 0, dus 6006 kan hier niet spelen.
  if (/6006|AddressAlreadyMalicious/.test(tekst)) {
    faal(`afwijzing kwam door AddressAlreadyMalicious (6006), niet door verbruik: ${tekst.slice(0, 220)}`);
  }
  // 2. wel de goede reden: een init-botsing in de systeem-laag.
  if (!/already in use|Custom\(0\)/.test(tekst)) {
    faal(`verwacht een init-botsing (already in use / Custom(0)), got: ${tekst.slice(0, 260)}`);
  }
  // 3. attributie: als de log een van beide PDAs noemt, moet het het
  //    verbruikaccount zijn en niet de markeringslijst (§51).
  const noemtConsumed = tekst.includes(markConsumed.toBase58());
  const noemtMalList = tekst.includes(malPda.toBase58());
  if (noemtMalList && !noemtConsumed) {
    faal(`botsing toegeschreven aan de markeringslijst-PDA, niet aan consumed: ${tekst.slice(0, 260)}`);
  }
  console.log(`  ✓ geweigerd; log noemt ${noemtConsumed ? "het consumed-account" : "geen van beide PDAs"}${noemtMalList ? " (wél de lijst-PDA!)" : ""}`);

  // 4. geen staat achtergelaten
  const naReplay = leesMarkering((await connection.getAccountInfo(malPda, "confirmed"))!.data);
  if (naReplay.count !== 0) faal(`replay liet count ${naReplay.count} achter`);
  console.log("  ✓ count blijft 0 — de geweigerde replay liet geen staat achter");

  // Elke geslaagde actie laat eigen verbruik na — de afweging uit §64 (rent per actie,
  // geen close-pad) zichtbaar gemaakt in plaats van verborgen.
  for (const [naam, pda] of [["mark", markConsumed], ["unmark", unmarkConsumed]] as const) {
    if (!(await connection.getAccountInfo(pda))) faal(`consumed-account van ${naam} ontbreekt na een geslaagde actie`);
  }
  console.log(`  ✓ twee verbruikaccounts aanwezig (${markConsumed.toBase58().slice(0, 4)}… en ${unmarkConsumed.toBase58().slice(0, 4)}…)\n`);

  console.log("✓✓✓ GESLAAGD: mark/unmark werken op een echte validator en de onderschepte");
  console.log("    handtekening herrijst niet — §64 geldt dus buiten LiteSVM om ✓✓✓");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
