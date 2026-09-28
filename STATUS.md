

## 44. Stap 1 compleet over alle paden (2026-09-26)

Sectie 43 sloot de programma-kant af en liet vijf TS-routes kapot achter. Die zijn
nu aangesloten, en de client-library kent de config zelf — anders blijft elke
consument buiten onze tests gebroken.

### Wat er veranderde

`client/src/poisonToken.ts`: `WALLET_CONFIG_SEED`, `deriveWalletConfigPda()`,
`buildSetWalletProgramIx()`, en de config-PDA onderaan de keys van
`buildAddAuthorizedRecipientIx()`.

`tests/lib/vertrouwensconfig.ts` (nieuw): één gedeelde
`zorgVoorVertrouwensConfig()` die de config zet tenzij hij al bestaat
(schrijf-één-keer) en daarna terugleest dát hij naar het verwachte programma
wijst. Gedeeld in plaats van vijf kopiën — dezelfde reden als de ene gedeelde
`POISON_AUTHORIZED_SEED` in de programma-bron: twee kopieën driften.

### Metingen

Elk script tegen `.so 73464061a78d1e27`, elk in een eigen localnet-validator:

| script | exit |
|---|---|
| `activeDefenseFull.ts` | 0 — config lees-bevestigd op de fixture-ID |
| `addAuthorizedRecipientIsolated.ts` | 0 |
| `attachTransferHookIsolated.ts` | 0 |
| `poisonTransferHookIsolated.ts` | 0 |
| `clientLibraryE2E.ts` | 0 |

Harness: 8 accountmodel + 6 layout-conformance, groen. Validator achteraf gecontroleerd: geen proces, geen ledger restant.

### De assertie die ik zocht en vond

`client/src/verify-poisonToken.ts` bevatte `check("7 accounts", ...)` voor
`add_authorized_recipient`. Met de config erbij is dat 8. Nu: 8, plus een
expliciete check dat `account[7]` de wallet-config-PDA is en read-only staat, en
een blok dat `buildSetWalletProgramIx` na meet (3 accounts, data 40 byte,
wallet_program op offset 8).

Opmerkelijk: dat verificatiescript draait alleen handmatig. Er hangt geen poortje
aan, dus een veroudererde assertie daarin had niets geblokkeerd en niemand gewezen
op de nieuwe account. Dat is een opening in de handhaving, niet in de code.

### Eigen fouten deze ronde

- Het importpad van de helper was `../client/...`; vanuit `tests/lib/` moet dat
  `../../client/...`. Eerste run: TS2307.
- Mijn eerste meetronde grepde alleen op de samenvattingsregel, dus drie
  mislukte scripts kwamen terug zonder foutmelding. Pas daarna pakte ik de echte
  tekst — dezelfde les als eerder vandaag: meet de oorzaak, niet het samenvatting.

### Wat er nog open staat

1. **Stap 2 — de semantiek.** Een legitieme wallet kan nog steeds ontvangers
   autoriseren op een mint die niet van hem is.
2. **Stap 3 — dezelfde wallet-controle ontbreekt** bij `attach_transfer_hook`,
   `mark_malicious` en `unmark_malicious`.
3. **Handhaving.** `verify-poisonToken.ts` draait buiten elk poortje; overwegen het
   in de harness-loop op te nemen.
