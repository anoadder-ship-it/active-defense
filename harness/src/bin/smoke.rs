//! Mijlpaal 1 van de LiteSVM-harness: staat de VM, en is ons eigen .so
//! uitvoerbaar? Geen functionele claims hier — alleen de onderkant van de
//! stack controleren voordat er bovenop gebouwd wordt.
//!
//! Uitvoeren:  cargo run --bin smoke   (vanuit harness/)
//!
//! Getoetst worden vier dingen, elk met eigen exitcode-boodschap:
//!   1. LiteSVM start met mainnet-feature-set, builtins, sysvars en precompiles.
//!   2. target/deploy/active_defense.so laadt op de echte programma-ID.
//!   3. De VM voert een transactie uit en rapporteert CU-verbruik.
//!   4. Een instructie met lege data tegen active_defense geeft een
//!      programmefout (discriminator), géén loaderfout. Dat bewijst dat de
//!      entrypoint van ons bytecode bereikt wordt.

use {
    litesvm::LiteSVM,
    solana_address::{address, Address},
    solana_instruction::Instruction,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_system_interface::instruction as system_instruction,
    solana_transaction::versioned::VersionedTransaction,
    std::path::PathBuf,
};

/// Programma-ID zoals in Anchor.toml en op devnet gedeporteerd.
const AD_ID: Address = address!("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");
/// Token-2022, zoals LiteSVM die standaard meegeeft (bundled 11.0.0).
const TOKEN_2022_ID: Address = address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
/// bpf_loader_upgradeable, de loader waaronder een anker-programma hoort.
const UPGRADEABLE_LOADER: Address =
    address!("BPFLoaderUpgradeab1e11111111111111111111111");

fn so_path() -> PathBuf {
    // Harness staat in <repo>/harness, het .so in <repo>/target/deploy.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("harness/ moet onder de repo-root liggen")
        .join("target/deploy/active_defense.so")
}

fn main() {
    let mut failures: Vec<String> = Vec::new();

    // --- 1. VM ---------------------------------------------------------------
    let mut svm = LiteSVM::new();
    println!(
        "[1] VM gestart. feature-set actief, blockhash {:?}",
        svm.latest_blockhash()
    );

    // Token-2022 moet al aanwezig zijn zonder dat wij iets laden: LiteSVM
    // bundelt elf/spl_token_2022-11.0.0.so in load_default_programs().
    match svm.get_account(&TOKEN_2022_ID) {
        Some(a) => println!(
            "[1] Token-2022 aanwezig in VM: {} byte executable-data, owner {}",
            a.data.len(),
            a.owner
        ),
        None => failures.push("Token-2022 niet gevonden in de VM".into()),
    }

    // --- 2. ons eigen bytecode ----------------------------------------------
    let path = so_path();
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) => {
            println!("[2] FATAL: {} niet leesbaar: {}", path.display(), e);
            std::process::exit(2);
        }
    };
    println!(
        "[2] {} geladen: {} byte",
        path.display(),
        bytes.len()
    );
    if let Err(e) = svm.add_program(AD_ID, &bytes) {
        println!("[2] FATAL: add_program mislukt: {:?}", e);
        std::process::exit(2);
    }
    match svm.get_account(&AD_ID) {
        Some(a) if a.owner == UPGRADEABLE_LOADER => println!(
            "[2] active_defense staat op {} onder bpf_loader_upgradeable",
            AD_ID
        ),
        Some(a) => failures.push(format!(
            "active_defense owner is {}, niet bpf_loader_upgradeable",
            a.owner
        )),
        None => failures.push("active_defense-account niet gevonden na add_program".into()),
    }

    // --- 3. transactie door de VM -------------------------------------------
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 2_000_000_000)
        .expect("airdrop moet slagen");

    let bh = svm.latest_blockhash();
    let ix = system_instruction::transfer(&payer.pubkey(), &Address::new_unique(), 1_000_000);
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&payer]).unwrap();
    match svm.send_transaction(tx) {
        Ok(res) => println!(
            "[3] systeemtransfer OK, {} CU verbruikt",
            res.compute_units_consumed
        ),
        Err(e) => failures.push(format!("systeemtransfer mislukt: {:?}", e)),
    }

    // --- 4. entrypoint van ons programma ------------------------------------
    // Lege data: Anchor's discriminator faalt vóór elke accountcontrole. Een
    // programmefout is hier dus het succespad; een loaderfout of "account not
    // found" zou betekenen dat het bytecode niet draait.
    let bh = svm.latest_blockhash();
    let ix = Instruction {
        program_id: AD_ID,
        data: vec![],
        accounts: vec![],
    };
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&payer]).unwrap();
    match svm.send_transaction(tx) {
        Ok(_) => failures.push(
            "lege instructie tegen active_defense werd geaccepteerd; dat kan niet".into(),
        ),
        Err(e) => println!("[4] active_defense entrypoint bereikt, verwachte afwijzing: {:?}", e),
    }

    println!();
    if failures.is_empty() {
        println!("MIJLPAAL 1 GROEN: VM + bytecode + transactieroute werken op deze host.");
    } else {
        println!("MIJLPAAL 1 RODEL:");
        for f in &failures {
            println!("  - {}", f);
        }
        std::process::exit(1);
    }
}
