# Alpha.5 PR1 — §12 evidence set (closed-world Guard + Stable Scoped Dispatcher)

Branch `alpha5-pr1-guard-dispatcher`, stacked on `alpha5-pr0-contracts` (PR base; **stacked-on-#252**).
Host: DSH `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84`, pins from
[`tests/paths.mjs`](../../../../tests/paths.mjs). CORE PATCH BUDGET = 0: every
capability here is an external plugin at a public seam.

## (a) decision delta — what this round decided that the plan left open

| # | decision taken | why, and where it is pinned |
| --- | --- | --- |
| 1 | The closed world is installed at the **Team trusted assembly point** (`packages/runtime/src/plugin/live/agent-bindings.mjs`), gated on the Agent actually carrying a `permissionPolicy`; Agents without one are left untouched | the assembly is the only place that knows both the blueprint and the Agent's real scope; the no-policy lane is the zero-interference control (`C4b`, `a6a` member-B pins) |
| 2 | **Monotonic, state-first refusal order**: dispatcher state → identity → unknown name (`TEAM_TOOL_UNGOVERNED`) → unverified / binding drift (`TOOL_BINDING_UNVERIFIED`) → abstain | a call must never reach a body because a later check would have caught it earlier; pinned by `a5p1-closed-world-guard.test.ts` G1–G11 |
| 3 | Names that already existed when the Agent published are bound as **inherited** (`bindingId native:<name>`, origin `inherited-native`) and the Guard **abstains** on them; whether such a tool may run stays the permission lane's decision | measured on the real Host, both lanes behave identically for `write` — see `(h)` and `alpha5-pr1-host/final/inherited-native-observation.json`. PR1 owns the unbound / post-publish class, not the permission lane's |
| 4 | Coverage Gate stays a **diagnostic** (FATAL line, no behaviour); the Guard is the safety line | the plan's S0 division of labour; `tools/change` only revalidates, it never widens |
| 5 | Lease boundary is **measured, not assumed**: the self-counted lease begins at the outermost door (`tools/pre-execute`) and ends at the result edge (`tools/post-execute`), with state gates on both doors and `endCallById` on refusals | `NEG1-SEAM` measures on every run that neither `pre-execute` nor `execute` resolves `next()` after a Body returns and that `post-execute` fires before a parked Body returns; so the count bounds "outer door → result event", strictly weaker than "no Body is running" — which is why the mask never lifts before `RELEASED` |
| 6 | Teardown never trusts a dispose return: `release()` refuses with `EXECUTION_TERMINATION_UNCONFIRMED` (+ `sideEffectUnknown: true`) while any lease is outstanding, and the mask/Guard stay armed | `NEG1-LEAK`, `NEG1-MASK`, dispatcher `release()` |
| 7 | This lane reads **no clock** | `S7` greps the lane sources for `Date.now` / `new Date` / timers; the finite-clock law (NaN / ±∞ → typed fail-closed, `body = 0`) is Admission's in PR2, and PR1 declares the same semantics for any future clock input |

## (b) goal → source mapping

| goal (memo §4 / design §4.1, §3.6-MCP, §4.2) | implementation | tests / kit criteria |
| --- | --- | --- |
| closed-world monotonic Guard, unknown name / unverifiable identity / binding change → typed deny | [`closed-world-guard.ts`](../../../../packages/runtime/tool-dispatch/closed-world-guard.ts) (`guardDecision`, `createGovernedSurface`, `untestedAssurance`, `GUARD_DENIAL_REASONS`) | `a5p1-closed-world-guard.test.ts` G1–G11, S1–S7 |
| installed first at the trusted assembly point, covering after-setup own-layer **and** MCP dynamic registration | [`agent-bindings.mjs`](../../../../packages/runtime/src/plugin/live/agent-bindings.mjs) install block + publish block (`bindOwnTools` / `bindMcpTools` / `publish`) | `a5p1-guard-install.test.ts` I1–I11, `a6a-production-wiring.test.ts` gate counts, `C1d`, `C2a`/`C2b` |
| `tools/change` revalidates only | `revalidateSurface()` in [`scoped-dispatcher.ts`](../../../../packages/runtime/tool-dispatch/scoped-dispatcher.ts) + the diagnostics listener in [`install.ts`](../../../../packages/runtime/tool-dispatch/install.ts) | dispatcher tests, `C5` (no drift across turns) |
| dispatcher `PREPARING→ACTIVE→DRAINING→TOMBSTONED→RELEASED`, refuse-new-first, mask kept, self-counted drain, never trust dispose | `scoped-dispatcher.ts` (transitions validated against PR0 `BINDING_TRANSITIONS`), `install.ts` `disposeOrdered()` | `a5p1-scoped-dispatcher.test.ts`, `NEG1-PARKED`/`NEG1-BODY`/`NEG1-MASK`/`NEG1-LEAK` |
| binding change = immutable revision, Definition never unloaded | `revise()` (new revision, surface re-bound); no unload path exists | dispatcher tests, `NEG1-STABLE` |
| assembly failure ⇒ never published | `failAssembly()` + `publish()` only from `ACTIVE`-eligible state | dispatcher tests, `I`-series |
| Agentless NEG-2 non-interference; Team nested without trusted Agent refused | install gate (`permissionPolicy !== undefined`), identity absent/foreign branches | `a6a` member-B zero-gate tests, `C4`/`C4b` |
| real-Host negative controls | [`a5p1-kit.mjs`](../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs), [`a5p1-order-hazard.mjs`](../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs) | 21/21 criteria, see `(d)` |

## (c) RED-first record (verbatim first failures)

The lane was written test-first; the numbers below are the first failing output,
not a narrative.

* Unit lane: `a5p1-closed-world-guard.test.ts` / `a5p1-scoped-dispatcher.test.ts`
  / `a5p1-guard-install.test.ts` were RED before `closed-world-guard.ts`,
  `scoped-dispatcher.ts`, `install.ts` existed (`Cannot find module
  '../tool-dispatch/index.js'`), then green; totals now 18 + 14 + 11 lane tests
  plus the layer-audit and import-law audits.
* Kit run-1 (`alpha5-pr1-host/run-3`): `FAIL C1c … results=0 seen=timeout` and
  `FATAL member scripts did not finish (strict=false ctl=false)` — the scripted
  leader chain did not advance on `tool_result`-only continuation turns.
* Kit run-2: `FATAL … TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED: cannot get
  property "agent" without inject` — the glue's trusted-identity computation read
  a cordis proxy outside an inject context and aborted root-Agent start.
* Kit runs 6–7: `TEAM_RUNTIME_DURABLE_WRITE_FAILED … a5p1-probe (file://…):
  cannot get property "tools" without inject` — same proxy rule, now in the kit's
  own observer row.
* Kit run-11/12: `{"leg": "register", "kind": "setup", "trigger": "apply",
  "ok": false, "error": "cannot get property \"tools\" without inject"}` with
  `listen` rows present and no `fire` row — a preset row's scope accepts
  subscriptions and delivers none. This is why the Host-side hazard no longer
  depends on a plugin registering anything.
* Kit run-14: `FAIL C2b … sideEffect=A5P1_RAN_strict_2026-10-16T06-40-50` —
  the governed Agent ran the inherited native `write`. Recorded as the decision
  delta (a)(3) and as an observation, not redefined into a pass.
* Kit run-15: `FAIL C5 … drift=["a5p1-guard: guard-denial agent=session-a5p1-team-… tool=team_follow_up"]`
  — the drift oracle swallowed C2's own planned refusal; the filter was narrowed
  by name rather than the assertion being loosened.

* Late round, and the most instructive: adding the Guard as a second
  `tools/pre-execute` listener turned three pre-existing files red —
  `a3p4-pr4-production-entry-regression` E3
  (`AssertionError: the glue executed despite the persisted overlay deny
  (decision: {"kind":"allow","nextCalls":1}): expected 1 to be +0`),
  `rc2a1-fs-containment` (`RC2A1 invariant: T3: the deny-subtree read is a
  static deny (got {"kind":"allow"})`, thrown at module load) and
  `alpha2-explicit-agent-setup` T1/T2 (`AssertionError: expected 2 to be 1`).
  All three reached for `listeners.find(l => l.event === 'tools/pre-execute')` —
  the FIRST leg — and were therefore driving PR1's outer door while labelling
  its answer "the glue". They are fixed by driving the whole chain in
  registration order (body-edge counted), not by adjusting expectations; the
  fix is recorded as commit `98774250`.

## (d) real Host Run Receipt (required)

[`../alpha5-pr1-host/final/run-receipt.md`](../alpha5-pr1-host/final/run-receipt.md)
— same directory: `summary.json` (the 21-criterion table: 8 order arms + 13 Host legs, all pass),
`kit.log`, redacted `instance.log`, `guard-observations.txt`,
`undeclared-team-tool-evidence.json`, `inherited-native-observation.json`,
`member-model-views.json`, `row-state-final.json`, `blueprints/`,
`stable-instance-{before,after}.json`. Port 3185; world
`tests/homes/a5p1-<stamp>` removed at teardown; pinned tree porcelain-clean;
`:3080` read-only and unchanged. Intermediate debugging runs
(`run-1` … `run-16`) are kept in the same parent directory; every captured
credential in them was scrubbed in place to `REDACTED-<sha256-8>` before commit
(`sweep-worlds.mjs --scrub-raw` is the reusable form).

**dynRan before / after** (the PoC record itself is untouched):

| shape | PoC (alpha.5 adapter P0) | PR1 (this branch) |
| --- | --- | --- |
| tool that appears after publish / bound by nothing | `hc-dyn-observation.dynRan = true` — the body ran | `Error: team tool guard: "team_follow_up" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes; declare it or bind it)` and **no effect from that body** (`C2a`/`C2b`) |
| teardown order hazard (lift-then-unload) | native body ran (count 1) | `NEG1-CONTROL` still reproduces count 1 **without** PR1 (the protection control); with PR1 `native=0, adapter=0` (`NEG1-PARKED`) |

## (e) baseline-diff identity table

Machine-readable: [`baseline-identity-diff.json`](baseline-identity-diff.json).
Method: identity = the verbatim `FAIL <file> > <suite> > <test>` line; two full
`pnpm test` runs (baseline tree vs this branch); set difference, never a count
comparison alone.

Two full `pnpm test` runs on this machine:

| tree | files | tests |
| --- | --- | --- |
| base = PR0 tip `cd13f781` | 10 failed \| 509 passed (519) | 36 failed \| 6529 passed (6565) |
| this branch (chain drives + kit hardening) | **7 failed \| 515 passed (522)** | **24 failed \| 6601 passed (6625)** |

Identity comparison (`only_in_after` = **0**, i.e. no test that was green on the
base is red here):

| file red in BOTH | red identities (this branch) | why it is not this PR |
| --- | --- | --- |
| `packages/runtime/test/a2c7-subtree-matcher.test.ts` | 13 | red on the base with the same test names; alpha.4 subtree-matcher lane, untouched here. **Condition, per the independent review (MINOR-3):** these 13 are order/environment-sensitive — running the file alone on a clean tree can be green, so the count in this table is a property of the FULL-suite run in this environment, not of the file in isolation; the direction (same identities on both trees) is what the no-new-red claim rests on |
| `packages/runtime/test/p6t3-mediation.test.ts` | 5 | same identity red on the base; p6t3 mediation lane |
| `packages/runtime/test/p6t3-restart.test.ts` | 2 | same |
| `packages/tools/test/p6t6-actions.test.ts` | 1 | same |
| `packages/runtime/test/a2c1-pwsh-permission.test.ts` | 1 (module fails to load) | same collection failure on the base |
| `packages/domain/test/t2-blueprint-hash.test.ts` | 1 (`projects absent optional singles as explicit null`) | same |
| `packages/testkit/test/a4p7-merge-gate.test.ts` | 2 (the composition-smoke legs) | both legs are red on the base as well; the THIRD base-red leg (`the scratch the commit-level instrument builds…`) is green here, and a fourth leg that was red mid-round — `the committed install surface is fresh against the tree` (artifacts staleness) — went green the moment `dist` was committed, which is the mechanism that leg exists to enforce |

The cause of the two red composition-smoke legs is named rather than waved at:
`node scripts/composition-smoke.mjs` prints
`SKIP client plugin (packages/client): host module closure unavailable — 1
unresolvable: clsx`, and the gate's own rule is that a skipped step is a red
(“A skipped step is an unverified claim, not a green one”). This environment's
`node_modules/clsx` carries only `.d.ts` files and
`packages/client/node_modules/clsx` does not exist, so the host module closure
cannot be traversed — an installation gap that is present on the base as well,
and nothing in this PR's diff touches it. Repairing it means re-running the
dependency install, which changes far more than this branch; it is recorded here
so a reviewer does not have to rediscover it.

Reds that disappeared between the two runs are **not claimed as fixes**:
`rc2-persona-probe`, `plugin-dsh-compat`, `rc2-kit-preset-seam` and one a4p7 leg
read the mandated runtime tree (`tests/deepseek-harness-test-use`) and the shared
`stable-3-0.2.0-rc.2` baseline, and that state differs between measurements —
they are environmental, and the count difference must not be read as progress
made by this PR.

This is also why the count moved from 36 to 24 while the red *identities* went
down only through environmental files: the three new `a5p1-*` lane files add 43
passing tests and remove nothing (519 → 522 files, 6565 → 6625 tests).

## (f) file hash manifest

FILE-HASH-MANIFEST-BELOW

## (g) reviewer slots (left empty by design)

| slot | reviewer | verdict | notes |
| --- | --- | --- | --- |
| R1 — closed-world semantics vs design §4.1 | _(empty)_ | _(empty)_ | _(empty)_ |
| R2 — dispatcher lifecycle / teardown safety | _(empty)_ | _(empty)_ | _(empty)_ |
| R3 — kit honesty (criteria vs what they actually observe) | _(empty)_ | _(empty)_ | _(empty)_ |

## (h) unfinished capability, disclosed boundaries, PoC-1 handling

* **PoC-1 (the H6 dynamic-registration harness) is superseded for the Host leg,
  not deleted.** The PoC record under `dev/agent-workflow/evidence/alpha5-adapter-p0/`
  is untouched. The PR1 kit's probe row now only *observes* and reports its own
  liveness, because on this Host a third-party row cannot register a tool at all
  (`cannot get property "tools" without inject`) and its `agent/created` /
  `tools/pre-execute` subscriptions deliver nothing. The post-publish class is
  covered on the Host by a name the Team glue itself registers after publish
  (`C2`), and the *timing* half by the deterministic `pr1-parked` / `pr1-body`
  arms and the lane's unit tests. The two halves are reported separately.
* Inherited native names are abstained on (delta (a)3). Refusing them is the
  permission lane's job; PR1 does not change that lane, and the real Host shows
  both lanes behaving identically for `write`.
* Lease bound is "outer door → result event", not "no Body is running"
  (`NEG1-SEAM`). Protection against the native-body hazard is the state gates at
  both doors plus the mask never lifting before `RELEASED`.
* The kit is not wired into any CI job; it is run manually and its Receipt is
  the artifact. The stacked base does not trigger GitHub Actions (see PR body).
* World cleanup covers success, FATAL and throw; a SIGKILL mid-run can still
  leave `tests/homes/a5p1-*` or `host-stdout.raw`. `sweep-worlds.mjs`
  (`--dry`, `--scrub-raw`) is the runner-side repair and is committed for that
  reason.
* `C1c` counts Team actions from what the model was actually told; a Team reply
  with `"status":"rejected"` and `isError: false` is a rejection, and the kit
  reads the payload — a transcript-level assertion would have hidden two
  rejected member creations in run 6–7.
* **Test-wire lesson worth stating for the next lane**: any test that selects
  `tools/pre-execute` by `find()` is now layer-ambiguous on this repository. The
  three files above are converted; a new test must drive the chain or select the
  leg by listener identity (`a5p1GuardPreExecuteGate` /
  `a5p1GuardDispatchGate` / `a5p1GuardResultEdge`).
* Not done in PR1 (unchanged from the plan's PR split): MCP *late-arriving*
  servers beyond the publish-surface snapshot, the Admission finite-clock law
  (PR2), and any per-call budget/timeout enforcement — this lane contains no
  clock at all.

---

## (i) Gate re-review round — F1…F5 (RED-first again)

The independent re-review (`review-PR1.md` @ `2075a815`) reproduced four
BLOCKERs on this branch's `dist` at `f6eeec02`. All five directed items were done
RED-first: the new failing tests were written and run BEFORE the behaviour
changed, and the verbatim first failure of each is kept under
[`runs/`](runs/).

| item | the first failure (verbatim, from `runs/`) | the law that replaced it |
| --- | --- | --- |
| **F1** unknown own name auto-bound `native:/verified:true` | `× R1 an observed name becomes a native Binding only if it is on the trusted native list` · `× R1 a scope-local name present at publish is NOT bound as a verified native` (`F1-F2-guard-RED.log`, `F1-F4-install-RED.log`: `5 failed | 19 passed`, `11 failed | 12 passed`) | native allowance comes only from an **explicit trusted list** (`nativeNames`, taken from the public GLOBAL view `tools.schemas()` with no scope) **and** a pinnable definition. An unknown name on the publish surface is bound as `unbound-observed:<scope>:<name>`, `providerId: unattributed`, `verified: false` → dispatch is a typed `TOOL_BINDING_UNVERIFIED` denial. Test `R1` registers `evil` as an own tool BEFORE publish and asserts the call after publish is refused |
| **F2** the verdict re-checked a name+generation, not the definition | `× R2 a same-scope name resolving to a DIFFERENT definition never runs on the old verification` · `× R2b an unreadable current definition is a refusal, never an assumption of no change` | every decision re-reads **what the name resolves to right now** (`tools.get(name, scope)` → a content-free fingerprint of the definition identity). Mismatch ⇒ `DEFINITION_DRIFT`, unreadable ⇒ `DEFINITION_UNREADABLE`; both are `TOOL_BINDING_UNVERIFIED` denials and both withdraw the verification as a new immutable revision, so the refusal is permanent until a real re-bind. `revise()` gained its production callers (the drift detector and `revalidateSurface`), and the name-diff no-op is now a real diff (`{added, removed, unverified, drifted}`). No trustworthy definition identity at all ⇒ **the assembly does not publish** (`R2c`), because "could not read it" must never be recorded as "nothing changed" (`R2b`) |
| **F3** a partial assembly published anyway | `× R3 a missing ctx.on is an assembly failure that leaves nothing armed` · `× R3b a pre-execute registration that throws is an assembly failure, not a degraded Guard` · `× R3c a required seam that cannot be armed fails the install` · `× R3d the armed-seam count is asserted, not assumed` | five **required** seams; `publish()` refuses below the expected count and a registration that throws unwinds everything already armed (`unarmAll` + listener disposers + `failAssembly`) and returns a typed failure with `residue: 'none'`. The expected count is a number the install asserts (`requiredSeams`, default 5), and `seamsArmed() === 0` is a failure, never a `RELEASED` |
| **F4** the lease ended at a seam that cannot prove the Body returned | `× R4 the settled edge ends a lease; post-execute alone proves nothing about the body` · `× R4c a late settled callback after TOMBSTONED never lifts the mask and never revives the scope` · `× R4d the caller may declare the drain given up` | `tools/post-execute` only RECORDS that a result is in hand; the lease ends at `tools/result` (the registry's final emit edge, `finishScheduledExecution → notifyResult`, success and error path alike) **while the dispatcher is still ACTIVE**. A settled callback crossing the drain boundary is recorded (`dispatcher-late-settled-after-teardown`) and refused. Once the caller declares the drain given up, `release()` refuses forever with `EXECUTION_TERMINATION_UNCONFIRMED` and the mask stays down: the half-state never disarms. A refusal we authored ends its own lease in ANY state, because "this call's Body never ran" is our own act |
| **F5** the failure path's cleanup was unproven | — (no unit RED: this is a run-path proof) | `a5p1-kit.mjs --inject-fatal-after-boot` forces a FATAL with a booted Host and a populated `DSH_HOME`; trace [`../alpha5-pr1-host/fatal-f5/`](../alpha5-pr1-host/fatal-f5/) and [`runs/F5-forced-fatal.log`](runs/F5-forced-fatal.log): `FATAL cleanup: host=… world=removed residue=verified absent (re-checked 500 ms after the sweep)`, exit 1, no `tests/homes/a5p1-*` left |

### The measurement that turned out to be wrong, corrected on the record

`NEG1-SEAM` and a comment in `install.ts` claimed `tools/post-execute` fires
*before* a parked Body returns, and used that as the reason to release the lease
there. Re-measuring (the point F2/F4 forced) showed the arm's park did not hold
the Body open at all: at the park point the obs tail read
`wrapper-enter → body → wrapper-return`, `inFlight=0`, and the criterion had
asserted only `postExecutedBeforeRelease`, which a completed call satisfies
trivially. With the park moved into the Definition's own `execute` wrapper the
pinned registry says the **opposite**: both result-side edges fire after the Body
returned, while the lease is still held (`inFlightAtTeardown=1`,
`bodyReturnedAtTeardown=false`, `bodyReturnedAtSettled=true`). The criterion is
now written against that measurement, and the arm gained `NEG1-R4` on top of it —
so the order leg is 9 criteria where it was 8, and the whole kit 22 where it was
21. Nothing was weakened to reach green: `NEG1-CONTROL` still reports
`native=1 bodies=NATIVE.grep` with PR1 out of the loop.

Two expectation re-casts are strengthenings and are stated as such: the
install-level I9 leg no longer lets a Body that settles after the drain began
re-open `release()`, and I11 asserts the refusal at the Guard door with the state
still `DRAINING` (previously it accepted a later, vaguer refusal).

### PUBLIC-seam gap (PoC-1 format), unchanged and now load-bearing

```
seam asked for        : tools.get(name, scope) → the live ToolDefinition
what it gives         : the definition object, so `definition.execute` is a
                        function identity this process can pin
what it does NOT give : any provenance field — no owner, no contributing package,
                        no "is native" bit (`schemas()` whitelists
                        name/description/parameters; `register()` records no
                        public owner; no BUILTIN/NATIVE name list is exported)
consequence           : native-vs-third-party ATTRIBUTION is not derivable at a
                        public seam. The assembly therefore carries an explicit
                        trusted native list (the public GLOBAL view) and pins
                        every inherited definition by identity; anything it
                        cannot pin is refused, never assumed
residual case         : a native name ALREADY shadowed by a scope-local
                        definition at publish time is pinned from that scope's
                        own resolution and so enters governance as verified.
                        Mitigations, in order: the pin is checked against the
                        same resolution on every call (drift ⇒ refusal); a
                        preset row cannot register a tool on this Host (measured);
                        Team assembly mounts after presets
```

If a future Host exposes per-definition provenance at a public seam, the trusted
list becomes derivable and this disclosure retires. Until then the assembly
prefers to refuse: the definition seam is one of the five **required** seams, so
its absence stops the publish instead of degrading to name-only verification.
