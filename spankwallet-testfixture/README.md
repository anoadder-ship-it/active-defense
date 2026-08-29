# SpankWallet Testfixture

Permanente, herhaalbare test-isolatie voor Active Defense.

## Doel
Active Defense volledig isoleren van het echte SpankWallet-programma (`9ma6vQVA71...`) door een gepinde, geïsoleerde kloon te gebruiken als testfixture. Hierdoor kan onafhankelijk gewerkt en getest worden zonder productietraffic of afhankelijkheid van SpankWallet's live status.

## Gebruik
```bash
# Build en deploy (eerste keer of na cleanup)
./build-and-deploy.sh

# Of met een specifieke repo-URL
./build-and-deploy.sh git@github.com:anoadder-ship-it/spankwallet.git
```

Het script:
1. Kloon SpankWallet naar `~/.config/active-defense/testfixture/spankwallet-src/` (geïsoleerd, eigen `.git`-map).
2. Pin op commit `1fb3134` (de B1-B7-referentie).
3. Genereert een throwaway-keypair (`spankwallet-throwaway-keypair.json`).
4. Past `declare_id!` aan en voegt `idl-build` feature toe.
5. Bouwt en verifieert op byte-niveau (throwaway-ID exact 1× in .so, echte SpankWallet-ID 0×).
6. Deploys naar devnet met los fee-payer en expliciete upgrade-authority.
7. Logt de deploy-signatuur en program-ID naar `testfixture-deploy.log`.

## Verificatie
Voer `verify-program-id-in-binary.ts` uit om te controleren dat het gebouwde `.so` de juiste ID bevat:
```bash
npx ts-node verify-program-id-in-binary.ts
```

## Cleanup
```bash
# Verwijder de fixture-kloon (niet het keypair!)
rm -rf ~/.config/active-defense/testfixture/spankwallet-src/

# Of upgrade het throwaway-programma naar een leeg .so om devnet-ruimte vrij te maken.
```

## Belangrijk
- Dit script raakt SpankWallet's eigen repository **niet** aan (geen `git worktree add`, geen schrijfactie in SpankWallet's `.git`).
- De throwaway-keypair is de enige upgrade authority — geen enkele SpankWallet-sleutel heeft hier gezag over.
- De gepinde commit (`1fb3134`) blijft de referentie, niet SpankWallet's `HEAD`.