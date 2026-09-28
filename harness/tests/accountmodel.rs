//! Accountmodel-aanvallen op `add_authorized_recipient`.
//!
//! De vraag die dit bestand beantwoordt: als `wallet` een `UncheckedAccount` is
//! zonder enige PDA- of eigendomscontrole, kan iemand dan een wallet-account
//! vervalsen en daarmee ontvangers autoriseren op een mint die hem niet toebehoort?
//!
//! De bestaande groene harness (`src/bin/hookflow.rs`) gebruikt zélf al een
//! gefabriceerd wallet-account op een willekeurig adres (`vaste_adres(0xA1)`,
//! eigen commentaar: "gefabriceerd account, géén spankwallet-programma"). Dat was
//! bedoeld als testgemak. Dit bestand kijkt of hetzelfde gebrek ook een aanval is.
//!
//! Hulpfuncties zijn bewust gekopieerd uit `hookflow.rs` in plaats van gehaald:
//! die wonen daar in een bin en delen kost een refactor van een werkend bestand.
//! Die refactor is verdiend werk, maar niet hier en nu.

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
    solana_transaction::versioned::VersionedTransaction,
};

const AD_ID: Address = address!("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");
/// Het echte spankwallet-programma. In LiteSVM hoeft daar geen code te staan:
/// het programma controleert alleen `owner` en de PDA-afleiding.
const SPANKWALLET_ID: Address = address!("9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9");
/// De wegwerp-fixture uit tests/activeDefenseFull.ts. Sinds §43 kan het programma
/// tegen een fixture wijzen; dát is precies wat fix 1 niet kon en wat onze eigen
/// localnet-run brak (6011).
const FIXTURE_ID: Address = address!("BUtmiNmqdyZvDfzgu3DTzK39QPTqFUn4aYiAMHemckqk");
const ACTION_NONCE: u64 = 1;

fn anchor_disc(ix: &str) -> [u8; 8] {
    let h = sha2::Sha256::digest(format!("global:{ix}").as_bytes());
    let mut d = [0u8; 8];
    d.copy_from_slice(&h[..8]);
    d
}

fn keccak256(delen: &[&[u8]]) -> [u8; 32] {
    let mut h = Keccak256::new();
    for d in delen { h.update(d); }
    let out = h.finalize();
    let mut r = [0u8; 32];
    r.copy_from_slice(&out);
    r
}

struct Passkey { sk: SigningKey, pk33: [u8; 33] }
struct Signed { client_data_json: Vec<u8>, signed_message: Vec<u8>, sig64: [u8; 64] }

impl Passkey {
    fn fixed(seed: u8) -> Self {
        let mut b = [0u8; 32];
        b[0] = seed; b[31] = 1;
        let sk = SigningKey::from_bytes(&b.into()).expect("vaste seed is een geldige P-256 sleutel");
        let mut pk33 = [0u8; 33];
        pk33.copy_from_slice(&sk.verifying_key().to_encoded_point(true).as_bytes());
        Self { sk, pk33 }
    }
    /// WebAuthn-structuur overgenomen uit src/bin/hookflow.rs:129-154, die op
    /// devnet en in LiteSVM slaagt: challenge in clientDataJSON, sha256 daarvan,
    /// 37 bytes authenticator-data met UV-vlag (0x04) erbij, en de handtekening
    /// over dat geheel — la-S genormaliseerd voor de precompile.
    fn sign(&self, challenge: &[u8; 32]) -> Signed {
        let client_data_json = format!(
            "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"https://harness.local\",\"crossOrigin\":false}}",
            base64url(challenge)
        ).into_bytes();
        let cdh = sha2::Sha256::digest(&client_data_json);
        let mut authenticator_data = vec![0u8; 37];
        authenticator_data[32] = 0x05; // UP | UV — het programma eist bit 0x04
        let mut signed_message = authenticator_data;
        signed_message.extend_from_slice(&cdh);

        let sig: p256::ecdsa::Signature = self.sk.sign(&signed_message);
        let sig = sig.normalize_s().unwrap_or(sig);
        let mut sig64 = [0u8; 64];
        sig64.copy_from_slice(&sig.to_bytes());
        Signed { client_data_json, signed_message, sig64 }
    }
}

fn base64url(d: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut s = String::new();
    for c in d.chunks(3) {
        let b = [c[0], c.get(1).copied().unwrap_or(0), c.get(2).copied().unwrap_or(0)];
        let n = (b[0] as u32) << 16 | (b[1] as u32) << 8 | b[2] as u32;
        s.push(T[(n >> 18 & 63) as usize] as char);
        s.push(T[(n >> 12 & 63) as usize] as char);
        if c.len() > 1 { s.push(T[(n >> 6 & 63) as usize] as char); }
        if c.len() > 2 { s.push(T[(n & 63) as usize] as char); }
    }
    s
}

/// Layout letterlijk overgenomen uit src/bin/hookflow.rs:159-191 (die zelf teruggaat
/// op tests/attachTransferHookIsolated.ts:112-132, devnet-geslaagd): teller(1) +
/// pad(1) + 7×u16 offsets + sig(64) + pk(33) + msg. Een eigen reconstructie hiervan
/// gaf `Custom(3)` en liet een negatieve test slagen voor de verkeerde reden.
fn secp256r1_ix(pk33: &[u8; 33], bericht: &[u8], sig64: &[u8; 64]) -> Instruction {
    const NO_OWN: u16 = u16::MAX;
    let data_start = 2 + 14usize;
    let sig_off = data_start;
    let pk_off = sig_off + 64;
    let msg_off = pk_off + 33;

    let mut data = vec![0u8; msg_off + bericht.len()];
    data[0] = 1;
    data[1] = 0;
    let mut o = 2usize;
    for v in [
        sig_off as u16, NO_OWN, pk_off as u16, NO_OWN, msg_off as u16,
        bericht.len() as u16, NO_OWN,
    ] {
        data[o..o + 2].copy_from_slice(&v.to_le_bytes());
        o += 2;
    }
    data[sig_off..sig_off + 64].copy_from_slice(sig64);
    data[pk_off..pk_off + 33].copy_from_slice(pk33);
    data[msg_off..].copy_from_slice(bericht);

    Instruction {
        program_id: address!("Secp256r1SigVerify1111111111111111111111111"),
        accounts: vec![],
        data,
    }
}

/// Wallet-account-bytes volgens de layout in crates/spankwallet-contract.
fn wallet_bytes(owner_passkey: &[u8; 33], nonce: u64) -> Vec<u8> {
    let mut d = vec![0u8; 174];
    d[0..8].copy_from_slice(&anchor_disc("wallet"));
    d[8..41].copy_from_slice(owner_passkey);
    d[41..73].copy_from_slice(&sha2::Sha256::digest(owner_passkey));
    d[73..106].copy_from_slice(owner_passkey);
    d[106] = 255; d[107] = 255;
    d[108..116].copy_from_slice(&1_700_000_000i64.to_le_bytes());
    d[148] = 0;
    d[149..157].copy_from_slice(&259_200i64.to_le_bytes());
    d[157] = 0;
    d[158..166].copy_from_slice(&nonce.to_le_bytes());
    d
}

struct Opstelling { svm: LiteSVM, payer: Keypair }

fn opstelling() -> Opstelling {
    let mut svm = LiteSVM::new();
    let (so, _) = ad_harness::so_path();
    let bytes = std::fs::read(&so).unwrap_or_else(|e| panic!("{} — {}", ad_harness::ontbreekt_fout(&so, "test"), e));
    svm.add_program(AD_ID, &bytes).expect("programma laden");
    let payer = ad_harness::vaste_toets(1);
    svm.airdrop(&payer.pubkey(), 5_000_000_000).unwrap();
    Opstelling { svm, payer }
}

fn stuur(svm: &mut LiteSVM, ixs: Vec<Instruction>, signers: &[&Keypair]) -> Result<(), String> {
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&ixs, Some(&signers[0].pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).expect("tekenen");
    match svm.send_transaction(tx) {
        Ok(_) => Ok(()),
        Err(FailedTransactionMetadata { err, meta }) => {
            Err(format!("{err:?} | {}", meta.logs.join(" / ")))
        }
    }
}

/// Roept `add_authorized_recipient` aan met het doorgegeven wallet-account.
fn voeg_ontvanger_toe(
    o: &mut Opstelling,
    wallet: Address,
    mint: Address,
    recipient: Address,
    pk: &Passkey,
    met_config: bool,
) -> Result<(), String> {
    let mut payload = Vec::new();
    payload.extend_from_slice(&ACTION_NONCE.to_le_bytes());
    payload.extend_from_slice(mint.as_ref());
    payload.extend_from_slice(recipient.as_ref());
    let challenge = keccak256(&[AD_ID.as_ref(), wallet.as_ref(), b"add_authorized_recipient", &payload]);
    let s = pk.sign(&challenge);

    let mut data = anchor_disc("add_authorized_recipient").to_vec();
    data.extend_from_slice(recipient.as_ref());
    data.extend_from_slice(&ACTION_NONCE.to_le_bytes());
    data.extend_from_slice(&(s.client_data_json.len() as u32).to_le_bytes());
    data.extend_from_slice(&s.client_data_json);

    let (auth_rec, _) = Address::find_program_address(
        &[b"poison_authorized".as_slice(), mint.as_ref(), recipient.as_ref()], &AD_ID);

    let mut ix = Instruction {
        program_id: AD_ID,
        accounts: vec![
            AccountMeta::new_readonly(wallet, false),
            AccountMeta::new_readonly(AD_ID, false),          // passkeys: None
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(auth_rec, false),
            AccountMeta::new(o.payer.pubkey(), true),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
        ],
        data,
    };
    if met_config {
        // config staat ONDERAAN de accounts-struct in instructions.rs — volgorde
        // is geen smaak: Anchor eist ze in declaratievolgorde.
        ix.accounts.push(AccountMeta::new_readonly(config_adres(), false));
    }
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer])
}

/// Eén, programma-brede config-PDA (programma-bron: state.rs WALLET_CONFIG_SEED).
fn config_adres() -> Address {
    let (a, _) = Address::find_program_address(&[b"wallet_config".as_slice()], &AD_ID);
    a
}

/// Zet de vertrouwde wallet-programma-ID. Schrijf-één-keer: een tweede aanroep
/// moet falen.
fn zet_config(o: &mut Opstelling, vertrouwd: Address) -> Result<(), String> {
    let mut data = anchor_disc("set_wallet_program").to_vec();
    data.extend_from_slice(vertrouwd.as_ref());
    let ix = Instruction {
        program_id: AD_ID,
        accounts: vec![
            AccountMeta::new(config_adres(), false),
            AccountMeta::new(o.payer.pubkey(), true),
            AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
        ],
        data,
    };
    stuur(&mut o.svm, vec![ix], &[&o.payer])
}

/// De wallet-adres die spankwallet zelf zou gebruiken voor deze passkey:
/// `["wallet", sha256(seed_key)]` onder het spankwallet-programma.
fn echte_wallet_adres(pk33: &[u8; 33], vertrouwd: &Address) -> Address {
    let hash = sha2::Sha256::digest(pk33);
    let (a, _) = Address::find_program_address(&[b"wallet".as_slice(), &hash], vertrouwd);
    a
}

/// Zet een willekeurig, data-dragend account neer (hier: de mint-stand-in).
fn zet_account(svm: &mut LiteSVM, a: Address, data: Vec<u8>, owner: Address) {
    let acc = solana_account::Account {
        lamports: svm.minimum_balance_for_rent_exemption(data.len()),
        data, owner, executable: false, rent_epoch: 0,
    };
    svm.set_account(a, acc).expect("account zetten");
}

/// De aanval uit STATUS §41, nu geblokkeerd door fix 1 (`bevestig_echte_wallet`).
///
/// Historie: deze test was geschreven als karakteriserende test die groen was
/// zolang het lek bestond ("verwacht (huidige, verkeerde) aanvaarding"). Na fix 1
/// is de verwachting omgezet naar verwerping, zoals de commentaar aankondigde.
#[test]
fn vervalsd_wallet_account_wordt_geweigerd() {
    let mut o = opstelling();
    let aanmaker_pk = Passkey::fixed(77);

    // Wallet op een willekeurig adres, eigendom van een willekeurig programma.
    let wallet = ad_harness::vaste_adres(0xB1);
    zet_account(&mut o.svm, wallet, wallet_bytes(&aanmaker_pk.pk33, ACTION_NONCE),
                ad_harness::vaste_adres(0xB2));

    // Mint: staat hier model voor iemands anders poison-token.
    let mint = ad_harness::vaste_adres(0xC1);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));

    let recipient = ad_harness::vaste_adres(0xD1);

    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");
    let resultaat = voeg_ontvanger_toe(&mut o, wallet, mint, recipient, &aanmaker_pk, true);
    let f = resultaat.expect_err("vervaalsd wallet-account werd GEACCEPT EERD");
    // Specifiek 6011: dit account heeft een FOUT eigendom-programma. De eerdere
    // versie aanvaardde ook 6013, en mutatie M5 (eigenaarscheck weglaten) maakte
    // daardoor geen enkele test rood — de PDA-tak ving hem op. Zie STATUS §43.
    assert!(f.contains("WalletNietVanSpankwallet") || f.contains("Custom(6011)"),
        "verwacht 6011 WalletNietVanSpankwallet, kreeg: {f}");

    let (auth_rec, _) = Address::find_program_address(
        &[b"poison_authorized".as_slice(), mint.as_ref(), recipient.as_ref()], &AD_ID);
    assert!(o.svm.get_account(&auth_rec).is_none(),
        "er is tóch een autorisatie-PDA ontstaan");
}

/// De reparatie mag het legitieme pad niet breken: een wallet op het adres dat
/// spankwallet zelf voor deze passkey afleidt, eigendom van spankwallet, moet
/// gewoon ontvangers kunnen autoriseren.
#[test]
fn echte_spankwallet_wallet_autoriseert_wel() {
    let mut o = opstelling();
    let pk = Passkey::fixed(79);
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), SPANKWALLET_ID);

    let mint = ad_harness::vaste_adres(0xC3);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));
    let recipient = ad_harness::vaste_adres(0xD3);

    if let Err(f) = voeg_ontvanger_toe(&mut o, wallet, mint, recipient, &pk, true) {
        panic!("legitieme wallet geweigerd: {f}");
    }
    let (auth_rec, _) = Address::find_program_address(
        &[b"poison_authorized".as_slice(), mint.as_ref(), recipient.as_ref()], &AD_ID);
    assert!(o.svm.get_account(&auth_rec).is_some(), "autorisatie-PDA ontbreekt");
}

/// Tegenpool: de challenge-binding wél in orde. Iemand die over een ándere mint
/// tekent dan de instructie doorgeeft, moet falen. Als deze test faalt ligt het
/// aan de signatuurverificatie, niet aan de wallet-controle — en dat is een ander
/// (ergere) probleem.
#[test]
fn handtekening_over_andere_mint_wordt_geweigerd() {
    let mut o = opstelling();
    let mut o = opstelling();
    let pk = Passkey::fixed(78);
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    // Echte wallet-PDA: deze test moet falen op de challenge-binding, niet op de
    // nieuwe wallet-autenticiteitscontrole.
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), SPANKWALLET_ID);
    let mint = ad_harness::vaste_adres(0xC2);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));
    let recipient = ad_harness::vaste_adres(0xD2);

    // Challenge over een ANDERE mint dan die in de instructie staat.
    let andere_mint = ad_harness::vaste_adres(0xC9);
    let mut payload = Vec::new();
    payload.extend_from_slice(&ACTION_NONCE.to_le_bytes());
    payload.extend_from_slice(andere_mint.as_ref());
    payload.extend_from_slice(recipient.as_ref());
    let challenge = keccak256(&[AD_ID.as_ref(), wallet.as_ref(), b"add_authorized_recipient", &payload]);
    let s = pk.sign(&challenge);

    let mut data = anchor_disc("add_authorized_recipient").to_vec();
    data.extend_from_slice(recipient.as_ref());
    data.extend_from_slice(&ACTION_NONCE.to_le_bytes());
    data.extend_from_slice(&(s.client_data_json.len() as u32).to_le_bytes());
    data.extend_from_slice(&s.client_data_json);

    let (auth_rec, _) = Address::find_program_address(
        &[b"poison_authorized".as_slice(), mint.as_ref(), recipient.as_ref()], &AD_ID);

    let mut ix = Instruction {
        program_id: AD_ID,
        accounts: vec![
            AccountMeta::new_readonly(wallet, false),
            AccountMeta::new_readonly(AD_ID, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(auth_rec, false),
            AccountMeta::new(o.payer.pubkey(), true),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
            AccountMeta::new_readonly(config_adres(), false),
        ],
        data,
    };
    let r = stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer]);
    // Anchor meldt eigen fouten als 6000+index: 6002 = WebAuthnChallengeMismatch,
    // 6001 = InvalidPasskeySignature. (Let op de instructie-index: een fout op
    // index 0 komt uit de precompile zelf, op index 1 uit ons programma — die
    // twee verwarden kostte me hier een rondte.)
    let f = r.clone().unwrap_err();
    assert!(f.contains("WebAuthnChallengeMismatch") || f.contains("Custom(6002)")
            || f.contains("InvalidPasskeySignature") || f.contains("Custom(6001)"),
        "niet geweigerd wegens challenge-binding, maar om een andere reden: {f}");
    assert!(o.svm.get_account(&auth_rec).is_none(), "er is toch een autorisatie-PDA ontstaan");
}

/// De config is schrijf-één-keer: een tweede `set_wallet_program` moet falen.
/// Zonder deze eigenschap is de vertrouwensroot weer een aanvalsoppervlak.
#[test]
fn tweede_config_zetting_wordt_geweigerd() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("eerste config-zetting moet slagen");
    let f = zet_config(&mut o, FIXTURE_ID).expect_err("tweede config-zetting slaagde");
    assert!(f.contains("Custom(0)") || f.contains("already in use") || f.contains("SystemError")
            || f.contains("Custom(1)") || f.contains("AddressAlreadyInUse"),
        "tweede zetting geweigerd, maar niet door het init-verbod: {f}");
    // De waarde is onveranderd: de wallet onder het echte ID werkt nog.
    let pk = Passkey::fixed(81);
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), SPANKWALLET_ID);
    let mint = ad_harness::vaste_adres(0xC5);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));
    voeg_ontvanger_toe(&mut o, wallet, mint, ad_harness::vaste_adres(0xD5), &pk, true)
        .expect("config zou nog op het echte ID moeten staan");
}

/// De regressie van §42: fix 1 hardcodeerde het echte spankwallet-ID en wierp
/// daarmee onze eigen localnet-fixture af (6011, gemeten). Met de config die naar
/// de fixture wijst moet exact diezelfde fixture-wallet weer werken.
#[test]
fn fixture_wallet_werkt_als_config_naar_de_fixture_wijst() {
    let mut o = opstelling();
    zet_config(&mut o, FIXTURE_ID).expect("config op fixture zetten");

    let pk = Passkey::fixed(80);
    let wallet = echte_wallet_adres(&pk.pk33, &FIXTURE_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), FIXTURE_ID);

    let mint = ad_harness::vaste_adres(0xC4);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));

    voeg_ontvanger_toe(&mut o, wallet, mint, ad_harness::vaste_adres(0xD4), &pk, true)
        .expect("fixture-wallet geweigerd terwijl de config naar de fixture wijst");
}

/// Fail-closed: zonder config-account mag de instructie niet simply werken.
#[test]
fn ontbrekende_config_faalt() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");
    let pk = Passkey::fixed(82);
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), SPANKWALLET_ID);
    let mint = ad_harness::vaste_adres(0xC6);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));

    let f = voeg_ontvanger_toe(&mut o, wallet, mint, ad_harness::vaste_adres(0xD6), &pk, false)
        .expect_err("instructie zonder config-account slaagde");
    assert!(o.svm.get_account(
        &Address::find_program_address(&[b"poison_authorized".as_slice(), mint.as_ref(),
                                         ad_harness::vaste_adres(0xD6).as_ref()], &AD_ID).0
    ).is_none(), "er is een autorisatie-PDA ontstaan zonder config");
    println!("  (fout zonder config: {})", f);
}

/// De aanval die de PDA-controle íets laat doen: het wallet-account heeft een
/// geldige eigenaar (het vertrouwde programma) maar staat op een adres dat niet
/// de PDA is die dat programma voor deze seed_key zou afleiden. Mutatie M1 in
/// STATUS §43 liet zien dat de eerdere aanvalstest hier nooit kwam — hij struikelde
/// al over de eigenaarscheck — dus deze test is de enige die de afleiding dekt.
#[test]
fn wallet_met_goede_eigenaar_maar_verkeerd_adres_wordt_geweigerd() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    let pk = Passkey::fixed(83);
    // Eigenaar klopt, adres is los verzonnen (gelijk aan de seed_key-hash doet er
    // niet toe: het moet de PDA zelf zijn).
    let wallet = ad_harness::vaste_adres(0xB9);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), SPANKWALLET_ID);

    let mint = ad_harness::vaste_adres(0xC7);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));

    let f = voeg_ontvanger_toe(&mut o, wallet, mint, ad_harness::vaste_adres(0xD7), &pk, true)
        .expect_err("wallet op een niet-PDA-adres werd geaccepteerd");
    assert!(f.contains("WalletPdaOnjuist") || f.contains("Custom(6013)"),
        "verwacht 6013 WalletPdaOnjuist, kreeg: {f}");
}

/// Derde tak van de wallet-controle: eigenaar en adres kloppen, maar het veld
/// `wallet_seed_hash` is niet de hash van `seed_key`. Zonder deze test dek je
/// alleen dat de PDA-berekening bestaat, niet dat de input ervan eerlijk is.
#[test]
fn wallet_met_vervalste_seed_hash_wordt_geweigerd() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    let pk = Passkey::fixed(84);
    let mut data = wallet_bytes(&pk.pk33, ACTION_NONCE);
    // [41..73) wallet_seed_hash vervangen door iets anders; de PDA-adres blijft
    // wél uit de echte seed_key afgeleid, dus alleen deze tak kan falen.
    data[41..73].copy_from_slice(&[7u8; 32]);
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, data, SPANKWALLET_ID);

    let mint = ad_harness::vaste_adres(0xC8);
    zet_account(&mut o.svm, mint, vec![0u8; 82],
                address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"));

    let f = voeg_ontvanger_toe(&mut o, wallet, mint, ad_harness::vaste_adres(0xD8), &pk, true)
        .expect_err("wallet met vervalste seed-hash werd geaccepteerd");
    assert!(f.contains("WalletSeedHashOnjuist") || f.contains("Custom(6012)"),
        "verwacht 6012 WalletSeedHashOnjuist, kreeg: {f}");
}
