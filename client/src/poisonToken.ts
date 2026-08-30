/**
 * Active Defense — Client Library (Route B, huidige 5-instructie-versie)
 *
 * Program ID: FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK
 * Upgrade Authority: zelfde keypair als het Program ID (nog geen multisig —
 * zie STATUS.md sectie 3). Update deze comment de dag dat dat verandert.
 *
 * Dit module bouwt instructies voor het active-defense-programma en leest
 * diens accounts. Het wijzigt spankwallet NIET — het leest alleen
 * owner_passkey / action_nonce uit spankwallet's WalletAccount (read-only).
 * SpankWallet's echte, multisig-bestuurde programma-ID en account-layout zijn
 * een externe, versie-gepinned dependency (zie STATUS.md voor welke commit).
 *
 * ============================================================================
 * HUIDIG ONTWERP (Route B — abl-token-patroon, STATUS.md secties 9-17)
 * ============================================================================
 *
 * De OUDE `create_poison_token` (één groeiend account met een Vec<Pubkey> in
 * de CPI-data) is VERWIJDERD (sectie 17 — structureel verkeerde envelope).
 * Vervangen door twee instructies + een herbouwde hook:
 *
 *   1. attach_transfer_hook      — registreert de ECHTE InitializeTransferHook
 *                                  + ExtraAccountMetaList, in één instructie.
 *   2. add_authorized_recipient  — maakt een AuthorizedRecipient-PDA aan voor
 *                                  (mint, recipient). Het BESTAAN van die PDA
 *                                  is ZELF de autorisatie (geen `allowed`-veld).
 *   3. poison_transfer_hook      — ECHTE SPL Execute-interface-implementatie
 *                                  (SPL_DISCRIMINATOR_SLICE), aangeroepen door
 *                                  Token-2022 bij elke transfer. Blokkeert via
 *                                  Anchor's eigen PDA-deserialisatie: bestaat de
 *                                  AuthorizedRecipient-PDA niet, dan faalt de
 *                                  transfer vóórdat de handler-body draait.
 *
 * Activeringsvolgorde voor een poison token (belangrijk, STATUS.md sectie 7):
 *   a. createMintForPoisonToken()  — mint aanmaken met ruimte VOORAF
 *                                     (getMintLen([TransferHook])), GEEN
 *                                     extensie-init, GEEN InitializeMint2.
 *   b. buildAttachTransferHookIx() — hook registreren + ExtraAccountMetaList.
 *   c. buildAddAuthorizedRecipientIx() — per toegestane ontvanger één PDA.
 *   d. InitializeMint2             — ALLERLAATSTE stap (na b en c), want
 *                                     unpackMint vereist is_initialized=true.
 *   e. buildPoisonTransferIx()     — echte transfer via Token-2022's eigen
 *                                     client-resolutie (vindt de PDA zelf).
 *
 * BEPERKING (bewust ontwerp, niet een bug): er is GEEN remove/close-instructie
 * voor AuthorizedRecipient. "Bestaan = autorisatie" betekent dat een ontvanger
 * die eenmaal is toegestaan, blijvend toegestaan blijft (de PDA kan niet via
 * het programma worden gesloten). Zie STATUS.md voor de afweging.
 *
 * ============================================================================
 * PASSKEY-FLOW (elke muterende instructie)
 * ============================================================================
 *
 * 1. Client berekent de challenge:
 *      keccak256(program_id || wallet_pda || domain || payload)
 *    per instructie (zie buildChallenge + de doc-comment van elke builder):
 *      - add_authorized_recipient: domain="add_authorized_recipient",
 *        payload = action_nonce(u64 LE) || mint(32) || recipient(32)
 *      - attach_transfer_hook:     domain="attach_transfer_hook",
 *        payload = action_nonce(u64 LE) || mint(32)
 *      - mark_malicious:           domain="mark_malicious",
 *        payload = action_nonce(u64 LE) || address(32)
 *      - unmark_malicious:         domain="unmark_malicious",
 *        payload = action_nonce(u64 LE) || address(32)
 * 2. User authentiseert met WebAuthn-passkey (of: signChallenge voor lokale
 *    test-passkeys).
 * 3. De secp256r1-precompile-instructie (secp256r1Ix) wordt VÓÓR de
 *    active-defense-instructie in de transactie geplaatst.
 * 4. Het programma verifieert de handtekening on-chain en controleert dat
 *    client_action_nonce == de on-chain action_nonce (replay-bescherming).
 *
 * OPTIONELE PASSKEYS-ACCOUNT (None-marker):
 *   Het programma declareert `passkeys: Option<UncheckedAccount>`. Per Anchor
 *   1.1.2 (accounts/option.rs) is de None-marker dat de account-key GELIJK is
 *   aan active-defense's EIGEN program-ID. Dus:
 *     - owner-passkey gebruiken  → geef ACTIVE_DEFENSE_PROGRAM_ID door (None).
 *     - extra passkey gebruiken  → geef spankwallet's PasskeysAccount-PDA door.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";
import { p256 } from "@noble/curves/p256";
import { keccak_256 } from "@noble/hashes/sha3";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  getExtraAccountMetas,
  createTransferCheckedWithTransferHookInstruction,
} from "@solana/spl-token";

// ============================================================
// CONSTANTS
// ============================================================

export const ACTIVE_DEFENSE_PROGRAM_ID = new PublicKey(
  "FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK"
);

export const INSTRUCTIONS_SYSVAR = new PublicKey(
  "Sysvar1nstructions1111111111111111111111111"
);

export const TOKEN_2022_ID = TOKEN_2022_PROGRAM_ID;

// Seed-literals — MOETEN exact matchen met programs/active-defense/src/state.rs.
// Als deze uit sync raken, rekent poison_transfer_hook tijdens een echte
// transfer een ANDER adres uit dan add_authorized_recipient aanmaakte (stille
// breuk, pas bij een echte transfer zichtbaar). Zie state.rs voor de uitleg.
const POISON_AUTHORIZED_SEED = Buffer.from("poison_authorized");
const EXTRA_ACCOUNT_METAS_SEED = Buffer.from("extra-account-metas");
const MALICIOUS_SEED = Buffer.from("malicious");

// ============================================================
// DISCRIMINATORS (dynamisch berekend, niet gehardcoded)
// ============================================================

/**
 * Anchor 1.x discriminator: sha256("global:<instruction_name>")[:8].
 * Dynamisch berekend zodat een hernoemde instructie geen stale bytes oplevert.
 */
export function anchorDisc(ix: string): Buffer {
  return createHash("sha256").update(`global:${ix}`).digest().subarray(0, 8);
}

/**
 * SPL transfer-hook Execute-discriminator, gebruikt door poison_transfer_hook.
 * Geverifieerd tegen de bron van spl-transfer-hook-interface 2.1.0:
 *   #[derive(SplDiscriminate)]
 *   #[discriminator_hash_input("spl-transfer-hook-interface:execute")]
 *   pub struct ExecuteInstruction;
 * Dus: sha256("spl-transfer-hook-interface:execute")[:8] = 692565c54bfb661a.
 * (NIET de oude, zelfverzonnen Anchor-discriminator ee7abc4b877f4350.)
 */
export const POISON_TRANSFER_HOOK_DISC: Buffer = createHash("sha256")
  .update("spl-transfer-hook-interface:execute")
  .digest()
  .subarray(0, 8);

// ============================================================
// PDA DERIVATION
// ============================================================

/**
 * AuthorizedRecipient-PDA. Seeds: ["poison_authorized", mint, recipient].
 * Het BESTAAN van deze PDA is zelf de autorisatie voor (mint, recipient).
 */
export function deriveAuthorizedRecipientPda(
  mint: PublicKey,
  recipient: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POISON_AUTHORIZED_SEED, mint.toBuffer(), recipient.toBuffer()],
    ACTIVE_DEFENSE_PROGRAM_ID
  );
}

/**
 * ExtraAccountMetaList-PDA. Seeds: ["extra-account-metas", mint].
 * Standaard Solana Foundation seed-recept voor transfer hooks (sectie 9 punt 1).
 */
export function deriveExtraAccountMetaListPda(
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_SEED, mint.toBuffer()],
    ACTIVE_DEFENSE_PROGRAM_ID
  );
}

/**
 * MaliciousAddressesAccount-PDA. Seeds: ["malicious", wallet_pda].
 */
export function deriveMaliciousPda(walletPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MALICIOUS_SEED, walletPda.toBuffer()],
    ACTIVE_DEFENSE_PROGRAM_ID
  );
}

/**
 * @deprecated Restant van het OUDE design (vóór Route B). Er is géén aparte
 * PoisonToken-PDA meer — de autorisatie leeft in per-(mint, recipient)
 * AuthorizedRecipient-PDA's (deriveAuthorizedRecipientPda). Alleen behouden
 * voor backward-compat; niet gebruiken voor nieuwe code.
 */
export function derivePoisonTokenPda(
  walletPda: PublicKey,
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("poison_token"), walletPda.toBuffer(), mint.toBuffer()],
    ACTIVE_DEFENSE_PROGRAM_ID
  );
}

// ============================================================
// ACCOUNT READING
// ============================================================

export interface AuthorizedRecipientInfo {
  mint: PublicKey;
  recipient: PublicKey;
  bump: number;
}

/**
 * Leest een AuthorizedRecipient-PDA. Geeft null terug als de PDA niet bestaat
 * — wat betekent dat `recipient` NIET is toegestaan voor `mint`.
 * Layout: discriminator(8) + mint(32) + recipient(32) + bump(1) = 73 bytes.
 */
export async function readAuthorizedRecipient(
  connection: Connection,
  mint: PublicKey,
  recipient: PublicKey
): Promise<AuthorizedRecipientInfo | null> {
  const [pda] = deriveAuthorizedRecipientPda(mint, recipient);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  const d = info.data;
  return {
    mint: new PublicKey(d.subarray(8, 40)),
    recipient: new PublicKey(d.subarray(40, 72)),
    bump: d[72],
  };
}

export interface MaliciousAddressesInfo {
  wallet: PublicKey;
  bump: number;
  count: number;
  addresses: PublicKey[];
}

/**
 * Leest de MaliciousAddressesAccount. Geeft null terug als die niet bestaat.
 * Layout: discriminator(8) + wallet(32) + bump(1) + count(1) + addresses(32*32).
 */
export async function readMaliciousAddresses(
  connection: Connection,
  walletPda: PublicKey
): Promise<MaliciousAddressesInfo | null> {
  const [maliciousPda] = deriveMaliciousPda(walletPda);
  const info = await connection.getAccountInfo(maliciousPda);
  if (!info) return null;
  const d = info.data;
  const wallet = new PublicKey(d.subarray(8, 40));
  const bump = d[40];
  const count = d[41];
  const addresses: PublicKey[] = [];
  for (let i = 0; i < count; i++) {
    const offset = 42 + i * 32;
    addresses.push(new PublicKey(d.subarray(offset, offset + 32)));
  }
  return { wallet, bump, count, addresses };
}

/**
 * Leest de ExtraAccountMetaList van een mint (via Token-2022's eigen
 * client-bibliotheek). Geeft het aantal extra accounts terug (moet 1 zijn voor
 * active-defense) en de opgeloste PDA's. Nuttig om te verifiëren dat
 * attach_transfer_hook correct heeft gelopen.
 */
export async function readExtraAccountMetas(
  connection: Connection,
  mint: PublicKey
): Promise<{ pda: PublicKey; count: number } | null> {
  const [pda] = deriveExtraAccountMetaListPda(mint);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  const metas = getExtraAccountMetas(info);
  return { pda, count: metas.length };
}

// ============================================================
// BORSH HELPERS
// ============================================================

function u64Le(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v));
  return b;
}

/** Borsh Vec<u8>: u32 length (LE) + bytes. */
function borshVecU8(data: Buffer): Buffer {
  const l = Buffer.alloc(4);
  l.writeUInt32LE(data.length);
  return Buffer.concat([l, data]);
}

// ============================================================
// PASSKEY HELPERS (WebAuthn-flow)
// ============================================================

export interface TestPasskey {
  privateKey: Uint8Array;
  compressedPublicKey: Buffer;
}

/** Genereert een lokale secp256r1 test-passkey (voor tests / dev). */
export function generateTestPasskey(): TestPasskey {
  const privateKey = p256.utils.randomPrivateKey();
  const compressedPublicKey = Buffer.from(p256.getPublicKey(privateKey, true));
  return { privateKey, compressedPublicKey };
}

function base64url(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Berekent de expected challenge: keccak256(program_id || wallet || domain || payload).
 * Exacte tegenhanger van het programma's build_expected_challenge.
 */
export function buildChallenge(
  programId: PublicKey,
  wallet: PublicKey,
  domain: string,
  payload: Buffer
): Buffer {
  const combined = Buffer.concat([
    programId.toBuffer(),
    wallet.toBuffer(),
    Buffer.from(domain, "utf-8"),
    payload,
  ]);
  return Buffer.from(keccak_256(combined));
}

export interface SignedChallenge {
  signedMessage: Buffer;
  rawSignature: Buffer;
  clientDataJSON: Buffer;
}

/**
 * Signeert een challenge met een LOCALE test-passkey (secp256r1, lowS).
 * Bouwt de WebAuthn clientDataJSON + authenticatorData (UV-flag gezet) en
 * retourneert het signedMessage (authenticatorData || sha256(clientDataJSON))
 * plus de compacte raw signature. Voor productie gebruik je in plaats daarvan
 * navigator.credentials.get() — deze helper is voor tests/dev.
 */
export function signChallenge(
  passkey: TestPasskey,
  challenge: Buffer,
  origin = "https://spankwallet-tests.local"
): SignedChallenge {
  const challengeB64 = base64url(challenge);
  const clientData = {
    type: "webauthn.get",
    challenge: challengeB64,
    origin,
    crossOrigin: false,
  };
  const clientDataJSON = Buffer.from(JSON.stringify(clientData), "utf-8");
  const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
  // authenticatorData: rpIdHash(32) + flags(1, UV=0x04 | UP=0x01) + counter(4)
  const authenticatorData = Buffer.concat([
    randomBytes(32),
    Buffer.from([0x05]),
    randomBytes(4),
  ]);
  const signedMessage = Buffer.concat([authenticatorData, clientDataHash]);
  const messageHash = createHash("sha256").update(signedMessage).digest();
  const sig = p256.sign(messageHash, passkey.privateKey, { lowS: true });
  return {
    signedMessage,
    rawSignature: Buffer.from(sig.toCompactRawBytes()),
    clientDataJSON,
  };
}

/**
 * Bouwt de secp256r1-precompile-instructie die VÓÓR de active-defense-
 * instructie in de transactie moet. Zelfde layout als in de tests.
 */
export function secp256r1Ix(
  pubkey: Buffer,
  message: Buffer,
  signature: Buffer
): TransactionInstruction {
  const SECP256R1_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");
  const NO_OWN = 0xffff;
  const dataStart = 2 + 14;
  const sigOff = dataStart;
  const pkOff = sigOff + 64;
  const msgOff = pkOff + 33;
  const total = msgOff + message.length;
  const data = Buffer.alloc(total);
  data[0] = 1; // num_signatures
  data[1] = 0;
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

// ============================================================
// INSTRUCTION BUILDERS
// ============================================================

/**
 * Bouwt de add_authorized_recipient-instructie.
 * Maakt een AuthorizedRecipient-PDA aan voor (mint, recipient).
 *
 * Data: disc(8) + recipient(32) + nonce(u64 LE) + clientDataJSON(Vec<u8>)
 * Accounts (7): wallet, passkeys(opt), token_mint, authorized_recipient(PDA,w),
 *               payer(signer,w), instructions_sysvar, system_program
 * Challenge: domain="add_authorized_recipient",
 *            payload = nonce(u64 LE) || mint(32) || recipient(32)
 */
export function buildAddAuthorizedRecipientIx(
  walletPda: PublicKey,
  mint: PublicKey,
  recipient: PublicKey,
  payer: PublicKey,
  clientActionNonce: number | bigint,
  clientDataJson: Buffer,
  passkeysPda?: PublicKey
): TransactionInstruction {
  const [authorizedRecipientPda] = deriveAuthorizedRecipientPda(mint, recipient);
  const data = Buffer.concat([
    anchorDisc("add_authorized_recipient"),
    recipient.toBuffer(),
    u64Le(clientActionNonce),
    borshVecU8(clientDataJson),
  ]);
  return new TransactionInstruction({
    programId: ACTIVE_DEFENSE_PROGRAM_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      // passkeys: Option = None → active-defense's eigen program-ID als marker.
      { pubkey: passkeysPda ?? ACTIVE_DEFENSE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: authorizedRecipientPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Bouwt de attach_transfer_hook-instructie.
 * Registreert de ECHTE InitializeTransferHook (via anchor-spl's typed CPI) +
 * initialiseert de ExtraAccountMetaList, in één instructie.
 *
 * Data: disc(8) + nonce(u64 LE) + clientDataJSON(Vec<u8>)
 * Accounts (8): wallet, passkeys(opt), token_mint(w), extra_account_meta_list(PDA,w),
 *               payer(signer,w), token_program(Token-2022), instructions_sysvar, system
 * Challenge: domain="attach_transfer_hook", payload = nonce(u64 LE) || mint(32)
 */
export function buildAttachTransferHookIx(
  walletPda: PublicKey,
  mint: PublicKey,
  payer: PublicKey,
  clientActionNonce: number | bigint,
  clientDataJson: Buffer,
  passkeysPda?: PublicKey
): TransactionInstruction {
  const [extraAccountMetaListPda] = deriveExtraAccountMetaListPda(mint);
  const data = Buffer.concat([
    anchorDisc("attach_transfer_hook"),
    u64Le(clientActionNonce),
    borshVecU8(clientDataJson),
  ]);
  return new TransactionInstruction({
    programId: ACTIVE_DEFENSE_PROGRAM_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: passkeysPda ?? ACTIVE_DEFENSE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: extraAccountMetaListPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_2022_ID, isSigner: false, isWritable: false },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Bouwt de mark_malicious-instructie.
 * Data: disc(8) + address(32) + nonce(u64 LE) + clientDataJSON(Vec<u8>)
 * Accounts (6): wallet, passkeys(opt), malicious(PDA,w), payer(signer,w),
 *               instructions_sysvar, system_program
 * Challenge: domain="mark_malicious", payload = nonce(u64 LE) || address(32)
 */
export function buildMarkMaliciousIx(
  walletPda: PublicKey,
  address: PublicKey,
  payer: PublicKey,
  clientActionNonce: number | bigint,
  clientDataJson: Buffer,
  passkeysPda?: PublicKey
): TransactionInstruction {
  const [maliciousPda] = deriveMaliciousPda(walletPda);
  const data = Buffer.concat([
    anchorDisc("mark_malicious"),
    address.toBuffer(),
    u64Le(clientActionNonce),
    borshVecU8(clientDataJson),
  ]);
  return new TransactionInstruction({
    programId: ACTIVE_DEFENSE_PROGRAM_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: passkeysPda ?? ACTIVE_DEFENSE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: maliciousPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Bouwt de unmark_malicious-instructie.
 * Data: disc(8) + address(32) + nonce(u64 LE) + clientDataJSON(Vec<u8>)
 * Accounts (4): wallet, passkeys(opt), malicious(PDA,w), instructions_sysvar
 * Challenge: domain="unmark_malicious", payload = nonce(u64 LE) || address(32)
 */
export function buildUnmarkMaliciousIx(
  walletPda: PublicKey,
  address: PublicKey,
  clientActionNonce: number | bigint,
  clientDataJson: Buffer,
  passkeysPda?: PublicKey
): TransactionInstruction {
  const [maliciousPda] = deriveMaliciousPda(walletPda);
  const data = Buffer.concat([
    anchorDisc("unmark_malicious"),
    address.toBuffer(),
    u64Le(clientActionNonce),
    borshVecU8(clientDataJson),
  ]);
  return new TransactionInstruction({
    programId: ACTIVE_DEFENSE_PROGRAM_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: passkeysPda ?? ACTIVE_DEFENSE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: maliciousPda, isSigner: false, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ============================================================
// HIGH-LEVEL HELPERS
// ============================================================

/**
 * Definitieve mint-grootte voor een poison token: basis-82 bytes + ruimte
 * voor de TransferHook-extensie. getMintLen([ExtensionType.TransferHook])
 * is de officiële bibliotheekfunctie (geen handmatige schatting,
 * STATUS.md §7) — dit is de waarde die de caller nodig heeft voor
 * getMinimumBalanceForRentExemption.
 */
export const POISON_MINT_LEN = getMintLen([ExtensionType.TransferHook]);

/**
 * Maakt een Token-2022-mint aan met ruimte VOORAF gereserveerd voor de
 * TransferHook-extensie (POISON_MINT_LEN = getMintLen([TransferHook])).
 *
 * BELANGRIJK (Route B, STATUS.md sectie 7): deze helper doet ALLEEN het
 * createAccount. Hij initialiseert GEEN hook (dat is attach_transfer_hook's
 * taak) en roept GEEN InitializeMint2 aan (die moet ALLERLAATSTE stap zijn,
 * ná attach_transfer_hook + add_authorized_recipient).
 *
 * `mintRentLamports` moet de caller berekenen via
 * getMinimumBalanceForRentExemption(POISON_MINT_LEN) en meegeven: de
 * instructie-data is direct geserialiseerd, een post-hoc aanpassing van de
 * returned transactie zou de lamports-waarde niet meer kunnen veranderen
 * (dit was exact het gebrek in de vorige versie, die lamports: 0 bakte).
 *
 * Retourneert de mint-keypair en de createAccount-transactie (nog niet
 * gesigneerd).
 */
export function createMintForPoisonToken(
  payer: PublicKey,
  mintRentLamports: number
): { mintKeypair: Keypair; tx: Transaction } {
  const mintKeypair = Keypair.generate();
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: mintRentLamports,
      space: POISON_MINT_LEN,
      programId: TOKEN_2022_ID,
    })
  );
  return { mintKeypair, tx };
}

/**
 * Bouwt een transfer-instructie voor een poison token (Token-2022 met
 * transfer hook). Gebruikt Token-2022's EIGEN client-bibliotheek-resolutie om
 * de extra accounts (de AuthorizedRecipient-PDA) te vinden — de client geeft
 * die PDA nooit expliciet mee. Als de destination-owner niet is toegestaan,
 * bestaat de opgeloste PDA niet en faalt de transfer on-chain (AccountNotInitialized).
 */
export async function buildPoisonTransferIx(
  connection: Connection,
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
  multiSigners?: PublicKey[]
): Promise<TransactionInstruction> {
  return createTransferCheckedWithTransferHookInstruction(
    connection,
    source,
    mint,
    destination,
    owner,
    amount,
    decimals,
    multiSigners ?? [],
    "confirmed",
    TOKEN_2022_ID
  );
}
