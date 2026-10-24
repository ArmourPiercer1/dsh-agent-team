# Round-18 (root 20:04) — three narrow cleanup fixes + full-suite attribution

FIXES (agent-bindings, all within the G2 blocks + the ONE drain line they require):
1. plane-build refusal (built.ok!==true) and 2. placement refusal (placed.ok!==true)
   now AWAIT a5G2Mount.dispose() BEFORE throwing (window between mount success
   and the disposer push closed); close failures ride observations AND the
   thrown message; the refusal stays the cause; a5G2Mount cleared so the later
   disposer never double-closes.
3. teardown chain: placed.dispose() REJECTION no longer skips the G2 close —
   both are attempted, the plane rejection is thrown as the PRIMARY error
   ({cause} kept) with the G2 failure joined, G2-only failure throws its own
   error; and the close() drain (6351) now AWAITs promise-valued disposers on
   the real async chain, rejections recorded with their message (the
   synchronous law of every other disposer is unchanged — no lifecycle rework).
STATED PRECISION (root): r1 staleness means NEW approvals must be minted
against r2 rows (remount); it is NOT an automatic revocation of already-live
mounts.

FULL-SUITE ATTRIBUTION (evidence/a5m2-g2-wire/vitest-bindings-regression-round18
.log + vitest-suspects-isolated-round18.log): the accidental full-suite run
(442 files) showed 19 failures; run ISOLATED: p6t3-mediation/restart,
a5w-integration-wiring, a5p4/a5p7 lane-hygiene ALL PASS (shared-world
interference under the mega run, pre-existing character). a5m2-g1-surface-
adapters fails exactly the 8 legs the owner commit itself names ("G1 lane
NO-REGRESS exactly the 8 known re-anchor pins") — the spec re-anchors live on
the owner G1 lane, NOT in the family-rules chain picked here; fixing them
would be reaching into another lane's spec face (declined per 不泛改/
ownership); the CENTER merge carrying the owner G1 re-anchor closes them.
a5m2-g2-team-assembly = the proven venue block (no test-use checkout here).

SUPPLY PRODUCER (本族实际推进): g2-team-mount.mjs now EXPORTS
createG2TeamAssemblySupply({entryPaths, mcpResources, makeTransport,
consumeBrowserApproval, callResource}) — real PUBLIC entry loading through the
owner-sIGNED loadG2TeamAssemblyEntries (no second loader), scope face +
transport factory REQUIRED pass-throughs named to their real producers
(host mcp scope layer / host mcp connection layer), browser supply
ALL-OR-NOTHING with typed refusal on half supply. The host row assembly
feeding deps.g2TeamAssembly() remains the single remaining wiring hop outside
this family region — recorded, not dumped.
