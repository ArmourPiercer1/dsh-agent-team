# tests/ — test infrastructure (canonical layout)

Standardized 2026-09-12 (test-infra-standardization, user-directed). The
single source of truth for these locations is **`tests/paths.mjs`**; the
authoritative rules (ports, red lines, home protocol) live in
**`docs/TEST_METHODS.md`**.

| Path | Role | Tracked? |
|---|---|---|
| `tests/characterization/` | P2-era characterization harness (pristine-upstream boot probes, public-surface fixtures, private-import negative control) | yes |
| `tests/mock/` | Mock model / mini-MCP fixtures and historical evidence | yes (evidence files are records — never rewritten) |
| `tests/deepseek-harness-test-use/` | **Pristine upstream DSH checkout** — the only permitted runtime source for test instances. Its own git repo, pinned at `TEST_USE_BASELINE_SHA` (see `tests/paths.mjs`), porcelain must stay empty after every run. | **no** (gitignored) |
| `tests/homes/` | Per-world DSH_HOME dirs (world state + launch tokens) | **no** (gitignored) |
| `tests/kits/` | Reusable, line-agnostic test kits (see `tests/kits/README.md`) | yes |
| `tests/paths.mjs` | Single source of truth for test paths + baseline pin | yes |

## DSH_HOME naming protocol (`tests/homes/`)

- **Shared persistent home**: `.dsh-test` — pre-existing durable rows are
  preserved, never destroyed (d4/g5 harness convention).
- **Ephemeral worlds**: `<line>-<UTC stamp>` (e.g. `rmr-rev7-20260912T03-00-00Z`),
  one world per directory; deleted at teardown **unless** retained as
  evidence (then registered in the task's evidence dir).
- **Long-lived task homes**: `.dsh-test-<task>` (e.g. `.dsh-test-p8s3`);
  freshness rules belong to the consuming harness.
- **Lock files** live beside their home: `<home>.lock`.

Historical homes under `references/.dsh-test*` (if present on a machine that
ran the old layout) are **not migrated** — they are records of finished
worlds. New work always uses `tests/homes/`.

## Red lines (unchanged by the move)

- Port 3180 family only (3180-3186 / 3491-3500). **Never 3080** (stable
  instance; read-only probe at most).
- The test-use checkout stays pristine upstream: no dev content, no patches,
  porcelain clean before AND after every run.
- `references/deepseek-harness` (frozen legacy fork, tag
  `legacy-agent-team-pre-vnext`) is read-only evidence — never a runtime.
