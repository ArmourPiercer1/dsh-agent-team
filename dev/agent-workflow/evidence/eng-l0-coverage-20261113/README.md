# eng-l0-coverage-20261113 — L0 undetermined rate + evidence claim binding

> Captured 2026-11-13 from `origin/master` @ `6361185d8`. Regenerate with §3.
> Nothing is hand-edited; the numbers below are the tool's output.

## 1. L0 coverage (last 40 first-parent commits with a diff)

```
coverage-audit (origin/master, last 40 commits with a diff):
  determined   20
  undetermined 20  (50%)
DSH-COVERAGE-AUDIT commits=40 undetermined=20 rate_pct=50 top=tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs
```

Top causes: `tests/kits/**` runner scripts (evidence generators, not product tests) and repo-root
scratch files (`.merge-loop.sh`, `.merge2.sh`, `.nbp.patch`, `.anchorfix.py`). Full output: `audit.txt`,
machine-readable: `audit.json`.

## 2. Claim → run binding (heuristic)

```
evidence READMEs: 192
with a PASS/green claim: 179
with a run id / sha / commit nearby: 86
without: 93 (52%)
```

Full list of the first 15 READMEs without a nearby id: `claim-scan.txt`.

**This is a heuristic, not a proof**: the regex accepts `run id`, `runs/<digits>`, `run-record`, a
9–12 digit number, `sha256:`, or `commit <7–40 hex>`. A README can link evidence without any of those
tokens, and a README with a token can still cite the wrong run. It is an upper bound on "no traceable
run", sufficient to justify the format proposal (memo §2 R1), not to accuse individual files.

## 3. Reproduce

```bash
node --test scripts/coverage-audit.test.mjs        # 8/8
node scripts/coverage-audit.mjs --self-test        # 4/4
node scripts/coverage-audit.mjs --commits 40       # 50%
node scripts/coverage-audit.mjs --commits 40 --json > audit.json
# claim scan: the node one-liner in the memo build (or see README §3 of the memo PR body)
```

## 4. Limitations

- `classify()` is imported from `ci-local.mjs`, so this audit inherits its rules exactly; when a rule
  changes, the historical rate changes too. The 50% is "what the classifier would say today" applied to
  past diffs, not what it said at merge time.
- Commits whose diff is empty or unreadable (root/shallow boundary) are excluded from the denominator.
- The claim scan is a token heuristic over README prose only; it does not follow links or open run records.
