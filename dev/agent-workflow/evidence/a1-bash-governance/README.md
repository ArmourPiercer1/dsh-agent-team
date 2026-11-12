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

## The seven clauses — run1 / run2 (the earlier tree, `0d74121ae`)

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

## The SECOND tree (the current tip) — runs 3 and 4

`origin/master` advanced after runs 1–2 to **`29e4b1b38626b264f70ad1428b42e1dfb2fa8361`**
(`F5-TWO-ASKS-PREFLIGHT: two governed asks per policy + shared boot preflight`,
#723). Because a rebase-only record would be dishonest, the SAME seven clauses
were re-run TWICE on that tip (fresh `DSH_HOME` each, same pinned host), and
runs 1–2 are kept untouched as the earlier-tree record.

**The delta between the two trees, measured** (`git diff --stat 0d74121ae 29e4b1b38`):
`#723` adds the `tests/kits/f5-two-asks/` driver, its evidence, one testkit
blueprint-fence pin line, and the fence baseline lines. It changes **no runtime
product code** — the ask path is MEASURED by that kit, not modified by it. The
A1 record therefore measures the same product law on both trees, which is
exactly what the re-run shows: identical verdicts, identical normalized details.

- branch: `task/a1-bash-governance-current-20261112` (a NEW branch off `29e4b1b38626b264f70ad1428b42e1dfb2fa8361`; the earlier-tree branch was not reused)
- measured tree sha: `32fa7d6d6e98ca3f5e4a35141846ca95fe13f2dd`
- blueprint content hash: `sha256:c31efec53d612e1154b932c590f9542773813fdb3f029c80ec4d1fcb410c4c32`
- OS sandbox backend: **`full`** (usable=True)

| clause | proposition | run3 | run4 | measured (run3 detail, world-specific values elided) |
|---|---|---|---|---|
| **A1-1** | a write INSIDE the Member root is allowed and its bytes are on disk | **PASS** | **PASS** | inside write allowed, file read back: 40 bytes, content equal, exit 0 |
| **A1-2** | a write OUTSIDE the Member ceiling is refused by the OS sandbox — zero bytes on disk | **PASS** | **PASS** | outside write refused (`Read-only file system`, exit 1); file absent after a real read (ENOENT, 0 bytes) |
| **A1-3** | the same Member keeps `cd` + `export` state across consecutive calls | **PASS** | **PASS** | 2nd call: `$PWD`=…/workspace/a1-sub, `$A1VAR`=a1-value, `marker.txt`=persisted-… |
| **A1-4** | a second Member cannot see the first Member's PTY state (own cwd, no export, different shell pid) | **PASS** | **PASS** | W2 own `$PWD`=…/workspace, `$A1VAR` empty, start-time differs, host PTY fds 1→2 |
| **A1-5** | a wrong or prefixed session id is refused BEFORE a PTY exists (no PTY fd, no turn, gate named) | **PASS** | **PASS** | `session/not-found` ×2 + `TEAM_REMOTE_FOREIGN_TEAM`; PTY fds 2→2, turns 45→45 |
| **A1-6** | with the Host default at danger-full-access the Member ceiling still narrows it (root writes, Member refused) | **PASS** | **PASS** | root write under `danger-full-access` = 41 bytes at DSH_HOME; Member write absent |
| **A1-7** | a DENIED approval produces zero native bash executions (no marker, no fact, no bytes) | **PASS** | **PASS** | deny-Member leg: `decision=deny`, 0 executions, 0 consumptions, 0 bytes, `the approval was denied` |

Agreement (runs 3↔4): `a1-agreement-current-tip.json` —
`verdictsAgree=True`, `detailsAgree=True`.

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

