# Artefactidentiteit

Wie `.so`-bestanden wil identificeren, doet dat hier — niet uit het hoofd.
`scripts/controle.sh` leest deze tabel; ontbreekt het bestand, dan faalt de controle
(fail-zero: geen identiteit is erger dan een onbekende identiteit).

Een rij is een **bouw**, niet een commit: dezelfde bron kan byte-verschillende `.so`
opleveren op verschillende machines (gemeten: CI-bouw `4fc06be522fe8bbc` tegenover
lokale `3d5b1a91e800bb38`, STATUS §54). Reden waarom "dezelfde commit" geen identiteit is.

| sha256 (16) | bytes | label | bron-commit | status |
|---|---|---|---|---|
| `81add7bab27aa4e9` | 367056 | §64 replay-bescherming (consumed-PDA's), lokaal gebouwd met platform-tools v1.52 | `ff8868a` (gebouwd uit de §64-werkboom vóór die commit; f46cac6 bevat §64 nog **niet**) | geldig voor de harness (23/23) en voor de CU-metingen van §64; niet gedeployd |
| `3d5b1a91e800bb38` | 318136 | fix-2 build, lokaal gebouwd | `564227b` | geldig — dit is wat er op localnet draait en wat de harness test |
| `32971d30b65aeda3` | 318136 | pre-fix-2, ouder dan de bron | `6e51720` | VEROUDERD — bewaard als vergelijkingspunt in `target/deploy/active_defense.pre-fix2-6e51720.so` |
| `4fc06be522fe8bbc` | 318136 | CI-bouw van `4976919` | `4976919` | niet gedeployd — alleen gebouwd op de runner; toont aan dat bouwen hier niet byte-reproduceerbaar is |

## Hoe een rij toe te voegen

Na elke bouw die ertoe doet (deploy, of een bouw waarvan de metingen afhangen):

```sh
sha256sum target/deploy/active_defense.so | cut -c1-16   # veld 1
stat -c%s target/deploy/active_defense.so                # veld 2
git rev-parse --short HEAD                               # veld 4
```

Plak dat als nieuwe rij, met in `label` wat deze bouw deed en in `status` of hij is
gedeployd, en vermeld de sha in de STATUS-sectie die erbij hoort.

## Wat deze tabel níét is

Geen whitelist voor goedkeuring en geen vervanging van check 2 (bron-verschuiving) of
check 3 (programma-ID). Een sha die hier staat, is geïdentificeerd — niet per se gewenst.

## Voorraad ter vergelijking (geen identiteit op zich)

`target/deploy/active_defense.pre-64-f46cac6.so` — sha `3d5b1a91e800bb38`,
318 136 byte, op 2026-10-01 herbouwd uit `f46cac6` in een wegwerkwerkboom met
platform-tools v1.52. Byte-gelijk aan de rij hierboven voor `564227b`. Dat
stelt twee dingen vast: deze host bouwt dezelfde bron byte-reproduceerbaar
(§54's waarschuwing ging over verschillende machines), en `programs/` is tussen
`564227b` en `f46cac6` niet veranderd. Het bestand staat er als controle-artefact
voor het faal-pad van §64 — coverage draait er tegen via `AD_SO` — en niet als
deploy-kandidaat. Alleen de `.so` is overgezet: het keypair dat
`cargo-build-sbf` in die werkboom aanmaakte, is bewust níét meegenomen (§54).
