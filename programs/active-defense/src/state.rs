use anchor_lang::prelude::*;

/// Maximum aantal geautoriseerde ontvangers per poison token.
pub const MAX_POISON_AUTHORIZED: usize = 16;

/// Maximum aantal malitieuse adressen per wallet.
pub const MAX_MALICIOUS_ADDRESSES: usize = 32;

#[account]
pub struct MaliciousAddressesAccount {
    /// De spankwallet WalletAccount PDA waarbij deze lijst hoort.
    pub wallet: Pubkey,
    /// PDA bump voor deze account.
    pub bump: u8,
    /// Aantal actief gevulde slots in addresses.
    pub count: u8,
    /// Malitieuse adressen.
    pub addresses: [Pubkey; MAX_MALICIOUS_ADDRESSES],
}

impl MaliciousAddressesAccount {
    // discriminator(8) + wallet(32) + bump(1) + count(1) + addresses(32 * 32)
    pub const LEN: usize = 8 + 32 + 1 + 1 + (32 * MAX_MALICIOUS_ADDRESSES);
}

/// Maximum aantal EXTRA passkeys (naast owner_passkey) dat een spankwallet
/// tegelijk mag registreren. Moet matchen met spankwallet's MAX_ADDITIONAL_PASSKEYS.
pub const MAX_ADDITIONAL_PASSKEYS: usize = 8;
