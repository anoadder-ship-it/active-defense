# active-defense — STATUS.md

**Doel van dit document:** eerste bestand om te lezen bij hervatten van dit project in
een nieuwe chatsessie. Legt vast waar we staan en waarom, zodat niets herhaald hoeft te
worden. Zelfde functie en stijl als spankwallet's eigen `STATUS.md` — dat bleek na weken
nog bruikbaar om zonder geheugenverlies verder te werken, dus dit project krijgt er meteen
één, vanaf de eerste commit.

Laatst bijgewerkt: 2026-08-29 — permanente SpankWallet testfixture toegevoegd (sectie 6),
voor/na-verificatie bewezen dat SpankWallet's eigen repo niet wordt aangerakt.

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

## 6. Permanente SpankWallet Testfixture (2026-08-29)

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

Dus de **grootte** van het mint-account is het probleem, niet de fixture. Een
Token-2022-mint met extra extensie-ruimte faalt bij InitializeMint2 op devnet.
Fix (nog te doen): mint eerst aanmaken met exact MINT_SIZE en initialiseren, en vóór
STAP 4 (transfer hook) de account-resizen tot de nodige grootte — of de juiste
Token-2022-extensie-initiërisatievolgorde vinden.

**Schoonmaken (wanneer de fixture niet meer nodig is):**
`git -C ~/projects/spankwallet worktree remove ~/projects/spankwallet-testfixture` +
het throwaway-programma op devnet laten verouderen (of upgraden naar een leeg .so).