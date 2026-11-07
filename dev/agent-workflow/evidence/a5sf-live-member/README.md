# `a5sf-live-member` — a REAL Member turn inside a governed Realm

**Status: produced.** This lane did **not** end in `NOT_WIRED`. A real Member was
activated through the product's own `team_delegate` path inside a governed Realm on a
booted Host, ran two `bash` calls, was **admitted** on one and **refused** on the other,
and both outcomes are in the Member's **own** durable transcript. The instrument is
`tests/world-factory/drivers/a5sf-live-member/run-boot.mjs`; one command runs two boots
and writes an agreeing pair.

Getting there required a fix, and the fix is in **our** package, not in the pinned Host:

| | |
| --- | --- |
| Blocking seam | `governedAuthorityReference` read "no durable MemberInstance row yet" as "not admitted" during the live child-creation window |
| Where | `packages/runtime/src/plugin/live/a5sf-governed-realm.mjs` + `packages/runtime/src/plugin/host.ts` (+ `.d.mts`, + committed `dist`) |
| `CORE_SEAM_BLOCKER`? | **No.** The pinned Host is untouched (`git status --porcelain` empty at the end); CORE PATCH BUDGET stays 0 |
| Candidate claim? | **No.** `recordClass: DEV-LIVE` ⇒ `candidateClaimEligibility.eligible: false` (`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`), quoted from both records |

## 1. The blocking seam, and how it was determined

The pre-#648 acceptance was boot/config level: the shipped rows compose, the v4 design is
durable, no realm refused. What had never happened is a Member **turn**. The first boot of
this driver created the Team, the Leader issued its `team_delegate`, and the attach was
refused. The refusal is kept verbatim in
[`seam-before/leader-delegate-AUTHORITY_REFUSED.json`](./seam-before/leader-delegate-AUTHORITY_REFUSED.json):

```text
TEAM_RUNTIME_DURABLE_WRITE_FAILED
activation: child-session creation failed for member 'inst-0htk69p0jfud':
TeamServiceInstallError: MEMBER_POLICY_UNAVAILABLE: Member 'inst-0htk69p0jfud'
(template 'worker') could not compile its ceiling
(AUTHORITY_REFUSED: Alpha.4 does not admit this member; no I/O policy is compiled
for a non-admitted member); a declared realm never mounts on an uncompiled policy
```

It was not a transient. Reading the chain from the refusal backwards established the
ordering, which is frozen and is the actual seam:

1. `packages/runtime/activation/adapter.ts#createChildSession` calls the child-session
   factory **first**, then `durability.ensureDurable(childSessionId)`, and only **then**
   does the coordinator durably write the `MemberInstance` row. Its own comment: *"the
   child artifact is durable BEFORE the MemberInstance record is written; the operation
   stays PREPARED until then."*
2. `packages/runtime/src/plugin/live/agent-bindings.mjs#childFactory.createChildSession`
   mounts **this Member's** governed realm during that call.
3. The realm provider asks the Host for the durable Alpha.4 authority
   (`readAuthority` → `permissionOverlay.latest` → `MemberInstance` row). Inside the
   window that row **does not exist yet**, so `lifecycle` is `undefined`.
4. `governedAuthorityReference` admitted only `CREATED / RUNNING / SETTLED`. `undefined`
   was treated as "not admitted", the compiler refused with `AUTHORITY_REFUSED`, the
   provider propagated `MEMBER_POLICY_UNAVAILABLE`, and the realm never mounted.

So a live governed Member could **never** attach. In-process acceptance could not see it:
those tests mount the realm against a roster where the row already exists. The bug lives
exactly in the difference between "mounted after the row exists" and "mounted during the
live creation window". Nothing in the pinned Host causes it and nothing there needs a
patch.

## 2. The fix: the fresh-create window

`governedAuthorityReference({generation, lifecycle, freshCreate})` now admits the window,
and the window is deliberately narrow:

```js
const admitted = GOVERNED_ADMITTED_LIFECYCLES.includes(lifecycle)
  || (lifecycle === undefined && freshCreate === true)
```

- `freshCreate` is the **one fact the live glue already carries**: the child factory's
  `bindPath`, which is `'fresh-member'` only for a fresh creation (it already bridges the
  persona/consumption resolution). No new state, no new store, no new plumbing.
- A **durable row always wins.** `ARCHIVED` / `DISPOSED` refuse; `CREATED` / `RUNNING` /
  `SETTLED` admit; the window only fills `undefined`.
- A **cold** mount (`bindPath === 'cold-member'`) passes `freshCreate: false` and reads
  the row it resumed — no window.

`G5c` in `tests/world-factory/a5sf-governed-preset.test.mjs` pins the negative controls:
the window admits only `lifecycle === undefined`, `ARCHIVED`/`DISPOSED` beat it, and the
admitted lifecycles are unchanged. Source and the committed `dist` mirrors were rebuilt;
the `dist` bytes were verified to contain the window before the evidence run.

## 3. The instrument

```sh
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs
```

One command: two boots, one agreement. `--boots 1` is a development iteration, `--plan`
is host-free. The driver's own README (contract, inputs, artefacts, failure discipline) is
next to it: [`tests/world-factory/drivers/a5sf-live-member/README.md`](../../../../tests/world-factory/drivers/a5sf-live-member/README.md).

**Composition.** The `dsh-agent-team/host` row and the `preset-a5sf-governed-member` row
are the **shipped** rows from `cordis.patch.yml` (the single `!!js
process.platform === 'win32'` predicate is *evaluated*, logged in
[`driver-digest.json`](./driver-digest.json), not stringified). The Team row is overridden
only with the preset's opt-in keys (`memberPresetId: a5sf-governed-member`,
`a5sfGovernedRealm: true`, `a5sfEvidencePath`), the boot/anchor fields, and a real
schemaVersion 4 `blueprintSource` whose one `memberIoCeilings` family is read/write = the
World workspace, network allow. The Leader template declares **no** `capabilities`: with
them the coverage gate demands a full permission set and refuses the 19 team tools as
unmanaged; without them the shipped default surface (which already carries every `team_*`)
is what the Leader runs.

**The turn.** The Leader is given a prompt; its scripted decision calls
`team_delegate(template 'worker', requestToken a5sf-lm-turn-delegate)`. The Member's
prompt says: run the two read probes exactly once each, one tool call at a time, then
report. Probe A is `<workspace>/in-lane.txt`, Probe B is
`<home>/out-of-lane/secret-out-of-lane.txt` — deliberately outside the ceiling. The
Member must answer through `bash`, so its answer cannot be produced without the tool
result.

**What is fixture, what is product.** The **model is scripted** (the shared
`mock-deepseek.mjs`); that is the only substitution. The activation path, the realm
provider, the policy compiler, the guard consult sink, the confined `terminals` face and
the confined process provider are the real modules the Host loads from
`packages/runtime/dist`. The driver adds no fixture tool module and no custom realm row.

The Member request is selected **structurally** (first user message starts with
`[team-work ` and carries the token), never by substring: the Leader's own post-delegate
request also contains the token inside the delegate result JSON, and selecting on that
replayed the Member script on the Leader — measured, then fixed.

## 4. The pair

| | boot 1 | boot 2 |
| --- | --- | --- |
| World (`DSH_HOME`) | `tests/homes/u5u5a5sfsub1-20261107T11-09-30Z` | `tests/homes/u5u5a5sfsub1-20261107T11-10-17Z` |
| Host / port | `3185` | `3185` |
| Head recorded by the record | `11991c2d4` | `11991c2d4` |
| Member child session | `session-team-child-cb24a8f5a8c5515a69d57e13a5167e0e` | same formula, same inputs |
| Instance | `inst-0htk69p0jfud`, `ADMISSION_OPEN`, `workSettled: true` | same |
| Member model calls | `3` (tool 1, tool 2, final) | `3` |
| Confined-provider launches | `1` for two commands | `1` |
| Provider `policyRevision` | `a5sf1:9a8fc80a…` | `a5sf1:39d377aa…` |

The two `policyRevision` values differ **by construction**: the revision is
content-addressed over inputs that include the World-specific workspace path and the
authority revision, so two different Worlds produce different labels for the same rules.
The rules are identical (read = write = the workspace, network allow), and the guard facts
below are identical.

### The Member's own transcript (boot 1, verbatim)

From [`runs/boot01/member-transcript.txt`](./runs/boot01/member-transcript.txt) lines
43–56; the JSON and the raw artefact are linked in §8.

```text
TOOL CALL [bash] call-a5sflm-admit
  command: cat '…/u5u5a5sfsub1-20261107T11-09-30Z/workspace/in-lane.txt'; sleep 1.5
  workdir: …/u5u5a5sfsub1-20261107T11-09-30Z/workspace
TOOL RESULT isError=false
  {"kind":"confined-terminal","sessionId":"confined-pty-1","exitCode":0,"signal":null,
   "timedOut":false,"aborted":false,"cancelled":false,
   "stdout":"A5SF_LIVE_MEMBER_IN_LANE_BYTES\n","stderr":"",
   "scrollback":"A5SF_LIVE_MEMBER_IN_LANE_BYTES"}

TOOL CALL [bash] call-a5sflm-deny
  command: cat '…/u5u5a5sfsub1-20261107T11-09-30Z/out-of-lane/secret-out-of-lane.txt'; sleep 1.5
  workdir: …/u5u5a5sfsub1-20261107T11-09-30Z/workspace
TOOL RESULT isError=true
  Error: IO_READ_DENIED: authored locator '…/u5u5a5sfsub1-20261107T11-09-30Z/out-of-lane/secret-out-of-lane.txt'
  is outside every allow subtree of the lane

ASSISTANT (final):
A5SF_LM_MEMBER_DONE Error: IO_READ_DENIED: authored locator '…/secret-out-of-lane.txt' is outs
```

The **admitted** read returns the in-lane marker bytes; the **denied** read returns a typed
error and **zero** secret bytes — inside the Member's own log, both as tool results. The
final line ends mid-word only because the scripted model caps its own reply at 200
characters (fixture), not because anything truncated the tool result.

### Guard facts (product sink, both boots identical)

From [`runs/boot01/guard-facts.json`](./runs/boot01/guard-facts.json), identity
`inst-0htk69p0jfud`:

| `method` | `locator` | `decision` | `decidedBy` |
| --- | --- | --- | --- |
| `shellRead` | `<workspace>/in-lane.txt` | `allow` | `ALLOW` |
| `spawn` | `<workspace>` | `allow` | `ALLOW` |
| `spawn:write` | `<workspace>` | `allow` | `ALLOW` |
| `shellRead` | `<home>/out-of-lane/secret-out-of-lane.txt` | `deny` | `IO_READ_DENIED` |

Exactly one ALLOW and one DENY on the **read** axis, for the real Member identity, at the
realm's `policyRevision`. The refused call never reached a shell: there is no
`confined-terminal` record for it.

### `LOCUS` — which layer did what

- **Attach.** [`runs/boot01/leader-delegate.json`](./runs/boot01/leader-delegate.json):
  `kind: member-activated`, `instanceId`, `childSessionId`, `admissionCode:
  ADMISSION_OPEN`, `workSettled: true`, `memberResult.status: succeeded`.
- **Admission/refusal of each read.** `guard-facts.json` above; the locator and the
  `decidedBy` code are the attribution. The refusal is the **guard's** (`IO_READ_DENIED`
  at admission), not the OS profile's and not the tool's argument validation.
- **Execution of the admitted read.** `counters.json` + `proc-observations.json`: one
  `landlock-prelauncher.py --confined-exec-stream` process under this World's
  `governed-scratch/plans/` directory. The base `bwrap` wrappers of the gateway itself are
  counted (`otherBwrapPids`) and none names the fixtures.
- **The Member's words.** `member-transcript.json` + `member-session.v4.jsonl.zstd`, found
  by header id in `<DSH_HOME>/sessions/**` (the durable name on this Host generation is
  `session.v4.jsonl.zstd`).
- **The record.** `run-record.json` `bindings`: `teamSha 11991c2d4…`, `hostSha
  639ed01539…`, authority pointer `as20261105r2`, grant `devlive-subprocess-1`, and
  `candidateClaimEligibility.eligible: false`.
- **Teardown.** `teardown.json`: host killed by identity, port released, home deleted,
  pinned-host porcelain `[]`.

## 5. Counters and the spawn witness

| counter | boot 1 | boot 2 |
| --- | --- | --- |
| `confinedTurnLaunchers` | `1` | `1` |
| `preflightLaunchers` (attach-time probes, **excluded**) | `3` | `5` |
| `baseBwrapWithMarkers` | `0` | `0` |
| `otherBwrapPids` (gateway's own wrappers, excluded) | `1` | `1` |
| `payloadInLaneSightings` | `0` | `0` |
| `procSecretCommandSightings` | `0` | `0` |
| `memberModelRequests` | `3` | `3` |
| guard `allow` / `deny` | `1` / `1` | `1` / `1` |

`payloadInLaneSightings` is **0 and is not used as a witness**: the confined terminal
writes the command text to a PTY, so the command never appears in any process's `argv`
(a property of the face, measured). The independent witness is therefore the provider
launcher process: exactly **one** `--confined-exec-stream` launcher under this World's
scratch for the **two** commands, and **zero** base `bwrap` carrying either fixture. The
denied command's absence of a spawn is corroborated by the DENY fact and by the absence of
a `confined-terminal` result. `preflightLaunchers` varies between boots (3 vs 5) because
it counts the realm's own attach-time probes; it is disclosed and deliberately **not** an
agreement row.

## 6. Two-run agreement

From [`agreement.txt`](./agreement.txt) (the same command, two boots):

```text
fact                          boot1                         boot2
overall                       PASS                          PASS
admittedVerdict               PROVEN                        PROVEN
deniedVerdict                 PROVEN                        PROVEN
surfaceVerdict                PROVEN                        PROVEN
factsVerdict                  PROVEN                        PROVEN
spawnsVerdict                 PROVEN                        PROVEN
allowFacts                    1                             1
denyFacts                     1                             1
confinedTurnLaunchers         1                             1
payloadInLane                 0                             0
procSecretCommandSightings    0                             0
baseBwrapWithMarkers          0                             0
governedSurface               true                          true
admittedBytes                 true                          true
deniedSecretAbsent            true                          true
transcriptSourceCount         2                             2

agreeing=true differing=[]
```

`transcriptSourceCount: 2` = one Member user envelope + one final assistant message
resolved from the Member's own log (the tool calls/results are separate fields).

## 7. What this cannot prove

- **The scripted model.** The two tool calls and the final wording are decided by a mock,
  not by a model. The product path that **executes** them and **decides** their admission
  is real, but this is not a claim about model behaviour.
- **Network confinement.** The shipped preset declares network **allow** only; a narrowed
  lane is refused at assembly. Nothing here claims netns/network-deny behaviour on this
  face (BL-39 / PD-5 unchanged).
- **Dynamic shell reads.** `$(…)`/backticks are not lexically attributable and are not
  refused at admission; only the authored locator is judged. PD-13's weakness stands.
- **Workspace/scratch Team isolation** — `NOT_WIRED`; the scratch root is a Host path
  (`A5SF_GOVERNED_SCRATCH` override), per-Team isolation is not claimed.
- **A stronger kernel claim.** The witness says *which process* ran (the confined
  provider's launcher); it does not independently prove the ruleset's contents beyond the
  guard facts and the one redirect-free execution.
- **Any candidate claim.** `DEV-LIVE` is development evidence; the records say so in their
  own eligibility field (`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`). No `V@B`, no grade, no
  register status change. The one register edit is mechanical: PD-11's anchor lines moved
  +5 (symbols unchanged) because the seam fix added lines above them in `host.ts`.
- **One boot's exact host log.** The Host's raw stdout is driver scratch and contains the
  one-time bootstrap token URL; it is not committed. `runs/bootNN/host-log-final.log` is
  its redacted tail.

## 8. Artefacts and reproduction

```sh
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs     # two boots, ~2 min
```

Per boot (`runs/boot01`, `runs/boot02`): `member-transcript.json` / `.txt`,
`member-session.v4.jsonl.zstd` (the Member's **raw** durable log),
`member-surface.json` (the confined `bash` schema with only `command` / `description` /
`workdir`), `guard-facts.json`, `counters.json`, `proc-observations.json`,
`leader-delegate.json`, `leader-surface.json`, `run-record.json`, `summary.txt`,
`host-log-final.log`, `teardown.json`. Run level: `agreement.json` / `.txt`,
`driver-digest.json`, `driver.log`, `plan-patch.yml`, `run-ledger.jsonl`,
`seam-before/`.

## 9. Gates

| gate | result |
| --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **pass**, exit 0 (includes the new `G5c` and the debt register) |
| `node scripts/doc-checks.mjs` | **pass**, exit 0 |
| `tests/world-factory/a5sf-debt-register.test.mjs` | **pass** (anchors re-resolved, §7) |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | **pass** (`round 58`, pointer agrees both ways) |
| `git diff --check` | **clean** |

The pinned host tree had to be *provisioned* for the world-factory tests in this worktree
(`tests/deepseek-harness-test-use` was absent; it is gitignored). The driver itself
resolves the shared read-only checkout and never writes it — porcelain `empty` /
`[]` before and after every boot, including at the end of this run.

**p4t6 population.** No booking is owed: this lane adds **no path under `packages/**`**
(the diff is `M` only — three sources, four committed `dist` mirrors; the new driver and
README are under `tests/`, the evidence under `dev/`). Measured, not assumed: the p4t6
scanner on this tree reports **`filesScanned = 1439`**, and `packages/testkit/test/
p4t6-session-event-scan.test.ts` is **20/20 pass** with the booked total unchanged.

## 10. Should `150-a5sf-read.mjs --live` be wired to this driver?

**No — it should stay refusing, and it does.** A dated note now says why in the suite
itself (the old "no production caller" sentence was stale; the refusal is unchanged):

- 150's proposition is the **native `read` tool** on a booted Host reaching the compiled
  confined Provider through an `A5SF_READ_DRIVER` module that runs where the Provider is
  mounted (the Host process, or an RPC into it). This driver proves the Member's confined
  **`bash`**, reached through `team_delegate`, and it is a separate process/evidence
  class. Wiring 150 to it would answer a different question.
- It would also let a `DEV-LIVE` boot stand in for a candidate run, which the record class
  itself forbids (`candidateClaimEligibility` is false by construction). A refusal that
  spends **zero** host starts is the correct fail-closed state until the read-driver
  contract exists.

## 2026-11-13 — 并发上限 2 → 6（所有者裁决，按本机测量）

所有者批准解除旧的"每机最多 2 个并发 dev Host"总限制。本机实测：**30 GiB 内存（可用约 25 GiB）、16 vCPU**，
单个 dev Host（Host + confined 子进程）峰值远低于 1 GiB。取 **6** 并发：内存留约 5 倍余量，核心留给 agent 自身进程；
**每个 subagent 同时最多 2 个 boot** 的独立约束不变。

`DEV_LIVE_SLOT_LIMIT` 是唯一常量。两条并发法则测试已改为**由常量驱动**（先占满 `DEV_LIVE_SLOT_LIMIT` 个槽，再断言
第 N+1 个被 `DEV_LIVE_LIMIT_REACHED` 拒绝，然后释放一个并断言重试被接纳），并把数字本身钉在一处——改数字必须是一次
有意的编辑，而不是顺手调参。
