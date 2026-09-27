//! Conformatietest: de wallet-layout die spankwallet WERKELIJK heeft, tegen de
//! offsets die onze spiegel (`crates/spankwallet-contract`) aanneemt.
//!
//! Waarom dit bestaat (STATUS §38): onze fixture staat bevroren op commit
//! `1fb3134`, maar het echte programma is intussen gegroeid. Elke fixture-test
//! blijft groen terwijl de werkelijke `WalletAccount` verandert — precies de
//! foutklasse die dit project al twee keer raakte. Deze test haalt de layout op
//! uit hun *broncode*, zoals die op dit moment op schijf staat, en botst die op
//! onze constanten. Drift wordt damit luid in plaats van stil.
//!
//! Geen enkele afhankelijkheid: pure tekstverwerking, dus hij draait ook als er
//! geen validator, VM of build bestaat.
//!
//! Bron: `$SPANKWALLET_STATE_RS`, anders `~/projects/spankwallet/programs/
//! spankwallet/src/state.rs`. Ontbreekt die, dan slaat de test over — luid, met
//! de reden.

use std::path::PathBuf;

const ONZE_SPIEGEL: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../crates/spankwallet-contract/src/lib.rs");

fn state_pad() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("SPANKWALLET_STATE_RS") {
        let p = PathBuf::from(p);
        if p.is_file() { return Some(p); }
    }
    let home = std::env::var("HOME").ok()?;
    let p = PathBuf::from(home).join("projects/spankwallet/programs/spankwallet/src/state.rs");
    p.is_file().then_some(p)
}

struct Veld { naam: String, ty: String }

/// Veldnamen en -types van `pub struct <naam> { ... }`, in bronvolgorde.
fn struct_velden(src: &str, naam: &str) -> Vec<Veld> {
    let start = match src.find(&format!("pub struct {naam} {{")) {
        Some(i) => i,
        None => panic!("struct {naam} niet gevonden in state.rs"),
    };
    let rest = &src[start..];
    let body = &rest[rest.find('{').unwrap() + 1..rest.find("\n}").unwrap()];
    body.lines()
        .filter_map(|l| {
            let l = l.trim();
            let rest = l.strip_prefix("pub ")?;
            let (n, t) = rest.split_once(':')?;
            Some(Veld { naam: n.trim().to_string(), ty: t.trim().trim_end_matches(',').to_string() })
        })
        .collect()
}

/// Grootte van een type in Borsh, voor zover deze test die kent. `None` bij een
/// onbekend type: dan moet er een mens kijken, niet een aanname.
fn type_grootte(ty: &str, passkey_len: usize, recovery_len: usize) -> Option<usize> {
    match ty {
        "u8" | "bool" => Some(1),
        "u64" | "i64" => Some(8),
        "Pubkey" => Some(32),
        "Option<Pubkey>" => Some(1 + 32),
        "Option<RecoveryState>" => Some(1 + recovery_len),
        // [u8; N] met N letterlijk, of [u8; PASSKEY_PUBKEY_LEN] opgelost uit hun
        // eigen constante — want een handmatige tabel is precies waar dit project
        // eerder op misging.
        t if t.starts_with("[u8; ") && t.ends_with(']') => {
            let n = t[5..t.len() - 1].trim();
            if n.chars().all(|c| c.is_ascii_digit()) { n.parse().ok() }
            else if n == "PASSKEY_PUBKEY_LEN" { Some(passkey_len) }
            else { None }
        }
        _ => None,
    }
}

/// Hoe de twee `Option`-velden worden geteld. Dit is geen kleinigheid: de offset
/// van `action_nonce` hangt er letterlijk van af (1 byte als None, 42/33 als
/// Some), en onze spiegel leest die offset variabele. Een enkele "de" offset van
/// action_nonce bestaat niet — dus wordt beide berekend.
#[derive(Clone, Copy)]
enum Opties { Min, Max }

fn offsets(velden: &[Veld], passkey_len: usize, recovery_len: usize, opties: Opties) -> Vec<(String, usize)> {
    let mut off = 8usize;
    let mut uit = Vec::new();
    for v in velden {
        let g = match (opties, v.ty.as_str()) {
            (Opties::Min, "Option<Pubkey>") => 1,
            (Opties::Min, "Option<RecoveryState>") => 1,
            _ => type_grootte(&v.ty, passkey_len, recovery_len).unwrap_or_else(|| {
                panic!("onbekend type '{}' op veld {} — conformatietabel aanvullen, niet gokken", v.ty, v.naam)
            }),
        };
        uit.push((v.naam.clone(), off));
        off += g;
    }
    uit
}

/// Onze eigen constanten, uit de bron van de spiegel gelezen (niet overgetypt).
fn onze_constante(naam: &str) -> usize {
    let src = std::fs::read_to_string(ONZE_SPIEGEL)
        .unwrap_or_else(|e| panic!("onze spiegel {} leesbaar? {e}", ONZE_SPIEGEL));
    for l in src.lines() {
        let l = l.trim();
        if let Some(rest) = l.strip_prefix(&format!("pub const {naam}: usize =")) {
            let rest = rest.trim().trim_end_matches(';');
            // constanten mogen een som zijn, bijv. `148 + 1 + 8 + 1 + 8`
            if !rest.chars().all(|c| c.is_ascii_digit() || matches!(c, '+' | '-' | '*' | '/' | ' ')) {
                panic!("kon {naam} niet evalueren: {rest}");
            }
            return eval_expr(rest);
        }
    }
    panic!("constante {naam} niet gevonden in onze spiegel");
}

fn eval_expr(s: &str) -> usize {
    let mut totaal = 0usize; let mut teken = '+'; let mut getal = String::new();
    let flush = |t: &mut String, teken: char, totaal: &mut usize| {
        if !t.trim().is_empty() {
            let n: usize = t.trim().parse().unwrap();
            *totaal = match teken { '+' => *totaal + n, '-' => *totaal - n, _ => unreachable!() };
        }
        t.clear();
    };
    for c in s.chars().chain(std::iter::once('+')) {
        if c.is_ascii_digit() { getal.push(c); }
        else if matches!(c, '+' | '-') { flush(&mut getal, teken, &mut totaal); teken = c; }
    }
    totaal
}

struct Grondslag { velden: Vec<Veld>, offs: Vec<(String, usize)>, pad: PathBuf }

fn grondslag() -> Option<Grondslag> {
    let pad = match state_pad() { Some(p) => p, None => {
        eprintln!("SLAAT OVER: spankwallet state.rs niet gevonden — zet SPANKWALLET_STATE_RS.");
        return None;
    }};
    let src = std::fs::read_to_string(&pad).expect("state.rs leesbaar");
    let passkey_len = {
        let marker = "pub const PASSKEY_PUBKEY_LEN: usize =";
        let i = src.find(marker)? + marker.len();
        src[i..].trim_start().chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().ok()?
    };
    let recovery: Vec<Veld> = struct_velden(&src, "RecoveryState");
    let recovery_len: usize = recovery.iter()
        .map(|v| type_grootte(&v.ty, passkey_len, 0).unwrap_or_else(|| {
            panic!("onbekend type '{}' in RecoveryState", v.ty)
        }))
        .sum();
    let velden = struct_velden(&src, "WalletAccount");
    let offs = offsets(&velden, passkey_len, recovery_len, Opties::Max);
    Some(Grondslag { velden, offs, pad })
}

fn offset_van<'a>(g: &'a Grondslag, veld: &str) -> usize {
    g.offs.iter().find(|(n, _)| n == veld)
        .unwrap_or_else(|| panic!("veld {veld} bestaat niet meer in WalletAccount"))
        .1
}

#[test]
fn owner_passkey_offset_klopt_met_onze_spiegel() {
    let Some(g) = grondslag() else { return };
    assert_eq!(offset_van(&g, "owner_passkey"), onze_constante("WALLET_OWNER_PASSKEY_OFFSET"),
        "owner_passkey staat in spankwallet op een andere offset dan onze spiegel aanneemt — layout gedrift\n  bron: {}",
        g.pad.display());
}

#[test]
fn recovery_state_tag_offset_klopt() {
    let Some(g) = grondslag() else { return };
    assert_eq!(offset_van(&g, "recovery_state"), onze_constante("OFFSET_RECOVERY_STATE_TAG"));
}

#[test]
fn recovery_state_grootte_klopt() {
    let Some(g) = grondslag() else { return };
    // onze RECOVERY_STATE_LEN is de payload zónder de Option-tag
    let mut her = 0usize;
    for v in struct_velden(&std::fs::read_to_string(g.pad.clone()).unwrap(), "RecoveryState") {
        her += type_grootte(&v.ty, 33, 0).expect("RecoveryState-type bekend");
    }
    assert_eq!(her, onze_constante("RECOVERY_STATE_LEN"));
}

#[test]
fn actie_nonce_offset_klopt_zonder_opties() {
    let Some(g) = grondslag() else { return };
    let src = std::fs::read_to_string(&g.pad).unwrap();
    let min = offsets(&struct_velden(&src, "WalletAccount"), 33, 41, Opties::Min);
    let mut off = None;
    for (n, o) in &min { if n == "action_nonce" { off = Some(*o); } }
    let off = off.expect("action_nonce in de min-layout");
    // WALLET_MIN_LEN is de ondergrens: genoeg bytes om action_nonce te lezen als
    // beide Options afwezig zijn.
    assert_eq!(off + 8, onze_constante("WALLET_MIN_LEN"),
        "onze minimum-lengte dekt action_nonce niet meer op de huidige layout (min-offset {})", off);
}

#[test]
fn veldvolgorde_tot_action_nonce_is_ongewijzigd() {
    let Some(g) = grondslag() else { return };
    let verwacht = ["seed_key", "wallet_seed_hash", "owner_passkey", "bump", "vault_bump",
                    "created_at", "backup_authority", "recovery_state",
                    "recovery_timelock_seconds", "deposit_authority", "action_nonce"];
    let echt: Vec<&str> = g.velden.iter().map(|v| v.naam.as_str()).take(verwacht.len()).collect();
    assert_eq!(echt, verwacht,
        "veldvolgorde gewijzigd: alles wat hierna komt verschuift en onze lezers \
         lezen dan stil de verkeerde bytes");
}

/// Documenteert de actuele layout in de testoutput, zodat een drift-melding niet
/// alleen zegt dát het mis is maar wát er staat.
#[test]
fn layout_tabel() {
    let Some(g) = grondslag() else { return };
    let src = std::fs::read_to_string(&g.pad).unwrap();
    let min = offsets(&struct_velden(&src, "WalletAccount"), 33, 41, Opties::Min);
    println!("WalletAccount-layout volgens {}", g.pad.display());
    println!("  {:>4}  {:>4}  veld", "min", "max");
    for ((n, mn), (_, mx)) in min.iter().zip(g.offs.iter()) {
        let markeert = if n == "action_nonce" || n == "owner_passkey" || n == "recovery_state" { "   ← onze spiegel leest hier" } else { "" };
        println!("  {mn:>4}  {mx:>4}  {n}{markeert}");
    }
}
