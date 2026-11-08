# PD20-LIFECYCLE — the two C-face lifecycle/transport-honesty defects, measured AFTER the fix

**Lane**: `task/pd20-lifecycle-20261114` · worktree `.worktrees/pd20-lifecycle` · base `origin/master` = `9a37321fb`
**Faces**: Subprocess (`bash` → PD-12 confined subprocess shadow / PD-13 confined terminal) + the Team
lifecycle authority's `close-admission` step.
**Register rows**: `PD-20 (B1-LIFECYCLE-CLOSE)` and `PD-21 (C3-CLOSED-SCHEMA)` in
`docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` (the register's own law is `PD-1…PD-n` contiguous: #669 landed PD-16…PD-19 for four other
defects while this branch was open, so these two rows take the next free pair, **PD-20** and
**PD-21**; the ids below name *this round's* findings and are not a second series).

**Draft PR**: #670 (first line `PD20-LIFECYCLE` — do not merge, do not settle).
**Record class**: `DEV-LIVE` (`eligible=false`). Two real boots of the SHIPPED governed Member
preset, agreeing on every judged row. This is **not** merge/candidate evidence: the parent re-tests.

---

## 0. The two sentences this lane must be able to defend

1. **After the archive request and before the durable commit, the archived Member CANNOT start a new
   execution.** Its next tool boundary is refused with `LIFECYCLE_ADMISSION_CLOSED`, no confined
   session is created, no child process is spawned — while the command that was ALREADY running keeps
   running to completion (the turn is **not** cancelled).
2. **A model that sends `run_in_background` gets a typed `BACKGROUND_NOT_SUPPORTED` refusal** whose
   text says there is no managed-job producer and the command must run in the foreground. The command
   does **not** execute, no job id is minted, and the argument is no longer silently dropped.

Both are measured below, in the same boot, on the same fixture that produced the pre-fix numbers in
`dev/agent-workflow/evidence/a5sf-recon-shell/README.md` §B-1 / §C-3.

---

## 1. What changed (and why this option, not the doc-only fallback)

B-1 offered two honest outcomes: implement the interruption, or narrow the documentation to the
measured behaviour. **We implemented it**, because the chokepoint already existed:

| file | change |
|---|---|
| `packages/runtime/lifecycle/admission-state.ts` | **new** module: the published "this Member's admission is closed" stamp (`markMemberAdmissionClosed` / `clearMemberAdmissionClosed` / `memberAdmissionCloseOf` / `memberAdmissionCloseOfSession`) and `LifecycleAdmissionClosedError` (code `LIFECYCLE_ADMISSION_CLOSED`, instance, root session, refused method/target). Keyed by BOTH `instanceId` (the lane guard's key) and `childSessionId` (the bindings' key), first stamp wins, idempotent. |
| `packages/runtime/team-services/src/fs.ts` | `createMemberFsGuard` — the single admission boundary in front of **every** Member execution face (confined `fs`/`subprocess`/`terminals`/search/web) — consults the stamp **before any lane decision** and throws the typed error. |
| `packages/runtime/lifecycle/quiesce.ts` | the QUIESCE PROCEDURE publishes the stamp itself right after `AdmissionClosePort` step 1 returns, and `reopenAdmission` drops it on every exit (committed / aborted / faulted) — the lifetime is the procedure's, and the digest-locked protected center (`agent-bindings.mjs`) needs **no** diff. |
| `packages/tools/src/tools.ts` | `team_archive_member`'s promise rewritten: close at the request, **next tool boundary refused** with the typed code, in-flight turn **not** cancelled, call returns once the turn settles, then the durable commit(s). |
| …same file (`quiesce.ts`) | its step-1 header now names the reader (the lane guard) and the measured window; step 2 (public Agent `cancel`) says plainly that it stops activity at its next step but does not abort an already-running tool call. |

Why not the doc-only fallback: `closeAdmission` had exactly **one** consumer — the Team tool-dispatch
route. A RUNNING Member's own turn never passes through it, which is why the recon measured new
sessions *after* the archive request. `createMemberFsGuard` was already the single admission boundary
for every execution face and `close-admission`/`reopenAdmission` are exactly lifecycle step 1 and its
exit, so the fix is one published state + one reader: **no second policy source**, no cyclic
dependency (`lifecycle` imports nothing from `team-services`), **no upstream patch**.

The publishing point is the procedure, not the live binding: `packages/runtime/src/plugin/live/agent-bindings.mjs`
is inside ARC-A's digest-locked **protected center** (family additions must not move it), and the
fix needs no diff there at all — the state is published where step 1 is executed. The rejection of the
first attempt is itself evidence: the fitness gate `u6-arc-a-fitness` went RED with
`digest-drift … agent-bindings.mjs` and the change was moved, not booked as an override.

The docs were narrowed *as well*, because "current work is interrupted" is still stronger than
reality: the in-flight turn is not cancelled, only its next tool call is refused. Both halves are
required — an implementation without the honest wording would still over-promise.

### C-3

| file | change |
|---|---|
| `packages/runtime/src/plugin/live/closed-tool-arguments.mjs` | **new** helper: `assertClosedArguments(toolName, args, declared)` refuses any undeclared key as `UNSUPPORTED_PARAMETER`, and `run_in_background` specifically as `BACKGROUND_NOT_SUPPORTED` ("no managed-job producer … REFUSED instead of silently dropped … run it in the foreground"). |
| `packages/runtime/src/plugin/live/confined-terminal-tool.mjs` | `execute` calls the helper before touching the terminal face (`command`, `description`, `workdir`). |
| `packages/runtime/src/plugin/live/confined-bash-tool.mjs` (PD-12 shadow) | same, with its own declared set (`+timeoutMs`). |
| `scripts/dist-placements/180-a5sf-pd20-closed-arguments.json` | the helper rides the dist mirror, otherwise the byte-copied shell modules would fail at member setup with `ERR_MODULE_NOT_FOUND`. |

Typed rejection (not "support it") is the minimal honest shape: this preset has **no managed-job
producer** (the host `tool-jobs` row is registered but nothing mints a job), so implementing a
background lane would be a new capability, not a bug fix.

---

## 2. Method

* Fixture: the SHIPPED governed Member preset (`preset-a5sf-governed-member`) on the real host
  (`tests/deepseek-harness-test-use`, pinned `639ed01539…`), exactly as `a5sf-recon-shell` did; the
  driver is `run-boot.mjs` here (retargeted copy — the shell-surface, dynamic-read, denied-lane and
  revoked-entry arms are KEPT as controls, so a failure to admit ordinary work would also be caught).
* One World per boot, `DSH_HOME` under `tests/homes/u5u5a5sfsub1-*`, host port from the 3180 family
  (measured: 3188), mock provider on 3497. The stable `:3080` instance is never touched.
* DEV-LIVE slot lease per boot (`tests/world-factory/lib/dev-live-slots.mjs`, grant
  `devlive-subprocess-1`, face `Subprocess`, world `u5a5sfsub1`); ≤2 concurrent; the driver's
  `preRegisterDevLiveBudget` books the intent, and the ledger (`run-ledger.jsonl`) shows one intent +
  one world per boot.
* Pinned host tree read-only: `host-tree-porcelain.txt` = `empty`, and the driver logs
  `host porcelain before/after: []`. `git status --porcelain` of the pinned tree was empty before and
  after both boots.
* Boots: **2** (`runs/boot01`, `runs/boot02`), `--boots 2`, `RESULT PASS (2/2 boots; agreeing
  pair=true)`; `agreement.txt` lists every compared fact.

### The B-1 timing arm (why it is probative)

The Leader archives Member B **while B's first command is still running**, and B then issues a second
`bash` — the exact shape the recon measured. The leader script polls `team_collect` until B reports
`running` and then HOLDS the archive for 2.5 s in real collect round trips, so the `sleep 8` child is
unambiguously mid-flight when the archive request lands. Measured (boot01 / boot02):

| fact | boot01 | boot02 |
|---|---|---|
| B's first `bash` issued | 00:33:42.258Z | 00:36:57.175Z |
| archive(B) request issued | 00:33:44.800Z (+2.54 s) | 00:36:59.712Z (+2.54 s) |
| B's first result (command finished) | +8.15 s after its call, `exitCode=0` | +8.16 s, `exitCode=0` |
| B's second `bash` issued | 00:33:50.439Z (+5.64 s after the request) | 00:37:05.359Z (+5.65 s) |
| archive's tool result observed (commit window closed) | +5.83 s after the request | +5.86 s |
| second call's outcome | **refused**, `LIFECYCLE_ADMISSION_CLOSED` | **refused**, `LIFECYCLE_ADMISSION_CLOSED` |
| refusal returned before the commit was observed | 190 ms | 207 ms |
| Member B guard facts (`guard-facts-B.json`) | `shellRead allow`, `spawn allow`, `spawn:write allow` — **one** admitted command, nothing for the second call | identical |

The second call was **inside** the archive's commit window in both boots
(`ordering.bSecondAboutArchive = INSIDE_COMMIT_WINDOW`) — i.e. in the very interval where the recon
measured a NEW confined session (`8.56 s` / `8.72 s`).

---

## 3. BEFORE → AFTER

### B-1 (`a5sf-recon-shell` §B-1, quoted from that README)

> Measured: after the archive request the Member's route-C `bash` still obtained NEW confined sessions
> inside the quiesce window (**8.56 s / 8.72 s** after the request), and the second `bash` completed
> **290 / 427 ms** before the durable commit. The docs promised "its current work is interrupted".

### B-1, now

```
call-rc-b-long    isError=false  {"kind":"confined-terminal","exitCode":0,
                                  "stdout":"A5SF_RC_B_START=…\nA5SF_RC_B_TTY=not a tty\nA5SF_RECON_SHELL_IN_LANE_BYTES\n"}
call-rc-b-second  isError=true   Error: LIFECYCLE_ADMISSION_CLOSED: instance 'inst-…' of team 'session-a5sf-rc-team'
                                 has an archive/dispose in flight in this process (close-admission → interrupt →
                                 drain → quiesce → release residency → commit; Architecture §30.1), so the NEXT tool
                                 boundary refuses new execution (refused: method 'shellRead', target '…/in-lane.txt').
                                 The in-flight turn is not cancelled by this refusal; it simply cannot start new work, …
```

* one `spawn` for B (the first command), **zero** for the second call — the refusal precedes any lane
  decision, so there is no child to count;
* the first command's own bytes are in its result (`A5SF_RC_B_START`, the in-lane read) — the close did
  **not** abort it;
* `ptyHolders = 0` in both boots.

**Interpretation.** The promise "the current work is interrupted" is now true in the only sense it can
be without retroactively killing a running tool call: the Member cannot start anything new, and the
turn ends when its current step finishes. That is exactly what the narrowed docs now say.

### C-3 / B-2, now

```
call-rc-a-bg     isError=true   Error: BACKGROUND_NOT_SUPPORTED: bash — this shell has no managed-job producer:
                                every command runs in a FRESH foreground confined child, so no job id is ever created
                                and there is nothing to list, read or kill. The parameter was REFUSED instead of
                                silently dropped. Run the command in the foreground …
call-rc-a-joblist isError=false (no background jobs)
```

* no `confined-terminal` record for the refused call, the command's marker never appears in any tool
  **result** (it exists only inside the model's own tool-call arguments, which is what "not executed"
  means);
* no `job-…` id anywhere in the transcript;
* the model-visible `bash` schema still has no `run_in_background` (`member-A-surface` is written by the
  driver: properties = `command, description, timeoutMs, workdir`), and `job_list` still answers the
  host tool's **free text**.

### The deferred `job_*` hint (recorded, not implemented)

`job_list` / `job_output` / `job_kill` come from the host `tool-jobs` row and have **no producer** on
this preset, so they cannot mint a job and answer free text. A typed `BACKGROUND_NOT_SUPPORTED` for
them would need a realm shadow of three host tools — a model-visible surface change plus
surface-accounting risk, i.e. larger than "minimal" and outside the measured defect (the defect is the
silently dropped *parameter*). Recorded as the residual in `PD-21`; the C-3 fix at least makes the
absence *loud* where the model actually asks for background work.

---

## 4. Judged rows (both boots identical)

`RUN-SUMMARY … overall=PASS cases=8 PASS:8`, `agreement.txt` → `agreeing=true differing=[]`.

| case | class | what it proves |
|---|---|---|
| `pd20:bash-admitted-read-control` | control | the lane still admits an in-ceiling read on a fresh confined child (`not a tty`, live `ps`) |
| `pd20:bash-denied-read-control` | control | `IO_READ_DENIED`, zero secret bytes, no confined child |
| `pd20:bash-denied-write-control` | control | a redirect target is not a read intent: the command runs, the OS profile refuses the write, no file |
| `pd20:bash-dynamic-read-control` | control | `$VAR` / `$(…)` resolve to the same denial, no bytes |
| `pd20:surface-shell-and-jobs-control` | control | the model-visible `bash` is the closed schema and `job_*` are present-but-empty |
| `pd20:c3-run-in-background-typed-refusal` | **target** | `BACKGROUND_NOT_SUPPORTED`, zero execution, no job id, free-text `job_list` |
| `pd20:b1-archive-window-refusal` | **target** | the 10 clauses of §2/§3: mid-flight archive, running command completes, second call refused typed, no spawn, new generation still works |
| `pd20:revoked-session-entry-control` | control | after the durable ARCHIVED commit the revoked session entry still obtains no terminal |

---

## 5. What this evidence does NOT claim

1. **The in-flight turn is not cancelled.** A tool call that is already running finishes. Only the next
   tool boundary is refused. The doc text and the register row say this explicitly.
2. **Not candidate evidence.** `recordClass=DEV-LIVE`, `eligible=false`; one host, one preset, two boots.
   The parent re-tests; nothing here is a matrix grade or a `V@B` change.
3. **`job_*` still answers free text.** Deferred and recorded (§3, `PD-21` residual).
4. **Only the shell faces were driven.** The stamp is consulted by the one lane guard every Member
   execution face uses, and the host-free suite
   `packages/runtime/test/a5sf-pd20-admission-close.test.ts` exercises the guard directly for
   `subprocess`/`fs`/`terminals`-shaped methods, but this boot only issued `bash` calls.
5. **The close stamp is in-process state.** A Member whose process ended cannot be reached by it — there
   the durable row is the authority, which is unchanged.

---

## 6. Host-free companions (no boot)

* `packages/runtime/test/a5sf-pd20-admission-close.test.ts` — 6/6: control arm admits, closed arm refuses
  spawn/`spawn:write`/read/write with the typed code + instance/root/method, close-before-lane (an
  out-of-lane target answers `LIFECYCLE_ADMISSION_CLOSED` while open answers `IO_READ_DENIED`), reopen
  restores (and reports idempotent `false`), keying by instance AND session with first-stamp retention,
  empty identity throws.
* `packages/runtime/test/a5sf-pd20-closed-arguments.test.ts` — 6/6: helper classification, accepted keys
  pass, non-object refused, the terminal `bash` registration stays closed (`additionalProperties:false`),
  and `execute` with `run_in_background` refuses with **zero** spawns — for both shell modules.
* p4t6 booking: `packages/testkit/test/p4t6-bookings/pd20-lifecycle.json` (4 paths, measured delta
  1442 → 1446); suite 20/20 — `p4t6-booking-GREEN.log`.

## 7. Reproduce

```bash
# host-free
pnpm -r typecheck
node --test packages/runtime/test/a5sf-pd20-admission-close.test.ts packages/runtime/test/a5sf-pd20-closed-arguments.test.ts

# DEV-LIVE (2 boots, lease + 3180-family port; never :3080)
pnpm build && node scripts/place-dist-glue.mjs
node dev/agent-workflow/evidence/pd20-lifecycle/run-boot.mjs --boots 2
```

`run-boot.mjs --plan` composes the patch layer without starting a host (used to check the fixture).

---

## 8. Artifact map

| path | what |
|---|---|
| `run-boot.mjs` | the driver (retargeted from `a5sf-recon-shell`; the two target judges are `judgeJobs` / `judgeRevocation`) |
| `driver.log` | full driver log of the final pair |
| `driver-digest.json` | digests of the driver + its imports |
| `runs/bootNN/` | per-boot evidence: `run-record.json` (verdicts + clauses), `member-{A,B,C}-transcript.{json,txt}`, `guard-facts{,-A,-B,-C}.json`, `ordering.json`, `counters.json`, `revocation.json`, `members.json`, `leader-events.json`, `host-log-final.log`, session `.zstd` copies |
| `agreement.{json,txt}` | the two boots' compared facts |
| `host-tree-porcelain.txt` | `empty` — the pinned host tree was not written |
| `plan-patch.yml` | the composed patch layer the boots used |
| `run-ledger.jsonl` | DEV-LIVE budget intents + worlds (lease provenance) |
| `p4t6-booking-GREEN.log` | the measured p4t6 accounting run |
