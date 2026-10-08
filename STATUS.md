# active-defense — STATUS.md

**Doel van dit document:** eerste bestand om te lezen bij hervatten van dit project in
een nieuwe chatsessie. Legt vast waar we staan en waarom, zodat niets herhaald hoeft te
worden. Zelfde functie en stijl als spankwallet's eigen `STATUS.md` — dat bleek na weken
nog bruikbaar om zonder geheugenverlies verder te werken, dus dit project krijgt er meteen
één, vanaf de eerste commit.

Laatst bijgewerkt: 2026-08-30 — Route B volledig (programma, client-library, tests; secties
11-22), canonieke devnet-programma geüpgraded en functioneel bewezen (sectie 20); lokale
werkboom en GitHub gesynchroniseerd (merge 418935d, sectie 24).

Document laatst bijgewerkt: 2026-09-22 (zie sectie 35 voor de recentste stand). De
regel hierboven beschrijft zelf alleen de Route B-mijlpaal van 2026-08-30 en is
sindsdien niet meegewerkt met latere secties (25-35, o.a. de Dependabot-analyse en
de licentie/security-audit) - voor de actuele stand is het chronologische logboek
leidend, niet deze regel.

---

## 1. Herkomst: verhuisd uit spankwallet

### Waarom

`programs/active-defense/` (Poison Token + Malicious Addresses, fase 1) leefde tot nu toe
als branch `active-defense-phase1` in de spankwallet-repo, uitgecheckt in een aparte
worktree (`/home/michel/projects/spankwallet-active-defense`) om te voorkomen dat één map
tussen twee branches heen en weer moest wisselen. Die scheiding hield niet: twee keer deze
week raakte spankwallet's `main` alsnog verstrengeld met active-defense-commits via een
verkeerd getypt `git pull --rebase origin active-defense-phase1` terwijl `main` toevallig
in dezelfde bredere werkomgeving stond uitgecheckt (spankwallet-STATUS.md secties 81, 92).
Een aparte worktree binnen dezelfde repo lost het onderliggende probleem niet op — twee
projecten in één repo blijft twee projecten die met één verkeerd commando in elkaar kunnen
schuiven. Vandaar: eigen repo, eigen geschiedenis, eigen levenscyclus.

### Wat is meeverhuisd

Geëxtraheerd uit `active-defense-phase1`, commit `38f9a2b` (het laatste checkpoint vóór de
verhuizing, spankwallet-STATUS.md's inventarisatieronde van 2026-08-26):

- `programs/active-defense/` — het volledige on-chain programma (5 bestanden).
- `client/src/poisonToken.ts` — TS-clientlibrary.
- `test/verify-deployment.ts` — deploymentcontrole (bestaand, gecommit in de oude repo).
- `tests/activeDefense.ts`, `tests/activeDefenseFull.ts` — de twee testiteraties van de
  poison-token-flow (v1/v2), plus `test-verify.js`/`test-transfer-hook.js` — allemaal
  ongecommit werk dat vlak vóór de verhuizing alsnog is vastgelegd (zie hieronder).
- Bijbehorende dependency- en tool-instellingen (`Anchor.toml`, root-`Cargo.toml`,
  `package.json`, `tsconfig.json`) zijn **niet** letterlijk overgenomen maar opnieuw
  geschreven, specifiek voor deze repo — de oude versies waren spankwallet's eigen
  bestanden met active-defense er half doorheen gemengd (het root-`package.json` heette
  bijvoorbeeld nog gewoon `"spankwallet-tests"`).

**Wat expliciet niet is meeverhuisd:** de rest van de spankwallet-codebase (`admin/`,
`desktop/`, `docs/`, `client/` op één bestand na, heel `programs/spankwallet/`, heel
`scripts/`, `README.md`, `SECURITY.md`, spankwallet's eigen `STATUS.md`) — die stond in de
oude branch alleen omdat hij ooit van spankwallet's `main` was afgesplitst, niet omdat het
bij active-defense hoort.

**Geen geschiedenis meegenomen — bewuste keuze.** De 9 commits van `active-defense-phase1`
waren klein, fase-1, en op het moment van verhuizen al niet meer synchroon met wat er
on-chain stond of in de werkboom leefde (zie hieronder). Een `git subtree split` had
bovendien spankwallet-bestanden meegesleept op de punten waar active-defense-commits die
toevallig meewijzigden. Vers beginnen was goedkoper dan schoon graven.

**Werk vlak vóór de verhuizing veiliggesteld, niet verloren:** op het moment van
inventariseren stond er in de oude worktree substantieel werk *staged maar nog niet
gecommit* (~2000 regels, incl. een herschreven `instructions.rs` en de twee nieuwe
testbestanden) — een tweede sessie was daar op dat moment actief mee bezig. Vóór er iets
verplaatst werd: gewacht tot die sessie klaar was, toen gemeten (niet aangenomen) dat alles
echt gecommit stond, en ter zekerheid zowel een `git bundle` als een volledige
werkboomkopie weggezet buiten beide repo's
(`/home/michel/backups/spankwallet-active-defense-safety-<tijdstempel>/`) vóórdat er
verder gewerkt werd.

### De adressenverwarring — rechtgezet, niet gearchiveerd

Vóór de verhuizing zwierven er vier adressen rond voor wat bedoeld was als één programma:

| Adres | Wat het was | Status hier |
|---|---|---|
| `9W3CGKhd7hgywf3xfP8snNmB2AgmzwQ3rdDFDV3hUurK` | gecommitte `declare_id!` in de oudste versie — bleek nooit het echte programma-adres te worden, eindigde als upgrade authority van `G1D5ckPj...` | **wegwerp, geen actie nodig** |
| `G1D5ckPj3ZMBeYNfEz24dGhvPExqNP6Y3SFNx3V7RbK5` | live devnet-deploy, 2026-08-21 | **wegwerp** — fase 1, geen echte gebruikers, oudste van drie live iteraties |
| `DGaTtEj3Hr54MedgZj2CyCpFgH1e6ATNTNweG9v46ypq` | live devnet-deploy, 2026-08-24 (`target/deploy/`, nooit eerder dus apart gedocumenteerd) | **wegwerp** |
| `8vPFH4YYVzRr2euemkXDHRz2McH58BBKfwJtQUumc8x5` | live devnet-deploy, 2026-08-25 23:04 — de laatste `declare_id!` vóór verhuizing | **wegwerp** — ook deze was op het moment van verhuizen al weer achterhaald door verder ongecommit werk |

Alle drie de live deploys deelden bovendien hun upgrade authority met ofwel een los
keypair (`9W3CGKhd...`) ofwel spankwallet's eigen algemene devnet-testwallet
(`G1qgHzMxNHqewWEKzEoV46GUXjDrsuD4P8LQ97T6gNXp`) — dat laatste was zelf al een kleine
vorm van precies de vermenging die deze verhuizing moet oplossen.

**Geen van de drie is ooit meer geweest dan een testiteratie in een fase-1-project zonder
gebruikers — er gaat niets van waarde verloren door ze los te laten.** In plaats van uit te
zoeken welke van de vier "de echte" was, is er een vijfde, canonieke identiteit aangemaakt:

- **`FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK`** — nieuw, vers keypair, gegenereerd
  specifiek voor deze repo.
- Leeft op `~/.config/active-defense/program-keypairs/active-defense-keypair.json` — buiten
  de repo-checkout, buiten `target/` (dat wist `anchor build --clean` net zo hard als
  `git clean -fdx`), en onder een eigen naam die niets met spankwallet's
  `~/.config/spankwallet/`-namespace deelt.
- `target/deploy/active_defense-keypair.json` is een **symlink** naar die ene locatie, geen
  kopie — `anchor keys sync`/`--clean` kan dus nooit stilzwijgend een nieuwe identiteit
  verzinnen en in `declare_id!` terechtbrengen, want er is geen los, regenereerbaar
  lokaal-testadres meer om per ongeluk naar te syncen. Dezelfde identiteit is zowel wat
  lokaal gebouwd wordt als wat gecommit staat — de twee-identiteiten-voetangel die
  spankwallet's `build-and-deploy.sh` nodig maakte (trap-based restore, zie diens
  koptekst) bestaat hier niet, omdat er (nog) geen aparte multisig-bestuurde "echte"
  identiteit is om uit elkaar te houden van een lokaal testadres.
- `.gitignore` sluit keypairbestanden uit sinds de allereerste commit (niet achteraf
  toegevoegd).

### Openstaande punten (uit de inventarisatie, nog niet opgelost — bewust, zie vervolgstappen)

**1. Gedupliceerde spankwallet-layoutconstanten in `programs/active-defense/src/
instructions.rs` — geverifieerd correct op 2026-08-26, maar structureel fragiel.**
Twee plekken lezen spankwallet's on-chain accounts op hand-berekende byte-offsets in
plaats van via een echt type:
- `WALLET_OWNER_PASSKEY_OFFSET = 73` (`WalletAccount.owner_passkey`)
- `PASSKEYS_OWNER_REVOKED_OFFSET = 41`, `PASSKEYS_COUNT_OFFSET = 42`,
  `PASSKEYS_ADDITIONAL_OFFSET = 43`, `MAX_ADDITIONAL_PASSKEYS = 8`
  (`PasskeysAccount`-velden)

Rechtstreeks geverifieerd tegen spankwallet's huidige `programs/spankwallet/src/state.rs`
(ná de B1-B7-upgrade van voorstel #11, sectie 95 aldaar): **alle vijf kloppen vandaag**,
inclusief de `WalletAccount`-offset die de vrees leek te bevestigen dat B2's nieuwe
`session_epoch`-veld ze had verschoven — dat veld staat achteraan de struct, ver na
`owner_passkey`, dus de offset bleef toevallig staan. Dat is precies het probleem: het
klopt vandaag omdat de gewijzigde velden toevallig ná de gelezen velden staan, niet omdat
er een garantie is dat dat zo blijft. Een toekomstige herordening aan spankwallet's kant
zou hier stilzwijgend de verkeerde bytes opleveren, zonder compileerfout, zonder
runtime-fout die iets herkenbaars zegt.

**Betere aanpak, nagetrokken en bevestigd werkend met de hier gebruikte Anchor-versie
(1.1.2, `otter-sec/anchor`-fork):** Anchor's `declare_program!`-macro. Leest een IDL-bestand
uit een `idls/`-map (op elke hoogte in de directory-boom), genereert daaruit échte,
benoemde types en (de)serialisatie — geen dependency op de spankwallet-crate nodig, werkt
zowel on-chain (CPI) als off-chain (Rust-clients via `anchor_client`, niet voor de
TypeScript-kant — `client/src/poisonToken.ts` heeft dit toevallig niet nodig, die leest
alleen active-defense's eigen accounts op offset). Een hernoemd/verwijderd veld aan
spankwallet's kant wordt dan een compileerfout bij het regenereren, in plaats van
stilzwijgend verkeerde bytes; een reorder blijft gewoon correct werken zonder handmatig
ingrijpen, want de (de)serialisatiecode wordt telkens opnieuw uit de actuele IDL
gegenereerd.

**Vervolgstap, nog niet uitgevoerd:** `idls/spankwallet.json` toevoegen (gegenereerd met
`anchor build -p spankwallet` tegen een gepinde spankwallet-commit — voorstel: `1fb3134`,
zie sectie 23 hieronder voor waarom die commit toch al de referentie is), `declare_program!
(spankwallet);` invoeren, de vijf handmatige offset-constanten vervangen door benoemde
veldtoegang. Zolang dat niet gebeurd is: bij elke wijziging aan een van de vijf constanten,
of bij elke nieuwe spankwallet-release, eerst herverifiëren zoals hierboven — nooit
aannemen dat een offset nog klopt omdat hij dat de vorige keer deed.

(Voorheen ook een tweede openstaand punt: tests draaiden nog tegen het echte,
multisig-bestuurde spankwallet-programma (`9ma6vQVA71...`), via `tests/activeDefense.ts`/
`tests/activeDefenseFull.ts` die `init_wallet` op dat adres aanriepen - opgelost door de
permanente, gepinde testfixture met blocklist tegen het echte adres en de oude
wegwerpadressen (sectie 23); sectie 22 bevestigt dat de tests er ook daadwerkelijk tegen
draaien.)

### Vervolgstappen (volgorde vastgelegd door de gebruiker, spankwallet-STATUS.md sectie 95)

1. ~~Nieuwe repo, vers, privé, alleen wat bij active-defense hoort~~ — dit document.
2. ~~Bewijzen dat de repo op zichzelf staat: schoon bouwen vanaf een verse clone, plus een
   echte devnet-deploy/test~~ — sectie 2.
3. ~~Tweede exemplaar van het canonieke keypair, buiten `~/.config/active-defense/` én
   buiten de repo~~ — sectie 3.
4. Pas daarna, aan spankwallet's kant: `programs/active-defense/` uit die tree, uit
   `Cargo.toml`/`Cargo.lock`, `build-and-deploy.sh` terug naar alleen spankwallet — één
   voorwaartse commit, geen rebase/reset. **Nog te doen.**
5. Elke toekomstige herverificatie van B1-B7 (spankwallet-voorstel #11) blijft tegen commit
   `1fb3134` gebeuren, niet tegen spankwallet's `HEAD` — dat blijft zo ook ná de opschoning.

## 2. Bewijs: schone build + echte devnet-deploy, vanaf een verse kloon

**Waarom dit moest, letterlijk zo geëist:** "zonder dat bewijs verwijderen we niets [aan
spankwallet-kant] — dat is dezelfde les als het programma-keypair dat we deze week zijn
kwijtgeraakt." Dus: niet aannemen dat deze repo werkt omdat de bestanden overgekopieerd
zijn, meten vanaf een omgeving die niets deelt met de map waarin hij gebouwd is.

**Procedure:** `git clone git@github.com:anoadder-ship-it/active-defense.git` naar een
volledig aparte locatie (buiten `/home/michel/projects/`), daar `npm install`, een
`target/deploy/active_defense-keypair.json`-symlink naar de canonieke keypair gezet (zoals
elke toekomstige checkout dat handmatig moet doen — geen kopie, staat niet in git), en
vandaar `anchor build` / `solana program deploy` / de tests gedraaid. Twee echte gaten in
de eerste versie van deze repo kwamen hierdoor pas aan het licht — niet in de oude repo
zichtbaar geweest, want daar draaide IDL-generatie nooit door:

1. **`programs/active-defense/Cargo.toml` miste de `idl-build`-feature.** `anchor build`
   faalde met `idl-build feature is missing`. Overgenomen van spankwallet's eigen
   `Cargo.toml` (die dit al goed had), inclusief het `[lints.rust]`-blok dat de
   `anchor-debug`-cfg-warnings stilhoudt. Gefixt, gecommit, opnieuw vanaf een verse kloon
   bevestigd dat de build daarna wél doorliep.
2. **Anchor's eigen veiligheidslint blokkeerde daarna alsnog:** `PoisonTransferHook`'s vier
   accounts (`source_token_account`, `token_mint`, `owner`) waren `UncheckedAccount` zonder
   verplichte `/// CHECK:`-documentatie. Toegevoegd — en eerlijk over wat er NIET
   geverifieerd wordt: deze drie worden niet inhoudelijk tegen elkaar gecontroleerd (een
   directe aanroep buiten een echte Token-2022-transfer om zou willekeurige accounts kunnen
   meegeven). Dat is een echt open punt voor vóór productiegebruik, geen omzeiling van de
   lint.

**Build, geverifieerd op byte-niveau (zelfde methode als spankwallet's
`verify-program-id-in-binary.ts`):** het canonieke adres
`FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK` komt **exact één keer** rauw voor in de
gecompileerde `target/deploy/active_defense.so` (offset 187739) — geen ontbrekend, geen
dubbelzinnig programma-ID.

**Deploy naar devnet, vanaf diezelfde verse kloon:**
- Signatuur: `5rNELg9hfq86fnPK5DXdQKekQHd6RzzgDLGPPAkQM2J1YeHQYmc2KMKtLD7fSRNzJ4CtsNbvN9AyxLMR5gW2P9ei`,
  slot `488530503`.
- `solana program show FzeAZmQz...`: `Owner: BPFLoaderUpgradeab1e...`, `Authority:
  FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK` (zichzelf — geen enkele spankwallet-sleutel
  heeft hier gezag over), `Data Length: 225848 bytes` (komt overeen met de lokaal gebouwde
  `.so`).
- **Voetangel tegengekomen en opgelost, vastgelegd voor een volgende keer:** het canonieke
  keypair eerst rechtstreeks voorzien van devnet-SOL (`solana transfer` naar het adres
  zelf, ná een uitgeputte airdrop-rate-limit) brak de deploy: `Error: ... is not an
  upgradeable program or already in use`. Oorzaak: de Solana-CLI behandelt een
  programma-ID-adres dat al een saldo draagt kennelijk anders dan een leeg adres bij een
  EERSTE deploy. Fix: het saldo teruggestort, gedeployed met een LOS keypair
  (spankwallet's `id.json`, met devnet-SOL) uitsluitend als `--fee-payer`/`--keypair`, met
  `--upgrade-authority` expliciet naar het canonieke keypair. `id.json` betaalde zo eenmalig
  de rent/fees en heeft daarna geen enkele bevoegdheid over dit programma meer bevestigd —
  wezenlijk anders dan de oude situatie waarin diezelfde sleutel bleef staan als doorlopende
  upgrade authority.

**Functioneel bewijs, `test-verify.js`, vanaf de verse kloon, tegen de zojuist gedeployde
instantie (geen spankwallet-afhankelijkheid, dat was precies het punt):**
```
[PASS] Program LIVE on devnet (36 bytes programma-account, 0.0011 SOL - klopt, de
       loader-metadata-account, niet de ProgramData zelf)
[PASS] PDA-derivatie werkt (poison_token- en malicious-PDA's afgeleid, bump=255 beide)
[PASS] Account reading werkt (beide accounts bestaan terecht nog niet)
```

**Conclusie:** deze repo staat aantoonbaar op zichzelf — bouwt schoon vanaf een kale
`git clone`, deployt onder zijn eigen, nieuwe canonieke identiteit, zonder spankwallet-code
of -sleutels nodig te hebben voor dit basisbewijs. Klaar voor stap 4 (opschoning aan
spankwallet-kant).

## 3. Keypair-backup: waarom hier wél kritiek, anders dan bij spankwallet

**Het verschil met spankwallet, expliciet:** bij spankwallet maakt het niet uit of het
lokale programma-keypair ooit verloren gaat — de échte upgrade authority is de 2-of-3
Squads-multisig, het lokale keypair is alleen nodig geweest om het adres ooit te
claimen. Hier is dat niet zo. `FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK` is op dit
moment **zowel het programma-ID als de upgrade authority** (sectie 1) — er is nog geen
multisig, geen tweede sleutel, niets. **Eén verloren bestand betekent hier: dit programma
is voorgoed niet meer te upgraden.** Precies de fout die deze week al één keer gebeurde bij
spankwallet (een programma-keypair kwijtgeraakt door aan te nemen dat het "wel ergens
anders" zou bestaan) — hier zou diezelfde fout wél gevolgen hebben, want er is geen
multisig als vangnet.

**Twee exemplaren, nu, vóórdat er iets kostbaars aan dit adres hangt:**
1. `~/.config/active-defense/program-keypairs/active-defense-keypair.json` — het werkende
   exemplaar, gebruikt door `target/deploy/`'s symlink.
2. `/home/michel/backups/active-defense-program-keypair/active-defense-keypair.json` —
   tweede exemplaar, buiten zowel de `~/.config/active-defense/`-map als elke
   repo-checkout. Byte-voor-byte geverifieerd identiek (`diff`), zelfde adres uit
   `solana-keygen pubkey` bevestigd.

**Wat hier nog ontbreekt, bewust niet nu opgelost:** dit is nog steeds twee kopieën op
dezelfde fysieke machine — geen bescherming tegen schijfuitval. Zodra dit programma een
echte upgrade authority krijgt die niet langer één los keypair is (een multisig, zoals
spankwallet, of op zijn minst een kopie op andere hardware), vervalt deze noot. Tot die
tijd: **dit keypair is de enige manier waarop dit programma ooit nog te upgraden is — geen
enkele actie die het zou kunnen wissen (`rm -rf`, een kapotte disk, `git clean` in een repo
die het per ongeluk toch zou tracken) mag zonder deze twee kopieën eerst te controleren.**

## 4. Client-library `poisonToken.ts` — verouderd, niet functioneel (gevonden 2026-08-27)

**Wat er aan de hand is:** `client/src/poisonToken.ts` is geschreven tegen een vroegere
design-iteratie van het programma en is sindsdien niet meer bijgewerkt. Het resultaat:
de library produceert instructies die het huidige programma **niet** herkent. Iemand die
blind op de library vertrouwt, krijgt geen duidelijke fout maar een "Instruction missing"
of een stilzwijgende mismatch.

**Concrete bevindingen (gemeten, niet aangenomen):**

1. **Alle discriminators zijn fout.** Anchor-discriminators zijn `sha256("global:<name>")[:8]`.
   De library gebruikt een sequentieel patroon (`11b8c30d`, `11b8c30e`, …) dat op geen
   enkele instructie klopt:

   | Instructie | Echte discriminator | In library |
   |------------|--------------------:|-----------:|
   | `create_poison_token` | `bb8fe1c5b2712049` | `11b8c30d00000000` |
   | `poison_transfer_hook` | `ee7abc4b877f4350` | `11b8c31000000000` |
   | `mark_malicious` | `f245119b9dd48c42` | `11b8c31100000000` |
   | `unmark_malicious` | `c16879a718313a4c` | `11b8c31200000000` |

2. **Twee phantom-instructies.** De library definieert `add_poison_authorized` en
   `remove_poison_authorized` — instructies die in het huidige programma
   (`programs/active-defense/src/lib.rs`) **niet bestaan**. Het programma heeft exact
   vier instructies: `create_poison_token`, `poison_transfer_hook`, `mark_malicious`,
   `unmark_malicious`.

3. **Data-layout mismatch op `create_poison_token`.** Het programma verwacht
   `(authorized_recipients: Vec<Pubkey>, client_action_nonce: u64, client_data_json:
   Vec<u8>)`. De library bouwt `(nonce: u64, json_len: u32, json)` — de
   `authorized_recipients`-vector ontbreekt volledig.

4. **Account-layout mismatch.** De library verwacht een `poisonTokenPda`-account
   (seeds `["poison_token", wallet, mint]`). Het huidige programma heeft géén aparte
   PoisonToken-PDA — de authorized list zit in de mint's Token-2022 transfer hook data.
   De library mist daarentegen het optionele `passkeys`-account dat het programma wél
   accepteert.

5. **`derivePoisonTokenPda()` en `test-verify.js`** refereren nog aan diezelfde
   `poison_token` PDA — restant van het oude design. `test-verify.js` "slaat" omdat
   het alleen controleert dat de PDA *niet* bestaat, wat triviaal waar is als er geen
   account op aangemaakt is.

**Wat dit betekent:** de client-library is momenteel **niet bruikbaar** voor het
opbouwen van geldige instructies. De E2E-tests (`tests/activeDefenseFull.ts`) omzeilen
dit door zelf de discriminators en data-layouts te bouwen (en kloppen daardoor wél met
het programma). De library is dus een dead-end totdat hij herschreven wordt.

**Vervolgstap, nog niet uitgevoerd:** `poisonToken.ts` herschrijven tegen de huidige
4-instructie-versie. Concreet:
- Discriminators vervangen door de echte sha256-waarden (of beter: genereren via een
  shared helper, zoals de tests al doen)
- `add_poison_authorized` / `remove_poison_authorized` verwijderen (of toevoegen aan het
  programma als ze wél nodig zijn — designbeslissing)
- `buildCreatePoisonTokenIx` data-layout corrigeren: `Vec<Pubkey>` vooraan, dan nonce,
  dan json
- Account-layout corrigeren: optioneel `passkeys`-account, geen `poisonTokenPda`
- `derivePoisonTokenPda()` en de `poison_token` PDA-check in `test-verify.js`
  verwijderen of expliciet markeren als "legacy"

**Tijdelijke workaround:** totdat de library herschreven is, bouwen tests en scripts
hun eigen instructies (zoals `tests/activeDefenseFull.ts` al doet). De library niet
gebruiken voor productie-instructies.

## 5. Spankwallet testfixture — wegwerp-deploy voor test-isolatie (2026-08-27)

**Doel:** de E2E-tests (`tests/activeDefenseFull.ts`, `tests/activeDefense.ts`) roepen
`init_wallet` aan op een spankwallet-programma. Vóór deze sectie was dat het ECHTE,
multisig-bestuurde programma (`9ma6vQVA71...`) — productietestverkeer op spankwallet's
kant (openstaand punt 3). Nu draaien de tests tegen een eigen wegwerp-deploy.

**Opzet (herhaalbaar):**
1. Geïsoleerde worktree van spankwallet op commit `1fb3134` (de B1-B7-referentie,
   sectie 1): `git -C ~/projects/spankwallet worktree add --detach
   ~/projects/spankwallet-testfixture 1fb3134`
2. Vers throwaway-keypair: `~/.config/active-defense/testfixture/spankwallet-throwaway-keypair.json`
   → program-ID `BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk`
3. In de worktree: `declare_id!` gewijzigd naar dat adres, én `idl-build`-feature
   toegevoegd aan `programs/active-defense/Cargo.toml` (die zat op commit 1fb3134 nog in
   spankwallet's workspace en brak de build — zelfde gat als sectie 2)
4. `anchor build` → `target/deploy/spankwallet.so` (552280 bytes)
5. Byte-verificatie: throwaway-ID exact **1×** rauw in het .so, echt spankwallet-ID **0×**
6. Deploy naar devnet met LOS fee-payer (spankwallet's `id.json`) + expliciete
   upgrade-authority (vermijdt de "already in use"-voetangel van sectie 2):
   `solana program deploy target/deploy/spankwallet.so --url devnet --fee-payer
   ~/.config/solana/id.json --program-id <throwaway> --upgrade-authority <throwaway>`
   → signature `mLkAzyaUZE4Qh9gxsGzvJx2ueWth5juDumHADu7b2PZZciAsGC4qZFeZbuZq27xgqgwXdFoVGG9T938tj9U44VP`

**Geverifieerd (`solana program show BUtmiNmq...`):**
- Owner: BPFLoaderUpgradeable (correct upgradeable)
- Authority: `BUtmiNmq...` (zichzelf = throwaway-keypair, **geen** spankwallet-id.json)
- Data Length: 552280 bytes (exact match met het .so)

**Test-koppeling (env-var + harde grendel):** beide testbestanden lezen nu
`SPANKWALLET_TEST_PROGRAM_ID` (default `BUtmiNmq...`) en weigeren via een blocklist op:
- Het echte spankwallet (`9ma6vQVA71...`)
- De vier oude active-defense wegwerpadressen (G1D5ckPj..., DGaTtEj3..., 8vPFH4YY..., 9W3CGKhd...)

Zodat een verouderd of verkeerd adres nooit stilzwijgend voor een nieuw kan doorgaan
(zelfde patroon als spankwallet's `verify-program-id-in-binary.ts`).

**Bewijs dat het werkt (`npx ts-node tests/activeDefenseFull.ts` tegen de fixture):**
- ✓ **STAP 1 (init_wallet) SLAG** — wallet PDA afgeleid, action_nonce 0. Dit bewijst dat
  de hardcoded offsets in active-defense kloppen met de fixture (beide op commit 1fb3134)
  én dat de passkey-flow end-to-end functioneel is.
- ✗ STAP 2 (Token-2022 mint) faalt — ZIE HIERONDER (apart, bestaand bug).

**Openstaand: STAP 2 Token-2022-mint `InvalidAccountData` (gevonden 2026-08-27):**
De test maakt de mint aan met `space = MINT_SIZE + 128` (210 bytes, voor de
transfer-hook-extensie). Diagnose via een minimale test:
- `space = MINT_SIZE` (82 bytes): ✓ InitializeMint2 slaagt
- `space = MINT_SIZE + 128` (210 bytes): ✗ "InvalidAccountData"

Dus de **grootte** van het mint-account is het probleem, niet de fixture — en het
is een **strikte** check, geen "niet genoeg ruimte": zelfs `MINT_SIZE + 8` (90 bytes)
faalt met dezelfde fout. Bevestigd via meerdere minimale tests op devnet:
- `space = MINT_SIZE` (82): ✓ InitializeMint2 slaagt
- `space = MINT_SIZE + 8` (90): ✗ InvalidAccountData
- `space = MINT_SIZE + 128` (210): ✗ InvalidAccountData

**Diepere bevinding (2026-08-27):** dit is geen test-bug maar een fundamenteel
design-constraint. Twee feiten samen sluiten de standaardpad:
1. `InitializeMint2` vereist strikt exact MINT_SIZE — géén grotere grootte, hoe klein
   de extensie-ruimte ook is.
2. `createInitializeTransferHookInstruction` (de client-kant van de hook-initiërisatie)
   geeft alleen het mint-account mee (writable) en **resizet niet zelf** — dus de mint
   zou vóórhand genoeg ruimte moeten hebben, maar punt 1 verbiedt precies dat.

Consequentie: een Token-2022-mint met vooraf gereserveerde extensie-ruimte is niet te
maken via `createAccount` + `InitializeMint2`, én de hook-instructie groeit het account
niet na. active-defense' poison-token-design (transfer hook op een mint) heeft hierdoor
een fundamenteel probleem zoals momenteel geconceerd. Mogelijke uitwegen (nog te
onderzoeken): een resize-mechanisme tussen initialisatie en hook-toevoeging (niet
triviaal voor een Token-2022-eigen account), óf een ander creatiepad dat nog niet is
gevonden, óf een ander mechanisme dan een Token-2022-extensie voor het blokkeren van
transfers. Dit is een designbeslissing, geen bugfix — bespreken vóórdat er verder op
wordt gebouwd.

**Schoonmaken (wanneer de fixture niet meer nodig is):**
`git -C ~/projects/spankwallet worktree remove ~/projects/spankwallet-testfixture` +
het throwaway-programma op devnet laten verouderen (of upgraden naar een leeg .so).

## 6. STAP2-FIX (rent-sysvar) getest tegen een wegwerp-deploy - twee losstaande, voorafgaande bugs gevonden, fix zelf nog niet bevestigd

Aanleiding: de niet-gecommitte STAP2-FIX (`instructions.rs`: `RENT_SYSVAR_ID` toegevoegd
aan `CreatePoisonToken` + de Token-2022-CPI; `tests/activeDefenseFull.ts`: mint-aanmaak
met alleen de basisgrootte + aparte pre-funding-stap) is gecontroleerd door de bijbehorende
test daadwerkelijk te draaien - niet alleen gelezen. Uitgevoerd tegen een wegwerp-deploy op
devnet (vers keypair, `declare_id!`/`ACTIVE_DEFENSE_ID` tijdelijk daarheen gewezen, na afloop
teruggezet - geen van beide bestanden staat blijvend gewijzigd, dit is puur een testverslag).
**Niets van dit onderzoek is gecommit.**

**Bug 1 (voorafgaand aan STAP2-FIX, blokkeert elke aanroep van `create_poison_token` via deze
testfile): `passkeys`-accountpositie klopt niet.** `CreatePoisonToken` se `passkeys`-veld is
`Option<UncheckedAccount>`. De test slaat dat slot in de `keys`-array volledig over
("`// passkeys: Option<UncheckedAccount> → leeg (None) = geen account`") - maar Anchor
consumeert voor een optioneel account ALTIJD een positioneel slot, ongeacht of het "leeg" is.
Rechtstreeks nagekeken in de daadwerkelijk gebruikte crate-versie
(`anchor-syn-1.1.2/src/codegen/accounts/try_accounts.rs:42-61`): een optioneel account is
`None` als de eerste resterende key gelijk is aan het PROGRAMMA-ID zelf (dat slot wordt dan
ALSNOG geconsumeerd); anders wordt het als `Some(account)` gelezen. Door het slot te
skippen i.p.v. het programma-ID als placeholder mee te geven, schuiven alle volgende
accounts één positie op - `payer` komt zo terecht op de plek waar het programma
`instructions_sysvar` verwacht, vandaar de geobserveerde fout:
`AnchorError caused by account: payer. Error Code: AccountNotSigner`. Bevestigd door een
placeholder (`{ pubkey: ACTIVE_DEFENSE_ID, isSigner: false, isWritable: false }`) op die
positie in te voegen (diagnostisch, niet gecommit) - de fout verschoof daarna naar bug 2
hieronder, wat de diagnose bevestigt.

**Bug 2 (eveneens voorafgaand aan STAP2-FIX, ook niet inhoudelijk gerelateerd aan de
rent-sysvar-fix): `CreatePoisonToken` mist een account voor het Token-2022-programma
zelf.** Na het herstellen van bug 1 faalt de transactie op een nieuwe plek: `"An account
required by the instruction is missing"` met logregel `"Unknown program
TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"` (Token-2022's eigen programma-ID). De
`invoke()`-aanroep in `create_poison_token` (de Token-2022-CPI die STAP2-FIX net van een
rent-sysvar-account voorzag) geeft alleen `[token_mint, rent, payer]` als account_infos mee
- het Token-2022-programma-account zelf staat nergens in de transactie, niet in de
`CreatePoisonToken`-structdefinitie (geen `token_program`-veld) en niet in de test se
`keys`-array. Zonder dat account kan de runtime het CPI-doelprogramma niet laden.

**Gevolg: de rent-sysvar-fix zelf is met deze test NIET bevestigd te werken - niet omdat
hij fout is, maar omdat twee onafhankelijke, voorafgaande gaten de uitvoering allebei vóór
STAP2-FIX se eigen logica blokkeren.** Om de rent-sysvar-fix daadwerkelijk te bewijzen moet
eerst bug 2 verholpen worden (een `token_program`-account toevoegen aan zowel de Rust-struct
als de test se `keys`-array), en dat is zelf weer een keuze die bij het "bespreken vóórdat
er verder op wordt gebouwd"-punt uit sectie 5 hoort, niet iets wat deze sessie op eigen
houtje heeft doorgevoerd.

**Niet gecommit, zoals gevraagd:** dit is uitsluitend een testverslag. `instructions.rs` en
`tests/activeDefenseFull.ts` staan zoals ze al waren (de oorspronkelijke, ongecommitte
STAP2-FIX) - geen van beide bugs hierboven is in de werkboom gecorrigeerd.

## 7. De "Diepere bevinding" uit sectie 5 getoetst - het vermoeden klopt, mét een tweede, groter gevonden probleem. Niets gebouwd, uitsluitend onderzoek.

**Gevraagd:** het vermoeden toetsen dat sectie 5's "Diepere bevinding" (InitializeMint2
verbiedt structureel een grotere-dan-basis mint-account) een misvatting over de VOLGORDE is,
niet een echt Token-2022-blokkade - tegen een concrete, officiële bron, niet aangenomen.

### 1. Officiële volgorde, met bronverwijzing - bevestigt het vermoeden, dubbel gesourced

**Bron 1, het officiële voorbeeld** (`solana-program/token-2022`, het huidige canonieke
SPL-Token-2022-repo - niet aangenomen welke repo canoniek is, apart gecontroleerd via
`gh api repos/solana-program/token-2022`, beschrijving "The SPL Token 2022 program and its
clients"):
[`clients/js-legacy/examples/transferHook.ts`](https://github.com/solana-program/token-2022/blob/74b48bf67f6ebc541a7589a9a44e05dd11fea7d4/clients/js-legacy/examples/transferHook.ts),
letterlijk (kernfragment):

```ts
const extensions = [ExtensionType.TransferHook];
const mintLen = getMintLen(extensions);
...
const mintTransaction = new Transaction().add(
    SystemProgram.createAccount({ ..., space: mintLen, ... }),
    createInitializeTransferHookInstruction(mint, payer.publicKey, transferHookPogramId, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TOKEN_2022_PROGRAM_ID),
);
```

Volgorde: `getMintLen([ExtensionType.TransferHook])` (volledige, definitieve grootte VOORAF
berekend) → account aangemaakt op die volledige grootte in één keer → `InitializeTransferHook`
→ als ALLERLAATSTE stap `InitializeMint`. Geen resize, nergens.

**Bron 2, het canonieke on-chain-programma se EIGEN interface-crate** (dus niet alleen een
client-side voorbeeld, maar de daadwerkelijke instructiedefinitie die het programma
decodeert):
[`interface/src/extension/transfer_hook/instruction.rs`](https://github.com/solana-program/token-2022/blob/74b48bf67f6ebc541a7589a9a44e05dd11fea7d4/interface/src/extension/transfer_hook/instruction.rs),
letterlijk, de doc-comment op `TransferHookInstruction::Initialize` zelf:

> Initialize a new mint with a transfer hook program.
>
> Fails if the mint has already been initialized, so must be called before
> `InitializeMint`.
>
> The mint must have exactly enough space allocated for the base mint (82
> bytes), plus 83 bytes of padding, 1 byte reserved for the account type,
> then space required for this extension, plus any others.

Dit is geen afgeleide interpretatie - dit IS de regel, letterlijk uit de bron die het
programma zelf implementeert. **Vermoeden bevestigd: de volgorde is doorslaggevend, niet de
grootte op zich.** Sectie 5's testopstelling (grotere account, GEEN extensie-init-instructie
ertussen, meteen `InitializeMint2`) testte een onvolledige variant van het officiële pad -
"faalt bij een grotere account" was empirisch correct gemeten, maar de conclusie "InitializeMint2
verbiedt principieel elke grotere grootte" is de misvatting: zonder eerst de
extensie-TLV-data in die extra ruimte te schrijven (via `InitializeTransferHook`) ziet
`InitializeMint2` alleen ongeïnitialiseerde/onherkenbare bytes na de basis-82, vandaar
`InvalidAccountData` - niet omdat de grootte zelf verboden is.

### 2. Vergelijking met de huidige code - de test doet exact de foute volgorde

`tests/activeDefenseFull.ts` STAP 2 (regel 306-317): maakt de mint aan op
`TOKEN_MINT_BASE_LEN` (82 bytes, GEEN extensieruimte) en roept DIRECT
`createInitializeMint2Instruction` aan - de mint is op dat moment al volledig
geïnitialiseerd, vóórdat er ooit een extensie bij kwam. STAP 4 (`create_poison_token`, pas
later) probeert dan een `InitializeTransferHook`-CPI op deze AL-GEÏNITIALISEERDE mint - exact
het patroon dat bron 2's doc-comment expliciet uitsluit ("must be called before
InitializeMint"). De "pre-fund voor extensieruimte, het programma resizet"-aanname (STAP2-FIX,
regel 356-366) is zelf ook onjuist: geen enkele Initialize<Extension>-instructie resizet een
account - de account moet AL op zijn definitieve grootte staan vóórdat welke
extensie-instructie dan ook draait (zie bron 2's "moet exact genoeg ruimte hebben" - vooraf,
niet achteraf).

### 3. Testfix of raakt het ook instructions.rs? - allebei, maar om twee verschillende redenen

**Voor de VOLGORDE/GROOTTE-kwestie specifiek: puur een testfix.** `create_poison_token`'s
Rust-handler (`instructions.rs`) leest of parseert nergens bestaande mint-state - hij gebruikt
`ctx.accounts.token_mint.key()` uitsluitend als pubkey voor de CPI-accountlijst, geen
`Account<'info, Mint>`-deserialisatie, geen aanname over decimals/mint_authority/of
`InitializeMint2` al gedraaid heeft. De CPI-timing van het programma zelf is dus onverschillig
voor de volgorde - het programma hoeft niet te weten of de mint al "af" is. De juiste fix zit
volledig in `tests/activeDefenseFull.ts`: STAP 2 moet de mint aanmaken op
`getMintLen([ExtensionType.TransferHook])` (niet de handmatig geschatte
`TOKEN_MINT_BASE_LEN + 128` uit de huidige `TOKEN_MINT_LEN`-constante - de officiële
bibliotheekfunctie gebruiken sluit een reken- of afrondingsfout uit), zonder meteen
`InitializeMint2` te callen; STAP 4 (`create_poison_token`) blijft ongewijzigd; een NIEUWE,
losse stap ná STAP 4 roept pas `createInitializeMint2Instruction` aan (zoals het officiële
voorbeeld met zijn eigen laatste instructie in dezelfde transactie doet - hier moet het een
aparte transactie worden, want STAP 4 loopt via het active-defense-programma, niet via een
kale client-transactie met alle drie instructies samen).

**Onafhankelijk gevonden, tijdens het rechtstreeks vergelijken van `instructions.rs` met
bron 2 voor deze vraag - een tweede, groter probleem dat NIET door de volgorde-fix wordt
opgelost:** de `InitializeTransferHook`-CPI die `create_poison_token` zelf bouwt
(`instructions.rs`, de `ix`/`ix_data`-constructie) komt niet overeen met wat bron 2 als het
daadwerkelijke, door het programma gedecodeerde formaat specificeert:

| | bron 2 (het echte programma) | `instructions.rs` nu |
|---|---|---|
| accounts | **1**: `[mint (writable)]` | **3**: `[mint, rent sysvar, payer]` |
| opcode | 2 bytes: `TransferHookExtension`(36) + `Initialize`(0) | 1 byte: `34` |
| data | `authority: MaybeNull<Address>` + `program_id: MaybeNull<Address>` (vast, 2 pubkeys) | 32-byte `crate::ID` + 4-byte lengte + variabele `authorized_recipients`-payload |

Dit is geen ordevraag - dit is een andere instructie-envelope. Zelfs ná de volgorde-fix zou
deze CPI vermoedelijk alsnog falen (verkeerde opcode, verkeerd aantal accounts, data die het
programma niet als `InitializeInstructionData` kan decoderen), of in het gunstigste geval
zonder fout een compleet verkeerd resultaat opleveren. **Belangrijker, een designvraag, geen
bugfix:** `InitializeInstructionData` heeft structureel geen ruimte voor een
`authorized_recipients`-lijst - alleen `authority` en `program_id` (het hook-programma-adres
zelf). De `authorized_recipients`-lijst die dit ontwerp per transfer wil raadplegen hoort dus
sowieso niet in deze instructie te zitten; die data moet ergens anders leven (bijv. een eigen,
door active-defense beheerde PDA die het hook-programma tijdens een echte transfer kan
uitlezen, via het transfer-hook-interface se eigen `ExtraAccountMetaList`-mechanisme voor het
doorgeven van extra accounts aan de hook-CPI - niet onderzocht in deze ronde, alleen
geconstateerd dat de huidige aanpak hier geen ruimte voor heeft). Dit raakt dus wél
`instructions.rs`, maar als een apart, dieper ontwerpprobleem, los van de sectie-5-vraag die
nu getoetst werd.

### 4. Terugkoppeling naar de drie oorspronkelijke uitwegen uit sectie 5

Niet meer van toepassing zoals oorspronkelijk gesteld - de vraag zelf ("resize-mechanisme
nodig?") berustte op de misvatting. Herzien:
1. ~~"Een resize-mechanisme tussen initialisatie en hook-toevoeging"~~ - niet nodig. De
   officiële route heeft nergens een resize; vooraf correct dimensioneren (`getMintLen`)
   vervangt dit volledig.
2. ~~"Een ander creatiepad dat nog niet is gevonden"~~ - gevonden, zie punt 1 hierboven
   (bron 1/2), geen alternatief pad nodig, het STANDAARDpad volstaat.
3. **"Een ander mechanisme dan een Token-2022-extensie voor het blokkeren van transfers"** -
   blijft als vraag OVEREIND, maar om een andere reden dan aanvankelijk gedacht: niet omdat
   Token-2022's transfer-hook-extensie een maat-/volgordeprobleem heeft (die is prima
   bruikbaar), maar omdat punt 3 hierboven laat zien dat de HUIDIGE CPI-constructie het echte
   protocol niet volgt en de authorized-recipients-data nergens een plek heeft in wat
   `InitializeTransferHook` daadwerkelijk accepteert - een implementatievraag over de
   transfer-hook-interface (extra-account-metas/eigen PDA), geen vraag over of de extensie
   zelf geschikt is.

**Niets gebouwd of gewijzigd, zoals gevraagd - dit blijft een bevinding, geen doorgevoerde
fix, totdat akkoord gegeven wordt.**

## 8. Volgordefix gebouwd in tests/activeDefenseFull.ts, getest tegen een wegwerp-deploy - STAP 2 bevestigd gefixt, een NIEUWE sequencing-fout gevonden vóórdat de envelope-kwestie uit sectie 7 bereikt werd

**Gevraagd:** alleen de volgordefix bouwen (STAP 2: `getMintLen`, account in één keer op
volledige grootte, `InitializeMint2` verplaatst naar een nieuwe stap ná STAP 4) -
`instructions.rs` expliciet niet aanraken.

### Wat gebouwd is, in `tests/activeDefenseFull.ts`

- Import toegevoegd: `createInitializeTransferHookInstruction`, `getMintLen`, `ExtensionType`.
- De handmatig geschatte constanten (`TOKEN_MINT_BASE_LEN`, `TRANSFER_HOOK_EXT_SIZE`,
  `TOKEN_MINT_LEN`) verwijderd - nergens anders gebruikt dan in het nu vervangen STAP-2-blok
  (gecontroleerd, niet aangenomen).
- STAP 2: `getMintLen([ExtensionType.TransferHook])` berekent de definitieve grootte;
  `SystemProgram.createAccount` maakt de mint in één keer op die grootte aan;
  `createInitializeTransferHookInstruction(mint, payer, ACTIVE_DEFENSE_ID, TOKEN_2022_PROGRAM_ID)`
  in dezelfde transactie - zelfde structuur als het officiële voorbeeld (sectie 7).
- De oude "pre-fund voor extensieruimte"-stap tussen STAP 3 en STAP 4 verwijderd (niet meer
  nodig - de mint staat al vanaf STAP 2 op zijn definitieve grootte).
- Nieuwe STAP 4b, ná STAP 4's try/catch-blok: `createInitializeMint2Instruction` in een eigen
  transactie - de allerlaatste stap, zoals bron 2 in sectie 7 voorschrijft.

### instructions.rs - bevestigd ongewijzigd

```
$ git diff -- programs/active-defense/src/instructions.rs
```
geeft exact dezelfde inhoud als vóór deze sessie se werk aan active-defense (de reeds
langer bestaande, ongecommitte STAP2-FIX-rent-sysvar-toevoeging - zie sectie 6). Geen enkele
`Edit`/`Write`-aanroep is in deze ronde tegen dit bestand gedaan.

### Getest tegen een wegwerp-deploy (vers keypair, `declare_id!`/`ACTIVE_DEFENSE_ID`
tijdelijk daarheen gewezen, na afloop teruggezet - beide bevestigd leeg via `git diff`,
niets gecommit)

**STAP 1 en STAP 2 slagen** - de mint-aanmaak zelf is hiermee empirisch bevestigd gefixt:
```
STAP 2: Token-2022 mint...
  Mint: 6iaGrudVfNPsfFzKiNjcgXLy8B4TxApLv1bL3oKepixV (mintLen=234, via getMintLen([TransferHook]))
```
Geen `AccountNotSigner`, geen `Unknown program` - de fouten uit sectie 6 zijn weg. Dit
bewijst de VOLGORDE-fix, niets meer en niets minder (zoals gevraagd expliciet afgebakend).

**STAP 3 faalt - een NIEUWE, eerder niet-voorspelde sequencing-fout, vóórdat de
envelope-kwestie uit sectie 7 punt 3 ooit bereikt wordt:**
```
STAP 3: Token accounts...
Program log: Instruction: InitializeAccount
Program log: Error: Invalid Mint
custom program error: 0x2
```
Rechtstreeks tegen de keten geverifieerd, niet aangenomen wat de oorzaak is: het mint-account
opgevraagd (`solana account 6iaGrudVfNPsfFzKiNjcgXLy8B4TxApLv1bL3oKepixV --output json`) -
234 bytes (klopt met `mintLen`), de basis-82-byte-Mint-laag is volledig nul, de
`is_initialized`-byte (offset 45) staat op `0`. **De mint is op dat moment in de test
daadwerkelijk nog niet geïnitialiseerd** - correct en verwacht, want STAP 4b
(`InitializeMint2`) is per opdracht bewust verplaatst naar NÁ STAP 4, en STAP 3 (het aanmaken
van de source/destination token-accounts) staat in de bestaande stapvolgorde nog steeds
VÓÓR STAP 4/4b. Token-2022's `InitializeAccount`-instructie weigert terecht een
niet-geïnitialiseerde mint (`Invalid Mint`, foutcode 0x2) - dit is geen bug in de
volgordefix, het is een gat in de VOLGORDE VAN DE STAPPEN ZELF dat de opdracht ("verplaats
alleen InitializeMint2") niet had voorzien: STAP 3 moet ook ná STAP 4b komen te staan, niet
alleen STAP 4b ná STAP 4.

**Consequentie: de envelope-kwestie uit sectie 7 punt 3 (verkeerde CPI-opcode/accounts/data
in `create_poison_token`) is in deze testrun NIET bereikt.** Het proces stopte bij STAP 3,
ruim vóór STAP 4 ooit een `create_poison_token`-CPI probeert te sturen. Sectie 7 punt 3's
bevinding blijft dus onbewezen-maar-ook-niet-weerlegd - simpelweg niet aan toegekomen.

### Wat dit wél en niet vaststelt

- **Wel:** de kern van sectie 7's vermoeden - `getMintLen` + account-in-één-keer +
  `InitializeTransferHook` vóór `InitializeMint2` - werkt zoals de officiële bron voorschrijft.
- **Niet:** of de volledige teststap-volgorde (2→3→4→4b→5) nu klopt - die doet het nog niet,
  STAP 3 moet verplaatst worden naar ná STAP 4b, wat buiten de scope van "alleen de
  volgordefix" viel zoals expliciet afgebakend voor deze ronde.
- **Niet:** of de envelope-kwestie uit sectie 7 punt 3 zich in de praktijk ook echt zo
  manifesteert als daar beredeneerd - de test kwam er niet aan toe. Blijft een aparte,
  openstaande vraag voor een volgende ronde, samen met de nu ontdekte STAP-3-volgordefout.

**Niets gecommit.** `git status` toont dezelfde drie bestanden als vóór deze testrun; het
wegwerp-programma (`FMM525HWL9p8xzyCdrkts3EDTpQWstV1TxyGxUVViauY`) staat nog live op devnet
(zelfde opruim-conventie als sectie 5: wordt niet actief opgeruimd, veroudert vanzelf).

## 9. Diepgaand onderzoek naar de CPI-envelope-kwestie (sectie 7 punt 3) - een officiële, kant-en-klare referentie-implementatie gevonden die exact dit probleem oplost. Niets gebouwd, uitsluitend onderzoek/ontwerp.

**Gevraagd:** uitzoeken hoe Token-2022's transfer-hook-interface daadwerkelijk werkt,
bestaande referentie-implementaties zoeken voor een allow-/blocklist-hook, vaststellen waar
`ExtraAccountMetaList` wel/niet voor dient, een ontwerpaanbeveling doen, checken op bestaande
crates, en een eerlijke scope-inschatting geven. **Niets gebouwd.**

### 1. Hoe werkt de transfer-hook-interface end-to-end - met bron

Twee soorten instructies, niet één:
- **`InitializeTransferHook`** (Token-2022 zelf, sectie 7 al behandeld) - registreert
  UITSLUITEND welk programma-adres de hook-logica uitvoert. Geen ruimte voor extra data.
- **`Execute`** (de transfer-hook-INTERFACE, een apart, door het HOOK-PROGRAMMA zelf
  geïmplementeerd protocol - niet onderdeel van Token-2022, maar een spec die elk
  hook-programma moet volgen). Dit is de instructie die Token-2022 als CPI aanroept bij
  ELKE ECHTE transfer, met de 4 standaard-accounts (source token account, mint, destination
  token account, owner/delegate) plus eventuele extra accounts.

**`ExtraAccountMetaList`** - een PDA met seeds `["extra-account-metas", mint]`
(rechtstreeks bevestigd: [Solana Foundation se eigen transfer-hook-gids](https://github.com/solana-foundation/developer-content/blob/main/content/guides/token-extensions/transfer-hook.md),
sectie over PDA-derivatie). Dit account bevat GEEN daadwerkelijke data - het is een
LIJST VAN RESOLUTIE-RECEPTEN (welke extra accounts, en hoe hun adres af te leiden), die
Token-2022 tijdens een ECHTE transfer zelf uitleest en gebruikt om automatisch de juiste
extra accounts aan de CPI naar het hook-programma se `Execute`-instructie toe te voegen.
Geïnitialiseerd via `ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &metas)`
(`spl-tlv-account-resolution`-crate), gevuld met `ExtraAccountMeta`-items
(`spl-tlv-account-resolution::account::ExtraAccountMeta`).

### 2. Bestaande referentie-implementatie gevonden - exact dit probleem, officieel, Anchor-gebaseerd

Gezocht in `solana-foundation/program-examples` (de huidige, canonieke naam - niet
`solana-developers/program-examples` zoals sommige secundaire bronnen nog vermelden, apart
gecontroleerd via `gh api repos/solana-foundation/program-examples`). Binnen
`tokens/token-2022/transfer-hook/` bestaan **twee** kant-en-klare voorbeelden die precies
doen wat active-defense wil:
- [`allow-block-list-token/anchor`](https://github.com/solana-foundation/program-examples/tree/main/tokens/token-2022/transfer-hook/allow-block-list-token/anchor)
  ("abl-token") - Anchor-gebaseerd (zelfde framework als active-defense), volledig
  allow/block/mixed-modus, per-wallet granulariteit.
- `block-list/pinocchio` - een kalere, Pinocchio-gebaseerde (geen Anchor) blocklist-variant -
  niet in detail bekeken (ander framework), wel het bestaan ervan bevestigd als een lichter
  alternatief indien Anchor's overhead ooit een reden wordt om te heroverwegen.

**`abl-token`'s architectuur, rechtstreeks uit de broncode (regel- en bestandsverwijzingen
naar `tokens/token-2022/transfer-hook/allow-block-list-token/anchor/programs/abl-token/src/`):**

- **`state.rs`**: `Config { authority: Pubkey, bump: u8 }` (één per mint, seeds `["config"]`)
  en **`ABWallet { wallet: Pubkey, allowed: bool }`** - een KLEIN, APART PDA PER WALLET
  (seeds `["ab_wallet", wallet]`), niet één grote `Vec<Pubkey>` in een enkel account.
- **`instructions/init_wallet.rs`** / **`remove_wallet.rs`**: voegen/verwijderen precies
  ÉÉN wallet-entry, elk zijn eigen kleine transactie - geen resize-problematiek voor een
  groeiende lijst, geen enkele write-hotspot-account die bij elke lijstwijziging herschreven
  moet worden.
- **`instructions/attach_to_mint.rs`**: doet de ECHTE `InitializeTransferHook`-registratie
  via `anchor_spl::token_interface::transfer_hook_update` (Anchor's eigen typed CPI-helper,
  niet een handmatige `Instruction`/`invoke()`-constructie zoals `instructions.rs` nu doet),
  ÉN initialiseert `ExtraAccountMetaList` in dezelfde instructie.
- **`utils.rs`**: `get_extra_account_metas()` - de kern van hoe de per-wallet-PDA's tijdens
  een ECHTE transfer gevonden worden, zonder dat de client ze hoeft mee te geven:
  ```rust
  ExtraAccountMeta::new_with_seeds(
      &[
          Seed::Literal { bytes: AB_WALLET_SEED.to_vec() },
          Seed::AccountData { account_index: 0, data_index: 32, length: 32 },
      ],
      false, false,
  )
  ```
  `Seed::AccountData { account_index: 0, data_index: 32, length: 32 }` leest bytes 32..64
  van accountindex 0 (het source-token-account, altijd aanwezig als standaardaccount) - dat
  is exact de `owner`-veldpositie in een SPL-Token-accountlayout. Zo wordt de `ab_wallet`-PDA
  voor de ECHTE afzender/ontvanger van DIE SPECIFIEKE transfer dynamisch afgeleid, zonder dat
  er ooit een aparte "wie is de eigenaar"-lookup nodig is.
- **`instructions/tx_hook.rs`**: de daadwerkelijke `Execute`-interface-implementatie
  (`#[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]` - het
  officiële discriminator-mechanisme uit de `spl-transfer-hook-interface`-crate, niet een
  zelfverzonnen opcode zoals `instructions.rs`'s huidige `ix_data.push(34)`). Leest de twee
  gerezolveerde `ABWallet`-accounts en beslist toe/afwijzen op basis van hun `allowed`-veld.

### 3. ExtraAccountMetaList: uitsluitend een resolutie-recept, NOOIT de data zelf

Rechtstreeks beantwoord door punt 2's `utils.rs`-fragment: de metadata bevat een
SEED-RECEPT (letterlijke bytes + verwijzingen naar bytes in AL AANWEZIGE accounts), nooit
de daadwerkelijke toegestane/geblokkeerde adressen. De echte data leeft altijd in aparte,
door het hook-programma zelf beheerde accounts (hier: de `ABWallet`-PDA's) die via dat
recept gevonden worden. Bevestigt sectie 7 punt 3's vermoeden expliciet en met een werkend
voorbeeld: er is geen manier om de `authorized_recipients`-lijst IN `InitializeTransferHook`
of IN `ExtraAccountMetaList` zelf te proppen - het hoort structureel ergens anders.

### 4. Aanbevolen ontwerp voor active-defense, vergeleken met de huidige code

**Aanbeveling: het `abl-token`-patroon overnemen, niet zelf opnieuw uitvinden.** Concreet
voor active-defense (mint-per-wallet-granulariteit i.p.v. Config's globale modus, want
`create_poison_token` se bestaande ontwerp is al per-mint, geen globale schakelaar nodig):

| nieuw nodig | rol | vergelijkbaar met huidige code |
|---|---|---|
| `AuthorizedRecipient`-PDA, seeds `["poison_authorized", mint, recipient]` | één per toegestane ontvanger | vervangt de `authorized_recipients: Vec<Pubkey>`-parameter die nu (fout) in de hook-CPI-data gepropt wordt |
| `add_authorized_recipient`/`remove_authorized_recipient`-instructies | lijstbeheer, passkey-gated zoals de rest van active-defense | nieuw - bestaat nu niet, de lijst werd tot nu toe alleen bij `create_poison_token` zelf meegegeven, nooit later te wijzigen |
| `attach_transfer_hook`-instructie | de ECHTE `InitializeTransferHook`-registratie + `ExtraAccountMetaList`-initialisatie, via `anchor_spl::token_interface::transfer_hook_update` | vervangt `create_poison_token`'s huidige, verkeerd-geconstrueerde raw-CPI-blok volledig |
| `poison_transfer_hook`-instructie (bestaat al bij naam, `instructions.rs` heeft 'm al als discriminator-doel voor de client-kant hook_disc-berekening) | de echte `Execute`-interface-implementatie, met `SPL_DISCRIMINATOR_SLICE` i.p.v. het huidige zelfverzonnen schema | moet herschreven worden - de huidige `create_poison_token` doet dit NIET, hij probeert zelf de `InitializeTransferHook`-CPI te sturen, wat een andere instructie is |

`create_poison_token` zoals het nu bestaat, doet in feite het werk van TWEE toekomstige
instructies door elkaar (transfer-hook-REGISTRATIE + lijst-INHOUD), met een instructie-
envelope die bij geen van beide standaarden past. De aanbeveling is geen kleine patch op de
bestaande functie - het is een vervanging door 3-4 kleinere, elk voor hun eigen taak
verantwoordelijke instructies.

### 5. Bestaande crates - ja, beide bevestigd echt en actueel op crates.io

- `spl-transfer-hook-interface` - **2.1.0** (`crates.io/api/v1/crates/spl-transfer-hook-interface`,
  rechtstreeks bevraagd, niet aangenomen), beschrijving "Solana Program Library Transfer
  Hook Interface".
- `spl-tlv-account-resolution` - **0.11.2**, beschrijving "Solana Program Library TLV
  Account Resolution Interface".

Beide worden daadwerkelijk gebruikt door `abl-token` hierboven, dus bewezen samen te werken
met Anchor `1.1.2`/`anchor-spl 1.1.2` in ieder geval in de vorm zoals dat voorbeeld het
gebruikt. **Niet met zekerheid vastgesteld:** of active-defense's eigen `anchor-lang`/
`anchor-spl`-versiepin (`1.1.2`, dezelfde ongebruikelijke versienotatie als spankwallet -
vermoedelijk een projectlokale/geforkte variant, niet geverifieerd tegen een officiële
Anchor-releaselijst) exact dezelfde `token_interface::transfer_hook_update`-helper
aanbiedt die `abl-token` gebruikt - dat vereist een daadwerkelijke build-poging om te
bevestigen, niet in deze onderzoeksronde gedaan.

### 6. Scope-inschatting, eerlijk

**Dit is aanzienlijk groter dan wat er tot nu toe in active-defense bestaat.** Vergelijking:
de huidige `create_poison_token` is één instructie, één account extra (`token_mint`), geen
apart lijstbeheer. Het juiste ontwerp voegt toe: minstens 2 nieuwe account-types
(`AuthorizedRecipient`-PDA, `ExtraAccountMetaList`), 3-4 nieuwe/herschreven instructies,
twee nieuwe dependencies (`spl-transfer-hook-interface`, `spl-tlv-account-resolution`,
compatibiliteit niet bevestigd, zie punt 5), en - net als bij elke nieuwe accountlayout in
dit project - een eigen worst-case-/layoutanalyse (naar het patroon dat spankwallet
consequent hanteert voor eigen accountwijzigingen). Dat is meer werk dan alles wat
active-defense tot nu toe heeft (sectie 1-8 samen betreffen één instructie).

**Kleinere eerste-versie-aanpak die het probleem WEL oplost, zonder het hele mechanisme in
één keer te bouwen:** een MINIMALE variant met alleen `add_authorized_recipient` (geen
`remove`, geen `Config`/modus-schakelaar zoals `abl-token`'s Allow/Block/Mixed - active-
defense se eigen ontwerp is toch al altijd "alleen expliciet toegestane ontvangers mogen
ontvangen", geen configureerbare modus nodig) plus de verplichte `attach_transfer_hook` en
`poison_transfer_hook`-herbouw. Dat is nog steeds 3 instructies en 2 nieuwe accounttypes,
maar zonder `abl-token`'s modus-/drempellaag (die active-defense's eigen, al vastgelegde
ontwerp niet nodig heeft) - een reëel kleinere eerste stap dan het volledige
`abl-token`-patroon overnemen, terwijl de kern (per-wallet-PDA + `ExtraAccountMetaList` +
échte `Execute`-interface) wel intact blijft.

**Niet met zekerheid vastgesteld, expliciet:** de exacte compute-/rentkosten van deze
nieuwe opzet, of active-defense's `anchor-spl 1.1.2` de gebruikte Anchor-typed-CPI-helpers
ondersteunt, en of er onderweg nog meer verrassingen zijn zoals sectie 8's STAP-3-
volgordefout - dit onderzoek stelt het ONTWERP vast, niet dat het zonder verdere iteratie
in één keer zal werken.

**Niets gebouwd, zoals gevraagd - dit blijft ontwerp-/onderzoekswerk voor een latere,
losse beslissing.**

## 10. Sectie 8's STAP-3-volgordefix gebouwd en getest tegen een nieuwe wegwerp-deploy - de fix zelf bevestigd (alleen via een diagnostische bypass), maar STAP 4 zelf blijkt niet meer te halen; een NIEUWE, eerder gemaskeerde token-account-groottefout gevonden

**Gevraagd:** sectie 8's bekende bevinding oplossen (STAP 3, het aanmaken van de
token-accounts, staat nog vóór STAP 4b/InitializeMint2 terwijl het zelf ook een al-
geïnitialiseerde mint nodig heeft) - kiezen voor de optie die minder aan de bestaande
structuur verandert, testen tegen een wegwerp-deploy, en rapporteren of STAP 2 t/m 4 nu
allemaal slagen tot aan de bekende CPI-envelope-kwestie (sectie 7/9).

### Wat gebouwd is, in `tests/activeDefenseFull.ts`

Gekozen voor "STAP 3 verplaatsen naar ná STAP 4b" (niet "STAP 4b naar vóór STAP 3") - dat
laatste zou InitializeMint2 vóór create_poison_token/STAP 4 plaatsen, wat sectie 7's
eigen, net vastgestelde regel ("InitializeMint2 moet ná alle extensie-init komen, dus ná
STAP 4") zou breken.

- STAP 3's volledige account-aanmaak (keypairs voor `srcToken`/`dstUnauthorized`/
  `dstAuthorized`, `tokenRent`, de drie `createAccount`+`InitializeAccount`-transacties)
  verplaatst naar ná STAP 4b, vóór STAP 5.
- `unauthorizedOwner`/`authorizedOwner` (kale `Keypair.generate().publicKey`-waarden, geen
  on-chain call) vervroegd naar vóór STAP 4 - `create_poison_token` had `authorizedOwner`
  daar al nodig voor `authorizedRecipients`. Alleen de PUBKEYS zijn vervroegd, niet de
  accounts die ze bezitten.
- `instructions.rs` niet aangeraakt - `git diff` vóór en na deze ronde identiek (bevestigd,
  niet aangenomen).

### Getest tegen een NIEUWE wegwerp-deploy (ander keypair dan sectie 8's, zelfde discipline)

Vers keypair gegenereerd (`aE1HJjEra7HwUJ5yb5udBWMcdAGfX36fEpkpxdv7ZdM`, hier bewust een
NIEUW keypair i.p.v. sectie 8's nog levende `FMM525HWL9p8xzyCdrkts3EDTpQWstV1TxyGxUVViauY`
hergebruiken, zoals gevraagd). `declare_id!`/`Anchor.toml` tijdelijk daarheen gewezen,
`anchor build` gedraaid, `.so` byte-geverifieerd (nieuw ID exact 1× rauw aanwezig, echt ID
`FzeAZmQz...` 0×), gedeployed met los fee-payer (`~/.config/solana/id.json`) + expliciete
eigen upgrade-authority. Achteraf onafhankelijk bevestigd (`solana program show`): Authority
= zichzelf (niet `id.json`), Data Length exact gelijk aan het `.so`-bestand (227208 bytes).
**Na de testrun** `declare_id!`, `Anchor.toml` én de test se `ACTIVE_DEFENSE_ID`-constante
teruggezet naar het echte adres - `git diff` op `programs/active-defense/src/lib.rs` en
`Anchor.toml` bevestigd LEEG na afloop.

### Resultaat van een NORMALE testrun (geen enkele code-bypass)

STAP 1 en STAP 2 slagen, zoals in sectie 8. **STAP 4 (`create_poison_token`) faalt nu
DIRECT** - vóórdat STAP 4b of het herziene STAP 3 ooit bereikt worden:

```
STAP 4: create_poison_token...
  ✗ create_poison_token failed: ...
Logs:
  "Program aE1HJjEra7HwUJ5yb5udBWMcdAGfX36fEpkpxdv7ZdM invoke [1]",
  "Program log: Instruction: CreatePoisonToken",
  "Unknown program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "... failed: An account required by the instruction is missing"
```

**Oorzaak:** de test se `keys`-array voor `create_poison_token` bevat het Token-2022-
programma-account zelf nergens (niet in deze instructie, niet in de secp256r1-instructie
ervoor) - een `invoke()` naar een CPI-doelprogramma vereist dat dát programma-account
ERGENS in de transactie se accounts staat, los van of het in de `Instruction`'s eigen
`accounts`-lijst voorkomt. Dit is inhoudelijk dezelfde categorie fout als sectie 6's
"bug 2" (`Unknown program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`, toen al
geconstateerd) en hoort bij sectie 7's bredere envelope-bevinding: de
`InitializeTransferHook`-CPI die `create_poison_token` zelf bouwt wijkt sowieso af van wat
Token-2022 decodeert (verkeerd aantal accounts, verkeerde opcode, verkeerd dataformaat).

**Correctie op sectie 8:** sectie 8 rapporteerde "✓ create_poison_token succeeded" voor
STAP 4, tegen naar verluidt dezelfde, nog steeds ongewijzigde `instructions.rs` (de
rent-sysvar-diff is vóór het testen apart gecontroleerd en bleek ongewijzigd). Met de
huidige code kon dat succes niet gereproduceerd worden - de aanroep faalt hier
onmiddellijk en deterministisch op een ontbrekend account, geen intermitterend probleem.
**Deze discrepantie is niet verder onderzocht in deze ronde** (buiten de gevraagde scope)
en wordt hier expliciet vermeld in plaats van stilzwijgend genegeerd. Mogelijke, niet-
geverifieerde verklaringen: een orderafhankelijk account-slot-verschil tussen sessies, of
een sectie-8-testrun die per ongeluk tegen een ander (nog niet opgeruimd) wegwerp-adres met
een afwijkende binary liep. Openstaand.

### Diagnostische bypass om de STAP-3-fix ZELF toch te valideren

Om te kunnen zien of de gevraagde volgordefix werkt ONAFHANKELIJK van STAP 4's eigen,
onopgeloste envelope-probleem: een TIJDELIJKE, niet-gecommitte wijziging (STAP 4's
catch-blok liet de test doorlopen i.p.v. `process.exit(1)`, uitsluitend voor déze ene
testrun) - direct erna teruggezet, `git diff` bevestigt dat dit niet is blijven staan.

**Resultaat:**
- **STAP 4b (`InitializeMint2`) slaagt gewoon**, ondanks STAP 4's mislukte CPI - de mint
  was al écht transfer-hook-geïnitialiseerd door STAP 2's EIGEN
  `createInitializeTransferHookInstruction()`-aanroep (de officiële clientbibliotheek-
  functie, niet de kapotte CPI in `instructions.rs`). `create_poison_token` probeert dus
  sowieso hetzelfde nogmaals te doen via een eigen, afwijkende CPI - een aparte designvraag
  (hoort bij sectie 7 punt 3's "authorized_recipients hoort niet in deze instructie"-
  bevinding), niet iets wat vandaag opgelost is.
- **STAP 3 (nu ná STAP 4b) bereikt `InitializeAccount` ZONDER de oorspronkelijke "Invalid
  Mint"/`is_initialized`-byte-0-fout uit sectie 8** - de kern van de gevraagde volgordefix
  is hiermee empirisch bevestigd: dat specifieke probleem is weg.
- **Maar een NIEUWE fout duikt op, eerder gemaskeerd door de volgordefout:**
  ```
  Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]
  Program log: Instruction: InitializeAccount
  Program log: Error: InvalidAccountData
  ```
  Vermoedelijke oorzaak (aannemelijk, niet binnen deze sessie 100% bevestigd):
  `TOKEN_ACCOUNT_LEN = 165` is de klassieke SPL-Token-basisgrootte. Voor een Token-2022-
  mint MET extensies (hier: TransferHook) moeten geassocieerde token-accounts, net als de
  mint zelf (sectie 7/8's `getMintLen`-fix), via de officiële `getAccountLen(...)`-functie
  gedimensioneerd worden (typisch 165 + minimaal 1 AccountType-byte) - niet de kale 165.
  Dit was nooit eerder zichtbaar omdat de STAP-3-volgordefout STAP 3 altijd al eerder
  blokkeerde, vóórdat deze groottevraag ooit aan bod kwam.

### Wat dit wel en niet vaststelt

- **Wel:** de sectie-8-STAP-3-volgordefix werkt zoals bedoeld (de mint moet daadwerkelijk
  geïnitialiseerd zijn vóórdat de token-accounts aangemaakt worden) - bevestigd, zij het
  alleen via de diagnostische bypass hierboven, niet in een normale testrun.
- **Niet:** dat STAP 2 t/m 4 in een NORMALE testrun nu allemaal slagen tot aan de bekende
  envelope-kwestie - STAP 4 zelf faalt al, dus het gevraagde eindresultaat is niet gehaald.
  De envelope-kwestie (sectie 7/9) manifesteert zich hiermee EERDER dan sectie 8 dacht:
  die blokkeert nu al STAP 4 zelf, niet pas de transfer-test in STAP 5.
- **Nieuw gevonden, nog niet gefixt:** `TOKEN_ACCOUNT_LEN` moet vermoedelijk ook via
  `getAccountLen()` herzien worden, analoog aan sectie 7/8's mint-groottefix.
- **Nieuw gevonden, nog niet verklaard:** de discrepantie met sectie 8's "STAP 4 slaagde"
  (zie hierboven) - open vraag.
- Sectie 9's diepere ontwerp voor de envelope-fix blijft de aangewezen vervolgstap om STAP 4
  ooit zonder bypass voorbij te komen.

### Openstaande bevinding: TOKEN_ACCOUNT_LEN - niet gefixt, bewust bewaard voor een volgende ronde

**Bevinding:** `TOKEN_ACCOUNT_LEN = 165` (`tests/activeDefenseFull.ts`) is de klassieke,
handmatig ingevulde SPL-Token-basisgrootte - dezelfde soort handmatige schatting die sectie
7/8 al aan de MINT-kant fout bleek te zijn (`TOKEN_MINT_BASE_LEN + 128`, vervangen door
`getMintLen(...)`). Voor token-accounts onder een Token-2022-mint MET extensies (hier:
TransferHook) is 165 vermoedelijk niet toereikend - Token-2022 accounts hebben in dat geval
minimaal 1 extra AccountType-byte nodig (en eventueel meer, afhankelijk van welke
extensies per-account-state vereisen), analoog aan hoe `getMintLen` de mint-kant al
oplost. Aangetroffen als `InvalidAccountData` bij `InitializeAccount`, alleen zichtbaar
geworden ná de sectie-8-STAP-3-volgordefix (via de diagnostische bypass hierboven) - vóór
die fix blokkeerde de volgordefout (`Invalid Mint`) STAP 3 altijd al eerder, dus deze
groottevraag kwam nooit eerder aan bod.

**Aanbevolen fix (niet vandaag gebouwd, expliciet op verzoek):** `getAccountLen(extensions)`
uit `@solana/spl-token` gebruiken in plaats van de kale `TOKEN_ACCOUNT_LEN`-constante -
zelfde patroon als STAP 2's `getMintLen`-fix uit sectie 7/8: de officiële
bibliotheekfunctie sluit een reken-/afrondingsfout structureel uit, in plaats van
handmatig een extra byte(s) te schatten. Welke `extensions`-array daarvoor precies nodig
is (afhankelijk van wat TransferHook, of een eventuele toekomstige extensie, per account
vereist) is niet onderzocht in deze sessie - dat hoort bij het bouwen van de fix, niet bij
het vastleggen ervan.

**Bewust niet gebouwd vandaag** - alleen vastgelegd als bekende, openstaande bevinding voor
een volgende sessie, op uitdrukkelijk verzoek.

**Niets gecommit.** `git status` toont dezelfde bestanden als vóór deze testrun (plus deze
STATUS.md-sectie); `git diff` op `programs/active-defense/src/lib.rs` en `Anchor.toml`
bevestigd leeg. Het wegwerp-programma (`aE1HJjEra7HwUJ5yb5udBWMcdAGfX36fEpkpxdv7ZdM`) staat
nog live op devnet (zelfde opruimconventie als sectie 5/8: wordt niet actief opgeruimd).

## 11. Route B (kleinere abl-token-gebaseerde herbouw, sectie 9) - Stap 1: de twee nieuwe dependencies toegevoegd, compileert, en sectie 9 punt 5's open vraag beantwoord

**Gevraagd:** i.p.v. eerst `TOKEN_ACCOUNT_LEN` te patchen (sectie 10), doorbouwen op sectie
9's "kleinere eerste-versie-aanpak": `add_authorized_recipient` + `attach_transfer_hook` +
een herbouwde `poison_transfer_hook`, met de officiële `spl-transfer-hook-interface`
(2.1.0) en `spl-tlv-account-resolution` (0.11.2) crates, geen `remove`/modus-schakelaar.
In genummerde stappen, met tussentijdse rapportage, niets committen zonder akkoord per
stap. **Dit is stap 1: alleen de dependencies toevoegen en bevestigen dat het compileert -
nog geen enkele regel programmalogica gewijzigd.**

### Sectie 9 punt 5's open vraag beantwoord: ja, `anchor-spl 1.1.2` ondersteunt de benodigde typed-CPI-helper

Rechtstreeks in de daadwerkelijk gebruikte crate-bron nagekeken
(`~/.cargo/registry/src/.../anchor-spl-1.1.2/src/token_2022_extensions/transfer_hook.rs`,
her-geëxporteerd via `anchor_spl::token_interface::*`): zowel `transfer_hook_initialize`
als `transfer_hook_update` bestaan, met de exacte typed-CPI-signatuur die sectie 9
citeerde. `anchor-spl`'s `default`-features (`token_2022`, `token_2022_extensions`, e.a.)
staan al aan - `programs/active-defense/Cargo.toml` had géén `default-features = false`,
dus dit was al beschikbaar vóór vandaag, alleen nog nooit gebruikt.

### Wat gewijzigd is, in `programs/active-defense/Cargo.toml`

```toml
spl-transfer-hook-interface = "2.1.0"
spl-tlv-account-resolution = "0.11.2"
spl-pod = "=0.7.2"
```

Geen enkele regel Rust-logica aangeraakt - uitsluitend `Cargo.toml`.

### Onderweg gevonden: een echte, bovenstroomse compile-bug (spl-list-view 0.1.0 × spl-pod 0.7.3), niet iets in dit project

Eerste `cargo check` na het toevoegen van de twee nieuwe dependencies **faalde** - niet in
onze eigen code, maar in `spl-list-view v0.1.0` (transitief via
`spl-tlv-account-resolution`):
```
error[E0277]: `?` couldn't convert the error to `ProgramError`
  --> spl-list-view-0.1.0/src/list_view.rs:104:38
  | *view.length = L::try_from(0)?;
  = note: the trait `From<<L as TryFrom<usize>>::Error>` is not implemented for `ProgramError`
```
Dit is een definitiesite-fout in `spl-list-view` zelf (`impl<T: Pod, L: PodLength>
ListView<T, L>` mist een `where`-bound) - onafhankelijk van hoe wij het gebruiken, dus
elk project dat deze exacte versiecombinatie oppikt zou hetzelfde krijgen. Root cause
empirisch geïsoleerd: `spl-pod 0.7.3`'s `PodLength`-implementatie voldoet niet meer aan
wat `spl-list-view 0.1.0` verwacht; `spl-pod 0.7.2` (één patch-versie terug, ook binnen
`spl-tlv-account-resolution`'s eigen `"0.7"`-range) heeft dit probleem niet - bevestigd
door `cargo update -p spl-pod --precise 0.7.2` en daarna opnieuw `cargo check`, twee keer
(vóór en ná), niet aangenomen op één run. Crates.io rechtstreeks bevraagd
(`spl-list-view`'s eigen versielijst): slechts twee versies bestaan (`0.0.0`, `0.1.0`),
geen nieuwere gefixte versie beschikbaar om in plaats daarvan te gebruiken - de enige
werkende uitweg is de `spl-pod`-pin.

**Fix: `spl-pod = "=0.7.2"` als expliciete, directe dependency toegevoegd** (met een
code-comment die de reden vastlegt, zodat een toekomstige `cargo update` niet per ongeluk
weer naar 0.7.3 springt zonder dat iemand begrijpt waarom dat breekt). Dit was nodig omdat
`Cargo.lock` in deze repo NIET onder git staat (bevestigd: staat niet in `.gitignore`, maar
verschijnt als "Untracked" in `git status` - een bestaande, niet vandaag genomen keuze) -
zonder de expliciete pin in `Cargo.toml` zelf zou een verse kloon zonder lockfile alsnog
de kapotte combinatie kunnen oppikken.

### Geverifieerd, niet aangenomen

- `cargo check -p active-defense`: slaagt, met uitsluitend de twee reeds-bestaande,
  ongerelateerde warnings (`unexpected cfg condition value: solana` op de
  `#[program]`-macro, dead-code op `PASSKEYS_OWNER_REVOKED_OFFSET`) - beide al aanwezig
  vóór vandaag, niet door deze wijziging veroorzaakt.
- **Herhaald tegen een volledig verse lockfile** (`rm Cargo.lock && cargo check`) om
  uit te sluiten dat het alleen toevallig werkte dankzij een al-opgeloste lockfile-staat
  van eerder vandaag - slaagt identiek.
- `anchor build` (de daadwerkelijke SBF/on-chain buildtarget, niet alleen de
  host-`cargo check`): slaagt eveneens, `target/deploy/active_defense.so` opnieuw
  gegenereerd (227208 bytes - ongewijzigd t.o.v. vóór deze stap, want er is nog geen
  enkele regel code die de nieuwe crates daadwerkelijk aanroept; dead-code-eliminatie
  verwijdert dus alles ongebruikte).

### Niet gedaan, bewust binnen de scope van "alleen stap 1"

Geen enkele nieuwe accountstructuur, instructie, of wijziging aan `create_poison_token`
zelf. Geen wegwerp-deploy nodig voor deze stap - er is geen nieuwe on-chain-gedrag om te
testen, alleen een build-vraag, en die is beantwoord.

**Niets gecommit.** `git status`: alleen `programs/active-defense/Cargo.toml` (deze stap),
`STATUS.md`, plus de al-bestaande, ongewijzigde diffs uit sectie 6/8/10
(`instructions.rs`, `tests/activeDefenseFull.ts`) en het untracked `Cargo.lock`. Wachten op
akkoord vóór stap 2 (het nieuwe `AuthorizedRecipient`-accounttype + `add_authorized_recipient`).

## 12. Route B, stap 2: AuthorizedRecipient-accounttype + add_authorized_recipient - getest tegen een nieuwe wegwerp-deploy, alle vier deelstappen slagen inclusief het negatieve pad

**Gevraagd:** het nieuwe `AuthorizedRecipient`-accounttype (seeds/velden naar abl-token's
`ABWallet`-patroon, eigen terminologie, `allowed`-veld heroverwegen) + de
`add_authorized_recipient`-instructie bouwen, geïsoleerd testen tegen een wegwerp-deploy,
documenteren als vervolg op sectie 11.

### Vooraf expliciet vastgelegd: waarom hier GEEN worst-case-layoutanalyse

Spankwallet's conventie (elke nieuwe accountwijziging krijgt een worst-case-analyse tegen
bestaande, al-live accounts - zie spankwallet's eigen STATUS.md) is HIER bewust
overgeslagen, met reden, niet per ongeluk: `AuthorizedRecipient` is een compleet NIEUW
accounttype, in een eigen, nieuw PDA-adresruimte (`["poison_authorized", mint, recipient]`)
die nog nooit eerder heeft bestaan. active-defense heeft, in tegenstelling tot
spankwallet, nog geen echte gebruikers of bestaande on-chain-data die door een
layoutwijziging geraakt zouden kunnen worden - elke "wegwerp-deploy" in dit hele project
(sectie 5 e.v.) wordt bewust nooit opgeruimd maar ook nooit als blijvende staat behandeld.
Een worst-case-analyse heeft pas zin zodra er daadwerkelijk bestaande accounts zijn die een
toekomstige wijziging zou kunnen breken - dat moment is nog niet aangebroken. Zodra
active-defense wél live gaat met echte gebruikers, moet deze stap alsnog ingevoerd worden
voor élke volgende accountwijziging (ook aan `AuthorizedRecipient` zelf) - vastgelegd hier
zodat dit later niet als "vergeten" overkomt, maar als een bewuste, tijdelijke keuze die
een duidelijke aanleiding heeft om te veranderen (het moment van eerste echte gebruikers).

### Ontwerpkeuzes

- **Naam:** `AuthorizedRecipient` (niet `ABWallet` - active-defense's eigen terminologie).
- **Geen `allowed: bool`-veld.** abl-token's `ABWallet` heeft dit veld nodig omdat het drie
  standen kent (Allow/Block/Mixed via zijn `Config.mode`) - een `ABWallet` kan dus bestaan
  én toch `allowed: false` zijn (een expliciete blocklist-entry). active-defense kent geen
  block-/mixed-modus - het ontwerp is al permanent "alleen expliciet toegestaan mag
  ontvangen" (bevestigd in sectie 9 punt 4's aanbeveling). Het BESTAAN van de PDA is dus
  zelf voldoende als autorisatie - één veld minder, één minder ding dat uit sync kan raken.
- **Velden: `mint: Pubkey, recipient: Pubkey, bump: u8`.** Beide pubkeys zijn strikt
  genomen al afleidbaar uit de PDA-seeds zelf (zoals abl-token's eigen `ABWallet.wallet`
  dat ook is) - toch opgeslagen, voor dezelfde reden als abl-token: introspectie/tooling
  kan een account lezen en meteen zien waar het bij hoort, zonder eerst de seeds te moeten
  kennen om het adres te reproduceren.
- **Seeds:** `[b"poison_authorized", mint, recipient]` - ongewijzigd t.o.v. sectie 9 punt
  4's aanbevolen tabel (per-mint, per-ontvanger, in tegenstelling tot abl-token's
  `["ab_wallet", wallet]` dat geen mint nodig heeft omdat dat voorbeeld één globale
  Config/modus per programma-instantie kent - active-defense's design is al per-mint).
- **Geen vaste capaciteitslimiet** (in tegenstelling tot het bestaande
  `MAX_POISON_AUTHORIZED = 16`, dat bestond vanwege het oude, éné-groeiende-account-
  ontwerp): elke ontvanger krijgt zijn eigen account, dus er is geen gedeelde array die kan
  volraken. Vastgelegd in `state.rs` als expliciete code-comment.
- **Passkey-gating identiek aan `create_poison_token`/`mark_malicious`** (niet abl-token's
  eenvoudigere `authority: Signer` + `has_one`-patroon): active-defense's eigen, al
  bestaande beveiligingsmodel (elke muterende actie vereist een echte passkey-handtekening
  tegen de spankwallet-`WalletAccount`, met action-nonce-replay-bescherming) weegt hier
  zwaarder dan abl-token's referentiepatroon volgen - dat referentiepatroon heeft geen
  passkeys, dus 1-op-1 overnemen zou active-defense's eigen beveiligingsinvariant
  doorbreken. Domain-string `"add_authorized_recipient"`, payload
  `action_nonce(8) || mint(32) || recipient(32)`.
- **Geen apart foutcode voor "al toegestaan".** Een tweede `add_authorized_recipient`-poging
  voor dezelfde `(mint, recipient)` faalt via Anchor's ingebouwde `init`-constraint
  ("already in use"/`0x0`-achtige AccountAlreadyInitialized-fout), niet via een eigen,
  vriendelijker foutbericht - bewust minimaal gehouden, kan later alsnog toegevoegd worden
  als de UX dat vraagt.

### Wat gebouwd is

- `state.rs`: `AuthorizedRecipient { mint: Pubkey, recipient: Pubkey, bump: u8 }` +
  `LEN = 8 + 32 + 32 + 1 = 73`.
- `instructions.rs`: `AddAuthorizedRecipient`-accounts-struct (`wallet`, optionele
  `passkeys`, `token_mint` (UncheckedAccount, zelfde patroon als `create_poison_token`),
  `authorized_recipient` (`init`, seeds hierboven), `payer`, `instructions_sysvar`,
  `system_program`) + `add_authorized_recipient()`-handler (nonce-check, challenge-bouw,
  passkey-verificatie, dan `mint`/`recipient`/`bump` in de nieuwe PDA schrijven).
- `lib.rs`: `add_authorized_recipient` geregistreerd als publieke instructie.

### Getest tegen een NIEUWE wegwerp-deploy (weer een ander keypair dan sectie 8/10)

Vers keypair (`GKLfjbg4fm4XfP8Td6w8xEUhhx9Qga5t6psuJEXprxKg`). `cargo check` én `anchor
build` (het echte SBF-target) slagen allebei, met alleen de twee al-bestaande,
ongerelateerde warnings. `.so` byte-geverifieerd (nieuw ID 1× rauw aanwezig, echt ID 0×,
`.so`-grootte 254528 bytes - gegroeid t.o.v. sectie 11's 227208, wat klopt: er is nu
daadwerkelijk nieuwe, gelinkte logica). Gedeployed met los fee-payer + eigen
upgrade-authority; `solana program show` bevestigt onafhankelijk: Authority = zichzelf,
Data Length exact gelijk aan het `.so`-bestand. **Na de testrun** `declare_id!`,
`Anchor.toml` én de test se `ACTIVE_DEFENSE_ID` teruggezet naar het echte adres - `git diff`
op `programs/active-defense/src/lib.rs` en `Anchor.toml` bevat NA het terugzetten
uitsluitend de bedoelde `add_authorized_recipient`-registratie, geen spoor van het
wegwerp-ID meer (apart met `grep` op de `declare_id`/`active_defense =`-regels gecontroleerd).

### Nieuw testbestand: `tests/addAuthorizedRecipientIsolated.ts` (geïsoleerd, los van `activeDefenseFull.ts`)

Bewust een NIEUW, eigen script i.p.v. dit in `activeDefenseFull.ts` te proppen - deze stap
test `add_authorized_recipient` volledig los van `create_poison_token`/
`attach_transfer_hook`/`poison_transfer_hook` (die pas in latere stappen komen), dus geen
enkele Token-2022-CPI of echte mint nodig - `token_mint` is een `UncheckedAccount` (zelfde
patroon als `create_poison_token`'s eigen `token_mint`-veld), dus een kale, nooit-op-chain-
gebruikte pubkey volstaat voor de PDA-seed/opgeslagen data.

**Resultaat, alle vier substappen slagen:**
```
STAP A: init_wallet...
  ✓ init_wallet succeeded

STAP B: add_authorized_recipient...
  AuthorizedRecipient PDA: 8ivwgPrq96uAHeWMfwRX8nu6amEquPLLQ1cxzHLWZfck (bump 254)
  ✓ add_authorized_recipient succeeded

STAP C: AuthorizedRecipient-PDA teruglezen...
  Owner: GKLfjbg4fm4XfP8Td6w8xEUhhx9Qga5t6psuJEXprxKg (moet ... zijn)
  Data length: 73 (moet 73 zijn: 8 disc + 32 mint + 32 recipient + 1 bump)
  ✓ alle velden kloppen (mint, recipient, bump) - GEEN 'allowed'-veld, bestaan = autorisatie.

STAP D: NEGATIEF - add_authorized_recipient nogmaals voor dezelfde (mint, recipient)...
  ✓ correct geweigerd (init-constraint, account bestaat al)

✓✓✓ ALLE STAPPEN GESLAAGD ✓✓✓
```

- **STAP C** leest de ruwe accountbytes rechtstreeks terug (niet alleen "geen fout"
  aangenomen) en vergelijkt `mint`/`recipient`/`bump` byte-voor-byte tegen wat verwacht
  werd, inclusief `data.length === 73` (bevestigt dat er inderdaad geen `allowed`-byte
  is meegekomen).
- **STAP D** bewijst dat de `init`-constraint daadwerkelijk een dubbele autorisatie
  voor exact dezelfde `(mint, recipient)` tegenhoudt - relevant omdat "bestaan = autorisatie"
  alleen klopt als er geen stille tweede/overschrijvende creatie mogelijk is.

### Wat dit wel en niet vaststelt

- **Wel:** het nieuwe lijstbeheer-mechanisme (PDA-per-ontvanger, geen `Vec`-in-CPI-data)
  werkt end-to-end op devnet, inclusief het negatieve pad.
- **Niet:** of dit mechanisme daadwerkelijk door een echte transfer-hook-CPI gevonden kan
  worden - dat is precies wat `attach_transfer_hook` (stap 3, `ExtraAccountMetaList` +
  het seed-recept) moet aantonen, nog niet gebouwd.
- **Niet:** `create_poison_token`/`poison_transfer_hook` zijn ONGEWIJZIGD - deze
  bestaan nog naast het nieuwe mechanisme, nog niet vervangen (dat is stap 4/5).

**Niets gecommit.** `git status`: `Cargo.toml` (sectie 11), `state.rs`/`instructions.rs`/
`lib.rs` (deze stap), `STATUS.md`, plus de al-bestaande diffs uit sectie 6/8/10
(`tests/activeDefenseFull.ts`); `Cargo.lock` en het nieuwe
`tests/addAuthorizedRecipientIsolated.ts` untracked. `declare_id!`/`Anchor.toml`
aantoonbaar terug op het echte adres. Wachten op akkoord vóór stap 3
(`attach_transfer_hook`).

## 13. Route B, stap 3: attach_transfer_hook - getest tegen een nieuwe wegwerp-deploy, MET het gevraagde resolutiebewijs tijdens een echte transfer-opbouw

**Gevraagd:** `attach_transfer_hook` bouwen (de ECHTE `InitializeTransferHook`-registratie
+ `ExtraAccountMetaList`-initialisatie, via de typed CPI-helper), met twee expliciete
aandachtspunten: (1) bewijzen dat Token-2022's eigen resolutielogica tijdens een ECHTE
transfer de juiste `AuthorizedRecipient`-PDA vindt zonder dat de client die meegeeft, en
(2) vaststellen of `transfer_hook_initialize` of `transfer_hook_update` hier van
toepassing is.

### Punt 2 eerst beantwoord: `transfer_hook_initialize`, niet `_update` - met harde bron

Rechtstreeks nagekeken in Token-2022's eigen interface-broncode
(`solana-program/token-2022`, `interface/src/extension/transfer_hook/instruction.rs`,
`gh api` opgevraagd, niet aangenomen):
- **`Initialize`**: "Fails if the mint has already been initialized, so must be called
  before `InitializeMint`." Accounts: **1** - `[mint (writable)]`.
- **`Update`**: "Only supported for mints that include the TransferHook extension"
  (vereist dus een VOORAFGAANDE `Initialize`). Accounts: **2** -
  `[mint (writable), authority (signer)]`.

Op het moment dat `attach_transfer_hook` draait heeft de mint (aangemaakt met alleen
`SystemProgram.createAccount` op `getMintLen`-grootte, GEEN client-side
`createInitializeTransferHookInstruction`-aanroep meer - die verantwoordelijkheid
verhuist volledig naar deze nieuwe instructie) nog NOOIT een `InitializeTransferHook`-
aanroep gehad. `Update` zou dus onherroepelijk falen ("extension not found"); `Initialize`
is het enige dat hier kan werken. Ter vergelijking onderzocht: abl-token's eigen
`attach_to_mint.rs` gebruikt wél `transfer_hook_update`, maar rechtstreeks nagekeken
(`mint: Box<InterfaceAccount<'info, Mint>>` - een AL-geïnitialiseerd, deserialiseerbaar
typed Mint-account) blijkt dat instructie bedoeld voor het RETROFITTEN van een mint die
elders AL een `Initialize` had (met een andere/tijdelijke autoriteit) - een ander scenario
dan actief-defense's eigen, verse mint. Geen aanname, een geverifieerd onderscheid.

### `authority: None` - bewust, met reden

Geen `update_transfer_hook`-instructie bestaat (nog). Een niet-lege authority zou een
belofte zijn die nergens op reageert. Bovendien: een spankwallet-PDA (de voor de hand
liggende kandidaat, gezien active-defense's passkey-first-ontwerp) zou hier STRUCTUREEL
nooit kunnen werken als toekomstige CPI-signer - die PDA is afgeleid met SPANKWALLET's
programma-ID, niet active-defense's, dus active-defense kan er nooit een geldige
`invoke_signed` voor produceren (PDA-signing werkt uitsluitend voor het programma waarmee
de PDA zelf is afgeleid). `None` is dus niet alleen eenvoudiger maar ook de enige eerlijke
keuze - geverifieerd in de test (STAP E hieronder: `authority` leest terug als
`PublicKey.default`, geen "dode belofte" die er per ongeluk anders uitziet).

### Wat gebouwd is

- `state.rs`: gedeelde seed-constanten `POISON_AUTHORIZED_SEED`/`EXTRA_ACCOUNT_METAS_SEED`
  - **`AddAuthorizedRecipient`'s bestaande PDA-seeds hierop omgezet** (was een losse
  inline-`b"poison_authorized"`-literal): als deze twee ooit uit sync raken, zou
  `poison_transfer_hook` tijdens een ECHTE transfer een ANDER adres uitrekenen dan
  `add_authorized_recipient` ooit aanmaakte - stil, pas zichtbaar bij een echte transfer.
  Gevonden tijdens het bouwen van deze stap, niet vooraf gepland - een kleine maar
  correctness-kritieke opruiming.
- `instructions.rs`: `get_meta_list_size()`/`get_extra_account_metas()` (naar
  abl-token's `utils.rs`-patroon, hier in `instructions.rs` zelf i.p.v. een nieuw
  bestand - consistent met hoe deze codebase al georganiseerd is). Precies **1** extra
  account (niet abl-token's 2) - active-defense checkt alleen de DESTINATION-owner, niet
  de source (bevestigd tegen `poison_transfer_hook`'s bestaande, ongewijzigde logica).
  Seed-recept: `Seed::Literal(POISON_AUTHORIZED_SEED)` + `Seed::AccountKey { index: 1 }`
  (de mint - staat altijd op index 1 in Execute's standaard-accountlijst, hoeft niet uit
  accountdata gelezen te worden) + `Seed::AccountData { account_index: 2, data_index: 32,
  length: 32 }` (destination-token-account se owner-bytes, index 2).
- `AttachTransferHook`-accounts-struct (`wallet`, optionele `passkeys`, `token_mint`,
  nieuwe `extra_account_meta_list`-PDA (`init`), `payer`, **`token_program: Program<Token2022>`**
  - dit laatste veld is zelf al de structurele fix voor sectie 6/10/11's "Unknown
  program"-bug: Anchor's typed `CpiContext`/CPI-helper-structs nemen het programma-account
  altijd mee in de `invoke()`-aanroep, in tegenstelling tot `create_poison_token`'s
  handmatige `invoke()` die dat account nergens meegaf) + `attach_transfer_hook()`-handler
  (nonce-check, challenge, passkey-verificatie, dan `transfer_hook_initialize` +
  `ExtraAccountMetaList::init`).
- `lib.rs`: `attach_transfer_hook` geregistreerd.
- **CpiContext-detail, tijdens het compileren gevonden:** deze `anchor-lang 1.1.2`-versie
  se `CpiContext::new` verwacht een `Pubkey` als eerste argument (niet een `AccountInfo`
  zoals in oudere Anchor-versies) - het daadwerkelijke programma-account voor `invoke()`
  komt hier via `TransferHookInitialize`'s eigen `token_program_id: AccountInfo`-veld,
  niet via `CpiContext` zelf. Rechtstreeks via de compiler-foutmelding + de crate-bron
  vastgesteld, niet aangenomen.

### Getest tegen een NIEUWE wegwerp-deploy (`DG9w2UvZq32Q7qpsXWwL9mUzPpb8fHbfsbAJYqjXBiDH`)

`cargo check` én `anchor build` slagen, alleen de twee al-bestaande warnings. `.so`
byte-geverifieerd (nieuw ID 1×, echt ID 0×, grootte 291360 bytes - gegroeid t.o.v. sectie
12's 254528, klopt met de nieuw-gelinkte `spl-tlv-account-resolution`/
`spl-transfer-hook-interface`-code). `solana program show` bevestigt onafhankelijk:
Authority = zichzelf, Data Length exact gelijk. **Na de testrun** `declare_id!`,
`Anchor.toml` én BEIDE testbestanden se `ACTIVE_DEFENSE_ID` teruggezet - `git diff` op
`Anchor.toml` leeg, `grep` op `declare_id`/`ACTIVE_DEFENSE_ID = new PublicKey` in alle
testbestanden bevestigt het echte adres overal.

### Nieuw testbestand: `tests/attachTransferHookIsolated.ts` - HET RESOLUTIEBEWIJS (kern van deze stap)

STAP A-F: init_wallet, mint aanmaken (alleen ruimte, geen client-side hook-init meer),
`attach_transfer_hook`, `add_authorized_recipient`, `InitializeMint2`, token-accounts
aanmaken - alles slaagt. Onderweg, **STAP F bevestigt sectie 10's vermoeden met harde
bron**: `getAccountLenForMint()` (die intern `getAccountTypeOfMintType(TransferHook) →
TransferHookAccount` gebruikt, rechtstreeks in `@solana/spl-token`'s eigen broncode
nagekeken) geeft **171** bytes, niet de kale 165 - een mint met de TransferHook-extensie
vereist dus WEL degelijk een extra account-side extensie op elk token-account. Sectie 10's
"vermoedelijke oorzaak, niet 100% bevestigd" is hiermee empirisch bevestigd (in deze
geïsoleerde test, niet in `activeDefenseFull.ts` zelf - dat blijft stap 5, zoals
afgesproken).

**STAP G, de kern - resolutie tijdens een ECHTE transfer-opbouw, met
`createTransferCheckedWithTransferHookInstruction` (`@solana/spl-token`'s EIGEN
clientbibliotheekfunctie, die dezelfde seed-wiskunde gebruikt als Token-2022 zelf
on-chain toepast tijdens een echte transfer):**

```
G1. Transfer naar de AUTHORIZED bestemming - resolutie bouwen...
  Opgelost (derde van achteren):  7UHSRyJQ5zMhb4Tx5aWy242Fadmn2BVjeYqZw2jTLTGt
  Verwacht (add_authorized_recipient's PDA): 7UHSRyJQ5zMhb4Tx5aWy242Fadmn2BVjeYqZw2jTLTGt
  ✓✓✓ DE OPGELOSTE PDA IS EXACT DE AuthorizedRecipient-PDA - de resolutie werkt.

G2. Transfer naar de UNAUTHORIZED bestemming - resolutie bouwen...
  Opgelost:  CLszB8KpR5SKgH6Zq19qoJyazBn9hwZtqgzTciWmyvtF
  Verwacht (nooit aangemaakt, puur PDA-derivatie): CLszB8KpR5SKgH6Zq19qoJyazBn9hwZtqgzTciWmyvtF
  ✓ correct: een ANDER, nooit-aangemaakt adres.

G3. De ECHTE transfer-transactie versturen naar devnet (naar AUTHORIZED)...
  Logs:
    Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]
    Program log: Instruction: TransferChecked
    Program DG9w2UvZq32Q7qpsXWwL9mUzPpb8fHbfsbAJYqjXBiDH invoke [2]
    Program log: AnchorError occurred. Error Code: InstructionFallbackNotFound.
    Error Message: Fallback functions are not supported.
    Program DG9w2UvZq32Q7qpsXWwL9mUzPpb8fHbfsbAJYqjXBiDH failed: custom program error: 0x65
```

- **G1/G2 bewijzen de kern zonder enige twijfel mogelijk te laten:** de bibliotheekfunctie
  krijgt de `AuthorizedRecipient`-PDA NERGENS expliciet aangereikt - hij wordt uitsluitend
  uit het on-chain `ExtraAccountMetaList`-seed-recept + de destination-token-account se
  eigen bytes herberekend, en komt exact overeen met het adres dat
  `add_authorized_recipient` eerder aanmaakte. G2 toont bovendien dat dit puur
  seed-wiskunde is (een ANDER, nooit aangemaakt adres voor de unauthorized-ontvanger),
  niet toevallig gelijk aan iets dat al bestond.
- **G3 bewijst het nog een stap verder: Token-2022 ZELF (niet alleen de clientbibliotheek)
  accepteert deze resolutie.** `invoke [1]` (Token-2022) gevolgd door `invoke [2]`
  (active-defense, ONS EIGEN programma-ID verschijnt in de logs) bewijst dat Token-2022
  de door de client aangeleverde accountlijst tegen zijn EIGEN on-chain-herberekening
  valideerde, geen mismatch vond, en daadwerkelijk CPI'de naar active-defense. De fout
  die daarna optreedt (`InstructionFallbackNotFound`) is Anchor's EIGEN dispatcher in
  active-defense die de Execute-interface's `SPL_DISCRIMINATOR_SLICE` (niet
  `sha256("global:poison_transfer_hook")`) nog niet herkent - exact het verwachte,
  naar stap 4 verwezen gat (`poison_transfer_hook` is in deze stap NOG NIET herbouwd),
  geen fout in stap 3's eigen werk.

### Kernresultaat, in één zin

De `invoke [1]` → `invoke [2]`-regel hierboven ís het bewijs: Token-2022 herberekende het
seed-recept ZELF, vond geen mismatch met wat de client aanleverde, en CPI'de daadwerkelijk
naar `active-defense`'s eigen programma-ID (`DG9w2UvZq32Q7qpsXWwL9mUzPpb8fHbfsbAJYqjXBiDH`,
zichtbaar in de logregel zelf) - de fout die daarna komt (`InstructionFallbackNotFound`,
"Fallback functions are not supported") is UITSLUITEND onze eigen, nog-niet-herbouwde
dispatcher die de Execute-interface se discriminator nog niet herkent. **Het mechanisme
zelf werkt bewezen end-to-end; alleen de laatste stap (poison_transfer_hook als echte
Execute-implementatie) ontbreekt nog.**

### Wat dit wel en niet vaststelt

- **Wel:** het volledige resolutiemechanisme (ExtraAccountMetaList-seed-recept →
  AuthorizedRecipient-PDA) werkt end-to-end tegen een ECHTE Token-2022-transfer op
  devnet, geverifieerd op het niveau van zowel de clientbibliotheek als Token-2022's
  eigen on-chain validatie.
- **Wel:** sectie 10's TOKEN_ACCOUNT_LEN-vermoeden is nu hard bevestigd (171, niet 165).
- **Niet:** een transfer kan nog niet volledig slagen of correct geweigerd worden -
  `poison_transfer_hook` zelf herkent de Execute-instructie nog niet (stap 4).
- **Niet:** `create_poison_token` is nog ongewijzigd, bestaat nog naast het nieuwe
  mechanisme.

**Niets gecommit.** `git status`: `Cargo.toml` (sectie 11), `state.rs`/`instructions.rs`/
`lib.rs` (sectie 12 + deze stap), `STATUS.md`, plus de al-bestaande diff uit sectie 6/8/10
(`tests/activeDefenseFull.ts`); `Cargo.lock` en de twee nieuwe testbestanden
(`tests/addAuthorizedRecipientIsolated.ts`, `tests/attachTransferHookIsolated.ts`)
untracked. `declare_id!`/`Anchor.toml`/beide testbestanden se `ACTIVE_DEFENSE_ID`
aantoonbaar terug op het echte adres. Wachten op akkoord vóór stap 4
(`poison_transfer_hook` herbouwen als echte Execute-interface-implementatie,
`SPL_DISCRIMINATOR_SLICE`).

## 14. Route B, stap 4 (LAATSTE stap van dit deel): poison_transfer_hook herbouwd als echte Execute-interface-implementatie - het VOLLEDIGE mechanisme bewezen end-to-end, toegestaan slaagt, niet-toegestaan faalt met een specifieke foutcode

**Gevraagd:** `poison_transfer_hook` herbouwen met `SPL_DISCRIMINATOR_SLICE` i.p.v. de
zelfverzonnen opcode, autoriseren op bestaan van de `AuthorizedRecipient`-PDA, en - niet
optioneel - een ECHTE end-to-end-test met tweemaal `transferChecked` (toegestaan moet
slagen, niet-toegestaan moet falen met een specifieke foutcode).

### Punt 1: het discriminator-patroon, geverifieerd tegen zowel abl-token als anchor-lang 1.1.2's eigen bron

`gh api` opgevraagd: abl-token's `lib.rs` gebruikt letterlijk
`#[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]`, geplaatst
BOVEN de instructie-functie BINNEN de `#[program]`-module (dus in `lib.rs`, niet in
`instructions.rs`'s losse `impl`-blok). Rechtstreeks in `anchor-syn-1.1.2`'s eigen bron
nagekeken (`src/parser/program/instructions.rs::parse_overrides`,
`src/codegen/program/instruction.rs`) - dit `discriminator`-attribuut op `#[instruction]`
is een ECHT, ondersteund mechanisme in onze eigen anchor-lang-versie (abl-token pint zelf
`anchor-lang = "1.0.2"`, met de comment "interface-instructions feature removed in Anchor
1.0" - bevestigt dat dit sindsdien een kernmechanisme is, geen aparte feature meer).
Toegepast in `lib.rs`, exact hetzelfde patroon.

### Punt 2: de autorisatielogica - Anchor's eigen typed-account-deserialisatie ALS de check

`authorized_recipient` is `Account<'info, AuthorizedRecipient>` (getypeerd, niet
`UncheckedAccount`) met een `seeds`-constraint
(`[POISON_AUTHORIZED_SEED, token_mint.key(), destination_token_account.owner.as_ref()]`).
Geen enkele handmatige `require!`/allowlist-doorzoeking nodig: bestaat de PDA niet (de
destination-owner is niet toegestaan), dan faalt Anchor's eigen accountdeserialisatie AL
vóór de handler-body draait - exact het "bestaan = autorisatie"-ontwerp uit sectie 12, nu
ook in de ENFORCEMENT-kant toegepast, niet alleen de registratiekant.

### Onderweg gevonden: `mut`-constraint-fout op de twee standaard-token-accounts

Eerste testrun faalde met `ConstraintMut` (2000) op `source_token_account` - Token-2022
geeft de 4 standaard-Execute-accounts NIET door met dezelfde writability als de buitenste
`transferChecked`-instructie; empirisch bevestigd dat ze non-writable aankomen in de
Execute-CPI, ongeacht wat de client oorspronkelijk instelde. Dit verklaart met terugwerkende
kracht waarom abl-token's eigen `TxHook`-struct GEEN enkele `mut`-annotatie heeft op de 4
standaardaccounts (aanvankelijk las ik dat als slordigheid, bleek een bewuste/noodzakelijke
keuze). `#[account(mut)]` verwijderd van zowel `source_token_account` als
`destination_token_account` - direct daarna verdween de fout.

### Wat gebouwd is

- `instructions.rs`: `PoisonTransferHook`-accounts-struct herschreven - 6 accounts in de
  exacte Execute-CPI-volgorde (source, mint, destination, owner, ExtraAccountMetaList,
  authorized_recipient). `destination_token_account` getypeerd via
  `token_interface::TokenAccount` (als `TokenInterfaceAccount` geïmporteerd, i.p.v. het
  klassieke `anchor_spl::token::TokenAccount` dat exclusief classic-SPL-Token als owner
  accepteert en op een Token-2022-account zou stukvallen). Handler: `amount: u64`
  (Execute's enige argument), body is nu enkel een bevestigings-`msg!` - alle
  autorisatiewerk gebeurt al in de accountvalidatie.
- `lib.rs`: `spl_discriminator::SplDiscriminate`/`ExecuteInstruction` geïmporteerd,
  `#[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]` op
  `poison_transfer_hook` toegepast, signatuur aangepast naar `amount: u64` (was
  `Vec<Pubkey>`).
- `Cargo.toml`: `spl-discriminator = "0.5.2"` toegevoegd (rechtstreeks nodig voor de
  `SplDiscriminate`-trait, was alleen transitief aanwezig).

### Getest tegen een NIEUWE wegwerp-deploy (`GcximMsnTxhCkmqncLs61rYKCMYHQFzZdPEsPrDPTdZE`)

`cargo check`/`anchor build` slagen. `.so` byte-geverifieerd (nieuw ID 1×, echt ID 0×).
`solana program show` bevestigt Authority = zichzelf. Ná de `mut`-fix opnieuw gebuild,
opnieuw byte-geverifieerd, en met een upgrade (zelfde program-ID, zelfde
upgrade-authority-keypair, los fee-payer voor de transactiekosten) opnieuw gedeployed -
`solana program show` na de upgrade bevestigt een nieuw `Last Deployed In Slot`, Authority
ongewijzigd (zichzelf).

### PUNT 3, HET BESLISSENDE BEWIJS: `tests/poisonTransferHookIsolated.ts`

Volledige flow (STAP A-F, identiek qua opzet aan sectie 13): init_wallet, mint, DE MEEST
ZORGVULDIGE FIX GECONTROLEERD (`add_authorized_recipient` uitsluitend voor
`authorizedOwner`, NOOIT voor `unauthorizedOwner` - de PDA voor die laatste bestaat dus
letterlijk nergens), `InitializeMint2`, token-accounts (via `getAccountLenForMint`, sectie
13's bevinding). Dan STAP G, de kern:

```
G1. ECHTE transfer naar de TOEGESTANE ontvanger (moet SLAGEN)...
  ✓✓✓ TRANSFER GESLAAGD. Signature: 2e9J5QuKjpreXzePRbmrPVyfwBqzc6uDL7hLhKpqrzykECnGmZScLCZEu2TXdf7re8HTwCZwH9qQwXppPbc5U1n3
  Bevestigd on-chain: dest (authorized) saldo = 500000 (moet 500000 zijn)
  ✓ daadwerkelijk on-chain bevestigd, niet alleen 'geen fout'.

G2. ECHTE transfer naar de NIET-toegestane ontvanger (moet FALEN)...
  Logs:
    Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]
    Program log: Instruction: TransferChecked
    Program GcximMsnTxhCkmqncLs61rYKCMYHQFzZdPEsPrDPTdZE invoke [2]
    Program log: Instruction: PoisonTransferHook
    Program log: AnchorError caused by account: authorized_recipient. Error Code: AccountNotInitialized.
    Error Number: 3012. Error Message: The program expected this account to be already initialized.
    Program GcximMsnTxhCkmqncLs61rYKCMYHQFzZdPEsPrDPTdZE failed: custom program error: 0xbc4

  Bevestigd on-chain: dest (unauthorized) saldo = 0 (moet 0 blijven)
  ✓ daadwerkelijk on-chain bevestigd: geen enkele token is verplaatst.

Source-saldo na afloop: 1500000 (moet 2000000 - 500000 = 1500000 zijn)
```

**Waarom dit sluitend bewijs is, niet slechts "de test slaagde":**
- **Discriminator-dispatch bevestigd:** `Program log: Instruction: PoisonTransferHook`
  verschijnt in BEIDE runs - `SPL_DISCRIMINATOR_SLICE` wordt herkend, Anchor routeert
  correct naar de herbouwde handler (niet meer "InstructionFallbackNotFound" zoals sectie
  13's tussenstand).
- **G1 is niet slechts "geen fout" - het EFFECT is apart, on-chain, teruggelezen:** het
  saldo van de bestemmingsaccount is daadwerkelijk 500000, niet aangenomen op basis van een
  succesvolle transactiestatus alleen.
- **G2's foutcode is SPECIFIEK, niet generiek:** `AccountNotInitialized` (3012), exact op
  het `authorized_recipient`-veld - een benoemde, voorspelde faalwijze die rechtstreeks uit
  het ontwerp volgt (PDA bestaat niet -> typed-deserialisatie faalt), geen paniek, geen
  onbegrepen crash, geen off-by-one of account-mismatch-fout die op iets anders zou kunnen
  wijzen.
- **G2's NUL-effect is apart, on-chain, teruggelezen:** het saldo van de (niet-toegestane)
  bestemming is nog steeds exact 0 - de transactie is niet "een beetje" doorgegaan.
  Source-saldo bevestigt onafhankelijk dat precies één van de twee transfers (500000)
  daadwerkelijk heeft plaatsgevonden.
- **Geen enkele handmatige Vec<Pubkey>, geen zelfverzonnen instructie-envelope, geen
  aparte `create_poison_token`-aanroep** was ergens in deze testrun nodig - de volledige
  keten (mint aanmaken -> attach_transfer_hook -> add_authorized_recipient ->
  InitializeMint2 -> een GEWONE `transferChecked`) is wat een echte gebruiker/dApp ook zou
  doen, zonder enige kennis van active-defense's interne PDA-structuur.

### Beantwoording van de twee openstaande vragen (gevraagd bij "wat blijft er over")

**1. Is `create_poison_token` nu overbodig, of moet die aangepast/verwijderd worden?**
**Overbodig EN inmiddels misleidend dood gewicht - aanbevolen: VERWIJDEREN, niet alleen
laten liggen.** Sectie 7/9/13/14 hebben inmiddels drievoudig vastgesteld dat
`create_poison_token`'s eigen `InitializeTransferHook`-CPI structureel verkeerd is
(verkeerd aantal accounts, verkeerde opcode, verkeerd dataformaat) en nooit correct kán
werken zoals hij nu in de broncode staat; `attach_transfer_hook` (stap 3) + de
losstaande `add_authorized_recipient`-PDA's (stap 2) doen nu ALLES wat
`create_poison_token` ooit probeerde te doen, correct. Hem laten staan is niet neutraal:
een toekomstige lezer (of een client die de IDL naïef gebruikt) zou kunnen denken dat dit
nog een werkende, alternatieve activeringsroute is. **Niet vandaag verwijderd** - dat raakt
ook `tests/activeDefenseFull.ts` (STAP 4 roept hem aan) en de bijbehorende
foutcodes/state, dus dat is zelf weer een aparte, af te bakenen stap, geen automatisch
onderdeel van "stap 4 was de laatste stap van Route B" - een aparte beslissing, met een
eigen wegwerp-deploy-test net als alle stappen hiervoor.

**2. Sectie 10's `TOKEN_ACCOUNT_LEN`-bevinding - vanzelf opgelost, of nog openstaand?**
**Nog steeds openstaand IN `tests/activeDefenseFull.ts` zelf** - dat bestand se eigen
`TOKEN_ACCOUNT_LEN = 165`-constante is in geen van de stappen 1 t/m 4 aangeraakt (bewust,
zoals steeds afgesproken: "dat blijft stap 5"). Wat WEL is gebeurd: het vermoeden is nu
DRIEMAAL empirisch bevestigd in de nieuwe, geïsoleerde testbestanden (sectie 13 en deze
sectie) via `getAccountLenForMint()` - elke keer 171 bytes, nooit 165, en elke keer
werkend. De fix zelf (`getAccountLenForMint()` i.p.v. de kale constante) is dus niet
langer een vermoeden maar een herhaaldelijk bewezen patroon - hij hoeft alleen nog
DOORGEVOERD te worden in `activeDefenseFull.ts`, wat vanzelf aan de orde komt zodra
besloten wordt dat bestand bij te werken (samenhangend met vraag 1 hierboven, want een
bijgewerkte `activeDefenseFull.ts` zou toch al `create_poison_token`'s vervanging moeten
verwerken).

**Niets gecommit.** `git status`: `Cargo.toml`/`state.rs`/`instructions.rs`/`lib.rs`
(sectie 11-14 samen), `STATUS.md`, plus de al-bestaande diff uit sectie 6/8/10
(`tests/activeDefenseFull.ts`); `Cargo.lock` en de DRIE nieuwe geïsoleerde testbestanden
(`tests/addAuthorizedRecipientIsolated.ts`, `tests/attachTransferHookIsolated.ts`,
`tests/poisonTransferHookIsolated.ts`) untracked. `declare_id!`/`Anchor.toml`/alle
testbestanden se `ACTIVE_DEFENSE_ID` aantoonbaar terug op het echte adres - `git diff` op
`Anchor.toml` leeg, `grep` over alle testbestanden bevestigt het echte adres overal.
**Onverklaard aangetroffen, niet door mij aangemaakt:** een untracked bestand
`test-transfer-hook-fixed.js` in de repo-root (tijdstempel binnen de sessievensterperiode
van vandaag) - niet aangeraakt, aan de gebruiker gemeld in plaats van stilzwijgend
genegeerd of verwijderd.

**Route B (sectie 9's "kleinere eerste-versie-aanpak") is hiermee, voor het eerste-versie-
mechanisme zelf, VOLTOOID en END-TO-END BEWEZEN.** Openstaand, als aparte, nog te
bespreken vervolgstappen: `create_poison_token` verwijderen, `activeDefenseFull.ts`
bijwerken (TOKEN_ACCOUNT_LEN + de nieuwe activeringsroute), en de al langer bekende,
bewust nog niet aangepakte "directe-aanroep-zonder-echte-transfer"-beperking op de 4
ongetypeerde Execute-standaardaccounts.

## 15. Gedeelde-werkboom-incident: een tweede, gelijktijdige AI-sessie overschreef stap 2-4's werkboom-inhoud - niets verloren, hersteld en opnieuw functioneel bewezen

Zelfde categorie fout als spankwallet's STATUS.md sectie 81 ("Gedeelde werkboom-incident:
twee sessies, één map"), hier in een andere vorm: geen git-rebase/-checkout deze keer, maar
een directe overschrijving van bestandsinhoud, buiten git om.

### Wat er gebeurde, en wanneer ontdekt

Tijdens een geplande afrondingsronde (opgedragen: eerst het onverklaarde bestand
`test-transfer-hook-fixed.js` uitzoeken vóórdat er verder gebouwd werd - precies deze
voorzichtigheid legde het incident bloot vóórdat het schade kon doen aan nieuw werk).
Onderzoek naar dat bestand (aangemaakt binnen de sessie van vandaag, niet door mij) legde
bloot dat:
- `programs/active-defense/src/instructions.rs` **volledig** was teruggezet naar de
  git-HEAD-inhoud (`git diff` toonde NIETS, `wc -l` matchte `git show HEAD:...` exact) -
  alle stap-2/3/4-toevoegingen (`AddAuthorizedRecipient`, `AttachTransferHook`, de
  herbouwde `PoisonTransferHook` met `SPL_DISCRIMINATOR_SLICE`, de bijbehorende imports en
  helperfuncties) waren uit de werkboom verdwenen.
- `programs/active-defense/src/lib.rs` was grotendeels hetzelfde overkomen - alleen
  `declare_id!` week nog af van HEAD, gewezen naar een adres
  (`DXdb6mZZjpC9jAhxRMhJs4yXDseFjFwYpF89RD9fZ9Wk`) dat ik nergens deze sessie gebruikt had.
- Een bestaand, getrackt bestand (`test-verify.js`) was gewijzigd naar datzelfde adres.
- Een nieuw, kapot testbestand (`test-transfer-hook-fixed.js`) was verschenen - onafhankelijk
  beoordeeld (zie hieronder) als een eigen, minder zorgvuldige poging tot hetzelfde
  transfer-hook-probleem, niet gebaseerd op mijn werk.

**`state.rs` en `Cargo.toml` bleven volledig intact** - de overschrijving trof specifiek
`instructions.rs`/`lib.rs`, niet alles wat ik die sessie had aangepast.

### Werkelijke oorzaak, bevestigd vóór er iets hersteld werd

Geen inbraak, geen kwaadaardige actie. Bewijs, verzameld in deze volgorde:
1. `git worktree list`: slechts één worktree - dit was geen tweede branch/checkout-conflict
   zoals spankwallet's sectie 81, dus de oorzaak moest elders liggen.
2. `git log`: HEAD ongewijzigd (`463797d`, dezelfde commit als bij het begin van de sessie)
   - **geen enkele git-operatie was betrokken**; de overschrijving gebeurde uitsluitend in
   de ongecommitte werkboom-inhoud zelf, buiten git om (dus geen rebase, geen checkout, geen
   reset - vermoedelijk een directe bestandsschrijving via een tool).
3. Procestabel: om 14:49 vandaag waren een reeks MCP-serverprocessen gestart
   (`mcp-server-filesystem` met expliciete schrijfscope over `/home/michel/projects`,
   plus `solana-mcp`/`shell-mcp`/`github-mcp`), horend bij een lokaal draaiende LM
   Studio-instantie (eveneens actief in de procestabel) - een tweede, lokale AI-agent-sessie
   met bestands-/shell-/Solana-toegang tot exact deze map.
4. Bestandstijdstempels (mtime/birth-time, `stat`) plaatsten de overschrijving precies
   tussen 14:47:25 en 14:47:40 vandaag - een gecoördineerde, korte schrijfburst over drie
   bestanden tegelijk, consistent met één toolaanroep van die andere sessie.
5. **Inhoudelijke beoordeling van `test-transfer-hook-fixed.js`** (gevraagd vóór verder
   herstel): plain CommonJS (niet TypeScript, andere stijl dan dit hele testcorpus), bevat
   een echte syntaxfout (`TransactionInstruction` twee keer gedestructureerd - dit script
   kan niet eens parsen zoals het er stond), en implementeert een handmatige
   `InitializeTransferHook`-instructie die het `authority`-veld volledig weglaat (dezelfde
   categorie fout als sectie 7's bevinding over `create_poison_token`, hier zelfstandig en
   opnieuw fout opgelost). **Conclusie: een onafhankelijke, minder zorgvuldige poging om
   hetzelfde probleem op te lossen, niet gebaseerd op of bewust van mijn werk.**
6. Vóór herstel apart bevestigd dat de andere sessie niet meer ACTIEF aan het schrijven was:
   geen bestand in de hele repo gewijzigd in de 12+ minuten vóór het herstel begon. (Achteraf
   bleek de andere sessie ná mijn herstel nog kort tweemaal teruggekeerd - 15:25/15:26,
   opnieuw alleen haar EIGEN bestanden, `test-transfer-hook-fixed.js` opnieuw + een nieuw
   `test-transfer-hook-v2.js` - zonder `instructions.rs`/`lib.rs` opnieuw aan te raken. Sinds
   dat moment, gecontroleerd vlak vóór dit herstel: geen enkel bestand in de repo meer
   gewijzigd.)

### Schade, hard gecontroleerd vóór er iets herschreven werd

- **Geen enkele commit was betrokken of verloren** - `git log` toonde dezelfde HEAD voor,
  tijdens, en na het incident. De schade was uitsluitend ongecommitte werkboom-inhoud.
- **Niets was inhoudelijk onherstelbaar**: de volledige, geteste code van stap 2-4 stond nog
  compleet in mijn eigen gespreksgeschiedenis (ik had elke regel zelf geschreven, stap voor
  stap, met tussentijdse compilatie- en devnet-bewijzen) - herstel uit git was NIET mogelijk
  (HEAD is precies de oude, kapotte staat die dit hele traject probeerde te repareren), maar
  herstel uit mijn eigen sessie wél, zonder enig informatieverlies.
- De drie nieuwe, geïsoleerde testbestanden (`addAuthorizedRecipientIsolated.ts`,
  `attachTransferHookIsolated.ts`, `poisonTransferHookIsolated.ts`) en `state.rs`/
  `Cargo.toml` waren nooit geraakt.

### Herstel, in deze volgorde, elke stap bevestigd vóór de volgende

1. Bevestigd dat de andere sessie niet meer actief aan het schrijven was (zie punt 6
   hierboven) vóórdat er iets werd teruggezet.
2. `instructions.rs` en `lib.rs` hersteld door mijn EIGEN, exacte bewerkingsvolgorde van
   stap 2, 3 en 4 letterlijk opnieuw toe te passen op de (naar HEAD teruggezette) bestanden
   - niet door de bestanden in één keer te herschrijven uit het geheugen, om
   transcriptiefouten in de niet-geraakte, langere delen van het bestand uit te sluiten.
   `declare_id!` teruggezet naar het echte adres.
3. **Niet aangenomen dat "de inhoud er weer goed uitziet" voldoende bewijs was.** Volledig
   opnieuw gecompileerd (`cargo check` + `anchor build`, identieke, reeds-bekende warnings),
   een NIEUWE wegwerp-deploy gedaan (`4bL7sZtjM7MnEbWXzQn9fS5xtiaFNRsw8FucKNzS9wto`,
   byte-geverifieerd, authority-geverifieerd), en de volledige G1/G2-beslissende test uit
   sectie 14 opnieuw gedraaid tegen die verse deploy:
   - G1 (toegestane ontvanger): opnieuw ✓✓✓ geslaagd, on-chain saldo opnieuw bevestigd
     (500000).
   - G2 (niet-toegestane ontvanger): opnieuw exact dezelfde, specifieke fout
     (`AnchorError caused by account: authorized_recipient. Error Code:
     AccountNotInitialized. Error Number: 3012`), on-chain saldo opnieuw bevestigd op 0.
   - Functioneel dus BYTE-VOOR-BYTE hetzelfde resultaat als sectie 14's oorspronkelijke
     bewijs - het herstel is niet alleen "compileert weer", maar opnieuw, onafhankelijk,
     end-to-end bewezen.
4. `declare_id!`/`Anchor.toml`/het testbestand se `ACTIVE_DEFENSE_ID` aantoonbaar teruggezet
   naar het echte adres - `git diff` op `Anchor.toml` leeg, `grep` over alle testbestanden
   bevestigt het echte adres overal.
5. `test-verify.js` (door de andere sessie gewijzigd) en de twee nieuwe
   `test-transfer-hook*.js`-bestanden **bewust niet aangeraakt** - dat is niet mijn werk om
   op te ruimen zonder toestemming, en het incident zelf staat hier los van of die bestanden
   ooit weg mogen.

### Structurele conclusie, expliciet zo bedoeld en geen stijlvoorkeur (zelfde als spankwallet sectie 81)

Eén gedeelde working directory voor twee onafhankelijke, gelijktijdige AI-agent-sessies is
hier - net als bij spankwallet, in een andere concrete vorm - geen kwestie van netheid
gebleken maar een aantoonbare bron van dataverlies-risico. Ditmaal geen git-geschiedenis-
herschrijving maar een stille, git-onzichtbare overschrijving van precies de bestanden waar
op dat moment het meeste, meest recent bewezen werk in zat. Dat het deze keer zonder
blijvend verlies afliep, kwam doordat de volledige inhoud toevallig ook in een actieve
gespreksgeschiedenis stond - een omstandigheid waar niet op gerekend zou moeten worden.
**Dezelfde aanbeveling als spankwallet's sectie 81: een aparte `git worktree` (of volledig
gescheiden kloon) per gelijktijdig lopend werkspoor, in plaats van dezelfde working
directory laten delen door meerdere, onafhankelijke AI-agent-sessies** - vooral relevant nu
gebleken is dat ook lokaal draaiende tools buiten Claude Code om (hier: een LM
Studio-agent met filesystem-/shell-MCP-toegang) dezelfde risico's kunnen introduceren als
een tweede Claude Code-sessie.

## 16. Extern onderzoek naar de Token-2022-transfer-hook-architectuur, vóór verdere wijzigingen - vier vragen, alle vier met bron beantwoord

**Gevraagd:** vóór er iets in Route B gewijzigd wordt, extern verifiëren of het gekozen
patroon (ExtraAccountMetaList + Seed::AccountData + PDA-per-item-autorisatie) nog
beveiligingstechnisch en qua actualiteit klopt. Niets gebouwd in deze sectie.

### 1. Bekende beveiligingsproblemen tegen dit patroon

Eén gedocumenteerde, relevante kwetsbaarheidsklasse gevonden: **"ExtraAccountMetaList
account injection"** - een Solana-beveiligingsgids (Zealynx, 2026) waarschuwt letterlijk:
"Failure to strictly validate these seeds allows attackers to inject malicious accounts
(e.g., a spoofed whitelist) to bypass transfer logic."

**Wij zijn hiertegen al beschermd** - niet toevallig: `authorized_recipient` in
`poison_transfer_hook` is getypeerd (`Account<'info, AuthorizedRecipient>`) MET een
expliciete `seeds`-constraint (sectie 14). Een gespoofd account op die positie zou Anchor's
eigen `ConstraintSeeds`-check laten falen vóór de handler-body draait - exact de mitigatie
die de bron voorschrijft.

**Wél een kleine, niet-kritieke hygiëne-lacune gevonden:** dezelfde bron beveelt ook aan de
`ExtraAccountMetaList`-PDA zelf te verifiëren via zijn seeds. `extra_account_meta_list` was
tot nu toe een kale `UncheckedAccount` zonder constraint - onschadelijk zolang de handler de
inhoud nooit leest (nog steeds zo), maar goedkoop dicht te zetten. **Meegenomen in sectie
17 hieronder**, tegelijk met de `create_poison_token`-verwijdering, omdat toch al in
hetzelfde bestand gewerkt wordt.

Geen recursie-risico van toepassing (dat vereist dat de hook zelf een CPI start die
dezelfde mint opnieuw transfereert - `poison_transfer_hook` doet geen enkele CPI). Geen
gepubliceerd, formeel audit-rapport specifiek tegen abl-token of een vergelijkbare
allow/blocklist-hook gevonden.

Bronnen: [Zealynx - Solana Audit Guide 2026](https://www.zealynx.io/research/smart-contracts/solana-2026-security),
[QuillAudits - Solana Token-2022 Guide](https://www.quillaudits.com/research/rwa-development/non-evm-standards/solana-token-2022).

### 2. Nieuwere canonieke versie/opvolger sinds abl-token?

**Nee - abl-token blijft canoniek en wordt actief onderhouden** (laatste commit op de map:
19 augustus 2026, 10 dagen vóór deze sessie). Belangrijker: **PR #672 (12 augustus 2026)
repareerde een ECHTE, community-gevonden kwetsbaarheid in abl-token zelf** -
`get_extra_account_metas()` checkte oorspronkelijk alleen de destination, waardoor een
`blocked`-wallet toch onbeperkt kon verzenden. **Niet van toepassing op active-defense**:
abl-token's Block-modus moet beide richtingen blokkeren, actief-defense heeft geen
"blocked sender"-concept - ons ontwerp checkt bewust alleen wie mag ONTVANGEN (sectie 9),
dus geen gemiste analoge bug.

Sinds 30 juli 2026 bestaat ook `block-list/pinocchio` - een kalere, niet-Anchor
implementatie, geen vervanger maar een nuttig tweede referentiepunt (zie vraag 3). Geen
ander, nieuw canoniek patroon gevonden - `ExtraAccountMetaList` + `Seed::AccountData` +
PDA-per-item blijft de standaardaanpak.

Bronnen: [PR #672](https://github.com/solana-foundation/program-examples/pull/672),
[PR #689](https://github.com/solana-foundation/program-examples/pull/689),
[PR #656](https://github.com/solana-foundation/program-examples/pull/656).

### 3. De directe-aanroep-beperking - een bewezen antwoord: NIET nodig, mits stateless

Token-2022's eigen `spl-token-2022-interface` bevat een `TransferHookAccount`-extensie met
een `transferring: bool`-vlag (`set_transferring`/`unset_transferring` in de bron) - het
officiële mechanisme om te bewijzen dat een hook-aanroep daadwerkelijk uit een echte
transfer komt. **Geen van beide officiële referentie-implementaties gebruikt dit** -
abl-token's `tx_hook.rs` niet, en `block-list/pinocchio`'s `tx_hook.rs` bevat een
EXPLICIETE, becommentarieerde beveiligingsredenering die het bewust weglaat:

> "SECURITY ASSUMPTIONS OVER TX-HOOK: [...] if some other program is calling it, we don't
> care as we don't write state here [...] given all the above we can skip a lot of type and
> owner checks"

**Conclusie, met bron: de `transferring`-check is alleen nodig als een hook STATE SCHRIJFT**
(een teller, een timestamp) die door een directe aanroep vervuild zou kunnen raken.
`poison_transfer_hook` is, net als `block-list/pinocchio`'s hook, **volledig
read-only/stateless** - leest alleen of een PDA bestaat, schrijft nergens naartoe. Een
directe aanroep kan hooguit iemands EIGEN, al-bekende autorisatiestatus tonen - geen
privilege-escalatie, geen state-corruptie, geen invloed op een ECHTE transfer (die Token-
2022 zelf, opnieuw, altijd correct herberekent). **Dit is dus geen "nog niet aan toegekomen"
open punt meer, maar een door de officiële referentie-implementatie bevestigd
ontwerpbesluit: niet nodig zolang de hook stateless blijft** - bewust zo laten staan,
gedocumenteerd, geen halve bescherming bouwen (zoals afgesproken).

Bronnen: [spl-token-2022-interface transfer_hook/mod.rs](https://github.com/solana-program/token-2022/blob/main/program/src/extension/transfer_hook/mod.rs),
[block-list/pinocchio tx_hook.rs](https://github.com/solana-foundation/program-examples/blob/main/tokens/token-2022/transfer-hook/block-list/pinocchio/program/src/instructions/tx_hook.rs),
[QuickNode Transfer Hook guide](https://www.quicknode.com/guides/solana-development/spl-tokens/token-2022/transfer-hooks).

### 4. Zijn onze crate-versies nog actueel? Ja - en de `spl-pod`-pin is STRUCTUREEL, niet tijdelijk

`spl-transfer-hook-interface 2.1.0`/`spl-tlv-account-resolution 0.11.2` zijn beide nog de
nieuwste, niet-yanked crates.io-versies (rechtstreeks bevraagd). Belangrijke nuance,
rechtstreeks relevant voor sectie 11's `spl-pod = "=0.7.2"`-pin:

- `spl-tlv-account-resolution 0.11.2` is pas 26 augustus 2026 gepubliceerd - 3 dagen vóór
  deze sessie. De eigen release-notes tonen dat de maintainers zelf heen en weer
  schoven tussen spl-pod-versies rond exact ons probleem.
- **De daadwerkelijke fix (`solana-program/libraries` PR #191, "list-view: drop spl-pod
  dependency", gemerged 20 maart 2026) is NOOIT als nieuwe crates.io-versie van
  `spl-list-view` gepubliceerd** - die staat nog op `0.1.0` (25 februari 2026), vijf
  maanden vóór de fix. `spl-pod 0.8.0` (de andere kant van deze opruiming) staat bovendien
  **yanked** op crates.io.
- **Vastgelegd, expliciet: onze `spl-pod = "=0.7.2"`-pin is geen tijdelijke workaround maar
  een STRUCTURELE noodzaak, extern bepaald.** Hij blijft nodig totdat `spl-list-view` zelf
  een nieuwe crates.io-release publiceert die PR #191's fix bevat - een extern,
  niet-door-ons-te-beïnvloeden afhankelijkheidspunt (upstream moet publiceren, niet iets
  wij kunnen forceren), GEEN eigen technische schuld. Geen wijziging nodig aan
  `Cargo.toml` - de bestaande pin + code-comment blijven correct en compleet.

Bronnen: [crates.io - spl-transfer-hook-interface](https://crates.io/crates/spl-transfer-hook-interface/versions),
[crates.io - spl-tlv-account-resolution](https://crates.io/crates/spl-tlv-account-resolution/versions),
[PR #191 - list-view: drop spl-pod dependency](https://github.com/solana-program/libraries/pull/191),
[spl-tlv-account-resolution v0.11.2 release notes](https://github.com/solana-program/libraries/releases/tag/tlv-account-resolution%40v0.11.2).

**Niets gebouwd in deze sectie, zoals gevraagd.**

## 17. DEEL 3, stap 1: create_poison_token verwijderd (+ sectie 16 punt 1's hygiëne-lacune meteen meegenomen) - getest tegen een nieuwe wegwerp-deploy

**Gevraagd:** de dode, structureel verkeerde `create_poison_token`-instructie consistent
verwijderen (niet alleen de functie zelf), plus - toevallig al in `instructions.rs` bezig -
sectie 16 punt 1's `extra_account_meta_list`-seeds-hygiëne meteen dichtzetten.

### Hygiëne-fix eerst (sectie 16 punt 1)

`PoisonTransferHook`'s `extra_account_meta_list` had geen enkele constraint. Toegevoegd:
```rust
#[account(
    seeds = [EXTRA_ACCOUNT_METAS_SEED, token_mint.key().as_ref()],
    bump,
)]
pub extra_account_meta_list: UncheckedAccount<'info>,
```
Puur defense-in-depth (sluit de "ExtraAccountMetaList account injection"-klasse uit sectie
16 punt 1 expliciet uit) - de handler leest de inhoud nog steeds nergens.

### Alle plekken gevonden en consistent bijgewerkt

Rechtstreeks doorzocht (`grep -rl`), niet aangenomen welke bestanden geraakt zijn:

- **`instructions.rs`**: `CreatePoisonToken`-struct + `create_poison_token()`-fn volledig
  verwijderd. Bijkomend, tijdens het compileren gevonden en meegenomen: `Instruction`/
  `invoke`-imports (uitsluitend door deze functie gebruikt), en de nu ongebruikte
  `TOKEN_2022_PROGRAM_ID`-constante (rustc's eigen `dead_code`-lint bevestigde dit -
  `pub` binnen een privaat gedeclareerde module is effectief ontoegankelijk van buiten
  de crate, dus écht dood, niet alleen intern ongebruikt).
- **`lib.rs`**: de `create_poison_token`-registratie verwijderd.
- **`state.rs`**: `MAX_POISON_AUTHORIZED` verwijderd (hoorde uitsluitend bij het oude,
  éné-groeiende-account-ontwerp) - de `AuthorizedRecipient`-doc-comment die er nog naar
  verwees, bijgewerkt.
- **`errors.rs`**: `PoisonTokenAuthorizedListEmpty`/`PoisonTokenAuthorizedListFull`
  (uitsluitend gebruikt door `create_poison_token`) én `PoisonTokenUnauthorizedRecipient`
  (al eerder wees geworden toen `poison_transfer_hook` in sectie 14 herbouwd werd, nooit
  opgeruimd) - alle drie verwijderd.
- **`README.md`**: drie inhoudelijke vermeldingen bijgewerkt (statustabel, de
  poison-token-flow-uitleg herschreven naar de echte, huidige 5-stappen-flow, de
  instructietabel, de PDA-tabel uitgebreid met `AuthorizedRecipient`/
  `ExtraAccountMetaList`) + openstaand punt 1 herzien met sectie 16 punt 3's bevinding
  (bewust ontwerpbesluit, niet "nog te doen").
- **`client/src/poisonToken.ts`**: `buildCreatePoisonTokenIx` was al gemarkeerd als
  verouderd/niet-functioneel (sectie 4, vóór vandaag) - een korte "DOUBLY OBSOLETE"-noot
  toegevoegd i.p.v. een volledige herschrijving, want dat blijft een apart, nog niet
  afgebakend vervolgproject (sectie 4/README openstaand punt 3 - was punt 4 tot de
  hernummering toen het toenmalige punt 3, "tests tegen het echte programma", uit de
  lijst werd gehaald na sectie 23).

### Gevonden, buiten scope, NIET aangeraakt - gemeld i.p.v. stilzwijgend genegeerd of zelf beslist

**`tests/activeDefense.ts` roept `create_poison_token` ook aan** (een oudere, kleinere,
zelfstandige testfile - titel verwijst naar "C1/M2/H2"-fixes, kennelijk een vroegere
iteratie van wat later `activeDefenseFull.ts` werd). Niet door de gebruiker genoemd in de
opdracht (die noemde specifiek `instructions.rs`/`lib.rs`/`activeDefenseFull.ts`/
documentatie). Dit bestand is nu ook stuk zodra tegen een programma zonder
`create_poison_token` gedraaid wordt - net als `activeDefenseFull.ts` vóór stap 2 hieronder.
**Bewust niet gewijzigd of verwijderd** - aan de gebruiker om te beslissen (bijwerken zoals
`activeDefenseFull.ts`, of laten vervallen als verouderd).

### Getest tegen een NIEUWE wegwerp-deploy (`GLAcUG66N4eajSffefht46fhC1St2TXHa8c1sMvgNzCD`)

`cargo check` (uitsluitend de al-bekende, ongerelateerde warning over
`PASSKEYS_OWNER_REVOKED_OFFSET` over) en `anchor build` slagen. `.so` **kleiner** dan sectie
14's build (277200 vs 293104 bytes - klopt, dode code verwijderd), byte-geverifieerd (nieuw
ID 1×, echt ID 0×). `solana program show` bevestigt onafhankelijk: Authority = zichzelf,
Data Length exact gelijk.

**Sectie 14's volledige G1/G2-beslissende test opnieuw gedraaid (niet aangenomen dat
verwijdering van ongebruikte code + een nieuwe constraint geen neveneffect zou hebben):**
identiek resultaat - G1 (toegestane ontvanger) slaagt, on-chain saldo 500000 bevestigd; G2
(niet-toegestane ontvanger) faalt met exact dezelfde `AccountNotInitialized`/3012-fout, saldo
blijft 0. De nieuwe `extra_account_meta_list`-seeds-constraint en de verwijdering van
`create_poison_token` hebben dus, zoals verwacht, geen enkele invloed op het bewezen
mechanisme - bevestigd, niet aangenomen.

**Niets gecommit.** `git status`: alle bovenstaande bestanden gewijzigd, plus de
al-bestaande diffs uit eerdere secties; geen nieuwe untracked bestanden deze stap.
`declare_id!`/`Anchor.toml`/alle testbestanden se `ACTIVE_DEFENSE_ID` aantoonbaar terug op
het echte adres - `git diff` op `Anchor.toml` leeg. Wachten op akkoord vóór stap 2
(`tests/activeDefenseFull.ts` bijwerken: `TOKEN_ACCOUNT_LEN` + de nieuwe activeringsroute)
en op een beslissing over `tests/activeDefense.ts`.

## 18. Naar aanleiding van sectie 15's incident: LM Studio's MCP-tools scope-beperkt, spankwallet expliciet uitgesloten

**Gevraagd:** sectie 15's onderliggende oorzaak wegnemen bij de bron, niet alleen het
gevolg herstellen - de tools die konden overschrijven zelf begrenzen, plus het omgekeerde
risico afdekken (dat zo'n tool net zo goed in spankwallet had kunnen schrijven).

### Onderzoek: OS-permissies bieden hier geen echte scheiding (eerlijk, geen schijnoplossing)

Bevestigd: elk relevant proces (deze sessie, LM Studio, alle MCP-servers) draait als
hetzelfde Linux-useraccount (`michel`, uid=1000). `chmod`/`chown` maken onderscheid tussen
gebruikers/groepen, niet tussen applicaties die toevallig hetzelfde account delen - een
permissie die "michel" iets ontzegt, ontzegt mezelf net zo goed. Echte scheiding zou een
apart useraccount of container voor LM Studio vereisen - een grotere herconfiguratie,
bewust niet vandaag doorgevoerd (zie spankwallet's SECURITY.md, nieuwe sectie).

### Gevonden: drie tools met onbeperkte schrijftoegang over heel `/home/michel/projects`, niet één

1. **`file-system-mcp`** (officiële `@modelcontextprotocol/server-filesystem`) -
   geconfigureerd in `~/.lmstudio/mcp.json` mét `/home/michel/projects` (de hele boom) als
   root.
2. **`fs-mcp`** (eigen project, `~/projects/fs-mcp`) - **erger dan de officiële tool**: de
   broncode had een `write_file`-tool zonder énige padrestrictie (alleen `path.resolve()`,
   geen allowlist).
3. **`shell-mcp`** (eigen project) - command-allowlist met bestandsmuterende commando's
   (`cp`, `mv`, `sed`, `git`) en een volledig vrij, aanroeper-bepaald `working_dir`
   (default `/home/michel/projects`).

### Doorgevoerd, elk apart getoond en akkoord gekregen vóór opslaan

**1. `file-system-mcp`:** root `/home/michel/projects` vervangen door
`/home/michel/projects/active-defense` in zowel `~/.lmstudio/mcp.json` als de
gespiegelde `~/.lmstudio/extensions/plugins/mcp/file-system-mcp/mcp-bridge-config.json`
(LM Studio synchroniseert die laatste automatisch zodra de eerste wijzigt - binnen dezelfde
seconde bevestigd via `stat`). Bewust alleen `active-defense` toegevoegd, niet gegokt op
welke van de ~50 andere projectmappen (waaronder spankwallet-afgeleide zoals
`spankwallet-testfixture`/`-audit`) verder nodig zijn.

**2. `fs-mcp`:** een `resolveWithinAllowedRoots()`-containment-check toegevoegd vóór elke
read/write - `path.resolve()` + `fs.realpathSync()` (lost symlinks op, ook in
tussenliggende mappen, en tolereert een nog-niet-bestaand doelpad door omhoog te lopen naar
de dichtstbijzijnde bestaande voorouder) + een trailing-separator-containmentcheck (niet
kwetsbaar voor de "/a/b" vs "/a/bevil"-prefixfout). Faalt CLOSED: weigert te starten zonder
expliciete `FS_MCP_ALLOWED_ROOTS`. **Geverifieerd tegen de ECHTE, herbouwde server (niet
alleen de losstaande logica) via directe JSON-RPC-aanroepen:**
- `../`-padtraversal: geweigerd.
- Symlink die van binnen de toegestane root naar buiten wijst: geweigerd.
- Prefix-collision (toegestane root `.../allowed` getest tegen `.../allowedEVIL`):
  geweigerd.
- Legitiem pad binnen de toegestane root: gewoon gelezen.
- Met de productie-configuratie (`FS_MCP_ALLOWED_ROOTS=.../active-defense`):
  `spankwallet/STATUS.md` geweigerd, `active-defense/STATUS.md` gelezen.
`~/.lmstudio/mcp.json`'s `fs-mcp`-entry kreeg de bijbehorende
`env.FS_MCP_ALLOWED_ROOTS`-waarde (bridge-config wederom automatisch gesynchroniseerd).
**`fs-mcp` heeft geen `.git`** - de code staat er, "committen" is letterlijk niet mogelijk
totdat besloten wordt of dit project alsnog onder versiebeheer komt (aan de gebruiker
voorgelegd, nog geen antwoord).

**3. `shell-mcp`:** dezelfde containment-logica toegepast op `working_dir` (nu verplicht,
geen stille default meer naar `/home/michel/projects`). **`git` bewust uit de
DEFAULT-allowlist gehaald**, niet alleen op de containment-check vertrouwd: `git -C <pad>`/
`--git-dir=`/een `GIT_DIR`-env-var laten een git-aanroep een compleet ander repository
aansturen, ongeacht `cwd` - een containment-check op `working_dir` kan dat niet tegenhouden.
**Eerlijk vastgelegd, niet stilzwijgend genegeerd: dit geldt breder dan alleen git.**
Empirisch bevestigd (zowel vóór als na de fix, met de ECHTE herbouwde server): een
absoluut pad-argument (`cat /pad/buiten/allowed`) negeert `cwd` volledig, ongeacht welke
`working_dir` is opgegeven - dat geldt evengoed voor `cp`/`mv`/`sed -i`, nog steeds
toegestane commando's. De containment-check sluit dus het **default/per-ongeluk-scenario**
uit (geen of een verkeerde `working_dir`), niet een commando dat doelbewust een absoluut pad
mee krijgt - dat vereist argument-parsing (fragiel tegen shell-quoting) of het
apart-useraccount/container-traject, bewust niet vandaag. **Geverifieerd tegen de ECHTE,
herbouwde server:** `working_dir=spankwallet` geweigerd, `working_dir=active-defense`
werkt, `git status` geweigerd (niet meer in de allowlist), ontbrekende `working_dir`
geweigerd, én de bovenstaande restrisico (`cat` met absoluut pad naar
`spankwallet/STATUS.md`, met een geldige `working_dir`) nog steeds aangetoond - bewust niet
verborgen. `ALLOWED_WORKING_DIRS=/home/michel/projects/active-defense` toegevoegd aan
`~/projects/shell-mcp/.env` (dit project laadt via `dotenv`, geen `mcp.json`-env-wijziging
nodig). **Ook geen `.git`** - zelfde openstaande vraag als `fs-mcp`.

**4. Documentatie:** spankwallet's `SECURITY.md` kreeg een nieuwe, doorlopende sectie
("Spankwallet is nooit een schrijfbare doel-map voor iets anders") met verwijzing naar dit
incident én naar spankwallet's eigen sectie-81-precedent; spankwallet's `STATUS.md` kreeg
een korte kruisverwijzende sectie 110 hierheen.

### Wat dit wel en niet oplost

- **Wel:** het feitelijke lek van vandaag (te brede scope naar heel `/home/michel/projects`)
  is bij alle drie de betrokken tools gedicht, elk met een geverifieerde, werkende
  containment-check tegen de ECHTE herbouwde server, niet aangenomen.
- **Niet:** een harde, OS-niveau-garantie - dat vereist het bewust uitgestelde apart-
  useraccount/container-traject. Ook niet: bescherming tegen een commando dat doelbewust
  een absoluut pad buiten de allowlist meekrijgt via `shell-mcp` (eerlijk gedocumenteerd
  als restrisico, geen halve/schijnoplossing gebouwd om dat te verbergen).
- **Openstaand:** akkoord van de gebruiker over `git init` voor `fs-mcp`/`shell-mcp`. De
  al-lopende `file-system-mcp`/`fs-mcp`-serverprocessen hebben de oude, bredere scope nog
  in het geheugen tot LM Studio (of de specifieke MCP-server) herstart wordt.

## 19. DEEL 3, stap 2: client-library `poisonToken.ts` volledig herschreven tegen de Route B 5-instructie-versie — offline geverifieerd (geen devnet)

**Gevraagd:** `client/src/poisonToken.ts` volledig herschrijven tegen het HUIDIGE
programma (Route B, secties 11-17), zodat sectie 4's "verouderd/niet functioneel"-status
opgelost is. De library moet instructies produceren die het actuele programma herkent.

### Wat er mis was (sectie 4, herbevestigd tegen het ACTUELE programma)
De oude library was geschreven tegen een vroegere design-iteratie én was daarna ook nog
achter het Route B-ontwerp komen te staan:
1. Alle Anchor-discriminators waren een sequentieel patroon (`0x11b8c30d`, ...), geen echte
   `sha256("global:<name>")[:8]`.
2. Phantom-instructies `add_poison_authorized`/`remove_poison_authorized` (bestonden nooit
   in het actuele programma).
3. `buildCreatePoisonTokenIx` targette `create_poison_token` — die is in sectie 17
   VERWIJDERD (vervangen door `attach_transfer_hook` + `add_authorized_recipient`).
4. Account-layout gebruikte de oude `poisonTokenPda` (seeds `["poison_token", wallet, mint]`)
   die niet meer bestaat; miste het optionele `passkeys`-account.
5. `readPoisonTokenAccount` las een PDA die niet meer bestaat → altijd null, misleidend.

### Wat er is gebouwd
**Volledige herschrijving van `client/src/poisonToken.ts`:**
- Vier client-facing instructie-builders: `buildAddAuthorizedRecipientIx`,
  `buildAttachTransferHookIx`, `buildMarkMaliciousIx`, `buildUnmarkMaliciousIx`.
- Discriminators DYNAMISCH berekend via `anchorDisc(name)` = `sha256("global:<name>")[:8]`
  — geen gehardcodede bytes die bij een rename stale raken.
- `POISON_TRANSFER_HOOK_DISC` = `sha256("spl-transfer-hook-interface:execute")[:8]`
  = `692565c54bfb661a` (zie hieronder voor de bronverificatie).
- PDA-afleidingen: `deriveAuthorizedRecipientPda`, `deriveExtraAccountMetaListPda`,
  `deriveMaliciousPda` (+ `derivePoisonTokenPda` gemarkeerd `@deprecated`).
- Account-lezen: `readAuthorizedRecipient`, `readMaliciousAddresses`, `readExtraAccountMetas`.
- Passkey-helpers: `generateTestPasskey`, `buildChallenge`, `signChallenge`, `secp256r1Ix`
  (zelfde recept als de geïsoleerde tests).
- High-level: `createMintForPoisonToken` (ALLEEN ruimte reserveren via
  `getMintLen([TransferHook])` — GEEN hook-init, GEEN InitializeMint2) en
  `buildPoisonTransferIx` (Token-2022's EIGEN client-resolutie voor de extra accounts).
- Phantom-instructies én de oude `create_poison_token`-builder verwijderd.

**Nieuw `client/src/verify-poisonToken.ts`:** offline smoke-test (GEEN devnet) die
discriminators, data-layouts, PDA-afleidingen en account-volgorde verifieert tegen het
programma-bron. Draait via `npx ts-node client/src/verify-poisonToken.ts`.

### Sleutelontwerpbeslissingen — geverifieerd tegen BRON, niet aangenomen
1. **Option<passkeys> None-marker:** rechtstreeks gelezen in Anchor 1.1.2's eigen
   `accounts/option.rs`: als de account-key GELIJK is aan het program-ID, dan retourneert
   Anchor `None`; anders `Some(account)`. Dus de None-marker is active-defense's EIGEN
   program-ID — exact wat de geïsoleerde tests al deden (`ACTIVE_DEFENSE_ID` als
   placeholder). Niet aangenomen, uit de bron gelezen.
2. **SPL execute-discriminator:** rechtstreeks gelezen in de bron van
   `spl-transfer-hook-interface` 2.1.0 (cargo-registry):
   `#[derive(SplDiscriminate)] #[discriminator_hash_input("spl-transfer-hook-interface:execute")]`
   → `sha256("spl-transfer-hook-interface:execute")[:8] = 692565c54bfb661a`. NIET de oude,
   zelfverzonnen Anchor-discriminator `ee7abc4b877f4350`. (Eerste gok
   `"spl-transfer-hook:execute"` was fout — de exacte hash-input staat in het attribuut.)
3. **Account-volgorde + data-layout:** rechtstreeks uit
   `programs/active-defense/src/instructions.rs` (de `Accounts`-structs + handler-
   signatures), niet uit de oude library of de tests.

### Bewijs (offline, geen devnet)
- `npx tsc --noEmit client/src/poisonToken.ts` → schoon (geen type-fouten).
- `npx ts-node client/src/verify-poisonToken.ts` → **alle checks geslaagd**:
  - 5 discriminators correct (4 Anchor + 1 SPL execute).
  - 3 PDA-afleidingen correct (AuthorizedRecipient, ExtraAccountMetaList, Malicious).
  - `add_authorized_recipient`: data-length, disc, recipient@8, nonce@40 (u64 LE),
    json_len@48, json@52, 7 accounts, volledige account-volgorde.
  - `attach_transfer_hook`: data-length, disc, nonce@8, json_len@16, json@20, 8 accounts,
    mint(writable), ExtraAccountMetaList-PDA(writable), token_program=Token-2022.
  - `mark_malicious`: data-length, disc, address@8, nonce@40, 6 accounts, malicious-PDA(w).
  - `unmark_malicious`: data-length, disc, address@8, nonce@40, 4 accounts, malicious-PDA(w).

### Wat dit wel en niet vaststelt
- **Wel:** de client-library produceert STRUCTUUREEL correcte instructies tegen het actuele
  programma (discriminators, data-layouts, PDA's, account-volgorde) — offline geverifieerd
  tegen het programma-bron (ground truth).
- **Niet:** dat deze instructies end-to-end op devnet slagen. Dat bewijzen de geïsoleerde
  tests (secties 12/13/14) al voor HETZELFDE layout — maar een dedicated E2E-run die de
  LIBRARY zelf gebruikt (i.p.v. de inline-opbouw in de tests) is nog niet gedraaid. Natuurlijk
  vervolg: één geïsoleerde test refactoren om de library-builders te gebruiken i.p.v. inline-
  opbouw, en zo byte-voor-byte-identiteit bewijzen.

### Gedocumenteerde beperking (in de library-header)
- Er is GEEN remove/close-instructie voor `AuthorizedRecipient`. "Bestaan = autorisatie"
  betekent dat een ontvanger die eenmaal is toegestaan, blijvend toegestaan blijft (de PDA
  kan niet via het programma worden gesloten). Bewust ontwerpbesluit, niet een bug — maar
  wel een revocation-gap die bij productiegebruik meegewogen moet worden.

## 20. Het canonieke devnet-programma geüpgraded naar Route B — bewijs vóór, tijdens en na, functioneel bevestigd tegen het echte adres zelf

**Gevraagd:** vóór welke upgrade dan ook, eerst vaststellen wat er nu op het canonieke
adres (`FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK`) staat en of een upgrade daar iets
kan breken; dan pas, na akkoord, de daadwerkelijke upgrade uitvoeren met volledige
provenance (commit-hash, byte-verificatie tegen alle bekende wegwerpadressen, on-chain-hash-
vergelijking) én een functionele eindtest tegen het echte, geüpgradede adres zelf - geen
wegwerp-deploy meer.

### Vooraf: risico-inventarisatie van het canonieke adres - niets aanwezig, dus niets te breken

Twee onafhankelijke controles, geen van beide aangenomen:
1. **`getProgramAccounts` voor het canonieke adres: `[]` - leeg.** Geen enkel account ooit
   aangemaakt door dit programma (geen `MaliciousAddressesAccount`, niets).
2. **Volledige transactiegeschiedenis gescand (753 transacties sinds het programma
   bestaat, niet een steekproef)** - voor elke transactie gecontroleerd of er een
   instructie is waar de `programIdIndex` daadwerkelijk naar het canonieke adres zelf
   wijst (dus als daadwerkelijk aangeroepen programma, niet alleen genoemd tijdens een
   deploy). **Nul treffers** - geen `create_poison_token`, geen `poison_transfer_hook`,
   geen `mark_malicious`, helemaal niets. De 753 "transacties" bleken bijna volledig
   deploy-/upgrade-plumbing (`SystemProgram`-buffer-writes + `BPFLoaderUpgradeable`-writes/
   upgrades) - dit programma is vaak herbouwd en herdeployed, maar zijn instructies zijn
   nooit daadwerkelijk aangeroepen op dit adres, ooit.

**Conclusie: de upgrade treft een schone lei. Niets kan inert worden of kapotgaan, want er
was niets.**

### Stap 1: build vanuit de gecommitte staat, niet vanuit een wegwerp-worktree

**Eerst gecommit** (was nog volledig ongecommit): `git commit` op `main`,
**`433a0c889ae429ec39bb6d7b760416a85304673a`** - "Route B: replace create_poison_token
with attach_transfer_hook + add_authorized_recipient + rebuilt poison_transfer_hook" (17
bestanden, +6741/-441 regels: het volledige Route B-programma, de herschreven
client-library + smoke-test, de drie geïsoleerde testbestanden, de spankwallet-testfixture-
scripts, en `Cargo.lock` - bewust nu wél meegecommit, want dit vastlegt precies welke
transitieve dependency-versies (met name de `spl-pod`-pin) tot déze exacte binary leidden).
**Bewust NIET meegenomen:** de twee ongereviewde, deels kapotte scripts van het andere-
sessie-incident (`test-transfer-hook-fixed.js`/`-v2.js`), en `test-verify.js` eerst
teruggezet naar het echte adres (stond nog op het incident se vreemde adres).

**Build in een verse, geïsoleerde `git clone`** (niet een worktree, niet de werkboom zelf,
om elke twijfel over per-ongeluk-meegenomen ongecommitte bestanden uit te sluiten):
```
git clone /home/michel/projects/active-defense <scratch>/active-defense-release-build
HEAD: 433a0c889ae429ec39bb6d7b760416a85304673a (bevestigd, git rev-parse)
declare_id! in de bron: FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK (al correct - geen
enkele tijdelijke swap nodig voor deze build, in tegenstelling tot elke eerdere
wegwerp-deploy-ronde)
```
`anchor build` hierin geeft `target/deploy/active_defense.so`: **277200 bytes**,
SHA-256 **`7e79372c7d53f530b3450eb45c540dd87d0fddf72f7fc9a473ff5f211e51835c`**.

### Stap 2: byte-verificatie tegen ALLE bekende adressen, niet alleen "geen echt spankwallet"

```
Canonieke ID: 1× (verwacht 1)
Vier oude wegwerpadressen (2026-08-21/24/25 + nooit-live): elk 0×
Alle acht sessie-wegwerpadressen (stap 1 t/m release-candidate, inclusief het
  vreemde adres uit het andere-sessie-incident): elk 0×
```
Twaalf adressen gecontroleerd, geen enkele aangenomen - alle exact zoals verwacht.

### Stap 3: de daadwerkelijke upgrade

```
solana program deploy <scratch>/.../active_defense.so \
  --program-id FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK \
  --fee-payer ~/.config/solana/id.json \
  --upgrade-authority ~/.config/active-defense/program-keypairs/active-defense-keypair.json
```
Los fee-payer, het ECHTE canonieke upgrade-authority-keypair (bevestigd vooraf:
`solana-keygen pubkey` op dat bestand geeft exact het canonieke adres terug).
**Signature: `3iUnJL5v9abfFkN8RjxVwDxt47Noc1QafHo2se4LdpMjvb4EhfuRiQryU7kxeRvRfCw9puUCKeKEnUyWD8vBGM2a`.**

### Stap 4: onafhankelijke na-verificatie - niet op de deploy-transactie zelf vertrouwd

`solana program show`: Authority nog steeds zichzelf, ProgramData-adres ongewijzigd (een
upgrade behoudt dat adres, in tegenstelling tot een verse deploy), Data Length 277200 -
gelijk aan de lokale build. **`solana program dump` gebruikt om de daadwerkelijke,
live executable rechtstreeks van de keten te halen** (niet de account-data handmatig
geparsed) en de SHA-256 daarvan vergeleken met de lokale build:
```
live (van de chain, via program dump):  7e79372c7d53f530b3450eb45c540dd87d0fddf72f7fc9a473ff5f211e51835c
lokaal (release-build):                 7e79372c7d53f530b3450eb45c540dd87d0fddf72f7fc9a473ff5f211e51835c
diff: IDENTIEK (byte-voor-byte, `diff` bevestigt geen enkel verschil)
```

### Stap 5: functioneel bewijs tegen het ECHTE canonieke adres - geen wegwerp-deploy meer

`tests/poisonTransferHookIsolated.ts` gedraaid zonder enige `declare_id!`/`Anchor.toml`-
aanpassing (`ACTIVE_DEFENSE_ID` stond al op het canonieke adres) - de volledige flow
rechtstreeks tegen het productie-devnet-adres:
```
init_wallet ✓ → mint aanmaken ✓ → attach_transfer_hook ✓ → add_authorized_recipient ✓
→ InitializeMint2 ✓ → token-accounts ✓ → mint tokens ✓

G1. ECHTE transferChecked → TOEGESTANE ontvanger:
    Program FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK invoke [2]   ← het canonieke adres zelf, in de logs
    ✓✓✓ GESLAAGD. Signature: WKFdnawi4eHwhGnN2762gsavx7z1tTSXL9ZpzhR9vVZ7EmpVuFU8bTCC4mWd4kxnvrUt4Lfr24xSN56DeT8jQZJ
    On-chain saldo bevestigd: 500000

G2. ECHTE transferChecked → NIET-toegestane ontvanger:
    Program FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK invoke [2]
    AnchorError: authorized_recipient - AccountNotInitialized (3012)
    On-chain saldo bevestigd: 0 (niets verplaatst)

Source-saldo na afloop: 1500000 - precies één van de twee transfers ging door
```
De `Program FzeAZmQz...invoke [2]`-logregel in beide gevallen is het onweerlegbare bewijs
dat dit tegen het ECHTE, geüpgradede canonieke programma liep, niet tegen een
wegwerp-adres.

### Eindstand

**Het canonieke devnet-programma draait nu Route B, bewezen op alle niveaus: schone
lei vooraf, exacte source-provenance (commit-hash), byte-verificatie tegen elk bekend
wegwerpadres, on-chain-hash-identiek aan de lokale build, én functioneel bewezen met een
ECHTE transfer die slaagt naar een toegestane ontvanger en faalt naar een niet-toegestane -
tegen het echte adres zelf, niet een wegwerp-kopie ervan.**

Openstaand, ongewijzigd door deze upgrade: `tests/activeDefenseFull.ts` (STAP 4 roept nog
de nu-verwijderde `create_poison_token` aan, `TOKEN_ACCOUNT_LEN` is nog de kale 165 -
sectie-16/17-vervolg) en `tests/activeDefense.ts` (bewust nog niet gemarkeerd of
verwijderd - vervolgstap).

## 21. Uitgezocht vóór verder gebouwd werd: geen verloren werk in `activeDefenseFull.ts`, wel een te vermijden verwarring

**Aanleiding:** de indruk dat `TOKEN_ACCOUNT_LEN`→`getAccountLenForMint()` plus de nieuwe
`attach_transfer_hook`/`add_authorized_recipient`-route al eerder in déze sessie gebouwd
en met succes end-to-end getest waren tegen `tests/activeDefenseFull.ts` specifiek - terwijl
sectie 20 dat bestand nog als openstaand, in de oude staat, noemt.

**Onderzoek, twee vragen, beide met bewijs beantwoord:**
1. `git log --oneline -- tests/activeDefenseFull.ts`: slechts drie commits ooit
   (`d33e4b2` initieel, `463797d`/`4bc45eb` de sectie-8/10-fix, en het zojuist gemaakte
   `433a0c8`). `git log -p` op al deze commits: **geen enkele bevat
   `getAccountLenForMint()`, `attach_transfer_hook`, of `add_authorized_recipient`
   toegepast op dit bestand** - die termen komen alleen voor in `433a0c8`'s eigen
   commit-boodschap, waar ze expliciet worden genoemd als NIET meegenomen voor dit
   bestand. `git stash list` (leeg) en `git reflog` (geen orphaned commits) bevestigen
   verder dat er nergens iets is blijven hangen dat had moeten committen.
2. `433a0c8` (de bron van sectie 20's upgrade) - het antwoord staat al in die commit se
   eigen boodschap, door mijzelf op het moment van committen geschreven: *"Not included:
   tests/activeDefenseFull.ts's own STAP 4 still calls the now-removed
   create_poison_token, and its TOKEN_ACCOUNT_LEN constant is still the legacy 165-byte
   SPL-Token size."*

**Conclusie: dit is GEEN herhaling van het LM Studio-incident (sectie 15) - geen
bewezen werk is hier verloren gegaan, want het is nooit geschreven.** Wat wél waar is,
en vermoedelijk de bron van de indruk: het `getAccountLenForMint()`-patroon en de nieuwe
route zijn **driemaal bewezen** (secties 10, 13, 14) - maar telkens in een **apart,
doelgericht geïsoleerd testbestand** (`attachTransferHookIsolated.ts`,
`poisonTransferHookIsolated.ts`), nooit in `activeDefenseFull.ts` zelf. STAP B (deze
precieze taak) werd aangevraagd, liep direct tegen de canonieke-programma-blokkade aan,
en het traject boog af naar de release-candidate-verificatie en de upgrade vóórdat de
daadwerkelijke code-wijziging voor dit bestand ooit geschreven werd. Elke sectie sindsdien
(14, 16, 17, 20) noemt het consequent en correct als "openstaand" - nooit als "gedaan".

**Les, iets anders dan bij sectie 15 maar wel de moeite van het vastleggen waard: als
eenzelfde bewezen patroon herhaaldelijk in ISOLATIE wordt aangetoond zonder ooit op de
uiteindelijke doellocatie te worden toegepast, kan de herhaalde bevestiging zelf de indruk
wekken dat de doellocatie ook al is bijgewerkt.** Geen structurele maatregel nodig zoals
bij sectie 15 (geen technisch risico, alleen een boekhoudkundige valkuil) - vooral een
reden om, zoals hieronder, de fix nu daadwerkelijk op de doellocatie toe te passen en
meteen te committen zodra hij slaagt, in plaats van de bevestiging in geïsoleerde
testbestanden te laten gelden als "klaar".

## 22. `tests/activeDefenseFull.ts` daadwerkelijk bijgewerkt naar Route B — geslaagd tegen beide permanente fixtures

**Vervolg op sectie 20/21:** nu sectie 21 bevestigd had dat dit bestand nooit eerder was
bijgewerkt, is de al driemaal (secties 10, 13, 14) bewezen route hier voor het eerst
daadwerkelijk toegepast — geen nieuw ontwerp, alleen het bekende patroon overgezet naar
deze specifieke, permanente-testfixture-gebaseerde E2E-test.

**Wijzigingen in `tests/activeDefenseFull.ts`:**
- Imports: `createInitializeTransferHookInstruction`/`createTransferInstruction`
  verwijderd; `createTransferCheckedWithTransferHookInstruction`, `getAccount`,
  `getAccountLenForMint`, `getMint` toegevoegd.
- `TOKEN_ACCOUNT_LEN = 165` en de dode `borshVecPubkey()`-helper verwijderd.
- STAP 2: mint wordt nu alleen met ruimte aangemaakt (`getMintLen`) — GEEN
  client-side `InitializeTransferHook` meer; die registratie gebeurt pas in STAP 4.
- STAP 4 (was `create_poison_token`, structureel kapot — sectie 7/17): vervangen door
  `attach_transfer_hook` (echte `InitializeTransferHook` + `ExtraAccountMetaList`,
  seeds `["extra-account-metas", mint]`).
- Nieuwe STAP 4a: `add_authorized_recipient` voor `authorizedOwner` (seeds
  `["poison_authorized", mint, recipient]`) — `unauthorizedOwner` krijgt bewust geen PDA.
- STAP 4b (`InitializeMint2`, allerlaatste stap) ongewijzigd, nu ná 4a.
- STAP 3: `TOKEN_ACCOUNT_LEN` vervangen door `getAccountLenForMint(await getMint(...))`
  — bevestigd 171 bytes i.p.v. de kale 165 (zie logregel hieronder).
- STAP 5: beide `createTransferInstruction`-aanroepen vervangen door ECHTE
  `createTransferCheckedWithTransferHookInstruction` (client-side auto-resolutie van de
  extra accounts); foutdetectie nu op `AccountNotInitialized`/3012 i.p.v. het oude,
  te brede "PoisonToken"/"0x"-stringmatch; on-chain balance-verificatie toegevoegd voor
  zowel de geblokkeerde als de toegestane transfer (niet alleen tx-succes/-falen).
- RESULTAAT-sectie: labels bijgewerkt (C1/M2/H1/M2/H2 uit het oude ontwerp vervangen
  door beschrijvingen die kloppen met Route B).

**Testresultaat** (`npx ts-node tests/activeDefenseFull.ts`, tegen de al-permanente
fixtures — geen wegwerp-deploy, geen `declare_id!`/`Anchor.toml`-wijziging nodig):
spankwallet-testfixture (`BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk`, geen env var
gezet dus de default) én het canonieke, sinds sectie 20 geüpgradede active-defense-
programma (`FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK` — dit bestand kent geen
throwaway-override voor active-defense). Alle stappen slaagden:
- `init_wallet`, `attach_transfer_hook`, `add_authorized_recipient`, `InitializeMint2`
  allemaal geslaagd.
- `accountLen: 171` bevestigd via `getAccountLenForMint` (niet 165).
- Echte `transferChecked` naar unauthorized: geblokkeerd met `AccountNotInitialized`
  op de niet-bestaande `AuthorizedRecipient`-PDA; balance-check bevestigt 0.
- Echte `transferChecked` naar authorized: geslaagd; balance-check bevestigt 500000.
- Eindresultaat: `✓✓✓ TEST PASSED — ALLE STAPPEN GROEN ✓✓✓`.

**Direct gecommit na slagen** (op expliciet verzoek, in afwijking van het gebruikelijke
"vraag eerst"-patroon in deze sessie). `tests/activeDefense.ts` (STAP C, nog niet
gemarkeerd als bewust stale) blijft het enige nog openstaande punt uit sectie 17/20.

## 23. Permanente SpankWallet Testfixture (2026-08-29)

**Doel:** Active Defense volledig isoleren van het echte SpankWallet-programma (`9ma6vQVA71...`) door een gepinde, geïsoleerde kloon te gebruiken als testfixture. Hierdoor kan onafhankelijk gewerkt en getest worden zonder productietraffic of afhankelijkheid van SpankWallet's live status.

**Opzet (herhaalbaar):**
1. `git clone` van SpankWallet naar `~/.config/active-defense/testfixture/spankwallet-src/` (geïsoleerd, eigen `.git`-map — geen `git worktree add`).
2. Gepind op commit `1fb3134` (de B1-B7-referentie).
3. Throwaway-keypair: `~/.config/active-defense/testfixture/spankwallet-throwaway-keypair.json` → program-ID `BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk`.
4. `declare_id!` aangepast, `idl-build` feature toegevoegd.
5. `anchor build` → `target/deploy/spankwallet.so` (552280 bytes).
6. Byte-verificatie: throwaway-ID exact **1×** rauw in het .so, echte SpankWallet-ID **0×**.
7. Deploy naar devnet met los fee-payer (`~/.config/solana/id.json`) + expliciete upgrade-authority (throwaway-keypair zelf).
   → signature `dKxm1ynmq6PbZNH9NmE7VCT7XeE3LcsbjB69WNZG5s9cDAM4EPe38iH5t9QNJX2bm1t66fnVRdpaXzMBbWc3irH`

**Geverifieerd (`solana program show BUtmiNmq...`):**
- Owner: BPFLoaderUpgradeable (correct upgradeable)
- Authority: `BUtmiNmq...` (zichzelf = throwaway-keypair, **geen** spankwallet-id.json)
- Data Length: 552280 bytes (exact match met het .so)

**Test-koppeling:** beide testbestanden lezen nu `SPANKWALLET_TEST_PROGRAM_ID` (default `BUtmiNmq...`) en weigeren via een blocklist op:
- Het echte spankwallet (`9ma6vQVA71...`)
- De vier oude active-defense wegwerpadressen (G1D5ckPj..., DGaTtEj3..., 8vPFH4YY..., 9W3CGKhd...)

**Voor/na-verificatie:** SpankWallet's `.git/worktrees/` en werkboom-bestanden (`git status`) zijn onveranderd — geen enkel schrijfmoment naar SpankWallet's eigen repository-administratie.

**Schoonmaken (wanneer de fixture niet meer nodig is):**
`rm -rf ~/.config/active-defense/testfixture/spankwallet-src/` + het throwaway-programma op devnet laten verouderen (of upgraden naar een leeg .so).

## 24. Lokale werkboom en GitHub gesynchroniseerd (merge 418935d) — divergentie, conflictresolutie, bevindingen uit de sync-sessie

**Gevraagd:** stap 1 van de afgesproken volgorde — lokaal en GitHub synchroniseren tot één
consistente geschiedenis.

### De divergentie, vastgesteld vóórdat er iets werd samengevoegd

Sinds `463797d` (het laatste gemeenschappelijke commit) hadden beide kanten eigen commits:
- **Lokaal:** `433a0c8` (Route B: programma + client-library + tests + testfixture-scripts,
  17 bestanden), `1048236` (STATUS.md sectie 20: canonieke upgrade), `ed389c1`
  (`activeDefenseFull.ts` naar Route B + STATUS.md secties 21/22).
- **GitHub:** `385150d` + `0197f78` (de spankwallet-testfixture-bestanden + een
  STATUS.md-sectie, via de GitHub-API en niet via deze kloon) en `ca379df`
  (Route B-programma — maar ONVOLLEDIG: alleen `Cargo.toml`/`errors.rs`/`lib.rs`/`state.rs`,
  ZONDER `instructions.rs`).

**Gevolg vóór de merge: GitHub main compileerde niet** — de nieuwe `lib.rs` (5 instructies)
verwees naar handlers (`add_authorized_recipient`, `attach_transfer_hook`) die in de oude,
nog op GitHub staande `instructions.rs` niet bestaan. De vier `ca379df`-bestanden waren
byte-identiek aan de lokale versies (gecontroleerd, niet aangenomen), dus voor die bestanden
was de merge triviaal; de echte conflicten zaten in `STATUS.md` en de drie
testfixture-bestanden.

### Conflicten en resolutie (merge-commit `418935d`)

- **`STATUS.md` (content-conflict):** één conflictregio — de lokale kant had secties 6-22
  (plus de uitbreiding van sectie 5), de GitHub-kant eindigde na sectie 5. Resolutie: lokale
  inhoud behouden; de GitHub-kant se enige eigen wijziging (de header-regel "Laatst
  bijgewerkt") werd door git automatisch meegenomen.
- **`spankwallet-testfixture/*` (add/add, drie bestanden):** beide kanten hadden dezelfde
  bestanden toegevoegd; het enige verschil was een afwezig trailing newline in de
  API-gepushde versie. Resolutie: lokale versie (met newline) behouden.
- **Niet meegenomen in de merge-commit:** de op dat moment ongecommitte "BEWUST STALE"-header
  die een tweede, gelijktijdige sessie aan `tests/activeDefense.ts` toevoegde (werkboom-WIP,
  mtime tussen het starten van de merge en het commit ervan) — bewust niet geadopteerd,
  blijft in de werkboom voor die sessie.

### Sectienummering gerepareerd

De permanente-testfixture-sectie (toegevoegd op 2026-08-29 via een andere sessie dan de
overige secties) stond als "sectie 6" vóór sectie 5 en botste op de reeds bestaande
"sectie 6" (STAP2-FIX). Verplaatst naar het einde van het bestand als **sectie 23** — geen
enkele kruisverwijzing raakt: geen ander bestand of sectie verwees naar het oude nummer
(grep over de hele repo; de negen bestaande "sectie 6"-vermeldingen in dit bestand horen
allemaal bij de STAP2-FIX-sectie). De header-regel verwijst nu naar sectie 23.

### Bevindingen uit deze sessie (onafhankelijk van de merge zelf)

1. **Upgradeable-program-account-layout, geverifieerd tegen bron én referentie:** de 36 bytes
   zijn `[u32 bincode-variant-tag][ProgramData-adres(32)]` — de tag is `2` (het
   `Program`-variant), géén slot. Geverifieerd op twee manieren: (a) Token-2022 zelf als
   referentieprogramma (zelfde layout; het uit bytes 4..36 afgeleide adres bestaat
   daadwerkelijk als ProgramData-account), en (b) `solana-loader-v3-interface` se eigen
   size-constanten (`size_of_program() = 36` = 4 + 32; alle vier de state-varianten tonen
   een consistente +3-offset t.o.v. standaard bincode, wat exact op een u32-tag i.p.v. een
   u8-tag wijst).
2. **ProgramData-accountgrootte = 45 bytes metadata + programlengte**
   (`size_of_programdata_metadata() = 45`). Gemeten: het canonieke programma se ProgramData
   is 277245 bytes = 45 + 277200 — exact sectie 20 se buildgrootte. Eén eerdere meting
   (236133) was een transient RPC-artifact (hetzelfde account leverde vlak daarvoor tweemaal
   `null` via dezelfde endpoint); de huidige waarde is via confirmed én finalized
   bevestigd.
3. **Tweede functionele testrun tegen het canonieke adres** (na sectie 20 se upgrade):
   `AttachTransferHook` → `AddAuthorizedRecipient` → `TransferChecked` met
   `POISON_TRANSFER_ALLOWED` in de logs (slots 490357891-490357958) — uitgevoerd door de
   parallelle sessie, hier onafhankelijk geverifieerd via de transactielogs.

### Eindstand na deze stap

Lokaal en GitHub staan weer op dezelfde commit (na de push die op dit commit volgt).
Openstaand, ongewijzigd: `tests/activeDefense.ts` (de "BEWUST STALE"-header is werkboom-WIP
van de parallelle sessie; het daarin gegeven advies — verwijderen — is een gebruikerbeslissing),
de twee incident-bestanden `test-transfer-hook-{fixed,v2}.js` (sectie 15, nog steeds
ontracked), en de dedicated E2E-run die de client-library se eigen builders gebruikt i.p.v.
inline-opbouw (sectie 19 se "natuurlijk vervolg").

## 25. Cleanup-ruis: activeDefense.ts + incident-scripts verwijderd, README-bomen bijgewerkt (2026-08-30)

Na de sync (sectie 24) de overgebleven "wat te doen hiermee?"-punten afgehandeld:

- **`tests/activeDefense.ts` verwijderd** (niet gemarkeerd, niet aangehouden): het testte
  het volledig verwijderde oude ontwerp (`create_poison_token`, `Vec<Pubkey>`-recipients)
  en faalde daardoor op-chain deterministisch met cryptische fouten;
  `activeDefenseFull.ts` dekt dezelfde flow en meer (echte `transferChecked`, on-chain
  balance-verificatie). De door een parallelle sessie toegevoegde "BEWUST STALE"-header
  adviseerde expliciet *verwijderen* i.p.v. een levend bestand met alleen een waarschuwing
  — git-geschiedenis is de historische referentie. Consistent met de behandeling van
  `create_poison_token` zelf: vervangen → verwijderd.
- **`test-transfer-hook-{fixed,v2}.js` verwijderd** (de twee ontracked incident-scripts uit
  sectie 15), bekeken vóór verwijdering: beide targetten het wegwerpadres `DXdb6mZZ...`
  van dat incident en belichaamden exact de bugs die later correct werden gedocumenteerd
  — v1: handgemaakte hook-envelope in het kapotte oude formaat (opcode + rent-sysvar +
  kale `MINT_SIZE`), v2: `InitializeMint2` vóór `InitializeTransferHook` (de
  volgordefout uit secties 7/8) plus 165-byte token-accounts (sectie 10). Eenmalig
  diagnostisch, niet opnieuw bruikbaar; het incident zelf staat volledig in sectie 15.
- **README.md's bestandstructuur-blok bijgewerkt**: op meerdere punten verouderd
  (`poisonToken.ts` nog gemarkeerd "VEROUDERD — zie §4" ondanks sectie 19's herschrijving,
  de drie nieuwe isolated-tests en `spankwallet-testfixture/` ontbraken, inmiddels
  verwijderde bestanden stonden er nog in).

Commit: `57d18d6`. Werkboom daarna volledig schoon (geen untracked, geen uncommitted).

## 26. Client-library E2E: poisonToken.ts bewezen on-chain via haar eigen publieke API (2026-08-30)

Sectie 19's "natuurlijk vervolg" is af: nieuwe test `tests/clientLibraryE2E.ts`
draait de volledige Route B-flow (init_wallet → mint → attach_transfer_hook →
add_authorized_recipient → InitializeMint2 → token-accounts → mint → transfers)
waarbij ALLES wat de library `client/src/poisonToken.ts` dekt via haar EIGEN
publieke exports loopt — passkey-flow (generateTestPasskey/buildChallenge/
signChallenge/secp256r1Ix), createMintForPoisonToken + POISON_MINT_LEN,
buildAttachTransferHookIx, buildAddAuthorizedRecipientIx,
deriveAuthorizedRecipientPda, buildPoisonTransferIx, readAuthorizedRecipient.
Alleen wat buiten de library's scope valt (spankwallet's init_wallet, de
action-nonce-lees, Token-2022's eigen client) blijft inline.

**Ontwerpkeuze:** nieuw testbestand i.p.v. activeDefenseFull.ts wijzigen — die
blijft de ongewijzigde, bewezen baseline (sectie 22). Als activeDefenseFull
slaagt en deze faalt, zit de bug in de library, niet in de flow.

**Resultaat: volledig groen** tegen het canonieke programma (FzeAZmQz..., Route
B) + spankwallet-testfixture (BUtmiNmq...): unauthorized transfer geblokkeerd
(AccountNotInitialized op de AuthorizedRecipient-PDA, destination-balance 0),
authorized transfer geslaagd (destination-balance 500.000 van 1.000.000,
decimals 6), readAuthorizedRecipient bevestigt on-chain (authorized → record
met correcte mint+recipient, unauthorized → null). Referentie: wallet PDA
`4du1oNgBUucjPCtmknBf6MoDVerMmGv29AeKUqLsqjhN`, mint
`3BoCwUFf1kT1QN9wge7DurMZtsnU3An72Vgi7UJ3AwGH`, AuthorizedRecipient-PDA
`F9Zz1NMaqpgCUETsgi8iNNGyBKvupqajLFv18kv7vXwG`.

Drie dingen die deze test opspoorde en die meegedefinieerd zijn:

1. **Latente bug in `createMintForPoisonToken` (library-fix)**: de helper bakte
   de createAccount-instructie met `lamports: 0` al geserialiseerd en had de
   comment "zet door caller" — onmogelijk, want instructie-data is direct
   geserialiseerd en niet meer aanpasbaar. Niets in de repo gebruikte de helper
   on-chain, dus de latente bug was nooit opgespoord. Fix: nieuwe signatuur
   `createMintForPoisonToken(payer, mintRentLamports)` + nieuwe export
   `POISON_MINT_LEN` (= 234, getMintLen([TransferHook])), zodat de caller eerst
   de rent kan berekenen en dan de helper aanroept. De offline smoke-test
   (verify-poisonToken.ts) is met een checkblok voor deze helper uitgebreid
   (o.a. lamports ≠ 0, space = POISON_MINT_LEN, owner = Token-2022).
2. **Spankwallet-challenge-encoding (nu gedocumenteerd)**: de init_wallet-
   challenge-payload gebruikt een FIXED-width 9-byte encoding voor het
   Optional<i64>-challenge-veld — NIET de variabele Borsh-Option (1 byte bij
   None) die de instructie-DATA gebruikt. Verwarden → WebAuthnChallengeMismatch
   (6002); de eerste E2E-run is hier tegenaan gelopen. encodeOptionalI64Challenge
   (bestond al in activeDefenseFull.ts) staat nu met uitleg ook in de nieuwe
   test.
3. **`test/verify-deployment.ts` was stale (oud design)**: importeerde
   `readPoisonTokenAccount` (verwijderd bij sectie 19's herschrijving) → het
   project-brede `tsc --noEmit` was rood. Bijgewerkt naar Route B: TEST 2
   deelt AuthorizedRecipient/ExtraAccountMetaList/Malicious-PDA's af, TEST 3
   leest readAuthorizedRecipient (null verwacht voor een niet-bestaand paar).
   Het bestand blijft groen (program LIVE, alle lees correct) en de
   project-typecheck is nu schoon.

## 27. Dependabot/npm-audit kwetsbaarheden: afgehakt wat fixbaar is, restant gedocumenteerd (2026-08-30)

De gebruiker vroeg om de Dependabot-kwetsbaarheden te bekijken (push-output:
"4 vulnerabilities: 2 high, 2 moderate"). `npm audit` op de lokale tree
ligt meer: **12 (4 high, 8 moderate)** — Dependabot telt per
root-cause-pakket in zijn eigen analyse, npm-audit markeert ook de
transitieve "effect"-pakketten. Drie root causes:

| Root cause | Severity | Pad | Status |
|---|---|---|---|
| `bigint-buffer` (GHSA-3gc7-fjrx-p6mg, buffer overflow in toBigIntLE) | high | @solana/spl-token → @solana/buffer-layout-utils | **GEEN patched versie upstream** (vulnerable range `<= 1.1.5`, `first_patched: null`, gepubliceerd 2025-04-04) → geaccepteerd, zie onder |
| `serialize-javascript` (GHSA-5c6j-r48x-rmvq RCE, GHSA-qj8w-gfj5-8c6v DoS) | high | mocha@10.8.2 → ^6.0.2 | **Fix**: npm override naar ^7.1.1 |
| `uuid` (GHSA-w5hq-g745-h8pq, missing buffer bounds check) | moderate | @solana/web3.js → jayson@4.3.0 → ^8.3.2 | **Fix**: scoped npm override (alleen onder jayson) naar ^11.1.1 |

**Wat er is gedaan:**

1. `"overrides"` in package.json:
   ```json
   "overrides": {
     "serialize-javascript": "^7.1.1",
     "jayson": { "uuid": "^11.1.1" }
   }
   ```
   De uuid-override is bewust **scoped** (alleen onder jayson): rpc-websockets
   heeft uuid@14.0.2 (al patched) en mag niet naar 11.x teruggeduwd worden.
   serialize-javascript heeft maar één afnemer (mocha), dus daar is een
   ongescooped override net zo precies.
2. **Ongebruikte devDeps verwijderd: `chai` + `@types/chai`.** Grep over alle
   .ts-bestanden: geen enkele import (de tests zijn standalone ts-node-scripts
   met console.log + process.exit, geen mocha/chai-testen). Mocha/ts-mocha/
   @types/mocha blijven WÉL — Anchor.toml's `[scripts] test` draait
   `yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts`, dus die
   zijn onderdeel van de `anchor test`-pipeline. tsconfig `"types"` aangepast
   naar `["node", "mocha"]`.
3. **Verifiëerd:** `tsc --noEmit` schoon; offline smoke-test
   (verify-poisonToken.ts) volledig groen; mocha-pipeline gesmoket
   (ts-mocha + kleine spec → 1 passing) met de overriden serialize-javascript.

**Resultaat:** `npm audit` nu **3 high, 0 moderate** (was 4 high, 8 moderate) —
en alle 3 highs zijn de ENKELE restant: de bigint-buffer-keten
(bigint-buffer → buffer-layout-utils → spl-token, "effect"-labels).

**Restant: bigint-buffer — risicobeoordeling en herbezichtigings-trigger.**

- Geen patched versie bestaat (laatste release 1.1.5 zit in de vulnerable
  range; GitHub-advisory: `first_patched: null`). npm's eigen
  "fix available via npm audit fix --force: Will install
  @solana/spl-token@0.1.8" is een resolution-artifact (0.1.8 is ouder dan de
  geïnstalleerde 0.4.15) en geen bruikbare fix.
- Risico in deze context is **laag**: (a) de kwetsbaarheid zit in client-side
  JS (devnet-tooling), het on-chain Rust-programma heeft zijn eigen
  Cargo.lock en is niet geraakt; (b) exploitatie vereist attacker-controlled
  input in `toBigIntLE()` — in onze tests komt data van een vertrouwde
  devnet-RPC; (c) geen productiegebruikers, geen gebruiker-geld via deze
  client-path.
- **Herbezichtigen** wanneer: @solana/buffer-layout-utils de bigint-buffer-
  dependency verlaat, óf bigint-buffer een patched versie uitbrengt. Dan:
  `npm audit` opnieuw draaien en de override-strategie bijstellen.

## 28. Toolbox-check + qwen-code geïmplementeerd als terminal-coding-agent (2026-08-30)

**Toolbox (MCP) na herstart geverifieerd:**
- Alle 5 custom MCP-builds aanwezig (fs-mcp, solana-mcp, pq-mcp-google, cardano-mcp, shell-mcp); 4 servers draaien onder de LM Studio bridge.
- GitHub MCP server direct getest via stdio: v0.6.2 start, 26 tools, `list_issues` met de geconfigureerde GITHUB_PERSONAL_ACCESS_TOKEN werkt.
- Sessie-level: oude tool-registry na herstart gaf "Cannot find tool"; na herstart van de toolbox route tool-calls weer correct (getest via MCP: -32603 op bestaande PR-zoekopdrachten = API-reactie, geen routing-fout).
- Opmerking: LM Studio-config gebruikt het OUDERLIJKSE `@modelcontextprotocol/server-github` (v0.6.2); tool-set in deze sessie matches de NIEUWE `github/github-mcp-server` (incl. dependabot_get_alerts). Optioneel om te upgraden.

**qwen-code (@qwen-code/qwen-code v0.22.3) geïmplementeerd:**
- Globaal geïnstalleerd (Node 24.10.0 ≥ vereiste 22). Bin `qwen`.
- **Bug in ~/.qwen/settings.json gefixt:** `DASHSCOPE_API_KEY` bevatte twee `export`-regels (shell-commands in het API-key-veld) → alle 6 ModelStudio/DashScope cloud-providers waren dood. Oud config gereserveerd als `settings.json.bak-20260830`. Key verwijderd (geen echte key gevonden in env/dotfiles); cloud-providers blijven in de lijst en werken zodra een echte DASHSCOPE_API_KEY wordt gezet (via /auth of env).
- **Locale LM Studio-providers toegevoegd** (baseUrl http://localhost:1234/v1, envKey LMSTUDIO_API_KEY="lm-studio", contextWindowSize 32768):
  - `qwen3-coder-30b-a3b-instruct` → **standaardmodel** (MoE 30B/3B-active, bedoeld voor coding)
  - `qwen3.8-27b-uncensored` → general-purpose alternatief
- **MCP-servers aan qwen toegevoegd** (user scope): `solana` (node solana-mcp, --trust, read-only chain-tools) en `github` (npx server-github + GITHUB_PERSONAL_ACCESS_TOKEN, géén trust → write-acties zoals PR/issue aanmaken vragen confirmatie). Beide "Connected".
- **Geverifieerd (alles groen):** (1) directe LM Studio completion 200 ("Vier"); (2) qwen headless `2+2` → "2 + 2 = 4." (exit 0); (3) qwen headless met MCP: blockhash-opdracht → geldige base58 blockhash via solana MCP (exit 0, ~88s).
- Eerste call na boot is lang (~50s model-load in LM Studio), daarna sneller.

**Workflow (afgesproken met gebruiker):**
Gebruiker werkt interactief in de terminal met `qwen` (TUI, zoals Claude Code) in het project; deze agent (toolbox) doet het werk achter de schermen (opzet, verificatie, git, chain, Dependabot) en geeft opdrachten door. Gebruiker kan de opdrachten van deze agent ook rechtstreeks in de qwen-sessie plakken. Headless (`qwen -p "..." -o text`) is voor beide partijen beschikbaar voor eenmalige taken.
## 29. STAP 1 ("contract as code"): gedeelde spankwallet-lees/challenge-logica in herbruikbare crate `spankwallet-contract` — 13 unit-tests + volledig on-chain E2E-bewijs (2026-09-01)

**Wat de gebruiker vroeg:** de spankwallet-contractlogica die active-defense inline heeft (WalletAccount-layout-lezen + WebAuthn-challenge-bouwen) uitpakken naar een eigen, herbruikbare, standalone testbare Rust-crate — zodat spankwallet (als het later ook als contract wordt bijgewerkt) en active-defense EXACT dezelfde, één keer geverifieerde code delen. Dit is "stap 1" van de grotere "het contract als code"-visie (het on-chain contract is de bron van waarheid; de code die dat contract uitleest/verifieert mag niet twee keer bestaan).

**Wat er is gebouwd — `crates/spankwallet-contract/`:**
Een minimale crate (geen anchor, geen solana-program, géén I/O; std-default, maar de kernfuncties zijn Vec/alloc-vrij zodat ze ook voor het SBF-target compileren) met precies de gedeelde kern:
- `ContractError` (typed errors: `WalletTooShort`, `PasskeysTooShort`)
- `read_wallet_action_nonce(wallet_data) -> Result<u64, ContractError>` — leest het action-nonce vanaf tag 148 met tag-walk over de twee Option-velden (`recovery_state`/`deposit_authority`) — logisch byte-identiek met de originele inline-implementatie (die óók géén checksum-validatie had)
- `read_owner_passkey(wallet_data) -> Result<[u8;33], ContractError>` — owner-passkey uit offset 73..106
- `build_expected_challenge(program_id, wallet, action, payload) -> [u8;32]` — keccak256 over het exacte WebAuthn-challenge-recept (vóór active-defense's `secp256r1_challenge`-prefix). **Met `program_id` als parameter** (niet als import) zodat het crate-programmatarget-agnostisch is en door ELK programma herbruikbaar.
- `WALLET_*` layout-constanten (offsets/lengtes)
- Her-export van `solana_keccak_hasher` (zodat `hashv` voor SBF én native tests beschikbaar is)

**Bewijs (standalone, 13 unit-tests):** `cargo test -p spankwallet-contract` → **13 passed, 0 failed**. De known-answer-tests (challenge-vectoren, nonce-lezing) zijn deterministisch en programmatarget-onafhankelijk.

**Refactor in `programs/active-defense` (behavior-preserving):**
- `instructions.rs`: inline `WALLET_*`-constanten → import uit het crate; inline `read_wallet_action_nonce` → crate-versie (met `map_err` naar `ActiveDefenseError`); inline `build_expected_challenge` → crate-versie met `crate::ID.as_ref()` + `wallet.key().as_ref()` als argumenten.
- `state.rs`: her-export van de layout-constanten (backwards-compat met de client/tests).
- `Cargo.toml`: dependency op `spankwallet-contract` (path) + workspace-member.

**Waarom behavior-preserving (en bewezen, niet alleen aangenomen):**
De refactor verplaatst code, hij verandert de logica niet. De uitslag is dubbel bewezen:
1. **Offline:** de 13 crate-tests + `cargo build-sbf` (SBF-compile) slagen.
2. **On-chain:** `tests/clientLibraryE2E.ts` (de volledige Route B-flow via de client-library's publieke API) slaagt tegen het canonieke programma `FzeAZmQz…` — passkey-flow, mint, attach_transfer_hook, add_authorized_recipient, poison_transfer (unauthorized geblokkeerd / authorized geslaagd), readAuthorizedRecipient. Alleen mogelijk nadat de toolchain-issue uit sectie 30 was opgelost.

**Wat dit wél en níét vaststelt:**
- Wél: de gedeelde lees/challenge-kern bestaat nu als één herbruikbare, testbare crate; active-defense gebruikt die; het gedrag is on-chain ongewijzigd.
- Níét: dit is géén volledige spankwallet-reconstructie (init_wallet, action-nonce-increment, de complete WalletAccount-writes blijven spankwallet's eigen domein — active-defense LEEST alleen). Stap 2+ (het contract zelf als code) volgt later.

## 30. SBF-toolchain-vinding: platform-tools v1.54 produceert een defecte `.so` — gepind op v1.52 via `build-sbf.sh` (2026-09-01)

**Symptoom:** na de sectie-29-refactor faalde de on-chain E2E bij `attach_transfer_hook`:
```
Program FzeAZmQz… failed: Access violation writing 48 bytes at address 0x8 (in unallocated region)
(consumed 446 of 400000 compute units)
```
Een null/base-pointer-write op adres 8 (in het gat vóór `.text` bij VMA 0x120).

**Diagnostiek-verloop (systematisch, elke hypothese afgewezen vóór de volgende):**
1. **Niet de refactor** — via `git stash` de OUDERLIJKSE (pre-refactor) code gebouwd + deployed; die crasht met EXACT dezelfde fout (zelfde 446 CU,zelfde bericht). Dus de refactor is schuldeloos.
2. **Niet een relocation-bug** — `llvm-readelf -r` + alle 1301 relocations (1250× `R_SBF_64_RELATIVE`, 51× `R_SBF_64_32`) uitgelezen: géén enkele wijst naar < 0x120. De pointer komt niet uit de relocations.
3. **Niet dependencies** — `Cargo.lock` is ongewijzigd sinds `433a0c8` (Route B); anchor-lang 1.1.2 / solana-zk-sdk 4.0.0 etc. zijn dezelfde als toen de E2E groen was.
4. **Niet devnet** — de spankwallet-testfixture (`BUtmiNmq…`) draait wél op devnet (E2E-stap 1 `init_wallet` slaagt); dus de runtime is gezond, het is specifiek de active-defense-build.
5. **Wél de toolchain** — de machine is aarch64 (DGX Spark); de SBF-build gebruikt de gebundelde platform-tools. `cargo build-sbf --version` → platform-tools **v1.54** (rustc-fork `daa3af4`). Er was ook **v1.52** (rustc-fork `790f153`) gecacht. Twee verschillende rustc-forks.

**Root cause, bevestigd door een contrast-experiment:**
- `cargo build-sbf` (default, **v1.54**) → `.so` van **260648 bytes** → **crasht** (het symptoom hierboven).
- `cargo build-sbf --tools-version v1.52` (→ uninstalleert v1.54, gebruikt **v1.52**) → `.so` van **275480 bytes** (ANDER binary) → **E2E volledig groen** (sectie 29).
Dus de rustc-fork in platform-tools v1.54 (`daa3af4`) bevat een codegen-issue die voor dit programma een defecte `.so` produceert; v1.52 (`790f153`) niet. Een plain `cargo build-sbf` revert wél terug naar v1.54 (defect) — vandaar de pin.

**Fix + reproduceerbaarheid:**
- Nieuw `build-sbf.sh` (root, executeerbaar): `exec cargo build-sbf --tools-version v1.52 "$@"`. Alle SBF-builds voor dit programma gaan via dit script.
- **Actie:** SBF-builds doen `./build-sbf.sh` i.p.v. `cargo build-sbf`, totdat het v1.54-rustc-issues bovenstroom is opgelost of een workaround is gevonden.

**Openstaand (bewust, niet nu opgelost):**
- De exacte codegen-regressie in rustc-fork `daa3af4` (v1.54) is niet geïdentificeerd (wel: het produceert een null/base-pointer-write). Dat is een bovenstroomse rustc/SBF-kwestie; de pin op v1.52 is de praktische workaround. Als v1.55+ de bug bevestigt opgelost, kan de pin worden opgeheven.

## 30.1 (auditoekenslag) Grondige dubbelcheck/audit van de sectie-29/30-werk — alles bevestigd, één onschuldige anomalië onderzocht (2026-09-01)

Op verzoek ("dubbelcheck/audit alles grondig") is de sectie-29/30-werk laag-voor-laag geauditeerd. **Alle lagen: PASS.**

**Laag 1 — crate vs. origineel (byte-veld-voor-veld):**
- Alle layout-constanten identiek met de pre-refactor inline-code (73, 148, 41, `148+1+8+1+8`, 41, 42, 43).
- `read_wallet_action_nonce`: tag-walk-logica logisch identiek (offset 148 → recovery-tag → +41 if Some → +8 timelock → deposit-tag → +32 if Some). Origineel: expliciete `len>=offset+8` + `try_into().map_err`; crate: `get(offset..offset+8).ok_or(...)` — semantisch evenwichtig (zelfde bounds-check). **De originele code had óók géén magic-checksum** (de vroege sectie-29-claim over "0x5d5d5d5d" is gecorrigeerd).
- `build_expected_challenge`: `hashv(&[program_id, wallet, domain, payload])` identiek; crate geparametriseerd op `program_id`, retourneert `[u8;32]` i.p.v. `Vec<u8>`.

**Laag 2 — refactor (imports + map_err + call-sites):**
- `use spankwallet_contract::{…}` + `use crate::state::*` (state.rs re-exports `MAX_ADDITIONAL_PASSKEYS`).
- `check_current_action_nonce` → crate `read_wallet_action_nonce` + `.map_err(|_| InvalidWalletLayout)` + `require!(==, StaleActionNonce)` — fout-semantiek behouden (WalletTooShort → InvalidWalletLayout).
- Alle vier de `build_expected_challenge`-call-sites: `crate::ID.as_ref(), wallet.key().as_ref(), domain, payload` — argument-volgorde correct.

**Laag 3 — state.rs:** `MAX_ADDITIONAL_PASSKEYS` wordt er re-exporteerd (enige bron); active-defense's eigen types (`MaliciousAddressesAccount`, `AuthorizedRecipient`) + seeds (`POISON_AUTHORIZED_SEED`, `EXTRA_ACCOUNT_METAS_SEED`) blijven lokaal. Geen dubbele definities.

**Laag 4 — CHAIN-audit (het sterkste bewijs):** het daadwerkelijk op devnet gedraaide programma (`FzeAZmQz…`, programdata `DnDPmA17…`) opgehaald + ELF geëxtraheerd:
- **De eerste 275480 bytes van het deployed ELF zijn byte-identiek** aan de committed v1.52-build (`32971d30…`).
- ELF-header, program-headers (4× LOAD/DYNAMIC) én alle 8 secties (grootte+VMA) zijn **exact identiek**; entry-point 0x1E4B0 in beide.
- **Anomalië (ongeschikt, onderzocht):** het programdata is 277200 bytes = de .so (275480) + **1720 bytes NUL** aan de staart (1720/1720 nul-bytes), na de section headers en buiten alle LOAD-segments → **niet geladen/uitgevoerd, dus inert**. Elke redeploy van de 275480-`.so` geeft dezelfde 277200 (het account wordt niet naar de exacte programmagrootte verkleind / deploy-padding). Geen correctheids-effect; enkel iets meer rent op het account.

**Laag 5 — tests:** `cargo test -p spankwallet-contract` → 13 passed, 0 failed (herbevestigd). `./build-sbf.sh` deterministisch (twee verse builds → identiek `32971d30…`). E2E on-chain groen (herbevestigd).

**Gecorrigeerd in sectie 29** (na deze audit): de "0x5d5d5d5d magic-checksum"-claim (bestond niet), de `ContractError`-varianten (echt: `WalletTooShort`, `PasskeysTooShort`), en "no_std-vriendelijk" (std-default, maar kernfuncties Vec/alloc-vrij).

## 31. OBP-analyse — "OfflineBearer Protocol" Grok-chat gelezen en geanalyseerd (2026-09-02)

Op verzoek ("lees en analyseer zorgvuldig deze chat van mij met Grok") is de volledige
Grok-chat over het **OfflineBearer Protocol** (munten offline halen op een stick, offline
overdragen, later terugzetten zonder double-spend) geanalyseerd. Uitgebreide analyse +
geverifieerde bronnen: `notes/obp-analysis.md`. Kernbevindingen:

1. **De lijn van Grok klopt grotendeels**: account-model vs UTXO is orthogonaal aan het
   offline-probleem; de 4-laags architectuur (L1/L2/state channels/Local Coin-Chains) is
   de standaardvorm; "bestaat er al zoiets" — grotendeels accuraat.
2. **Zes technisch onderbesloten punten in het eindontwerp** (volledig uitgewerkt in de
   notitie):
   - "Optionele bonds" is de kernfout: een challenge-periode beslist wie betaald wordt,
     maar compenseert niemand. Bond moet verplicht zijn, = muntwaarde V, escrow bij
     check-in; "eerste geldige check-in wint, tweede betaalt de bond".
   - Het check-in-mechanisme mist het **head-commitment + langste-keten-wint**-model
     (per-serial optimistic-rollup dispute-game); Grok heeft alleen een serienummer-lijst
     + willekeurige 24–72u challenge-periode.
   - L2 als "multi-sig federatie" is het zwakste trust-model van het systeem; moet een
     optimistic rollup zijn (state roots op L1, finality = fraud-proof window) óf een
     expliciete N-of-M trust-aanname.
   - **Privacy-lek**: "eigenaar publiceert de lokale chain op L2" maakt de volledige
     munt-lineage publiek bij check-in. Fix = blind minting + ZK check-in (Zcash
     shielded-spend model, met spend = check-in).
   - **Post-kwantum**: lokale munt-chain = publieke handtekeningen op lang-levende
     credentials (10 jaar). Ed25519/secp256k1 valt onder Shor → "harvest now, break
     later". Aanbeveling: ML-DSA of SLH-DSA (FIPS 204/205) op de munt-chain vanaf dag
     één; ZK als optionele laag houden (PQ-ZK is niet productie-rijp).
   - Het **begrenste offline-toelating**-trucje (digitale euro: "offline sublimit")
     ontbreekt; zonder cap is het double-spend-risicoprofiel per munt onbegrensd.
3. **Bronverificatie (Grok's claims gecontroleerd)**: Videira-paper klopt ("The offline
   cash puzzle solved by a local blockchain", IET Blockchain 4(1) maart 2024,
   doi:10.1049/blc2.12049, auteur Braziliaans Centraal Bank); Cashu + Fedimint zijn in
   productie (offline bearer tokens, blind signatures, offline minting); BoE
   "Digital pound experiment report: Offline payments" (2025, met Thales/Secretarium/
   IDEMIA/Quali-Sign/Consult Hyperion); ECB digitale euro heeft een offline sublimit
   (design doc juni 2024, closing report okt 2025); Miden testnet v5 doet "local
   transaction executions" (state lokaal, commitments on-chain). Nuance op Grok:
   Lightning is pairwise en **niet overdraagbaar** — dat onderscheid staat in de chat
   impliciet maar is cruciaal (de munt-laag is precies waar overdraagbaarheid ontstaat).
4. **Positie van OBP, eerlijk**: OBP = "Cashu waarbij de mint vervangen is door een
   publieke L2 en het note een verifieerbare lokale chain is". Cashu levert al ~80% van
   de UX; de echte gap is de engineering, niet het concept. Wat er écht niet bestaat:
   het complete permissionless plaatje (L1 + L2 met fraud proofs + channels + Local
   Coin-Chains + verplichte bonds + ZK check-in).
5. **Aanbeveling**: prototype met Cashu/trusted-mint eerst (UX bewijzen), dan de mint
   upgraden naar een L2-dispute-game. Concrete check-in state machine + on-chain state
   + invariants + Solana/Anchor-valkuilen staan in `notes/obp-analysis.md` §5.

Geen code gebouwd; puur analyse + bronverificatie. Openstaand: of Michel de check-in
state machine (notitie §5) verder wil uitwerken tot een echt Anchor-programma (dan
past het in deze repo), of eerst de trust-model-kiezen (rollup vs federatie).

## 32. Dependabot-ronde (2026-09-14): toml + stream-json afgewezen, zelfde onderbouwing als
spankwallet sectie 138

Tijdens de vertrekcontrole na een week afwezigheid drie nieuwe Dependabot-alerts
aangetroffen sinds het laatst bekende punt (2026-09-02): **#7/#6 toml 3.0.0** (high,
GHSA-v5mp-jgw5-2x6j prototype pollution via `__proto__` / GHSA-82x6-q7mm-w9cf uncontrolled
recursion, via `@coral-xyz/anchor@0.31.1`→`toml`) en **#5 stream-json 1.9.1** (medium,
GHSA-528h-pc64-c93x, O(diepte²) event-loop-DoS, via `@solana/web3.js@1.98.4`→`jayson`→
`stream-json`). Zelfde pakketten, zelfde versies, zelfde dependency-paden als in
`spankwallet` sectie 138 - de volledige codepad-verificatie is daar uitgeschreven, hier
alleen samengevat plus de repo-specifieke bevestiging dat dezelfde conclusie ook hier klopt.

**#7/#6 toml → `dismissed_reason: "tolerable_risk"`.** `toml.parse()` heeft process-breed
precies één call-site (`@coral-xyz/anchor/dist/{cjs,esm}/workspace.js:56`,
`toml.parse(fs.readFileSync("Anchor.toml"))`, hardcoded pad). Die aanroep vindt hier
daadwerkelijk plaats (bij elke `anchor.workspace.*`-toegang in de tests), maar uitsluitend op
ons eigen lokale `Anchor.toml` - nooit netwerk- of gebruikersinvoer. De trigger-precondition
(aanvaller-gecontroleerde TOML-inhoud) is aantoonbaar afwezig; de aanroep zelf niet - vandaar
`tolerable_risk`, niet `not_used`.

**#5 stream-json → `dismissed_reason: "not_used"`.** Expliciet gecontroleerd voor déze repo
(niet zomaar overgenomen): `npm ls jayson`/`grep -rn "require('jayson"` in
`node_modules/@solana/web3.js/lib/index.cjs.js` bevestigt hetzelfde `jayson/lib/client/browser`
+ `fetch()`-transport als in spankwallet; geen enkele require van `jayson/lib/client/tcp`,
`.../tls`, of `jayson/lib/server/*` in `@solana/web3.js` of `@coral-xyz/anchor`. De enige
functie die `stream-json` aanraakt (`Utils.parseStream`) wordt uitsluitend door die
tcp/tls-varianten aangeroepen - in ons daadwerkelijke require-pad dus nooit uitgevoerd,
ongeacht input. Vandaar `not_used`: de vulnerabele functie draait hier niet, punt (in
tegenstelling tot `toml`, waar de aanroep wél gebeurt maar de input veilig is).

**`js-yaml`: geen alert, geen actie nodig.** `npm ls js-yaml --all` toont hier al
`mocha@10.8.2 → js-yaml@4.3.2` - al gepatcht, in tegenstelling tot spankwallet waar een
losse override nodig was (zie spankwallet-sectie 138).

**`#1 bigint-buffer` bewust ongewijzigd** - al eerder gedocumenteerd/geaccepteerd risico,
buiten scope van deze ronde (deze ronde betrof uitsluitend de drie nieuwe alerts sinds
vertrek).

**Bevestigd via `GET .../dependabot/alerts` ná de PATCH-aanroepen:** #7 en #6 `dismissed`/
`tolerable_risk`, #5 `dismissed`/`not_used`, #1 blijft `open` (ongewijzigd, buiten scope).

## 33. Audit vóór release-candidate-verificatie (spankwallet-kant): README-stale-claim gefixt na akkoord + nieuw ontdekt operationeel probleem met de devnet-upgrade-authority-wallet (2026-09-14)

Onderdeel van een bredere pre-RC-audit die vanuit spankwallet liep (zie daar, sectie 139,
voor het volledige verslag). Sectie 31/`.obp-staging/`/`notes/` bevestigd onaangeroerd - niet
door deze audit geraakt.

**README.md: substantiële, na expliciet akkoord gefixte stale claim.** Regel 33 (tabel)
beweerde nog dat `client/src/poisonToken.ts` "VEROUDERD / niet functioneel" is (verwijzend
naar sectie 4, de OUDE 3-instructie-beoordeling) - maar sectie 19 herschreef het bestand
volledig tegen Route B (huidige 5-instructieversie) en sectie 26 bewees het on-chain
end-to-end via zijn eigen publieke API. Het bestand se eigen top-of-file-comment bevestigt
zelf al de huidige Route B-staat. Gefixt: tabelrij bijgewerkt, "Openstaande punten"-lijst se
punt 3 (dezelfde stale claim, nog EXTRA verouderd: noemde "de huidige 4-instructie-versie"
terwijl het er inmiddels 5 zijn) verplaatst naar de al-bestaande "voorheen opgelost"-
parenthetical (zelfde patroon als de testfixture-regel daar). Kop "Huidige staat (augustus
2026)" bijgewerkt naar september.

**Nieuw ontdekt tijdens de verse-testrun (item 10), NIET gefixt - operationeel probleem,
geen documentatiefout:** `yarn test`/`anchor test` faalt hier onvoorwaardelijk, vóór er ook
maar één test draait. Oorzaak: `Anchor.toml`'s `[provider] cluster = "devnet"` betekent dat
een kale `anchor test` altijd EERST een echte devnet-programma-upgrade probeert (build +
`solana program deploy`/upgrade tegen `FzeAZmQz…`), en die upgrade faalt:

```
Attempt 1/2/3 failed: Account allocation failed: RPC response error -32002:
Transaction simulation failed: This account may not be used to pay transaction fees;
```

**Root cause bevestigd:** de upgrade-authority (`~/.config/active-defense/program-keypairs/
active-defense-keypair.json`, pubkey `FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK` - zelfde
keypair als het Program ID zelf, README regel 184/185 documenteert dit bewust zo) heeft nog
maar **0.00114144 SOL** op devnet (`solana balance ... --url devnet`). Een upgrade-buffer voor
de huidige ~275KB `.so` heeft rond de 1,76 SOL rent-exempt nodig (vergelijkbaar met het reeds
gedeployde programma's eigen balance van 1.756603209 SOL) - de authority-wallet is dus ver
onder wat nodig is voor zelfs één upgrade-poging.

**Waarom dit niet eerder is opgevallen:** de daadwerkelijke, historisch gebruikte testroute
gaat NOOIT via `yarn test`/`anchor test` - alle vijf testbestanden (`activeDefenseFull.ts`,
`addAuthorizedRecipientIsolated.ts`, `attachTransferHookIsolated.ts`, `clientLibraryE2E.ts`,
`poisonTransferHookIsolated.ts`) zijn standalone `npx ts-node tests/X.ts`-scripts (console.log
+ process.exit, geen `describe`/`it` - bevestigd, `grep` op echte mocha-blocks levert niets
op), zoals sectie 27 punt 2 ook al vaststelde. `package.json`'s `"test": "anchor test"` is dus
een ongebruikt/nooit-in-de-praktijk-gedraaid commando-pad dat nu blijkt kapot te zijn.

**Bewust NIET zelf gefixt of omzeild tijdens deze audit** (geen devnet-upgrade geprobeerd,
geen wallet gefund, geen `package.json`-scriptwijziging aangebracht) - dit vereist een keuze
van Michel: (a) de authority-wallet funden zodat een kale `anchor test` weer werkt, (b)
`package.json`'s `"test"`-script aanpassen naar iets dat niet probeert te deployen (bijv. de
vijf ts-node-scripts na elkaar aanroepen, of `anchor test --skip-deploy`), of (c) bewust laten
zoals het is omdat de echte testroute toch nooit via dit commando loopt. Los daarvan: de
13 crate-unit-tests (`cargo test -p spankwallet-contract`, geen devnet nodig) opnieuw gedraaid
tijdens deze audit - **13 passed, 0 failed**, identiek aan sectie 30.1.

**Vervolg (zelfde dag): optie (b) gekozen - `package.json`'s `"test"` roept nu de vijf
ts-node-scripts na elkaar aan, i.p.v. `anchor test`.** Waarom dit beter is dan de wallet
funden (optie a): een testcommando hoort geen devnet-programma-upgrade als bijwerking te
hebben, ongeacht of de authority-wallet toevallig gefund is - funden had het symptoom
verholpen (het commando zou weer "werken"), maar niet de onderliggende designfout opgelost
dat `yarn test` een write-actie tegen een gedeeld, echt devnet-programma uitvoert als
neveneffect van "even de tests draaien". Dat is precies de categorie fout die dit project
elders al bewust vermijdt (onzichtbare tijdgebonden/netwerk-side-effects, zie o.a. sectie 99's
afwijzing van een vast tijdvenster om diezelfde reden - onvoorspelbaar gedrag als bijwerking).

Nieuw `"test"`-script (`&&`-keten, stopt bij de eerste mislukking - geen stille doorloop, elk
script duidelijk gelabeld `[N/5]`):
```
echo '=== [1/5] activeDefenseFull.ts ===' && npx ts-node tests/activeDefenseFull.ts &&
echo '=== [2/5] addAuthorizedRecipientIsolated.ts ===' && npx ts-node tests/addAuthorizedRecipientIsolated.ts &&
echo '=== [3/5] attachTransferHookIsolated.ts ===' && npx ts-node tests/attachTransferHookIsolated.ts &&
echo '=== [4/5] clientLibraryE2E.ts ===' && npx ts-node tests/clientLibraryE2E.ts &&
echo '=== [5/5] poisonTransferHookIsolated.ts ===' && npx ts-node tests/poisonTransferHookIsolated.ts &&
echo '=== Alle vijf active-defense-testscripts geslaagd ==='
```
Werkt omdat alle vijf scripts al altijd tegen het canonieke, AL-gedeployde devnet-programma
(`FzeAZmQz…`) draaiden via `~/.config/solana/id.json` als fee-payer (de goedgefunde
algemene CLI-wallet, 95+ SOL, NIET de active-defense-specifieke upgrade-authority) - geen van
de vijf doet ooit een `solana program deploy`/upgrade. `npm test` gedraaid ter bevestiging:
alle vijf `[N/5]`-labels verschenen in volgorde, `exitcode 0`, geen enkele `upgrad`/
`Deploying`/`program deploy`-regel in de output. Upgrade-authority-balance vóór en ná
identiek (`0.00114144 SOL`) - bevestigt zwart-op-wit dat er geen devnet-schrijfactie richting
het programma zelf plaatsvond. De onderliggende onderfunding (a) blijft een open, apart punt -
relevant zodra er ooit weer een ECHTE upgrade nodig is, niet meer relevant voor "gewoon de
tests draaien".

## 34. Dependabot-alert #1 (bigint-buffer) herverifieerd en afgewezen (2026-09-21)

Push van de OBP-analyse-housekeeping-commit (sectie 31) triggerde GitHub's
Dependabot-scan: 1 open alert, `bigint-buffer` (#1, CVE-2025-3194, high).
Al eerder gedocumenteerd als geaccepteerd risico (sectie 27, 2026-08-xx,
géén `dismissed_reason` toen op GitHub gezet — puur in STATUS.md
vastgelegd). Vandaag niet blind op die eerdere analyse vertrouwd, maar
opnieuw geverifieerd tegen de huidige `node_modules`-boom en, belangrijker,
specifiek tegen dit project zijn eigen adversariële testpaden — want
`active-defense` is precies het project waar bewust met vergiftigde/
kwaadaardige tokens gewerkt wordt, dus als er ergens een afwijkende
conclusie zou gelden t.o.v. het generieke "vertrouwde RPC-data"-argument,
zou het hier moeten zijn.

**Keten:** `@solana/spl-token` → `@solana/buffer-layout-utils` →
`bigint.js` → `toBigIntLE()`/`toBigIntBE()`, aangeroepen via `getMint()`/
`getAccount()`. Bereikbaar: deze functies worden overal gebruikt, óók in
`client/src/poisonToken.ts` en de poison-token-tests
(`tests/attachTransferHookIsolated.ts`, `tests/poisonTransferHookIsolated.ts`,
`tests/activeDefenseFull.ts`, `tests/clientLibraryE2E.ts`).

**Specifiek nagegaan: raakt de "vergiftiging" ooit lokaal-verzonnen bytes
die rechtstreeks (buiten het Token-programma om) de decoder ingaan?**
Nee — elke `getMint`/`getAccount`-aanroep in álle bestanden hierboven haalt
op via `connection` (live RPC-fetch). De "vergiftiging" zelf gebeurt door
een échte on-chain-transactie te versturen (bijv. een kwaadaardige
TransferHook-extensie aan een mint hangen via `getMintLen([ExtensionType.
TransferHook])` + een echte `InitializeMint2`/`InitializeTransferHook`-
instructie) — het Token-2022-programma valideert en schrijft die state zelf;
pas ná bevestiging wordt hij teruggelezen. De basis-`Mint`/`Account`-struct
(waar de `u64`-velden zitten die `bigint-buffer` decodeert) heeft een vaste,
door het programma afgedwongen lay-out, ook met extensies (die zitten in
een TLV-blok ná de basisstruct, raken de `u64`-decodering niet). Dus: zelfde
twee argumenten als bij `offline-bearer-protocol` (zie die repo's
STATUS.md sectie 17.3, identieke keten): vaste code-gedefinieerde
bufferlengtes (8/16 bytes) + altijd programma-afgedwongen, nooit
lokaal-verzonnen bytes.

Geen patch beschikbaar upstream (`first_patched: null`).

**Uitgevoerd:** gedismissed via de Dependabot-API,
`dismissed_reason: tolerable_risk`, bovenstaande onderbouwing samengevat
in `dismissed_comment`. Bevestigd ná de PATCH-aanroep: **0 open
Dependabot-alerts.**

**Vervolg (zelfde datum): `.obp-staging/` verwijderd (26 bestanden, 852K,
untracked, laatste wijziging 2026-09-16).** Vóór verwijdering elk bestand
individueel tegen de actieve `offline-bearer-protocol/`-werkkopie gediffd
(niet op bestandsnaam alleen afgegaan). Conclusie, per bestand in één van
drie categorieën: byte-identiek aan het huidige equivalent
(`allowance.rs`, `vault.rs`); een strikt voorafgaande snapshot van een
sindsdien geëvolueerd bestand, elke diff-hunk nagelopen zonder een
orphaan idee/testgeval (`lib.rs`, `state.rs`, `errors.rs`, `Cargo.toml`,
`instructions/{init,mint,mod,checkin}.rs`, de twee smoke-scripts) —
inclusief `crypto.rs`, dat geen equivalent meer heeft maar bewust
afgeschaft is (in-program ed25519-dalek vervangen door de
ed25519-precompile, CU-kosten-reden staat in de checkin.rs-historie); of
een eenmalig diagnosescript waarvan de bevinding al elders is vastgelegd
(`close-pdas{,2}.js`, `ping-test.js`, `verify-so.js`, `cu-probe{,2,3,4}.js`,
`settle-sim.js`, `settle-log.js`, `m1x-edit.py`, `obp_core_v0_backup.so`,
`relocs.txt` — stuk voor stuk terug te voeren op nu-gedocumenteerde,
al-opgeloste episodes: de v1.52-toolchain-bug, de devnet-CU-budget-
bevinding, de programma-ID-migratie). Geen informatie verloren.
`git status` ná verwijdering: schoon, verder niets in de werkboom
gewijzigd.

**Vervolg (zelfde datum): permanente data-herkomst-scan toegevoegd
(`tests/poisonDecodeProvenance.ts`), draait vooraan in `npm test`.**

Bewaakt structureel de aanname achter de `tolerable_risk`-dispositie voor
`bigint-buffer` hierboven: de functie draait wél (`getMint`/`getAccount`,
ook in de poison-token-tests), maar de trigger-voorwaarde
(attacker-controlled bytes) doet zich niet voor omdat de data altijd
programma-gevalideerd via een live RPC-fetch binnenkomt. Die aanname was
tot nu toe een momentopname (handmatig nagegaan); deze test maakt hem
permanent.

**Waarom hier een andere methode dan bij `offline-bearer-protocol` — dat
verschil is zelf de belangrijkste informatie in deze sectie.** OBP's
CoinFile-decodeerpad (`coinfile.ts`/`layout.ts`/`wrapper.ts`) heeft géén
enkele referentie naar `@solana/spl-token` in die bestanden — een
bestandsbrede `Bun.build()`-graafcheck ("dit bestand mag bigint-buffer
nooit bundelen") is daar zowel mogelijk als betekenisvol. Hier ligt dat
anders: de twee eigen, native-Buffer-gebaseerde decodeerfuncties
(`readAuthorizedRecipient`, `readMaliciousAddresses` in
`client/src/poisonToken.ts`) staan in **hetzelfde bestand** als functies
die legitiem `@solana/spl-token` gebruiken (`buildPoisonTransferIx`,
`createMintForPoisonToken`, `readExtraAccountMetas`). Een module-import
voert altijd het volledige bestand uit, dus een bestandsbrede
graafcheck op `poisonToken.ts` zou permanent en zonder informatiewaarde
falen — niet omdat de decodeerfuncties zelf `bigint-buffer` raken, maar
omdat hun bestandsgenoten dat terecht wél doen. In plaats van het
bestand op te knippen (een structuurwijziging die niet gevraagd was) is
hier gekozen voor de **daadwerkelijke veiligheidsaanname**: niet "welk
pakket zit in de graaf" maar "komt elk argument dat ruwe account-bytes
levert aantoonbaar van een live `connection`-fetch, nooit van een lokaal
geconstrueerde buffer".

**Implementatie: AST (TypeScript compiler-API), geen regex.** Voor elke
aanroep van `readAuthorizedRecipient`/`readMaliciousAddresses`/`getMint`/
`getAccount` in het hele project wordt het eerste argument teruggeleid
naar zijn declaratie (`new Connection(...)`/`new web3.Connection(...)` =
goed, `Buffer.from(...)`/array-literals/object-literals = fout). Regex
zou onbetrouwbaar zijn voor dit doel: een over meerdere regels
geformatteerde aanroep (zoals in `test/verify-deployment.ts`, waar de
argumenten elk op een eigen regel staan) is met een patroon-match
makkelijk te missen, en een argument dat toevallig de tekst "connection"
bevat zonder dat te zíjn zou een regex ten onrechte goedkeuren — de AST
geeft de echte argument-node, geen tekstgok. Bonus-check, buiten de
aanroep-analyse om: de twee decodeerfuncties zelf moeten ook echt via
`connection.getAccountInfo(...)` lezen (sluit de lus aan de
definitiekant, niet alleen aan de aanroepkant).

**Rood-vóór-groen, zoals steeds in dit project.** Baseline: 6 bestanden
met een aanroep van de vier doelfuncties (`client/src/poisonToken.ts`
zelf bevat alleen de definities, geen aanroepen), allemaal groen. Tijdelijk
`readAuthorizedRecipient(Buffer.from([1, 2, 3]) as any, ..., ...)`
toegevoegd in een los, nooit-uitgevoerd bewijsbestand → de scan faalde
meteen, met exact het bestand, de regel en de reden ("eerste argument
niet herleidbaar tot een live connection-fetch") — dit is tegelijk de
negatieve controle (bewijst dat de scan onderscheid maakt, niet altijd
"OK" zegt) en het rood-bewijs. Bewijsbestand daarna volledig verwijderd
(niet als permanente fixture bewaard, in tegenstelling tot OBP's
`accounts.ts` — daar was dat al een bestaand productiebestand; hier moest
de foutieve aanroep bewust kunstmatig zijn, dus tijdelijk). `git status`
ná verwijdering: werkboom weer exact zoals ervoor, op de nieuwe
testfile na. Scan opnieuw gedraaid: weer groen.

`npm test`'s scripts-regel in `package.json` aangepast: de scan draait nu
als stap [1/6], vóór de vijf dure on-chain-E2E-scripts — snel, geen
validator nodig, faalt liever meteen dan pas ná een lange testrun.

## 35. Licentie vastgesteld: Apache-2.0 (2026-09-22)

`LICENSE` stond nog op MIT (copyright "Active Defense contributors").
Michel heeft vastgesteld: **Apache-2.0**, consistent met
offline-bearer-protocol (zelfde beslissing daar, dezelfde avond). `LICENSE`
vervangen door standaard Apache-2.0-tekst (copyright "2026 Michel"),
`license = "Apache-2.0"` toegevoegd aan `programs/active-defense/Cargo.toml`
en als `[workspace.package]`-veld aan het root-`Cargo.toml` (had voorheen
geen enkel SPDX-veld), en README.md's licentie-regel bijgewerkt.
`crates/spankwallet-contract/Cargo.toml` (de gepinde, externe
spankwallet-layout-dependency, geen eigen active-defense-code) is bewust
niet aangepast — buiten scope van deze wijziging.


## 36. FN-DSA op de SVM: eerste echte CU-meting, en correctie op mijn eigen SIMD-0461-bewering (2026-09-25)

Aanleiding: de vraag wat FALCON-verificatie (FN-DSA-512, NIST FIPS 206) aan
compute units kost op de SVM. Het antwoord is er nu: gemeten, niet geschat.

### Wat er staat

* `pq-bpf/` — SBF-programma (cdylib) met echte FN-DSA-512 verificatie via
  `falcon-rs` 0.3.1 (`default-features = false`; het crate is netjes no-std en
  heeft een `fpemu`-feature voor targets zonder FPU). 65.648 byte, modus-byte in
  de instructiedata: 0 = alles behalve verifiëren, 1 = mét.
* `pq-host/` — gast-heer die het gedeployde `.so`-bestand uitvoert en instructies
  telt. Beproeft toetsmateriaal: publieke sleutel 897 byte, signatuur 809 byte,
  bericht 48 byte, deterministisch opgebouwd (op SBF is geen RNG).

### Meting

| meting | waarde |
|---|---|
| modus 0 (alleen parsen) | 129 instructies, resultaat `Ok(0)` |
| modus 1 (met verificatie) | 1.097.198 instructies, resultaat `Ok(0)` |
| **verschil = verificatie** | **1.097.069 instructies** |
| herhaling | exact identiek; de VM is deterministisch |

`Ok(0)` betekent dat de signatuur daadwerkelijk gevalideerd is op de SBPF-VM: het
is echte cryptografie, niet een pad dat voortijdig afhaakt.

### Omrekening naar compute units

Agave's kostmodel rekent de meeste SBPF-instructies als 1 CU, dus bij benadering:

| grootheid | waarde |
|---|---|
| FN-DSA-512 verificatie | ≈ 1,10 miljoen CU |
| limiet per transactie (1.400.000) | 78 % van het plafond |
| standaardlimiet (200.000) | 5,5×; expliciete `SetComputeUnitLimit` nodig |
| limiet per blok (50.000.000) | ≈ 45 verificaties per blok |

Onafhankelijke kalibratie-controle: SIMD-0563 noemt officieel 159,37 ns voor
`keccak(135B)` tegen 152 CU, dus 1 CU ≈ 1,05 ns op de referentiehardware. Native
verificatie meet 51 µs ≈ 0,05 miljoen native-CU; de VM kost 1,10 miljoen, dus de
interpreter is ~20× trager dan native. Dat is een normale factor voor een
geïnterpreteerde VM, dus het getal is coherent en geen artefact van de opstelling.

Caveat om bij elk hergebruik van dit getal mee te geven: het zijn
*SBPF-instructies*, gewogen 1-op-1 naar CU. Geheugentoegang en calls kunnen in
het echte kostmodel zwaarder wegen; de werkelijke CU-waarde ligt dus iets hoger,
niet lager.

### Gevolgen voor het ontwerp

1. PQ-handtekeningen on-chain controleren kan, maar vreet 78 % van een
   transactiebudget en ~1/45 van een blok.
2. Verificaties bundelen, of onderbrengen in een apart kanaal, is geen
   optimalisatie meer maar een ontwerpeis.
3. Een eigen, geverifieerde implementatie is geen luxe: dit getal geldt voor onze
   build en alleen wij kunnen hem nameten.

### Twee bugs die de meting verstopten (beide van onszelf)

1. **Verkeerde VM.** Agave 4.1 gebruikt niet `solana_rbpf` (upstream, API
   vertakt) maar `solana-sbpf`, de eigen fork. Tegen de verkeerde VM aan hiken
   verklaarde de onverklaarbare `InvalidMemoryRegion` waar het eerder vastliep.
2. **Verkeerde invoerindeling.** `deserialize` begint met het aantal accounts,
   daarna pas de instructiedata. Lengte vóór aantal gegeven gaf een zinloos
   accountaantal: "memory allocation failed".

Drie kleinere, dezelfde oorzaak (raaden in plaats van de bron lezen): de
geheugenindeling moet de programmaregio (`get_ro_region()`) bevatten plus stack,
heap en invoer; `with_capacity` voor de heap geeft lengte nul en gaf een
toegangsfout (moet `zero_filled`); en syscalls moeten gast-adressen via `map()`
naar host-adressen vertalen, anders een segfault.

### Correctie op mijn eigen eerdere bewering

Eerder stelde ik in gesprek dat Solana FALCON "als richting noemt (SIMD-0461
precompile)". Dat was te optimistisch. Geverifieerd uit de primaire bron (de PR's
zelf):

| voorstel | inhoud | status |
|---|---|---|
| SIMD-0461 | Falcon-512 verificatie-syscall | **closed, niet gemerged, 17 jun 2026**; verkennend, van een community-bijdrager, geen Anza-toezegging |
| SIMD-0563 | Keccak-p1600 syscall | **closed, niet gemerged, 27 jul 2026** |
| firedancer-io/firedancer#9446 | Falcon-syscall in C (Jump) | verouderd, laatst bewerkt apr 2026 |
| anza-xyz/solana-sdk#537 | Falcon via liboqs | verouderd sinds 1 feb 2026 |

De Foundation-publicatie van 27 apr 2026 (solana.com/news/quantum-readiness)
noemt Falcon wél, maar is wallet-scoped en zegt letterlijk dat er "vandaag en
waarschijnlijk op korte termijn niets moet veranderen". Beide
validator-client-teams, Anza én Firedancer/Jump, kozen onafhankelijk FN-DSA
(FIPS 206); ML-DSA zat alleen in het Project-Eleven-onderzoeksprototype (dec
2025). Er staat geen onjuiste versie van deze bewering in de repo: ze stond
alleen in gesprekstekst, en is hierbij gecorrigeerd.

### Navolging op §31 (post-kwantumadvies)

§31 adviseerde ML-DSA of SLH-DSA (FIPS 204/205) voor de munt-chain. Dat blijft
een geldig advies voor een geïsoleerde munt-chain, maar is onvolledig geworden voor
interoperabiliteit met Solana: daar is FN-DSA de door beide client-teams gekozen
richting. Practische vertaling: SLH-DSA of ML-DSA voor eigen lange-levende
credentials, en FN-DSA ondersteunen voor het verkeer richting Solana.

### Open punten

1. Dit zijn SBPF-instructies op `solana-sbpf`, geen CU's uit een draaiende
   validator. Bevestiging vraagt een x86-runner met `solana-program-test`
   (`units_consumed`), waar de adresmapping en het kostmodel productief correct
   zijn. Verwacht een getal iets boven 1,10 miljoen.
2. SIMD-0461 kan heropend worden "when there is more demand"; een gemeten,
   reproduceerbare benchmark uit dit project is precies het soort bewijs dat daar
   voor nodig is.

## 37. LiteSVM als testloop op ARM, en mijlpaal 2: de autorisatie-route echt draaiend gekregen (2026-09-26)

Aanleiding: de handover van 2026-09-25 sloot af met twee openstaande dingen — de
huisvestingscontrole (punt 5) en het advies over de volgorde van aanpak. Punt 1
(werkende testloop) hangt aan een harde voorwaarde: `solana-test-validator`
bestaat niet voor aarch64, dus "de testloop fixen" kan hier niet betekenen
"localnet aan de praat krijgen". gekozen route is LiteSVM: in-process Agave-VM,
geen validator-binary.

### Huisvestingscontrole (punt 5, gemeten)

| controle | resultaat | bron |
|---|---|---|
| `qwen38-flash-next/` getrackt? | nee, en het is een **lege map** (0 entries) | `git ls-files`; `os.listdir` |
| `target/` genegeerd? | ja, `.gitignore:1` | `git check-ignore -v target/`; gemeten 1,9 GB |
| `node_modules/` genegeerd? | ja, `.gitignore:2` | idem; gemeten 84 MB |
| keypairs getrackt? | nee, 0 van 35 bestanden | `git ls-files` |
| throwaway-keypair | correct genegeerd (`!!`) | `git status --porcelain --ignored=matching` |
| HEAD vs origin/main | gelijk: `38290bcf…` | `git rev-parse` |

Conclusie: geen lek, wel ruis. Git meldt een lege map niet omdat git lege mappen
niet trackt; zodra er iets in geschreven wordt dook het op als `??` en dus mee
met een `git add -A`. De map is hier niet verwijderd — dat is een beslissing,
geen bevinding.

Eigen fout in deze controle: de eerste `check-ignore test-ledger` gaf vals
"niet genegeerd". Het patroon is `test-ledger/`; bij een niet-bestaand pad is de
trailing slash nodig. Met slash matcht regel 3.

### De bouwsteen

`harness/` — losstaande crate (eigen `[workspace]`-tabel), dus hij deelt de
workspace bovenin niet en raakt de programma-build niet. Versies: `litesvm`
0.16.0, dat op Agave 4.2.2-crates bouwt; `spl-token-2022` 11.1.0; `p256` 0.13
(puur Rust, geen openssl op deze host). Compileert en draait op aarch64 — de
ARM-blokkade uit de handover geldt voor deze route niet.

LiteSVM bundelt zelf `spl_token_2022-11.0.0.so` op `TokenzQdBNbL…`, dus er was
geen download nodig. Versieverschil met onze pin is gedicht: program@v11.0.0 én
program@v11.1.0 hangen allebei aan `spl-transfer-hook-interface = "2.1.0"`, wat
exact onze pin is (gecheckt tegen de tags in solana-program/token-2022).

### Risico dat bleek te bestaan: de instructies-sysvar

Het programma leest de instructies-sysvar via **accountbytes**, niet via een
syscall — `load_current_index_checked` en `load_instruction_at_checked` in
`solana-instructions-sysvar` 3.0.1 hebben geen `cfg`-aftakking en geen
`extern "C"`, ze parsen de accountdata. Als de VM die bytes niet vult kan de
hele secp256r1-binding niet werken. Bronketen waarmee dat risico is uitgesloten:

1. LiteSVM vult de account: `utils::construct_instructions_account` roept
   `construct_instructions_data(&message.decompile_instructions())`, owner
   `sysvar`; aangeroepen in `lib.rs:1324-1329`, met verwijzing naar agave
   v4.2.0 `svm/src/account_loader.rs#L613-L618`.
2. De huidige index schrijft LiteSVM zelf niet — geen enkele
   `store_current_index`-aanroep in de crate. Dat is géén gat: die write zit in
   `solana-transaction-context::TransactionContext::push` (agave v4.2.0
   `transaction-context/src/transaction.rs:437-446`), en LiteSVM gebruikt die
   crate.
3. LiteSVM's `message_processor.rs` regel 1: "copied from agave commit
   63b13a1f…", en hij roept `invoke_context.process_instruction(...)` — dezelfde
   push-route als Agave.

Bijvangst uit agave `transaction.rs:415-430`: bij een CPI wordt
`next_top_level_instruction_index - 1` opgeslagen, niet de CPI-index. Voor onze
hook betekent `current_index - 1` dus "de instructie vóór de transfer", precies
waar de precompile moet staan. Wat voorheen een aanname was staat nu op primair
bronmateriaal.

### Mijlpaal 1 — VM en bytecode (`harness/src/bin/smoke.rs`)

| meting | waarde |
|---|---|
| `active_defense.so` laden onder bpf_loader_upgradeable | gelukt, 275.480 byte |
| lege instructie tegen het programma | `Custom(101)` InstructionFallbackNotFound — entrypoint écht bereikt |
| CU-verbruik die mislukte call | 1261 van 200.000 |
| systeemtransfer als referentie | 150 CU |

Het met platform-tools v1.52 gebouwde `.so` wordt geaccepteerd door de SBPF-loader
uit Agave 4.2.2: toolchainpin en runtime hoeven niet op dezelfde lijn te zitten.

### Mijlpaal 2 — de autorisatie-route (`harness/src/bin/hookflow.rs`)

12 stappen, alle groen, exit 0. CU-waarden zijn harness-CU (zie caveat).

| stap | CU / uitkomst |
|---|---|
| createAccount(mint) met hook-ruimte | 150 |
| attach_transfer_hook + secp256r1-precompile | 16.940 |
| mint bevat AD_ID als hook-program | byte-offset 202 |
| ExtraAccountMetaList Execute-discriminator | 51 byte, `69 25 65 c5 4b fb 66 1a` |
| InitializeMint2 op mint mét extensie | 1.777 |
| add_authorized_recipient + precompile | 13.953 |
| ATA's (bron, geautoriseerd, ongeautoriseerd) | 17.268 / 17.369 / 18.869 |
| mintTo 1000 units | 1.533 |
| transferChecked naar geautoriseerde ontvanger | 23.098, hook-log `POISON_TRANSFER_ALLOWED` |
| transferChecked naar ongeautoriseerde ontvanger | `Custom(3012)` AccountNotInitialized |

Bewezen: echte P-256 signatuur door de precompile, challenge-binding via
keccak256(`program_id ‖ wallet ‖ domain ‖ payload`), Token-2022 die zelf de
TransferHook-extensie schrijft, dynamische PDA-resolutie uit het seed-recept
tijdens een echte transfer, en handhaving door PDA-bestaan.

### Drie bevindingen

1. **Een transfer naar een hook-mint moet het hook-programma expliciet als
   account meegeven.** Zonder die account: `Unknown program FzeAZ…` →
   `InstructionError::MissingAccount`. Gemeten, niet vermoed. Onze TS-client doet
   dit al goed (`createTransferCheckedWithTransferHookInstruction` plakt hem
   eraan), dus geen productbug — wel een harde client-contract-eis die nu voor
   het eerst ergens expliciet in een test staat.
2. **Layout-pariteit.** `ExtensionType::try_calculate_account_len::<PodMint>(&[
   TransferHook])` = 234; `verify-poisonToken.ts:135` claimt `POISON_MINT_LEN ===
   234`. Twee onafhankelijke implementaties, dezelfde uitkomst.
3. **Mijn eerste negatieve test was schijn-groen.** Die faalde op het ontbreken
   van het geresolveerde PDA-account, niet op de autorisatie — dus hij bewees
   niets. Pas toen het wél correct afgeleide (maar niet-bestaande) PDA-adres
   meeging stuurt hij op de bedoelde plek: `AccountNotInitialized`. Les die hier
   hoort te staan: een negatieve test die faalt op de verkeerde fout is erger
   dan geen negatieve test.

### Wat hiermee níét bewezen is

* De wallet is handmatig opgebouwd uit de layout in `crates/spankwallet-contract`
  (174 byte, recovery/deposit None, `action_nonce` op 158). Er draait géén
  spankwallet-programma in de harness. Bewezen is de contractkant van
  active-defense, niet de conformiteit van een echte spankwallet-account.
* CU-cijfers zijn harness-CU. Instructie-meting komt uit `solana-compute-budget`
  4.2.2 en deert mee als op mainnet; transaction-overhead in LiteSVM is niet
  identiek aan een echte slot.

### Open punten

1. Handover-punt 3 is nu verifieerbaar gemaakt maar nog niet gefixt: `wallet`
   wordt niet getoetst als spankwallet-PDA-afleiding, `token_mint` niet als
   Token-2022 mint. Beide zijn in deze harness toetsbaar te maken (positief én
   negatief).
2. Wil de harness dichter bij devnet: het echte spankwallet-`.so` ernaast laden
   in plaats van een gefabriceerde wallet-account.
3. Pariteit met devnet is niet gemeten: de harness draait Token-2022 11.0.0
   (LiteSVM-bundeld). Wat er op devnet daadwerkelijk actief is, staat hier niet
   vast.
4. `qwen38-flash-next/` staat nog als lege map in de werkboom.

### Correctie op de CU-tabel hierboven (later op 2026-09-26)

De CU-kolom in de tabel hierboven is **niet reproduceerbaar zoals hij daar staat**.
Over runs heen verschilden `attach_transfer_hook` (18.451 / 16.940 / 22.931) en de
geautoriseerde transfer (23.098 / 35.098). Oorzaak: elke run genereerde nieuwe
keypairs, dus nieuwe adressen, andere PDA-afleidingen en een andere
accountvolgorde in de boodschap. De VM is deterministisch; mijn opstelling was
dat niet. Getallen die je niet kunt narekenen had ik beter niet kunnen printen.

Sinds commit `d48ab95` gebruikt de harness vaste toetsen
(`ad_harness::vaste_toets(seed)`) en vaste stand-in-adressen
(`ad_harness::vaste_adres(markering)`). Twee opeenvolgende runs leveren identieke
output op, behalve cargo's eigen compileertijd. Naverekenbare waarden, gemeten
tegen artefact `active_defense.so`, 275.480 byte, sha256 `32971d30…`:

| stap | CU (vast) |
|---|---|
| createAccount(mint) met hook-ruimte | 150 |
| attach_transfer_hook + secp256r1-precompile | 16.932 |
| InitializeMint2 op mint mét extensie | 1.777 |
| add_authorized_recipient + precompile | 18.555 |
| ATA bron / geautoriseerd / ongeautoriseerd | 17.268 / 17.369 / 17.369 |
| mintTo 1000 units | 1.533 |
| transferChecked naar geautoriseerde ontvanger | 32.098 |
| transferChecked naar ongeautoriseerde ontvanger | faalt op `Custom(3012)` |

De caveat uit de vorige alinea blijft onverminderd staan: dit is harness-CU, geen
mainnet-slotkost. Wat wél veranderd is: de getallen zijn nu een meting in plaats
van een trekking uit een verdeling.

## 38. Welk spankwallet-artifact draagt welk programma-ID, en wat de fixture wel en niet dekt (2026-09-26)

Aanleiding: er circuleren vijf programma-ID's rond dit project en de localnet-
testloop heeft een spankwallet-artifact nodig op een adres dat klopt met wat de
tests verwachten. In plaats van keypair-bestanden of bronregels te geloven is het
artefact zelf ondervraagd: `declare_id!` belandt als byte-literal in de rodata van
het gecompileerde `.so`, dus zoeken naar de 32 bytes van een kandidaat-ID zegt wat
een binary werkelijk draagt.

### Meting

| artefact | grootte | gedeklareerd ID (bytes gevonden) |
|---|---|---|
| `~/projects/spankwallet/target/deploy/spankwallet.so` | 881.984 B | `9ma6vQ…` op offset 805679, één keer |
| `~/.config/active-defense/testfixture/spankwallet-src/target/deploy/spankwallet.so` | 552.280 B | `BUtmiN…` op offset 496318, één keer |
| `~/projects/active-defense/target/deploy/active_defense.so` | 275.480 B | `FzeAZ…` op offset 233879, één keer |

Geen van de drie bevat een van de andere kandidaten (`BUtmiN`, `9ma6vQ`,
`4ywru3z`, `FzeAZ` onderling uitgesloten). De scan is dus discriminerend, niet
slechts aanwezig.

### Verdict

* `9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9` is het **echte**, multisig-
  bestuurde spankwallet-programma: `declare_id!` in hun bron, en hun build-dragers
  bevestigen het.
* `BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk` is de **gepinde testfixture** —
  een geïsoleerde kloon op commit `1fb3134` met een throwaway-keypair, opgebouwd
  door `spankwallet-testfixture/build-and-deploy.sh` (kloon → checkout pin →
  keypad genereren → `sed` op `declare_id!` → build → deploy). De keypair bestaat
  nog en is reproduceerbaar: `~/.config/active-defense/testfixture/spankwallet-throwaway-keypair.json`
  → pubkey `BUtmiN…`.
* Voor onze localnet-loop is `BUtmiN…` dus het juiste doel, met het fixture-`.so`
  van 552.280 byte. Het echte programma hoort daar niet bij: onze tests bedoelen
  expliciet de geïsoleerde kloon.

### Drift tussen fixture en werkelijkheid

`programs/spankwallet/src/state.rs` is tussen `1fb3134` (de pin van fixture én van
onze `crates/spankwallet-contract`) en hun huidige `HEAD` met 349 regels gegroeid.
De veldvolgorde van `WalletAccount` tot en met `session_epoch` is **identiek**; er
zijn drie velden achteraan toegevoegd:

```
spend_threshold_lamports: u64
disarmed: bool
recovery_nonce_snapshot: u64
```

Gevolg voor onze spiegel: de offsets die active-defense leest — `owner_passkey` op
73, de `recovery_state`-tag op 148, `action_nonce` op een variabele offset vóór
`session_epoch` — zijn nog geldig tegen het programma van vandaag. Appending aan
het eind verschuift niets ervoor.

Maar de fixture staat stil op `1fb3134`. Onze fixture-tests kunnen dus nooit zien
dat het echte programma is veranderd, en ze zullen dat ook niet zien als er ooit
vóór `action_nonce` een veld wordt ingevoegd — dan breekt onze spiegel stil. Dat is
precies de foutklasse die dit project al twee keer raakte (sectie 7 en 9), en hij
is nu niet theoretisch: de werkelijke wallet is al drie velden groter dan waar onze
mirror op gebouwd is.

### Twee correcties op mijn eigen beweringen eerder vandaag

1. Ik zei dat "één van de twee fixture-ID's verouderd is". Onjuist. Beide zijn
   betekenisvol en beide correct: `9ma6vQ…` is het echte programma, `BUtmiN…` de
   gepinde kloon. De tests onderscheiden ze al via `SPANKWALLET_REAL_ID` en
   `DEFAULT_TEST_SPANKWALLET_ID` met `SPANKWALLET_TEST_PROGRAM_ID` als override.
2. Ik zei dat bij hun lokale build "een build en een bronverklaring uit elkaar
   lopen", omdat `target/deploy/spankwallet-keypair.json` naar `4ywru3z…` wijst.
   Ook onjuist: hun `.so` draagt `9ma6vQ…`, precies zoals `declare_id!` zegt. Het
   keypair-bestand is achterhaalde rommel (in hun eigen registry staat `4ywru3z…`
   als "tijdelijke declare_id!-ID-swap"), geen afwijking in de build.

### Open punten

1. `7BT258uniN4CCmiqLmvbhFSYoAp6AbAzBtE6WAMuH7GP` staat als
   `~/.config/spankwallet/program-keypairs/active-defense-keypair.json` in hun
   store en is níét onze `FzeAZ…`. Onverklaard; mogelijk een restant van een
   eerdere isolatiepoging.
2. Beslissing nodig: fixture bevriezen op `1fb3134` (contracttest blijft stabiel,
   maar dekt het echte programma niet) of meebewegen (dekt wél, maar elke layout-
   wijziging breekt onze mirror openlijk). Mijn voorkeur: bevriezen vóór de
   contracttest, en er een **tweede** test naast zetten die de mirror toetst aan de
   actuele bron van spankwallet — dan is drift luid in plaats van stil.
3. Die layout-conformiteitstest past in de LiteSVM-harness: wallet-bytes bouwen uit
   de *huidige* veldvolgorde en controleren dat `read_owner_passkey` en
   `read_wallet_action_nonce` nog dezelfde waarden teruggeven.

## 39. Werkende localnet-loop op deze host, zonder publiek netwerk (2026-09-26)

Vier breuken waren nodig voordat deze loop bestond. Drie daarvan stonden niet in
de handover: de ESM-crash in `poisonDecodeProvenance.ts` die het inladen van de
hele suite afbrak (sectie 38's context), het feit dat `anchor test` met exit 0
eindigde ná een fatale RPC-fout, en het ontbreken van enige mocha-assert. De
vierde — hardcoded devnet-endpoints en een eigen keypair-lezing in elke test —
stond er wél, maar met de verkeerde diagnose: het `[provider]`-blok in
`Anchor.toml` wordt door de scripts helemaal niet gelezen.

### Wat er nu staat

* `tests/lib/env.ts`: `AD_RPC_URL` → `ANCHOR_PROVIDER_URL` → devnet, en
  `AD_PAYER` → `~/.config/solana/id.json`. Defaults zijn exact het oude gedrag,
  gemeten en niet aangenomen.
* Vijf scripts omgezet, elk in een eigen commit.
* `--fail-zero` in het test-script, want "0 passing" met exit 0 is geen groen.
* Fee-betaler gescheiden van de upgrade-authority: `localnet-payer-keypair.json`,
  het programmakpair tekent geen transactiekosten meer.

### Reproduceerbaar commando

```bash
# 1. validator (native aarch64, Agave 4.1.2 — ZIE WAARSCHUWING ONDER)
/home/michel/projects/agave/bin/solana-test-validator \
  --ledger /tmp/ad-localnet-ledger --reset \
  --rpc-port 13399 --gossip-port 13301 --faucet-port 13388 \
  --dynamic-port-range 13500-13540 --bind-address 127.0.0.1 --quiet \
  --bpf-program FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK \
      ~/projects/active-defense/target/deploy/active_defense.so \
  --bpf-program BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk \
      ~/.config/active-defense/testfixture/spankwallet-src/target/deploy/spankwallet.so

# 2. fee-payer spijzen
solana --url http://127.0.0.1:13399 airdrop 3 6faFXAjSoQqj4DHvyjw8xEYRA4VEsryvaK2qwnJHgD4A

# 3. één script, expliciet tegen lokaal
AD_RPC_URL=http://127.0.0.1:13399 \
AD_PAYER=~/.config/active-defense/localnet-payer-keypair.json \
node -r ts-node/register tests/activeDefenseFull.ts
```

Poorten 133xx zijn bewust: de andere sessie gebruikt 8899/8001 en soms
8960/8061. `--ws-port` bestaat niet in deze test-validator (clap-fout), ws volgt
de rpc-poort.

### Meting

Validator op slot 822 na ~30 s; beide programma's `executable=true` onder
`BPFLoaderUpgradeable`. Run: exit 0, 17 × ✓, 0 × ✗.

```
Payer      6faFXAjSoQqj4DHvyjw8xEYRA4VEsryvaK2qwnJHgD4A   3,0000 SOL
Wallet PDA 65gNcvbvg3AApcb9QZPTQAPGdi3rPLy4iiMTZiUKsqUS
Mint       C2Syu5mRsxCkppNAcLTGmfwRLHWXvdUjDGLj3Zq3Hs97   mintLen=234
Transfer naar ongeautoriseerde ontvanger: GEBLOKKEERD
    (AccountNotInitialized op de AuthorizedRecipient-PDA)
Transfer naar geautoriseerde ontvanger:   GESLAAGD, saldo 500.000
```

Bewijs dat er geen publiek netwerk bij kwam: payer is de wegwerp-sleutel, het
woord "devnet" komt in de log niet voor, geen enkele 429.

### Waarschuwingen die erbij horen

1. **De vinkjes zijn geen asserts.** 17 `console.log`-regels; `anchor test` als
   suite meldt nog steeds `0 passing`. Deze groen komt van het script direct
   aanroepen. Zolang dat zo is, betekent groen "het script liep uit", niet
   "de eigenschappen gelden".
2. **Eén van de vijf scripts uitgeoefend.** De andere vier zijn alleen omgezet,
   niet tegen localnet gedraaid.
3. **Runtime-versie.** Localnet is Agave 4.1.2; de LiteSVM-harness draait op
   4.2.2-runtime-crates. CU-cijfers tussen die twee zijn niet uitwisselbaar en
   elke meting moet zeggen welke van de twee hij is.
4. **Geheugendruk.** Deze host had tijdens deze run 5,7–6,0 GiB beschikbaar bij
   een draaiende validator van de andere sessie. Twee validators tegelijk kan
   hier, maar het is geen comfortabele marge.

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

## 41. Lek: autorisatie is niet gebonden aan de wallet of de mint-eigenaar (2026-09-26)

Gevonden door `harness/tests/accountmodel.rs`, bewezen in LiteSVM met de `.so`
uit de hoofdwerkboom. Dit is geen theoretisch accountmodel-bezwaar; de aanval
lukt.

### Wat er gebeurt

`add_authorized_recipient` neemt `wallet` als `UncheckedAccount` en controleert
niets aan dat account behalve: lang genoeg, en de passkey op offset 73 heeft een
geldige handtekening op de challenge. Dat is alles. Er wordt niet gecontroleerd
dat het een spankwallet-PDA is, niet dat de eigenaar spankwallet is, en niet dat
de wallet er iets mee te maken heeft.

De test zet een account neer op adres `[0xB1;32]`, eigendom van programma
`[0xB2;32]`, met zelfgebouwde wallet-bytes en de passkey van de aanmaker, en
roept de instructie aan voor een mint `[0xC1;32]` die aan niemand toebehoort.

```
test vervalsd_wallet_account_autoriseert_ontvanger_op_vremde_mint ... ok
```

Daarna bestaat de PDA `[poison_authorized, mint, recipient]`.

### Waarom dat ernaast neer komt

De volledige autorisatie in de hook is één accountconstraint (uit
`programs/active-defense/src/instructions.rs`):

```rust
#[account(seeds = [POISON_AUTHORIZED_SEED,
                   token_mint.key().as_ref(),
                   destination_token_account.owner.as_ref()], bump)]
pub authorized_recipient: Account<'info, AuthorizedRecipient>,
```

De handler-body doet niets behalve loggen. Autorisatie is dus: *die PDA bestaat*.
De seed bevat mint en bestemmings-eigenaar — **de wallet komt er niet in voor**.

Gevolg: wie als eerste `[poison_authorized, M, R]` aanmaakt, bepaalt of
overdrachten van mint `M` aan eigenaar `R` doorgaan. Een derde kan dat voor
iemands anders mint doen. De garantie "deze ontvanger is door de wallet-eigenaar
toegestaan" bestaat niet.

Drie gevolgen, oplopend in ernst:

1. **Namespace-gijzeling.** De echte eigenaar kan een bezette `(mint, recipient)`
   niet meer autoriseren — `init` faalt, de PDA is al weg.
2. **Consent-vervalsing.** Wie deze PDAs leest als bewijs van toestemming, leest
   iets dat door om het even wie neergezet kan zijn.
3. **De poison-bescherming zelf.** Een dief die gestolen poison-tokens bezit,
   kan zichzelf als ontvanger autoriseren op de mint van het slachtoffer en ze
   dan verplaatsen. De bescherming waar dit hele programma voor bestaat, is dan
   per `(mint, ontvanger)` uit te schakelen door eenieder die bereid is de kosten
   te dragen.

### Wat de test níét bewijst

- **De kosten op mainnet.** Een account met willekeurige bytes vereist een
  programma dat ze schrijft; een eigen programmdeploy kost op mainnet rent van
  rond de 0,57 SOL. Niet gemeten, alleen beredeneerd. Op devnet vrijwel gratis.
- **Een echte spankwallet-wallet.** In de test is de wallet gefabriceerd. Met een
  *legitieme* eigen wallet lukt dezelfde aanval ook — de instructie vraagt immers
  nergens naar een relatie tot de mint. Dat is zelfs de eenvoudigere variant.
- **De hook zelf.** De `source_token_account`/`owner`-posities van
  `PoisonTransferHook` zijn nog steeds ongetypeerd (eigen commentaar in de bron:
  "niet vandaag aangepakt"). Een rechtstreekse aanroep van de hook verplaatst
  overigens geen tokens — de hook geeft alleen toestemming terug aan Token-2022.

### Wat er wél degelijk is

De tegenpool-test draait mee en slaagt: een handtekening over een ándere mint dan
de instructie doorgeeft wordt geweigerd met `WebAuthnChallengeMismatch` (6002).
Challenge-binding, nonce-binding en secp256r1-verificatie zijn dus in orde. Het
gat zit uitsluitend in de vraag *wiens* wallet er staat.

### Voorgestelde reparatie, nog niet uitgevoerd

1. `wallet.owner` moet spankwallet zijn, en de PDA-adres herself afleiden uit het
   `seed_key`-veld in de accountdata (`find_program_address(["wallet",
   sha256(seed_key)], SPANKWALLET_ID)`) en aan `wallet.key()` toetsen. Dat sluit
   gefabriceerde accounts uit.
2. Autorisatie binden aan de mint: in `add_authorized_recipient` controleren dat
   de wallet overeenkomt met de transfer-hook-authority van de mint. Alleen wie de
   hook van een mint bestuurt, mag ontvangers voor die mint toestaan.
3. Overwegen de wallet-key in de PDA-seed van `AuthorizedRecipient` op te nemen,
   zodat autorisaties per wallet staan. Dat is een brekende wijziging van het
   PDAschema en raakt de hook-resolutie; apart te beslissen.

Punt 1 is klein en sluit de aanval. Punt 2 is de eigenlijke semantische reparatie.

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


## 47. FF-reconciliatie, artefactidentiteit, OPEN #1 gemeten, en een STATUS-herstel (2026-09-29)

De handoff van 2026-09-25 claimde §41–§46; in deze checkout (`main`) stond alleen
§38. Meten voorstellen: `git merge-base --is-ancestor main agent/harness` → JA, en
`git worktree list` toont een tweede werkboom
(`/home/michel/projects/active-defense-harness`, `agent/harness`). De claims kloppen
dus — maar wonen op de branch. Op jouw woord is `main` fast-forward naar `564227b`
(lokale FF, geen push).

### Artefactidentiteit vóór en na de herbouw

De `.so` in `target/deploy` was van 1 sep — pre-fix-2. Behouden als
`active_defense.pre-fix2-6e51720.so`, daarna herbouwd met `./build-sbf.sh`
(platform-tools v1.52, §30). Bytescan op de Fix-2-identiteit, niet aannames:

| artefact | grootte | sha256 (16) | "Only the wallet that attached" | `mint_owner` | `wallet_config` |
|---|---|---|---|---|---|
| nieuw | 318 136 B | `3d5b1a91e800bb38` | 1× | 1× | 1× |
| pre-fix2 | 275 480 B | `32971d30b65aeda3` | 0× | 0× | 0× |

Baseline op de nieuwe `.so`: `accountmodel.rs` 12/12 groen,
`layout_conformance.rs` 6/6 groen, hookflow 13 stappen groen. CU-reconciliatie met
de handoff: attach **40543** (handoff 40134, klopt binnen ruis; pre-fix2 was 16932),
`set_wallet_program` 13085, `add_authorized_recipient` 30502, transferChecked-hook
32101 (handoff 32098).

### OPEN #1 gemeten: de koppeling is eerste-wins (`harness/tests/open1.rs`)

Post-establish was al gedekt (`koppeling_is_schrijf_een_keer`: tweede attach faalt).
Wat gemetens moest worden was de andere volgorde — Y vóór X, op een verse mint met
hook-ruimte die door X' kant is aangemaakt maar nog niet ge-attach:

| stap | meting |
|---|---|
| S1 Y attach vóór X | **TOEGESTAAN**; `MintOwner.wallet = Y` (uit de 73-byte account-data gelezen) |
| S2 X attach ná Y | geweigerd, `InstructionError(1, Custom(0))` — het `init`-verbod van Anchor, níét Token-2022 |
| S3 Y authoriseert ontvanger op X' mint | **TOEGESTAAN** — de binding geeft recht |
| S4 X authoriseert op eigen munt | geweigerd, `Custom(6014)` |

Conclusie: fix 2 sluit de deur na het establishen, maar tussen mint-aanmaak en
attach van X zit een venster waarin élke legitieme wallet de koppeling claimt —
zonder enige autoriteit over de mint (S1 slaagt zonder handtekening van X). De
claimer krijgt daarmee de autorisatielijst van die mint, permanent: X kan de hook
nooit meer zetten (`init` bezet) en wordt op `add` met 6014 geweerd.

### Het besluit dat hierbij hoort en niet bij mij ligt

Drie routes, elk met een ander aannames-pakket — jouw keuze:

1. **Cliënt-kant, atomisch:** `createAccount` + `attach_transfer_hook` +
   `InitializeMint2` in één transactie. Dan bestaat er on-chain geen venster tussen
   aanmaak en binding. Geen programmawijziging; wel een runbook-/clientplicht.
2. **Programma-kant, binden aan de mint-maker:** attach eist de handtekening van de
   keypair die de mint-account aanmaakte. Sluit het venster ook tegen een aanvaller
   die sneller is dan de cliënt, maar verandert de accountstructuur en raakt de
   deploy-stroom.
3. **Accepteren en documenteren:** eerste-wins ís het claimmechanisme; het deploy-
   runbook garandeert de volgorde.

### STATUS-herstel (regel 5 toegepast)

Bij het FF viel op dat `STATUS.md` op de branch sinds §39 bij elke commit was
VERVANGEN door alleen de nieuwe sectie (77/65/90/70/74/60/79/27 regels per commit);
in de werkboom stond na de FF dus alleen §46. Iemands tekst was aan het verdwijnen.
Mechanisch hersteld per regel 5 ("beide houden"): base `6e51720` (§1–§38) +
§39 `c5bfbe94` + §40 `7a7ece5b` + §41 `539a20df` + §42 `098cf9d2` + §43 `206a2981` +
§44 `8f9a6166` + §45 `c479c30d` + §46 (werkboom), in volgorde geconcateneerd, geen
enige sectie herschreven. Resultaat: 3862 regels, koppen 1–46 (de dubbele §30-kop
komt uit `main` zelf en is niet aangeraakt).

### Wat er nu open staat

- OPEN #1 is beantwoord (eerste-wins) maar het mitigitiebesluit hierboven is nog niet genomen.
- OPEN #3: `scripts/controle.sh` (vingerafdruk van `.so` ↔ broncommit ↔ ID op devnet).
- OPEN #4: runbook — `set_wallet_program` één keer per cluster, en (bij route 1) de atomiciteitsplicht.


## 48. Route 1 gemeten: bij een atomische cliënt is het venster dicht (2026-09-29)

§47 liet de keuze tussen drie routes; voor route 1 (`createAccount` +
`attach_transfer_hook` + `InitializeMint2` in één transactie) hoefde geen enkele
aanname te blijven staan — `harness/tests/atomiciteit.rs` zet alles in één boodschap
en laat de aanvaller daarna daadwerkelijk proberen:

| stap | meting |
|---|---|
| A1 atoom: create + attach + InitializeMint2 | **OK, 42484 CU** (één transactie) |
| METING `MintOwner.wallet` | = wallet X |
| A2 Y claimt in een latere transactie | geweigerd, `Custom(0)` — het `init`-verbod |
| A3 X authoriseert / A4 Y authoriseert | X OK; Y geweigerd, `Custom(6014)` |

De redenering die hiermee opgehouden heeft een aanname te zijn: tussen de
aanmaak van de mint en de binding bestaat geen window meer waarin een losse
transactie kan binnenglijden — vóór de atoom bestaat de mint niet, erna is
`MintOwner` bezet. De volgorde binnen de boodschap is geen smaak: extensie-init
vóór `InitializeMint2` (programma-document, hookflow stap 3) en de secp256r1-
precompile direct vóór attach (het programma leest index-1).

### Wat dit níét dekt

De meting geldt voor een cliënt die atoom bouwt. `client/src/poisonToken.ts` doet
dat nog niet — dat is de volgende werkstap, geen zekerheid die hier al bestaat. En
een integrator die een eigen flow bouwt houdt het venster uit §47 open; route 2
(attach binden aan de handtekening van de mint-maker) blijft daarmee een bewuste,
uitgestelde optie en geen vergeten punt.


## 49. `scripts/controle.sh`: artefactvingerafdruk als commando (2026-09-29)

§47 ontmaskerde de Sep-1 `.so` met een handeling: hashen, scannen, vergelijken.
Die handeling is nu `scripts/controle.sh`, want "eraan denken om te hashen" is geen
controle. Vijf checks, fail-zero (onbekend ≠ groen, dezelfde les als `--fail-zero`
uit `bff02c4b`):

1. `.so` bestaat en komt overeen met een **bekende** build (sha → label; onbekende
   sha = rood, niet "even doorlopen").
2. Geen enkele programmaregel nieuwer dan de `.so` — de verspreiding die ik zelf
   overkwam.
3. Programma-ID uit `Anchor.toml` == ID uit het programmakpair (`solana-keygen pubkey`).
4. Git-identiteit: HEAD, en of `programs/` vuil is (dan kan de `.so` van geen
   beide commits kloppen).
5. Optioneel `--cluster <url>`: gedeployde programdata-lengte tegen lokale `.so`.
   Zonder vlag staat er expliciet "overgeslagen … géén bevestiging".

Gemeten, inclusief de faal-pad (een script dat alleen groen kan zeggen is geen
controle): met de verouderde `.so` teruggezet op zijn plek geeft het script
**exit 1** met twee onafhankelijke gronden — `VEROUDERD` (check 1) én
`lib.rs is nieuwer` (check 2). Daarna hersteld (`sha 3d5b1a91…` gecontroleerd) en
draait het weer groen, exit 0.

### Eigen fout, opgetekend zoals hij is

Bij het schrijven van deze sectie kapte ik `STATUS.md` zelf af tot 25 regels:
`open(p,'w').write(open(p).read() + …)` evalueert de write-modus vóór de read,
dus de inhoud was al weg voordat hij gelezen werd. De commit die dat bevatte is
lokaal en ongepusht; hersteld uit `4803da8` en geamendeerd. Precies dit soort
handelingen is waarom secties onschendbaar zijn en waarom check 2 hierboven bestaat.


## 50. Deploy-runbook; OPEN #4 gesloten als document, niet als zekerheid (2026-09-29)

`notes/RUNBOOK-deploy.md` is er: zes stappen van `controle.sh` tot post-deploy-bytescan,
elke met de gemreden en de sectie waarin hij gemeten is. Het runbook is geen nieuw
bewijs — het bundelt wat §30, §38, §42/§43, §46, §47 en §48 al zeiden, in de volgorde
waarin je erachter komt als je het zélf doet.

Eén regel daarin verdient het om hier te herhalen, want hij is een plicht en geen
geruststelling: **`client/src/poisonToken.ts` bouwt de atoom-transactie uit §48 nog
niet.** Tot die wiring bestaat is "het venster is dicht" alleen waar voor wie het
runbook handmatig opvolgt. OPEN #4 is daarmee gesloten als documentatie; het werk dat
eruit voortvloeit (cliënt-wiring, en route 2 zodra derden een eigen flow krijgen)
staat open in §47/§48.


## 51. Route 1 zit in de cliënt; het claim-venster is gemeten op een echte validator (2026-09-29)

`client/src/poisonToken.ts` krijgt `buildAtoomPoisonMintTx(...)`: één transactie met
createAccount → secp256r1 → `attach_transfer_hook` → InitializeMint2. De builder kan
zelf niet signeren (de passkey tekent buiten de client), dus hij neemt de
handtekening-materialen aan en zet wél de volgorde vast die het venster sluit — de
precompile direct vóór attach, `InitializeMint2` als allerlaatste (§7).

`tests/poisonAtoomIsolated.ts` meet dat op localnet, door de bibliotheek heen en via
twee échte `init_wallet`s op de fixture (geen `setAccount`-kruierwerk):

| stap | meting |
|---|---|
| A1 atoom via de client | **geslaagd**, 4 instructies in één boodschap |
| METING `MintOwner.wallet` | = wallet X (uit het account gelezen, niet afgeleid) |
| A2 Y claimt later | geweigerd, en **geattribueerd**: de handler draait (`AttachTransferHook` in de logs) en de `init` van MintOwner botst (`Custom(0)`) |
| A3 X authoriseert / A4 Y | X toegestaan; Y geweigerd met **6014** (`0x177e`) |
| navraag | mint `isInitialized`, decimals 6, hook → `FzeAZm…` |

### De testfout die ik zelf maakte, en wat fail-zero ving

Eerste run: A1–A3 groen, A4 **rood** — `Custom(0)` in plaats van de verwachte 6014.
Mijn fout: A3 en A4 deelden één `recipient`, dus A4 botste op de `init` van de
AuthorizedRecipient-PDA die A3 net had aangemaakt. Anchor evalueert account-constraints
in declaratievolgorde, dus die botsing (index 3) valt vóór de `mint_owner.wallet ==
wallet`-check (als laatste) — ik meette toen de PDA-botsing en noemde het per ongeluk
bewijs voor de binding. Met twee verse recipients is A4 wat hij moet meten: 6014.

Twee lessen, beide al eerder opgetekend en weer van toepassing: een assertie op het
*foutnummer* is geen chicanerie maar de enige manier om attributie te bewijzen (§47),
en "groen" zonder dat je weet wat er gemeten wordt is geen groen (`--fail-zero`, `bff02c4b`).

`client/src/verify-poisonToken.ts` en `tsc --noEmit` draaien schoon; het runbook is
aangepast waar het "de client bouwt die ene transactie nog niet" zei — die plicht
bestaat niet meer, en een valse plicht in een runbook is gevaarlijker dan geen plicht.

Daarmee is route 1 uit §47 gesloten van harness tot cliënt tot validator. Route 2
blijft, zoals afgesproken, een bewuste uitgestelde optie tot derden een eigen flow krijgen.


## 52. Drie dingen waardoor "groen" weer iets betekent (2026-09-29)

**A1 — back-up.** 38 commits bestonden alleen op deze machine. Teruglopen op
`origin/main` gaf 0 achterstand, dus puur vooruit duwen: `38290bc..820e72d`, daarna
`git rev-list --count origin/main..main` = 0.

**A2 — CI.** Het template in `.github/workflows/rust.yml` draaide `cargo build` +
`cargo test` op de workspace. Gemeten: die workspace (programs + spankwallet-contract)
bevat **nul** `#[test]`-functies, en de harness is géén workspace-lid — de pipeline
kon dus per constructie niet falen. Bovendien had hij op geen van die 38 commits
gedraaid, omdat er niets gepusht was. Nieuwe `.github/workflows/ci.yml` (template
verwijderd): Agave gepind op de lokaal gemeten versie (solana-cli 4.1.2 /
cargo-build-sbf 4.1.0) → `./build-sbf.sh` (platform-tools v1.52, §30) →
`controle.sh --nieuw-artefact` → host-build → **de LiteSVM-tests zelf**
(accountmodel 12, open1 1, atomiciteit 1 — draaiden lokaal groen met exact dit
commando) → `npm ci` + `tsc --noEmit` + `verify-poisonToken.ts`. Als laatste stap
een blok "wat deze CI NIET dekt": `layout_conformance.rs` (extern fixture-bestand),
de TS-suite met validator, en elke deploy.

Daarvoor kreeg `controle.sh` een `--nieuw-artefact`-vlag: op een bouw-agent is elke
sha per definitie nieuw, dus check 1 mag daar niet falen — checks 2 t/m 4 wél.
Gemeten dat dit het script niet tandloos maakt: met de verouderde `.so` teruggezet
op zijn plek geeft het ook mét de vlag **exit 1**.

**A3 — de atoomtest de suite in.** `npm test` roept nu zeven scripts (was zes).
`poisonAtoomIsolated.ts` kreeg een wachter: hij schrijft wallets, mints en PDAs, dus
op een publiek netwerk is dat geen test maar gebruik. Gemeten zonder `AD_RPC_URL`
(de default wijst naar devnet): exit 1, **met nul verzoeken** — de wachter staat vóór
`new Connection(...)`. Bewust publiek kan met `AD_TAST_PUBIEK=1`.

Gevolgen van deze keuze, expliciet: `npm test` is nu **rood** tenzij `AD_RPC_URL` naar
een localnet wijst. Dat is opzettelijk (fail-zero, §49), maar het verandert wat het
commando voor je deed — wie de oude devnet-gang wil, zet `AD_TAST_PUBIEK=1` of draait
de eerste zes los. De overige zes scripts hebben die wachter níét; dat is een open
punt, geen verandering van vandaag.


## 53. De eerste echte CI-run was rood, en dat was mijn bug (2026-09-29)

De nieuwe pipeline draaide (run 36716576829) en viel op de derde stap:
`scripts/controle.sh: line 42: NIEUW: unbound variable`. Oorzaak: ik had de
argumentverwerking bij check 5 gezet, maar `$NIEUW` wordt al bij check 1 gelezen; met
`set -u` is dat een afbreker.

Erger dan de bug is waarom mijn eigen tests hem misten: zowel de normale run als de
negatieve test gebruikten een **bekende** sha, dus de tak die `$NIEUW` leest werd
nooit genomen. Ik had het script getest op de paden die ik al kende, niet op het pad
dat de CI zou bewandelen — dezelfde blinde vlek als de mocha-suite met nul asserts.

Daarnaast was er een tweede, ontwerpmatige oorzaak op komst: op een bouw-agent staat
het programmakpair bewust niet (en `cargo-build-sbf` maakt het ook niet aan), dus
check 3 zou daar hoe dan ook falen. In `--nieuw-artefact`-modus is check 3 nu een
luide, expliciete overslaging ("dit is géén bevestiging van de ID-koppeling") in
plaats van een groene vlek; op een werkboom met echt keypair blijft elke mismatch rood.

Pad-matrix, gemeten na de fix (met herstel en sha-verificatie van het artefact):

| combinatie | exit | reden zoals getoond |
|---|---|---|
| bekende sha, geen vlag | 0 | — |
| bekende sha, `--nieuw-artefact` | 0 | — |
| **onbekende sha, geen vlag** | **1** | "staat in geen enkele bekende build" |
| onbekende sha, `--nieuw-artefact` | 0 | "geaccepteerd als nieuw artefact" |
| onbekend, vlag, keypair afwezig | 0 | ID-check overgeslagen (gemeld) |
| verouderde sha, `--nieuw-artefact` | **1** | "dit is een verouderde .so" |

Terzijde, niet verzwegen: de CI-bouw produceerde sha `4fc06be5…`, niet de lokale
`3d5b1a91…`. Bouwen is hier niet byte-reproduceerbaar over machines heen — nog een
reden waarom "dezelfde commit" geen identiteit is en een vingerafdruk wél (§47).

Tot slot: `git add -A` nam onbedoeld ook `notes/HANDOVER-2026-09-25.md` mee (104
regels, jouw handover-notitie die ik bewust ongetrackt had gelaten). Die staat nu in
`a6e98fd` op `origin`. Inhoudelijk onschadelijk, maar het was niet mijn keuze.


## 54. `cargo build-sbf` maakt een programmakpair aan dat er autoritatief uitziet (2026-09-29)

Tweede rode CI-run, andere oorzaak — en de interessantste van de twee:

```
== 3. programma-ID ==
  Anchor.toml   FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK
  keypair       2XXXFnLBfpAgSZUw1onHiXo1ZwA1BtsrKkTkw5pR9zyJ
  FAAL Anchor.toml en programmakpair wijzen verschillende ID's
```

`cargo build-sbf` **genereert** `target/deploy/active_defense-keypair.json` als die
ontbreekt. Het bestand ligt op de plek waar het echte, upgrade-bevoegde keypair hoort,
het is leesbaar met `solana-keygen pubkey`, en het wijst naar een willekeurig ander
programma. Op mijn werkboom is het een symlink naar `~/.config/active-defense/...` en
klopt het; op een verse bouw-agent is het een toevalsexemplaar. Iemand die zo'n boom
gebruikt om te deployen, wijst naar een ander programma — of denkt dat hij upgradet.

De fix is niet de check verzachten (die deed precies zijn werk), maar de omgeving eerlijk
verklaarden: CI verwijdert het gegenereerde bestand expliciet en meldt afwezigheid met
`--geen-sleutel`. Nieuwe semantics in `controle.sh`, allemaal gemeten:

| toestand | vlag | uitkomst |
|---|---|---|
| keypair aanwezig, consistent | — | groen |
| keypair aanwezig, ander ID | — | **rood** (de CI-vondst) |
| keypair aanwezig | `--geen-sleutel` | **rood** — contradictie, geen sluipweg |
| keypair afwezig | `--geen-sleutel` | groen, met luid "géén bevestiging van de ID-koppeling" |
| keypair afwezig | — | **rood** |

De regel die hieruit volgt en die ik in het runbook thuishoort: een
`target/deploy/*-keypair.json` die je niet zelf hebt neergelegd, is geen identiteit.


## 55. "Groen" zegt nu wat het dekt (2026-09-29)

De eerste groene CI-run (36721927492: 14 harness-tests, `verify-poisonToken` geslaagd,
controle-stap groen) eindigde met de zin "artefact, bron en ID zijn één" — in een run
waarin de ID-check was overgeslagen. Dat is precies de groen-zonder-betekenis die dit
project al drie keer op het verkeerde been zette (§38 nul asserts, `bff02c4b`
`--fail-zero`, §52 onbekende sha).

`controle.sh` onderscheidt daarom twee soorten niet-controleren: een **materiële**
overslagging (de ID-koppeling) kleurt het oordeel — `CONTROLE GROEN MET OVERSLAGINGEN`,
ID "NIET bevestigd" — terwijl een niet gedane clustercheck een optie blijft en alleen
onderaan staat. Gemeten op beide toestanden: werkboom met keypair → volledige groen;
CI-achtig zonder keypair → groen met overslagging, exit 0, geen valse claim.


## 56. Dependency-schuld opgemeten, niet weggeklikt (2026-09-29)

GitHub meldde vier dependabot-alerts, `npm audit` acht. Het verschil bleek relevant:
drie daarvan zijn **Rust**-crates en zitten volgens `cargo tree -i` uitsluitend in de
harness (`litesvm → agave-precompiles → ed25519-dalek 1.0.1 / curve25519-dalek 3.2.0`),
niet in de boom van het programma. Het gedeployde programma raakt ze dus niet; `cargo
update` kan ze ook niet optillen want de parent pind 1.x.

| melding | staat in | status |
|---|---|---|
| ed25519-dalek 1.0.1 (CVE-2022-50237, medium) | alleen harness | niet oplosbaar vanaf onszelf; niet bereikbaar uit het programma |
| curve25519-dalek 3.2.0 (CVE-2024-58262, low) | alleen harness | idem |
| rand (low) | alleen harness | idem |
| bigint-buffer (high, buffer overflow in `toBigIntLE`) | npm, via `@spl-token/buffer-layout-utils` | **geen gepatchte versie bestaande**: aangetast `<=1.1.5`, 1.1.5 is de hoogste publicatie |
| stream-json (moderate, DoS) | npm, via `jayson` | zie hieronder |

Wat wél gebeurde: `@coral-xyz/anchor` en `bn.js` stonden als direct dependency maar worden
**nergens geïmporteerd** (met de hand nagelopen over client/, tests/, scripts/) — weg ermee,
wat zes meldingen wegnam. Daarna `npm audit fix` zonder force: 8 → 6 → 5.

Twee dingen die ik probeerde en terugdraaide op grond van meting:

1. Een `overrides`-blok dat `stream-json` naar `^3.7.0` tilt (de advisory zegt `<=3.4.0`).
   In onze boom staat stream-json op **1.9.1** en die override trok een andere versielijn:
   het aantal meldingen ging van 5 naar **10**. Teruggedraaid.
2. Daarna `npm install` op de teruggedraaide `package.json`: dat herresolveerde de hele
   boom en bracht `mocha → serialize-javascript` en `uuid` terug (8 meldingen). De les is
   dezelfde als bij het artefact: tussenstanden die je niet uit een vast punt reproduceert,
   zijn geen metingen. Teruggezet naar `git HEAD` en de twee ingrepen één voor één gemeten.

Gedragsonderzoek na de wijzigingen — niet alleen statisch: `tsc --noEmit`, `verify-poisonToken`
en de provenance-scan groen, en op een echte validator `attachTransferHookIsolated.ts`
(haakregistratie + resolutie + echte transfer) en `poisonAtoomIsolated.ts` (A1–A4) beide
groen. Reststand: 3 high (de `bigint-buffer`-keten, geen patch beschikbaar) en 2 moderate
(`jayson`/`stream-json`, alleen oplosbaar door majors van `@solana/web3.js` aan te raken).

Bijvangst: `attachTransferHookIsolated.ts` G3 schrijft dat een geslaagde transfer "onverwacht,
dat kan pas na stap 4" is — stap 4 is inmiddels gebouwd, dus die verwachtingstekst is onwaar
geworden. De test faalt er niet op, maar het is een leugen in een testuitvoer en staat op de
lijst voor B6.


## 57. Drie ongemeten paden, gemeten — en een handtekening die niet eenmalig is (2026-09-29)

`harness/tests/coverage.rs` (3 tests, draaien in ~0,3 s, opgenomen in de CI-reeks).

**M1 — wat de nonce-wacht werkelijk doet.**

| deelmeting | uitkomst |
|---|---|
| M1a instructie met nonce+1 | geweigerd: `Custom(6010)` = `StaleActionNonce` |
| M1b wallet-nonce vóór / na een geslaagde AD-instructie | `1 → 1` — **active-defense verhoogt de nonce niet** (het WalletAccount is van SpankWallet, AD mag er niet schrijven) |
| M1c zelfde instructiebytes in een andere omhullende transactie | geweigerd: `Custom(6006)` = `AddressAlreadyMalicious` — **structureel**, niet door versheid |
| M1d na `unmark` (teller terug naar 0) dezelfde onderschepte bytes opnieuw | **TOEGESTAAN** |

Conclusie, zuiver opgemeten: een WebAuthn-handtekening op een AD-instructie is **geen
eenmalig verbruiksartikel**. De nonce-wacht vergelijkt alleen met de wallet-eigen teller;
verbruik wordt nergens bijgehouden. Dat het vandaag niet misbruikt kan worden, komt doordat
elke instructie zijn eigen structurele botsing heeft (PDA `init`, adres-al-markering,
eerste-wins op `MintOwner`). Zodra die staat terugvalt — hier: een unmark — herleeft de
handtekening. Een toekomstige instructie zónder zo'n botsing (een teller, een "verwijder
alles", een drempel) is direct speelbal.

*Wat ik er niet heb aangepast:* een eigen nonce-verbruik per wallet (een AD-PDA die het
laagste ongebruikte nummer bijhoudt) is de logische reparatie, maar dat is een
interface-wijziging met een nieuw account — voorstelbaar, niet unilateraal doorgevoerd.

**M2 — fail-closed zonder vertrouwensconfig.** `mark_malicious` in een context zonder
`set_wallet_program`: geweigerd met `Custom(3012)` (Anchor: *"the program expected this
account to be already initialized"*), en er ontstond géén MaliciousAddresses-account. De
config-check uit stap 3 is dus geen decoratie.

**M3 — plafond.** 32 markeringen slagen, count = 32; het 33e adres geeft `Custom(6007)` =
`MaliciousListFull`. Het vaste account is dus een afgedwongen limiet, geen stille afkap.

**Twee meetfouten die ik zelf maakte, want ze zijn de les:**

1. De eerste M1c zond de transactie gewoon opnieuw en zag `AlreadyProcessed`. Dat is
   LiteSVM's dedup op signatuur — `warp_to_slot` verandert hier de blockhash niet — dus die
   meting ging over de VM, niet over het programma. Replay namaken doe je zoals een
   aanvaller: zelfde instructiebytes, andere omhullende transactie (hier: een extra
   nul-transfer erbij).
2. Mijn geraden accountlijst voor `unmark_malicious` bevatte een payer-account die er niet
   hoort; daardoor schoof alles op en kreeg ik `AccountOwnedByWrongProgram` op `config`.
   De lijst staat nu in de test geciteerd uit `buildUnmarkMaliciousIx` — de cliënt is hier
   de waarheid, niet mijn geheugen.


## 58. Artefactidentiteit verhuist van geheugen naar bestand (2026-09-29)

`controle.sh` kende zijn builds uit een `case`-blok — handig tot de derde bouw, daarna
een placehouder voor iets wat je uit het hoofd moet weten. De tabel staat nu in
`notes/ARTEFACTEN.md` (sha · bytes · label · bron-commit · status), met instructies om er
een rij aan toe te voegen, en het script leest hem. Gemeten na de verhuizing: bekende sha
→ groen met label uit het bestand; onbekende sha → rood; onbekende sha met
`--nieuw-artefact` → groen met melding; **tabel weg → rood** ("zonder tabel is een sha
geen identiteit").

De tabel bevat nu ook de CI-bouw `4fc06be522fe8bbc` naast de lokale `3d5b1a91e800bb38`:
twee byte-stromen voor dezelfde bron, wat het punt van §54 is — bouwen is hier niet
byte-reproduceerbaar, dus identiteit vraagt een registratie, geen herinnering.


## 59. Route 2: wanneer hij nodig is, en waarom de voor-de-hand-liggende versie niet kan (2026-09-29)

**Trigger (de voorwaarde waarop uitstel ophoudt uitstel te zijn):** zodra een derde een eigen
mint-flow krijgt die níét door `buildAtoomPoisonMintTx` gaat. Route 1 sluit het venster
namelijk alleen voor onze eigen cliënt; het programma zelf staat nog steeds toe dat wallet Y
een bestaande, nog niet ge-attachte mint claimt (gemeten: §51 A2 op localnet, `open1.rs` in
de harness).

**Waarom "bind attach aan de mint-maker" niet werkt.** De gedachte is: eis bij `attach_transfer_hook`
een handtekening van de eigenaar van de mint. Maar op dat moment is de mint nog niet
geïnitialiseerd — `InitializeMint2` is juist de allerlaatste stap (§7), dus er bestaat géén
`mintAuthority` om tegen aan te lopen. Gemeten in de cliënt: `createInitializeMint2Instruction(..., p.mintAuthority ?? p.payer, ...)`
bestaat pas ná attach. Een check op een niet-bestaande autoriteit is geen check.

**Wat wél kan (schets, niet gebouwd):** het programma leest al de instructions-sysvar (voor de
secp256r1-precompile). Een attach-instructie zou daarin mogen eisen dat **dezelfde transactie**
een `createAccount` voor precies deze mint bevat, ondertekend door dezelfde sleutel die het
wallet-account beheerst. Daarmee wordt "ik claim een mint die ik niet zelf heb gemaakt"
onmogelijk in plaats van alleen onwaarschijnlijk. Kosten: sysvar-parsing wordt uitgebreid, de
cliënt moet de volgorde blijven garanderen, en alle attach-tests (harness + TS) moeten meelopen.

**Besluit:** niet bouwen vóór de trigger. Wel vastleggen dat route 1 een *cliëntcontract* is,
geen programma-garantie — en dat elk integratiepunt dat contract dus zelf moet naleven.

## 60. Eén keypair, twee onomkeerbare machten (besluitmemo, 2026-09-29)

Twee dingen in dit systeem zijn eenrichtingsverkeer:

1. **De vertrouwensconfig** (`set_wallet_program`) is write-once (§43). Fout zetten = programma
   herprogrammeren of een nieuwe ID.
2. **De upgrade-autoriteit** van het BPF-account is één keypair (§3). Wie die heeft, kan de code
   onder `FzeAZm…` vervangen — en dat is het programma dat bij elke Token-2022-transfer van
   vergiftigde assets beslist of een bestemming mag ontvangen.

De combinatie is de reden dat dit een memo is en geen voetnoot: één gestolen bestand geeft een
aanvaller de macht om *achteraf* de transfer-regels te herschrijven, zonder dat iemand daar
over stemt. Er is geen `upgrade`-instructie in ons eigen programma nodig om dat te doen; het
is loader-beleid, dus migreren is ook loader-beleid: `solana program update-authority` naar een
multisig-account, zonder code-wijziging en zonder nieuwe deploy.

Opties, met wat ze kosten:

| optie | wat het doet | kosten / risico |
|---|---|---|
| A. blijft één keypair | niets | acceptabel op localnet/devnet; op mainnet is dit een enkele aanvalskans op de transfer-logica |
| B. `spl-multisig` m-van-n (bijv. 2-of-3) | autoriteit gaat naar een multisig-account; elke upgrade heeft m handtekeningen | eenmalige overdracht, sleutelverdeling regelen, verliesrisico van n sleutels |
| C. governance-programma (Squads e.d.) | multisig plus procedure/timelock en audit-spoor | zwaarder gereedschap, meer bewegende delen, afhankelijkheid van dat programma |

**Aanbeveling:** B vóór elke mainnet-zet, met de write-once config ná de overdracht (eerst de
autoriteit borgen, dan pas onomkeerbaar zetten). Devnet mag op A blijven staan; daar is een
fout geen verlies. **Besluit van jou nodig**, want het raakt wie er straks "ja" moet zeggen.

## 61. Devnet: gemeten staat en de twee poorten die op jou wachten (2026-09-29)

Read-only gepeild met `controle.sh --cluster https://api.devnet.solana.com`:

| check | uitkomst |
|---|---|
| lokaal artefact | `3d5b1a91e800bb38`, bron niet nieuwer, ID-koppeling klopt (Anchor.toml = keypair) |
| programma op devnet | **bestaat niet** — "geen programdata-length voor `FzeAZm…`" |
| fee-payer (`AD_PAYER` default) | **0 SOL op devnet** |

Dus B5 is geen verificatie maar de eerste deploy, en die kost ≈0,22 SOL aan programma-data-rent
plus buffer/fees (ruw geschat 0,45 SOL). Twee poorten die ik niet door stap zonder jou:

1. **Betaling**: devnet-lucht of een storting naar `6faFXAjSoQqj4DHvyjw8xEYRA4VEsryvaK2qwnJHgD4A`.
2. **`set_wallet_program`**: write-once op een publiek cluster, met jouw programmakpair als
   ondertekenaar.

`scripts/devnet-dryrun.sh` zet de rest klaar: het controleert CLI, keypair en saldo, toont exact
wat er zou gebeuren, en weigert te handelen zonder `--ik-tekenen`. Voorbereiden tot op één
commando is van mij; dat commando is van jou.


## 62. Een testuitvoer die liegt, is erger dan geen uitvoer (2026-09-29)

`attachTransferHookIsolated.ts` G3 meldde bij een geslaagde transfer "ONVERWACHT … dat zou
pas na stap 4 moeten kunnen, nader onderzoeken" — terwijl stap 4 allang gebouwd is en die
transfer dus precies het werkende eindpunt is. De test gaf er geen cijfer aan, dus `npm test`
bleef groen en de uitvoer beweerde het tegenovergestelde van de werkelijkheid. Dit was het
stille restant van een eerdere fase (het schrijft over "onze nog-niet-herbouwde haak").

G3 zegt nu wat er geldt: een transfer naar een bestemming met een AuthorizedRecipient-PDA
**moet slagen**; de haken die falen zijn omgezet in exit 1 — "onze haak wees een geautoriseerde
bestemming af" is een regressie, geen tussenvorm. Gemeten op localnet na de wijziging: transfer
geslaagd, stap groen, exit 0. (Mijn eerste poging bevatte overigens een aanhalingsteken binnen
een string; `tsc` ving het vóórdat ik het draaide.)

Daarmee is de suite weer in lijn met wat §52 voor de hele reeks eiste: groen betekent dat de
verwachting uit vandaag uitkomt, niet dat een script toevallig niet crashte.


## 63. Dezelfde leugen, in het kopcommentaar (2026-09-29)

§62 repareerde de uitvoer van G3; het kopcommentaar van hetzelfde bestand beweerde nog
steeds dat `poison_transfer_hook` "NOG NIET herbouwd" is en "een geslaagde transfer dus nog
NIET bewezen kan worden". Commentarieel dat een eerdere fase beschrijft, wordt gelezen als
huidige staat — dus het is nu vervangen door wat de test vandaag bewijst: resolutie zónder
dat de client de PDA meegeeft, plus een geslaagde echte transfer. `tsc` groen, test draaide
groen op localnet (§62).


## 64. Replay is nu een verbruiksartikel: één PDA per getekende actie (2026-10-01)

§57 M1d mat het gat: na een `unmark` herleeft dezelfde onderschepte handtekening. De
wallet-nonce is namelijk een versheidscheck en geen verbruiksregister — active-defense
verhoogt hem niet (M1b: 1 → 1) en elke instructie leunde op haar eigen structurele
botsing (PDA-`init`, adres-al-gemarkeerd, eerste-wins op `MintOwner`). Zodra die staat
terugvalt, is de handtekening weer goed.

### De constructie

Eén account per unieke getekende actie, in `state.rs` als `ConsumedAction { wallet, action }`
met `LEN = 8 + 32 + 32 = 72` byte, geschreven door de instructie zelf:

    seeds = ["consumed", wallet, [tag], keccak256(tag || wallet || argumenten)]

Tag: 1 = attach, 2 = add, 3 = mark, 4 = unmark. `init` faalt bij herhaling, dus verbruik
staat nu in de keten in plaats van in afgeleide staat die iemand kan terugzetten. Raakt
vier instructies over drie lagen: programma (`instructions.rs`, `state.rs`), cliënt
(`poisonToken.ts` met `actieHash`/`deriveConsumedActionPda`) en harness (`lib.rs` met
`consumed_adres`). De tests importeren die afleiding uit de cliënt in plaats van de hash
te kopiëren — één definitie, drie lagen.

### Metingen, vandaag herhaald in plaats van overgenomen

| meting | nu (§64) | voorheen (§47) | delta |
|---|---|---|---|
| attach-transfer-hook CU | **46 786** | 40 543 | +6 243 |
| add_authorized_recipient CU | **38 289** | 30 502 | +7 787 |
| transferChecked naar geautoriseerde ontvanger | 32 101 | 32 101 | 0 |

Gemeten met `cargo run --bin hookflow` op artefact `81add7bab27aa4e9` (367 056 byte, sha
zelf nagerekend), 13 stappen groen. De hook zelf is niet veranderd: `poison_transfer_hook`
kreeg géén consumed-account — een transfer is geen WebAuthn-actie en Token-2022 kan die
account er ook niet bij geven.

M1d van §57 is nu een assertie met vier attributen in plaats van een `match` die beide
kanten als succes printte (een test die TOEGESTAAN én geweigerd goedkeurt, bewijst niets —
viel §64 stil terug, dan bleef hier alles groen):

1. `InstructionError(2, Custom(0))` — index 2 want de ruis-transfer en de precompile gaan
   vooraf; `Custom(0)` is `SystemError::AccountAlreadyInUse`. Een 6006 of 6010 zou betekenen
   dat iets anders eerst faalt en we dus níét de replay-bescherming meten (§51).
2. Het adres uit de log (`Allocate: account Address { address: 7ZWtSJ… }`) is gelijk aan de
   eigen afleiding van het consumed-PDA. "Het bestaat" was te makkelijk: die assertie is ook
   groen als iets anders botst.
3. Een verse mark met ander adres (andere challenge, ander consumed-PDA) slaagt vlak daarna —
   de afwijzing is actie-specifiek en geen algemene breuk.
4. `count` = 1: 0 na de unmark plus precies één uit de controle-actie; de replay liet géén
   staat achter.

Volledige keten uit de log: `Instruction: MarkMalicious` → `Program 1111… invoke [2]` →
`Allocate: account … already in use` → `failed: custom program error: 0x0`.

M1c is van karakter veranderd en dat verdient een regel: §57 zag daar `Custom(6006)`
(`AddressAlreadyMalicious`), vandaag `InstructionError(2, Custom(0))`. Dezelfde conclusie
(replay faalt), ander mechanisme — de afwijzing komt nu uit de account-laag en niet meer
uit de handler, want constraints lopen vóór de handler-body.

### Faal-pad geprobeerd, en deels mislukt

Een assertie die niet rood kan worden, is geen controle (§49). Poging: dezelfde coverage-
test tegen het enige oudere artefact op schijf (`active_defense.pre-fix2-6e51720.so`, via
`AD_SO`). Uitkomst: alle drie tests rood, maar om de verkeerde reden — die `.so` kent
`set_wallet_program` niet en faalt met `InstructionFallbackNotFound (101)` vóórdat M1 bij
M1d komt. Dit artefact bewijst dus níét dat de M1d-assertie replay vangt. Bijvangst: M2
zegt op dat artefact "mark zonder config werd TOEGESTAAN", precies de fail-open die §57
later als gedekt noteerde — een cross-check van §57, niet van §64. Voor een echte controle
is een build van `f46cac6` nodig (post fix 2, pre §64); die `.so` bestaat niet meer.

### Brekende cliëntwijziging

`buildUnmarkMaliciousIx(walletPda, address, payer, nonce, clientDataJson, passkeys?)` — de
`payer`-parameter is nieuw. `unmark_malicious` had geen payer en geen system_program (het
hoefde niets aan te maken); met het verbruikaccount erbij zijn die verplicht. Elke aanroeper
moet meelopen; binnen deze repo is dat alleen `client/src/verify-poisonToken.ts`, gemeten
met grep over de hele boom.

### Correctie op de handover: het waren vier TS-tests, niet zes

De overdracht zei dat zes scripts hun instructies met de hand bouwen en dus allemaal
`consumed` missen. Meten: `clientLibraryE2E.ts` (regels 218 en 237) en
`poisonAtoomIsolated.ts` (168, 208, 241) roepen de library-builders en droegen het
consumed-account dus al. Aangepast: `activeDefenseFull.ts`, `addAuthorizedRecipientIsolated.ts`
(twee sites), `attachTransferHookIsolated.ts`, `poisonTransferHookIsolated.ts`.
Declaratievolgorde is geen smaak en verschilt per instructie: bij add is het
`…, config, mint_owner, consumed`, bij attach `…, mint_owner, config, consumed`.

### Kanttekening die nog geen besluit is

Verbruikbewijzen stapelen op: 72 byte plus rent-exempt minimum per actie, en er is geen
close-pad — geen enkele instructie ruimt een consumed-PDA op. Voor localnet en tests is dat
gratis; bij veel acties per wallet blijven lamports bezet. Bewust accepteren of een
opcuim-route bouwen is niet besloten en ligt bij jou. Het bedrag per actie heb ik niet
nagerekend; de 72 byte zijn wel gemeten (`state.rs`).

### Wat hier open staat

* TS-suite op localnet (de vier aangepaste scripts). `tsc --noEmit` is groen, meer is er
  over de TS-kant nog niet te zeggen.
* Herbouwen en registreren: `notes/ARTEFACTEN.md` kent sha `81add7bab27aa4e9` nog niet, dus
  `scripts/controle.sh` is rood (onbekende sha én vuile `programs/`). Dat is de staat van
  werk in voortgang, geen regressie.
* `addAuthorizedRecipientIsolated.ts` STAP D: `signChallenge` bouwt `clientDataJSON`
  deterministisch uit de challenge, dus de herhaling heeft dezelfde actie-identiteit als de
  eerste poging en er zijn twee afwijs-redenen. Declaratievolgorde zorgt dat de
  `authorized_recipient`-botsing (index 3) vóór het consumed-account (als laatste) valt, dus
  de bedoelde meting blijft leidend — op localnet uit de logs verifiëren in plaats van
  beredeneren.

### Twee fixes van vandaag die blijven staan

1. `harness/src/bin/hookflow.rs:572` — de afgebroken edit had het sluitende `],` van een
   `accounts: vec![…]` (ATA-create) weggehaald, waardoor `cargo test` niet compileerde.
2. `harness/tests/accountmodel.rs`, helper `voeg_ontvanger_toe` — `consumed_action` stond
   vóór de voorwaardelijke `config`-push en botste daarmee met de declaratievolgorde; vijf
   tests gaven `3012`. Verplaatst naar achteren.

Daarna gemeten in deze sessie: harness 23/23 groen (accountmodel 12, atomiciteit 1,
coverage 3, layout_conformance 6, open1 1).

### Naschrift: `addAuthorizedRecipientIsolated.ts` is omgebouwd (meting, niet smaak)

De TS-suite op localnet (Agave 4.1.2, RPC 13399) gaf zeven scripts, waarvan dit script
rood: `AnchorError caused by account: mint_owner. AccountNotInitialized (3012)`. Niet door
de consumed-accounts — de HEAD-versie tegen dezelfde localnet faalt ook, met
`AccountNotEnoughKeys (3005)`, eveneens op `mint_owner`. De oorzaak is ouder: het script
toetste `add` op een kale pubkey als `token_mint`, bewust los van attach, en sinds §45 is
die koppeling verplicht. De veroudering bestond dus al; de nieuwe accounts hebben haar
blootgelegd in plaats van veroorzaakt.

Ombouwkarakter: van positieve test naar **NEG 1 / POS / NEG 2**, want een negatieve test
zonder positieve controle kan niet rood worden en bewijst dus niets (§49).

| stap | wat er staat | gemeten op localnet |
|---|---|---|
| NEG 1 | `add` zonder koppeling moet falen | geweigerd, toegeschreven aan `mint_owner`, 3012 |
| POS | na attach op een echte Token-2022-mint moet dezelfde add slagen | geslaagd; PDA-velden (mint, recipient, bump) kloppen |
| NEG 2 | dezelfde getekende actie in een andere omhullende transactie | geweigerd op init-botsing |

Twee dingen die deze ombouw opleverde en die hier thuishoren:

1. **De attributie van NEG 2 is níét het consumed-mechanisme.** Gemeten: het botsende
   account is `authorized_recipient` (declaratie-index 3), niet `consumed_action` (als
   laatste). Een replay van een geslaagde `add` botst dus eerst op die PDA en bereikt
   consumed nooit. Dit script bewijst de afwijzing; het bewijs van het consumed-mechanisme
   blijft in `coverage.rs` M1d, waar de staat wél teruggezet kan worden. De test print die
   grens expliciet — anders zou hij iets suggereren wat hij niet meet (§51).
2. **Een geweigerde actie laat geen verbruik achter.** NEG 1 asserteert dat er na de
   afwijzing géén `consumed`-account bestaat. Doordat consumed als allerlaatste gedeclareerd
   is, faalt alles anders vóórdat er rent voor verbruik uitgegeven wordt — daarmee is een
   aanvaller die mislukte acties forceert geen rent-griefing. Dat is nu een assertie in
   plaats van een hoop.

Stand van de TS-suite na de ombouw: `npm test` exit 0, alle zeven scripts geslaagd op
localnet. Eigen meetfout onderweg: mijn teller zocht naar `✗|FOUT` en telde daarmee de
regel "SPECIFIEKE, ZINVOLLE FOUTCODE bevestigd" als fout — een groen script leek één ✗ te
hebben. Zelfde les als §52: wat je telt moet betekenen wat je beweert.

### Naschrift: het faal-pad is alsnog gemeten, en de M1d-assertie bloedt

Hierboven staat dat het faal-pad mislukte: het enige oudere artefact op schijf
(`pre-fix2`) faalt te vroeg, dus het kon niet laten zien dat de nieuwe M1d-assertie replay
werkelijk vangt. Dat is nu opgelost met een controle-build van `f46cac6` — de bron ná fix 1
en fix 2, vóór §64.

Procedure: `git worktree add --detach /tmp/ad-f46cac6 f46cac6`, daar `cargo build-sbf
--tools-version v1.52`, en de **huidige** coverage-tests tegen die `.so` via `AD_SO`. De
bron in die werkboom bevat geen `ConsumedAction` en geen `consumed_action` — gemeten, niet
aangenomen.

| meting | pre-§64-artefact | §64-artefact |
|---|---|---|
| M1a valse nonce | geweigerd `Custom(6010)` | geweigerd `Custom(6010)` |
| M1c zelfde bytes, andere transactie | geweigerd **`Custom(6006)`** | geweigerd **`Custom(0)`** |
| M1d oude handtekening na unmark | **TOEGESTAAN → test FAALT** | geweigerd, vier attributen |
| coverage exit | **101** | 0 |

De paniekregel is precies wat er moet staan: `M1d: de onderschepte handtekening werd
TOEGESTAAN na unmark — het §57-gat is terug`. Daarmee is de assertie geen groen-vlek meer:
valt §64 weg, dan wordt de suite rood. De M1c-regel bevestigt bovendien de mechanismewijziging
die hierboven staat beredeneerd — zonder §64 is de afwijzing `AddressAlreadyMalicious` uit de
handler, met §64 een `init`-botsing uit de account-laag.

Bijvangst die er toe doet: de bouw van `f46cac6` op deze host gaf sha **`3d5b1a91e800bb38`**,
318 136 byte — byte-gelijk aan het artefact dat in `notes/ARTEFACTEN.md` staat als "fix-2
build, lokaal gebouwd" met bron-commit `564227b`. Twee conclusies: bouwen is op deze machine
wél byte-reproduceerbaar voor dezelfde bron (§54's waarschuwing ging over verschillende
machines), en `programs/` is tussen `564227b` en `f46cac6` niet veranderd.

Controle dat niets beschadigd raakte: het geregistreerde artefact in `target/deploy` is na
alle experimenten nog `81add7bab27aa4e9`, 367 056 byte.

### Naschrift: M1c is dezelfde treatment ondergaan als M1d

M1c printte TOEGESTAAN en geweigerd allebei als succes — dezelfde zwakte als M1d had. Nu
asserteert het `InstructionError(2, Custom(0))` én dat `count` op 1 blijft. Dat geeft een
tweede, onafhankelijke controle op het verschil tussen de mechanismen:

| artefact | M1c meting | uitkomst |
|---|---|---|
| `81add7bab27aa4e9` (§64) | `InstructionError(2, Custom(0))` | groen, 3/3 |
| `3d5b1a91e800bb38` (pre-§64) | `InstructionError(2, Custom(6006))` | rood: "verwachting was de consumed-init botsing" |

De rode regel noemt het cijfer dat hij zag, dus een toekomstige lezer ziet niet alleen dat
iets faalt maar waar het mechanisme verschilt. Harness na deze wijziging: 23/23 groen.

## 65. Verbruikmechanisme bewezen op Agave, niet alleen in LiteSVM

*Geschreven 2026-10-01 (main). Vereist: §57 (het gat), §64 (de sluiting).*

§64 sloot het replay-gat en `coverage.rs` M1d bewees de sluiting — maar in LiteSVM. LiteSVM
is niet de runtime waarop dit programma draait; Agave is dat. Zolang de enige getuige een
simulator is, is "het gat is dicht" een claim over een nabootsing. Deze sectie levert de
getuige op de echte runtime: `tests/markUnmarkReplayIsolated.ts`.

Het script gebruikt de **cliënt-builders** (`buildMarkMaliciousIx`,
`buildUnmarkMaliciousIx`), geen handbouw-instructies. Wat groen is, is dus wat een wallet of
dApp werkelijk verzendt — niet een kopie die ik handiger vond.

| stap | wat er staat | §64-artefact `81add7bab27aa4e9` | pre-§64-artefact `3d5b1a91e800bb38` |
|---|---|---|---|
| POS 1 | `mark_malicious` via de cliënt | geslaagd, count 0 → 1 | geslaagd, count 0 → 1 |
| POS 2 | `unmark_malicious`, staat teruggezet | geslaagd, count 1 → 0 | geslaagd, count 1 → 0 |
| NEG | dezelfde getekende bytes, andere omhullende transactie | **geweigerd**; de log noemt het consumed-account | **TOEGESTAAN** → test faalt |
| exit | | 0 | 1 |

De onderste cel is de punt van dit whole exercise: op een echte Agave-validator herrees de
onderschepte handtekening na een unmark precies zoals §57 beschreef. Het gat was geen
simulatie-artefact en de sluiting is dat nu niet meer.

## Bevinding: een nieuwere cliënt breekt niet tegen een ouder programma

Gemeten, niet afgeleid: tegen het pre-§64-programma **slagen** `mark` en `unmark` met de
nieuwe acht-account-instructie. Anchor verwerpt extra accounts niet; het oudere programma
negeert het achtste (consumed) account en doet zijn oude werk.

Waarom dit hier hoort: §60 gaat over upgrade-autoriteit en over wat een upgrade onomkeerbaar
maakt. Dit meetpunt zegt dat een *cliënt-uitbreiding* de uitrol niet hoeft te wachten op het
programma — een nieuwe client werkt tegen beide binaire versies. De omgekeerde richting is
niet gemeten en ook niet bewering: een oudere cliënt tegen een nieuwer programma faalt op
`AccountNotEnoughKeys (3005)`, zoals §64 al mat voor `addAuthorizedRecipientIsolated.ts`.

## Ordening van asserties is zelf een methodische keuze

De eerste versie van dit script controleerde de bestaande consumed-accounts vóór de replay.
Tegen het pre-§64-artefact struikelde het dan op "consumed-account ontbreekt" en zag de replay
nooit — precies het gat dat het moest laten zien. De controles staan nu ná NEG.

Dat is geen stijl: wie zijn positieve controle vóór de negatieve zet, verbergt wat hij wilde
weerleggen. Meten wat je wilt weerleggen, niet wat handig uitkomt.

## Poort en CI

`npm test` telt nu acht stappen (stap 8 is dit script). De CI draait de TS-suite nog steeds
niet — die doet `tsc` en `verify-poisonToken.ts` en noemt expliciet wat ze niet dekt. Die
opmerking zei "7 stappen" en is naar 8 gezet; een commentaar met een verouderd getal wordt
gelezen als huidige staat (§62, §63).

Omgevingstval, twee keer tegengekomen: `pkill -f solana-test-validator` matcht ook de shell
waarvan de argumenten mijn eigen scripttekst bevatten. Je gooit dan je eigen stap weg en de
uitvoer verdwijnt. Validator altijd per pid of procesgroep stoppen (`os.killpg`), nooit op
patroon als het patroon in je eigen commandoregel staat.

## 66. Besluit over §60: B, 2-van-3 — en devnet blijkt allang live

*Geschreven 2026-10-01 (main). Vereist: §60 (het memo), §61 (devnet), §54 (keypair-identiteit).*

### Eerst meten, want twee premissen van §60 bleken niet te kloppen

| vraag | meting |
|---|---|
| mainnet | géén account op `FzeAZm…` — programma bestaat er niet |
| testnet | géén account |
| devnet | **BESTAAT**: ProgramData 277 245 byte, owner BPFLoaderUpgradeable, 1,7566 SOL rent-exempt |
| sinds wanneer | deploy-slot 491 648 033 → block time **2026-09-01 21:19 UTC** |
| upgrade-autoriteit devnet | `Some(FzeAZm…)` — het deploy-keypair zélf, `target/deploy/active_defense-keypair.json`, mode 600, gitignored |

Decoding, zodat het navraagbaar is: het program-account is 36 byte = discriminant u32 (2 = ProgramV2)
plus de ProgramData-publieke sleutel op byte 4..36; het ProgramData-account heeft discriminant 3,
daarna een u64-slot en een `Option<Pubkey>`. De attributie loopt niet via die layout-aanname:
de publieke helft van het keypair-bestand is in de bytes van het ProgramData-account gezocht en
op offset 13 gevonden. Wie mijn layouttwijfel navraagt, hoeft dus niet aan mij te geloven.

### Correctie op §61

§61 (2026-09-29) stelt dat het programma op devnet niet bestaat en dat de fee-payer er 0 SOL
heeft. Het tweede klopt; het eerste niet. Het programma staat er sinds 2026-09-01, bijna een
maand vóór die sectie. Hypothese voor hoe die meting misging — als hypothese gelabeld, want ik
heb niet gezien welk commando er toen is draaien: `solana program show --programs` toont
programma's die door *die payer* zijn gedeployed, en de autoriteit hier is het programmakpair,
dus die opdracht toont niets en nodigt uit tot "bestaat niet".

Waarom dit ertoe doet: §61 is de poort waar een mainnet-besluit op leunt. Een besluit dat
steunt op "er staat nog niets" is een ander besluit dan een dat steunt op "er staat iets, met
één sleutel, sinds 1 september".

### Correctie op §60

§60 schrijft dat migreren kan met `solana program update-authority`. Dat subcommando bestaat
niet in deze CLI. Gemeten `solana program --help` in Agave 4.1.2 noemt: close, deploy, dump,
extend, set-buffer-authority, **set-upgrade-authority**, show, upgrade, write-buffer. Het juiste
commando heet anders, en het heeft twee vlaggen die de moeite zijn: `--final` (maakt het
programma onomkeerbaar immutable) en `--skip-new-upgrade-authority-signer-check`.

Ook gemeten: `solana-keygen multisig` bestaat niet en er staat geen `spl`-binary op deze machine
(wel `spl-token`). Optie B is tóch haalbaar zonder nieuw gereedschap, want de afhankelijkheid
die we al hebben exporteert het: `@solana/spl-token@0.4.15` met
`createMultisig(connection, payer, signers, m, keypair?, confirmOptions?, programId?)` — gemeten
als `typeof === "function"` in de geïnstalleerde bron, niet uit het hoofd.

### Het besluit

**B, 2-van-3, vóór elke mainnet-zet.** Devnet blijft op A. Dat is nu geen aannames meer maar een
keuze met een datum eraan: devnet hangt daar al sinds 1 september met één sleutel, en er staat
niets waardevols aan — dus daar is A geen nalatigheid, het is de goedkope toestand die we als
repetitieterrein kunnen gebruiken.

De volgorde is gesorteerd op onomkeerbaarheid, niet op gemak:

1. **Drie sleutelplaatsen kiezen en verifiëren.** Dit is het enige punt waar verlies definitief
   is: 2 van de 3 kwijt is de autoriteit kwijt, zonder herstelroute. Elke sleutel op een andere
   machine of drager; "drie kopieën op één laptop" is 1-van-1 met extra stappen.
2. **Multisig aanmaken** met `createMultisig`. Kosten gemeten: accountgrootte 355 byte
   (`MULTISIG_SIZE`, uit het pakket zelf gevraagd, niet uit mijn hoofd — het is niet 352),
   huur 2 453 640 lamports = 0,002454 SOL op mainnet.
3. **Overdracht op devnet als repetitie**:
   `solana program set-upgrade-authority FzeAZm… --new-upgrade-authority <multisig> --skip-new-upgrade-authority-signer-check -u devnet`.
   Die vlag is geen formaliteit: een Multisig-account is geen keypair en kan niet zelf tekenen,
   dus zónder die vlag faalt de overdracht.
4. **Eén upgrade via de multisig op devnet**, om te bewijzen dat twee handtekeningen volstaan én
   dat één niet volstaat. Zonder die meting is 2-van-3 een gevoel.
5. **Write-once config (`set_wallet_program`) ná de overdracht**, nooit ervoor — §60's volgorde
   was al goed en blijft.
6. **Mainnet** pas na 1–5. `--final` niet gebruiken zolang er ook maar één kans op correctie is;
   die knop is de enige echt eenrichtingsdeur in dit hele verhaal.

### Wat dit besluit níét doet

Ik teken, deploy of draag niets over. De overdracht vereist het deploy-keypair op deze machine en
betekent dat voortaan twee mensen "ja" moeten zeggen — dat is precies de bedoeling, maar het is
een keuze over personen en dragers, niet over code. Waar die drie sleutels komen, is aan jou.

### Slot: het tweede geheim op schijf

`target/deploy/new-active-defense-keypair.json` (publiek `DXdb6mZZ…`) is een volledig
ed25519-geheim zonder bekend doel. Voordat er autoriteiten worden overgedragen, moet dit verklaard
of vernietigd zijn. §54's regel is dat een keypair die je niet zelf geplaatst hebt geen identiteit
is; een geheim dat niemand kan verklaren is geen sleutel maar een aanvalskans met een padnaam.

## 67. GitHub-alerts naast `npm audit`: eenheden, woordkeus en één ingetrokken duplicaat

*Geschreven 2026-10-01 (main). Vereist: §56 (dependency-schuld, bereikbaarheid).*

De push van §64–§66 meldde aan de remote-kant: "GitHub found 4 vulnerabilities (1 moderate,
3 low)". Lokaal zei `npm audit` 5 meldingen (3 high, 2 moderate). Dat klinkt als een verschil
van inzicht; het blijkt grotendeels een verschil van **eenheid en woordkeus**, plus één
ingetrokken advisory die mijn eigen scan op een dwaalspoor zette.

### De twee kijkwijzen, pakket voor pakket

| pakket @ versie | `npm audit` | GitHub Advisory Database | bereikbaar in ons pad? | patch? |
|---|---|---|---|---|
| `bigint-buffer@1.1.5` | high (via 3 knooppunten) | GHSA-3gc7-fjrx-p6mg, high, CVSS 7,5, `<= 1.1.5` | **ja** — zie hieronder | **geen**: `first_patched_version = None`, en 1.1.5 is de laatste publicatie ooit (2019-10-17) |
| `stream-json@1.9.1` | moderate | GHSA-528h-pc64-c93x, medium, CVSS 6,2, `<= 3.4.0 → 3.5.0` | **nee** op onze oppervlakte — jayson importeert uitsluitend `streamers/StreamValues` en `utils/Verifier`; het advies gaat over `pick`/`ignore`/`filter`/`replace`, en `@solana/web3.js` haalt alleen `jayson/lib/client/browser` | wél, maar een major (3.5.0), vastgezeten achter majors van `@solana/web3.js` |
| `uuid@11.1.1` | niet gemeld | alleen rakend via GHSA-qmq6-f8pr-cx5x — en dat is een **ingetrokken duplicaat** met bereik `< 14.0.0`. Het origineel GHSA-w5hq-g745-h8pq (medium, 7,5) heeft `< 11.1.1 → patched 11.1.1` | niet van toepassing: wij staan precies op de patch-grens, en jayson gebruikt uitsluitend `.v4`, wat het advies expliciet onaangeroerd laat | n.v.t. |
| `serialize-javascript@7.1.2` | niet meer gemeld | 6 adviezen in de DB, geen enkel bereik dekt 7.1.2 | — | opgelost in de §56-triage |

### Waarom "4" en "5" elkaar niet tegenspreken

1. **Eenheden.** `npm audit` telt knooppunten in de afhankelijkheidsboom. De drie high-meldingen
   zijn één advies (bigint-buffer) dat via drie paden wordt gerapporteerd: `bigint-buffer` zelf,
   `@solana/buffer-layout-utils` en `@solana/spl-token`. GitHub vult daar één alert voor in.
2. **Woordkeus.** npm schrijft *moderate*, GitHub schrijft *medium*. Het zijn dezelfde labels voor
   hetzelfde niveau; wie de lijsten naast elkaar leest zonder dit te weten, ziet "verschillen".
3. **Ingetrokken adviezen.** De query `?affects=<pkg>` op de publieke advisory-API geeft óók
   ingetrokken advisories terug. Mijn eerste scan markeerde `uuid@11.1.1` daardoor als RAAKT op
   grond van een duplicaat dat juist om zijn te brede bereik (`< 14.0.0`) is ingetrokken. Dat was
   een fout van mij, hierboven gecorrigeerd tegen het origineel.

De eerlijke reststand is dus: **twee adviezen**, niet vijf. Eén zonder patch (bigint-buffer), één
met een patch die we niet kunnen pakken zonder majors (stream-json).

### Bereikbaarheid van bigint-buffer, want dat is het enige echte risico

Gemeten in de geïnstalleerde bron, niet beredeneerd: `@solana/spl-token` gebruikt uit
`@solana/buffer-layout-utils` de symbolen `publicKey` (55×), **`u64` (28×)** en `bool` (8×). En in
`bigint.js` staat: `exports.u64 = bigInt(8)`, wiens `decode` `toBigIntLE(...)` aanroept — precies
de functie die het advies noemt. Onze eigen client en tests roepen `getMint`/`unpackMint` aan,
die via die `u64`-layout dekken.

De exposure is dus: *het decoderen van accountbytes die van een RPC komen*. Op localnet en devnet
is die RPC van ons. Voor mainnet geldt: het is de RPC die wij zelf kiezen, en een aanval vraagt om
kwaadaardige accountbytes vanuit die bron — niet om een of andere publieke ingang. Er bestaat geen
gepatchte versie (laatste publicatie 2019), dus "upgraden" is hier geen optie; de keuzes zijn
accepteren met registratie, of de `u64`-decode van spl-token zelf doen.

**Aanbeveling:** accepteren, met deze sectie als registratie en twee hercheck-triggers: het
verschijnen van `bigint-buffer >= 1.1.6` of van een onderhouden fork, én elke wijziging in hoe wij
mint-data decoderen. Voor `stream-json` één trigger: elke major van `@solana/web3.js`, want dan
kan de 3.x-lijn opeens wel.

### Wat ik niet kon verifiëren

De samenstelling van die GitHub-melding (1 moderate, 3 low) is vanaf hier niet opvraagbaar: de
alerts-API geeft 401 zonder token en `/security/dependabot` geeft 404 voor anonieme bezoekers.
Daarnaast is de banner bij een push een momentopname van de stand vóór de her-scan, dus het getal
kan na afloop lager zijn. Met een token is het één commando:

```
gh api repos/anoadder-ship-it/active-defense/dependabot/alerts --paginate \
  --jq '.[] | "\(.number) \(.state) \(.security_advisory.severity) \(.dependency.package.name) \(.security_advisory.ghsa_id)"'
```

Wie dat uitvoert, krijgt de vier namen; tot die tijd is "3 low" een getal zonder inhoud en doe ik
geen uitspraak over wat eronder zit.

### Naschrift: de momentopname is nu gemeten, niet alleen beredeneerd

Hierboven stond als redenering dat de push-banner een stand vóór de her-scan toont. Bij de
push van deze sectie (`b70e83a..1bbb573`) zei de remote: "1 moderate, 2 low". De vorige push,
`f46cac6..b70e83a`, zei "1 moderate, 3 low". Tussen die twee pushes is aan onze
afhankelijkheden niets veranderd — `b70e83a` bevatte al de serialize-javascript-fix uit §56.

Het verschil van precies één low, opkomend uit het niets en verdwijnend zonder dat wij iets
deden, is dus de vertraging tussen de push en de her-scan van de slot. Daarmee is de waarschuwing
boven feitelijker: een teller in een banner is geen meting van de huidige staat, en al helemaal
geen lijst. Wat wél meetbaar blijft zijn de twee adviezen hierboven.

### Correctie op §66 — optie B zoals daar stond zou het programma onupgradebaar hebben gemaakt

*Toegevoegd 2026-10-01, vóórdat iemand de ceremonie uitvoert.*

§66 beveelt "B, spl-multisig 2-van-3" aan en stelt dat `createMultisig` uit
`@solana/spl-token` die route haalbaar maakt zonder nieuw gereedschap. Dat laatste is onjuist,
en het gevolg ervan is fataal.

Bewijs uit de loader-bron op deze machine (`/home/michel/projects/agave`, v4.1.2, `version = "4.1.2"`,
`programs/bpf_loader/src/lib.rs`, handler `UpgradeableLoaderInstruction::SetAuthority`):

```rust
if !instruction_context.is_instruction_account_signer(1)? {
    ic_logger_msg!(log_collector, "Upgrade authority did not sign");
    return Err(InstructionError::MissingRequiredSignature);
}
```

De loader controleert één ding: of het account dat als autoriteit meekomt, **zelf** een handtekening
op de instructie heeft. Het woord `multisig` komt in dat hele bestand niet voor (0 treffers). Een
SPL Multisig-account is geen keypair en kan niet tekenen; de token-program-aanpak (waar het
token-program zelf de ledenhandtekeningen in de accountlijst naloopt) bestaat hier niet.

Gevolg: upgrade-autoriteit overdragen aan een SPL Multisig-account maakt het programma
**onomkeerbaar onupgradebaar** — dezelfde eenrichtingsdeur als `--final`, alleen zonder dat iemand
`--final` heeft getypt. `createMultisig` is wél bruikbaar voor token-autoriteiten, niet voor
loader-autoriteit.

Wat wél werkt is een **PDA die door een programma via CPI wordt ondertekend** (`invoke_signed`),
want dan ziet de loader dat PDA-account als tekenaar. Dat is precies hoe Squads/Safe en vergelijkbare
governance-programma's upgrade-autoriteit beheren — reden waarom elke praktische handleiding daar
op uitkomt, en niet bij `spl-multisig`.

**Herziene besluitvorming.** B bestaat niet als "spl-multisig"; de keuze is nu:
- **B′ — PDA-multisig via een bestaand governance-programma (Squads Safe e.d.).** m-van-n met
  CPI-handtekeningen, geen eigen code om te auditen. Aanbevolen.
- **B″ — eigen PDA-multisig-programma.** Maximale controle, maar dan is er een tweede programma
  dat gecontroleerd moet worden vóór het de macht krijgt die het eerste beschermt.
- **A — één keypair, maar dan bewust en offline bewaard.** Op devnet prima; op mainnet is dit de
  situatie die we wilden afbouwen.

De rest van §66 (volgorde op onomkeerbaarheid, devnet als repetitieterrein, `set-upgrade-authority`
in plaats van het niet-bestaande `update-authority`, write-once config ná de overdracht) blijft staan.
Wat vervalt: desuggestie dat een kale SPL Multisig hier genoegsoort is, en het `--skip-new-upgrade-authority-signer-check`
advies in die context — die vlag omzeilt alleen de CLI-controle dat de nieuwe autoriteit meetekent,
en lost niets op voor een account dat principieel niet kan tekenen.

**Nieuwe verplichte stap vóór elke echte overdracht:** de ceremonie herhalen op een
**wegwerp-programma** op devnet — inclusief het opzettelijk mislukken van de SPL-multisig-route —
zodat deze correctie gemeten is in plaats van afgeleid uit broncode. Nooit testen op `FzeAZm…`.

## 68. Fase 1 gemeten: een SPL Multisig brickt het programma, een PDA met CPI werkt

*Geschreven 2026-10-01 (main). Vereist: §66 en de Correctie op §66.*

Alles hieronder is gedraaid op devnet met wegwerpdingen, gefinancierd uit een faucet-stort van
10 SOL op een wegwerp-payer `BA5SbPYr…`. Geen enkel echt adres is aangeraakt.

### Test A — SPL Multisig als upgrade-autoriteit (de route die §66 aanbeval)

| stap | wat er gebeurde |
|---|---|
| wegwerp-programma P1 deployen (`7ow4RUMW…`) | lukt |
| autoriteit overdragen aan een 2-van-3 SPL Multisig `F6aXCYo6…`, **zonder** skip-vlag | CLI weigert: `missing signature for supplied pubkey: F6aXCYo6…` |
| dezelfde overdracht **met** `--skip-new-upgrade-authority-signer-check` | lukt, autoriteit = multisig |
| daarna een upgrade-instructie met die multisig als autoriteit | **mislukt**: `Signature verification failed. Missing signature for public key [F6aXCYo6…]` |

Het falen komt vóór de loader: het runtime kan geen ed25519-handtekening van dat account vinden,
en er kan er nooit een bestaan, want het account heeft geen privésleutel. **P1 is op dit moment
definitief onupgradebaar en blijft zo staan op devnet als artefact van deze meting.**

### Test B — PDA-autoriteit met CPI-handtekening (B′)

| stap | wat er gebeurde |
|---|---|
| ondertekenaar `S = 2WayktXg…` deployen (doet niets dan één CPI SetAuthority) | lukt |
| tweede wegwerp `P2 = 86be7993…` deployen, autoriteit overdragen aan PDA `A = AmuFi5nV…` | lukt |
| `S` aanroepen zodat `A` via `invoke_signed` de autoriteit terugdraagt naar de payer | **lukt**; log: `New authority Some(BA5SbPYr…)`, `Program BPFLoaderUpgradeab1e… success` |
| daarna een echte upgrade van P2 via de CLI | **lukt**, deploy-slot 506 644 060 |

Dus: de loader aanvaardt een account zonder privésleutel als autoriteit, mits een programma dat
account via CPI laat tekenen. Dat is precies het verschil tussen B′ en de mislukte route uit §66,
en het is nu gemeten in plaats van afgeleid uit `is_instruction_account_signer`.

### Valkuilen die deze repetitie blootlegde — ze bepalen de ceremonie

1. **Wie de autoriteit wordt bij een deploy.** `solana program deploy x.so --program-id K --keypair P`
   maakt **P** de upgrade-autoriteit, niet K. Bij P1 dacht ik dat het programmakpair de macht hield;
   de loader zei anders. Een ceremonie die hiervan uitgaat, draagt de macht per ongeluk over aan de
   fee-payer.
2. **`set-upgrade-authority` kent geen `--fee-payer`** in Agave 4.1.2: de autoriteit-sleutel betaalt
   ook de fees. Een autoriteit zonder SALD kan dus niet eens een autoriteitsoverdracht doen.
3. **`--program-keypair` bestaat niet**; het heet `--program-id`.
4. **De CLI leest vóór bevestiging.** Direct na een gelande CPI zei de CLI nog dat de autoriteit de
   PDA was; het account zelf zei payer. Meten doe je tegen de RPC, niet tegen de CLI-uitvoer.
5. **CPI heeft de callee als account nodig.** Zonder `BPFLoaderUpgradeab1e…` in de accountlijst:
   `An account required by the instruction is missing`.
6. **Onze eigen web3.js 1.98.4 wijkt af**: `SystemProgram.createAccount` wil `fromPubkey` (niet
   `fromAccount`), `sendAndConfirmRawTransaction` tekent níét, er is geen `getHealth`, en geen
   `UpgradeableLoader`-helpers. Instructies bouw ik daarom zelf met discriminanten uit de
   Agave-bron (`Upgrade` = 3, `SetAuthority` = 4) en de accountlijst uit de interface-docs
   (0 programdata, 1 program, 2 buffer, 3 spill, 4 rent, 5 clock, 6 autoriteit).

### Wat dit verandert aan het plan

B′ is haalbaar, en de overdracht zelf is één transactie. Nieuwe verplichte randvoorwaarde uit
punt 2 hierboven: de autoriteit die straks de overdracht tekent moet SALD hebben op dezelfde
account — bij een PDA-bestuurde safe betekent dat dat de *huidige* autoriteit (het deploy-keypair)
op dat moment SOL nodig heeft, en dat de eerste handeling ná de overdracht is dat de safe zelf
rent/lamports krijgt waar hij om vraagt.

Rest saldo wegwerp-payer: zie commit-log; de wegwerp-programma's `S`, `P1` (onupgradebaar) en
`P2` staan op devnet en doen niets. De sleutels staan in `/tmp/ad-fase1/` en zijn wegwerp.

## 69. Fase 1b: een echte Squads v4-multisig als upgrade-autoriteit, tweestemseis gemeten

*Geschreven 2026-10-01 (main). Vereist: §68.*

Wegwerpdingen op devnet, SDK `@sqds/multisig@2.1.4` in `/tmp/ad-fase1b/` (niet in onze repo).
Squads v4-programma `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` staat op devnet én mainnet.

### Wat er draaide

Multisig `HXsa6nnU3AffqQRSQsKtgKG8qoumqgVik1PrHDqPXCwQ`, drempel 2 van 3, time-lock 0.
Wegwerp-programma `P3 = Dorz4G17TVyfSSpUbFLLXytDrZFryrZjVXquRgoDJrW` kreeg als upgrade-autoriteit de
**vault-PDA** `CjMN1dfjvi7rZAUaojX76kjNSthX2c63H42FgSZ95k8p`.

| stap | resultaat |
|---|---|
| voorstel aanmaken (`vaultTransactionCreate`, indiener = lid 1, betaler = payer) | OK |
| `proposalCreate` | OK |
| lid 1 stemt goed | OK |
| **uitvoeren met 1 van de 2 stemmen** | **FAALT: `0x1778` = 6008 `InvalidProposalStatus`** |
| lid 2 stemt goed | OK |
| **uitvoeren met 2 stemmen** | **OK** — de vault tekende de loader-`SetAuthority` via CPI |
| autoriteit van P3 daarna | weer de payer, en een echte CLI-upgrade van P3 slaagt |

De tweestemseis is dus geen papieren belofte: één handtekening is aantoonbaar te weinig.

### De tweede val: de verkeerde PDA is net zo dodelijk als de SPL Multisig

Overdracht aan de **multisig-PDA** in plaats van de vault-PDA, op een apart wegwerp `P4 = 31dEq1LSiMFktMqnUh7oMEsBtrUc6YeneBZESaRGdsTW`:

```
Signature verification failed. Missing signature for public key [`HXsa6nnU3…`].
```

Identiek aan §68. Bij Squads tekent de **vault** (`[prefix, multisig, "vault", vault_index, bump]`,
zie `vault_transaction_execute.rs`), niet het multisig-account. Wie in de echte ceremonie het
multisig-adres overdraagt — omdat dat het adres is dat iedereen deelt — maakt het programma kapot.
Vóór de overdracht controleren: het doeladres moet de vault-PDA van index 0 zijn, en dat adres
moet uit de SDK come forward, niet uit een clipboard.

### Valkuilen uit deze ronde

1. **`treasury` is niet vrij te kiezen**: `multisig_create` eist `treasury == program_config.treasury`
   (`multisig_create.rs:69`, fout `0x177e` = 6014 `InvalidAccount`). Op devnet is die
   `HM5y4mz3…` en de creation fee 0; op mainnet staat een andere treasury en een niet-nul fee.
2. **Indiener moet lid zijn.** `creator` van een voorstel met de payer als indiener geeft
   `0x1775` = 6005 `NotAMember`. Fijn: "wie mag indienen" en "wie betaalt fees" zijn gescheiden rollen.
3. **`rentPayer` defaultt naar de indiener.** Een lid zonder SOL faalt met
   `Transfer: insufficient lamports 0, need 2468880`. Dus: elk voorstel heeft een fee-wallet nodig.
4. **Betaler tekent élke transactie mee**, ook bij stemmen en uitvoeren — anders
   `Transaction did not pass signature verification`.
5. **De SDK geeft u64-velden als string.** `ms.transactionIndex + 1` werd `"1" + 1 = "11"`, en mijn
   voorstel richtte zich op een PDA die niet bestond (`0x7d6` = 2006 `ConstraintSigner`). In een
   echte ceremonie betekent zoiets: tekenen op een voorstel dat er niet is. Alles wat uit die SDK
   komt vóór gebruik door `BigInt(String(v))` halen.
6. **Eerste transactie-index is 1**, niet 0.

### Consequentie voor de hoofdceremonie

B′ staat, inclusief goedkeuringsmechanisme. De overdracht zelf is één transactie naar de
**vault-PDA van index 0**. Aanvullende randvoorwaarden: een fee-wallet die bij elk voorstel meetekent,
de indiener moet een lid zijn met Initiate-recht, en de vault moet zelf lamports hebben zodra hij
huur of fees moet dragen. Time-lock laten staan op 0 is geen optie voor mainnet — dat deden we hier
alleen om de test kort te houden; een time-lock van bij voorkeur 24 uur geeft de derde drager tijd
om een kwaadaardig voorstel te zien vóór het uitgevoerd kan worden.

## 70. Een notitie die ik zelf vernietigde, en waarom dat niet had hoeven gebeuren

*Geschreven 2026-10-02 (main).*

`notes/HANDOVER-2026-10-01b.md` is vanmiddag leeggeschreven door een script van mij. De volgorde in
Python is genadeloos: bij `open(p,"w").write(t.replace(oud, nieuwd, 1))` wordt `open()` éérst
geëvalueerd — het bestand is dan al afgehakt — en pas daarna de argumenten. In dat argument stond
een typefout (`nieuwd` in plaats van `nieuw`), dus de write gebeurde nooit en bleef een leeg
bestand over. Er was geen kopie: handover-notities staan bewust in `.gitignore`
(`notes/HANDOVER-*.md`, verband met live adressen), dus git had niets.

Wat er terug is: de substantie stond allemaal al in §66–§69 en die zijn gecommit. Het addendum is
gereconstrueerd uit wat ik deze sessing schreef, met bovenaan een kop die zegt dat het een
reconstructie is. Woordkeus verschilt van het origineel; inhoudelijk zijn geen metingen kwijt.

Twee lessen die hier blijven staan:

1. **Bereken de inhoud, schrijf daarna.** In deze repo's schrijven we voortaan via
   `tempfile.mkstemp` + `os.replace`, zodat een mislukt script het oude bestand heel laat in plaats
   van het op zijn beurt af te hakken.
2. **Een notitie die bewust buiten versiebeheer staat, heeft geen vangnet.** Dat is een bewuste
   keuze (live adressen), maar dan moet er wél érgens een kopie zijn. Voorstel aan de gebruiker:
   ofomslag — handover-notities met geredigeerde adressen in een private repo, of een
   tijdstempelkopielaag vóór elke schrijfwijziging. Tot die keuze maakt dit bestand geen
   claims boven de STATUS-secties.

## 71. De autoriteit van `FzeAZm…` is het programmadres zelf — en dat is tóch tekenbaar

*Geschreven 2026-10-02 (main). Vereist: §68, §69.*

Gemeten vandaag op mainnet en devnet:

| cluster | `FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK` |
|---|---|
| mainnet | **bestaat niet** — geen account, dus geen programma |
| devnet | aanwezig; ProgramData `DnDPmA17cj4HGpp6NyPs3U2RaCaDFWgVbzEGP7Ldwhjx`; upgrade-autoriteit = **`FzeAZm…` (het adres zelf)**; laatste deploy slot 491 648 033 |

Dat klinkt als een dichtgevroren programma: een adres tekent niet, tenzij het programma zelf via
CPI voor zichzelf tekent, en dát doet het niet. Dus heb ik de toestand nagemaakt op wegwerp
`P3 = Dorz4G17…` (autoriteit naar zijn eigen adres gezet) en geprobeerd die weer weg te dragen.

| poging | resultaat |
|---|---|
| CLI `set-upgrade-authority -k programmakpair` | faalt: `This account may not be used to pay transaction fees` — de CLI kent geen `--fee-payer`, dus de autoriteit moet de fees betalen, en een programmarekening mag dat niet |
| CLI met `--skip-new-upgrade-authority-signer-check`, nog steeds `-k programmakpair` | zelfde fout: het is geen autoriteitsprobleem maar een fee-probleem |
| **handgebouwde transactie**: `SetAuthority` met fee-payer = losse systeem-rekening, ondertekend door het programmakpair | **SUCCES** — autoriteit ging van `Dorz4G17…` naar de payer |

Conclusie: **`FzeAZm…` is niet bevroren.** De sleutel op schijf tekent gewoon; alleen de CLI kan er
geen transactie van maken. De overdracht naar een multisig-vault vereist dus één handgebouwde
transactie (fee-payer apart, autoriteit tekent), en die heb ik nu bewezen op een wegwerp.

Aantekening: `solana transfer` in Agave 4.1.2 is positioneel (`<RECIPIENT> <BEDRAG> --from`), en
naar een nog ongefund adres alleen met `--allow-unfunded-recipient`. Een keypair waarnaar je overmaakt
kun je daarna niet meer als verse program-id gebruiken (`not an upgradeable program or already in use`).
`Transaction.sign()` in web3.js is variadic: `tx.sign(a, b)`, niet `tx.sign([a, b])`.

Sloopwerk op devnet: `JBLKZuDxZdczFxBiUdCJTF36sntfzJatgF4zADams9Rs` heeft 1,4 SOL die ik erheen
stortte voor een mislukte deploy-poging; `P3` staat nu weer onder de wegwerp-payer.

## 72. Bouw van record, en het feit dat devnet een maand oude code draait

*Geschreven 2026-10-02 (main). Vereist: §71.*

### De bouw van record

`anchor build` (anchor-cli 1.1.2, vastgezet in `Anchor.toml [toolchain]`; platform-tools v1.54,
sbpf-rustc 1.89) geeft `target/deploy/active_defense.so`:

```
367 056 byte   sha256 81add7bab27aa4e93e79d79ac7e18486931196fa63651530d2fc5469ed8d3b97
```

Determinisme is gemeten, niet aangenomen: `programs/active-defense/src/lib.rs` aangeraakt (inhoud
ongewijzigd) → `Compiling active-defense` verschijnt wél → dezelfde hash. Eerdere "beproevingen" die
ik zelf deed met alleen `cargo clean -p` waren waardeloos: die lieten de sbpf-cache heel en kopieerden
het oude artefact in 1 seconde.

**Gevaar:** `cargo build-sbf` rechtstreeks geeft een *andere* binair — 458 344 byte, `ef8451fe…`.
Twee aannemelijke commando's, twee binaireën. Alleen `anchor build` is de record; wat er gedeployd
wordt moet achteraf on-chain op hash vergeleken worden.

### Wat er op devnet draait

De ELF in ProgramData `DnDPmA17…` is 277 200 byte en blijkt **byte-identiek** aan
`target/deploy/active_defense.pre-fix2-6e51720.so` (275 480 byte, sha `32971d30…`, van 2026-09-01),
opgevuld met 1720 NUL-bytes tot de bij de deploy gekozen `max_data_len`.

Gevolg is hard: **elke test die na 1 september "tegen devnet" groen is gemeten, draaide code die niet
meer in de bron boom staat.** Terugval-exemplaar: `notes/archief/devnet-FzeAZm-277200-fdc80992.so`.

### Groei van het programdata-account (gemeten op wegwerp P3)

| poging | resultaat |
|---|---|
| `solana program upgrade <buffer> <P3>` met een grotere binair | **FAALT**: `ProgramData account not large enough` |
| `solana program deploy <grote .so> --program-id <P3>` | **SUCCES**: dezelfde ProgramData-rekening `63sbboBY…` gegroeid van max_data_len 19 872 → 367 056, ELF erin = sha `81add7ba…` |

Dus: `program upgrade` weigert groei, `program deploy --program-id` groeit automatisch (vlag
`--no-auto-extend` bestaat om dat uit te zetten), en `--max-len <n>` reserveert bij de eerste deploy
ruimte boven de omvang van de binair. Huur is ~5,08 lamports/byte: 367 056 byte kost 1,8655 SOL.

`--upgrade-authority` aanvaardt **alleen een keypair-bestand**; een kaal adres wordt verwierpen
(`No such file or directory`). De autoriteit kan bij deploy dus niet rechtstreeks op de Squads-vault
gezet worden — de overdracht moet erna, en §71 liet zien dat dat alleen handmatig kan als de
autoriteit geen fees mag betalen.

### Beslissingen die ik hier neem

1. **Bouw van record** is `anchor build` → `81add7ba…`. Na elke deploy: on-chain ELF-hash vergelijken
   met lokaal. Zonder die vergelijking is "gedeployd" geen uitspraak over code.
2. **Devnet moet eerst op de bouw van record** voordat enig testresultaat telling doet. Route:
   `program deploy --program-id FzeAZm…` (auto-extend), met het terugval-exemplaar in de hand.
3. **Mainnet wordt een verse deploy.** Adreskeuze: `FzeAZm…` hergebruiken houdt Anchor.toml, tests en
   clientconfig gelijk; een vers adres houdt het programmakpair uit de buurt van wat er nu draait.
   Ik neig naar hergebruik, mits de sleutelhygiëne daarvoor staat (één keer hot, daarna machtloos).
4. **Ruimte reserveren met `--max-len`.** De bron groeide 275 480 → 318 136 → 367 056 in een maand.
   Auto-extend bestaat, maar een vergroting op het moment dat het moet is een extra ronde en extra
   huur op een onhandig moment. Voorstel: `--max-len` op ~2× (734 112 byte ≈ 3,73 SOL vast).
5. **Time-lock 24 uur** op de multisig; **indiener ≠ betaler**; overdracht naar de **vault-PDA**.

## 73. Devnet draait de bouw van record; het meetinstrument zelf was kapot

*Geschreven 2026-10-02 (main). Vereist: §72.*

### Wat er veranderd is op devnet

`FzeAZm…` draait nu `81add7ba…` (367 056 byte), voorheen de build van 1 september.
Gedeployed met `program deploy --program-id FzeAZm… -k target/deploy/active_defense-keypair.json
--fee-payer <wegwerp BA5SbPYr…>` — hun eigen wallets zijn niet aangesproken. Laatste deploy-slot
506 762 253, autoriteit nog `FzeAZm…` (eigen adres), ProgramData-huur 1,8655 SOL.

Terugvallen kan altijd: `notes/archief/devnet-FzeAZm-277200-fdc80992.so` is de exacte vorige bytes
(275 480 + opvulling). Een kleinere binair terug in een groter ProgramData-account mag, dus de weg
terug is niet geblokkeerd door de vergroting.

Vóór ik deploide gecontroleerd of er iets aan hangt: de devnet-mint `6iaGrudV…` bevat de 32 bytes van
`FzeAZm…` **niet**, dus geen enkele mint op devnet is aan deze hook gebonden. De upgrade kon dus geen
andere bestaande functionaliteit breken — gemeten, niet verondersteld.

### Het instrument was kapot, en dat viel alleen op als je ernaar zocht

`scripts/controle.sh` check 5 vergelijkt de gedeployde data-lengte met de lokale `.so` en leest daar
`Programdata length:` uit `solana program show`. **Agave 4.1.2 schrijft dat veld `Data Length:`.**
De check faalde daardoor altijd met `cluster bereikbaar? geen programdata-length…` — een eerlijke
faalmelding, maar wel één die al weken een verkeerde reden geeft. Gecorrigeerd naar beide labels;
`controle.sh --cluster https://api.devnet.solana.com` is nu groen en bevestigt 367 056 on-chain.

Les: een faalende check is veiliger dan een slapende check, maar een faalende check die de *ware* reden
verbergt, kost tijd en wekt wantrouwen dat je nodig hebt voor de echte checks.

### Determinisme, versterkt

`notes/ARTEFACTEN.md` kende `81add7ba…` al (vastgelegd 2026-10-01, "gebouwd uit de §64-werkboom vóór
`ff8868a`, platform-tools v1.52"). Vandaag herbouwd met anchor-cli 1.1.2 en platform-tools v1.54:
**dezelfde hash**. De bouw van record is dus reproduceerbaar over een dag én over een
platform-tools-wissel heen.

### Stand

| ding | staat |
|---|---|
| bouw van record | `anchor build` → `81add7ba…`, 367 056 byte |
| devnet | draait die build, slot 506 762 253 |
| instrument | `controle.sh --cluster` groen (na labelcorrectie) |
| terugval | `notes/archief/devnet-FzeAZm-277200-fdc80992.so` |
| mainnet | nog niets; adreskeuze en `--max-len`-ruimte staan open (§72 beslissingen 3 en 4) |

## 74. Zes van de zes: de huidige bron voor het eerst echt gemeten

*Geschreven 2026-10-02 (main). Vereist: §72, §73.*

Devnet draaide tot §73 code van 1 september. Dat betekent: **geen enkele test die na 1 september
"groen" is gemeten, heeft ooit de huidige bron getest.** Deze sessing is dat voor het eerst wél gebeurd,
tegen `81add7ba…` op devnet en op een lokale Agave-validator.

| test | waar | resultaat |
|---|---|---|
| `activeDefenseFull.ts` | devnet | GROEN |
| `addAuthorizedRecipientIsolated.ts` | devnet | GROEN |
| `attachTransferHookIsolated.ts` | devnet | GROEN |
| `clientLibraryE2E.ts` | devnet | GROEN (tweede poging) |
| `poisonTransferHookIsolated.ts` | devnet | GROEN (tweede poging) |
| `markUnmarkReplayIsolated.ts` | localnet | GROEN — §64-replay op een echte validator |

### Twee keer rood was geen code, en dat is belangrijk om te onderscheiden

De eerste ronde gaf `clientLibraryE2E` en `poisonTransferHookIsolated` rood met
`HTTP 429 Too Many Requests` van `api.devnet.solana.com`. Na een pauze en opnieuw draaien: beide
groen, zonder dat er één regel code is veranderd. Wie dit niet had nagelopen, had twee groene tests
als rood opgeschreven — of erger: een rate-limit als een bug in §64 geïnterpreteerd.

`markUnmarkReplayIsolated.ts` weigert devnet expliciet (`dit script schrijft accounts; het draait
alleen tegen localnet`). Dat is géén falen maar een ontwerpkeuze die ik respecteer: het script
weigeren schrijven naar een gedeeld netwerk als "even testen" de bedoeling was. Het draait dus op
`scripts/localnet.sh --script …`, met dezelfde `.so` als devnet.

### Wat dit wél en niet bewijst

Bewezen: de huidige bron compileert reproduceerbaar, laadt op Agave, en gedraagt zich op devnet en
localnet zoals de tests verwachten — inclusief het verbruikmechanisme van §64 op een echte validator.

Niet bewezen: mainnet-gedrag. Mainnet heeft een andere feature-set (geactiveerde features, rent,
compute-limieten) en geen enkel account dat hier hangt. De volgende stap is dus niet "nog meer tests",
maar de hoofnet-ceremonie zelf voorbereiden: adreskeuze, `--max-len`-ruimte, autoriteitsoverdracht
naar de vault-PDA, en die ceremony één keer doorlopen op een wegwerp.

## 75. Volgorde van de mainnetbeslissingen, en wat `/tmp` mij over mainnet leerde

*Geschreven 2026-10-02 (main). Vereist: §72, §73.*

### Eerst de repetitie, dan de adreskeuze — en waarom die volgorde eenrichting is

De vraag was of ik eerst `FzeAZm…`-hergebruik en `--max-len` moet kiezen, of de ceremonie moet
naspelen. De repetitie heeft geen adreskeuze nodig (die draait op een wegwerp-id); de adreskeuze heeft
wél de repetitie nodig. Twee redenen:

1. **`--max-len` is nu alleen een belofte in een help-tekst.** Dat de vlag bestaat, is gelezen; dat ze
   werkelijk `max_data_len = gereserveerde waarde` zet en wat dat kost, is nog niet gemeten. §72 bewees
   wél de grens: `program upgrade` weigert alles boven `max_data_len` (`ProgramData account not large
   enough`). Een reservering is dus pas een keuze als de reservering zelf gemeten is.
2. **Of de overdracht atomaire kan, bepaalt het risico van adreshergebruik.** Lukt deploy +
   `SetAuthority → vault` in één transactie, dan bestaat er geen moment met een hete macht en is
   hergebruik betaalbaar. Lukt het niet, dan kiest hergebruik voor een venster waarin een keypair dat
   op meer machines heeft gestaan de macht draagt. Adreskeuze vóór die meting is gokken op een punt
   dat onherroepelijk wordt zodra een mint aan de hook hangt.

### `/tmp` is hier vergankelijk, en dat is geen bijzaak

Midden in deze sessie werd `/tmp` leeggemaakt. Daarmee verdwenen: de wegwerp-payer `BA5SbPYr…`, de
drie leden-sleutels van de §69-multisig `HXsa6nnU3…`, en de keypairs van de proef-programma's
`p3/p4/p5`. Geen echte waarde verloren — het was devnet-SOL en wegwerpcode — maar de §69-multisig kan
nooit meer ondertekenen, en mijn eigen eerdere meetopstellingen zijn niet meer te besturen.

Dit is precies de categorie fout die dit project voor mainnet moet vermijden: **sleutelmateriaal op
een opslaglaag die niet van jou blijkt.** Voor mainnet geldt dat verlies van de juiste sleutel geen
onhandigheid is maar definitief — een upgrade-autoriteit die niemand meer kan tekenen, is dezelfde
eindstaat als de onupgradebare programma's uit §68 en §71.

Daarom staat de repetitiewerkruimte nu in het project zelf: `.repetitie/`, expliciet opgenomen in
`.gitignore` (sleutels komen nooit in git), met daarin `payer.json` (`PfXMpPptTFDjTFucwT7apJAHL2GUF8noai1Jzbui95e`)
en `proef-id.json` (`8EPk8eNDVTFeiDEsfrAEoczmywgEiFouh19bhSvq42QX`).

### Waar de repetitie nu staat

| onderdeel | staat |
|---|---|
| werkruimte | `.repetitie/` in het repo, git-uitgesloten |
| `--max-len`-meting | **blokkeert op devnet-SOL** — de faucet rate-limt dit IP (`airdrop request failed`) |
| atoomaire deploy + autoriteitsoverdracht | nog te bouwen, na de `--max-len`-meting |
| hoofnet | niets; adres en reserverering blijven open totdat deze twee metingen groen zijn |

Zodra er 3 devnet-SOL op `PfXMpP…` staat: deploy van `active_defense.so` (367 056 byte) onder
`8EPk8eND…` met `--max-len 800000`, dan ProgramData-grootte en huurlast aflezen en toetsen op
`45 + 800000`. Dat getal is de invoer voor de reserveringskeuze; §72's grensbewijs doet de rest.

## 76. De mainnet-ceremonie bestaat, en hij is atomair

*Geschreven 2026-10-02 (main). Vereist: §72, §75.*

### `--max-len` gemeten, niet aangenomen

Deploy van `active_defense.so` (367 056 byte) met `--max-len 800000`:

```
ProgramData-rekening   800 045 byte   → max_data_len 800 000   (klopt exact)
huurlast               4,0649 SOL     → 5 081 lamports per byte
```

Kostenmodel voor mainnet (huur is cluster-identiek), bij huidige code van 367 056 byte:

| reservering | `max_data_len` | huur vast |
|---|---|---|
| exact | 367 056 | 1,865 SOL |
| 1,5× | 550 584 | 2,798 SOL |
| **2× (aanbevolen)** | **734 112** | **3,730 SOL** |
| 3× | 1 101 168 | 5,595 SOL |

### Reservering is échte groeiruimte

Upgrade van diezelfde proef-programma van 367 056 → **458 344** byte (de `.so` uit de andere
bouwstraat) **slaagt**, en `max_data_len` blijft 800 000. Samen met §72 (`program upgrade` weigert
alles erboven: `ProgramData account not large enough`) is dit het volledige bewijs: reserveren bij de
eerste deploy is de enige manier om later grotere code in hetzelfde adres te krijgen.

### Verificatieval bij reservering — belangrijk tijdens een ceremonie

Met reservering is de on-chain ELF-regio **niet** de lengte van je `.so` maar `max_data_len`,
aangevuld met nullen (meten: 800 000 regio voor 458 344 byte code). Een verificatie die de hele
ProgramData-data hasht, rapporteert dan **schijn-mismatch**. Correct is:

```
sha256(on-chain[45 .. 45 + len(lokale .so)])  ==  sha256(lokale .so)
```

Datzelfde verklaart §72's "277 200 = 275 480 + 1720 NUL" op devnet.

### De atomaire ceremonie: gebouwd en geslaagd

Uit `agave/programs/bpf_loader/src/lib.rs` (niet uit een SDK — de geïnstalleerde web3.js 1.99
exporteert `UpgradeableLoader` hier niet):

| # | instructie | accounts |
|---|---|---|
| — | `ComputeBudget.setComputeUnitLimit(1 400 000)` | |
| 1 | `SystemProgram.createAccount` (ruimte 36, huur-vrij, eigenaar = loader) | betaler → nieuw program-id |
| 2 | `DeployWithMaxDataLen` — data: `u32(2) ++ u64(max_data_len)` | 0 betaler·WS, 1 programdata-PDA·W, 2 program-id·WS, 3 buffer·W, 4 rent-sysvar, 5 clock-sysvar, 6 systeemprogramma, 7 autoriteit·S |
| 3 | `SetAuthority` — data: `u32(4)` | 0 programdata·W, 1 huidige autoriteit·S, 2 nieuwe autoriteit (vault-PDA, niet-tekenaar) |

Detail uit de bron dat een tweekrachtige poging scheelt: `SetAuthority` **vertakt op de state van het
account** (Buffer of ProgramData), er is geen apart type-byte; en het program-account moet al bestaan
en huurvrij zijn vóór instructie 2, want de loader eist `ExecutableAccountNotRentExempt` anders.

Resultaat op devnet (`7nkRe7uKfAV2Zj7TLdhBPWDDWrPNUPZ2KquEKN4gM13U`, signature
`32UUM26NiyH4P1jpQLDBG9oLr6w9yszbSnsMVUM6mzPEBh99fCYqRBXvcpf7BJ4WjE4gvoreFbwKSLMYFDEEPGjD`):

```
autoriteit na de transactie : CjMN1dfjvi7rZAUaojX76kjNSthX2c63H42FgSZ95k8p  (de vault-PDA) ✓
max_data_len                : 400 000 ✓
ELF-prefix sha256           : 81add7ba… == lokale bouw van record ✓
```

Tegencontrole: autoriteit terughalen met de oorspronkelijke betaler faalt met
`Incorrect authority provided`. De overdracht is dus echt, en er bestond geen tussenstaat waarin een
hete sleutel de macht droeg — Solana's alles-of-niets-semantiek doet dat, niet mijn volgorde.

### Kosten van de repetitie, afgerekend

`~/.config/solana/id.json`: 79,2894 → **77,2489 devnet-SOL**. Het proefprogramma met 800 000 reserve
is gesloten (`Closed Program Id 8EPk8eND…`, **4,0649 SOL terug**). Blijft staan: 2,04 SOL huur in het
atoom-programma, opzettelijk onbereikbaar gemaakt — dat ís de test.

### Wat dit beslist voor mainnet

1. **Adreshergebruik van `FzeAZm…` is veilig wat betreft machtswenster**, mits met deze transactie
   gedeployed wordt: het keypair tekent alleen de `createAccount`/deploy en is daarna nooit meer
   autoriteit. Zonder deze vorm ontstaat wél een window — dus de CLI-route (`deploy` + apart
   `set-upgrade-authority`) is de zwakkere keuze, niet de makkelijkere.
2. **`--max-len` op 2× (734 112 byte ≈ 3,73 SOL)** is mijn aanbeveling. De bron groeide 275 480 →
   318 136 → 367 056 in één maand; een nieuw programmadres nodig krijgen nádat een mint aan de hook
   hangt, is véél duurder dan 1,9 SOL extra huur.
3. **Hygiëne vóór mainnet:** `~/.config/solana/id.json` staat op mod `0664` — leesbaar voor elke
   gebruiker op deze machine. Voor een devnet-CLI-wallet een onhandigheid; voor een sleutel die ooit
   mainnet tekent, een inbraak.

### Nog open

Drie dragers, time-lock van 24 uur, en het back-upbeleid voor de handovers (§70). De ceremonie zelf is
nu geen onbekende meer.

## 77. Mijn eigen gereedschap wijzigde hun project, en `git status` ving het

*Geschreven 2026-10-02 (main). Vereist: §76.*

### Wat er gebeurde

Om de atomaire ceremonie te bouwen had ik `@solana/web3.js` nodig. Ik installeerde die in
`.repetitie/` — een directory die netjes in `.gitignore` staat. **Dat redde de repository niet van de
manifestwijziging:** npm vond de `package.json` van het project en tilde de root van

```
"@solana/web3.js": "^1.98.0"   (slot: 1.98.4)      →   "^1.99.0"   (+46/−31 regels lock, nieuwe transatieven)
```

Een gitignore-regel beschermt tegen vastleggen, niet tegen wijzigen. Dat onderscheid had ik uit het
oog verloren.

### Waarom dit hier staat en niet als bijzaak

Tijdens een mainnet-ceremonie is dit de gevaarlijke categorie: een hulptool dat je *even* installeert
verandert de bomen waaronder je net je tests draaide en waartegen je straks verifieert. De testuitslag
en de deploy zijn dan niet meer dezelfde waarheid.

### Terugdraaien en bevestigen

1. `git checkout -- package.json package-lock.json`
2. `npm ci` — installeert exact volgens het slotbestand, geen interpretatie
3. gecontroleerd: `node_modules/@solana/web3.js` = **1.98.4** (weer de vergrendelde versie)
4. één harness-test opnieuw: `addAuthorizedRecipientIsolated.ts` → exit 0 in 6 s
5. `git status --porcelain` → leeg

### Regel die ik hiermee overneem

**Pakketinstallaties horen niet binnen de projectboom**, al helemaal niet tijdens een ceremonie.
Tooling buiten het repo (`$HOME/...`) of met een expliciet eigen projectje erbuiten; `--no-save` is
niet genoeg, want npm loopt omhoog naar de dichtstbijzijnde manifest. En na élke installatie:
`git status --porcelain`. Die check kost een seconde en vingt precies dit.

### Bijvangst voor §76

De claim dat `UpgradeableLoader` hier ontbreekt, was géén bijproduct van mijn eigen installatie: in
1.98.4 is hij net zo goed `undefined` als in 1.99.0. De handbouw uit §76 was dus nodig, en staat.

## 78. Gereedschap vóór het document: `controle.sh` log, twee bugs in mijn eigen script

*Geschreven 2026-10-02 (main). Vereist: §76, §77.*

Een runbook dat verwijst naar commando's die niet werken, is gevaarlijker dan geen runbook: tijdens een
ceremonie vertrouw je erop. Dus eerst het gereedschap, toen het document.

### `controle.sh` check 5 was fout bij reservering — door mijzelf zo geschreven

De check vergeleek de gedeployde lengte met de lokale `.so`. Met `--max-len` zijn die **nooit** gelijk
(het account is `max_data_len` breed, aangevuld met nullen), dus mijn eigen verificatiestap zou op een
geslaagde mainnet-deploy vals rood slaan. Nieuwe logica: lengte-only is verboden bij reservering; er
wordt een prefix-hashvergelijking gedaan via de nieuwe helper.

Drie gevallen, allemaal gedraaid:

| geval | verwacht | gemeten |
|---|---|---|
| devnet `FzeAZm…`, `max_data_len` == code | groen | `GELIJK`, exit 0 |
| atoom-programma, 400 000 reserve om 367 056 code | groen via prefix | `GELIJK`, "opvulling: 32 944 byte NUL …buiten de vergelijking" |
| **negatief**: verkeerde `.so` eronder | rood | `VERSCHIL — dit is niet de build die je dacht te deployen`, exit 1 |

Het negatieve geval is geen formaliteit: een verificatie die alles groen meldt, is geen verificatie.

### `scripts/ceremonie-deploy.js` — wat het beschermt

- `--vault` moet **letterlijk gelijk** zijn aan `--bevestig` (twee keer overtypen); typfout → afbreken,
  want een verkeerde autoriteit bevriest het programma definitief (§68/§71)
- `max-len` moet ≥ de code zijn (§72)
- de vault mag geen adres zijn waarvan hier een sleutel ligt
- de buffer wordt **vooraf** geopend en zijn bytecode vergeleken met de lokale `.so` — dus vóórdat er
  iets getekend wordt, staat vast dat de buffer de bouw van record bevat
- standaard wordt alleen **gesimuleerd**; verzenden gebeurt uitsluitend met `--stuur`

Droogloop op devnet: `simulatie: OK — 5190 compute units`, niets verzonden.

### Twee bugs in dat gereedschap, beide dodelijk tijdens een ceremonie

1. `v.indexOf("--")` zoekt een element dat **gelijk** is aan `"--"`, niet een die ermee **begint** —
   dus alle vlaggen vielen weg en het script klaagde dat `--betaler` ontbrak. Nooit gevonden zonder de
   wakers zelf te testen.
2. `Connection.simulateTransaction(tx, {sigVerify:true})` gooit `Invalid arguments`: in web3.js 1.98 is
   die tweede parameter een **signers-array**, geen config-object. De SDK-doc die ik in mijn hoofd had,
   klopte niet met de geïnstalleerde versie — kijken in `node_modules` was sneller dan gokken.

Beide hadden zich pas op het moment suprême gemeld als ik dit niet had gedroogd.

### Afrekening

Buffer van de droogloop gesloten: **1,86548268 devnet-SOL terug**. Cumulatief verbruik van de
repetities blijft 2,04 SOL (de huur die opzettelijk in het atoom-programma `7nkRe7uK…` zit, onbereikbaar
gemaakt als test van de overdracht).

### Document

`notes/MAINNET-CEREMONIE.md`: elf poorten (fail-closed), de twee getallen die jij invult, buffer
schrijven, droogloop, ceremonie, verificatie met de juiste hash-methode, de onomkeerbare mint-stap, en
een terugvaltabel met de foutcodes die ik werkelijk zag (§72, §74, §76).

## 79. De volledige repetitie, en wat die twee systemische fouten blootlegde

*Geschreven 2026-10-02 (main). Vereist: §76, §77, §78.*

Het runbook is één keer helemaal doorlopen op devnet: poorten → buffer → droogloop → ceremonie →
verificatie → tegencontrole → terugval → opruimen.

| stap | resultaat |
|---|---|
| P1 P2 P4 P5 | groen (boom schoon, build == record, devnet == bytes, steekproeftest) |
| **P9** | **regeloverschrijding**: `~/.config/solana/id.json` stond op `0664` → teruggezet naar `0600` |
| P3 | herbouw groen, `.so` bit-identiek aan de record |
| buffer | `5rxq1CbC…` |
| droogloop | simulatie OK, 5190 CU, niets verzonden |
| ceremonie | `83nrkQiSG9aPYUdbqVRfjRbPP6B1HkLPa47sV7EkpesK`, autoriteit == vault, `max_data_len` 734 112, bytecode gelijk |
| verificatie | `program show` bevestigt autoriteit en lengte; hash-helper GELIJK met 367 056 byte opvulling buiten de vergelijking |
| tegencontrole | autoriteit terugdragen met de betaler faalt: `Incorrect authority provided` |
| terugval | upgrade naar andere build (458 344) binnen de gereserveerde 734 112, prefix-hash GELIJK, daarna gesloten: **3,7301678 SOL terug** |

### Bevinding 1 — stil falen is de gevaarlijkste foutsoort hier

`confirmTransaction` **resolve ook als de transactie on-chain mislukt**; ik controleerde het `err`-veld
niet. Daarmee meldde mijn eigen gereedschap "SUCCES" bij het aanmaken van een multisig die **nooit is
aanangemaakt** — bleek toen ik er iets uit wilde halen: `AccountNotInitialized` (3012).

Dit raakt §76 niet in de uitkomst: daar stond na de deploy een onafhankelijke staatcontrole (autoriteit,
lengte, hash), en die is wat telt. Maar het laat precies zien waarom stap 5 van het runbook geen
vriendelijkheid is. **Een verzending zonder gecontroleerd foutveld is geen bevestiging.**

### Bevinding 2 — de vaultadres mag ik nooit zelf afleiden

Ik probeerde een 2-van-3 multisig op devnet met `@sqds/multisig`. Het programma wees bij het aanmaken
een account aan dat ik uit 168 zaadcombinaties niet kon reproduceren; het SDK-pakket blijkt niet te
matchen met wat er op devnet draait. Mijn eerdere handmatige vault-afleiding reproduceerde het §69-adres
niet.

Consequentie voor mainnet, en dit is hard: **het vaultadres wordt afgelezen van de multisig die je werkelijk
heeft aangemaakt** (UI of on-chain account), niet berekend door mijn gereedschap. Een verkeerd adres als
upgrade-autoriteit is precies de bevriezing uit §68 en §71.

Daarmee kon ook het "de vault kan handelen"-luik hier niet opnieuw bewezen worden; dat rust op §69, en
de back-uppoort (P11) is waarom dat niet lichtvaardig is.

### Gereedschapshertoegang tijdens de repetitie

`controle.sh --cluster` controleerde het adres uit `Anchor.toml`, **niet** het zojuist gedeployde programma
— het meldde GROEN op grond van een ander account (367 056 tegenover 734 112 byte). Er is een `--id`-vlag
bijgekomen; gemeten: met `--id` naar de replica (groen, juiste lengte), zonder `--id` oud gedrag, en tegen
een vreemd mainnet-programma (`Tokenkeg…`, 108 600 byte) terecht **ROOD**.

### Afrekening

Wallet `G1qgHzMx…`: 79,2894 → **73.2900 devnet-SOL**, verbruik 5.9995.
Waar het zit: de huur staat in het **ProgramData**-account, niet in het program-account zelf (die houdt
slechts 0,0008 SOL — meten van het verkeerde account geeft dus een bedrieglijk beeld). Vastgezet en
opzettelijk onbereikbaar: **5.7630 SOL** over `7nkRe7uK…` (400k) en `83nrkQ…` (734k), beide onder
een vault — precies zoals mainnet. De rest (0.2364 SOL) zijn transactiekosten van
de repetitie, inclusief de mislukte transacties die ik als tegencontrole deed.

## 80. Twee meetpunten die de adreskeuze beslissen, plus het papier eromheen

*Geschreven 2026-10-02 (main). Vereist: §72, §76, §79.*

Twee dingen gemeten die ik tot nu toe aannam:

1. **Het programmadres zit in de bytecode.** De 32 ruwe bytes van `FzeAZm…` komen voor in
   `target/deploy/active_defense.so`. Een ander adres kiezen is dus geen configuratiekeuze maar een
   **bronwijziging met herbouw**, en daarmee een nieuwe bouw van record waarvoor §72–§79 opnieuw doorlopen
   moeten worden.
2. **Het programmakpair is nooit in git geweest.** Geen volgd bestand, geen spoor in `git log --all`, en
   `.gitignore` sluit het expliciet uit. Het echte bestand staat in
   `~/.config/active-defense/program-keypairs/active-defense-keypair.json` op mod `0600`;
   `target/deploy/active_defense-keypair.json` is een symlink ernaartoe. Publiek sleutel == Anchor-id.

Daarmee is hergebruik van `FzeAZm…` verdedigbaar: het artefact blijft hetzelfde, en het kpair tekent bij
de atomaire ceremonie uitsluitend de aanmaak en houdt daarna geen enkele macht (§76).

**Papier.** `notes/BESLISBLAD-ADRES.md` (keuze, kosten, wat vast komt te zitten, ondertekening) en
`notes/VAULT-VOORBEREIDING.md` (2-van-3, time-lock 86 400 s, adressen aflezen uit de ui, en het bewijs
dat de vault kan handelen — de enkele test die ik op devnet niet kon leveren, §79).

**Open, en niet door mij te beantwoorden:** of er buiten deze machine een back-up van het programmakpair
bestaat. Zonder die back-up is keuze A bij verlies onuitvoerbaar en moet er hoe dan ook herbouwd worden.

## 81. "Geen herstel, liever herbouwen" — gemeten in plaats van gehoopt

*Geschreven 2026-10-08 (main). Vereist: §72, §80.*

Het standpunt van de eigenaar is: geen back-upregime, geen herstelzinnen, geen staal, geen passphrase.
Bij verlies wordt herbouwd. Dat is alleen een beveiligingsmodel als herbouwen werkelijk kan — dus dat
werd getest in plaats van aangenomen.

**Meting.** `git clone --depth 1` van `git@github.com:anoadder-ship-it/active-defense.git` naar
`/tmp/ad-herbouw-test/repo` (HEAD `eadd0465dc50`, gelijk aan lokaal `main`), daarbinnen `anchor build`
zonder enige bouwcache, en de uitkomst vergeleken met de bouw van record:

| | grootte | sha256 |
|---|---|---|
| verse kloon vanaf GitHub | 367 056 byte | `81add7bab27aa4e93e79d79ac7e18486931196fa63651530d2fc5469ed8d3b97` |
| bouw van record (§72) | 367 056 byte | idem |

**Bit-identiek.** Dit is sterker dan §72, waar twee bouwen *op dezelfde werkboom* werden vergeleken; nu
stond er niets anders dan wat GitHub oplevert. Het herbouwmodel draagt dus — voor het programma.

**Waar het ophoudt.** Twee grenzen, beide eerder gemeten (§6, §80):
1. Het programmadres zit in de `.so`, dus herbouwen onder een *ander* adres kost een bronwijziging met
   volledige herverificatie. Uren, geen geld.
2. **Een mint migreert niet.** Een Token-2022-mint blijft aan zijn hook-programmadres gebonden; een nieuw
   adres redt een bestaande mint niet. Verlies van de autoriteit ná de mint is daarom onherstelbaar:
   token dood, huur vast, adres voorgoed onbruikbaar.

Daarmee is de zinloze vraag "waar ligt de ciphertext?" beantwoord door er eentje te vervangen: **er is
geen ciphertext nodig, en de enige muur die er toe doet staat vóór de mint.** `notes/VAULT-VOORBEREIDING.md`
§4 en `notes/BESLISBLAD-ADRES.md` zijn dienovereenkomstig herschreven naar aanvaarding met paraaf; in het
runbook staat de mint-regel nu als dragende regel in plaats van als hygiëne.

**Procesnotitie.** Een eerdere poging tot deze meting werd afgebroken voordat er één bestand bestond, en
ik had geen uitvoer om naar te kijken. Dat is precies de fout die ik de hele week probeer te vermijden:
aannemen dat een commando liep omdat ik het stuurde. De les staat hier: eerst bestaan controleren, dan
pas concluderen.
