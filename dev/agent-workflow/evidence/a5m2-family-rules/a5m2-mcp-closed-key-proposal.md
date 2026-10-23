# A5-M2 B-MCP closed-key accommodation — PROPOSAL ONLY (not implemented)

Status: **proposal awaiting root/user ruling.** The MCP encoding is FROZEN (root
ruling, round-2 card): no MCP mint change, no field relocation, no deletion
ships in any lane until this ruling lands. B-MCP stays the named gap — every
full-family B-MCP claim fails closed at `validatePaFamilyTarget` with
`familyId: no target structure is registered for 'B-MCP'` (pinned by the g2
wire lane, bc6cf5ed6 test/a5m2-g2-wire-c1.test.ts:771-772, and by
packages/runtime/test/a5m2-family-rules-c1.test.ts leg 5).

## The measured problem (source: packages/runtime/src/plugin/live/governed-families/g2-connector-adapters.mjs:730-762)

Every real B-MCP claim (records 55/56/57: list_mcp_resources,
list_mcp_resource_templates, read_mcp_resource) carries:

- a nested `surface` OBJECT on EVERY claim (:733) — the surface:mcp_stdio /
  surface:mcp_http_dynamic record with spawn/endpointOrigin facts;
- per-call CONDITIONAL keys: `connectionIncarnationReason` (only while the
  incarnation is 'unobserved', :739), `domainAuthorityId` (only with a declared
  domain authority, :740), `uriVerbatim` + `uriOpacity` (read_mcp_resource
  only, :753-754), `cursor` (list calls that carry one, :760).

`PA_FAMILY_TARGET_RULES` (packages/runtime/control/types.ts) admits exactly one
CLOSED key set per family, over the kind union
`string | boolean | nonNegativeInt | countsTriple | obligations`; none of the
five kinds accepts a plain nested object (`countsTriple` = ONLY
{pending,inProgress,completed}; `obligations` = non-empty ARRAY of objects).
Therefore NO rule over the measured shapes exists inside the current grammar:
omitting `surface` denies every real claim at the extra-key law; the
conditional keys cannot all be required (base claims would lack them) nor all
be absent (variant claims carry facts that must be typed).

## Ruled out (root rulings, restated for the record)

- Moving the five conditional keys or `surface` to obligations/execution
  layers that do not participate in the full-manifest digest and current facts
  — FROZEN: those bytes ride the durable manifest, hence the
  `operationFingerprint`; relocating them would change the approved question.
- Deleting keys "to please closed-key" — forbidden guess.
- FamilyId splitting per tool/transport — family-identity drift.
- Sentinel/padding values — fabricated facts in an approved target.

## THE ONE minimal contract correction (validator/closed-key accommodation)

Two inseparable clauses of ONE change to the same table contract
(`PaFamilyTargetRule` + `isPaFamilyTargetField`), nothing else:

1. **One new field kind `'plainObject'`**: a non-empty plain object whose every
   member recursively satisfies the EXISTING `isLosslessJsonValue` walk. This
   is the shape fact `surface` needs; it introduces no sub-schema, no nested
   rule language, no schema system — one membership test, one kind.
2. **An `optional` typed-leaf map beside `required`** on each rule entry:
   a target is valid iff every `required` key is present and typed, every
   PRESENT optional key satisfies its kind, and NO other key appears. The law
   stays CLOSED (unknown key = deny); it merely lets one rule describe the
   claims ONE lane actually produces instead of forcing a key set no claim
   ever has.

Paired landing (pairing law, one change): clause 1+2 + `PA_FAMILY_TARGET_RULES`
gain

```
'B-MCP': required { operation: 'string', server: 'string',
                    providerReSelectionLaw: 'string',
                    businessObligations: 'obligations' }
         optional { surface: 'plainObject',
                    connectionIncarnationReason: 'string',
                    domainAuthorityId: 'string',
                    uriVerbatim: 'string', uriOpacity: 'string',
                    cursor: 'string' }
```

together with the wire lane's `registerA5GovernedFamily` mint side — no
`g2-connector-adapters.mjs` byte moves.

## M0 semantic-equivalence argument

M0 baseline semantics (the frozen docs): the durable row's manifest IS the
approved question at FULL VALUE; the `operationFingerprint` digests those exact
bytes; approval and execution read the SAME immutable plan; the raw target
manifest is walked for losslessness BEFORE any rewrite (f696e6f28, b83b913a2).

- The correction changes the VALIDATION GRAMMAR ONLY: no claim byte, no mint,
  no digest, no effect set, no grant/consume path moves. Every MCP claim that
  denies today still denies, EXCEPT exactly the four measured shapes, which
  become approvable at their full measured value.
- Fail-closed everywhere else is untouched: unknown familyId still denies
  (`no target structure is registered`), an unlisted key still denies
  (`not part of the … typed plan`), a present key is still typed, a partial
  carrier still fails `parsePaManifestFamilyBlock`, the lossless raw walk still
  runs before anything durable.
- Cross-leaf correlations and current facts are preserved because the durable
  manifest keeps every one of the six keys at full value — the named-blocker
  honesty (`connectionIncarnation: "unobserved"` + reason), the IDENTITY LAW
  (server = declared server), the OPAQUE-URI law and the cursor pass-through
  all remain facts the human approves and the fingerprint binds.
- Hence semantic equivalence: the same questions are asked, answered and
  executed; only the approvable set grows by exactly the four shapes the lane
  already mints. The anti-drift purpose of closed-key survives: every
  approvable key is named AND typed in the table.

— measured and proposed by the a5m2-family-rules lane (feat/a5m2-family-rules),
2026-10-23 round 2; implementation waits on the root/user ruling.
