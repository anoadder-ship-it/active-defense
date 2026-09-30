/**
 * Atomaire poison-mint tegen het claim-venster van STATUS.md §47 (2026-09-29).
 *
 * §47 maten: gesplitst over transacties claimt élke legitieme wallet de
 * mint→wallet-koppeling op een nog niet ge-attach mint — zonder handtekening van
 * de aanmaker, en met de autorisatielijst als prijs. §48 sloot dat in de Rust-
 * harness: één transactie dicht het venster. Dit script herhaalt die meting op
 * een echte validator via de CLIËNT-BIBLIOTHEEK (`buildAtoomPoisonMintTx`), want
 * "de harness zegt het" is geen bewijs over wat `client/src` daadwerkelijk bouwt.
 *
 * Wat hier gemeten wordt, niet aangenomen:
 *   A1  atoom (createAccount + secp256r1 + attach + InitializeMint2) slaagt
 *   METING  MintOwner.wallet == wallet X
 *   A2  Y's claim in een latere transactie faalt — en wél op het `init`-verbod
 *       (attribution: de handler draait, de `init` van MintOwner botst)
 *   A3  X authoriseert; A4  Y krijgt 6014 op dezelfde mint
 *
 * Gebruik: scripts/localnet.sh --script tests/poisonAtoomIsolated.ts
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
import { getMint, getTransferHook, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import {
  ACTIVE_DEFENSE_PROGRAM_ID,
  INSTRUCTIONS_SYSVAR,
  POISON_MINT_LEN,
  buildAtoomPoisonMintTx,
  buildAddAuthorizedRecipientIx,
  buildAttachTransferHookIx,
  buildChallenge,
  deriveMintOwnerPda,
  generateTestPasskey,
  secp256r1Ix,
  signChallenge,
  TestPasskey,
} from "../client/src/poisonToken";
import { rpcUrl, loadPayer, isLocalnet, beschrijfOpstelling } from "./lib/env";
import { zorgVoorVertrouwensConfig, deriveWalletConfigPda } from "./lib/vertrouwensconfig";

// --- fixture-ID, met dezelfde blocklist als de andere geïsoleerde tests ------
const SPANKWALLET_REAL_ID = "9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9";
const DEFAULT_TEST_SPANKWALLET_ID = "BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk";
const BLOKLIJST = [
  SPANKWALLET_REAL_ID,
  "G1D5ckPj3ZMBeYNfEz24dGhvPExqNP6Y3SFNx3V7RbK5",
  "DGaTtEjHr54MedgZj2CyCpFgH1e6ATNTNweG9v46ypq",
  "8vPFH4YYVzRr2euemkXDHRz2McH58BBKfwJtQUumc8x5",
  "9W3CGKhd7hgywf3xfP8snNmB2AgmzwQ3rdDFDV3hUurK",
];
function resolveSpankwalletTestId(): PublicKey {
  const raw = process.env.SPANKWALLET_TEST_PROGRAM_ID ?? DEFAULT_TEST_SPANKWALLET_ID;
  const id = new PublicKey(raw);
  if (BLOKLIJST.includes(id.toBase58())) {
    throw new Error(`SPANKWALLET_TEST_PROGRAM_ID (${id.toBase58()}) staat op de blocklist`);
  }
  return id;
}
const SPANKWALLET_ID = resolveSpankwalletTestId();

// --- kleine lokale helpers (niet door de cliënt exported) --------------------
function anchorDisc(ix: string): Buffer {
  return createHash("sha256").update(`global:${ix}`).digest().subarray(0, 8);
}
function borshVecU8(d: Buffer): Buffer {
  const l = Buffer.alloc(4); l.writeUInt32LE(d.length); return Buffer.concat([l, d]);
}
function borshOptionI64(v: number | null): Buffer {
  if (v === null) return Buffer.from([0]);
  const b = Buffer.alloc(9); b[0] = 1; b.writeBigInt64LE(BigInt(v), 1); return b;
}
function encodeOptionalI64Challenge(v: number | null): Buffer {
  const b = Buffer.alloc(9); if (v !== null) { b[0] = 1; b.writeBigInt64LE(BigInt(v), 1); } return b;
}
function u64Le(v: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; }

function faal(m: string): never { console.log(`  ✗✗✗ FAAL: ${m}`); process.exit(1); }

/** Wallet aanmaken op de fixture via een echte init_wallet (geen setAccount-truc). */
async function initWallet(connection: Connection, payer: Keypair): Promise<{ pk: TestPasskey; walletPda: PublicKey }> {
  const pk = generateTestPasskey();
  const seedKey = pk.compressedPublicKey;
  const hash = createHash("sha256").update(seedKey).digest();
  const [walletPda] = PublicKey.findProgramAddressSync([Buffer.from("wallet"), hash], SPANKWALLET_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), walletPda.toBuffer()], SPANKWALLET_ID);

  const backupAuthority = Keypair.generate().publicKey;
  const payload = Buffer.concat([backupAuthority.toBuffer(), encodeOptionalI64Challenge(null)]);
  const challenge = buildChallenge(SPANKWALLET_ID, walletPda, "init_wallet", payload);
  const signed = signChallenge(pk, challenge);
  const data = Buffer.concat([
    anchorDisc("init_wallet"), seedKey, hash, backupAuthority.toBuffer(),
    borshOptionI64(null), borshVecU8(signed.clientDataJSON),
  ]);
  const ix = new TransactionInstruction({
    programId: SPANKWALLET_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  const t = new Transaction().add(secp256r1Ix(seedKey, signed.signedMessage, signed.rawSignature), ix);
  await sendAndConfirmTransaction(connection, t, [payer], { commitment: "confirmed" });
  return { pk, walletPda };
}

/** action_nonce uitlezen — zelfde offset-logica als attachTransferHookIsolated.ts. */
async function readNonce(connection: Connection, walletPda: PublicKey): Promise<bigint> {
  const info = await connection.getAccountInfo(walletPda, "confirmed");
  if (!info) faal(`wallet ${walletPda.toBase58()} bestaat niet`);
  let off = 148;
  if (info!.data[off] === 1) off += 41; off += 1;   // recovery_seed tag
  off += 8;                                          // created_at
  if (info!.data[off] === 1) off += 32; off += 1;   // delegated_agent tag
  return info!.data.readBigUInt64LE(off);
}

async function main() {
  console.log("=== atomaire poison-mint tegen het claim-venster (§47/§48) ===\n");
  console.log(`  ${beschrijfOpstelling()}`);

  // Wachter: deze test schrijft wallets, mints en PDAs. Op een publiek netwerk is
  // dat geen test maar gebruik — en de defaults van dit project wijzen naar devnet
  // (zie tests/lib/env.ts: elke run schreef daar eerder echte accounts).
  // Bewust publiek toestaan kan met AD_TAST_PUBIEK=1.
  if (!isLocalnet() && process.env.AD_TAST_PUBIEK !== "1") {
    console.log("  ✗ FAAL: deze test schrijft wallets, mints en PDAs — op een publiek");
    console.log("    netwerk is dat geen test maar gebruik.");
    console.log(`    ${beschrijfOpstelling()}`);
    console.log("    Zet AD_RPC_URL op een localnet (scripts/localnet.sh --script …),");
    console.log("    of AD_TAST_PUBIEK=1 als je het bewust en expliciet doet.");
    process.exit(1);
  }

  const connection = new Connection(rpcUrl(), "confirmed");
  const payer = loadPayer();
  console.log(`  payer ${payer.publicKey.toBase58()} — ${(await connection.getBalance(payer.publicKey) / 1e9).toFixed(4)} SOL\n`);

  await zorgVoorVertrouwensConfig(connection, payer, SPANKWALLET_ID, "CONFIG");

  console.log("STAP 1: twee wallets X en Y (twee échte init_wallet's)...");
  const X = await initWallet(connection, payer);
  const Y = await initWallet(connection, payer);
  console.log(`  X: ${X.walletPda.toBase58()}`);
  console.log(`  Y: ${Y.walletPda.toBase58()}\n`);

  // ---- A1: de atoom-transactie, gebouwd door de cliënt-bibliotheek ----------
  console.log("STAP 2 (A1): buildAtoomPoisonMintTx — één transactie, vier instructies...");
  const nonceX = await readNonce(connection, X.walletPda);
  const mintKeypair = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(POISON_MINT_LEN);
  const attachPayload = Buffer.concat([u64Le(nonceX), mintKeypair.publicKey.toBuffer()]);
  const attachChallenge = buildChallenge(ACTIVE_DEFENSE_PROGRAM_ID, X.walletPda, "attach_transfer_hook", attachPayload);
  const attachSigned = signChallenge(X.pk, attachChallenge);
  const { tx } = buildAtoomPoisonMintTx({
    walletPda: X.walletPda,
    payer: payer.publicKey,
    mintKeypair,
    mintRentLamports: rent,
    clientActionNonce: nonceX,
    attachClientDataJson: attachSigned.clientDataJSON,
    passkeyPubkey: X.pk.compressedPublicKey,
    signedMessage: attachSigned.signedMessage,
    rawSignature: attachSigned.rawSignature,
    decimals: 6,
  });
  console.log(`  instructies in één boodschap: ${tx.instructions.length} (verwacht 4)`);
  if (tx.instructions.length !== 4) faal("atoom-boodschap heeft niet vier instructies");
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair], { commitment: "confirmed" });
    console.log(`  ✓ A1 atoom geslaagd: ${sig}\n`);
  } catch (e: any) {
    faal(`A1 atoom faalde: ${String(e.message).split("\n")[0]}`);
  }

  // ---- METING: MintOwner.wallet -------------------------------------------
  const mintOwnerPda = deriveMintOwnerPda(mintKeypair.publicKey)[0];
  const mo = await connection.getAccountInfo(mintOwnerPda, "confirmed");
  if (!mo) faal("MintOwner-PDA bestaat niet na de atoom");
  if (mo!.data.length !== 73) faal(`MintOwner heeft ${mo!.data.length} byte, verwacht 73`);
  const gebondenWallet = new PublicKey(mo!.data.subarray(40, 72));
  console.log("STAP 3 (METING): MintOwner gelezen uit de chain...");
  console.log(`  MintOwner.wallet: ${gebondenWallet.toBase58()}`);
  if (!gebondenWallet.equals(X.walletPda)) faal("binding wijst naar een ANDERE wallet dan X");
  console.log("  ✓ binding staat op X (de aanmaker)\n");

  // ---- A2: Y claimt in een latere transactie ------------------------------
  console.log("STAP 4 (A2): Y probeert de koppeling te claimen (latere transactie)...");
  const nonceY = await readNonce(connection, Y.walletPda);
  const yPayload = Buffer.concat([u64Le(nonceY), mintKeypair.publicKey.toBuffer()]);
  const yChallenge = buildChallenge(ACTIVE_DEFENSE_PROGRAM_ID, Y.walletPda, "attach_transfer_hook", yPayload);
  const ySigned = signChallenge(Y.pk, yChallenge);
  const yAttachTx = new Transaction().add(
    secp256r1Ix(Y.pk.compressedPublicKey, ySigned.signedMessage, ySigned.rawSignature),
    buildAttachTransferHookIx(Y.walletPda, mintKeypair.publicKey, payer.publicKey, nonceY, ySigned.clientDataJSON),
  );
  let a2Faalde = false; let a2Hoop = "";
  try {
    await sendAndConfirmTransaction(connection, yAttachTx, [payer], { commitment: "confirmed" });
  } catch (e: any) {
    a2Faalde = true;
    a2Hoop = String(e.message);
    try { a2Hoop += " " + JSON.stringify(await e.getLogs(connection)); } catch { /* logs niet beschikbaar */ }
  }
  if (!a2Faalde) faal("A2: Y's claim SLAAGDE — het venster is op deze weg open");
  const initVerbod = /custom program error: 0x0\b|already in use/i.test(a2Hoop);
  const handlerDraaide = a2Hoop.includes("AttachTransferHook");
  console.log(`  eerste regel: ${a2Hoop.split("\n")[0].trim().slice(0, 120)}`);
  if (!handlerDraaide) faal("A2: falen komt niet uit de handler — attributie onduidelijk (geen 'AttachTransferHook' in logs)");
  if (!initVerbod) faal(`A2: falen is niet het init-verbod — wat is dit wel? ${a2Hoop.slice(0, 300)}`);
  console.log("  ✓ A2 geweigerd, en wél op het init-verbod (niet op een toevallige accountfout)\n");

  // ---- A3/A4: autorisatierecht volgt de binding ---------------------------
  console.log("STAP 5 (A3/A4): wie mag er autoriseren op deze mint?");
  // Twee VERSCHILLENDE recipients: A3 en A4 delen niets. Met één gedeelde
  // recipient botst A4 namelijk op de `init` van de AuthorizedRecipient-PDA die
  // A3 al aanmaakte (Custom(0)) — dan meet je de botsing, niet de binding.
  // Gemeten in de eerste run: precies dat, en het kostte een validator-run.
  const recipientX = Keypair.generate().publicKey;
  const recipientY = Keypair.generate().publicKey;
  async function add(walletPda: PublicKey, pk: TestPasskey, recipient: PublicKey) {
    const n = await readNonce(connection, walletPda);
    const p = Buffer.concat([u64Le(n), mintKeypair.publicKey.toBuffer(), recipient.toBuffer()]);
    const ch = buildChallenge(ACTIVE_DEFENSE_PROGRAM_ID, walletPda, "add_authorized_recipient", p);
    const s = signChallenge(pk, ch);
    const t = new Transaction().add(
      secp256r1Ix(pk.compressedPublicKey, s.signedMessage, s.rawSignature),
      buildAddAuthorizedRecipientIx(walletPda, mintKeypair.publicKey, recipient, payer.publicKey, n, s.clientDataJSON),
    );
    try {
      await sendAndConfirmTransaction(connection, t, [payer], { commitment: "confirmed" });
      return { ok: true as const, msg: "" };
    } catch (e: any) {
      let hoop = String(e.message);
      try { hoop += " " + JSON.stringify(await e.getLogs(connection)); } catch { /* idem */ }
      return { ok: false as const, msg: hoop };
    }
  }
  const a3 = await add(X.walletPda, X.pk, recipientX);
  if (!a3.ok) faal(`A3: X kon niet autoriseren op z'n eigen atomaire mint: ${a3.msg.slice(0, 200)}`);
  console.log("  ✓ A3 X authoriseert: toegestaan");
  const a4 = await add(Y.walletPda, Y.pk, recipientY);
  if (a4.ok) faal("A4: Y mocht autoriseren op X' mint — binding geeft geen recht?");
  if (!/0x177e|6014/i.test(a4.msg)) faal(`A4: verwachte 6014 (0x177e), kreeg: ${a4.msg.slice(0, 200)}`);
  console.log("  ✓ A4 Y authoriseert: geweigerd met 6014\n");

  // ---- Navraag: is de mint wél geïnitialiseerd (InitializeMint2 in de atoom)?
  const m = await getMint(connection, mintKeypair.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
  const hook = getTransferHook(m);
  console.log("STAP 6: mint na de atoom — InitializeMint2 en hook...");
  console.log(`  decimals ${m.decimals}, supply ${m.supply}, isInitialized ${m.isInitialized}`);
  if (!hook || !hook.programId.equals(ACTIVE_DEFENSE_PROGRAM_ID)) faal("TransferHook wijst niet naar active-defense");
  console.log(`  ✓ hook → ${hook.programId.toBase58()}\n`);

  console.log("✓✓✓ ATOOM-RONDE GROEN: client-bibliotheek sluit het claim-venster op een echte validator");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
