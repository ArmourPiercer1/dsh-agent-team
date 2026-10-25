> **Tracked copy (2026-10-26, FIX-D / external-audit finding D3).** Verbatim copy of `dev/agent-workflow/evidence/u2-g2-review-r1/REVIEW.md`
> (local evidence, untracked at copy time). Content below unchanged; the machine-checkable index of what
> these records say is [./GATE-LEDGER.md](./GATE-LEDGER.md).

# G2 Gate Review R1 — S2 authority candidate

**Candidate:** `feat/s2-authority-snapshot-iso-20261025` @ `2e10100a59321b563430ef3a3294d3ffcbd18581`\n**Base:** `4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84`\n**Verdict:** **补充内容**\n
## Evidence actually run

- All six `tests/s2-authority/*.test.mjs` passed: exit 0 (9 + 30 + 13 + 11 + 7 + 8 cases).
- `node scripts/doc-consistency-controls.mjs`: exit 1, `controls=94 failed=8`. The failures are positive clean-fixture assertions expecting `findings=0` (POS-1/3/4/6/8/10/11 and NEG-21 summary); negative controls mostly passed. This is not a clean mandatory-check result.
- `node scripts/ci-pr-gate.mjs`: exit 1. Graph/state files are absent from this sparse review worktree, install/store is unavailable, blueprint baseline is absent, typecheck dependencies are absent, lint baseline is absent, and artifacts leg is not run; census is explicitly named skip. This is an environment/worktree failure, not evidence of candidate correctness.
- `.github/workflows/pr-gate.yml` preserves the existing required gate and adds docs checks in the same job; `.github/workflows/census-runtime.yml` preserves the existing awk/current-contract checks and adds candidate-vs-legacy agreement.

## Met by candidate

- Frozen six-field snapshot shape and owner/schema material are present in `dev/engineering/authority-snapshot.schema.json`; `scripts/authority-snapshot.mjs` provides canonical F0 digest and loud unsupported-schema handling.
- Immutable, exclusive, symlink/hardlink-safe publisher writes only `dev/engineering/authority-snapshots/<version>.json`; it does not write registry, generated view, or pointer (`scripts/publish-authority.mjs:7-17,84-120`).
- Existing six-field semantics and legacy reader are retained; candidate consumers use the shared core grading path rather than a second semantic implementation (`scripts/ci-pr-gate.mjs:189-227`).
- Explicit candidate path + expected digest is required; invalid/missing/one-sided candidates fail closed with no fallback (`scripts/docs-probe.mjs:291-312`, `scripts/docs-sync.mjs:128-140`, `scripts/gen-current-state.mjs:460-500`).
- Dual-read is read-only, compares all six fields, reports divergence/missing field/digest errors, and does not consult derived mirror to repair authority (`scripts/authority-dual-read.mjs:80-104`).
- No dual-write path was found. `registry.yaml` explicitly says migration is not started and retains `legacy_execution_authority` (`dev/engineering/registry.yaml:6-10`). `current-state.json` remains a derived view, not a replacement.
- Negative controls in the new S2 suites are genuinely red for old/new conflict, missing field, wrong digest/ID, forged candidate, and skipped/partial candidate configuration.

## Missing for actual G2 / switchover

1. **No Authority Migration Map** covering every consumer, read/write direction, permissions, switch order, rollback, and Host-dependent exceptions. Current registry only states `migration_of_legacy_consumers: not_started_requires_coordination` (`dev/engineering/registry.yaml:6-10`).
2. **No short switchover transaction.** `current-authority.json` and its expected digest are only described/carried as future candidates; publisher deliberately has no pointer mode (`scripts/publish-authority.mjs:7-13`). No atomic pointer creation/update, precondition check, final snapshot digest lock, or complete consumer cutover exists.
3. **No rollback drill/evidence.** There is no implementation/test restoring the pre-migration graph authority SHA plus original pointer snapshot; derived `current-state.json` cannot be used as recovery.
4. **Entry documentation is not corrected to make the new authority operational.** Schema text still labels the pointer as a carrier while the publisher says pointer mode is not implemented (`dev/engineering/authority-snapshot.schema.json:13,25`; `scripts/publish-authority.mjs:7-13`).
5. **The mandatory CI docs probe is wired with an invalid invocation.** `.github/workflows/pr-gate.yml:169-174` runs `node scripts/docs-probe.mjs` without `--base <verified-ref>` or `--worktree-only`; the CLI explicitly refuses missing base (`scripts/docs-probe.mjs:275-279`). Thus the new required step is deterministically RED in CI as written. It must use the workflow’s verified base ref (or an explicitly justified worktree-only mode), while remaining in the existing single required job.
6. `doc-consistency-controls` is not green on this head (8 positive-control failures); these must be resolved or explicitly explained before claiming the mandatory docs check is operational.

## Design assessment / defects

- **Good safety posture:** candidate mode is explicit, fail-closed, and never silently selects between old/new. No dual-write or derived-view reverse authority was observed.
- **Gate-level defect:** workflow invocation above makes the supposedly minimal mandatory docs check unusable. This is a concrete integration defect, not merely an unfinished switchover.
- **Ambiguity to remove before switch:** `current-authority.json` is named as the eventual pointer in schema/comments but is intentionally absent from the publisher and current tree. The final transaction must define it as the sole active pointer, not leave snapshot directory, registry, and generated view competing as “current.”

## Recommended minimal switchover design

1. Keep one editable current authority: `dev/engineering/current-authority.json`, containing exactly `{snapshot_version, content_digest}` and owned by the Workflow/Contract Owner. Versioned snapshots under `dev/engineering/authority-snapshots/` are immutable history; `registry.yaml` and `current-state.json` remain decision/derived views only.
2. Before switch, publish one validated snapshot, verify its canonical digest and all six fields against `graph.yaml#current_contract` with dual-read. Require clean docs:probe/docs:sync and all existing pr-gate/census safety checks.
3. In one guarded transaction: capture pre-switch graph authority SHA and pointer bytes/digest; exclusively create/write the pointer via symlink-safe atomic temp-in-same-directory + fsync/rename (or exclusive create if absent); immediately read pointer, resolve snapshot, verify digest/schema, and run all consumer checks. Any mismatch aborts and restores the exact pre-switch pointer bytes and leaves graph untouched.
4. Cut consumers one by one only after the pointer is valid; each consumer must use explicit pointer+digest and fail closed. No writer updates both graph and pointer. During transition, dual-read remains diagnostic and any divergence is RED.
5. Rollback drill must delete/restore only the exact pre-switch pointer snapshot and restore the recorded pre-migration authority SHA/pointer bytes; verify consumers read the restored old authority. Never reconstruct from `current-state.json` or registry.
6. Lock final merged SHA plus pointer-resolved snapshot digest in the review evidence and rerun negative controls (conflict, missing field, wrong ID, forged C2, skipped docs check).
