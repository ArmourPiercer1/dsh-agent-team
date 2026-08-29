# P2-T5 Seam Report — Storage / Fork-Lineage / Descendant Seams

Task: **P2-T5 — Storage/fork/descendant seams** (TaskDoc §11.3). CORE PATCH BUDGET = 0 — every
claim below is proven through the public surface of the pinned pristine upstream
(`references/deepseek-harness-test-use` @ `cd5ef8148158c3a752a658978873241fdf8e2bbc`);
nothing was patched, and no public-behavior gap was found.

Canonical evidence: full harness run, attempt 3, `run/` in this directory
(`run/run-log.txt`, `run/summary.json`, `run/obs-{seed,verify,isolate}.json`,
`run/p2t5-run-meta.json`, `run/logs/`). Run window 2026-08-29T19:32:32.224Z →
19:33:05.685Z (≈33.5 s), **exit 0, 109 PASS / 0 FAIL**, all seven sections green
(preflight, surface, fixture, static, lifecycle, probes, byte-clean).

Ports 3384 (main) / 3394 (isolate/backup); DSH_HOME `references/.dsh-test-p2t5`.
Environment facts: `hasEnvApiKey=false`, `envBaseUrl=null`; root fixture agent created with
public `agents.create({agentOptions:{provider:'deepseek-official',model:'deepseek-v4-flash'}})`
(`{{model}}` resolves from `agent.options.model`); fork children inherit the route.
All fixture model calls hit an in-process blackhole HTTP endpoint (ephemeral
`127.0.0.1:60494`, SSE comment line, stream never ends) so turns stay *held* and interrupt/
drain semantics are observable without external network access.

Fixture (pinned ids): root `11111111-…0001`, member1 `…0002`, member2 `…0003`,
grand `…0004`, plainFork `…0005`, unknown `ffffffff-ffff-4fff-afff-ffffffffffff`.

---

## Seam 1 — StorageDomain external persistence — **PASS**

**Criterion.** StorageDomain external persistence must be provable through the public seam:
domain rows and the domain global can be seeded, read back byte-equal in-instance, survive a
full process restart (same home), and are scoped per home (fresh home ⇒ empty table, initial
global). No TeamDomain/TeamSession code is involved.

**Mechanism.** Public `storageDomain` service (package `@deepseek-ai/dsh-storage-domain`,
admitted by the live public surface; import-level enforcement proven by the static negative
section). Descriptor `{name:'p2t5_probe', version:1, tables:['records'], hasGlobal:true}`;
spec opened/created once (a second open of the live spec throws `already-open`). Three records
plus one global are written, read back in-instance, and — after the instance is stopped and a
fresh process boots on the same home — reopened and read back again. A third boot on a fresh
scratch home proves the persistence is home-scoped.

**Evidence (canonical run).**

| check | observed |
| --- | --- |
| S1.1 seed — in-instance readback of all 3 records byte-equal | `r1 {v:'alpha',n:1}`, `r2 {v:'beta',n:2}`, `r3 {v:'gamma',n:3}` (obs-seed `data.domain.readback.records`) |
| S1.1 seed — global readback byte-equal | `{note:'seeded-p2t5',count:3}` |
| S1.2 seed — second open of a live spec fails loud | code `already-open` — “domain 'p2t5_probe' is already open” |
| S1.3 verify — after restart all 3 records reopen byte-equal | obs-verify `data.domain.records` identical to seeded values |
| S1.3 verify — global reopens byte-equal; `entryCount` = 3 | `{note:'seeded-p2t5',count:3}`, entryCount 3 |
| S1.4 isolate — fresh home: table empty, global serves `initial` | `entries:[]`, `keys:[]`, global `{note:'initial',count:0}` |

**Negative controls.** (a) `bad-global` fixture: a global schema accepting `null` is rejected by
the domain layer — “null is the medium's 'never written' sentinel, so a stored null could not
round-trip”. (b) Double-open of the live spec (`already-open`). (c) Fresh-home isolation (S1.4):
the same domain name/version on a different home has no rows.

**Verdict.** **PASS** — blocker id: none.

---

## Seam 2 — Fork lineage visibility — **PASS**

**Criterion.** Fork lineage must be visible: a subagent fork of a session produces a durable
descendant *entry* whose header carries the lineage facts (parent session, origin,
delegation depth); a plain (non-subagent) session fork produces **no** entry; the lineage
survives a process restart and is reconstructible from the durable backend, including a full
lineage trace.

**Mechanism.** `subagents.startContinuable({provider:'fork', label, childId, request, signal})`
with pinned child ids creates child sessions whose headers carry
`{parentSession, origin:'subagent', delegationDepth}`; `subagents.listDescendants(root)` walks
the tree recursively (a depth-2 grandchild is reachable through member1). `sessions.fork`
(plain) creates a session with `parentSession` set but `origin:null`. After restart, the
`sessionQuery` public API (`listSessions` corpus, `readSession` with replay-validated logs,
`trace`) reconstructs the lineage from the persistent backend.

**Evidence (canonical run).**

| check | observed |
| --- | --- |
| S2.1 — member1/member2 headers | `parentSession` = root, `origin:'subagent'`, `delegationDepth:1` |
| S2.1 — grand header | `parentSession` = member1, `origin:'subagent'`, `delegationDepth:2` |
| S2.1 — root header | `parentSession:null`, `origin:null`, `delegationDepth:null` (plain agent session) |
| S2.2 — live listing | exactly `{member1, grand, member2}`, all `kind:'child'`, `mode:'continuable'`, `activity:'running'` (held mid-turn), `member1.hasChildren=true`, parentId/depth/label correct |
| S2.3 — plain fork adds NO entry | plainFork `…0005` header `{parentSession:root, origin:null, delegationDepth:null, seedLength:3}`; `listDescendants` entryCount stays 3 (ids = the 3 subagent entries); plainFork is still persisted in the corpus as a *session* |
| S2.4 verify — after restart | durable listing identical to the live snapshot (incl. `hasChildren` surviving via log fold); all entries `activity:'inactive'` (no live agents) |
| S2.5 verify — corpus | root/member1/member2/grand `present+persisted+not-live`; plainFork `present+persisted` |
| S2.6 verify — replay-validated log headers | member1 and grand log headers keep `parentSession`/`origin`/`delegationDepth` after restart |
| S2.7 verify — `trace(root)` | `complete:true`, `rootId` = root, `ancestorIds:[]`, descendants = member1 → [grand] + member2 + plainFork (`origin:null`); `traceError:null`; all nodes present |
| S2.N verify — unknown id | absent from corpus; `readSession` throws `SESSION_QUERY_SESSION_NOT_FOUND` |
| S2.O verify — recorded fact | live store empty for every fixture id after restart (process-scoped live store; durable reads go through `sessionQuery`) |
| S2.ISO isolate — cross-home isolation | scratch-home corpus/entries contain no fixture ids |

**Negative controls.** (a) Plain-fork phantom-row check (S2.3). (b) Unknown-session id on
corpus + `readSession` + fresh home (S2.N). (c) Cross-home leak check (S2.ISO).

**Mechanism note.** `trace(root)` walks *session* lineage (header `parentSession` links), so it
includes the plain fork (`origin:null`); `listDescendants` enumerates *subagent entries* only.
Both views are public and consistent — the entry layer is the subagent projection of the session
lineage.

**Verdict.** **PASS** — blocker id: none.

---

## Seam 3 — Generic descendant enumeration / interrupt / drain — **PASS**

**Criterion.** The generic descendant machinery must work: recursive enumeration of
descendants, targeted interrupt with authority semantics (user authority = the durable direct
parent; ancestor authority cannot target self), and a drain that stops every continuable
descendant — all observable durably.

**Mechanism.** `subagents.interrupt(id, {kind:'user', parentSessionId})` /
`{kind:'ancestor', agent}`; `subagents.drainContinuableDescendants([rootAgent])`.
Observation of the interrupted grandchild's turn end is done through the synchronous
`session/event` store observer (fires inside the commit, before detach) — the child session
detaches from the *live* store as soon as its interrupted turn settles (activation settled →
AgentHandle disposed → session removed from the live store; cold-resume on next send), so
live-store polling is racy **by design** (finding F2, compliance report). Durable
verification of every turn end is done in the verify phase through
`sessionQuery.readSession` (replay-validated logs).

**Evidence (canonical run).**

| check | observed |
| --- | --- |
| S3.1 — interrupt(user, direct parent) on the held grandchild turn | `turn/end` captured at `seq 7` with `reason {kind:'aborted', reason:'user'}` (obs-seed `data.interrupt.grandEnd`); entry `grandActivityAfter:'inactive'`; **durable** (verify): grand log `turnEnds = [{seq:7, reason:{kind:'aborted', reason:{kind:'user'}}}]` |
| S3.2 — WRONG parent session, live target | `UNAUTHORIZED` — “subagent '11111111-…0004' belongs to another parent session” (attempted *before* the successful interrupt, while the turn was live) |
| S3.3 — unknown target (recorded finding F1) | accepted silent no-op (`threw:false`) — authority checks fire for live targets only; task guidance expected a loud failure — discrepancy recorded, mechanism not affected (authority enforcement proven by S3.2/S3.4) |
| S3.4 — self-targeting ancestor authority | `UNAUTHORIZED` — “agent '11111111-…0001' cannot interrupt itself” |
| S3.5 — duplicate child id | `DUPLICATE_CHILD` — “subagent '11111111-…0002' already exists” |
| S3.6 — members held mid-turn before drain | no `turn/end` for member1/member2 before the drain (durable member logs end with `kind:'aborted'` only *after* the drain) |
| S3.7 — drain | `drainContinuableDescendants([rootAgent])` resolved, `error:null`, **103 ms**; afterwards member1/member2/grand all `agentAlive:false, sessionLive:false`; root handle disposed via the public handle (`disposed:true`, agent/session gone) |
| S3.8 verify — durable turn ends | grand log ends `aborted/user` (user interrupt); member1/member2 logs end `kind:'aborted'` (drain interrupts) |
| S3.9 — persistence gate | all four fixture sessions `persisted:true` before the instance stop (250 ms poll, 30 s budget — passed early; seed phase completed in 1.8 s); plainFork `persisted:true` |

**Negative controls.** Wrong-parent authority on a live target (S3.2); unknown target (S3.3,
recorded as finding F1); self-ancestor (S3.4); duplicate child id (S3.5).

**Verdict.** **PASS** — blocker id: none. (S3.3 is a recorded behavioral finding, not a seam
gap: the authority mechanism itself is proven by S3.2 and S3.4 against live targets.)

---

## Infrastructure attestations (from the canonical run)

- Upstream tree byte-clean at start **and** end: `git status --porcelain` empty, `git diff`
  empty, HEAD `cd5ef814…` unchanged (preflight + byte-clean sections; `run/logs/git-state-after.json`).
- Ports 3384/3394 free before the first boot and after every teardown (checked per boot).
- Runtime-surface changes (settings `baseURL` override, credentials entry, cordis patch rows,
  directives, blackhole endpoint, scratch home) all restored/deleted with post-restore
  self-checks — see `compliance-report.md` §4.
