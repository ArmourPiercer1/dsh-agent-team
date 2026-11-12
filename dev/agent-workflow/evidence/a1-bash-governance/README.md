# A1 bash-governance — the negative-control acceptance, two runs

The joint acceptance's `J04` arm proved the model-visible `bash` definition is the PINNED one and that a body executed. It did not prove the body ran on the Member-bound PTY under the OS sandbox, nor that the boundary refuses. This record is the dedicated measurement of that gap. `J04` is untouched and remains the joint record's FUNCTIONAL arm (see `../joint-acceptance/README.md`); this kit is a separate, stricter, NEGATIVE-CONTROL acceptance, not a re-labelling.

Kit: `tests/kits/a1-bash-governance-20261112/` (`a1-bash-governance.mjs`, `compare-a1-runs.mjs`, `README.md`).

## The tree these runs measured

- branch: `task/a1-bash-governance-20261112`
- measured tree sha: `0d74121aedb7dd9f7814fe4a0644858fd5724cbf`
- `origin/master` tip at run time: `0d74121aedb7dd9f7814fe4a0644858fd5724cbf` (the branch is a NEW branch off that tip; the joint kit's branch was not reused)
- pinned host: `0.2.0-rc.2 @ 639ed01539` (from `tests/paths.mjs`)
- blueprint content hash: `sha256:17e44288a0a59a01a3cc57221a2d74a3d4c5466dd6b4a89ac3e2dd898e1e61cb` (identical in both runs)
- OS sandbox backend actually in use: **`full`** (usable=True), from the shipped provisioner's own `--check` (`a1-run1/a1-sandbox-backend.json`)

## The seven clauses — run1 / run2

| clause | proposition | run1 | run2 | measured (run1 detail, world-specific values elided) |
|---|---|---|---|---|
| **A1-1** | a write INSIDE the Member root is allowed and its bytes are on disk | **PASS** | **PASS** | inside write allowed, bytes on disk (size 40, content equal) |
| **A1-2** | a write OUTSIDE the Member ceiling is refused by the OS sandbox — zero bytes on disk | **PASS** | **PASS** | outside write refused by the OS (`Read-only file system`), file absent after a real read (ENOENT, 0 bytes) |
| **A1-3** | the same Member keeps `cd` + `export` state across consecutive calls | **PASS** | **PASS** | `$PWD`=…/workspace/a1-sub, `$A1VAR`=a1-value, `marker.txt`=persisted-… in the SECOND call |
| **A1-4** | a second Member cannot see the first Member's PTY state (own cwd, no export, different shell pid) | **PASS** | **PASS** | W2 `$PWD`=…/workspace (own), `$A1VAR` empty, start-time differs, host PTY fds 1→2 |
| **A1-5** | a wrong or prefixed session id is refused BEFORE a PTY exists (no PTY fd, no turn, gate named) | **PASS** | **PASS** | `session/not-found` ×2 + `TEAM_REMOTE_FOREIGN_TEAM`; PTY fds 2→2, model turns 45→45 |
| **A1-6** | with the Host default at danger-full-access the Member ceiling still narrows it (root writes, Member refused) | **PASS** | **PASS** | root write under `danger-full-access` lands 41 bytes at DSH_HOME; the Member's identical write stays absent |
| **A1-7** | a DENIED approval produces zero native bash executions (no marker, no fact, no bytes) | **PASS** | **PASS** | the deny-Member leg: `decision=deny`, 0 executions, 0 consumptions, 0 bytes, tool said `the approval was denied` |

Agreement file: `a1-agreement.json` — `verdictsAgree=True`, `detailsAgree=True` (details compared after normalizing only the run stamp, home suffix, ids, hashes, paths and wait ms).

## What is NOT claimed

- **No read-scope admission clause.** The governed PTY path carries **no PD-13 lexical read allowlist**; read scope there rests on the OS profile alone. A lexical-read clause would be measuring the profile, so none is claimed — the kit, its README and this record all say so.
- **Not `V@B`, never CANDIDATE-C2.** Both runs are `DEV-LIVE`, `osLevelNetworkIsolationClaimed: false`.
- **Two runs are agreement, not stability.**
- **Clause 5 is the admission gate, not the in-process one.** The model cannot forge an owner session id, so the `expectBoundOwner` gate inside `packages/runtime/team-services/src/terminal-pty.ts` (`PTY_OWNER_MISMATCH`) is unreachable from the model side on a real Host; what is measured is that the RPC layer refuses a suffixed/truncated/prefixed session id BEFORE any PTY exists (typed refusals named in the row, plus unchanged PTY fds and model-turn count). Both gates are named in the kit.

## Gates run on this tree before the commit

- `npx vitest run packages/runtime/test/u6-arc-a-fitness.test.ts` — 12/12 PASS
- `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` — 20/20 PASS
- `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` — `76 distinct; new 0, resolved 0`
- `node scripts/verify-blueprint-version-clean.mjs` — no new and no gone offender lines against `dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt`

