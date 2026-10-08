# Vault voorbereiden — mainnet multisig als upgrade-autoriteit

Doel: een autoriteit die jij niet kunt ontbinden, maar wél kunt bedienen met drie mensen.
Alles hieronder is handwerk in de Squads-ui; geen enkel adres wordt door mijn gereedschap berekend (§79).

## 1. Aanmaken

| instelling | waarde | waarom |
|---|---|---|
| leden | **3** | verdraagzaamheid: één drager mag wegvallen |
| drempel | **2 van 3** | geen enkele drager kan alleen; twee verliezen = bevroren |
| time-lock | **86 400 s (24 u)** | aanval op een geopende sessie krijgt de tijd niet |
| rent collector | de vault zelf | huur blijft onder multisigcontrole |
| config-authority | de multisig zelf | wijzigingen gaan weer door dezelfde drempel |

Elk van de drie lid-sleutels op een **ander** apparaat of account. Twee dragers op één machine is geen
2-van-3, dat is 1-van-2 met extra papierwerk.

## 2. Adressen aflezen — niet berekenen

Noteer beide, uit de ui, en laat een tweede persoon het tweede veld invullen:

```
Multisig-adres : ____________________________________________
Vault-adres    : ____________________________________________   ← dit wordt de upgrade-autoriteit

| lid | drager (bevestigd 2026-10-08) | soort | mainnet-SOL | devnet-SOL | adres |
|---|---|---|---|---|---|
| 1 | `brave22` | browser-extensie (Brave) | 0 | 0 | _nog niet publiek — zie regel hieronder_ |
| 2 | `backpack google` | browser-extensie, Google-gebonden | 0 | 10,00000 | idem |
| 3 | `solflare main` | browser-extensie (Solflare) | 0 | 9,03473 | idem |

Alle drie gemeten: **op de curve**, dus echte tekenbare accounts en geen programmadressen.

**Waarom de adressen hier nog niet staan.** Deze repo is openbaar. Adressen nu committeën koppelt
drie wallets aan dit project vóórdat ze ooit iets hebben gedaan — dat is een uitnodiging om juist díe
drie te benaderen in de kwetsbaarste week van dit project. Zodra de multisig bestaat, staan die drie
adressen hoe dan ook op de chain en kost registreren niets meer. Vul ze hier in op dat moment.```

Waarom zo streng: in de repetitie (§79) lukte het mij niet het verwachte vaultadres te reproduceren uit
168 zaadcombinaties; het SDK-pakket kwam niet overeen met wat er draait. Een handmatig afgeleid adres als
autoriteit is precies de bevriezing uit §68/§71.

### 2b. Canary — bewijs dat elk van de drie werkelijk kan tekenen

Geen van deze wallets heeft ooit op mainnet getekend (gemeten: nul transacties). De eerste mainnet-
handtekening mag niet toevallig die van de ceremonie zijn.

Per drager, vóórdat er iets anders gebeurt:
1. mini-overboeking van een eigen adres naar die wallet (enige duizendste SOL);
2. daaruit terugboeken — de drager tekent zelf;
3. handtekening op de explorer opgezocht en in `STATUS.md` gezet.

Lukt stap 2 bij één van de drie niet, dan is die drager er niet. Tel dan opnieuw: 2-van-3 met een
afwezige is 1-van-2.

## 3. Bewijs vóór de overdracht — de stap die ik niet kon leveren

Op devnet lukte het niet een multisig te her-aanmaken, dus het luik "**de vault kan handelen**" is daar
niet opnieuw bewezen; het rust op §69. Sluit dat gat op mainnet vóórdat je autoriteit overdraagt:

1. Maak in de vault **één eenvoudige transactie** over — bijvoorbeeld 0,001 SOL van de vault naar een
   eigen adres.
2. Laat twee dragers goedkeuren en **uitvoeren**.
3. Controleer op de explorer dat die transactie is geland.

Lukt dát niet, dan is er geen enkele reden om een programma aan die vault te geven. Dit is de enige test
die telt, en hij is goedkoop.

## 4. Geen herstel — verlies betekent herbouw

**Standpunt (besloten 2026-10-08):** er komt geen back-upregime en geen herstelzin. Geen staal, geen
Shamir-shards, geen passphrase die iemand moet onthouden. Wat er wél staat is op GitHub, en GitHub is
het enige wat telt.

| verlies | gevolg | kosten |
|---|---|---|
| programmakpair vóór de ceremonie | herbouwen onder een nieuw adres | uren verificatiewerk, geen geld (§80: het adres zit in de `.so`) |
| één drager | niets — 2 van 3 werkt door; lid vervangen via de multisig | geen |
| twee dragers **vóór de mint** | programma opgeven, herbouwen onder nieuw adres | uren |
| twee dragers **ná de mint** | **het token is dood.** Een mint wisselt niet van hook-programma; een nieuw adres migreert hem niet. Huur blijft definitief vast, het adres is voorgoed onbruikbaar (§6) | onherstelbaar |

De onderste rij is de enige echte prijs van dit standpunt. Wie hem niet accepteert, heeft alsnog een
herstelregime nodig — en dat is een besluit, geen detail.

```
Aanvaarding "geen herstel; verlies ná de mint = dood token":  ____________________  (paraaf)
```
### Aanvaard risico: drie extensies, één soort falen

Drie browser-extensies zijn drie instanties van dezelfde zwakte: een kapot browserprofiel, een gestolen
apparatuur of — bij `backpack google` — een Google-herstelprocedure die tweefactoromzeiling is. Eén
verlies is draaglijk (2 van 3). Twee verliezen ná de mint is de dood van het token, en die twee verliezen
zijn bij dit trio méér gecorreleerd dan bij drie onafhankelijke apparaten.

```
Keuze (a): zo blijven, risico aanvaard ────────────  ______________  (paraaf)
Keuze (b): één drager vervangen door hardware/offline  ______________  (paraaf)
```


## 5. Wat niet te doen

- Vaultadres zelf berekenen of uit een oud document kopiëren (§79).
- Fee-payer als drager gebruiken — dan valt geld en macht samen op één sleutel.
- Autoriteit overdragen vóór het bewijs uit §3.
- Time-lock zetten vóórdat je de terugval-oefening hebt gedaan: ná het slot duurt elke correctie 24 uur.

## 6. Aansluiting op het runbook

Met dit document ingevuld zijn poorten **P6** (vault bestaat, adres afgelezen), **P7** (dragers
gescheiden) en **P11** (back-up buiten deze machine) aantoonbaar groen. Dan pas: buffer → droogloop →
ceremonie → verificatie → en daarna de mint.
