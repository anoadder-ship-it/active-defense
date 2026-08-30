use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    transfer_hook_initialize, TokenAccount as TokenInterfaceAccount, TransferHookInitialize,
};
use solana_instructions_sysvar::{
    load_current_index_checked, load_instruction_at_checked, ID as IX_SYSVAR_ID,
};
use solana_keccak_hasher::hashv;
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::errors::ActiveDefenseError;
use crate::state::*;

pub const SECP256R1_PROGRAM_ID: Pubkey = pubkey!("Secp256r1SigVerify1111111111111111111111111");
pub const PASSKEY_PUBKEY_LEN: usize = 33;

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
// add_authorized_recipient
//
// STATUS.md sectie 9/11/17 (Route B): maakt een AuthorizedRecipient-PDA aan
// voor (mint, recipient). Het BESTAAN van deze PDA is zelf de autorisatie -
// geen `allowed`-veld nodig, active-defense kent geen block-/mixed-modus.
// Vervangt `create_poison_token` (verwijderd, sectie 17 - structureel
// verkeerde Vec<Pubkey>-in-CPI-data-aanpak, sectie 7 punt 3) samen met
// `attach_transfer_hook` en de herbouwde `poison_transfer_hook`.
// ============================================================================

#[derive(Accounts)]
#[instruction(recipient: Pubkey)]
pub struct AddAuthorizedRecipient<'info> {
    /// CHECK: spankwallet WalletAccount PDA (read-only).
    pub wallet: UncheckedAccount<'info>,

    /// CHECK: spankwallet PasskeysAccount PDA (read-only, optioneel).
    pub passkeys: Option<UncheckedAccount<'info>>,

    /// CHECK: de Token-2022 mint waarvoor deze ontvanger wordt toegestaan.
    /// Geen typed Mint-deserialisatie nodig - alleen de key is relevant voor
    /// de PDA-seed en de opgeslagen data (zelfde patroon als
    /// create_poison_token's token_mint-veld hierboven).
    pub token_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = AuthorizedRecipient::LEN,
        seeds = [POISON_AUTHORIZED_SEED, token_mint.key().as_ref(), recipient.as_ref()],
        bump,
    )]
    pub authorized_recipient: Account<'info, AuthorizedRecipient>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(address = IX_SYSVAR_ID)]
    /// CHECK: geverifieerd via de secp256r1-precompile-instructie.
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn add_authorized_recipient(
    ctx: Context<AddAuthorizedRecipient>,
    recipient: Pubkey,
    client_action_nonce: u64,
    client_data_json: Vec<u8>,
) -> Result<()> {
    let wallet_data = ctx.accounts.wallet.try_borrow_data()?;
    let action_nonce = check_current_action_nonce(&wallet_data, client_action_nonce)?;

    // Payload: action_nonce(8) + mint(32) + recipient(32)
    let mut payload = Vec::with_capacity(8 + 32 + 32);
    payload.extend_from_slice(&action_nonce.to_le_bytes());
    payload.extend_from_slice(ctx.accounts.token_mint.key().as_ref());
    payload.extend_from_slice(recipient.as_ref());

    let expected_challenge = build_expected_challenge(
        &ctx.accounts.wallet.key(),
        b"add_authorized_recipient",
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

    let entry = &mut ctx.accounts.authorized_recipient;
    entry.mint = ctx.accounts.token_mint.key();
    entry.recipient = recipient;
    entry.bump = ctx.bumps.authorized_recipient;

    msg!("AUTHORIZED_RECIPIENT_ADDED: {} mag nu deze poison token ontvangen", recipient);

    Ok(())
}

// ============================================================================
// attach_transfer_hook
//
// STATUS.md sectie 9/12 (Route B, stap 3): de ECHTE InitializeTransferHook-
// registratie (via anchor-spl's typed CPI-helper, GEEN handmatige
// Instruction/invoke() meer) + ExtraAccountMetaList-initialisatie, in ÉÉN
// instructie. Vervangt create_poison_token's huidige, structureel verkeerde
// raw-CPI-blok (sectie 7 punt 3: verkeerd aantal accounts, verkeerde
// opcode, verkeerd dataformaat) volledig - create_poison_token zelf wordt
// pas in een latere stap herzien/verwijderd.
//
// `transfer_hook_initialize`, NIET `transfer_hook_update`: rechtstreeks
// nagekeken in Token-2022's eigen interface-bron
// (solana-program/token-2022, interface/src/extension/transfer_hook/
// instruction.rs) - `Update` is expliciet "only supported for mints that
// include the TransferHook extension" (vereist dus een EERDERE Initialize),
// en `Initialize` accepteert maar ÉÉN account ([mint]), tegenover `Update`'s
// twee ([mint, authority]). Op het moment dat attach_transfer_hook draait
// heeft de mint NOG NOOIT een InitializeTransferHook-aanroep gehad (dat was
// exact het gat dat create_poison_token's kapotte CPI probeerde te vullen) -
// dus `Initialize` is het enige dat hier kan werken.
//
// `authority: None` - er bestaat (nog) geen update_transfer_hook-instructie,
// dus een niet-lege authority zou een belofte zijn die nergens op reageert.
// Een spankwallet-PDA zou hier sowieso nooit kunnen werken als toekomstige
// CPI-signer: die PDA is afgeleid met SPANKWALLET's programma-ID, niet
// active-defense's, dus active-defense kan er nooit `invoke_signed` voor
// produceren (PDA-signing werkt alleen voor het programma waarmee de PDA
// zelf is afgeleid). `None` is dus niet alleen eenvoudiger maar ook
// eerlijker dan een authority-waarde die toch nooit bruikbaar zou zijn.
// ============================================================================

fn get_meta_list_size() -> Result<usize> {
    ExtraAccountMetaList::size_of(1).map_err(|_| ProgramError::InvalidArgument.into())
}

/// STATUS.md sectie 12/13: precies ÉÉN extra account - de
/// AuthorizedRecipient-PDA voor de DESTINATION-owner. Active-defense's
/// ontwerp checkt alleen wie mag ONTVANGEN (poison_transfer_hook's huidige
/// logica checkt ook alleen dest_owner, niet de source) - geen tweede extra
/// account nodig zoals abl-token's source+destination-paar, dat wél beide
/// kanten checkt vanwege zijn eigen Allow/Block/Mixed-modus.
///
/// Seed-recept: `[POISON_AUTHORIZED_SEED, mint, recipient]` - EXACT dezelfde
/// drie componenten als add_authorized_recipient's PDA-seeds hierboven,
/// zodat Token-2022 tijdens een ECHTE transfer dezelfde PDA uitrekent die
/// add_authorized_recipient ooit aanmaakte:
///   - `Seed::Literal`: de gedeelde `POISON_AUTHORIZED_SEED`-constante.
///   - `Seed::AccountKey { index: 1 }`: de mint's EIGEN adres - in de
///     standaard Execute-accountlijst (`[0]=source, [1]=mint,
///     [2]=destination, [3]=owner, ...extra`) staat de mint altijd op
///     index 1, dus dit hoeft niet uit accountdata gelezen te worden.
///   - `Seed::AccountData { account_index: 2, data_index: 32, length: 32 }`:
///     bytes 32..64 van de DESTINATION-token-account (index 2) - dat is
///     exact de `owner`-veldpositie in een SPL-Token(-2022)-accountlayout
///     (32 bytes mint, dan 32 bytes owner) - dezelfde truc als abl-token's
///     `get_extra_account_metas()`.
fn get_extra_account_metas() -> Result<Vec<ExtraAccountMeta>> {
    Ok(vec![ExtraAccountMeta::new_with_seeds(
        &[
            Seed::Literal { bytes: POISON_AUTHORIZED_SEED.to_vec() },
            Seed::AccountKey { index: 1 },
            Seed::AccountData { account_index: 2, data_index: 32, length: 32 },
        ],
        false,
        false,
    )
    .map_err(|_| ProgramError::InvalidArgument)?])
}

#[derive(Accounts)]
pub struct AttachTransferHook<'info> {
    /// CHECK: spankwallet WalletAccount PDA (read-only).
    pub wallet: UncheckedAccount<'info>,

    /// CHECK: spankwallet PasskeysAccount PDA (read-only, optioneel).
    pub passkeys: Option<UncheckedAccount<'info>>,

    /// CHECK: de Token-2022-mint. Moet nog GEEN transfer hook hebben (zie
    /// `attach_transfer_hook`'s eigen documentatie hierboven) - vandaar
    /// UncheckedAccount i.p.v. InterfaceAccount<Mint>: een InterfaceAccount
    /// zou proberen te deserialiseren als een AL-geïnitialiseerde Mint, wat
    /// op dit punt in de flow nog niet zo is (InitializeMint2 loopt nog
    /// steeds als allerlaatste stap, ná deze instructie).
    #[account(mut)]
    pub token_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = get_meta_list_size()?,
        seeds = [EXTRA_ACCOUNT_METAS_SEED, token_mint.key().as_ref()],
        bump,
    )]
    /// CHECK: ExtraAccountMetaList - ruwe TLV-data, geen Anchor-getypeerd
    /// accounttype (zelfde patroon als abl-token's eigen extra_metas_account).
    pub extra_account_meta_list: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,

    #[account(address = IX_SYSVAR_ID)]
    /// CHECK: geverifieerd via de secp256r1-precompile-instructie.
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn attach_transfer_hook(
    ctx: Context<AttachTransferHook>,
    client_action_nonce: u64,
    client_data_json: Vec<u8>,
) -> Result<()> {
    let wallet_data = ctx.accounts.wallet.try_borrow_data()?;
    let action_nonce = check_current_action_nonce(&wallet_data, client_action_nonce)?;

    let mut payload = Vec::with_capacity(8 + 32);
    payload.extend_from_slice(&action_nonce.to_le_bytes());
    payload.extend_from_slice(ctx.accounts.token_mint.key().as_ref());

    let expected_challenge = build_expected_challenge(
        &ctx.accounts.wallet.key(),
        b"attach_transfer_hook",
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

    // De ECHTE InitializeTransferHook-registratie, via anchor-spl's typed
    // CPI-helper - Anchor voegt het Token-2022-programma-account zelf
    // automatisch toe aan de CPI (via CpiContext::new's program-parameter),
    // wat exact het account is dat in sectie 6/10/11's "Unknown program"-
    // fout ontbrak in create_poison_token's handmatige invoke()-aanroep.
    let cpi_accounts = TransferHookInitialize {
        token_program_id: ctx.accounts.token_program.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
    transfer_hook_initialize(cpi_ctx, None, Some(crate::ID))?;

    // ExtraAccountMetaList initialiseren met het seed-recept hierboven.
    let extra_account_meta_list = &ctx.accounts.extra_account_meta_list;
    let metas = get_extra_account_metas()?;
    let mut data = extra_account_meta_list.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &metas)
        .map_err(|_| ProgramError::InvalidAccountData)?;

    msg!("TRANSFER_HOOK_ATTACHED: mint {} wijst nu naar active-defense, ExtraAccountMetaList geïnitialiseerd", ctx.accounts.token_mint.key());

    Ok(())
}

// ============================================================================
// poison_transfer_hook (Token-2022 transfer hook - ECHTE Execute-interface)
//
// STATUS.md sectie 9/13/14 (Route B, stap 4, de laatste van dit deel): dit
// vervangt de oude, zelfverzonnen dispatch (Anchor-eigen
// sha256("global:poison_transfer_hook")-discriminator + een handmatig
// meegegeven Vec<Pubkey>) door de ECHTE, officiële SPL-transfer-hook-
// Execute-interface (`SPL_DISCRIMINATOR_SLICE`, geregistreerd in lib.rs via
// `#[instruction(discriminator = ...)]` - zie lib.rs voor de exacte
// toepassing, hetzelfde patroon als abl-token's `tx_hook`). Token-2022 roept
// deze instructie aan bij ELKE transfer van een mint met deze hook
// geregistreerd (via attach_transfer_hook, stap 3), met PRECIES de
// standaard-Execute-accountlijst + de accounts die STAP 3's
// ExtraAccountMetaList-seed-recept oplevert:
//   1. Source token account
//   2. Mint
//   3. Destination token account
//   4. Owner/delegate
//   5. ExtraAccountMetaList (altijd aanwezig, positioneel, hier niet
//      inhoudelijk gebruikt)
//   6. AuthorizedRecipient-PDA voor (mint, destination-owner) - DYNAMISCH
//      gevonden door Token-2022 zelf via stap 3's seed-recept, NOOIT
//      expliciet door een client meegegeven (STATUS.md sectie 13's
//      resolutiebewijs).
//
// Autorisatielogica (STATUS.md sectie 12): GEEN `allowed`-veld, GEEN
// handmatige Vec-doorzoeking meer - het BESTAAN van de AuthorizedRecipient-
// PDA is zelf de autorisatie. `Account<'info, AuthorizedRecipient>` (getypeerd,
// niet Unchecked) + de `seeds`-constraint hieronder doen het VOLLEDIGE werk:
// als de PDA niet bestaat (destination-owner niet toegestaan), faalt Anchor's
// eigen accountdeserialisatie AL vóór de handler-body ooit draait
// (`AccountNotInitialized`) - geen eigen `require!`/foutafhandeling nodig.
// ============================================================================

#[derive(Accounts)]
pub struct PoisonTransferHook<'info> {
    /// Account 1 (Execute-standaard): source token account. GEEN `mut` -
    /// empirisch bevestigd (STATUS.md sectie 14): Token-2022 geeft dit
    /// account in de Execute-CPI NIET als writable door, ongeacht de
    /// writability in de buitenste transferChecked-instructie (zelfde,
    /// aanvankelijk verrassende keuze als abl-token's `TxHook`-struct, die
    /// om dezelfde reden ook geen enkele `mut` op de 4 standaardaccounts
    /// heeft). Een `#[account(mut)]` hier gaf `ConstraintMut` (2000).
    /// CHECK: ongetypeerd - zelfde, langer al openstaande beperking als
    /// voorheen (zie STATUS.md): een kwaadwillende die deze instructie
    /// rechtstreeks aanroept i.p.v. via een echte Token-2022-transfer kan nu
    /// willekeurige accounts meegeven. Niet vandaag aangepakt - buiten de
    /// scope van "herbouw als echte Execute-interface".
    pub source_token_account: UncheckedAccount<'info>,

    /// Account 2 (Execute-standaard): mint.
    /// CHECK: alleen de key is relevant, als PDA-seed voor
    /// `authorized_recipient` hieronder.
    pub token_mint: UncheckedAccount<'info>,

    /// Account 3 (Execute-standaard): destination token account. Getypeerd
    /// via `token_interface::TokenAccount` (NIET het klassieke
    /// `anchor_spl::token::TokenAccount` - dat accepteert uitsluitend
    /// classic-SPL-Token als owner-programma en zou hier stukvallen op een
    /// Token-2022-eigendomsaccount; `token_interface::TokenAccount`
    /// accepteert beide programma-ID's, zie STATUS.md). GEEN `mut` - zelfde
    /// empirische reden als source_token_account hierboven.
    pub destination_token_account: InterfaceAccount<'info, TokenInterfaceAccount>,

    /// Account 4 (Execute-standaard): owner/delegate. Token-2022 geeft dit
    /// door als gewoon account (geen signer-vlag in de CPI naar de hook).
    /// CHECK: zie source_token_account hierboven - zelfde open punt.
    pub owner: UncheckedAccount<'info>,

    /// Account 5: ExtraAccountMetaList - altijd aanwezig, vlak na de 4
    /// standaardaccounts (STATUS.md sectie 13). Puur positioneel vereist,
    /// niet inhoudelijk gebruikt in deze handler. STATUS.md sectie 16 punt 1:
    /// een `seeds`-constraint hier is strikt genomen overbodig zolang de
    /// handler de inhoud nooit leest, maar sluit exact de "ExtraAccountMetaList
    /// account injection"-klasse uit die gepubliceerde Solana-audit-gidsen
    /// noemen (spoofed/verkeerd account op deze positie) - goedkope
    /// defense-in-depth, geen functionele wijziging.
    /// CHECK: puur positioneel, inhoud nooit gelezen.
    #[account(
        seeds = [EXTRA_ACCOUNT_METAS_SEED, token_mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// Account 6: de door stap 3's seed-recept dynamisch gevonden
    /// AuthorizedRecipient-PDA voor (token_mint, destination-owner). Getypeerd
    /// (niet Unchecked) - Anchor's eigen `Account<T>`-deserialisatie is de
    /// volledige autorisatiecheck: bestaat de PDA niet (of is de seeds-
    /// afleiding onjuist), dan faalt dit VÓÓR de handler-body draait.
    #[account(
        seeds = [
            POISON_AUTHORIZED_SEED,
            token_mint.key().as_ref(),
            destination_token_account.owner.as_ref(),
        ],
        bump,
    )]
    pub authorized_recipient: Account<'info, AuthorizedRecipient>,
}

pub fn poison_transfer_hook(ctx: Context<PoisonTransferHook>, amount: u64) -> Result<()> {
    msg!(
        "POISON_TRANSFER_ALLOWED: {} lamports/units naar {} (AuthorizedRecipient-PDA {} bevestigd voor mint {})",
        amount,
        ctx.accounts.destination_token_account.owner,
        ctx.accounts.authorized_recipient.key(),
        ctx.accounts.token_mint.key()
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
