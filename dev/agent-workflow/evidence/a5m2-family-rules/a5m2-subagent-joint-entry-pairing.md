# A5M2 B-SUBAGENT joint table entry — pairing record (root 21:20 joint approval)

ONE table writer for this entry: the a5m2-family-rules lane (root 21:20). The
entry lands in `packages/runtime/control/types.ts` `PA_FAMILY_TARGET_RULES`
with spec legs `test/a5m2-family-rules-c1.test.ts` round 9.

## Measured pins (read-only)
- SPAWN lane: `feat/a5m2-new-family @8c314fb94b3a694f0cc1acd14c9b9b73a36ff10b` —
  `subagent-spawn-adapters.mjs` `mintTarget` :347-366, `RECORD_SPECS` :111-116
  (records 39-43), `A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION = 1`;
  `subagent-spawn-wiring.mjs` `targetManifest` :154-165,
  `A5_B_SPAWN_WIRING_REVISION = 1`.
- CONTROLS lane: `feat/a5m2-subagent-fix @6166344117088870799f6f64c915f872dd7e3b41` —
  `subagent-adapters.mjs` `mintTarget` :490-520, trio rows 44-46, adapter rev 1,
  UNWIRED by their ruling; row-level `effectDelta` :471 (spawn :337 likewise).
- Both lanes' `canonicalJson`: sorted-key `JSON.stringify` (controls module
  :234-238) — complete reversible canonical JSON, NOT a digest; key ORDER is
  deterministically normalized; null / `''` / unknown legal args keys / full
  text survive the round-trip (pinned by spec leg 完整值往返).

## Joint entry shape vs card — deltas REPORTED (nothing fabricated)
1. The card lists `action` in the shared required set. The SIGNED guard law
   (module-load legality) permits binds ONLY over a group's own `adds`, so
   `action` rides every group's adds+binds (round-7 signed B-MCP pattern);
   presence is still enforced for all eight rows (adds loop) and the bind
   pins `action` to the row's operation. Measured true: both lanes mint
   `target.action === plan.operation`.
2. `argsCanonical` / `namedGapsCanonical` are joint MINT additions: neither
   projection emits them at the measured pins. Each lane changes ONLY its own
   mint (root 21:18). Until those land, joint claims fail closed at
   `argsCanonical: required by the B-SUBAGENT typed plan, absent` — pinned;
   no silent translation of old approved shapes.
3. The spawn lane's earlier flat `B-SUBAGENT` entry (their tree's types.ts)
   is SUPERSEDED at merge: key-set/currentFields legs re-anchor VISIBLY
   (their `targetManifest` gains the two canonical leaves; currentFields
   `['operation','contract']` -> `['operation','action']`).
4. Controls-side flatten (caller/address{claim,relation,adjudication}/budget +
   plan recordIndex -> flat leaves named per the card) is their card-delivered
   mint change; the entry types exactly those names.
5. No fingerprint-key law exists in either mint — none pinned.

## Law carried, not encoded
Two-branch delegate-style laws, service adjudications, `''`-legal published
faces, and the whole named-gaps semantics stay mint/service-side (root
19:25: no hand-mirrored constraints). The table is a type gate ONLY: no C2,
no wiring tier change, no registration here. B-SUBAGENT claims were and stay
fail-closed at the bridge until BOTH the entry (this commit) and each lane's
mint delta land.
