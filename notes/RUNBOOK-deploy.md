# Runbook — deploy en inrichting van active-defense

Elke stap hieronder heeft een gemreden; de verwijzingen gaan naar STATUS.md-secties.
Volgorde is geen smaak: het zijn de plekken waar ik zelf ben gestruikeld.

## 0. Vooraf, elk keer opnieuw

```sh
scripts/controle.sh
```

Exit 0 of niet meten en niet deployen. Dit script ving op 2026-09-26 een `.so` van
één september die voor fix-2-metingen werd aangezien (§47). Met `--cluster <url>`
vergtijkt het ook de gedeployde programdata-lengte; zonder die vlag staat er
expliciet "overgeslagen … géén bevestiging" — een overgeslagen check is geen groene.

## 1. Bouwen

```sh
./build-sbf.sh          # platform-tools v1.52, GEPIJD
```

`cargo build-sbf` zonder pin pakt v1.54 en produceert een defecte `.so`: access
violation bij `attach_transfer_hook`, 446 CU (§30). Na elke bouw: sha256 van de
`.so` in `scripts/controle.sh` als bekend artefact opnemen, met de sectie waarin
hij gemeten is. Een onbekende sha is rood, niet "even doorlopen" (§49).

## 2. Programma-id en upgrade-authority

- Het programmakpair (`~/.config/active-defense/program-keypairs/`) is **alleen**
  upgrade-authority. Het tekent nooit transactiekosten; de fee-payer is
  `localnet-payer-keypair.json` (Anchor.toml, handover-punt 1/2).
- ID staat in `Anchor.toml` onder `[programs.localnet]` én `[programs.devnet]`:
  `FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK`. Check beide bronnen:
  `solana-keygen pubkey <programmakpair>` moet identical zijn (§49 check 3).

## 3. Eén keer per cluster: de vertrouwensconfig zetten

```sh
# set_wallet_program — schrijf-één-keer PDA ["wallet_config"]
```

- Dit is de vertrouwensroot: het wallet-programma waaronder wallet-PDA's geaccepteerd
  worden. Localnet-fixture en echt ID zijn verschillende waarden (§42/§43).
- **Onomkeerbaar**: een tweede `set_wallet_program` faalt (gemeten, §43), dus een
  foute waarde betekent een schone cluster of een programmawijziging. Eerst de
  waarde bepalen, dán pas zetten — niet andersom.
- Volgorde binnen een test of deploy-flow: vóór `attach_transfer_hook`, want attach
  leest hem sinds stap 3 (§46). Een config-stap te laat plaatsen gaf bij mij drie
  keer achter elkaar `AccountNotInitialized` (3012).

## 4. Per mint: ATOMISCH aanmaken en binden

Eén transactie, deze volgorde:

```
createAccount(mint, TransferHook-space)
  → secp256r1-verificatie
  → attach_transfer_hook
  → InitializeMint2
```

Gemeten in `harness/tests/atomiciteit.rs` (§48): de binding blijft bij de aanmaker,
en een latere claim van een andere wallet faalt op het `init`-verbod. Gesplitst over
twee transacties staat er wél een venster: dan claimt élke legitieme wallet de
koppeling op een nog niet ge-attach mint, inclusief de autorisatielijst (§47).

Sinds §51 bouwt `client/src/poisonToken.ts` die ene transactie zelf:
`buildAtoomPoisonMintTx({ walletPda, payer, mintKeypair, … })` zet createAccount →
secp256r1 → attach → InitializeMint2 in één boodschap, gemeten op localnet door
`tests/poisonAtoomIsolated.ts`. Gebruik die builder; plakt zelf geen losse
`createMintForPoisonToken` + `buildAttachTransferHookIx` aan elkaar — dat is
precies het venster uit §47. Route 2 (attach binden aan de handtekening van de
mint-maker) blijft een uitgestelde optie voor derden met een eigen flow.

## 5. Na deploy: verificatie, niet vertrouwen

```sh
scripts/controle.sh --cluster <rpc-url>
```

Voor een harde identiteitscheck bytescannen op de Fix-2-markeringen in het gedeployde
account (methode §38): `mint_owner`, `wallet_config`, en de foutmelding
`Only the wallet that attached…`. Een ID alleen bewijst niets — dezelfde ID kan tegen
een oude `.so` wijzen, en dat is precies wat er misging (§47).
