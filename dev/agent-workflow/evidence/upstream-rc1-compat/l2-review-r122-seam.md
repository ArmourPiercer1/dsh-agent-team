# L2 Review Dossier — R122 Host-Service-Registry Seam (rc.1 `ensureMaterialized` removal)

**Reviewer:** Lane 2 (independent L2 code reviewer), read-only review
**Subject:** uncommitted working-tree changes in `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\RC1` (branch `task/upstream-rc1-compat`, HEAD `c6bae9c`, 6 modified files, all under `packages/runtime`)
**Upstream baseline:** TU at `76fda72979` (0.1.2-rc.1), `git status` clean, `ensureMaterialized` = 0 occurrences in rc.1 `.ts` source (verified by grep)
**Date:** R122 review round

---

## Verdict: **GO**

All seven invariants hold except **2g, which fails on a single stale doc-comment
reference** (`packages/runtime/member-residency/fresh-member.ts:182`) — documentation-only,
zero behavior impact, non-blocking. No source outside `packages/runtime` was touched; the
frozen glue is byte-identical to HEAD; the frozen-glue contract (deps key + method name +
stable error code) is preserved; the `sessions.flush` replacement is exactly upstream's own
rc.1 ACP pattern, verified present in both eras; both test pins are updated and no other pin
references the old list. The compat-matrix §6 section is factually consistent with the diff.

---

## Findings per invariant

### 2a. No file outside `packages/runtime` modified — **PASS**

- `git -C .worktrees\RC1 status --porcelain` → exactly 6 `M` entries, all
  `packages/runtime/**`:
  - `packages/runtime/member-residency/fresh-member.ts`
  - `packages/runtime/member-residency/harness/plugin.mjs`
  - `packages/runtime/member-residency/types.ts`
  - `packages/runtime/src/plugin/host.ts`
  - `packages/runtime/test/p8s5a-host-loadability.test.ts`
  - `packages/runtime/test/runtime.test.ts`
- No untracked (`??`) entries; `git diff HEAD --stat` confirms the same 6 files (57+/39−).
- Frozen glue `packages/runtime/src/plugin/live/agent-bindings.mjs` is **not** in the
  modified set and does not appear in `git diff HEAD` → byte-identical to HEAD. It still
  calls the facade at 7 sites: L815, L863, L878, L914, L980, L1065, L1104
  (`await sessionPersistence.ensureMaterialized(…agent.session)`).

### 2b. Frozen-glue contract preserved — **PASS**

- Deps key `sessionPersistence`: `host.ts:360` (`const sessionPersistence = { … }`) and
  `host.ts:471` (`glue.createAgentBindings({ …, sessionPersistence })` — the key passed to
  the frozen glue).
- Facade method `ensureMaterialized`: `host.ts:361`
  (`ensureMaterialized(session: unknown): Promise<unknown>`).
- Stable error code: `host.ts:367–369` — `TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING`
  with message now naming the `sessions` service / `flush` (message text changed, **code
  unchanged** — the stable-code contract is on the code, not the message).
- Lazy resolution preserved: `host.ts:362` (`ctx.get('sessions')` **per call**, inside the
  method body — identical structure to the HEAD version, which did `ctx.get('sessionPersistence')`
  per call; verified against `git show HEAD:packages/runtime/src/plugin/host.ts` L350–363).
- Guard structure unchanged: `svc === undefined || svc === null || typeof svc.flush !== 'function'`
  (`host.ts:366`) mirrors the HEAD guard (`typeof svc.ensureMaterialized !== 'function'`).

### 2c. `sessions.flush` replacement semantically correct per rc.1 ACP — **PASS**

- Upstream call site (TU rc.1), `references/deepseek-harness-test-use/packages/acp/acp/src/index.ts`:
  - L228: `// The attached log writer's flush materializes an empty session durably.`
  - L229: `await ctx.sessions.flush(record.agent.session)`
  (inside `newSession`, immediately after `record.configOptions(signal)`).
- Alpha.1 ACP (verified via `git show cd5ef814…:packages/acp/acp/src/index.ts`) had
  `await persistence.ensureMaterialized(record.agent.session)` at the same position —
  the in-repo swap reproduces upstream's own migration 1:1.
- Signature stability across eras (stock `sessions` core service):
  - alpha.1: `packages/core/session/src/index.ts:1020` — `async flush(session: Session): Promise<boolean>`
  - rc.1: `packages/core/session/src/index.ts:1087` — identical signature; JSDoc L1074–1086:
    awaited `session/flush` durability checkpoint, all listeners flush, throws first listener
    failure after all settle, returns whether ≥1 durability listener participated.
  - The "no-op on re-run" property relied on by the doc comments holds: with the artifact
    already durable and no pending write-behind, the checkpoint settles with nothing to write.
- rc.1's surviving `sessionPersistence` service is handle-based (481 references repo-wide in
  TU; e.g. `packages/session/session-persistence/src/handle.ts:98`
  `flush(options?)`, service-wide `flush()` in tests) and has **no** `ensureMaterialized` —
  matches the matrix's "face moved from id-based to handle-based" claim.
- Repo call sites match the upstream shape: `host.ts:372` (`return svc.flush(session)`),
  `plugin.mjs:755` (`await sessions.flush(agent.session)`). Return value (`Promise<boolean>`)
  is intentionally not consumed by either site; the frozen glue (alpha.1-era
  `Promise<void>`) only `await`s — compatible.

### 2d. Inject swap is a declaration improvement, not a regression — **PASS**

- `host.ts:337`: `export const inject = ['agents', 'storageDomain', 'sessions']` (HEAD was
  `['agents', 'storageDomain', 'sessionPersistence']`).
- `sessions` is a stock core service: rc.1 `packages/core/session/src/index.ts:862`
  (`super(ctx, 'sessions')`), same package present in alpha.1 (flush at L1020) → provided by
  the host at boot in **both** eras; Loader defer-untail-three-exist semantics are unchanged
  (both old and new lists are all-stock). The row now declares exactly the services it
  consumes: the facade calls `ctx.get('sessions')`, and the glue's materialization path ends
  in `sessions.flush`. The old list declared a service the row no longer calls.
- Fail-closed behavior intact: the facade still resolves lazily per call and throws the
  stable `TEAM_PLUGIN_SERVICE_MISSING` (`host.ts:366–371`) — a pre-settle call cannot
  produce a bare TypeError.

### 2e. Member-residency harness preserves fail-closed semantics — **PASS**

- `packages/runtime/member-residency/harness/plugin.mjs` `makeSessionDurability` L743–758:
  1. L746–749: `ctx.get('sessions') === undefined` → throws
     `'p5t6: sessions service missing — the durability barrier seam is unavailable'` — **before
     any durable write**;
  2. L750–754: `svc.agents.get(SessionId(childSessionId)) === undefined` → throws
     `'p5t6: child session … has no live agent handle …'` — **before any durable write**;
  3. L755: only then `await sessions.flush(agent.session)`.
- Guard order (service → agent → call) is identical to HEAD; only the service key, method,
  and the service-missing message changed. Doc comment L732–741 updated consistently
  (names `sessions.flush`, cites the ACP pattern, keeps the fail-closed statement).
- No test pins the changed `p5t6: … service missing` string (grep `p5t6:` across packages:
  only the separate injected-barrier-fault string `p5t6: injected barrier fault (write-behind
  flush failed)` is pinned, at `test/p5t6-fresh-member.test.ts:734,1053` — untouched).

### 2f. Test pins match; no other test pins the old list — **PASS**

- `test/p8s5a-host-loadability.test.ts:43`: `expect(host.inject).toEqual(['agents', 'storageDomain', 'sessions'])`.
- `test/runtime.test.ts:59`: `expect(hostPlugin.inject).toEqual(['agents', 'storageDomain', 'sessions'])`.
- Grep for quoted `'sessionPersistence'` across `packages/runtime`: **0 matches**.
- Grep `inject.*sessionPersistence | sessionPersistence.*inject` across all packages: only
  `host.ts:21` — a doc comment, not a pin.
- All other `inject).toEqual` pins in the repo are for the **client** plugin (packages/client
  tests, different inject list, unaffected). No other test pins the host plugin's inject list.

### 2g. Doc comments factually consistent; no stale `ensureMaterialized` in non-frozen product files — **FAIL (minor, doc-only)**

- **Stale reference found:** `packages/runtime/member-residency/fresh-member.ts:182` still
  reads `// re-run; the real upstream 'ensureMaterialized' is a no-op when the artifact is
  already durable …` — the diff updated the file's header comment (L33–35 now names
  `sessions.flush(liveSession)` as rc.1's replacement) but missed this inline comment, which
  names a seam that no longer exists in rc.1 as "the real upstream" one. Non-frozen product
  file → violates the invariant as worded.
- All other non-frozen references are intentional, R122-marked historical references and are
  factually correct:
  - `host.ts:23,330,353,356` — describe the removal and the deps-key/method preservation;
  - `plugin.mjs:737` — "R122: rc.1 removed `sessionPersistence.ensureMaterialized` in favor of it";
  - `types.ts:195` — "rc.1's replacement for the alpha.1 `sessionPersistence.ensureMaterialized`";
  - `test/runtime.test.ts:53` — "R122: rc.1 removed sessionPersistence.ensureMaterialized; the
    materialization seam is the stock sessions service's flush".
- Expected-and-correct references (per task brief): frozen glue `agent-bindings.mjs`
  (L23, L815, L826, L829, L833, L863, L878, L914, L980, L1065, L1104) and the
  `t12a-live-bridge` test doubles (`test/t12a-live-bridge.mjs:30,281`,
  `test/t12a-live-bridge.d.mts:122`) — verified to be a facade double mirroring the glue's
  deps surface (L25–36 doc block: "The doubles mirror ONLY the service surface the glue
  consumes … sessionPersistence ensureMaterialized(session)"), valid because the contract is
  unchanged.

### 3. Compat-matrix §6 factual consistency — **PASS**

`dev/agent-workflow\evidence\upstream-rc1-compat\compat-matrix.md` L115–158, checked against the diff:

| Matrix claim | Verified |
|---|---|
| File list = the 6 files (table L143–148) | Exact match with `git status` / `git diff HEAD --stat` |
| `host.ts` row: facade `ctx.get('sessions')` per call, `svc.flush(session)`, same `TEAM_PLUGIN_SERVICE_MISSING` code, message updated, inject swap, deps key + method preserved | Matches `host.ts:337,353–373,471` |
| `plugin.mjs` row: real `SessionDurabilityPort` on `sessions.flush(agent.session)` | Matches `plugin.mjs:743–758` |
| `fresh-member.ts` / `types.ts` rows: doc comments only | Matches the diffs (doc hunks only) |
| Two test files: inject pins → `['agents','storageDomain','sessions']` | Matches (L43 / L59) |
| Discovery story: boot failure message + frozen glue call site `agent-bindings.mjs:863` | L863 confirmed to be `await sessionPersistence.ensureMaterialized(rootHandle.agent.session)` |
| `ensureMaterialized` zero occurrences in rc.1 | Verified (0 matches in TU `.ts`) |
| Alpha.1 had it in `session-persistence-jsonl` interface + ACP | Verified via `git show cd5ef814` (jsonl: `override ensureMaterialized(session: Session)`; ACP: `await persistence.ensureMaterialized(record.agent.session)`) |
| ACP L228–229 quote | Exact match (read directly) |
| `sessions.flush(session: Session): Promise<boolean>` in both eras (api-catalog claim) | Source-level verification in both eras (core/session L1020 / L1087); api-catalog is a live-generated artifact, not a checked-in doc in the TU, so source definitions used as ground truth — signatures identical |
| "R122 commit, 6 files" (L140) | The 6 files are correct; the adaptation is currently **uncommitted** working-tree state (see nits) |
| §8 gates (L180–245): typecheck/build EXIT=0, runtime vitest 1070/1070 (`runtime-vitest-r122b.log`) | Log exists; tail read directly: `Test Files 116 passed (116)`, `Tests 1070 passed (1070)` — plausible and consistent (not independently re-run) |

---

## Nits (non-blocking)

1. **`fresh-member.ts:182` stale seam name** — update the inline comment to name
   `sessions.flush` (mirroring the file's own updated header L33–35), e.g.
   "the real upstream barrier — `sessions.flush(liveSession)` — is a no-op when the artifact
   is already durable…". Doc-only; no behavior or gate impact.
2. **`compat-matrix.md:140` says "R122 commit"** while the adaptation is still uncommitted in
   the working tree. Becomes true once committed; harmless either way.
3. `plugin.mjs:748` user-visible error string changed
   (`sessionPersistence service missing` → `sessions service missing`). Nothing pins it
   (verified) and no stable-code contract covers it (stable-code requirement is on the host
   facade's `TEAM_PLUGIN_SERVICE_MISSING`), so this is a correct consequence of the swap —
   recorded for completeness only.

---

## Evidence notes

- All source-level facts verified read-only against the RC1 worktree (`git diff HEAD`,
  `git show HEAD:…` for the pre-change facade, `grep`/`read` on changed files) and the TU at
  `76fda72979` (clean tree), with alpha.1 (`cd5ef814…`) recovered via `git show`.
- The author's gate evidence was checked for plausibility, not re-run:
  `runtime-vitest-r122b.log` tail = 116 files / 1070 tests passed.
- CORE PATCH BUDGET = 0 holds: TU working tree clean; no upstream file in the diff.
