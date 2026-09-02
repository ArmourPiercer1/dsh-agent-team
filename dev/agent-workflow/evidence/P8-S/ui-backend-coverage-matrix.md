# P8-S7 UI → Backend Coverage Matrix (read-only mapping)

## 0. Header
- Base 15da6b5 (worktree .worktrees/P8S7-M, READ-ONLY); 2026-07-11; S7-MAP read-only: no code/test/config edits, no commits
- Plan §26 (216 fixed rows verbatim) + §21-25: docs/plans/active/DSH_Agent_Team_vNext_P8-S_Backend_Closure_Plan_20260831.md (master only; absent from tip)
- S5A: task-cited S5A-result.md absent → S5A-node-brief.md + S5A-review.md used.
- S6 re-verified TRUE: 4 seams root:812/819/850/851; 12 facade-only ports (handlers/ports.ts); 4 durable repo calls (C2.3b); closed 23-method catalog (cat:61-83).
- Row: ID|behavior (verbatim)|surfaces (verbatim)|class|impl @15da6b5 (file::line / NATIVE DSH / CLIENT-LOCAL / absence)|STATUS|test (file::name, read-verified).
- Classes: bq=§21 projection, bc=§22 command, bs=§23 sync, nd=§24 native DSH, cl=§25 client-local, neg=negative.
- Aliases (worktree-relative): s6rem/proj/live/prim/root/host/legsurf=runtime/plugin/; bind/diag/recb=storage/bindings/; ctrl/act/ovadm/hand=runtime/; fork=storage/fork-reconciliation/; cat/par=remote/src/contracts/; st/tpl/mem=contracts/src/; push=remote/src/push/.
- Test aliases (full test names): t1 p8t3-rt::intent.probe · t2 p8t3-rt::catalog.list · t3 p8t3-rt::compatibility.get · t4 p8t3-rt::sequence in provenance · t5 p8t3-rt::read effects · t6 p8t3-ver::unknown endpoint · t7 p8s6-proj::C2.1e · t8 p8s6-proj::C2.1d · t9 p8s6-proj::C2.1f · t10 p8s6-proj::C2.2a · t11 p8s6-proj::C2.2b · t12 p8s6-proj::C2.2c · t13 p8s6-rc::C4.1 · t14 p8s6-rc::C4.2 · t15 p8s6-rc::C4.3 · t17 p8s6-rc::C4.4 · t18 p8s6-prim::C3.8 · t24 p8s6-push::C5.4 · t25 p8s6-page::C6.2 · t29 p8s5b::follow-up ALWAYS executes · t30 p8s5b::exactly ONE work fact · t32 p5t5-fresh-root::TeamSession then team-root binding · t36 p7t1-ack::ack bound to CURRENT pair · t37 p7t1-ack::DEGRADED gen+1 · t38 p7t1-ack::blocks NEW work · t40 p7t1-drift::settles pre-drift work

## 1. Surface catalog (gap-relevant; others per impl cell)
BQ-08 effective config value/state/provenance | contract effective-config.ts + resolver domain/policy/resolve.ts:109 (tested); proj EMITS EMPTY (proj:494/509/530); remote RAW override.get only (s6rem:859-883)
BQ-09 template future defaults | raw team-scope autonomy-overlay via override.get (s6rem:859-883); no BQ-09 surface
BQ-10 PolicyState current | s6rem:975 EPHEMERAL (root:741-743); proj const 'default' (root:803); no durable repo
BQ-11 pending model view | NONE (no model field, mem:93+)
BQ-16 Team events page | getLedgerPage s6rem:769; 8 LEDGER_CATEGORIES st:224-240 (no handoff/fork); pagination push/ledger-page.ts
BQ-17 handoff snapshot read | service state (hand:103); NO remote/projection surface
BQ-18 fork reconciliation read | wired root:679-683, exported :1005; NO projection/remote surface
BQ-21 generation+provenance (G8) | g8s1 stamp; provenance s6rem:1463-1505; pull cross-check push/pull.ts:90
BC-09 steer | NO independent v1 method (cat:61-83) → mapped to BC-08
BC-21 startTeamFromHere | hand:103; prod ports FAIL-CLOSED root:686-712; remote prepare/create throw in prod
BC-22/23/24 handoff retry/continue/cancel | hand:126; ABSENT from closed catalog
BS-01 push frame verdicts | push/generation.ts decideFrameVerdict; NO production transport (fixtures only)
BS-02 push transport | RemotePushTransport fixtures only (p8t4-*); NONE in prod
BS-03 reconnect+pull | push/reconnect.ts; PULL=team.getProjection
ND-02 preset / ND-03 model directory | NO Team adapter anywhere in tree
ND-01 workspace / ND-04 chat / ND-05 trajectory / ND-06 nav / ND-07 fork / ND-08 root model control | NATIVE DSH (UI §45)
CL-03/05/07 | CLIENT-LOCAL (client pkg = P9 deliverable; skeleton NOT mounted, run.mjs:445-462)

## 2. Matrix (plan §26 order)

### A
UI-A01|external Team client 能加载|ND public client module seam + BQ-21|nd+bq|client.ts:32-41 skeleton NOT mounted (run.mjs:445-462)|COVERED|client::plugin shape; t4
UI-A02|ordinary Session 识别为 ordinary|BQ-01|bq|bind:66-74 unbound branch|COVERED|p4t3-bind::resolves an unbound
UI-A03|Team Root 识别|BQ-01|bq|bind:66-74 team-root|COVERED|p4t3-bind::resolves the team root
UI-A04|Member child Session 识别 + perspective|BQ-01 + BQ-04|bq|bind:74; proj member rows|COVERED|p4t3-bind::resolves the member child; t7
UI-A05|legacy Session 识别|BQ-01 + BQ-19|bq|legsurf:165; s6rem:1083-1099; host:450|COVERED|p7t7-leg::legacy-team view; p8t3-rt::legacy.inspect
UI-A06|integrity error 不伪装 ordinary|BQ-01 + BQ-20|bq|diag:30-83; recb:123 fail-closed|COVERED|p4t3-rec::read-only + orphan
UI-A07|projection generation|BQ-21 + BS-01/03|bq+bs|gen stamp (g8s1) + push engine ✓; ABSENT prod transport + mount|PARTIAL|p8s6-push::C5.1; t24
### B
UI-B01|New Team 打开 creation flow|CL-05|cl|CLIENT-LOCAL (UI §25)|CLIENT_LOCAL|NONE
UI-B02|Blueprint picker|BQ-02|bq|s6rem:672-690|COVERED|t2
UI-B03|Blueprint revision/source detail|BQ-02|bq|s6rem:691-693 catalog.get|COVERED|t2 (shared handler)
UI-B04|Workspace picker|ND-01|nd|NATIVE DSH (ND-01)|NATIVE_PROVEN|NONE
UI-B05|Runtime preset picker/detail|ND-02 或 safe Remote adapter|nd|ABSENT: no preset method (cat:61-83); no ND-02 adapter|PARTIAL|NONE
UI-B06|`complete:true` FATAL 判定|BC-01/BQ-03 authoritative result|bc+bq|intent.probe → evaluateCompatibility|COVERED|t5-ct::an ack cannot downgrade
UI-B07|Initial work optional field|CL draft -> BC-03|cl+bc|ABSENT: team.create closed fields (par:344) lack initialWork|PARTIAL|NONE
UI-B08|preflight compatibility PASS|BC-01 + BQ-03|bc+bq|intent.probe: blueprint + environmentFacts|COVERED|t1
UI-B09|WARNING mismatch detail|BQ-03|bq|probe verdict mismatches|COVERED|t1
UI-B10|WARNING explicit ACK|BC-02|bc|ack fingerprint-bound (authority:375-385); probe re-verifies; FATAL blocks create|COVERED|t36
UI-B11|FATAL Create disabled|BQ-03 authoritative|bq|FATAL structural, non-downgradable|COVERED|t5-ct::complete:true ordinary requirement
UI-B12|reselect config -> preflight again|BC-01|bc|probe stateless read-only|COVERED|t1
UI-B13|Create Team|BC-03|bc|s6rem:713-760 fresh+cold; guard :732|COVERED|t32
UI-B14|TeamIntent before create not Sidebar Session|backend must not materialize root before BC-03|neg|probe zero durable writes (read effect)|COVERED|t5
UI-B15|created Root opens native Session|BC-03 result + ND-06|bc+nd|result rootSessionId + native nav|COVERED|t32
UI-B16|cancel panel has zero backend Team creation|CL-05 + negative BC evidence|cl+neg|nothing materialized pre-create|COVERED|t5
### C
UI-C01|Blueprint identity/revision|BQ-04|bq|blueprint snapshot ref|COVERED|p8s6-proj::C2.1b
UI-C02|Leader perspective|BQ-01/BQ-04|bq|leader row proj:485-513|COVERED|t10
UI-C03|Member perspective|BQ-01/BQ-04|bq|member rows + binding|COVERED|t7
UI-C04|lifecycle counts|BQ-04/BQ-22|bq|lifecycle verbatim per row; counts = client aggregation|COVERED|t7
UI-C05|pending control count|BQ-14/BQ-22|bq|proj:557+ pendingControlCount|COVERED|t9
UI-C06|Compatibility badge|BQ-05|bq|s6rem:1015-1027; proj:347|COVERED|t3
UI-C07|PolicyState current|BQ-10|bq|s6rem:975 EPHEMERAL; root const (root:803); ABSENT durable repo|PARTIAL|t15
UI-C08|AgentPreset readonly identity|BQ-04 + ND-02|bq+nd|blueprint identity ✓; ABSENT ND-02|PARTIAL|p8s6-proj::C2.1b
UI-C09|Blueprint detail view|BQ-02/BQ-04|bq|catalog.get + bound snapshot ref|COVERED|t2
UI-C10|no Blueprint replacement action|backend exposes no rebind command|neg|no rebind in catalog; guard-only :732|COVERED|t6
### D
UI-D01|Leader shown separately|BQ-04|bq|leader row separate|COVERED|t7
UI-D02|Template list|BQ-04/BQ-06|bq|template rows|COVERED|t8
UI-D03|Template description|BQ-06|bq|description? (tpl:66)|COVERED|t8
UI-D04|Template active/total count|BQ-04|bq|member rows (active) + instanceQuota? (tpl:70)|COVERED|t7
UI-D05|Template quota summary|BQ-06/BQ-04|bq|instanceQuota? + creationBudgetConsumed (root.ts:69)|COVERED|t9
UI-D06|0..N instances|BQ-04|bq|member rows 0..N|COVERED|t7
UI-D07|duplicate labels legal|backend identity uses instanceId|neg|instanceId-first; label not a target|COVERED|p6t2-addr::a member label as target
UI-D08|instance lifecycle|BQ-07|bq|lifecycle verbatim (proj:507)|COVERED|t7
UI-D09|instance model summary|BQ-07/BQ-11|bq|ABSENT model field (mem:93+); effectiveConfig EMPTY (proj:530)|PARTIAL|NONE
UI-D10|groupId tag|BQ-07|bq|groupId? (proj:510)|COVERED|t7
UI-D11|current perspective highlight|BQ-01/BQ-04|bq|binding kind + rows|COVERED|p4t3-bind::resolves the member child
UI-D12|instanceId diagnostics/copy|BQ-07|bq|row instanceId|COVERED|t7
UI-D13|archived collapsed group|BQ-04 + CL|bq+cl|ARCHIVED rows present (only DISPOSED excluded, live:86)|COVERED|t12
UI-D14|disposed historical discoverability|BQ-04/BQ-12/BQ-16|bq|BQ-04 excludes DISPOSED; ABSENT DISPOSED row discoverability|PARTIAL|p7t3-disp::X3
### E
UI-E01|Create Member template fixed|BQ-06|bq|templates from bound blueprint|COVERED|t8
UI-E02|label|BC-06|bc|payload label (par:350)|COVERED|t17
UI-E03|group optional|BC-06|bc|payload groupId? → row|COVERED|t17
UI-E04|workspace|ND-01 + BC-06|nd+bc|payload workspace; inherited into rows|COVERED|t7
UI-E05|initial work optional|BC-06 + real work execution|bc|initialWork; delivery to child|COVERED|t29
UI-E06|fresh_per_delegation wording|BQ-06 contextPolicy|bq|contextPolicy (tpl:68)|COVERED|t8
UI-E07|explicit create|BC-06|bc|s6rem:781|COVERED|t17
UI-E08|Leader delegate existing instance|BC-07|bc|delegationInstanceId (par:357)|COVERED|p6t1-deleg::activates a new member
UI-E09|Leader delegate by template|BC-07|bc|delegationTemplateId (par:358)|COVERED|p6t1-deleg::activates a new member
UI-E10|same template -> multiple instances|BC-06/07 + BQ-04|bc+bq|N rows per template; parallel boundary|COVERED|p6t1-par::one of four parallel
UI-E11|quota rejection typed|BC-06/07 typed error|bc|QUOTA_EXCEEDED_TEAM/TEMPLATE_INSTANCES|COVERED|p6t2-quota::one over the limit
### F — BQ-08 cluster (PARTIAL, R2; see catalog)
UI-F01|value|BQ-08|bq|F-cluster: raw value only|PARTIAL|t14
UI-F02|source/provenance|BQ-08|bq|F-cluster: raw kind/scope/generation|PARTIAL|t14
UI-F03|inherited state|BQ-08|bq|F-cluster: 'inherited' contract-only, prod EMPTY|PARTIAL|p7t2-ovr::step 3 (beta DENY)
UI-F04|overridden state|BQ-08|bq|F-cluster: layer precedence at resolver|PARTIAL|p7t2-ovr::step 1 instanceOverlay
UI-F05|suppressed overlay visible|BQ-08|bq|F-cluster: suppression read-time only|PARTIAL|p7t2-ps::atStep 1 locked
UI-F06|unavailable distinct|BQ-08|bq|F-cluster: 'unavailable' never emitted|PARTIAL|NONE
UI-F07|denied distinct + reason|BQ-08|bq|F-cluster: 'denied'+deniedBy contract-only|PARTIAL|NONE
UI-F08|locked distinct|BQ-08|bq|F-cluster: 'locked' state|PARTIAL|p7t2-ps::atStep 1 (locked)
UI-F09|pending next boundary|BQ-08/BQ-11|bq|F-cluster; boundary re-read proven (p5t3), no view|PARTIAL|p5t3-fb::request N stays A
UI-F10|degraded distinct|BQ-05/BQ-08|bq|BQ-05 degraded ✓ (ack flow); 'degraded' absent on BQ-08|PARTIAL|t37
UI-F11|workspace source/locked-after-run|BQ-07/BQ-08|bq|workspace ✓; ABSENT source provenance + remote resolver (ws.ts:60)|PARTIAL|t7
UI-F12|residency diagnostic|BQ-07/BQ-16|bq|resident/cold (live:99/103); 'resuming' NOT derivable (live:25-26)|PARTIAL|t11
### G
UI-G01|view explicit human override|BQ-08|bq|F-cluster: RAW human-override record; resolved view absent|PARTIAL|t14
UI-G02|distinguish autonomy overlay|BQ-08|bq|raw kind autonomy-overlay vs human-override (s6rem:952)|PARTIAL|t14
UI-G03|set Team/instance human override|BC-13|bc|override.set operator→human-override (s6rem:885; ovadm:22)|COVERED|t13
UI-G04|reset override|BC-13|bc|override.reset deletes slot winner|COVERED|t14
UI-G05|hard-policy block reflected|BC-13 result + BQ-08|bc+bq|hard policy (root:734) + resolver hardDeny ✓; BQ-08 view absent|PARTIAL|p7t2-ovr::step 4 (invariant 34)
UI-G06|template future defaults read|BQ-09|bq|raw override record only; no BQ-09 surface|PARTIAL|t14
UI-G07|set template future defaults|BC-14|bc|override.set leader→team-scope autonomy-overlay|COVERED|t13
UI-G08|existing instances unchanged|BC-14 semantics + test|bc|one record per slot; instance beats team at read|COVERED|p7t2-ovr::step 3 (alpha INSTANCE)
UI-G09|suppressed stored overlay still visible|BQ-08|bq|stored record readable (suppression read-time)|PARTIAL|p7t2-ps::atStep 1 (locked)
### H
UI-H01|current PolicyState|BQ-10|bq|s6rem:975 EPHEMERAL; no durable repo|PARTIAL|t15
UI-H02|allowed transitions|BQ-10|bq|transitions not in policyState.get response|PARTIAL|p8s6-rc::C4.3b
UI-H03|switch PolicyState|BC-15|bc|policyState.set via mutation service; ABSENT durability (root:741-743)|PARTIAL|t15
UI-H04|explicit overrides remain visible/effective|BQ-08|bq|F-cluster: non-destructive ✓; visibility raw-record-only|PARTIAL|p7t2-ovr::step 2 humanOverride
UI-H05|PolicyState not workflow progress|backend uses governance state only|neg|switch explicit only; no progress→state automation|COVERED|t15
UI-H06|Member current model|BQ-11|bq|ABSENT model field (mem:93+)|PARTIAL|NONE
UI-H07|Member authorized model mutation|BC-16/BC-13|bc|override.set capability=model (par:50-56)|COVERED|t13
UI-H08|current request stays model A|backend mutation semantics|bc|frozen selection per request; boundary re-read (ovadm:4)|COVERED|p5t3-fb::request N = model A
UI-H09|next request model B|BQ-11 + actual execution test|bq+bc|execution ✓ (p5t3); BQ-11 pending view absent|PARTIAL|p5t3-fb::request N+1 uses B
UI-H10|model availability|ND-03 + Team constraint BQ-08|nd+bq|ND-03 adapter absent; BQ-08 EMPTY in proj|PARTIAL|NONE
UI-H11|Root ordinary model control|ND-08|nd|NATIVE DSH root model control|NATIVE_PROVEN|NONE
UI-H12|Team provenance on Root model|BQ-08/BQ-11|bq|model-lane provenance only in mutation service|PARTIAL|p7t2-prov::templateOverlay
### I
UI-I01|CREATED send work|BC-08|bc|member.send → work delivery|COVERED|t29
UI-I02|RUNNING follow-up/steer|BC-09 or documented BC-08|bc BC-09→BC-08|no steer in v1 catalog; follow-up = member.send|COVERED|p8s5b::one follow-up branch
UI-I03|SETTLED Resume… means new work|BC-08|bc|send = new work; no resume semantics|COVERED|t29
UI-I04|cold SETTLED automatically resumes Agent|backend Member residency|bq|residency overlay (live:99/103); scope restore 0-write|COVERED|p5t6-cold::scope restore
UI-I05|work actually reaches child Session|backend production E2E|bc|production-root path (p8s5b createTeamProductionRoot)|COVERED|t29
UI-I06|work -> RUNNING|BQ-07 after BC|bq|lifecycle after work acceptance|COVERED|t30
UI-I07|completion -> SETTLED|backend settlement + BQ-07|bq|settlement service; in-flight never cancelled|COVERED|t40
UI-I08|Archive CREATED|BC-10|bc|FSM rejects CREATED→ARCHIVED ILLEGAL_STATE (lifecycle;A6)|PARTIAL|p7t3-arch::A6
UI-I09|Archive RUNNING quiesces|BC-10|bc|settle-then-archive (lifecycle:86)|COVERED|p7t3-arch::A1
UI-I10|Archive SETTLED|BC-10|bc|direct edge|COVERED|p7t3-arch::A2
UI-I11|Restore ARCHIVED -> SETTLED|BC-11|bc|G7 zero live contact|COVERED|p7t3-restore::R1
UI-I12|Restore creates/resumes no Agent|BC-11 negative test|bc neg|G7: resume/create never touched|COVERED|p7t3-restore::R2
UI-I13|Dispose active/settled/archived|BC-12|bc|dispose terminal; single commit winner|COVERED|p7t3-disp::X1
UI-I14|DISPOSED terminal|BQ-07 + typed BC rejection|bq+bc|X2b ILLEGAL_STATE; DISPOSED excluded from proj|COVERED|p7t3-disp::X2b; t12
UI-I15|history retained after dispose|BQ-12/BQ-16 + ND-04/05|bq+nd|X3 history preserved; stable pages; native history|COVERED|p7t3-disp::X3; t25
UI-I16|residency != lifecycle|BQ-07/BQ-16|bq|resident iff own child live|COVERED|t11
### J
UI-J01|Compatible|BQ-05|bq|verdict OPEN (s6rem:1015-1027)|COVERED|t3
UI-J02|Degraded acknowledged|BQ-05|bq|DEGRADED_ACKNOWLEDGED gen+1 same fingerprint|COVERED|t37
UI-J03|Action required warning|BQ-05|bq|warning counts + unacked blocking facts|COVERED|t38
UI-J04|Structural FATAL|BQ-05|bq|BLOCKED_FATAL (compatibility/probe.ts:187)|COVERED|p7t1-drift::classifies the drift
UI-J05|blocked reason|BQ-05|bq|blocking facts on verdict|COVERED|t38
UI-J06|Review compatibility|BQ-05|bq|compatibility.get full state|COVERED|t3
UI-J07|Recheck|BC-04|bc|compatibility.reprobe gen+1 (s6rem:1042+)|COVERED|p8s6-push::C5.2
UI-J08|ACK current warning|BC-05|bc|compatibility.ack (s6rem:1028-1041); fingerprint-bound|COVERED|t36
UI-J09|stale ACK invalidated|backend compatibility|bq|freshness gate (authority:375-385)|COVERED|p7t1-ack::reopens admission
UI-J10|existing admitted work can settle|backend compatibility|bq|in-flight never cancelled by drift|COVERED|t40
UI-J11|new prompt/create/resume disabled|authoritative admission errors|neg|admission gate all new-work paths (router:122-130)|COVERED|p5t5-adm::does NOT admit
UI-J12|same ACK semantics on all new-work paths|backend tests|neg|single admission path (router performAction)|COVERED|p5t5-adm::standing root OPEN
### K
UI-K01|running activity|BQ-12/BQ-13|bq|open interval (act:398) + fact|COVERED|p6t5-int::multiple simultaneous running
UI-K02|completed activity|BQ-13|bq|closed progress fact 'completed' (actions:116)|COVERED|p6t5-prog::records the first progress
UI-K03|blocked progress|BQ-13|bq|PROGRESS_VALUES 'blocked'|COVERED|p6t5-prog::updates the status (blocked)
UI-K04|actor instance|BQ-13|bq|fact subject/actor (reporter rule)|COVERED|p6t5-prog::allows the leader to report
UI-K05|correlation|BQ-13|bq|correlation per-subject|COVERED|p6t5-int::same correlation
UI-K06|no workflow-state authority|backend has no progress->PolicyState automation|neg|progress ≠ governance state|COVERED|t15
### L
UI-L01|send Team message if exposed|BC-17|bc|member.send|COVERED|p6t3::1. leader → member: DIRECT
UI-L02|message appears as Team coordination|BQ-16|bq|message-category ledger facts|COVERED|p6t3::1. leader → member: DIRECT
UI-L03|actual relay received by Agent appears natively|ND-04/05|nd|NATIVE DSH; relay attributed (proven p6t3)|NATIVE_PROVEN|p6t3::1. leader → member: DIRECT
UI-L04|pending control count|BQ-14|bq|proj:557+|COVERED|t9
UI-L05|control request detail|BQ-15|bq|listControlState (ctrl:970)|COVERED|p6t4-deny::durable row carries
UI-L06|request approval/control|BC-18|bc|requestControl durable before effect (ctrl:456)|COVERED|p6t4-allow::durable one request
UI-L07|resolve allowed|BC-19|bc|resolveControl durable decision|COVERED|p6t4-allow::allow executes once
UI-L08|resolve denied|BC-19|bc|deny verdict, scope blocked|COVERED|p6t4-deny::a deny blocks the scope
UI-L09|user-approval only human principal|backend principal boundary|bc|valid human only (prim:117-142)|COVERED|p8s6-prim::C3.9
UI-L10|decision != tool execution|BQ-15/BQ-16 + ND-05|bq+nd|guard consults state; executes on consumed allow|COVERED|p6t6-guard::consumed exactly once
UI-L11|Team allow but managed policy blocks execution|BQ-08/BQ-15 + native execution result|bq+nd|external-policy deny ✓; ABSENT BQ-08 view|PARTIAL|p6t4-ext::a hard-deny tools cell
UI-L12|exactly-once allow consumption|backend control tests|bq|guardOperation consumes allow once (ctrl:995)|COVERED|p6t4-allow::second attempt blocked
### M — BQ-16 cluster (see catalog)
UI-M01|creation/binding event|BQ-16|bq|M-cluster: team|COVERED|t25
UI-M02|member creation|BQ-16|bq|M-cluster: member|COVERED|t25
UI-M03|work admitted/settled|BQ-16|bq|M-cluster: work facts|COVERED|t30
UI-M04|lifecycle change|BQ-16|bq|M-cluster: lifecycle|COVERED|t25
UI-M05|message|BQ-16|bq|M-cluster: message|COVERED|p6t3::1. leader → member: DIRECT
UI-M06|control request/decision|BQ-16|bq|M-cluster: control|COVERED|p6t4-deny::a deny blocks the scope
UI-M07|PolicyState transition|BQ-16|bq|M-cluster: policy row|COVERED|t15
UI-M08|override mutation|BQ-16|bq|M-cluster: policy override row|COVERED|t13
UI-M09|compatibility warning/ACK|BQ-16|bq|M-cluster: compatibility + ack provenance|COVERED|p7t1-ack::ack provenance
UI-M10|model mutation/effective boundary|BQ-16|bq|M-cluster: model lane + boundary re-read|COVERED|p5t3-fb::request N+1 uses B
UI-M11|handoff/fork provenance|BQ-16|bq|ABSENT: no handoff/fork category; prod handoff fail-closed → no facts|PARTIAL|NONE
UI-M12|progress facts|BQ-16|bq|M-cluster: progress|COVERED|p6t5-prog::first progress
UI-M13|ledger sequence|BQ-16|bq|M-cluster: durable sequence in provenance|COVERED|t4
UI-M14|actor/related instance/template|BQ-16|bq|M-cluster: entry actor/subject fields|COVERED|t25
UI-M15|correlation|BQ-16|bq|M-cluster: entry correlation field|COVERED|p6t5-int::same correlation
UI-M16|safe detail/provenance|BQ-16|bq|M-cluster: lossless; typed no leak|COVERED|p8t3-adm::no details key
UI-M17|filter by category|BQ-16 server filter OR CL over loaded pages, explicitly documented|bq+cl|no server filter (par:350-354) → CL over loaded pages (DOCUMENTED)|CLIENT_LOCAL|NONE
UI-M18|filter instance/template|same|bq+cl|same → CL over loaded pages (DOCUMENTED)|CLIENT_LOCAL|NONE
UI-M19|load earlier|BQ-16 pagination|bq|M-cluster: anchor load-earlier|COVERED|p8s6-page::C6.4
UI-M20|stable historical window while new events arrive|BQ-16 + BS-02|bq+bs|stable window via cursor re-read (C6.3); BS-02 gap → A07/S06/S07|COVERED|p8s6-page::C6.3
### N — BQ-12 cluster (act:561)
UI-N01|Template -> Instance lane|BQ-12|bq|N-cluster: per template/instance|COVERED|p6t5-int::simultaneous running
UI-N02|multiple intervals same instance|BQ-12|bq|N-cluster|COVERED|p6t5-int::simultaneous running
UI-N03|start/end/duration|BQ-12|bq|open/closeInterval; one open bar per triple|COVERED|p6t5-int::rejects open-while-open
UI-N04|running interval open-ended|BQ-12|bq|open interval nullable end|COVERED|p6t5-int::simultaneous running
UI-N05|historical bars survive archive|BQ-12|bq|durable facts immutable|COVERED|p7t3-arch::A2
UI-N06|historical bars survive dispose|BQ-12|bq|X3|COVERED|p7t3-disp::X3
UI-N07|groupId metadata|BQ-12/BQ-07|bq|row groupId? + interval subject|COVERED|t7
UI-N08|click -> Member Session|BQ-07 + ND-06|bq+nd|row childSessionId → native nav|COVERED|t10
UI-N09|zoom/pan/hover|CL-03|cl|CLIENT-LOCAL (UI §25)|CLIENT_LOCAL|NONE
### O
UI-O01|Root Chat first-person|ND-04|nd|NATIVE DSH root chat|NATIVE_PROVEN|NONE
UI-O02|Member Chat first-person|ND-04|nd|NATIVE DSH member child chat|NATIVE_PROVEN|NONE
UI-O03|Root Trajectory first-person|ND-05|nd|NATIVE DSH trajectory|NATIVE_PROVEN|NONE
UI-O04|Member Trajectory first-person|ND-05|nd|NATIVE DSH trajectory|NATIVE_PROVEN|NONE
UI-O05|TeamDomain-only event not synthetic Chat|negative architecture test|neg|no synthetic chat; vocabulary quarantined (legsurf:104) + scan|COVERED|p4t6-scan::zero legacy payload
UI-O06|TeamDomain-only event not synthetic Trajectory|negative architecture test|neg|same quarantine + declaration-merging scan|COVERED|p4t6-scan::declaration-merging
UI-O07|Open Member Session|BQ-07 + ND-06|bq+nd|row childSessionId + native nav|COVERED|t7
UI-O08|Open Leader|BQ-04 + ND-06|bq+nd|leader child = root session|COVERED|t10
UI-O09|Team tab perspective after navigation|BQ-01/BQ-04|bq|binding kind + rows|COVERED|p4t3-bind::resolves the member child
### P — handoff cluster (R4; see catalog)
UI-P01|ordinary Team zero-state|BQ-01|bq|unbound ordinary (no team artifacts)|COVERED|p4t3-bind::resolves an unbound
UI-P02|Start Team from Here|BC-21|bc|P-cluster: ABSENT production availability (fail-closed + throwing remote)|PARTIAL|NONE
UI-P03|source workspace prefill|ND-01/session metadata|nd|NATIVE DSH source session workspace metadata|NATIVE_PROVEN|NONE
UI-P04|source Session identity|ND session identity|nd|NATIVE DSH session identity surface|NATIVE_PROVEN|NONE
UI-P05|one-shot source snapshot|backend handoff|bc|P-cluster: EXACTLY ONE read + frozen snapshot ✓; port fail-closed|PARTIAL|p7t5-snap::S1
UI-P06|summary preview/status|BQ-17|bq|service holds snapshot; ABSENT remote/projection read|PARTIAL|p7t5-fail::S1 awaiting-decision
UI-P07|Retry without reread|BC-22|bc|retry reuses FROZEN snapshot (service); ABSENT BC-22 in catalog|PARTIAL|p7t5-fail::S1 retry FROZEN
UI-P08|Continue without handoff explicit|BC-23|bc|triad (hand:126); ABSENT BC-23 in catalog|PARTIAL|p7t5-fail::S1 unknown op
UI-P09|Cancel|BC-24|bc|same — ABSENT from catalog|PARTIAL|p7t5-fail::S1
UI-P10|source Session not converted|negative backend test|neg|source never mutated; snapshot detached|COVERED|p7t5-mut::S1
UI-P11|new Root created|BC-03/BC-21 result|bc|BC-03 ✓; BC-21 creation fail-closed in prod|PARTIAL|t32 (BC-03 side only)
UI-P12|provenance visible|BQ-17/BQ-16|bq|ABSENT: handoffSourceSessionId not in proj (proj:295-297); no ledger category|PARTIAL|NONE
UI-P13|target cannot live-read source later|backend negative test|neg|querySourceHistoryFromTarget ALWAYS denied (hand:147)|COVERED|p7t5-tgt::S1
### Q
UI-Q01|native fork Root|ND-07|nd|NATIVE DSH native fork|NATIVE_PROVEN|NONE
UI-Q02|root fork same Blueprint snapshot|backend reconciliation + BQ-18|bq|reconcileForkSidecar wired (root:679-683/:1005); ABSENT BQ-18 read|PARTIAL|p4t3-fork::root fork sidecar
UI-Q03|root fork zero MemberInstances|BQ-04/BQ-18|bq|sidecar consistent + memberless at storage; ABSENT remote read|PARTIAL|p4t3-fork::bidirectionally consistent
UI-Q04|transient recovering state|BQ-18/BQ-20|bq|transient at storage (crash windows); ABSENT remote exposure|PARTIAL|p4t3-fork::committed fork awaiting
UI-Q05|member child native fork|ND-07|nd|NATIVE DSH native fork|NATIVE_PROVEN|NONE
UI-Q06|member fork stays ordinary|BQ-01/BQ-18|bq|member fork → unbound ordinary, 0 writes ✓; BQ-18 read absent|PARTIAL|p4t3-bind::fork of member child
UI-Q07|no auto-new Member/Team|negative backend test|neg|member-fork branch 0 writes; no auto-creation|COVERED|p4t3-fork::no team artifacts = empty
UI-Q08|fork notice dismissal|CL-07|cl|CLIENT-LOCAL (UI §25)|CLIENT_LOCAL|NONE
### R
UI-R01|detect legacy read-only|BQ-01|bq|detection teamEventTotal (legsurf:110)|COVERED|p7t7-leg::legacy-team view
UI-R02|legacy summary if available|BQ-19|bq|legacy.inspect (s6rem:1083-1099)|COVERED|p7t7-leg::roster overlay; p8t3-rt::legacy.inspect
UI-R03|native Chat available|ND-04|nd|NATIVE DSH chat on legacy session|NATIVE_PROVEN|NONE
UI-R04|native Trajectory available|ND-05|nd|NATIVE DSH trajectory|NATIVE_PROVEN|NONE
UI-R05|no Resume Team|no command / typed rejection|neg|no resume-team in closed catalog; FOREIGN_TEAM (s6rem:641-650)|COVERED|t6
UI-R06|no Restore Member|typed rejection|neg|member.* on legacy id → typed FOREIGN_TEAM|COVERED|t18
UI-R07|no Create Member|typed rejection|neg|same boundary|COVERED|t18
UI-R08|no Policy mutation|typed rejection|neg|same boundary|COVERED|t18
UI-R09|no override mutation|typed rejection|neg|same boundary|COVERED|t18
UI-R10|no in-place upgrade|no backend command|neg|no upgrade method in closed catalog|COVERED|t6
### S
UI-S01|TeamDomain unavailable|BQ-20|bq|diag:30-83 + stable bootstrap codes|COVERED|p8s5a::T1.6
UI-S02|native Chat/Trajectory remain usable|ND-04/05|nd|NATIVE DSH surfaces unaffected|NATIVE_PROVEN|NONE
UI-S03|Team mutation fail closed|Remote typed error|bs|toS6RemoteErrorResult typed P7 codes (s6rem:1463)|COVERED|p8t3-adm::compatibility-blocked
UI-S04|binding corruption|BQ-20|bq|reconciler diagnostics|COVERED|p4t3-rec::orphan
UI-S05|no guessed mapping|backend fail-closed|neg|principal fails closed (prim:C3.4) + non-lossless → internal-error|COVERED|p8s6-prim::C3.4; p8t3-ver::NaN
UI-S06|reconnect state|BS-03|bs|reconnect state machine (push/reconnect.ts) ✓; ABSENT production transport|PARTIAL|t24
UI-S07|old generation cannot overwrite new|BQ-21 + BS-01/03|bq+bs|G8 stale-overwrite (pull.ts:90) + verdicts ✓; ABSENT prod transport|PARTIAL|p8s6-push::C5.3
UI-S08|optimistic action not treated durable until Host accepts|BS-04|bs|effectSequence in response provenance (pull)|COVERED|t4
UI-S09|Retry projection|BQ-04/BQ-21|bq|getProjection re-pull with generation|COVERED|t24
UI-S10|Diagnostics safe detail|BQ-20|bq|typed errors, no leak|COVERED|p8t3-adm::untyped throw

## 3. SUMMARY
COVERED 148 (A6 B12 C8 D12 E11 G4 H3 I15 J12 K6 L10 M17 N8 O5 P3 Q1 R8 S7) · PARTIAL 49 (A1 B2 C2 D2 F12 G5 H8 I1 L1 M1 P8 Q4 S2) · MISSING 0 · NATIVE_PROVEN 14 (B04 H11 L03 O01-O04 P03 P04 Q01 Q05 R03 R04 S02) · CLIENT_LOCAL 5 (B01 M17 M18 N09 Q08) · NOT_APPLICABLE_WITH_REASON 0

## 4. GAP LIST (49 PARTIAL; MISSING 0; plan §26: each must become a repair task before P9)
- R1 Creation/preflight (2): B05 (no ND-02 adapter / no preset method), B07 (team.create lacks initialWork).
- R2 Projection query (29): C07 C08 D09 D14 F01-F12 G01 G02 G05 G06 G09 H01 H02 H04 H06 H09 H10 H12 L11 — BQ-08 view absent (EMPTY_EFFECTIVE_CONFIG); BQ-10 ephemeral; BQ-11/ND-02/ND-03 absent; DISPOSED discoverability absent.
- R3 Runtime/command (2): H03 (PolicyState switch non-durable), I08 (Archive CREATED → ILLEGAL_STATE, FSM divergence).
- R4 Handoff/fork (13): M11 (no handoff/fork ledger category); P02 P05 P06 P07 P08 P09 P11 P12 (handoff fail-closed; BC-22/23/24 + BQ-17 absent); Q02 Q03 Q04 Q06 (BQ-18 no surface).
- R5 Reconnect/push (3): A07 S06 S07 (push engine + G8 verdicts tested; NO production push transport, no client mount).

## 5. SPOT-VERIFY
- UI-J08: s6rem:1028-1041 compatibility.ack → fingerprint-bound acknowledge. Confirmed.
- UI-E11: p6t2-quota "one over the limit is REJECTED with QUOTA_EXCEEDED_TEAM_INSTANCES". Confirmed.
- UI-R02: s6rem:1083-1099 legacy.inspect + p7t7 roster. Confirmed.

## 6. Anomalies / main-agent notes
1. S5A-result.md (task-cited) absent → S5A-node-brief.md + S5A-review.md used.
2. Plan §26 only in master checkout, absent from tip (rows read from master; citations = tip worktree).
3. Client half = empty P1-T4 skeleton, not in profile-patch (run.mjs:445-462) — CL rows are P9 deliverables.
4. Prod handoff fail-closed by design (service+tests complete) — largest gap cluster.
5. policyState non-durable; effectiveConfig EMPTY; 'resuming' not derivable (live:25-26); BC-09→BC-08 (I02).
6. Per plan §26: all 49 PARTIAL rows must generate repair tasks; none may carry into P9.
