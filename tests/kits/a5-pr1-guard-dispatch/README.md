# a5-pr1-guard-dispatch — the closed-world Guard and the Stable Scoped Dispatcher, on the real Host

Alpha.5 **PR1** regression kit. It exists to answer one question with evidence
rather than argument: *does the closed world PR1 installs actually hold against
the pinned Host, and does it hold in the directions the design says it must?*

Pinned Host: DSH `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(pins come from [`tests/paths.mjs`](../../paths.mjs) — never restated here).
Test tree `tests/deepseek-harness-test-use` stays a pristine upstream checkout;
this kit writes NOTHING into it (`C7b` asserts `git status --porcelain` is
empty). Worlds live in `tests/homes/a5p1-<stamp>` and are deleted at teardown
(`--keep` preserves one for inspection). Port **3185** (the `318x` family);
the stable development instance `:3080` is probed **read-only** and asserted
unchanged (`C7a`). Mock model only
([`packages/tools/harness/mock-deepseek.mjs`](../../../packages/tools/harness/mock-deepseek.mjs)),
no real model key. Every wait is <= 180 s and every model wait aborts above 300
recorded requests (storm fuse). Credentials are redacted: everything the kit
captures (HTTP bodies, headers, log tails, merged Host log lines) goes through
`redact()` at capture, and the Host's own stdout is captured raw and redacted
before `instance.log` is finalised — the raw capture is deleted in the same step,
and [`sweep-worlds.mjs`](sweep-worlds.mjs) `--scrub-raw` repairs it if a run is
killed mid-flight. Replacements are `REDACTED-<sha256-prefix-8>`, so two
captures of the same token still line up while no artifact carries a usable
value.

## The two runners

| runner | what it drives | why it is separate |
| --- | --- | --- |
| [`a5p1-order-hazard.mjs`](a5p1-order-hazard.mjs) | the pinned **registry** in-process (the PoC's `p00-fixture.mjs`), four teardown-order arms | the hazard is a registry race; driving a whole Host around it would only add noise |
| [`a5p1-kit.mjs`](a5p1-kit.mjs) | a **booted Host** with the production `dsh-agent-team` row from this worktree's built `dist`, a real Team Session, leader + two members | the Guard only means something at the trusted assembly point, with real Agents behind it |

```bash
# both, in one run (the kit spawns the order leg first):
node tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs \
  --evidence-dir dev/agent-workflow/evidence/alpha5-pr1-host/run-1

# only the registry arms:
node tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs --out /tmp/neg1.json
```

Exit codes: `0` every criterion passed · `2` a criterion failed · `1` fatal.
Evidence lands flat in `--evidence-dir`, and the run writes its own
**`run-receipt.md`** (§12(d) real-Host Run Receipt: the baseline the Host
reported, port, world and its disposition, the dynRan before/after line and the
criteria table verbatim), so the receipt cannot drift from the artifacts it
describes. Also there: `summary.json`, `order-hazard.json`, `probe-ledger.json`,
`marker-dir.json`, `guard-observations.txt`, `member-model-views.json`,
`discovery-surface.json`, `undeclared-team-tool-evidence.json`,
`inherited-native-observation.json`, `leader-tool-results.json`, the redacted
`instance.log`, and `stable-instance-*.json`.

The kit sweeps its world on every exit route (success, FATAL, throw). For the
case it cannot cover — SIGKILL mid-run — the runner side has
`node tests/kits/a5-pr1-guard-dispatch/sweep-worlds.mjs` (`--dry`, `--scrub-raw`);
it deletes only `tests/homes/a5p1-*` directories.

## Order-hazard arms (`a5p1-order-hazard.mjs`)

The PoC measured that a call which has not reached its Body **re-resolves its
Definition at dispatch time** (`evidence/alpha5-adapter-p0/01-routing`):
lift `restrict` first and the native body runs; keep the mask and it does not.
So the disposer ORDER alone decides behaviour, and the kit must be able to see
that hazard or its green PR1 arms mean nothing.

| arm | PR1 in the loop? | parked at | assertion |
| --- | --- | --- | --- |
| `hazard` | no | pre-execute fence | **native body runs (count 1)** — the protection control |
| `safe` | no | — | native count 0 (the reverse order) |
| `pr1-parked` | yes | pre-execute fence | native 0, adapter 0, teardown refused `EXECUTION_TERMINATION_UNCONFIRMED`, mask kept, and the mask lifts EXACTLY ONCE when the refused call's own lease is ended by that refusal |
| `pr1-body` | yes | inside the Team Body (a wrapper parks the Body before its own `return`) | native 0, the Team Body completes, the lease is still held across the whole drain window, a second teardown is refused with the half-state armed |

Criteria: `NEG1-CONTROL`, `NEG1-SAFE`, `NEG1-PARKED`, `NEG1-BODY`, `NEG1-MASK`,
`NEG1-SEAM`, `NEG1-R4`, `NEG1-STABLE`, `NEG1-LEAK`. Counters from body
invocations are the evidence — never the returned prose.

`NEG1-MASK` and `NEG1-R4` are the R3/R4 laws on the real registry: an
unproven termination never lifts the mask; a lease that is still outstanding
when the drain gives up leaves `release()` refusing forever (the run does not
"look clean" a second time).

## Host legs (`a5p1-kit.mjs`)

| id | claim |
| --- | --- |
| `C1a` | the Host boots on the recorded port with the production `dsh-agent-team` row (this worktree's built `dist`) mounted, and the token gate is live (unauthenticated request = 401) |
| `C1b`/`C1c` | `team.create` over `/team-remote` starts a durable Team Session; the scripted Leader creates one governed member and one legacy member, delegates to both, and issues the `C5` re-drive — Team replies are read at the PAYLOAD level, because `status: rejected` arrives with `isError` still false |
| `C1d` | the production assembly **armed and published** the closed world per permissions-carrying Agent (Leader + governed member), with no install refusal in the log |
| `C2a`/`C2b` | **the dynRan FLIP, on the real Host**: a tool registered AFTER the Agent published and bound by nothing — `team_follow_up`, a real Team Definition with a real effect, absent from the blueprint's declared `teamTools` — is refused with the PR1 text (`team tool guard: ... has no Team Tool Binding ... closed world`) and **produced no effect**. The PoC recorded `hc-dyn-observation.dynRan = true` for this class |
| `C3` | a governed allowed call (`read` of a seeded file) still runs: a closed world, not a shutdown |
| `C4`/`C4b` | `write`, the same native Definition on both lanes, **runs on the permissions-less legacy template** (its file is created) and no Guard ever speaks for that lane (Agentless NEG-2 zero interference) |
| `C5` | the governed Agent is served **again** on a later turn with no drift: no `REVISION_DRIFT`, no `TOOL_BINDING_UNVERIFIED`, no refusal of a call it already served |
| `C6` | the ordered teardown reaches its end state at row close (no `ordered dispose STOPPED` line) |
| `C7a`/`C7b` | `:3080` reads the same before/after and was never operated; the pinned tree stays porcelain-clean |

### Observations the run records rather than asserts

| observation | file | why it is not a criterion |
| --- | --- | --- |
| **inherited native names run on BOTH lanes** — `write` created its file for the governed member and for the legacy member alike | `inherited-native-observation.json` | PR1 binds names that already existed when the Agent published (`bindingId native:<name>`) and abstains on them; whether an inherited tool may run is the **permission lane's** decision and PR1 changes nothing there. The two lanes behaving identically for this class IS the non-interference statement; PR1 owns the unbound / post-publish class, which is `C2` |
| which layer refused an unbound name | `undeclared-team-tool-evidence.json` | the text is recorded verbatim instead of assumed: the PR1 closed-world text and the pre-existing Team-tool lane are different protections and this kit must not book the second as the first |
| the **failure path cleans up too** (`--inject-fatal-after-boot`, run `fatal-f5`) | `fatal-f5/summary.json` (`cleanup`) | a forced FATAL after the boot gate, with a booted Host and a populated `DSH_HOME`: the handler stops the Host, sweeps the world and RE-CHECKS 500 ms later (`verified absent`), and the run trace stays. Liveness is probed with `kill(pid, 0)`, not with the child's `exited` flag — that flag needs an event loop this path no longer has, and it reported a dead process as alive |
| a **preset row cannot register a tool** on this Host | `probe-ledger.json` (`register ... ok: false`, `cannot get property "tools" without inject`) | measured, not argued. That scope also accepts `agent/created` / `tools/pre-execute` subscriptions that are **never delivered**; an earlier revision of this kit built the H6 hazard on exactly that and returned a run of silence — green criteria on a hazard that never appeared. The hazard therefore uses a name the Host contributes after publish (`C2`), and the probe row stays only as an observer that reports its own liveness |

## Disclosed boundaries (asserted, not glossed)

* **`NEG1-SEAM` — the seam order, measured (and a correction on the record).**
  Neither `tools/pre-execute` nor `tools/execute` resolves its `next()` after a
  Body returns. An earlier revision of this kit also recorded
  `tools/post-execute` as firing *before* a parked Body returned, and released
  the lease there as the best available approximation. **That measurement was
  vacuous**: the arm's park did not hold the Body open (the obs tail read
  `wrapper-enter → body → wrapper-return` before the teardown ran), so the call
  had already completed and any order it reported was meaningless. With the park
  made real, the pinned registry says the opposite — `tools/post-execute` and
  `tools/result` both fire only AFTER the Body returned, while the Dispatcher's
  lease is still held across the whole window. The law follows: `post-execute`
  only RECORDS that a result is in hand; the lease ends at `tools/result`, the
  registry's final emit edge (`finishScheduledExecution → notifyResult`, on the
  success AND the error path). A call that never reaches a Body — a refusal at
  the Guard or at either state gate — ends its own lease at the refusal, because
  "this call's Body never ran" is our own act, not host evidence.
* So the self-count bounds *"outer door → the call's own settled or refused
  edge"*, strictly weaker than *"no Body is running"*. What protects the
  native-body hazard is the **state gates at both doors plus the mask never
  lifting before `RELEASED`** — never the mask alone. A lease that cannot end
  fails CLOSED (`release()` refuses, the mask and Guard stay armed;
  `TERMINATION_UNCONFIRMED`).
* This lane reads **no clock** (pinned by test `S7`); the finite-clock law
  (NaN / ±Infinity typed fail-closed, `body = 0`) is Admission's in PR2.
* Coverage Gate stays FATAL as a diagnostic; the Guard is the safety line
  (`C2` is the criterion that would fail if that division of labour were wrong).
* **Post-publish registration by a third-party row is not reachable on this
  Host** (measured, see the observation table), so the Host leg cannot grow its
  own unbound name. The post-publish *timing* is covered where it can be driven
  deterministically — the `pr1-parked` / `pr1-body` arms and the lane's unit
  tests — while the Host leg covers the class the Host itself produces (`C2`:
  registered after publish by the Team glue). Both are stated separately in the
  PR body rather than merged into one claim.
