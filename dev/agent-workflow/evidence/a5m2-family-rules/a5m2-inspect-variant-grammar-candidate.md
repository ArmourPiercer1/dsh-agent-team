# A5-M2 B-INSPECT discriminated target — IMPLEMENTED under the root 17:40 ruling

Status: **implemented on feat/a5m2-family-rules for the root's solo review**
(root 17:40: the 39c revert is accepted; the minimal strict discriminated
implementation is allowed as a technical encoding ruling, not a
security-semantics change — no longer proposal-only). INSPECT is NOT enabled:
nothing registers pa-mount-registry; the wire lane lands registration against
exactly these shapes later. CONTROL-full-target and B-MCP stay separate
(§5); the B-MCP proposal remains unapproved. The 957-era candidate text is
superseded by this implemented record.

## 1. The lawful set (control/types.ts PA_FAMILY_TARGET_RULES['B-INSPECT'])

`required` (exact, all claims): topologyRevision ('nonNegativeInt'),
topologyDigest ('string'), inspectVariant ('string'), trusted×5 ('string') —
the root-957 SIGNED scalar floor kept field-for-field, plus the discriminant.

One optional rule member (the whole grammar delta, used by THIS entry only —
no schema generalization): `variant: { leaf, by: { <exact value> -> { adds,
binds } } }`. `required ∪ selected adds` is the EXACT closed key set (same
violation strings); every leaf uses the EXISTING kinds; every `binds` entry
pins its leaf to ONE exact literal (full-value binding).

| variant (own-key selected) | adds (existing kinds) | binds (closed literals — full value) |
| --- | --- | --- |
| 'list' (rec 53) | listLaw: string | listLaw = the list-law text (never arbitrary) |
| 'query-host' (rec 54) | queryPlatform, queryProvider, queryMethod: string | queryPlatform = 'host' |
| 'query-client' (rec 54) | same triple + clientRoundtrip: string | queryPlatform = 'client'; clientRoundtrip = the roundtrip-law text |

Laws, exactly as ruled:
- **own-key discriminant**: `Object.prototype.hasOwnProperty.call(by, value)`;
  'toString'/'constructor'/'__proto__'/'valueOf'/unknown select nothing and
  deny (`inspectVariant: '<v>' selects no B-INSPECT variant group`); the
  extra-key law for variant families is own-key on BOTH maps, so a
  prototype-named claim key ('toString' …) denies like any extra key. (The
  original `in`-based law of the three pre-existing families is byte-identical
  — scoped narrow; disclosed observation: those families' targets are
  mint-only, so that path is unconstructible for them, and generalizing the
  law further is NOT done here.)
- **exact pairing**: variant↔queryPlatform bound by `binds`; the
  variant↔record pairing is mint truth: inspectVariant is derived inside
  effectsFor from spec.recordIndex + the authorized triple's platform — the
  closed parameter grammar (P_G1_CLASSIFY_UNKNOWN_PARAMETER) keeps model text
  out of the target, so the discriminant can never be model-supplied.
- **clientRoundtrip iff client, not an arbitrary string**: it exists ONLY in
  the 'query-client' closed group (anywhere else: 'not part of the typed
  plan'; missing there: 'required … absent') and is BOUND to the exact
  roundtrip-law text.
- **group structure legal**: a module-load guard throws AT IMPORT on any
  malformed variant table (discriminant not a required 'string' leaf, group
  redeclaring a required leaf, unknown kind, bound leaf outside the group or
  violating its own kind) — never quietly at a claim.

## 2. One encoding, full-value bound (rule/mint/edge); fingerprint intact

Mint (g1-surface-adapters.mjs, records 53/54) emits the SAME leaf names with
the SAME full values: { topologyRevision, topologyDigest, inspectVariant,
(listLaw | queryPlatform+queryProvider+queryMethod(+clientRoundtrip)),
trusted×5 }. Every fact rides the targetManifest — the approved question and
its fingerprint keep every one (nothing moved out; no effects/provider-scope
extension; no new ledger; currentFields stays the signed trusted trio).
Edge (reVerifyAtEdge) reads `plan.targetManifest` — the same bytes the rule
inspected — over the SAME flat leaves: topology scalars (unchanged source/
verdicts/words), and for the two query variants the triple as ONE correlated
fact (the closed group guarantees all three ride together). Current-facts
semantics unmoved; the allowed-triple authorization at classify is untouched.

## 3. Digest change: explicit revision invalidation, no silent translation

The encoding digest moved (new leaf set). Two explicit mechanisms:
1. `A5_G1_ADAPTER_REVISION 6 -> 7` — the approved family block pins
   adapterRevision (parsePaManifestFamilyBlock), so revision-6 approvals are
   explicitly stale at the PA walk against the revision-7 mount/plan; pinned
   by spec (constant === 7, reviewPayload.adapterRevision === 7).
2. The edge is a CLOSED switch: a stored target whose discriminant is not
   exactly 'list'/'query-host'/'query-client' refuses
   (`no closed G1 inspect variant … pre-revision-7 encodings are retired and
   never translated`). Grammar side, every retired shape denies too: the
   base-form targets lack the required discriminant ('inspectVariant:
   required … absent'); the 957a obligations-carrier form denies
   ('inspectTarget: not part …'). In-process replay of an old plan is
   independently impossible (delegate: P_G1_NOT_OWN_PLAN WeakMap).

## 4. Fixed-point contract checks (packages/runtime/test/a5m2-family-rules-c1.test.ts, 10/10 RC=0)

POSITIVE: three REAL classify outputs (53 / 54-host / 54-client) validate;
claim key sets = required ∪ selected group exactly; rule literals stand
mint-independently; fresh list + host delegates run the captured face; the
list delegate runs with zero authorized triples (no triple to lose).
NEGATIVE (each its own pinned string): discriminant absent/''/non-string;
unknown + prototype-named discriminants (nope/LIST/toString/constructor/
__proto__/valueOf); variant↔platform mismatch both ways; arbitrary-string
roundtrip refused; roundtrip missing in client / present in host; list law
refusing an arbitrary string; partial triple ('queryMethod … absent');
cross-variant leaf ('queryPlatform' on 'list'); retired base forms; retired
957a carrier; prototype-named claim key. Regression legs of the three
pre-existing rules byte-identical; the obligations-kind flaw (root 957)
remains pinned through B-IMAGE to document WHY this family does not use that
carrier. B-CONTROL real-classify ACCEPT kept — still NOT full-family closure
(§5). G1 lane run: exactly the 8 previously-listed re-anchor pins red
(:486 .trusted ×7 flattened records, :831 nested-topology pin) — no new break
category; a5m2-g1-query-wiring green.

## 5. Original gaps, listed SEPARATELY (unchanged by this change)

- **B-CONTROL full claims**: target = five trusted leaves only; the
  request/case/permission-subject/revision/action facts ride
  classifiedArgs/effects — measured faces: 83 rootSessionId/requestToken/
  kind/targetInstanceId/actionName(+toolName,summary); 84 +requestId/decision
  (+note); 85 +limit; 87/88 targetInstanceId/rules. A separate pairing change
  (request identity + action facts INTO the target) must close it; the
  trusted ACCEPT is not family closure.
- **B-MCP**: still unregistered; encoding FROZEN; its contract-correction
  proposal (a5m2-mcp-closed-key-proposal.md) is NOT approved. The INSPECT
  discriminated target does NOT express it (nested surface, argument-driven
  conditionals) and this change does NOT generalize the grammar for it.

— implemented by the a5m2-family-rules lane (feat/a5m2-family-rules) under the
root 17:40 ruling; INSPECT enablement (registration/wire) waits on the root's
review of exactly this source.
