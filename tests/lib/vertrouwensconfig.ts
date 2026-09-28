/**
 * De vertrouwensconfig zetten en lees-bevestigen (STATUS.md sectie 43).
 *
 * Gedeeld door de TS-scripts. Vier kopiën van dezelfde stap is precies de drift
 * waar dit project al op brandde (zie de opmerking bij POISON_AUTHORIZED_SEED in
 * de programma-bron: één gedeelde constante, niet twee losse).
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { buildSetWalletProgramIx, deriveWalletConfigPda } from "../../client/src/poisonToken";

export interface ConfigResult {
  walletProgram: string;
  bestondAl: boolean;
}

/**
 * Zet `set_wallet_program` tenzij de config al bestaat (schrijf-één-keer), en lees
 * daarna terug dát hij naar `walletProgram` wijst. De lees-bevestiging is geen
 * versiering: zonder die weet je niet of een eerdere run op dezelfde ledger een
 * andere waarde zette.
 */
export async function zorgVoorVertrouwensConfig(
  connection: Connection,
  payer: Keypair,
  walletProgram: PublicKey,
  label = "CONFIG"
): Promise<ConfigResult> {
  const [configPda] = deriveWalletConfigPda();
  const bestondAl = (await connection.getAccountInfo(configPda, "confirmed")) !== null;

  if (!bestondAl) {
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(buildSetWalletProgramIx(walletProgram, payer.publicKey)),
      [payer],
      { commitment: "confirmed" }
    );
  }

  const acc = await connection.getAccountInfo(configPda, "confirmed");
  if (acc === null) throw new Error(`${label}: config-account bestaat niet na het zetten`);

  // Layout (programma state.rs): discriminator(8) + wallet_program(32) + gezet_door(32)
  const gezet = new PublicKey(acc.data.subarray(8, 40)).toBase58();
  if (gezet !== walletProgram.toBase58()) {
    throw new Error(`${label}: config wijst naar ${gezet}, verwacht ${walletProgram.toBase58()}`);
  }
  console.log(`  ✓ vertrouwensconfig: wallet-eigenaar = ${gezet}${bestondAl ? " (bestond al, alleen nagelezen)" : ""}`);
  return { walletProgram: gezet, bestondAl };
}

export { deriveWalletConfigPda };
