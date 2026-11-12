# A1 bash-governance — the negative-control acceptance

A real-Host acceptance for **A1: the governed shell lane actually governs**. It
answers the question the joint acceptance's `J04` arm could not: J04 proved the
model-visible `bash` definition is the PINNED one and that a body executed; it
did not prove the body ran on the Member-bound PTY under the OS sandbox, nor
that the boundary refuses anything. `J04` stays where it is — the joint record's
**functional** arm — and this kit is the dedicated measurement.

## What it measures (seven pre-registered clauses)

Every clause is computed from what the OS and the durable ledger say: a real
`read`/`stat` of a file, a shell's own `$PWD`/`$TZ`-class state, the Host
process' open PTY fds (`/proc/<pid>/fd`), a typed refusal code, a ledger row.
None is a boolean the driver chose.

| clause | proposition | measured from |
|---|---|---|
| **A1-1** | a write INSIDE the Member root is allowed | the file read back: bytes + size equal the written payload; the tool result reports exit 0 |
| **A1-2** | a write OUTSIDE the Member ceiling is refused by the OS sandbox, ZERO bytes | a real read AFTER the refusal (`ENOENT`) plus the shell's own `Read-only file system` + exit 1 |
| **A1-3** | the same Member keeps `cd` + `export` state across consecutive calls | call B prints `$PWD`, `$A1VAR`, and `cat marker.txt` written by call A; all three must match |
| **A1-4** | a second Member cannot see the first Member's PTY state | the second Member's `$PWD` is its own, `$A1VAR` is empty, its process start-time differs, and the Host's PTY fd count GREW (a distinct shell) |
| **A1-5** | a wrong/prefixed session id is refused BEFORE a PTY exists | three typed refusals (`session/not-found` ×2, `TEAM_REMOTE_FOREIGN_TEAM`); Host PTY fds and the model-turn count are UNCHANGED (pre-creation) |
| **A1-6** | the Host's `danger-full-access` default is NARROWED, not inherited | the ROOT agent writes the same out-of-workspace file successfully (bytes on disk), while the Member's identical write stays refused |
| **A1-7** | a DENIED approval = ZERO native bash executions | the ledger row for that leg: `decision: deny`, zero `control-execution-result`, zero `control-allow-consumed`; the target file is absent |

## The composition it measures

One `schemaVersion: 5` Team carrying **both** `memberIoCeilings` (read/write
restricted to the kit workspace) and `reviewRouting` (Officer;
`whenOfficerUnavailable: hold`) on the SAME document; the shipped governed
Member preset; the plane takeover that adopts the PINNED native `bash` over the
governed PTY; the pinned host `0.2.0-rc.2 @ 639ed01539`. The Host is booted with
`DSH_PERMISSION_MODE=danger-full-access` so A1-6 faces a genuinely full-access
default.

## What this kit does NOT claim

- **No read-scope admission clause.** The governed PTY path carries **no PD-13
  lexical read allowlist**; read scope on this path rests on the OS profile
  alone (bwrap masks are not a complete read allowlist). A clause asserting
  lexical read admission would be measuring the profile, not the product's gate,
  so none is claimed. This is the limit the external review named.
- **Not a `V@B`, never CANDIDATE-C2.** Every run is `DEV-LIVE`
  (`osLevelNetworkIsolationClaimed: false`).
- **Not a stability measurement.** Two runs are agreement, not stability.
- **The OS backend is recorded, not assumed.** Each run writes the shipped
  provisioner's own `--check` output (`a1-sandbox-backend.json`) and names the
  backend (`full` = landlock launcher present and usable on this host). A
  host-free test with a recording provider would measure the POLICY handed to
  `sandbox.confine`, not the OS; this kit refuses that substitution, and an
  unusable provider is `ENV_BLOCK`, never PASS.

## Run it

```bash
node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3187 --mock-port 3496 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/a1-bash-governance/a1-run1"

node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree "$PWD" --testuse "$PWD/tests/deepseek-harness-test-use" \
  --host-port 3188 --mock-port 3497 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/a1-bash-governance/a1-run2"

node tests/kits/a1-bash-governance-20261112/compare-a1-runs.mjs \
  <run1-dir> <run2-dir> a1-agreement.json
```

`compare-a1-runs.mjs` requires the VERDICT to agree exactly for every clause and
compares the measured detail after normalizing only what necessarily differs
between two worlds (run stamp, home suffix, ids, paths, hashes, wait ms).

## The tree the recorded runs measured

`origin/master` tip `0d74121ae` (the branch `task/a1-bash-governance-20261112`
is a NEW branch off that tip — the joint kit's branch was not reused). The host
is the pinned `0.2.0-rc.2 @ 639ed01539`; both runs report the OS backend as
`full` (usable). The measured tree sha and the blueprint content hash are in
`a1-verdicts.json` under `tree`, and in the evidence README.

## The two measured records

`dev/agent-workflow/evidence/a1-bash-governance/` — `a1-run1/`, `a1-run2/`,
`a1-agreement.json`, and the README that names the tree and the seven-row table.

## Notes on the instrument

- The Officer is a real model turn resolved through the production
  `team_resolve_control` tool. A1-7's DENY is chosen by the mock model inside a
  window the driver arms immediately before the deny delegate and closes once
  the row is decided; the driver then asserts the measured row BELONGS to the
  deny Member, so a stray decision on another Member's leg fails the clause
  instead of hiding inside it. (The wake notification carries only the
  requestId, so the decision cannot be routed by the command text.)
- A1-4's shell pid (`$$`) reads `2` for both Members because each PTY runs in
  its own PID namespace; the clause therefore uses host-side PTY fd growth and
  the process start-time, and discloses the namespace-local pid in the detail.
