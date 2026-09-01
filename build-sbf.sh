#!/bin/sh
# SBF-build voor active-defense, met platform-tools v1.52 GEPIND.
#
# WAAROM GEEN PLAIN `cargo build-sbf`:
#   cargo-build-sbf 4.1.0 default naar platform-tools v1.54 (rustc-fork
#   daa3af4), die voor dit programma een DEFECTE .so produceert:
#     "Access violation writing 48 bytes at address 0x8 (in unallocated region)"
#   bij attach_transfer_hook, 446 CU (null/base-pointer-write).
#   v1.52 (rustc-fork 790f153) produceert een WERKENDE .so (E2E volledig groen).
#   Zie STATUS.md sectie 30 voor het volledige diagnostiek-verloop en bewijs.
#
# Gebruik: ./build-sbf.sh   (optioneel met doorgeef-args, bijv. --debug)
exec cargo build-sbf --tools-version v1.52 "$@"
