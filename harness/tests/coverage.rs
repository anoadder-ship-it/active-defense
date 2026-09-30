//! Dekking van drie paden die tot nu toe ONBESCHREVEN waren (STATUS §57).
//!
//! 1. REPLAY — het programma vergelijkt `client_action_nonce` met de nonce in de
//!    WalletAccount, maar verhoogt hem zelf niet (active-defense mag SpankWallet's
//!    account niet schrijven). Is een onderschepte, getekende instructie dus opnieuw
//!    bruikbaar? Gemeten: (a) valse nonce, (b) nonce na een geslaagde AD-instructie,
//!    (c) identiek opnieuw inzenden.
//! 2. FAIL-CLOSED ZONDER CONFIG — sinds stap 3 eisen mark/unmark de vertrouwensconfig.
//!    Draait het programma werkelijk dicht als die config ontbreekt?
//! 3. PLAFOND — MaliciousAddressesAccount is vast (32 adressen). Wat doet de 33e?
//!
//! Helpers zijn gekopieerd uit tests/open1.rs (zelfde reden als daar: bewezen-goede
//! constructies kopiëren, niet herbouwen).

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
const NONCE: u64 = 1;

fn anchor_disc(ix: &str) -> [u8; 8] {
    let h = sha2::Sha256::digest(format!("global:{ix}").as_bytes());
    let mut d = [0u8; 8]; d.copy_from_slice(&h[..8]); d
}
fn keccak256(delen: &[&[u8]]) -> [u8; 32] {
    let mut h = Keccak256::new();
    for d in delen { h.update(d); }
    let out = h.finalize();
    let mut r = [0u8; 32]; r.copy_from_slice(&out); r
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

struct Passkey { sk: SigningKey, pk33: [u8; 33] }
struct Signed { client_data_json: Vec<u8>, signed_message: Vec<u8>, sig64: [u8; 64] }

impl Passkey {
    fn fixed(seed: u8) -> Self {
        let mut b = [0u8; 32]; b[0] = seed; b[31] = 1;
        let sk = SigningKey::from_bytes(&b.into()).expect("vaste seed");
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
        authenticator_data[32] = 0x05;
        let mut signed_message = authenticator_data;
        signed_message.extend_from_slice(&cdh);
        let sig: p256::ecdsa::Signature = self.sk.sign(&signed_message);
        let sig = sig.normalize_s().unwrap_or(sig);
        let mut sig64 = [0u8; 64]; sig64.copy_from_slice(&sig.to_bytes());
        Signed { client_data_json, signed_message, sig64 }
    }
}

fn secp256r1_ix(pk33: &[u8; 33], bericht: &[u8], sig64: &[u8; 64]) -> Instruction {
    const NO_OWN: u16 = u16::MAX;
    let data_start = 2 + 14usize;
    let sig_off = data_start; let pk_off = sig_off + 64; let msg_off = pk_off + 33;
    let mut data = vec![0u8; msg_off + bericht.len()];
    data[0] = 1; data[1] = 0;
    let mut o = 2usize;
    for v in [sig_off as u16, NO_OWN, pk_off as u16, NO_OWN, msg_off as u16, bericht.len() as u16, NO_OWN] {
        data[o..o + 2].copy_from_slice(&v.to_le_bytes()); o += 2;
    }
    data[sig_off..sig_off + 64].copy_from_slice(sig64);
    data[pk_off..pk_off + 33].copy_from_slice(pk33);
    data[msg_off..].copy_from_slice(bericht);
    Instruction { program_id: address!("Secp256r1SigVerify1111111111111111111111111"), accounts: vec![], data }
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
    Address::find_program_address(&[b"wallet_config".as_slice()], &AD_ID).0
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
    Address::find_program_address(&[b"wallet".as_slice(), sha2::Sha256::digest(pk33).as_slice()], vertrouwd).0
}
fn zet_account(svm: &mut LiteSVM, a: Address, data: Vec<u8>, owner: Address) {
    let acc = solana_account::Account {
        lamports: svm.minimum_balance_for_rent_exemption(data.len()),
        data, owner, executable: false, rent_epoch: 0,
    };
    svm.set_account(a, acc).expect("account zetten");
}
fn malicious_adres(wallet: &Address) -> Address {
    Address::find_program_address(&[b"malicious".as_slice(), wallet.as_ref()], &AD_ID).0
}

/** Eén getekende mark_malicious-instructie, als klaar-om-te-sturen paar. */
fn mark_ix(o: &Opstelling, wallet: Address, pk: &Passkey, adres: Address, nonce: u64) -> (Instruction, Signed) {
    let mut payload = Vec::new();
    payload.extend_from_slice(&nonce.to_le_bytes());
    payload.extend_from_slice(adres.as_ref());
    let challenge = keccak256(&[AD_ID.as_ref(), wallet.as_ref(), b"mark_malicious", &payload]);
    let s = pk.sign(&challenge);
    let mut data = anchor_disc("mark_malicious").to_vec();
    data.extend_from_slice(adres.as_ref());
    data.extend_from_slice(&nonce.to_le_bytes());
    data.extend_from_slice(&(s.client_data_json.len() as u32).to_le_bytes());
    data.extend_from_slice(&s.client_data_json);
    let ix = Instruction {
        program_id: AD_ID,
        accounts: vec![
            AccountMeta::new_readonly(wallet, false),
            AccountMeta::new_readonly(AD_ID, false),
            AccountMeta::new(malicious_adres(&wallet), false),
            AccountMeta::new(o.payer.pubkey(), true),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
            AccountMeta::new_readonly(config_adres(), false),
        ],
        data,
    };
    (ix, s)
}
fn stuur_mark(o: &mut Opstelling, wallet: Address, pk: &Passkey, adres: Address, nonce: u64) -> Result<(), String> {
    let (ix, s) = mark_ix(o, wallet, pk, adres, nonce);
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer])
}
/** Eén unmark_malicious (zelfde accountlijst en data-vorm als mark). */
fn unmark(o: &mut Opstelling, wallet: Address, pk: &Passkey, adres: Address, nonce: u64) -> Result<(), String> {
    let mut payload = Vec::new();
    payload.extend_from_slice(&nonce.to_le_bytes());
    payload.extend_from_slice(adres.as_ref());
    let challenge = keccak256(&[AD_ID.as_ref(), wallet.as_ref(), b"unmark_malicious", &payload]);
    let s = pk.sign(&challenge);
    let mut data = anchor_disc("unmark_malicious").to_vec();
    data.extend_from_slice(adres.as_ref());
    data.extend_from_slice(&nonce.to_le_bytes());
    data.extend_from_slice(&(s.client_data_json.len() as u32).to_le_bytes());
    data.extend_from_slice(&s.client_data_json);
    // accountlijst overgenomen uit client/src buildUnmarkMaliciousIx: géén payer,
    // wel de instructions-sysvar vóór de config. (Een extra payer-account schuift
    // alles op en geeft AccountOwnedByWrongProgram op config — gemeten.)
    let ix = Instruction {
        program_id: AD_ID,
        accounts: vec![
            AccountMeta::new_readonly(wallet, false),
            AccountMeta::new_readonly(AD_ID, false),
            AccountMeta::new(malicious_adres(&wallet), false),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(config_adres(), false),
        ],
        data,
    };
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer])
}

/** LiteSVM warpt de slot maar NICHT de blockhash: een identieke transactie blijft
 *  `AlreadyProcessed` — dat is dedup op signatuur, geen programmabeleid. Een replay
 *  in het echt is dezelfde AD-instructie in een ANDERE omhullende transactie; dat
 *  nabouwen door een neutrale nul-transfer mee te sturen verandert de transactie-
 *  signatuur terwijl de instructiebytes onder de loep exact gelijk blijven. */
fn vul_aan_met_ruis(ixs: Vec<Instruction>, payer: &Address, ruis_bestemming: &Address) -> Vec<Instruction> {
    let mut v = vec![solana_system_interface::instruction::transfer(payer, ruis_bestemming, 0)];
    v.extend(ixs);
    v
}

/** LiteSVM heeft geen slot-getter; warpen kan alleen vooruit, dus eigen telwerk. */
fn steek_slot(svm: &mut LiteSVM, doel: u64) {
    svm.warp_to_slot(doel);
}

fn count_malicious(svm: &LiteSVM, wallet: &Address) -> Option<usize> {
    let a = svm.get_account(&malicious_adres(wallet))?;
    if a.data.len() < 42 { return None; }
    Some(a.data[41] as usize)   // disc(8)+wallet(32)+bump(1)+count(1)
}

/// M1 — replay: wat doet de nonce-wacht werkelijk?
#[test]
fn m1_replay_en_nonce() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config");
    let pk = Passkey::fixed(0xA1);
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, NONCE), SPANKWALLET_ID);
    let adres = ad_harness::vaste_adres(0x51);

    // (a) valse nonce → moet falen
    let fout = stuur_mark(&mut o, wallet, &pk, adres, NONCE + 1)
        .expect_err("M1a: instructie met valse nonce werd TOEGESTAAN");
    println!("  M1a valse nonce            : geweigerd — {}", &fout[..fout.len().min(120)]);

    // (b) juiste nonce → slaagt. Eén keer tekenen en dat paar bewaren: M1c en M1d
    // zenden letterlijk dezelfde bytes, anders meten we geen replay maar iets nieuws.
    let (ix_bewaard, s_bewaard) = mark_ix(&o, wallet, &pk, adres, NONCE);
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s_bewaard.signed_message, &s_bewaard.sig64), ix_bewaard.clone()], &[&o.payer])
        .expect("M1b: mark met juiste nonce faalde");
    let na = o.svm.get_account(&wallet).expect("wallet").data;
    let nonce_na = u64::from_le_bytes(na[158..166].try_into().unwrap());
    println!("  M1b nonce in wallet voor 1 : {NONCE} · na AD-instructie: {nonce_na}");

    // (c) zelfde instructiebytes in een ANDERE omhullende transactie. De eerste
    // versie van deze test stuurde gewoon opnieuw en zag `AlreadyProcessed`: dat is
    // LiteSVM's dedup op signatuur (warpen verandert hier de blockhash niet), dus die
    // meting ging over de VM en niet over het programma.
    steek_slot(&mut o.svm, 10);
    let ruis = ad_harness::vaste_adres(0x01);
    let tweede = stuur(&mut o.svm,
        vul_aan_met_ruis(vec![secp256r1_ix(&pk.pk33, &s_bewaard.signed_message, &s_bewaard.sig64), ix_bewaard.clone()], &o.payer.pubkey(), &ruis),
        &[&o.payer]);
    match &tweede {
        Ok(()) => println!("  M1c zelfde bytes, andere transactie: TOEGESTAAN"),
        Err(f) => println!("  M1c zelfde bytes, andere transactie: geweigerd — {}", &f[..f.len().min(110)]),
    }
    println!("  METING count malicious     : {:?}", count_malicious(&o.svm, &wallet));

    // (d) de scherpe variant: zet de staat terug en zend dezelfde onderschepte bytes
    // opnieuw. De nonce is nooit verhoogd (M1b), dus als de structurele botsing weg
    // is, moet deze handtekening weer geldig zijn. Meet dit, stel het niet voor.
    unmark(&mut o, wallet, &pk, adres, NONCE).expect("M1d: unmark faalde");
    println!("  M1d na unmark              : count = {:?}", count_malicious(&o.svm, &wallet));
    steek_slot(&mut o.svm, 20);
    // exact hetzelfde bewaarde paar als bij M1b/M1c, in een andere omhullende transactie
    let herhaling = stuur(&mut o.svm,
        vul_aan_met_ruis(vec![secp256r1_ix(&pk.pk33, &s_bewaard.signed_message, &s_bewaard.sig64), ix_bewaard.clone()], &o.payer.pubkey(), &ad_harness::vaste_adres(0x02)),
        &[&o.payer]);
    match &herhaling {
        Ok(()) => println!("  M1d oude handtekening na terugzetten staat: TOEGESTAAN — vers is hier niet afgedwongen"),
        Err(f) => println!("  M1d oude handtekening na terugzetten staat: geweigerd — {}", &f[..f.len().min(110)]),
    }
}

/// M2 — fail-closed: zonder vertrouwensconfig mag niets muteren.
#[test]
fn m2_zonder_config_faalt_alles() {
    let mut o = opstelling();          // expres GEEN zet_config
    let pk = Passkey::fixed(0xA2);
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, NONCE), SPANKWALLET_ID);

    let fout = stuur_mark(&mut o, wallet, &pk, ad_harness::vaste_adres(0x52), NONCE)
        .expect_err("M2: mark_malicious zonder config werd TOEGESTAAN");
    println!("  M2 mark zonder config      : geweigerd — {}", &fout[..fout.len().min(140)]);
    assert!(count_malicious(&o.svm, &wallet).is_none(), "M2: er ontstond tóch een MaliciousAddresses-account");
    println!("  METING malicious-account   : bestaat niet (fail-closed)");
}

/// M3 — plafond van het vaste MaliciousAddressesAccount.
#[test]
fn m3_plafond_32_adressen() {
    let mut o = opstelling();
    zet_config(&mut o, SPANKWALLET_ID).expect("config");
    let pk = Passkey::fixed(0xA3);
    let wallet = echte_wallet_adres(&pk.pk33, &SPANKWALLET_ID);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, NONCE), SPANKWALLET_ID);

    for i in 0..32u8 {
        let a = ad_harness::vaste_adres(0x60 + i);
        stuur_mark(&mut o, wallet, &pk, a, NONCE)
            .unwrap_or_else(|f| panic!("M3: adres {} van de 32 werd geweigerd: {}", i + 1, &f[..f.len().min(120)]));
    }
    println!("  M3 na 32 markeringen       : count = {:?}", count_malicious(&o.svm, &wallet));

    let drieendertigste = stuur_mark(&mut o, wallet, &pk, ad_harness::vaste_adres(0x81), NONCE);
    match drieendertigste {
        Ok(()) => panic!("M3: het 33e adres werd TOEGESTAAN — het plafond bestaat niet of is geen 32"),
        Err(f) => println!("  M3 33e adres               : geweigerd — {}", &f[..f.len().min(140)]),
    }
    assert_eq!(count_malicious(&o.svm, &wallet), Some(32), "M3: count zou 32 moeten zijn");
}
