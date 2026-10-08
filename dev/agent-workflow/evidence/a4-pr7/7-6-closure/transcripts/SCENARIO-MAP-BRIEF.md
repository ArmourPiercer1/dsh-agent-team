# Shared brief — §7.6 scenario traceability fan-out (A4-PR7 evidence lane `7-6-closure`)

You are one of six read-only mappers. Deliverable: **traceability evidence**, not code.

## Repo discipline (mandatory first step, per `AGENTS.md`)

1. Read `docs/ROUTER_RULES.md` §0 (current plan outranks it).
2. Read `docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md` lines **853–863** (§7.6, the gate you are producing evidence against).
3. Read `docs/plans/active/alpha4-permission-governance/alpha4-permission-governance-spec.md` **§21** (the acceptance matrix, lines ~905–1000) — that is the normative meaning of the scenario names §7.6 lists.

All paths below are relative to **your assigned tree**:
`/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-closure` (branch `feat/a4-76-closure` @ `0e7004b6`).
Read and write **only inside that tree**. Never write into `/home/user/dsh-plugins/dsh-agent-team` (the main workspace).

## Hard rules

* **Never map a scenario to a file name.** Map it to registered test identities.
* The authoritative registry of what actually exists is
  `dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/registered-legs-before.tsv` —
  TSV columns: `file \t describe-path \t test-title \t status \t full-name ("describe > … > title")`.
  It was produced by `vitest run --reporter=json` on this exact tree: **502 files, 6277 registered legs**
  (all nine `packages/*/test` roots as the root config loads them; it contains **0** `*.client.spec.*` legs —
  those are in `scratch/client-names-before.txt`, 55 files / 880 legs, format `file::full name::status`).
* **Verify every identity you cite with `grep -F` against the index** (an exact-string match). A cited
  identity that is not in the index is a fabrication and will be caught.
* **Read the body of every leg you map** — locate the title in the file and read its `it(...)` body.
  You are asserting what the leg *actually asserts*, not what its title promises. Alpha.4 has already been
  bitten by prose attributing a law to a file that did not hold it (plan line 708), so titles are hypotheses.
* The `status` column matters: a leg that is currently `failed` is **not** coverage — cite it, but say so.
* **Do not run vitest, npm, pnpm, or any test command.** Runs are serialised by the lane owner on purpose
  (a concurrent run perturbs the load-sensitive `p6t1-parallel` family and corrupts the census).
  `grep`, `read`, `ls`, `git log` are fine; `node -e` for pure text processing is fine.
* **Write only your own output file** (named in your task). Do not edit any source, test, manifest, or
  another mapper's file. This lane adds evidence and inventories only.

## What to produce

For **each** assigned scenario, in your output file:

```
### <row id>. <scenario name, as §7.6 words it>
Normative meaning used: <the spec §21 row(s) / ADR clause you treated as the obligation, quoted>
Asserting legs (verbatim from the index):
  - `<file> > <describe path> > <title>` — <one line: what the body actually asserts that discharges the obligation>
  (…or, if none:) **no asserting leg found.**
Searched for: <the literal strings/regexes you grepped, the files you opened and rejected, and why you
rejected each — e.g. "title matches, body asserts the evaluator's unit answer on a hand-built envelope,
never the service path" is a legitimate rejection and is more valuable than a soft COVERED>
Verdict: COVERED | PARTIAL | ABSENT
Verdict reason: <one sentence. PARTIAL must name the missing sub-clause; ABSENT must be a plain statement
that nothing in the 6277-leg registry asserts it, with the searches above as support>
```

Judgement rules, applied honestly:

* **COVERED** — at least one leg asserts the scenario's core obligation *through the path the product uses*
  (production entry point, service, or adapter), and the leg passes.
* **PARTIAL** — the obligation is asserted only in part, or only against a hand-wired double / unit-level
  evaluator where the obligation is about the wired path, or the only asserting legs are red, or the leg
  asserts the shape of an error name rather than the behaviour.
* **ABSENT** — nothing asserts it. This is the most valuable possible answer for some rows: say it plainly.
  Do not stretch a nearby test into coverage to avoid writing ABSENT, and do not call a leg "coverage in
  spirit". A nearby-but-different leg belongs in a `Nearby but not this:` line, not in the asserting list.
* Where the same scenario is asserted in several suites, cite the **best 2–5** legs (production path first)
  and summarise the rest as "plus N same-shape legs in `<file>`" — but every identity you print verbatim
  must be real.

Use the whole tree, not just `a4*`: `a3p3-*`, `a3p4-*`, `a2c*`, `a5a-*`, `p*-*`, `t*-*`, `d*-*`, `s6t-*`,
`remote/`, `tools/`, `testkit/`, `domain/`, `storage/` all count. Suite prefixes are history; the scenario
list is what has to be covered.
