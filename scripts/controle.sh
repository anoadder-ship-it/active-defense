#!/usr/bin/env bash
# controle.sh — artefactvingerafdruk: .so ↔ bron ↔ programma-ID.
#
# WAAROM: op 2026-09-26 draaiden metingen in deze werkboom tegen een .so van 1 sep
# (sha 32971d30…) terwijl de bron allang fix 2 bevatte. Niets zei dat; ik ontdekte
# het door met de hand te hashen en bytes te scannen. Dit script maakt die handeling
# herhaalbaar. Fail-zero: onbekend is NIET groen (zie bff02c4b, --fail-zero).
#
# Gebruik:  scripts/controle.sh [--cluster <rpc-url>]
# Exit 0 alleen als alle checks OK zijn; elke MISMATCH/STALE/UNKNOWN geeft exit 1.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SO="$ROOT/target/deploy/active_defense.so"
KEYPAIR="$ROOT/target/deploy/active_defense-keypair.json"
ANCHOR="$ROOT/Anchor.toml"
FOUT=0

# Argumenten: [--cluster <rpc-url>] [--nieuw-artefact]
#   --nieuw-artefact  voor een bouw-agent: daar is elke sha per definitie nieuw,
#                     dus check 1 eist dan geen bekende sha (check 2 t/m 4 wél).
#                     Zonder deze vlag is een onbekende sha ROOD — zo hoort het op
#                     een werkboom waar de .so geïdentificeerd móét zijn.
CLUSTER=""; NIEUW=0; ZONDER_SLEUTEL=0
while [ $# -gt 0 ]; do
    case "$1" in
        --cluster) CLUSTER="${2:-}"; shift 2 ;;
        --nieuw-artefact) NIEUW=1; shift ;;
        --geen-sleutel) ZONDER_SLEUTEL=1; shift ;;
        *) echo "   (negeer onbekend argument: $1)"; shift ;;
    esac
done
URL="$CLUSTER"

regel() { printf '  %-22s %s\n' "$1" "$2"; }
faal()   { echo "  FAAL $1"; FOUT=1; }

# Bekende builds: sha256(16) -> label. Nieuwe build = hier een regel bij, met de
# sectie waarin hij gemeten is. Een onbekende .so is geen groene testwaardering.
bekend() {
    case "$1" in
        3d5b1a91e800bb38) echo "fix-2 build (STATUS §47, bron 564227b)" ;;
        32971d30b65aeda3) echo "pre-fix-2 (VEROUDERD, bron 6e51720 — §47/§48)" ;;
        *) echo "" ;;
    esac
}

echo "== 1. artefact =="
if [ ! -f "$SO" ]; then
    faal ".so ontbreekt: $SO (bouw met ./build-sbf.sh)"
else
    SHA="$(sha256sum "$SO" | cut -c1-16)"
    SIZE="$(stat -c%s "$SO")"
    MTIME="$(date -r "$SO" '+%Y-%m-%d %H:%M')"
    LABEL="$(bekend "$SHA")"
    regel ".so" "$SIZE byte  sha256 $SHA  ($MTIME)"
    if [ -z "$LABEL" ]; then
        if [ "$NIEUW" = "1" ]; then
            echo "       → onbekende sha, geaccepteerd als nieuw artefact (--nieuw-artefact);"
            echo "         identiteit rust nu op check 2 t/m 4, niet op een geheugenlijst"
        else
            faal "sha $SHA staat in geen enkele bekende build — onbekend artefact"
        fi
    else
        echo "       → $LABEL"
        case "$LABEL" in *VEROUDERD*) faal "dit is een verouderde .so; herbouw vanaf de huidige bron" ;; esac
    fi
fi

echo "== 2. bron vs artefact (verschuiving) =="
# Een .so die ouder is dan de nieuwste programmaregel is per definitie niet deze bron.
if [ -f "$SO" ]; then
    NIEUWSTE="$(find "$ROOT/programs" -name '*.rs' -newer "$SO" -print -quit 2>/dev/null)"
    if [ -n "$NIEUWSTE" ]; then
        faal ".so heter dan bron: $NIEUWSTE is nieuwer — herbouwen"
    else
        echo "       ok: geen programmaregel nieuwer dan de .so"
    fi
fi

echo "== 3. programma-ID =="
ID_ANCHOR="$(sed -n '/\[programs.localnet\]/,/^\[/p' "$ANCHOR" | sed -n 's/^active_defense = "\([^"]*\)".*/\1/p')"
if [ "$ZONDER_SLEUTEL" = "1" ] && [ -f "$KEYPAIR" ]; then
    ID_CONTR="$(solana-keygen pubkey "$KEYPAIR" 2>/dev/null || echo onleesbaar)"
    faal "--geen-sleutel gegeven maar er staat wél een keypair ($ID_CONTR) — precies de verwarrende toestand die deze check vangt"
elif [ -f "$KEYPAIR" ] && command -v solana-keygen >/dev/null 2>&1; then
    ID_KEY="$(solana-keygen pubkey "$KEYPAIR" 2>/dev/null)"
    regel "Anchor.toml" "${ID_ANCHOR:-ONBEKEND}"
    regel "keypair"     "${ID_KEY:-ONBEREIKBAAR}"
    if [ -z "$ID_ANCHOR" ] || [ -z "$ID_KEY" ]; then
        faal "ID niet van beide kanten af te leiden"
    elif [ "$ID_ANCHOR" != "$ID_KEY" ]; then
        faal "Anchor.toml en programmakpair wijzen verschillende ID's"
    else
        echo "       ok: één ID, twee bronnen hetens"
    fi
else
    if [ "$ZONDER_SLEUTEL" = "1" ]; then
        # expliciet gemeld: deze omgeving heeft géén programmakpair.
        echo "       OVERGESLAGEN: geen programmakpair in deze omgeving (--geen-sleutel)."
        echo "       Dit is géén bevestiging van de ID-koppeling."
    elif [ "$NIEUW" = "1" ]; then
        echo "       OVERGESLAGEN: keypair ontbreekt op deze bouw-agent."
        echo "       Let op: cargo-build-sbf MAKT een keypair aan als hij er geen vindt —"
        echo "       zo'n bestand wijst naar een ANDER programma en check 3 vangt dat af"
        echo "       (gemeten op CI, STATUS §54). Verwijder het of meld het met --geen-sleutel."
    else
        faal "keypair of solana-keygen ontbreekt — ID niet te verifiëren"
    fi
fi

echo "== 4. git-identiteit =="
HEADKORT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo GEEN-GIT)"
DIRTY=""
if [ -n "$(git -C "$ROOT" status --porcelain -- programs 2>/dev/null)" ]; then
    DIRTY=" (programs/ vuil)"
fi
regel "HEAD" "$HEADKORT$DIRTY"
[ -n "$DIRTY" ] && faal "programmaregels zijn gewijzigd sinds de commit — de .so kan van beide niet kloppen"

echo "== 5. cluster (optioneel) =="
if [ -n "${URL:-}" ]; then
    if command -v solana >/dev/null 2>&1 && [ -n "${ID_ANCHOR:-}" ]; then
        SHOW="$(solana program show "$ID_ANCHOR" --url "$URL" 2>&1)"
        DEPLOYED="$(printf '%s' "$SHOW" | sed -n 's/^Programdata length: \([0-9]*\).*/\1/p')"
        if [ -z "$DEPLOYED" ]; then
            faal "cluster bereikbaar? geen programdata-length voor $ID_ANCHOR op $URL"
        else
            regel "deployd data-lengte" "$DEPLOYED"
            if [ -f "$SO" ] && [ "$DEPLOYED" = "$SIZE" ]; then
                echo "       ok: lengte gelijk aan lokale .so (sha-vergelijking vereist account-fetch, zie §38)"
            else
                faal "deployde lengte $DEPLOYED ≠ lokale .so $SIZE — andere code of geen deploy"
            fi
        fi
    fi
else
    echo "       overgeslagen (geen --cluster <url> gegeven; dit is géén bevestiging)"
fi

echo
if [ "$FOUT" -eq 0 ]; then
    echo "CONTROLE GROEN — artefact, bron en ID zijn één."
else
    echo "CONTROLE ROOD — hierboven staat minstens één faalreden; geen meting is bruikbaar."
fi
exit "$FOUT"
