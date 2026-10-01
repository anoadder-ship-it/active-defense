//! Artefact-resolutie voor de harness.
//!
//! De harness hoort bij de `agent/harness`-werkboom; het programma wordt gebouwd
//! in de hoofdwerkboom (`main`). Dat is geen ongeluk: de twee projectdelen zijn
//! gekoppeld via contract en build-artefact, niet via elkaars broncode. Daarom
//! wijst de harness het `.so` expliciet aan en print hij het bij elke run, zodat
//! een meting altijd aan een specifieke binary hangt.
//!
//! Resolutie-volgorde:
//!   1. `$AD_SO` — expliciete override, wint altijd.
//!   2. de eigen boom: `../target/deploy/active_defense.so`.
//!   3. de hoofdwerkboom: `/home/michel/projects/active-defense/target/deploy/…`
//!
//! Regel 3 faalt luid als daar nog nooit gebouwd is. Dat is de bedoeling: een
//! harness die stilletjes een oude binary oppikt meet iets anders dan hij claimt.

use {
    sha2::Digest as _,
    std::path::{Path, PathBuf},
    std::time::UNIX_EPOCH,
};

pub const HOOFD_WERKBOOM_SO: &str =
    "/home/michel/projects/active-defense/target/deploy/active_defense.so";

/// Het `.so` dat getest wordt, plus welke regel hem koos.
pub fn so_path() -> (PathBuf, &'static str) {
    if let Ok(v) = std::env::var("AD_SO") {
        return (PathBuf::from(v), "$AD_SO");
    }
    let eigen = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("harness/ moet onder een repo-root liggen")
        .join("target/deploy/active_defense.so");
    if eigen.exists() {
        return (eigen, "eigen werkboom");
    }
    (PathBuf::from(HOOFD_WERKBOOM_SO), "hoofdwerkboom")
}

/// Vingerafdruk van het artefact: sha256 (verkort), omvang en bouwtijd.
/// Elke meting in deze harness hoort met deze regel te beginnen.
pub fn beschrijf(p: &Path) -> String {
    let bytes = std::fs::read(p).unwrap_or_default();
    let hash = sha2::Sha256::digest(&bytes);
    let mtime = std::fs::metadata(p)
        .and_then(|m| m.modified())
        .map(|t| {
            t.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0).to_string()
                + "s-sinds-epoch"
        })
        .unwrap_or_else(|_| "onbekend".into());
    format!(
        "{} | {} byte | sha256 {:02x}{:02x}{:02x}{:02x}… | gebouwd {}",
        p.display(),
        bytes.len(),
        hash[0], hash[1], hash[2], hash[3],
        mtime
    )
}

/// Fouttekst als het artefact ontbreekt — vertelt de lezer wat er dan moet.
pub fn ontbreekt_fout(p: &Path, regel: &str) -> String {
    format!(
        "geen {} gevonden (regel: {}).",
        p.display(),
        regel
    )
}

/// Deterministische ed25519-toets uit één byte. De harness meet compute units;
/// met willekeurige toetsen veranderen adressen, PDA-afleidingen en de
/// accountvolgorde in de boodschap mee, en dan is elke CU-vergelijking tussen
/// twee runs ruis. Vaste toetsen maken elke meting naverekenbaar.
pub fn vaste_toets(seed: u8) -> solana_keypair::Keypair {
    let mut s = [0u8; 32];
    s[31] = seed;
    solana_keypair::keypair_from_seed(&s).expect("vaste seed is een geldige ed25519-sleutel")
}

/// Deterministisch adres uit één byte, voor accounts die géén toets nodig hebben
/// (de gefabriceerde wallet en de spankwallet-owner-stand-in).
pub fn vaste_adres(markering: u8) -> solana_address::Address {
    solana_address::Address::new_from_array([markering; 32])
}

// ── Verbruikbewijs van getekende acties (STATUS §64) ───────────────────────
// Spiegelt `actie_identiteit` en de zaden uit het programma:
//   hash  = keccak256(tag || wallet || argumenten)
//   seeds = ["consumed", wallet, [tag], hash]
// De harness bouwt instructies met de hand; zonder dit account faalt élke
// AD-instructie op Anchor's AccountNotEnoughKeys.
pub const TAG_ATTACH: u8 = 1;
pub const TAG_ADD: u8 = 2;
pub const TAG_MARK: u8 = 3;
pub const TAG_UNMARK: u8 = 4;

pub fn consumed_adres(
    program: &solana_address::Address,
    wallet: &solana_address::Address,
    tag: u8,
    delen: &[&[u8]],
) -> solana_address::Address {
    use sha3::Digest as _;
    let tag_byte = [tag];
    let mut h = sha3::Keccak256::new();
    h.update(tag_byte);
    h.update(wallet.as_ref());
    for d in delen { h.update(d); }
    let hash = h.finalize();
    solana_address::Address::find_program_address(
        &[b"consumed".as_slice(), wallet.as_ref(), &[tag], hash.as_slice()],
        program,
    )
    .0
}
