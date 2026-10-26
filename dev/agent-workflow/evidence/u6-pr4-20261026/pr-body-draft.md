# feat(u6-pr4): jobs bridge onto the governance kernel — byte-identical bridge body, same admission ledger (ARC-C), old trio injection removed

Single-writer slice 4/6 of the U6 center-assembly plan (ARC-C, **first named
Bridge**). Protected set untouched; CORE PATCH BUDGET = 0; Host pin
0.2.0-rc.2 @ `639ed01539` (runner host-base guard enforces HEAD + empty
porcelain before/after every C2 boot).

## What moves where

- **NEW** `packages/runtime/src/plugin/live/jobs-family-bridge.mjs` —
  `createGovernedJobsBridge` moved **VERBATIM** from
  `plane-effect-backends.mjs`, plus the bridge's CENTER FACE (slice-plan
  option 2: defs + bridge in one module, plane stays orchestration-only):
  `JOBS_MANAGEMENT_NAMES` (the C6 list), `JOBS_BRIDGE_ID`,
  `buildJobsManagementRowDefs` (the trio row defs, shapes verbatim),
  `buildJobsBridgeContribution` (the `dsh.jobs-family` contribution:
  capability `jobs-management`, `execution.via: 'named-bridge'`, provider
  `dsh.host/job-registry` @ `0.2.0-rc.2@639ed01539`, lifecycle
  kernel-owned, honest cancel boundary `request-only, Host settles`).
- `plane-effect-backends.mjs` — body DELETED, re-export edge kept (A2
  pins: no body, direct re-export; `agent-bindings.mjs` imports the bridge
  module directly).
- `team-tool-plane.mjs` — the old direct trio injection is REMOVED. The
  trio now arrives ONLY as the bridge contribution through the SAME closed
  schema + `GovernedFamilyRegistry` as read/bash: contribution
  `register`ed, family manifest `{capabilities: {'jobs-management':
  {backsExecution: 'named-bridge'}}}` rides `mountPaMount`'s existing
  `kernelManifest` data (zero new mount surface), per-instance bridge
  built with the gateway + jobs-service accessors, trio rows placed
  through the SAME placement path (`definitionIdentity` from the bridge
  row defs — A3's import whitelist keeps the module dependency-free apart
  from `node:crypto` + the contracts barrel), approval entries seeded via
  the SAME `ensureApprovalEntry` arm read/bash uses, dispose path drops
  the family through the kernel owner surface. Registration/kernel refusal
  fails the MOUNT closed (`PLANE_JOBS_REGISTRATION_REFUSED`) — no
  un-governed trio mount exists.
- `jobs-gateway-assembly.mjs` — **UNTOUCHED** (gateway row stays; E1 pins
  its sha `c99ecaad…`), `pa-mount-registry.mjs` — **UNTOUCHED** (imported
  unmodified, CI-08; E1 pins `fa1d831d…`). No file under `control/**`,
  `tool-admission/**`, `tool-dispatch/**` touched; `install.ts` untouched.
- dist mirrors co-committed + `scripts/place-dist-glue.mjs` PLACEMENTS
  updated for the new `.mjs` (the glue law: dist carries the byte-pinned
  twins).

## Byte-identity (the move law)

The moved region (module lines 76–347) hashes
`sha256:71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f` —
identical to the sup-b PoC-3 measurement of the master extract, re-measured
two ways: `sed -n '76,347p' jobs-family-bridge.mjs | sha256sum` and the
in-test re-extraction (A1: whole lines from `export function
createGovernedJobsBridge` to the center-face seam, trailing newline kept —
the same recipe as `sed -n '1579,1850p'` at master `3288567d3` and
`sed -n '595,866p'` at `8337e52cf`, both of which hash IDENTICAL, so the
PR2/PR3 moves never touched this region).

## No-second-ledger proof

One kernel, one table, one consume port, one guard:

- C1-C: `value.centerKernel.familyIds` carries `dsh.jobs-family` exactly
  once; the trio's approval entries carry the SAME definitionIdentity the
  pb §6 `placementFeed` answers and `kernelGuard.identityFor` mints
  (`expect(guard.identityFor('read'))` equality extended to the trio);
  after `registry.revoke('dsh.jobs-family')` the trio is gone from feed,
  guard and kernel (`owns` false) — no residue to act as a second ledger.
- C1-A2: the old home answers only the re-export edge; C1-A3: the bridge
  module's ONLY imports are `node:crypto` + the contracts barrel — no
  second authority is even reachable from it.
- C2 live: trio tool uses ≥ 4 with **trio control rows = 0** (the kernel
  table is the ONLY ledger the trio touches; any birth ask row is
  `tool:bash`, the PA lane — different lane, different tool name).
- C2 leak-check leg PASS (no residual lease/port/home after teardown).

## Same admission (the ARC-C point) over the REAL gateway

C1-D drives the actual `createLiveJobsGatewayAssembly` (0.2.0-rc.2 pinned)
with a counting svc double through two member mounts: the trio rows run
with the control-leg counter at **ZERO** (approval lane untouched — the
trio rides exactly read's `ensureApprovalEntry` → `decide` →
`consumeOnce` path, and the gateway's own pins are fed FROM THE KERNEL
TABLE via the placement feed), and the owner fence is measured where the
unit tier can measure it: an id attributed to member B answers member A's
`job_kill` with `owner-mismatch` and **zero svc reach** (D2), while
un-attributed ids stay `corded:false` HOST pass-through (D3 — the
disclosed live law, below).

## R-REM-2 (review round 1, PR2) — condition carried, not regressed

R-REM-2 required: enforcing mounts take the REAL dispatcher lifecycle
port, never a self-counted fallback, absence fails closed. PR4 adds no
kernel construction: the jobs family registers into the ALREADY-enforcing
mount built by PR2/PR3 (`dispatcherLifecycle` passed through unchanged —
this PR touches no lifecycle code path; the FIX-K legs
`u6-fixk-*.test.ts` and the PR2 `u6-pr2-rrem2-read-lane.test.ts` stay
green in the full suite below). The jobs contribution's lifecycle fields
declare the kernel as owner (`kernel/kernel-owned`) — the cancel boundary
is stated honestly (`request-only, Host settles`), and the bridge's
`job_kill` NEVER claims a settlement (verbatim law, measured live in C2's
`jobs:cancel-honest`).

## Tests

- C1 `packages/runtime/test/u6-pr4-jobs-bridge.test.ts` — **19/19**
  (groups A move-law / B closed-schema negatives via the registry's
  `schemaCode` wrap / C kernel+mount law / D same-admission + owner fence
  / E CI-08 mount-generation law + E3 plant: the naive identity-less
  disposer destroys the CURRENT mount — measured, the counterfactual the
  law exists to prevent).
- Offline judge law `node --test tests/world-factory/world-factory.test.mjs`
  — **28/28** incl. the u6-jobs judge NON-VACUITY leg (synthetic ALL-PASS
  digest + twelve targeted mutations, each failing exactly its named case
  (no-host-vocabulary birth, output1 without ring claim, foreign read
  that SAW ring bytes, foreign settle event, kill with settled wording,
  FINAL in the post-settle ring, kill subject that never ran, vacuous
  native arm, kernel words on the root lane, approval row naming the
  trio, trio row in controlRows, registration refusal, dead host)) and
  the roster/envelope laws as data (background-capable bash only, no
  provider re-added to the preset, request-control on both ask sides with
  the leader pinned) and the FOLLOW-UP
  statelessness finding (decide machines count only `type:'tool'`
  exchanges — turn-local counters re-count follow-up pings as fresh
  results; pinned by test).
- C2 `--suite u6-jobs` — see next section (verdicts recorded verbatim from
  the run).

## C2 — six boots, every cause named by its own receipt, budget spent

World = `tests/world-factory/lib/u6-jobs-assembly.mjs` ONLY (no env vars,
no probe rows), budget ledger `host-starts.jsonl` (6/6 entries), ports
3180-family, worlds deleted after each run. Full receipts + narrative:
`dev/agent-workflow/evidence/u6-pr4-20261026/README.md`.

**What was MEASURED live on the pinned host (recorded from consoles):**

- `jobs:mounted` PASS on boots 2, 3, 4, 6 — the `dsh.jobs-family` bridge
  contribution passes the closed schema on a REAL host, the trio rows
  land on a REAL Team mount (`a5g7: placement-feed rows=3`), every
  refusal counter 0 (`PLANE_JOBS_REGISTRATION_REFUSED`,
  `mount-REFUSED`, `placement-REFUSED` all 0). Boot 5's mount FAIL is
  recorded too (a World-profile bug, below).
- `jobs:leak-check` PASS on every mount-reached boot — no residual
  pid/port/home/lease after teardown.
- `jobs:no-second-ledger` PASS on boot 4 with REAL governed trio
  traffic: `trioUses:7`, `trioControlRows:[]`, `controlRowsTotal:0` —
  seven real `job_list/job_output/job_kill` calls answered by the
  bridge/host (`(no background jobs)`, `refused: host-jobs-refused —
  unknown job …`) with ZERO rows in the Control ledger: the kernel table
  is provably the only ledger the trio touched.

**What was NEVER measured live (standing FAIL, disclosed):** the EFFECT
legs — `birth-positive`, `governed-management`, `owner-fence`,
`cancel-honest`, `ctl-native-untouched`. Six boots, six causes, each
named verbatim by the receipt (the digest carries global deduped
bash/trio host answers precisely so this is possible):
(1) no jobs substrate in the world → mount the verbatim base-bundle
`jobs`/`tool-jobs` rows (the CI-03 arm needs the substrate PRESENT and
untreated); (2) the bash sandbox REFUSES workspace writes — disk claims
demoted to `|| true` bonus, effects moved to the HOST RING (the
background child's stdout, returned by `job_output`: server-side bytes,
not transcript echo); (3) lane transcripts matched the raw delegation
token (leader contamination) → match the `[team-work requestToken=`
envelope; (4) the kit preset's `tool-bash-persistent` has **no background
spawn at all** (`run_in_background` silently dropped — its renderer's
trailer proved it) → background-capable plain `tool-bash`, and the member
ask lane needed `request-control` named on BOTH envelope sides (PR3's
u6prc8 law) with the leader entry pinned to its old bounds; (5) the boot
host's own bundle already provides `shell`/`shellEnv` — preset re-adding
them is a duplicate registration the binder refuses fail-closed →
providers host plane, consumers preset; (6) plain tool-bash makes
`description` REQUIRED — the first bash answered `Error: invalid
arguments: missing required property "description"`. The fix (all four
bash sites carry `description`; offline 28/28) is committed
(`cc2ea7b8d`) but **UNVERIFIED LIVE: the 6-boot budget is exhausted and
this PR does not re-boot**. No boot claimed an effect it did not measure;
the judge never passed vacuously (mutations held every boot).

Judge law (final, offline-pinned 28/28): effects are RING bytes the HOST
registry buffered; `cancel-honest` = kill-vocabulary + warm ring read +
MEASURED ABSENCE of the FINAL text after the settle spacer + the host's
own settle rows; `owner-fence` = the foreigner never sees ring bytes,
answers in host-fence vocabulary, ZERO settle events for the owner's id,
the owner's row survives; `ctl-native-untouched` = the boot-root's native
trio returns its own RING bytes + `[status` with `rootKernelMentions=0`.
Prose-without-tool-calls FAILS; the runner does not coerce the model.

## Gates

- census `p4t6`: honest RED (unbook→run→restore; `expected 1265 to be
  1263`) → booked GREEN 10/10 (1263→1265 = bridge module + spec).
- lint-identities vs the recorded baseline: 76 distinct, **new 0**
  (the first capture DID flag `no-explicit-any` in the new spec — fixed
  with structural consumed-face interfaces, not waived).
- `pnpm -r typecheck` clean; `docs:sync --check` blocking=0;
  `docs:probe --base origin/master` blocking=0 non_blocking=0;
  ci-pr-gate required legs `logs-gate-default.log`; root vitest full tree
  — failing set ⊆ the PR2/PR3 machine baseline
  (`t2-blueprint-hash`, `p6t3-mediation`, `p6t3-restart`,
  `a4p7-merge-gate`, `p6t6-actions`), NO NEW REDS.
- Budget: Host starts 6/6 (ledger `c2/host-starts.jsonl`, ceiling never
  exceeded; boot-5 burned on a World-profile provider duplication,
  disclosed); `tests/homes/` empty at the end; HTU pristine
  (`639ed01539`, porcelain empty) verified before and after every boot.

## ARC-C verdict (PARTIAL by measurement, stated honestly)

CA-03 (§10.6) requires one REAL named-bridge success on the pinned Host
for full G4. What is measured live: `dsh.jobs-family` passes the closed
schema, mounts, places its trio rows on a real Team mount, and serves
seven real governed trio calls with the kernel as the ONLY ledger
(boot-4 receipt). That is a real named bridge serving real traffic.
What is NOT measured live: end-to-end management of a REAL background
job (birth→ring→post-settle absence) — the effect legs stand FAIL with
the sixth cause fixed-but-unverified by budget. **ARC-C PARTIAL is
claimed; full G4 requires one further boot (`--suite u6-jobs --line
u6jobs7`, ledger ceiling raised) running the committed fixed World.**
The same-admission + owner-fence claims are NOT standing on the
unmeasured legs alone: C1-D drives the SAME pinned gateway code at unit
tier (zero control-leg reach on trio; `owner-mismatch` + zero svc reach
on foreign kill; `corded:false` honesty for un-attributed ids).

## Disclosures & risks

1. **Live attribution gap (carried, honest):** no production
   creation-lane producer attributes native-born jobs at this pin, so the
   live owner fence measures through the Host's OWN session-scoped fence
   behind the bridge's `corded:false` pass-through; the AT-OWNER
   `owner-mismatch` + zero-reach measurement lives in C1-D2 on the same
   pinned gateway code. The attribution-producer hook
   (`attributeBackgroundJob`) is exercised from the KERNEL TABLE in C1-D1
   as the production contract for the future creation lane.
2. **Leader/ask structural limit (PR3 legacy, disclosed):** the mock-lane
   brain is a state machine over transcript exchanges; the boot-root lane
   can answer in prose without tool calls — the judge FAILS that (no
   vacuous pass), it does not paper over it.
3. **Env deviation:** the shared baseline
   `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` is a stub in
   this environment; the pristine HTU is a `cp -a` copy of the main
   checkout's `tests/deepseek-harness-test-use` (detached @ `639ed01539`,
   porcelain empty, verified before/after every boot). HTU install ran
   `pnpm install --ignore-scripts --frozen-lockfile` (postinstall scripts
   skipped by flag).
4. **Double-wrap risk (slice-plan):** PR#360's `job-adapters/wiring` is an
   arm/bridge split of the SAME surface — this slice takes ONE shape (the
   sup-b bridge); the other must not be merged alongside it.
5. Host-private API need: none arose — every seam used is public at the
   pin (`jobsBridgeScopeKey`, the gateway rows, the mount registry, the
   scoped guard).
