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
Lid 1 / drager : ______________________  apparaat: ____________
Lid 2 / drager : ______________________  apparaat: ____________
Lid 3 / drager : ______________________  apparaat: ____________
```

Waarom zo streng: in de repetitie (§79) lukte het mij niet het verwachte vaultadres te reproduceren uit
168 zaadcombinaties; het SDK-pakket kwam niet overeen met wat er draait. Een handmatig afgeleid adres als
autoriteit is precies de bevriezing uit §68/§71.

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

## 5. Wat niet te doen

- Vaultadres zelf berekenen of uit een oud document kopiëren (§79).
- Fee-payer als drager gebruiken — dan valt geld en macht samen op één sleutel.
- Autoriteit overdragen vóór het bewijs uit §3.
- Time-lock zetten vóórdat je de terugval-oefening hebt gedaan: ná het slot duurt elke correctie 24 uur.

## 6. Aansluiting op het runbook

Met dit document ingevuld zijn poorten **P6** (vault bestaat, adres afgelezen), **P7** (dragers
gescheiden) en **P11** (back-up buiten deze machine) aantoonbaar groen. Dan pas: buffer → droogloop →
ceremonie → verificatie → en daarna de mint.
