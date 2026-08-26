use anchor_lang::prelude::*;

#[error_code]
pub enum ActiveDefenseError {
    #[msg("Invalid passkey prefix")]
    InvalidPasskeyPrefix,

    #[msg("Invalid passkey signature")]
    InvalidPasskeySignature,

    #[msg("WebAuthn challenge mismatch")]
    WebAuthnChallengeMismatch,

    #[msg("Missing WebAuthn challenge in clientDataJSON")]
    MissingWebAuthnChallenge,

    #[msg("Invalid WebAuthn type, expected 'webauthn.get'")]
    InvalidWebAuthnType,

    #[msg("User verification (UV flag) is required")]
    UserVerificationRequired,

    #[msg("Poison token authorized list is empty")]
    PoisonTokenAuthorizedListEmpty,

    #[msg("Poison token authorized list full")]
    PoisonTokenAuthorizedListFull,

    #[msg("Poison token unauthorized recipient detected")]
    PoisonTokenUnauthorizedRecipient,

    #[msg("Address already marked as malicious")]
    AddressAlreadyMalicious,

    #[msg("Malicious addresses list full")]
    MaliciousListFull,

    #[msg("Address not marked as malicious")]
    AddressNotMalicious,

    #[msg("Wallet account layout invalid")]
    InvalidWalletLayout,

    #[msg("Client action nonce does not match on-chain action nonce")]
    StaleActionNonce,
}
