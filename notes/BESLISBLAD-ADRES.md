# Beslisblad — programmadres en gereserveerde ruimte

Eén pagina. In vullen, paraferen, en meenemen naar de ceremonie (`notes/MAINNET-CEREMONIE.md`).

## 1. Wat vaststaat (gemeten, niet aangenomen)

| feit | waarde | waar gemeten |
|---|---|---|
| bouw van record | `active_defense.so`, **367 056 byte** | §72, §79 |
| sha256 daarvan | `81add7bab27aa4e93e79d79ac7e18486931196fa63651530d2fc5469ed8d3b97` | §72, §79 |
| program-id | `FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK` | Anchor.toml = keypair |
| adres zit in de bytecode | **ja** — de 32 ruwe bytes staan in de `.so` | gemeten tijdens opmaak van dit blad |
| kpair nooit in git | **correct**: geen spoor in `git log --all`, expliciet genegeerd | gemeten |
| kpair op schijf | `~/.config/active-defense/program-keypairs/…`, mod `0600`; `target/deploy` is een symlink | gemeten |
| huurlast | **5 081 lamports per byte** van `max_data_len` | §76 |

## 2. Keuze A — adres hergebruiken (aanbevolen)

Het geverifieerde artefact blijft het uitgerolde artefact. `controle.sh` werkt zonder `--id`.
Devnet en mainnet delen één adres, dus elke vergelijking tussen clusters is direct.

**Machtswenster: geen.** De atomaire ceremonie (§76, herhaald in §79) geeft het programma onder de
vault *geboren*; het kpair tekent uitsluitend de aanmaak en is daarna nooit meer autoriteit. Getest:
autoriteit terugdragen met de betaler faalt op `Incorrect authority provided`.

## 3. Keuze B — nieuw adres

Vereist bronwijziging en herbouw, dus een **nieuwe bouw van record**. Daarmee vervalt het bewijs uit
§72–§79 voor dát artefact en moet opnieuw: zes tests, devnet-deploy, hashverificatie. Kosten: geen
extra SOL, wél een onherhaalde verificatieketen — en een onherhaalde keten is precies waar fouten
wonen.

**Redelijk alleen als** het kpair ooit buiten je controle is geweest (andere machine, gedeelde map,
back-up op onbekende plek), of als devnet en mainnet bewust gescheiden moeten blijven.

## 4. Gereserveerde ruimte (`max_data_len`)

| reservering | `max_data_len` | huur vast |
|---|---|---|
| exact | 367 056 | 1,865 SOL |
| **2× — aanbevolen** | **734 112** | **3,730 SOL** |
| 3× | 1 101 168 | 5,595 SOL |

Waarom royaal: `program upgrade` weigert elke build groter dan `max_data_len` (§72). Te krap reserveren
kost later een **nieuw programmadres** — en dat is onbetaalbaar zodra een mint aan de hook hangt.
Waarom niet te royaal: de huur staat vast in het ProgramData-account en is alleen terug te halen door
een 2-van-3 multisig-handeling.

## 5. Wat er vast komt te zitten

| post | omvang | terug te halen door |
|---|---|---|
| ProgramData-huur | 3,730 SOL (bij 734 112) | de vault — niet door jou alleen |
| program-account | 0,0008 SOL | idem |
| buffer na deploy | 0 (automatisch terug) | — |

Let op: de huur zit in het **ProgramData**-account. Het program-account zelf houdt 0,0008 SOL; daar naar
kijken geeft een bedrieglijk beeld (§79).

## 6. Onomkeerbaar, en wanneer

1. Deploy onder een adres met verkeerde autoriteit → onherstelbaar; enige weg is een nieuw adres (§68/§71).
2. **Mint met deze hook creëren** → een mint wisselt niet van hook-programma. Pas ná volledige verificatie.

## 7. Beslissing

```
Adres:            □ hergebruiken FzeAZm…   □ nieuw adres (reden: ______________________ )
max_data_len:     ________________________   (SOL vast: __________ )
Fee-payer wallet: ________________________   (saldo ≥ 4 SOL: □ ja )
RPC:              ________________________
Datum / paraaf:   ________________________
```

**Open vraag die vóór de ceremonie beantwoord moet zijn:** bestaat er een back-up van het programmakpair
buiten deze machine? Zo nee: bij verlies vóór de ceremonie is keuze A onuitvoerbaar en moet er hoe dan
ook herbouwd worden.
