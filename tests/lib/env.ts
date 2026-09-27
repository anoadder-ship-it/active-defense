/**
 * Endpoint en fee-betaler van de tests, uit de omgeving.
 *
 * Bestaat omdat elke test-script hier voorheen hardcoded
 * `https://api.devnet.solana.com` en `~/.config/solana/id.json` in zich droeg:
 * daardoor schreef élke run (ook een die alleen lokaal bedoeld was) echte
 * accounts op devnet, en was localnet-testen onmogelijk zonder bij-effect.
 *
 * De defaults zijn bewust exact wat er eerder stond. Wie niets instelt krijgt
 * dus hetzelfde gedrag als voorheen; wie localnet wil zet AD_RPC_URL.
 */
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import os from "os";

export const DEVNET_URL = "https://api.devnet.solana.com";

/** AD_RPC_URL wint, dan ANCHOR_PROVIDER_URL (door anchor zelf gezet), dan devnet. */
export function rpcUrl(): string {
  return process.env.AD_RPC_URL ?? process.env.ANCHOR_PROVIDER_URL ?? DEVNET_URL;
}

export function isLocalnet(url: string = rpcUrl()): boolean {
  return /(^|\/\/)(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
}

/** AD_PAYER wint; anders de lokale dev-sleutel zoals die hier altijd al was. */
export function payerPath(): string {
  const home = process.env.HOME ?? os.homedir();
  return process.env.AD_PAYER ?? `${home}/.config/solana/id.json`;
}

export function loadPayer(): Keypair {
  const pad = payerPath();
  const raw = JSON.parse(fs.readFileSync(pad, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function connect(): Connection {
  return new Connection(rpcUrl(), "confirmed");
}

/** Eén regel logboek per run, zodat altijd zichtbaar is tégen welk netwerk er
 *  iets beweerd te testen — en met welke sleutel. */
export function beschrijfOpstelling(): string {
  const url = rpcUrl();
  return `rpc=${url}${isLocalnet(url) ? " (localnet)" : " (NET-LIEF: deze run schrijft naar een publiek netwerk)"}`;
}
