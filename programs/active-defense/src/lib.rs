use anchor_lang::prelude::*;

mod errors;
mod instructions;
mod state;

use instructions::*;

declare_id!("FzeAZmQzcGgwizWdg1y2hpTr1E6JEXeMQTyDXWQrYkzK");

#[program]
pub mod active_defense {
    use super::*;

    /// Stelt de Token-2022 transfer hook in op de mint.
    /// De authorized list wordt opgeslagen in de transfer_hook_instruction data.
    pub fn create_poison_token(
        ctx: Context<CreatePoisonToken>,
        authorized_recipients: Vec<Pubkey>,
        client_action_nonce: u64,
        client_data_json: Vec<u8>,
    ) -> Result<()> {
        instructions::create_poison_token(ctx, authorized_recipients, client_action_nonce, client_data_json)
    }

    /// Token-2022 transfer hook: blokkeert transfers naar ongeautoriseerde ontvangers.
    /// Wordt aangeroepen door Token-2022 bij elke transfer van deze mint.
    pub fn poison_transfer_hook(
        ctx: Context<PoisonTransferHook>,
        authorized_recipients: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::poison_transfer_hook(ctx, authorized_recipients)
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
