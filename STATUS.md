# active-defense — STATUS.md

**Doel van dit document:** eerste bestand om te lezen bij hervatten van dit project in
een nieuwe chatsessie. Legt vast waar we staan en waarom, zodat niets herhaald hoeft te
worden. Zelfde functie en stijl als spankwallet's eigen `STATUS.md` — dat bleek na weken
nog bruikbaar om zonder geheugenverlies verder te werken, dus dit project krijgt er meteen
één, vanaf de eerste commit.

Laatst bijgewerkt: 2026-08-26 — repo aangemaakt, vers en privé, schoon-bouw- en
deploy-bewijs geleverd (sectie 2). Klaar voor de opschoning aan spankwallet-kant.

---

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
of -sleutels nodig te hebben voor dit basisbewijs. Klaar voor stap 5 (opschoning aan
spankwallet-kant).

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
zie punt 2 hieronder voor waarom die commit toch al de referentie is), `declare_program!
(spankwallet);` invoeren, de vijf handmatige offset-constanten vervangen door benoemde
veldtoegang. Zolang dat niet gebeurd is: bij elke wijziging aan een van de vijf constanten,
of bij elke nieuwe spankwallet-release, eerst herverifiëren zoals hierboven — nooit
aannemen dat een offset nog klopt omdat hij dat de vorige keer deed.

**2. Tests draaien nog tegen het echte, multisig-bestuurde spankwallet-programma
(`9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9`).** `tests/activeDefense.ts` en
`tests/activeDefenseFull.ts` roepen `init_wallet` aan op dat adres om een testwallet op te
zetten — productietestverkeer op spankwallet's kant, en de reden dat spankwallet's eigen
sectie-85-telling (14 wallets) inmiddels bij 17 staat (deels dit, deels spankwallet's eigen
legitieme post-upgrade-proofscripts — niet één-op-één aan active-defense toe te schrijven
zonder per-wallet forensisch werk, maar het is in elk geval een deel van de ruis).

**Vervolgstap, beschreven maar nog niet gebouwd** (spankwallet-STATUS.md, inventarisatie
2026-08-26): een eigen wegwerp-deploy van spankwallet als testfixture, met hergebruik van
spankwallet's sectie-87-wegwerppatroon (geïsoleerde worktree, tijdelijk lokaal
`declare_id!`, `refuseIfRealProgram()`-achtige harde grendel). Die grendel moet weigeren op
zowel het echte adres áls alle vier de adressen in de tabel hierboven — nooit alleen een
positieve check op "is dit het echte adres", ook een negatieve check op de lijst bekende
oude/wegwerp-adressen (zelfde patroon als spankwallet's
`scripts/verify-program-id-in-binary.ts`), zodat een verouderd adres nooit stilzwijgend
voor een nieuw kan doorgaan.

### Nog te doen (volgorde vastgelegd door de gebruiker, spankwallet-STATUS.md sectie 95)

1. ~~Nieuwe repo, vers, privé, alleen wat bij active-defense hoort~~ — dit document.
2. Bewijzen dat de repo op zichzelf staat: schoon bouwen vanaf een verse clone, plus een
   echte devnet-deploy/test — **nog te doen, zie volgende sectie zodra die er is.**
3. Pas daarna, aan spankwallet's kant: `programs/active-defense/` uit die tree, uit
   `Cargo.toml`/`Cargo.lock`, `build-and-deploy.sh` terug naar alleen spankwallet — één
   voorwaartse commit, geen rebase/reset.
4. Elke toekomstige herverificatie van B1-B7 (spankwallet-voorstel #11) blijft tegen commit
   `1fb3134` gebeuren, niet tegen spankwallet's `HEAD` — dat blijft zo ook ná de opschoning.
