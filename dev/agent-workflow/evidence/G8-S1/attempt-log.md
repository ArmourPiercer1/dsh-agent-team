# G8-S1 attempt log

Worker: G8-S1 (LEAF, no subagents), provider/model qiyuan-self/qwen3.8-27b.
Worktree: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G8-S1`,
branch `task/G8-S1-gate-supplement`, base `93d2a96e3ded6a92820f78ee9de94eac9ea6fffb`.
Every command below ran with the working directory explicitly set to this
worktree (pwsh `workdir`), per brief §8.

## Attempt 1 — S1-A verification (reads only, no runs, no code)

Reads (full coverage):

- Brief `dev/agent-workflow/briefs/G8-S1-brief.md` (all 112 lines, main repo).
- `packages/storage/schema/seam.ts` (130 ln) — public `StorageKvTable` /
  `DomainGlobal` / `Domain` surfaces; `update(key, fn)` = single-key atomic
  read-modify-write on the domain's write chain.
- `references/deepseek-harness-test-use/packages/storage/storage-domain/src/domain.ts`
  (read-only) — upstream `DomainImpl`: one write chain per domain; each write
  awaits backend durability FIRST, then mutates memory (every write is its own
  durable boundary).
- Full-package grep `transaction|batch|atomic|commit` over
  `packages/storage/**` — no batch/transaction/multi-record primitive exists
  (journal "COMMITTED" = operation-row state, not a storage primitive).
- `packages/storage/operations/journal.ts` (520 ln) — `applyPhase`
  (:336-383): effects → dedup ledger fact → COMMITTED row; `driveRow`
  (:392-400), `execute` (:407-430), `prepareInternal` (:264-286).
- `packages/storage/operations/types.ts` (220 ln) — frozen v1
  `OperationRecord` carries NO per-operation stamp-target field.
- `packages/storage/provisioning/coordinator.ts` (570 ln) — default journal
  has no effects (:245); `ensureMemberRecord` check-then-apply put (:540)
  BEFORE `journal.drive`; `recover` = roll-forward.
- `packages/storage/repositories/ledger.ts` (210 ln) — gap-tolerant sequence
  allocation via atomic `update` (the codebase's established non-idempotent
  increment pattern across durable boundaries).
- `packages/storage/repositories/base.ts` (`putRaw` :140, `putRecord` :157,
  protected `updateRaw` :180), `packages/storage/repositories/team-sessions.ts`
  (113 ln).
- Production writer enumeration: 33 call sites across
  `packages/runtime/**` + `packages/storage/**` (see design note §2, W1-W14 +
  W-T).
- `packages/runtime/admission/types.ts:120-189` — the real P6-T2
  `RuntimeActionEffect` closed union (8 kinds; discriminant `kind`).
- `packages/runtime/action-router/effects.ts` (587 ln),
  `packages/runtime/projection/fold.ts` (201 ln),
  `packages/runtime/projection/types.ts` (template rows from the bound
  immutable blueprint snapshot, invariant 10).
- `packages/remote/src/handlers/member.ts` (144 ln), `ports.ts` (358 ln),
  `contracts/response.ts` (213 ln), `dispatch.ts` (:166-169);
  `packages/remote/test/**` layout (p8t3-*, p8t4-*, remote.test.ts);
  p8t3-negative-scan rules (R1-R6, `packages/remote/src/**` only);
  p4t6 scanner denylist (`packages/testkit/fault-injection/session-event-scan.mjs:75-115`)
  and the 482-file pin (`packages/testkit/test/p4t6-session-event-scan.test.ts:161-162`).
- Docs (frozen, read-only): DevPlan §17.3 (crash model), §21.4 (push model),
  §21.5 (G8 criteria); Architecture §14.3/§14.4 (non-ACID TeamDomain).

Outcome: S1-A decision FINAL = BLOCKER:SPEC (design note §3-§4 carry the
commit-point analysis + crash-window argument + exact primitive gap). No
storage primitive makes a cross-table state write + stamp increment atomic;
the brief forbids inventing a new table or two-phase workaround; §4.2 req-2
escape clause + §4.4 + §9 mandate stop-and-report. S1-B scoped and started.

## Attempt 2 — S1-B pre-commit sanity (uncommitted tree; HEAD 93d2a96 + dirty)

S1-B edits made (4 files): `member.ts` (`admissionEffectSequence` → canonical
rule), `ports.ts` (doc), `p8t3-helpers.ts` (fixture → real
`fact-recorded` shape), `p8t3-round-trip.test.ts` (fixture assertion + new
S1-B suite, 4 `it`s, header note).

- RUN 2a: `node node_modules/typescript/bin/tsc -p packages/remote/tsconfig.json`
  → exit 2, 2 errors: TS2322 at `p8t3-round-trip.test.ts:453` (malformed
  fixture string vs `Record<string, unknown>`) and :467 (`Record<string,
  unknown>` not assignable to `RemoteSafeRecord`).
- Fix: typed the effect table `effect: RemoteSafeJsonValue` and
  `efxOutcome(effect: RemoteSafeJsonValue): RemoteSafeRecord` (types imported
  from `../src/index.js`).
- RUN 2b: tsc remote → exit 0.
- RUN 2c: full chain `node scripts/run-tests.mjs` (workdir = this worktree) →
  **1758 passed, 0 failed, 1758 total, 6980 ms; RESULT: PASS; exit 0.**
  (Includes p4t6 482-pin PASS, p8t3/p8t4 negative scans PASS, new S1-B suite.)

Scratch file `dev/scratch-filelist.txt` (untracked) DELETED before the commit.
Code committed: **`a5b418a`** — "G8-S1: S1-B align effect-sequence vocabulary
with the P6-T2 RuntimeActionEffect closed union (packages/remote)"
(4 files changed, 213 insertions, 12 deletions). Working tree clean.

## Attempt 3 — formal evidence runs (COMMITTED clean tree)

Proof header (printed verbatim before the runs):

```
proof-header:
  pwsh-cwd: D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G8-S1
  toplevel: D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G8-S1
  HEAD: a5b418a3ef60cc10c5b0148a0524535d5cf580a3
  status: 0 dirty paths
  ran-on: G8-S1 worktree, branch task/G8-S1-gate-supplement, base 93d2a96e3ded6a92820f78ee9de94eac9ea6fffb
```

- RUN 3a (chain): `node scripts/run-tests.mjs` (workdir = this worktree),
  full output saved to `run3-chain-clean-tree.txt` →
  **1758 passed, 0 failed, 1758 total, 6988 ms; RESULT: PASS run-tests
  (0 failures); exit 0.**
- RUN 3b (tsc ×6, separate args, each output saved to `run3-tsc-<pkg>.txt`):
  - `tsc -p packages/contracts/tsconfig.json` → exit 0 (0 output lines)
  - `tsc -p packages/domain/tsconfig.json` → exit 0 (0 output lines)
  - `tsc -p packages/storage/tsconfig.json` → exit 0 (0 output lines)
  - `tsc -p packages/runtime/tsconfig.json` → exit 0 (0 output lines)
  - `tsc -p packages/testkit/tsconfig.json` → exit 0 (0 output lines)
  - `tsc -p packages/remote/tsconfig.json` → exit 0 (0 output lines)

No Windows ENOTEMPTY flake occurred in any run; no testkit logic touched.

## Result

S1-A: BLOCKER:SPEC (no code, no tests). S1-B: DONE (commit `a5b418a`).
Frozen-region diff vs base `93d2a96`: only the four owned `packages/remote`
paths (code commit) + `dev/agent-workflow/evidence/G8-S1/**` (this evidence
commit). Nothing pushed; no other worktree/branch touched.
