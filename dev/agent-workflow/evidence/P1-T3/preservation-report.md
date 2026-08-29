# P1-T3 — Preservation of unrelated fork features (Class B) in the downstream host

Task P1-T3 (TaskDoc §11.2): keep the `UNRELATED_FORK_FEATURE` fork content (10 files) in the
downstream host so it does **not** enter `dsh-agent-team`. Allowed dependency: downstream fork only.

- Host worktree: `.worktrees/P1-T3-unrelated`, branch `host/unrelated-features-20260829`, base `cd5ef8148158c3a752a658978873241fdf8e2bbc` (upstream master tip, PR #3248 `dsh-0.1.2-alpha.1` = merge-base(origin/master, legacy)).
- Team worktree: `.worktrees/P1-T3`, branch `task/P1-T3-unrelated-preserve`, base `c61a2f48714d418c31b05e2c0d42aa5ecf5db36e` (master, G0 PASS).
- Legacy reference: `references/deepseek-harness` @ `a3ab31992762c5d6560797eabc7e0885a9320ade` (branch `feat/team-vnext-integration-20260829`, tag `legacy-agent-team-pre-vnext`), used read-only for `git show`/`rev-parse`.
- Authority: `dev/agent-workflow/evidence/provenance/file-manifest.json` (470 files) — replay scope is exactly its 10 `UNRELATED_FORK_FEATURE` entries; `mixed-hunk-report.md` confirms the 11 `MIXED` files are a disjoint set (P1-T1 lane).

## 1. Feature list and replay method

Replay method (all 10 files): **whole-file**. Every one of the 10 manifest entries carries
`mixed_hunks: []`, so no hunk-level selection was required or performed. Content was taken with
`git -C <legacy checkout> show a3ab319:<path>` and written verbatim (fd-redirected write — the
Windows file sandbox forbids piped stdio for non-pwsh programs). Extraction integrity was proven by
recomputing the git blob SHA-1 (`sha1("blob <len>\0" + content)`) in-process and matching it against
the authoritative `git rev-parse a3ab319:<path>` identity from the legacy object database.

5 files are `A` (created in the host tree; absent at `cd5ef814`); 5 are `M` (upstream baseline
content replaced by baseline + the unrelated fork delta). Per-file fork deltas (verified against
`git diff cd5ef814..a3ab319`):

| # | Path (DSH-repo-relative) | St | Disp | Feature | Fork delta | legacy blob @ a3ab319 | bytes |
|---|---|---|---|---|---|---|---|
| 1 | `.agents/notes/implemented/process/2026-08-14-plugin-development-guide-reference.md` | A | REFERENCE_ONLY | Plugin-development-guide process note (EN) | new file | `52c2f0d0`… | 3046 |
| 2 | `.agents/notes/implemented/process/2026-08-14-plugin-development-guide-reference.zh.md` | A | REFERENCE_ONLY | same note (ZH) | new file | `b648bce1`… | 2783 |
| 3 | `AGENTS.md` | M | SPLIT | Two-instance warning header (never touch 3080; this checkout is 3180), pointing at `ENVIRONMENTS.md` | +2 lines at top | `f43c7ce4`… | 16550 |
| 4 | `ENVIRONMENTS.md` | A | REFERENCE_ONLY | Local two-instance environment boundary doc (stable vs dev checkout) | new file | `ea595bcb`… | 2232 |
| 5 | `PLUGIN_DEV_GUIDE.md` | A | REFERENCE_ONLY | Fork-level plugin development guide | new file | `0c951752`… | 11058 |
| 6 | `docs/subsystems/subagent.zh.md` | M | SPLIT | ZH wording fix + paragraph removal (doc sync with English) | +2/−3 lines | `89519463`… | 56018 |
| 7 | `learning-path-zh.md` | A | REFERENCE_ONLY | DSH learning path for physics-background readers (ZH) | new file | `61d0573f`… | 14821 |
| 8 | `packages/session/session-persistence-jsonl/src/format.ts` | M | SPLIT | `SessionLogScanner` backward seq-scan replacement (compaction-summary driven): accepts backward-seq replacement events in place so the committed prefix stays contiguous | +7 lines | `e5661a29`… | 18447 |
| 9 | `packages/web/tool-web/src/turndown-plugin-gfm.d.ts` | M | SPLIT | Type declaration doc-comment cleanup | +5/−4 lines | `9620818f`… | 421 |
| 10 | `scripts/translation-pairing.ts` | M | SPLIT | `references/**` excluded from the translation-pairing scope | +2 lines | `e5365337`… | 18644 |

**Lane disjointness.** None of the 10 paths appears in the 11-file `MIXED` list
(`.gitignore`, `docs/subsystems/README{,.zh}.md`, `packages/core/session/src/known-event-types.ts`,
`scripts/gen-cordis-catalog.ts`, `scripts/gen-doc-graphs.ts`, `scripts/gen-tool-catalog.ts`,
`scripts/project-doc-site.spec.ts`, `website/docs.ts`, `tsconfig.base.json`, `tsconfig.host.json`) —
those files, including their model-UI class hunks, are replayed in the **P1-T1 lane**, not here.
The model-picker family files themselves (`packages/client/ui-settings-models/*`,
`apps/web/tests/models-settings.e2e.ts`, the `models-settings/fetch-grouped.expected.md` companion,
etc.) classify `GENERIC_FORK_CAPABILITY` in the manifest — also P1-T1's lane. This task touches
only the 10 rows above.

## 2. Environment and documented deviations

Toolchain: node v24.20.0, pnpm 11.7.0 (matches the root `packageManager`, so no corepack version
gate; `COREPACK_ENABLE_STRICT=0` / `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` exported anyway).

The Windows file sandbox blocks **every non-pwsh program from creating pipes**. Probed directly:
node `child_process` stdio pipe → `EPERM`; `fork()` IPC channel → `EPERM`; esbuild service spawn
→ `EPERM`; `pnpm install` lifecycle-script spawn → `EPERM`. Consequences, applied **identically to
the baseline and post-replay runs**:

1. **Install**: attempt 1 `pnpm install` linked all 1011 packages, then failed at the dependency
   lifecycle scripts (`koffi install`, `node-pty install` → spawn `EPERM`), exit 1. Attempt 2
   `pnpm install --ignore-scripts` → exit 0 (Done in 18m 32s), `pnpm-lock.yaml` untouched. The
   `koffi`/`node-pty` native bindings therefore stay unbuilt; any suite that loads them fails
   identically in both runs (recorded under baseline failures, §3).
2. **`pnpm run <script>` is unusable** (pnpm `runCmd_` spawns with pipes → `EPERM`). The repo's
   standard build/test commands were therefore invoked directly, step by step
   (`run-buildtest.ps1`): `tsc -b tsconfig.host.json` → `tsdown --env.DSH_BUILD_FACE host` →
   `tsc -b tsconfig.client.json` → `tsdown --env.DSH_BUILD_FACE client` → `vite build` in
   `apps/web` → `vitest run` — the exact script bodies of `build:lib:host`, `build:lib:client`,
   `build:web` and `test` from the root `package.json`.
3. **vitest pool**: the repo config sets `pool: 'forks'` per project; fork IPC is a pipe and is
   blocked, so both runs used the CLI override `vitest run --pool=threads` (worker threads, no
   pipes).
4. **`vite build` (build:web)** fails in this sandbox (vite 6 → esbuild service spawn `EPERM`).
   Recorded as an environmental failure; it fails identically in both runs and is excluded from the
   new-failure comparison.

## 3. Build + test: baseline vs post-replay

Command basis (identical for both runs, per §2.2–2.4): steps `tsc-host`, `tsdown-host`,
`tsc-client`, `tsdown-client`, `vite-web`, `vitest` (`--pool=threads`).

| Step | Baseline exit | Post-replay exit | Notes |
|---|---|---|---|
| tsc-host (`tsc -b tsconfig.host.json`) | 0 | 0 | |
| tsdown-host (`tsdown --env.DSH_BUILD_FACE host`) | 0 | 0 | |
| tsc-client (`tsc -b tsconfig.client.json`) | 0 | 0 | |
| tsdown-client (`tsdown --env.DSH_BUILD_FACE client`) | 0 | 0 | |
| vite-web (`vite build`, apps/web) | 1 | 1 | sandbox: esbuild service spawn EPERM (environmental, symmetric) |
| vitest (`vitest run --pool=threads`) | 1 | 1 | failure-set diff below |

Vitest failure-set comparison (tool: `compare-testlogs.mjs`; normalized identities = re-joined
`FAIL <file> > <test>` entries + duration-stripped `× <test>` names + unhandled-rejection messages,
set-diffed between the two logs):

- Baseline failed tests: **593** in 74 files (all environmental: subprocess spawn/exit `EPERM`
  suites — tool-ralph, lsp-stdio, workflow-worker-thread — Windows temp-dir `ENOTEMPTY` rmdir
  races, `SetNamedSecurityInfoW` Win32-5 ACL denials, `execFileSync('git')` `EPERM` in
  project-doc-site, 30 s subprocess timeouts, unbuilt `koffi`/`node-pty` native bindings; none in
  the test scope of the 10 replayed files).
- Post-replay failed tests: **594** in the same 74 files.
- **New failures in post-replay: 3 — all proven environmental; zero content-caused. Acceptance
  "no new failures" is met in the content sense (triage below).**
- Gone in post-replay: 2 (both environmental flakes that recovered on re-run).

Triage of the 5 set-diffing tests (full error text in the run logs):

| Test | State | Failure signature | Proof of environmental cause |
|---|---|---|---|
| `message-feedback.spec.ts > MessageFeedbackService item concurrency > drains admitted mutations before domain close and rejects later admission` | new | `ENOTEMPTY: directory not empty, rmdir <tmp>` | passes in the isolated post-state re-run (file 18/18 green) |
| `acl.spec.ts > ACL editing > dispose revokes the revocable temp ACE and keeps the standing workspace ACE (self-managed flow)` | new | `Win32Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite <tmp>` | fails **identically in the baseline-state isolated run** (10 replay files reverted, clean `cd5ef814` worktree): `acl.spec.ts` 5/9 fail with the same Win32-5 signatures → machine ACL environment, state-independent of the replay |
| `sqlite.spec.ts (session-persistence-sqlite) > PersistenceCoordinator orchestration: sqlite > persists a live session driven through the store, surviving reload` | new | `ENOTEMPTY: directory not empty, rmdir <tmp>` | passes in the isolated post-state re-run (✓ 16 ms) |
| `sqlite-backend.spec.ts (storage-sqlite) > sqlite backend specifics > drains a still-pending failed open during close` | gone | `ENOTEMPTY: directory not empty, rmdir <tmp>` | passes in the isolated post-state re-run (file 22/22 green) |
| `gen-third-party-notices.spec.ts > THIRD_PARTY_NOTICES.md > matches what the generator produces from the current manifests` | gone | `Test timed out in 5000 ms` | passes in the isolated post-state re-run (2672 ms; full-suite load pushed it past the cap in the baseline run) |

None of the 5 tests lives in a package touched by the replay. The only replayed functional files
are `session-persistence-jsonl/src/format.ts` and `scripts/translation-pairing.ts`; none of the 5
specs imports either. (`message-feedback` and `session-persistence-sqlite` do depend on
`@deepseek-ai/dsh-session-persistence-jsonl`, but in *other* spec files that passed in both runs;
their failing tests are temp-dir cleanup/ACL races, not scan/parse assertions, and the
`format.ts` delta only widens `SessionLogScanner` acceptance of backward-seq replacement events —
a no-op for the forward-seq data these suites write.)

## 4. Preservation check (step 5, scripted)

Script: `preservation-check.mjs` (committed with this evidence). Runs with no child processes and
no network:

- **Check 1 (byte preservation)**: for each of the 10 files — `blob(a3ab319 extraction) == recorded
  rev-parse identity` (extraction integrity) and `buffer(extraction) == buffer(host worktree file)`
  and `blob(host file) == recorded identity` (direct host-side confirmation). All 10 files are
  whole-file class, so byte comparison is the required granularity (no hunk comparison needed).
- **Check 2 (no reverse dependency)**: full-text scan of the Team worktree for the 10 DSH-relative
  paths (patterns P1–P10) and feature markers (F1–F9); skips `.git`, `node_modules`, `references/`,
  `docs/plans`, `.worktrees/`, build-output dirs, and the three read-forbidden files
  (`docs/ROUTER_RULES.md`, `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `dev/agent-workflow/graph.yaml`);
  hits bucketed `audit_record` (under `dev/agent-workflow/evidence/` — this audit's own records),
  `doc_reference` (other markdown), `code_or_config` (anything else — must be zero).

Result: **PASS** (run `2026-08-29T13:01:51.350Z`, after replay and before the post-replay run —
file bytes were stable throughout both runs). Check 1: **10/10 byte-exact** — for every file,
`blob(a3ab319 extraction) == rev-parse identity`, `host file bytes == extraction bytes`, and
`blob(host file) == rev-parse identity` (post-commit cross-check `git rev-parse HEAD:<path>`
reconfirmed all 10 after the commit, §5). Check 2: **scanned 25 files; 161 hits, all
`audit_record`** (this evidence's own provenance/audit records); `doc_reference` = 0;
`code_or_config` = 0 — the Team repo has no reverse dependency on the 10 fork features.

## 5. Commits

- Host: `74ac91e5f04d075eaa513edfa1831ca28be4e339` on `host/unrelated-features-20260829`
  (parent = base `cd5ef8148158c3a752a658978873241fdf8e2bbc`) — exactly the 10 replayed files
  (5 A + 5 M; 454 insertions, 8 deletions); `git status --porcelain` verified before commit
  (only the 10 staged, nothing else) and after (clean); `pnpm-lock.yaml` unchanged (no lockfile
  in the commit, per the P1-T1 lockfile rule). Post-commit `git rev-parse HEAD:<path>` for all 10
  equals the `a3ab319` blob identity (see `sha-mapping.json`).
- Team evidence: the single commit on `task/P1-T3-unrelated-preserve` (parent
  `c61a2f48714d418c31b05e2c0d42aa5ecf5db36e`) — `dev/agent-workflow/evidence/P1-T3/` only
  (`preservation-report.md`, `sha-mapping.json`, `preservation-check.mjs`,
  `compare-testlogs.mjs`). Its SHA is deliberately not written here: the report is inside the
  commit, so a self-reference is impossible; verify with
  `git log -1 --format=%H task/P1-T3-unrelated-preserve`.

## 6. SHA mapping

Per-file legacy→host identity mapping: `sha-mapping.json` (legacy blob @ a3ab319, host blob @
post-replay commit, content SHA-256, feature name, test evidence).
