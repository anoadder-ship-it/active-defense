# active-defense — STATUS.md

**Doel van dit document:** eerste bestand om te lezen bij hervatten van dit project in
een nieuwe chatsessie. Legt vast waar we staan en waarom, zodat niets herhaald hoeft te
worden. Zelfde functie en stijl als spankwallet's eigen `STATUS.md` — dat bleek na weken
nog bruikbaar om zonder geheugenverlies verder te werken, dus dit project krijgt er meteen
één, vanaf de eerste commit.

Laatst bijgewerkt: 2026-08-30 — Route B volledig (programma, client-library, tests; secties
11-22), canonieke devnet-programma geüpgraded en functioneel bewezen (sectie 20); lokale
werkboom en GitHub gesynchroniseerd (merge 418935d, sectie 24).

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
