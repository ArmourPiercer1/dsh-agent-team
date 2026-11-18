# F2 — `PD34-PIN` failed OPEN on absent history

**Dated:** 2026-11-18 (real UTC, `date -u`). **Branch:** `task/residual-fixes-20261116`.
**File:** `tests/world-factory/a5sf-pd34-member-stop.test.mjs:183` (the `PD34-PIN` arm).

**Defect in one sentence.** The arm mapped *every* non-zero `git cat-file -e
<base>:<path>` to `exists = false`, so in a checkout that does not carry the lane base
(`3101ca08f`) at all — a depth-1 / single-branch clone — it reported *"the entry did not
exist"* and the suite passed **8/8** having proven nothing.

## 1. The two different failures one exit code was covering

```
$ git cat-file -e 3101ca08f^{commit}      # (A) the BASE is not in this clone  → depth 1, fatal: Not a valid object name
$ git cat-file -e 3101ca08f:<path>        # (B) the PATH is absent AT a readable base → exit 1, and THAT is the pin
```

The old arm only ever ran (B) and read both cases as (B)'s answer. A pin that cannot be
evaluated must **fail**, never claim absence.

## 2. Before / after

Depth-1 clone: `git clone --depth 1 file://<worktree> .artifacts/tmp/pd34-depth1`
(`git rev-list --count HEAD` = 1, `git cat-file -e 3101ca08f^{commit}` → *fatal: Not a
valid object name*). CI shape: the task worktree itself, full history.

```
f2-pd34-pin-depth1-before.txt   depth-1, arm from origin/master
  ✔ PD34-PIN: the entry did not exist at the lane base
  ℹ tests 8   ℹ pass 8   ℹ fail 0        <-- FAIL-OPEN

f2-pd34-pin-depth1-after.txt    depth-1, fixed arm
  ✖ PD34-PIN: the entry did not exist at the lane base
    AssertionError: PD34-PIN INCOMPLETE: the lane base 3101ca08f is not readable in this checkout
    (fatal: Not a valid object name 3101ca08f^{commit}). The pin cannot be evaluated;
    "cannot evaluate" must never be read as "does not exist". ...
  ℹ tests 8   ℹ pass 7   ℹ fail 1        <-- RED, loudly

f2-pd34-pin-depth0-after.txt    depth 0 (CI shape), fixed arm
  ✔ PD34-PIN: the entry did not exist at the lane base
  ℹ tests 8   ℹ pass 8   ℹ fail 0        <-- still green where it can be evaluated
```

The depth-0 run is green **because the base is readable and the path really is absent**
(`git cat-file -e 3101ca08f:packages/client/src/model/member-stop.ts` → non-zero; the
model's first commit is after the lane base). The assertion was not weakened: it still
requires the path to be absent, and it now additionally requires the base to be readable.

## 3. Change

`tests/world-factory/a5sf-pd34-member-stop.test.mjs:183-205`, `execFileSync` →
`spawnSync` (so the arm can distinguish *why* the probe failed):

1. `git cat-file -e <base>^{commit}` must exit **0** — otherwise `assert.equal` fails with
   `PD34-PIN INCOMPLETE: …` naming the base, git's own stderr, and the two ways to fix
   the checkout (`fetch-depth: 0`, or `A5SF_PD34_BASE`).
2. only then `git cat-file -e <base>:<MODEL>` must exit **non-zero** — the original,
   unweakened claim.
