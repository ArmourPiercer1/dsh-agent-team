# Recovery (EB4-C)

**State: `DELIVERED` for the read/verify/restore drills below; the history-moving steps are `UNRUN`
on purpose.** Every command marked with an observed result was run in the `u7-3` worktree at
`origin/master` (`f71159648`). Anything that rewrites shared history, moves the authority pointer or
deletes a world is written down and marked `UNRUN` with the reason — those are approval-gated
operations, not cold-start steps.

Use this page when a step in [INSTALL-COLD-START.md](./INSTALL-COLD-START.md) fails, or when the
tree is not the thing you think it is. Release-line recovery (master vs stable, RC fixes) lives in
[RELEASE.md](./RELEASE.md). Plugin/profile troubleshooting stays in
[docs/INSTALL.md §6](./INSTALL.md).

## 1. First: what state am I in?

Run these before changing anything. All are read-only.

| Question | Command | Observed here |
| --- | --- | --- |
| Which commit, which branch? | `git status --short --branch` · `git log --oneline -1` | clean, on the task branch |
| Is the worktree secretly sparse? | `git sparse-checkout list` | `fatal: this worktree is not sparse` (good) |
| Which current authority? | `node scripts/current-authority.mjs status` | `ok:true`, `POINTER`, snapshot `as20261026r1`, `two_current_findings: []` |
| Is the test host pristine? | `git -C tests/deepseek-harness-test-use status --porcelain` and `rev-parse HEAD` | empty; `639ed015397290b3745d163aafe02ffee4aa3f84` = `tests/paths.mjs` pin |
| Does the gate agree? | `node scripts/ci-pr-gate.mjs` | `DSH-CI-VERDICT pass pass=7 fail=0 skip=1 skipped=census` |

A sparse worktree silently hides tracked files (U3 measured this; see
[docs/TEST_METHODS.md §8](./TEST_METHODS.md)). If `git sparse-checkout list` prints patterns, run
`git sparse-checkout disable` in that worktree before trusting any gate.

## 2. Symptom → recovery

| Symptom | Cause | Recovery (run) |
| --- | --- | --- |
| `pnpm install` → `ERR_SQLITE_ERROR: unable to open database file` | default pnpm store is outside the sandbox (`$HOME`) | `pnpm install --frozen-lockfile --offline --store-dir <in-workspace store>` — observed exit 0 |
| `DSH-ARTIFACT-VERDICT … verdict=stale` | a source change was committed without its rebuilt install-surface artifacts | `pnpm setup` then commit the rebuilt `packages/runtime/dist` + `packages/client/composition-shim` in the SAME commit; confirm with `pnpm check:artifacts:head` (observed `verdict=ok drift=0`) |
| `STALE_GENERATED_VIEW` from `docs:sync --check` | `dev/engineering/current-state.json` or the contract INDEX is out of date | `node scripts/docs-sync.mjs --write` — writes **derivatives only**, refuses normative paths; observed here as a byte-verified no-op |
| `REFUSED BASE_UNRESOLVABLE` from `docs:probe` | `--base` names a ref this clone does not have | `git fetch origin master` then rerun; never pass `--worktree-only` to dodge a real base |
| census `REFUSED before spawning vitest` | `tests/deepseek-harness-test-use` absent | the refusal is correct; materialize the host per [TEST_METHODS §1](./TEST_METHODS.md) or run the gate without `--full`. Do **not** add `--allow-refused census` to make a PR green |
| `POINTER_*` / `TWO_CURRENT_AUTHORITY` | authority pointer invalid, or pointer + legacy `current_contract` block both present | read-only: `node scripts/current-authority.mjs status`. Repair is an authority transaction — see §4 (UNRUN) |
| `lint-identities` reports `new N` | a new ESLint identity vs the recorded baseline | fix the new diagnostic; `pnpm lint` red at master is the disclosed baseline, not a licence |
| a refusal you cannot place | — | [DIAGNOSIS-CALL-CHAIN.md](./DIAGNOSIS-CALL-CHAIN.md): `node scripts/diag-call-chain.mjs --text '<refusal line>'` |

## 3. Evidence relocated out of the tree (U3)

20,148 historical evidence files were moved out of the tracked tree into a local content-addressed
store (index: `dev/agent-workflow/evidence/RELOCATED-MANIFEST.tsv`). Tool:
[scripts/evidence-store.mjs](../scripts/evidence-store.mjs).

```bash
node scripts/evidence-store.mjs verify
# verify verdict=pass entries=20148 bytes_ok=521862486 findings=0        (observed, exit 0)

node scripts/evidence-store.mjs restore <manifest path> --to <scratch dir>
node scripts/evidence-store.mjs restore <manifest path> --to <scratch dir> --from-git
```

Restore drill, observed on the first manifest entry into a scratch dir under `.artifacts/tmp/`:

* store restore → `RESTORED`, exit 0;
* the same restore again → `FINDING EXISTS … restore never overwrites`, exit 1 (exclusive create);
* `--from-git` restore into a second scratch dir → exit 0, and `cmp` says the store bytes equal the
  git-history bytes; sha256 matches the manifest column.

Git history is the durable fallback: if the local store is lost, `--from-git` restores any manifest
entry from `git cat-file blob <oid>`. The store is local and temporary by user ruling; it is not a
release artifact. Scratch dirs were removed after the drill.

## 4. History-moving recovery (UNRUN — approval-gated)

These are written down so nobody improvises them. **None was run here.** Each needs an explicit
authorization recorded in `dev/agent-workflow/SESSION_ROUTER_LOG.md` before it is attempted.

| Operation | Command shape | Why UNRUN |
| --- | --- | --- |
| Roll back the authority switch | `git revert <switch commit set>` on a task branch, reviewed as a PR | moves the single current authority; [dev/engineering/README.md](../dev/engineering/README.md) is the procedure; never via the derived view |
| Move the authority pointer forward | `node scripts/publish-authority.mjs …` then `node scripts/switch-authority.mjs --expect-pointer-digest <sha256:…> …` | the only writers of snapshot/pointer; byte precondition + atomic write + exact restore on failure; out of this lane's scope |
| Revert a merged PR | `git revert -m 1 <merge sha>` on a task branch, then PR | shared history; normal PR flow, never a force-push |
| Delete a test world | remove `tests/homes/<world>` | an impact-surface operation that must be recorded in evidence ([TEST_METHODS §7](./TEST_METHODS.md)); never `.dsh-test` (durable) |
| Remove a finished worktree | `git worktree remove .worktrees/<task>` | only the task's own writer, after merge; never someone else's worktree |

Forbidden in recovery, always: force-push of gated history, editing
`dev/engineering/current-authority.json` or a snapshot by hand, touching port 3080 or `~/.dsh`,
patching the pristine host (`CORE PATCH BUDGET = 0`).
