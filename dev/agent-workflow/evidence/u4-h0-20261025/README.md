# U4-H0 — G1-F feasibility: H0 Definition-TOCTOU via public seams (verdict evidence)

Work package: **U4-H0** (H0 Definition TOCTOU, G1-F feasibility). Executor: U4 subagent.
Date: 2026-10-25 (UTC). Host pin: `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(pristine, porcelain-empty verified before/after every run; no upstream edits, no patch-package, no private imports).

## 0. Question and fixed-format verdict

Phase-1 memo §6.2 H0: can a public-seam governance layer guarantee that the **executed**
Definition Body is the **verified** Definition Body, given that Host `tools/execute`
re-resolves the live name→Definition binding *after* pre-dispatch policy (late resolve)?

PASS criterion (fixed): for every adversarial case, the count of **executions of an
unverified Body** is 0 — proved via marker/side-effect oracle (file markers, sentinel
reads, `/bin/echo` process legs) inside the Bodies themselves, not via logs. A
sensitivity plant (guard deliberately disabled) MUST show the unverified Body executing,
otherwise a zero would be vacuous.

Verdict options: `READY-PUBLIC` / `CONDITIONAL` (with center-enforceable invariants) /
`CORE_SEAM_BLOCKER` (fixed format per ROUTER_RULES §5).

**VERDICT: CONDITIONAL** — the public seams suffice: one plugin at the `tools/execute`
waterfall (prepend listener + identity check via `ctx.tools.get` + self-dispatch of the
verified function + `tools/change` abort watcher + contract-permitted `exec.signal`
replacement) drove the executed-Body count for every unverified Definition to **0**
across five adversarial classes on the real Host at `639ed015`, with a proven
non-vacuous sensitivity plant (guard off → B executed). The conditions (§7) are
center-enforceable today — none requires an upstream patch — so this is not a blocker.

## 1. Static call-sequence trace

Full analysis with line numbers: [`STATIC-TRACE.md`](./STATIC-TRACE.md). Summary of the
window under test at `639ed015` (`packages/core/tools/src/index.ts`):

| Pt | Line | What happens | Can resolved Definition change here? |
|----|------|--------------|--------------------------------------|
| P0 | :1493-1531 | pre-dispatch gate (guards/ask/deny — name+args only) | n/a (no Definition resolved yet for execution) |
| P1 | :1554-1566 | signal fusion prep | — |
| P2 | :1569-1571 | fuseToolSignals(store signal) | — |
| P3 | :1572-1575 | `store.isAborted` → `toolAbortedBeforeDispatchResult()` (Host's own pre-dispatch abort check) | — |
| P4 | :1578 | `resolveExecution(name, scope)` — **LATE live resolve #1** | YES — this is the TOCTOU point |
| P5 | :1581 | `definition.execute(args, runCtx)` — Body begins | no await between P3 and P5 (F3) |
| P6 | inside body | arbitrary awaits — bindings can change here (F1: every mutation emits `tools/change` synchronously) | YES |
| P7 | waterfall return | listener return value becomes the result (:1609 normalizeDispatchResult); a sync throw also prevents the Body (:1628) | — |
| P8 | :1865-1883 | success-result re-resolve at :1876 (schema binds late; ERROR path resolves nothing) | YES (schema only — never a Body exec) |

Facts F1–F6 (proofs in STATIC-TRACE): every register/dispose/restrict mutates the store
synchronously and then emits `tools/change` synchronously; `ctx.tools.get(name, scope)`
reads the same view the dispatcher resolves; mode-collapse only denies; listener order =
registration order with `prepend` able to reach first; a listener that never calls
`next()` fully vetoes the built-in dispatch (and self-dispatching the verified function
from the listener therefore substitutes exactly the verified identity).

## 2. Guard design tested (public seams only)

One test plugin (`u4h0-probe-plugin.mjs`, roles CENTER/GUARD/WATCH/FOREIGN/FENCE/CTL)
installs the candidate center guard:

1. **PREPEND-first `tools/execute` listener** (`ctx.on(name, fn, true)`): for the
   governed name, observes `ctx.tools.get(TARGET, exec.agent)` and compares to the
   approved binding — mismatch or invisibility → **veto result, `next()` never called**
   (built-in dispatch and its late resolve never run).
2. **Self-dispatch on approval**: `await approved.def.execute(exec.arguments, exec)` —
   the executed function object **is** the observed function object (structural
   identity, not a second resolution). Its return value is handed back as the listener
   result.
3. **Defense-in-depth abort**: per-call `AbortController` folded into `exec.signal` via
   `AbortSignal.any([incoming, ac])` (the contract-permitted signal replacement,
   restored in `finally`), plus a **prepend `tools/change` watcher** that re-gets the
   live binding and aborts the armed call on any mismatch (catches swaps during the
   Body's own awaits).
4. **Grant token** checked inside the approved Body (callId-bound) — defense, not
   sufficiency (a foreign Body would not carry it).
5. Guard-off switch exists ONLY for the S1-owned sensitivity plant (phase-1 §6.2:
   plant is test-side, this is it).

## 3. Real-Host matrix — oracle and results

Runner: `u4h0-run.mjs` (mock model provider copied byte-identical from sealed
`s1-h0-m1` — pins verified; ONE plugin row through the public profile-patch seam; world
`tests/homes/u4-h0-<UTC>`; port 3184; token-gate 401 check; bounded single-Host-start
runs with circuit breakers). Ground truth = **ledger rows written from inside the
Bodies + marker/echo files on disk**, per leg; wire delivery recorded secondary.

Oracle invariants: unverified-Body execution count = any `body-start` row for Body **B**
(or `B-*` marker/echo files) outside the plant case; the plant case (f1) MUST show
`B-f1.marker` + `B-f1.echo` + process leg ok.

Matrix template (filled from the sealed run's `summary.json` / `ledger.jsonl`):
**Primary run: `runs/u4-h0-2026-10-25T13-38-52Z/` — 17/17 oracle cells PASS.**
(12 body-start rows total: 11×A + 1×B where B is only the plant; markers/ exactly 18
files; exactly 2 guard vetoes, both intended cells; zero rows for `u4_h0_never`.)

| Case | Vector (all public) | Expected | Actual | Evidence |
|------|--------------------|----------|--------|----------|
| a | stable control | A executes, all legs ok | **PASS** — a1 ran:true (marker+echo+process) | markers/A-a1.* |
| b1 | regen at-rest (same object) | A executes | **PASS** — regen-same ok; b1 ran:true | ledger b1 |
| b2 | regen in-flight mid-Body | A-only; B count 0; conservative abort | **PASS** — A body-start 1, `body-abort-observed` reason `u4h0-guard-change-abort`, B rows 0 | ledger b2 |
| c1 | foreign AGENT-SCOPED shadow mid-Body | A-only (abort-observed); B count 0 | **PASS** — shadow add ok, A aborted:true, no B-c1.* files | ledger c1; markers/ (no B-c1) |
| c2 | shadow at-rest before call | guard **veto** (identity-mismatch), zero Bodies | **PASS** — veto:identity-mismatch; zero body-start c2 | ledger c2 |
| c3 | restore control | A executes | **PASS** — c3 ran:true | markers/A-c3.* |
| d1 | scope restriction (`tools.restrict deny:[TARGET]`) | guard **veto** (not-visible), zero Bodies | **PASS** — veto:not-visible; zero body-start d1 | ledger d1 |
| d2 | lift control | A executes | **PASS** — d2 ran:true | markers/A-d2.* |
| e1-e3 | microtask/timer shadow races at guard boundary | A-only; B count 0 | **PASS** — e1,e2,e3 all A-only (aborts observed), zero B | ledger e1/e2/e3 |
| **f1** | **sensitivity plant: guard OFF + fence swap A→B mid-dispatch** | **B executes (MUST)**: marker+echo+process | **PASS (RED observed)** — fence swapped at :57.207, `body-start f1 B`, ran:true, **B-f1.marker + B-f1.echo on disk**, process leg ok | markers/B-f1.* |
| f2 | guard back on, control | A executes | **PASS** — f2 ran:true | markers/A-f2.* |
| global | never-called name `u4_h0_never` | zero rows anywhere | **PASS** | ledger grep 0 |

## 4. Budget ledger (shared S1+U4 caps: ≤20 PoC, ≤12 Host starts; per-package ≤8/≤6)

| # | Time (UTC) | Experiment | Host start? | Outcome |
|---|-----------|------------|-------------|---------|
| prior | ≤23:37Z | S1: M1×2, M2, M3 | 4 | sealed (see s1-h0-m1/m2/m3, s1-h0-m3-safety-determination) |
| U4-0 | 13:24 | runner preflight selftest | **no** (aborted pre-spawn: async port-check bug in runner preflight) | fixture bug, 0 starts |
| U4-1 | 13:27 | matrix attempt | **yes (5/12)** | fixture: plugin import ERR (spawnSync misimported from node:fs); tool calls never dispatched; runner OOM-killed by own no-advance loop; breaker added |
| U4-2 | 13:33 | diagnostic w/ wire dumps | **yes (6/12)** | root cause found: decide id-prefix bug (`t01` vs wire `u4-t01`); ctl executed fine; guard live; agent capture ok |
| U4-3 | 13:36 | full matrix | **yes (7/12)** | 13/16 cells pass; 3 fails = fixture race (micro-shadow auto-restore window outlives group spacing); guard vetoed CORRECTLY on every poisoned call (true positives) |
| U4-4 | 13:38:52Z | clean matrix (heal-per-group) | **yes (8/12)** | **PASS 17/17** — verdict evidence `runs/u4-h0-2026-10-25T13-38-52Z/` |

Totals after all U4 runs: PoC experiments 9/20 (4 prior + 5), Host starts 8/12 (4 prior + 4).
Per-package: U4 experiments 5/8, Host starts 4/6 — budget respected, no hypothesis needed
a discriminating retest (each failed run was a fixture defect root-caused in-run, fixed,
and the fixed matrix passed on its first clean execution).

## 5. Run hygiene verification

- `git -C tests/deepseek-harness-test-use status --porcelain` — empty before and after
  every run; HEAD `639ed015397290b3745d163aafe02ffee4aa3f84` unchanged (`post-check-htu`
  step in each `runs/*/steps.jsonl`).
- Sealed neighbors' bytes asserted unchanged in every preflight (`sealed-unchanged:*`).
- Ports: 3184 only (sanctioned); `:3080` and `~/.dsh` untouched; token redaction on all
  logs (`*.redacted`); owned-PID teardown verified (`teardown-host` step, port-free).
- Worlds: `tests/homes/u4-h0-*` (see §6 for what was kept vs deleted).

## 6. Evidence inventory

- `runs/u4-h0-2026-10-25T13-24-04Z/` — U4-0 preflight abort (steps only)
- `runs/u4-h0-2026-10-25T13-24-48Z/` — U4-1 (OOM postmortem: 2328-request loop rows)
- `runs/u4-h0-2026-10-25T13-27-39Z/` — U4-2 (first stalled matrix)
- `runs/u4-h0-2026-10-25T13-33-50Z/` — U4-2 diagnostic: **`wire/` fixture dumps** proving
  result replay + tools announcement (14 envelopes)
- `runs/u4-h0-2026-10-25T13-36-56Z/` — U4-3: 13/16 cells + full veto trail (every veto
  later shown to be a CORRECT guard decision on a genuinely poisoned binding)
- `runs/u4-h0-2026-10-25T13-38-52Z/` — U4-4: **primary verdict evidence** — PASS 17/17
  (`ledger.jsonl` 12 body-starts 11A+1B-plant, `markers/` 18 files incl. B-f1.*,
  `steps.jsonl` incl. preflight/post-check-htu, `summary.json`, `wire/` envelopes)
- `u4h0-probe-plugin.mjs`, `u4h0-run.mjs`, `make-manifest.mjs` — fixture (public seams only)
- `mock-deepseek.mjs`, `instance.mjs`, `util.mjs`, `s1m1-session-client.mjs` —
  byte-identical copies of the sealed `s1-h0-m1` harness (pins asserted per run)
- `STATIC-TRACE.md` — P0–P9 trace + F1–F6 + guard design + alternatives
- `manifest.json` — sha256 of every file here (rerun `node make-manifest.mjs` to verify)

Test homes: all five `tests/homes/u4-h0-*` worlds deleted after runs (contents that
matter are mirrored under `runs/`); nothing else in `tests/homes/` touched.

## 7. Verdict and conditions

**CONDITIONAL.** The H0 TOCTOU window (late resolve at `:1578` after verification) is
**closed on the executed path by public seams alone**, by construction rather than by
race timing: the guard listener returns without calling `next()`, so the Host's built-in
dispatch — and therefore its late `resolveExecution` — never runs for governed names,
and the function that executes is the exact object the guard verified (§2.2). The
`tools/change` watcher + per-call signal (§2.3) additionally abort the A Body when a
binding changes mid-execution (defensive layer; every mid-flight vector in the matrix
was observed and acted on within ≤30ms).

The conditions below are what makes the mechanism a *governance guarantee* rather than
one well-behaved plugin; each is stated as an invariant the center can enforce today
through public seams (they become U6 requirements):

1. **CENTER-OWNED APPROVAL TABLE.** The guard's `approved` binding set must be owned by
   the same center composition that performs governed registrations; verification is
   only meaningful relative to that table. A guard fed an attacker-writable table
   verifies nothing.
2. **COMPOSITION-ORDER CONTROL.** The guard must be the first `tools/execute` listener
   for governed names (prepend), and the center must own/audit which plugins participate
   in the composition: a *later-prepending* listener can suppress the guard's delivery
   (F5/L1). Such a listener executing arbitrary code is composition-membership risk
   (trusted-plugin boundary), NOT an H0 TOCTOU hole — but the center must be able to
   enumerate `tools/execute` listeners and registration order to keep that boundary
   auditable.
3. **GOVERNED-NAME VISIBILITY DISCIPLINE.** Foreign definitions must not become the
   visible binding for governed names without center action. Public vectors exist
   (agent-scoped same-name shadow — agent-loop injects `tools`, so any tool Body with
   `exec.agent.ctx` can shadow at agent scope; scoped `restrict` hides globals). The
   guard fails CLOSED on all of these (veto/abort observed: c1, c2, d1), but the center
   should (a) run the guard where foreign scopes cannot precede it, and (b) alert on
   `identity-mismatch`/`not-visible` vetoes as governance events.
4. **RESULT-PATH SCHEMA PARITY (P8).** The success-result path re-resolves the live
   definition at `:1876` to bind the output schema. It can never execute a Body, but it
   can schema-validate a verified result against a swapped Definition's schema. Rule:
   admitted Definitions for a governed name must present identical I/O schemas
   (schema-parity admission rule); mode-collapse semantics remain fail-closed (only
   denies, never substitutes — STATIC-TRACE F2).
5. **IN-BODY GRANT IS DEFENSE ONLY.** The callId-bound grant check inside approved
   Bodies detects anomaly; it is not the guarantee (a foreign Body lacks it by
   definition). Do not let it substitute for conditions 1–3.
6. **NO TRANSACTIONAL REGISTRATION-TIME VETO.** `tools/change` fires after the store
   mutation commits (F1): a listener cannot veto a swap transactionally, only observe
   synchronously-post-commit and act before/around dispatch (veto next calls, abort in
   flight). The guard design encodes this; center must not promise "atomic swap
   prevention", only "zero dispatch of unverified Body".

Explicit non-claims: this run proves Definition-identity binding of execution on this
Host at this pin via this oracle (markers/read/process side effects from inside the
Bodies). It does not authorize claims about approval-policy semantics (S1's lane),
multi-process Hosts, or future Host versions.

Why not READY-PUBLIC: conditions 1–3 are trust/composition obligations the guard plugin
cannot self-enforce from inside the public seam; they are enforceable by the center
today, hence CONDITIONAL with concrete invariants rather than CORE_SEAM_BLOCKER.
