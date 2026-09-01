use anchor_lang::prelude::*;

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
/// tegelijk mag registreren. Gedeelde constante uit het spankwallet-contract
/// (gepin @ 1fb3134) - de enige bron van waarheid (STATUS.md sectie 29).
pub use spankwallet_contract::MAX_ADDITIONAL_PASSKEYS;

/// STATUS.md sectie 9/11/12 (Route B, abl-token-patroon): één PDA per
/// (mint, recipient)-paar, in plaats van create_poison_token's huidige
/// Vec<Pubkey>-in-CPI-data (het echte, structurele probleem uit sectie 7
/// punt 3). Geen `allowed: bool`-veld zoals abl-token's `ABWallet` - active-
/// defense heeft geen block-/mixed-modus, alleen "expliciet toegestaan", dus
/// het BESTAAN van deze PDA is zelf de autorisatie. `mint`/`recipient` zijn
/// al in de PDA-seeds gecodeerd (dus technisch afleidbaar uit het adres) -
/// hier toch opgeslagen voor introspectie/tooling, zelfde afweging als
/// abl-token's `ABWallet.wallet` (ook al afleidbaar uit zijn eigen seed).
///
/// Geen vaste maximum-capaciteit (in tegenstelling tot het inmiddels
/// verwijderde `MAX_POISON_AUTHORIZED`, dat bestond vanwege het oude, éné-
/// groeiende-account-ontwerp van `create_poison_token` - sectie 17) - elke
/// ontvanger krijgt zijn eigen, onafhankelijke account, dus er is geen
/// gedeelde array die kan volraken. De enige grens is economisch (rent per
/// PDA), niet technisch.
#[account]
pub struct AuthorizedRecipient {
    /// De Token-2022-mint waarvoor deze ontvanger is toegestaan.
    pub mint: Pubkey,
    /// De toegestane ontvanger (owner van de destination-token-account).
    pub recipient: Pubkey,
    /// PDA-bump.
    pub bump: u8,
}

impl AuthorizedRecipient {
    // discriminator(8) + mint(32) + recipient(32) + bump(1)
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

/// Seed-literal voor `AuthorizedRecipient`-PDA's - EEN GEDEELDE constante,
/// gebruikt zowel bij het AANMAKEN (add_authorized_recipient) als bij het
/// dynamisch AFLEIDEN tijdens een echte transfer (attach_transfer_hook's
/// ExtraAccountMetaList-seed-recept). Bewust niet op twee plekken los
/// ingetypt: als deze twee ooit uit sync raken, zou poison_transfer_hook
/// tijdens een echte transfer een ANDER adres uitrekenen dan
/// add_authorized_recipient ooit aanmaakte - een stille, pas-bij-een-
/// ECHTE-transfer zichtbare breuk, precies het soort fout dat sectie 7/9's
/// envelope-onderzoek al eerder blootlegde.
pub const POISON_AUTHORIZED_SEED: &[u8] = b"poison_authorized";

/// Seed-literal voor de ExtraAccountMetaList-PDA - het Solana Foundation-
/// eigen, standaard seed-recept (`["extra-account-metas", mint]`, sectie 9
/// punt 1, bevestigd tegen de officiële transfer-hook-gids).
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";
