# U6 PR4 evidence — jobs bridge onto the governance kernel, ARC-C (2026-10-26)

Single-writer slice 4/6 (ARC-C, FIRST named Bridge). Branch
`task/u6-pr4-jobs-bridge-20261026`. Protected set untouched (`control/**`,
`pa-mount-registry.mjs`, `jobs-gateway-assembly.mjs`, `tool-admission/**`,
`install.ts`); CORE PATCH BUDGET = 0; Host pin 0.2.0-rc.2 @ `639ed01539`.

## The move law (byte-identity)

- `packages/runtime/src/plugin/live/jobs-family-bridge.mjs` carries
  `createGovernedJobsBridge` VERBATIM (module lines 76–347). The moved-region
  sha `71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f`
  equals the sup-b PoC-3 measurement of the master extract — measured TWO
  ways: `sed -n '76,347p' … | sha256sum` in the review and the in-test
  re-extraction (`u6-pr4-jobs-bridge.test.ts` A1, whole lines, trailing
  newline kept). The pre-move master region hashes identically at both
  `3288567d3` (`sed -n '1579,1850p'`) and `8337e52cf` (`sed -n '595,866p'`).
- Frozen files pinned BY SHA in test E1: `jobs-gateway-assembly.mjs`
  `c99ecaadf2d34f8c313e539aee6ab9e247aad6e32b6087d29f12edaa08158b53`,
  `pa-mount-registry.mjs` `fa1d831d559d1016f6ee99e43436d3155b3f0c493a76fda021cc228f4c14510d`.
- The old home `plane-effect-backends.mjs` keeps ONLY the re-export edge
  (A2); `agent-bindings.mjs` imports the bridge module directly.

## C1 — `packages/runtime/test/u6-pr4-jobs-bridge.test.ts` 19/19

Groups A (move law: sha, re-export-only old home, import whitelist
`node:crypto` + contracts barrel — no second authority reachable), B (closed
schema forces the named bridge: honest descriptor registers and is pure over
inputs; host-pin flip changes digests (CI-07); provider-backed-without-bridge
refuses `schemaCode=NAMED_BRIDGE_REQUIRED`, family-body-backed capability
refuses `CAPABILITY_UNBACKED` — the registry WRAPS the schema code,
`registry.ts:115`, so the assertions read `schemaCode`), C (kernel law:
`owns(job_*)=true`, foreign names false; one identity across
feed/guard/approval entry; registration refused ⇒ mount refused closed with
`PLANE_JOBS_REGISTRATION_REFUSED`; `revoke` → entries gone, feed gone,
guard blind, kernel no longer owns), D (SAME admission as read/bash over the
REAL `createLiveJobsGatewayAssembly` + counting svc double: approval entries
fed from the kernel table; owner trio runs with the control-leg counter at
ZERO (approval lane untouched — the trio rides the same `ensureApprovalEntry`
+ `decide` + `consumeOnce` path read does); owner-mismatch `job_kill`
answers `owner-mismatch` with ZERO svc reach; ghost ids stay
`corded:false` HOST pass-through, disclosure D3), E (frozen shas; the real
pa-mount-registry mount-generation law: old disposer's drop REFUSED, current
identity's drop lands; E3 plant — with the naive identity-less disposer the
CURRENT mount dies (the counterfactual the law exists to prevent)).

## Offline judge law — `node --test tests/world-factory/world-factory.test.mjs` 28/28

SUITE_CASES/parseArgs pins; assembly shape (`jobsEnabled`, tee-to-disk cmds,
`yaml.parseDocument(...).toJS()` single-doc, NO `u6-jobs-probe` emitted);
decide-script transcript law incl. the FOLLOW-UP statelessness finding (a
turn-local call counter re-counts follow-up pings as fresh results — the
machines count only `type:'tool'` exchanges); judge NON-VACUITY: synthetic
ALL-PASS digest + nine targeted mutations, each FAILING exactly its named
case (`claim→echo`, `output→ghost`, `kill→settled`, `settle→alive`,
`list→status-text`, `foreign→''`, `ctl→governed`, `ledger→approval rows`,
`controlRows→trio row`) + dead-host `mounted` FAIL.

## C2 — one governed Team World (`c2/`)

- `host-starts.jsonl` — the budget ledger: boots under
  `--max-host-starts 6`; HTU HEAD `639ed01539` + porcelain empty verified
  before AND after every boot (runner host-base guard + manual check).
- `run-u6jobs1.console.txt` + `…u6jobs1…u6jobs-evidence.json` — the
  DISCLOSED pre-fix state (boot 1): `jobs:mounted` PASS (the bridge law
  held even then — feed carries the trio, zero refusal codes) and
  `jobs:leak-check` PASS; the six other legs FAIL with one root cause the
  receipt states itself: `claimHead:""`, `jobIds:[]`,
  `ctlAnswerHead:"Error: unknown tool \"job_output\""` — THE WORLD HAD NO
  JOBS SUBSTRATE (the host's own `jobs`/`tool-jobs` rows were absent: the
  member native bash cannot compose `run_in_background` without the jobs
  service, and the boot-root mounts no native trio). Not a bridge failure
  — a harness gap; the CI-03 "native untreated" arm needs the substrate
  PRESENT and untouched, not absent. Fixed in `u6-jobs-assembly.mjs` by
  mounting the VERBATIM rows of the host base bundle
  (`packages/bundle/base/cordis.patch.yml`: jobs → `@deepseek-ai/dsh-jobs-`
  `local`, tool-jobs → `@deepseek-ai/dsh-tool-jobs`). The runner digest
  additionally gained truncated per-lane transcript tails so a stalled
  chain is diagnosable from the receipt alone.
- `run-u6jobs2.console.txt` + `…u6jobs2…u6jobs-evidence.json` — boot 2,
  substrate present: the boot-root's NATIVE trio answered honestly
  (`Error: unknown job job-unknown` — the HOST registry spoke,
  `rootKernelMentions:0`), `jobs:mounted` + `jobs:leak-check` re-held. But
  the receipt's debug tail caught the next law: `tee` into a new
  sub-directory inside a bash child answered `Permission denied` — the
  disk-oracle design violated the SANDBOX law.
- `run-u6jobs3.console.txt` + evidence JSON — boot 3 with PR3's proven
  FLAT append-mode writers: `bash: …/u6jobs-ctl.txt: Permission denied`
  again — even a flat workspace child is refused for sandboxed lanes at
  this pin. (PR3's own receipts anticipated exactly this: its ctl arm was
  judged WITHOUT any disk requirement.) The same receipt also exposed the
  second defect: `trioUses:1` while the worker machine had demonstrably
  issued six trio calls — `laneTranscript` matched the RAW delegation
  token, which also rides the leader's `team_delegate` ARGS, so the
  digest had been reading the LEADER's transcript as the worker's.
- The fix round (commit `ec6c4318e`): effects are now RING-FIRST (the
  background child's stdout is HOST-buffered; the managed trio's
  job_output returns those bytes — a server-side fact no transcript echo
  imitates), the disk claim is a `|| true` bonus, the cancel window moved
  to the registry (kill → foreground 40 s spacer > the 35 s FINAL print
  deadline → POST-SETTLE ring read; FINAL's absence THERE is the
  measurement), lane matching pins the `[team-work requestToken=`
  envelope, `toolExchanges` pairs ARGS with results, and the receipt
  carries global deduped bash/trio host answers (truncated, token-free)
  so a stalled chain names its own cause. The judge's offline
  non-vacuity set grew to twelve mutations.
- `run-u6jobs4.console.txt` + `…u6jobs4…u6jobs-evidence.json` — boot 4
  (ring-first + envelope lane match): `jobs:mounted`, `jobs:no-second-ledger`
  (trioUses:7 — the lane-attribution fix made the member trio VISIBLE) and
  `jobs:leak-check` PASS; birth/management/fence/cancel/ctl FAIL. The new
  diagnostics named both causes verbatim in the receipt: member bash
  answered `Error: permission request failed: TeamRuntime: operation
  'request-control' (action 'request-control') is outside the caller's
  mutation envelope — the boundary fails closed` (the ask lane could not
  open its durable row — PR3's u6prc8 law, template entries never widen
  the team root), and the ROOT lane's background-flagged birth answered
  with the PERSISTENT-PTY renderer's output + `[Command finished with
  exit code 0]` — the kit preset's bash is `tool-bash-persistent`, which
  has NO background spawn in its schema at all; `run_in_background` was
  silently dropped.
- The fix round (commits `ec6c4318e`→`3e05531ed`): ring-first effects +
  envelope-text lane matching + global bash/trio diagnostics (`ec6c4318e`);
  preset roster rebuilt hand-assembled with the BACKGROUND-CAPABLE
  `@deepseek-ai/dsh-tool-bash`, persistent-shell out of the World, and
  `request-control` named on BOTH envelope sides (team root + worker
  template) with a leader entry pinning its old bounds (`3e05531ed`).
- `run-u6jobs5.console.txt` — boot 5 never got a session: the binder
  fail-closed naming the new preset row — `preset … is broken:
  bash-sandbox (@deepseek-ai/dsh-bash-sandbox): service "shell" has been
  registered at <SandboxBashExecutor>` — because the boot host composes
  its OWN bundle layers and base+web-app ALREADY carry the providers
  (`bash-sandbox` -> 'shell', `shell-env`) on the host plane. Fix
  `fbc296b99`: the preset carries ONLY consumers (`tool-bash`), which
  resolves 'shell'/'shellEnv'/'jobs' across planes exactly as the web-app
  bundle comment prescribes. The offline law asserts a jobs-World patch
  never re-adds a provider row.
- `run-u6jobs6.console.txt` — boot 6 (6/6 budget): `jobs:mounted` PASS
  (placement-feed rows=3, all refusal counters 0) and `jobs:leak-check`
  PASS; birth/management/fence/cancel/ctl/no-second-ledger FAIL
  (`trioUses:1`). The receipt named the cause verbatim: the root lane's
  birth answered `Error: invalid arguments: missing required property
  "description"` — the PLAIN tool-bash schema makes `description`
  REQUIRED (the persistent variant never demanded it, and the decide
  machines predated the variant switch), so the first bash errored, no
  job was born, and the chain honestly stayed unsatisfied. Fix committed
  (`cc2ea7b8d`: description on all four bash sites, offline 28/28) —
  DISCLOSED UNVERIFIED LIVE: the budget is exhausted at 6/6, the fix was
  NOT re-booted. No verdict beyond what boots recorded exists anywhere
  in this evidence set.

**C2 final position (all six boots, measured):** the BRIDGE LAW legs —
`jobs:mounted` (real host, real Team mount, trio rows placed through the
closed schema, zero refusals) and `jobs:leak-check` (clean teardown) —
PASS on every boot that reached mount (2, 3, 4, 6); `jobs:no-second-ledger`
PASSed boot 4 with REAL governed trio traffic (trioUses:7, control rows
0, the bridge's honest `refused: host-jobs-refused — unknown job …`
answers visible). The EFFECT legs (birth/management/fence/cancel) never
reached a positive measurement in six boots: each boot's own receipt
named one harness-level cause (no substrate → sandbox disk law →
transcript contamination → wrong bash variant + ask envelope → provider
duplication → required `description`), every cause was fixed with its
law booked as data, and the sixth fix stands unverified by budget. The
EFFECT legs therefore stand FAIL-disclosed in the PR; the judge never
passed vacuously (each boot's non-vacuity mutations held), and the
offline judge law (28/28, twelve targeted mutations) is what the seventh
boot — whoever runs it — starts from.

## Gates (final tree)

- `p4t6-RED-unbooked.log` — honest RED, re-measured by unbook→run→restore:
  `AssertionError: expected 1265 to be 1263` (1263 = booked totals before
  this slice, +2 = the new bridge module + this slice's test file).
  `p4t6-GREEN.log` — booked `SCANNED_PATHS_U6PR4` (12), 10/10.
- `lint-identities-final.txt` + `lint-identities-summary.txt` — vs the
  recorded baseline `a4-lint-baseline/lint-identities-0237d487.txt`:
  76 distinct, NEW 0, resolved 0 (the lane's first capture carried ONE new
  identity — `no-explicit-any` in the new spec — and was FIXED, not
  waived: the spec now rides structural consumed-face interfaces).
- `pnpm -r typecheck` clean; docs gates: `docs:sync --check` blocking=0
  (68 docs / 38 plans / 20 contracts), `docs:probe --base origin/master`
  blocking=0 non_blocking=0.
- `logs-gate-default.log` — ci-pr-gate required legs.
- `root-vitest-final.txt` — full-tree run; failing set ⊆ the
  PR2/PR3-recorded machine baseline (`t2-blueprint-hash`, `p6t3-mediation`,
  `p6t3-restart`, `a4p7-merge-gate`, `p6t6-actions`); NO NEW REDS.

## Deviations & disclosures (all carried into the PR body)

1. The env baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`
   is a STUB in this environment (no git repo). The pristine HTU for this
   slice is a `cp -a` copy of the main checkout's
   `tests/deepseek-harness-test-use` — verified detached @ `639ed01539`
   with porcelain empty before/after every C2 run (the runner's own
   host-base guard enforces this each boot).
2. HTU install ran `pnpm install --ignore-scripts` (frozen-lockfile); the
   build chain ran with `DSH_CLIENT_COMMIT_HASH=639ed01539`.
3. Live-world attribution: NO production creation-lane producer attributes
   native-born jobs (disclosed unit fact, test D3); the C2 owner fence is
   therefore measured through the Host's own session-scoped fence behind
   the bridge's `corded:false` pass-through — which is exactly the CI-03
   untreated-native posture the arm exists to show. The AT-OWNER fence
   itself is measured at the unit tier (D2: `owner-mismatch`, zero svc
   reach) on the same pinned gateway code.
4. Scratch recorder files were kept OUT of the lint universe (the `.artifacts`
   tree); host instance logs (which carry the boot token) are NOT part of
   this evidence — receipts carry verdicts, kernelHits, and truncated
   transcript tails only. The raw instance logs stay OUTSIDE the repo at
   `.artifacts/tmp/u6pr4-scratch/c2-logs/` (gitignored); where this file
   quotes a host-log line (boot 5's binder refusal), the quote is the
   retained artifact.
