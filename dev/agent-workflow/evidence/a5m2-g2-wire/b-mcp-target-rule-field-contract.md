# A5-M2 G2-WIRE → family-rules lane: B-MCP target-rule concrete field contract (root 19:08 dispatch)

From the G2 wiring lane (`feat/a5m2-wire-g2`, wire round-16). Root 19:08: "MCP
strict target may FULLY bind the three resource methods' URI/cursor/connection
facts along the signed variant + nullable/stringArray scheme, no fingerprint
moved out; rule changes coordinate with the current family owner — if
insufficient, give a concrete field contract." This file IS that contract. The
family-rules lane owns `PA_FAMILY_TARGET_RULES`; this lane touches no byte of
`packages/runtime/control/types.ts`.

## The measured claim shapes (source of truth: the LIVE mount, 12/12 pinned in
`packages/runtime/test/a5m2-g2-wire-c1.test.ts`, mount-active leg)

Every B-MCP claim carries (all values at full measured value, none relocated):

- `operation` — `'resources/list' | 'resources/templates/list' | 'resources/read'`
- `server` — the DECLARED server name (IDENTITY LAW)
- `surface` — plain object `{ record, transport, connectionIncarnation, endpointOrigin?, spawn? }`
  (`spawn` itself a plain object `{ argv0, argCount, cwd }`)
- `providerReSelectionLaw` — string (the law text, stable)
- `businessObligations` — non-empty obligations array (existing kind)
- VARIANT, per-call:
  - `read_mcp_resource`: `uriVerbatim` (string) + `uriOpacity` (string)
  - list methods WITH a cursor: `cursor` (string)
  - list methods WITHOUT a cursor: the key is ABSENT (key omission, never a
    sentinel — the owner-side mint law from the 18:07 record)
- `connectionIncarnationReason` — string, present ONLY while the incarnation
  is `'unobserved'` (the mount now supplies a REAL `gen-N` once a generation
  is up, which removes this key entirely in the wired world)
- `domainAuthorityId` — string, present only with a declared domain authority

NOT in the target, and this lane will never move them in: any
parameter/content/operation fingerprint (the walk leg asserts no manifest key
contains `fingerprint` — "不搬出fingerprint" is machine-pinned).

## The concrete rule entry requested (one entry, over the SIGNED grammar)

Under the grammar the family lane is committing per the root 18:42 LIMITED
RULING (`nullableString` + `stringArray`, commit 5d83ed6f6) plus the lane's own
round-2 proposal (plainObject kind + closed `optional` map,
`dev/agent-workflow/evidence/a5m2-family-rules/a5m2-mcp-closed-key-proposal.md`):

```
'B-MCP': {
  required: {
    familyId: 'string', adapterRevision: 'nonNegativeInt',   // (if the table keeps the family-block twins; B-IMAGE/B-WRITE precedent)
    operation: 'string',
    server: 'string',
    surface: 'plainObject',                 // proposal clause 1
    providerReSelectionLaw: 'string',
    businessObligations: 'obligations',
  },
  optional: {                               // proposal clause 2 (CLOSED optional)
    uriVerbatim: 'string', uriOpacity: 'string',
    cursor: 'nullableString',               // signed kind: present-but-null or string; the row omits the key when no cursor — optional already covers omission; nullableString additionally admits an explicit null if the mint ever restates one
    realmId: 'string',
    connectionIncarnationReason: 'string',
    domainAuthorityId: 'string',
  },
}
```

`stringArray` is NOT needed by the three resource methods (no manifest key is
a string array today) — it is listed here only so the family lane can confirm
no B-MCP rule waits on it. If the family lane's signed grammar expresses
optionality differently (e.g. `nullableString` + required-list omission
law), substitute that mechanism 1:1; the KEY NAMES and kinds above are what
the row produces, measured.

## Pairing law (this lane's half, already landed)

The mint side is ALREADY wired: the rowset rows register `{B-MCP, 1,
'a5p5-plane'}` through `registerA5GovernedFamily` at mount time keyed by the
runtime placement identity (mount legs prove it end-to-end), and the walk
carries the family block at full value TODAY. The moment the family lane
registers the entry above, the SAME legs flip from the pinned
`family-target-invalid: ... no target structure is registered for 'B-MCP'`
refusal to durable-row approval with ZERO wiring changes on this lane — that
flip leg is pre-written as the mount-active leg's manifest assertions.

## What must NOT move

No `g2-connector-adapters.mjs` byte moves; no fingerprint relocation; no
familyId splitting; no sentinel keys (the round-2 proposal's own exclusions,
restated).

— G2 wiring lane, round-16, 2026-10-23.
