# R428-RETRO-og — Budget-ledger enforcement fidelity (PR #428, R2)

Scope: lane-independent seam in `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs`
(`--evidence` / `--budget-ledger` / `--budget`), commits `d9761a1ff` (seam) + `ce4ca22b4` (review round 1 caps).
Single dimension: **budget-ledger enforcement fidelity**. Mode: read-only + argv refusals only; no Host booted, :3080 and `~/.dsh` untouched.

## Self-check (pre-flight)

| Item | Result |
| --- | --- |
| Worktree | `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rr-428` |
| HEAD | `c2b03fc341937a6b7dfc65035ae36f8e1d66fa1c` — matches target `c2b03fc34` |
| `git status --porcelain` | empty (0 entries) — no checkout, no writes made |
| Seam ancestors | `git log -- <file>`: `ce4ca22b4`, `d9761a1ff`, `5234a60dc` |
| File size | 620 lines |
| Syntax | `node --check` → SYNTAX_OK |
| Spawn-safety | Only argv-refusal / fatal-guard executions attempted; no world, ledger or evidence byte written by me |
| Closed-lane ledger | `c2/boot-budget.jsonl` boots = 1..7 (7/7, full) — confirms closed history |

## Check 1 — Is a boot declared in the ledger BEFORE the process spawn?

**PASS.** Declaration is a single function called immediately, unconditionally, before the only `startHost` site.

`run-c2.mjs:278-288` (assert-then-append, one function):
```
278 function declareBoot(world) {
...
283   const prior = existsSync(BUDGET_PATH) ? parseBootLedger(readFileSync(BUDGET_PATH, 'utf8')) : []
284   const n = assertBootBudget({ declared: prior.length, budget: BUDGET, ledgerPath: BUDGET_PATH })
286   appendFileSync(BUDGET_PATH, JSON.stringify(entry) + '\n')
287   return entry
```
Call site is ordered *before* the spawn, with no branch between them:
```
357   await world.startMock({ decide })
358   const declared = declareBoot(world)
359   run.record.bootDeclaration = declared
360   console.log(`[u7tb-c2] boot ${String(declared.boot)}/${...} declared; starting (world ${world.id})`)
...
364     boot = await world.startHost({ bootTimeoutMs: 150_000 })
```
`startHost` appears exactly once (`:364`); `declareBoot` exactly once (`:358`). `startMock` (`:357`) precedes the declaration but is not a Host boot and is not what the budget counts — the budget is Host boots. Append is durable (`appendFileSync`) before `startHost` is reached, so a crash between them leaves a declared-but-unstarted slot (over-counting, fail-closed), never the reverse.

## Check 2 — Budget exhausted: exit code / verdict, anything spawned first?

**Fail-closed on the boot itself; diagnosis is poor and cleanup is skipped.**

`run-c2.mjs:186-190`:
```
187 export function assertBootBudget({ declared, budget, ledgerPath }) {
188   const n = declared + 1
189   if (n > budget) throw new Error(`boot budget exhausted: ${String(declared)}/${String(budget)} declared in ${ledgerPath}`)
```
- Nothing is appended (throw precedes `appendFileSync` at `:286`) → no double-spend, no phantom line.
- **No Host is spawned**: `assertBootBudget` throws inside `declareBoot` (`:358`), and the only `startHost` is at `:364`. Confirmed by control flow.
- But the world and mock *are* already up (`factory.createWorld`/`writePreBootFiles` `:341-343`, `startMock` `:357`), and the throw unwinds `main()` to the CLI catch (`:617-620`): `console.error('[u7tb-c2] FATAL', error)` then **`process.exit(1)`**. No `world.stopHost()`/`world.teardown()` (`:390-391`) runs, so a budget refusal leaks a world dir under `.artifacts/tmp/u7-tbash-c2-world` and whatever `startMock` started. No run record, no `tbash:mounted` entry, no structured verdict is written — an exhausted budget is indistinguishable in output from any other crash (same exit 1, same `FATAL` prefix).

## Check 3 — Can it be pointed at a CLOSED lane's ledger dir? What stops it?

**Blocked, lexically; disclosed only in code comments.**

`run-c2.mjs:98-106`, applied to *both* flags (`:170-171`):
```
 98 const inRepoOutsideClosedLane = (given, flag) => {
 99   const abs = resolve(REPO, given)
100   const rel = relative(REPO, abs)
101   if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`${flag} must stay inside the repo: ${given}`)
103   if (relPosix === CLOSED_LANE_REL || relPosix.startsWith(`${CLOSED_LANE_REL}/`)) throw new Error(`${flag} must not point inside the closed lane dir ${CLOSED_LANE_REL}/: ${given}`)
```
Empirically refused (no spawn, thrown at module load `:237`):
```
### ARGS: --evidence dev/agent-workflow/evidence/u7-tbash-l4-20261027/arc-b --budget-ledger .../arc-b/boot-budget.jsonl --budget 1
run-c2.mjs:103  ... `must not point inside the closed lane dir ...`
```
Plus a second, independent net: the closed lane's own ledger is already 7/7, so even a bypass hits `boot budget exhausted: 7/7 declared` at `assertBootBudget`. Caveat: `resolve()` is purely lexical — no `realpathSync`, so a symlink inside the repo whose target is the closed lane would satisfy the string check (none exists today; `..` and absolute forms are correctly normalized/blocked by `:101`).

## Check 4 — Any path where a start happens with no ledger line?

**No unauthorized-start path found for `startHost`.** Two adjacent fidelity gaps:

(a) **Unknown/typo'd flags are silently dropped → silent fallback to the closed lane's ledger.** The parser (`:137-154`) has branches only for `--evidence`, `--budget-ledger`, `--budget`, `--allow-reused-dir`; there is **no `else` that rejects unknown argv**. A mistyped flag yields `given === 0` and takes the no-flag default, i.e. `DEFAULT_BUDGET` 7 and `dev/.../c2/boot-budget.jsonl` — exactly the fallback `:160` claims to make impossible ("refusing to fall back to the closed lane's committed ledger"). Verified, no spawn:
```
### ARGS: --bogus
[u7tb-c2] FATAL HostBaseError: host base guard: c2-check: git rev-parse failed (exit 128)
    at main (... run-c2.mjs:340:28)
```
It passed argv resolution and reached `main()` — the *host-base guard* stopped it here, not the seam. In a provisioned worktree it would create a world, `startMock`, then die in `declareBoot` against the 7/7 ledger — after the world existed, with the misleading `budget exhausted` message. This is the same silent-fallback class the header decries (`:27`) and is not covered by the seam tests.

(b) `startHost` failure still leaves the ledger line (`:358` before `:364`, catch at `:365-367`), so a failed boot consumes a slot — conservative, not a violation.

## Disclosure status (part of check 3)

Seam semantics live **only** in the runner's own header (`:19-27`, `:78-83`, `:112-127`) and in `tests/world-factory/u7-tbash-seam.test.mjs`. `grep -rln -- "budget-ledger" docs/ dev/agent-workflow/ --include=*.md` returns no lane README or plan file for this lane — the option set, the F1/F2/F3 rules and the closed-lane guard are undiscoverable to anyone who does not open the .mjs. The header does disclose the F1 cap and F3 reuse rule; it does **not** disclose the unlocked check-then-write race (that one *is* disclosed at `:279-282`).

## Verdict: PASS-WITH-FINDINGS

Core property holds: the sole `startHost` is gated by a durable ledger append that throws closed on exhaustion, and the closed lane is protected by two independent nets (path guard + full 7/7 ledger). Findings are about fidelity of the "any lane" story and failure hygiene, not about unauthorized boots.

| ID | Sev | Location | Issue | Evidence |
| --- | --- | --- | --- | --- |
| F-1 | P2 | `run-c2.mjs:137-154`, `:155-160` | Unknown/typo'd flags are silently ignored; `given===0` then falls back to the CLOSED lane's ledger + budget 7, contradicting `:160`/`:27`. A single typo in `--budget-ledger` runs the wrong lane's ledger. | `node run-c2.mjs --bogus` reached `main()` (HostBaseError at `:340`), not a refusal; no test covers unknown argv |
| F-2 | P2 | `run-c2.mjs:357-364`, `:617-620` | Budget exhaustion throws after `createWorld`+`startMock`, so exit 1 `FATAL` leaks a world dir / mock and writes no record or verdict; indistinguishable from an unrelated crash, no teardown at `:390-391`. | `assertBootBudget` throw `:189` precedes `startHost` `:364`; `main()` has no try/finally around `declareBoot` |
| F-3 | P3 | `run-c2.mjs:99-103` | Closed-lane guard is lexical (`resolve` only, no `realpathSync`); an in-repo symlink to the closed lane would pass. Mitigated today by the full 7/7 ledger and the absence of such a symlink. | guard source `:98-106`; `c2/boot-budget.jsonl` boots 1-7 |
| F-4 | P3 | repo docs / lane README | Seam options and F1/F2/F3 rules are documented only in code comments (`:19-27`, `:78-83`, `:112-127`) + seam test; no prose doc names `--evidence/--budget-ledger/--budget`. | `grep -rln -- "budget-ledger" ... --include=*.md` → no lane/plan doc |

Adjacent note (not scored): a *failed* `startHost` still consumes a ledger slot (`:358` before `:364`) — intentionally conservative.

Reviewer independence: single-dimension (budget-ledger enforcement), cross-model pass, no writes to tracked files; report is the only artifact.
