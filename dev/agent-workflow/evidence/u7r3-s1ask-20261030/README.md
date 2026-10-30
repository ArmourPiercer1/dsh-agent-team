# u7r3-s1ask — governed `ask_user_question`: thread the per-call carrier Agent into the EXISTING port binding (O2-A S1)

> **Dated banner (real UTC 2026-10-30T14:2xZ, lane `u7r3-s1ask`, seat: delegated subagent on the
> harness-reported model qwen3.8-flash-next, disclosed; ROUTER_RULES §0.2 — independence =
> independent sessions, not a model identity).** Branch `task/u7r3-s1ask-20261030`, worktree
> `.worktrees/u7r3-s1ask`, base `e2f14c71bd65e3671ed72bffe9b7092db8d1b3b8` (origin/master tip at
> spawn). Foundation: `dev/agent-workflow/evidence/u7r3-o2memo-20261030/O2-A-ask-port-agent-binding.md`
> (branch `task/u7r3-o2memo-20261030`), classification gate `CLASSIFICATION.md` beside this file.
> **ZERO boots, ZERO starts.** The lane proves the C1 shape offline; it proves NOTHING live.

## STEP 0 classification (gating, written before any code)

**VERDICT: NO — threading the already-public per-call carrier `ToolExecutionInput.agent`
(host `packages/core/tools/src/index.ts:339` @ `639ed01539`) into the EXISTING unused second-arg
binding of `createUserQuestionsPort` is NOT a 中心接口变更 per
`dev/agent-workflow/gates/USER-RULING-20261031.md` §一.2 `:24`.** No new public surface, no host
change, no capability-shape change (`CAPABILITY_KEYS` byte-equal): a behavior change WITHIN
existing contracts — governed rows' asks become deliverable to the row's own carrier Agent
through the adapter's own documented semantics. This is the memo's **S1**, classified there as
lane-owned; the centre-shape candidate (S2: one `CAPABILITY_KEYS` key) was NOT taken. Full
clause-by-clause argument: [`CLASSIFICATION.md`](./CLASSIFICATION.md).

## Change map (the whole diff, product plane)

| File | Change |
| --- | --- |
| `packages/tools/ui-family/src/ask-row.mjs` | execute transport carries `exec?.agent` on `corr` — verbatim the `spawn-row.mjs:41-43` trusted-transport pattern incl. the falsy law (`null`/`undefined` → NOT carried) |
| `packages/tools/ui-family/src/ask-executor.mjs` | the per-call lazy port resolution receives the carrier: `portRef(corr?.agent)` (single call site; gate + post-consume use the same resolved port, ordering law untouched); docblock states the law |
| `packages/tools/families/ui.mjs` | `portRef(agent)` passes it into the EXISTING binding `createUserQuestionsPort(service, { agent: () => agent })` — lazy, per-call, never mount-time captured; injected arm returns the injected port untouched (owns its own binding); the present executor's zero-arg call site is unchanged (adapter's `live === undefined` drop keeps its service arm byte-equal) |
| `packages/tools/families/manifest.json` | reviewed digest rebase for `ui.mjs` (family-module edits carry their manifest re-digest in the same commit — precedent `c348a22c5`, `aecffd984`, `9a6ffab05`); `node scripts/gen-family-index.mjs --check` OK |
| `packages/tools/test/u7f-ask-port-agent-binding.test.ts` | NEW C1 suite, 13 legs, no boot (see below) |
| `packages/testkit/test/p4t6-bookings/u7r3s1ask.json` | the lane's ONE p4t6 scannable-path booking (u7-w0 enumeration convention — one JSON beside the loader, no shared-list edits): the new test file, MEASURED tie 1392 → 1393 |
| `packages/runtime/dist/**` | regenerated committed dist mirrors of the four changed family-lane sources (place-dist-glue; `check:artifacts` compared=1883 glue=100 OK) |

Not touched (deliberately): `ui-interaction-port.mjs` (the seam already exists — that is the
point of S1), `present-executor.mjs` / `present-row.mjs` (present is the O2-B gap),
`family-assembly.mjs` / `team-tool-plane.mjs` / `agent-bindings.mjs` (centre + mount glue),
any matrix/backlog/ledger file (EF-05: not touched, so no obligation regeneration is due),
any Host file (CORE PATCH BUDGET = 0 honored).

## Failure laws — each preserved and pinned by a leg

- **Absent carrier → same `UI_INTERACTION_PORT_FAILED` typed refusal, no silent unscoped
  delivery**: the row does not carry a nullish agent; the adapter's documented no-agent arm
  forwards the request UNTOUCHED (same object, no `agent: undefined` key) and the Host service's
  OWN law answers (`NO_PROVIDER` @ `user-questions/src/index.ts:318-324`), surfaced verbatim as
  the same `refused-io UI_INTERACTION_PORT_FAILED` the row answers today (f3/f4 C2 refusal shape
  — regression legs SB-2, SB-3a, AD-2, AD-3).
- **No path forwards unscoped when a carrier is expected**: sweep leg SB-4 (3 calls, every
  service request carries the EXACT carrier identity, zero unscoped); scoped shape pinned:
  service request keys are exactly `['agent','questions']` (SB-1), timed face included (SB-1t).
- **Falsy/unknown carrier → refusal**: unknown agent → service law `CALLER_NOT_LIVE` rides
  verbatim (SB-3b); falsy non-nullish rides as dispatch data and the law refuses it (SB-3c).
- **Injected legacy arm untouched**: injected port wins and receives NO re-stamped carrier
  (LEG-1/LEG-2); all **41 legs of `packages/runtime/test/u7-f-ui-c1.test.ts` pass unchanged**
  (they ride this arm).
- **Port gate stays before any authority force; correlation discipline holds**: the Agent never
  rides an observe line / callId / ledger string (sentinel assertion in SB-1; observe lines in
  the run logs carry counts and codes only).

## Test evidence (C1, no boot)

- New suite: `packages/tools/test/u7f-ask-port-agent-binding.test.ts` — **13/13 PASS**
  (`logs/new-suite-vitest.log`).
- Existing UI C1: `packages/runtime/test/u7-f-ui-c1.test.ts` — **41/41 PASS unchanged**
  (`logs/c1-ui-vitest.log`).
- The service-arm legs drive the REAL chain through `mount(agentCtx)` (the same public seam
  production binds, `team-tool-plane.mjs:2039-2048`) with a service fake that MIRRORS the pinned
  host's law; the fake answering scoped traffic is a C1 stand-in for the Host's scoped waterfall
  + forwarded-events face, disclosed as such.

## Honest limit — what this lane does and does not prove

- **Proven (offline)**: the binding is threaded end-to-end through the real plane/executor/
  adapter chain; the call that reaches `userQuestions.ask/askTimed` carries the row's carrier
  Agent; every failure law above is regression-pinned; the full repo gates pass (below).
- **NOT proven here — LIVE RE-VERIFICATION OWED**: whether a governed Team member's Agent is an
  `assertLiveRoot` **root** (PR #491 `ui:live-root-law` = NOT_REACHED, PR #489 Q3 `L2
  NOT_VERIFIED`) and whether the answer round-trips on a real Host. That is the **f4 cell re-run
  — a SEPARATE boot leg in a future lane** (pool 「其他 Family 的 L3/L4 验收」, ≤3 starts,
  pre-registration law). This lane ran ZERO boots and ZERO starts and may not be quoted as any
  L4-positive movement: `ask_user_question` `L4-positive` stays **DISCLOSED**
  (`dev/agent-workflow/ledgers/u7-tool-acceptance.json`) until that live leg lands. If the Host
  answers `DELEGATED_CALLER`, the adapter surfaces it verbatim (already written, SB-3b shape) —
  the correct honest outcome, and the positive arm remains owed.
- If review refuses the reviewed-family lane the right to hold a per-call `Agent` carrier, the
  ranked fallback is O2-A **S3** (trusted-mount binding); this lane's diff reverts cleanly.

## Gate logs (this dir: `logs/`)

- `full-vitest-raw.log` — root `vitest run` FULL: **651 files / 8576 tests, 0 failed** (above the
  650+/8563+ floor; VITEST_EXIT=0). Honest note: in an INTERMEDIATE full run one leg
  (`a4p7` cross-instrument scratch leg) was RED because a targeted vitest run of mine executed
  CONCURRENTLY and one instrument's scratch moved the other's lint universe; the leg passes
  serially (`ledger-suites-vitest.log`, 55/55). Contention artifact, no product finding.
- `gate-chain.log` — `pnpm typecheck` (0) / `pnpm build` (0) / `pnpm build:composition` (0) /
  `pnpm check:artifacts` (0) / `docs:probe --worktree-only` (0, blocking=0; the CI leg names its
  own base ref) / lint identity vs the named a4p7 baseline `lint-identities-0237d487.txt`
  (**new 0, resolved 0**, exit 0) / eb3 static legs (`family-boundaries` findings=0,
  `family-definitions` findings=0, `tool-acceptance` — 31 tools, L4 19/11/1 UNCHANGED,
  `trusted-sources` findings=0, `gen-family-index --check`) all exit 0.
- `new-suite-vitest.log` (13/13), `c1-ui-vitest.log` (41/41 unchanged),
  `ledger-suites-vitest.log` (p4t6 scan with the new booking + a4p7 merge-gate: 55/55).
- `test-use-provision.log` — fresh `tests/deepseek-harness-test-use` per TEST_METHODS §1/§2:
  `git clone --local --no-hardlinks` **from the main checkout test-use** (EF-04: the shared
  baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` has no `.git`),
  `checkout --detach 639ed015397290b3745d163aafe02ffee4aa3f84`, `pnpm install --ignore-scripts
  --frozen-lockfile`, `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run
  build`; post-checks: `git status --porcelain` empty + `rev-parse HEAD` = baseline. Store:
  workspace `.pnpm-store-lane` (HOME store not writable in sandbox).

## Impact & reversibility

One branch, one worktree, one writer; single commit, single push of the task branch only;
merge = PR review loop; revert = `git revert` of the commit set (digest rebase included).
No world, no home, no instance touched; `tests/deepseek-harness-test-use` stays pristine
(porcelain verified, detached at baseline).
