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

- C1 `packages/runtime/test/u6-pr4-jobs-bridge.test.ts` — **24/24**
  (groups A move-law / B closed-schema negatives via the registry's
  `schemaCode` wrap / C kernel+mount law / D same-admission + owner fence
  over the REAL gateway + counting svc double / E CI-08 mount-generation
  law + E3 plant: the naive identity-less disposer destroys the CURRENT
  mount — measured, the counterfactual the law exists to prevent /
  **F (R1)**: the real bridge region driven through the real CI-05 mount
  wrap — un-attributed id refused typed with ZERO counting-svc reach on
  output AND kill; attributed id: corded owner trio reaches the host and
  reads ring bytes; foreign attributed: `owner-mismatch` + zero reach;
  the wrap is a pure law over one answer (idempotent, static detail, no
  identity leak); the list row law through the same face).
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

## C2 (round 1) — six boots, every cause named by its own receipt, budget spent (boot 7 under Review R1 below)

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

## Review R1 (round 2) — CI-05 fail-closed for un-attributed ids + authorized boot 7

Reviewer verified byte-identity, frozen shas, closed schema, one ledger,
CI-03/CI-08. Two required additions; one targeted round; same branch.

**R1-1 — CI-05 fail-closed mount face (the pass-through is gone).** The
frozen gateway keeps answering the disclosed pass-through
`{ok:true, corded:false}` for ids with no team record (its own two-fence
layer law; file sha-pinned, E1). The mount no longer forwards that answer
to the Host: the assembly (`agent-bindings`) hands the bridge its
gateway row through `ci05GovernedGatewayRow` — a center-face export
OUTSIDE the byte-identical region (76–347 re-measured `71705d6e…`, E1
passes; gateway untouched). On a governed mount a no-team-record id is
refused BEFORE any svc reach: the region's own `checked()` gate turns the
typed, static-detail `unattributed-job` refusal into a stop for
`job_output`/`job_kill`, and `job_list`'s per-row filter (the SAME face)
hides un-attributed rows. Non-Team/native sessions never build the
bridge — CI-03 and the host fence it rides are untouched BY CONSTRUCTION.
Tests: F group drives the real region through the real wrap — F1
un-attributed refusal with counting-svc ZERO reach on both arms; F2
attributed id: corded owner trio reaches the host and reads ring bytes;
F3 foreign attributed: `owner-mismatch` stands, zero reach; F4 the wrap
is a pure law over one answer (idempotent, static detail, no identity
leak); F5 the list row law. D3 re-disclosed as the RAW-region posture
the production mount never exposes.

**Attribution producer — named item, not patched around.** No
Team-owned creation seam exists at this pin: the governed confined row
refuses background by name (PR3's measured law), and the member native
lane is untreated (CI-03) — its receipt never passes through Team code;
attributing a native-born job from outside its creating lane would
invent ownership, which `admitJob`'s law (and this refusal) exists to
forbid. `attributeBackgroundJob` has no production caller (measured:
gateway definition + tests only). The producer rides a future governed
background creation lane; per R1 the fail-closed refusal ships NOW and
the producer is carried here as the named item. Consequence, stated
plainly: with no producer at this pin the governed trio manages NOTHING
live (every member-born job is un-attributed → typed refusal) — which
is precisely the CI-05 posture, and exactly why the ring-byte proof of
the live world rides the CI-03 native control arm.

**R1-2 — boot 7 (parent-authorized 7th start, ceiling 8).**
**Boot 7 (ledger 7/8; HTU pristine before/after; full receipt in
`c2/`).** VERBATIM: `jobs:mounted` PASS; `jobs:birth-positive` FAIL
(`jobIds:[]`); `jobs:ci05-governed-fail-closed` FAIL — vacuous-safe,
`trioUses:1` (no governed trio call happened this boot); `jobs:owner-fence`
FAIL (`foreignOutput:""`); `jobs:kill-refusal-zero-reach` FAIL
(`kill2:""`); `jobs:ctl-native-untouched` FAIL (`ctlAnswerHead:"(no new
output)\n[status: running]"`, `rootKernelMentions:0`);
`jobs:no-second-ledger` FAIL (`trioUses:1`); `jobs:leak-check` PASS;
lanes `{work:false, foreign:false, leader:false, ctl:true}`. Two causes,
both named by this receipt. **(1) Team-lane stall (dominant):** all three
Team lanes produced ZERO tool exchanges — `team.create` succeeded and all
three governed mounts placed (`a5g7` feed rows ×3), the root-native lane
ran end to end, yet the leader phase machine emitted nothing observable,
so no member ever ran the effect chain. The stall has been present since
boot 5 (boot 6's lanes map is identical, masked there by the
description error) and is not diagnosable to a one-line data fix from
these receipts — the digest carries no leader-lane slice. **(2) ctl
ring-read race (new, fix is one line):** the root background birth
SUCCEEDED for the first time (`started background job bash-1` — cause #6
`description` is now VERIFIED FIXED live) and the immediate read answered
`(no new output) [status: running]` — the read raced the spawn. The 8th
start was deliberately NOT spent: its authorization (new cause +
one-line fix) is satisfied only by the spacer, while the CAUSING leg is
the stall — that boot could not answer the effect legs and would burn
budget without changing the verdict. Named items for the next boot round:
leader telemetry in the digest + the spacer, then the effect legs.

**ARC-C final status: G4-CORE-PASS / BRIDGE-BLOCKED (§10.6)** — the
bridge law (mount, closed schema, one ledger, byte-identity, CI-05
fail-closed) is measured at C1/CI and live where live is reachable; the
end-to-end governed management of a real job awaits the two named items:
(a) the Team-lane stall diagnosis, (b) the creation-lane attribution
producer (no seam at this pin — until it exists the governed trio
manages nothing live, which is exactly the CI-05 posture).

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
- Budget: Host starts 7/8 authorized (ledger `c2/host-starts.jsonl`,
  ceiling never exceeded; boot-5 burned on a World-profile provider
  duplication, disclosed); the 8th deliberately NOT taken (its
  authorization condition is analyzed against the boot-7 receipt in the
  R1 section); `tests/homes/` empty at the end; HTU pristine
  (`639ed01539`, porcelain empty) verified before and after every boot.
- R1 re-measurement (`logs-gate-r1.log`): C1 24/24, a5p7 40/40, offline
  28/28, `pnpm -r typecheck` clean, lint-identities 76 distinct new 0,
  ci-pr-gate required legs pass=7 fail=0 (census skip is the standing
  opt-in disclosure), `docs:sync --check` ok, `docs:probe
  --worktree-only` blocking=0; byte-identity re-measured
  (`71705d6e…`) after the R1 edits; root vitest `root-vitest-r1.txt`.

## ARC-C verdict — G4-CORE-PASS / BRIDGE-BLOCKED (§10.6, stated honestly)

What is MEASURED (the G4-CORE-PASS part): the bridge law end to end —
byte-identical body (re-measured after R1), closed schema forces the
named bridge, ONE kernel ledger (live boot-4: 7 governed trio calls,
zero Control rows), CI-08 mount-generation law, frozen-sha law, and the
R1 CI-05 fail-closed mount face (F1–F5: un-attributed ids refused typed
with zero host reach; attributed owners reach the host; foreign owners
get `owner-mismatch`; list hides un-attributed rows). Live mount +
teardown hold on every boot that reached them (1–4, 6, 7).

What is NOT measured live (the BRIDGE-BLOCKED part): end-to-end governed
management of a real background job. After seven boots the chain of
harness causes ends at two NAMED ITEMS: (a) the Team-lane stall (boot-7
receipt: leader/work/foreign lanes produced zero exchanges while the
root-native lane ran — next-round diagnosis with leader telemetry), and
(b) the creation-lane attribution producer (no Team-owned seam at this
pin: the governed confined row refuses background by name; attributing
native-born jobs from outside their creating lane would invent
ownership, which the refusal law exists to forbid). The judge never
passed vacuously (every boot's mutations held); full G4 closes when the
named items land and the effect legs go positive.

## Disclosures & risks

1. **Live attribution gap (carried, honest; R1 posture):** no production
   creation-lane producer attributes native-born jobs at this pin — and
   since R1 the governed mount therefore REFUSES every un-attributed id
   typed (`unattributed-job`, zero host reach, C1-F1): a governed mount
   manages NOTHING live until the producer exists, which is the CI-05
   posture, not a regression to hide. The native lane is untouched
   (CI-03) and still rides the host fence alone. The AT-OWNER
   `owner-mismatch` + zero-reach measurement lives in C1-D2/F3 on the
   same pinned gateway code; `attributeBackgroundJob` is exercised from
   the KERNEL TABLE in C1-D1/F2 as the production contract for the
   future creation lane.
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
