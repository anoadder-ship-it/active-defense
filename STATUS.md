

## 39. Werkende localnet-loop op deze host, zonder publiek netwerk (2026-09-26)

Vier breuken waren nodig voordat deze loop bestond. Drie daarvan stonden niet in
de handover: de ESM-crash in `poisonDecodeProvenance.ts` die het inladen van de
hele suite afbrak (sectie 38's context), het feit dat `anchor test` met exit 0
eindigde ná een fatale RPC-fout, en het ontbreken van enige mocha-assert. De
vierde — hardcoded devnet-endpoints en een eigen keypair-lezing in elke test —
stond er wél, maar met de verkeerde diagnose: het `[provider]`-blok in
`Anchor.toml` wordt door de scripts helemaal niet gelezen.

### Wat er nu staat

* `tests/lib/env.ts`: `AD_RPC_URL` → `ANCHOR_PROVIDER_URL` → devnet, en
  `AD_PAYER` → `~/.config/solana/id.json`. Defaults zijn exact het oude gedrag,
  gemeten en niet aangenomen.
* Vijf scripts omgezet, elk in een eigen commit.
* `--fail-zero` in het test-script, want "0 passing" met exit 0 is geen groen.
* Fee-betaler gescheiden van de upgrade-authority: `localnet-payer-keypair.json`,
  het programmakpair tekent geen transactiekosten meer.

### Reproduceerbaar commando

```bash
# 1. validator (native aarch64, Agave 4.1.2 — ZIE WAARSCHUWING ONDER)
/home/michel/projects/agave/bin/solana-test-validator \
  --ledger /tmp/ad-localnet-ledger --reset \
  --rpc-port 13399 --gossip-port 13301 --faucet-port 13388 \
  --dynamic-port-range 13500-13540 --bind-address 127.0.0.1 --quiet \
  --bpf-program FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK \
      ~/projects/active-defense/target/deploy/active_defense.so \
  --bpf-program BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk \
      ~/.config/active-defense/testfixture/spankwallet-src/target/deploy/spankwallet.so

# 2. fee-payer spijzen
solana --url http://127.0.0.1:13399 airdrop 3 6faFXAjSoQqj4DHvyjw8xEYRA4VEsryvaK2qwnJHgD4A

# 3. één script, expliciet tegen lokaal
AD_RPC_URL=http://127.0.0.1:13399 \
AD_PAYER=~/.config/active-defense/localnet-payer-keypair.json \
node -r ts-node/register tests/activeDefenseFull.ts
```

Poorten 133xx zijn bewust: de andere sessie gebruikt 8899/8001 en soms
8960/8061. `--ws-port` bestaat niet in deze test-validator (clap-fout), ws volgt
de rpc-poort.

### Meting

Validator op slot 822 na ~30 s; beide programma's `executable=true` onder
`BPFLoaderUpgradeable`. Run: exit 0, 17 × ✓, 0 × ✗.

```
Payer      6faFXAjSoQqj4DHvyjw8xEYRA4VEsryvaK2qwnJHgD4A   3,0000 SOL
Wallet PDA 65gNcvbvg3AApcb9QZPTQAPGdi3rPLy4iiMTZiUKsqUS
Mint       C2Syu5mRsxCkppNAcLTGmfwRLHWXvdUjDGLj3Zq3Hs97   mintLen=234
Transfer naar ongeautoriseerde ontvanger: GEBLOKKEERD
    (AccountNotInitialized op de AuthorizedRecipient-PDA)
Transfer naar geautoriseerde ontvanger:   GESLAAGD, saldo 500.000
```

Bewijs dat er geen publiek netwerk bij kwam: payer is de wegwerp-sleutel, het
woord "devnet" komt in de log niet voor, geen enkele 429.

### Waarschuwingen die erbij horen

1. **De vinkjes zijn geen asserts.** 17 `console.log`-regels; `anchor test` als
   suite meldt nog steeds `0 passing`. Deze groen komt van het script direct
   aanroepen. Zolang dat zo is, betekent groen "het script liep uit", niet
   "de eigenschappen gelden".
2. **Eén van de vijf scripts uitgeoefend.** De andere vier zijn alleen omgezet,
   niet tegen localnet gedraaid.
3. **Runtime-versie.** Localnet is Agave 4.1.2; de LiteSVM-harness draait op
   4.2.2-runtime-crates. CU-cijfers tussen die twee zijn niet uitwisselbaar en
   elke meting moet zeggen welke van de twee hij is.
4. **Geheugendruk.** Deze host had tijdens deze run 5,7–6,0 GiB beschikbaar bij
   een draaiende validator van de andere sessie. Twee validators tegelijk kan
   hier, maar het is geen comfortabele marge.
