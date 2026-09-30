# Security

Dit document beschrijft hoe je een veiligheidsprobleem in Active Defense
rapporteert.

## Wat is een veiligheidsprobleem?

Een probleem dat aanleiding geeft tot:
- Onverwacht verlies van fondsen (token transfer naar ongeautoriseerde ontvanger)
- Een actie die doorgaat zonder geldige passkey-authenticatie
- Een replay-aanval (zelfde actie tweemaal uitgevoerd)
- Een onjuiste reading van SpankWallet's WalletAccount (verkeerde bytes als passkey)

## Hoe rapporteer je?

Stuur een e-mail naar de projectonderhouders met:
- Een korte beschrijving van het probleem
- De instructie en account-configuratie die het probleem triggert
- Eventueel een minimale reproducerende transactie (devnet)

Vermijd voorlopig open issue's voor nog niet bevestigde problemen, totdat
de onderhouders hebben bevestigd dat het een veiligheidsprobleem is.

## Belangrijke context

- Het programma leest SpankWallet's WalletAccount op handmatige byte-offsets
  (zie STATUS.md sectie 1, openstaand punt 1). Een layoutwijziging aan
  SpankWallet's kant kan hier stilzwijgend verkeerde bytes opleveren.
- De upgrade authority is momenteel één los keypair (geen multisig). Zie
  STATUS.md sectie 3 voor waarom dit kritiek is.
- poison_transfer_hook wordt normaal aangeroepen door Token-2022, maar kan
  theoretisch rechtstreeks worden aangeroepen met willekeurige accounts
  (openstaand punt 1).

## Bekende beperkingen

Statussen hieronder zijn gemeten of uit de code voorgelezen op 2026-09-29; de verwijzing
wijst naar de meting. "Open" betekent: bewust niet opgelost, niet: vergeten.

1. **Handtekeningen zijn niet eenmalig.** De `client_action_nonce` wordt vergeleken met de
   teller in het WalletAccount, maar door active-defense nóóit verhoogd (dat account is van
   SpankWallet). Misbruik wordt vandaag voorkomen door de structurele botsing van elke
   instructie (PDA-`init`, adres-al-markering, eerste-wins op `MintOwner`); valt die staat
   terug, dan herleeft een onderschepte handtekening. Gemeten: STATUS §57 M1b/M1d
   (`harness/tests/coverage.rs`). Voorgestelde reparatie (eigen verbruiksteller per wallet in
   een AD-PDA) is een interface-wijziging en wacht op besluit.
2. **Rechtstreekse aanroep van `poison_transfer_hook`.** De autorisatie zit in seed-constraints
   (`[poison_authorized, mint, destination-owner]`) en Anchor-deserialisatie — die check is
   dus inhoudelijk. Wat resteert: `source_token_account` en `owner` zijn ongetypeerd
   (`UncheckedAccount`), zodat iemand de haak-instructie direct kan aanroepen met willekeurige
   accounts op die twee posities. De handler schrijft niets (alleen een logregel), dus het
   effect is logruis, geen staat. Voorgelezen uit `instructions.rs` (struct
   `PoisonTransferHook`); niet apart in LiteSVM gemeten.
3. **Byte-offsets naar SpankWallet** (`WALLET_*_OFFSET`, 148/158/166) zijn een fragiele
   koppeling: een veldverschuiving aan SpankWallet-kant leest een verkeerde nonce of
   eigendomssleutel. Verdedigd door de conformatietest `layout_conformance.rs` (vereist het
   externe fixture-bestand, draait dus niet in CI — zie `.github/workflows/ci.yml`).
4. **Vertrouwensconfig is write-once** (§43): één keer zetten, daarna onmogelijk te corrigeren
   zonder herprogrammering. Fouten moeten vóór de eerste zet gevonden worden; zie het
   deploy-runbook.
5. **Upgrade-authoriteit is één keypair** (§3). Geen multisig. Zie STATUS §60 voor de gevolgen
   en de opties.

### Kwetsbaarheden in afhankelijkheden (stand 2026-09-29, STATUS §56)

| melding | waar | disposition |
|---|---|---|
| `ed25519-dalek` 1.0.1, `curve25519-dalek` 3.2.0, `rand` | uitsluitend de test-harness (via `litesvm → agave-precompiles`) | niet bereikbaar uit het programma; niet oplosbaar vanaf onszelf (parent pind 1.x) |
| `bigint-buffer` (high) | npm, via `@solana/spl-token → buffer-layout-utils` | **geen gepatchte versie bestaande** (aangetast `<=1.1.5`, hoogste publicatie 1.1.5) |
| `jayson` / `stream-json` (moderate) | npm, via `@solana/web3.js` | alleen oplosbaar door majors van web3.js aan te raken; een override naar `stream-json@^3.7.0` verergerde het aantal meldingen (5 → 10) en is teruggedraaid |

Twee ongebruikte direct dependencies (`@coral-xyz/anchor`, `bn.js`) zijn verwijderd; dat nam
zes meldingen weg. Totaal npm: 8 → 5.
