# a5sf-domain-attrib — host-free attribution of the boot #5 `TeamDomain is closed`

**Verdict: `TEST-WORLD`.** Boot #5's recorded failure is not a product boot-lifecycle defect
and not the five-row composition: the evidence driver probed `/__p6t6/health` **once**, read
the *legitimately pending* boot as a **404**, and aborted; the world teardown then disposed the
shared upstream `storageDomain` facility, whose disposer runs `closeAll()` and closed the Team
domain under the still-running bootstrap, which reported that teardown as
`store 'session_bindings' operation 'get' was rejected: the TeamDomain is closed`.

**The forcing observation (all preserved in `evidence/a5sf-bl18-live2/`, no Host needed):**
the ordering `health 404` → `abort` → `TeamDomain is closed` is provable from the preserved
records alone, and it inverts the causal story:

1. The domain was **open and healthy** after the mount step — the mount is a later bootstrap
   step than the domain open, and its success is logged (`remote mount: MOUNTED`).
2. The only in-process closers of that domain are the row-stop disposer and an independent
   disposal of the shared `storageDomain` facility. The row-stop disposer **waits for
   `ready`** before closing (`host.ts:3276-3281`), so it cannot close the domain under the
   bootstrap it is waiting for; `root.close()` is never reached (the boot never returned).
3. The only disposal that actually happened in the run is the world teardown:
   `teardown.json` → `"at": "2026-11-06T05:07:52.961Z"`, `"abortedDuring": "health-gate"`.
   The health gate's single `fetchJson` is the only thing that can throw at that stage
   (`run-boot.mjs:938-941`), so the probe precedes the teardown.
4. A `TeamDomain is closed` rejection requires a close that already completed (`E0`, `E6`),
   so the rejection is **after** 52.961 — after the probe and after the abort.

Chain: `domain open → mount → probe 404 → abort → teardown → closeAll → masked rejection`.
The 404 is a *pending* reading, not a failure: the p6t6 route exists only once `teamRoot.ready`
settles, and a settled **failure** answers `200 {ok:false,setupError}`
(`packages/tools/harness/plugin.mjs:222-243,326-341`), which is what `E7b` reproduces. A
composition-unwind or product-defect story would have produced `health gate failed:
status=200`, not a 404.

*Residual assumption, disclosed:* the instance log carries no in-host timestamps, so the
ordering rests on (i) the recorded abort stage (`health-gate`) and (ii) "the only closer that
can act in that microsecond window is the facility disposal". A single timestamped line at
p6t6's `fail()` (or at the facility's `closeAll()`) would make it unconditional; that is a
one-line diagnostic, not a special boot.

0 Host starts · 0 ports · no `DSH_HOME` · no pristine write · `CORE_PATCH_BUDGET = 0` ·
12/12 host-free expectations hold (`domain-attrib.mjs`) · 9/9 control expectations hold
(`preflight-domain-lifecycle.mjs`).

---

## 1. What was run, and what could not be

Everything below runs the **shipped dist** — the exact files that appear in the boot #5 stack
(`packages/runtime/dist/packages/...`) — over the shipped seam contract, in one node process:

```bash
node dev/agent-workflow/evidence/a5sf-domain-attrib/domain-attrib.mjs            # 12 experiments
node dev/agent-workflow/evidence/a5sf-domain-attrib/preflight-domain-lifecycle.mjs --self-test
```

The durable medium is a scratch dir inside this evidence directory, deleted on exit; the
blueprint is boot #5's own (`blueprint-anchor-boot5.yaml`, extracted verbatim from the composed
profile patch), the root session id, generation and workspace are boot #5's. The one fidelity
wrapper is `fidelitySeam` (README §6, instrument honesty).

**Not mountable host-free:** the Host's five-row *plug-in composition* (the offer row needs a
live `webServer`; p6t6 needs `teamRoot` + `webServer`; the two preset rows are declarative).
What the composition experiments can therefore prove is: the product payload of the plan binds
clean, and no composition variant expressible host-free changes that. That is enough to reject
composition as the *cause* here because the recorded 404 already proves the boot never failed,
and because the store/op in the message varies across occurrences (§3.3).

## 2. Reconstructed boot #5 timeline

| # | event | evidence |
|---|---|---|
| 1 | `05:07:39.154` boot starts (`bootTimeoutMs: 240_000`) | `run-record.json#hostStarts` |
| 2 | the launcher resolves as soon as `dsh web: <url>` is printed — **not** on Team readiness | `tests/characterization/lib/instance.mjs:114` |
| 3 | the Team row's `apply()` returns while its tracked `ready` is still pending; the domain opens, `/team-remote` mounts | `host.ts:1532-1560`, `3159`; log line `remote mount: MOUNTED` |
| 4 | `bindFreshTeamRoot` passes step 2 (binding read) and step 3 (`team_sessions` put) | stack in `setup-failure.json`; `fresh-root.ts:136,169` |
| 5 | the driver authenticates then probes `/__p6t6/health` **once**; 404 is thrown as fatal | `run-boot.mjs:938-941`, `health.json` |
| 6 | `05:07:52.961` the driver's teardown stops the world | `teardown.json` (`abortedDuring: health-gate`) |
| 7 | the storage-domain fiber is disposed → `await facility.closeAll()` | `…/storage-domain/src/index.ts:232` |
| 8 | the pending bootstrap's next touch (step 4's `putSessionBinding` → `readRow` → `table.get`) rejects `closed`; the product maps it to `NOT_OPEN` and logs `bootstrap FAILED`; p6t6's `fail()` then writes `setup-failure.json` and registers the failure route | `errors.ts:162-169`, `base.ts:76-82`, `fresh-root.ts:190-196` (compiled `fresh-root.js:137`, `write-port.js:33` = `write-port.ts:47`), `plugin.mjs:222-243` |

Steps 7–8 are what make the recorded artefact *look* like a product failure: the failure text
is produced **after** the process was already being torn down, and the only log line the
operator sees is the teardown's echo.

### Why the row-stop disposer is not the closer

The production row's only in-row closer is the row-stop effect, and it **waits for `ready`
first** (`host.ts:3276-3281`: `void ready.catch(...).then(settled => …)`). It therefore cannot
close the domain in the middle of the bootstrap it is waiting for. The closer must be an
**independent disposal of the shared facility** — the world teardown — which is exactly what
`closeAll()` is for and why it closes *all* domains, including one owned by another row.

## 3. Hypotheses × experiments × result

| hypothesis | experiment (host-free) | result |
|---|---|---|
| **(a)** the five-row composition is wrong | **E1** boot #5's own payload (blueprint/session/generation/workspace) binds clean; **E1b** production row alone binds clean; **E4** four composition variants (all rows / production only / offer+production / reordered) all bind clean; **E7b** a plan that *would* fail composition answers `200 {ok:false}` at the probe, which is not what boot #5 recorded | **REJECTED** — composition alone is never a sufficient cause, and boot #5's 404 excludes "already failed" |
| **(b)** a web-service injection/ordering event closed the domain | **E2** one `closeAll()` at the boot #5 instant reproduces the exact message **and** the exact stack frames (`bindFreshTeamRoot → putSessionBinding → putRecord → readRow`); **E2b/E3** the same close one await earlier/later gives `schema_meta 'put'` / `member_instances 'get'` | **PARTIALLY SUPPORTED as mechanism, REJECTED as trigger** — the closer is the facility teardown (step 7), not a `webServer` ordering event; no such event appears in any preserved artefact |
| **(c)** a product boot-lifecycle defect | **E7** replays the driver sequence end to end: pending boot → 404 → teardown → masked rejection → failure route; **E0/E6** the message can only come from a closed domain | **REJECTED as the cause; CONFIRMED as a masking defect** — the product converts a foreign teardown into a domain-closed error and keeps writing into the dead domain (§7, PD-11) |
| **(d)** test-world assembly/teardown artefact | **E7** (the exact artefact order, host-free) + the preserved `health.json`/`teardown.json`/`run-boot.mjs:938-941` + the route-registration semantics | **CONFIRMED** — a single-probe readiness gate read a pending boot as fatal and tore the world down; the product's error is downstream of that |

### 3.3 Why the message cannot identify the closer

Boot #5 says `session_bindings 'get'`, the previous native2 boot at the same base says
`schema_meta 'put'`, the α5/w7m2 records say `member_instances`. **E2/E2b/E3** show one and the
same teardown producing all three by moving the close by one await, so the store/op is a
**timing artifact**, not a cause. A composition cause would be deterministic and store-stable.
That non-determinism, plus the 404, is what excludes (a) and (c) as the cause.

## 4. Can this message come from an **uninitialised** domain?

**No — with one instrument caveat.**

- `normalizeSeamError` maps **only** seam code `closed` to
  `store '<store>' operation '<op>' was rejected: the TeamDomain is closed`
  (`packages/storage/schema/errors.ts:162-169`); `already-open`, `invalid-table`,
  `version-mismatch` and uncoded errors all become `SEAM_FAILURE` or a distinct message
  (**E0**, executable).
- Upstream `DomainImpl` throws code `closed` from exactly two places: `enqueue()` once
  `disposing = true` (`…/storage-domain/src/domain.ts:263-268`) and `assertReadable()` once
  `closed = true` (`:272-276`), and `closed` is set only at the end of `close()` (`:231-243`).
  `table(name)` never checks closure — it returns the stable handle or throws a **plain**
  `Error` for an undeclared name (`:217-223`), which is why the observed op is `get`/`put`
  and not `table`.
- A domain that was *never opened* has no `DomainImpl` at all: `open()` creates it
  (**E6**: `open()` on a fresh medium resolves). "Not open" is not "closed".
- **Caveat (instrument, disclosed):** the test-only in-memory fake treats `!unit.open` as
  `closed` and throws at `table()` (`packages/storage/test/p4-helpers.ts:235-243`), and
  `FileStorageSeam` does the same (`packages/testkit/fault-injection/file-seam.mjs:333-345`).
  A fake-seam-only experiment would therefore be unable to tell "uninitialised" from "closed"
  and would mislabel the op. `fidelitySeam` (this repo's evidence script) pre-resolves the
  declared table handles once, like `DomainImpl`, so the rejection is reported by the table
  member — which is why every op in this report matches production.

## 5. The pre-start control: `preflight-domain-lifecycle.mjs`

**What it decides** (plan-only, falsifiable, host-free): given a run plan
(`plans/*.json`), which of the closed verdict set applies.

| case | plan | verdict |
|---|---|---|
| boot #5's **real** plan (7 rows + its readiness gate) | `plan-boot5-five-rows.json` | **`PREDICTED_ABORT_ON_PENDING_BOOT`** |
| the same plan with the gate that polls instead of probing once (the fix) | `plan-boot5-polling-gate.json` | `CLEAN` |
| production row alone, fresh home, polling gate | `plan-clean-minimal.json` | `CLEAN` |
| **synthetic plan that must fail for the composition reason** (a required row whose module does not exist) | `plan-composition-fault.json` | `PREDICTED_BOOTSTRAP_DOMAIN_CLOSED` |
| a declared runtime reload inside the boot window | `plan-reload-in-window.json` | `PREDICTED_BOOTSTRAP_DOMAIN_CLOSED` |
| `create` over a stamped home | `plan-stale-home-create.json` | `PREDICTED_TEAM_DOMAIN_EXISTS` (E5a) |
| `resume` over a fresh home | `plan-resume-fresh.json` | `PREDICTED_SCHEMA_STAMP_MISSING` (E5b) |
| home freshness not declared | `plan-unknown-home.json` | `UNDETERMINED` |

So on this class the control **is** distinguishing and **would have predicted boot #5 before
it ran**: the decisive facts are static — (i) the gate mode (`single-probe`) and (ii) the fact
that the product boot settles asynchronously after `apply()` returns. Any failure it sees
would have produced `200 {ok:false}`; a 404 is a pending state.

**What the control cannot do** (verbatim in every verdict's `blindTo`): it cannot see a
runtime fiber disposal the plan does not declare, a reload triggered after the plan was read,
a second boot on the same medium, a port collision after the window opened, the **boot
duration** (so it cannot say *whether* the single probe will land while pending — only that it
*may*), or a module that resolves and throws later at mount time. `CLEAN` is a statement about
the plan, not a liveness guarantee; the plan-shape field that would remove the residual
blindness is a declaration of boot duration vs. probe instant, which no current plan carries.

**Actionable fix (driver, not product):** replace `run-boot.mjs:938-941`'s single `fetchJson`
with the file's own `waitFor()` loop, treating 404 as *pending* and bounding the wait by the
already-declared `bootTimeoutMs` (`240_000`). The `plan-boot5-polling-gate.json` fixture is
that plan.

## 6. Reproduction and instrument honesty

`domain-attrib.mjs` — 12 expectations, all green (`domain-attrib.json` is the machine record):

| id | claim |
|---|---|
| E0 | only seam code `closed` produces the message |
| E1 / E1b | boot #5's payload / the minimal payload bind clean host-free |
| E4 | shrink + reorder never change the outcome |
| E2 | `closeAll()` at the boot #5 instant → exact message **and** identical stack frames |
| E2b | one await earlier → `schema_meta 'put'` |
| E3 | one await later → `member_instances 'get'` |
| E7 | pending boot → `404` → teardown → masked rejection → `200 {ok:false}` (the recorded artefact order) |
| E7b | a bootstrap that really failed before the probe → `200 {ok:false}`, never 404 (the contrast that excludes the product/composition story) |
| E5a/E5b | the deterministic create/resume precondition classes |
| E6 | a never-opened domain is not a closed domain |

`fidelitySeam` is disclosed as a fidelity wrapper, not a product change: it pre-resolves the
declared table handles once (as `DomainImpl` does) so that `closed` is reported by the table
member; `FileStorageSeam.table()` checks closure eagerly and would otherwise mislabel the op
as `table` (see §4's caveat).

## 7. Product finding (secondary) — filed as `PD-11`

[DEBT-ROW-PD-11.md](DEBT-ROW-PD-11.md) contains the register-format row for the masking
defect: a foreign storage teardown is reported as `TeamDomain is closed`, the detached
bootstrap writes into the dead domain, and the row-stop disposer (the only closer that waits
for `ready`) cannot observe an independent facility disposal. It is **not** the cause of boot
#5 and it needs no upstream change; the owner decides the code/name. It is filed as a
standalone row because `docs/plans/active/**` is an owner asset (`AGENTS.md`).

## 8. What still needs a Host

**Nothing, to attribute boot #5** — the preserved `health.json` (404) + `teardown.json`
(`abortedDuring: health-gate`) + the route-registration semantics + the host-free replay (E7)
are jointly decisive, and the three conditionally pre-authorised starts were **not spent**.

A Host would only be needed to (i) positively confirm that the same plan under a polling gate
reaches `200 {ok:true}` (the fix's positive control, not the cause), and (ii) measure the real
boot-to-ready duration so the control can predict a specific plan's race instead of only its
possibility. Neither is needed to decide `COMPOSITION` vs `PRODUCT` vs `TEST-WORLD`.

## 9. Gates

- `node domain-attrib.mjs` → 12/12, exit 0
- `node preflight-domain-lifecycle.mjs --self-test` → 9/9, exit 0
- `node --check` both scripts
- `node scripts/doc-checks.mjs`, `git diff --check` (see the task log)
