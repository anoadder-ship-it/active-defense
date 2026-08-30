#!/usr/bin/env bash
# SpankWallet Testfixture — permanente, herhaalbare test-isolatie
# Gebruikt git clone (niet worktree) om SpankWallet's eigen repo niet aan te raken.
set -euo pipefail

# --- Configuratie ---
FIXTURE_DIR="$HOME/.config/active-defense/testfixture"
SRC_DIR="$FIXTURE_DIR/spankwallet-src"
KEYPAIR_DIR="$FIXTURE_DIR"
KEYPAIR_PATH="$KEYPAIR_DIR/spankwallet-throwaway-keypair.json"
SPANKWALLET_REPO="${1:-$HOME/projects/spankwallet}"  # lokaal pad of GitHub-URL
PINNED_COMMIT="1fb3134"
DEPLOY_LOG="$FIXTURE_DIR/testfixture-deploy.log"

# --- Voorbereiding ---
echo "=== SpankWallet Testfixture Build & Deploy ==="
echo "Source repo: $SPANKWALLET_REPO"
echo "Pinned commit: $PINNED_COMMIT"
echo "Fixture dir: $SRC_DIR"

mkdir -p "$KEYPAIR_DIR"

# --- Voor-verificatie: SpankWallet's .git/worktrees/ en git status ---
echo ""
echo "--- VOOR-VERIFICATIE ---"
if [ -d "$SPANKWALLET_REPO/.git/worktrees" ]; then
    echo "SpankWallet .git/worktrees/ (voor):"
    ls -la "$SPANKWALLET_REPO/.git/worktrees/" 2>/dev/null || echo "(leeg)"
else
    echo "SpankWallet .git/worktrees/ bestaat niet (geen worktrees)."
fi
echo ""
echo "SpankWallet git status (voor):"
(cd "$SPANKWALLET_REPO" && git status --short) || echo "(niet beschikbaar)"
echo "--- EINDE VOOR-VERIFICATIE ---"

# --- Kloon SpankWallet (geïsoleerd, eigen .git-map) ---
if [ -d "$SRC_DIR" ]; then
    echo "Bestaande fixture gevonden, verwijder voor schone kloon..."
    rm -rf "$SRC_DIR"
fi
echo ""
echo "Klonen van SpankWallet (geïsoleerd)..."
git clone "$SPANKWALLET_REPO" "$SRC_DIR" --quiet
(cd "$SRC_DIR" && git checkout "$PINNED_COMMIT" --quiet)
echo "Gekloond en gepind op commit: $(cd "$SRC_DIR" && git rev-parse HEAD)"

# --- Throwaway-keypair genereren (als nog niet bestaat) ---
if [ ! -f "$KEYPAIR_PATH" ]; then
    echo ""
    echo "Genereren van throwaway-keypair..."
    solana-keygen new --no-bip39-passphrase -o "$KEYPAIR_PATH" --quiet
fi
THROWAWAY_ID=$(solana-keygen pubkey "$KEYPAIR_PATH")
echo "Throwaway program-ID: $THROWAWAY_ID"

# --- declare_id! aanpassen in de kloon ---
echo ""
echo "Aanpassen declare_id! naar throwaway-ID..."
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"$THROWAWAY_ID\")/" "$SRC_DIR/programs/spankwallet/src/lib.rs"

# --- idl-build feature toevoegen (zelfde fix als STATUS.md §2) ---
echo "Toevoegen idl-build feature aan Cargo.toml..."
if ! grep -q 'idl-build' "$SRC_DIR/programs/spankwallet/Cargo.toml"; then
    sed -i '/^\[features\]/a idl-build = []' "$SRC_DIR/programs/spankwallet/Cargo.toml"
fi

# --- Build ---
echo ""
echo "Bouwen SpankWallet..."
(cd "$SRC_DIR" && anchor build --quiet) || { echo "BUILD FAILED"; exit 1; }
SO_PATH="$SRC_DIR/target/deploy/spankwallet.so"
echo "Build voltooid: $SO_PATH ($(wc -c < "$SO_PATH") bytes)"

# --- Byte-verificatie ---
echo ""
echo "--- BYTE-VERIFICATIE ---"
THROWAWAY_COUNT=$(grep -cP "$(solana-keygen pubkey "$KEYPAIR_PATH" | tr -d '\n')" "$SO_PATH" || true)
REAL_ID="9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9"
REAL_COUNT=$(grep -cP "$(echo -n $REAL_ID | xxd -p | tr -d '\n')" "$SO_PATH" || true)
echo "Throwaway-ID in .so: $THROWAWAY_COUNT (verwacht: 1)"
echo "Echte SpankWallet-ID in .so: $REAL_COUNT (verwacht: 0)"
if [ "$THROWAWAY_COUNT" -ne 1 ] || [ "$REAL_COUNT" -ne 0 ]; then
    echo "BYTE-VERIFICATIE MISLUKT"; exit 1
fi
echo "--- BYTE-VERIFICATIE GESLAAGD ---"

# --- Deploy naar devnet (los fee-payer, expliciete upgrade-authority) ---
echo ""
echo "Deployen naar devnet..."
FEE_PAYER="${HOME}/.config/solana/id.json"
solana program deploy "$SO_PATH" \
    --url devnet \
    --fee-payer "$FEE_PAYER" \
    --program-id "$KEYPAIR_PATH" \
    --upgrade-authority "$KEYPAIR_PATH" \
    2>&1 | tee "$DEPLOY_LOG"

# --- Na-verificatie: SpankWallet's .git/worktrees/ en git status ---
echo ""
echo "--- NA-VERIFICATIE ---"
if [ -d "$SPANKWALLET_REPO/.git/worktrees" ]; then
    echo "SpankWallet .git/worktrees/ (na):"
    ls -la "$SPANKWALLET_REPO/.git/worktrees/" 2>/dev/null || echo "(leeg)"
else
    echo "SpankWallet .git/worktrees/ bestaat niet (geen worktrees)."
fi
echo ""
echo "SpankWallet git status (na):"
(cd "$SPANKWALLET_REPO" && git status --short) || echo "(niet beschikbaar)"
echo "--- EINDE NA-VERIFICATIE ---"

# --- Resultaat ---
echo ""
echo "=== TESTFIXTURE KLAAR ==="
echo "Program-ID: $THROWAWAY_ID"
echo "Deploy log: $DEPLOY_LOG"
echo "SPANKWALLET_TEST_PROGRAM_ID=$THROWAWAY_ID"
