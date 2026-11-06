# BL-17 live half — boot #3 of 5 (Shell-PTY face): **ABORTED before any case ran**

**Status: NOT PROVEN — the single authorised start was spent on a DRIVER GATE defect,
not on a product failure. Zero of the four live questions were reached. BL-17's live
half remains unproven; no matrix pointer may be added from this run.**

- Tree: `task/a5sf-bl17-live-20261108` @ `572a7625dd83548d32f889ca0cc51bf6ac278efd`
  (cut from `origin/master`), pristine host `639ed015397290b3745d163aafe02ffee4aa3f84`.
- Allocation: P2-04 boot **#3 of 5** (owner ruling 2026-11-06 「批准5次P2-04预算」,
  allocation #2 = BL-17 live half). Exactly **one** start was authorised and **one**
  was spent. After this run **2 starts remain** (earmarked BL-18 live + one
  FS/Search re-validation).
- Port **3184** (3180 family). `:3080` was never touched. `DSH_HOME` was
  `tests/homes/u5a5sfbl17-20261106T00-16-23Z`, deleted by teardown.
- Zero-boot preflight **PASS 13/13** before the start (`preflight.log`,
  `preflight-after-fix.log`). The preflight cannot see the driver's *gate order*;
  that is why it passed and the run still aborted. This gap is disclosed in §5.

---

## 1. What the run was supposed to measure

Four live questions the host-free arms cannot answer. Each was planned on ONE
Member terminal / ONE confined subprocess face, with per-item artefacts.

| item | question | planned observable |
| --- | --- | --- |
| 1 | same-PTY multi-command | two sequential `bash` calls on one Member print the same `$$`, `sess=` and `tty=` — one backend PTY, not a spawn per command |
| 2 | write-only read denial, live | a Member with the root in its effective WRITE lane but not its READ lane calls `bash_probe` with that root **declared as a read** → refusal is `IO_READ_DENIED` (READ axis), zero provider calls, no secret bytes |
| 3 | the `chmod` gap | a file inside the READ lane, outside the WRITE lane; body `chmod 600 <file>` with **no** `chmod` declaration → the mode still changes (Landlock has no chmod right) |
| 4 | `network: deny` refusal position | a second Member with `network.access = deny` → `bash_probe` refused at admission with `NETWORK_UNCONFINED_REALM`, **zero** provider spawn attempts |

Item 1 was always going to be measured on the Member's **inherited host terminal**
(the pinned `@deepseek-ai/dsh-tool-bash-persistent` over `@deepseek-ai/dsh-terminal`),
because no governed realm installs a terminal face (`GAP-PTY-CONTRACT-1`,
`TERMINALS_LEGACY_PTY_REFUSED`). Had it passed it would have proven the **host PTY
service** shares one shell, not a confined PTY. That disclosure is part of the
planned artefact and is repeated in §4.

## 2. What actually happened

`00:16:23Z` intent row written; grant bound to `572a7625…`; rows handed over;
`00:16:30Z` mock started; `00:16:43Z` **Host booted on 3184**, health `ok:true`,
host alive; `00:16:43Z` authenticated. Then:

```
00:16:43.949Z p6t6 health=true hostAlive=true
00:18:14.107Z p6t6 state (rootSessionId=session-a5sf-bl17-team)=false
00:18:14.107Z RUN FAILED: Error: the anchor team never settled; team.create cannot run
             case shell-positive: NOT_REACHED
             case write-only-read: NOT_REACHED
             case chmod-gap: NOT_REACHED
             case network-deny-refusal: NOT_REACHED
             teardown: host pid 55 killed, port 3184 free, home deleted, no orphan
```

No case ran. No `team.create`, no `team_delegate`, no `bash`, no `bash_probe`.
`overall=NOT_REACHED`, 1 boot spent (ledger: one `budget-intent` row + one
`a5sf-bl17-live-boot1` row).

## 3. Root cause (driver, not product)

The driver gated on `GET /__p6t6/state` **before** `team.create`, on the root the
Team would later be created on (`session-a5sf-bl17-team`). That root has **no team
session** yet, and the state route reads
`control.listControlState(rootSessionId)` + `messaging.recoverPendingDeliveries(rootSessionId)`;
the control service throws `TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND` for a root with no
team session (documented at `packages/runtime/src/plugin/root.ts:3770-3777`). The
route therefore never answered 200, and the 90 s gate could never open.

The Host row itself was healthy: the p6t6 health body's `ok` is
`setupError === null` (`packages/tools/harness/plugin.mjs:328-340`) and it answered
`ok:true`, so this was **not** a Team-row setup failure. The driver also failed to
record the state response body, which is itself a defect this run fixed (below).

**Fix (driver only, committed on this branch):** the pre-create state read is now a
diagnostic that records status/body and never gates; the state gate runs **after**
`team.create` and requires `rootSessionId === directive root && teamSession !== null`.
The health gate now records the health body (`rootSessionId`, `setupError`). The fix
is verified host-free: `node run-boot.mjs --plan` exits 0 with the same row identity
and patch layer, and `scripts/a5sf-preflight.mjs` → **PASS 13/13**
(`plan-after-fix.log`, `preflight-after-fix.log`).

## 4. The four items: NOT REACHED

None of the four planned observations exists. The expected/planned shape below is
kept so the next run is a continuation, not a redesign. **Nothing here is a result.**

- **item 1 (same-PTY):** not attempted. Planned proof: two `bash` calls on one
  Member's child session both report the same PID/`sess=`/`tty=`; artefact would
  also state that this is the inherited **host** PTY, not the confined face.
- **item 2 (write-only read):** not attempted. Planned proof: exactly one
  `a5sf-guard-consult/1` fact for the secret path with `decision:'deny'`,
  `decidedBy:'IO_READ_DENIED'`; no `confined-spawn-attempt` counter row; no secret
  token in the tool result. A supplementary (not preflighted) call with **no**
  declared read would show the kernel layer: admitted, exit ≠ 0, no bytes.
- **item 3 (chmod gap):** not attempted. Planned proof: `stat` mode of a READ-lane /
  not-WRITE-lane file changes to `0600` after `chmod 600` with no `chmod`
  declaration. This gap is already host-free-disclosed in `a5sf-bash/README.md`
  §6.2; the live run was to reproduce it on this tree.
- **item 4 (`network: deny` position):** not attempted. Planned proof:
  `NETWORK_UNCONFINED_REALM` before any provider call, zero spawn attempts, body
  never runs. **This is not a network-isolation claim** — see §6.

## 5. Why the zero-boot preflight could not stop this

The shared preflight checks composition inputs (rows, blueprint identity, lanes,
grant/run-record wiring, collector shape). It has no model of **driver control flow**
— the order in which the driver gates on live routes. The defect was a gate placed on
a route whose precondition (`team.create`) had not run. A future preflight extension
could assert "no durable-state read gates before the create call"; this run did not
have one, and the gap is recorded rather than papered over. This is the **fifth**
start in this programme spent on a run-construction defect; the fix now lives in the
driver instead of in a retry.

## 6. `network: deny` — the exact bar, quoted (not re-derived)

Even had item 4 run, its honest reading would be *refusal position*, never
isolation. The bar in `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7:

> Refusing to spawn is **not** evidence of network isolation: it is a statement about
> our own admission code, made before the OS was asked. A claim would require all of
> the following **observable facts**, on the tree being claimed:
>
> 1. **A capability row with a mechanism and recorded evidence**, not just a level:
>    `network-destination: enforced`, a non-null `mechanism` (e.g. `netns` + seccomp
>    + no inherited sockets), and an `evidence://` row bound to the realm id and
>    launcher trust root, with the ABI/coverage listed (TCP **and** UDP, IPv6, raw
>    sockets, AF_UNIX, inherited FDs, out-of-band routes — the list
>    `LANDLOCK_TCP_NOTE` says Landlock v4 does **not** cover).
> 2. **A real child attempt that would otherwise reach the network and fails inside
>    the deny lane**, with the failure being a kernel/transport denial (not a tool
>    error and not our refusal) …
> 3. **A positive control on the same invocation without the confinement** … that
>    **succeeds** and is observed on the wire …
> 4. **An out-of-band observation** of the transport itself … "Zero transport
>    entries" in a probe result is exactly what must **not** be used as this
>    observation unless the probe says it measured syscalls/transport …
> 5. **A second consumer path** (the live Host preset) showing the same deny lane on
>    the model-visible `bash` …
>
> Until 1–5 exist, the strongest honest statement is the one this document makes:
> *on this host, a `network: deny` lane refuses at the admission layer with zero
> processes, because the provider's own probe reports `network-destination:
> unsupported`; the OS was never asked to deny anything.*

On this host the provider's network row carries `mechanism: null` / `evidence: null`,
so points 1–5 were and remain absent.

## 7. Budget and what the next run needs

- Starts before this run: 2 (allocation #1 + the candidate-1 retry). This run: 1.
  **Remaining: 2** (BL-18 live + one FS/Search re-validation).
- **No retry was attempted.** The evidence ledger for this directory holds the intent
  row + boot row, and the driver refuses a second boot (`priorBoots >= 1`). A re-run
  requires: (a) a **new owner grant** bound to the **new branch HEAD** (the fix commit),
  `maxStarts >= 2` (1 intent + 1 boot); (b) a **fresh evidence directory** (or an
  explicit ledger reset by the owner); (c) the same `--host-root` and port family.
- The fixed driver is on the branch and host-free-verified; it must still be
  preflighted against the **grant bound to its own HEAD** before the next start.

## 8. Artefacts

| file | what it is |
| --- | --- |
| `boot3-abort.log` | the spent run's full log (boot, health, gate, teardown, ledger) |
| `boot3-abort-run-record.json` | `u5-run-record/1`, `overall=NOT_REACHED`, 4 × NOT_REACHED |
| `boot3-abort-ledger-rows.json` | the 2 shared-ledger rows (intent + boot) |
| `boot3-abort-teardown.json` | host pid 55 killed, port free, home deleted, no orphan |
| `boot3-grant.json` | the per-run grant, bound to `572a7625…` |
| `abort-diagnosis.json` | root cause, evidence, the fix, budget arithmetic |
| `preflight-bundle.json` / `preflight.log` | the PASS 13/13 bundle and its verdict |
| `preflight-after-fix.log` | PASS 13/13 after the gate-order fix |
| `plan.log` / `plan-after-fix.log` | host-free plan: blueprint ingest, row identity, lane algebra |
| `a5sf-bl17-live-realm-provider-row.mjs` | the composition row (lanes, shell class, per-template network, counters) |
| `a5sf-bl17-bash-probe-tool.mjs` | the composition caller of the confined face (decides nothing) |
| `run-boot.mjs` | the driver (+ `--plan` mode, now with the post-create state gate) |

## 9. Honest limits

- **This document proves nothing about the Shell-PTY face.** It proves the start was
  spent, the Host booted healthy on 3184, the teardown was clean, and the abort was a
  driver gate-order defect (not a product refusal).
- The state response body was not recorded; the exact HTTP status is not in the
  artefacts. The code path (`listControlState` on a session-less root) is the one that
  fires on a healthy row and is documented in `root.ts:3770-3777`.
- The preflight does not model driver control flow; a PASS is necessary, not
  sufficient. That is the structural lesson of this run and the reason the fix is in
  the driver, not in a retry.
- BL-17's live half (same-PTY sharing on a governed Member, the live read-axis
  refusal, the live chmod gap, the live network-refusal position) stays **unproven**
  and candidate-track claims stay **spec-only**. No grade and no `V@B` changed.

## 2026-11-08 — 记录格式更正（未改任何测量事实）

`boot3-abort-run-record.json` 的 `bindings.authority` 缺 `pointerSha256`，在 CI 的
`EB3-RUN-MANIFEST --new` 严格档下被判 `RUN_AUTHORITY_BINDING_MISMATCH`（本地非严格档不报）。
已补为当前指针字节哈希 `31ac81fb…`（`sha256sum dev/engineering/current-authority.json` 的实测值），
严格档现为 `strict=1 findings=0`。

这是**记录格式缺陷，不是测量缺陷**，与第 5 次仪器缺陷同类：它同样只在真实门禁里才现形。
本次 abort 的四项结果仍全部为 `NOT_REACHED`，未因这次更正获得任何新结论。
