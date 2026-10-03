#!/usr/bin/env node
/* Atoomaire deploy van het active-defense-programma: program-account + DeployWithMaxDataLen
 * + SetAuthority, in ÉÉN transactie, zodat het programma onder de multisig-vault GEBOREN wordt.
 *
 * Waarom handgebouwd: `solana program deploy --upgrade-authority` aanvaardt alleen een
 * keypair-bestand, geen kaal PDA-adres (STATUS §72). En `deploy` + apart `set-upgrade-authority`
 * laat een window bestaan waarin een hete sleutel de macht draagt (§76).
 *
 * Accountvolgorde ontleend aan agave/programs/bpf_loader/src/lib.rs, niet aan een SDK
 * (web3.js 1.98/1.99 exporteert hier geen UpgradeableLoader) — STATUS §76.
 *
 * Standaard SIMULEERT dit script alleen. Pas met --stuur wordt er echt verzonden.
 *
 * Gebruik:
 *   node scripts/ceremonie-deploy.js \
 *     --betaler <pad.json> --program-id-keypair <pad.json> --buffer <BASE58> \
 *     --max-len 734112 --vault <BASE58> --bevestig <BASE58> \
 *     --so target/deploy/active_defense.so [--url <rpc>] [--stuur]
 */
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram,
        SYSVAR_RENT_PUBKEY, SYSVAR_CLOCK_PUBKEY } = require("@solana/web3.js");
const fs = require("fs"), crypto = require("crypto");

const LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
function args(v) { const i = v.findIndex(x => x.startsWith("--")); return i < 0 ? {} : v.slice(i).reduce((a, x, j, arr) => {
  if (x.startsWith("--")) a[x.slice(2)] = arr[j + 1] && !arr[j + 1].startsWith("--") ? arr[j + 1] : true; return a; }, {}); }
const A = args(process.argv);
const sha = b => crypto.createHash("sha256").update(b).digest("hex");

function nodig(v) { for (const k of v) if (!A[k]) { console.error(`FAAL: --${k} ontbreekt`); process.exit(2); } }

(async () => {
  nodig(["betaler","program-id-keypair","buffer","max-len","vault","bevestig","so"]);
  if (A.vault !== A.bevestig) { console.error("FAAL: --vault en --bevestig verschillen — typfout in de autoriteit maakt het programma definitief onbereikbaar (§68/§71)."); process.exit(2); }

  const url = A.url || "https://api.mainnet-beta.solana.com";
  const conn = new Connection(url, "confirmed");
  const betaler = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(A.betaler, "utf8"))));
  const nieuwId = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(A["program-id-keypair"], "utf8"))));
  const buffer = new PublicKey(A.buffer);
  const vault = new PublicKey(A.vault);
  const maxLen = Number(A["max-len"]);
  const so = fs.readFileSync(A.so);

  console.log(`cluster      : ${url}`);
  console.log(`betaler      : ${betaler.publicKey.toBase58()}`);
  console.log(`program-id   : ${nieuwId.publicKey.toBase58()}`);
  console.log(`vault        : ${vault.toBase58()}  (kan niet tekenen — dit is onomkeerbaar)`);
  console.log(`code         : ${so.length} byte  sha256 ${sha(so)}`);
  console.log(`max_data_len : ${maxLen}`);

  if (!Number.isInteger(maxLen) || maxLen < so.length) {
    console.error(`FAAL: max-len (${maxLen}) kleiner dan de code (${so.length}) — past niet (§72).`); process.exit(2);
  }
  for (const k of ["betaler","program-id-keypair"]) { /* geen autoriteit op een tekenbaar adres */ }
  if (vault.equals(betaler.publicKey) || vault.equals(nieuwId.publicKey)) {
    console.error("FAAL: de vault is een adres waarvan hier een sleutel ligt — dat is geen multisig-autoriteit."); process.exit(2);
  }

  // vooraf: buffer moet bestaan, van ons zijn, en dezelfde code bevatten
  const bi = await conn.getAccountInfo(buffer);
  if (!bi) { console.error(`FAAL: buffer ${A.buffer} bestaat niet op ${url}`); process.exit(2); }
  const boff = bi.data.indexOf(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  if (boff < 0) { console.error("FAAL: geen ELF in de buffer"); process.exit(2); }
  const bknip = bi.data.subarray(boff, boff + so.length);
  if (sha(Buffer.from(bknip)) !== sha(so)) { console.error("FAAL: buffer bevat ANDERE code dan de lokale .so"); process.exit(2); }
  console.log(`buffer       : OK — zelfde bytecode (${sha(so).slice(0,16)}…)`);

  const [pd] = PublicKey.findProgramAddressSync([nieuwId.publicKey.toBuffer()], LOADER);
  const rent36 = await conn.getMinimumBalanceForRentExemption(36);
  const huurPD = await conn.getMinimumBalanceForRentExemption(45 + maxLen);
  console.log(`huur ProgramData ~ ${(huurPD / 1e9).toFixed(4)} SOL (+ ${rent36/1e9} SOL program-account)`);

  const d = Buffer.alloc(12); d.writeUInt32LE(2, 0); d.writeBigUInt64LE(BigInt(maxLen), 4);
  const deploy = { programId: LOADER, keys: [
      { pubkey: betaler.publicKey, isSigner: true,  isWritable: true },   // 0 betaler
      { pubkey: pd,                isSigner: false, isWritable: true },   // 1 programdata (afgeleid)
      { pubkey: nieuwId.publicKey, isSigner: true,  isWritable: true },   // 2 program-account
      { pubkey: buffer,            isSigner: false, isWritable: true },   // 3 buffer
      { pubkey: SYSVAR_RENT_PUBKEY,  isSigner: false, isWritable: false },// 4
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },// 5
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 6 systeemprogramma
      { pubkey: betaler.publicKey, isSigner: true,  isWritable: false },  // 7 autoriteit (wordt vervangen)
    ], data: d };

  const setAuth = { programId: LOADER, keys: [
      { pubkey: pd, isSigner: false, isWritable: true },
      { pubkey: betaler.publicKey, isSigner: true, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: false }],
    data: Buffer.from([4, 0, 0, 0]) };

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  tx.add(SystemProgram.createAccount({ fromPubkey: betaler.publicKey, newAccountPubkey: nieuwId.publicKey,
        lamports: rent36, space: 36, programId: LOADER }));
  tx.add(deploy); tx.add(setAuth);
  tx.feePayer = betaler.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
  tx.sign(betaler, nieuwId);

  const sim = await conn.simulateTransaction(tx);  // 2e arg = signers-array in web3.js 1.98, geen config (§78)
  if (sim.value.err) {
    console.error("SIMULATIE FAALT — er is niets verzonden:", JSON.stringify(sim.value.err));
    (sim.value.logs || []).filter(l => /error|not |Incorrect|Missing/i.test(l)).slice(-6).forEach(l => console.error("   ", l));
    process.exit(1);
  }
  console.log(`simulatie    : OK — ${sim.value.unitsConsumed} compute units`);

  if (!A.stuur) { console.log("\nNiet verzonden (geen --stuur). Dit was een droogloop."); return; }

  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 0 });
  await conn.confirmTransaction(sig, "confirmed");
  console.log(`VERZONDEN    : ${sig}`);

  const pdi = await conn.getAccountInfo(pd);
  const raw = pdi.data;
  const BAS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n; for (const x of raw.subarray(13, 45)) n = n * 256n + BigInt(x);
  let s = ""; while (n > 0n) { const r = Number(n % 58n); s = BAS[r] + s; n /= 58n; }
  const auth = s;
  const off = raw.indexOf(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  const knip = raw.subarray(off, off + so.length);
  console.log("\n=== verificatie na deploy ===");
  console.log(`  autoriteit    : ${auth}`);
  console.log(`  == vault      : ${auth === vault.toBase58() ? "JA" : "NEE — STOP, dit is niet de bedoeling"}`);
  console.log(`  max_data_len  : ${raw.length - 45}`);
  console.log(`  bytecode gelijk aan lokale build: ${sha(Buffer.from(knip)) === sha(so) ? "JA" : "NEE"}`);
})().catch(e => { console.error("FAAL:", e.message); if (process.env.AD_TRACE) console.error(e.stack); process.exit(1); });
