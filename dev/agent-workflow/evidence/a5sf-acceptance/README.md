# a5sf six-row acceptance boot — the P2-01 Host start that answered a DIFFERENT question

**Lane:** `task/a5sf-acceptance-20261103` · worktree `.worktrees/a5sf-acceptance`
**HEAD at run time:** `6d1b7a1fb63dc4551fb24de199702d18ae2b2c06`
(`fix(a5sf P0, dated 2026-11-03): an invalidated managed Member is refused at admission, not silently served by the preset definition (#574)`, merged forward from `origin/master` before the run)
**Pinned host baseline:** `639ed015397290b3745d163aafe02ffee4aa3f84` (`tests/deepseek-harness-test-use`, pristine — porcelain measured empty by the factory's own base guard at boot time)
**Boots spent:** **1** (`3183`), charged through the BL-14 pre-registration gate against allocation item **"P2-01 live read (BL-14 / G2 live half)"** — that item's **last** boot. The `+6` RCA reserve is untouched.
**Run record:** `run-record.json` → `RUN-SUMMARY run=a5sf-acceptance-2026-11-03T22-53-54-833Z suite=a5sf-acceptance overall=FAIL cases=7 FAIL:6 NOT_REACHED:1 worlds=none`

---

## 1. The result, stated without softening

**None of the six rows was reached.** All six are **NOT_REACHED**, and the reason is not any of
the six: the a5sf-wired Member **never activated** on the live Host at this HEAD.

The boot itself was healthy — Host up on `3183`, `/__p6t6/health` `ok`, the anchored TeamSession
present, discovery turn served, `team.create` `ok:true`, a 24-name model-visible surface with
**exactly one** `read`, and a clean Host teardown (pid killed, port freed, home deleted). The
first and only tool call the leader issued — `team_delegate` — came back:

```json
{"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
 "message":"activation: child-session creation failed for member 'inst-0b366g81a5yc':
   TeamServiceInstallError: SERVICE_MOUNT_FAILED: native tool module null registers asynchronously
   and its deferred registration cannot run inside the routed mount (deferred …"}
```

Member activation happens **before** any of the six rows can run, so the six questions were never
put to the product. A `REFUTED` would be a false report (nothing was tested); `PROVEN` obviously
not. The run-record's mechanical `FAIL` for the precondition and rows 1–4 is the record of
"assertions whose inputs were `null`" — see §4 for the exact mapping and why the word for those
rows is **NOT_REACHED**, not FAIL-as-product-finding.

The cause of the refusal is **the product seam added by #561** (`feat(a5sf second axis S-1 …):
… deferred registration fails closed`), triggered by the **pinned upstream `@deepseek-ai/dsh-tool-fs`
module's optional `attachments` injection**. §2 gives the exact text and a host-free reproduction
with a three-arm discriminating matrix.

---

## 2. The blocker (the finding this boot actually produced)

### 2.1 What the product refused

`packages/runtime/team-services/src/mount.ts` (the routed native mount) settles the deferred
registration window after `await inner` and then refuses if any descendant fiber that the
**Member's own context** could have satisfied did not reach `ACTIVE`:

```ts
// packages/runtime/team-services/src/mount.ts (HEAD 6d1b7a1fb, lines ~1050-1072)
const unsettled = windowFibers
  .filter((created) => created !== routerFiber && isDescendantOf(created, routerFiber) && created.uid !== null && created.state !== FIBER_ACTIVE)
  // An OPTIONAL dependency that is absent everywhere is benign …
  .filter((created) => Object.keys(created.inject).some((name) => target.get(name) !== undefined))
if (unsettled.length > 0) {
  throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED',
    `native tool module ${JSON.stringify(mount.toolBindingIdentity ?? null)} registers asynchronously …`)
}
```

The rule is *correct* as a rule (`NoStaleShadow ⇒ no unshadowed preset path`), and the fail-closed
choice is the right instinct. What it meets on the live Host is the pinned module:

```js
// tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js (unmodified upstream)
const inject = ["tools", "fs", "systemPrompt"]
function apply(ctx, config) {
  applyReadTool(ctx, …)
  ctx.inject(["attachments"], (imageCtx) => { applyReadImageTool(imageCtx) })   // ← always declared
  const sandbox = new FsSandboxController(ctx)
  applyWriteTool(ctx, sandbox); applyEditTool(ctx, sandbox)
}
```

On the live Host a durable attachment store **is** mounted, so `target.get('attachments') !== undefined`
— the fiber is therefore *not* filtered out as benign, and the mount is refused.

### 2.2 Host-free reproduction (`mount-refusal-probe.{log,json}`, ZERO boots)

`probe-mount-refusal.mjs` mounts the **real pinned tool-fs** through the **same product entry points**
the live glue uses (`mountMemberA5sfRealm` → `attachA5sfNativeToolModules`), in an in-process unit
root (no Host, no port, no `DSH_HOME`, no pristine-tree writes). Three arms:

| arm | `attachments` service | mount path | outcome (verbatim) |
| --- | --- | --- | --- |
| **B** | present | **routed** (`mountNativeToolModules`) | **REFUSED** — `SERVICE_MOUNT_FAILED: native tool module null registers asynchronously and its deferred registration cannot run inside the routed mount (deferred registration failed, waiting on [attachments]); refusing the mount instead of leaving those tools on the unshadowed preset path` |
| **A** | absent | routed | **MOUNTED** (`read`, `write`, `edit` forwarded) — the unsettled child is filtered out as benign, exactly as the source comment intends |
| **C** | present | **direct** plugin mount on the agent ctx (no router) | **MOUNTED** — the module and its `read_image` registration are fine with `attachments` |

Read together: the defect is at the **intersection** — *routed mount* **and** *a resolvable
`attachments` service*. Arm A isolates the router from the dependency; arm C isolates the module
from the router. Neither one alone refuses.

The public fiber state the product saw is `failed` (the refusal's own wording: `deferred
registration failed, waiting on [attachments]`). The product deliberately does **not** read the
fiber's private error slot (its own disclosure, quoted from `mount.ts`: *“the refusal names the
MODULE, its pending inject names and the public fiber state — it does NOT quote the upstream error
text, which this seam never reads”*), so **this evidence does not claim to know why the injected
child threw**. That is the next measurement, and it is a seam question, not a row question.

### 2.3 Blast radius

- It is **not** specific to row 5 or to the P0 admission gate: it blocks **Member activation** for
  every a5sf-wired Member (`a5sfEvidencePath` + `a5sfNativeToolModules` present) on the live Host at
  this HEAD, i.e. the whole live half of Alpha.5, not just `NoStaleShadow ≠ NoUnconfinedExecution`.
- It is **not** a live-new regression of my composition: the guard arrived in **#561**
  (`474a8d46d`), after the last working live boot (`a5sf-live-native3`, team SHA `3af944ca`), which
  is why native3 could prove the confined read and this boot cannot. Verified by ancestry:
  `git merge-base --is-ancestor 474a8d46d 3ded98db0…` → **NO**; and `git show 3af944ca:…/mount.ts |
  grep -c "registers asynchronously"` → **0**, while at `6d1b7a1fb` → **1**.
- `CORE PATCH BUDGET = 0` and the host tree is pristine: the pinned `tool-fs` cannot be edited, and
  neither `mount.ts` nor `agent-bindings.mjs` was touched by this lane (`git diff --stat` on
  `packages/` is empty; the only changes are under this evidence directory).

### 2.4 Where the fix belongs (named, not taken)

The seam that owns the decision is `mountNativeToolModules`'s settle-window refusal. The honest
options, in the order I would try them, are for its owner — not this lane:

1. **Distinguish “the dependency is satisfiable but the fiber is still settling” from “the fiber
   failed”.** The current filter is about *reachability*, not *outcome*; a `PENDING` child that is
   being served by an inherited service is not the leak the comment describes (`FAILED` is).
2. **Exempt a deferred child whose only unsatisfied dependency is one the router deliberately did
   not shadow** (the module's optional `read_image` gate), while still refusing when the child would
   have registered a **covered** name. The name set is already computed (`partition.forwarded`).
3. If neither can be made safe: refuse **earlier and louder**, at `a5sfRealmConfigOf`/glue level,
   with a typed `NATIVE_MODULE_DEFERRED_REGISTRATION_UNSUPPORTED` that names the module and the
   dependency — so a live boot fails at boot time with a meanable code instead of at the first
   Member activation.

---

## 3. The six rows

Verdict vocabulary: **PROVEN / REFUTED / NOT_REACHED**. In the run record these map to
`PASS` / `FAIL` / `NOT_REACHED`.

| # | row | verdict | why |
| --- | --- | --- | --- |
| — | composition precondition (a5sf-wired Member activates; ONE `read` on its surface) | **NOT_REACHED** | activation refused (`SERVICE_MOUNT_FAILED`); no member request ever reached the mock model |
| 1 | read **A** (inside ceiling **and** inside the binding restriction) → bytes + allow facts | **NOT_REACHED** | no Member, no `read` call |
| 2 | read **B** (inside ceiling, **outside** the restriction) → exactly one binding deny fact | **NOT_REACHED** | ditto |
| 3 | read **C** (**outside** ceiling, inside restriction) → refused, no widening | **NOT_REACHED** | ditto |
| 4 | native `write` to **B** → succeeds on the ceiling lane, no read-lane fact | **NOT_REACHED** | ditto |
| 5 | post-invalidation managed `read` of **B** → `A5SF_NATIVE_SHADOW_INVALIDATED`, no bytes | **NOT_REACHED** | no Member to invalidate; **also** two driver defects (§5) would have blocked it |
| 6 | teardown: no usable-but-unconstrained shadow / orphan / unsettled call | **NOT_REACHED** (Member-scoped) · **PROVEN** (process-scoped, see §3.6) | the seams that answer it are Member-scoped; the process seam *was* observed |

### 3.1 What actually ran (real capture)

```
[22:54:10] BOOTED port=3183 (lease bootsSpent=1)
[22:54:11] p6t6 health=true hostAlive=true
[22:54:11] p6t6 state (rootSessionId=session-a5sf-acceptance-root, teamSession!=null)=true
[22:54:11] discovery prompt status=200
[22:54:11] model-visible surface (24): bash,edit,glob,grep,read,read_image,
           team_archive_member,team_collect,team_create_member,team_delegate,team_follow_up,
           team_grant_permission,team_inspect_config,team_list_members,
           team_list_pending_control,team_list_templates,team_report_progress,
           team_request_control,team_resolve_control,team_revoke_permission,
           team_send_message,u5_canary,u6fs_probe,write
[22:54:11] discovery read schemas=1  prompt read-description mentions=0  prompt tool:read section mentions=0
[22:54:11] builtinToolDeny base list: glob,grep,u5_canary,u6fs_probe
[22:54:11] team.create status=200 ok=true
[22:54:11] … (delegate) …
[22:59:11] worker D1 turn closed (A5SF_ACC_D1_DONE)=false  leader chain closed (A5SF_ACC_L1_DONE)=true
[22:59:13] sink=…/a5sf-consult.jsonl exists=false rows=0 guardFacts=0 A=0 B=0 C=0
[22:59:13] counter installed={"leg":"counter-installed","baseCtor":"SandboxedFileSystem","baseInstance":"fs-0",…} readRows=0 writeRows=0
[22:59:13] ledger rows (2): budget-intent:grant-a5sf-acceptance-6d1b7a1fb63d | a5sf-acceptance-boot1:u5a5sfacc-…
[22:59:13] RUN-SUMMARY … overall=FAIL cases=7 FAIL:6 NOT_REACHED:1
```

The `leader chain closed=true` line is **not** progress: it is the leader's *second* turn after its
`team_delegate` was rejected (`teamCalls >= 1` → the scripted model answers `A5SF_ACC_L1_DONE`). No
member turn exists, so `readCalls=0`, `writeCalls=0`, `surfacePerMemberRequest=[]`, the sink file
was never created, and the provider counter logged only its installation row. The lane report the
provider row wrote at apply time still proves the **composition** was what this evidence claims:

```
ceiling.read.allow    = [<workspace>]
restriction.read.allow= [<workspace>/axis/allow, <home>/restriction-outside]
effective.read.allow  = [<workspace>/axis/allow]          ← the PRODUCT intersection
write (binding)       = "no-additional-narrowing" → effective.write.allow = [<workspace>]
```

and the host-free plan preflight (`plan.log`) measured the dispositions the rows would have asserted:

```
a.txt  ceiling=allow restriction=allow effective=allow
b.txt  ceiling=allow restriction=deny  effective=deny
c.txt  ceiling=deny  restriction=allow effective=deny
```

### 3.2 Rows 1–4 — the evidence that does not exist

Nothing was captured for them, and nothing is claimed: no tool result, no `a5sf-guard-consult/1`
fact for A/B/C (the sink does not exist), no provider counter read/write row, no per-member surface
sample. The driver's assertions evaluated against `null` inputs and therefore recorded `FAIL`, which
is the mechanical truth of "the required evidence is absent" — **not** a measurement that the
product denies/permits the wrong thing. The capacity they were written to test was last measured
`PROVEN` at `a5sf-live-native3` (read A allowed, read outside denied with one typed denial, inside
read served by a non-base confined instance, one `read` on the surface); this run neither reproduces
nor contradicts that, because it never got a Member.

### 3.3 Row 5 — the P0 row, and the P0 finding that *did* land (host-free)

Row 5's live arm was never reached. But two facts about the P0 merge at this HEAD were established
**without** this boot:

- the admission deny is a `tools/pre-execute` **deny** keyed on the attach's covered names, and it
  writes **no** `a5sf-guard-consult/1` fact (source: `admitCoveredTool` in `mount.ts`, which returns
  `{kind:'deny', …refusalOf(name, record)}` before any provider method runs);
- the invalidation event is reported through the product's own `console.error`
  (`a5sf: native tool shadow INVALIDATED (a5sf-native-invalidation/1): …`), which this run's log
  predicate would have matched — the predicate itself was verified against the source string, not
  against a live event.

The P0 gate's live behaviour therefore remains **unmeasured by this lane**, and it could not have
been measured: the gate lives in the same mount path that refuses to mount at all (§2).

### 3.4 The row-5 trigger that was built but never fired

`a5sf-realm-provider-row.mjs` carries a `lateToolRoute` (default `POST /__a5sf/late-tool`) that
registers ONE unrelated tool through the public `tools.register` seam on demand — a genuine
`tools/change` surface change of exactly the class `a5sf-native-invalidation/1` exists to catch,
without patching Core. It was exercised **structurally** only (the route is registered in the same
`ctx.inject(['webServer','tools'])` as the counter; the boot's row mounted and served traffic on the
counter's injection path). It never fired, because no Member survived long enough to carry a shadow.
No claim of invalidation behaviour is made from this run.

### 3.5 Why `/__p6t6/state` also under-reported (a driver defect, disclosed early)

`packages/tools/harness/plugin.mjs` binds `rootSid = directive.rootSessionId` at row setup
(line 324). The driver created the acceptance Team under a **different** root
(`session-a5sf-acceptance-team`) than the boot root (`session-a5sf-acceptance-root`), so every
`GET /__p6t6/state` and every `POST /__p6t6/tool {as: …}` addresses the **anchor** team, not the
acceptance team. That is why `state.members` shows only `inst-leader` and why row 5 recorded
`NO_WORKER_CHILD_SESSION_IN_STATE` even before the mount refusal is considered. It is a **driver**
defect (mine), not a product finding; the fix is in §5.

### 3.6 Row 6 — what *was* observed, through which seam

**Member scope: NOT_REACHED.** No Member was ever created, so there is no disposed agent scope to
probe. The seams that would answer it (the product dispatch route's `NO_LIVE_AGENT`, the residency
drop, the dispose-fault observations, a post-stop fact delta) all presuppose a Member; two prior
lanes already failed to reach a *disposed-scope* seam, and this run does not add a third attempt.

**Process scope: PROVEN, and honestly narrow.** From `teardown.json`:

```json
{"host":{"wasRunning":true,"pid":56,"killed":true,"portFree":true},
 "homeDeleted":"…/tests/homes/u5a5sfacc-20261103T22-53-55Z","releasedPorts":[3183,3493,3183],
 "killedPids":[56],"notes":[]}
```

and the independent probe after teardown: `portStillListening=false`, `homeExistsAfterTeardown=false`.
So: the Host this run spawned is gone, its ports are free, and its `DSH_HOME` is deleted — **no
orphan process**. That is the process seam and nothing more. It does **not** answer "is there a
usable-but-unconstrained shadow for a stopped Member", which needs a Member.

---

## 4. Verdict mapping (so the record cannot be read as softened)

`run-record.json` never saw a Member, so its verdicts are:

| case id | run-record verdict | the word this README uses | note |
| --- | --- | --- | --- |
| `live:composition-precondition-read-surface` | `FAIL` | NOT_REACHED | no member request existed (`memberRequestSeen=false`, `readCalls=0`) |
| `live:row1-read-a-inside-both-allowed` | `FAIL` | NOT_REACHED | `call=null`, zero facts, no sink file |
| `live:row2-read-b-binding-deny-exactly-one-fact` | `FAIL` | NOT_REACHED | `call=null`, zero facts |
| `live:row3-read-c-refused-no-widening` | `FAIL` | NOT_REACHED | `call=null`; the lane report **was** captured (see §3.1) |
| `live:row4-write-b-ceiling-allowed-no-read-lane-fact` | `FAIL` | NOT_REACHED | `call=null`; `diskContent=null` (B was never written) |
| `live:row5-post-invalidation-refused-shadow-invalidated` | `NOT_REACHED` | NOT_REACHED | `NO_WORKER_CHILD_SESSION_IN_STATE` |
| `live:row6-teardown-no-usable-unconstrained-shadow` | `FAIL` | NOT_REACHED (member) + PROVEN (process) | the case's own filter also matched the root session *name* (§5, defect 2) |

---

## 5. Driver defects found in THIS run (all disclosed, none re-run)

1. **Create-root ≠ observe-root (fatal for rows 5/6).** `/__p6t6/state` and `/__p6t6/tool` address
   `directive.rootSessionId` only, but the acceptance Team was created under
   `session-a5sf-acceptance-team`. Fix for a future run: either create the acceptance Team on the
   **boot root** (needs a measurement: does `team.create` replace an already-anchored root team?),
   or extend the p6t6 harness row with an explicit `?root=` selector — that is a test-infra change
   outside this evidence directory, so it was **not** taken unilaterally.
2. **Dispose-fault filter matched the session name.** `observations` are strings like
   `a5p1-guard: guard-installed agent=session-a5sf-acceptance-team`, and the filter was `/a5sf/i`, so
   every observation counted as an `a5sf` fault. Fixed in the committed driver to match the product's
   own phrases (`a5sf: realm dispose failed|residency dispose failed|a5sf: native shadow`).
3. **Capture clip (why §2 needed a probe).** The driver persisted tool results clipped to 320 chars,
   so the activation error's `(deferred …)` tail was lost with the World. The committed driver now
   persists the **full** text for every result. `transcript.json` in this directory is the **pre-fix**
   artifact (field `head`, 320 chars) and is kept unedited — the boot it describes cannot be re-run.

These are recording defects, not product claims; none of them changes a verdict above.

---

## 6. Disclosures — what is product, what is fixture

Unchanged from the lane's plan and re-stated because this run's only *positive* result (§2.2) leans
on them:

- The two-axis lane **inputs** (ceiling `[workspace]`; binding read restriction
  `[workspace/axis/allow, <home>/restriction-outside]`; binding write `no-additional-narrowing`) are
  **test composition** — no product code bridges a v3 blueprint to compiled ceilings at this base.
  The **intersection** and every disposition are the product's `intersectPathRuleSets` /
  `matchLocator` (`member-io-policy/src/path-rules.ts`, emitted build), called by the row.
- The `teamA5sfRealm` **provider** is supplied by one evidence row
  (`a5sf-realm-provider-row.mjs`) because no product code provides that service at this base (grep:
  only the consumer in `host.ts`).
- The **provider counter** is test instrumentation (the shipped host `fs` has no counter): an
  in-memory prototype wrap, pass-through, appended to a JSONL in the World home. It never decides.
- The **row-5 late-tool route** is test composition; the invalidation/deny behaviour it would
  trigger is the product's. It fired zero times.
- The **host-free probe** (§2.2) uses stub `fs`/`attachments` services and the **real** pinned
  `tool-fs` module and the **real** product entry points. Arm C's direct mount passes the module's
  four documented positive config integers explicitly because the live Loader (not a bare
  `Config.parse({})`) applies the schema defaults; the probe registers tools and never executes one.

---

## 7. Budget accounting (exact)

`dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json` → allocation **P2-01 live read (BL-14 / G2
live half)** = 3 boots.

| boot | evidence dir | what it spent on | result |
| --- | --- | --- | --- |
| 1 | `a5sf-live-native/` | unscoped-ctx activation seam | refused at activation |
| 2 | `a5sf-live-native2/` | two evidence rows from one package identity | Loader compose abort (no product code ran) |
| 3 | `a5sf-live-native3/` | confined native read on the live Host | six points PROVEN; teardown seam open |
| **4 (this run)** | `a5sf-acceptance/` | the six acceptance rows | **1 boot — Member activation refused by #561's mount rule; rows NOT_REACHED** |

Gate mechanics, measured: intent row **before** any World (`rowsBeforeIntent=0`,
`rowsAfterIntent=1`), grant `maxStarts=2` (1 intent + 1 boot), `boundCommit` = the exact run HEAD,
then `lease.boot()` wrote the start row and spawned. `ledger.jsonl` is the shared ledger's own copy
(2 rows). **The reserve was not touched; P2-01's allocation is now exhausted.**

---

## 8. `pnpm ci:local` — verbatim, and why this red is an environment gap

```
$ pnpm ci:local
packages/runtime typecheck: error TS2688: Cannot find type definition file for 'node'.
packages/runtime typecheck:   The file is in the program because:
packages/runtime typecheck:     Entry point of type library 'node' specified in compilerOptions
packages/runtime typecheck: Failed
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @dsh-agent-team/runtime@0.1.1-alpha.2 typecheck: `tsc -p tsconfig.json`
Exit status 2
[WARN]  Local package.json exists, but node_modules missing, did you mean to install?
[ELIFECYCLE] Command failed with exit code 2.
✘ pnpm typecheck (3.5s)
DSH-CI-LOCAL verdict=fail steps=4 failed=1 coverage=determined files=0 wall=4.2s
```

**Isolation:** this worktree carries **no `node_modules`** (`pnpm install --frozen-lockfile
--offline` also fails in this sandbox: `ERR_SQLITE_ERROR unable to open database file` — the pnpm
store is outside the writable workspace). The boot did not need it: the Host runs from the pristine
tree, and the team's emitted `dist` resolves `@deepseek-ai/*` by walking up to the main checkout.
So this is an **install gap, not a code signal** — and per the lane rule an exit-2 red is **never a
pass**. Remedy for the next lane: `pnpm install` in the worktree (or run `ci:local` in a checkout
that has one) and re-read the result.

---

## 9. Residual risks / honest limits

1. **The live refusal's full text is not in this evidence** — only its 320-char prefix (§5.3) plus
   the host-free reproduction at the same HEAD. The reproduction matches the prefix word-for-word,
   but a reader should treat `mount-refusal-probe.json` as a *mechanism* receipt, not as the Host's
   own log line.
2. **The `read_image` child's failure reason is unknown.** The product refuses to read the private
   fiber error slot; this lane did not patch Core to peek. §2.4 option 1/2 needs that measurement.
3. **No Member ⇒ no live measurement of**: the binding lane's deny fact count, the no-widening
   property, the ceiling write lane, the P0 admission deny, the invalidation event, or any teardown
   property at Member scope. Everything about those remains as `a5sf-live-native3` and
   `a5sf-p0` left it.
4. **The anchor team was left created on the boot root** (a normal World, deleted with the home).
   No product state outside `tests/homes/` was written; the World home is deleted, ports are free.
5. **`git` in this worktree has no `node_modules`**, so the committed driver cannot be re-run
   in-place until an install (see §8) — the same limitation that keeps `ci:local` red.
6. The evidence directory's `logs/…/instance-port3183.log` is only 3 lines: the mount refusal is
   reported through the tool result, **not** through a Host log line. Do not read the small log as
   "nothing happened".

---

## 10. The single next question

> **#561's deferred-registration fail-closed rule refuses the pinned `tool-fs` mount whenever
> `attachments` is resolvable — so no a5sf-wired Member can activate on the live Host at
> `6d1b7a1fb`, and the P0 admission gate is unreachable in practice. Should the mount seam
> distinguish a still-settling deferred child from a failed one (or exempt a child that would
> register only uncovered names), or should the live half stay blocked until the pinned module's
> optional `attachments` injection can be served inside the routed mount?**

---

## 11. Files in this directory

| file | what it is |
| --- | --- |
| `README.md` | this report |
| `run-boot.mjs` | the six-row driver (post-fix: full result text, correct fault filter; see §5) |
| `probe-mount-refusal.mjs` | host-free reproduction of the activation refusal (§2.2) |
| `a5sf-realm-provider-row.mjs` | the two-axis composition row (lane inputs + counter + row-5 route) |
| `identity-check.txt` | the lane's pre-boot composition precondition — **PASS**, pasted before the boot |
| `plan.log` | host-free preflight: blueprint ingest, patch layer, lane algebra dispositions, world teardown |
| `run.log` | the boot's own log (every line the driver produced) |
| `run-record.json` | the shared-ledger run record (7 cases, `overall=FAIL`) |
| `ledger.jsonl` / `ledger-rows.json` | the shared boot ledger: 1 intent row + 1 start row |
| `grant.json` | the grant bound to `6d1b7a1fb…`, `maxStarts=2`, allocation item P2-01 |
| `transcript.json` | model-visible surface, calls, tool results (**pre-fix 320-char clip**, §5.3) |
| `guard-facts.json` | the sink census — zero facts (no Member) |
| `consultations.jsonl` | the sink copy — **empty, 0 bytes** (the `a5sfEvidencePath` file was never created) |
| `counter.json` | the provider counter ledger — installation row only, zero read/write rows |
| `teardown.json` | Host/process teardown seam + the (member-scoped) teardown observations |
| `mount-refusal-probe.json` / `.log` | the three-arm host-free matrix (§2.2) |
| `ci-local.log` | `pnpm ci:local` verbatim (§8) |
| `logs/<world>/` | the World's instance log + the composed profile patch actually mounted |
