# Active Defense

Solana-programma dat **Poison Token** en **Malicious Addresses** functionaliteit
toevoegt aan SpankWallet — een on-chain "active defense" laag die spam- en
poison-tokens blokkeert via Token-2022 transfer hooks, en per wallet een lijst
van malicious adressen bijhoudt.

- **Poison Token**: zet een Token-2022 transfer hook op een mint; transfers naar
  ongeautoriseerde ontvangers worden on-chain geblokkeerd. De officiële SPL-
  transfer-hook-interface (`ExtraAccountMetaList` + een `AuthorizedRecipient`-PDA
  per toegestane ontvanger) - geen `Vec<Pubkey>` in CPI-data meer (dat oude
  ontwerp, `create_poison_token`, is verwijderd - STATUS.md sectie 17)
- **Malicious Addresses**: per-wallet lijst van gemarkeerde adressen, met
  mark/unmark (max. 32 adressen per wallet)
- **Passkey-gedreven**: elke actie wordt geautoriseerd via SpankWallet's WebAuthn-passkey
  (secp256r1-precompile), niet via een seed phrase
- **Zelfstandig programma**: eigen repo, eigen identiteit, geen spankwallet-code of
  -sleutels nodig om te bouwen of te deployen
- **Leest SpankWallet read-only**: haalt `owner_passkey` en `action_nonce` uit
  SpankWallet's WalletAccount (externe, versie-gepinned dependency — zie STATUS.md)

> **STATUS.md** is de primaire bron van waarheid voor voortgang, gotchas en
> beslissingen. Lees die eerst als je het project hervat — dit README geeft alleen
> het overzicht.

## Huidige staat (september 2026)

| Onderdeel | Status |
|-----------|--------|
| On-chain programma (5 instructies) | Gedeployed op devnet, **zelfstandig bewezen** (schoon build + deploy + `test-verify.js` groen, vanaf een verse kloon — STATUS.md sectie 2) |
| `attach_transfer_hook` + `add_authorized_recipient` + `poison_transfer_hook` | **Route B, end-to-end bewezen op devnet** (STATUS.md sectie 13/14): echte Token-2022 `Execute`-interface, `SPL_DISCRIMINATOR_SLICE`, `ExtraAccountMetaList`-resolutie, `AuthorizedRecipient`-PDA-per-ontvanger. `create_poison_token` (het oude, structureel verkeerde ontwerp) is verwijderd (sectie 17) |
| `mark_malicious` / `unmark_malicious` | Geïmplementeerd (fase 1) |
| Client-library (`client/src/poisonToken.ts`) | **Herschreven tegen Route B (huidige 5-instructieversie)** — offline geverifieerd (STATUS.md sectie 19) en on-chain end-to-end bewezen via haar eigen publieke API (STATUS.md sectie 26) |
| Test-isolatie (permanente, gepinde spankwallet-testfixture) | Afgerond — blocklist tegen het echte adres + oude wegwerpadressen (STATUS.md sectie 23), tests draaien er daadwerkelijk tegen (sectie 22) |
| `declare_program!` + gepind IDL | Nog te doen (openstaand punt 2 — nu nog handmatige byte-offsets) |

**Program ID (devnet):** `FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK`

**Upgrade authority:** hetzelfde keypair (nog geen multisig — STATUS.md sectie 3
legt uit waarom dit hier kritiek is, anders dan bij spankwallet).

### Hoe de poison-token-flow werkt

1. De mint wordt aangemaakt (client-side, `getMintLen([ExtensionType.TransferHook])`
   voor de juiste ruimte) - nog GEEN `InitializeTransferHook`-aanroep.
2. `attach_transfer_hook` wordt aangeroepen met een passkey-handtekening: doet de
   ECHTE `InitializeTransferHook`-registratie (via `anchor_spl`'s typed CPI-helper,
   `transfer_hook_initialize`) én initialiseert de `ExtraAccountMetaList`-PDA met
   het seed-recept dat tijdens een echte transfer naar de juiste
   `AuthorizedRecipient`-PDA wijst.
3. `add_authorized_recipient` maakt, per toegestane ontvanger, een eigen
   `AuthorizedRecipient`-PDA aan (seeds: mint + recipient). Het BESTAAN van die PDA
   ís de autorisatie - geen `allowed`-veld, geen gedeelde lijst die kan volraken.
4. `InitializeMint2` rondt de mint af (moet, per Token-2022's eigen regel, als
   allerlaatste stap komen - ná alle extensie-initialisatie).
5. Bij elke ECHTE transfer roept Token-2022 zelf `poison_transfer_hook` aan via de
   officiële `Execute`-interface (`SPL_DISCRIMINATOR_SLICE`), met de door stap 2's
   seed-recept dynamisch gevonden `AuthorizedRecipient`-PDA als extra account. Bestaat
   die PDA niet (destination niet geautoriseerd) → Anchor's eigen
   `AccountNotInitialized`-fout, vóór de handler-body draait → transfer geblokkeerd.
   Bestaat hij wel → transfer slaagt.

Volledig, end-to-end bewezen op devnet (echte transfer naar een toegestane ontvanger
slaagt, naar een niet-toegestane faalt) - zie STATUS.md sectie 14.

## Instructies

| Instructie | Autorisatie | Beschrijving |
|------------|-------------|--------------|
| `attach_transfer_hook` | Passkey (spankwallet) | Registreert de echte Token-2022 transfer hook + initialiseert `ExtraAccountMetaList` |
| `add_authorized_recipient` | Passkey (spankwallet) | Maakt een `AuthorizedRecipient`-PDA aan voor (mint, recipient) |
| `poison_transfer_hook` | (aangeroepen door Token-2022, `Execute`-interface) | Blokkeert transfers naar ongeautoriseerde ontvangers |
| `mark_malicious` | Passkey (spankwallet) | Markeer adres als malicious (per wallet, max. 32) |
| `unmark_malicious` | Passkey (spankwallet) | Verwijder adres uit de malicious-lijst |

Alle passkey-gedreven instructies volgen hetzelfde patroon:
1. Client genereert een challenge (Keccak-256 over program_id ‖ wallet ‖ domain ‖ payload)
2. User authentiseert met WebAuthn-passkey
3. `secp256r1`-precompile-instructie wordt vóór de eigen instructie geplaatst
4. Het programma verifieert de handtekening on-chain en controleert de `action_nonce`

## PDAs

| PDA | Seeds | Gebruik |
|-----|-------|---------|
| `MaliciousAddressesAccount` | `["malicious", wallet_pda]` | Per-wallet lijst van malicious adressen |
| `AuthorizedRecipient` | `["poison_authorized", mint, recipient]` | Bestaan = autorisatie om deze poison token te ontvangen (geen `allowed`-veld) |
| `ExtraAccountMetaList` | `["extra-account-metas", mint]` | Token-2022's eigen, standaard seed-recept - geen eigen data, puur resolutie-instructies |

**Let op:** er bestaat **geen** aparte `poison_token`-PDA - dat was het oude,
inmiddels verwijderde `create_poison_token`-ontwerp (STATUS.md sectie 17). De
`derivePoisonTokenPda()`-functie in de client-library en `test-verify.js` is een
restant daarvan (zie STATUS.md sectie 4).

## Structuur

*(stand 2026-08-30)*

```
active-defense/
├── programs/active-defense/src/
│   ├── lib.rs              # declare_id! + instruction dispatch (Route B, 5 instructies)
│   ├── instructions.rs     # implementatie (passkey-verificatie, SPL-transfer-hook-CPI's)
│   ├── state.rs            # MaliciousAddressesAccount + AuthorizedRecipient + constanten
│   └── errors.rs           # ActiveDefenseError enum
├── client/src/
│   ├── poisonToken.ts          # TS-clientlibrary (Route B — herschreven, zie STATUS.md §19)
│   └── verify-poisonToken.ts   # offline smoke-test voor de library
├── spankwallet-testfixture/
│   ├── README.md
│   ├── build-and-deploy.sh     # gepinde git-clone van spankwallet → wegwerp-deploy
│   ├── verify-program-id-in-binary.ts
│   └── spankwallet-throwaway-keypair.json
├── test/
│   └── verify-deployment.ts    # deploy-verificatie (groen)
├── tests/
│   ├── activeDefenseFull.ts            # E2E-test (Route B, tegen fixtures — §22)
│   ├── clientLibraryE2E.ts             # E2E via de client-library's publieke API (§26)
│   ├── addAuthorizedRecipientIsolated.ts
│   ├── attachTransferHookIsolated.ts
│   └── poisonTransferHookIsolated.ts
├── test-transfer-hook.js       # standalone: transfer hook verificatie
├── test-verify.js              # standalone: program live + PDA's
├── Anchor.toml                 # anchor 1.1.2 (otter-sec fork), devnet config
├── Cargo.toml                  # workspace root
├── package.json                # dependencies + scripts
├── tsconfig.json               # Node.js types
├── STATUS.md                   # primaire bron van waarheid
└── README.md                   # dit bestand
```

## Lokaal bouwen en testen

```bash
# Dependencies
npm install

# Build (anchor 1.1.2 — otter-sec/anchor fork)
anchor build

# Keypair-symlink zetten (elke nieuwe checkout moet dit handmatig doen)
ln -s ~/.config/active-defense/program-keypairs/active-defense-keypair.json \
      target/deploy/active_defense-keypair.json

# Deploy-verificatie (bewijst program live + PDA's afleiden)
npx ts-node test/verify-deployment.ts

# E2E-test (draait tegen de permanente, gepinde spankwallet-testfixture — STATUS.md sectie 23)
npx ts-node tests/activeDefenseFull.ts

# Standalone scripts
node test-verify.js
node test-transfer-hook.js
```

**Let op:** de tests zijn standalone `ts-node`-scripts, geen mocha-testen.
De `"test": "anchor test"` in `package.json` en het `[scripts]`-blok in
`Anchor.toml` zijn overblijfsels van een vroegere opzet — gebruik `npx ts-node`.

### Deployen naar devnet

```bash
# Gebruik een LOS keypair als fee-payer (NIET het canonieke keypair zelf!)
solana program deploy target/deploy/active_defense.so \
  --url devnet \
  --keypair ~/.config/solana/id.json \
  --upgrade-authority ~/.config/active-defense/program-keypairs/active-defense-keypair.json
```

**Voetangel:** geef het canonieke programma-ID-adres nooit vooraf zelf SOL.
De Solana-CLI weigert dan een eerste deploy met "not an upgradeable program or
already in use". Zie STATUS.md sectie 2 voor de volledige uitleg.

## Veiligheidsprincipes

- **Passkey i.p.v. seed phrase**: de user hoeft zijn private key nooit te
  tonen; de secp256r1-precompile verifieert on-chain
- **Action nonce**: elke actie verbruikt een on-chain nonce (leesbaar uit
  WalletAccount met variabele offset) — voorkomt replay
- **Challenge-binding**: de WebAuthn-challenge is gebonden aan program_id,
  wallet-PDA, domein en payload — geen generieke handtekeningen
- **Read-only spankwallet**: active-defense schrijft nooit naar spankwallet's
  accounts; het leest alleen `owner_passkey` en `action_nonce`
- **Upgrade authority = programma-ID zelf**: nog geen multisig; het ene
  keypair-bestand is de enige upgrade-route (STATUS.md sectie 3)

## Openstaande punten (korte samenvatting)

Volledige uitleg en vervolgstappen: **STATUS.md** secties 1, 4, en 9-17 (Route B).

1. **`poison_transfer_hook` verifieert niet dat de aanroep uit een echte
   Token-2022-transfer komt** (een directe aanroep kan willekeurige accounts
   meegeven) — extern onderzocht (STATUS.md sectie 16 punt 3, met bron): dit is
   BEWUST zo gelaten, niet vergeten. De officiële `TransferHookAccount.transferring`-
   vlag bestaat exact hiervoor, maar zowel abl-token als het officiële
   `block-list/pinocchio`-voorbeeld laten hem weg met de expliciete redenering dat
   dit alleen nodig is als de hook STATE SCHRIJFT. `poison_transfer_hook` is
   volledig read-only/stateless (leest alleen of een PDA bestaat) - een directe
   aanroep kan dus geen privileges verhogen of een echte transfer beïnvloeden.
2. **Handmatige byte-offsets naar spankwallet's WalletAccount/PasskeysAccount** —
   geverifieerd correct op 2026-08-26, maar structureel fragiel. Fix:
   `declare_program!` + gepind IDL-bestand.

(Voorheen ook: tests draaiden tegen het echte spankwallet-programma - opgelost door de
permanente, gepinde testfixture met blocklist tegen het echte adres, zie STATUS.md
sectie 23. En: client-library `poisonToken.ts` was verouderd t.o.v. Route B (discriminators
fout, phantom-instructies, data-layout mismatch) - opgelost door de volledige herschrijving
tegen de huidige 5-instructieversie, offline geverifieerd (sectie 19) en on-chain
end-to-end bewezen via haar eigen publieke API (sectie 26).)

## Relatie tot SpankWallet

Active-defense is een **companion-programma** van SpankWallet:
- Het leest SpankWallet's `WalletAccount` (read-only) voor `owner_passkey` en
  `action_nonce`
- Het gebruikt SpankWallet's passkey-authenticatie-flow (secp256r1-precompile)
- Het wijzigt SpankWallet **niet** — geen schrijfrechten op spankwallet's accounts
- SpankWallet's echte, multisig-bestuurde programma-ID en account-layout zijn een
  **externe, versie-gepinned dependency** (zie STATUS.md voor welke commit)

De twee leven in aparte repos met aparte levenscycli. De enige koppeling is de
read-only leesrelatie en de gedeelde passkey-flow.

## Licentie

Zie [LICENSE](LICENSE). MIT.
