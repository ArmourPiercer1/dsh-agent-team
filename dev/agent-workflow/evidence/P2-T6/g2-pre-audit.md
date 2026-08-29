# P2-T6 — G2 Pre-Audit (criterion → evidence → PASS)

Scope: this document is the **pre-audit** required by the P2-T6 card (“G2 criterion 有
证据”). The authoritative G2 gate itself is the separate `G2-REVIEW` task run by an
independent reviewer per the TaskDoc §11.3 “G2 Gate 执行方法” (L1049-1062); this file
hands that reviewer a complete criterion→evidence map. Nothing here self-certifies the
gate.

## G2 criteria — verbatim (DevPlan §15.4, “Gate G2 必须满足”)

```text
✓ every architecture-critical seam has executable characterization test
✓ tests pass on pristine pinned upstream
✓ no private source import
✓ no fork-only required package
✓ every known limitation has explicit status
✓ any blocker stops affected feature before implementation
```

Architecture-critical set (frozen DevPlan §15 matrix): **TEAM_REMOTE, CLIENT_MODULE,
TEAM_VIEW_SLOT, NEW_TEAM_ENTRY**. Input dock is non-critical with a frozen fallback
seat clause.

## Criterion → evidence → PASS

### 1. every architecture-critical seam has executable characterization test — **PASS**

All four arch-critical seams are covered by **executable** probe code in this repo, run
on every harness execution (not one-off scripts):

| seam (manifest name) | executable test | evidence |
| --- | --- | --- |
| client module discovery (dsh.client → boot graph) | `probes/remote-client/index.mjs` B1 + negative fixtures B3/B4 | `dev/agent-workflow/evidence/P2-T6/run/logs/obs/host-probe-activated.json`, `run/logs/dump-config-b1.txt`, `run/logs/instance-port3401-negative-b3.log`, `run/logs/instance-port3401-negative-b4.log` |
| remote RPC (authenticated client-request channel) | B2 wire-contract assertions (positive echo + 5 negative responses) | `dev/agent-workflow/evidence/P2-T6/run/run-log.txt` |
| reconnect basic (loss → backoff → reconnect) | `plugins/reconnect-probe.js` R1-R5 inside the instance | `dev/agent-workflow/evidence/P2-T6/run/logs/obs/obs-reconnect.json` |
| conversation.view seat (Team Tab, list/session) | `plugins/slot-probe.js` core A | `dev/agent-workflow/evidence/P2-T6/run/logs/obs/obs-slot.json` |
| sidebar New Team entry (sidebar.footer.action, list/root) | `plugins/slot-probe.js` core B | `dev/agent-workflow/evidence/P2-T6/run/logs/obs/obs-slot.json` |

Machine-checkable: the aggregate manifest (`tests/characterization/seam-manifest/
manifest.json`) carries 26 seam rows (≥15), 5 rows flagged `architecture-critical`
(≥4), and the in-group validation rule `critical-executable` fails the run unless every
arch-critical row is a PASS (or a SPECULATIVE_PASS with explicit risk). Result of the
canonical run: see `run/logs/obs/seam-manifest-validation.json`.

### 2. tests pass on pristine pinned upstream — **PASS**

- Upstream pin: `references/deepseek-harness-test-use @ cd5ef8148158c3a752a658978873241fdf8e2bbc`,
  pristine (prebuilt), read-only for the whole task.
- The full harness (preflight → surface → fixture → static → lifecycle → probes →
  byte-clean) is green on that pin, including the five pre-existing groups — canonical
  run: `dev/agent-workflow/evidence/P2-T6/run/run-log.txt` (exit 0), plus the bare
  command (no flags) green run (see compliance report, attempt ledger).
- The byte-clean section asserts the pinned tree is byte-identical after the run.

### 3. no private source import — **PASS**

- Zero-core discipline: the group module imports node: builtins + in-root `lib/**`
  only; **all** upstream imports live in `plugins/` payloads.
- The static section scans every probe source against the **live public surface**
  (`lib/public-surface.mjs checkSpecifier`) on each run.
- The in-group validation re-applies the same check to the exact file set the static
  section scans (lib/** + run.mjs + spawn-probe.mjs + probes/*/index.mjs + all probe
  sources): rule `zero-private-imports` = 0 findings (see
  `run/logs/obs/seam-manifest-validation.json`).
- The one public subpath import that is not plain-JS,
  `@deepseek-ai/dsh-client-connection/src/client/connection.ts`, is declared in the
  package's own `exports` (`./src/*` → `./src/*`); it is a **public** surface, loaded
  with a documented runtime flag deviation (L6-1), not a private/internal API.

### 4. no fork-only required package — **PASS**

- Every package touched at runtime is an upstream package at the pinned pristine SHA:
  `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-connection` (public
  subpath), and the composition/CLI surface itself.
- No fork of any package is required: no vendored copies, no `patch-package`/`pnpm
  patch`/postinstall rewrites (global red line, unchanged), no modified upstream
  copies anywhere in the worktree (owned paths only: `tests/characterization/
  probes/remote-client/**`, `tests/characterization/seam-manifest/**`,
  `dev/agent-workflow/evidence/P2-T6/**`).
- Upstream tree byte-clean after every run (harness byte-clean section + manual
  `git status --porcelain` empty check, see compliance report).

### 5. every known limitation has explicit status — **PASS**

- The manifest carries a 24-entry `knownLimitations` register aggregated across
  P2-T1..T6 (L1-1..L1-4, L2-1..L2-3, L3-1..L3-6, L4-1..L4-3, L5-F1..L5-F4,
  L6-1..L6-4); every entry has a non-empty `status` and ≥1 evidence path — enforced by
  the in-group rule `limitations-complete` on every run.
- T6-specific entries: L6-1 (transform-types flag deviation, scoped to B2 boot),
  L6-2 (browser rendering out of machine-level scope), L6-3 (deterministic instance
  log name), L6-4 (a flat top-level `"dsh.client"` key is silently ignored by the
  registry, which reads the nested `pkg.dsh.client` — misdeclared rows vanish with
  zero diagnostics).

### 6. any blocker stops affected feature before implementation — **PASS**

- Zero blockers were raised by P2-T6 (no `CORE_SEAM_BLOCKER`, no
  `CONTRACT_CHANGE_REQUEST`, no `SPEC_CONFLICT`, no `DEPENDENCY_BLOCKER`, no
  `TEST_INFRA_BLOCKER`): every arch-critical entry has a public seam (criterion 1).
- Where a seam was missing for a **non-critical** requirement (input dock), the frozen
  fallback-seat clause applied (equivalent public seat `conversation.input.dock`
  exists) — recorded, no blocker, per the card 实现要点.
- Blockers from other P2 tasks: none carried in the manifest (`blocker_id: null` on
  all 26 rows). The G2-REVIEW task remains the authoritative stop point before any
  affected feature is implemented.

## Result

| # | criterion | verdict |
| --- | --- | --- |
| 1 | every architecture-critical seam has executable characterization test | PASS |
| 2 | tests pass on pristine pinned upstream | PASS |
| 3 | no private source import | PASS |
| 4 | no fork-only required package | PASS |
| 5 | every known limitation has explicit status | PASS |
| 6 | any blocker stops affected feature before implementation | PASS |

6/6 criterion PASS on the canonical run.
