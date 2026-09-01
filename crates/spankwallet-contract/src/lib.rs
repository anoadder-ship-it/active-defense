//! # spankwallet-contract
//!
//! Gedeeld, program-ID-onafhankelijke interface tussen `active-defense` en een
//! spankwallet `WalletAccount` / `PasskeysAccount`.
//!
//! ## Gepingde referentie
//!
//! Elke byte-level constante in deze crate is een spiegel van de gepinde
//! spankwallet-bron op commit `1fb3134` (de B1-B7-referentie - zie
//! `spankwallet-testfixture/README.md`). De spiegel is veld-voor-veld
//! cross-gecheckt tegen `spankwallet-src/programs/spankwallet/src/{state,instructions}.rs`
//! (STATUS.md sectie 29).
//!
//! ## Ontwerpregels
//!
//! - Geen `anchor-lang`, geen vaste program-id. De crate werkt op ruwe
//!   `&[u8]`, zodat dezelfde spec zowel het active-defense-programma, het
//!   (toekomstige) spankwallet-standin-programma én de conformiteits-tests
//!   dient - onafhankelijk van welke program-id waar gedeployd staat.
//! - De challenge-constructie is geparametriseerd op `program_id` omdat elk
//!   programma zijn challenge aan zijn EIGEN id ankert (bewezen: gepinde
//!   spankwallet `build_expected_challenge` gebruikt `crate::ID`; de
//!   active-defense-mirror gebruikt zijn eigen `crate::ID`).

use solana_keccak_hasher::hashv;

// ---------------------------------------------------------------------------
// Caps / gedeelde lengtes
// ---------------------------------------------------------------------------

/// secp256r1 (P-256) gecomprimeerde publieke sleutel: 1 prefix-byte +
/// 32-byte X-coordinaat. (gepinde spankwallet `state.rs`:
/// `PASSKEY_PUBKEY_LEN`)
pub const PASSKEY_PUBKEY_LEN: usize = 33;

/// Max EXTRA passkeys (naast owner_passkey) die een spankwallet tegelijk mag
/// registreren. (gepinde spankwallet `state.rs`:
/// `MAX_ADDITIONAL_PASSKEYS`)
pub const MAX_ADDITIONAL_PASSKEYS: usize = 8;

// ---------------------------------------------------------------------------
// WalletAccount-layout
// (gepinde spankwallet `state.rs` `WalletAccount`, Anchor `#[account]`:
//  8-byte discriminator + velden in declaratievolgorde)
//
//   [0..8)      discriminator
//   [8..41)     seed_key [u8;33]
//   [41..73)    wallet_seed_hash [u8;32]
//   [73..106)   owner_passkey [u8;33]
//   [106..107)  bump u8
//   [107..108)  vault_bump u8
//   [108..116)  created_at i64
//   [116..148)  backup_authority Pubkey [u8;32]
//   [148..149)  recovery_state Option-tag (0=None, 1=Some)
//   [149..190)  (enkel Some) RecoveryState { initiated_at i64,
//                                   new_owner_passkey [u8;33] }  (41 bytes)
//   [...+8)     recovery_timelock_seconds i64  (altijd aanwezig)
//   [...+1)     deposit_authority Option-tag (0=None, 1=Some)
//   [...+32)    (enkel Some) Pubkey [u8;32]
//   [...+8)     action_nonce u64        <- laatste veld dat active-defense leest
//   [...+8)     session_epoch u64       <- in bron; NIET gelezen door
//                                           active-defense
// ---------------------------------------------------------------------------

/// Offset van `owner_passkey` = disc(8) + seed_key(33) + wallet_seed_hash(32).
pub const WALLET_OWNER_PASSKEY_OFFSET: usize = 73;
/// Offset van de `recovery_state` Option-tag.
pub const OFFSET_RECOVERY_STATE_TAG: usize = 148;
/// Grootte van `RecoveryState` = initiated_at(8) + new_owner_passkey(33).
pub const RECOVERY_STATE_LEN: usize = 41;
/// Minimale wallet-datalengte om `action_nonce` te lezen (beide Options None):
/// 148 + recovery-tag(1) + timelock(8) + deposit-tag(1) + nonce(8).
pub const WALLET_MIN_LEN: usize = 148 + 1 + 8 + 1 + 8;

// ---------------------------------------------------------------------------
// PasskeysAccount-layout
// (gepinde spankwallet `state.rs` `PasskeysAccount`)
//
//   [0..8)   discriminator
//   [8..40)  wallet Pubkey [u8;32]
//   [40..41) bump u8
//   [41..42) owner_passkey_revoked bool
//   [42..43) count u8
//   [43..)   additional_passkeys [[u8;33]; MAX_ADDITIONAL_PASSKEYS]
// ---------------------------------------------------------------------------

pub const PASSKEYS_OWNER_REVOKED_OFFSET: usize = 41;
pub const PASSKEYS_COUNT_OFFSET: usize = 42;
pub const PASSKEYS_ADDITIONAL_OFFSET: usize = 43;

// ---------------------------------------------------------------------------
// PDA-seeds
// (gepinde spankwallet `instructions.rs`)
//
//   wallet PDA   = [b"wallet",   wallet_seed_hash]   (wallet_seed_hash = SHA-256(seed_key))
//   passkeys PDA = [b"passkeys", wallet PDA]
//   vault PDA    = [b"vault",    wallet PDA]
// ---------------------------------------------------------------------------

pub const WALLET_PDA_SEED: &[u8] = b"wallet";
pub const PASSKEYS_PDA_SEED: &[u8] = b"passkeys";
pub const VAULT_PDA_SEED: &[u8] = b"vault";

// ---------------------------------------------------------------------------
// Fouten
// ---------------------------------------------------------------------------

/// Fouten bij het lezen van een spankwallet-account-layout.
#[derive(Debug, PartialEq, Eq)]
pub enum ContractError {
    /// Wallet-data korter dan de minimale leesbare lengte.
    WalletTooShort,
    /// Passkeys-data korter dan de gevraagde slot.
    PasskeysTooShort,
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/// `owner_passkey` (33-byte gecomprimeerde secp256r1) uit wallet-data.
pub fn read_owner_passkey(wallet_data: &[u8]) -> Result<[u8; PASSKEY_PUBKEY_LEN], ContractError> {
    let end = WALLET_OWNER_PASSKEY_OFFSET + PASSKEY_PUBKEY_LEN;
    let slice = wallet_data
        .get(WALLET_OWNER_PASSKEY_OFFSET..end)
        .ok_or(ContractError::WalletTooShort)?;
    Ok(slice.try_into().expect("lengte vooraf gecheckt"))
}

/// `action_nonce` (u64 LE) uit wallet-data op zijn VARIABELE offset - de
/// offset hangt af van de twee `Option`-velden erboven (`recovery_state`,
/// `deposit_authority`).
pub fn read_wallet_action_nonce(wallet_data: &[u8]) -> Result<u64, ContractError> {
    if wallet_data.len() < WALLET_MIN_LEN {
        return Err(ContractError::WalletTooShort);
    }
    let mut offset = OFFSET_RECOVERY_STATE_TAG;
    let recovery_state_tag = wallet_data[offset];
    offset += 1;
    if recovery_state_tag == 1 {
        offset += RECOVERY_STATE_LEN;
    }
    offset += 8; // recovery_timelock_seconds: i64, altijd aanwezig
    let deposit_authority_tag = wallet_data[offset];
    offset += 1;
    if deposit_authority_tag == 1 {
        offset += 32;
    }
    let bytes: [u8; 8] = wallet_data
        .get(offset..offset + 8)
        .ok_or(ContractError::WalletTooShort)?
        .try_into()
        .expect("lengte vooraf gecheckt");
    Ok(u64::from_le_bytes(bytes))
}

/// Aantal gevulde `additional_passkeys`-slots.
pub fn read_passkey_count(passkeys_data: &[u8]) -> Result<u8, ContractError> {
    if passkeys_data.len() < PASSKEYS_COUNT_OFFSET + 1 {
        return Err(ContractError::PasskeysTooShort);
    }
    Ok(passkeys_data[PASSKEYS_COUNT_OFFSET])
}

/// De `index`-e `additional_passkey` (0-based, aaneengesloten vanaf 0).
pub fn read_passkey_at(passkeys_data: &[u8], index: usize) -> Result<[u8; PASSKEY_PUBKEY_LEN], ContractError> {
    let start = PASSKEYS_ADDITIONAL_OFFSET + index * PASSKEY_PUBKEY_LEN;
    let end = start + PASSKEY_PUBKEY_LEN;
    let slice = passkeys_data.get(start..end).ok_or(ContractError::PasskeysTooShort)?;
    Ok(slice.try_into().expect("lengte vooraf gecheckt"))
}

// ---------------------------------------------------------------------------
// Seed- + challenge-helpers
// ---------------------------------------------------------------------------

/// SHA-256 van de 33-byte `seed_key` -> de 32-byte `wallet_seed_hash` die
/// als wallet-PDA-seed dient. (gepinde spankwallet `instructions.rs`
/// `hash_seed_key`.)
pub fn hash_seed_key(seed_key: &[u8; PASSKEY_PUBKEY_LEN]) -> [u8; 32] {
    let digest = solana_sha256_hasher::hash(seed_key);
    let mut out = [0u8; 32];
    out.copy_from_slice(digest.as_ref());
    out
}

/// Vaste-breedte 9-byte encoding van `Option<i64>` voor de challenge-payload:
/// 1 tag-byte (0=None, 1=Some) + 8 waarde-bytes LE (nul-gevuld bij None).
/// Vaste breedte opzet - dit bindt in de challenge, het is GEEN
/// account-opslag. (gepinde spankwallet `instructions.rs`
/// `encode_optional_i64`.)
pub fn encode_optional_i64(value: Option<i64>) -> [u8; 9] {
    let mut out = [0u8; 9];
    if let Some(v) = value {
        out[0] = 1;
        out[1..9].copy_from_slice(&v.to_le_bytes());
    }
    out
}

/// Exacte tegenhanger van spankwallet's `build_expected_challenge`:
/// Keccak-256 over `program_id || wallet || domain || payload`.
///
/// Geparametriseerd op `program_id` omdat elk programma de challenge aan zijn
/// EIGEN id ankert: active-defense tekent tegen een challenge met het
/// active-defense-id, spankwallet met het spankwallet-id.
pub fn build_expected_challenge(
    program_id: &[u8],
    wallet: &[u8],
    domain: &[u8],
    payload: &[u8],
) -> [u8; 32] {
    let digest = hashv(&[program_id, wallet, domain, payload]);
    let mut out = [0u8; 32];
    out.copy_from_slice(digest.as_ref());
    out
}

// ---------------------------------------------------------------------------
// Conformiteits- / consistentie-tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Beweert dat de layout-constanten intern consistent zijn met de
    /// gedocumenteerde veld-offsets (regressie-wacht: een typefout in één
    /// constante breekt de sommenketen).
    #[test]
    fn wallet_layout_constant_chain() {
        assert_eq!(WALLET_OWNER_PASSKEY_OFFSET, 8 + 33 + 32);
        assert_eq!(OFFSET_RECOVERY_STATE_TAG, 73 + 33 + 1 + 1 + 8 + 32);
        assert_eq!(RECOVERY_STATE_LEN, 8 + 33);
        assert_eq!(WALLET_MIN_LEN, 148 + 1 + 8 + 1 + 8);
    }

    #[test]
    fn passkeys_layout_constant_chain() {
        assert_eq!(PASSKEYS_OWNER_REVOKED_OFFSET, 8 + 32 + 1);
        assert_eq!(PASSKEYS_COUNT_OFFSET, 41 + 1);
        assert_eq!(PASSKEYS_ADDITIONAL_OFFSET, 42 + 1);
    }

    fn synth_wallet(nonce: u64, recovery_some: bool, deposit_some: bool) -> Vec<u8> {
        let mut out = vec![0u8; 148]; // vaste prefix t/m backup_authority
        out[73] = 0x02; // owner_passkey-prefix (geldig)
        out.push(if recovery_some { 1 } else { 0 }); // recovery_state-tag
        if recovery_some {
            out.extend_from_slice(&0i64.to_le_bytes()); // initiated_at
            let mut nkp = [0u8; 33];
            nkp[0] = 0x02; // new_owner_passkey (geldig prefix)
            out.extend_from_slice(&nkp);
        }
        out.extend_from_slice(&259_200i64.to_le_bytes()); // recovery_timelock_seconds
        out.push(if deposit_some { 1 } else { 0 }); // deposit_authority-tag
        if deposit_some {
            out.extend_from_slice(&[7u8; 32]); // Pubkey
        }
        out.extend_from_slice(&nonce.to_le_bytes()); // action_nonce
        out.extend_from_slice(&0u64.to_le_bytes()); // session_epoch
        out
    }

    #[test]
    fn read_action_nonce_none_none() {
        let w = synth_wallet(0xDEAD_BEEF, false, false);
        assert_eq!(read_wallet_action_nonce(&w), Ok(0xDEAD_BEEF));
        assert_eq!(w.len(), 174); // 148 + 1 + 8 + 1 + 8 + 8
    }

    #[test]
    fn read_action_nonce_recovery_some() {
        assert_eq!(read_wallet_action_nonce(&synth_wallet(7, true, false)), Ok(7));
    }

    #[test]
    fn read_action_nonce_deposit_some() {
        assert_eq!(read_wallet_action_nonce(&synth_wallet(9, false, true)), Ok(9));
    }

    #[test]
    fn read_action_nonce_both_some() {
        assert_eq!(read_wallet_action_nonce(&synth_wallet(42, true, true)), Ok(42));
    }

    #[test]
    fn read_action_nonce_too_short() {
        let w = vec![0u8; WALLET_MIN_LEN - 1];
        assert_eq!(read_wallet_action_nonce(&w), Err(ContractError::WalletTooShort));
    }

    #[test]
    fn read_owner_passkey_roundtrip() {
        let pk = read_owner_passkey(&synth_wallet(1, false, false)).unwrap();
        assert_eq!(pk[0], 0x02);
        assert_eq!(pk.len(), 33);
    }

    fn synth_passkeys(count: usize, pk_byte: u8) -> Vec<u8> {
        let mut d = vec![0u8; PASSKEYS_ADDITIONAL_OFFSET];
        d[PASSKEYS_COUNT_OFFSET] = count as u8;
        for i in 0..MAX_ADDITIONAL_PASSKEYS {
            let b: u8 = if i < count { pk_byte } else { 0 };
            for _ in 0..PASSKEY_PUBKEY_LEN {
                d.push(b);
            }
        }
        d
    }

    #[test]
    fn read_passkey_count_roundtrip() {
        assert_eq!(read_passkey_count(&synth_passkeys(3, 0x02)), Ok(3));
    }

    #[test]
    fn read_passkey_at_roundtrip() {
        let p = synth_passkeys(2, 0x03);
        assert_eq!(read_passkey_at(&p, 0).unwrap()[0], 0x03);
        assert_eq!(read_passkey_at(&p, 1).unwrap()[0], 0x03);
        assert_eq!(read_passkey_at(&p, 2).unwrap()[0], 0); // buiten count: nul
    }

    #[test]
    fn encode_optional_i64_none() {
        assert_eq!(encode_optional_i64(None), [0u8; 9]);
    }

    #[test]
    fn encode_optional_i64_some() {
        assert_eq!(encode_optional_i64(Some(5)), [1, 5, 0, 0, 0, 0, 0, 0, 0]);
    }

    /// Bekend-antwoord: challenge van vier lege inputs == keccak256(leeg).
    #[test]
    fn build_expected_challenge_known_answer() {
        let c = build_expected_challenge(&[], &[], &[], &[]);
        assert_eq!(
            hex_of(&c),
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        );
    }

    fn hex_of(b: &[u8]) -> String {
        let mut s = String::with_capacity(b.len() * 2);
        for x in b {
            s.push_str(&format!("{:02x}", x));
        }
        s
    }
}
