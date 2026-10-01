# alpha3 PR4 — Grant / Revoke / Lifecycle lane + production entry wiring — verification ledger

All numbers below come from real tool runs in this session (raw logs in this directory; each
command's exit code is recorded in a sibling `<log>.exit` file — `tsc` on a clean tree exits 0 with
an EMPTY stdout, so its `.log` is legitimately 0 bytes and the exit value lives in
`a3p4-tsc-runtime.log.exit` / `a3p4-tsc-r2.exit`). No number is hand-computed. Nothing in this
round touched the host, any port, any DSH_HOME world, the acceptance carrier
(`.worktrees/int-alpha3-stage2`), or any other PR's files.

## Identity

| item | value |
| --- | --- |
| branch | `task/alpha3-pr4-permission-lifecycle` |
| worktree | `.worktrees/pr4-permission-lifecycle` (one worktree, one writer) |
| base (= `origin/master` at branch creation) | `d8953d6a53047e7d2e787450c0f0efb7e46ad024` (PR3 squash = merged permission kernel) |
| round-1 commit | `440ede5172c6bb0d669426d5cf019012620e4f9f` — 56 files, +5973 / −22 |
| round-2 commit (this ledger + the folded test leg) | forward-only child of the round-1 commit, single commit, no force; its 40-char hash is reported in PR #60 and in the parent report (a commit cannot contain its own hash) |
| remote verification | round-1 raw `git ls-remote origin` output verbatim in `readback-round1.txt`; `refs/heads/master` stays at `d8953d6a…` (never touched) |
| PR | #60 — DRAFT, base `master` |

## What landed (12 non-dist files, round 1)

New — `packages/runtime/permission-lifecycle/{types,mutation-lane,decision-lane,index}.ts`
(the three lifecycle write entries riding `GovernanceMutationService.mutatePermission`, the ADR §8
execution gate, the merged file/exec decision planes); `packages/runtime/src/plugin/permission-plane.ts`
(the production assembly helpers); `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts`;
`packages/runtime/test/a3p4-production-permission-plane.test.ts`.

Modified in place — `packages/runtime/operation-permission/pre-execute-adapter.ts` (optional
`resolveDynamicDecision` seam: unwired = byte-for-byte the static pipeline);
`packages/runtime/src/plugin/root.ts` (optional `permissionOverlay` / `fsContainsKeys` /
`permissionPlaneRef`; injects `permissionLane` into its own governance service; fills the plane
reference during construction); `packages/runtime/src/plugin/host.ts` (opens the durable
`permission_overlays` store, fail-closed to absent; injects the key-level containment over the lazy
strict `ctx.get('fs')` accessor; shares the reference with the glue);
`packages/runtime/src/plugin/live/agent-bindings.mjs` (reads the reference at agent setup; passes
the decision closure + the `FileSystem.contains`-backed overlay containment);
`packages/testkit/test/p4t6-session-event-scan.test.ts` (file-count recount).

Round 2 adds exactly one source-side change: **one test leg** in
`packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts` (see "Known gap closed"). No
production module changed, so the dist artifacts did not move.

Round 3 (2026-10-06, fresh sole writer) is the CONSOLIDATED forward-only fix of all five confirmed
blocks (BLOCK-0 store double-open, BLOCK-1 empty authority envelope, BLOCK-2 stale-decision deny
routing, BLOCK-3 stranded artifact-grant floor, BLOCK-4 Leader lifecycle blindness, BLOCK-5 optional
durable authority at the entry) plus MINOR-1 (`winningLayer` 'blueprint' attribution) and INFO-3
(fabricated declared-none at the seam input). See the round-3 section at the bottom for the full
file list, chains (`ROUND3-VERIFIED-CHAINS-AND-RULINGS.md`), RED/GREEN raws and the battery.

## Verification battery (real exits)

| # | command (cwd) | exit | recorded result | log |
| --- | --- | --- | --- | --- |
| 1 | `npx vitest run` (`packages/runtime`) — PR4 tree, clean scratch, round 1 | 1 | `Test Files 6 failed | 293 passed (299)`, `Tests 8 failed | 3180 passed (3188)` | `a3p4-runtime-suite.log` (repeat: `a3p4-runtime-suite-repeat1.log`) |
| 2 | `npx vitest run` (`packages/runtime`) — pristine base `d8953d6a`, detached read-only worktree (deps symlinked, worktree removed afterwards) | 1 | `Test Files 6 failed | 291 passed (297)`, `Tests 8 failed | 3148 passed (3156)` — the baseline set | `baseline-runtime-suite.log` (+ `baseline-runtime-suite-repeat1.log`) |
| 3 | `npx vitest run` — round 2 (26-leg lane spec included) | 1 | `Test Files 6 failed | 293 passed (299)`, `Tests 8 failed | 3181 passed (3189)`; **`diff baseline-failset.txt r2-repeat-failset.txt` = byte-identical (exit 0)** | `a3p4-runtime-suite-r2-repeat.log`, `baseline-failset.txt`, `r2-repeat-failset.txt` |
| 4 | `npx vitest run test/a3p4-permission-lifecycle-e2e.test.ts` | 0 | round 1: 25 passed → round 2: **26 passed** | per-file sections of `a3p4-runtime-suite.log` / `a3p4-runtime-suite-r2-repeat.log` |
| 5 | `npx vitest run test/a3p4-production-permission-plane.test.ts` | 0 | `Tests 7 passed (7)` | `a3p4-runtime-suite.log` |
| 6 | `npx vitest run test/p4t6-session-event-scan.test.ts` (`packages/testkit`) | 0 | `Tests 10 passed (10)` after the honest recount 934 → **941** (the pre-recount run reported `expected 941 to be 934`); re-run in round 2 unchanged (no new files) | `a3p4-p4t6-scan.log`, `a3p4-p4t6-scan-r2.log` |
| 7 | `npx tsc -p tsconfig.json --noEmit` (`packages/runtime`; includes `src` + `test`) | **0** (a clean `tsc` prints nothing ⇒ 0-byte stdout) | round 1: `a3p4-tsc-runtime.log` (0 B) with `a3p4-tsc-runtime.log.exit` = `0`; round 2: `a3p4-tsc-r2.log` (0 B) with `a3p4-tsc-r2.exit` = `0` | as named |
| 8 | `pnpm build` (repo root) | 0 | all packages built | `a3p4-build.log` |
| 9 | `pnpm build:composition` BEFORE staging the drift | 1 | lists 32 `produced-but-untracked` + 12 `content-drift` dist files | `a3p4-composition.log` |
| 10 | `pnpm build:composition` AFTER staging (same commit) | 0 | `[check-artifacts-committed] OK: 1424 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))` (dist total 1392 → 1424) | `a3p4-composition-committed.log` |
| 11 | `git diff --cached \| grep -icE 'api[_-]?key\|secret\|passwd\|password\|ghp_\|AKIA\|-----BEGIN'` | 1 (no match) | `0` | recorded here |

**Baseline parity, stated precisely.** PR4 adds **2** test files (`297 → 299`: the lane spec and
the production-plane spec) and **33** tests (`3156 → 3189`); the failure SET is identical to the
pristine base on the byte-compared runs (the eight: `d3-member-identity-context` D3-4, five
`p6t3-mediation`, two `p6t3-restart`, plus the three pre-existing collection-failed files
`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`).

## Known gap closed in round 2 (was: acknowledged, unpinned)

Round 1 documented but did not pin that a **faulting** containment predicate is UNKNOWN coverage
rather than a negative verdict. Round 2 folds one leg into
`packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts`:
`a FAULTING containment predicate is UNKNOWN coverage, not a negative verdict: typed refusal, zero
write`. It drives the PRODUCTION wrapper — `createPermissionGovernanceLane({ fsContainsKeys: () =>
{ throw … } })` from `src/plugin/permission-plane.ts`, not a hand-rolled stand-in — through the same
Leader subtree-envelope mutation the adjacent legs use, and asserts
`code === PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE` **and** zero history. It
passes against the round-1 implementation (no production change was needed); the spec went 25 → 26
legs and the whole-suite count 3188 → 3189.

## Honest caveats

- **Load flake, proven pre-existing.** `p6t1-parallel > P2: N=5 same-template parallel activations`
  drifted into the failure set in two full-suite runs (`a3p4-runtime-suite-final.log`,
  `a3p4-runtime-suite-r2.log`; the delta over baseline is recorded in `failset-diff-r2.txt`). The
  **pristine base commit drifts the same way** — its repeat run reported
  `Tests 10 failed | 3146 passed (3156)` including `p6t1-parallel`
  (`baseline-runtime-suite-repeat1.log`) — and the spec passes 3/3 in isolation on this head. The
  round-2 repeat run is back to the byte-identical baseline set. Round 3 observes the
  same class again: the full-suite run `a3p4-r3-battery-full-r2.log` flaked TWO `p6t1-parallel` P1
  legs (`expected 1 to be +0`, `expected 1 to be 2` — load-sensitive N=2 activation timing) that
  passed in the immediately preceding full run (`a3p4-r3-battery-full.log`) and pass 9/9 in
  isolation (`a3p4-r3-p6t1-flakecheck.log`, exit 0).
- **Stale scratch contamination (mine, cleaned).** `packages/testkit/test/.tmp-fault/` held 23 dirs
  left by earlier crashed runs in this worktree; with them present, extra fixed-name worlds fail at
  collection with `team_domain already exists`. Every battery run above was executed after
  `rm -rf packages/testkit/test/.tmp-fault/*`. That directory is gitignored test scratch; no source
  file was touched by the cleanup.
- **Dist drift attribution (corrected).** Of the 32 `produced-but-untracked` dist artifacts, **20 are
  PR4's own new modules** — `runtime/permission-lifecycle/*` (4 modules × 4 artifacts = 16) and
  `runtime/src/plugin/permission-plane.*` (4) — and the other **12 are first-shipments of EARLIER
  rounds' already-committed sources**: `runtime/permission-governance/{index,overlay-repository}.*`
  (8, PR1/PR2) and `storage/repositories/permission-overlays.*` (4, PR1). They ride in this branch
  because the composition gate requires the committed artifacts to match the fresh build in the same
  commit. The 12 `content-drift` modifications are exactly the files PR4 edited
  (`pre-execute-adapter`, `host`, `root`, the `agent-bindings.mjs` glue placement).
- **`p4t6` recount is a pin move, not a scanner change.** 934 → 941 = +7 files (4 lane modules +
  `src/plugin/permission-plane.ts` + the 2 new specs); the scanner `.mjs` is untouched and the
  frozen quarantine hit set stays at 15 occurrences. Round 2 added no file so the pin held;
  round 3 adds the 2 RED-first regression specs → scanner-reported **943** (`a3p4-r3-p4t6-recount.log`
  first reported `expected 943 to be 941`, then the pin moved to the scanner's own number —
  `a3p4-r3-p4t6-recount-r2.log`, 10/10 green; hit set unchanged at 15).
- **Scope discipline.** No `tests/deepseek-harness-test-use` change (CORE PATCH BUDGET 0 — the
  containment authority stays the pinned public `FileSystem.contains`, called with the provider's
  own `targetKey` values). One `PermissionMutation` writer, one read plane, no notification-based
  authority (PR5), no delete, no inheritance. `root.ts` gained wiring only, and the PR2 "production
  wires NOTHING of the assembler" walk (`a3p2-permission-assembler-provenance`) stays green — the
  production files carry no assembler needle; the decision lane reaches the assembler from inside
  `permission-lifecycle/`.

## Design decisions worth the reviewer's attention

1. **Two merged decision planes.** The frozen Alpha.2 matcher (`ruleMatches`) matches
   `exact`/`subtree` only when `operation.resource.kind === 'file'`, while an exec operation carries
   `kind: 'tool'` — so a `fingerprint:` overlay rule cannot be expressed as a `CanonicalRule`.
   Filespace rides the PR2 assembler + the frozen resolver; execspace rides the governance kernel's
   exported pure `permissionEffectiveAnswer` over the fingerprint region (kernel-vs-assembler parity
   is already pinned by PR3's `a3p3-effective-parity`). `PermissionDecisionOutcome.plane` records
   which plane answered.
2. **Containment is injected, never derived.** A `subtree` matcher is judged only by the injected
   predicate (production: the pinned public `FileSystem.contains`, resolved fresh per decision, no
   cache); a predicate FAULT maps to the kernel's typed `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE`,
   never to a `false` verdict (pinned by the round-2 leg); the frozen lane asymmetry holds when
   coverage is undeterminable (deny/ask never dropped, allow never invented).
3. **The mutation plane's static facts stay UNKNOWN-by-absence** (documented in
   `permission-plane.ts`): the root holds policy rules only as blueprint paths, and comparing paths
   against canonical keys would be confidently wrong. The decision plane never runs on absent facts
   — the pre-execute decision site supplies freshly canonicalized lanes.
   **[SUPERSEDED in round 3]** for the PRODUCTION entry: the host now builds identity-bound
   authority facts (per-template static layers + the Leader expansion ceiling) by canonicalizing
   each declared rule through the row's fs provider at the POST-BOOT async boundary
   (`createPermissionAuthorityFacts` in `permission-plane.ts`); the documents are consumed
   synchronously and abstain on snapshot drift (UNKNOWN / zero envelope — never stale facts, never
   a second authority). The rule itself stands wherever no fs-authorized canonicalization exists.
4. **Restore writes nothing decorative.** A pure restore is one lifecycle commit (`commit-restore`)
   returning the SAME instance to the CURRENT latest overlay; a genuine rule change at restore time
   is one ordinary PermissionMutation (`wroteSnapshot` reports whether a snapshot was actually
   appended; re-supplying the same desired state yields `changed: false`).

## Round 3 — the consolidated forward-only fix (2026-10-06, fresh sole writer)

All chains, the derived-envelope ruling and the mandatory-authority ruling are recorded in full in
**`ROUND3-VERIFIED-CHAINS-AND-RULINGS.md`** (written before any production edit, from source reading
at head `440ede51`). Every fix below was RED-pinned first; the RED logs and their per-leg reasons
are in this directory.

### Blocks fixed (each: chain → RED raw → GREEN raw)

| Block | Chain (condensed) | Fix | RED raw | GREEN evidence |
| --- | --- | --- | --- | --- |
| BLOCK-0 | `host.ts` opened a SECOND TeamDomain handle (`openPermissionOverlayStore(seam)`) while the row's domain handle was live → upstream single-open law ⇒ `already-open` throw ⇒ swallowed by the catch ⇒ the overlay authority was absent on EVERY production row, while the warn text claimed fail-closed | the repository now RIDES the already-open facade handle (`domain.repositories.permissionOverlays`, new facade member in `storage/repositories/team-domain.ts`); an eager read-only probe at boot proves the authority answers; any fault is a typed startup failure | `a3p4-r3-red-entry.log` (fault leg: booted despite store fault) | `a3p4-r3-green-entry-r2.log` (typed `TEAM_PLUGIN_PERMISSION_AUTHORITY_UNAVAILABLE`, `booted=false`) |
| BLOCK-1 | the lane received NO envelope and NO static layers ⇒ permanent `{rules:[]}` zero authority + UNKNOWN facts ⇒ EVERY Leader permission mutation typed-refused forever | identity-bound `createPermissionAuthorityFacts` (`permission-plane.ts`): documents built at the post-boot async boundary (TeamSession exists, fs consulted only for rules that exist), consumed synchronously by the pure kernel; drift ⇒ abstain (UNKNOWN / zero envelope) | `a3p4-r3-red-entry.log` (grant refused NOT_CONFIGURED / envelope negative) | `a3p4-r3-green-entry-r2.log` (i-host: Leader grant commits through the DERIVED envelope; negative region still refuses typed) |
| BLOCK-2 | the deny route re-read the STALE `decision.decision` after the seam had answered ⇒ static-deny + overlay-ASK denied outright (approval bypass) | ONE merged routing value (`effectiveEffect`/`effectiveSource`), read at every route | `a3p4-r3-red-routing.log` (R2: no control row ever created) | `a3p4-r3-green-routing-r3.log` (R2 exact/subtree/exec: durable row, resolve, execute) |
| BLOCK-3 | the early `return` on ANY dynamic deny stranded the artifact-grant floor + dropped provenance ⇒ core-spill reads died the moment the plane was wired | early return deleted; merged `source` rides the seam contract; the floor runs on DEFAULT denies (any plane), explicit rule denies still block | `a3p4-r3-red-routing.log` (R3 positive: grant ignored) | same GREEN log (POSITIVE floor executes; NEGATIVE explicit-deny + grant still blocks; NON-REGRESSION ask+grant zero rows) |
| BLOCK-4 | `createMemberLifecycleReader` read member rows blind; the Leader has NO member row in v2 ⇒ `EXECUTION_STATE_UNKNOWN` on EVERY Leader tool decision | leader-aware reader reusing the control/service.ts semantics (Leader live ⇔ TeamSession row exists; `inst-leader` excluded from member-row checks); member semantics byte-identical | `a3p4-r3-red-entry.log` (Leader decision refused) | `a3p4-r3-green-entry-r2.log` (Leader live over the real TeamSession; ghost STILL refuses) |
| BLOCK-5 | glue installed the decision seam only `if (plane)` and the entry treated a store fault as warn-and-continue ⇒ durable permission authority was OPTIONAL at the production entry | RULING (recorded): the authority is MANDATORY and always-on at the host entry — typed startup failure on any store fault, loud pre-flight (`console.info`) naming every bound template that declares `capabilities.permissions`; NO new user-facing config flag; NEGATIVE control pinned: a healthy no-permissions world gains ZERO new startup failures and no permission warning | `a3p4-r3-red-entry.log` | `a3p4-r3-green-entry-r2.log` (fault ⇒ typed failure; negative control boots clean) |
| MINOR-1 | `decision-lane.ts` hard-mapped kernel `'layer' ⇒ 'template'` — a blueprint exec answer could never be reported | per-slot attribution: re-run the SAME pure algebra per declared slot (highest first); template/blueprint/overlay/null all reachable | `a3p4-r3-red-routing.log` (blueprint leg reported 'template') | `a3p4-r3-green-routing-r3.log` M1 leg |
| INFO-3 | the seam input fabricated `?? { allow: [], ask: [], deny: [] }` (declared-none) where the adapter had a value; glue laundered undefined into declared-none | verbatim pass-through end-to-end; undefined ⇒ facts ABSENT ⇒ lane's typed `STATIC_FACTS_UNKNOWN` ⇒ hard deny | `a3p4-r3-red-routing.log` (I3 seam-identity leg) | GREEN log (seam input carries the real rules; source-text pin: the fallback text does not survive) |

### Files changed (round 3, non-dist)

Production — `packages/storage/repositories/team-domain.ts` (facade gains the tenth repository, the
single-open law documented at the release point); `packages/runtime/src/plugin/permission-plane.ts`
(leader-aware reader, verbatim envelope/facts forwarding, `createPermissionAuthorityFacts`);
`src/plugin/root.ts` (two fact-reader deps, plane exposed on the root surface);
`src/plugin/types.ts` (`TEAM_PLUGIN_PERMISSION_AUTHORITY_UNAVAILABLE`,
`TeamProductionRoot.permissionPlane`); `src/plugin/host.ts` (handle-riding mandatory port + eager
probe + typed startup failure, facts authority + post-boot refresh + loud pre-flight; the
`permissionOverlayStore` handle and its second `close()` are GONE);
`operation-permission/pre-execute-adapter.ts` (merged routing, floor on merged source, verbatim
`staticRules`); `permission-lifecycle/decision-lane.ts` (MINOR-1 attribution);
`src/plugin/live/agent-bindings.mjs` (undefined-rules posture + `source` passthrough).

Tests — NEW `test/a3p4-pr4-decision-routing-regression.test.ts` (13 legs),
NEW `test/a3p4-pr4-production-entry-regression.test.ts` (9 legs, incl. the REAL host entry and the
REAL `createAgentBindings` glue world); amended pins: `test/a3p3-governance-lane-hygiene.test.ts`
(PR3's "lands dormant" walk allow-listed with exactly ONE audited production consumer —
`src/plugin/permission-plane.ts` — the amendment is documented in the leg),
`test/a3p4-production-permission-plane.test.ts` (closure mirrors the round-3 seam contract),
`test/t12a-live-bridge.mjs` + `.d.mts` (`permissionPlaneRef` pass-through),
`test/a3p4-permission-lifecycle-e2e.test.ts` (predecessor WIP, 26 legs, kept green unchanged),
`packages/testkit/test/p4t6-session-event-scan.test.ts` (941 → 943).

### Round-3 battery (real exits, this worktree, scratch cleaned before each run)

| # | Command | Exit | Raw |
| --- | --- | --- | --- |
| 1 | RED runs (pre-fix): routing spec | 1 | `a3p4-r3-red-routing.log` 8f/5p, `-r2` (after two test-harness fixes, still block-red) 7f/6p |
| 2 | RED runs (pre-fix): entry spec | 1 | `a3p4-r3-red-entry.log` 8f/1p, `-r2` 7f/2p |
| 3 | GREEN File A (routing, 13 legs) | 0 | `a3p4-r3-green-routing-r3.log` |
| 4 | GREEN File B (entry, 9 legs) | 0 | `a3p4-r3-green-entry-r2.log` |
| 5 | Existing P-spec + e2e (33 legs) | 0 | `a3p4-r3-green-existing-p-e2e.log` |
| 6 | a6a + p8s5a + a2c4 + a2c5 (80 tests) | 0 | `a3p4-r3-green-glue-host.log` |
| 7 | `p4t6` scanner suite | 0 (after pin) | `a3p4-r3-p4t6-recount.log` (943 vs 941) → `-r2.log` |
| 8 | FULL runtime suite, run 1 | 1 | `a3p4-r3-battery-full.log` — `Test Files 7 failed | 294 passed (301)`, `Tests 9 failed | 3202 passed (3211)`; the 11 FAIL lines ⊃ the 11 baseline lines + the hygiene pin (`a3p3-governance-lane-hygiene`) |
| 9 | hygiene pin amendment (see files) + FULL suite run 2 | 1 | `a3p4-r3-battery-full-r2.log` — 10 failed; fail-list diff vs baseline = ONLY two `p6t1-parallel` legs (load flake, see caveats; `a3p4-r3-battery-fail-list.txt`) |
| 10 | `p6t1-parallel` isolated | 0 | `a3p4-r3-p6t1-flakecheck.log` 9/9 |
| 11 | `npx tsc --noEmit -p .` (`packages/runtime`) | **0** | `a3p4-r3-tsc.log` (0 B) + `.exit` |
| 12 | `pnpm build` (root) | 0 | `a3p4-r3-build.log` |
| 13 | `pnpm build:composition` before staging | 1 | `a3p4-r3-composition-prestage.log` — 27 `content-drift`, **0** `produced-but-untracked`; the 27 are exactly the round-3-edited modules (`pre-execute-adapter`, `decision-lane`, `host`, `agent-bindings` placement, `permission-plane`, `root`, `types`, `storage/repositories/team-domain`) — 100% PR4-round-3-own drift |
| 14 | `pnpm build:composition` after staging (same commit) | 0 | `a3p4-r3-composition-committed.log` (post-total from the log's own line) |
| 15 | staged-diff secret scan | 1 (no real match) | `a3p4-r3-token-scan.txt` — the single hit is the README's own scan-description line (self-referential); excluding the evidence dir the count is 0 |

### Findings about the previous rounds (corrected, not silently patched)

- **The predecessor handoff claimed `root.ts:2974` still carried a "deferred to PR5" permission
  comment. FALSE at head `440ede51`** — grep at that line shows unrelated code and
  `git log -S 'deferred to PR5' -- packages/runtime/src/plugin/root.ts` is empty. Nothing to correct
  there; what WAS stale-and-wrong at head was the host warn text claiming the store was "opened"
  fail-closed while it could never open (BLOCK-0's cover story) and the plane docs asserting the
  envelope was "wired by the caller" while the caller wired nothing (BLOCK-1's cover story). Both
  now state the round-3 truth.
- **The round-1 "32 produced-but-untracked" figure** (README table row 9) stays as recorded; this
  round's composition pre-stage run reports 27 content-drift / 0 untracked — consistent (the
  untracked set was shipped in the round-1 commit; the drift set now equals exactly the modules
  round 3 edited).

### Rulings recorded this round (full text in ROUND3-VERIFIED-CHAINS-AND-RULINGS.md)

1. **Derived Leader envelope (asymmetry stated, no symmetry claimed).** The envelope grammar has no
   `any`/shell matcher (the frozen §6 carrier does not exist yet), so the derived ceiling covers
   file-class `exact`/`subtree` rules from the Leader template's ALLOW/ASK lanes ONLY; Leader EXEC
   (bash/pwsh) expansion therefore has NO grammar authority and keeps refusing
   `PERMISSION_ENVELOPE_EXPANSION_DENIED` typed — the pre-execute dual gate unchanged. File-class
   parity for the Leader is reached; exec parity awaits the carrier.
2. **Mandatory durable authority at the production entry** (BLOCK-5): always-on, no config flag,
   typed startup failure, loud pre-flight; the ONLY zero-new-failure guarantee is for worlds whose
   bound templates declare no `capabilities.permissions` (negative control pinned).
3. **Every refused seam class is a hard deny** with the typed code preserved (ARCHIVED /
   OVERLAY_VIEW_UNDECODABLE / STATIC_FACTS_UNKNOWN pinned as three distinct legs) — no static
   fallback anywhere on the decision path. This closes the design note's open decision in the
   fail-closed direction.
4. **Boot canonicalization uses the row's `defaultWorkspace`; the decision site uses each agent's
   session cwd** (documented asymmetry): absolute configured paths canonicalize identically on both
   sides (all specs use absolute paths); relative template paths would resolve against
   `defaultWorkspace` at boot and against the agent cwd at decision time — flagged for the next
   round rather than silently normalized.
