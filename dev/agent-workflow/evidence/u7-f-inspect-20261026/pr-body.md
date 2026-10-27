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

## Review round 1 — the five findings and what changed

Independent review (worktree `.worktrees/rv-wave1-a`, `REVIEW-404.md`) bound
head `292558f70` and returned BLOCKED with H-1/B-1/B-2/B-3/M-1. Every finding
is fixed at this head, each pinned by a vector that is RED on the previous
head (or on the planted mutant) and GREEN here. C1 grew 25 → 34 vectors.

**H-1 (HIGH, skill root escape via check-then-use symlink swap).** The
reviewer's deterministic test swapped `SKILL.md` for a symlink immediately
after the executor's `lstat`, and the pre-fix head answered
`kind:'ok', content:'OUTSIDE-SECRET'` — reproduced verbatim in
`review-round1/s9-red-on-292558f70.txt` before any fix. The fix removes the
check-then-use window entirely by adopting the fs-family open law — no third
copy: `resolveAnchoredPath` → identity snapshot → ONE open with
`O_RDONLY | O_NOFOLLOW` → `verifyOpenedHandle` (the fs lane's own function,
now re-exported through the fs-family PUBLIC barrel — see shared-pin item 7)
→ the size cap measured against the FD (cap+1 metered read on the SAME
verified fd, overshoot refused whole). ELOOP → typed `symlink-alias`, zero
bytes; a handle that fails verification → typed `exec-time-*` refusal. The
reviewer's swap scenario is C1 vector S9 (same-process TOCTOU hook, both
branches captured, `SWAP-SECRET-OUTSIDE-THE-ANCHOR` may never appear);
S10 pins the fd-based size bound. X1 (rebuilt mutant: fake resolution +
`O_NOFOLLOW` dropped + handle check disabled) reads the outside file —
proving every vector loads bearing.

**B-1 (vacuous mutation control).** Deleting the query row's method-meta arm
left all 25 old vectors GREEN. E1 now pins each row's EXACT requested effect
multiset (kind-for-kind, locator-for-locator, order included), and X3 replants
the reviewer's exact arm deletion — E1's method-locator count goes to 0
against the mutant (proven in-suite).

**B-2 (declared ≠ requested; `tool-invoke` requested but never declared).**
`contribution.effects.kinds` is now the EXACT union `[tool-invoke, read,
meta]` — nothing requested undeclared, nothing unrequested declared.
Row-level exactness has a hard ceiling the review should know about: the
governance-center closed schema (`governance-center/contribution-schema.ts`
`EFFECTS_KEYS = ['declared','kinds','targets']`, frozen, budget-0) REJECTED a
per-row map with `UNKNOWN_FIELD at $.effects.rows` (measured live in the M2
seam build). The row-level contract therefore binds where it can: C1 E1
(exact requested multiset per row) and E2 (per-row requested == the lane's
declared row table, requested ⊆ declared, declared union == requested union
exactly).

**B-3 (live records lacked `overall`/`finishedAt`/`bindings.authority`).** The
C2 runner now writes through the shared `tests/world-factory/lib/run-record.mjs`
(`createRunRecord` + `readAuthorityBinding(repoRoot)`, `finalize()` BEFORE
`write()`), the way #400's runner does. No committed record was hand-edited:
round-1 records are preserved verbatim under `c2/round1-boots-1-3/` (README
labels them non-RUN-rule digests), boot 4's record under `c2/boot4-record/`,
and boots 4–5 (the +2 granted) produced fresh compliant records — see the C2
section.

**M-1 (validator lied).** `validateInputSubset` now refuses any keyword
outside the closed subset it can verify (`pattern`, `oneOf`, … are a typed
`inspect-input-invalid` naming the keyword, BEFORE dispatch, for BOTH a
matching and a non-matching input) instead of returning `[]`; a query with
OMITTED input validates against the declared schema (as `{}` for object
schemas, so `required` bites) instead of skipping validation; and `const`/
`enum` checks no longer early-return past sibling constraints. M-1 vector +
X4 mutant (restoring the silent-skip hole makes it RED).

**Re-checks of the two earlier fixes (why neither admits more names than
intended).** (a) Placement-name law: the tool-invoke arm spells the row's
OWN mounted alias, and C1 R1 asserts per row the invoked-name singleton —
exactly `[team_skill]` / `[team_cordis_inspect_list]` / `[team_cordis_inspect_query]`
across every producible call, never a native spelling, never another row's
name; the admissible set the plane can resolve (`seamPlacementNames`) is that
same closed three. (b) `exec.tokenKey` correlation: it rides ONLY as the PA
`callId` (facts-entry identity), never as a name — R2 asserts every PA call
carries exactly the host correlation, that no callId ever contains a tool or
placement name (so forwarding one cannot enlarge the admissible set), and
that without a host correlation the synthetic id is plane-scoped and
name-free.

## PROVEN vs DISCLOSED per tool

(proof taxonomy: C1 = offline determinism incl. mutation controls; C2 =
live host, one boot)

| tool | proven | disclosed |
| --- | --- | --- |
| skill | C1 (34-vector suite): full positive chain, grammar/unknown-skill refusals, root-shut + malformed-roots typed refusals, anchor law (escape/symlink drift), the H-1 swap regression S9 + fd size cap S10, cancel-before-PA, exact effect multiset (E1), X1/X3/X4 mutation controls | C2 boot-5: the governed load ran LIVE behind the live durable PA ask→resolve chain (`governed-skill RAN name=u7f-demo-skill bytes=145`) — see C2 section |
| cordis_inspect_list | C1: face-absent typed refusal (never a bypass), zero-effect on every refusal arm, exact effect multiset (E1), declared==requested (E2) | boot-5: the member ISSUED the call (last mock reply is the `team_cordis_inspect_list {}` tool_use) but the run window closed while its ask awaited approval — the leg is a NOT-REACHED FAIL, verbatim below |
| cordis_inspect_query | C1: closed params, pre-dispatch provider/method/schema refusals listing what exists, M-1 fail-closed validator + X4 mutant, timeout at a live 40 ms budget, mid-pending cancel, late-settle non-delivery (X2 mutant), exact effect multiset incl. the method-meta arm (E1/X3) | boot-5: not reached (same window); the round-1 boot already PROVED the live pre-PA unknown-provider refusal with zero dispatch — that arm stands as a round-1 observation, never re-run at this head |

## C2 live-host verdicts (verbatim, final record = boot 5)

Machine copy: `c2/c2-verdicts.json` — a `u5-run-record/1` record written
through the shared `run-record.mjs` lib (finding B-3: `overall`,
`finishedAt`, `bindings.authority` present, finalized BEFORE the write).
Transcripts: `c2/attempt-final.txt`, `c2/host-boot-round2.log`,
`c2/mock-corpus.json`, `c2/home-log-hits.txt`. Superseded records kept
verbatim, nothing hand-edited: `c2/round1-boots-1-3/` (boots 1–3, pre-RUN-rule
shape, README labels them) and `c2/boot4-record/` (boot 4 + the envelope
root-cause note).

Boot 5 is the boot where the durable ask chain WORKS: the member template
and team-root envelope now both name `request-control` (the effective member
bounds are the INTERSECTION — `admission/envelope.ts:100-119` — and boot 4's
verbatim `leg-deny durable control request failed: TeamRuntime: operation
'request-control' … is outside the caller's mutation envelope` matches the
law exactly, the same wall u6-proc measured live at u6prc6-8).

| leg | verdict | verbatim witness |
| --- | --- | --- |
| u7f:mounted | **PASS** | `createOk=true`, placement-feed rows carry all three aliases (`a5g7: placement-feed rows=[team_skill,team_cordis_inspect_list,team_cordis_inspect_query,…]`). |
| u7f:skill-load | **PASS — LIVE, through the live durable PA ask→resolve chain** | `ranWitness=["[dsh-agent-team] a7f-skill: governed-skill RAN name=u7f-demo-skill bytes=145"]`, `refusalWitness=[]`, claim bytes in the member transcript. This exercises the H-1 fd-pinned loader (O_NOFOLLOW + verifyOpenedHandle + fd-capped read) live behind a real Control-row approval. |
| u7f:inspect-list | **FAIL (not reached — window)** | `transcriptHasProviders=false, ranWitness=[]`. Forensics: the last member-lane mock reply in the corpus IS the `team_cordis_inspect_list {}` tool_use; no member turn followed before the drive window closed — its ask was awaiting approval when the run ended. Not a family refusal; the leg simply did not complete. |
| u7f:refusal-zero-effect | **FAIL (not reached in this boot)** | `transcriptHasRefusal=false` — the unknown-provider call was never issued (same window). The live zero-dispatch refusal for this arm was OBSERVED at round 1 (boot 3, verbatim there) and is not re-run at this head; the C1 arm-level proof stands regardless. |
| u7f:approval-leg | **FAIL (counting law unmet)** | `resolveIssues=30, pendingSeenNonEmpty=0`. Resolves were genuinely issued (30 — the leader extracted real requestIds from real list output, and the skill approval LANDED, see skill-load PASS), but this leg's PASS law is a witnessed `pending-control-listed` count>0 AND a resolve, and my witness regex never matched the actual list-output shape (written in round 1, when nothing ever reached listing). Honest FAIL kept; the resolve machinery itself is proven by the skill-load leg landing its approval. |
| u7f:leak-check | **PASS** | outside-the-root secret claim in no transcript, no host log; bytes unchanged. |

Record outcome: `overall=FAIL, pass=3, fail=3` — the FAILs are drive-script
artifacts (witness regex, resolve-spam budget, window length) forensically
traced above, not family-law refusals; zero `APPROVAL_DENIED` occurred in
boot 5. No FAIL leg is flipped or restated as PASS anywhere.

## Boot budget (5 declared: 3 original + 2 granted for B-3; 5 spent)

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
- **boot 2**: booted; the alias placement law PROVEN live (placement-feed
  carried all three); positive legs refused fail-closed AT THE PA EDGE:
  `TOOL_BINDING_UNVERIFIED … identity-gap=no-answer-object` — the rows
  dropped the host call correlation (`exec.tokenKey`). Fixed at HEAD.
- **boot 3**: `mounted`/`refusal-zero-effect`/`leak-check` PASS; positives
  refused again with the decisive `entry-cause=no-placement-name` (the
  plane resolves a seam call only through PLACED names — team-tool-plane
  .mjs:957-970). Fixed at HEAD, pinned offline as C1 I10.
- **boot 4** (granted, review round): first RUN-rule-shaped record
  (`c2/boot4-record/`): 3 PASS / 3 FAIL, positives verbatim
  `APPROVAL_DENIED — durable Control request uncreated answered deny`.
  Root cause pinned from the u6-proc evidence corpus (which contains this
  same leg-deny string and its fix): the member's EFFECTIVE mutation
  envelope is `teamEnvelope.allow` ∩ template entry; neither half named
  `request-control`, so the asker's `requestControl` threw pre-row.
  Fixed in the assembly blueprint (fixture data through the blueprint
  seam; closed `ALL_MUTATION_OPS` vocabulary; zero product-file edits).
- **boot 5** (granted, final): the record above — skill-load LIVE-PROVEN;
  three legs die on drive-script mechanics, disclosed verbatim. Budget now
  5/5 spent; no further boot is taken or claimed.


## Zero-plane-edit file list (full inventory in `git diff --stat origin/master...HEAD`)

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
6. `scripts/eb3-family-boundaries.mjs` (#398's boundary grader, merged
   after this branch was cut) — the `dsh.inspect-family` booking in
   `LANE_EDGES` + `LANE_ID_BY_LANE`, transcribed from the new lane README.
   The booking round also moved this lane's two sibling imports from
   sibling-INTERNALS (`fs-family/src/fs-mechanics.mjs`,
   `search-family/src/cancel-leg.mjs`) to the siblings' PUBLIC barrels —
   both symbols already ride those barrels; no other lane's file changed.
7. `packages/tools/fs-family/src/index.mjs` (review round 1, H-1 — the
   minimal additive export the review authorized): the barrel now re-exports
   `verifyOpenedHandle` from `runtime/controlled-fs` so the inspect lane
   verifies the opened handle through the fs-family PUBLIC face instead of
   importing the runtime path directly or copying the function (third-copy
   law). Additive only: no existing export, line, or behavior of the fs lane
   changed; the fs lane suites and the M4 shipped-face closure walk are green
   with it — the re-export adds no new closure TARGET, controlled-fs is
   already shipped in the dist graph (read-executor reaches it today).

## Gate outputs

- `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store --full --census`:
  run-4 hit ONE census red — `packages/testkit/test/rc2-sanitize-evidence.test.ts::S13`
  — root-caused as ENVIRONMENT: the shared host ran load 16+; S13's nested
  `node --test` suite passes 25/25 but takes 8.4 s wall while the wrapper
  `it()` sits on vitest's 5000 ms default (the census leg line itself names
  this clock fragility). No sanitizer file changed in the merge or this lane.
  Run-5 and run-7 with the gate's own `--census-test-timeout 30000`:
  **`DSH-CI-VERDICT pass pass=8 fail=0 skip=0 skipped=none legs=8 refused=0`**
  with the census verdict printed at its declared clock
  (`--testTimeout=30000 ms, an operator override above the 5000 ms default —
  COUNTS MOVED, SET DID NOT — identity set IDENTICAL to the published
  baseline`). Run-6 (after the EB3 boundary round) caught ONE genuine new
  red — `alpha5-search-backend M4` (the shipped-face import-closure walk,
  raw-text regex): an EB3 comment of mine cited a quoted specifier and the
  comment parsed as an edge; fixed (`fix(inspect): name no quoted specifier
  in prose`) and run-7 is the final-head green. Logs
  `ci-pr-gate-full-4.log` … `ci-pr-gate-full-7.log`.
- `pnpm typecheck` clean; lint-identities: 76 distinct / **new 0**;
  docs:sync + probe blocking 0; `node scripts/eb3-ci-required.mjs`:
  `EB3-CI-REQUIRED pass workflows=9 findings=0`;
  `node scripts/check-artifacts-at-head.mjs`: 1839 compared, **drift 0**;
  composition-smoke PASS; world-factory registries+arc-d 19/19; node-globals
  parity 6/6; seam fitness 4/4; p4t6 20/20; ARC-A 12/12.
- C1 suite `packages/runtime/test/u7f-inspect-family-c1.test.ts`: **34
  vectors** green at the review-round head (was 25; +S9 swap regression, +S10
  fd cap, +E1/E2 effect-set law, +M-1 fail-closed, +R1/R2 no-widening
  singletons; mutation controls X1–X4 each RED-verified against their planted
  bug; I10 pins the placement-spelling law measured live in C2 boot-3).
- Hosted CI was fully GREEN at the pre-review head `292558f70`
  (ci-required run 40463495314 EXIT=0; census-runtime 40463495459; pr-gate
  1m39s) — the review's blockers were semantic law gaps, not CI. The
  review-round head carries the same gate set (ledger lines appended below
  after the final push).
- Post-merge (#398): `diag-call-chain --self-test` OK (49 codes),
  `diag-call-chain.test.mjs` 24/24, `devex-integration.test.mjs` green.
