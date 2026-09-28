

## 43. Stap 1: vertrouwensconfig, en wat mutaties over onze tests zeiden (2026-09-26)

### Waarom dit moest

Fix 1 zette de vertrouwde wallet-programma-ID als constante in het programma.
Gemeten gevolg: onze eigen localnet-run brak — `add_authorized_recipient` tegen
een fixture-wallet gaf `WalletNietVanSpankwallet` (6011), exit 1, terwijl dezelfde
script tegen de `.so` vóór fix 1 groen doorliep. Een trust-root in een hardcode
betekent dat geen enkele omgeving behalve mainnet de controle kan doorstaan.

### Het ontwerp

`WalletProgramConfig` op PDA `["wallet_config"]`, gezet door `set_wallet_program`.
Twee bewuste ongemakken:

- **Geen update-pad.** `init` faalt als de config bestaat. Verkeerd gezet is
  herdeployen. Een update-route vraagt om een autoriteit die die update mag doen,
  en die autoriteit is even gevoelig als het programma zelf — daarmee had ik een
  hardcode door een ander hardcode vervangen.
- **Front-run-raam.** De eerste aanroep wint, dus `set_wallet_program` hoort in
  dezelfde transactie als de programmdeploy. Dat is geen formaliteit: wie daar
  first is, krijgt zijn eigen wallet-programma vertrouwd.

Lezende instructies eisen de config via een seeds-constraint. Ontbreekt hij, dan
faalt de instructie — fail-closed. In localnet gemeten als `AccountNotEnoughKeys`
(3005), veroorzaakt door account `config`.

### Wat de mutaties zeiden

Vier mutaties door het programma, met telkens de test die rood moet worden:

| mutatie | rood |
|---|---|
| M1 PDA-afleiding weglaten | `wallet_met_goede_eigenaar_maar_verkeerd_adres_wordt_geweigerd` |
| M3 her-init toestaan | `tweede_config_zetting_wordt_geweigerd` |
| M4 seed-hash-controle weglaten | `wallet_met_vervalste_seed_hash_wordt_geweigerd` |
| M5 eigenaarscheck weglaten | `vervalsd_wallet_account_wordt_geweigerd` |

Twee van die vier tests bestonden nog niet toen ik begon, en de reden waarom is de
moeite waard om op te schrijven:

1. **M1 maakte in eerste instantie niets rood.** De aanvalstest uit §41 zette een
   account neer met een fout eigendom-programma, dus hij struikelde over de
   eigenaarscheck en bereikte de PDA-controle nooit. De test heette "vervaalsd
   wallet-account wordt geweigerd" en dekte die tak niet.
2. **M5 maakte ook niets rood.** Dezelfde test aanvaardde `6011 óf 6013`, dus toen
   de eigenaarscheck wegviel ving de PDA-tak hem op en bleef hij groen.

Beide zijn aangescherpt naar precies één foutcode, en er zijn twee tests bij:
één die de PDA-tak bereikt (goed eigendom-programma, verkeerd adres) en één die de
seed-hash-tak bereikt (goed adres, vervalst hash-veld). Dat is de eerste keer vandaag
dat een mutatiesweep míjn testdekking corrigeerde in plaats van van tevoren te
weten wat ik zou moeten schrijven.

### Kosten

A/B op dezelfde harness, drie binaire bestanden:

```
pre-fix   .so 32971d30b65aeda3   add_authorized_recipient   18 262 CU
fix 1     .so b35d3f3b3abe3839   add_authorized_recipient   22 958 CU
config    .so 73464061a78d1e27   add_authorized_recipient   28 006 CU   (+9 744 t.o.v. pre-fix)
```

De transfer-route is onveranderd: 31 926 CU voor een autoriseerde `transferChecked`.
`set_wallet_program` zelf kost 12 959 CU en draait once per deployment.

### Status van de paden (twee claims, gescheiden)

- **Mechanisme in de VM:** acht tests groen, mijlpaal 2 dertien stappen groen.
- **Onze E2E-route:** nog rood. `tests/activeDefenseFull.ts` kent de config niet en
  faalt op `AccountNotEnoughKeys` (3005). Dat is de volgende werkpost: een stap
  `set_wallet_program(fixture-id)` vóór alles, plus de config-account in de
  accountlijst van `add_authorized_recipient`.
