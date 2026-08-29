/**
 * Verifieer dat het gebouwde SpankWallet .so de throwaway-ID bevat
 * en niet het echte SpankWallet-programma-ID.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FIXTURE_DIR = path.join(process.env.HOME, ".config", "active-defense", "testfixture");
const KEYPAIR_PATH = path.join(FIXTURE_DIR, "spankwallet-throwaway-keypair.json");
const SO_PATH = path.join(FIXTURE_DIR, "spankwallet-src", "target", "deploy", "spankwallet.so");
const REAL_ID = "9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9";

function pubkeyToBytes(pubkey) {
    const bs58 = require("bs58");
    return bs58.decode(pubkey);
}

async function main() {
    console.log("=== SpankWallet Testfixture Byte-Verificatie ===\n");

    // Throwaway-ID ophalen
    const throwawayId = execSync(`solana-keygen pubkey ${KEYPAIR_PATH}`).toString().trim();
    console.log(`Throwaway-ID: ${throwawayId}`);
    console.log(`Echte SpankWallet-ID: ${REAL_ID}`);

    // .so bestand lezen
    if (!fs.existsSync(SO_PATH)) {
        console.error("FATAL: spankwallet.so niet gevonden op", SO_PATH);
        process.exit(1);
    }
    const soData = fs.readFileSync(SO_PATH);

    // Byte-verificatie
    const throwawayBytes = pubkeyToBytes(throwawayId);
    const realBytes = pubkeyToBytes(REAL_ID);

    let throwawayCount = 0;
    for (let i = 0; i <= soData.length - 32; i++) {
        if (soData.slice(i, i + 32).equals(Buffer.from(throwawayBytes))) {
            throwawayCount++;
        }
    }

    let realCount = 0;
    for (let i = 0; i <= soData.length - 32; i++) {
        if (soData.slice(i, i + 32).equals(Buffer.from(realBytes))) {
            realCount++;
        }
    }

    console.log(`\nThrowaway-ID in .so: ${throwawayCount} (verwacht: 1)`);
    console.log(`Echte SpankWallet-ID in .so: ${realCount} (verwacht: 0)`);

    if (throwawayCount === 1 && realCount === 0) {
        console.log("\n=== BYTE-VERIFICATIE GESLAAGD ===");
    } else {
        console.error("\n=== BYTE-VERIFICATIE MISLUKT ===");
        process.exit(1);
    }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });