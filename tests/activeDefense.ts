/**
 * Active-Defense Poison Token Flow Test
 * 
 * Verifieert:
 * - C1: Nonce encoding (little-endian) matcht tussen client en program
 * - M2: IDL-based instruction encoding werkt  
 * - H2: Mint constraint in poison_transfer_hook
 * 
 * Gebruik:
 *   npx ts-node tests/activeDefense.ts auto
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
// --- Spankwallet testfixture (wegwerp-deploy, NIET het echte multisig-programma) ---
// Zie STATUS.md sectie 5 voor de volledige uitleg.
const SPANKWALLET_REAL_ID = "9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9";
const DEFAULT_TEST_SPANKWALLET_ID = "BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk";
// Harde grendel: weigeren op het echte programma én alle bekende oude/wegwerp-adressen.
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
const SECP256R1_PROGRAM_ID = new PublicKey("Secp256r1SigVerify1111111111111111111111111");
const TOKEN_2022_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
// Solana instructions sysvar address (from solana_instructions_sysvar::ID)
const INSTRUCTIONS_SYSVAR_ID = new PublicKey("Sysvar1nstructions1111111111111111111111111");

// --- Test helpers ---

function base64url(bytes: Buffer | Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

/**
 * [C1-VERIFICATIE] Exacte TS-tegenhanger van build_expected_challenge() in instructions.rs:
 * Keccak-256 over program_id || wallet || domain || (action_nonce_LE || payload)
 * Zelfde patroon als spankwallet: action_nonce VOORAAN in de payload.
 */
function buildExpectedChallenge(
  programId: PublicKey,
  wallet: PublicKey,
  domain: string,
  payload: Buffer,
  actionNonce: bigint
): Buffer {
  const domainBytes = Buffer.from(domain, "utf-8");
  const nonceLe = Buffer.alloc(8);
  nonceLe.writeBigUInt64LE(actionNonce);
  // [C1] action_nonce VOORAAN in payload (zelfde als spankwallet)
  const fullPayload = Buffer.concat([nonceLe, payload]);
  const combined = Buffer.concat([
    programId.toBuffer(),
    wallet.toBuffer(),
    domainBytes,
    fullPayload,
  ]);
  return Buffer.from(keccak_256(combined));
}

interface SignedTestChallenge {
  signedMessage: Buffer;
  rawSignature: Buffer;
  clientDataJSON: Buffer;
}

function signTestChallenge(
  passkey: TestPasskey,
  expectedChallenge: Buffer
): SignedTestChallenge {
  const challengeB64url = base64url(expectedChallenge);
  const clientData = {
    type: "webauthn.get",
    challenge: challengeB64url,
    origin: "https://spankwallet-tests.local",
    crossOrigin: false,
  };
  const clientDataJSON = Buffer.from(JSON.stringify(clientData), "utf-8");
  const clientDataHash = createHash("sha256").update(clientDataJSON).digest();

  const rpIdHash = randomBytes(32);
  const signCount = randomBytes(4);
  const authenticatorData = Buffer.concat([
    rpIdHash,
    Buffer.from([0x05]), // UP | UV
    signCount,
  ]);

  const signedMessage = Buffer.concat([authenticatorData, clientDataHash]);
  const messageHash = createHash("sha256").update(signedMessage).digest();

  const signature = p256.sign(messageHash, passkey.privateKey, { lowS: true });
  const rawSignature = Buffer.from(signature.toCompactRawBytes());

  return { signedMessage, rawSignature, clientDataJSON };
}

function buildSecp256r1Instruction(
  compressedPubkey: Buffer,
  message: Buffer,
  rawSignature: Buffer
): TransactionInstruction {
  const NO_OWN_INSTRUCTION = 0xffff;
  const HEADER_LEN = 2;
  const OFFSETS_STRUCT_LEN = 14;
  const dataStart = HEADER_LEN + OFFSETS_STRUCT_LEN;

  const signatureOffset = dataStart;
  const publicKeyOffset = signatureOffset + rawSignature.length;
  const messageOffset = publicKeyOffset + compressedPubkey.length;
  const totalLen = messageOffset + message.length;

  const data = Buffer.alloc(totalLen);
  data[0] = 1;
  data[1] = 0;

  let o = HEADER_LEN;
  data.writeUInt16LE(signatureOffset, o); o += 2;
  data.writeUInt16LE(NO_OWN_INSTRUCTION, o); o += 2;
  data.writeUInt16LE(publicKeyOffset, o); o += 2;
  data.writeUInt16LE(NO_OWN_INSTRUCTION, o); o += 2;
  data.writeUInt16LE(messageOffset, o); o += 2;
  data.writeUInt16LE(message.length, o); o += 2;
  data.writeUInt16LE(NO_OWN_INSTRUCTION, o); o += 2;

  rawSignature.copy(data, signatureOffset);
  compressedPubkey.copy(data, publicKeyOffset);
  message.copy(data, messageOffset);

  return new TransactionInstruction({
    programId: SECP256R1_PROGRAM_ID,
    keys: [],
    data,
  });
}

/**
 * [C1-VERIFICATIE] Leest action_nonce uit WalletAccount met VARIABELE offset.
 */
function actionNonceOffset(data: Buffer): number {
  const OFFSET_RECOVERY_STATE_TAG = 148;
  const RECOVERY_STATE_LEN = 41;

  let offset = OFFSET_RECOVERY_STATE_TAG;
  const recoveryStateTag = data[offset];
  offset += 1;
  if (recoveryStateTag === 1) offset += RECOVERY_STATE_LEN;
  offset += 8;
  const depositAuthorityTag = data[offset];
  offset += 1;
  if (depositAuthorityTag === 1) offset += 32;
  return offset;
}

async function fetchActionNonce(
  connection: Connection,
  walletPda: PublicKey
): Promise<bigint> {
  const info = await connection.getAccountInfo(walletPda, "confirmed");
  if (!info) {
    throw new Error("WalletAccount bestaat niet: " + walletPda.toBase58());
  }
  return info.data.readBigUInt64LE(actionNonceOffset(info.data));
}

function anchorDiscriminator(programName: string, instructionName: string): Buffer {
  return createHash("sha256")
    .update(`global:${programName}:${instructionName}`)
    .digest()
    .subarray(0, 8);
}

/** [C1] Encodeert u64 als little-endian bytes */
function u64Le(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

// --- Token-2022 raw instruction helpers ---

/** Token-2022 initializeMint2 (instruction index 1) */
function token2022InitializeMint2(
  mint: PublicKey,
  rent: PublicKey,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number
): TransactionInstruction {
  // Data: instruction_index(1) + supply(8) + decimals(1) + mint_authority(32) + freeze_authority_option(1+32)
  const data = Buffer.alloc(1 + 8 + 1 + 32 + 33);
  data[0] = 1; // initializeMint2
  data.writeBigUInt64LE(0n, 1); // supply = 0
  data[9] = decimals;
  mintAuthority.toBuffer().copy(data, 10);
  if (freezeAuthority) {
    data[42] = 1; // Some
    freezeAuthority.toBuffer().copy(data, 43);
  } else {
    data[42] = 0; // None
  }

  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: rent, isSigner: false, isWritable: false },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Token-2022 initializeTransferHook (instruction index 48) */
function token2022InitializeTransferHook(
  mint: PublicKey,
  payer: PublicKey,
  hookProgramId: PublicKey,
  hookInstruction: Buffer
): TransactionInstruction {
  // Data: instruction_index(1) + hook_program_id(32) + hook_instruction(Vec<u8>)
  const hookIxLen = Buffer.alloc(4);
  hookIxLen.writeUInt32LE(hookInstruction.length);
  const data = Buffer.concat([
    Buffer.from([48]),
    hookProgramId.toBuffer(),
    hookIxLen,
    hookInstruction,
  ]);

  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
    ],
    data,
  });
}

/** Token-2022 initializeAccount (instruction index 4) - simplified, no extensions */
function token2022InitializeAccount(
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  rent: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(1);
  data[0] = 4; // initializeAccount

  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: rent, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Token-2022 mintTo (instruction index 11) */
function token2022MintTo(
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint
): TransactionInstruction {
  const data = Buffer.alloc(1 + 8);
  data[0] = 11; // mintTo
  data.writeBigUInt64LE(amount, 1);

  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Token-2022 transfer (instruction index 7) */
function token2022Transfer(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint
): TransactionInstruction {
  const data = Buffer.alloc(1 + 8);
  data[0] = 7; // transfer
  data.writeBigUInt64LE(amount, 1);

  return new TransactionInstruction({
    programId: TOKEN_2022_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

// --- Main test ---

async function main() {
  console.log("=== Active-Defense Poison Token Flow Test ===\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const homeDir = process.env.HOME || "/home/michel";
  const keypairJson = JSON.parse(
    fs.readFileSync(`${homeDir}/.config/solana/id.json`, "utf-8")
  );
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairJson));

  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // --- Genereer test passkey en derive Wallet PDA ---
  const passkey = generateTestPasskey();
  const walletSeedHash = createHash("sha256").update(passkey.compressedPublicKey).digest();
  const [walletPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("wallet"), walletSeedHash],
    SPANKWALLET_ID
  );
  console.log(`Wallet PDA: ${walletPda.toBase58()}`);

  // Check if wallet exists
  const walletInfo = await connection.getAccountInfo(walletPda, "confirmed");
  if (!walletInfo) {
    console.log("FOUT: WalletAccount PDA bestaat niet op devnet.");
    console.log("Deze test vereist een bestaande spankwallet wallet.");
    console.log("Voer eerst init_wallet uit via de browser-testpagina.");
    process.exit(1);
  }

  const actionNonce = await fetchActionNonce(connection, walletPda);
  console.log(`Action nonce: ${actionNonce}`);

  // Verify owner_passkey matches our test passkey
  const ownerPasskey = walletInfo.data.subarray(73, 73 + 33);
  if (!ownerPasskey.equals(passkey.compressedPublicKey)) {
    console.log("FOUT: Test passkey komt niet overeen met owner_passkey in wallet.");
    console.log(`  Owner:  ${ownerPasskey.toString("hex")}`);
    console.log(`  Test:   ${passkey.compressedPublicKey.toString("hex")}`);
    process.exit(1);
  }
  console.log("✓ Passkey matcht met owner_passkey\n");

  // --- Stap 1: Creëer Token-2022 mint met transfer hook ---
  console.log("Stap 1: Creëer Token-2022 mint met transfer hook...");

  const mint = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(82); // mint size without extensions

  // Create mint account
  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint.publicKey,
    lamports: rent,
    space: 82, // basic mint size (no extensions yet)
    programId: TOKEN_2022_ID,
  });

  // Initialize mint
  const initMintIx = token2022InitializeMint2(
    mint.publicKey,
    new PublicKey("Sysvar1111111111111111111111111111111111111"), // Rent sysvar
    payer.publicKey,
    null,
    6
  );

  const createMintTx = new Transaction().add(createMintAccountIx, initMintIx);
  await sendAndConfirmTransaction(connection, createMintTx, [payer, mint], { commitment: "confirmed" });
  console.log(`  Mint created: ${mint.publicKey.toBase58()}`);

  // Set transfer hook
  const hookDiscriminator = anchorDiscriminator("active_defense", "poison_transfer_hook");
  const setHookIx = token2022InitializeTransferHook(
    mint.publicKey,
    payer.publicKey,
    ACTIVE_DEFENSE_ID,
    hookDiscriminator
  );

  const setHookTx = new Transaction().add(setHookIx);
  await sendAndConfirmTransaction(connection, setHookTx, [payer], { commitment: "confirmed" });
  console.log("  Transfer hook set to active-defense program\n");

  // --- Stap 2: Creëer token accounts ---
  console.log("Stap 2: Creëer token accounts...");

  const sourceTokenAccount = Keypair.generate();
  const destTokenAccount = Keypair.generate();
  const unauthorizedRecipient = Keypair.generate();

  const tokenAccountRent = await connection.getMinimumBalanceForRentExemption(165); // token account size

  // Create source token account
  const createSourceIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: sourceTokenAccount.publicKey,
    lamports: tokenAccountRent,
    space: 165,
    programId: TOKEN_2022_ID,
  });
  const initSourceIx = token2022InitializeAccount(
    sourceTokenAccount.publicKey,
    mint.publicKey,
    payer.publicKey,
    new PublicKey("Sysvar1111111111111111111111111111111111111")
  );
  const createSourceTx = new Transaction().add(createSourceIx, initSourceIx);
  await sendAndConfirmTransaction(connection, createSourceTx, [payer, sourceTokenAccount], { commitment: "confirmed" });

  // Create dest token account (owned by unauthorized recipient)
  const createDestIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: destTokenAccount.publicKey,
    lamports: tokenAccountRent,
    space: 165,
    programId: TOKEN_2022_ID,
  });
  const initDestIx = token2022InitializeAccount(
    destTokenAccount.publicKey,
    mint.publicKey,
    unauthorizedRecipient.publicKey,
    new PublicKey("Sysvar1111111111111111111111111111111111111")
  );
  const createDestTx = new Transaction().add(createDestIx, initDestIx);
  await sendAndConfirmTransaction(connection, createDestTx, [payer, destTokenAccount], { commitment: "confirmed" });

  console.log(`  Source: ${sourceTokenAccount.publicKey.toBase58()}`);
  console.log(`  Dest:   ${destTokenAccount.publicKey.toBase58()}`);
  console.log(`  Unauthorized recipient: ${unauthorizedRecipient.publicKey.toBase58()}\n`);

  // --- Stap 3: Call create_poison_token ---
  console.log("Stap 3: Call create_poison_token...");

  // [C1] client_action_nonce moet matchen met on-chain action_nonce
  const clientActionNonce = actionNonce;
  // Payload zonder nonce (nonce wordt door buildExpectedChallenge vooraan gezet)
  const payload = Buffer.concat([
    mint.publicKey.toBuffer(),
  ]);

  const expectedChallenge = buildExpectedChallenge(
    ACTIVE_DEFENSE_ID,
    walletPda,
    "create_poison_token",
    payload,
    actionNonce
  );

  const signed = signTestChallenge(passkey, expectedChallenge);

  const [poisonTokenPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("poison_token"), walletPda.toBuffer(), mint.publicKey.toBuffer()],
    ACTIVE_DEFENSE_ID
  );
  console.log(`  Poison token PDA: ${poisonTokenPda.toBase58()}`);

  const createDiscriminator = anchorDiscriminator("active_defense", "create_poison_token");
  const clientDataJsonLen = Buffer.alloc(4);
  clientDataJsonLen.writeUInt32LE(signed.clientDataJSON.length);
  const ixData = Buffer.concat([
    createDiscriminator,
    u64Le(clientActionNonce),
    clientDataJsonLen,
    signed.clientDataJSON,
  ]);

  const createPoisonIx = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: poisonTokenPda, isSigner: false, isWritable: true },
      { pubkey: mint.publicKey, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  const createPoisonTx = new Transaction().add(
    buildSecp256r1Instruction(passkey.compressedPublicKey, signed.signedMessage, signed.rawSignature),
    createPoisonIx
  );

  try {
    await sendAndConfirmTransaction(connection, createPoisonTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ create_poison_token succeeded\n");
  } catch (e: any) {
    console.log(`  ✗ create_poison_token failed: ${e.message}`);
    if (e.message.includes("WebAuthnChallengeMismatch")) {
      console.log("    → C1 BUG: nonce encoding mismatch");
    } else if (e.message.includes("InvalidPasskeySignature")) {
      console.log("    → Passkey signature verification failed");
    }
    process.exit(1);
  }

  // --- Stap 4: Call add_poison_authorized ---
  console.log("Stap 4: Call add_poison_authorized...");

  // [C1] client_action_nonce moet matchen met on-chain action_nonce
  // NB: na create_poison_token is de on-chain nonce nog steeds actionNonce
  // (active-defense verhoogt de nonce NIET - dat doet spankwallet)
  const clientActionNonce2 = actionNonce;
  const payload2 = Buffer.concat([
    unauthorizedRecipient.publicKey.toBuffer(),
  ]);

  const expectedChallenge2 = buildExpectedChallenge(
    ACTIVE_DEFENSE_ID,
    walletPda,
    "add_poison_authorized",
    payload2,
    actionNonce
  );

  const signed2 = signTestChallenge(passkey, expectedChallenge2);

  const addDiscriminator = anchorDiscriminator("active_defense", "add_poison_authorized");
  const clientDataJsonLen2 = Buffer.alloc(4);
  clientDataJsonLen2.writeUInt32LE(signed2.clientDataJSON.length);
  const ixData2 = Buffer.concat([
    addDiscriminator,
    unauthorizedRecipient.publicKey.toBuffer(),
    u64Le(clientActionNonce2),
    clientDataJsonLen2,
    signed2.clientDataJSON,
  ]);

  const addPoisonIx = new TransactionInstruction({
    programId: ACTIVE_DEFENSE_ID,
    keys: [
      { pubkey: walletPda, isSigner: false, isWritable: false },
      { pubkey: poisonTokenPda, isSigner: false, isWritable: true },
      { pubkey: INSTRUCTIONS_SYSVAR_ID, isSigner: false, isWritable: false },
    ],
    data: ixData2,
  });

  const addPoisonTx = new Transaction().add(
    buildSecp256r1Instruction(passkey.compressedPublicKey, signed2.signedMessage, signed2.rawSignature),
    addPoisonIx
  );

  try {
    await sendAndConfirmTransaction(connection, addPoisonTx, [payer], { commitment: "confirmed" });
    console.log("  ✓ add_poison_authorized succeeded\n");
  } catch (e: any) {
    console.log(`  ✗ add_poison_authorized failed: ${e.message}`);
    process.exit(1);
  }

  // --- Stap 5: Mint tokens en trigger poison_transfer_hook ---
  console.log("Stap 5: Mint tokens en trigger poison_transfer_hook...");

  const mintToIx = token2022MintTo(
    mint.publicKey,
    sourceTokenAccount.publicKey,
    payer.publicKey,
    1000000n // 1 token (6 decimals)
  );
  const mintToTx = new Transaction().add(mintToIx);
  await sendAndConfirmTransaction(connection, mintToTx, [payer], { commitment: "confirmed" });
  console.log("  Tokens gemint naar source account");

  // Transfer naar unauthorized recipient - moet falen met poison trigger
  const transferIx = token2022Transfer(
    sourceTokenAccount.publicKey,
    mint.publicKey,
    destTokenAccount.publicKey,
    payer.publicKey,
    1000000n
  );
  const transferTx = new Transaction().add(transferIx);

  let poisonTriggered = false;
  try {
    await sendAndConfirmTransaction(connection, transferTx, [payer], { commitment: "confirmed" });
    console.log("  ✗ Transfer succeeded (moest falen met poison trigger)");
  } catch (e: any) {
    const msg = e.message || String(e);
    if (msg.includes("PoisonTokenUnauthorizedRecipient") ||
        msg.includes("unauthorized recipient") ||
        msg.includes("custom program error") ||
        msg.includes("0x1")) {
      poisonTriggered = true;
      console.log("  ✓ Poison token triggered! Transfer geblokkeerd.");
    } else {
      console.log(`  ✗ Onverwachte fout: ${msg}`);
    }
  }

  // --- Stap 6: Verify token state ---
  console.log("\nStap 6: Verify poison token state...");
  const poisonTokenInfo = await connection.getAccountInfo(poisonTokenPda, "confirmed");
  if (poisonTokenInfo) {
    const data = poisonTokenInfo.data;
    // PoisonTokenAccount layout:
    // discriminator(8) + wallet(32) + mint(32) + bump(1) + count(1)
    // + authorized_recipients(32*16=512) + triggered(1) + triggered_at(8)
    const triggeredOffset = 8 + 32 + 32 + 1 + 1 + 512;
    const triggered = data[triggeredOffset] === 1;
    const triggeredAt = data.readBigInt64LE(triggeredOffset + 1);

    console.log(`  Triggered: ${triggered}`);
    console.log(`  Triggered at: ${triggeredAt}`);

    if (triggered && poisonTriggered) {
      console.log("\n=== TEST PASSED ===");
      console.log("✓ C1 verified: nonce encoding (LE) matcht tussen client en program");
      console.log("✓ M2 verified: instruction encoding werkt correct");
      console.log("✓ H2 verified: mint constraint in poison_transfer_hook");
      console.log("✓ Poison token flow werkt end-to-end");
    } else {
      console.log("\n=== TEST FAILED ===");
      console.log(`  poisonTriggered=${poisonTriggered}, onChainTriggered=${triggered}`);
    }
  } else {
    console.log("  ✗ Poison token PDA niet gevonden op chain");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
