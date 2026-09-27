#!/usr/bin/env bash
# Localnet voor active-defense: één commando, twee programma's, geen publiek netwerk.
#
# Waarom dit script bestaat: de handover zei dat er hier geen validator draaide,
# en de tests hadden devnet als enige bestemming — elke run schreef daar echte
# accounts. Dit script zet de VM op met precies de artifacts die STATUS §38 aan
# hun ID koppelt, en laat de tests expliciet tegen lokaal draaien.
#
# Gebruik:
#   scripts/localnet.sh                      # VM op, anchor-suite, VM af
#   scripts/localnet.sh --script tests/x.ts  # VM op, één ts-script, VM af
#   AD_KEEP=1 scripts/localnet.sh            # VM aan houden na afloop
#
# Instelbaar via omgeving: AGAVE_BIN AD_SO FIX_SO AD_PAYER AD_RPC_PORT
# AD_GOSSIP_PORT AD_FAUCET_PORT AD_DYNAMIC_PORTS AD_LEDGER

set -euo pipefail

AGAVE_BIN="${AGAVE_BIN:-$HOME/projects/agave/bin}"
LEDGER="${AD_LEDGER:-/tmp/ad-localnet-ledger}"
RPC_PORT="${AD_RPC_PORT:-13399}"
GOSSIP_PORT="${AD_GOSSIP_PORT:-13301}"
FAUCET_PORT="${AD_FAUCET_PORT:-13388}"
DYNAMIC_PORTS="${AD_DYNAMIC_PORTS:-13500-13540}"

# Artifact ↔ ID-koppeling is expliciet, niet afgeleid uit een keypair-bestand.
# Zie STATUS §38: de .so zelf getuigt via zijn declare_id-bytes.
AD_ID="FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK"
AD_SO="${AD_SO:-$HOME/projects/active-defense/target/deploy/active_defense.so}"
FIX_ID="BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk"
FIX_SO="${FIX_SO:-$HOME/.config/active-defense/testfixture/spankwallet-src/target/deploy/spankwallet.so}"
PAYER="${AD_PAYER:-$HOME/.config/active-defense/localnet-payer-keypair.json}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALPID=""

stap() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fout() { printf 'FAAL: %s\n' "$*" >&2; exit 2; }

vinger() { # pad -> "naam  byte  sha256-volledig"
    local f="$1"
    [ -f "$f" ] || { echo "  $f — ONTBREEKT"; return 1; }
    printf '  %-14s %9d byte  sha256 %s\n' "$(basename "$(dirname "$f")")/$(basename "$f")" \
        "$(stat -c%s "$f")" "$(sha256sum "$f" | cut -c1-16)"
}

opruimen() {
    if [ -n "$VALPID" ] && kill -0 "$VALPID" 2>/dev/null; then
        if [ "${AD_KEEP:-0}" = "1" ]; then
            echo "validator blijft draaien (pid $VALPID, rpc $RPC_PORT)"
            return
        fi
        stap "afsluiten validator $VALPID"
        kill -TERM "$VALPID" 2>/dev/null || true
        sleep 3
        kill -KILL "$VALPID" 2>/dev/null || true
    fi
}
trap opruimen EXIT

# --- voorcontroles -----------------------------------------------------------
stap "voorcontroles"
command -v "$AGAVE_BIN/solana-test-validator" >/dev/null \
    || fout "geen solana-test-validator in $AGAVE_BIN — deze boom gebruikt de native aarch64-build, niet het FEX-wrapper-script in ~/bin"
vinger "$AD_SO"  || fout "active_defense.so ontbreekt (bouw hem in de hoofdwerkboom, of zet AD_SO)"
vinger "$FIX_SO" || fout "fixture-.so ontbreekt (spankwallet-testfixture/build-and-deploy.sh, of zet FIX_SO)"
[ -f "$PAYER" ] || fout "fee-payer $PAYER ontbreekt"

for p in "$RPC_PORT" "$GOSSIP_PORT" "$FAUCET_PORT"; do
    python3 - "$p" <<'PY' || exit 2
import socket, sys
p=int(sys.argv[1])
s=socket.socket()
r=s.connect_ex(("127.0.0.1",p)); s.close()
if r==0:
    print(f"FAAL: poort {p} is in gebruik — kies eigen poorten (AD_RPC_PORT/AD_GOSSIP_PORT/AD_FAUCET_PORT)"); sys.exit(2)
print(f"  poort {p}: vrij")
PY
done

# --- validator ---------------------------------------------------------------
stap "validator starten (rpc $RPC_PORT)"
rm -rf "$LEDGER"
"$AGAVE_BIN/solana-test-validator" \
    --ledger "$LEDGER" --reset \
    --rpc-port "$RPC_PORT" --gossip-port "$GOSSIP_PORT" --faucet-port "$FAUCET_PORT" \
    --dynamic-port-range "$DYNAMIC_PORTS" --bind-address 127.0.0.1 --quiet \
    --bpf-program "$AD_ID"  "$AD_SO" \
    --bpf-program "$FIX_ID" "$FIX_SO" &
VALPID=$!
echo "  pid $VALPID  ledger $LEDGER"

stap "wachten op sloten (max 120s)"
deadline=$((SECONDS+120)); slot=""
while [ $SECONDS -lt $deadline ]; do
    slot="$("$AGAVE_BIN/solana" --url "http://127.0.0.1:$RPC_PORT" slot 2>/dev/null || true)"
    case "$slot" in (*[![:space:]]*) [ -n "${slot//[!0-9]/}" ] && break;; esac
    sleep 3
done
[ -n "${slot//[!0-9]/}" ] || { tail -20 "${TMPDIR:-/tmp}/ad-validator-out.log" 2>/dev/null; fout "validator gaf geen slot binnen 120s"; }
echo "  slot $slot"

stap "programma's geladen?"
for id in "$AD_ID" "$FIX_ID"; do
    "$AGAVE_BIN/solana" --url "http://127.0.0.1:$RPC_PORT" account "$id" >/dev/null 2>&1 \
        && echo "  $id: aanwezig" || fout "$id niet geladen in de VM"
done

stap "fee-payer spijzen"
PAYER_PUB="$("$AGAVE_BIN/solana-keygen" pubkey "$PAYER")"
"$AGAVE_BIN/solana" --url "http://127.0.0.1:$RPC_PORT" airdrop 3 "$PAYER_PUB" >/dev/null
echo "  $PAYER_PUB: 3 SOL"

# --- tests -------------------------------------------------------------------
export AD_RPC_URL="http://127.0.0.1:$RPC_PORT"
export AD_PAYER="$PAYER"
cd "$REPO"

if [ "${1:-}" = "--script" ]; then
    shift
    [ $# -ge 1 ] || fout "--script heeft een pad nodig"
    stap "één script: $1"
    set +e; node -r ts-node/register "$1"; RC=$?; set -e
else
    stap "anchor-suite (--skip-build --skip-deploy --skip-local-validator)"
    echo "  let op: zolang de suite nul asserts heeft, meldt --fail-zero rood. Dat is geen defect van dit script."
    set +e; anchor test --skip-build --skip-deploy --skip-local-validator; RC=$?; set -e
fi

stap "resultaat: exit $RC"
exit $RC
