# Exact-base comparison: root vitest and root lint, classified instead of labelled "debt"

Base control: `.worktrees/base-6b2f401b-control` = plugin `6b2f401bbc…` (the exact
parent of this branch) with its **own** `tests/deepseek-harness-test-use` cloned from
the shared baseline and detached at its own pin `46a7f68b09…` (0.1.7-rc.1), porcelain
clean. Its pin file is the base `tests/paths.mjs`, so the control measures the base
generation, not this one's tree with a different label.
Logs: `logs/base-vitest-the-10-failures-6b2f401b.log`,
`logs/base-vitest-…`/`logs/lint-base-6b2f401b-summary.log`,
`logs/root-vitest-current-e89063c8-plus.log`, `logs/lint-current-head-summary.log`.

## Root vitest

| | value |
| --- | --- |
| current HEAD | 5392 tests, **20 failed** in 10 files; 444 files pass |
| same 10 files at exact base | 76 tests, **19 failed** in 9 files; **1 file passes** |

Nine of the ten failing files fail **identically at the base**, with the base's own
0.1.7-rc.1 host tree, i.e. they are not host-upgrade regressions. Observed causes at
base and here alike (first error per file):

| file | first failure | note |
| --- | --- | --- |
| `domain/t1-capability-schema` | `$.metadata must be a plain object, got null` | contract validation in own fixtures |
| `domain/t2-blueprint-hash` | object has 6 keys, expected 5 | fixture drifted from the hash expectation |
| `runtime/d3-member-identity-context` | message mismatch (`…capability template u…` vs `fail closed`) | |
| `runtime/p6t3-mediation`, `runtime/p6t3-restart`, `tools/p6t6-actions` | `expected 'session-root-p6t1' to be 'session-child-p6t3-leader'` / `Cannot read properties of undefined (reading 'sessionId')` | seed/world coupling between P6T1/P6T2/P6T3 fixtures |
| `runtime/p8s3b-result-effects` | `agent-bindings: sessionPersistence.exists public seam is unavailable` | harness stub, same at base |
| `runtime/t12a-b2-child-identity` | `capability template unresolved … (reason=template-id-missing)` | |
| `runtime/t12a-glue-handoff-ports` | `blueprint document must start with a --- frontmatter delimiter line` | |

One file fails **only here**, and the reason is fully computed rather than assumed:

- `packages/testkit/test/p4t6-session-event-scan.test.ts` — `expected 964 to be 958`,
  and it **passes at the base**. It is a file-count tripwire over *our own* packages.
  Diffing the scanned sets between the control worktree and this tree gives **7 added,
  0 removed**, all seven being the `rc2-*` test files this PR adds
  (`rc2-kit-wire-shape`, `rc2-kit-fixture-invariants`, `rc2-kit-fault-injection`,
  `rc2-kit-pin-hygiene`, `rc2-kit-preset-seam`, `rc2-sanitize-evidence`,
  `rc2-team-deny-least-privilege`). The pin was moved 958 → **965** with that list
  recorded in the case title, exactly the convention every previous increment in that
  test follows; the assertion stays an exact equality. It was at 964 in the root run
  because two of the seven landed after that run.

Nothing in the ten files is called "debt" or skipped: nine are attributed to the base
(with their base-observed error), one is attributed to this PR and closed.

## Root lint (`eslint .`)

| | errors | warnings |
| --- | --- | --- |
| exact base `6b2f401b` | **132** | 32 |
| this HEAD, first measurement | 199 | 32 |
| this HEAD, after the fix below | **133** | 32 |

The recorded "132E/32W" figure in `02-gates-and-findings.md` was therefore the *base*
count — pre-existing, not this round's. The apparent +67 was a measurement artifact:
`eslint .` walks `.private-raw-evidence/` (and its `.sanitized-tmp/` working copy),
the **gitignored** raw-evidence mirror the sanitizer reads, and the base worktree has
no such directory. Three diagnostic probe scripts × two mirrors ≈ 67 errors. The fix
is an ignore entry for a gitignored scratch tree, next to the existing `references/**`
and `tests/**` entries; product lint coverage is unchanged, and the remaining delta is
one error, not 67.

The one real error is **not mine to fix**:

```
packages/tools/harness/mock-deepseek.mjs  62:28  no-useless-escape
```

`mock-deepseek.mjs` is in the frozen set (blob `6925ce78`, matching `e89063c8`) and is
owned by the independent patch, so it is reported here rather than edited. Same defect
class already fixed in `scripts/sanitize-evidence.mjs` (`[A-Za-z0-9._\-]` → `[A-Za-z0-9._-]`).

## Disclosure: two commands of mine ran in the wrong tree

While preparing the control I mis-pathed one command; it executed in
`/srv/workspace/dsh-plugins/dsh-agent-team` (the protected old root):

- `git -C tests/deepseek-harness-test-use checkout --detach 46a7f68b…` — a **no-op**:
  that tree was already detached at `46a7f68b09…` (reflog head is still the original
  clone; porcelain 0).
- `pnpm install --offline --ignore-scripts` — ran in the old root. It changed nothing
  tracked: old root is still `6259cf4b` with the **same 14 dirty lines** and no
  `pnpm-lock.yaml` modification.

Both facts were checked immediately after the mistake and are recorded here rather
than mentioned only in chat. A nested `git worktree add` from the same mistake was
removed with `git worktree remove --force` + `prune`; the pre-existing
`base-6b2f401b-control` worktree is the one used for the numbers above.

## Repeat runs at this head, because a number you cannot reproduce is not a signal

`4e2d7976`, three consecutive full root runs: **19 failed / 5380 passed (5399)**, with
identical per-file counts each time (`t1-capability-schema` 9, `p6t3-mediation` 5,
`p6t3-restart` 2, six files with 1). `logs/root-vitest-head-4e2d7976.log` is one of them.

One earlier run of the same commit reported **21 failed / 5378 passed** — two tests that
pass in all three recorded runs failed there, and that run's output was truncated by a
`tail -4` before it was logged, so the two names are lost. Most likely candidate is the
P6T3/P6T6 session-seed coupling visible in every one of these failures
(`expected 'session-root-p6t1' to be 'session-child-p6t3-leader'`: fixtures reading a
world another fixture writes). It is recorded as a single unreproduced observation with a
named suspect, **not** smoothed into "19 is stable". Any future claim of "no new failures"
must therefore be a per-file comparison over repeats, not a single total.

Base numbers in the table above come from a **10-file subset** run in the control worktree
(9 files failed, 19 of 76 tests failed); the coincidence of "9 files / 19" with this head's
whole-suite numbers is arithmetic luck, not a comparison of the same populations.
