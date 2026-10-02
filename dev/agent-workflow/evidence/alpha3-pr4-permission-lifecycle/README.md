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
| round-2 commit (this ledger + the folded test leg) | **CORRECTED ROUND 4 (R-C B-1): NO round-2 commit exists in the shipped history.** `440ede51…` contains the lane spec at exactly 25 `it()` legs, and the 26th leg's +58 lines ship INSIDE `3d432261` (folded). The round-2 battery counts (`…3189`) were taken from the UNCOMMITTED WIP tree — stated as such. Whether the hash that round-2 reported was ever pushed is NOT verifiable offline from this worktree; no claim is made either way. Original text kept above/below for the audit trail. Original claim: forward-only child of the round-1 commit, single commit, no force; its 40-char hash is reported in PR #60 and in the parent report (a commit cannot contain its own hash) |
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
| 4 | `npx vitest run test/a3p4-permission-lifecycle-e2e.test.ts` | 0 | round 1: 25 passed → round 2: **26 passed** | **CORRECTED ROUND 4 (R-C A-2): the named "per-file sections" citation does not exist in those logs.** The retained raw for 26 passed is `a3p4-r3-green-existing-p-e2e.log` (round-3 GREEN run of the same spec) |
| 5 | `npx vitest run test/a3p4-production-permission-plane.test.ts` | 0 | `Tests 7 passed (7)` | `a3p4-runtime-suite.log` |
| 6 | `npx vitest run test/p4t6-session-event-scan.test.ts` (`packages/testkit`) | 0 | `Tests 10 passed (10)` after the honest recount 934 → **941**. **CORRECTED ROUND 4 (R-C A-1): the quoted `expected 941 to be 934` line has NO retained raw** — the assertion text is reconstructed, not quoted from evidence. The externally verifiable retained content is `Tests 10 passed (10)` (`a3p4-p4t6-scan-r2.log`) | `a3p4-p4t6-scan.log`, `a3p4-p4t6-scan-r2.log` |
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
  round 3 adds the 2 RED-first regression specs → scanner-reported **943** (**CORRECTED ROUND 4:
  the 943/941 counts are NOT externally verifiable from the retained raws — `a3p4-r3-p4t6-recount-r2.log`
  shows only `Tests 10 passed (10)`; the `expected 943 to be 941` line is reconstructed**) —
  then the pin moved to the scanner's own number —
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


---

## Round 4 — the four-BLOCK close batch: addressed-team authority + the explicit §6 carrier (sole writer, fresh)

Tree base `3d432261a4941328e78ff1785c694fff65d70f3d` (parent `440ede51…`); forward-only.
Input: parent CONFIRMED-GO + the five reviewer reports (R-A, R-B, X1, X2, R-C). Design
rulings + per-BLOCK chains in full: **`ROUND4-FIX-DESIGN-NOTE.md`**. Round-4 raw exit
files use the `rc=N` convention.

### What landed (round 4, non-dist)

| file | change |
| --- | --- |
| `packages/domain/blueprint/src/schema.ts` / `types.ts` / `validate.ts` / `index.ts` | the NEW top-level `permissionMutationEnvelope` carrier (`{operationClass, matcher{exact|subtree→path \| fingerprint→fingerprint}, maximumEffect}`, closed sets, shell↔fingerprint / file↔path enforced AT THE GRAMMAR, duplicate pair refusal); present-only hash inclusion (pre-round-4 contentHashes byte-identical) |
| `packages/runtime/governance/permission-mutation.ts` | `LeaderMutationAuthorizationInput.authorityCeiling?` — every risen cell is additionally capped by the GRANTOR'S EFFECTIVE answer (`permissionEffectiveAnswer` over the leader's own overlay + static facts: deny/ask EXCEPTIONS subtracted, never a lane union); below-ceiling → `EXPANSION_OUTSIDE_ENVELOPE` / `expansion-exceeds-authority-ceiling`, unknown grantor → `EFFECT_CONTEXT_UNAVAILABLE`; ABSENT `authorityCeiling` = the PR3 algebra byte-for-byte |
| `packages/runtime/governance/types.ts` | the lane readers become ADDRESSED: `permissionEnvelope(teamSessionId, memberInstanceId)`, `staticLayers(…)`, NEW `leaderAuthorityFacts(teamSessionId, targetMemberInstanceId)`; `T \| Promise<T>` (sync fakes stay legal) |
| `packages/runtime/governance/service.ts` | awaits the ADDRESSED readers inside the serialized section; folds `authorityCeiling` from the LEADER durable lane (`LEADER_INSTANCE_ID`) + `leaderAuthorityFacts` |
| `packages/runtime/src/plugin/permission-plane.ts` | REWRITE (~640 lines): per-addressed-team `resolveBoundBlueprint` reads (row-wide constant `void teamSessionId` GONE), canonicalization at the TARGET member's effective workspace via the REAL provider, binding tuple `{blueprintId, revision, contentHash, templateId, cwd, providerVersion}` re-validated AFTER every await (drift → discard + abstain, never mixed identity, faults never cached), envelope = the EXPLICIT carrier ONLY (the static-lane DERIVATION is deleted; fingerprints verbatim), `leaderAuthorityFacts`, warm-refresh semantics (§ GAP3 below) |
| `packages/runtime/src/plugin/root.ts` | `permissionLeaderAuthorityFacts` pass-through; lane deps types via `GovernancePermissionLaneDeps` |
| `packages/runtime/src/plugin/host.ts` | the facts wiring is built on `resolveBoundBlueprint(team)` (three-case bound authority, throw→UNKNOWN wrapper — never the anchor fallback), per-member effective workspace (`row.workspace ?? defaultWorkspace`), the real fs canonicalizer (`resolve(path,{cwd}).targetKey`); loud post-boot log rewritten (warm-up semantics, carrier wording, addressed-team text) |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | honest recount pin 943 → **944** (one new spec file; RED raw `round4/r4-p4t6-scan.log` shows `expected 944 to be 943` BEFORE the recount) |
| `packages/runtime/test/a3p4-r4-authority-binding.test.ts` | NEW (14 legs, group A/B below) |
| `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` | E2 fixture re-anchored DERIVED→configured carrier (+comment/title honesty); NEW `R4` describe: 6 host-`apply()` legs |

### Blocks closed (chain → RED raw → GREEN raw), each pinned at production entry

- **BLOCK-1 exec UNREACHABLE** — carrier grammar carries exec fingerprint authority → builder
  maps it VERBATIM → real boot commits the exact-fingerprint grant. RED: round 3 could not even
  express the carrier (grammar rejection; the derivation skipped shell rules — R-A BLOCK1/B-0).
  GREEN: `R4-exec` (legal fingerprint ALLOW commits at host apply; uncarriered fingerprint
  refuses `PERMISSION_ENVELOPE_EXPANSION_DENIED`; envelope-free tightening still legal) —
  `round4/r4-family-green.log`; root-level `A3` (verbatim, ZERO provider calls).
- **BLOCK-2 ROW-A-ON-BEHALF-OF-TEAM-B** — `void teamSessionId` deleted; every fact resolves
  through `resolveBoundBlueprint(ADDRESSED team)`; identical-templateId isolation. GREEN: `A1`
  (teams A/B share templateId `worker`, carrier on A only → A expands, B has zero authority,
  ghost team abstains) + the whole E/R4 entry family.
- **BLOCK-3 CWD WRONG-SOURCE** — canonical anchor = TARGET member's effective workspace (never
  the acting row/anchor cwd), envelope + target static facts + leader-ceiling facts + rising
  cells share ONE canonical key space per decision (documented ruling; cross-workspace ceiling
  interpretation can only make ceilings STRICTER = fail closed); drift revalidation after the
  canonicalization await. GREEN: `A2` (two members, same relative rule → divergent keys),
  `A7` (mid-await workspace drift → document discarded, never cached), `A8` (cache keyed by the
  FULL tuple; rebind rebuilds), `R4-anchor` (member-basis key COMMITS, foreign-basis key
  refuses — the round-3 inversion).
  **[SUPERSEDED PARTIALLY 2026-10-02 (ROUND 5): the leader-ceiling facts clause is GONE (FIX-1); the authority cache was
  REMOVED outright (FIX-4 — a constant `providerVersion` is not a version; every read
  RE-CANONICALIZES through the CURRENT provider/cwd), so `A8` is INVERTED to a
  no-cross-call-cache pin (rebind-rebuild half kept); and the memberWorkspace FALLBACK now
  reads the DURABLE TeamSession default, never the acting boot row (FIX-3) — pinned by
  `R5-ws` (NON-BOOT Team B, leader position + member without a workspace row).]**
- **BLOCK-4 DERIVE SWALLOWING DENY/ASK** — **[SUPERSEDED PARTIALLY 2026-10-02 (ROUND 5): the SECOND gate this bullet adds
  on top (`authorityCeiling` = the leader's effective answer capping every risen cell) was
  REMOVED — ADR §6 carries no second policy condition; see ROUND4-FIX-DESIGN-NOTE.md supersede
  marker incl. the mislabeled `expansion-region-uncovered` refusal finding. The DERIVATION
  REMOVAL below STANDS.]**- **BLOCK-4 DERIVE SWALLOWING DENY/ASK** — derivation DELETED (absence ≠ read failure: absent
  carrier = legal typed zero authority, NO hard-fail of unrelated reads — `A4`, `R4-absent`:
  tightening commits while the same static-lane grant that round 3 DERIVED to legal now
  refuses); risen effects additionally checked against the leader's EFFECTIVE answer. GREEN:
  `B1` (X1 demo 1 verbatim: deny-exception leg — exception refuses, exception-subtracted rest
  grants) + `B2` (X1 demo 2 verbatim: ask-ceiling leg) + `B3` (unknown grantor =
  `EFFECT_CONTEXT_UNAVAILABLE`, never assumed) + `B5` (deny→allow laundering class stays closed)
  + entry `R4-derive` (carrier covers, CEILING refuses, through the real boot) + `B4` (legacy
  callers WITHOUT `authorityCeiling` keep the PR3 algebra byte-for-byte — the a3p3 80/80 family
  untouched and green).
- **GAP3 refresh-FAILURE semantics (recorded, pinned)** — boot refresh is a WARMUP: a provider
  fault logs LOUD (`console.error` + degraded `console.info` line), the boot CONTINUES
  (never a boot failure), expansion-capable reads ABSTAIN typed (`EFFECT_CONTEXT_UNAVAILABLE`
  / zero-authority refusal) meanwhile, UNAFFECTED readers keep serving correct current facts,
  faults are NEVER cached so the next addressed read REBUILDS (bounded recovery). GREEN:
  `A6` (unit) + `R4-recover` (entry: fault → typed refusal + unaffected commit → fault clears
  → the SAME mutation now commits).

### Reviewer findings → disposition (CLOSED per each reviewer's re-verification; this table is the FIXED ledger)

| reviewer | finding | round-4 disposition |
| --- | --- | --- |
| R-A | BLOCK1 async ordering (host.ts:2623-2652) + facts shape | CLOSED at round 3 re-verification; the async ordering fix STAYS (post-boot `await refresh()` preserved through the round-4 rewrite) |
| R-A | BLOCK5 mandatory-open | CLOSED round 3; unchanged, still pinned (E0/E1 negative controls green) |
| R-A | envelope/static semantics confusion | FIXED round 4: carrier is the ONLY envelope source; `A3`/`A4`/`R4-absent` pin the separation |
| R-A | GAP3 fail-closed refresh semantics undocumented | FIXED round 4: semantics documented here + in the design note, pinned `A6`/`R4-recover` |
| R-B | BLOCK2 cross-team / BLOCK3 cwd / BLOCK4 derive | FIXED round 4 (above), pinned at BOTH levels |
| R-B | exec code identity | FIXED round 4: fingerprint verbatim end-to-end, `A3` + `R4-exec` |
| X1 | exec-reachability split (carrier needed for exec authority; `any` may NEVER derive exec authority) | FIXED round 4 exactly along the split: carrier-fingerprint path added, `any`-derivation stays forbidden; dual gate + overlay exec-shape rules untouched (decision plane untouched — no diff there) |
| X1 | demos: deny-exception + ask-ceiling must both pin | `B1`/`B2` verbatim + `R4-derive`/`R4-ceiling` at entry |
| X1 | (round-5 note 2026-10-02) the ceiling DEMOS above were retargeted with the gate's removal: `B1`/`B2` now pin the ENVELOPE'S OWN ladder algebra (carrier `maximumEffect`), `R4-derive` → `R5-derive` (carrier-covered grant COMMITS despite leader deny; no self-widening), `R4-ceiling` KEPT (carrier ladder math — name collision with the deleted gate, deliberate). X1's EXEC truths (dual gate, no `any` derivation) remain untouched. |
| X2 | decision-plane-per-team refinement (live glue CORRECT today; mutation-authority plane was the defect; no verdict cache exists) | respected: glue untouched; isolation pinned at the mutation plane (`A1`); **no production wire caller of `grantInstance` at this commit** — the root `permissionPlane` surface + these entry tests are what make the isolation real (stated per X2, no live-RPC claim) |
| R-C | B-1/A-1/A-2 ledger errors | FIXED this round — see "Ledger corrections (round 4)" below |

### Round-4 battery (real exits, this worktree, clean scratch; raws under `round4/`)
> **[SUPERSEDED PARTIALLY 2026-10-02 (ROUND 5): every count below was superseded by the round-5 battery (`round5/`) —
  two tools (13 → 15), one remote method (29 → 30), five retargeted/added spec legs and five
  added entry legs. The rows stay as the round-4 record.]**

| # | command (cwd) | exit | recorded result (QUOTED from the raw) | log |
| --- | --- | --- | --- | --- |
| 1 | RED probe — family with the NEW carrier semantics BEFORE the E2 fixture re-anchor | 1 | `Tests 1 failed \| 54 passed (55)` (the old derived-envelope leg `E2-i-host`, refusing exactly as the new rules demand) | `r4-family-redprobe.log` |
| 2 | `npx vitest run test/a3p4-r4-authority-binding.test.ts` (`packages/runtime`) | 0 | `Tests 14 passed (14)` | `r4-spec1-authority-binding.log` |
| 3 | `npx tsc -p tsconfig.json` (`packages/runtime`; includes `src` + `test`) | 0 | 0-byte stdout | `r4-tsc.log` |
| 4 | PR4 family (plane 7 + routing 13 + entry 15 + e2e 26 + authority-binding 14) | 0 | `Tests 75 passed (75)` | `r4-family-green.log` |
| 5 | `pnpm run build` (repo root) | 0 | all packages built | `r4-build.log` |
| 6 | `node scripts/check-artifacts-committed.mjs` BEFORE staging | 1 | content-drift list = exactly the modules round 4 edited | `r4-artifacts-PRESTAGE.log` |
| 7 | FULL runtime suite run 1 | 1 | `Test Files 6 failed \| 296 passed (302)`, `Tests 8 failed \| 3223 passed (3231)`; **failset vs `baseline-failset.txt` = byte-identical (`diff` exit 0)** | `r4-battery-full.log`, `r4-battery-failset.txt` |
| 8 | FULL runtime suite run 2 (repeat) | 1 | `Tests 8 failed \| 3223 passed (3231)`; repeat failset byte-identical to BOTH run 1 and the baseline | `r4-battery-full-repeat.log`, `r4-battery-repeat-failset.txt` |
| 9 | FULL runtime suite run 3 (final tree, after the post-battery tsc fix + rebuild) | 1 | `Test Files 6 failed \| 296 passed (302)`, `Tests 8 failed \| 3223 passed (3231)` | `r4-battery-final.log` |
| 10 | `p4t6` scanner (`packages/testkit`) RED (pre-recount) → GREEN (pin 944) | 1 → 0 | `expected 944 to be 943` → `Tests 10 passed (10)` | `r4-p4t6-scan.log` → `r4-p4t6-scan-r2.log` |
| 11 | `node scripts/check-artifacts-committed.mjs` AFTER staging (same commit) | 0 | `[check-artifacts-committed] OK: 1424 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))` (dist total UNCHANGED at 1424 — round 4 edited only already-shipped modules) | `r4-artifacts-COMMITTED.log` |
| 12 | `git diff --cached \| grep -icE 'api[_-]?key\|secret\|passwd\|password\|ghp_\|AKIA\|-----BEGIN'` | 0 (20 matches) | **stated per-log, not blended**: ALL 20 matches are the round-4 deny-exception DEMO fixture (`/work/secret`, `secretPath`) from `a3p4-r4-authority-binding`/entry `R4-derive`; zero high-confidence indicators (`ghp_`/`AKIA`/`api_key`/`-----BEGIN` matched nothing). Round 1's row 11 reported `0` because no prior round used the word | recorded here |

**Per-log failset statements (no blended claims).** Run 7 (`r4-battery-full.log`) FAIL
lines = 11, `diff` against `baseline-failset.txt` (11 lines) exits 0 — byte-identical,
so round 4 adds ZERO new failures AND clears none of the pre-existing ones (the
round-3 hygiene-pin extra is gone because the pin was fixed in round 3). Run 8
(`r4-battery-full-repeat.log`) FAIL lines = same 11 (diff vs run 7 exit 0) — the two
`p6t1-parallel` flakes from round-3 run 2 did NOT recur in either round-4 run. Run 9
(final tree) summary byte-equal to run 7 (`r4-battery-final.summary`). Test-count
delta vs round 3's final battery (3211): +20 = the 14 new spec-1 legs + the 6 new R4
entry legs; the prior 55 family legs all still pass (no weakening — E2's absolute-path
legs retained, the relative-divergence coverage ADDED alongside, per parent ruling).

### Ledger corrections (round 4 — mandatory, per R-C B-1/A-1/A-2)

1. **(B-1) There is NO round-2 commit in the shipped history.** `440ede51` contains the lane
   spec at exactly 25 `it()` legs; the 26th leg's +58 lines ship INSIDE `3d432261` (folded
   WIP). The round-2 battery figure `…3189` was taken from the UNCOMMITTED WIP tree and is
   reported here as exactly that. Whether the hash that round 2 reported was ever pushed is
   NOT verifiable offline from this worktree — no claim either way. (The Identity-table row is
   annotated in place; the battery-table rows 3 keep their raws — they ARE the WIP-tree raws.)
2. **(A-1) The round-1 quote `expected 941 to be 934` has no retained raw** — reconstructed,
   not quoted (table row 6 annotated). The externally verifiable retained content is
   `Tests 10 passed (10)`.
3. **(A-2) Entry 9's line-4 citation "per-file sections of …" does not exist** in the named
   logs; the retained raw for `26 passed` is `a3p4-r3-green-existing-p-e2e.log` (annotated).
4. **Scanner counts 943/941 are NOT externally verifiable from retained raws** (round-3
   `a3p4-r3-p4t6-recount-r2.log` shows only `Tests 10 passed (10)`); annotated at the
   round-3 caveat. Round 4's own recount keeps BOTH raws (RED `expected 944 to be 943` +
   GREEN `10 passed`) so this round is verifiable.
5. **`ROUND3-VERIFIED-CHAINS-AND-RULINGS.md` "This never widens" is FALSE as shipped** — the
   derivation DID widen past the leader's effective answer at deny/ask exception regions;
   correction appended IN PLACE at the claim (line ~44) and the false code comment (then
   `permission-plane.ts:259-260`) is deleted with the round-4 rewrite.
6. **Failset comparisons are now stated PER LOG** (see the dedicated paragraph above); earlier
   rounds' blended phrasings are superseded by it.

### Honest non-closures / recorded edges (round 4)

- No production wire caller of `grantInstance` at this commit (root `permissionPlane` surface +
  tests only). The isolation/entry tests exercise the REAL host boot + mutation service — they
  are not live-RPC claims (per X2, stated plainly).
- Tool-surface canonicalization of leader-authored grant RESOURCE texts at the target-member
  basis is FUTURE wiring; grant matchers remain canonical keys (the R4-anchor foreign-key leg
  pins that a non-member-basis key simply gets NO authority — fail-closed).
- A SECOND TeamSession booted inside ONE host world was not added; cross-team isolation is
  pinned (a) directly on the builder with identical templateIds (`A1` — the exact BLOCK-2
  shape) and (b) through the bound-Blueprint resolver those multi-team specs already pin
  (`policy-state-multi-team-bound-blueprint.test.ts` stays green in the battery).
- The lane's no-change early return stays byte-stable BY DESIGN (X2's refined site): pair
  equality = opaque identity; staleness is eliminated upstream at the readers (anchor +
  revalidation), and an unchanged effective state is not an expansion.
- X1's standing exec truths preserved verbatim (dual gate; overlay exec shapes; no `any`
  derivation) — `CONSOLIDATED-FIX-DESIGN-NOTE.md` §:64 unmet-line now CLOSED by the carrier.


---

## Round 5 — the parent's FINAL batch: the second gate out, the REAL entries in (sole writer, fresh)

Date: 2026-10-02. Tree base (round-4 HEAD) `137532f4…`, parent of that `3d432261…`.
Input: the parent's round-5 directive (implement NOW, do not park on reviewers) +
three independent reviewer reports over the shipped round-4 HEAD (R-A design/law,
R-B line-level, R-C entry/production — archived, condensed + attributed, in
`round5/REVIEWER-REPORTS-ROUND5-ARCHIVE.md`, including the GAP-numbering map and
the note that the forwarded originals were not committed at receipt).

### What landed (round 5, non-dist — 27 files)

- **FIX-1 — the SECOND policy gate is GONE** (ADR §6 carries exactly ONE policy
  condition: the explicit carrier over the TARGET's effective before/after).
  `authorityCeiling` deleted from the kernel input + risen branch
  (`governance/permission-mutation.ts`), the service fold (`governance/service.ts`),
  the `leaderAuthorityFacts` type member (`governance/types.ts`), the plane reader
  and the host injection. KEPT per rulings: real actor identity, the PR3 legacy
  operator explicit-capability admission (operator mutations intentionally skip
  the LEADER authorize gate — pinned since PR3, now WIRE-REACHABLE via FIX-2),
  the single carrier, the target effective before/after check (kernel, byte-stable).
  Writer-discovered while removing it: the round-4 ceiling refusals were
  **MISLABELED** — the aggregate coverage loop threw the wrapped
  `expansion-region-uncovered` problem while the documented
  `expansion-exceeds-authority-ceiling` label was UNREACHABLE in that path
  (cited in the ROUND4-FIX-DESIGN-NOTE.md supersede markers).
- **FIX-2 — REAL production entries, both paths** (no future-listing):
  (a) TOOLS: `team_grant_permission` + `team_revoke_permission` on the real
  `ToolSpec` surface (`tools/src/tools.ts`; registration AFTER the archive tool —
  existing selection indices untouched). Leader identity is taken SERVER-SIDE
  from the session identity (`resolveToolCaller`), never from arguments; member
  callers are refused typed (`TEAM_TOOL_PERMISSION_NOT_LEADER`); malformed rules
  refused by a CLOSED rule grammar (1..32 rules, `exact|subtree|fingerprint`,
  `allow|ask|deny`); non-fingerprint path values are canonicalized INSIDE the
  wiring at the TARGET member's basis (`root.ts` → `options.permission.canonicalizeFile`,
  member row workspace else DURABLE TeamSession default; unwired/no-workspace →
  typed refusal) — client-supplied keys are never authorization input. Mutation
  identity = the tool's request token (`perm-<verb>-<token>` = durable dedupe).
  (b) RPC: new REMOTE method `override.mutatePermission` (v7-only — the closed
  availability chain v1–v6 excludes it, typed `method-version-unsupported` below
  7; OVERRIDE category; catalog 29 → 30). The strict closed param schema
  (`remote/src/contracts/params.ts`) refuses unknown fields — a client smuggled
  `authority` field is DEAD: the handler derives the principal server-side
  (`principalDerivation`) and maps human → `{kind:'operator'}` through the SAME
  `authorityOf` the override lane uses, then routes to `options.governance.
  mutatePermission` (`s6-remote.ts` port + router).
- **FIX-3 — CWD source-of-truth**: `host.ts` memberWorkspace fallback now reads
  the DURABLE `teamSessions.get(teamSessionId)?.defaultWorkspace` — for the
  no-member-workspace case AND the leader position (no member row at all). The
  ACTING boot row's `resolvedRowConfig.defaultWorkspace` is never a cross-team
  fallback; no durable row → `undefined` (UNKNOWN → typed refusal).
- **FIX-4 — NO unprovable-version authority cache**: the plane's cache Map +
  bindingKey are DELETED (a constant `providerVersion` is not a version —
  symlink re-point staleness; the old key omitted `templateId`; nothing evicted).
  Every read RE-CANONICALIZES inside the serialized outer layer through the
  CURRENT provider/cwd; the post-read identity revalidation (drift → discard +
  abstain) stays; faults still never cache; `healthy()` now derives from
  per-target READ RESULTS (R-A minor) and a warm-up fault prints a LOUD
  `console.error` (`R4-recover` asserts the line). `refresh()`'s rebind→rebuild
  half survives; the A8 cache-tuple pin is INVERTED into a no-cross-call-cache
  pin (a stable binding MUST show fresh provider reads through).
- **R-B folded**: carrier NEGATIVE-GRAMMAR legs (closed ladder vocabulary /
  closed field set / matcher-kind closure — first legs of this class anywhere in
  the repo) + the GOLDEN content-hash pin (`sha256:f0148ab8…c897bd6`) guarding
  canonicalizer drift.
- **Closed-set growth (precedent: C1, archive-member)**: team tools 13 → **15**
  (vocab + count pins retargeted in `d1-member-base-tools`,
  `t12a-team-tools-registration`, `tcm-d4-root-context`, `t4a-capability-wiring`,
  `p8s5a-production-assembly` T1.1, `c1-list-pending-control`,
  `archive-member-tool` A1, `p6t6-bypass-scan`); remote methods 29 → **30**
  (`tcm-m1`, `d1-remote-v3`, `f9-remote-v4`, runtime `p8s7r4` S4;
  `REMOTE_V7_ONLY_METHODS` exported from the package index). The external
  skill-catalog text still says "thirteen" — that is NOT this repo's frozen-doc
  set (`frozen thirteen` = 0 occurrences there, re-checked round 4); recorded,
  not chased.

### Tests added / retargeted (RED raws before GREEN)

- `a3p4-r4-authority-binding.test.ts` (14 → **13**): B1/B2 retargeted to the
  ruled envelope algebra (carrier-covered subtree grant COMMITS; envelope
  `maximumEffect` ladder math intact); B3 removed with the gate; A9 REPLACED by
  the leader-position staticLayers pin (workspace = durable team default;
  ghost team → `undefined`); A8 INVERTED (fresh reads through a stable binding);
  B4/B5 kept verbatim (verified ceiling-FREE inputs — R-C's B5 suspicion was
  wrong at line level).
- `a3p4-pr4-production-entry-regression.test.ts` (15 → **20**): `R4-derive` →
  `R5-derive` (THE required positive: carrier-covered member grant COMMITS
  while the LEADER's own decide for the same key stays DENY — no self-widening);
  `R4-recover` + the LOGD warm-up-fault assertion + the exact during-fault wire
  code pinned (`PERMISSION_ENVELOPE_EXPANSION_DENIED` — during a fault BOTH
  reads abstain and the kernel aggregates envelope-zero FIRST; the pure
  facts-abstention CONTEXT route stays pinned at
  `a3p3-permission-mutation-authority.test.ts:454`); NEW `R5-tool`, `R5-rpc`
  (grant→durable overlay→NEXT pre-execute ALLOW→revoke→DENY through the REAL
  surfaces incl. member-caller refusal, closed-schema refusal, dedupe replay,
  v6 typed rejection, operator human mapping), `R5-ws` (NON-BOOT Team B over
  ONE host row: B member WITHOUT a workspace row + B LEADER commit at B's
  durable default; the row-A basis REFUSES typed; Team A stays correct
  concurrently), `R5-grammar`, `R5-hash`.
- RED evidence (round-4 tree, the NEW/rewritten legs first):
  `round5/r5-redprobe-rewritten-legs.log` — `Tests 3 failed | 25 passed (28)`
  (exactly the inverted legs: A8, the derive inversion, the recover log
  assertion — the round-4 tree cannot satisfy the round-5 rulings).
  `round5/r5-entries-iter1.log` — the FIRST run of R5-tool/R5-rpc refused
  typed: the writer had invented the kind token `revoke_instance`; the kernel's
  closed set (`permission-mutation.ts:394`: `grant_instance |
  update_permission | revoke_permission`) caught it — corrected everywhere.

### Round-5 battery (real exits, this worktree, clean scratch; raws under `round5/`)

| # | command (cwd) | exit | recorded result (QUOTED from the raw) | log |
| --- | --- | --- | --- | --- |
| 1 | RED probe of the rewritten legs on the round-4 tree (`packages/runtime`) | 1 | `Tests 3 failed \| 25 passed (28)` | `r5-redprobe-rewritten-legs.log` |
| 2 | entry file, GREEN (whole file incl. R5) | 0 | `Tests 20 passed (20)` | `r5-green-entry-final.log` |
| 3 | `test/a3p4-r4-authority-binding.test.ts` | 0 | `Tests 13 passed (13)` | `r5-spec1-rerun.log` |
| 4 | PR4 family (plane 7 + e2e 26 + spec1 13 + entry 20) + routing file separately | 0 / 0 | `Tests 66 passed (66)` + `Tests 13 passed (13)` → **79** (round 4 was 75: entry +5, spec1 −1; the runtime-suite delta is the same +4) | `r5-family-green.log`, `r5-family-routing.log` |
| 5 | FULL remote suite | 0 | `Tests 220 passed (220)` | `r5-remote-suite-r3.log` (iter logs `-suite.log`, `-r2` kept: the 29→30 + v7-import iterations, per-log failsets, no blending) |
| 6 | FULL tools suite | 1 | `Tests 1 failed \| 110 passed (111)` — the ONE is `p6t6-actions` "worker -> leader delivered direct", PROVEN pre-existing at the shipped HEAD: the leg fails BYTE-EQUAL against HEAD's versions of every file this diff touches (`Tests 1 failed \| 13 skipped (14)`, same `session-root-p6t1` assertion); the HEAD-file run restored all files from backup immediately | `r5-tools-suite-r3.log`, `r5-p6t6-head-probe.log` |
| 7 | FULL runtime suite, run 1 (concurrent with #5/#6) | 1 | `Tests 9 failed \| 3226 passed (3235)` — baseline 8 + `team-session-activation` A15 (absolute-deadline TIMING leg; passes `16/16` ISOLATED) = the recorded load-flake class | `r5-runtime-suite-r2.log` |
| 8 | FULL runtime suite, run 2 (SOLO, final tree) | 1 | `Test Files 6 failed \| 296 passed (302)`, `Tests 8 failed \| 3227 passed (3235)`; failset vs `round4/r4-battery-failset.txt` = **byte-identical (diff EMPTY)** | `r5-runtime-suite-r3.log`, `r5-runtime-failset-r3.txt`, `r5-failset-diff-vs-r4.txt` |
| 9 | `npx vitest run test/p4t6-session-event-scan.test.ts` (`packages/testkit`) | 0 | `Tests 10 passed (10)` (no new test FILES this round — the count pin stands) | `r5-p4t6-scan.log` |
| 10 | FULL domain suite (NOT covered by the runtime battery — recorded for completeness) | 1 | `Tests 10 failed \| 482 passed (492)`: `t1-capability-schema` ×9 (pre-existing per code identity — zero changed files under `packages/domain\|storage\|contracts` in this diff) + `t2-blueprint-hash` ×1 ("projects absent optional singles as explicit null" — a projection test my diff cannot reach; the round-4 note's "t2 green" was itself a code-identity claim that was NEVER RUN; honest correction: t2 is RED in the domain suite on the shipped tree class too) | `r5-domain-suite.log` |
| 11 | `npx tsc --noEmit -p .` (`packages/runtime`) | 0 | clean | `r5-tsc.log` |
| 12 | `pnpm run build` (repo root) | 0 | all packages Done; dist staged IN THE SAME commit | `r5-build.log` |
| 13 | `node scripts/check-artifacts-committed.mjs` (pre-commit, dist staged) | 0 | `OK: 1424 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))` — re-run post-commit in `r5-artifacts-COMMITTED.log` | `r5-artifacts-PRESTAGE.log`, `r5-artifacts-COMMITTED.log` |
| 14 | staged-diff secret scan (same pattern as round-4 row 12) | 0 (24 matches) | stated exact: ALL 24 are `secret`-family (the carrier deny-exception fixtures `secret.txt`/`secretPath`/`/work/secret` + this ledger's prose); the exactly ONE line matching a HIGH-confidence pattern (`api[_-]?key`/`-----BEGIN`) is THIS row's OWN scan-pattern line — a self-match; zero external credentials (`ghp_`/`AKIA`: 0) | `r5-secret-scan.log` |

### Ledger corrections (round 5 — mandatory)

1. **A-1/A-2 transposition**: the round-4 "Ledger corrections" rows cited R-C's
   A-1/A-2 swapped (A-1 = the per-file-sections citation → retained raw
   `a3p4-r3-green-existing-p-e2e.log`; A-2 = the reconstructed `941/934`
   scanner line with NO retained raw). Both inline tags corrected in place; the
   corrections themselves stand.
2. **ROUND4-FIX-DESIGN-NOTE.md line 4**: "CONFIRMED-GO" was overstated framing
   for the parent's round-4 directive (implement while reviews circulate);
   annotated — read as GO-to-implement, never design-beyond-review.
3. **GAP numbering**: round-4 README's "GAP3" (refresh semantics) vs the
   round-5 reports' GAP2(hard)/GAP3(minor) — mapped in
   `round5/REVIEWER-REPORTS-ROUND5-ARCHIVE.md`; no silent renumbering.
4. **Round-4 supersede markers** added in place: README BLOCK-3/BLOCK-4 bullets,
   the X1 ledger row, the round-4 battery header, the ROUND3-VERIFIED addendum,
   and ROUND4-FIX-DESIGN-NOTE.md §2/§3/§5 + header. All dated 2026-10-02, all
   keeping the round-4 text visible AS RECORDED.
5. **Family math re-pinned**: 75 → **79** (per-file: plane 7, routing 13, e2e
   26, spec1 13, entry 20) — matches the full-suite +4 test delta exactly.

### Honest non-closures / recorded edges (round 5)

- The entry worlds' CALLER-IDENTITY seam is the stub glue's `resolveCaller`
  (overridden live to Leader/member per leg): the seam's own root-binding is
  pinned in the tools package suite; the R5 legs pin everything downstream of
  it. Stated, not hidden.
- Glue ambiguity (recorded, NOT code): agent-bindings boot-member `meta.cwd`
  equals `config.defaultWorkspace` in boot worlds — a boot-only world cannot
  distinguish row-vs-team default by construction; the FIX-3 pin therefore uses
  a NON-boot Team B where the two ARE distinct (`R5-ws`).
- `override.mutatePermission` v<7 pin covers the typed rejection at the
  dispatcher gate; the v7 param-schema negatives pinned: unknown field, plus
  the closed kind/matcher/effect vocabularies. Deep fuzzing not added (budget).
- Operator (human) mutations skip the LEADER authorize gate BY DESIGN (PR3
  legacy explicit-capability admission, pinned `a3p3` plane legs since round 1);
  the new wire merely REACHES that pre-existing semantics.
- The `update_permission` kind exists in the kernel closed set but is exposed
  by NEITHER new entry this round (tool = grant/revoke; RPC exposes grant +
  revoke like the tool pair). Not future-listed as shipped surface.
- Pre-existing reds recorded this round with proofs: `p6t6-actions` messaging
  leg (HEAD-probe raw), domain `t1`×9 + `t2`×1 (code identity), the A15
  timing-leg load flake (isolated 16/16 vs concurrent fail).

## Round 7 — the lifecycle law IN the shared lane, the addressed root, the closed exec intent, the required reason (sole writer, fresh)

Date: 2026-10-02. Tree base (shipped round-5 pair) code `6f755080`, evidence tip
`dbf8ecb1`; branch/PR unchanged, Draft kept.
Input: the parent's round-7 GO batch (BLOCK-1 shared-path lifecycle gate with the
parent-pinned TRI-STATE, BLOCK-2 one trusted per-call addressed-root context,
item 3 closed-set structured exec intent canonicalized SERVER-SIDE, item 4 reason
contract = R-B option (a)) + the evidence-hygiene corrections (per-log failset
diffs that cannot silently print empty, A15 isolated raw, t2 triage, p6t6 wording,
B6-1 completeness).

### What landed (round 7, non-dist — 14 source/test files + this ledger)

- **BLOCK-1 — the lifecycle gate moved INTO the serialized mutation path.**
  `assertPermissionMutationTarget(members, tsid, mid, operation)` is now the ONE
  exported law (`permission-lifecycle/mutation-lane.ts:78`, re-exported at
  `permission-lifecycle/index.ts:61`); the lane's pre-check delegates to it
  (`mutation-lane.ts:115`), and the governance service calls it INSIDE
  `deps.chain.run` — after the serialized lock is held, before ANY
  classification or append (`governance/service.ts:612-613`, law comment
  :608; `GovernancePermissionLaneDeps.targetGuard` at `governance/types.ts:144`;
  passthrough `permission-plane.ts:181-188`). NO parallel second gate: the SAME
  function runs pre-lane and in-section (post-await revalidation — a DISPOSED
  transition racing past the pre-check is caught inside the section). Both
  entries route through `plane.mutation.grantInstance/revoke` ONLY
  (`src/plugin/root.ts:2665` `permissionLaneMutate`, wired at :2943 RPC-side and
  :3116 tool-side); no entry checks-then-calls-GMS directly.
  TRI-STATE pinned by legs (`R7-law`, `R7-rpc`): **unknown** →
  `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN`, zero write; **DISPOSED** →
  `PERMISSION_LIFECYCLE_TARGET_TERMINAL`, zero write; **ARCHIVED** → overlay
  legally MUTABLE (grant commits) but execution NEVER happens — the leg grants
  through the real tool, then drives the REAL pre-execute adapter and asserts
  the overlay-allow STILL does not produce ALLOW (the decision lane's own
  ARCHIVED refusal precedes facts). Mutation-legal vs execution-illegal,
  split-pinned.
- **BLOCK-2 — ONE trusted per-call addressed context.** The tool closure no
  longer captures the boot `rootSid`: `canonicalizeFile(teamSessionId,
  targetInstanceId, path)` (`tools/src/types.ts:268`) is called with the
  PER-CALL ctx at `tools/src/tools.ts:1388`, and the root implementation is
  parameterized (`src/plugin/root.ts:3121`). The R7-addr leg boots Team B under
  a foreign boot root: the tool call addressed to Team B commits
  `exact:<wsB>/b.txt` (B's durable defaultWorkspace), `exact:<wsA>/b.txt`
  provably ABSENT, and the pre-execute ALLOW leg runs under B. The s6 RPC file
  branch was already addressed-clean; both entries now share the law.
- **Item 3 — CLOSED-SET structured exec intent; the fingerprint is GMS-internal.**
  The wire vocabulary is `{kind:'exact'|'subtree', value}` OR `{kind:'exec',
  intent}` — the raw `fingerprint` string is REMOVED from both entries' grammar
  (a client cannot self-label canonical authority; smuggle legs at tool AND
  router refuse with zero write). `TeamPermissionExecIntent`
  (`tools/src/types.ts`, exported via `tools/src/index.ts`) /
  `RemotePermissionExecIntent` (`remote/src/contracts/params.ts:1477`) carry
  ONLY `{tool: bash|pwsh (default bash), command, workdir?, run_in_background?,
  timeoutMs?, sandbox_permissions?}`; closed fields, unknown fields refused
  (`tools.ts:1208` `parseExecIntent`, `params.ts:1527`). The SERVER canonicalizes
  through the REAL `canonicalizeShellOperation` (`root.ts:2706`
  `permissionExecCanonicalize` builds the exec args at the target's durable
  workspace and takes `.fingerprint`); the GMS stores exactly the same
  `fingerprint:sha256:…` the execution plane computes — the exec legs assert
  entry-side and execution-side keys are BYTE-IDENTICAL (grant→ALLOW for the
  identical call, DENY for another command, revoke→DENY, via the REAL
  `installParameterPermissionListener`). No new authority surface: the intent is
  data, the canonicalizer is the kernel's own.
- **Item 4 — reason is REQUIRED at the RPC wire (R-B option (a)).** Zero shipped
  consumers; the kernel ALWAYS required it; an optional wire reason only lets
  provenance be silently omitted. `params.ts:1602` `requiredField(…, 'reason')`
  + non-empty ≤512 (:1604). The kernel label split is honest now: missing-field
  → `reason-missing`, length → `reason-over-bound`
  (`governance/permission-mutation.ts:461/:469`) — the round-5
  `reason-over-bound` mislabel for absent-field is corrected.
- **Writer-discovered through the ROOT-ASSEMBLED router (two real gaps the
  fixture-level dispatchers could not see):**
  1. v7 params lacked the `actor` derivation claim — the root dispatcher's
     `deriveMutationActor` REQUIRES `params.actor` (v7 contract), so every
     legitimate root-assembled call would have died `malformed-actor`. Added to
     contract + parse + dispatcher mapping
     (`params.ts` `RemoteOverrideMutatePermissionParams.actor`,
     `s6-remote.ts:3638`); the round-5 RPC fixture had to gain the claim too —
     proving the round-5 RPC legs were fixture-level.
  2. `REMOTE_BACKING_ERROR_CODE_SET` carried ZERO `PERMISSION_*` codes, so at
     the real router every typed permission refusal (lifecycle, envelope,
     generation…) degraded to `internal-error` — the round-5 typed-code claims
     were only ever fixture-visible. Nine codes added
     (`remote/src/handlers/dispatch.ts:220-228`); the R7-rpc legs now pin
     `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN` / `…_TARGET_TERMINAL` /
     malformed-`reason` as TYPED codes through the root-assembled dispatcher.
  The root now exposes `remoteDispatcher` (`root.ts:3483`, `plugin/types.ts`)
  for exactly this entry-level verification.

### Regression battery (all raws in `round7/`, `.exit` per log)

- **NEW `a3p4-pr7-entry-exec-contract-regression.test.ts` — 12/12**
  (`r7-family-green.log` with the 5 a3p4 files: family **91/91**). 3 exec legs
  (tool), 5 RPC legs (root-assembled dispatcher incl. reason-required +
  provenance-verbatim), lifecycle tri-state, addressed-root Team B, kernel
  semantics (reason label split; replay = rule-set-equal no-op, same-mutationId
  different-rules STILL commits — mutationId is provenance, NOT dedupe).
  MANDATED legs: actual tool/RPC → GMS → REAL `installParameterPermissionListener`
  pre-execute boundary, NO `plane.decide` substitutes, BOTH file and exec
  classes, grant→ALLOW and revoke-or-absent→DENY on every leg.
- **Runtime suite** `r7-runtime-suite-r1.log`: `8 failed | 3239 passed` — the
  failset is BYTE-IDENTICAL to the round-4 baseline (`r7-runtime-failset-r1-diff.txt`,
  counts printed on both sides; +12 tests = exactly the new R7 legs).
- **Tools** `1 failed | 110`: failset byte-identical vs round-5 r3
  (`r7-tools-failset-diff.txt`). **Domain** `10 failed | 482`: byte-identical vs
  round-5 (`r7-domain-failset-diff.txt`). **Remote** `220/220` green.
- **t2 triage (parent-mandated)**: the failing leg is pinned to
  `t2-blueprint-hash.test.ts > projects absent optional singles as explicit
  null` (`r7-t2-files.log`: hash 15/16, v2-hash 8/8 GREEN, revision 8/8 GREEN —
  the confusion risk is dead, per-file raw). ROOT CAUSE: the projection has
  always emitted `capabilities: null` for absent template capabilities
  (`domain/blueprint/src/validate.ts:1582`, toHashableTemplate) while the test
  expects the key absent — a test-vs-code contradiction that is **byte-identical
  at the base**: `git diff 137532f4 -- packages/domain` = 0 lines, base test blob
  == worktree blob (`089b32f1…`), base validate.ts blob == worktree blob
  (`023cb585…`) (`r7-t2-code-identity.log`). CARRIER LEAK HYPOTHESIS REFUTED by
  direct probe (`r7-t2-carrier-probe.log`): a NON-declaring document's hashable
  projection contains NO carrier key and its contentHash is unchanged; a
  DECLARING document gains the key and the hash changes (present-only spread is
  the design). Classification: KNOWN-BASELINE (code-identity proof); NOT fixed —
  outside the GO batch (changing a master-era expectation is not this PR's
  scope).
- **p6t6-actions** (`1 failed` in tools, byte-identical failset): proven AT the
  shipped HEAD (round-5 HEAD-probe raw + this round's identical suite line);
  base-code comparison NOT done — the throwaway detached base worktree could not
  be provisioned (`pnpm install` dies at `StoreIndex.openDatabase`; store index
  unwritable in this sandbox) — raw `r7-base-comparison-attempt.log`, including
  the tools/src hunk map showing NO hunk touches the messaging action code —
  the only change outside the permission additions is ONE divider-comment line
  (hunk @480, verified diff text in that raw). Classification: UNATTRIBUTED with reason,
  per the parent's scale — no false attribution claimed.
- **A15 timing leg**: isolated raw RETAINED this round — `r7-a15-isolated.log`
  `16/16` at HEAD. Round-5's single full-suite failure remains load/timing
  (concurrent-only, 1-line deadline assert, code-identity with base for the
  activation path). Attribution stated as before; the missing raw from round 5
  is now replaced by a kept raw at this HEAD.
- **Base comparison**: infeasible this round (see `r7-base-comparison-attempt.log`
  for the pnpm evidence); the affected claims carry the exact wording
  "proven AT the shipped HEAD; base comparison not done" — never "pre-existing
  by base run".

### Failset method repair (round-5 defect, parent-noted)

Round 5's `r5-failset-diff-vs-r4.txt` compared a 12-line file against an 11-line
r4 file yet printed "no diff" — a comparison-script integrity failure. Replaced by
`round7/r7-failset.py`: dedups FAIL lines, normalizes path prefixes, and its diff
artifact ALWAYS prints `baseline-lines=` / `new-lines=` and only states
BYTE-IDENTICAL when counts agree AND content matches; a mismatched-count case is
structurally unable to print equality. This round every suite diff is per-log
and carries both counts.

### Comment / ledger corrections (round-5 texts this round repairs)

- `tools/src/tools.ts` — the round-5 comment "the client never supplies the
  authority key" was FALSE at that time for exec rules (a client-supplied
  fingerprint string was accepted verbatim). With item 3 it is now TRUE by
  construction (fingerprint is not wire-reachable) and the comment states why.
- `tools/src/tools.ts` — the "durable dedupe by mutationId" comment was wrong:
  the kernel no-ops on a RULE-SET-EQUAL plan only; the same mutationId with
  different rules commits. Both the comment and the tool DESCRIPTION strings now
  say this, and the replay leg pins it (`changed:false` no-op vs
  same-token-different-rules commits).
- Round-5 RPC legs were fixture-level (hand-built options). Disclosed then;
  now ALSO corrected at the line level the way R-B asked: the round-5 R5-tool
  leg DID exercise the real handler; R5-rpc did not reach the root-assembled
  dispatcher — and reaching it found the two real gaps (actor claim, backing
  error-code vocabulary). Round-7's R7-rpc legs ARE root-assembled.
- Glue boundary (recorded, NOT code, per R-A): the permission-fact workspace is
  the DURABLE `TeamSession.defaultWorkspace` (host.ts:1842 addressed
  memberWorkspace; root `permissionLane` effective-workspace law), while the
  agent-bindings boot glue's memberCwd is the acting-row value — the two
  coincide in boot worlds by construction and are DISTINCT for non-boot teams,
  where the R5-ws/R7-addr legs pin the durable-default as the permission truth.
  Documented boundary, not a silent divergence.

### B6-1 completeness note

This commit carries the FULL cited round-7 evidence set (every log + `.exit` +
the failset extractor + this ledger). Round-5's `diag-backup/` row-6 dependence
(18 untracked payload copies) is SUPERSEDED as a dependence: no round-7 claim
rests on restoring those files; the manifest stays as recorded history, payloads
remain untracked and unneeded.

### Honest non-closures / recorded edges (round 7)

- R5-rpc's original fixture-level legs stay as shipped evidence of what they
  pinned; the root-assembled coverage this round lives in R7-rpc. Nothing was
  retroactively re-labeled.
- `update_permission` remains kernel-only surface (no entry exposes it) —
  unchanged.
- `canonicalizeExecIntent` is OPTIONAL on both wiring ports (unwired → typed
  `PERMISSION_MUTATION_NOT_CONFIGURED`, pinned); a host that wires tool
  permissions without it gets refusal, not guesswork.
- Domain `t1`×9 remain the round-4-era pre-existing reds (code identity, zero
  domain hunks); no attempt to fix master-era tests inside this PR.
- No merge, no host boot, no ports touched; Draft kept; forward-only push.
