const { Connection, PublicKey } = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

function derivePoisonTokenPda(walletPda, mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("poison_token"), walletPda.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  );
}

function deriveMaliciousPda(walletPda) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("malicious"), walletPda.toBuffer()],
    PROGRAM_ID
  );
}

async function main() {
  console.log("=== ACTIVE DEFENSE VERIFICATION ===\n");

  // Test 1: Program deployed?
  const acct = await connection.getAccountInfo(PROGRAM_ID);
  if (acct) {
    console.log("[PASS] Program LIVE on devnet");
    console.log(`       Size: ${acct.data.length} bytes`);
    console.log(`       Balance: ${(acct.lamports / 1e9).toFixed(4)} SOL`);
  } else {
    console.log("[FAIL] Program NOT found");
    process.exit(1);
  }

  // Test 2: PDA derivation
  const wallet = new PublicKey("9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9");
  const mint = new PublicKey("So11111111111111111111111111111111111111112");

  const [ptPda, ptBump] = derivePoisonTokenPda(wallet, mint);
  const [mPda, mBump] = deriveMaliciousPda(wallet);

  console.log(`\n[PASS] PDA derivation works`);
  console.log(`       Poison Token: ${ptPda.toBase58()} (bump=${ptBump})`);
  console.log(`       Malicious:    ${mPda.toBase58()} (bump=${mBump})`);

  // Test 3: Account reading (should be null)
  const ptAcct = await connection.getAccountInfo(ptPda);
  const mAcct = await connection.getAccountInfo(mPda);
  console.log(`\n[PASS] Account reading works`);
  console.log(`       Poison Token account: ${ptAcct ? "EXISTS" : "not yet created (expected)"}`);
  console.log(`       Malicious account:    ${mAcct ? "EXISTS" : "not yet created (expected)"}`);

  console.log("\n=== ALL CHECKS PASSED ===");
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
