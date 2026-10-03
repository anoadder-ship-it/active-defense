#!/usr/bin/env python3
"""Vergelijk de on-chain ELF met een lokale .so — correct, ook met gereserveerde ruimte.

Waarom dit bestaat: een ProgramData-account is bij deploy opgeslagen op
`45 + max_data_len` byte en de loader vult aan met nullen (STATUS §72, §76).
De hele regio hashen geeft dus schijn-mismatch zodra er gereserveerd is.
Correct is alleen de eerste `len(lokale .so)` bytes van de ELF vergelijken.

Gebruik: elf-hash-vergelijk.py <program-id> <pad-naar.so> [--url <rpc>]
Exit 0 gelijke ELF, 1 verschil of fout.
"""
import sys, json, urllib.request, base64, hashlib

A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
def b58d(s):
    n = 0
    for ch in s: n = n * 58 + A.index(ch)
    return n.to_bytes(32, "big")
def b58(b):
    n = int.from_bytes(b, "big"); s = ""
    while n: n, r = divmod(n, 58); s = A[r] + s
    return "1" * (len(b) - len(b.lstrip(b"\x00"))) + s

def rpc(url, m, p):
    q = urllib.request.Request(url, data=json.dumps({"jsonrpc":"2.0","id":1,"method":m,"params":p}).encode(),
                               headers={"Content-Type":"application/json"})
    r = json.loads(urllib.request.urlopen(q, timeout=45).read())
    if "error" in r: raise SystemExit(f"RPC-fout: {r['error'].get('message')}")
    return r["result"]["value"]

def main():
    args = [a for a in sys.argv[1:]]
    url = "https://api.mainnet-beta.solana.com"
    if "--url" in args:
        i = args.index("--url"); url = args[i+1]; del args[i:i+2]
    if len(args) != 2:
        raise SystemExit(__doc__)
    pid, so = args

    lokaal = open(so, "rb").read()
    h_lokaal = hashlib.sha256(lokaal).hexdigest()

    prog = rpc(url, "getAccountInfo", [pid, {"encoding":"base64"}])
    if not prog: raise SystemExit(f"geen account voor {pid} op {url}")
    pda = b58(base64.b64decode(prog["data"][0])[4:36])
    pd = rpc(url, "getAccountInfo", [pda, {"encoding":"base64"}])
    if not pd: raise SystemExit(f"geen ProgramData {pda}")
    raw = base64.b64decode(pd["data"][0])

    off = raw.find(b"\x7fELF")
    if off < 0: raise SystemExit("geen ELF-magie in ProgramData — geen programma?")
    regio = len(raw) - off
    knip = raw[off:off+len(lokaal)]
    h_onchain = hashlib.sha256(knip).hexdigest()

    print(f"  ProgramData      {pda}")
    print(f"  ELF-regio on-chain {regio} byte (max_data_len), code {len(lokaal)} byte")
    print(f"  sha256 lokaal      {h_lokaal}")
    print(f"  sha256 on-chain-knip {h_onchain}")
    if regio > len(lokaal):
        print(f"  opvulling: {regio-len(lokaal)} byte NUL "
              f"(alleen de eerste {len(lokaal)} zijn vergeleken)")
    if h_onchain == h_lokaal:
        print("  GELIJK — het gedeployde bytecode is de lokale build")
        return 0
    print("  VERSCHIL — dit is niet de build die je dacht te deployen")
    return 1

sys.exit(main())
