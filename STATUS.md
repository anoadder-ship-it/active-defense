

## 45. Fix 2: autoriseren kan alleen op een mint waarvan je de hook zette (2026-09-26)

### Eerst meten, toen schrijven

Twee metingen in `harness/tests/accountmodel.rs` voordat er programmalogica stond:

1. **Het `authority`-veld van de TransferHook-extensie is nul.** Niet de
   mint-authoriteit. Oorzaak is hun eigen gedocumenteerde volgorde
   `create → attach_transfer_hook → InitializeMint2`: op het moment van attach
   bestaat er nog geen mint-authoriteit om aan te binden. De gedachte "lees de
   hook-authority van de mint en koppel die aan een wallet" is daarmee onbruikbaar.
2. **Her-attach door een andere wallet faalt toevallig**, op de botsing met de
   ExtraAccountMetaList-allocatie (`Allocate: account … already in use`). Er staat
   geen beleid op her-attach. Write-once voor de nieuwe koppeling is dus geen luxe.

De meting kostte vier pogingen, waarvan drie mijn eigen parser betroffen: ik nam aan
dat de TLV-header op offset 82 stond met type 8256, terwijl hij op 166 staat met
type 14, en een blinde bytewalk leest bij offset 165 `type = 3584` en springt dan
duizenden bytes door. De parser verankert nu op het bekende hook-programma en laat
de header zichzelf identificeren; staat daar niet type 14 / lengte 64, dan geeft hij
`None` in plaats van een gok.

### Wat het programma nu eist

`MintOwner` op PDA `["mint_owner", mint]`, geschreven door `attach_transfer_hook`
via `init` — dus eenmalig, niet overschrijfbaar — en vereist door
`add_authorized_recipient` met `mint_owner.wallet == wallet.key()`
(6014 WalletNietDeMintEigenaar). Daarmee is het rest-gat uit §42 dicht: een andere,
volstrekt geldige wallet kan niet meer autoriseren op een mint die hij niet ge-attach
heeft.

### Bewijs

11 tests groen. Mutatie M6 (de binding weglaten) maakt precies twee tests rood:
`andere_legitieme_wallet_autoriseert_niet_op_vremde_mint` en
`koppeling_is_schrijf_een_keer`.

| pad | status |
|---|---|
| harness 11 + layout 6 | groen |
| mijlpaal 2 (hookflow) | 13 stappen groen |
| `activeDefenseFull.ts` | exit 0 |
| `attachTransferHookIsolated.ts` | exit 0 |
| `poisonTransferHookIsolated.ts` | exit 0 (de 3012 daarin is zijn eigen negatieve test) |
| `clientLibraryE2E.ts` | exit 0 |
| `verify-poisonToken.ts` | 9 accounts voor attach én add, met checks op `account[8]` |

### Kosten

```
attach_transfer_hook       16 688 → 30 258 CU   (+13 570: nieuwe account + PDA)
add_authorized_recipient   28 006 → 30 137 CU   (+ 2 131)
transfer-route             31 926 CU            (onveranderd)
```

### Besluit dat ik niet voor me uit heb genomen

`tests/addAuthorizedRecipientIsolated.ts` is opgezet om `add_authorized_recipient`
*los van* attach te testen — "een willekeurige mint, geen attach". Fix 2 maakt die
opzet onmogelijk: zonder koppeling faalt de instructie per ontwerp. Ik heb het
script niet stilzwijgend herschreven. Twee eerlijke opties:

1. **Om bouwen tot de negatieve test van fix 2** op het echte netwerk: add zonder
   attach moet falen met 6014. Dan houdt het script een zinvolle functie en wordt
   de reparatie ook buiten de VM afgedwongen.
2. **Met naam en toenaam pensioen** geven, met een regel die uitlegt waarom de
   premisse niet meer bestaat.

Mijn voorkeur is 1. Het is een beslissing over wat hun testsuite claimt, dus die
leg ik neer in plaats van te kiezen.

### Nog open

Stap 3: `attach_transfer_hook`, `mark_malicious` en `unmark_malicious` nemen
`wallet` nog steeds als `UncheckedAccount` zonder de autenticiteitscontrole uit
fix 1. Bij `attach` weegt dat nu zwaarder dan voorheen: deze instructie schrijft
namelijk de eigendomsbinding. Wie een wallet-account kan neerzetten dat door die
controle komt… kan dat sinds fix 1 niet meer, maar attach ís nu de plek waar de
koppeling ontstaat, en daar hoort dezelfde poort.
