# feat(inspect): governed skill/cordis_inspect_list/cordis_inspect_query via the FamilyAssembly seam

U7-F delivers the three host-defined read tools as ONE governed family —
**`dsh.inspect-family`** — mounted through the PR #400 FamilyAssembly seam
with **ZERO lines** in `team-tool-plane.mjs`, `family-assembly.mjs`,
`agent-bindings.mjs`, the governance center, or any protected path
(`git diff --name-only origin/master...HEAD | grep -E "team-tool-plane|family-assembly|agent-bindings|governance-center|control/|tool-dispatch|tool-admission|operation-permission|pa-mount-registry" | wc -l` = **0**).

**Lineage**: branched off `origin/master @ 42c4d04b5`; normally merged
`origin/master` through `0ea67bee8` (#398 — diag-call-chain resolves family
refusal codes from `packages/tools/families/manifest.json`; devex+diag
suites gate CI). Post-merge `gen-family-index.mjs` regenerates
byte-identical output (4 reviewed families) and
`diag-call-chain --self-test` is OK (49 codes, 5 kinds): this family's
refusal codes ride the manifest-driven resolution #398 introduced, no lane
change needed.

## What mounts (default OFF)

Descriptor `packages/tools/families/inspect.mjs` (sha256
`120d45343f9157d5c876edb53d23eefe049af502c07abe367d9287563c181274`, pinned
in the reviewed `manifest.json`, 4th family). Gate:
`config.teamToolPlane.inspectFamilyEnabled === true` (boolean; absent ⇒ the
seven master rows are byte-identical — C1 leg M1). When enabled the family
claims exactly three rows and the mount is all-three-or-refused (ARC-A L4
closedness requires a readable bracketed `nativeNames` block; per-row
conditional claiming would turn the census blind — the SHUT-skill-executor
law in `inspect.mjs` states this trade).

**Mount spellings are aliases** `team_skill` / `team_cordis_inspect_list` /
`team_cordis_inspect_query`. The native spellings are PLANE_RESERVED_NATIVE;
a native claim requires an entry in the plane's
`PLANE_SUPPORTED_NATIVE_TAKEOVERS` ledger — center-interface data inside
`team-tool-plane.mjs`. A zero-plane-line lane never edits that ledger (the
ledger must stay the complete truth), so this family makes no native claim;
native-spelling takeover is a named center-interface follow-up (U7-9a
precedent). C2 boot-1 **measured** the law live: claiming `skill` refuses
placement and throws at root-agent start (verbatim in
`dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/`).

## READ-ONLY proof (no mutation effect, ever)

- All three executors mint effect sets through `parseRequestedEffectSet`
  (the domain's closed effect grammar): `tool-invoke` arms with
  `resource: null`, one `read` arm (absolute-path, `rights: ['read']`) for
  the skill row, `meta` arms (metadata) for the inspect rows. There is no
  code path that constructs a write/edit/bash-class effect.
- The contribution declares `effects: { kinds: ['read','meta'], targets:
  ['absolute-path','metadata'] }`; family-assembly's closed check rejects
  anything else before the plane would mount it.
- `cordis_inspect_query` refuses any parameter outside its closed
  `{platform, provider, method, input}` face BEFORE any dispatch
  (`unexpected-parameter`, "mutation-shaped"); unknown provider/method are
  typed refusals that list what IS available; input validation runs against
  the provider's own advertised schema before dispatch (unverifiable ⇒
  refused, fail closed).
- The skill row reads ONLY the mount-configured `skillRoots` through the
  fs family's anchor law (`resolveAnchoredPath`), proves file-ness with its
  own `lstat` (a symlink is a typed refusal, not a read), caps size, and
  refuses `..`/absolute/symlink escapes with zero bytes read. Unknown skill
  = typed refusal `skill-unknown`.
- host-tools.json for this round: sha256
  `35e2a63c5feed18d47e4e03665785efa911616a9ff450c3a040f88520eca4f86`; the
  matrix rows skill/cordis_inspect_* stay UNKNOWN until the review gate
  colors them — this PR claims no matrix cell.

## Cancel/timeout law (query leg)

Pre-consume refusals never dispatch. Post-consume the executor owns one
AbortController and runs `raceConfinedSettle` (tie law `exited > timedOut >
aborted`): timeout ⇒ typed `inspect-query-timeout` + controller.abort();
cancel-during-pending ⇒ typed `call-aborted`; a promise that settles AFTER
either ⇒ **never delivered** (mutation control X2: planting a late-resolve
delivery path turns the C1 vector RED — the law is load-bearing, not prose).

## Family placement justification (new family vs fs-family extension)

NEW family. The fs-family anchor law governs exactly one resource class
(a governed root for file IO); skill roots are a SECOND trust input (host
composition config, not a team realm root), and the inspect rows carry a
different effect law (meta/directory, no fs resource at all) and a
different settle law (bounded race, no-late-delivery). Folding them into
the fs anchor would either widen the fs family's contribution law beyond
its reviewed shape or smuggle a second law through an anchor built for
another. The seam exists exactly for this: a new descriptor + manifest
entry + index regeneration, zero plane edits. Reuse kept where the law is
genuinely shared: the anchored-path resolver face and the effect-grammar
face (both booked, see below).

## PROVEN vs DISCLOSED per tool

(proof taxonomy: C1 = offline determinism incl. mutation controls; C2 =
live host, one boot)

| tool | proven | disclosed |
| --- | --- | --- |
| skill | C1: full positive chain, grammar refusal, unknown-skill refusal, root-shut typed refusal, malformed-roots whole-family refusal, anchor law (escape/symlink drift), size cap, cancel-before-PA, X1 mutation control (dropping the anchor check turns the escape vector RED) | C2 section below |
| cordis_inspect_list | C1: face-absent typed refusal (never a bypass), zero-effect on every refusal arm, effects read-only | C2 section below |
| cordis_inspect_query | C1: closed params, pre-dispatch provider/method/schema refusals listing what exists, timeout typed refusal at a 40 ms budget, mid-pending cancel, late-settle non-delivery, X2 mutation control | C2 section below |

## C2 live-host verdicts (verbatim, final boot)

Machine copy: `c2/c2-verdicts.json` (+ `mock-corpus.json`, `host-boot1.log`,
`home-log-hits.txt`). One boot runs all six legs; the boot below is host
boot 3 of the declared 3.

| leg | verdict | verbatim witness (detail fields quoted from c2-verdicts.json) |
| --- | --- | --- |
| u7f:mounted | **PASS** | `createOk=true`, `placementFeed="[dsh-agent-team] a5g7: placement-feed rows=[team_skill,team_cordis_inspect_list,team_cordis_inspect_query,team_grep,team_glob,team_bash,read,write,edit,read_image]"` — the three alias rows PLACED on the live host. DISCLOSED detail: the same-session root-surface discovery prompt lists member-visible tools, and the alias check there is disclosed as a surface-scope fact, not the mount law (placement-feed is the mount truth). |
| u7f:skill-load | **DISCLOSED (live refusal, not flipped)** | `[dsh-agent-team] a7f-skill: governed-skill pa-refused code=TOOL_BINDING_UNVERIFIED` + the verbatim model-visible refusal: `the live dispatcher binding behind this call (skill) could not be answered by the call-level facts entry: identity-gap=no-answer-object … entry-cause=no-placement-name — no admission, no grant, and no Control row is opened on an identity that was never read`. Root cause, pinned by that exact `entry-cause`: the effect `tool-invoke` arm carried the NATIVE class while this family MOUNTS at the alias — `paPlacementNameOf` (team-tool-plane.mjs:957-970, the U7-9a family-blind law) resolves seam calls only through the placed names. Fixed at HEAD in `fix(inspect): spell the effect tool-invoke arm at the MOUNTED placement name`; the refusal itself was the fail-closed law WORKING (zero effect, zero grant, zero Control row). Live re-verification needs one boot beyond the declared 3 — NOT taken; see boot budget. |
| u7f:inspect-list | **DISCLOSED (same law, same verbatim shape)** | `[dsh-agent-team] a7f-ilist: governed-inspect-list pa-refused code=TOOL_BINDING_UNVERIFIED` … `entry-cause=no-placement-name`. Same fix, same law, zero effect. |
| u7f:refusal-zero-effect | **PASS** | the unknown-provider query answered typed in the live transcript (`inspect-provider-unknown`, refusing text listing what exists) with **ZERO** `governed-inspect-query RAN` dispatch lines — the pre-PA refusal arm is proven live with zero effect. |
| u7f:approval-leg | **DISCLOSED (never reached)** | `resolveIssues=0, pendingSeenNonEmpty=0` — the two ask-lane calls died at the identity edge BEFORE any durable Control row was opened (exactly what the refusal text promises: "no Control row is opened on an identity that was never read"), so no leader resolve could exist. The honest count replaces boot-2's corpus-string artifact (which had counted tool-DEFINITION text); the approval mechanics themselves are proven by the earlier u5 approval worlds. |
| u7f:leak-check | **PASS** | the planted outside-the-root secret claim appears in NO corpus message and NO host log line, and the secret's bytes are unchanged on disk after the full run. |

## Boot budget (3 declared, 3 spent)

- script round 1: import-path bug in the evidence runner — the HOST never
  started, no boot consumed; fixed.
- **boot 1**: booted; health/state/discovery OK; `team.create` root-start
  REFUSED — the host's registration law (`assertSupportedJsonSchema`,
  pinned host core/tools/src/index.ts:1071) rejected my row schemas:
  `type:'json'` is the native EXTENSION DSL's spelling, outside the
  enforced registration subset, and a single-branch `oneOf` is likewise
  outside it. Verbatim error: `c2/c2-create-error.json`. Fixed at HEAD
  (`fix(inspect): speak the host's enforced JSON-Schema subset at
  registration`).
- **boot 2**: booted; health/state OK; **placement-feed rows carried all
  three aliases** (`a5g7: placement-feed rows=[team_skill,
  team_cordis_inspect_list, team_cordis_inspect_query, team_grep, …]`) —
  the alias mount law PROVEN live; unknown-provider refusal answered
  typed with ZERO dispatch; the outside-the-root secret stayed out of
  every transcript and byte-identical on disk; team.create OK.
  Positive legs refused fail-closed AT THE PA EDGE:
  `TOOL_BINDING_UNVERIFIED … identity-gap=no-answer-object` — the rows
  called PA with synthetic call ids; the call-level facts entry resolves
  the live dispatcher binding only behind the host-allocated call
  correlation (`exec.tokenKey`), which my transports dropped. The law
  worked exactly as designed (zero effect, typed refusal); my rows were
  wrong. Fixed at HEAD (`fix(inspect): ride the host call correlation
  into the PA edge (exec.tokenKey)`).
- **boot 3**: booted; `u7f:mounted` PASS on the placement-feed witness,
  `u7f:refusal-zero-effect` PASS, `u7f:leak-check` PASS; the two positive
  legs refused again at the PA edge, now with the decisive detail
  `entry-cause=no-placement-name` — the plane's fact entry resolves a
  seam call's placement only through the PLACED names
  (team-tool-plane.mjs:957-970, U7-9a law), and my effect arms spelled
  native classes. Fixed at HEAD and pinned offline as C1 vector I10
  (25/25). A confirming fourth boot would exceed the declared budget;
  it was requested and the budget owner was unreachable mid-session, so
  it is **not taken** — the two arms stay DISCLOSED above, never flipped.


## Zero-plane-edit file list (36 paths, full inventory in `git diff --stat origin/master...HEAD`)

Lane: `packages/tools/inspect-family/src/*` (9 files) + descriptor
`packages/tools/families/inspect.mjs` + `manifest.json`/`index.mjs` (seam
registration) + dist mirror (`packages/runtime/dist/packages/tools/...` +
placement `scripts/dist-placements/070-inspect-family.json`) + node-globals
ledger `scripts/eslint-node-globals/030-inspect-family.json`.

## Shared-pin edits this PR makes (all non-protected, each disclosed)

1. `packages/runtime/test/u7-w0b-family-seam.test.ts` — reviewed-family
   count pin 3→4 (read-back of the reviewed set).
2. `tests/checks/eslint-node-globals.test.mjs` — `ADDED_BY_LANES` (+ dated
   comment): one pattern, ONE ambient global `AbortController` (documented
   in the 030 ledger entry).
3. `dev/agent-workflow/ledgers/arc-a-family-census.json` — the census
   booking for `dsh.inspect-family`.
4. `packages/testkit/test/p4t6-bookings/u7finspect.json` — p4t6 delta
   1322→1333 (11 scannable files; RED-first unbooked log in evidence).
5. `scripts/audit-a5-tool-governance-imports.mjs` +
   `packages/domain/test/a5p0-layer-audit.test.ts` — the two governed
   executors booked FILE-BY-FILE for the SAME single thin face
   (`parseRequestedEffectSet`) the fs-family executors carry. Zero lane
   edits; pure-domain law untouched.

## Gate outputs

- `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store --full --census`:
  (final run appended below)
- `pnpm typecheck` clean; lint-identities: 76 distinct / **new 0**;
  docs:sync + probe blocking 0; `node scripts/eb3-ci-required.mjs`:
  `EB3-CI-REQUIRED pass workflows=9 findings=0`;
  `node scripts/check-artifacts-at-head.mjs`: 1839 compared, **drift 0**;
  composition-smoke PASS; world-factory registries+arc-d 19/19; node-globals
  parity 6/6; seam fitness 4/4; p4t6 20/20; ARC-A 12/12.
- C1 suite `packages/runtime/test/u7f-inspect-family-c1.test.ts`: 25 vectors
  green (both mutation controls RED-verified; I10 pins the placement-spelling
  law measured live in C2 boot-3).
- Post-merge (#398): `diag-call-chain --self-test` OK (49 codes),
  `diag-call-chain.test.mjs` 24/24, `devex-integration.test.mjs` green.
