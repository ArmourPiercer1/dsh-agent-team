# F4 — the `declared-not-run` exception was leg-wide and never earned

**Dated:** 2026-11-18 (real UTC, `date -u`). **Branch:** `task/residual-fixes-20261116`.
**Files:** `scripts/eb3-ci-required.mjs` (`hostRefusalWaiver`, `checkHostRefusalGuard`),
`dev/ci/eb3-ci-manifest.json` (the one excepted leg), `scripts/eb3-ci-negative-controls.mjs` (C10d).

**Defect in one sentence.** The exception was the string `"hostRefusal": "declared-not-run"` on
the **leg**, so once the leg carried it *every* suite added to that leg inherited it: a
refusal-capable suite could be appended to `a5sf-fs-contract-layer-b` and
`eb3-ci-required` still said `pass` — only `test-catalog` (a different gate) noticed.

## 1. What the guard grades now

`hostRefusal` must be an object that **names its subject and its reason**:

```json
"hostRefusal": {
  "mode": "declared-not-run",
  "suites": ["tests/world-factory/a5sf-fs-contract.test.mjs"],
  "why": "<why THIS suite's absence is a declared NOT_RUN here>"
}
```

| code | when |
| --- | --- |
| `CI_HOST_REFUSAL_WAIVER_UNSCOPED` | the legacy leg-wide **string** spelling (a waiver of the whole leg) |
| `CI_HOST_REFUSAL_WAIVER_INVALID` | not an object / `mode` ≠ `declared-not-run` / empty `suites[]` / no `why` |
| `CI_HOST_REFUSAL_WAIVER_UNKNOWN_SUITE` | names a suite the leg does not list (the waiver drifted off its subject) |
| `CI_HOST_REFUSAL_UNGUARDED` | a suite names the refusal marker, the leg does not set the marker to `1`, and the waiver does **not name this suite** |

## 2. Before / after — the planted defect (`f4-waiver-before.txt` / `f4-waiver-after.txt`)

Probe (`.artifacts/tmp/probe-waiver.mjs`): append `tests/world-factory/a5sf-pty-contract.test.mjs`
— B3's measured `NOT_RUN` trap (`skipped=15 cases=15 verdict=NOT_RUN`, exit 0) — to the excepted
leg, and ask the real `checkHostRefusalGuard` for its findings.

```
# BEFORE  (origin/master code + origin/master manifest)
manifest hostRefusal as committed: "declared-not-run"
honest                  : findings=0 []
planted-undeclared      : findings=0 []            <-- THE DEFECT: an undeclared suite is absorbed
planted-legacy-string   : findings=0 []

# AFTER   (this tree)
manifest hostRefusal as committed: {"mode":"declared-not-run","suites":["tests/world-factory/a5sf-fs-contract.test.mjs"],"why":"…"}
honest                  : findings=0 []            <-- the reviewed exception still works
planted-undeclared      : findings=1 ["CI_HOST_REFUSAL_UNGUARDED(a5sf-pty-contract.test.mjs)"]
planted-legacy-string   : findings=3 ["CI_HOST_REFUSAL_WAIVER_UNSCOPED",
                                      "CI_HOST_REFUSAL_UNGUARDED(a5sf-fs-contract.test.mjs)",
                                      "CI_HOST_REFUSAL_UNGUARDED(a5sf-pty-contract.test.mjs)"]
planted-named-in-waiver : findings=0 []            <-- declared suite => pass
```

Both directions the brief asks for: **undeclared suite → finding**, **declared suite → pass**.

## 3. Negative control

`scripts/eb3-ci-negative-controls.mjs` gains **C10d** (existing controls untouched, none
renumbered): `28/28` → `29/29 control(s) behaved as required`. It asserts (a) honest passes,
(b) planted-undeclared fires, (c) the legacy string is `UNSCOPED` **and** does not silence the
suite, (d) named-in-waiver passes, (e) a stray subject is `UNKNOWN_SUITE`, (f)
empty/`no why`/wrong-mode are `INVALID`.

## 4. The manifest's own declaration was rewritten to the scoped shape

`a5sf-fs-contract-layer-b` still carries **one** exception, for **one** suite; its leg `why`
text now says the old spelling is refused rather than describing it as the current form. No
other leg, suite, env or workflow line changed: `EB3-CI-REQUIRED pass workflows=10 findings=0`
before and after.
