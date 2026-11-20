# UTE-3 evidence — the machine-checkable family inventory (2026-11-20)

Branch `task/ute3-inventory-20261120`, worktree
`.worktrees/ute3-inventory-20261120`, base `origin/master 35b59ca3c`.
Self-contained transcripts; every command below was run from the worktree root.

| file | what it is |
|---|---|
| `inventory.txt` | `node scripts/ute-family-inventory.mjs` — the per-family verdict and the summary line (exit 0). |
| `inventory-json.txt` | The same run with `--json` (machine payload; used by the required leg and by consumers that need per-step detail). |
| `mutations.txt` | `node --test scripts/ute-family-inventory.test.mjs` — 35 tests. Each mutation edits an in-memory clone of the committed ledger (or the tracked-file set) and requires the NAMED refusal to fire; the last test prints `UTE-INVENTORY-MUTANTS total=N red=N` and fails when `red < total`, so the line cannot be hand-written. |
| `ci-leg-law.txt` | `node scripts/eb3-ci-required.mjs` + `node scripts/eb3-family-definitions.mjs` + the manifest leg and workflow line that carry them. |
| `manifest-delta.txt` | The ONLY CI-shape change in this PR: the suite is collected on the EXISTING `ci-census` "next host lane" leg (one `check[]` token, one byte-identical workflow token). Also the element-by-element equality proof. |
| `required-leg-bites.txt` | The required leg made RED on purpose (one member renamed in the committed ledger, then restored byte-identically): `INVENTORY_MEMBER_DRIFT` … `findings=1`, exit 1; then pass again. This is the proof the required wiring is not decorative. |
| `gates.txt` | Every local gate, verbatim, with exit codes (inventory, family definitions, ci-required, boundaries, docs-sync, artifacts, `git diff --check`, `node --check` ×3, `git status`). |

Notes.

- `required-leg-bites.txt` copies the ledger to a scratch file under this directory
  and restores it; the scratch file was deleted afterwards, and the transcript shows
  `cmp … restored-byte-identical` plus the clean re-run. Nothing is left mutated.
- `mutations.txt` also contains the positive controls (member order is irrelevant;
  an explicitly declared `shared` file with a reason satisfies the universe rule)
  and the parser specimens (comments / string literals / template literals cannot
  fake an import; the probe lane's `new URL(..., import.meta.url)` seams are read).
- The suite is host-free and dependency-free by construction: its import graph is
  `node:` builtins only (`scripts/ute-family-inventory.mjs` →
  `scripts/ute-retirement-gate.mjs`; `scripts/eb3-family-definitions.mjs` →
  `packages/testkit/test/arc-a-fitness/scan.mjs`), so it needs no `pnpm install`
  and no repo build — which is why the census lane can run it before
  `Build this repo` (the UTE-1 `ERR_MODULE_NOT_FOUND` trap does not apply here).
- The inventory is **not** a retirement licence: `scripts/ute-retirement-gate.mjs`
  owns `RetireAllowed`. See `docs/plans/memo/ute-g1-20261120/INVENTORY.md` §5 for
  what this evidence does not prove.
