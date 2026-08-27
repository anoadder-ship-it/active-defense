# Active Defense

Solana-programma dat **Poison Token** en **Malicious Addresses** functionaliteit
toevoegt aan SpankWallet — een on-chain "active defense" laag die spam- en
poison-tokens blokkeert via Token-2022 transfer hooks, en per wallet een lijst
van malitieuse adressen bijhoudt.

- **Poison Token**: zet een Token-2022 transfer hook op een mint; transfers naar
  ongeautoriseerde ontvangers worden on-chain geblokkeerd (de authorized list zit
  in de mint's eigen transfer_hook_instruction data — geen aparte PDA)
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

## Huidige staat (augustus 2026)

| Onderdeel | Status |
|-----------|--------|
| On-chain programma (4 instructies) | Gedeployed op devnet, **zelfstandig bewezen** (schoon build + deploy + `test-verify.js` groen, vanaf een verse kloon — STATUS.md sectie 2) |
| `create_poison_token` + `poison_transfer_hook` | Geïmplementeerd; E2E-test bestaat (`tests/activeDefenseFull.ts`) maar draait nog tegen het **echte** spankwallet-programma (openstaand punt 3) |
| `mark_malicious` / `unmark_malicious` | Geïmplementeerd (fase 1) |
| Client-library (`client/src/poisonToken.ts`) | ⚠️ **VEROUDERD / niet functioneel** — discriminators kloppen niet, phantom-instructies, data-layout mismatch (STATUS.md sectie 4) |
| Test-isolatie (wegwerp-deploy van spankwallet) | Nog te doen (openstaand punt 3) |
| `declare_program!` + gepind IDL | Nog te doen (openstaand punt 1 — nu nog handmatige byte-offsets) |

**Program ID (devnet):** `FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK`

**Upgrade authority:** hetzelfde keypair (nog geen multisig — STATUS.md sectie 3
legt uit waarom dit hier kritiek is, anders dan bij spankwallet).

### Hoe de poison-token-flow werkt

1. `create_poison_token` wordt aangeroepen met een authorized list (`Vec<Pubkey>`)
   en een passkey-handtekening. Het programma verifieert de handtekening via de
   secp256r1-precompile, controleert de `action_nonce`, en zet daarna een
   Token-2022 `InitializeTransferHook` op de mint. De authorized list wordt
   opgeslagen **in de transfer_hook_instruction data van de mint zelf** (geen
   aparte PoisonToken-PDA — dat was het oude design).
2. Bij elke transfer van die mint roept Token-2022 onze `poison_transfer_hook` aan
   met de opgeslagen authorized list als argumenten.
3. De hook controleert of de destination owner in de authorized list staat.
   Staat hij er niet → error → transfer geblokkeerd.

## Instructies

| Instructie | Autorisatie | Beschrijving |
|------------|-------------|--------------|
| `create_poison_token` | Passkey (spankwallet) | Zet Token-2022 transfer hook op een mint met authorized list |
| `poison_transfer_hook` | (aangeroepen door Token-2022) | Blokkeert transfers naar ongeautoriseerde ontvangers |
| `mark_malicious` | Passkey (spankwallet) | Markeer adres als malitieus (per wallet, max. 32) |
| `unmark_malicious` | Passkey (spankwallet) | Verwijder adres uit de malitieus-lijst |

Alle passkey-gedreven instructies volgen hetzelfde patroon:
1. Client genereert een challenge (Keccak-256 over program_id ‖ wallet ‖ domain ‖ payload)
2. User authentiseert met WebAuthn-passkey
3. `secp256r1`-precompile-instructie wordt vóór de eigen instructie geplaatst
4. Het programma verifieert de handtekening on-chain en controleert de `action_nonce`

## PDAs

| PDA | Seeds | Gebruik |
|-----|-------|---------|
| `MaliciousAddressesAccount` | `["malicious", wallet_pda]` | Per-wallet lijst van malitieuse adressen |

**Let op:** het huidige programma gebruikt **geen** aparte `poison_token` PDA.
De authorized list leeft in de mint's Token-2022 transfer hook data. De
`derivePoisonTokenPda()`-functie in de client-library en `test-verify.js` is een
restant van het oude design (zie STATUS.md sectie 4).

## Structuur

```
active-defense/
├── programs/active-defense/
│   ├── src/
│   │   ├── lib.rs              # declare_id! + instruction dispatch
│   │   ├── instructions.rs     # implementatie (passkey-verificatie, CPI's)
│   │   ├── state.rs            # MaliciousAddressesAccount + constanten
│   │   └── errors.rs           # ActiveDefenseError enum
│   ├── Cargo.toml              # idl-build-feature + lints
│   └── Xargo.toml
├── client/src/
│   └── poisonToken.ts          # ⚠️ TS-clientlibrary (VEROUDERD — zie STATUS.md §4)
├── test/
│   └── verify-deployment.ts    # deploy-verificatie (groen)
├── tests/
│   ├── activeDefenseFull.ts    # E2E-test (draait tegen echte spankwallet)
│   └── activeDefense.ts        # v1 test-iteratie
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

# E2E-test (⚠️ draait tegen het ECHTE spankwallet-programma — openstaand punt 3)
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

Volledige uitleg en vervolgstappen: **STATUS.md** secties 1 en 4.

1. **`poison_transfer_hook` controleert accounts niet inhoudelijk** — een directe
   aanroep buiten een echte Token-2022-transfer om kan willekeurige accounts
   meegeven. Moet dicht vóór productiegebruik.
2. **Handmatige byte-offsets naar spankwallet's WalletAccount/PasskeysAccount** —
   geverifieerd correct op 2026-08-26, maar structureel fragiel. Fix:
   `declare_program!` + gepind IDL-bestand.
3. **Tests draaien tegen het echte spankwallet-programma** — plan: eigen
   wegwerp-deploy van spankwallet als testfixture, met harde grendel die
   weigert op het echte adres én alle bekende oude wegwerpadressen.
4. **Client-library `poisonToken.ts` is verouderd** — discriminators fout,
   phantom-instructies, data-layout mismatch. Moet herschreven worden tegen
   de huidige 4-instructie-versie.

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
