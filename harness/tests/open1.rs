//! OPEN #1 — volgorde van claimen (handoff 2026-09-25, §46).
//!
//! De vraag: kan wallet Y (legitieme spankwallet-wallet, eigen handtekening) de
//! AD-koppeling op X z'n mint claimen VÓÓRDAT X zelf done is? En post-establish?
//!
//! Post-establish is al gedekt door `accountmodel::koppeling_is_schrijf_een_keer`
//! (tweede attach faalt). Dit bestand meet de ANDERE volgorde: Y first, X second.
//! Fix 2 bindt via `init` op MintOwner[mint] — init is eerste-wins. Als Y die
//! eerste-wins haalt op een mint die nog niet van hem is, is de koppeling dán van Y?
//! En kan Y dan ook autoriseren (de 6014-poort gaat open voor de aanvrager)?
//!
//! Helpers zijn letterlijk overgenomen uit tests/accountmodel.rs (544-578, 226-247,
//! 139-154): bewezen-goede constructies kopiëren, niet herbouwen.

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
const SPANKWALLET_ID: Address = address!("9ma6vQVA71yUD6jqvyMuYXnMBYGoE7u9bTUbBYEMGBK9");
const TOKEN_2022_ID: Address = address!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
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
    fn sign(&self, challenge: &[u8; 32]) -> Signed {
        let client_data_json = format!(
            "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"https://harness.local\",\"crossOrigin\":false}}",
            base64url(challenge)
        ).into_bytes();
        let cdh = sha2::Sha256::digest(&client_data_json);
        let mut authenticator_data = vec![0u8; 37];
        authenticator_data[32] = 0x05; // UP | UV
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
    for v in [sig_off as u16, NO_OWN, pk_off as u16, NO_OWN, msg_off as u16, bericht.len() as u16, NO_OWN] {
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
        Err(FailedTransactionMetadata { err, meta }) => Err(format!("{err:?} | {}", meta.logs.join(" / "))),
    }
}

fn config_adres() -> Address {
    let (a, _) = Address::find_program_address(&[b"wallet_config".as_slice()], &AD_ID);
    a
}

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

fn echte_wallet_adres(pk33: &[u8; 33], vertrouwd: &Address) -> Address {
    let hash = sha2::Sha256::digest(pk33);
    let (a, _) = Address::find_program_address(&[b"wallet".as_slice(), &hash], vertrouwd);
    a
}

fn zet_account(svm: &mut LiteSVM, a: Address, data: Vec<u8>, owner: Address) {
    let acc = solana_account::Account {
        lamports: svm.minimum_balance_for_rent_exemption(data.len()),
        data, owner, executable: false, rent_epoch: 0,
    };
    svm.set_account(a, acc).expect("account zetten");
}

fn mint_met_hookruimte(o: &mut Opstelling) -> Address {
    let ruimte = spl_token_2022::extension::ExtensionType::try_calculate_account_len::<
        spl_token_2022::pod::PodMint,
    >(&[spl_token_2022::extension::ExtensionType::TransferHook])
        .expect("mint-lengte");
    let huur = o.svm.minimum_balance_for_rent_exemption(ruimte);
    let mint_kp = ad_harness::vaste_toets(11);
    let mint = mint_kp.pubkey();
    stuur(
        &mut o.svm,
        vec![solana_system_interface::instruction::create_account(
            &o.payer.pubkey(), &mint, huur, ruimte as u64, &TOKEN_2022_ID,
        )],
        &[&o.payer, &mint_kp],
    ).expect("mint-ruimte aanmaken");
    mint
}

fn mint_owner_adres(mint: &Address) -> Address {
    let (a, _) = Address::find_program_address(&[b"mint_owner".as_slice(), mint.as_ref()], &AD_ID);
    a
}

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
            AccountMeta::new_readonly(AD_ID, false),
            AccountMeta::new(mint, false),
            AccountMeta::new(eaml, false),
            AccountMeta::new(o.payer.pubkey(), true),
            AccountMeta::new_readonly(TOKEN_2022_ID, false),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
            AccountMeta::new(mint_owner_adres(&mint), false),
            AccountMeta::new_readonly(config_adres(), false),
        ],
        data,
    };
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer])
}

fn voeg_ontvanger_toe(
    o: &mut Opstelling, wallet: Address, mint: Address, recipient: Address, pk: &Passkey,
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
    let ix = Instruction {
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
        ],
        data,
    };
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer])
}

/// MintOwner uitlezen: (mint, wallet) uit de 73-byte account-data.
/// Layout uit state.rs: disc(8) + mint(32) + wallet(32) + bump(1).
fn mint_owner_uit(data: &[u8]) -> Option<(Address, Address)> {
    if data.len() != 73 { return None; }
    let mut m = [0u8; 32]; m.copy_from_slice(&data[8..40]);
    let mut w = [0u8; 32]; w.copy_from_slice(&data[40..72]);
    Some((Address::from(m), Address::from(w)))
}

/// OPEN #1 — Y claimt de koppeling vóór X. Meet het resultaat, geen aanname.
#[test]
fn open1_y_claimt_koppeling_voor_x() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config zetten");

    // X: de wallet die de mint "van hem" zou moeten zijn (hij betaalde de ruimte).
    let pk_x = Passkey::fixed(101);
    let wallet_x = echte_wallet_adres(&pk_x.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_x, wallet_bytes(&pk_x.pk33, ACTION_NONCE), SPANKWALLET_ID);

    // Y: aanvaller, eigen volkomen legitieme wallet.
    let pk_y = Passkey::fixed(102);
    let wallet_y = echte_wallet_adres(&pk_y.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet_y, wallet_bytes(&pk_y.pk33, ACTION_NONCE), SPANKWALLET_ID);

    // Verse mint met hook-ruimte, door de payer (X's kant) aangemaakt, NOG niet ge-attach.
    let mint = mint_met_hookruimte(&mut o);

    // S1 — Y attach vóór X.
    attach(&mut o, wallet_y, &pk_y, mint).expect("S1: Y's vooraf-attach werd geweigerd");
    println!("  S1 — Y attach vóór X: TOEGESTAAN");

    // Binding uitlezen: wie staat er in MintOwner?
    let mo = o.svm.get_account(&mint_owner_adres(&mint)).expect("MintOwner na Y-attach");
    let (mo_mint, mo_wallet) = mint_owner_uit(&mo.data).expect("MintOwner-layout 73 byte");
    println!("  METING — MintOwner.mint   : {mo_mint}");
    println!("  METING — MintOwner.wallet : {mo_wallet}");
    assert_eq!(mo_mint, mint, "MintOwner.mint zou de geminte moeten zijn");
    assert_eq!(mo_wallet, wallet_y, "koppeling zou bij Y staan (eerste-wins)");

    // S2 — X probeerna; init is eerste-wins, dus dit MOET falen.
    let f2 = attach(&mut o, wallet_x, &pk_x, mint)
        .expect_err("S2: X attach ná Y werd TOEGESTAAN");
    println!("  S2 — X attach ná Y: geweigerd ({})", &f2[..f2.len().min(140)]);

    // S3 — Y kan autoriseren op deze mint (de binding geeft recht).
    voeg_ontvanger_toe(&mut o, wallet_y, mint, ad_harness::vaste_adres(0xE1), &pk_y)
        .expect("S3: Y kon niet autoriseren terwijl MintOwner naar Y wijst");
    println!("  S3 — Y authoriseert ontvanger op X' mint: TOEGESTAAN");

    // S4 — X wordt geweigerd met 6014 op z'n eigen munt.
    let f4 = voeg_ontvanger_toe(&mut o, wallet_x, mint, ad_harness::vaste_adres(0xE2), &pk_x)
        .expect_err("S4: X mocht autoriseren op z'n eigen munt");
    assert!(f4.contains("WalletNietDeMintEigenaar") || f4.contains("Custom(6014)"), "S4: {f4}");
    println!("  S4 — X authoriseert op eigen munt: geweigerd (6014)");

    println!("\n  CONCLUSIE OPEN#1: de koppeling is eerste-wins; wie als eerste attach");
    println!("  bezet de mint voor alle latere autorisatie. Tussen mint-aanmaak en");
    println!("  attach van X zit dus een venster waarin Y de mint claimt.");
}
