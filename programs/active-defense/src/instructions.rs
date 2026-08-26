use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::TokenAccount;
use solana_instructions_sysvar::{
    load_current_index_checked, load_instruction_at_checked, ID as IX_SYSVAR_ID,
};
use solana_keccak_hasher::hashv;

use crate::errors::ActiveDefenseError;
use crate::state::*;

pub const SECP256R1_PROGRAM_ID: Pubkey = pubkey!("Secp256r1SigVerify1111111111111111111111111");
pub const PASSKEY_PUBKEY_LEN: usize = 33;

/// Token-2022 program ID.
pub const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

// --- WalletAccount layout constants (spankwallet) ---
const WALLET_OWNER_PASSKEY_OFFSET: usize = 73; // 8 + 33 + 32
const OFFSET_RECOVERY_STATE_TAG: usize = 148;
const RECOVERY_STATE_LEN: usize = 41; // initiated_at(8) + new_owner_passkey(33)
const WALLET_MIN_LEN: usize = 148 + 1 + 8 + 1 + 8; // beide Option None

// --- PasskeysAccount layout constants (spankwallet) ---
const PASSKEYS_OWNER_REVOKED_OFFSET: usize = 41; // 8 + 32 + 1
const PASSKEYS_COUNT_OFFSET: usize = 42;
const PASSKEYS_ADDITIONAL_OFFSET: usize = 43;

// --- Helpers (zelfde patroon als spankwallet) ---

fn sha256_32(data: &[u8]) -> [u8; 32] {
    let digest = solana_sha256_hasher::hash(data);
    let mut out = [0u8; 32];
    out.copy_from_slice(digest.as_ref());
    out
}

fn validate_passkey_prefix(passkey: &[u8; PASSKEY_PUBKEY_LEN]) -> Result<()> {
    require!(
        passkey[0] == 0x02 || passkey[0] == 0x03,
        ActiveDefenseError::InvalidPasskeyPrefix
    );
    Ok(())
}

fn base64url_decode(input: &[u8]) -> Result<Vec<u8>> {
    fn val(c: u8) -> Result<u8> {
        match c {
            b'A'..=b'Z' => Ok(c - b'A'),
            b'a'..=b'z' => Ok(c - b'a' + 26),
            b'0'..=b'9' => Ok(c - b'0' + 52),
            b'-' => Ok(62),
            b'_' => Ok(63),
            _ => Err(ActiveDefenseError::WebAuthnChallengeMismatch.into()),
        }
    }

    let mut out = Vec::with_capacity(input.len() * 3 / 4 + 3);
    let mut chunk = [0u8; 4];
    let mut chunk_len = 0usize;

    for &byte in input {
        chunk[chunk_len] = val(byte)?;
        chunk_len += 1;
        if chunk_len == 4 {
            out.push((chunk[0] << 2) | (chunk[1] >> 4));
            out.push((chunk[1] << 4) | (chunk[2] >> 2));
            out.push((chunk[2] << 6) | chunk[3]);
            chunk_len = 0;
        }
    }

    match chunk_len {
        0 => {}
        2 => out.push((chunk[0] << 2) | (chunk[1] >> 4)),
        3 => {
            out.push((chunk[0] << 2) | (chunk[1] >> 4));
            out.push((chunk[1] << 4) | (chunk[2] >> 2));
        }
        _ => return Err(ActiveDefenseError::WebAuthnChallengeMismatch.into()),
    }

    Ok(out)
}

fn extract_webauthn_challenge(client_data_json: &[u8]) -> Result<Vec<u8>> {
    const NEEDLE: &[u8] = b"\"challenge\":\"";

    let start = client_data_json
        .windows(NEEDLE.len())
        .position(|w| w == NEEDLE)
        .ok_or(ActiveDefenseError::MissingWebAuthnChallenge)?
        + NEEDLE.len();

    let end = client_data_json[start..]
        .iter()
        .position(|&b| b == b'"')
        .ok_or(ActiveDefenseError::MissingWebAuthnChallenge)?
        + start;

    base64url_decode(&client_data_json[start..end])
}

fn verify_webauthn_type(client_data_json: &[u8]) -> Result<()> {
    const NEEDLE: &[u8] = b"\"type\":\"webauthn.get\"";
    let found = client_data_json.windows(NEEDLE.len()).any(|w| w == NEEDLE);
    require!(found, ActiveDefenseError::InvalidWebAuthnType);
    Ok(())
}

const SIGNATURE_LEN: usize = 64;
const OFFSETS_STRUCT_LEN: usize = 14;
const HEADER_LEN: usize = 2;
const NO_OWN_INSTRUCTION: u16 = u16::MAX;
const AUTHENTICATOR_DATA_MIN_LEN: usize = 37;
const AUTHENTICATOR_DATA_FLAGS_OFFSET: usize = 32;
const AUTHENTICATOR_DATA_UV_FLAG: u8 = 0x04;

struct ParsedOffsets {
    signature_offset: u16,
    signature_instruction_index: u16,
    public_key_offset: u16,
    public_key_instruction_index: u16,
    message_data_offset: u16,
    message_data_size: u16,
    message_instruction_index: u16,
}

fn read_u16_le(data: &[u8], at: usize) -> Result<u16> {
    let bytes = data.get(at..at + 2).ok_or(ActiveDefenseError::InvalidPasskeySignature)?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn parse_offsets(precompile_data: &[u8]) -> Result<ParsedOffsets> {
    require!(
        precompile_data.len() >= HEADER_LEN + OFFSETS_STRUCT_LEN,
        ActiveDefenseError::InvalidPasskeySignature
    );
    let num_signatures = precompile_data[0];
    require!(num_signatures >= 1, ActiveDefenseError::InvalidPasskeySignature);
    let base = HEADER_LEN;
    Ok(ParsedOffsets {
        signature_offset: read_u16_le(precompile_data, base)?,
        signature_instruction_index: read_u16_le(precompile_data, base + 2)?,
        public_key_offset: read_u16_le(precompile_data, base + 4)?,
        public_key_instruction_index: read_u16_le(precompile_data, base + 6)?,
        message_data_offset: read_u16_le(precompile_data, base + 8)?,
        message_data_size: read_u16_le(precompile_data, base + 10)?,
        message_instruction_index: read_u16_le(precompile_data, base + 12)?,
    })
}

fn resolve_instruction_data<'a>(
    ix_sysvar: &AccountInfo<'_>,
    index: u16,
    own_data: &'a [u8],
) -> Result<Vec<u8>> {
    if index == NO_OWN_INSTRUCTION {
        Ok(own_data.to_vec())
    } else {
        let ix = load_instruction_at_checked(index as usize, ix_sysvar)?;
        Ok(ix.data)
    }
}

fn verify_passkey_signature_core(
    ix_sysvar: &AccountInfo<'_>,
    expected_challenge: &[u8],
    client_data_json: &[u8],
) -> Result<[u8; PASSKEY_PUBKEY_LEN]> {
    let current_index = load_current_index_checked(ix_sysvar)?;
    require!(current_index > 0, ActiveDefenseError::InvalidPasskeySignature);

    let precompile_ix = load_instruction_at_checked((current_index - 1) as usize, ix_sysvar)?;
    require!(
        precompile_ix.program_id == SECP256R1_PROGRAM_ID,
        ActiveDefenseError::InvalidPasskeySignature
    );

    let offsets = parse_offsets(&precompile_ix.data)?;

    let pubkey_source =
        resolve_instruction_data(ix_sysvar, offsets.public_key_instruction_index, &precompile_ix.data)?;
    let pk_start = offsets.public_key_offset as usize;
    let pk_end = pk_start + PASSKEY_PUBKEY_LEN;
    let actual_pubkey_slice = pubkey_source
        .get(pk_start..pk_end)
        .ok_or(ActiveDefenseError::InvalidPasskeySignature)?;
    let mut actual_pubkey = [0u8; PASSKEY_PUBKEY_LEN];
    actual_pubkey.copy_from_slice(actual_pubkey_slice);

    let message_source =
        resolve_instruction_data(ix_sysvar, offsets.message_instruction_index, &precompile_ix.data)?;
    let msg_start = offsets.message_data_offset as usize;
    let msg_end = msg_start + offsets.message_data_size as usize;
    let actual_message = message_source
        .get(msg_start..msg_end)
        .ok_or(ActiveDefenseError::InvalidPasskeySignature)?;

    require!(
        actual_message.len() >= AUTHENTICATOR_DATA_MIN_LEN + 32,
        ActiveDefenseError::InvalidPasskeySignature
    );
    let client_data_hash = sha256_32(client_data_json);
    let message_hash_tail = &actual_message[actual_message.len() - 32..];
    require!(
        message_hash_tail == client_data_hash.as_slice(),
        ActiveDefenseError::WebAuthnChallengeMismatch
    );

    let flags = actual_message[AUTHENTICATOR_DATA_FLAGS_OFFSET];
    require!(
        flags & AUTHENTICATOR_DATA_UV_FLAG != 0,
        ActiveDefenseError::UserVerificationRequired
    );

    verify_webauthn_type(client_data_json)?;

    let actual_challenge = extract_webauthn_challenge(client_data_json)?;
    require!(
        actual_challenge == expected_challenge,
        ActiveDefenseError::WebAuthnChallengeMismatch
    );

    let sig_source =
        resolve_instruction_data(ix_sysvar, offsets.signature_instruction_index, &precompile_ix.data)?;
    let sig_start = offsets.signature_offset as usize;
    require!(
        sig_source.len() >= sig_start + SIGNATURE_LEN,
        ActiveDefenseError::InvalidPasskeySignature
    );

    Ok(actual_pubkey)
}

/// [H1-FIX] Leest action_nonce uit WalletAccount met VARIABELE offset.
fn read_wallet_action_nonce(wallet_data: &[u8]) -> Result<u64> {
    require!(
        wallet_data.len() >= WALLET_MIN_LEN,
        ActiveDefenseError::InvalidWalletLayout
    );

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

    require!(
        wallet_data.len() >= offset + 8,
        ActiveDefenseError::InvalidWalletLayout
    );

    let nonce_bytes: [u8; 8] = wallet_data[offset..offset + 8]
        .try_into()
        .map_err(|_| ActiveDefenseError::InvalidWalletLayout)?;
    Ok(u64::from_le_bytes(nonce_bytes))
}

/// [M1-FIX] Verifieert passkey tegen owner_passkey OF extra passkeys.
fn verify_passkey_for_wallet(
    ix_sysvar: &AccountInfo<'_>,
    wallet_account_info: &AccountInfo<'_>,
    passkeys_account_info: Option<&AccountInfo<'_>>,
    expected_challenge: &[u8],
    client_data_json: &[u8],
) -> Result<()> {
    let data = wallet_account_info.try_borrow_data()?;
    require!(
        data.len() >= WALLET_MIN_LEN,
        ActiveDefenseError::InvalidWalletLayout
    );

    let mut owner_passkey = [0u8; PASSKEY_PUBKEY_LEN];
    owner_passkey.copy_from_slice(
        &data[WALLET_OWNER_PASSKEY_OFFSET..WALLET_OWNER_PASSKEY_OFFSET + PASSKEY_PUBKEY_LEN],
    );
    validate_passkey_prefix(&owner_passkey)?;

    let actual_pubkey = verify_passkey_signature_core(ix_sysvar, expected_challenge, client_data_json)?;

    if &actual_pubkey == &owner_passkey {
        return Ok(());
    }

    if let Some(passkeys_info) = passkeys_account_info {
        let pk_data = passkeys_info.try_borrow_data()?;
        require!(
            pk_data.len() >= PASSKEYS_ADDITIONAL_OFFSET + (PASSKEY_PUBKEY_LEN * MAX_ADDITIONAL_PASSKEYS),
            ActiveDefenseError::InvalidWalletLayout
        );

        let count = pk_data[PASSKEYS_COUNT_OFFSET] as usize;
        require!(
            count <= MAX_ADDITIONAL_PASSKEYS,
            ActiveDefenseError::InvalidWalletLayout
        );

        for i in 0..count {
            let offset = PASSKEYS_ADDITIONAL_OFFSET + (i * PASSKEY_PUBKEY_LEN);
            let mut extra_passkey = [0u8; PASSKEY_PUBKEY_LEN];
            extra_passkey.copy_from_slice(&pk_data[offset..offset + PASSKEY_PUBKEY_LEN]);

            if &actual_pubkey == &extra_passkey {
                return Ok(());
            }
        }
    }

    err!(ActiveDefenseError::InvalidPasskeySignature)
}

/// Exacte tegenhanger van spankwallet's build_expected_challenge:
/// Keccak-256 over program_id || wallet || domain || payload.
fn build_expected_challenge(
    wallet: &Pubkey,
    domain: &[u8],
    payload: &[u8],
) -> Vec<u8> {
    hashv(&[crate::ID.as_ref(), wallet.as_ref(), domain, payload])
        .as_ref()
        .to_vec()
}

/// [H1-FIX] Controleert dat client_action_nonce == on-chain action_nonce.
fn check_current_action_nonce(wallet_data: &[u8], client_action_nonce: u64) -> Result<u64> {
    let on_chain_nonce = read_wallet_action_nonce(wallet_data)?;
    require!(
        client_action_nonce == on_chain_nonce,
        ActiveDefenseError::StaleActionNonce
    );
    Ok(on_chain_nonce)
}

// ============================================================================
// create_poison_token
//
// Stelt de Token-2022 transfer hook in op de mint. De authorized list wordt
// opgeslagen IN de transfer_hook_instruction data van de mint. Wanneer een
// transfer plaatsvindt, roept Token-2022 onze poison_transfer_hook aan met
// deze data als instructie-argumenten (Vec<Pubkey>).
// ============================================================================

#[derive(Accounts)]
pub struct CreatePoisonToken<'info> {
    /// CHECK: spankwallet WalletAccount PDA (read-only).
    pub wallet: UncheckedAccount<'info>,

    /// CHECK: spankwallet PasskeysAccount PDA (read-only, optioneel).
    pub passkeys: Option<UncheckedAccount<'info>>,

    /// CHECK: de Token-2022 mint. Moet nog GEEN transfer hook hebben.
    #[account(mut)]
    pub token_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(address = IX_SYSVAR_ID)]
    /// CHECK: geverifieerd via de secp256r1-precompile-instructie.
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_poison_token(
    ctx: Context<CreatePoisonToken>,
    authorized_recipients: Vec<Pubkey>,
    client_action_nonce: u64,
    client_data_json: Vec<u8>,
) -> Result<()> {
    require!(
        !authorized_recipients.is_empty(),
        ActiveDefenseError::PoisonTokenAuthorizedListEmpty
    );
    require!(
        authorized_recipients.len() <= MAX_POISON_AUTHORIZED,
        ActiveDefenseError::PoisonTokenAuthorizedListFull
    );

    let wallet_data = ctx.accounts.wallet.try_borrow_data()?;
    let action_nonce = check_current_action_nonce(&wallet_data, client_action_nonce)?;

    // [C1] action_nonce VOORAAN in payload (zelfde als spankwallet)
    let mut payload = Vec::with_capacity(8 + 32);
    payload.extend_from_slice(&action_nonce.to_le_bytes());
    payload.extend_from_slice(ctx.accounts.token_mint.key().as_ref());

    let expected_challenge = build_expected_challenge(
        &ctx.accounts.wallet.key(),
        b"create_poison_token",
        &payload,
    );

    let passkeys_info = ctx.accounts.passkeys.as_ref().map(|p| p.to_account_info());
    verify_passkey_for_wallet(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &ctx.accounts.wallet.to_account_info(),
        passkeys_info.as_ref(),
        &expected_challenge,
        &client_data_json,
    )?;

    // Bouw de transfer_hook_instruction data:
    // [8 bytes: anchor discriminator voor poison_transfer_hook]
    // [Borsh-encoded Vec<Pubkey>: authorized_recipients]
    let hook_disc = {
        // sha256("global:poison_transfer_hook")[:8]
        let mut disc = [0u8; 8];
        let hash = solana_sha256_hasher::hashv(&[b"global:poison_transfer_hook"]);
        disc.copy_from_slice(&hash.as_ref()[..8]);
        disc
    };

    let mut hook_instruction_data = Vec::with_capacity(8 + 4 + 32 * authorized_recipients.len());
    hook_instruction_data.extend_from_slice(&hook_disc);
    // Borsh Vec<Pubkey>: u32 length (LE) + pubkeys
    let count = (authorized_recipients.len() as u32).to_le_bytes();
    hook_instruction_data.extend_from_slice(&count);
    for r in &authorized_recipients {
        hook_instruction_data.extend_from_slice(r.as_ref());
    }

    // Bouw de InitializeTransferHook instructie voor Token-2022:
    // [1 byte: instruction index = 34]
    // [32 bytes: transfer_hook_program_id (ons programma)]
    // [4 bytes: length van transfer_hook_instruction (LE)]
    // [N bytes: transfer_hook_instruction data]
    let mut ix_data = Vec::with_capacity(1 + 32 + 4 + hook_instruction_data.len());
    ix_data.push(34); // InitializeTransferHook instruction index
    ix_data.extend_from_slice(crate::ID.as_ref());
    let hook_len = (hook_instruction_data.len() as u32).to_le_bytes();
    ix_data.extend_from_slice(&hook_len);
    ix_data.extend_from_slice(&hook_instruction_data);

    // CPI naar Token-2022
    let ix = Instruction {
        program_id: TOKEN_2022_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.token_mint.key(), false),
            AccountMeta::new(ctx.accounts.payer.key(), true),
        ],
        data: ix_data,
    };

    invoke(
        &ix,
        &[
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.payer.to_account_info(),
        ],
    )?;

    msg!("POISON_TOKEN_CREATED: transfer hook set on mint with {} authorized recipients", authorized_recipients.len());

    Ok(())
}

// ============================================================================
// poison_transfer_hook (Token-2022 transfer hook)
//
// Wordt aangeroepen door Token-2022 bij ELKE transfer van deze mint.
// Ontvangt exact 4 accounts van Token-2022:
//   1. Source token account (writable)
//   2. Mint (read-only)
//   3. Destination token account (writable)
//   4. Owner/authority (signer)
//
// En de opgeslagen transfer_hook_instruction data als argumenten:
//   Vec<Pubkey> = authorized_recipients
//
// Als de destination owner NIET in de list staat → error (transfer geblokkeerd).
// ============================================================================

#[derive(Accounts)]
pub struct PoisonTransferHook<'info> {
    /// Account 1 van Token-2022: source token account (writable).
    /// CHECK: ongetypeerd omdat Token-2022 deze hook zelf aanroept met een
    /// vaste accountvolgorde (transfer-hook-interface); niet inhoudelijk
    /// geverifieerd tegen de mint hier. TODO (open punt, zie STATUS.md):
    /// een kwaadwillende die deze instructie rechtstreeks aanroept i.p.v.
    /// via een echte Token-2022-transfer kan nu willekeurige accounts
    /// meegeven - vóór productiegebruik moet hier op zijn minst geverifieerd
    /// worden dat dit account daadwerkelijk bij `token_mint` hoort.
    #[account(mut)]
    pub source_token_account: UncheckedAccount<'info>,

    /// Account 2 van Token-2022: mint (read-only).
    /// CHECK: zie source_token_account hierboven - zelfde open punt.
    pub token_mint: UncheckedAccount<'info>,

    /// Account 3 van Token-2022: destination token account (writable).
    #[account(mut)]
    pub destination_token_account: Account<'info, TokenAccount>,

    /// Account 4 van Token-2022: owner/authority (signer).
    /// CHECK: zie source_token_account hierboven - zelfde open punt.
    pub owner: UncheckedAccount<'info>,
}

pub fn poison_transfer_hook(
    ctx: Context<PoisonTransferHook>,
    authorized_recipients: Vec<Pubkey>,
) -> Result<()> {
    let dest_owner = ctx.accounts.destination_token_account.owner;

    let is_authorized = authorized_recipients.iter().any(|r| *r == dest_owner);

    require!(
        is_authorized,
        ActiveDefenseError::PoisonTokenUnauthorizedRecipient
    );

    Ok(())
}

// ============================================================================
// mark_malicious / unmark_malicious (onveranderd)
// ============================================================================

#[derive(Accounts)]
pub struct MarkMalicious<'info> {
    /// CHECK: spankwallet WalletAccount PDA (read-only).
    pub wallet: UncheckedAccount<'info>,

    /// CHECK: spankwallet PasskeysAccount PDA (read-only, optioneel).
    pub passkeys: Option<UncheckedAccount<'info>>,

    #[account(
        init_if_needed,
        payer = payer,
        space = MaliciousAddressesAccount::LEN,
        seeds = [b"malicious", wallet.key().as_ref()],
        bump
    )]
    pub malicious: Account<'info, MaliciousAddressesAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(address = IX_SYSVAR_ID)]
    /// CHECK: geverifieerd via de secp256r1-precompile-instructie.
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn mark_malicious(
    ctx: Context<MarkMalicious>,
    address: Pubkey,
    client_action_nonce: u64,
    client_data_json: Vec<u8>,
) -> Result<()> {
    let wallet_data = ctx.accounts.wallet.try_borrow_data()?;
    let action_nonce = check_current_action_nonce(&wallet_data, client_action_nonce)?;

    let mut payload = Vec::with_capacity(8 + 32);
    payload.extend_from_slice(&action_nonce.to_le_bytes());
    payload.extend_from_slice(address.as_ref());

    let expected_challenge = build_expected_challenge(
        &ctx.accounts.wallet.key(),
        b"mark_malicious",
        &payload,
    );

    let passkeys_info = ctx.accounts.passkeys.as_ref().map(|p| p.to_account_info());
    verify_passkey_for_wallet(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &ctx.accounts.wallet.to_account_info(),
        passkeys_info.as_ref(),
        &expected_challenge,
        &client_data_json,
    )?;

    let mal = &mut ctx.accounts.malicious;

    if mal.wallet == Pubkey::default() && mal.count == 0 {
        mal.wallet = ctx.accounts.wallet.key();
        mal.bump = ctx.bumps.malicious;
        mal.count = 0;
        mal.addresses = [Pubkey::default(); MAX_MALICIOUS_ADDRESSES];
    }

    let already_present = mal.addresses[..mal.count as usize]
        .iter()
        .any(|a| *a == address);
    require!(!already_present, ActiveDefenseError::AddressAlreadyMalicious);
    require!(
        (mal.count as usize) < MAX_MALICIOUS_ADDRESSES,
        ActiveDefenseError::MaliciousListFull
    );

    let index = mal.count as usize;
    mal.addresses[index] = address;
    mal.count += 1;

    Ok(())
}

#[derive(Accounts)]
pub struct UnmarkMalicious<'info> {
    /// CHECK: spankwallet WalletAccount PDA (read-only).
    pub wallet: UncheckedAccount<'info>,

    /// CHECK: spankwallet PasskeysAccount PDA (read-only, optioneel).
    pub passkeys: Option<UncheckedAccount<'info>>,

    #[account(
        mut,
        seeds = [b"malicious", wallet.key().as_ref()],
        bump = malicious.bump,
    )]
    pub malicious: Account<'info, MaliciousAddressesAccount>,

    #[account(address = IX_SYSVAR_ID)]
    /// CHECK: geverifieerd via de secp256r1-precompile-instructie.
    pub instructions_sysvar: UncheckedAccount<'info>,
}

pub fn unmark_malicious(
    ctx: Context<UnmarkMalicious>,
    address: Pubkey,
    client_action_nonce: u64,
    client_data_json: Vec<u8>,
) -> Result<()> {
    let wallet_data = ctx.accounts.wallet.try_borrow_data()?;
    let action_nonce = check_current_action_nonce(&wallet_data, client_action_nonce)?;

    let mut payload = Vec::with_capacity(8 + 32);
    payload.extend_from_slice(&action_nonce.to_le_bytes());
    payload.extend_from_slice(address.as_ref());

    let expected_challenge = build_expected_challenge(
        &ctx.accounts.wallet.key(),
        b"unmark_malicious",
        &payload,
    );

    let passkeys_info = ctx.accounts.passkeys.as_ref().map(|p| p.to_account_info());
    verify_passkey_for_wallet(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &ctx.accounts.wallet.to_account_info(),
        passkeys_info.as_ref(),
        &expected_challenge,
        &client_data_json,
    )?;

    let mal = &mut ctx.accounts.malicious;
    let count = mal.count as usize;
    let index = mal.addresses[..count]
        .iter()
        .position(|a| *a == address)
        .ok_or(ActiveDefenseError::AddressNotMalicious)?;

    let last = count - 1;
    mal.addresses[index] = mal.addresses[last];
    mal.addresses[last] = Pubkey::default();
    mal.count -= 1;

    Ok(())
}
