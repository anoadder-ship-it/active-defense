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
        // config en mint_owner staan ONDERAAN de accounts-struct in
        // instructions.rs — volgorde is geen smaak: Anchor eist declaratievolgorde.
        ix.accounts.push(AccountMeta::new_readonly(config_adres(), false));
    }
    ix.accounts.push(AccountMeta::new_readonly(mint_owner_adres(&mint), false));
    // consumed_action is sinds §64 het allerlaatste veld — na config/mint_owner.
    ix.accounts.push(AccountMeta::new(
        ad_harness::consumed_adres(&AD_ID, &wallet, ad_harness::TAG_ADD,
            &[recipient.as_ref(), &ACTION_NONCE.to_le_bytes(), s.client_data_json.as_slice()]),
        false));
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

    // Mint met echte hook-ruimte: attach heeft een geldig PodMint-account nodig.
    let mint = mint_met_hookruimte(&mut o);

    let recipient = ad_harness::vaste_adres(0xD1);

    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");
    // Sinds stap 3 (STATUS §46) wijst al attach het vervalsde account af: de
    // weigering verschuift dus naar het eerste punt waar hij mogelijk is. De
    // add-route is daarmee dubbel gedekt — via de binding (6014) én via deze
    // controle, maar die 6014-tak is hier niet meer bereikbaar.
    let resultaat = attach(&mut o, wallet, &aanmaker_pk, mint);
    let f = resultaat.expect_err("vervaalsd wallet-account werd GEACCEPT EERD");
    // Specifiek 6011: dit account heeft een FOUT eigendom-programma. De eerdere
    // versie aanvaardde ook 6013, en mutatie M5 (eigenaarscheck weglaten) maakte
    // daardoor geen enkele test rood — de PDA-tak ving hem op. Zie STATUS §43.
    assert!(f.contains("WalletNietVanSpankwallet") || f.contains("Custom(6011)"),
        "verwacht 6011 WalletNietVanSpankwallet bij attach, kreeg: {f}");

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

    let mint = eigen_mint(&mut o, wallet, &pk);
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
    let pk = Passkey::fixed(78);
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    // Echte wallet-PDA: deze test moet falen op de challenge-binding, niet op de
    // nieuwe wallet-autenticiteitscontrole.
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), SPANKWALLET_ID);
    // Mint die door deze wallet is ge-attach: deze test moet falen op de
    // challenge-binding, niet op de mint-koppeling.
    let mint = eigen_mint(&mut o, wallet, &pk);
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
            AccountMeta::new_readonly(mint_owner_adres(&mint), false),
        
            AccountMeta::new(ad_harness::consumed_adres(&AD_ID, &wallet, ad_harness::TAG_ADD, &[recipient.as_ref(), &ACTION_NONCE.to_le_bytes(), s.client_data_json.as_slice()]), false),],
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
    let mint = eigen_mint(&mut o, wallet, &pk);
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

    let mint = eigen_mint(&mut o, wallet, &pk);

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
    let mint = eigen_mint(&mut o, wallet, &pk);

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

    // De weigering komt nu al bij attach (stap 3): dat is het eerste punt waar de
    // adrescontrole loopt, en dus waar ze thuishoort.
    let mint = mint_met_hookruimte(&mut o);
    let f = attach(&mut o, wallet, &pk, mint)
        .expect_err("wallet op een niet-PDA-adres werd geaccepteerd bij attach");
    assert!(f.contains("WalletPdaOnjuist") || f.contains("Custom(6013)"),
        "verwacht 6013 WalletPdaOnjuist bij attach, kreeg: {f}");
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

    let mint = mint_met_hookruimte(&mut o);
    let f = attach(&mut o, wallet, &pk, mint)
        .expect_err("wallet met vervalste seed-hash werd geaccepteerd bij attach");
    assert!(f.contains("WalletSeedHashOnjuist") || f.contains("Custom(6012)"),
        "verwacht 6012 WalletSeedHashOnjuist bij attach, kreeg: {f}");
}

// ===========================================================================
// METINGEN voor fix 2 (STATUS §45). Dit zijn géén asserties op gewenst gedrag;
// het zijn feiten die ik nodig heb vóór ik de semantiek van autorisatie verander.
// ---------------------------------------------------------------------------

const TOKEN_2022_ID: Address = address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// Zet een mint-account neer met ruimte voor de TransferHook-extensie, exact zoals
/// hookflow.rs dat doet (createAccount mét ruimte, InitializeMint2 apart).
fn mint_met_hookruimte(o: &mut Opstelling) -> Address {
    // Zelfde berekening en zelfde createAccount als hookflow.rs — overgenomen,
    // niet nagebouwd (spl_token_2022 + solana_system_interface, geen spl_pod).
    let ruimte = spl_token_2022::extension::ExtensionType::try_calculate_account_len::<
        spl_token_2022::pod::PodMint,
    >(&[spl_token_2022::extension::ExtensionType::TransferHook])
        .expect("mint-lengte");
    let huur = o.svm.minimum_balance_for_rent_exemption(ruimte); // vóór de &mut-leening
    let mint_kp = ad_harness::vaste_toets(11);
    let mint = mint_kp.pubkey();
    stuur(
        &mut o.svm,
        vec![solana_system_interface::instruction::create_account(
            &o.payer.pubkey(),
            &mint,
            huur,
            ruimte as u64,
            &TOKEN_2022_ID,
        )],
        &[&o.payer, &mint_kp],
    )
    .expect("mint-ruimte aanmaken");
    mint
}

/// Een mint die door `wallet` is ge-attach — sinds fix 2 de enige mint waarop die
/// wallet ontvangers mag autoriseren.
fn eigen_mint(o: &mut Opstelling, wallet: Address, pk: &Passkey) -> Address {
    let mint = mint_met_hookruimte(o);
    attach(o, wallet, pk, mint).expect("attach door de eigen wallet");
    mint
}

/// De MintOwner-PDA bij een mint (programma-bron: state.rs MINT_OWNER_SEED).
fn mint_owner_adres(mint: &Address) -> Address {
    let (a, _) = Address::find_program_address(&[b"mint_owner".as_slice(), mint.as_ref()], &AD_ID);
    a
}

/// attach_transfer_hook aanroepen met het gegeven wallet/passkey.
fn attach(o: &mut Opstelling, wallet: Address, pk: &Passkey, mint: Address) -> Result<(), String> {
    let (eaml, _) = Address::find_program_address(
        &[b"extra-account-metas".as_slice(), mint.as_ref()], &AD_ID);

    let mut payload = Vec::new();
    payload.extend_from_slice(&ACTION_NONCE.to_le_bytes());
    payload.extend_from_slice(mint.as_ref());
    let challenge = keccak256(&[AD_ID.as_ref(), wallet.as_ref(), b"attach_transfer_hook", &payload]);
    let s = pk.sign(&challenge);

    let mut data = anchor_disc("attach_transfer_hook").to_vec();
    data.extend_from_slice(&ACTION_NONCE.to_le_bytes());
    data.extend_from_slice(&(s.client_data_json.len() as u32).to_le_bytes());
    data.extend_from_slice(&s.client_data_json);

    let ix = Instruction {
        program_id: AD_ID,
        accounts: vec![
            AccountMeta::new_readonly(wallet, false),
            AccountMeta::new_readonly(AD_ID, false), // passkeys: None
            AccountMeta::new(mint, false),
            AccountMeta::new(eaml, false),
            AccountMeta::new(o.payer.pubkey(), true),
            AccountMeta::new_readonly(TOKEN_2022_ID, false),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
            // mint_owner en config staan onderaan de accounts-struct
            AccountMeta::new(mint_owner_adres(&mint), false),
            AccountMeta::new_readonly(config_adres(), false),
        
            AccountMeta::new(ad_harness::consumed_adres(&AD_ID, &wallet, ad_harness::TAG_ATTACH, &[&ACTION_NONCE.to_le_bytes(), s.client_data_json.as_slice()]), false),],
        data,
    };
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer])
}

/// De TransferHook-extensie uit mint-data halen: (authority, hook_program).
///
/// Layout is GEMETEN, niet aangenomen (zie `meet_hook_authority_en_of_herattach_kan`):
/// de TLV-header staat op offset 166 van een 234-byte mint, type = 14 (NIET 8256),
/// lengte 64, daarna authority(32) en hook-program(32).
///
/// Een blinde byte-scan faalt hier: bij offset 165 lees je `type = 3584` (de halve
/// header) en spring je duizenden bytes door. Daarom verankeren we op het bekende
/// hook-programma en laten we de header zichzelf identificeren — als daar niet
/// type 14 / lengte 64 staat, geeft deze functie `None` in plaats van gokwerk.
fn transfer_hook_uit(mint_data: &[u8]) -> Option<(Address, Address)> {
    const TRANSFER_HOOK_TYPE: u16 = 14;
    let pos = mint_data.windows(32).position(|w| w == AD_ID.as_ref())?;
    if pos < 36 { return None; }
    let h = pos - 36; // header(4) + authority(32) gaan aan het programma vooraf
    let type_ = u16::from_le_bytes([mint_data[h], mint_data[h + 1]]);
    let len = u16::from_le_bytes([mint_data[h + 2], mint_data[h + 3]]) as usize;
    if type_ != TRANSFER_HOOK_TYPE || len < 64 { return None; }
    println!("  TLV-header gevonden op offset {h} (type {type_}, lengte {len})");
    let mut a = [0u8; 32]; a.copy_from_slice(&mint_data[h + 4..h + 36]);
    Some((Address::from(a), AD_ID))
}

#[test]
fn meet_hook_authority_en_of_herattach_kan() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config");

    let pk_a = Passkey::fixed(91);
    let wallet_a = echte_wallet_adres(&pk_a.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_a, wallet_bytes(&pk_a.pk33, ACTION_NONCE), SPANKWALLET_ID);

    let mint = mint_met_hookruimte(&mut o);
    attach(&mut o, wallet_a, &pk_a, mint).expect("attach door wallet A");

    let data = o.svm.get_account(&mint).expect("mint").data;
    // TLV-walk: geen aannames over discriminant-codes, gewoon printen wat er staat.
    println!("  mint-data lengte {}", data.len());
    let mut k = 82usize;
    while k + 4 <= data.len() {
        let t_ = u16::from_le_bytes([data[k], data[k + 1]]);
        let l_ = u16::from_le_bytes([data[k + 2], data[k + 3]]) as usize;
        if t_ == 0 && l_ == 0 { println!("    [{k}] leeg"); break; }
        println!("    [{k}] type={t_} len={l_}");
        if t_ == 0 && l_ == 0 { break; }
        k += 4 + l_;
    }
    // hexdump van het extensiegebied: waar staat werkelijk wat?
    let eerste_niet_nul = data[82..].iter().position(|b| *b != 0).map(|x| x + 82);
    println!("  eerste niet-nul byte na offset 82: {:?}", eerste_niet_nul);
    for r in (82..data.len()).step_by(16) {
        let einde = (r + 16).min(data.len());
        let hex: String = data[r..einde].iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().join(" ");
        if data[r..einde].iter().any(|b| *b != 0) { println!("    {r:4}: {hex}"); }
    }
    if let Some(pos) = data.windows(32).position(|w| w == AD_ID.as_ref()) {
        println!("  AD_ID-bytes gevonden op offset {pos} — authority zou op {} staan", pos - 32);
    }
    let ext = transfer_hook_uit(&data).expect("TransferHook-extensie gevonden na attach");
    println!("  METING 1 — authority in de TransferHook-extensie : {}", ext.0);
    println!("  METING 1 — hook-program                         : {}", ext.1);
    println!("  METING 1 — payer (mint-authoriteit)             : {}", o.payer.pubkey());
    assert_eq!(ext.1, AD_ID, "hook-program zou ons programma moeten zijn");

    // Her-attach door een ANDERE wallet, met dezelfde betaler (mint-authoriteit).
    let pk_b = Passkey::fixed(92);
    let wallet_b = echte_wallet_adres(&pk_b.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_b, wallet_bytes(&pk_b.pk33, ACTION_NONCE), SPANKWALLET_ID);

    match attach(&mut o, wallet_b, &pk_b, mint) {
        Ok(()) => println!("  METING 2 — her-attach door andere wallet: GEWOON TOEGESTAAN"),
        Err(f) => println!("  METING 2 — her-attach door andere wallet: geweigerd ({})", f),
    }
    let ext2 = transfer_hook_uit(&o.svm.get_account(&mint).expect("mint").data).expect("extensie na her-attach");
    println!("  METING 2 — authority na her-attach              : {}", ext2.0);
}

/// Fix 2: een ándere, volstrekt legitieme wallet mag niet autoriseren op een mint
/// waarvan hij de hook niet heeft gezet. Dit is het rest-gat uit STATUS §42 punt 1:
/// fix 1 maakte vervalsen onmogelijk, maar liet open dat elke echte wallet elke
/// mint kon adresseren.
#[test]
fn andere_legitieme_wallet_autoriseert_niet_op_vremde_mint() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    // Eigenaar van de mint: wallet A.
    let pk_a = Passkey::fixed(95);
    let wallet_a = echte_wallet_adres(&pk_a.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_a, wallet_bytes(&pk_a.pk33, ACTION_NONCE), SPANKWALLET_ID);
    let mint = eigen_mint(&mut o, wallet_a, &pk_a);

    // Aanvaller: eigen, geldige wallet B — eigendom, PDA en seed-hash allemaal correct.
    let pk_b = Passkey::fixed(96);
    let wallet_b = echte_wallet_adres(&pk_b.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_b, wallet_bytes(&pk_b.pk33, ACTION_NONCE), SPANKWALLET_ID);

    let recipient = ad_harness::vaste_adres(0xD9);
    let f = voeg_ontvanger_toe(&mut o, wallet_b, mint, recipient, &pk_b, true)
        .expect_err("wallet B mocht niet autoriseren op de mint van wallet A");
    assert!(f.contains("WalletNietDeMintEigenaar") || f.contains("Custom(6014)"),
        "verwacht 6014 WalletNietDeMintEigenaar, kreeg: {f}");
    let (auth_rec, _) = Address::find_program_address(
        &[b"poison_authorized".as_slice(), mint.as_ref(), recipient.as_ref()], &AD_ID);
    assert!(o.svm.get_account(&auth_rec).is_none(), "er is tóch een autorisatie-PDA");

    // Ter vergelijking: wallet A, die de hook zette, kan wél.
    voeg_ontvanger_toe(&mut o, wallet_a, mint, recipient, &pk_a, true)
        .expect("wallet A (eigenaar van de koppeling) werd geweigerd");
}

/// De koppeling is schrijf-één-keer: een tweede attach op dezelfde mint, door
/// welke wallet dan ook, mag de binding niet verleggen.
#[test]
fn koppeling_is_schrijf_een_keer() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    let pk_a = Passkey::fixed(97);
    let wallet_a = echte_wallet_adres(&pk_a.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_a, wallet_bytes(&pk_a.pk33, ACTION_NONCE), SPANKWALLET_ID);
    let mint = eigen_mint(&mut o, wallet_a, &pk_a);

    let pk_b = Passkey::fixed(98);
    let wallet_b = echte_wallet_adres(&pk_b.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_b, wallet_bytes(&pk_b.pk33, ACTION_NONCE), SPANKWALLET_ID);

    let f = attach(&mut o, wallet_b, &pk_b, mint).expect_err("tweede attach op dezelfde mint slaagde");
    println!("  (tweede attach geweigerd: {})", &f[..f.len().min(120)]);

    // En de binding is nog steeds A: B wordt geweigerd, A wordt geaccepteerd.
    let r = voeg_ontvanger_toe(&mut o, wallet_b, mint, ad_harness::vaste_adres(0xDA), &pk_b, true)
        .expect_err("wallet B kreeg alsnog greep op de mint");
    assert!(r.contains("WalletNietDeMintEigenaar") || r.contains("Custom(6014)"), "kreeg: {r}");
    voeg_ontvanger_toe(&mut o, wallet_a, mint, ad_harness::vaste_adres(0xDA), &pk_a, true)
        .expect("wallet A zou nog steeds de gerechtigde zijn");
}

/// Fail-closed ook voor attach: zonder config geen koppeling.
#[test]
fn attach_zonder_config_faalt() {
    let mut o = opstelling();
    // géén zet_config: de config-PDA bestaat niet
    let pk = Passkey::fixed(99);
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE), SPANKWALLET_ID);
    let mint = mint_met_hookruimte(&mut o);

    let f = attach(&mut o, wallet, &pk, mint).expect_err("attach zonder config-account slaagde");
    assert!(o.svm.get_account(&mint_owner_adres(&mint)).is_none(),
        "er is tóch een eigendomsbinding geschreven zonder config");
    println!("  (fout zonder config bij attach: {})", &f[..f.len().min(90)]);
}
