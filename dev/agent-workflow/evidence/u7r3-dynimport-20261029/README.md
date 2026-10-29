# R-DYNIMPORT — computed dynamic-import blind spot closed (2026-10-29)

Task: external architecture review 2026-10-29 (R-DYNIMPORT). `scripts/eb3-family-boundaries.mjs`
extracted family import edges with regexes that saw ONLY literal specifiers —
`const p = './x.mjs'; import(p)` and `import(prefix + suffix)` were invisible to the
boundary audit. Seat disclosure: qiyuan-self/qwen3.8-27b (quota window).

Branch `task/u7r3-dynimport-20261029` + worktree `.worktrees/u7r3-dynimport`, off
`origin/master` @ `e0c60bc43`. 1 task = 1 branch = 1 worktree = 1 writer. Do not merge
(review-gated).

## What changed

- `scripts/eb3-family-boundaries.mjs` — the extractor is now a PARSER, not a pattern:
  - **Primary engine: acorn AST.** Edges are collected from `ImportDeclaration` /
    `ExportNamedDeclaration` / `ExportAllDeclaration` `source`, literal `require('…')`,
    and `ImportExpression`. A **non-literal `ImportExpression` is the new fail-closed
    finding `COMPUTED_DYNAMIC_IMPORT`** (file + line).
  - **acorn resolution (measured, disclosed):** bare `import('acorn')` from the repo
    root FAILS (`ERR_MODULE_NOT_FOUND` — pnpm does not put hoisted deps on the root
    resolution path), but acorn **is resolvable under node_modules** at pnpm's hoist
    directory `node_modules/.pnpm/node_modules/acorn` (v8.18.0, pulled in by
    eslint→espree and vitest→vite→rollup; `pnpm-workspace.yaml` pins `hoistPattern: '*'`).
    `loadAcorn()` tries bare resolution first, then that directory — so the AST path
    is live on this host AND on a CI `pnpm install --frozen-lockfile` host. The
    regex-plus-string-masking fallback remains fully implemented and is what grades
    `.ts`/`.d.mts` type surfaces (acorn parses plain JavaScript only) and any host
    where acorn cannot load; the summary line prints WHICH extractor graded the tree.
  - **Regex fallback now MASKS string literals** (contents blanked, offsets/lines
    preserved) BEFORE matching, so the prose-from-literal incident class
    (`"a zero-side-effect assertion must treat…" from 'x'` once graded as an import)
    cannot recur even on the fallback path.
  - **`COMPUTED_IMPORT_ALLOW`** — the closed booking table (exact `file` + exact
    expression text). Two occurrences EXIST in the current tree (the task brief
    expected a clean tree; it is not clean): the U6 ARC-A probe lane's
    seam-resolution law `await import(CENTER_URL)` (probe-assembly.mjs:24) and
    `await import(CONTRACTS_URL)` (probe-contribution.mjs:22) — env-overridable
    public-seam loads documented in both file headers and the lane README
    (vitest world = repo TS sources, Host world = shipped dist faces; a literal
    could pin only one world). Renaming either expression fails again (C4 4g).
- `scripts/eb3-ci-negative-controls.mjs` — C4 extended with the negative controls
  (the checker's own test coverage lives here; nothing under `tests/` or
  `packages/testkit` referenced this checker, and `scripts/**` is outside the
  p4t6 census scan — no booking needed):
  - 4d computed dynamic import → exactly 1 `COMPUTED_DYNAMIC_IMPORT`, line present;
  - 4e string literal containing `import('…')` / `from 'x'` → ZERO findings;
  - 4f ordinary static (unbooked) edge → still `FAMILY_CROSS_INFLUENCE`;
  - 4g booked allowlist is closed — `CENTER_URL` renamed → detected again;
  - engines-agree: honest tree + every fixture graded by EVERY available engine
    (`auto`, `ast`, `regex`) with identical verdicts. C4's honest set now mirrors
    `trackedLanePaths` exactly (packages/tools + tests lanes), so the booked rows
    are graded by the positive half too.

## Receipts (this directory)

| file | content |
| --- | --- |
| `RED-c4.txt` | C4 BEFORE the extractor fix: `4d MISSED, 4e LEAKED, 4g LEAKY` (RED confirmed first, TDD) |
| `GREEN-negative-controls.txt` | full `node scripts/eb3-ci-negative-controls.mjs` → **24/24** |
| `GREEN-spot-controls.txt` | 10 adversarial fixtures × both engines: multiline dynamic import, template-with-substitution → computed (was invisible to BOTH old extractor AND even a backtick-aware literal regex), static backtick spec, prose-with-quotes, `import.meta`, side-effect import, `export *`, `require()`, `Array.from(...)`, concat → ALL OK, ast/regex identical |
| `checker-auto.txt` / `checker-auto.json` | full checker run: **`files=82 findings=0`** (identical to the pre-change baseline captured on `origin/master` @ e0c60bc43) |
| `checker-ast.txt` / `checker-regex.txt` | forced-engine runs: **82/0 both** — behavior identical for the current 82 checked units |
| `GREEN-edge-parity-per-file.txt` | per-file edge-multiset parity old-vs-new (see next section): `diffs = 0 over 82 files x 2 engines` |
| `spot-controls.mjs` | the adversarial fixture script (reproducible: `node dev/agent-workflow/evidence/u7r3-dynimport-20261029/spot-controls.mjs` from the worktree root) |
| `edge-parity.mjs` | the per-file parity script (usage in its header) |

## Behavior-identity proof (beyond 0-findings-on-green)

Old extractor vs each new engine, PER FILE over all 82 units, with an empty edge
list so EVERY real edge becomes a finding (edge-multiset diff of `detail` strings):
`per-file edge-parity diffs = 0 over 82 files x 2 engines`. The 0-findings runs
alone could hide canceling errors; the per-file edge diff cannot. Reproduce with
`edge-parity.mjs`.

## Other gate notes

- `git diff --check` clean; `npx eslint` on both touched scripts: 0 problems.
- `node scripts/eb3-ci-required.mjs`: pass workflows=9 findings=0 (no workflow touched).
- No `package.json` / lockfile change: acorn is consumed as a toolchain-resident
  module via the hoist-dir probe, per the task's "if genuinely unresolvable under
  node_modules fall back" clause — here it IS resolvable under node_modules
  (pnpm hoist dir), and the fallback exists and is tested regardless.
- p4t6 census: unaffected (scan universe is `packages/**` test files; this round
  adds no file under `packages/`).
