# Mainnet-ceremonie — runbook

Laatst bijgewerkt 2026-10-02. Gebouwd op de metingen in STATUS §72–§78. Alles hieronder is
daadwerkelijk gedraaid op devnet; niets is aangenomen.

**Programma:** `active-defense` — een Token-2022 transfer-hook.
**Bouw van record:** `target/deploy/active_defense.so`, 367 056 byte,
`sha256 81add7bab27aa4e93e79d79ac7e18486931196fa63651530d2fc5469ed8d3b97`.

---

## 0. Poorten — fail-closed, vóór alles

Elke regel is een commando of een handeling. Loopt iets niet groen: **stop**, geen "even doorwerken".

| # | poort | hoe te controleren |
|---|---|---|
| P1 | boom is schoon | `git status --porcelain` → leeg |
| P2 | build is de record | `sha256sum target/deploy/active_defense.so` == hierboven |
| P3 | build is reproduceerbaar | `anchor build` opnieuw → zelfde hash (§72) |
| P4 | devnet draait dezelfde bytes | `scripts/controle.sh --cluster https://api.devnet.solana.com` → GROEN |
| P5 | tests groen op die build | §74: zes van de zes |
| P6 | mainnet-vault bestaat en het adres is **afgelezen**, niet berekend | 2-of-3, time-lock 24 u; adres uit de multisig zelf (UI/on-chain), twee bronnen vergeleken — zie §79 |
| P7 | dragers zijn gescheiden | drie aparte apparaten/accounts; géén twee op één machine |
| P8 | betaler is een eigen wallet | niet het programmakpair, niet de vault; saldo ≥ 8 SOL |
| P9 | sleutelbestanden op `600` | `stat -c %a <bestand>` — **nooit** `664` (§76) |
| P10 | geen pakketinstallaties in deze boom | §77: npm liep omhoog en wijzigde het root-manifest |
| P11 | back-up van de handover staat buiten deze machine | §70 |

| P12 | elke verzending wordt fail-closed bevestigd
| **P13** | **de ceremoniemachine draagt geen autonome agent** | geen shell-/fs-/github-gereedschap op "allow all" op het toestel met de programmakpair — tekst stuurt dat gereedschap, en de keypair is één `cat` verwijderd (§82, §83) |
 | `confirmTransaction` resolve óók bij een mislukte transactie; het `err`-veld controleren is geen formaliteit (§79) |

### Wat P13 in de praktijk betekent

De programmakpair heeft precies één fysieke kopie op deze machine (gemeten: inode 5275602; de tweede
treffer in een bestandsdoorzoek was een symlink). Op dezelfde machine draait een agent met shell-,
bestand- en github-gereedschap, staand op "allow all". Daarmee is de vraag niet *of* de sleutel
uitleesbaar is voor zo'n agent — die is het, en deze sessie heeft het tweemaal gedaan om te verifiëren
dat het kanonieke bestand het juiste is.

Een ceremonie vraagt daarom een toestel waarop:
1. geen agent met shell/bestand/netwerk-gereedschap draait (of: de sleutel staat op een toestel waarop
   geen agent draait);
2. alleen de programmakpair en de geverifieerde `.so` staan, niet de hele repo met zijn symlinks;
3. het geheugen niet op "kritiek" staat — een bouw van minuten die halverwege vastloopt, is waar mensen
   gaan gokken in plaats van meten.

Wie dat niet wil, verkort het venster: hoe eerder de ceremonie draait, hoe korter deze sleutel überhaupt
iets betekent. Dat is dezelfde redenering als §81 — geen herstel, dus snel door dat punt heen.

## 1. Twee getallen vastleggen (dit document invullen)

```
program-id      : ____________________________   (hergebruik FzeAZm… of nieuw — §76)
max_data_len    : ____________________________   (aanbevolen 734112 ≈ 3,73 SOL huur)
vault-PDA       : ____________________________
```

Huur is 5 081 lamports/byte (gemeten, §76): exact 367 056 → 1,865 SOL · 1,5× → 2,798 SOL ·
**2× → 3,730 SOL** · 3× → 5,595 SOL. Reden om royaal te reserveren: `program upgrade` weigert alles
boven `max_data_len` (§72), dus te krap reserveren kost later een **nieuw programmadres** — en dat is
onherroepelijk zodra een mint aan de hook hangt.

## 2. Buffer schrijven (traag, hervatbaar, geen autoriteit gemoeid)

```bash
solana program write-buffer target/deploy/active_defense.so \
    -k <betaler.json> --url mainnet-beta
```

Noteer het buffer-adres. De huurlast (~3,73 SOL bij deze code) komt automatisch terug zodra de buffer
geconsumeerd wordt door de deploy, of handmatig met `solana program close <buffer>`.

## 3. Droogloop — verzendt niets

```bash
node scripts/ceremonie-deploy.js \
  --betaler <betaler.json> --program-id-keypair <program-id.json> \
  --buffer <BUFFER> --max-len 734112 \
  --vault <VAULT-PDA> --bevestig <VAULT-PDA> \
  --so target/deploy/active_defense.so \
  --url https://api.mainnet-beta.solana.com
```

Controleer de uitvoer regel voor regel: `code … sha256` == de record, `buffer: OK — zelfde bytecode`,
`max_data_len` == je keuze, `simulatie: OK`. De wakers zijn er niet voor niets: verschillen
`--vault` en `--bevestig`, dan stopt het script — een typfout in de autoriteit maakt het programma
definitief onbereikbaar (§68/§71).

## 4. De ceremonie — één transactie

Zelfde commando, plus `--stuur`. Eén transactie doet: compute-limiet, program-account aanmaken,
`DeployWithMaxDataLen`, `SetAuthority → vault`. Het programma wordt onder de vault **geboren**; er
bestaat geen tussenstaat met een hete macht (§76). Noteer de signature.

## 5. Verificatie — vóór enig mint, binnen dezelfde zitting

```bash
solana program show <PROGRAM-ID> --url mainnet-beta
scripts/elf-hash-vergelijk.py <PROGRAM-ID> target/deploy/active_defense.so \
    --url https://api.mainnet-beta.solana.com
scripts/controle.sh --cluster https://api.mainnet-beta.solana.com --id <PROGRAM-ID>
```

`--id` is geen versiersel: zonder die vlag controleert dit script het adres uit
`Anchor.toml`. Bij een nieuw programmadres is dat niet het programma dat je zojuist deploorde,
en meldt het GROEN op grond van een ander account (gemeten in de repetitie, §79).

Deze drie stappen zijn geen formaliteit. In de repetitie (§79) meldde gereedschap "SUCCES" bij een
transactie die on-chain was mislukt — `confirmTransaction` gooit namelijk niet op een mislukte
transactie. De enige waarheid is wat er ná de verzending op de chain staat.

Verwacht: `Authority:` == de vault-PDA; `Data Length:` == je `max_data_len`; de hash-helper meldt
`GELIJK` en laat expliciet zien hoeveel NUL-opvulling hij **buiten** de vergelijking laat.

> **De val waar dit document het meeste op is gericht.** Met reservering is de on-chain ELF-regio zo breed als
> `max_data_len`, aangevuld met nullen. De hele regio hashen geeft **schijn-mismatch** op een
> geslaagde deploy (§72, §76). Gebruik daarom altijd `elf-hash-vergelijk.py`, nooit `sha256sum` over
> een account-dump.

Optionele tegencontrole (kost alleen een mislukte transactie-fee): probeer de autoriteit terug te
dragen met de betaler. Verwacht `Incorrect authority provided`. Bewijst dat alleen de vault nog macht
heeft.

## 6. Hierna pas: de mint

Een Token-2022-mint met deze hook is **onomkeerbaar**: een mint wisselt niet van hook-programma.
Regel: geen mint zolang §5 niet volledig groen is, en pas na instemming van twee dragers.

Deze regel is geen hygiëne maar de enige zekerheid die dit project heeft. Er bestaat geen herbouw-pad
voorbij dit punt: het programma is reproduceerbaar uit GitHub (§81), maar een nieuw programmadres
migreert een bestaande mint niet.

## 7. Terugvalplan

| situatie | wat er gebeurd is | doen |
|---|---|---|
| simulatie faalt | niets — atomair (§76) | foutcode opzoeken hieronder, corrigeren, opnieuw |
| `Buffer and upgrade authority don't match` | buffer eigendom ≠ autoriteit in de transactie | buffer herschrijven met de juiste `-k` |
| `Program account already initialized` | dit program-id is al gebruikt | ander id; bestaande id is weg (§6: gesloten = voorgoed) |
| `Max data length is too large` | reservering boven de loader-limiet | kleiner `--max-len` |
| `429 Too Many Requests` | RPC, geen code (§74) | wachten of andere RPC; **nooit** code aanpassen |
| autoriteit blijkt een onbekend adres | verkeerd afgeleid vaultadres (§79) | adres úít de multisig halen; bestaand adres is onherstelbaar — nieuw programmadres is de enige weg, zolang er geen mint hangt |
| deploy groen, verificatie rood | verkeerde bytes of verkeerde autoriteit | **geen mint**. Verkeerde bytes: de vault kan upgraden (past binnen `max_data_len`). Verkeerde autoriteit: adres opgeven, opnieuw onder een nieuw id — zolang er geen mint hangt |
| huur terughalen | — | `solana program close <id> --bypass-warning` door de autoriteit; zonder de vault lukt dit niet |

## 8. Logboek van de ceremonie (in STATUS, sectie 79+)

signature · program-id · sha256 van de gedeployde build · `max_data_len` · tijdstip UTC · welke
dragers tekenden · uitkomst van elke verificatiestap · wat er vast zit aan huur.
