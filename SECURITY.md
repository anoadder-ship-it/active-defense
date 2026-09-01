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
  (zie STATUS.md sectie 1, openstaand punt 2). Een layoutwijziging aan
  SpankWallet's kant kan hier stilzwijgend verkeerde bytes opleveren.
- De upgrade authority is momenteel één los keypair (geen multisig). Zie
  STATUS.md sectie 3 voor waarom dit kritiek is.
- poison_transfer_hook wordt normaal aangeroepen door Token-2022, maar kan
  theoretisch rechtstreeks worden aangeroepen met willekeurige accounts
  (openstaand punt 1).

## Bekende beperkingen

Zie STATUS.md voor de volledige lijst openstaande punten. De drie belangrijkste:
1. poison_transfer_hook controleert accounts niet inhoudelijk tegen elkaar
2. Handmatige byte-offsets naar SpankWallet (fragiele koppeling)
3. Tests draaien tegen het echte SpankWallet-programma
