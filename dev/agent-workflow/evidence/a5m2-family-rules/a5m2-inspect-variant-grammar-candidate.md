# A5-M2 B-INSPECT variant grammar — exact short interface CANDIDATE (not implemented)

Status: **CANDIDATE awaiting root ruling** (root 957: "只给精确短接口候选,不新
schema框架/泛测,不改已PASS标量"). Nothing here is implemented; the signed
scalar floors stay byte-identical; the refused `inspectTarget: 'obligations'`
pairing is REVERTED from rule and mint (variant facts ride their measured
BASE form inside the target, so the fingerprint keeps every fact; every real
B-INSPECT claim fails closed at the grammar gate — pinned by
packages/runtime/test/a5m2-family-rules-c1.test.ts leg 2).

## 1. The measured variants (g1-surface-adapters.mjs classify, runtime-verified)

Shared by every B-INSPECT claim (SIGNED floor, untouched):
`topologyRevision (int)`, `topologyDigest (str)`,
`trusted×5 (str: memberAgentId/sessionHeaderId/realmId/owner/profileId)`.

Variant facts (measured base form, still inside the target):
- rec 53 list: `listLaw = <law string>` — NO query triple exists (a list
  targets the whole CURRENT authorized topology).
- rec 54 host-query: `queryClaim = { platform:'host', provider, method }` —
  NO roundtrip law.
- rec 54 client-query: `queryClaim = { platform:'client', provider, method }`
  + `clientRoundtrip = <law string>`.

Cross-leaf pairing required by the semantic: the triple is ONE correlated
fact (never partial); the roundtrip law is present ⟺ platform==='client'.

## 2. Why NO existing closed leaf expresses this (measured, two independent obstacles)

The law (control/types.ts validatePaFamilyTarget): ONE exact key set per
familyId; every present key typed; unknown key denies. Kinds: `string`
(length>0), `boolean`, `nonNegativeInt`, `countsTriple` (the fixed
{pending,inProgress,completed} triple), `obligations` (non-empty object
array, INTERIOR UNVERIFIED).

Obstacle A — variant key sets vs one closed key set. listLaw is absent from
query claims and clientRoundtrip absent from host/list claims; a required
leaf that a real claim lacks denies `absent`, so a union key set is
impossible; an intersection drops facts from the approved target — moving
approved content out of the fingerprint is FROZEN. A present-with-sentinel
leaf is a fabricated fact — forbidden.

Obstacle B — no strict kind for the correlated triple. A free string leaf or
the obligations array carries it unverified: root 957 refused exactly this
(pinned live in the spec, leg 6: `businessObligations: [{}]` and
`[{anything:1},{nope:[1,2]},{}]` both VALIDATE under the generic
'obligations' kind). countsTriple is fixed to the todo triple. No existing
kind checks a named triple of strings.

⇒ not expressible with existing closed leaves ⇒ minimal contract delta
below. (Rejected non-candidates: wide-object kind = the forbidden bypass;
delimiter-encoded strings = same unverified-content flaw as obligations;
per-variant familyIds = family-identity drift, earlier ruling; a general
nested-schema mini-language = the "new schema framework" root forbade.)

## 3. THE candidate: one optional rule member — discriminated variants reusing the EXISTING closed check

```ts
export interface PaFamilyTargetRule {
  readonly required: Readonly<Record<string, PaFamilyTargetFieldKind>>   // unchanged
  readonly currentFields: readonly string[]                              // unchanged
  /** VARIANT GRAMMAR (the whole delta): this family's claims share `required`
   *  and differ by exactly ONE discriminated group. `variantKey` is itself a
   *  required 'string' leaf whose value selects the group; each group is
   *  checked by the SAME closed law (exact key set, every key typed, nothing
   *  else). No new kind, no nesting, no optionality, no wide object. */
  readonly variants?: Readonly<{
    variantKey: string
    by: Readonly<Record<string, Readonly<Record<string, PaFamilyTargetFieldKind>>>>
  }>
}
```

Validator delta — ~10 lines inside the existing function, same violation
string shapes, zero I/O:

```ts
if (rule.variants !== undefined) {
  const v = rule.variants
  const value = record[v.variantKey]                       // kind-checked by the required loop ('string')
  const group = typeof value === 'string' ? v.by[value] : undefined
  if (group === undefined) return `${v.variantKey}: no '${String(value)}' variant in the ${familyId} typed plan`
  for (const [field, kind] of Object.entries(group)) {
    if (!(field in record)) return `${field}: required by the ${familyId} typed plan, absent`
    if (!isPaFamilyTargetField(kind, record[field])) return `${field}: not a ${kind}`
  }
  // the extra-key loop closes over Object.keys(required) ∪ Object.keys(group)
}
```

Pairing is enforced by the CLOSED GROUPS themselves (the same law the whole
table already relies on): a partial triple denies `absent`; a roundtrip law
on a host/list claim denies `not part of the typed plan`. The delegate then
reads NAMED, GRAMMAR-VERIFIED leaves (`record.queryPlatform` …) — no `[0]`,
no unchecked interior, mint discipline nowhere load-bearing.

## 4. Application (exact claim -> rule; mint-side delta = one derived leaf per claim)

Mint adds ONE derived scalar leaf per B-INSPECT claim (minted from
classify-time truth, never model text — the same pattern as the signed
`operation: 'replace-list'` / `'read-exact-file'` literal leaves), and the
triple flattens to three named string leaves; everything else byte-identical:

- `inspectVariant: 'string'` ∈ {'list','query-host','query-client'}
  (rec 53 → 'list'; rec 54 + claim.platform → 'query-host'|'query-client')

| measured nested fact | flat leaf | kind | where |
| --- | --- | --- | --- |
| topology.topologyRevision | topologyRevision | nonNegativeInt | required (SIGNED, unchanged) |
| topology.topologyDigest | topologyDigest | string | required (SIGNED, unchanged) |
| trusted.X | trustedX ×5 | string | required (SIGNED, unchanged) |
| (record/platform identity) | inspectVariant | string | required (new leaf, discriminant) |
| listLaw (rec 53) | listLaw | string | variants.by['list'] |
| queryClaim.platform (rec 54) | queryPlatform | string | variants.by['query-host'/'query-client'] |
| queryClaim.provider (rec 54) | queryProvider | string | same group |
| queryClaim.method (rec 54) | queryMethod | string | same group |
| clientRoundtrip (rec 54 client) | clientRoundtrip | string | variants.by['query-client'] ONLY |

Equivalence: same facts, same full values, all INSIDE the target — the
approved question and its fingerprint keep every fact (root 957: no move
out); the encoding is a bijection; the edge re-verify reads the same
topology scalars + the named triple leaves with identical verdicts/words.

Not a schema framework: no recursion (groups are flat leaf maps), no new
field kind (selection only reuses `isPaFamilyTargetField`), no optional
keys, no wildcards; the closed-key law remains the ONLY law, evaluated once
over `required ∪ by[discriminant]`. Table-integrity guard (same change):
`variants.variantKey` must be in `required` with kind 'string' (validate on
use, like every other table law).

## 5. Original gaps listed SEPARATELY (root 957: "CONTROL完整…事实仍原缺口单列, trusted ACCEPT非全族闭")

- **B-CONTROL full claims**: the target of records 83/84/85/87/88 carries
  ONLY the five trusted leaves (signed). The request/case/permission-subject/
  revision/action facts ride classifiedArgs/effects, NOT the target —
  measured faces: 83 `rootSessionId, requestToken, kind, targetInstanceId,
  actionName (+toolName, summary)`; 84 `rootSessionId, requestToken,
  requestId, decision (+note)`; 85 `rootSessionId, requestToken (+limit)`;
  87/88 `rootSessionId, requestToken, targetInstanceId, rules`. Closing that
  gap is a SEPARATE pairing change (request identity + action facts INTO
  the target) — the trusted ACCEPT is not family closure.
- **B-MCP**: rule still unregistered, encoding FROZEN; the contract
  correction in a5m2-mcp-closed-key-proposal.md is NOT approved and NOT
  implemented. (Note: the §3 candidate alone does NOT express B-MCP — its
  `surface` is a nested object and its conditionals are argument-driven;
  B-MCP keeps its own unapproved delta and must be ruled separately.)

— measured and proposed by the a5m2-family-rules lane (feat/a5m2-family-rules),
2026-10-23 round 3; implementation waits on the root ruling.
