#!/usr/bin/env bash
# Devnet-voorbereiding voor het deploy-runbook (STATUS §61).
#
# Zonder vlag: uitsluitend lezen en tonen. Nooit schrijven, nooit kosten maken.
# Met --ik-tekenen: wél de deploy (kost SOL, is te upgraden), NOOIT de write-once
# vertrouwensconfig — die wordt alleen getoond. Eén verkeerde zet daar is niet te
# corrigeren zonder herprogrammering (§43), dus die blijft expliciet menselijk.
set -uo pipefail

CLUST="https://api.devnet.solana.com"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SO="$ROOT/target/deploy/active_defense.so"
PROG_KP="$ROOT/target/deploy/active_defense-keypair.json"
PAYER="${AD_PAYER:-$HOME/.config/active-defense/localnet-payer-keypair.json}"
ID="FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK"
VERTROUWD="9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9"
TEKEN=0
[ "${1:-}" = "--ik-tekenen" ] && TEKEN=1

FAAL=0
stap() { printf '\n== %s ==\n' "$1"; }
ok()   { printf '   ok: %s\n' "$1"; }
wijg() { printf '   WIJGT: %s\n' "$1"; FAAL=1; }

stap "gereedschap"
if command -v solana >/dev/null 2>&1; then ok "solana $(solana --version | head -1)"; else wijg "solana-CLI niet gevonden"; fi

stap "artefact"
if [ -f "$SO" ]; then
    SHA=$(sha256sum "$SO" | cut -c1-16)
    if grep -q "^| \`$SHA\`" "$ROOT/notes/ARTEFACTEN.md" 2>/dev/null; then
        ok "$(stat -c%s "$SO") byte, sha256 $SHA — geregistreerd in notes/ARTEFACTEN.md"
    else
        wijg "sha $SHA staat niet in notes/ARTEFACTEN.md — bouw of registreer eerst (§58)"
    fi
else
    wijg "geen $SO (bouw met ./build-sbf.sh)"
fi

stap "sleutels"
if [ -f "$PROG_KP" ]; then
    PKP=$(solana-keygen pubkey "$PROG_KP" 2>/dev/null || echo onleesbaar)
    if [ "$PKP" = "$ID" ]; then ok "programmakpair wijst naar $ID"; else wijg "keypair geeft $PKP, verwacht $ID"; fi
else
    wijg "geen programmakpair op $PROG_KP"
fi
if [ -f "$PAYER" ]; then ok "fee-payer $(solana-keygen pubkey "$PAYER")"; else wijg "geen fee-payer op $PAYER"; fi

stap "saldo op devnet"
if [ -f "$PAYER" ]; then
    SALDO=$(solana balance "$(solana-keygen pubkey "$PAYER")" --url "$CLUST" 2>/dev/null || echo fout)
    echo "   saldo: $SALDO (deploy nodig ≈ 0,45 incl. buffer en fees)"
    case "$SALDO" in
        fout) wijg "saldo niet op te vragen" ;;
        *) awk -v s="$SALDO" 'BEGIN{exit !(s+0 >= 0.45)}' || wijg "saldo te laag om te deployen" ;;
    esac
fi

stap "wat er zou gebeuren"
cat <<EOF
   1) solana program deploy --url $CLUST \\
          --program-keypair $PROG_KP --keypair $PAYER $SO
        → aanmaker en upgrade-autoriteit worden de sleutel bij dit programma (§60)

   2) set_wallet_program — SCHRIJF-ÉÉN-KEER, wordt nooit automatisch uitgevoerd
        PDA  : ["wallet_config"]
        body : wallet_program = $VERTROUWD
        helper: zorgVoorVertrouwensConfig() in tests/lib/vertrouwensconfig.ts
        runbook: notes/RUNBOOK-deploy.md §3
EOF

if [ "$FAAL" -ne 0 ]; then
    printf '\nDROOGRUNNEN GESTOPT — hierboven staat een wijger. Nog niets gedaan.\n'
    exit 1
fi
if [ "$TEKEN" -ne 1 ]; then
    printf '\nDROOGRUNNEN GROEN — prerequisites staan, er is niets gedaan.\nMet --ik-tekenen voer ik stap 1 uit; stap 2 nooit.\n'
    exit 0
fi

stap "stap 1: deployen (jouw opdracht, jouw SOL)"
solana program deploy --url "$CLUST" --program-keypair "$PROG_KP" --keypair "$PAYER" "$SO" || {
    printf '\nDEPLOY MISLUKT — laat de fout staan, probeer niet twee keer blind.\n'; exit 1; }
printf '\nGEDEPLOYD. Verifieer vóór je verder gaat:\n'
printf '   bash scripts/controle.sh --cluster %s\n' "$CLUST"
printf '\nStap 2 (set_wallet_program) voer IK niet uit: write-once op een publiek cluster.\n'
