# Aborted pre-Host attempt — 2026-11-04T07:19Z

**No start was consumed.** The driver threw `ReferenceError: relative is not defined` at
`run-boot.mjs:799` while building the run-record `bindings` literal, **before** the BL-14
pre-registration gate wrote a ledger row and before any Host was spawned.

Evidence of that ordering, from these captures: the log ends at `grant materialised: …`
with the stack trace, there is **no** ledger row (`ledger.jsonl` absent), no World home was
created, no port was released or bound, and no `node` process existed afterwards.

## Why it is kept

The grant file here is a **materialised draft**, not a spend: `maxStarts: 2` is the
intent+start arithmetic the gate would have used. Deleting the captures would make the
attempt invisible, and the next reader could believe the first of the three dedicated
P2-01 starts was spent here.

## What it changed

The defect was reachable **only** in boot mode — `planOnly()` never built that literal — which
is exactly how a typo can cost a start. `runBindings(head, grant)` is now a single function
called by both `boot()` and `--plan`, so the whole record literal is exercised host-free; a
broken binding now fails in `--plan` and in `dry-run.mjs` instead of after authorisation.
