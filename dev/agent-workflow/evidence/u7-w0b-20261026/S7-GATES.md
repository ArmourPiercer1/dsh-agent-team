# S7 — gates (head af49450ea + this evidence commit; no product change after af49450ea)

| Gate | Result | Receipt |
| --- | --- | --- |
| `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store --full --census` | **PASS 8/8** (graph-parse, state-freshness, install, blueprint-fence, typecheck, lint-identities, artifacts-at-head, census) | `s7-ci-pr-gate.log` |
| typecheck (`pnpm -r run typecheck`) | clean | `s7-typecheck.log` |
| `lint-identities --diff …lint-identities-0237d487.txt` | new 0, resolved 0 | `s7-lint-identities.log` |
| docs:probe `--base origin/master` | blocking 0 (2 advisories: owner docs — runtime + tools README updated) | `s7-docs-probe.log` |
| docs:sync `--check` | findings 0, blocking 0 | `s7-docs-sync.log` |
| dist mirror (`place-dist-glue.mjs`, drop-in `060-u7w0b-family-seam.json`) | 45 placements, check-artifacts OK | gate leg artifacts-at-head |
| artifacts-at-head | HEAD carries its own build, drift 0 | gate leg |
| `gen-family-index --check` | OK, 3 reviewed families | F2 in `u7-w0b-family-seam.test.ts` |

How the census leg got to green, disclosed in order (no flags, no
`--allow-refused`):

1. run 1: census REFUSED — this worktree had no `tests/deepseek-harness-test-use`.
2. run 2 (unbuilt pristine clone at 639ed01539): 8 new reds, all host-build
   dependent — `plugin-dsh-compat` imports the host's built `app-boot/lib`, and
   the merge-gate composition-smoke arm needs `packages/client/dist`
   (gitignored, in no install surface).
3. provisioned: the worktree's test-use = a copy of the main checkout's BUILT
   pristine host (HEAD 639ed01539, porcelain empty, verified), and
   `packages/client` built locally (gitignored output only). run 3: 1 new red —
   `team-session-activation.test.ts` A15 "one absolute deadline … ≈ timeout,
   not 2× timeout", a wall-clock bound under full-suite load; the file and its
   lanes are untouched by this branch (`git diff 88107ad71` empty) and it passes
   3/3 isolated. (`s7-ci-pr-gate-run3.log`)
4. run 4: **PASS 8/8** (`s7-ci-pr-gate.log`). The A15 timing red is load-
   sensitive and intermittent; recorded, not masked.

Census scratch JSONs written by the gate under
`dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/` are left untracked per that
directory's UNTRACKED-SCRATCH.md.
