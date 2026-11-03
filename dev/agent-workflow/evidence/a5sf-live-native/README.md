# a5sf LIVE NATIVE — the one authorised Host boot (route C, effective half)

**Task:** convert route C from "mechanism proven host-free" into "a booted world
where a model-visible native `read` is refused" — or find out that the product
has no usable seam for it and say exactly where.

**Verdict: the product has no usable seam at this HEAD.** The Host boots, the
Team Session is created, and the a5sf realm **mounts** — then every a5sf-wired
Member's child-session activation is **refused** by the route-C attach itself:

```
{"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
 "message":"activation: child-session creation failed for member
 'inst-1m0s1pf1deuo': TypeError: agent-bindings: the a5sf native tool
 re-mount needs a SCOPED agent Context (the tool plane is per-agent)"}
```

It fails **closed** (no Member turn, no unconfined native row, zero
consultations) — the safety property holds, but the *effective half is NOT
reached*. No second boot was spent: this is the finding, and it names the exact
line to change.

| fact | value |
| --- | --- |
| Worktree | `.worktrees/a5sf-live-native` |
| Branch | `task/a5sf-live-native-20261103` (from `origin/master`) |
| HEAD **run** | `c8a5836238b1a567fb512d09fdf7f4dff5853ae3` (master, PR #557) |
| Host baseline | `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2, `tests/paths.mjs` pin, asserted before boot) |
| Hosts booted | **1 of 1** (`bootsSpent=1`, port 3183; mock 3493; host pid 57, killed + port released) |
| Shared-ledger rows | **2** = 1 `budget-intent` + 1 `a5sf-live-native-boot1` (see §9) |
| Grant | `grant.json`, `maxStarts: 2`, `boundCommit` = the run HEAD |
| Core patch budget | **0** — no file under `packages/` was edited; `agent-bindings.mjs` (ARC-A protected) untouched |
| `:3080` | only a read-only `GET /` before (401) and after (401); never signalled |
| `tests/homes/**` | the one World home was deleted by `world.teardown()` (ownership-marker checked); `tests/homes` is empty |
| RUN record | `run-record.json` — `overall=FAIL`, `FAIL:1 NOT_REACHED:6` |

**RUN-SUMMARY** (verbatim):

```
RUN-SUMMARY run=a5sf-live-native-2026-11-03T11-23-16-973Z suite=a5sf-live-native overall=FAIL cases=7 FAIL:1 NOT_REACHED:6 worlds=none
```

`worlds=none` is the record's own bookkeeping field (the runner normally fills
`bindings.worldIds`); the World DID boot and is named in `run-record.json`
`boots[0].world = u5a5sflive-20261103T11-23-17Z`.

---

## 1. What was asked, and how it was spent

One World, one Host, one boot, on the pinned pristine tree. The World's
production Team row (`packages/runtime/dist/.../host.js`, the shipped dist face)
carried:

```yaml
a5sfEvidencePath: <world.home>/a5sf-consult.jsonl
a5sfNativeToolModules:
  - "file:///<host-tree>/packages/fs/tool-fs/lib/index.js"   # the HOST's own native module
```

and **no `teamToolPlane`** — so the only confinement in the World is the a5sf
compiled realm, never the Alpha.4/U6 governed read plane.

Because **no product code provides `teamA5sfRealm`** at this base (grep: only
the consumer in `packages/runtime/src/plugin/host.ts:2316` and the type doc), a
test composition row mounted beside the Team row supplies it:
[`a5sf-native-provider-row.mjs`](./a5sf-native-provider-row.mjs)
(`ctx.provide('teamA5sfRealm', { compiledFor })`). Its `MemberPolicy` is a
compiled-**shaped** fixture whose one allow locator is the canonical workspace
root — **disclosed**: the production compiler (`compileMemberPolicy`) consumes a
v4 blueprint + an Alpha.4 authority fact and no v3→compiled bridge exists; the
guard that enforces the fixture is the **shipped** one
(`createMemberFsGuard` + `TeamConfinedFileSystem`). This boot therefore tests
**the product seam** (does a Member with this config mount and run?), not
product policy compilation.

Plants:

| file | locator | claim |
| --- | --- | --- |
| `world.home/outside-ceiling.txt` | **outside** the ceiling root | `A5SF_OUTSIDE_CLAIM_<world>` |
| `world.workspace/inside-ceiling.txt` | **inside** the ceiling root | `A5SF_INSIDE_CLAIM_<world>` |

The driver is the scripted mock model (`makeDecide` in `run-boot.mjs`): the
leader creates the a5sf-wired Member by `team_delegate` (`async:false`), has it
`read` the outside file then the inside file, then creates a second Member whose
`builtinToolDeny` names the native `read`, then archives the first — all through
the public Team tool surface.

## 2. Reproduction

```bash
# 0. host-free preflight (NO gate, NO ledger row, NO spawn): emits the patch
#    layer and validates both blueprints with the HOST's own domain facade.
node dev/agent-workflow/evidence/a5sf-live-native/run-boot.mjs --plan

# 1. THE one boot. Materialises grant.json bound to `git rev-parse HEAD`,
#    goes through the BL-14 gate (intent row -> start row -> spawn), drives the
#    scenario, writes every artifact in this directory.
node dev/agent-workflow/evidence/a5sf-live-native/run-boot.mjs

# 2. re-derive the case table from the captured artifacts only (NO boot; see §5)
node dev/agent-workflow/evidence/a5sf-live-native/rejudge.mjs
```

The gate is `tests/world-factory/suites/150-a5sf-read.mjs#preRegisterReadBudget`
(imported, never restated); the ledger is `tests/world-factory/lib/run-record.mjs`.
Order is the law: **intent row → (lease re-verifies it) → start row → spawn**,
and the log shows it (`rowsBeforeIntent=0`, `rowsAfterIntent=1`, then
`BOOTED ... bootsSpent=1`).

Artifacts: [`run.log`](./run.log) (the boot's own transcript),
[`consultations.jsonl`](./consultations.jsonl) (the product sink; **0 bytes** —
see §5.3), [`ledger-rows.json`](./ledger-rows.json),
[`transcript.json`](./transcript.json) (every mock request/result),
[`guard-facts.json`](./guard-facts.json), [`host-witnesses.json`](./host-witnesses.json),
[`ledger.jsonl`](./ledger.jsonl), [`grant.json`](./grant.json),
[`run-record.json`](./run-record.json),
[`scope-duplicate-instances.log`](./scope-duplicate-instances.log) (the
host-free root-cause measurement of §4).

## 3. What actually happened (verbatim from `run.log`)

```
gate lease: grant=grant-a5sf-live-native-c8a5836238b1 intentRows=1 rowsBeforeIntent=0 rowsAfterIntent=1 remaining=1
BOOTED port=3183 (lease bootsSpent=1)
p6t6 health=true hostAlive=true
p6t6 state (rootSessionId=session-a5sf-live-root, teamSession!=null)=true
model-visible surface (24): bash,edit,glob,grep,read,read_image,team_archive_member,team_collect,team_create_member,team_delegate,team_follow_up,team_grant_permission,team_inspect_config,team_list_members,team_list_pending_control,team_list_templates,team_report_progress,team_request_control,team_resolve_control,team_revoke_permission,team_send_message,u5_canary,u6fs_probe,write
team.create status=200 ok=true
leader chain closed (A5SF_L1_DONE)=true
sink=.../a5sf-consult.jsonl exists=false rows=0 guardFacts=0 outside=0 inside=0
```

The **only** leader-side results for both Members were refusals:

```
team_delegate(worker)         -> {"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
  "message":"activation: child-session creation failed for member 'inst-1rn23qe04pfh':
   TypeError: agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context
   (the tool plane is per-agent)"}
team_create_member(denyread)  -> (same TypeError, instance 'inst-1m0s1pf1deuo')
team_archive_member           -> {"status":"blocked","reason":"target-stale"}
```

No Member ever existed ⇒ no model request, no `read` call, no guard decision,
no sink. The successful `team.create`, healthy `/__p6t6/health` and the 24-name
surface are the **positive** half: the World boots, the row config with
`a5sfEvidencePath` + `a5sfNativeToolModules` is accepted, and the realm mount
runs (the attach is only reached when `a5sfRealm !== undefined` —
`agent-bindings.mjs:2799`).

## 4. Root cause — and the exact line that must change (NOT patched here)

The attach's first statement is the surface read
(`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`, `a5sfAgentToolSurface`):

```js
const scope = scopeOf(root)
if (scope === undefined) throw new TypeError('agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context (the tool plane is per-agent)')
```

**`scopeOf()` through the Team plugin's `@deepseek-ai/dsh-scope` instance
answers `undefined` for a healthy Host-tagged agent context.** That is not a
guess and not a property of this World's composition — the product's own code
documents it two lines above the resolver it uses everywhere else:

> `agent-bindings.mjs:503-508` — “the scope tag (`scopeOf(agentCtx)` — which is
> unreadable across duplicate `@deepseek-ai/dsh-scope` module instances because
> the tag is a module-private Symbol, so it is the least reliable of the three
> and must never shadow the explicit Agent)” …
> “reads `undefined` even for a perfectly healthy Agent ctx”.

The mechanical measurement ([`scope-duplicate-instances.log`](./scope-duplicate-instances.log)):

```
team plugin resolves dsh-scope  : <repo>/node_modules/.pnpm/@deepseek-ai+dsh-scope@0.2.0-rc.2…/lib/index.js
pristine host resolves dsh-scope: <repo>/tests/deepseek-harness-test-use/packages/core/scope/lib/index.js
same realpath                  : false
same module namespace          : false
scope minted via TEAM instance   : scopeOf=KEY
same ctx read via HOST instance  : undefined
```

So the a5sf attach must use the **canonical runtime Agent** the glue has already
resolved (`resolveSetupAgent(agentCtx, setupAgent)` → `runtimeAgent`, the Agent
*is* the scope key), with `scopeOf` only as the last-resort fallback — exactly
the precedence the rest of `agent-bindings.mjs` follows. That is a change inside
`packages/runtime/src/plugin/live/agent-bindings.mjs` + `a5sf-realm-row.mjs`
(the ARC-A protected center), i.e. **`CORE PAYLOAD`-class product work this lane
must not take**: `CORE PATCH BUDGET = 0`, and the file is protected. **Reported
as the seam, not patched.**

A second, smaller observation for that fix: `mountNativeToolModules` itself
lands the shadow in the right layer (it inherits the host's scope tag through
Cordis `extend`/`isolate`), so only the *surface read* is blocked — the mount
succeeded before the throw.

## 5. The five points, with their real captured output

Re-derived by [`rejudge.mjs`](./rejudge.mjs) from the same single boot's
captured artifacts (no second boot). The **executed** predicate required
`toolResult.is_error === true` for a legible refusal; the host reports a refused
activation as `status:"rejected"` with `is_error:false`, so that predicate
scored the refusal as FAIL. The correction and its reason are recorded in
`run-record.json.verdictsRevised` — a predicate fix, not a new observation.

| # | question | verdict | evidence |
| --- | --- | --- | --- |
| 1 | a Host with a managed a5sf-wired Member boots, surface carries exactly ONE `read` | **REFUTED** | the Host booted and the surface has one `read`, but the Member never reached an agent turn: activation refused (§3) |
| 2 | native `read` **outside** the ceiling is refused by the Guard (`IO_READ_DENIED`), not a crash | **NOT_REACHED** | no Member ⇒ no `read` call ⇒ no guard decision. Blocker: the setup TypeError (§3/§4) |
| 3 | sink holds exactly ONE `a5sf-guard-consult/1` deny fact | **NOT_REACHED** | sink never created (`consultations.jsonl` = 0 bytes); zero facts, reported as zero |
| 4 | native `read` **inside** succeeds, bytes match | **NOT_REACHED** | same blocker; neither the claim nor an allow fact exists |
| 5 | a Member whose `builtinToolDeny` names the native tool fails **loudly** (C2(a)) | **PROVEN (loud) / NOT_REACHED (deny-specific)** | typed rejection quoted below; the *specific* surface-neutrality refusal never ran |
| 6 | after the Member stops, no shadow is kept (C2(b)) | **NOT_REACHED** | no Member ran; archive `blocked target-stale`; no seam reports a disposed agent scope |
| 7 | is a runtime revoke via the Guard reachable in a boot? (C2(b)) | **NOT_REACHED** | no a5sf revoke exists on the 15-tool Team surface — see §6 |

### 5.1 Point 1 — the surface (one `read`) but no Member

`surfacePerMemberRequest` is **empty** (`memberModelTurns: 0`); the one surface
that was captured is the boot-root/discovery surface, which carries exactly one
`read`:

```
model-visible surface (24): bash,edit,glob,grep,read,read_image,team_…,u5_canary,u6fs_probe,write
```

The positive half is real and worth keeping: the Team row config was accepted,
`team.create` returned `ok:true`, the a5sf realm mounted, and the failure came
from the **native attach**, not from configuration or from the mount.

### 5.2 Point 2 — no read call exists to judge

`readResults: 0`; `memberModelTurns: 0`. This boot **must not** be read as “the
read was refused”: the refusal happened one layer earlier, at agent activation.
Nothing about `IO_READ_DENIED` was observed.

### 5.3 Point 3 — the sink is empty, and that is the honest reading

[`consultations.jsonl`](./consultations.jsonl) is **0 bytes**;
`guard-facts.json` is `{ "guardFacts": [], "outsideFacts": [], "insideFacts": [] }`.
An empty sink proves the guard was never consulted (consistent with "no tool
ran"), **not** that a denial was silently dropped.

### 5.4 Point 4 — the inside read

Not executed (same blocker). Neither `A5SF_INSIDE_CLAIM_<world>` nor an allow
fact appears anywhere in the captured corpus.

### 5.5 Point 5 — the loud failure is real, but it is not the deny-lane refusal

The `denyread` Member's creation result, verbatim:

```
{"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
 "message":"activation: child-session creation failed for member 'inst-1m0s1pf1deuo':
  TypeError: agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context
  (the tool plane is per-agent)",
 "details":{"source":"activation-provider","providerCode":"ACTIVATION_CHILD_SESSION_CREATION_FAILED", …}}
```

- **PROVEN:** it does **not** run silently unconfined; the failure is legible to
  the operator (status + code + the exact cause), and no member turn happened.
- **NOT_REACHED:** C2(a)'s *discriminating* arm. The control `worker` Member got
  the **identical** TypeError first, so the deny-then-attach surface-neutrality
  refusal (route C §5(a)) never executed. This boot cannot credit it.

### 5.6 Point 6 — teardown / C2(b) (i): no observable residual shadow

`team_archive_member` was issued and answered `{"status":"blocked","reason":"target-stale"}`
(the Member never reached a live durable state). The host stayed alive with no
realm-dispose fault line. But **no host-exposed seam reports the disposed agent
scope**, so "the row does not keep a shadow after the Member stops" is
**NOT_REACHED** — the seam for it does not exist at this HEAD. Route C's §5(b)
fail-open (realm disposed while the agent lives) is the same class of
unobservable fact.

### 5.7 Point 7 — runtime revoke via the Guard: not reachable

The 15 Team tools contain no a5sf revoke. `team_grant_permission` /
`team_revoke_permission` are the **Alpha.4 permission-rule** lane and do not
re-evaluate a mounted a5sf realm. The only a5sf revoke is the row teardown
(`realm.dispose`), reached by archive and co-terminating with the agent. **No
runtime revoke was attempted or observed; this is a seam gap, stated as such.**

## 6. What this boot did NOT prove

- It did **not** observe a `read` tool call, a guard denial, an allow, or a
  `a5sf-guard-consult/1` fact. Zero consultations.
- It did **not** prove kernel or OS enforcement of any kind (no `read` ran at
  all; no syscall claim is made anywhere here).
- It did **not** validate the compiled-ceiling compiler: the ceiling was a
  compiled-**shaped** fixture from the test composition (§1), because no
  product v3→compiled bridge exists.
- It did **not** reach the `builtinToolDeny`-specific refusal (C2(a)) nor any
  teardown-shadow observation (C2(b)).
- It is **not** a green: `overall=FAIL`.

## 7. The single most important thing the next boot should ask

> After the scope key is supplied by the product (the canonical runtime Agent
> instead of the cross-instance `scopeOf`), does a model-visible native `read`
> — exactly one name on the Member surface — execute on the confined lane: a
> file outside the compiled ceiling refused with `IO_READ_DENIED` and exactly
> one matching `a5sf-guard-consult/1` deny fact in the configured sink, and a
> file inside the ceiling returned with matching bytes?

That is the F1 effective-half question, still open. It should be asked **only
after** the ARC-A-protected change lands (with its own review and override), and
in the same boot it should also re-ask C2(a) (deny-native refusal must now be the
surface-neutrality refusal, not the unscoped-ctx TypeError).

## 8. Budget — what this boot cost

Grant [`grant.json`](./grant.json):

```json
{"grantId":"grant-a5sf-live-native-c8a5836238b1","maxStarts":2,
 "grantedBy":"user ruling 2026-11-03 a5sf-boot-pool-20261103-user-20 — allocation item \"F1 effective-half verification\" (1 boot; the other 2 boots of that item moved to route C and binding acceptance)",
 "boundCommit":"c8a5836238b1a567fb512d09fdf7f4dff5853ae3"}
```

Shared-ledger rows ([`ledger-rows.json`](./ledger-rows.json), `rowCount: 2`):

| # | kind | id | at |
| --- | --- | --- | --- |
| 1 | `budget-intent` (reservation) | `grant-a5sf-live-native-c8a5836238b1` | `2026-11-03T11:23:17.004Z` |
| 2 | host start (`a5sf-live-native-boot1`) | `u5a5sflive-20261103T11-23-17Z` | `2026-11-03T11:23:23.425Z` |

`maxStarts = 2 = 1 intent row + 1 boot` (the gate counts shared-ledger rows, not
spawns). The grant is bound to the HEAD the boot ran on (`c8a583623`); this
evidence commit is its child, which is why the file is not re-bound.

## 9. Local CI (`docs/ROUTER_RULES.md` §8.9)

`pnpm ci:local` (default `--base origin/master`), run **before** the push,
verbatim tail:

```
✔ docs:probe (0.3s)
✔ docs:sync --check (0.3s)
✔ ci shape (eb3-ci-required) (0.1s)
✔ pnpm typecheck (12.5s)

DSH-CI-LOCAL verdict=pass steps=4 failed=0 coverage=determined files=0 wall=13.2s
```

Exit status **0** (pass), **and its stated limit must be read with it**:
`files=0` — this change set selects **no test files**, so the run proves the
four static legs only (docs probe, docs sync, workflow shape, typecheck). It is
**L0**: it is not a substitute for L1/L2 (the world-factory suites), which this
lane cannot run for this change because the evidence directory adds no suite and
this repo's suite registry is a shared test. No local green beyond L0 is claimed.

