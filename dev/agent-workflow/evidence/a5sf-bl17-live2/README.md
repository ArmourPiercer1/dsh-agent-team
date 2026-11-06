# BL-17 live half — boot #4 of 5 (Shell-PTY face): **ABORTED at `team.create`**

**Status: NOT PROVEN — the single authorised start was spent on a RUN-CONSTRUCTION
defect (the leader's model-facing tool surface is not permission-covered), one step
after the step boot #3 died on. Zero of the four live questions were reached.
BL-17's live half remains unproven; no matrix pointer is added, no grade and no
`V@B` changed.**

- Tree: `task/a5sf-bl17-live2-20261108` @ `e0f18df3b702370cd50b475d18b8d9758a1fe9d0`
  (cut from `origin/master`), pristine host `639ed015397290b3745d163aafe02ffee4aa3f84`.
- Allocation: P2-04 boot **#4 of 5** (owner ruling 2026-11-06 「批准5次P2-04预算」,
  allocation #2 = BL-17 live half). Exactly **one** start was authorised and **one**
  was spent. **1 start remains** (BL-18 live or an FS/Search re-validation — owner
  call, not this lane's).
- Port **3184** (3180 family). `:3080` and its DSH_HOME were never touched.
  `DSH_HOME` = `tests/homes/u5a5sfbl17-20261106T02-21-57Z` (inside this worktree),
  deleted by teardown. Mock on 3494 (sanctioned 3491-3500 range).
- Zero-boot preflight **PASS 16/16, exit 0** immediately before the start — not
  `UNKNOWN`: `bundle.case-coverage`, `driver.gate-order` and `driver.log-capture`
  were all graded from a declared plan (§4). It still could not see the defect
  that aborted the run (§5).

---

## 1. What this run was supposed to measure

Four live questions the host-free arms cannot answer, on ONE Member terminal and
ONE confined subprocess face, one artefact per item.

| item | question | planned observable |
| --- | --- | --- |
| 1 | same-PTY multi-command | two sequential `bash` calls on one Member print the same `$$`, `sess=`, `tty=` — one backend PTY, not a spawn per command |
| 2 | write-only read denial, live | a root in the effective WRITE lane but not the READ lane, declared as a read: refusal on the **read axis** (`IO_READ_DENIED`), zero provider calls, no secret bytes |
| 3 | the `chmod` gap | a file inside the READ lane, outside the WRITE lane; `chmod 600` with **no** chmod declaration still changes the mode |
| 4 | `network: deny` refusal position | a second Member with `network.access = deny` refuses at admission (`NETWORK_UNCONFINED_REALM`) with zero processes |

Item 1 was always planned on the Member's **inherited host terminal** (no governed
realm installs a terminal face: `GAP-PTY-CONTRACT-1`, `TERMINALS_LEGACY_PTY_REFUSED`).
Had it passed it would have proven the **host PTY service** shares one shell, not a
confined PTY. That disclosure is repeated in §6 and in `item1-same-pty.json`.

## 2. What happened

`02:21:57Z` intent row written; grant bound to `e0f18df3…`; rows handed over
(4 rows, identity equal); `02:22:04Z` mock started; `02:22:17Z` **Host booted on
3184**, health `ok:true`, 15 tools on the route; authenticated. Then:

```
02:22:18.052Z p6t6 health=true body={"ok":true,...,"toolCount":15}
02:22:18.054Z p6t6 state BEFORE team.create (diagnostic, not a gate):
              status=500 body={"error":"ControlService: no TeamSession record for root
              session 'session-a5sf-bl17-team'"}
02:22:18.123Z team.create status=200 ok=false
              code=TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED
              "permission coverage gate failed for instance 'inst-leader': 2 unmanaged
               tool(s) on the final model-facing surface: u5_canary (unknown-unm…"
02:22:18.124Z RUN FAILED ... all four cases NOT_REACHED
02:22:18.205Z teardown: host pid 33 killed, port 3184 free, home deleted, no orphan
```

No `team_delegate`, no `bash`, no `bash_probe`, **zero model requests**
(`final-mock-requests.json` = `[]`), and no guard-fact / provider-counter / probe-ledger
artefact at all (the World home never installed a realm).
`overall=NOT_REACHED`, 1 boot spent (ledger: 1 `budget-intent` row + 1
`a5sf-bl17-live2-boot1` row; `boots === plannedStarts - aborts` → `1 === 1 - 0`).

## 3. Root cause (run construction, not product)

`team.create` starts the root (leader) agent, and the product's **A2C-2 permission
coverage gate** refuses to start an agent whose final model-facing surface contains
a tool that is neither allowed, asked, nor denied. Two tools were in that state:

- `u5_canary` (from the World's always-composed `u5-canary` row), and
- `u6fs_probe` (from the World's always-composed `u6-fs-probe-host` row).

Both rows are inserted by the World factory (see the composed profile in `logs/`).
The driver's `main.yaml` declares the leader with `capabilities.builtinToolDeny: []`
(`run-boot.mjs` `mainBlueprintYaml()`, the `builtinToolDeny: []` line), so neither
name is covered. The gate did exactly what it documents: it named both tools with
their classification and the closed inner code
`alpha2-permission-coverage-unmanaged-tools`.

**This is not a product defect and it contradicts no host-free arm.** The arms never
claim a coverage-clean leader surface; the a5sf-bash README §8 checklist starts at
the native module mount and does not mention the World's canary/probe rows at all.
The canonical World assemblies cover them: `tests/world-factory/lib/u6-fs-assembly.mjs`
`mainBlueprintYaml(denyList)` puts *every* unmanaged surfaced name into
`builtinToolDeny` (with the measured b2 comment: deny is coverage here, not a call
site), and `tests/world-factory/suites/040-u6-arc-a.mjs:159-161` first prompts the
leader, reads the surface from the mock request, computes the deny list, then writes
`main.yaml` and creates. This driver did neither.

**Fix candidates** (driver/composition only; `CORE_PATCH_BUDGET = 0`):
1. minimal: add `- u5_canary` and `- u6fs_probe` to the leader's `builtinToolDeny`
   (precedent: `tests/world-factory/u7-tbash.test.mjs:43`);
2. robust: adopt the discovery-first pattern so a future preset/row change cannot
   reintroduce the class.

## 4. Preflight: PASS 16/16 before the start (not UNKNOWN)

The fixed driver from `.worktrees/a5sf-bl17-live` (`ee5014c60`+) was copied in and
its step preconditions were **declared** in the preflight bundle, so the new checks
grade real facts instead of answering `UNKNOWN`:

- `driver.steps` (14 steps) declares `create-team` `produces: ["team-session","member"]`
  before `state-gate` `requires: ["team-session"]`, and before every
  `delegate-*`/`item-*` step's `requires: ["member"]`. The pre-create state read is
  declared with **no** `requires` — it is a diagnostic, which is exactly the boot-3
  defect the declaration must not repeat.
- `plannedCases` = the three cases the shared schema can table; `fixtures` has a row
  per case. (The network case is a refusal-position plan and is hand-checked; the
  bundle's `policy.note` says so.)
- both run records carry `bindings.authority.pointerSha256` =
  `31ac81fb4c4818b4eb09a61723b7c15a963114272bb9095b18b8e21e5fbc7f0a`
  = the measured `sha256sum dev/engineering/current-authority.json` (verified
  immediately before the start; `archive/pre-boot-sha256.txt`).

```
DSH-A5SF-PREFLIGHT {"verdict":"PASS","summary":"PASS 16/16 checks",...}
```

`driver.gate-order` PASS: the declared order puts every gate after its producer.
`driver.log-capture` PASS: every fail-capable declared step asks for `status`+`body`.

**The PASS was honest and still insufficient**, and this run produced a measured
instance of the residual limitation stated in `a5sf-preflight-order/README.md` §1.5:
the driver *declared* `captures: ["status","body"]` and still **truncated the body**
to 400/300 characters at runtime. The full `team.create` body was not captured; the
message in `abort-diagnosis.json` is flagged as reconstructed from product code plus
the visible prefix.

## 5. What the preflight still could not see

The bundle declares blueprint IDs, member counts and composition rows, but **not the
leader's model-facing tool surface nor its permission coverage**. The blueprint text
lives inside the driver; it is not a bundle fact. No check compares
`builtinToolDeny` against the World's always-composed test rows, and the driver never
discovers the surface before create.

What would have caught it, host-free:
- a `driver.leader-surface` check over a declared
  `driver.blueprint.leaderSurface = { tools, builtinToolDeny, managed }` requiring
  every non-team tool in the declared surface to be covered (the World rows are known
  before boot), **or**
- a declared `discover-leader-surface` step with `produces: ["leader-surface"]`
  gating `create-team` via `requires: ["leader-surface"]` — the same
  declared-precondition mechanism, extended to the surface fact.

This is the same structural lesson as boot #3: a content-complete bundle can still
omit the fact the next gate consumes. It is the **sixth** start in this programme
spent on run construction; the fix now belongs in the driver (and in a declared
surface fact), not in a retry.

## 6. The four items: NOT REACHED

Each has its own artefact with `verdict: NOT_REACHED`, the planned observable, what
would prove it, and the honest limits. **Nothing here is a result.**

- **item 1 (same-PTY)** — `item1-same-pty.json`. No member existed, so no terminal
  was allocated. A future PASS proves the **inherited host** PTY's sharing, not a
  confined PTY; a second-Member different-pid control is required to distinguish
  sharing from a global shell.
- **item 2 (write-only read)** — `item2-write-only-read.json`. No guard fact, no
  provider counter, no probe ledger row; their absence is *not* a refusal. A future
  PROVEN needs exactly one `IO_READ_DENIED` fact on the read axis, 0 provider calls,
  and no secret bytes — plus the supplementary kernel call showing the OS layer.
- **item 3 (chmod gap)** — `item3-chmod-gap.json`. Nothing was measured on this tree.
  The only standing statement remains the host-free disclosure in
  `a5sf-bash/README.md` §6.2 (Landlock has no "change mode" right; an undeclared
  same-uid `chmod` is outside the OS profile). A future run must record the result
  **whether or not** it matches that prediction.
- **item 4 (`network: deny` position)** — `item4-network-deny.json`. Nothing was
  attempted. This is **not** a network-isolation claim, and even a future PASS would
  not be one.

### `network: deny` — the exact bar, quoted (not re-derived)

From `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7:

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

## 7. Budget and ledger

- Starts spent before this run: 3 (allocation #1, the candidate-1 retry, boot #3).
  This run: 1. **Remaining: 1** — BL-18 live or an FS/Search re-validation (owner
  call).
- Ledger (`run-ledger.jsonl`, `ledger.json`): 1 `budget-intent` row + 1 boot row;
  `plannedStarts=1`, `aborts=0`, `boots=1`; `boots === plannedStarts - aborts` holds.
- Grant (`grant.json`): `maxStarts=2`, `boundCommit=e0f18df3…`, covering the intent
  row + the boot row. Both the plan-time bundle record and the live run record carry
  the measured `pointerSha256`.
- **No retry was performed and none is authorised.** The driver refuses a second boot
  in this directory (`priorBoots >= 1`); a re-run needs a **new** evidence directory
  and a **new** grant bound to the fixed branch HEAD.
- Teardown (`teardown.json`): host pid 33 killed, 3184 free, mock 3494 released,
  home deleted, no orphan, no lingering listener.

## 8. Artefacts

| file | what it is |
| --- | --- |
| `run.log` | the spent run, full driver log (boot, health, pre-create state, create, teardown, ledger) |
| `run-record.json` | `u5-run-record/1`, `overall=NOT_REACHED`, 4 × NOT_REACHED, authority binding with `pointerSha256` |
| `abort-diagnosis.json` | root cause, observed vs reconstructed body, the preflight blind spot, fix candidates, budget arithmetic |
| `item1-same-pty.json` … `item4-network-deny.json` | one NOT_REACHED artefact per item: question, observed, what would prove it, limits |
| `ledger-rows.json` / `ledger.json` / `run-ledger.jsonl` | the two shared-ledger rows and the arithmetic |
| `grant.json` | per-run grant bound to `e0f18df3…`, `maxStarts=2` |
| `teardown.json` | host pid, port release, home deletion, orphan check |
| `preflight-bundle.json` / `preflight.log` | the declared plan and the `PASS 16/16` verdict |
| `plan.log` | host-free plan: blueprint ingest, row identity, lane algebra |
| `fixtures.json` | the lane/secret/mode-file paths and claim tokens used by the driver |
| `final-mock-requests.json` | `[]` — zero model requests, so zero agent turns |
| `archive/pre-boot-*` | plan, preflight payload and the pre-start hashes frozen before the start |
| `logs/…/composed-profile-*.patch.yml` | the exact composed row set (canary + probe rows visible) |
| `logs/…/instance-port3184.log` | host boot log (launch token redacted) |
| `a5sf-bl17-live-realm-provider-row.mjs` / `a5sf-bl17-bash-probe-tool.mjs` | the composition row and the confined-face caller (unchanged from boot #3) |
| `run-boot.mjs` | the fixed driver + the declared step plan/fixtures/pointer binding used by this run |

## 9. Honest limits

- **This document proves nothing about the Shell-PTY face.** It proves the start was
  spent, the Host booted healthy on 3184 with 15 tools, boot #3's pre-create state
  diagnosis is correct (the route really answers 500 naming
  `ControlService: no TeamSession record ...`), the teardown was clean, and the abort
  was a leader-surface coverage defect in the run construction.
- The `team.create` body was **truncated** in the run record (300/400 chars). The
  full message in `abort-diagnosis.json` is **reconstructed** from the product's own
  message builder plus what was observed. Of the two tool names only `u5_canary`
  (with the `unknown-unm…` prefix) is in the observed bytes; `u6fs_probe` is
  **inferred** from the observed count (`2 unmanaged tool(s)`), the World's other
  always-composed test row, and the canonical b2 coverage comment. It is labelled
  as a reconstruction; no observed byte is claimed beyond the visible prefix.
- The preflight grades declarations; it passed `driver.log-capture` while the driver
  still truncated the body. That is a measured instance of the known residual, not a
  new check gap — but it does mean "PASS 16/16" must never be read as "the run is
  diagnosable".
- The preflight does not model the leader's model-facing surface or permission
  coverage (§5). A PASS is necessary, not sufficient; that is why the fix belongs in
  the driver plus a declared surface fact, not in a retry.
- BL-17's live half (same-PTY sharing on a governed Member, the live read-axis
  refusal, the live chmod gap, the live network-refusal position) stays **unproven**
  and candidate-track claims stay **spec-only**. No grade and no `V@B` changed.

## 10. Matrix evidence pointers

**None added.** The live result supports no matrix claim: all four rows would be
`NOT_REACHED`. The target row when a real run succeeds is M-08 (`bash persistent`,
`os-confined:leaf` + `team-shell`, currently `NOT_WIRED` / `V@B=no`), but neither the
row's grade nor its `V@B` is this lane's to move, and `docs/plans/active/**` is
owner/main-agent material that a worker may not edit.
