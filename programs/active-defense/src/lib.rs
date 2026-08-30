use anchor_lang::prelude::*;
use spl_discriminator::SplDiscriminate;
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

mod errors;
mod instructions;
mod state;

use instructions::*;

declare_id!("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");

#[program]
pub mod active_defense {
    use super::*;

    /// Maakt een AuthorizedRecipient-PDA aan voor (mint, recipient) - het
    /// BESTAAN van deze PDA is zelf de autorisatie (STATUS.md sectie 11).
    pub fn add_authorized_recipient(
        ctx: Context<AddAuthorizedRecipient>,
        recipient: Pubkey,
        client_action_nonce: u64,
        client_data_json: Vec<u8>,
    ) -> Result<()> {
        instructions::add_authorized_recipient(ctx, recipient, client_action_nonce, client_data_json)
    }

    /// De ECHTE InitializeTransferHook-registratie + ExtraAccountMetaList-
    /// initialisatie, via de typed anchor-spl-CPI-helper (STATUS.md sectie 12/13).
    pub fn attach_transfer_hook(
        ctx: Context<AttachTransferHook>,
        client_action_nonce: u64,
        client_data_json: Vec<u8>,
    ) -> Result<()> {
        instructions::attach_transfer_hook(ctx, client_action_nonce, client_data_json)
    }

    /// Token-2022 transfer hook: ECHTE Execute-interface-implementatie
    /// (STATUS.md sectie 14) - `SPL_DISCRIMINATOR_SLICE` i.p.v. de oude,
    /// zelfverzonnen Anchor-discriminator, zelfde patroon als abl-token's
    /// `tx_hook`. Blokkeert transfers naar ongeautoriseerde ontvangers via
    /// het bestaan (of niet) van de AuthorizedRecipient-PDA - zie
    /// instructions.rs voor de volledige uitleg.
    #[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn poison_transfer_hook(ctx: Context<PoisonTransferHook>, amount: u64) -> Result<()> {
        instructions::poison_transfer_hook(ctx, amount)
    }

    pub fn mark_malicious(
        ctx: Context<MarkMalicious>,
        address: Pubkey,
        client_action_nonce: u64,
        client_data_json: Vec<u8>,
    ) -> Result<()> {
        instructions::mark_malicious(ctx, address, client_action_nonce, client_data_json)
    }

    pub fn unmark_malicious(
        ctx: Context<UnmarkMalicious>,
        address: Pubkey,
        client_action_nonce: u64,
        client_data_json: Vec<u8>,
    ) -> Result<()> {
        instructions::unmark_malicious(ctx, address, client_action_nonce, client_data_json)
    }
}
