# G8 Blind-Review Brief (shared by reviewers 4–6; per-reviewer id = N)

> Round R61. Gate G8-REVIEW for phase P8 (int/P8-remote-projection @ `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86`, chain 1773/1773 + tsc x6).
> Three fresh independent blind reviewers, each dispatched as a workflow leaf (provider `qiyuan-self`, model `qwen3.8-27b`).
> A reviewer sees ONLY this brief (with their N substituted). No main-agent findings, no worker reports, no prior-round context.

## §0 MANDATORY FIRST STEP

Read in YOUR worktree: `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md` (complete; both). Protocol docs are allowed reading. Anything else in `dev/agent-workflow/` is FORBIDDEN to read (see §1).

## §1 BLINDNESS RULE (strict)

You are a blind gate reviewer. Your information sources are EXACTLY:

- the frozen docs in `docs/plans/active/` (verify their sha256, §3);
- `docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md`;
- the implementation + tests at the integration SHA (the code under `packages/` and `tests/`);
- `docs/migration/` (legacy inventory/reference);
- `references/deepseek-harness/` (frozen legacy fork, READ-ONLY) if you need to check legacy on-disk formats;
- your own test runs, harness runs, and scans (your evidence).

FORBIDDEN to open or grep: anything under `dev/agent-workflow/` (worker evidence incl. any design-note.md / g8-report.md, briefs, SESSION_ROUTER_LOG.md, graph.yaml — they contain worker self-reports and main-agent context). The ONLY exception: WRITING your own report + harness + logs into `dev/agent-workflow/evidence/G8-REVIEW/reviewer-N/` in your own worktree.

## §2 Your identity & environment

- You are reviewer **N** of gate G8 (N ∈ {4,5,6}).
- Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team`. The main worktree (on `master`) is NOT yours — never write there.
- Create your review worktree (DETACHED, no branch):

  ```
  git -C D:\AgentDev\dsh-plugins\dsh-agent-team worktree add --detach .worktrees/G8-RN 3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86
  ```

  (replace RN with your N, e.g. `G8-R4`).
- Verify: `git rev-parse HEAD` == `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86`. If not, STOP and report.
- You are the only writer on your worktree. NEVER modify any tracked file anywhere. Your only writes: your worktree (including node_modules via install + NEW UNTRACKED harness files under your evidence dir) + your own evidence dir `dev/agent-workflow/evidence/G8-REVIEW/reviewer-N/`.
- NO push. NO force-push. Never touch other worktrees, `master`, `int/P8-remote-projection`, `references/deepseek-harness` (read-only), the stable deployment `D:\deepseek-harness\`, or the :3080 instance. Verify :3080 returns 200 BEFORE and AFTER your work.

## §3 Frozen documents (verify hashes before relying on them)

- Architecture `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Development Plan `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Task Decomposition `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`

Gate entry to read (method step 2): Development Plan §21.5 "Gate G8" (the SIX criteria) and Task Decomposition §11.9 (P8 task cards T1–T5 + "G8 Gate 执行方法" six steps + P8-T5 card: required tests = pristine host browser-less remote e2e / dependency scan / reconnect suite).

## §4 Review method (TaskDoc G8 执行方法 six steps — execute all)

1. **Checkout** — done at worktree creation (§2); re-verify HEAD.
2. **Read the gate entry** — §3 above; hash-verify the frozen docs.
3. **Rerun key positive + negative tests** (in YOUR worktree, serial, with proof headers `git rev-parse --show-toplevel` + `git rev-parse HEAD` in every log):
   - `pnpm install --ignore-scripts`
   - `node scripts/run-tests.mjs` (all 9 packages) — record the exact totals; expect 0 failures (1773/1773 at this SHA).
   - tsc x6 with SEPARATE args: `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for contracts, domain, storage, runtime, testkit, **remote**.
   - Pay particular attention to the P8 suites (positive AND negative): `p8t1-*` (contracts/test), `p8t2-*` (runtime/test), `p8t3-*` (remote/test), `p8t4-*` (remote/test), the `g8s1-*` suites (storage/test + runtime/test), and the p4t6 scanner suite.
   - NEVER `pnpm run`/`pnpm exec`, vitest CLI, tsx, esbuild, vite.
   - Log → your evidence dir `chain-rerun.log`.
4. **Zero-core / private-import / owned-boundary checks** (log → your evidence dir `boundary-checks.log`):
   - **zero-core**: no `node:` builtin imports in any `.ts` under `packages/` (`.mjs`/`.cjs` harness/scan scripts excluded by rule); no `patch-package`/`pnpm patch`/postinstall mutation of upstream (check package.json scripts + lockfile diff vs `959e36358ee7244ff8c7e1e0b8396e70dfef4562`); no import of anything under `references/deepseek-harness-test-use` (upstream) from `packages/*`.
   - **private-import**: grep `packages/**/*.ts` for imports referencing upstream internals or the frozen legacy fork; expect none.
   - **owned-boundary**: `git diff --name-only 959e36358ee7244ff8c7e1e0b8396e70dfef4562..HEAD -- packages/` — every added/modified file must fall inside an owned glob below (TaskDoc §11.9 cards, plus the gate-level files recorded in the gate's own task trail; verify the gate-level files with the SAME discipline as any other owned file):
     - T1: `packages/contracts/src/projection/**` (+ additive `packages/contracts/src/index.ts`) + `packages/contracts/test/p8t1-*`
     - T2: `packages/runtime/projection/**` + `packages/runtime/test/p8t2-*`
     - T3: `packages/remote/src/contracts/**` + `packages/remote/src/handlers/**` (+ additive `packages/remote/src/index.ts`) + `packages/remote/test/p8t3-*`
     - T4: `packages/remote/src/push/**` + `packages/remote/test/p8t4-*` (+ `packages/remote/test/p8t3-negative.test.ts` layout-pin maintenance — a standing exception recorded in the P8-T4 evidence)
     - gate-level: `packages/runtime/compatibility/probe.ts`; `packages/storage/repositories/ledger.ts`, `packages/storage/repositories/team-sessions.ts`, `packages/storage/repositories/team-domain.ts`; `packages/storage/test/g8s1-stamp-advance.test.ts`, `packages/runtime/test/g8s1-generation-stamp.test.ts`; the P4/P6 test-expectation updates `packages/storage/test/{p4-06-journal,p4t2-conflicts,p4t2-crash-recovery,p4t2-helpers,p4t2-journal,p4t4-helpers,p4t4-one-committed-invariant,p4t4-orphan-detect,p4t4-per-stage-retry}.*`, `packages/runtime/test/{p6t1-explicit,p6t1-recovery,p6t3-send-delivery}.test.ts`, `packages/testkit/test/{p4t5-corrupt-version,p4t5-crash-matrix,p4t5-helpers,p4t5-retry-restart}.*`, `packages/testkit/fault-injection/fixtures/committed-world/team_domain/team_sessions.json`
     - DEC-1 standing exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` (count maintenance)
     - Any file outside these globs → record it as an owned-boundary violation (→ 阻塞).
5. **Cross-task invariant combination review + the mandated e2e** — read the P8 code as a SYSTEM (contracts/projection DTO → runtime/projection service → remote contracts/handlers → remote push engine + test client) and verify the six G8 criteria hold in combination (below, §5). At minimum examine: the projection service's read surface exposes NO log-read port and its live overlay never fills identity/generation/workspace lanes; the remote handlers' 12-port dependency surface is structural (no SessionController Team mirror, no session-log-derived truth); the dispatcher invariants (unknown method rejected before envelope, per-method param parse, typed error results only, promise never rejects) combine with the P8-T4 client stale guard so that a stale frame can never mutate applied state; the ledger pagination read path (P8-T2 `ledger.ts`) is what `team.getLedgerPage` serves.
6. **Output criterion → evidence → PASS/FAIL** — the fixed report format (§7).

## §5 The mandated pristine-host browser-less remote e2e (build + run)

The P8-T5 card mandates: **pristine host browser-less remote e2e / dependency scan / reconnect suite**. The in-process suites (step 3) are NOT a substitute — you must boot a REAL pristine DSH web instance and drive the TEAM_REMOTE seam over real HTTP with a node client (no browser).

**Reusables committed at the integration SHA (read them; do not copy into tracked paths):**

- `packages/legacy/session-reader/e2e/run.mjs` — the proven pristine-host boot driver: preflight (pristine test-use tree @ cd5ef814, stable :3080 probe, port free), fresh workspace-internal DSH_HOME, FILE-FD stdio spawn (`tests/characterization/lib/util.mjs` `spawnToLog` — NEVER piped stdio: sandbox EPERM), boot `node apps/cli/lib/bin.js web --port N --no-open` with env `DSH_HOME` + `DSH_CLIENT_COMMIT_HASH=cd5ef814`, row mount through the public seam `DSH_HOME/profiles/web/cordis.patch.yml`, log-line waits, cleanup in finally.
- `packages/legacy/session-reader/e2e/plugin.mjs` + `ts-loader.mjs` — the proven ROW pattern: a row payload that imports the WORKTREE's TypeScript sources through a resolve hook and serves public surface.
- `tests/characterization/probes/remote-client/index.mjs` (+ its payloads) — the TEAM_REMOTE seam characterization: the launch URL mints the HMAC auth cookie on `GET /?token=<launchToken>`; client→host RPC = `POST /<channel>/<endpoint>` body `{"type":"client-request","rpcId","method","payload"}`; rows register public handlers via the `connection` service (`ctx.effect(() => connection.rpc.handle(CHANNEL, async (endpoint, payload) => {...}), 'label')`); responses = `server-response` envelopes `result:{ok:true,value}` / `result:{ok:false,error:{code,message}}`; negatives: no cookie 401 / wrong content-type 415 / method≠endpoint 200 bad-request / handler typed error 200 ok:false / handler throw 500.
- `packages/remote/src/handlers/register.ts` — `REMOTE_RPC_CHANNEL = '/team-remote'` and `registerRemoteHandlers(connection, deps)` (deps = the 12 structural ports; `createRemoteDispatcher`/`makeFakePorts` in `packages/remote/src/handlers/ports.ts` show the port shapes).
- `packages/remote/test/p8t4-test-client.ts` — the deterministic client (stale guard `decideFrameVerdict`, backoff state machine, page anchoring). Your e2e client should drive THIS client through a real-HTTP transport you write.

**Your harness (new untracked files under your evidence dir, e.g. `dev/agent-workflow/evidence/G8-REVIEW/reviewer-N/harness/`):**

1. A row payload (like `plugin.mjs`) that loads the worktree's `packages/remote/src` + `packages/runtime`/`contracts`/`domain`/`storage` sources via the ts-loader pattern, builds REAL ports over the fresh DSH_HOME's real TeamDomain storage (seed a small team with a few members + ledger entries the way `run.mjs` plants fixtures), and registers the public seam: `connection.rpc.handle('/team-remote', <dispatcher from registerRemoteHandlers>)`.
2. A boot driver (like `run.mjs`) for web port **318<N>** (reviewer 4 → 3184, 5 → 3185, 6 → 3186), fresh DSH_HOME under `references/.dsh-test-g8-r<N>` (workspace-internal), cordis.patch.yml row mount, FILE-FD stdio, log waits, cleanup in finally.
3. A browser-less node client (real HTTP: cookie mint + client-request POSTs) that drives `p8t4-test-client` and asserts the e2e scenarios (for deep value comparison use `deepStrictEqual` from `node:assert`):
   - **E1 projection round-trip**: `team.create` → `team.getProjection` → value deserializes to the typed P8-T1 `TeamProjectionDto` losslessly, provenance intact (origin/method/contractVersion/requestToken + generation).
   - **E2 round-trip after reconnect**: pull a projection; destroy the client connection (new client / re-mint cookie); reconnect; re-pull → projection consistent with durable truth (generation equal-or-advanced, content matches).
   - **E3 stale ignored**: fire `team.getProjection`; while in flight perform a mutating action (e.g. `member.create`); apply the newer projection; then the OLD response arrives → the client must REJECT it (applied state untouched; verdict `stale`).
   - **E4 pagination stable**: `team.getLedgerPage` first page + anchor; append ledger activity (e.g. `member.send`); re-fetch with the same anchor → same page semantics stable per the P8-T2 ledger read-path contract.
   - **E5 typed errors + provenance on the wire**: invalid ID, unsupported contract version, and one admission-blocked action → HTTP 200 `result.ok:false` with typed code + message (NO 500s, NO raw exceptions); every success value carries provenance.
   - **E6 wire negatives**: no cookie → 401; wrong content-type → 415; method≠endpoint → 200 `bad-request`.
4. **Dependency scan** (criterion 1): prove from the BROWSER consumer's perspective that the remote surface alone suffices — scan `packages/remote/**` import face (all relative; the 12-port surface; zero SessionController/session-log/mirror tokens) and assert the test client's data needs are fully met by remote responses (no side channel). Log → `dependency-scan.log`.
5. **Reconnect suite**: E2 (e2e) + the in-process `p8t4-*` reconnect tests (step 3) together constitute the reconnect suite; cite both.

**Serialization (MANDATORY)**: only ONE pristine-host harness may run at a time. External lockfile `references/.dsh-test-g8.lock` (the harness has no internal lock — documented gap): before booting, loop: if lock file age < 10 min → sleep 20 s and retry (≤75 times ≈ 25 min); if age ≥ 10 min → remove it; then write `G8-R<N> <ISO timestamp>` to the lock. In your finally: remove the lock ONLY if its content still matches your `G8-R<N> <ts>` marker. If you still cannot acquire after the loop: do NOT force-remove a fresh lock — record `e2e: NOT-RUN(LOCK-TIMEOUT)`, skip §5, and continue with in-process evidence; the main agent adjudicates.
Log the whole e2e (boot, scenario PASS/FAIL lines, wire samples, cleanup) → `e2e-run.log` + keep instance output under `harness-output/`.

## §6 The six G8 criteria (DevPlan §21.5 — each needs criterion → evidence → PASS/FAIL)

1. **No SessionController Team mirror**: the browser needs NO SessionController Team mirror — the remote surface alone is sufficient (evidence: §5 dependency scan + owned-boundary + handler 12-port structural surface).
2. **Round-trip after reconnect**: a projection round-trip works after reconnect (evidence: e2e E2 + p8t4 reconnect suite).
3. **Stale responses ignored**: stale/older responses never overwrite newer client state (evidence: e2e E3 + p8t4 stale-guard tests + the P8-T1 `decideFrameVerdict` combination with the dispatcher).
4. **Ledger pagination stable**: paging is stable under ledger growth (evidence: e2e E4 + p8t4 page-anchor tests against the P8-T2 ledger read path).
5. **Typed error + provenance**: every UI-visible action has a typed error + provenance on the wire (evidence: e2e E5 + p8t3 error/version suites + closed error registry in `packages/remote/src/contracts/errors.ts`).
6. **Contract versioned + tested**: the Remote contract is versioned (`REMOTE_CONTRACT_VERSION`, supported-versions set, version-mismatch rejection) and tested (evidence: p8t3-version suite + e2e E5 version case + catalog closedness).

## §7 Verdict (fixed format — your LAST message)

Verdict vocabulary (ROUTER_RULES): `通过` (all evidence green) | `投机通过` (green with minor, non-blocking concerns recorded) | `补充内容` (a criterion needs more evidence than you could produce — list exactly what) | `阻塞` (a criterion FAILS or a red line is broken — say which, with evidence).

```
G8RN_VERDICT
verdict: 通过 | 投机通过 | 补充内容 | 阻塞
reviewer: N
head: 3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86
chain: <passed>/<total> (failures <n>) | tsc: contracts=<x> domain=<x> storage=<x> runtime=<x> testkit=<x> remote=<x>
criterion-1 no-mirror: PASS|FAIL — <one-line evidence>
criterion-2 reconnect-roundtrip: PASS|FAIL — <one-line evidence>
criterion-3 stale-ignored: PASS|FAIL — <one-line evidence>
criterion-4 pagination-stable: PASS|FAIL — <one-line evidence>
criterion-5 typed-error-provenance: PASS|FAIL — <one-line evidence>
criterion-6 contract-versioned-tested: PASS|FAIL — <one-line evidence>
e2e: RUN(PASS) | RUN(<n> scenario failures: list) | NOT-RUN(LOCK-TIMEOUT) | NOT-RUN(<reason>)
e2e-port: 318<N> | n/a
zero-core: PASS|FAIL | private-import: PASS|FAIL | owned-boundary: PASS|FAIL
concerns: <none | list>
blocker: <none | BLOCKER:TYPE:detail>
```

- Write the same content to `dev/agent-workflow/evidence/G8-REVIEW/reviewer-N/g8-report.md` (your report file) before finishing.
- Do not leave the harness running; delete your lock only if you own it; ports must be released (your driver does this in its own finally — verify).
- If a transient environment failure hits your e2e (e.g. a Windows file-handle race in a testkit scratch dir): clean the untracked leftover, retry ONCE, and record the incident in `concerns`; it does not by itself fail a criterion.
