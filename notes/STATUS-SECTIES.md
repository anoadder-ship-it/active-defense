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
| 40 | Drift-detector wallet-layout | agent/harness | 2026-09-26 | geschreven |
| 41 | Lek: autorisatie niet gebonden aan wallet/mint-eigenaar | agent/harness | 2026-09-26 | geschreven |
| 42 | Fix 1 uitgevoerd, met gemeten kosten | agent/harness | 2026-09-26 | geschreven |
| 43 | Vertrouwensconfig + mutatiebevindingen | agent/harness | 2026-09-26 | geschreven |
| 44 | Stap 1 compleet over alle paden | agent/harness | 2026-09-26 | geschreven |
| 45 | Fix 2: koppeling mint→wallet, met twee metingen vooraf | agent/harness | 2026-09-26 | geschreven |
| 46 | Stap 3 over de TS-routes; de volgordefout die ik drie keer maakte | agent/harness | 2026-09-26 | geschreven |
| 47 | FF-reconciliatie, artefactidentiteit, OPEN#1 gemeten, STATUS-herstel | main | 2026-09-29 | geschreven |
| 48 | Route 1 gemeten: het venster is dicht bij atomische cliënt | main | 2026-09-29 | geschreven |
| 49 | controle.sh: artefactvingerafdruk als commando, faal-pad gemeten | main | 2026-09-29 | geschreven |
| 50 | Deploy-runbook; OPEN#4 gesloten als document | main | 2026-09-29 | geschreven |
| 51 | Route 1 in de cliënt; venster gemeten op localnet | main | 2026-09-29 | geschreven |
| 52 | A1 back-up, A2 betekenisvolle CI, A3 atoomtest + wachter | main | 2026-09-29 | geschreven |
| 53 | Eerste CI-run rood: unbound variable, pad-matrix gemeten | main | 2026-09-29 | geschreven |
| 54 | cargo-build-sbf genereert een bedrieglijk programmakpair | main | 2026-09-29 | geschreven |
| 55 | Groen zegt wat het dekt: materiële vs optionele overslagging | main | 2026-09-29 | geschreven |
| 56 | Dependency-schuld: 8→5, twee ingrepen teruggedraaid op meting | main | 2026-09-29 | geschreven |
| 57 | Replay is niet afgedwongen; config fail-closed; plafond 32 | main | 2026-09-29 | geschreven |
| 137–199 | gereserveerd blok voor `agent/harness` bij parallel werk | agent/harness | 2026-09-26 | reservering |
