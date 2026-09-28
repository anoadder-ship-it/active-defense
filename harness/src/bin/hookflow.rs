//! Mijlpaal 2: de echte autorisatie-route in LiteSVM.
//!
//! Wat hier wél en niet getest wordt, expliciet:
//!   WÉL  : secp256r1-precompile + instructies-sysvar-binding + wallet-layout +
//!          challenge-binding + Token-2022 InitializeTransferHook-CPI +
//!          ExtraAccountMetaList + dynamische PDA-resolutie tijdens een echte
//!          transfer, inclusief de negatieve tak (niet-geautoriseerde
//!          ontvanger moet falen).
//!   NIET : spankwallet zelf. Er staat hier geen spankwallet-programma; de
//!          wallet-account is handmatig opgebouwd uit de layout in
//!          crates/spankwallet-contract. Dit bewijst dus de contractkant van
//!          active-defense, niet de conformiteit van een echte spankwallet.
//!
//! Accountvolgorde en byte-layouts zijn overgenomen uit de devnet-geteste
//! ts-scripts (tests/attachTransferHookIsolated.ts, tests/
//! addAuthorizedRecipientIsolated.ts), niet uit het hoofd.
//!
//! Uitvoeren:  cargo run --bin hookflow   (vanuit harness/)

use {
    litesvm::{types::FailedTransactionMetadata, LiteSVM},
    p256::ecdsa::{signature::Signer, SigningKey},
    sha2::Digest as _,
    sha3::Keccak256,
    solana_address::{address, Address},
    solana_instruction::{AccountMeta, Instruction},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_sdk_ids::sysvar,
    solana_signer::Signer as _,
    solana_system_interface::instruction as system_instruction,
    solana_transaction::versioned::VersionedTransaction,
    spl_token_2022::{extension::ExtensionType, pod::PodMint},
    spl_transfer_hook_interface::instruction::ExecuteInstruction,
    spl_discriminator::SplDiscriminate,
};

const AD_ID: Address = address!("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");
const TOKEN_2022_ID: Address = address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA_ID: Address = address!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SECP256R1_ID: Address = address!("Secp256r1SigVerify1111111111111111111111111");
/// Echte spankwallet-ID. Het programma eist sinds fix 1 (STATUS §41) dat de
/// wallet door dát programma eigendom is én de PDA is die het zelf zou afleiden.
const SPANKWALLET_ID: Address = address!("9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9");

/// Zelfde nonce als de ts-scripts gebruiken; de wallet is hier immers fictief.
const ACTION_NONCE: u64 = 1;

// ---------------------------------------------------------------------------
// kleine helpers
// ---------------------------------------------------------------------------

fn anchor_disc(ix_name: &str) -> [u8; 8] {
    let d = sha2::Sha256::digest(format!("global:{ix_name}").as_bytes());
    let mut out = [0u8; 8];
    out.copy_from_slice(&d[..8]);
    out
}

fn sha256(data: &[u8]) -> [u8; 32] {
    let d = sha2::Sha256::digest(data);
    let mut out = [0u8; 32];
    out.copy_from_slice(&d);
    out
}

/// Tegenhanger van solana_keccak_hasher::hashv: één keccak over de
/// aaneengeplakte delen.
fn keccak256(parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Keccak256::new();
    for p in parts {
        h.update(p);
    }
    let d = h.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&d);
    out
}

/// base64url zonder padding — de decoder in instructions.rs verpakt geen '='.
fn base64url(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();
    for chunk in data.chunks(3) {
        let b = [chunk[0], chunk.get(1).copied().unwrap_or(0), chunk.get(2).copied().unwrap_or(0)];
        let n = (b[0] as u32) << 16 | (b[1] as u32) << 8 | b[2] as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(T[(n >> 6) as usize & 63] as char);
        }
        if chunk.len() > 2 {
            out.push(T[n as usize & 63] as char);
        }
    }
    out
}

fn contains(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.len() > hay.len() {
        return None;
    }
    (0..=(hay.len() - needle.len())).find(|&i| &hay[i..i + needle.len()] == needle)
}

// ---------------------------------------------------------------------------
// passkey + webauthn-achtige signatuur
// ---------------------------------------------------------------------------

struct Passkey {
    sk: SigningKey,
    pk33: [u8; 33], // gecomprimeerde P-256 sleutel
}

struct SignedWebAuthn {
    signed_message: Vec<u8>, // authenticator_data(37) || sha256(clientDataJSON)
    sig64: [u8; 64],
    client_data_json: Vec<u8>,
}

impl Passkey {
    fn fixed(seed: u8) -> Self {
        let sk = SigningKey::from_slice(&[seed; 32]).expect("geldige P-256 scalar");
        let ep = sk.verifying_key().to_encoded_point(true);
        let mut pk33 = [0u8; 33];
        pk33.copy_from_slice(ep.as_bytes());
        Self { sk, pk33 }
    }

    /// Bouwt exact wat de ts-scripts ook bouwen: authenticator_data met UV-vlag
    /// op byte 32, challenge als base64url in clientDataJSON.
    fn sign(&self, challenge: &[u8; 32]) -> SignedWebAuthn {
        let client_data_json = format!(
            "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"https://harness.local\",\"crossOrigin\":false}}",
            base64url(challenge)
        )
        .into_bytes();
        let cdh = sha256(&client_data_json);

        let mut authenticator_data = vec![0u8; 37];
        authenticator_data[32] = 0x05; // UP | UV — program eist bit 0x04
        let mut signed_message = authenticator_data;
        signed_message.extend_from_slice(&cdh);

        // Precompile verifieert met OpenSSL sha256 → ECDSA over sha256(message).
        let sig: p256::ecdsa::Signature = self.sk.sign(&signed_message);
        let sig = sig.normalize_s().unwrap_or(sig);
        SignedWebAuthn {
            signed_message,
            sig64: {
                let mut b = [0u8; 64];
                b.copy_from_slice(&sig.to_bytes());
                b
            },
            client_data_json,
        }
    }
}

/// Layout overgenomen uit tests/attachTransferHookIsolated.ts:112-132, die op
/// devnet slaagt. teller(1) + pad(1) + 7×u16 offsets + sig(64) + pk(33) + msg.
fn secp256r1_ix(pk33: &[u8; 33], message: &[u8], sig64: &[u8; 64]) -> Instruction {
    const NO_OWN: u16 = u16::MAX;
    let data_start = 2 + 14usize;
    let sig_off = data_start;
    let pk_off = sig_off + 64;
    let msg_off = pk_off + 33;

    let mut data = vec![0u8; msg_off + message.len()];
    data[0] = 1;
    data[1] = 0;
    let mut o = 2usize;
    for v in [
        sig_off as u16,
        NO_OWN,
        pk_off as u16,
        NO_OWN,
        msg_off as u16,
        message.len() as u16,
        NO_OWN,
    ] {
        data[o..o + 2].copy_from_slice(&v.to_le_bytes());
        o += 2;
    }
    data[sig_off..sig_off + 64].copy_from_slice(sig64);
    data[pk_off..pk_off + 33].copy_from_slice(pk33);
    data[msg_off..].copy_from_slice(message);

    Instruction {
        program_id: SECP256R1_ID,
        accounts: vec![],
        data,
    }
}

// ---------------------------------------------------------------------------
// gefabriceerde spankwallet WalletAccount
// ---------------------------------------------------------------------------

/// Layout volgens crates/spankwallet-contract/src/lib.rs:43-73. Recovery-state
/// en deposit-authority zijn None, dus action_nonce staat op 158.
fn wallet_bytes(owner_passkey: &[u8; 33], nonce: u64) -> Vec<u8> {
    let mut d = vec![0u8; 174];
    // [0..8) discriminator: voor deze test inhoudsloos, het programma leest hem niet.
    d[0..8].copy_from_slice(&anchor_disc("wallet"));
    // [8..41) seed_key — hier dezelfde sleutel als owner_passkey.
    d[8..41].copy_from_slice(owner_passkey);
    // [41..73) wallet_seed_hash = sha256(seed_key)
    d[41..73].copy_from_slice(&sha256(owner_passkey));
    // [73..106) owner_passkey
    d[73..106].copy_from_slice(owner_passkey);
    // [106] bump, [107] vault_bump
    d[106] = 255;
    d[107] = 255;
    // [108..116) created_at
    d[108..116].copy_from_slice(&1_700_000_000i64.to_le_bytes());
    // [116..148) backup_authority: nul
    // [148] recovery_state tag = None
    d[148] = 0;
    // [149..157) recovery_timelock_seconds
    d[149..157].copy_from_slice(&259_200i64.to_le_bytes());
    // [157] deposit_authority tag = None
    d[157] = 0;
    // [158..166) action_nonce
    d[158..166].copy_from_slice(&nonce.to_le_bytes());
    // [166..174) session_epoch
    d
}

// ---------------------------------------------------------------------------
// transactie-hulp
// ---------------------------------------------------------------------------

struct Step {
    label: &'static str,
    ok: bool,
    detail: String,
}

fn send(
    svm: &mut LiteSVM,
    _label: &'static str,
    ixs: Vec<Instruction>,
    signers: &[&Keypair],
) -> Result<litesvm::types::TransactionMetadata, (String, Vec<String>)> {
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&signers[0].pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers)
        .expect("transactie tekenen");
    match svm.send_transaction(tx) {
        Ok(meta) => Ok(meta),
        Err(FailedTransactionMetadata { err, meta }) => {
            Err((format!("{err:?}"), meta.logs))
        }
    }
}

fn expect_ok(
    svm: &mut LiteSVM,
    steps: &mut Vec<Step>,
    label: &'static str,
    ixs: Vec<Instruction>,
    signers: &[&Keypair],
) -> Option<litesvm::types::TransactionMetadata> {
    match send(svm, label, ixs, signers) {
        Ok(m) => {
            steps.push(Step {
                label,
                ok: true,
                detail: format!("{} CU", m.compute_units_consumed),
            });
            Some(m)
        }
        Err((e, logs)) => {
            steps.push(Step {
                label,
                ok: false,
                detail: format!("{e} | logs: {:?}", logs.last()),
            });
            None
        }
    }
}

fn expect_err(
    svm: &mut LiteSVM,
    steps: &mut Vec<Step>,
    label: &'static str,
    ixs: Vec<Instruction>,
    signers: &[&Keypair],
) {
    match send(svm, label, ixs, signers) {
        Ok(_) => steps.push(Step {
            label,
            ok: false,
            detail: "transactie werd GEACCEPTEER, maar moest falen".into(),
        }),
        Err((e, logs)) => steps.push(Step {
            label,
            ok: true,
            detail: format!("verwachte afwijzing: {e}\n              laatste logs: {:?}", logs.last()),
        }),
    }
}

// ---------------------------------------------------------------------------

fn main() {
    let mut steps: Vec<Step> = Vec::new();
    let mut fatal: Option<String> = None;

    // --- VM + programma ----------------------------------------------------
    let mut svm = LiteSVM::new();
    let (so, regel) = ad_harness::so_path();
    println!("  artefact-fingerprint : {}", ad_harness::beschrijf(&so));
    let bytes = std::fs::read(&so)
        .unwrap_or_else(|e| panic!("{} — {}", ad_harness::ontbreekt_fout(&so, regel), e));
    svm.add_program(AD_ID, &bytes).expect("programma laden");

    let payer = ad_harness::vaste_toets(1);
    svm.airdrop(&payer.pubkey(), 5_000_000_000).unwrap();

    let passkey = Passkey::fixed(7);

    // Wallet: nog steeds zonder spankwallet-programma (zie kop), maar wél op het
    // adres en onder de eigenaar die spankwallet zelf zou produceren — fix 1
    // verwerpt anders alles (STATUS §41).
    let wallet_hash = sha2::Sha256::digest(passkey.pk33);
    let (wallet, _) = Address::find_program_address(
        &[b"wallet".as_slice(), &wallet_hash], &SPANKWALLET_ID);
    let wdata = wallet_bytes(&passkey.pk33, ACTION_NONCE);
    let wallet_acc = solana_account::Account {
        lamports: svm.minimum_balance_for_rent_exemption(wdata.len()),
        data: wdata,
        owner: SPANKWALLET_ID,
        executable: false,
        rent_epoch: 0,
    };
    svm.set_account(wallet, wallet_acc).expect("wallet account zetten");

    // --- mint-ruimte -------------------------------------------------------
    let mint_kp = ad_harness::vaste_toets(2);
    let mint = mint_kp.pubkey();
    let mint_space = ExtensionType::try_calculate_account_len::<PodMint>(&[ExtensionType::TransferHook])
        .expect("mint-lengte");
    let rent_mint = svm.minimum_balance_for_rent_exemption(mint_space);

    // --- PDA's vooraf uitrekenen ------------------------------------------
    let (eaml, _b1) =
        Address::find_program_address(&[b"extra-account-metas".as_slice(), mint.as_ref()], &AD_ID);
    let recipient_kp = ad_harness::vaste_toets(3);
    let recipient = recipient_kp.pubkey();
    let (auth_rec, _b2) = Address::find_program_address(
        &[b"poison_authorized".as_slice(), mint.as_ref(), recipient.as_ref()],
        &AD_ID,
    );

    println!("mijlpaal 2 — opzet");
    println!("  mint-ruimte met TransferHook-extensie : {mint_space} byte");
    println!("  extra-account-meta-list PDA           : {eaml}");
    println!("  authorized-recipient PDA              : {auth_rec}");
    println!("  passkey (33 byte, gecomprimeerd)      : {:02x}…", passkey.pk33[0]);

    // stap 1: ruimte reserveren voor de mint, owner = Token-2022
    if expect_ok(
        &mut svm,
        &mut steps,
        "createAccount(mint) met hook-ruimte",
        vec![system_instruction::create_account(
            &payer.pubkey(),
            &mint,
            rent_mint,
            mint_space as u64,
            &TOKEN_2022_ID,
        )],
        &[&payer, &mint_kp],
    )
    .is_none()
    {
        fatal = Some("mint-ruimte aanmaken mislukt; rest overgeslagen".into());
    }

    // stap 2: attach_transfer_hook — precompile vóór de programma-instructie
    if fatal.is_none() {
        let mut payload = Vec::new();
        payload.extend_from_slice(&ACTION_NONCE.to_le_bytes());
        payload.extend_from_slice(mint.as_ref());
        let challenge = keccak256(&[AD_ID.as_ref(), wallet.as_ref(), b"attach_transfer_hook", &payload]);
        let s = passkey.sign(&challenge);

        let mut data = anchor_disc("attach_transfer_hook").to_vec();
        data.extend_from_slice(&ACTION_NONCE.to_le_bytes());
        data.extend_from_slice(&(s.client_data_json.len() as u32).to_le_bytes());
        data.extend_from_slice(&s.client_data_json);

        let ix = Instruction {
            program_id: AD_ID,
            accounts: vec![
                AccountMeta::new_readonly(wallet, false),
                // passkeys: None — de ts-scripts vullen deze positie met het
                // programma-ID zelf; zelfde truc hier, geen eigen verzinsel.
                AccountMeta::new_readonly(AD_ID, false),
                AccountMeta::new(mint, false),
                AccountMeta::new(eaml, false),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(TOKEN_2022_ID, false),
                AccountMeta::new_readonly(sysvar::instructions::id(), false),
                AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
            ],
            data,
        };
        expect_ok(
            &mut svm,
            &mut steps,
            "attach_transfer_hook (met secp256r1-precompile)",
            vec![secp256r1_ix(&passkey.pk33, &s.signed_message, &s.sig64), ix],
            &[&payer],
        );
    }

    // controle: staat de hook echt op de mint, en is de EAML echt geschreven?
    if fatal.is_none() {
        let m = svm.get_account(&mint).expect("mint-account");
        let hook_at = contains(&m.data, AD_ID.as_ref());
        let eaml_acc = svm.get_account(&eaml);
        let disc_ok = eaml_acc
            .as_ref()
            .map(|a| a.data.starts_with(ExecuteInstruction::SPL_DISCRIMINATOR_SLICE))
            .unwrap_or(false);
        steps.push(Step {
            label: "mint bevat active-defense als hook-program",
            ok: hook_at.is_some(),
            detail: match hook_at {
                Some(o) => format!("byte-offset {o} in mint-data"),
                None => "AD_ID niet gevonden in mint-data".into(),
            },
        });
        steps.push(Step {
            label: "ExtraAccountMetaList heeft Execute-discriminator",
            ok: disc_ok,
            detail: match &eaml_acc {
                Some(a) => format!("{} byte, eerste 8: {:02x?}", a.data.len(), &a.data[..8.min(a.data.len())]),
                None => "EAML-account bestaat niet".into(),
            },
        });
    }

    // stap 3: InitializeMint2 (na attach — het programma-document zegt dat de
    // extensie-init vóór mint-init hoort)
    if fatal.is_none() {
        let ix = spl_token_2022::instruction::initialize_mint2(
            &TOKEN_2022_ID,
            &mint,
            &payer.pubkey(),
            Some(&payer.pubkey()),
            2,
        )
        .expect("initialize_mint2");
        expect_ok(
            &mut svm,
            &mut steps,
            "InitializeMint2 op mint mét hook-extensie",
            vec![ix],
            &[&payer],
        );
    }

    // stap 4: add_authorized_recipient
    if fatal.is_none() {
        let mut payload = Vec::new();
        payload.extend_from_slice(&ACTION_NONCE.to_le_bytes());
        payload.extend_from_slice(mint.as_ref());
        payload.extend_from_slice(recipient.as_ref());
        let challenge =
            keccak256(&[AD_ID.as_ref(), wallet.as_ref(), b"add_authorized_recipient", &payload]);
        let s = passkey.sign(&challenge);

        let mut data = anchor_disc("add_authorized_recipient").to_vec();
        data.extend_from_slice(recipient.as_ref());
        data.extend_from_slice(&ACTION_NONCE.to_le_bytes());
        data.extend_from_slice(&(s.client_data_json.len() as u32).to_le_bytes());
        data.extend_from_slice(&s.client_data_json);

        let ix = Instruction {
            program_id: AD_ID,
            accounts: vec![
                AccountMeta::new_readonly(wallet, false),
                AccountMeta::new_readonly(AD_ID, false), // passkeys: None
                AccountMeta::new_readonly(mint, false),
                AccountMeta::new(auth_rec, false),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(sysvar::instructions::id(), false),
                AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
            ],
            data,
        };
        expect_ok(
            &mut svm,
            &mut steps,
            "add_authorized_recipient (met secp256r1-precompile)",
            vec![secp256r1_ix(&passkey.pk33, &s.signed_message, &s.sig64), ix],
            &[&payer],
        );
    }

    // stap 5: token-accounts + mint naar bron
    let ata_src = {
        let (a, _) = Address::find_program_address(
            &[payer.pubkey().as_ref(), TOKEN_2022_ID.as_ref(), mint.as_ref()],
            &ATA_ID,
        );
        a
    };
    let ata_dst = {
        let (a, _) = Address::find_program_address(
            &[recipient.as_ref(), TOKEN_2022_ID.as_ref(), mint.as_ref()],
            &ATA_ID,
        );
        a
    };
    let unauthorized = ad_harness::vaste_toets(4);
    let ata_bad = {
        let (a, _) = Address::find_program_address(
            &[unauthorized.pubkey().as_ref(), TOKEN_2022_ID.as_ref(), mint.as_ref()],
            &ATA_ID,
        );
        a
    };

    if fatal.is_none() {
        for (label, owner, ata) in [
            ("ATA bron (payer)", payer.pubkey(), ata_src),
            ("ATA ontvanger (geautoriseerd)", recipient, ata_dst),
            ("ATA ontvanger (ONGEAUTORISEERD)", unauthorized.pubkey(), ata_bad),
        ] {
            let ix = Instruction {
                program_id: ATA_ID,
                accounts: vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new(ata, false),
                    AccountMeta::new_readonly(owner, false),
                    AccountMeta::new_readonly(mint, false),
                    AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
                    AccountMeta::new_readonly(TOKEN_2022_ID, false),
                ],
                data: vec![0], // ATA Create
            };
            if expect_ok(&mut svm, &mut steps, label, vec![ix], &[&payer]).is_none() && label.contains("bron") {
                fatal = Some("ATA van bron ontbreekt; rest overgeslagen".into());
            }
        }

        let ix = spl_token_2022::instruction::mint_to(
            &TOKEN_2022_ID,
            &mint,
            &ata_src,
            &payer.pubkey(),
            &[],
            1_000,
        )
        .expect("mint_to");
        expect_ok(&mut svm, &mut steps, "mintTo 1000 units naar bron", vec![ix], &[&payer]);
    }

    // stap 6: de echte transfer door de hook
    if fatal.is_none() {
        let mut ix = spl_token_2022::instruction::transfer_checked(
            &TOKEN_2022_ID,
            &ata_src,
            &mint,
            &ata_dst,
            &payer.pubkey(),
            &[],
            400,
            2,
        )
        .expect("transfer_checked");
        // Volgorde die Token-2022 zelf afdwingt: standaard vier, dan de
        // ExtraAccountMetaList, dan de geresolveerde extra accounts.
        ix.accounts.push(AccountMeta::new_readonly(eaml, false));
        ix.accounts.push(AccountMeta::new_readonly(auth_rec, false));
        // Token-2022 lost de extra accounts op maar zet het hook-programma niet
        // zelf in de lijst: zonder dat account geeft de loader
        // "Unknown program …" / InstructionError::MissingAccount. Gemeten, niet
        // vermoed — zie de log van de eerste run.
        ix.accounts.push(AccountMeta::new_readonly(AD_ID, false));

        match send(&mut svm, "transferChecked naar geautoriseerde ontvanger", vec![ix], &[&payer]) {
            Ok(m) => {
                let hooked = m.logs.iter().any(|l| l.contains("POISON_TRANSFER_ALLOWED"));
                steps.push(Step {
                    label: "transferChecked naar geautoriseerde ontvanger",
                    ok: hooked,
                    detail: format!(
                        "{} CU, hook-log {}",
                        m.compute_units_consumed,
                        if hooked { "aanwezig" } else { "ONTBREKEND" }
                    ),
                });
            }
            Err((e, logs)) => steps.push(Step {
                label: "transferChecked naar geautoriseerde ontvanger",
                ok: false,
                detail: format!("{e}\n              logs:\n                {}", logs.join("\n                ")),
            }),
        }

        // negatieve tak
        let mut bad = spl_token_2022::instruction::transfer_checked(
            &TOKEN_2022_ID,
            &ata_src,
            &mint,
            &ata_bad,
            &payer.pubkey(),
            &[],
            100,
            2,
        )
        .expect("transfer_checked bad");
        // Wel de juiste geresolveerde PDA-adressen: Token-2022 eist dat het
        // account op deze positie gelijk is aan het uit de seeds afgeleide
        // adres. Die PDA bestaat niet, dus onze hook moet falen op de
        // deserialisatie van Account<AuthorizedRecipient> — dat is precies wat
        // deze tak moet bewijzen, en niet een of andere account-fout.
        let (auth_rec_bad, _) = Address::find_program_address(
            &[
                b"poison_authorized".as_slice(),
                mint.as_ref(),
                unauthorized.pubkey().as_ref(),
            ],
            &AD_ID,
        );
        bad.accounts.push(AccountMeta::new_readonly(eaml, false));
        bad.accounts.push(AccountMeta::new_readonly(auth_rec_bad, false));
        bad.accounts.push(AccountMeta::new_readonly(AD_ID, false));
        expect_err(
            &mut svm,
            &mut steps,
            "transferChecked naar ongeautoriseerde ontvanger MOET falen",
            vec![bad],
            &[&payer],
        );
    }

    // --- rapport -----------------------------------------------------------
    println!("\nresultaten");
    for s in &steps {
        println!("  {} {:<58} {}", if s.ok { "[ok]  " } else { "[FAAL]" }, s.label, s.detail);
    }
    if let Some(f) = &fatal {
        println!("\nFATAAL: {f}");
    }

    let faals: Vec<_> = steps.iter().filter(|s| !s.ok).collect();
    println!();
    if fatal.is_none() && faals.is_empty() {
        println!(
            "MIJLPAAL 2 GROEN: {} stappen, precompile-binding en hook-resolutie werken end-to-end in de harness.",
            steps.len()
        );
    } else {
        println!("MIJLPAAL 2 NIET GROEN: {} van {} stappen faalden.", faals.len(), steps.len());
        std::process::exit(1);
    }
}
