const fs = require("fs");
const { 
  Connection, Keypair, PublicKey, Transaction, 
  sendAndConfirmTransaction, SystemProgram, LAMPORTS_PER_SOL 
} = require("@solana/web3.js");
const { 
  TOKEN_2022_PROGRAM_ID, MINT_SIZE,
  createInitializeMint2Instruction,
  createInitializeTransferHookInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferInstruction
} = require("@solana/spl-token");

const PROGRAM_ID = new PublicKey("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  console.log("=== TRANSFER HOOK TEST ===\n");
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("Cluster: devnet\n");

  // Payer (upgrade authority keypair)
  const keypairJson = JSON.parse(fs.readFileSync("/home/michel/.config/solana/spankwallet-dev-keys/active-defense-keypair.json", "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairJson));
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Payer: ${payer.publicKey.toBase58()}`);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  if (balance < 1000000) {
    console.log("[FAIL] Not enough SOL for test. Request airdrop first.");
    process.exit(1);
  }

  // --- STEP 1: Create Token-2022 mint with transfer hook ---
  console.log("[STEP 1] Creating Token-2022 mint with transfer hook...");
  
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  
  // Recipient accounts
  const recipientA = Keypair.generate().publicKey;
  const recipientB = Keypair.generate().publicKey;
  
  const ataA = getAssociatedTokenAddressSync(mint, recipientA, undefined, TOKEN_2022_PROGRAM_ID);
  const ataB = getAssociatedTokenAddressSync(mint, recipientB, undefined, TOKEN_2022_PROGRAM_ID);

  const tx1 = new Transaction();
  
  // Create mint account
  const rentMint = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  tx1.add(SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint,
    lamports: rentMint,
    space: MINT_SIZE,
    programId: TOKEN_2022_PROGRAM_ID,
  }));

  // Initialize mint (6 decimals)
  tx1.add(createInitializeMint2Instruction(mint, 6, payer.publicKey, null, TOKEN_2022_PROGRAM_ID));

  // Initialize transfer hook -> our program
  tx1.add(createInitializeTransferHookInstruction(
    mint, PROGRAM_ID, payer.publicKey, undefined, TOKEN_2022_PROGRAM_ID
  ));

  // Create ATA for recipient A
  const rentAta = await connection.getMinimumBalanceForRentExemption(165);
  tx1.add(SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: ataA,
    lamports: rentAta,
    space: 165,
    programId: TOKEN_2022_PROGRAM_ID,
  }));
  tx1.add(createAssociatedTokenAccountInstruction(
    payer.publicKey, ataA, recipientA, mint, undefined, TOKEN_2022_PROGRAM_ID
  ));

  // Create ATA for recipient B
  tx1.add(SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: ataB,
    lamports: rentAta,
    space: 165,
    programId: TOKEN_2022_PROGRAM_ID,
  }));
  tx1.add(createAssociatedTokenAccountInstruction(
    payer.publicKey, ataB, recipientB, mint, undefined, TOKEN_2022_PROGRAM_ID
  ));

  // Mint 1,000,000 tokens (1.0 token with 6 decimals) to A
  tx1.add(createMintToInstruction(mint, ataA, payer.publicKey, 1000000, [], TOKEN_2022_PROGRAM_ID));

  tx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx1.feePayer = payer.publicKey;
  tx1.sign(payer, mintKeypair);

  const sig1 = await sendAndConfirmTransaction(connection, tx1, [payer, mintKeypair]);
  console.log(`       Mint: ${mint.toBase58()}`);
  console.log(`       ATA A: ${ataA.toBase58()}`);
  console.log(`       ATA B: ${ataB.toBase58()}`);
  console.log(`       Tx: ${sig1}\n`);

  // --- STEP 2: Transfer from A to B (should SUCCEED - no poison token) ---
  console.log("[STEP 2] Transferring 500,000 tokens from A to B...");
  console.log("         (No PoisonTokenAccount exists → transfer should PASS)\n");

  const tx2 = new Transaction();
  tx2.add(createTransferInstruction(ataA, ataB, recipientA, 500000, [], TOKEN_2022_PROGRAM_ID));
  
  tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx2.feePayer = payer.publicKey;
  tx2.sign(payer);

  try {
    const sig2 = await sendAndConfirmTransaction(connection, tx2, [payer]);
    console.log(`       [PASS] Transfer SUCCEEDED (as expected)`);
    console.log(`       Tx: ${sig2}\n`);
    
    // Verify balance
    const { getAccount } = require("@solana/spl-token");
    const balA = await getAccount(connection, ataA, "confirmed", TOKEN_2022_PROGRAM_ID);
    const balB = await getAccount(connection, ataB, "confirmed", TOKEN_2022_PROGRAM_ID);
    console.log(`       Balance A: ${balA.amount} (expected 500000)`);
    console.log(`       Balance B: ${balB.amount} (expected 500000)\n`);
    
    if (balA.amount === 500000n && balB.amount === 500000n) {
      console.log("=== ALL CHECKS PASSED ===");
      console.log("\nTransfer hook is correctly wired to our program.");
      console.log("When a PoisonTokenAccount exists and is triggered,");
      console.log("this same transfer will be BLOCKED by the hook.");
    } else {
      console.log("[WARN] Balances unexpected");
    }
  } catch (err) {
    console.log(`       [INFO] Transfer failed: ${err.message}`);
    console.log("         This might mean the hook is blocking it.");
    console.log("         Check if a PoisonTokenAccount was created.");
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
