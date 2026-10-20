# ROOT ruling X - bridge-specific opaque scope keys: CONSUMERS PROOF TABLE (file:line, this HEAD)

ONE derivation helper (collision-safe JSON-array tuple; no colon concat):
| what | where |
| --- | --- |
| helper DEFINITION `jobsBridgeScopeKey` -> `JSON.stringify([realmId, rootSessionId, instanceId])` | packages/runtime/jobs-gateway/types.ts:114 |
| lane barrel export | packages/runtime/jobs-gateway/index.ts:18 |
| live row RE-EXPORT (entry reaches the lane ONLY through the row - GLUE-5 edge law) | packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs:52 (one barrel import line, name-list grew per the C1 precedent), :58 `export { jobsBridgeScopeKey }` |
| entry single import line (row only, never the barrel - re-pinned) | packages/runtime/src/plugin/live/agent-bindings.mjs:443 |
| PRODUCTION MOUNT (the only production key site) | packages/runtime/src/plugin/live/agent-bindings.mjs:2446 |
| bridge ensure -> register | packages/runtime/src/plugin/live/plane-effect-backends.mjs:979 |
| bridge WITHDRAWAL invalidate (exact member scope; stale pin never masquerades as revocation) | plane-effect-backends.mjs:971 + store `unregister` at jobs-gateway-assembly.mjs (definition store delete) |
| store key (scopeKey opaque, single row per (scope,name)) | jobs-gateway-assembly.mjs:91 |
| admission reader + record write (admit-time input.scopeKey) | jobs-gateway/jobs-gateway.ts:203, :209, :232 |
| records/recheck read the STORED scope - never re-derive | jobs-gateway.ts:209 (record.scopeKey = admitted value); the owner fence is the INDEPENDENT jobOwnerKey dimension (types.ts:78) |
| bridge read-only `scopeKey` ACCESSOR (future producers consume it, never recompute) | plane-effect-backends.mjs:1164 |
| tests consume the SAME helper (scopeOf) | packages/runtime/test/a5p7-jobs-assembly-actuator.test.ts:66, :79 |

Cross-root collision face (blueprint-exlicit realm shared across two team roots):
BOTH belts hold - (a) the triple tuple carries rootSessionId (real mount-site
ID, never invented; taken even though per-root isolation exists, per ruling);
(b) per-root isolation: the ONLY definition-store holder is the live assembly
created per team root (agent-bindings.mjs:771 map, :2505-2507 per-root set,
:2449 gatewayRow reads its OWN teamRoot) - another root's store is unreachable
either way. Proven by test: same instanceId under two roots -> distinct keys,
foreign admit fail-closes at never-registered.

Matrix (all green in a5p7-jobs-assembly-actuator.test.ts): A/B distinct
def-ids; A->B->A third call still A; replace-B-keeps-A; replace-A-keeps-B;
WITHDRAWN feed invalidates the exact member scope (fresh admit fail-closes,
other member keeps its pin); different roots x same instanceId; delimiter
injection ('realm-a","realm-b' vs split-differently - the naive concat would
collapse, the tuple cannot); read-only accessor. Observer diagnostics now
carry the tuple form in `scope=` (recorded here; also `definition-invalidated`).

Receipt label (root accounting): host-receipt = SYNTHETIC JobRead VECTORS
fed side-by-side to the host's own render code and our dist-mirror bridge -
RENDER-BOUNDARY coverage over synthetic reads ONLY; NOT live-registry, NOT
model-cursor, NOT wait-timeout coverage. Basename spill redaction = recorded
sanctioned divergence; fine newline difference noted as non-blocking.
