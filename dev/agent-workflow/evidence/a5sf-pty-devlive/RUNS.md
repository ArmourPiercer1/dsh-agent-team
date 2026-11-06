# RUNS — a5sf-pty-devlive

Nine authorised Host starts on the pinned Host
(`0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`), each one World, each
one `DEV-LIVE` ledger row (`budget-intent` + `boot` + `dev-live-outcome`), each
torn down and recorded. Authority: owner ruling 2026-11-09; grant
[`dev-live-grant.json`](dev-live-grant.json); port family 3180 only; at most two
concurrent dev Hosts (`DEV_LIVE_SLOT_LIMIT = 2`); `:3080` never touched.

**Stable pair: `run-08` and `run-09`** — six identical verdicts, identical facts,
no code change between them.

| run | purpose | cause (what went wrong) | fix | result |
|---|---|---|---|---|
| 01 | first live look; settle all five questions | **judge, ×4**: (a) Q1/Q2 read `/proc/<pid>` from the *driver's* PID namespace and `ps -o tty=`, so a real PTY looked fake; (b) `MK_PTY_WORKER` is a prefix of `MK_PTY_WORKER2` and was matched first, so the control Member got text and never ran `bash`; (c) `typedCode` read only `error.info.code`, which the product does not populate, so two real refusals judged FAIL; (d) the kernel arm declared an **out-of-lane** read, so admission refused and the kernel was never asked (a LOCUS error) | shell reads its own `/proc/$$/stat` (`tty_nr` is a device number); non-prefix markers + most-specific-first routing; typed code from four sources (`error.info`, probe row, message prefix, guard fact); kernel arm declares an **in-lane** read so the kernel is the layer asked; added the `pty_observe` service witness | **FAIL**, 2 PASS / 4 FAIL. Real findings already visible: same `$$` for two commands; product `bash` returned the write-only secret; chmod gap reproduced; `NETWORK_UNCONFINED_REALM` with 0 processes |
| 02 | verify the run-01 fixes | **instrument**: `ReferenceError: observeSessions is not defined` — a leftover identifier from the refactor to `observeOn`, at the Q1 log line | removed; added an **eslint `no-undef` gate** over all four instrument modules (the check `node --check` cannot make); the config is [`eslint-no-undef.config.mjs`](eslint-no-undef.config.mjs) and it must report **0 errors** before a start | **aborted at `member-bash-calls`, 0 verdicts.** Ledger still one boot, teardown clean |
| 03 | re-measure with the fixed judge | **judge, ×2**: (a) Q1/Q2 gated on `/proc/$$/stat` field 6 (`session`), which is **0** across PID namespaces, and Q2 also gated `sameSession`; (b) the network judge demanded exactly **one** guard fact, but the shipped face throws `ConfinedSubprocessRefusal` *before* the guard, so the empty sink is correct | Q1 replaced the session check with `tty_nr`↔`fd0` device consistency; Q2 dropped session gating; network judged on the typed refusal + 0 processes, and the 0 guard facts recorded as the **LOCUS** rather than a failure; `pty_observe` added on the control Member too | **FAIL**, 3 PASS / 3 FAIL. Q4 confirmed twice (01, 03); Q3 face PASS; Q5 still judged FAIL |
| 04 | re-measure | **judge**: the shared-state commands used a **relative** `cd lane/inside`, but the shell starts in the **Host checkout**, so the `cd` failed and the cwd assertion was unmeasurable; the `SHARED_SEEN` echo never made it into the command array (a replacement that did not apply) | absolute lane path interpolated per run; explicit setup/read commands; shell start cwd captured **before** the `cd` | 5 PASS / 1 FAIL (Q2 only) |
| 05 | re-measure after the command fix | **instrument, and this one is a FALSE PASS**: the "second" command was derived from the first by renaming `RUN=1`→`RUN=2`, so it re-`export`ed and re-`cd`'ed before reading — the observation created the state it reported. Caught by reading the **control Member's raw `tool_result`**, which also "saw" the token because it had exported it too | split into three distinct commands: `setup` (writes state), `read` (no export, no cd), `control` (the read command verbatim, on a second Member) | 6 PASS — **but Q2 is invalid and this run is superseded** |
| 06 | repeat for stability | same as 05 (no code change) | — | 6 PASS — **also superseded**: a second false pass is not stability |
| 07 | re-measure with the split commands | **instrument**: the control arm still used a **divergent mini-parser** that never read `SHARED_SEEN`/`CWD`, so a control that behaved correctly (`UNSET` + its own start directory, visible in the raw text) judged FAIL | one parser (`ptyOf`) for every arm, control included | 5 PASS / 1 FAIL (Q2 only) |
| 08 | re-measure | — | — | **PASS 6/6** |
| 09 | second consecutive run, no code change | — | — | **PASS 6/6**, facts identical to run-08 → **stable** |

## What the stable pair measured

| fact | run-08 | run-09 |
|---|---|---|
| PTY service backends | `["shell"]` | `["shell"]` |
| measured Member's session | `pty-1`, `type: shell`, `pid: 141`, `running` | identical |
| control Member's session | `pty-2`, `pid: 243` | identical |
| shell `tty_nr` / `fd0` | `34816` (136:0) / `/dev/pts/0` | identical |
| shell start cwd | Host checkout (`…/tests/deepseek-harness-test-use`) | identical |
| state across two calls (`export` + `cd`) | survives (read command sees both) | identical |
| control sees the state | `UNSET`, own start cwd, `tty_nr` 34817 | identical |
| product `bash` read of the write-only secret | bytes returned, exit 0 | identical |
| confined read refusal | `IO_READ_DENIED`, 0 provider calls, 0 bytes | identical |
| kernel arm (declared in-lane read, out-of-lane `cat`) | admitted, child ran, no bytes, child failed | identical |
| `chmod` gap | `644 → 600`, 0 guard facts, no declaration | identical |
| `network: deny` | `NETWORK_UNCONFINED_REALM`, 0 processes, 0 guard facts | identical |
| teardown | `portClosed=true homeRemoved=true` | identical |
| ledger | `boots=1 planned=1 aborts=0 outcome=1`, class `DEV-LIVE` | identical |

## Ledger rows

Nine `DEV-LIVE` rows, one per start, all with
`recordClass: 'DEV-LIVE'` in the boot row and
`devLiveOutcomeRecorded: true`. Per-run copies:
[`runs/run-NN/ledger.json`](runs/run-08/ledger.json) and the append-only
[`runs/run-NN/run-ledger.jsonl`](runs/run-08/run-ledger.jsonl).

**No row in this lane can produce `V@B=yes`**; `DEV-LIVE` is a record class the
run-record finalizer refuses to grade as candidate evidence.

## Hygiene

* Ports: each run bound and released its own 318x port; `ss -ltn` after the last
  run shows only the *other* lane's `3181`. `:3080` untouched.
* `DSH_HOME`: one `tests/homes/u5a5sfptydv-<stamp>/` per run, all removed
  (`homeRemoved=true`); `ls tests/homes` is empty.
* Pinned host checkout: `git status --porcelain` empty throughout
  (`hostPin 639ed01539…`, `CORE_PATCH_BUDGET = 0`).
* Concurrency: never more than one of this lane's Hosts at a time; the slot limit
  is asserted (`lease.holdsSlot()` right after `lease.boot()`).

## Escalation rule

Three consecutive same-cause failures without new diagnostic information ⇒ stop
and escalate. **Never triggered**: every failing run had a *different* cause and
each produced new information (the closest thing to a repeat is 05→06, which was
a deliberate no-change repeat and was superseded on its own evidence).
