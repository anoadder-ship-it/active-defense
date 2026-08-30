/**
 * Smoke-test voor de herschreven client-library (client/src/poisonToken.ts).
 * Verifieert discriminators, data-layouts en PDA-afleidingen ZONDER devnet.
 * Gebruik: npx ts-node client/src/verify-poisonToken.ts
 */
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";
import {
  ACTIVE_DEFENSE_PROGRAM_ID,
  anchorDisc,
  POISON_TRANSFER_HOOK_DISC,
  deriveAuthorizedRecipientPda,
  deriveExtraAccountMetaListPda,
  deriveMaliciousPda,
  buildAddAuthorizedRecipientIx,
  buildAttachTransferHookIx,
  buildMarkMaliciousIx,
  buildUnmarkMaliciousIx,
  createMintForPoisonToken,
  POISON_MINT_LEN,
} from "./poisonToken";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.log(`  ✗ ${name} ${detail}`); failures++; }
}

const walletPda = new PublicKey("9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9");
const mint = new PublicKey("So11111111111111111111111111111111111111112");
const recipient = new PublicKey("11111111111111111111111111111112");
const payer = new PublicKey("G1qgHzMxNHqewWEKzEoV46GUXjDrsuD4P8LQ97T6gNXp");
const nonce = 0n;
const json = Buffer.from('{"type":"webauthn.get"}', "utf-8");

console.log("=== Discriminators ===");
check("add_authorized_recipient", anchorDisc("add_authorized_recipient").toString("hex") === "aaa9aec7c4f5bb61");
check("attach_transfer_hook", anchorDisc("attach_transfer_hook").toString("hex") === "9e326f3eb8a3ee2f");
check("mark_malicious", anchorDisc("mark_malicious").toString("hex") === "f245119b9dd48c42");
check("unmark_malicious", anchorDisc("unmark_malicious").toString("hex") === "c16879a718313a4c");
check("poison_transfer_hook (SPL execute)", POISON_TRANSFER_HOOK_DISC.toString("hex") === "692565c54bfb661a");

console.log("\n=== PDA-afleidingen ===");
const [arPda, arBump] = deriveAuthorizedRecipientPda(mint, recipient);
const expectedAr = PublicKey.findProgramAddressSync(
  [Buffer.from("poison_authorized"), mint.toBuffer(), recipient.toBuffer()],
  ACTIVE_DEFENSE_PROGRAM_ID
)[0];
check("AuthorizedRecipient PDA", arPda.equals(expectedAr), `${arPda} vs ${expectedAr}`);
console.log(`    AuthorizedRecipient: ${arPda} (bump ${arBump})`);

const [emlPda] = deriveExtraAccountMetaListPda(mint);
const expectedEml = PublicKey.findProgramAddressSync(
  [Buffer.from("extra-account-metas"), mint.toBuffer()],
  ACTIVE_DEFENSE_PROGRAM_ID
)[0];
check("ExtraAccountMetaList PDA", emlPda.equals(expectedEml));
console.log(`    ExtraAccountMetaList: ${emlPda}`);

const [malPda] = deriveMaliciousPda(walletPda);
const expectedMal = PublicKey.findProgramAddressSync(
  [Buffer.from("malicious"), walletPda.toBuffer()],
  ACTIVE_DEFENSE_PROGRAM_ID
)[0];
check("Malicious PDA", malPda.equals(expectedMal));

console.log("\n=== add_authorized_recipient data-layout ===");
const addIx = buildAddAuthorizedRecipientIx(walletPda, mint, recipient, payer, nonce, json);
{
  const d = addIx.data;
  // disc(8) + recipient(32) + nonce(8) + vec_u8(4+len)
  const expectedLen = 8 + 32 + 8 + 4 + json.length;
  check("data length", d.length === expectedLen, `${d.length} vs ${expectedLen}`);
  check("discriminator", d.subarray(0, 8).equals(anchorDisc("add_authorized_recipient")));
  check("recipient @8", d.subarray(8, 40).equals(recipient.toBuffer()));
  const nonceRead = d.readBigUInt64LE(40);
  check("nonce @40 (u64 LE)", nonceRead === nonce, `${nonceRead}`);
  const jsonLen = d.readUInt32LE(48);
  check("json_len @48", jsonLen === json.length, `${jsonLen} vs ${json.length}`);
  check("json @52", d.subarray(52).equals(json));
  // accounts: 7 keys
  check("7 accounts", addIx.keys.length === 7, `${addIx.keys.length}`);
  check("account[0]=wallet", addIx.keys[0].pubkey.equals(walletPda) && !addIx.keys[0].isWritable);
  check("account[1]=passkeys(None=programId)", addIx.keys[1].pubkey.equals(ACTIVE_DEFENSE_PROGRAM_ID));
  check("account[2]=mint(ro)", addIx.keys[2].pubkey.equals(mint) && !addIx.keys[2].isWritable);
  check("account[3]=authorizedRecipientPda(w)", addIx.keys[3].pubkey.equals(arPda) && addIx.keys[3].isWritable);
  check("account[4]=payer(signer,w)", addIx.keys[4].pubkey.equals(payer) && addIx.keys[4].isSigner && addIx.keys[4].isWritable);
}

console.log("\n=== attach_transfer_hook data-layout ===");
const attachIx = buildAttachTransferHookIx(walletPda, mint, payer, nonce, json);
{
  const d = attachIx.data;
  // disc(8) + nonce(8) + vec_u8(4+len)
  const expectedLen = 8 + 8 + 4 + json.length;
  check("data length", d.length === expectedLen, `${d.length} vs ${expectedLen}`);
  check("discriminator", d.subarray(0, 8).equals(anchorDisc("attach_transfer_hook")));
  check("nonce @8 (u64 LE)", d.readBigUInt64LE(8) === nonce);
  check("json_len @16", d.readUInt32LE(16) === json.length);
  check("json @20", d.subarray(20).equals(json));
  check("8 accounts", attachIx.keys.length === 8, `${attachIx.keys.length}`);
  check("account[2]=mint(w)", attachIx.keys[2].pubkey.equals(mint) && attachIx.keys[2].isWritable);
  check("account[3]=extraAccountMetaListPda(w)", attachIx.keys[3].pubkey.equals(emlPda) && attachIx.keys[3].isWritable);
  check("account[5]=token_program(Token-2022)", attachIx.keys[5].pubkey.toBase58() === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
}

console.log("\n=== mark_malicious data-layout ===");
const markIx = buildMarkMaliciousIx(walletPda, recipient, payer, nonce, json);
{
  const d = markIx.data;
  const expectedLen = 8 + 32 + 8 + 4 + json.length;
  check("data length", d.length === expectedLen, `${d.length} vs ${expectedLen}`);
  check("discriminator", d.subarray(0, 8).equals(anchorDisc("mark_malicious")));
  check("address @8", d.subarray(8, 40).equals(recipient.toBuffer()));
  check("nonce @40", d.readBigUInt64LE(40) === nonce);
  check("6 accounts", markIx.keys.length === 6, `${markIx.keys.length}`);
  check("account[2]=maliciousPda(w)", markIx.keys[2].pubkey.equals(malPda) && markIx.keys[2].isWritable);
}

console.log("\n=== unmark_malicious data-layout ===");
const unmarkIx = buildUnmarkMaliciousIx(walletPda, recipient, nonce, json);
{
  const d = unmarkIx.data;
  const expectedLen = 8 + 32 + 8 + 4 + json.length;
  check("data length", d.length === expectedLen, `${d.length} vs ${expectedLen}`);
  check("discriminator", d.subarray(0, 8).equals(anchorDisc("unmark_malicious")));
  check("address @8", d.subarray(8, 40).equals(recipient.toBuffer()));
  check("nonce @40", d.readBigUInt64LE(40) === nonce);
  check("4 accounts", unmarkIx.keys.length === 4, `${unmarkIx.keys.length}`);
  check("account[2]=maliciousPda(w)", unmarkIx.keys[2].pubkey.equals(malPda) && unmarkIx.keys[2].isWritable);
}

console.log("\n=== createMintForPoisonToken + POISON_MINT_LEN (Route B, STATUS.md §26) ===");
{
  check("POISON_MINT_LEN = 234 (basis-82 + TransferHook-extensie)", POISON_MINT_LEN === 234, String(POISON_MINT_LEN));
  const { mintKeypair, tx } = createMintForPoisonToken(payer, 1_000_000);
  check("1 instructie (createAccount)", tx.instructions.length === 1, String(tx.instructions.length));
  const ix = tx.instructions[0];
  check("program = system-program", ix.programId.equals(SystemProgram.programId));
  check("2 accounts (payer, newAccount)", ix.keys.length === 2, String(ix.keys.length));
  check("keys[0] = payer (signer,w)", ix.keys[0].pubkey.equals(payer) && ix.keys[0].isSigner && ix.keys[0].isWritable);
  check("keys[1] = mintKeypair.publicKey (signer,w — createAccount vereist een signer voor het nieuwe adres)", ix.keys[1].pubkey.equals(mintKeypair.publicKey) && ix.keys[1].isSigner && ix.keys[1].isWritable);
  check("lamports = meegegeven waarde (NIET de oude 0)", ix.data.readBigUInt64LE(4) === 1_000_000n, String(ix.data.readBigUInt64LE(4)));
  check("space = POISON_MINT_LEN", ix.data.readBigUInt64LE(12) === BigInt(POISON_MINT_LEN), String(ix.data.readBigUInt64LE(12)));
  check("owner = Token-2022", new PublicKey(ix.data.subarray(20, 52)).toBase58() === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
}

console.log("\n" + (failures === 0 ? "✓✓✓ ALLE CHECKS GESLAAGD ✓✓✓" : `✗✗✗ ${failures} CHECKS GEFALLEN ✗✗✗`));
process.exit(failures === 0 ? 0 : 1);
