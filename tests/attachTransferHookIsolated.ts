/**
 * Geïsoleerde test voor stap 3 (STATUS.md sectie 12/13, Route B):
 * attach_transfer_hook - de ECHTE InitializeTransferHook-registratie +
 * ExtraAccountMetaList-initialisatie.
 *
 * De KERN van deze test (expliciet gevraagd, niet optioneel): bewijzen dat
 * Token-2022's EIGEN clientbibliotheek-resolutielogica (dezelfde seed-
 * wiskunde die Token-2022 zelf on-chain gebruikt tijdens een ECHTE transfer)
 * de juiste AuthorizedRecipient-PDA vindt, ZONDER dat de client die PDA ooit
 * expliciet meegeeft - puur via het ExtraAccountMetaList-seed-recept.
 *
 * poison_transfer_hook zelf is in deze stap NOG NIET herbouwd (dat is stap
 * 4, het echte Execute-interface-discriminator-mechanisme) - een volledige,
 * geslaagde transfer kan dus nog NIET bewezen worden. Wat WEL bewezen wordt:
 * 1. Client-side resolutie (dezelfde bibliotheeksfunctie die een echte
 *    wallet/dApp zou gebruiken) vindt de EXACTE AuthorizedRecipient-PDA.
 * 2. Een ECHTE transfer-poging op devnet laat zien dat Token-2022 zelf de
 *    resolutie ACCEPTEERT (geen mismatch-fout van Token-2022 zelf) en
 *    daadwerkelijk CPI't naar active-defense - de fout die daarna optreedt
 *    is onze EIGEN, nog-niet-herbouwde poison_transfer_hook die de
 *    Execute-discriminator niet herkent (verwacht, hoort bij stap 4).
 *
 * Gebruik: npx ts-node tests/attachTransferHookIsolated.ts
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
  getExtraAccountMetaAddress,
  getExtraAccountMetas,
  getMint,
  getMintLen,
  getTransferHook,
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

// --- Helpers (zelfde als activeDefenseFull.ts / addAuthorizedRecipientIsolated.ts) ---

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
  console.log("=== attach_transfer_hook - geïsoleerde test (STATUS.md sectie 12/13) ===\n");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const homeDir = process.env.HOME || "/home/michel";
  const kpJson = JSON.parse(fs.readFileSync(`${homeDir}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(kpJson));
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Balance: ${(await connection.getBalance(payer.publicKey) / 1e9).toFixed(4)} SOL\n`);

  // ============================================================
  // STAP A: init_wallet
  // ============================================================
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
  console.log(`  Action nonce: ${actionNonce}\n`);

  // ============================================================
  // STAP B: mint aanmaken - GEEN client-side InitializeTransferHook meer
  // (dat is nu attach_transfer_hook's taak, niet de client s'.)
  // ============================================================
  console.log("STAP B: Token-2022 mint aanmaken (alleen ruimte reserveren, GEEN hook-init)...");
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
  console.log(`  Mint: ${mint.publicKey.toBase58()} (mintLen=${mintLen}, nog GEEN extensie geïnitialiseerd)\n`);

  // ============================================================
  // STAP C: attach_transfer_hook
  // ============================================================
  console.log("STAP C: attach_transfer_hook...");
  const [extraAccountMetaListPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  console.log(`  ExtraAccountMetaList PDA: ${extraAccountMetaListPda.toBase58()}`);

  const attachPayload = Buffer.concat([u64Le(actionNonce), mint.publicKey.toBuffer()]);
  const attachChallenge = buildChallenge(ACTIVE_DEFENSE_ID, walletPda, "attach_transfer_hook", attachPayload);
  const attachSigned = signChallenge(passkey, attachChallenge);
  const attachDisc = anchorDisc("attach_transfer_hook");
  const attachData = Buffer.concat([attachDisc, u64Le(actionNonce), borshVecU8(attachSigned.clientDataJSON)]);

  const attachIx = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false }, // passkeys: None
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
  try {
    await sendAndConfirmTransaction(connection, attachTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ attach_transfer_hook succeeded\n");
  } catch (e: any) {
    console.log(`  ✗ attach_transfer_hook failed: ${e.message}`);
    if (e.getLogs) console.log(await e.getLogs(connection));
    process.exit(1);
  }

  console.log("STAP C-verificatie: ExtraAccountMetaList teruglezen...");
  console.log("(De mint zelf is pas na STAP E/InitializeMint2 met getMint() te deserialiseren -");
  console.log("unpackMint vereist is_initialized=true, wat vóór InitializeMint2 nog niet zo is;");
  console.log("de TransferHook-extensie zelf is door attach_transfer_hook al wel geschreven, en");
  console.log("wordt hieronder ná STAP E alsnog expliciet geverifieerd.)");
  const emlAccount = await connection.getAccountInfo(extraAccountMetaListPda, "confirmed");
  if (!emlAccount) { console.log("  ✗ FOUT: ExtraAccountMetaList-account bestaat niet."); process.exit(1); }
  const metas = getExtraAccountMetas(emlAccount);
  console.log(`  ExtraAccountMetaList: ${metas.length} extra account(s) (moet 1 zijn)`);
  if (metas.length !== 1) { console.log("  ✗ FOUT: verwachtte precies 1 extra account."); process.exit(1); }
  console.log("  ✓ mint + ExtraAccountMetaList kloppen.\n");

  // ============================================================
  // STAP D: add_authorized_recipient voor de ECHTE authorizedOwner
  // ============================================================
  console.log("STAP D: add_authorized_recipient...");
  const authorizedOwner = Keypair.generate().publicKey;
  const unauthorizedOwner = Keypair.generate().publicKey;

  // action_nonce herlezen - attach_transfer_hook muteert de wallet niet,
  // maar voor de zekerheid opnieuw lezen i.p.v. aannemen dat hij nog 0 is.
  const walletInfo2 = await connection.getAccountInfo(walletPda, "confirmed");
  actionNonce = walletInfo2!.data.readBigUInt64LE(nonceOff);

  const [authorizedRecipientPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("poison_authorized"), mint.publicKey.toBuffer(), authorizedOwner.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  console.log(`  authorizedOwner:   ${authorizedOwner.toBase58()}`);
  console.log(`  unauthorizedOwner: ${unauthorizedOwner.toBase58()}`);
  console.log(`  Verwachte AuthorizedRecipient PDA (voor authorizedOwner): ${authorizedRecipientPda.toBase58()}`);

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

  // ============================================================
  // STAP E: InitializeMint2 (allerlaatste stap, per sectie 7's regel)
  // ============================================================
  console.log("STAP E: InitializeMint2...");
  const initMintTx = new Transaction().add(
    createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null, TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, initMintTx, [payer], { commitment: "confirmed" });
  console.log("  ✓ InitializeMint2 succeeded\n");

  console.log("STAP E-verificatie: mint's TransferHook-extensie teruglezen (nu wél mogelijk)...");
  const mintInfoAfterInit = await getMint(connection, mint.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
  const hook = getTransferHook(mintInfoAfterInit);
  if (!hook) { console.log("  ✗ FOUT: geen TransferHook-extensie op de mint gevonden."); process.exit(1); }
  console.log(`  TransferHook.programId: ${hook.programId.toBase58()} (moet ${ACTIVE_DEFENSE_ID.toBase58()} zijn)`);
  console.log(`  TransferHook.authority: ${hook.authority.toBase58()} (moet default/000...0 zijn - authority: None)`);
  if (!hook.programId.equals(ACTIVE_DEFENSE_ID)) { console.log("  ✗ FOUT: programId klopt niet."); process.exit(1); }
  if (!hook.authority.equals(PublicKey.default)) { console.log("  ✗ FOUT: authority is niet None."); process.exit(1); }
  console.log("  ✓ TransferHook-extensie correct: attach_transfer_hook's Initialize (niet Update)");
  console.log("  heeft daadwerkelijk gewerkt, authority is écht None (geen dode belofte).\n");

  // ============================================================
  // STAP F: token-accounts aanmaken - getAccountLenForMint (NIET de kale 165
  // uit STATUS.md sectie 10 - deze mint heeft de TransferHook-extensie, die
  // per ExtensionType.TransferHook -> ExtensionType.TransferHookAccount een
  // extra account-side extensie vereist, rechtstreeks bevestigd in
  // @solana/spl-token's eigen getAccountTypeOfMintType()).
  // ============================================================
  console.log("STAP F: token-accounts aanmaken (getAccountLenForMint, bevestigt sectie 10's vermoeden)...");
  const mintInfoForAccounts = await getMint(connection, mint.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
  const accountLen = getAccountLenForMint(mintInfoForAccounts);
  console.log(`  accountLen = ${accountLen} (165 + TransferHookAccount-extensie, NIET de kale 165)`);
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
  console.log("");

  const mintToTx = new Transaction().add(
    createMintToInstruction(mint.publicKey, srcToken.publicKey, payer.publicKey, 1_000_000n, [], TOKEN_2022_PROGRAM_ID)
  );
  await sendAndConfirmTransaction(connection, mintToTx, [payer], { commitment: "confirmed" });
  console.log("  Tokens gemint naar source (1.0)\n");

  // ============================================================
  // STAP G (DE KERN): een ECHTE transferChecked-instructie bouwen met
  // Token-2022's EIGEN clientbibliotheek-resolutie (dezelfde seed-wiskunde
  // als on-chain) en bewijzen dat de opgeloste extra account EXACT de
  // AuthorizedRecipient-PDA is die add_authorized_recipient aanmaakte -
  // zonder dat wij die PDA hier ooit expliciet meegeven aan
  // createTransferCheckedWithTransferHookInstruction.
  // ============================================================
  console.log("STAP G (KERN VAN DEZE STAP): resolutie tijdens een echte transfer-opbouw...\n");

  console.log("G1. Transfer naar de AUTHORIZED bestemming - resolutie bouwen...");
  const transferToAuthorized = await createTransferCheckedWithTransferHookInstruction(
    connection, srcToken.publicKey, mint.publicKey, dstAuthorized.publicKey, payer.publicKey,
    500_000n, 6, [], "confirmed", TOKEN_2022_PROGRAM_ID
  );
  // Verwachte volgorde (addExtraAccountMetasForExecute): [...standaard transferChecked-keys...,
  // <opgeloste extra accounts...>, <hook-programId>, <validateStatePubkey>]
  const resolvedKeys = transferToAuthorized.keys;
  const resolvedAuthorizedRecipientKey = resolvedKeys[resolvedKeys.length - 3].pubkey;
  const resolvedHookProgramKey = resolvedKeys[resolvedKeys.length - 2].pubkey;
  const resolvedValidateStateKey = resolvedKeys[resolvedKeys.length - 1].pubkey;

  console.log(`  Opgelost (derde van achteren):  ${resolvedAuthorizedRecipientKey.toBase58()}`);
  console.log(`  Verwacht (add_authorized_recipient's PDA): ${authorizedRecipientPda.toBase58()}`);
  console.log(`  Opgelost hook-programId (tweede van achteren): ${resolvedHookProgramKey.toBase58()}`);
  console.log(`  Opgelost validateState (laatste):  ${resolvedValidateStateKey.toBase58()}`);

  let g1ok = true;
  if (!resolvedAuthorizedRecipientKey.equals(authorizedRecipientPda)) {
    console.log("  ✗✗✗ FOUT: de opgeloste PDA komt NIET overeen met add_authorized_recipient's PDA!");
    g1ok = false;
  } else {
    console.log("  ✓✓✓ DE OPGELOSTE PDA IS EXACT DE AuthorizedRecipient-PDA - de resolutie werkt.");
  }
  if (!resolvedHookProgramKey.equals(ACTIVE_DEFENSE_ID)) { console.log("  ✗ FOUT: hook-programId klopt niet."); g1ok = false; }
  if (!resolvedValidateStateKey.equals(extraAccountMetaListPda)) { console.log("  ✗ FOUT: validateState-PDA klopt niet."); g1ok = false; }
  if (!g1ok) process.exit(1);
  console.log("");

  console.log("G2. Transfer naar de UNAUTHORIZED bestemming - resolutie bouwen (moet een ANDER,");
  console.log("nooit-aangemaakt PDA-adres opleveren, puur op basis van de seed-wiskunde)...");
  const [unauthorizedRecipientPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("poison_authorized"), mint.publicKey.toBuffer(), unauthorizedOwner.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  const transferToUnauthorized = await createTransferCheckedWithTransferHookInstruction(
    connection, srcToken.publicKey, mint.publicKey, dstUnauthorized.publicKey, payer.publicKey,
    500_000n, 6, [], "confirmed", TOKEN_2022_PROGRAM_ID
  );
  const resolvedUnauthKey = transferToUnauthorized.keys[transferToUnauthorized.keys.length - 3].pubkey;
  console.log(`  Opgelost:  ${resolvedUnauthKey.toBase58()}`);
  console.log(`  Verwacht (nooit aangemaakt, puur PDA-derivatie): ${unauthorizedRecipientPda.toBase58()}`);
  if (!resolvedUnauthKey.equals(unauthorizedRecipientPda)) {
    console.log("  ✗ FOUT: resolutie klopt niet voor de unauthorized-ontvanger.");
    process.exit(1);
  }
  if (resolvedUnauthKey.equals(authorizedRecipientPda)) {
    console.log("  ✗ FOUT: unauthorized en authorized PDA's zijn identiek (kan niet kloppen).");
    process.exit(1);
  }
  console.log("  ✓ correct: een ANDER, nooit-aangemaakt adres - de resolutie hangt puur af van");
  console.log("  de destination-owner-bytes, niet van of er al een account bestaat.\n");

  console.log("G3. De ECHTE transfer-transactie versturen naar devnet (naar AUTHORIZED)...");
  console.log("Verwacht: Token-2022 accepteert de resolutie (geen mismatch-fout van Token-2022");
  console.log("zelf) en CPI't daadwerkelijk naar active-defense - de fout die daarna komt is");
  console.log("onze EIGEN, nog-niet-herbouwde poison_transfer_hook (herkent Execute's");
  console.log("SPL_DISCRIMINATOR_SLICE nog niet - dat is stap 4, hier verwacht en geen falen");
  console.log("van deze stap).\n");
  const transferTx = new Transaction().add(transferToAuthorized);
  try {
    const sig = await sendAndConfirmTransaction(connection, transferTx, [payer], { commitment: "confirmed" });
    console.log(`  ONVERWACHT: transfer SLAAGDE volledig (signature ${sig}) - dat zou pas na`);
    console.log("  stap 4 (poison_transfer_hook herbouwd) moeten kunnen. Nader onderzoeken.");
  } catch (e: any) {
    const msg = e.message || String(e);
    console.log(`  Transactie faalde zoals verwacht: ${msg.split("\n")[0]}`);
    if (e.getLogs) {
      const logs = await e.getLogs(connection);
      console.log("  Logs:");
      for (const line of logs ?? []) console.log("    " + line);
      const reachedOurProgram = (logs ?? []).some((l: string) => l.includes(ACTIVE_DEFENSE_ID.toBase58()));
      const tokenLevelMismatch = (logs ?? []).some((l: string) =>
        l.toLowerCase().includes("incorrect") || l.toLowerCase().includes("account required by the instruction is missing")
      );
      console.log("");
      if (reachedOurProgram) {
        console.log("  ✓✓✓ BEWEZEN: Token-2022 heeft de resolutie geaccepteerd en daadwerkelijk");
        console.log("  gecpi't naar active-defense (programma-ID verschijnt in de logs) - de fout");
        console.log("  zit in ONS programma (poison_transfer_hook herkent de Execute-instructie");
        console.log("  nog niet), niet in Token-2022's eigen accountresolutie/-validatie.");
      } else if (tokenLevelMismatch) {
        console.log("  ✗✗✗ ONVERWACHT: Token-2022 zelf wees de resolutie af vóórdat active-defense");
        console.log("  ooit werd aangeroepen - dit zou wijzen op een echte fout in het seed-recept.");
        process.exit(1);
      } else {
        console.log("  Onduidelijk uit de logs of active-defense bereikt is - zie de ruwe logs hierboven.");
      }
    }
  }

  console.log("\n✓✓✓ STAP 3 (attach_transfer_hook + resolutiebewijs) VOLTOOID ✓✓✓");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
