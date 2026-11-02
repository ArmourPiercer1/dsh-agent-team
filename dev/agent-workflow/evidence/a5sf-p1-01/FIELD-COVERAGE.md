# P1-01 · v4 reuse vs. the minimal Member-ceiling increment — field coverage evidence

- **Task**: P1-01 of `docs/plans/memo/alpha5-sandbox-first-20261101/IMPLEMENTATION-PLAN.md`
  (entry task of the P1 policy lane; Gate **G1.1**).
- **Branch / worktree**: `task/a5sf-p1-01-20261102` @ `.worktrees/a5sf-p1-01`, based on
  PR #531 head `8bff512d1` (`design/alpha5-sandbox-first-20261101`).
- **Date**: 2026-11-02 (real UTC).
- **Test**: `packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts` (21 tests).
- **RED**: `red-test.log` — 18 failed / 3 passed against the unmodified grammar.
- **GREEN**: `green-tests.log` — 21/21 new, 84/84 v4 + v1–v3 grammar regressions
  (a5sr1–a5sr5, a5fl1, a4p7), `tsc -p packages/domain/tsconfig.json` rc=0.

## 1. The question, answered before any code was added

The plan orders P1-01 as a **capability comparison**, not a v5 build. The three real
shapes the plan asks for were written into the test fixture as genuine v4 documents
(parsed through `parseBlueprintV4`, not hand-built objects):

| Shape | Authoring | Expressible today? |
|---|---|---|
| Member A: read-only `/work/a` (minus `/work/a/secret`), write-only `/work/b` | per-`toolBindings` rows only | **NO** — no Member-level carrier |
| Member B: the SAME persistent `bash`, read `/work/c`, write `/work/d` | per-`toolBindings` rows only | **NO** — a tool row cannot differ per Member |
| Same Member, `read` tool narrowed FURTHER than the Member ceiling (`/work/a/docs`) | `toolBindings[].io.read.restricted` | **YES** — v4 tool-level lanes |
| Leader and an unknown third-party CLI under the Member ceiling | — | **NO** — `toolBindings[].owner` is the tool source, not a Member |
| Network boolean allow/deny per Member | — | **NO** at Member level (only per tool; `restricted` has no enforcing backend) |

### Per-field verdict against the LIVE v4 + Alpha.4 vocabulary

| Existing field | What it actually means | Why it cannot be the Member ceiling |
|---|---|---|
| `toolBindings[].owner` → `authoringOwner` | the tool's AUTHORING SOURCE (e.g. `dsh.shell`) | pinned by a5sr2/a5sr3 and re-pinned here: `owner: 'alpha'` mints **no** ceiling for member `alpha`; it only names a source |
| `toolBindings[].name` | tool name | not an identity axis |
| `toolBindings[].io.{read,write}` | per-TOOL path lanes (mode `all` \| `restricted`, allow/ask/deny) | one tool binding is one row shared by every member that uses the tool — no per-Member narrowing point |
| `toolBindings[].io.network` | per-TOOL `allow` \| `restricted` \| `deny` | same, and `restricted` is not enforceable in this round |
| `toolBindings[].authorization` | Alpha.4 call admission (`allow`/`ask`/`deny`) | call permission, explicitly NOT an I/O ceiling |
| `toolBindings[].execution` | implementation origin / boundary | no I/O authority |
| `memberEnvelopes[].envelope` | mutation-operation + exec tokens (`bash`/`pwsh`) | capability set, not file/network I/O |
| `teamHardEnvelope` / `permissionMutationEnvelope` | human hard expansion ceiling / Leader expansion authority | permission expansion, not I/O paths |
| `capabilityPolicy`, `memberRequirements` | tool/skill/requirement availability | availability, not I/O |

**Conclusion**: exactly one fact is missing — a **Member-level three-axis I/O ceiling**.
The minimal increment is therefore one additive, optional v4 family. No v5 grammar, no
second vocabulary, and no change to any frozen v1–v3 or existing v4 field.

## 2. What was added (and what was deliberately NOT added)

Added to `packages/domain/blueprint/src/blueprint-v4.ts`:

- `BLUEPRINT_V4_MEMBER_CEILING_FAMILY = 'memberIoCeilings'`, closed entry
  `{ templateId, io }` (`BLUEPRINT_V4_MEMBER_CEILING_FIELDS`);
- `V4MemberIoCeilingAuthoring`, `TeamBlueprintV4Core.memberIoCeilings?`,
  `findMemberIoCeiling(core, templateId)` (returns `null` when undeclared);
- **shared** lane validation: the tool-binding `io` block was extracted into one
  `validateIoBlock()` that both families call — the ceiling cannot drift from the
  tool vocabulary by construction;
- one new problem code `duplicate-member-ceiling` (a second ceiling for one member
  has no single meaning and is refused, never merged by declaration order).

Added to `packages/domain/vnext-field-mapping/src/v4-authoring-map.ts`:

- `projectV4MemberIoCeiling(maps, entry)` → `MemberCeilingProjection`
  (`templateId`, three projected lanes, `networkCeiling`, `resourceDeclarations`),
  reusing the SAME shipped tables (`rwByMode` / `networkByMode`) and the same
  declaration emitter as tool bindings;
- `MemberNetworkCeiling`: `network: restricted` projects to
  `{ kind: 'unsupported', declaredMode: 'restricted', reason:
  'network-destination-restricted-not-enforced' }` — **never** coerced to boolean.

Deliberately NOT added: a v5 version, a `MemberPolicy` runtime type/compiler (P1-02),
path-matching semantics (P1-03), invocation/trust binding (P1-04), any change to
`memberEnvelopes`, `teamHardEnvelope`, tool-level `io`, or any hash of a document that
does not declare the new family.

## 3. Laws pinned by the test (all machine-checked)

1. **L1 absence declares nothing** — no family / no row / empty family ⇒ lookup `null`,
   projection empty, no synthesized `read: all`.
2. **L2 trusted reference** — `templateId` resolves inside this blueprint (leader
   included); unknown id ⇒ `path-unresolvable`; duplicate ⇒ `duplicate-member-ceiling`;
   `owner` can never mint a ceiling; closed entry keys, no implicit modes, `..` refused.
3. **L3 per-Member isolation** — A's projection contains none of B's locators (asserted
   both directions by whole-object serialization); lane rights preserved (read/write/
   connect); `canonical: false` (schema stays zero-normalization); deeply frozen.
4. **L4 tool `all` cannot invent a path** — `mode: all` projects with zero allow
   locators and no resource declarations; tool narrowing does not mutate the ceiling.
   (The actual intersection is P1-02 `compileEffectiveIo` — not duplicated here.)
5. **L5 network honesty** — `restricted` keeps parsing for tool bindings and projects as
   typed UNSUPPORTED for the ceiling.
6. **L6 hash discipline** — absent family ⇒ key omitted from the hashable projection;
   declared family ⇒ bound; one widened locator changes the hash.

## 4. What P1-01 does NOT prove (honest boundary)

- No runtime enforcement of any kind: nothing reads `memberIoCeilings` outside tests.
- The intersection, revision and fail-closed behavior are P1-02; path matching and
  hardlink/alias semantics are P1-03; call binding and trust are P1-04.
- `network: restricted` is UNSUPPORTED in this round by design; no backend claim.
- P1-01 changes no production entry: `parseBlueprint` already dispatches v4, so a v4
  document that DECLARES the family now parses through the same public entry — the
  grammar is live, the semantics are consumed only by P1-02 and later.

## 5. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts
node_modules/.bin/vitest run packages/domain/test/a5sr2-blueprint-v4-grammar.test.ts \
  packages/domain/test/a5sr3-default-deny-mapping.test.ts \
  packages/domain/test/a4p7-v3-identity-binds-grammar.test.ts \
  packages/domain/test/a5fl1-blueprint-v4-flip.test.ts
node_modules/.bin/tsc -p packages/domain/tsconfig.json --noEmit
```
