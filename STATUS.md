

## 46. Stap 3 over de TS-routes, en een fout die ik drie keer maakte (2026-09-26)

De wallet-controle uit fix 1 geldt nu ook voor `attach_transfer_hook`,
`mark_malicious` en `unmark_malicious`; die drie eisen daarom de
vertrouwensconfig-account. Cliëntkant: `buildAttachTransferHookIx`,
`buildMarkMaliciousIx` en `buildUnmarkMaliciousIx` voegen hem toe als laatste
account, en `verify-poisonToken.ts` telt attach op 10 met een expliciete check op
`account[9] = wallet_config (read-only)`.

Volledige sweep, één run, `.so 6be1bf0a8513ef90`: harness 6/6 ok, mijlpaal 2
groen (13 stappen), `verify-poisonToken` alle checks geslaagd, en
`activeDefenseFull` / `attachTransferHookIsolated` / `poisonTransferHookIsolated` /
`clientLibraryE2E` allemaal exit 0.

### De fout die drie keer achter elkaar dezelfde was

In hookflow, in `clientLibraryE2E.ts` en in beide geïsoleerde scripts zette ik de
config-stap vóór `add_authorized_recipient` — goed zolang alleen add de config las.
Nadat attach hem ook nodig had, liep attach vast op `AccountNotInitialized` (3012)
voor account `config`. Eén keer was onoplettendheid, drie keer is een patroon: ik
plaatste een stap op de plek waar ík hem nodig dacht, niet op het moment waarop het
programma hem voor het eerst leest. De volgorde in een test is geen smaak, het is
een aannames over het programma.

Eerste run na de wiring: 1 van 4 groen, met twee TS2300-dubbelimporten (de
config-PDA kwam al uit `./lib/vertrouwensconfig`) en twee volgordefouten. Tweede
run: 2 van 4. Derde run: 4 van 4. Dat is de reeks die achter "allemaal groen" staat.
