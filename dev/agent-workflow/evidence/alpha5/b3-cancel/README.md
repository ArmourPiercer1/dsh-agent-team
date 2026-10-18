# A5-B3 — the cancel leg: `bash · cancelled` becomes reachable, for the causes that mean it

Branch `alpha5-b3-cancel-pr`, one commit, base = `origin/master` = `fee982d25c0c945c2e3afe6be2b512ef0afa5c5e`
(`git ls-remote origin refs/heads/master`, recorded 2026-10-18 on this host; the #336/B2 merge point —
as instructed). Writer: B3 cancel-leg writer (qwen3.8-flash-next). No push. No :3080, no host trees,
no system permissions touched.

## 1. The approved plan, and its anchors re-measured on THIS tree

The approved plan came from the read-only diagnostic (`11c246f2`-class judgment (a): a public cancel
channel exists and the lane drops it). Per instruction, every line number was re-verified on the
live trees before acting; the measurements (0.2.0-rc.2 baseline runtime, `639ed01539`, per
`tests/paths.mjs`):

| fact | anchor (measured here) |
| --- | --- |
| public `ToolExecutionInput.signal` | `tests/deepseek-harness-test-use/packages/extensions/tool-cordis/src/api-catalog.ts:7621-7622` (`readonly signal: AbortSignal` inside the `ToolExecutionInput` declaration) |
| closed cause union | `packages/core/session/src/types.ts:189-193` = `AgentCancelCause = user \| parent \| hook(reason) \| disposed`; same text in the public catalog at `api-catalog.ts:4469-4470`; durable variant `TurnEndCancelCause` at `:7718` |
| the cause is what the signal carries | `packages/core/agent-loop/src/agent.ts:180` `this.phase.abort.abort(cause)` — `signal.reason` IS the union arm object |
| dispatch passes it to the tool | `packages/core/tools/src/index.ts:1581` `await tool.execute(exec.arguments, exec)`; the obligation is the host's own law: `index.ts:228` "Async work must observe or forward `exec.signal`" |
| our lane drops it (pre-B3) | `packages/tools/a5p5-tools/src/register.ts` — `makeExecute` returned `async (raw: unknown)`; the second parameter was never named, so no backend call could carry a signal |
| the renderer branch proven unreachable | `packages/tools/a5p5-tools/src/render.ts:183-184` — `outcome.cancelled ? 'bash · cancelled'` (B2 X6 booked this reachability gap as "owned by that face") |
| closed settlement vocabulary | `packages/tools/a5p5-tools/src/spill.ts:60-67` — the six `dispatcher-call-*` names; `dispatcher-call-terminated-after-body-start` is the one an aborted-then-terminated body is exactly |

The diagnostic's judgment (a) held at every anchor: the channel is public, it carries the cause,
and the only missing wire was our own `execute`'s second parameter. No architecture change was
needed, therefore none was invented.

## 2. The change (four production sites + one spec, each with what it refuses to do)

* `packages/tools/a5p5-tools/src/backend-contract.ts` — `ToolCancelSignal`, the lane's OWN
  structural four-member view of a cancel signal (`aborted`, `unknown` reason, the two listener
  methods): the lane names neither node nor host types, its purity law untouched. `BackendCall`
  gains `signal?:` — ADDITIVE; a backend that grew no abort leg simply never reads it.
* `packages/tools/a5p5-tools/src/pipeline.ts` — `ToolCallRequest.signal?:` carried through to the
  backend call and nothing else. The pipeline acts on NOTHING: a cancel is the row's fact, never a
  second authorization decision, and admission stays deny-before-backend exactly as reviewed.
* `packages/tools/a5p5-tools/src/register.ts` — `GovernedToolExecContext` +
  `execute(raw, exec?)`: the second parameter is READ, forwarded onto the call, nothing else.
  Optional, so every pre-B3 single-arg caller (and B2's X6) keeps byte-identical behavior —
  an absent signal means "never asked to cancel", and the row keeps honestly saying
  `cancelled: false` for it.
* `packages/runtime/src/plugin/live/plane-effect-backends.mjs` — **shell arm only** (the diff's two
  hunks live inside `createConfinedShellBackend`; the glob arm and the search row are untouched).
  ONE abort leg joins the existing settle race. After 根 14:13Z the race and the cancelled law
  are module-level EXPORTS — `raceShellSettle` (registration order is the closed tie law
  `exited > timedOut > aborted`; `sleep` injectable) and `shellCancelled` (the pure cause-range
  law) — and the row calls exactly those, so legs C8/C9/C10 pin the shipped code, not a
  spec-side reimplementation. The closed cancelled law:

  ```
  cancelled = !timedOut && signal.aborted && cause.kind ∈ {user, parent}
  ```

  — `timedOut` owns its own form (the guard keeps a late abort from rewriting a timed-out outcome);
  `hook` and `disposed` HONOR the abort (the payload is terminated through the SAME frozen
  `terminate()` arm the timeout uses) but keep the death shape `exit=not-observed` /
  `cancelled: false` — a hook firing or a teardown is not someone pressing cancel, and the renderer
  must never mint that intent; a cause outside the union's object shape is not a cause at all.
  A cause that is `user`/`parent` renders `bash · cancelled` — reachable at last.
  The settlement reuses the closed six-name vocabulary verbatim: an aborted body is exactly a
  `dispatcher-call-terminated-after-body-start`, no new word anywhere.
  Provider `terminate()` never passes through the signal, so it cannot mint a cancelled.
* **render.ts / types.ts / glob / search: ZERO changes.** Making the existing
  `bash · cancelled` line reachable IS the fix; the `cancelled: boolean` field and the
  ShellOutcome shape already existed. B2's anti-collateral form was copied into the new spec
  (leg C7) and strengthened for the new input: the two rows are pinned against a live signal AND
  against one already aborted when the call arrives — pinning only the first case would let a
  copy-paste of the abort leg into either row pass.

## 3. The six legs (+ the booked anti-collateral leg), RED → GREEN

Spec: `packages/runtime/test/a5b3-cancel-leg.test.ts` (new; 7 legs). Real plane, real launcher,
real confined payload; worlds under `tests/homes/` self-remove.

RED at pristine `fee982d2` (`red-pristine-fee982d2.log`, EXIT=1): **3 failed / 4 passed** —

* `× C1` user cancel — `a user cancel must render the cancelled shape: bash · exit=0 … expected
  … to contain 'bash · cancelled'` (the cancelled line was unreachable; the payload also ran its
  full 12 s: `elapsed < 10000` trips — a signal nobody reads cannot stop anything);
* `× C2` parent cancel — same message for cause `{kind:'parent'}`;
* `× C3` hook/disposed — `an aborted payload never reported an end; expected +0 to be null`:
  with no cancel input the row reported COMPLETION (`exit=0`) for a call the host had already
  ended — honest RED for the death-form half, and the same B2 defect class seen from the other side.

GREEN with the change (`green-fixed.log`, EXIT=0): **7/7**, C1+C2 now settle ~430-490 ms after
abort (the payload is actually stopped, not relabeled), C3 reads
`bash · exit=not-observed` with `cancelled:false` for BOTH `hook` and `disposed`, and:

* `✓ C4` positive control past a LIVE, never-aborted signal: `exit 7` still prints `exit=7` —
  the wiring is additive (green in the RED run on purpose);
* `✓ C5` timeout leg keeps its recorded form past a live signal: `bash · exit=not-observed ·
  timed-out`, `timedOut:true`, `cancelled:false` — B2 X5 re-pinned with the cancel input present,
  the `!timedOut` guard's ground (green in RED on purpose);
* `✓ C6` provider terminate is NOT a cancel (根 13:50Z booked it as an independent leg): half (1)
  re-measures B2 A4 — `terminate()` settles the payload as a 128+signum waitpid death, never 0,
  never null; half (2) is signal-FREE end to end — a payload that dies of its own `kill -TERM $$`
  reads `bash · exit=143` with `cancelled:false`. The cancelled word is reachable ONLY through
  the cause-gated abort leg (green in RED on purpose — this leg pins the conflation OUT, and it
  already held before; what changes is that the conflation now has a door, which this leg keeps shut);
* `✓ C7` zero-motion next door — glob/search wires carry no `exit=`/`exitCode`/cancelled word,
  with a live signal and with a pre-aborted one (green in RED on purpose).

The 3-failed/4-passed split IS the disclosure: exactly the legs that measure the newly-connected
channel were red; the three guards of NOT-changing-anything were green from the start, so their
later green proves "no motion", not "fixed".

## 3b. 根 14:13Z 覆盖面加令 — the five coverage items, each its own leg, races deterministic

The root order arrived after the first GREEN; the spec grew (7 → 11 legs) and the settle
race + cancelled law were lifted to production exports so the race legs pin the shipped seam.
The extension was itself RED-first: `red-pristine-fee982d2-v2.log` (EXIT=1) shows **7 failed /
4 passed** at base — C1b/C8/C9/C10 join C1/C2/C3 red (C8/C9/C10 fail on `raceShellSettle`
absent from the module — the seam did not exist to be injected); C4-C7 stay green by design.

| 根 item | leg(s) | how it is deterministic |
| --- | --- | --- |
| ① abort ALREADY fired before the call | **C1b** (e2e) + **C11** (boundary witness, §3c) + the pre-aborted arm inside `raceShellSettle` (`if (signal.aborted === true) onAbort()` — settles at setup, no event ordering) | C1b asserts `bash · cancelled` AND `elapsed < 10s` with the signal aborted before `execute` is even entered; monotonic clock; C11 witnesses the honest boundary — spawned-first (provider's own outDir mkdir), controlled fast termination, payload-side-effect direction RECORDED not bet |
| ② exit-vs-cancel race — one truth, pinned order | **C8** | controlled deferred for `exited`: ends-first → winner is the report and a LATER abort cannot rewrite it; aborts-first → winner is the abort and a later exit cannot rewrite it; BOTH-already-settled tie → `exited` wins (race registration order is the law, documented at the export) — the tie is decided ONCE, cancelled cannot also be true |
| ③ timeout-vs-cancel race — timedOut outranks, pinned | **C9** (race) + guard rows in **C10** (law) | injected `sleep`: immediate-fire timer + already-aborted signal at construction → timeout leg wins by array order, and `shellCancelled` composes to `false`; reverse window (timer held, abort lands) → abort wins, "a held timer cannot fabricate a timeout". No sleep anywhere in either race leg |
| ④ hook/disposed terminate for real, never impersonate | **C3** | end-to-end: payload IS stopped (elapsed bound) but the row prints the death — `bash · exit=not-observed`, `cancelled:false` — for BOTH causes |
| ⑤ cause range MEASURED, not imagined | **C10** | (a) re-reads the `AgentCancelCause` declaration from the baseline checkout's own `types.ts` — resolved through `tests/paths.mjs` alone, and **FAIL-CLOSED** when it cannot be read (no silent skip; receipt = printed path + git blob sha, §3c) — asserting the arms are EXACTLY `user|parent|hook|disposed`; a union change trips the leg before the law ships; (b) truth-table over the exported `shellCancelled`: the two arms → true; hook/disposed/foreign-kind/bare-string/null/undefined/case-folded → false; `timedOut+aborted` → false; never-fired → false |

GREEN with the change (`green-fixed-v2.log`, EXIT=0): **11/11** (race legs settle in 0-1 ms —
fully injected; the e2e legs stop their payloads in ~430 ms). One disclosed flake fixed on the
way: the elapsed guards read `Date.now()`; a live forward wall-clock step turned a 432 ms run
into a 27176 ms *measurement artifact* (caught in the wild on `green-fixed-v2` run #2; three
standalone reproductions were green — the step does not repeat). The stopwatch is now
`process.hrtime.bigint()` (monotonic), documented at the helper; the failure mode is gone
regardless of the host clock, and the suite re-ran 11/11.

## 3c. Root 16:15Z correction order + 16:30Z three-point narrow review (this closure commit)

Five closures, each measured before it was worded:

* **16:15Z ① — C10(a) is now FAIL-CLOSED with one source and a receipt.** The private
  two-candidate path list is gone: the baseline checkout is resolved through the repo's only
  path authority, `tests/paths.mjs` (`findTestRepoRoot`/`testUseTree`, the same resolvers
  `rc2-persona-probe.test.ts:29` uses — static import, typed via `paths.d.mts`). If no
  resolvable checkout carries `packages/core/session/src/types.ts`, the leg FAILS (an
  acceptance environment carries the pristine checkout at the pinned baseline BY DEFINITION;
  the rejected `it.skip` alternative could never be tallied as done, so it buys nothing —
  the demo: `findTestRepoRoot('/tmp/deep/a-b')` → `null`, printed in
  `green-v3-c10-failclosed.log`). Acceptance receipt (①c): every run prints the resolved
  path AND the git blob sha of the bytes read —
  `git-blob-sha=593c86d52a5c26d531913ffaff9aac651732c2da`, matching
  `git -C tests/deepseek-harness-test-use hash-object packages/core/session/src/types.ts`
  exactly. Environment placement (TEST_METHODS-canonical for a fresh worktree):
  `git clone --local --no-hardlinks /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness
  tests/deepseek-harness-test-use` + `checkout --detach 639ed01539…` (the `TEST_USE_BASELINE_SHA`
  constant) + `pnpm install --ignore-scripts --frozen-lockfile` + host build, EXIT=0; the
  shared baseline is never written; the checkout is gitignored (porcelain stayed 0).
* **16:30Z ① — the abort-listener removal path is proven closed, not felt closed.** The
  concern (removal lives in `.then(success)` — a rejecting race would strand the listener)
  is answered from the provider's construction: `exited` is built RESOLVE-ONLY
  (`provider.ts:657-660` — the executor takes no reject parameter), and even a REJECTED
  `proc.exit` is absorbed there into a resolve of `{code:null, signal:'exit-error'}`
  (`provider.ts:649-653`). The timeout leg resolves via the timer callback, the abort leg
  only ever resolves — the race has NO rejection path, so the `.then`-side removal covers
  every settlement. Recorded at the export's JSDoc; no code motion (the conditional the root
  set — code fix + reject-injection leg — applies when rejection is reachable; it is not,
  line-proven above).
* **16:30Z ② — cleanup, enumerated honestly, no full-cleanup claim.** This round ADDED the
  abort listener and REMOVES it once the race settles (the new surface, cleaned). The
  timeout timer keeps its HISTORICAL shape byte-for-byte — no handle kept, never cleared;
  an early winner leaves it scheduled to fire into a decided race, exactly as the pre-B3
  shell race (`git show fee982d2:…` side-by-side) and the untouched search arm
  (`plane-effect-backends.mjs:496`) already did. Preserved pre-existing property, stated
  as such at the export.
* **16:30Z ③ — C1b's pre-abort boundary: evidence corrected the wording before it shipped.**
  The new **C11** witness leg records the boundary: the row SPAWNS, then races — the
  provider's own spawn-prep `outDir` mkdir (`provider.ts:496-497`, under the governed root,
  fresh per plan) proves THIS call reached spawn even with the signal pre-fired (asserted
  before/after count — payload timing irrelevant). What the payload manages to EXECUTE
  before the kill is NOT row-determined: measured, terminate's first-tick SIGTERM
  (`provider.ts:400-412`) landed before the payload's first statement ran — the recorded
  line reads `payload-side-effect-landed=false settled-in=241ms` — so the leg RECORDS the
  side-effect direction (and stamps its order vs the abort if it lands) without asserting
  either way. The honest boundary, now the wording everywhere: **spawned first, terminated
  under control, fast** — never rewritten as "never started", nor as "always ran". Scope:
  the host never routes a pre-aborted call to the row at all (dispatch pre-check
  `core/tools/src/index.ts:1572-1574` in the pinned checkout answers
  `toolAbortedBeforeDispatchResult` before `execute`); the row-level leg is the belt for
  direct/non-host callers of the seam. Leg count: 11 → **12**.
* **16:15Z ② + 16:30Z ④ — provider-lane numbers corrected to receipts.** The logged original
  receipt `gates-provider-lane.log` says **41/41 (4 files)** and the README now says exactly
  that. The intermediate 8-file extension run of the v2 battery left NO stdout receipt (only
  the rc line `PROVIDER2=0`) — per the order it is **not counted** and its "63/63" is struck
  from the numbers; the same 8-file set was re-run WITH a log at this closure head
  (`closure-provider.log`) and is cited as its own fresh row instead. The reviewer 98274a4f's
  47/47 stays a SEPARATE corroborating line (§4, last rows) — not merged, not substituted.

## 4. Gates run at HEAD (this tree)
| gate | result | log |
| --- | --- | --- |
| B2 baseline at base (before any edit) | 10/10, EXIT=0 | `b2-baseline-at-base.log` |
| B3 spec RED at pristine base (v1, 7 legs) | 3F/4P, EXIT=1 | `red-pristine-fee982d2.log` |
| B3 spec RED at pristine base (v2, 11 legs, 根加令 after) | 7F/4P, EXIT=1 | `red-pristine-fee982d2-v2.log` |
| B3 spec GREEN (v1) | 7/7, EXIT=0 | `green-fixed.log` |
| B3 spec GREEN (v2, final tree shape) | 11/11, EXIT=0 | `green-fixed-v2.log` |
| B3+B2 together (A-series no-regression) | 21/21, EXIT=0 | `v2-battery.log` |
| glue7 + search + glob suites | 103/103, EXIT=0 | `v2-battery.log` |
| provider lane — LOGGED original receipt (4 files) | **41/41, EXIT=0** (verbatim from the receipt) | `gates-provider-lane.log` |
| provider lane — v2-battery 8-file EXTENSION | rc was recorded (`PROVIDER2=0`) but its stdout never entered a log → **不作数, not counted**; the "63/63" number is struck (root 16:15Z ②) | `gates-battery-rc.txt` `PROVIDER2` line only |
| ledgers (p4t6 1198 counted + dormant-audit 8th name + a5p0 consumer set + barrel) + a5p5-tools lane suite | 86/86, EXIT=0 | `v2-battery.log` |
| full root suite at HEAD (first run) — NO-NEW-RED by twin comparison | same 7 failing files / same 18 failing tests as BASE; +7 passes = this round's legs | `full-suite.log` (HEAD) vs `full-suite-BASE-fee982d2.log` (BASE twin, below) |
| full root suite BASE twin (identical tree `fee982d2`, same host, same command — run in the byte-identical `a5b2-rc` twin) | 18 failed / 7327 passed — the 18 are PRE-EXISTING env reds (p6t3 ×2, p6t6-actions, plugin-dsh-compat, rc2-persona-probe, t2-blueprint-hash v3-drift, a4p7-merge-gate) | `full-suite-BASE-fee982d2.log` |
| full root suite at refactored tree (v2) — 2 EXTRA reds, root-caused to THIS session's killed intermediate run (scratch-world residue), not code (see §6) | 28 failed / then green on re-run of the two specs (`A2C7P4T6=0`) | `full-suite-v2.log`, `gates-battery-rc.txt` `FULL_V2` |
| full root suite at FINAL tree (v3, clean tree, quiet start) | 12 files / 23 reds: the BASE 7/18 + 4 pure-load 5s-timeout flakes + p4t6 — ALL five re-ran GREEN individually on the quiet tree (20/20, `V3EXTRAS=0`); root cause of the p4t6 movement in §6 | `full-suite-v3-final.log`, `gates-battery-rc.txt` `FULL_V3` |
| `pnpm -r typecheck` (all packages) | EXIT=0 | `typecheck-identities-v2.log` |
| `npx eslint` on every touched file | 0 errors | this session |
| `node scripts/lint-identities.mjs` | EXIT=0 | `typecheck-identities.log` |
| `pnpm check:artifacts` (drift, staged) | EXIT=0 (first run EXIT=1 = the gate working: dist mirror staged in the same commit) | `build-and-drift.log` |

**CLOSURE-HEAD rows (root 16:15Z ④ + 16:30Z, this commit — all re-run at the final content):**

| gate | result | log |
| --- | --- | --- |
| B3 spec 12 legs (C11 added; C10 fail-closed) | 12/12, EXIT=0; C10 receipt + C11 boundary line printed in-log | `green-v4-b3-12legs.log` |
| B3+B2 together | **22/22, EXIT=0** (`CLOSURE_B2B3_FINAL=0`) | `closure-b2b3.log` |
| glue7 + glob + glob-adversarial + search (4 files) | 111/111, EXIT=0 | `closure-glue.log` |
| a5p5-tools suite dir (8 files, ledgers incl. dormant-audit) | 76/76, EXIT=0 | `closure-ledgers.log` |
| provider-lane EXTENSION set re-run WITH receipt (a5p4 ×5 + a5lsp2 ×2 + a5int-r3) | **71/71, EXIT=0** — this is the extension's first real log; counts stand on it alone | `closure-provider.log` |
| p4t6 (1198 count holds at closure tree) | 10/10, EXIT=0 | `closure-a2c7-p4t6.log` |
| a2c7-subtree-matcher (walk-up now resolves the worktree's own built checkout) | 31/31, EXIT=0 | `closure-a2c7-p4t6.log` |
| `pnpm -r typecheck` / eslint on touched files / `lint-identities` | EXIT=0 / 0 errors / EXIT=0 | `typecheck-closure.log`, `eslint-closure.log` |
| drift (staged) / `check:artifacts:head` | staged EXIT=0 at this commit (index==tree; the at-head self-build property was proven at the parent 914b834b and this commit's dist movement is the comment-only glue re-place, `cmp`-verified byte-identical to the build) | `build-and-drift-v2.log` (v2 lineage), commit message |
| CORROBORATING, NOT MERGED, NOT SUBSTITUTED: reviewer run at 98274a4f | provider segment 47/47 (the reviewer's own receipt, cited at the root's word, not a number of this branch) | root's review record |

## 5. What this round deliberately is NOT

* NOT a provider-architecture change: the launcher, provider, lease law, and terminate escalation
  are byte-untouched (B2's numbers re-measure identically in C6).
* NOT a new word: no new settlement event, no new outcome field, no new render shape, no new name
  on any closed set. `cancelled` was always in `ShellOutcome`; this round is the first time
  anything can honestly set it.
* NOT hook/disposed cancellation: they stop the payload (the host asked the call to end — the
  cooperative law) and they print the death, because that is what they are. If the product ever
  wants them rendered as cancellation, that is a NEW semantic needing its own ruling, and this
  spec's C3 is the leg that would tell you it moved.
* NOT a cancel of already-finished work: the race is cooperative; a payload that ends before the
  abort keeps reporting the end it measured. The `!timedOut` guard keeps the timeout's form whole
  if a cancel races its window.

## 6. Disclosures

* **B2's X6 comment: CLOSED per the root's 15:14Z order (①), forward commit on this branch.**
  The B2-era wording ("the shell row has no cancel input") was superseded by this round, and the
  root ruled the prose may be corrected directly: X6's title and comment now state the fact in
  two layers — the LEG injects no signal (the one-argument caller path is not a cancellation
  path: no signal, no leg, `cancelled:false` honestly), while the ROW now has a cancel channel
  (B3, two-argument path, pinned by `a5b3-cancel-leg.test.ts`) — explicitly separating "this
  leg injects no signal" from the stale "the row has no signal surface". **X6's judgment and
  call bytes are byte-identical to B2's pin** (the register single-arg compatibility pin, green
  shape unchanged); that commit's diff surface is comments + this README only.
* **The 18 full-suite reds are environment, not this round** — proved by the BASE twin: an
  identical tree (`fee982d2`, byte-identical `a5b2-rc` worktree, same host, same command) fails
  the SAME 18 tests in the SAME 7 files. HEAD's only delta is +7 passes.
* **Suite scratch left behind by provider/merge-gate tests** (`probe-*/`, `out/`, `plans/` at the
  worktree root — the same artifacts the twin tree carries) was deleted before staging so the
  tree reports `git status --porcelain` empty at commit time; nothing under them was ever
  tracked. The same scratch family bit twice inside the suite itself, and NEITHER red is this
  round's code: (v2) the intermediate full-suite run this session KILLED left its per-test
  worlds in `packages/testkit/test/.tmp-fault/` (gitignored scratch by contract) — a2c7's
  `createP6T1World` hit `team_domain already exists` (9 reds) and stray files inflated the
  p4t6 count 1198→1200; (v3) after a full cleanup, p4t6 raced the LIVE scratch of the
  concurrently running fault/artifact specs (their fixture copies land under
  `packages/testkit/test/.tmp-fault/**` with scannable `.mjs` names — the scanner counts
  whatever exists at scan second) plus four 5s-timeout flakes of heavy parallel
  restart/durable-world specs. All five specs re-ran GREEN individually on the quiet tree
  (20/20, `V3EXTRAS=0`; earlier `A2C7P4T6=0`); the race class predates this round and sits on
  the BASE twin identically (its `.tmp-fault` carries the same 35 dirs post-run). The
  no-new-red claim rests on the v1-vs-BASE pair — same host, same time window, byte-identical
  failing set (7 files / 18 tests), +7 passes = this round's legs.
* **The v2 clock artifact** (a live forward wall-clock step fabricating a 27 s "slow stop") is
  documented in §3b; the fix is monotonic timing inside this spec only — no production file
  reads any clock for the cancelled law.
* **The wide-glob `rm` incident, booked per the root's 16:15Z ③ (with the discipline it
  produced).** While clearing provider scratch after the v2 battery, `rm -rf probe-mvd*` was
  run at the worktree root — and the base tree TRACKS 66 `probe-*` fixture files (six
  probe dirs from the B2 era, committed into `fee982d2` itself). The glob expanded across
  tracked and untracked alike; the staged-deletion count (66 `D` entries in `git add -A`)
  caught it before commit; every file was restored from HEAD (`git restore --staged
  --worktree`), and the final commit touches ZERO `probe-*` paths (`git show --stat` proves
  it). **Standing rule adopted for this lane, root's wording: 未来禁止宽 glob 删除** — scratch
  removal addresses entries by exact name (or by name taken from a `git status --porcelain`
  `??` listing, which cannot name a tracked file); no `rm -rf <prefix>*` at any tree root,
  ever, including during this round's own cleanups (the closure cleanups above were all
  name-list driven).
* **No push. No :3080. No upstream/host tree. No system permissions.** The branch
  `alpha5-b3-cancel-pr` in `.worktrees/a5b3-cancel` carries THREE commits on `fee982d2`
  (B3 main → X6 prose truth-update per 15:14Z → this closure per 16:15Z+16:30Z), for the
  Gate loop to pull from.
