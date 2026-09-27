

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
