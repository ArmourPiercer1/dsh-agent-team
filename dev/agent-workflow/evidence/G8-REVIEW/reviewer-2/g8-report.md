# G8-REVIEW — reviewer-2 (N=2) report

- Gate: G8-REVIEW · Program: dsh-agent-team (Team-mode vNext, phase P8)
- Reviewer: 2 · Provider/model: qiyuan-self/qwen3.8-27b (mandated, not switched)
- Worktree: `.worktrees/G8-R2` (detached @ `93d2a96e3ded6a92820f78ee9de94eac9ea6fffb`)
- Evidence dir (this dir): `dev/agent-workflow/evidence/G8-REVIEW/reviewer-2/`
- e2e port: **3182** · Brief: `dev/agent-workflow/briefs/G8-review-brief.md` (read in full incl. §5 verbatim)
- Discipline: BLIND (nothing under `dev/agent-workflow/` opened except the brief; no writes anywhere except this evidence dir); zero tracked-file modifications; zero pushes; stable deployment `D:\deepseek-harness\` and :3080 untouched (:3080 probed 200 before and after every e2e run); worktrees G8-R1/G8-R3 never touched.

---

## 1. §4.3 — Chain rerun at the integration SHA

`chain-rerun.log` (complete, this dir):

- Worktree proof header: toplevel `.worktrees/G8-R2`, HEAD `93d2a96e3ded6a92820f78ee9de94eac9ea6fffb` (exact integration SHA, asserted by every subsequent step).
- `pnpm install --ignore-scripts` clean; full test rerun via the repo's plain-node runner (no pnpm/vitest CLI): **1754 passed, 0 failed, 1754 total** (6896 ms), covering the brief-mandated key positive + negative suites (p8t1 contracts, p8t2 runtime projection, p8t3 remote contract, p8t4 test client, plus the full package graph).
- `tsc -p` per package, all exit 0: **contracts=0 domain=0 storage=0 runtime=0 testkit=0 remote=0**.

## 2. §4.4 — Boundary checks (external lockfile, main-worktree frozen docs)

`boundary-checks.log` + `boundary-lockfile-diff.txt` (complete, this dir):

- **zero-core: PASS** — no import/reference into `references/deepseek-harness/` (frozen legacy fork) from any vNext package source or test; lockfile diff vs base `959e36358ee7244ff8c7e1e0b8396e70dfef4562` shows no upstream-pinned dependency drift introduced by the integration range.
- **private-import: PASS** — no import of upstream private/internal APIs anywhere in the vNext package trees.
- **owned-boundary: PASS (adjudicated)** — mechanical scan flagged 11 files (mandated test deliverables of the owning tasks: `packages/contracts/test/p8t1-*`, `packages/runtime/test/p8t2-*`, `packages/remote/test/p8t3-*`/`p8t4-*`), because brief §4.4's concretized test globs name only the T3/T4 test outputs while §4.3 itself orders the reviewer to re-run the p8t1/p8t2 suites. Adjudication (logged in full in the file): per the AGENTS.md authority order (frozen TaskDoc above protocol docs), the TaskDoc-mandated test outputs are legitimate deliverables committed by the owning tasks; **effective owned-boundary violations after adjudication: 0**. The brief enumeration gap is recorded as a documentation discrepancy (concern #2), not a violation.
- Frozen docs: all four `docs/plans/active/` 20260829 documents verified by sha256 against the frozen copies — **all MATCH**.

## 3. §4.2 / criterion 1 — No SessionController Team mirror (remote surface alone sufficient)

`harness/scan.mjs` → `dependency-scan.log`: **SCAN: PASS (src R1-R6=0, test code-context=0, import audit=0, ports=12, test-client side-channel=0)**

- R1–R6 patterns (SessionController, team-mirror service registration, domain/service duplication signatures, storage reach-around from remote, node: builtins in remote src, external specifiers): 0 hits in src, 0 in test code context.
- `RemoteHandlerDeps` (src/handlers/ports.ts) is **exactly the 12 frozen ports** (catalog, intent, teamCreate, projection, ledger, admission, lifecycle, override, policyState, compatibility, handoff, legacy) — no mirror port in the dispatcher wiring.
- `p8t4-test-client.ts` import audit: all 4 imports stay inside `packages/remote` (no storage/runtime/domain side channel, no node: builtins, no vitest).
- Sufficiency proof: the entire §5 e2e (create → projection → reconnect → stale → pagination → mutations → error taxonomy) was driven through the remote seam with only those 12 ports behind it — the remote surface alone suffices; no Team mirror exists or is needed.

## 4. §5 — Mandated pristine-host, browser-less remote e2e (external lockfile)

### 4.1 Setup (all driver-logged, `e2e-run.log`)

- Test-use tree `references/deepseek-harness-test-use` pristine upstream, pinned at `cd5ef8148158c3a752a658978873241fdf8e2bbc` (`DSH_CLIENT_COMMIT_HASH=cd5ef814`), `git status --porcelain` empty before **and** after every run.
- Fresh per-run `DSH_HOME` = `references/.dsh-test-g8-r2` (workspace-internal, TEST_METHODS convention); row mounted via `DSH_HOME/profiles/web/cordis.patch.yml`; mount + dump proof captured each run.
- External lock `references/.dsh-test-g8.lock` (shared with reviewers 1/3): acquired **attempt 1** in every run, released with content-matched marker at end. Lock and DSH_HOME live under the main worktree's `references/` directory which is entirely **untracked** — "never write to main worktree" = never modify tracked git state; no tracked path was ever written.
- Boot: `node apps/cli/lib/bin.js web --port 3182 --no-open` (FILE-FD stdio only — piped stdio is EPERM under this sandbox); cookie minted via `GET /?token=` → 302 + `Set-Cookie dsh-auth-<43>=v1.<seg>.<seg>` (B2 shape, regex-verified per mint).
- `:3080` probed 200 before and after every run (final independent probe: 200). Port 3182 free before, released after (independently re-verified: connection refused). No leftover e2e node processes (machine node count back to the stable-harness baseline).
- Environment note: `web/lib` absent in the test-use farm build; boots succeed without it (recorded, concern #5).

### 4.2 Harness design (my artifacts, `harness/` — untracked evidence, freely iterated)

- `row.mjs` — the cordis row exposing the remote seam over a **synchronous in-memory model**. Rationale (documented in-file): `packages/remote/src/handlers/ports.ts` carries deviation **D-2** — port methods are synchronous (vNext runtime services/storage are in-process and synchronous; the seam is promise-based and the dispatcher adapts), and handlers validate returned plain records via `isPlainRecord`. This is exactly the stand-in role the product's own `makeFakePorts` (p8t3-helpers.ts) fills for in-process suites; faithful remote e2e requires a sync source of truth. All 12 ports implemented; deterministic injected clock (`'2026-01-01T00:00:00.000Z'`, the P8-T2 test option) so repeated reads are byte-stable.
- Stale-response mechanism (E3): the row reads `<DSH_HOME>/g8r2-control.json` (`{"pin": <gen>}`); while pinned it serves the cached snapshot source of that generation, producing a genuine over-the-wire stale-generation response through a real HTTP reply.
- `client.mjs` — plain `node:http` client driving the **real product test client** (`packages/remote/test/p8t4-test-client.ts` via ts-loader) over real HTTP, plus raw `client-request` POSTs. String wire rpcIds (`g8r2-rpc-N`) are minted by the transport and echoed back mapped to the engine's numeric ids — the adapter split documented in concern #4.
- `driver.mjs` — preflight (SHA assert, test-use pin+pristine, :3080 200, port free) → lock → fresh DSH_HOME → throwaway profile-init boot → real boot → row activation marker poll → client run → stop → postflight (stable 200, port released, tree byte-clean) → `e2e-summary.json`.

### 4.3 Results — run 8 (final): **ALL 6 SCENARIOS PASS** (44/44 checks, 13 wire samples)

`harness-output/e2e-summary.json` + `e2e-run.log` (latest section). Wire bodies archived in `harness-output/wire-samples.json` (parsed envelopes).

| Scenario | Result | Evidence |
|---|---|---|
| **E1** projection round-trip (12/12) | PASS | E1.1–1.5 raw `team.create` → 200 typed envelope, `path: fresh-root`, `bind.teamSessionId === rootSessionId` (invariant 9), provenance on success; E1.6–1.9 first pull verdict `apply` gen 1, applied frame round-trips `teamSessionId`, frame provenance (`getProjection`, `projectionGeneration: 1`, `requestToken: null`); E1.10 raw `team.getProjection` 200 ok; **E1.11 lossless JSON round-trip through the real P8-T1 `parseTeamProjection`**; E1.12 all nine frozen `REMOTE_PROJECTION_FIELDS` present. |
| **E2** round-trip after reconnect (8/8) | PASS | E2.1–2.4 loss → `transport-loss` verdict, state `reconnecting`, frozen backoff entry (attempt 1, cap 20 ms, delay ∈ [cap/2, cap]), deterministic `advance(20)` → reconnect, gen-1 duplicate (idempotent); E2.5 re-minted cookie (B2 shape); **E2.6 new client re-pull applies the durable generation; E2.7 applied content deep-equal to a second raw-RPC durable truth**; E2.8 generation equal-or-advanced. In-process corroboration: p8t4 reconnect suites + P8-T1 `decideFrameVerdict` (rerun in §4.3 chain). |
| **E3** stale response ignored (7/7) | PASS | E3.1 in-flight gen-1 response captured; E3.2–3.3 `member.create` 200 ok, `effectSequence: 4`, `requestToken` echo; E3.4 client applies gen 2; **E3.5 the stale gen-1 reply (served over a genuine HTTP response via the row's pin) is REJECTED — verdict `stale`, `receivedGeneration: 1`; E3.6 `framesStale === 1`; E3.7 applied state byte-identical to the pre-stale snapshot (still gen 2)**. In-process corroboration: p8t4 stale suites (P8-T1 `decideFrameVerdict`). |
| **E4** ledger pagination stable under growth (8/8) | PASS | E4.1 first page (anchor 0, limit 3): seq 1–3, cursor 3 (non-terminal), total 4; E4.2 tracker anchor → 3; E4.3 `member.send` 200 ok, `effectSequence: 5`, token echo; E4.4 next page from anchor: seq 4–5, terminal, total 5; **E4.5 raw re-read of anchor 0 → byte-identical first-page entries** (independent node diff over the archived wire samples: entries 0–2 IDENTICAL, `total` 4→5 the only movement); E4.6 total only moved up (4→5); E4.7 tracker rejects the stale-anchor re-fetch (`anchor-mismatch`; cursor stays 3, `pagesRejected: 1`); E4.8 `pagesApplied === 2`. Interpretation (concern #3): the tracker's `applyPage` rejects older-anchor re-fetches by design (correlation guard, `packages/remote/src/push/ledger-page.ts` lines 21–24/125–128) — that rejection is part of the frozen P8-T2 read-path contract, and the stability claim is proven by the byte-identical raw slice plus the guard rejection, exactly as the contract specifies. |
| **E5** typed errors + provenance (9/9) | PASS | E5.1 invalid `teamSessionId` → 200 typed envelope, `ok:false`, reason `domain-error`, cause code in the session-id grammar family; E5.2 contract version 2 → typed unsupported-contract-version rejection (criterion 6 on the wire); E5.3 duplicate `member.create` (`inst-g8r2charlie` re-requested) → `member-already-exists`, reason `domain-error`, cause code; E5.4–5.7 full provenance on all successes (`origin`/`method`/`contractVersion: 1`/`projectionGeneration`; `requestToken` echo on `member.create`/`member.send`); E5.8 **no HTTP 500 anywhere in the whole run**; E5.9 every 200 body is a typed `server-response` envelope (no raw exceptions on the wire). |
| **E6** seam negatives (4/4) | PASS | E6.1–6.2 no cookie → 401 (body indicates unauthorized); E6.3 wrong content-type → 415; E6.4 method≠endpoint → 200 `result.ok:false`, code `bad-request` (endpoint check precedes the envelope). |

### 4.4 Harness incidents (ALL in my own untracked harness artifacts; NONE product-related; all fixed and re-run)

1. **Async ports leaked Promises into the synchronous handlers** (run 4: `'teamCreate': expected an object, got [object Promise]`, reason `port-contract`). Design error on my side against the D-2 sync-port contract; `row.mjs` rewritten as a synchronous in-memory model.
2. **Fixture instanceIds with hyphens in the suffix** (`inst-g8r2-alpha`) rejected by the fold → P8-T1 `parseInstanceId` grammar (`inst-<1..32 lowercase alphanumerics>`). Fixed to `inst-g8r2alpha`/`inst-g8r2bravo`/`inst-g8r2auto${n}`/`inst-g8r2charlie`. *Positive side effect*: the rejection arrived as a correctly typed `domain-error` envelope with cause `INVALID_INSTANCE_ID` — live wire evidence of criterion 5 before the fixture fix (run 5).
3. E1.10 aborted on `JSON.parse("undefined")` when the projection was absent → guarded with a record-the-check-FAIL path instead of ERROR-abort.
4. E3.7 `preStaleFrame` captured at scenario top (gen 1) instead of post-apply (gen 2) → capture moved after E3.4.
5. Live-clock nondeterminism between repeated reads → deterministic injected clock (product-provided P8-T2 test option).
6. **Decisive (runs 4–7): `import util from 'node:util'; util.deepStrictEqual` is `undefined` — `deepStrictEqual` lives in `node:assert`, and the comparator's try/catch silently converted every `deepEqual` to `false`, producing spurious E2.7/E3.7/E4.1/E4.4/E4.5 failures.** The wire content was byte-stable from the start: an independent node diff over the archived wire samples showed the E1/E2 `getProjection` bodies byte-identical and the E4 first-page vs raw re-read entries 0–2 IDENTICAL, and run-7 diagnostics reported `json-strings-equal (deepStrictEqual still failed)` on all three — i.e. equal content, broken comparator. Fixed in run 8 (import from `node:assert` + a fail-loud guard so a comparator regression can never be swallowed again) → all 6 scenarios PASS.

### 4.5 Observations

- **Positive**: the product rejected my malformed fixture instanceId over the wire with a correctly typed `domain-error` envelope (reason + `{code, message}` cause) — criterion-5 behavior observed live on a real host.
- **rpcId split** (concern #4): the p8t4 engine mints numeric ids (`push/types.ts`: `rpcId: number`) while the upstream wire requires string rpcIds (`clientRequestSchema`). My e2e transport demonstrates the mint-and-map adapter; a future vNext browser client must do the same. Integration consideration, not a defect.

## 5. §6 — Criterion verdicts

1. **No SessionController Team mirror — PASS.** Scan: src R1–R6=0, test code-context=0, import audit=0; `RemoteHandlerDeps` exactly the 12 frozen ports; p8t4 test-client imports confined to `packages/remote`; the entire e2e ran through the remote surface alone.
2. **Projection round-trip after reconnect — PASS.** E2.5–E2.8: fresh client + re-minted cookie re-pulls the durable generation; applied content deep-equal to a second raw-RPC truth; in-process p8t4 reconnect suites + `decideFrameVerdict` rerun green in the chain.
3. **Stale responses ignored — PASS.** E3.5–E3.7: genuine over-the-wire stale gen-1 reply rejected (`stale`, `framesStale: 1`), applied state byte-identical to the pre-stale snapshot; in-process p8t4 stale suites rerun green.
4. **Ledger pagination stable — PASS.** E4.1–E4.8: cursors/anchors advance correctly under growth, raw re-read of anchor 0 byte-identical (total only moved up), older-anchor re-fetch rejected by the frozen tracker guard; P8-T2 read-path contract satisfied (interpretation note, concern #3).
5. **Typed error + provenance on every UI-visible action — PASS.** E5.1–E5.9 + E6: domain-error cause codes for invalid ids/versions/duplicates, provenance on every success (origin/method/contractVersion/projectionGeneration + requestToken echo), zero HTTP 500s, all 200s typed envelopes; plus the live `INVALID_INSTANCE_ID` rejection of my malformed fixture (run 5).
6. **Remote contract versioned + tested — PASS.** Envelope `version: 1` mandatory (`REMOTE_CONTRACT_VERSION=1`); version 2 rejected with a typed unsupported-contract-version error over the wire (E5.2); in-process p8t3 contract suites (supported set + mismatch rejection) rerun green in the chain.

## 6. Concerns

1. **Frozen docs untracked / main-worktree-only**: the four `docs/plans/active/` frozen documents are not tracked in git and exist only in the main worktree (absent from `.worktrees/G8-R2`); sha256 verified against the main-worktree frozen copies (all match). Repo hygiene; non-blocking.
2. **Brief §4.4 T1/T2 glob enumeration gap**: concretized test globs cover only the T3/T4 test outputs while §4.3 mandates re-running the p8t1/p8t2 suites; raw scan flagged the 11 corresponding TaskDoc-mandated test files; adjudicated non-violations per the AGENTS.md authority order (frozen TaskDoc governs); documentation discrepancy, non-blocking (full reasoning in `boundary-checks.log`).
3. **E4 literal-wording interpretation**: the tracker rejects older-anchor re-fetches by design (correlation guard, `ledger-page.ts`); stability proven via the byte-identical raw slice plus the guard rejection, per the frozen P8-T2/D-5 read-path contract.
4. **rpcId type split**: p8t4 engine numeric ids (`rpcId: number`) vs upstream string wire ids — future vNext browser client must mint/map (demonstrated by my e2e transport).
5. **`web/lib` absent in the test-use farm build**: boots succeed without it; environment note only.
6. **Harness incidents during e2e bring-up** (§4.4, items 1–6) — all my own untracked harness bugs, all fixed and re-run; the decisive one (undefined `deepStrictEqual` silently failing every `deepEqual` in runs 4–7) was caught by differential wire-sample analysis; no product defect was involved in any of them.

## 7. Verdict

**通过 (PASS)** — all six §6 criteria satisfied with wire-level evidence on a pristine host; chain 1754/1754 + tsc 6×0; boundary clean after recorded adjudication; no blocker.
