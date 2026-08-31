# G8-REVIEW — reviewer 4 (N=4) report

- Phase / task: P8 (`int/P8-remote-projection`)
- Head under review: `3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86` (detached worktree `.worktrees/G8-R4`, clean)
- Diff base: `959e36358ee7244ff8c7e1e0b8396e70dfef4562` (owned delta: 97 files, `owned-diff.txt`)
- Brief: `dev/agent-workflow/briefs/G8-review-brief-r2.md` (§0–§7 executed in order; N=4 substituted)
- Reviewer session: 2026-08-31, provider qiyuan-self / model qwen3.8-27b, LEAF (no subagents/workflow/ralph)
- Blindness: nothing under `dev/agent-workflow/` was used for judgment except my own brief (re-reads) and my own evidence writes. One incidental over-broad grep exposure occurred — see concerns (1); contents were NOT used.

## §2 Worktree

Detached worktree `.worktrees/G8-R4` at head `3fa4c1f27…`, `git status --porcelain` empty before and after all work. No tracked file was modified; all reviewer artifacts are untracked and left in place under this report's directory. No push performed.

## §3 Frozen docs (sha256 — all 4 MATCH)

| doc | sha256 |
| --- | --- |
| Architecture | `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53` |
| UI | `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e` |
| DevPlan | `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f` |
| TaskDoc | `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3` |

Files are gitignored; read from the main worktree `docs/plans/active/` (the only copy). Log: `chain-rerun.log` lines 8–13.

## §4 Chain rerun + boundary checks

- `pnpm install --ignore-scripts`: exit 0, lockfile up to date (150 pkgs reused).
- Full chain: **1773 passed, 0 failed** (7030 ms), including the p8t3 admission/round-trip/invalid-id/negative/error/version suites and the p8t4 reconnect/stale/page-anchor suites. Log: `chain-rerun.log`.
- tsc ×6 (erasable TS, no emit): contracts=0, domain=0, storage=0, runtime=0, testkit=0, remote=0 (all exit 0).
- Boundary checks (`boundary-checks.log`): **zero-core PASS** (no `node:` builtins anywhere in `packages/`; sole bare production import is `yaml` in `packages/domain/blueprint/src/parse.ts:34`, pre-existing and permitted) | **private-import PASS** | **owned-boundary PASS** (all 97 changed files inside the owned globs, 0 out-of-glob).
- Stable-instance probe :3080 = HTTP 200 BEFORE any work (and AFTER — see §5 postflight).

### §4.5 Cross-task invariant combination review

Direct source reads (this session chain) establish the invariants hold in combination, not just per task:

1. **P8-T2 read surface × P8-T3 remote (no-mirror, structural).** `TeamDomainReadPort` (`packages/runtime/projection/types.ts`) exposes **exactly one method**, `readProjectionSource(teamSessionId): TeamDomainProjectionSource` — there is no session-log / child-log read surface at all, so the §21.2 no-log red line is enforced by the type system, not by convention. `createProjectionService` (`service.ts:78–93`) is the only reader: `readProjectionSource` → `overlay?.snapshot()` (once per projection) → `projectTeam(source, snapshot, clock())`; the fold is pure (no I/O, clock injected at the service boundary and used only for the `generatedAt` stamp), and it "does not write, does not scan session logs, and does not touch the (ephemeral) SessionController Team mirror" (service.ts doc, lines 22–25). The live overlay never fills identity/generation/workspace lanes — `generation` is always the durable one (service.ts doc lines 18–20; fold.ts:88 `generation: source.generation` verbatim), so stale-overwrite detection downstream remains trustworthy with or without live activity.
2. **P8-T1 contracts × P8-T3 dispatcher (provenance/data agreement by construction).** Dispatcher flow (dispatch.ts/request.ts pinned): unknown-endpoint check BEFORE envelope parse; `parseRemoteRequest` exact keys `{version, params}`; version ∉ [1] → `contract-version-unsupported`; `requestToken` echoed into provenance; sync category-handler call; `buildRemoteSuccess` carries `projectionGeneration`/`effectSequence ?? null`; never rejects. `team.getProjection` sets `projectionGeneration: projection.generation` (handlers/team.ts:184–192), so provenance and data generation agree by construction — verified over the wire in E1 (`provenance ok … gen=2` with `data.generation === 2`).
3. **P8-T3 generation semantics × P8-T4 client (stale guard).** Every durable mutation the remote layer performs lands as a ledger put, and the real storage hook (hook A: each ledger put advances THAT entry's `rootSessionId` team generation +1, verified in the copied store) makes the durable generation strictly increase. The client (`push/pull.ts` `assessProjectionSync` → `decideFrameVerdict`) rejects `provenance.projectionGeneration !== projection.generation` as `inconsistent` and frames whose generation ≤ applied as `stale`; the transport must echo the client's `rpcId` (client correlation guard → `inconsistent`). Combination: an in-flight stale response carries a strictly lower durable generation than the applied state → deterministic rejection. Verified live in E3 (held gen-6 response rejected after gen-7 applied; applied state untouched; `framesStale ≥ 1`).
4. **P8-T2 ledger read path × P8-T3 `team.getLedgerPage` × P8-T4 page tracker.** The read path is a pure anchor/limit slice over the append-only ledger (D-5 slicer: `nextAfterSequence` non-null IFF the page overflowed, else null). `LedgerPageTracker.applyPage` enforces shape (entries strictly after anchor, ascending, ≤ limit, cursor iff full page, total non-decreasing) and advances the anchor ONLY on non-null cursor — a complete page leaves the anchor unchanged. Server slicer and client tracker implement the same contract; E4 verified it live (fixed anchor under concurrent append: total 6→7, prefix deep-equal, appended entry present; client cursor walk 0→2→4 with limit 2; full pages carry `nextAfterSequence: null`).
5. **P8-T3 error mapping × P8-T5-style admission/intent ports.** Typed domain errors pass through with their code + `reason: 'domain-error'` + cause; untyped errors collapse to `internal-error`; no raw exception or 500 crosses the wire. E5 verified three typed codes (`INVALID_ROOT_SESSION_ID`, `contract-version-unsupported`, `INSTANCE_NOT_FOUND`) over HTTP-200 `{ok:false}` envelopes, and every success value in E1–E4 carried full provenance (origin/method/contractVersion/requestToken + generation/effect).

Structural surface (also confirmed by `dependency-scan.log` §D): `RemoteHandlerDeps` has **exactly** the 12 frozen port names (`catalog, intent, teamCreate, projection, ledger, admission, lifecycle, override, policyState, compatibility, handoff, legacy`) — the remote layer's coupling to the host is precisely the frozen port set, with no mirror, no extra back door.

## §5 Mandated remote e2e (pristine host, browser-less, port 3184)

**Setup (brief line 87 verbatim satisfied).** The harness mounts a single function-plugin row (`harness/row.mjs`, id `g8r4-remote-projection`, `inject: ['webServer','connection']`) via a pre-seeded `profiles/web/cordis.patch.yml` in a fresh `DSH_HOME` (`references/.dsh-test-g8-r4` — auto-init path, no network). The row loads the worktree's `packages/remote/src` + `packages/runtime`/`contracts`/`domain`/`storage` sources through the ts-loader resolve hook (`harness/ts-loader.mjs`), builds REAL ports over the fresh DSH_HOME's real TeamDomain storage (file-backed sync-mutating seam under `<DSH_HOME>/g8-team-domain/`), seeds a small team the way `run.mjs` plants fixtures (root `g8-root-1`: leader `inst-leader` + `inst-alpha` + `inst-beta`, 2 team-member bindings, 5 ledger facts → generation 6), and registers the public seam `connection.rpc.handle('/team-remote', <dispatcher from registerRemoteHandlers>)` (`RM.registerRemoteHandlers(ctx.connection, deps)`). Cookie mint: `GET /?token=<t>` → 303 + HttpOnly `dsh-auth-…` Set-Cookie, captured with `redirect:'manual'`. External lockfile `references/.dsh-test-g8.lock` (acquire/release verified every run); boot under `references/deepseek-harness-test-use` @ pin `cd5ef814` (HEAD `cd5ef81481`, porcelain verified clean before AND after). Logs: `boot.log`, `e2e-run.log`, `e2e-summary.json`; store + harness output copied to `team-domain-store/`, `harness-output/`.

**Documented harness decisions.** (a) Storage seam is file-backed with sync cache mutations (production host binding is deferred to P4-T5/P5 — the seam exercises the same repositories/contracts the host will use). (b) The ledger sequence space is global across teams (one counter row — decision 5), so absolute sequences are shared while per-team `totalEntries`/prefixes are per-team. (c) The agent-setup surface is an inline mock-first no-op recorder (R28). (d) The fresh-root `team.create` path persists the leader `MemberInstanceRecord` (`inst-leader`, `childSessionId = root`, RUNNING) + its `member.created` fact — the projection fold REQUIRES exactly one leader row (`MALFORMED_DTO` otherwise), and the binder itself "never creates" durable records (binder.ts), so the port must complete the structurally-valid team; this mirrors the seed team exactly. (e) E2's deep comparison excludes `generatedAt` (the fold's injected-clock stamp — the only non-deterministic input to the pure fold; run-5's full assert diff confirmed it was the sole differing leaf).

**Scenario results (final run — `e2e-run.log`, 2026-08-31T13:53:39Z):**

- **E1 PASS** — `team.create` (fresh root `g8-e1-root`, blueprint rev 1) → `path=fresh-root`, `durable.wrote=true`; `team.getProjection` → value deserializes losslessly to the typed P8-T1 `TeamProjectionDto` (JSON round-trip deep-equal), `parseTeamProjection` OK, provenance intact (origin `team-remote`, method, contractVersion 1, requestToken echoed, `projectionGeneration === data.generation === 2`), structurally complete team (exactly one member row = leader; 1 ledger entry).
- **E6 PASS** — no cookie → 401; `text/plain` content-type → 415; `method ≠ endpoint` → HTTP 200 `{ok:false}` `bad-request` (`method X does not match endpoint Y`). Fence ordering (403/401 → 404 → 415 → 400 → bad-request) holds.
- **E2 PASS** — client A starts/applies (gen 6), connection destroyed, cookie re-minted, client B starts/applies: generation equal-or-advanced (6→6), content identical (all structural fields deep-equal, clock stamp excluded), projection ledger total == durable `team.getLedgerPage` total == latestSequence (no gaps), harness health generation agrees.
- **E3 PASS** — in-flight `team.getProjection` parked at gen 6; `member.create` (delegation template `writer`) advances durable generation to 7; the parked (old) response arrives after the newer projection is applied → client REJECTS it (`stale`; `receivedGeneration === 6` < applied 7); applied state untouched; `framesStale ≥ 1`; new instance `inst-0ebe162068c4`.
- **E4 PASS** — anchor 0 page: 6 entries; `member.send` appends (seq 8, `effectSequence` provenance on success); re-fetch SAME anchor → total 7, prefix deep-equal (append-only stability), appended entry present with `factType message.sent`; full pages carry `nextAfterSequence: null` per D-5; client `fetchPage(0,2)` → cursor 2, `pageAnchor()=2`; `fetchPage(2,2)` → anchor 4 (tracker advances only on non-null cursor).
- **E5 PASS** — invalid (whitespace) root ID → `INVALID_ROOT_SESSION_ID` with `details.method`; unsupported contract version 2 → `contract-version-unsupported`; admission-blocked target → `INSTANCE_NOT_FOUND` with `reason: domain-error` + cause. All over HTTP 200 typed envelopes — no 500s, no raw exceptions.

**Run history (transparency).** 7 boot runs total: runs 1–6 fixed driver-side bugs only (REPO_ROOT path; Windows-sandbox EPERM on piped stdio → FILE-FD pattern; `node:module` import name; `blueprintOf` field; transport rpcId correlation; E4 cursor semantics; E3 disarm ordering; E2 clock-stamp exclusion; E1 global-sequence expectation; fresh-root leader record). **Zero environmental failures** — the brief's retry-once rule for transient env failures was never needed. Lock acquired+released cleanly on every run; postflight after every run: test-use porcelain clean, :3080 = 200, port 3184 released. Store copy proves hook-A per-team semantics (seed root gen 6→8 across E3/E4; fresh root gen 1→2).

**Postflight (final run):** `test-use HEAD=cd5ef81481 clean=true`, `stable :3080 -> 200`, `port 3184 busy=false`, `summary: e2e=ALL-PASS`, lock released. No harness left running; no leftover processes.

## §6 Criteria (DevPlan §21.5)

1. **No SessionController Team mirror — PASS.** `dependency-scan.log` (41 files of `packages/remote`): 144 relative / 0 `node:` / 0 absolute specifiers; bare = test-only `vitest` + `vitest/config`; zero mirror/host-private tokens in code (one non-binding string-literal mention in a p8t3 positive-control test label, `NOTE`d); 12-port face exact; read port single-method. Plus owned-boundary PASS and §4.5 combination 1.
2. **Projection round-trip after reconnect — PASS.** e2e E2 (live wire, new client + re-minted cookie, content identical, durable-truth agreement) + p8t4 reconnect suite inside the 1773 chain.
3. **Stale responses ignored — PASS.** e2e E3 (held old response rejected after newer generation applied; applied state untouched) + p8t4 stale-guard/`decideFrameVerdict` in chain; combination 3.
4. **Ledger pagination stable — PASS.** e2e E4 (same anchor under append: stable prefix, +1 total, cursor semantics per D-5; client tracker walk 0→2→4) + p8t4 page-anchor suite in chain; combination 4.
5. **Typed error + provenance — PASS.** e2e E5 (three typed codes, 200 envelopes, no 500s/raw exceptions) + provenance verified on every success value (E1/E3/E4) + closed error registry (`contracts/errors.ts`) exercised by p8t3 suites in chain.
6. **Contract versioned + tested — PASS.** `REMOTE_CONTRACT_VERSION = 1`, supported-versions gate (version 2 → `contract-version-unsupported`, e2e E5), p8t3 round-trip/version/error suites in chain, catalog closedness (structural scan + in-chain tests).

## §7 Verdict

All six criteria PASS on independently reproduced evidence (chain rerun, boundary checks, deterministic dependency scan, live browser-less e2e over a pristine host on port 3184). Recorded concerns are process-level only and do not affect any criterion's evidence.

```
G8RN_VERDICT
verdict: 通过
reviewer: 4
head: 3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86
chain: 1773/1773 (failures 0) | tsc: contracts=0 domain=0 storage=0 runtime=0 testkit=0 remote=0
criterion-1 no-mirror: PASS — dependency-scan.log green: 0 node:/absolute specifiers, 0 mirror/host-private tokens in code across 41 files, exactly-12 port face, single-method read port
criterion-2 reconnect-roundtrip: PASS — e2e E2 live wire: new client + re-minted cookie, gen 6->6, content identical, projection ledger total == durable total
criterion-3 stale-ignored: PASS — e2e E3: held gen-6 response rejected stale after gen-7 applied, applied state untouched, framesStale>=1
criterion-4 pagination-stable: PASS — e2e E4: same anchor under member.send -> total 6->7, prefix deep-equal, appended seq 8, cursor walk 0->2->4, full pages null-cursor per D-5
criterion-5 typed-error-provenance: PASS — e2e E5: INVALID_ROOT_SESSION_ID / contract-version-unsupported / INSTANCE_NOT_FOUND over 200 envelopes, no 500s; provenance on every success value
criterion-6 contract-versioned-tested: PASS — REMOTE_CONTRACT_VERSION=1 gate (version 2 rejected, e2e E5) + p8t3 round-trip/version/error suites in 1773 chain
e2e: RUN(PASS)
e2e-port: 3184
zero-core: PASS | private-import: PASS | owned-boundary: PASS
concerns: process-only, none affect criterion evidence: (1) one over-broad grep incidentally returned a few lines from dev/agent-workflow outside my own evidence — contents NOT used for any judgment; (2) e2e needed 7 boot runs — every failure was a driver-side bug (paths, sandbox EPERM stdio -> FILE-FD, import name, rpcId correlation, cursor assertions, E2 clock-stamp exclusion, E1 global-sequence expectation, fresh-root leader record), zero environmental failures, retry-once rule never needed; (3) documented harness decisions: file-backed sync seam, global ledger counter (decision 5), mock agent-setup surface (R28), fresh-root team.create persists the leader record (fold hard requirement; binder never creates), E2 deep-equal excludes generatedAt clock stamp; (4) taskkill access-denied under sandbox — driver fell back to child.kill() and verified host exit
blocker: none
```

## Evidence files (this directory, untracked, left in place)

`chain-rerun.log`, `boundary-checks.log`, `owned-diff.txt`, `pnpm-install.log`, `dependency-scan.log`, `e2e-run.log`, `e2e-summary.json`, `boot.log`, `e2-diff-run5.txt` (run-5 E2 full assert diff), `harness/` (row.mjs, ts-loader.mjs, boot.mjs, client-e2e.mjs, import-drytest.mjs, dependency-scan.mjs, import-face-audit.mjs, blueprints/team.g8research.yaml), `harness-output/`, `team-domain-store/`.
