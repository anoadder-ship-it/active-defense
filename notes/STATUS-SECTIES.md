# STATUS.md — sectienummers verdelen tussen sessies

STATUS.md is één aaneengeschreven document en de enige plek die beide sessies
altijd aanraken. Botsingen zitten daar, niet in de code. Deze regels gelden voor
elke agent die in dit project schrijft.

1. **Claim vóór je schrijft.** Eén regel in de tabel hieronder, gecommit samen
   met je sectie. Wie zonder claim schrijft, kan een nummer kwijtraken.
2. **Eén nummer per claim**, en sla geen nummer over dat al bezet is.
3. **Takken reserveren een blok.** Werk je op een andere tak dan `main`, neem dan
   het volgende vrije honderdtal (137, 237, …) en hernummer bij het mergen
   mechanisch naar het eerst vrije nummer. Verwijzingen in lopende tekst gaan
   naar de slug van de kop, niet naar het cijfer — anders maakt hernummeren ze
   kapot.
4. **Bestaande secties zijn onschendbaar.** Toevoegen, niet herschrijven.
   Correcties krijgen een eigen `### Correctie op …`-kop binnen dezelfde sectie,
   met de onjuiste bewering er nog boven.
5. **Conflicten in STATUS.md lossen altijd op als "beide houden"**, gevolgd door
   hernummering van de tak-secties. Nooit iemands tekst weggooien om het conflict
   te laten verdwijnen.

| sectie | onderwerp | branch | datum | status |
|---|---|---|---|---|
| 36 | FN-DSA verificatie op de SVM, CU-meting | main | 2026-09-25 | geschreven |
| 37 | LiteSVM-harness, autorisatie-route end-to-end | agent/harness | 2026-09-26 | geschreven |
| 38 | Artifact↔ID-bepaling en fixture-drift | agent/harness | 2026-09-26 | geschreven |
| 39 | Werkende localnet-loop zonder publiek netwerk | agent/harness | 2026-09-26 | geschreven |
| 40 | — vrij, volgende schrijver claimt hier | | | |
| 137–199 | gereserveerd blok voor `agent/harness` bij parallel werk | agent/harness | 2026-09-26 | reservering |
