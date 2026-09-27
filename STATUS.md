

## 40. Drift-detector: wallet-layout getoetst aan de spankwallet-bron (2026-09-26)

Sectie 38 stelde het probleem: de fixture staat stil op `1fb3134`, het echte
programma niet, en geen enkele fixture-test merkt het als hun layout verandert.
`harness/tests/layout_conformance.rs` sluit die kloof.

**Hoe het werkt.** De test leest `programs/spankwallet/src/state.rs` zoals die op
dit moment op schijf staat (`$SPANKWALLET_STATE_RS`, anders het standaardpad),
parset de veldvolgorde van `WalletAccount`, berekent de Borsh-offsets — inclusief
de 8 bytes Anchor-discriminator vooraan — en botst die op onze eigen constanten.
Onze constanten worden uit de bron van `crates/spankwallet-contract` geparset,
niet overgetypt; een typfout in de spiegel is dus ook een testfout. Een type dat
de tabel niet kent geeft een paniek met de boodschap "aanvullen, niet gokken".

**Wat hij eist:**

| eigenschap | toets |
|---|---|
| `owner_passkey` staat op 73 | `WALLET_OWNER_PASSKEY_OFFSET` |
| `recovery_state`-tag staat op 148 | `OFFSET_RECOVERY_STATE_TAG` |
| `RecoveryState` is 41 byte payload | `RECOVERY_STATE_LEN` |
| `action_nonce` + 8 past in de ondergrens | `WALLET_MIN_LEN` |
| veldvolgorde tot en met `action_nonce` is onveranderd | expliciete lijst |

**De layout, uit de testoutput:**

```
   min   max  veld
     8     8  seed_key
    41    41  wallet_seed_hash
    73    73  owner_passkey        ← onze spiegel leest hier
   106   106  bump
   ...
   148   148  recovery_state       ← onze spiegel leest hier
   158   231  action_nonce         ← onze spiegel leest hier
   166   239  session_epoch
   174   247  spend_threshold_lamports
   182   255  disarmed
   183   256  recovery_nonce_snapshot
```

De `min`/`max`-kolommen zijn geen versiering: `action_nonce` verschuift 73 byte
afhankelijk van de twee `Option`-velden ervoor. Er bestaat geen *enkele* offset
ervan, en precies daarom leest onze spiegel hem variabele.

**Bewijs dat de detector detecteert.** Eén veld van 8 byte ingevoegd vóór
`owner_passkey` (in een kopie van hun bron, via `SPANKWALLET_STATE_RS`):

```
4 failed, exit 101        (owner_passkey, recovery_state-tag, actie_nonce, veldvolgorde)
```

Zonder mutatie: `6 passed`.

**Eigen fout, gemeten.** De eerste versie vergeleek de Some/Some-offset van
`action_nonce` met `WALLET_MIN_LEN`, dat de None/None-ondergrens is — de test
gaf rood op een layout die gewoon klopte. Dat is dezelfde verwarring die §14 al
over de variabele offset beschreef, en hij werd door de test gevonden, niet door
mij. Twee lessen: een drift-detector heeft een mutatiecontrole nodig, en een
test die het systeem niet kent wordt door zijn eigen output geschrapt.

**Grenzen.** De test staat of valt bij de aanwezigheid van hun repo op deze host;
ontbreekt het bestand, dan slaat hij over met een luide melding. In een omgeving
zonder hun bron is "overgeslagen" dus géén groen — wie dit in CI zet moet het
pad setten en het overslaan laten tellen als fout.
