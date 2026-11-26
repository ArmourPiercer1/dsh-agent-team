# ROUND 125 — the `d3` in-flight window is a real, KERNEL-BLOCKED window

Head `b1b6a0478…` + this round's commit (see `README.md` §5 for the frozen SHA). Branch `vnext/a1-cut`,
PR **#822 stays DRAFT**, `:3080` untouched, **CORE PATCH BUDGET = 0**, no upstream patch, no history rewrite.

**This round changes the crash arm's METHOD, not its judge.** The round-124 defect is reproduced here as a
fact, not a story:

```
[2026-11-26T01:16:02.690Z] [boot2] FAILED at sigkill-restart: Error: no genuine in-flight call at crash
  time: call-d3-b-inflight-edit settlement state="FAILED" … (the crash judge cannot fake an in-flight call)
```

The in-flight record was an `edit` of a **256 MiB** file: the call's settlement was expected to stay open
because the write was slow. On boot 2 the write finished (or failed) *before* the driver's SIGKILL, so the
two boots disagreed on `inflightBefore` (`open` vs not) and the pair judge failed. The judge was right to
refuse — a crash judge must never fabricate an in-flight call. The window was a **timing hope**, not a
condition.

## 1. The mechanism — a FIFO with no reader is a kernel-level block

`tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs`, in-flight provider (default
`A5SF_D3_INFLIGHT_MODE=blocked`):

1. the driver creates a FIFO in Member B's write lane (`inflight-write.fifo`) and opens **only** the read
   end, `O_RDONLY | O_NONBLOCK`. No other process holds a read end.
2. Member B's admitted call is a governed **`bash`** whose command is FINITE and redirects into that FIFO:
   `i=0; while [ "$i" -lt 2097152 ]; do printf '%s' 'DBOOT_D3_INFLIGHT_FIFO_WRITE'; i=$((i+1)); done > FIFO`
   — exactly **58,720,256** bytes.
3. the kernel pipe buffer (65,536 B here) fills; the writer's `write(2)` parks in `pipe_write` /
   `anon_pipe_write`. The tool body cannot return, so the settlement stays `RUNNING`.
4. the driver reads **one** pipe buffer (≤ 65,536 B — proof bytes actually flowed), then **stops reading**.
   The command can now complete only if the driver drains the remaining ~58.6 MiB, which it never does.
5. the driver re-reads the settlement after a 400 ms settle: it must still be `RUNNING`. Only then does it
   SIGKILL the host pid.
6. after the SIGKILL the driver closes its read end (`pipeClosedAfterKill`), so a surviving writer would get
   `EPIPE`/`SIGPIPE` — the window ends exactly at process death, never on a timer.

The command is finite on purpose: an infinite loop would be "unstoppable" even if the pipe were drained,
which would prove nothing about the kernel block. With a finite command, completion is gated **only** by the
reader, i.e. by the kernel pipe object.

**Why the in-flight call is `bash` and not `edit`/`write`.** The product's edit law opens the target
`O_RDWR | O_NOFOLLOW` and requires a **regular file** (`packages/runtime/controlled-fs/src/post-consume-edit.ts`;
`post-consume-write.ts` refuses a non-regular pre-open target). A FIFO is therefore refused `not-a-file` by
`edit`/`write`, and a regular-file write cannot be parked in the kernel without root/FUSE. The governed
`bash` tool is a real admitted call on the `process.exec` axis, so the blocked writer is a real tool call the
product actually admitted — the same honesty requirement the judge enforces.

## 2. Fail-closed — no window, no kill

- `waitInFlight` (blocked mode) returns only on `RUNNING`. If it sees `ADMITTED` or a terminal state it
  refuses the pair instead of guessing.
- `killAndRestart`'s gate is `before.bOpen.state !== 'RUNNING'` → it writes `inflight-refusal.json`
  (`sigkillIssued:false`, `killRefused:true`, `hostPidAliveAtRefusal`) and throws the **existing** named
  reason `no genuine in-flight call at crash time: <callId> settlement state=… fact=… (the crash judge
  cannot fake an in-flight call)`. The host is left alive; no `crash.json` is written.
- If `mkfifo` or the read-end open fails the boot refuses before the call with
  `A5SF_D3_INFLIGHT_BLOCK_UNAVAILABLE: …` instead of racing.
- The judge got **stronger**, not weaker: `inflight-was-open-at-crash` now requires `state === 'RUNNING'`
  (no more `'open'` normalization), and a new clause `inflight-window-blocked-in-kernel` requires
  `blocked === true`, `bytesObservedInPipe > 0`, `stateAfterSettle === 'RUNNING'` and
  `bytesDrainedOfCommand < commandIntendedBytes`.

## 3. Controls

**Positive** — the new judge clause is only reachable when the kernel block is measured, and it is
evidenced per boot in `runs/boot0N/inflight-block.json`. Best-effort corroboration: the driver also
locates the writer in `/proc` by an fd opened `O_WRONLY` on the FIFO (never its own reader) and records
`wchan`; on both hosts it read `state=S wchan=anon_pipe_write`, i.e. the kernel's own name for the sleep.

**Negative** — `A5SF_D3_INFLIGHT_MODE=fast` runs the same arm with a provider that completes immediately
(`printf … > inflight-fast.txt`). The driver must NOT kill: it writes `inflight-refusal.json` and fails at
`sigkill-restart` with the same named reason. `--expect-inflight-refusal` grades six checks:

| check | legacy | next |
| --- | --- | --- |
| `boot-failed-at-sigkill-restart` | PASS | PASS |
| `refusal-reason-is-the-named-reason` | PASS | PASS |
| `settlement-was-not-running` (`COMPLETED`) | PASS | PASS |
| `no-sigkill-issued` (`sigkillIssued=false killRefused=true`) | PASS | PASS |
| `host-left-alive` (`hostPidAliveAtRefusal=true`) | PASS | PASS |
| `no-restart-recorded` (`crash.json` absent) | PASS | PASS |

Artifacts: `controls/negative-legacy.json`, `controls/negative-next.json`,
`controls/negative-*.log`; the driver's canonical copies live under
`dev/agent-workflow/evidence/d-boot-feasibility/d3/controls/`.

## 4. The six measured runs — three per host, two boots each

Every run is a full `run-boot-d3.mjs` (two boots, all four `d3` judges). Console output, agreement, per-boot
counters, `inflight-block.json` and `crash.json` are preserved under `runs/<host>-run<N>/`. `inflightBefore`
is the **raw settlement state** read before the kill (no normalization anywhere).

| run | host | boot 1 `inflightBefore` | boot 2 `inflightBefore` | bytes in pipe (b1 / b2) | writer `wchan` | pair | exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `legacy-run1` | 0.2.0-rc.2 @ `639ed01539` | **RUNNING** | **RUNNING** | 30,184 / 51,352 | `anon_pipe_write` | `agreeing=true` | 0 |
| `legacy-run2` | 0.2.0-rc.2 @ `639ed01539` | **RUNNING** | **RUNNING** | 65,408 / 30,016 | `anon_pipe_write` | `agreeing=true` | 0 |
| `legacy-run3` | 0.2.0-rc.2 @ `639ed01539` | **RUNNING** | **RUNNING** | 40,964 / 1,876 | `anon_pipe_write` | `agreeing=true` | 0 |
| `next-run1` | 0.2.2-rc.5 @ `9c2670d3bc` | **RUNNING** | **RUNNING** | 65,408 / 65,408 | `anon_pipe_write` | `agreeing=true` | 0 |
| `next-run2` | 0.2.2-rc.5 @ `9c2670d3bc` | **RUNNING** | **RUNNING** | 65,408 / 65,408 | `anon_pipe_write` | `agreeing=true` | 0 |
| `next-run3` | 0.2.2-rc.5 @ `9c2670d3bc` | **RUNNING** | **RUNNING** | 65,408 / 65,408 | `anon_pipe_write` | `agreeing=true` | 0 |

**No run disagreed.** Every boot: settlement `RUNNING` at observation, still `RUNNING` after the settle,
`blocked=true`, `bytesObservedInPipe > 0`, drained bytes ≪ 58,720,256, kill `exit={"code":null,
"signal":"SIGKILL"}`, `pidGone=true`, `portFree=true`, `pipeClosedAfterKill=true`; after restart the
in-flight record is `UNKNOWN` (`inflightAfter=UNKNOWN`) and the completed `read` is byte-identical.

**The aborted attempt is kept.** `archive/2026-11-26T02-01-31-786Z/` is the first six-run attempt, stopped
deliberately after boot 1 because the `/proc` writer probe matched the **driver's own read end**. The probe
was fixed (skip own pid; require an `O_WRONLY` fd via `fdinfo.flags`) and all six runs above were measured
with the SAME driver bytes. The archive is the repair trail, not a measured run.

## 5. Gate + dispatch — the machine verdict is PASS; the workflow job is RED on a BINDING-STEP defect

**Frozen SHA:** `e07f431e9c599eaa73ede15996ae36808b8a3750` (pushed to `vnext/a1-cut`; the PR stays DRAFT).

**Local gate block at that SHA** — every command exit 0, logs in `gates/`:

| gate | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | `suites=8 files=8 exit=0`, 268 / 265 pass / 0 fail / 3 skipped, set `sha256:0b087a6a…` |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=790 collected=738 excluded=14 uncollected=38 findings=0` |
| `ute-cut-closure --check` | `cut(0/148) prodRefs=0 distResiduals=0 findings=0` |
| `ute-p0-assets --check` | `modules=37 files=180 lines=69512 cut(148/148) findings=0` |
| `docs-sync --check` | `docs=193 findings=0 blocking=0 contracts=20` |
| `place-dist-glue` | 36 placements, byte-identical |
| `eb3-ci-required` | `pass workflows=11 findings=0` |
| bound vitest | `PASS suites=15 files=15 passed=238 failed=0` |
| `eb3-run-manifest` | `pass records=662 strict=0 incomplete=11 findings=0` |
| UTE G1 argv (9 files) | `tests 89 / pass 89 / fail 0 / skipped 0` |
| verifier unit | `tests 22 / pass 22 / fail 0` |
| `ci-pr-gate --full --census-captures 2` | **`DSH-CI-VERDICT pass pass=10 fail=0 skip=0 refused=0 legs=10`** (305.9 s) |

**The ONE dispatch.** `gh workflow run candidate-acceptance.yml --ref vnext/a1-cut -f
head=e07f431e9c599eaa73ede15996ae36808b8a3750` → run **`45746665143`** (`workflow_dispatch`, created
2026-11-26T03:05:33Z). It was dispatched exactly once and was **not** retried.

**Measured result — the gate PASSED, the binding step failed, the receipt does not exist:**

```
CANDIDATE-GATE pass host=legacy judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
CANDIDATE-GATE pass host=next   judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2 env-limited=0
```

per host: `d`, `d2`, `d3`, `d4` all `pass`; `d3 RESULT evidence-complete=true allProven=true (2/2 boots;
agreeing pair=true)` with the hosted in-flight lines

```
legacy boot1 RUNNING, bytesObserved=19768  blocked=true wchan=anon_pipe_write
legacy boot2 RUNNING, bytesObserved=65408  blocked=true wchan=anon_pipe_write
next   boot1 RUNNING, bytesObserved=38948  blocked=true wchan=anon_pipe_write
next   boot2 RUNNING, bytesObserved=39704  blocked=true wchan=anon_pipe_write
```

(`hosted/<host>-d3-inflight-lines.txt`, `hosted/<host>-d3-agreement.txt`: `inflightBefore RUNNING RUNNING`,
`inflightAfter UNKNOWN UNKNOWN`, `agreeing=true differing=[]`).

**The job is nevertheless RED, and the root cause is in the workflow, not the gate.** Step 16 (`Candidate
acceptance gate — both pinned hosts, one machine verdict`) is `success`; step 17 (`Bind the graded head to
the requested SHA`) is `failure`:

```
VERDICT=$(find dev/agent-workflow/evidence/candidate-acceptance-gate -name verdict.json … )   # RELATIVE path
GRADED=$(node -e "const j=require(process.argv[1]); …" "$VERDICT")
Error: Cannot find module 'dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-26T03-15-42-275Z/verdict.json'
```

`require()` treats a specifier that does not begin with `./` or `/` as a package name, so the freshly
written verdict could not be loaded. The artifact's own `verdict.json` proves the head binding would have
succeeded: `"head": "e07f431e9c599eaa73ede15996ae36808b8a3750"`, `"verdict": "pass"`. Because step 17 died,
step 18 (`Publish version-gate-receipt.json`) was **skipped**, no receipt exists, and the separate
`version-gate (Required at frozen candidate SHA)` job concluded **failure** with the fail-closed line

```
REFUSED VERSION_GATE_RECEIPT_MISSING …/version-gate-receipt.json does not exist
```

(exit 1, `hosted/version-gate-refusal.log`; the workflow conclusion is `failure`.)

**Honest reading.** The dual-host gate's 62 judges are measured **pass at this frozen SHA** (60 PROVEN, the
same 2 enumerated `known-refuted`), and the `d3` crash arm — the round's subject — passed 4/4 on **both**
hosts with the kernel-blocked window. The Required `version-gate` context is **not** green, because the
receipt was never published: the next round must fix the binding step (`path.resolve` / absolute `find`
root / `fs.readFileSync` + `JSON.parse`) and dispatch again. **No green is claimed for the Required context,
no capability row moves, and nothing is PRODUCT-PROVEN.** Evidence: `hosted/` (`verdict.json`,
`summary.txt`, `grading-summary.log`, `head-binding-failure.log`, `version-gate-refusal.log`, per-host
`d3` logs and agreements).
