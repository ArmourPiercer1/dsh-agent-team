# R431-R3 closure re-review #2 (finding: GATE-LEDGER ENV_BLOCK citation over-claim)

Verifier: independent read-only (flash). Scope: PR #431 head `0454b56d4`, finding round-2 NOT-CLOSED.
Mode: READ-ONLY. No checkout performed.

## Identity

- worktree: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rr-431`
- pwd verified: `.worktrees/rr-431`
- `git rev-parse HEAD` = `0454b56d4a0038c07c24227aeda437d8fb9b0672` (matches target, detached)
- `git status --porcelain` = 0 lines (clean)

## Check 1 — repair commit content (`git show 0454b56d4`) — PASS

- commit = `0454b56d4a0038c07c24227aeda437d8fb9b0672`, authored 2026-10-28, 1 file changed, +1/−1:
  `docs/plans/memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md`.
- The single changed row (G4-R takeover reconciliation) now reads:
  "ENV_BLOCK only via `nativeConfinementEnvBlock` in `tests/world-factory/lib/host-sandbox-assets.mjs`
  — both halves required on a leg that already failed its functional assertions: a pre-flight record
  whose probe answered `unusable` **and** the host's typed unavailable signal in what the lane
  observed; everything else stays FAIL".
  ⇒ both halves + already-failed-leg premise + else-FAIL all stated. Yes.
- False cross-reference gone: `grep -c 'two conditions stated'` in GATE-LEDGER.md = **0**;
  `grep -n 'If the Jobs native leg still cannot run'` in GATE-LEDGER.md = **no match**. Yes.
- New citation actually exists: `nativeConfinementEnvBlock` ×1 and `host-sandbox-assets.mjs` ×1 in the ledger.

Basis of the original over-claim (independently re-confirmed read-only): RULING-B-G4R-3.md's
§"If the Jobs native leg still cannot run after the provisioning fix" (line 137 ff.) says only
"recorded as `ENV_BLOCK` with the probe receipt and referred to the promotion reviewer … never
relabelled PASS"; it never states the two-condition conjunction, and line 126–127 in fact treats a
`unusable` *pre-boot* probe as "a stop, not a leg". So deleting that citation was correct, not cosmetic.

## Check 2 — code matches the gloss (`tests/world-factory/lib/host-sandbox-assets.mjs`) — PASS

Export at line 661; doc comment (lines ~645–652):

    /**
     * THE gate for ENV_BLOCK on a native (non-governed) confinement control.
     * Both halves are required, and the caller applies it only on a leg that has
     * ALREADY failed its functional assertions:
     *   · a real pre-flight record whose probe answered `unusable`, AND
     *   · the host's typed unavailable signal in what the lane actually observed.
     * Everything else returns null (⇒ the leg stays FAIL).

Body — all three requirements enforced, else `null`:

    export function nativeConfinementEnvBlock({ observedText = '', observedSignal = null, preflight = null } = {}) {
      const signal = observedSignal !== null && typeof observedSignal === 'object'
        ? { present: observedSignal.present === true, ... }
        : sandboxUnavailableSignal(observedText)
      if (signal.present !== true) return null
      if (!isSandboxPreflightRecord(preflight)) return null
      if (preflight.backend !== 'unusable') return null
      return { typedSignal: signal, sandboxPreflight: { ... }, note: '… ENV_BLOCK (never PASS, never a product FAIL)' }
    }

- `signal.present` required: yes (strict `!== true`, and `present` is normalised to a boolean, so a
  truthy-but-not-`true` value cannot pass).
- `isSandboxPreflightRecord(preflight)` required (real record, not a bare object): yes.
- `backend === 'unusable'` required (a `partial`/`full` probe can never yield ENV_BLOCK): yes.
- otherwise `null` ⇒ leg stays FAIL: yes. Doc comment states the already-functionally-failed-leg premise: yes.
⇒ Gloss and code agree on every clause.

## Check 3 — ledger table integrity — PASS

Markdown row for the edited entry: `awk -F'|'` → `fields=9`, `cells=7` (leading/trailing pipe
delimiters excluded) ⇒ the 7-column shape (entry / verdict / date / review basis / record / merges /
ruling detail) is intact; no cell was split or merged by the edit.

## Verdict

**CLOSED.** All three sub-claims hold at `0454b56d4`: the false RULING §cross-reference is deleted
(grep = 0), the replacement cites the real code source with both halves + the already-failed-leg
premise + else-FAIL, the cited code enforces exactly those three requirements, and the table row is
still 7 cells. No new defect introduced. Read-only: no checkout, no writes outside this artifact.


