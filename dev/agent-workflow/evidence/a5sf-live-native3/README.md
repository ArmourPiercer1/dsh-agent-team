# a5sf LIVE NATIVE 3 — the boot that answered it: a model-visible native `read` runs through the CONFINED provider

**Task (the question boot 2 could not reach).** With the **runtime Agent** as the scope key
(#558, already in this tree), does a **model-visible native `read` on an admitted Member**
execute through the **confined provider**?

**Answer: YES.** One Host start, one World, one Member. The a5sf-wired Member **activated**, its
model-visible surface carried **exactly one** `read`, a `read` **outside** the compiled ceiling was
**refused by the Guard** (typed refusal, no crash, no `ENOENT`), the sink holds **exactly one**
`a5sf-guard-consult/1` fact for that locator (`decision: deny`, `decidedBy: IO_READ_DENIED`), a
`read` **inside** the ceiling returned the **planted bytes**, the **base provider's read counter
did not move for the refused call**, and a Member whose `builtinToolDeny` names `read` **failed
loudly** with the surface-neutrality refusal — not the old unscoped-ctx `TypeError`.

| item | value |
| --- | --- |
| Worktree | `.worktrees/a5sf-live-native3` |
| Branch | `task/a5sf-live-native3-20261103`, from `task/a5sf-live-native2-20261103` (`3af944ca2`, boot 2's corrected composition) |
| HEAD **run** | `3af944ca2e83b81a739bfbdcccec37cd4470dc37` (grant `boundCommit` = this) |
| Host baseline | `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2, asserted before boot; host tree `porcelain` empty after) |
| Pool / allocation charged | `dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json` → **P2-01 live read**, this run = its **SECOND of 3** boots |
| Grant | `grant.json` — `maxStarts: 2` = 1 intent row + 1 boot, bound to `3af944ca2e83…` |
| Ledger | `ledger.jsonl` — 2 rows: `budget-intent` then `a5sf-live-native3-boot1` (order: intent → start row → spawn) |
| Hosts booted | **1 of 1** (`bootsSpent=1`), port **3183**, mock **3493**, host pid 56 killed, port released |
| World | `tests/homes/u5a5sflive3-20261103T13-20-42Z` — **deleted** by teardown (`homeDeleted`, `portFree:true`); `tests/homes` empty in this worktree **and** in the main checkout |
| `:3080` | read-only `GET /` after the run → **401**, same as before; never signalled |
| Core patch budget | **0** — `packages/` untouched; `agent-bindings.mjs` / `a5sf-realm-row.mjs` not edited |
| Runner exit code | **1** — the boot itself succeeded; the driver's **final persistence block** threw a `ReferenceError` (`discoveryPromptReadMentions`). See §7. The boot was **not** re-run. |
| RUN record | `run-record.json` — `overall=NOT_REACHED`, **`PASS:6 NOT_REACHED:1`** |

**RUN-SUMMARY** (verbatim, `run.log`):

```
RUN-SUMMARY run=a5sf-live-native3-2026-11-03T13-20-42-255Z suite=a5sf-live-native3 overall=NOT_REACHED cases=7 NOT_REACHED:1 PASS:6 worlds=none
```

`overall=NOT_REACHED` is the aggregate's conservatism: the **teardown** case is `NOT_REACHED`
(§6). All six of the reviewer's points are `PASS`. `worlds=none` is the record's own bookkeeping
field; the World is named in `boots[0].world`.

---

## 1. Preconditions (run BEFORE the boot, no start spent)

### 1.1 The lane's `--identity-check` — **PASS**

The composition precondition boot 2 died on (two `file://` rows from one package identity), run over
the exact rows this boot would mount. Output saved as `identity-check.txt`:

```
$ node dev/agent-workflow/evidence/a5sf-live-native3/run-boot.mjs --identity-check \
    dev/agent-workflow/evidence/a5sf-live-native3/a5sf-native-provider-row.mjs \
    packages/runtime/dist/packages/runtime/src/plugin/host.js \
    packages/tools/harness/plugin.mjs
[2026-11-03T13:19:52.299Z] identity-check PASS {"ok":true,"rows":[
  {"rowId":"row-0","modulePath":"…/evidence/a5sf-live-native3/a5sf-native-provider-row.mjs",
   "packageName":"dsh-agent-team","packagePath":"…/package.json","hasClientHalf":true},
  {"rowId":"row-1","modulePath":"…/packages/runtime/dist/packages/runtime/src/plugin/host.js",
   "packageName":"@dsh-agent-team/runtime","packagePath":"…/packages/runtime/package.json","hasClientHalf":false},
  {"rowId":"row-2","modulePath":"…/packages/tools/harness/plugin.mjs",
   "packageName":"@dsh-agent-team/tools","packagePath":"…/packages/tools/package.json","hasClientHalf":false}]}
```
exit **0**. Exactly **one** row resolves to the client-half package (`dsh-agent-team`), so the
client-modules registry's "remove one entry" refusal cannot fire.

The **identical** check ran again inside the boot over the *real* row set (including the
non-`file://` preset row) before the grant:

```
[2026-11-03T13:20:42.255Z] pre-boot row identity check: {"ok":true,"rows":[…same three…]}
[2026-11-03T13:20:42.255Z] grant materialised: …/grant.json maxStarts=2 boundCommit=3af944ca2e83b81a739bfbdcccec37cd4470dc37 item=P2-01 live read (BL-14 / G2 live half)
```

### 1.2 Host-free plan preflight (`--plan`: no gate, no ledger row, no spawn)

`plan.log`:

```
[2026-11-03T13:19:59.827Z] HEAD=3af944ca2e83b81a739bfbdcccec37cd4470dc37 pinnedHost=639ed015397290b3745d163aafe02ffee4aa3f84
[2026-11-03T13:19:59.868Z] blueprint ingest: anchor={"ok":true,"via":"parseBlueprint(dist domain facade = the host own import)"} main={"ok":true,…}
[2026-11-03T13:19:59.904Z] pre-boot row identity check: {"ok":true,…}
[2026-11-03T13:19:59.904Z] plan world torn down: homeDeleted=…/tests/homes/u5a5sflive3-20261103T13-19-59Z releasedPorts=[]
```

### 1.3 The gate and the world (the accounting, from `run.log`)

```
[2026-11-03T13:20:42.288Z] gate lease: grant=grant-a5sf-live-native3-3af944ca2e83 intentRows=1 rowsBeforeIntent=0 rowsAfterIntent=1 remaining=1
[2026-11-03T13:20:42.328Z] team row a5sfEvidencePath=…/u5a5sflive3-20261103T13-20-42Z/a5sf-consult.jsonl a5sfNativeToolModules=["file:///…/tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js"]
[2026-11-03T13:20:48.699Z] mock started on 3493
[2026-11-03T13:20:57.117Z] BOOTED port=3183 (lease bootsSpent=1)
[2026-11-03T13:20:57.309Z] p6t6 health=true hostAlive=true
[2026-11-03T13:20:57.718Z] p6t6 state (rootSessionId=session-a5sf-live3-root, teamSession!=null)=true
[2026-11-03T13:20:59.415Z] team.create status=200 ok=true
[2026-11-03T13:21:00.617Z] tool calls (deduped): read,team_delegate,read,team_delegate,team_create_member,team_archive_member,team_follow_up
```

The composed profile actually launched is preserved byte-for-byte:
`logs/u5a5sflive3-20261103T13-20-42Z/composed-profile-0713a14c….patch.yml` (4 rows: the one
evidence row, the production Team row, `p6t6`, and the preset declaration).

---

## 2. Point 1 — an a5sf-wired Member activates; the discovery surface carries exactly ONE `read`

**PROVEN.** `live:member-activated-surface-one-read = PASS` (`run-record.json`):

```
memberRequestSeen=true  hostAlive=true
memberReadSchemas=1     memberSurfaceSize=24   memberSurfaceHasDuplicates=false
discoveryReadSchemas=1  discoveryPromptReadMentions=0  discoveryPromptReadSectionMentions=0
memberPromptReadMentions=0  memberPromptReadSectionMentions=0
memberReadCalls=2
```

The Member's model-visible surface (captured from the mock's request, i.e. what the model actually
saw), identical to the boot-root discovery surface:

```
bash,edit,glob,grep,read,read_image,team_archive_member,team_collect,team_create_member,
team_delegate,team_follow_up,team_grant_permission,team_inspect_config,team_list_members,
team_list_pending_control,team_list_templates,team_report_progress,team_request_control,
team_resolve_control,team_revoke_permission,team_send_message,u5_canary,u6fs_probe,write
```

`read` appears **once**; no duplicate tool names; the Member gained **no** extra `tool:read` prompt
section relative to the discovery prompt (0 == 0). The activation itself is the positive
counterpart to boot 1: the same wiring that boot 1 saw refused with
`needs a SCOPED agent Context` now **admits** the Member, and the Member runs model turns
(`member requests=6`, `read calls=2`).

## 3. Point 2 — a native `read` OUTSIDE the ceiling is REFUSED by the Guard

**PROVEN.** `live:native-read-outside-refused = PASS`. The member request for token `a5sf3-d1`
issued `read` on `…/u5a5sflive3-…/outside-ceiling.txt` (outside the compiled ceiling root = the
world workspace). The tool result the model received, verbatim:

```
Error: authored locator '…/u5a5sflive3-20261103T13-20-42Z/outside-ceiling.txt' is outside every allow subtree of the lane
```

```
isError=true   guardRefusalText=true   crashLikeText=false   enoentLikeText=false   outsideClaimLeaked=false
```

That is a **typed denial**, not a stack trace/`TypeError` and not a raw `ENOENT`; the planted
outside claim never reached the model.

## 4. Point 3 — the sink holds EXACTLY ONE `a5sf-guard-consult/1` fact for it

**PROVEN.** `live:sink-exactly-one-deny-fact = PASS`. The witness is the **product's own sink**
(`a5sfEvidencePath`), copied verbatim to `consultations.jsonl` (1296 bytes, sha256
`ac44949be715a05ac2a69d96d242368d543baaff7fbe3fabdee0c19849332bed`):

```
totalGuardFacts=3   outsideFacts=1   denyFacts=1   outsideDenyFacts=1
```

The one fact for the refused locator, whole row:

```json
{"schema":"a5sf-guard-consult/1","realm":"member","memberIdentity":"inst-076sd9g0gtwp",
 "toolBindingIdentity":null,"policyRevision":"a5sf-live3:inst-076sd9g0gtwp:g1","method":"stat",
 "locator":"…/u5a5sflive3-20261103T13-20-42Z/outside-ceiling.txt",
 "decision":"deny","decidedBy":"IO_READ_DENIED","sequence":1,"observedAt":"2026-11-03T13:20:58.668Z"}
```

The other two facts are the *inside* call's `stat`+`readText` **allow** pair (§5) — the whole sink
is exactly three facts, one deny for the outside locator.

## 5. Point 4 — a native `read` INSIDE the ceiling succeeds with MATCHING BYTES

**PROVEN.** `live:native-read-inside-allowed = PASS`. The **same Member**
(`inst-076sd9g0gtwp`) read `…/workspace/inside-ceiling.txt`; the tool result, verbatim:

```
<path>…/u5a5sflive3-20261103T13-20-42Z/workspace/inside-ceiling.txt</path>
<type>file</type>
<content>
1: A5SF3_INSIDE_CLAIM_u5a5sflive3-20261103T13-20-42Z

(End of file - total 1 lines)
</content>
```

The planted file was `A5SF3_INSIDE_CLAIM_u5a5sflive3-20261103T13-20-42Z\n` — the returned bytes
match. `insideClaimReturned=true`, `isError=false`, and its consultations were `allow`
(`stat`/`readText`, `decidedBy: ALLOW`).

## 6. Point 5 — the BASE provider's read counter did not move; the confined provider served it

**PROVEN.** `live:base-read-counter-did-not-move = PASS`.

```
counter installed: leg=counter-installed baseCtor=SandboxedFileSystem baseInstance=fs-0
                   methods=[readText,streamText,readBytes,readByteRange]
readRows=1  outsideAny=0  outsideBase=0  insideAny=1  insideBase=0  insideConfined=1
```

The only counter row:

```json
{"leg":"read-call","method":"readText","path":"…/workspace/inside-ceiling.txt","instance":"fs-1","isBase":false}
```

- the **refused** call produced **zero** counter rows → it never reached *any* provider read method
  (the guard's `stat` refused first), so the base provider's counter did not move for it;
- the **inside** call was served by instance `fs-1` with `isBase:false` — the **confined** provider
  (the realm installs `createConfinedFileSystemClass(Base, guard)` into `root.isolate('fs', …)`), not
  the base instance `fs-0`;
- `insideBaseRead=0`: the base instance served neither call.

**Disclosure:** the shipped host `fs` provider has **no read counter of its own**. This counter is
*test-composition* instrumentation installed by `a5sf-native-provider-row.mjs` behind
`config.counterPath` — an in-memory, pass-through wrap of the four read methods on the live
provider class prototype. It is not a product counter and must not be quoted as one.

## 7. Point 6 — a `builtinToolDeny: [read]` Member fails LOUDLY with the surface-neutrality refusal

**PROVEN.** `live:deny-native-surface-refusal = PASS`. The leader's `team_create_member` for the
`denyread` template returned, verbatim (`isError:false` at the envelope level — the **body** carries
the rejection):

```json
{"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED",
 "message":"activation: child-session creation failed for member 'inst-1jidzyz0kmqw': TypeError: agent-bindings: the configured a5sfNativeToolModules would CHANGE the Member's model-visible tool surface (added: [\"read\"]; removed: []); refusing to mount the native shadow — a scoped registration is outside the inherited tools.restrict filter, so a re-mounted tool could re-enable a builtinToolDeny lane",
 "details":{"source":"activation-provider","providerCode":"ACTIVATION_CHILD_SESSION_CREATION_FAILED",
            "rootSessionId":"session-a5sf-live3-team","instanceId":"inst-1jidzyz0kmqw"}}
```

```
a5sfSurfaceRefusal=true   unscopedCtxTypeError=false
```

It fails **closed** at Member setup: the deny lane hid `read`, the shadow's registration would have
**added** `read` back (`added: ["read"]`), and the attach refused — the exact surface-neutrality
law. The old `needs a SCOPED agent Context` TypeError boot 1 observed is **gone**.

---

## 8. Teardown — **NOT_REACHED**, and the stop itself was refused (two independent reasons)

`live:teardown-no-shadow = NOT_REACHED` with
`reason: NO_OBSERVABLE_SEAM_FOR_A_DISPOSED_AGENT_SCOPE_ON_A_SUBSEQUENT_READ`.

**Reason A — the stop never happened.** The driver's `team_archive_member` was **refused** by the
leader's mutation envelope. Verbatim from `run.log`:

```json
{"status":"rejected","code":"TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS",
 "message":"TeamRuntime: operation 'archive-member' (action 'archive-member') is outside the caller's mutation envelope — the boundary fails closed",
 "details":{"action":"archive-member","op":"archive-member","requiredOps":["archive-member"],
            "inBounds":["create-member","assign-task","send-message","report-progress"]}}
```

This is a **test-composition defect in this driver**, not a product finding: `mainBlueprintYaml()`
declares `teamEnvelope.allow: [create-member, assign-task, send-message, report-progress]` and
never adds `archive-member`, so the leader may not archive. The follow-up probe then **executed**
on the still-live Member:

```json
{"status":"executed","action":"follow-up","targetInstanceId":"inst-076sd9g0gtwp",
 "effect":{"kind":"work-admitted","fromLifecycle":"SETTLED","lifecycleCommitted":true,
           "memberResult":{"status":"succeeded","body":"A5SF3_INSIDE_DONE …"}}}
```

**Do not read the record's `archiveOk:true` / `archivedLifecycle:true` as "the Member was archived".**
Those fields test `isError===false` and a `/archiv/i` regex; the rejected body contains the word
`archive-member`, so both are satisfied *by the refusal text*. The record's **verdict**
(`NOT_REACHED`) is right; those two detail booleans are misleading and are corrected here rather
than edited in the append-only record.

**Reason B — there is no seam that reports it.** Seams enumerated by the driver, all checked:
`team_archive_member` + a model-visible `team_follow_up`; `GET /__p6t6/state`
(`members[].lifecycle`, `observations[]`); `POST /__p6t6/tool {name:"read", as:<childSessionId>}`
(only a live agent can be dispatched to); the host instance log (no realm-dispose / shadow lines);
the 15 team tools (no a5sf revoke). The state endpoint returned only `inst-leader` in `members[]`
(`workerMember: null`), so the post-archive dispatch could not even be attempted
(`postArchiveReadStatus: null`).

**Answer to "is the shadow gone after the Member stops?": NOT REACHED — and not observed either
way.** No read-after-stop witness exists on this live product, and in this run the Member never
stopped. The dispose contract remains host-free evidence only (route-C arm N4). This is not evidence
that the shadow is gone.

The record also carries `disposeFaultObserved:true` (an `observations[]` entry matching `/a5sf/i`
existed). Its **verbatim text did not survive** — `teardown.json` was never written (§9) — so it is
reported as a flag, not as a finding, and no claim is built on it.

---

## 9. The driver defect that cost the artifacts (not the answer)

The boot **succeeded and answered every point**, then the driver threw while **persisting** the JSON
dumps:

```
[2026-11-03T13:21:00.626Z] RUN FAILED: ReferenceError: discoveryPromptReadMentions is not defined
    at boot (…/run-boot.mjs:1086:7)
```

`discoveryPromptReadMentions` is a **key**, never an identifier; the declared name is
`discoveryReadMentions`. The typo is **pre-existing in boot 2's driver** (`evidence/a5sf-live-native2/run-boot.mjs:1076`)
— boot 2 aborted at Loader compose and never reached that line, so it was never exercised until now.

**Why the answer is unaffected.** The crash is *after* every observation and every verdict:
`consultations.jsonl` had already been copied, all seven `record.addCase(...)` calls had already run,
and `run-record.json` was written by the `finally` block. Proof in `run.log` line order: the sink
copy line, the seven `case …` lines, then `RUN FAILED`, then the `finally` teardown and
`RUN-SUMMARY`. **The boot was not re-run** (1-boot budget); spending a second start to regenerate
derived JSON would have been waste.

**What was therefore never written** (all of it *derived* from data that did survive, except the
mock corpus):

| artifact | status |
| --- | --- |
| `transcript.json` | **ABSENT — raw mock request corpus is LOST** (in-memory in the mock, destroyed with the World). Not reconstructed: a reconstruction would look like a capture. Per-case captured values survive in `run-record.json` (surface, calls, the refusal text, the inside bytes, the sink facts, the counter rows) — the same values the driver computed. |
| `guard-facts.json` | absent (redundant: `consultations.jsonl` **is** the sink, copied verbatim before the crash) |
| `base-reads.json` | absent; the counter rows survive verbatim in `run.log` (§6) |
| `host-witnesses.json`, `teardown.json` | absent; the host instance log is preserved under `logs/…/instance-port3183.log`, the archive/follow-up bodies in `run.log` (§8) |
| `record.evidence` block | absent (set after the crash); `boots[]`, `bindings`, per-case verdicts+detail are present |

The one-line fix is applied in this directory's `run-boot.mjs` with an in-code disclosure; the fix
changes **only** artifact writing, never a capture or a verdict — which is why it did not justify
another boot.

## 10. Residual risks / what this boot does NOT claim

- **The ceiling is a fixture.** No product code provides `teamA5sfRealm` at this base and there is
  no v3-blueprint → compiled-policy bridge, so the `MemberPolicy` is composed by the **test row**
  (`a5sf-native-provider-row.mjs`) as a compiled-shaped `{ok:true,value}`. The **guard** that
  enforced it (`createMemberFsGuard` + `TeamConfinedFileSystem`) is the **shipped** one. This proves
  the *seam* (a Member's native `read` is served by the confined provider), not product policy
  compilation.
- **One template, one Member ceiling.** `worker` has no `capabilities` block, so the only
  confinement is the compiled a5sf realm; `providerClass` is deliberately omitted so the base is
  the host's own `fs`, never a test double. No binding-level realms were exercised.
- **The counter is test instrumentation**, in-memory and pass-through (§6). It distinguishes base
  (`fs-0`) from confined (`fs-1`) **instances**; it cannot distinguish "confined provider served it"
  from "some other non-base instance served it" beyond the instance identity.
- **The mock model is scripted.** The tool calls come from the driver's `decide()`, one call per
  turn; this proves the *product path* for a model-visible call, not model judgement.
- **Teardown is NOT_REACHED for two reasons** (§8), one of which is this driver's own envelope
  omission. Nothing is claimed about shadow disposal on a stopped Member.
- **`:3080` was only probed read-only** (`GET /` → 401 before and after); the stable instance and
  its `DSH_HOME` were never touched.
- **`worlds=none` in the summary** is the record's bookkeeping field, not a claim that no World
  booted (see `boots[0].world`).

## 11. Files

| file | what it is |
| --- | --- |
| `run-boot.mjs` | the ONE-boot driver (`--plan`, `--identity-check`, boot); fixed persistence line disclosed in-code |
| `a5sf-native-provider-row.mjs` | the single test-composition row: `teamA5sfRealm` + the disclosed read counter |
| `identity-check.txt` | the pre-boot row-identity PASS (verbatim) |
| `plan.log` | the host-free plan preflight (no gate, no ledger row, no spawn) |
| `grant.json` | per-run grant, `maxStarts:2`, `boundCommit 3af944ca2e83…` |
| `ledger.jsonl`, `ledger-rows.json` | the shared-ledger intent + start rows |
| `run.log` | the run's own log — **the primary surviving capture** |
| `run-record.json` | machine RUN record: bindings, boot, 6 PASS / 1 NOT_REACHED with per-case detail |
| `consultations.jsonl` | the product sink, copied verbatim (3 facts; 1 deny) |
| `logs/u5a5sflive3-20261103T13-20-42Z/instance-port3183.log` | the Host's own stdout (boot marker, remote mount). The launch token is **redacted** in this preserved copy (`?token=<redacted>`); the World home it authenticated is deleted and nothing else in the log was altered |
| `logs/…/composed-profile-0713a14c….patch.yml` | the exact profile layer launched |
| `logs/u5a5sflive3-20261103T13-19-59Z/` | the plan-mode World's (empty) log dir |
| `transcript.json` | **absent — see §9** |
| `README.md` | this document |

### Reproduction (no boot)

```bash
node dev/agent-workflow/evidence/a5sf-live-native3/run-boot.mjs --identity-check \
  dev/agent-workflow/evidence/a5sf-live-native3/a5sf-native-provider-row.mjs \
  packages/runtime/dist/packages/runtime/src/plugin/host.js packages/tools/harness/plugin.mjs
node dev/agent-workflow/evidence/a5sf-live-native3/run-boot.mjs --plan
node scripts/eb3-evidence-guard.mjs
```

The boot itself (`node …/run-boot.mjs`) must **not** be re-run on this grant: `ledger.jsonl` already
holds its 2 rows and the lease refuses a second spawn.

## 12. Disposition and the single next question

- **Points:** 1–6 **PROVEN**. **Teardown: NOT_REACHED** (stop refused by this driver's envelope +
  no disposed-scope seam).
- **Boots:** 1 spent (P2-01, its 2nd of 3). **1 boot remains in P2-01's allocation.**
- **The scope-key question is answered:** with the runtime Agent as the scope key, a model-visible
  native `read` on an admitted Member **does** execute through the confined provider — outside
  refused with exactly one deny fact, inside served with matching bytes, base provider untouched.

**The single next question:** *the teardown half is still unobserved — does the a5sf shadow (the
re-mounted native tool layer) disappear when a Member is actually stopped, and is there ANY live
seam that reports it?* Answering it needs a composition whose leader envelope **includes
`archive-member`** (a one-line fixture change in `mainBlueprintYaml()`), and a witness for a read
after the stop; if no such seam exists, the next deliverable is the seam proposal, not another boot.
