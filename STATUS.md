

## 42. Fix 1 uitgevoerd: wallet-autenticiteit, met gemeten kosten (2026-09-26)

Sectie 41 beschreef het lek; dit is de reparatie die ervoor in de plaats staat,
plus wat die kost.

### Wat er nu geëist wordt

`bevestig_echte_wallet()` draait vóórdat `add_authorized_recipient` iets anders
doet dan argumenten in ontvangst nemen:

1. `wallet.owner` is spankwallet (`9ma6vQ…`).
2. het veld `wallet_seed_hash` in de accountdata is gelijk aan `sha256` van het
   veld `seed_key` uit dezelfde data — het account kan dus niet zijn eigen
   identiteit verzinnen;
3. het adres van het account is `find_program_address(["wallet", hash], spankwallet)`.

Punt 3 is de eigenlijke sluiting: een aanvaller kan geen account meer neerzetten
dat toevallig op een wallet lijkt, want het adres moet de PDA zijn die het
spankwallet-programma zelf voor die sleutel voortbrengt.

### Toetsen

| test | wat hij eist |
|---|---|
| `vervalsd_wallet_account_wordt_geweigerd` | de §41-aanval faalt nu met 6011/6013 |
| `echte_spankwallet_wallet_autoriseert_wel` | een wallet op het echte PDA-adres werkt nog |
| `handtekening_over_andere_mint_wordt_geweigerd` | challenge-binding blijft werken |

Drie groen. De karakteriserende test uit §41 is omgezet naar verwerping, precies
zoals zijn commentaar aankondigde — dat is het moment waarop zo'n test nuttig is
geweest.

### Wat het kost

A/B gemeten in dezelfde harness, twee builds achter elkaar:

```
zonder fix  .so cb7df5e360c80938   add_authorized_recipient   18 262 CU
met fix     .so b35d3f3b3abe3839   add_authorized_recipient   22 958 CU
                                          delta                +4 696  (+25,7 %)
```

Een kwart meer compute voor één instructie die zelden voorkomt (wallet-beheer,
niet de transfer-route). Ruim binnen de 400k-limiet. De transfer-route zelf is
onraakbaar — daar draait deze controle niet.

Mijlpaal 2 draaide na de fix ongewijzigd groen door: twaalf stappen, autoriseerde
transfer 31 926 CU, ongeautoriseerde geblokkeerd met 3012.

### Wat er open blijft

1. **Fix 2 (semantiek).** De instructie vraagt nog steeds niet of de wallet er
   iets mee te maken heeft. Iemand met een *legitieme* eigen wallet kan nog steeds
   ontvangers autoriseren op een mint die van hem niet is, want de
   `AuthorizedRecipient`-PDA is gekoppeld aan `(mint, recipient)` en niet aan de
   wallet of aan de hook-authority van de mint. Fix 1 maakt het vervalsen
   onmogelijk, niet het misbruik van een eigen wallet.
2. **De TS-tests staan op gespannen voet met de fix.** `tests/activeDefenseFull.ts`
   en de geïsoleerde varianten zetten `9ma6vQ…` op hun blokkeerlijst om nooit per
   ongeluk het echte programma aan te spreken, en gebruiken de fixture op
   `BUtmiN…`. Het programma accepteert nu alleen wallets onder `9ma6vQ…`. Op
   localnet is dat oplosbaar (de fixture lokaal op dat adres zetten), maar het
   botst met een bewuste veiligheidspoort in hun code — dus dat is geen wijziging
   om even door te voeren.
3. **Dezelfde poort elders.** `attach_transfer_hook`, `mark_malicious` en
   `unmark_malicious` nemen `wallet` ook als `UncheckedAccount` zonder deze
   controle. Voor `mark_malicious` is de schade kleiner (de PDA-seed bevat
   `wallet.key()`, dus iemands eigen lijst kan niet door een ander worden
   volgeschreven zolang de adressen verschillen), maar het is dezelfde klasse en
   verdient dezelfde controle.
