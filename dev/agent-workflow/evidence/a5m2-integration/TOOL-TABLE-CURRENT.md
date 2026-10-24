# TOOL TABLE — CURRENT (living, superseded-by-nothing; history = lane-status-matrix.md append-only log)

Fixed evidence base: int `cb2a70c9647866bf11a1568c1eea1abde5286ef8` + `a4636a42e900d7e02cfb316b6d5bb111274fe14d` (B-TERMINAL family-registration restore, byte-identical to signed 8b205c412) + `e0d89a2333bdb43e25b8e085809cb5e2f628dca9` (schedule residual round, root narrow-review b4f9fc51a). Tiers: 未开发 / 未接线 / 接线未测 / 已测试(complete). 局部签不整名绿。boot/Host probes: ZERO everywhere (no Host GO). "PROVEN(src)" = source-level chain read at the fixed tip, never boot.

| family / tool | tier | owner (pane) | real evidence (file:line at fixed tips) | PA consumption |
|---|---|---|---|---|
| `team_list_members` | 接线未测 + **公开链 smoke 已测(单调用配对)** | 9c | window-4 `92a206ad…` pairCount=1 {ok:1}; rows: team-adapters:219 list, plane funnel :2002 | NOT_VERIFIED |
| `team_list_templates` `team_inspect_config` `team_create_member` `team_delegate` `team_follow_up` `team_collect` `team_send_message` `team_report_progress` `team_archive_member` (9) | 接线未测 | 9c | B-TEAM ten-name table team-adapters.mjs:219; one-name-one-placement plane :1589-1594; family B-TEAM :195 + consistency law :1198-1204; PA funnel :2002 (:1725-1729 law) | all NOT_VERIFIED |
| `team_list_pending_control` (record 85) | 接线未测 | 44ece | G1 PURE-QUERY mount plane :175-179; handover carve-out bindings :2916-2932, g1-query-wiring :260/:272 | PROVEN(src); boot NOT_VERIFIED |
| `team_request_control` `team_resolve_control` `team_grant_permission` `team_revoke_permission` (4 self-governance) | **未接线(树内)**; host-side landing UNVERIFIED | 44ece (open) | deliberately OUTSIDE blueprint-visible set schema.ts:561; NO mount/row/PA entry in-tree (:689 factory unreachable via :5584 supply-gate; declared/INACTIVE plane :4463-4465) | n/a |
| `session_search` `session_event_search` `session_trace` `session_event_trace` `session_event_read` | 接线未测 (search pair mount CONDITIONAL-on-searchBackend-evidence) | 00270f41 | names g6-session-query:222-228; full chain cited (bindings :3978-3984, inject :4062-4071, wiring call :4591-4614 pa:paAdmit, registration pairing :6216-6238); ORDER fix :565-573 | PROVEN(src); boot NOT_VERIFIED |
| `session_query` | host-plane service, NOT a plugin tool | — | zero tool token in plugin tree; ctx.inject(['sessionQuery']) host.ts:2954 | n/a |
| `stagehand_act/extract/navigate/observe/screenshot/tabs` (6) | 接线未测 (armed-only; no-armed no-backend) | e78 | names plane :187; identity g2-connector-adapters:837+; exec lease g2-team-mount:246-258 (callResource REQUIRED :210-212); arm gates bindings :3737/:3803/:3813 | PROVEN(src); boot NOT_VERIFIED |
| `browser_*` | 未接线(本插件无 wrapper; host 侧另有) | e78 | zero hits bindings/team-tool-plane | n/a |
| `terminal_open/send/read/signal/close/list` (6) | 接线未测 (int registration restored `a4636a42e`) | 8e62 | names term.mjs:76-83; arms fsproc:2792; PA seat term:261-268+edge :429; family reg block byte-identical restore (1489B) | PROVEN(src incl. restored family leg); boot NOT_VERIFIED; native-mask behavior unknown |
| `run_code` | 接线未测 (guard 两席; arm 绝对注册禁) | 44ece | adapter rev4 fsproc :180; wiring ptc :541/:647/:763 (edge D2 :804); listeners bindings :6277/:6281 fill :6291; ban ptc:100/:520 | PROVEN(src); boot NOT_VERIFIED |
| `get_goal` `create_goal` `update_goal` | 接线未测 (GOVERN: runPlan after edge) | 44ece | g5-goal-wiring :366/:374/:386-389/:408; register via allDefs :5163-5165 → tools.register :5439-5441 | PROVEN(src); boot NOT_VERIFIED |
| `schedule_list` `schedule_delete` | 接线未测, **根窄审中(b4f9fc51a)** | d675 | PAIR bind-after-def:60; real guard surface (entryOf→ACTIVE+ORIGINAL def); one-flight paTokenLedger on SAME governedTokenLedger; measured cordis-order boundary (post-next refusal DELETED, OBSERVED notes) | PROVEN(src); boot NOT_VERIFIED |
| `schedule_create` `schedule_update` | 未接线 (no wrapper/mount/PA evidence; adapter vocabulary only) | d675 (open) | zero evidence at tip (owner disclosed "create/update NOT registered" :3677/:6171) | n/a |
| `todo` `write` | 接线未测 (single-mount backends keys) | center/fs lines | bindings todo :6088-6093 'a5m2-todo', write :6109-6114; ONE PA mount per member instance ab:6441, keys :5143-5175 | PROVEN(src); boot NOT_VERIFIED |
| `edit` / `editor` | gap → 8e62 card (readName spelling variants plane :431; no own row) | 8e62 (open) | cited by 8e62 inventory B/C | n/a |
| `bash` `grep` `glob` `read` (fs line) | 接线未测 (fs rows: plane :136/:569, reserved-native :508) | 8e62 | as cited | PROVEN(src); boot NOT_VERIFIED |
| `pwsh` | 未接线 (reserved-native census :508/:544; Windows side host-owned) | 8e62 (open: contract check) | census plane :475-482 | n/a |
| `lsp*` | 未接线(本树= a5lsp2 借住臂 fsproc:2875) | **GAP: original LSP lane not in current roster** (branches alpha5-lsp-* exist) | 8e62 inventory B | n/a |
| `skill` `ask_user_question` `exit_plan_mode` `present` (G1 non-pure records) | 未接线; surface INVENTORY only | 00270f41 (open: minimal source block) | g1-surface-adapters :20-27/:159 nativeFaceRef records; module self-law "UNWIRED by ruling" :9/:12; gate :5584 | n/a |
| `dependency` `plugin_manager`(8 actions) | 未核/未接线 (zero in-tree governance found) | 00270f41 (open: contract check first) | none found (center grep + 002 card scope) | n/a |
| `workflow` (record 47) `ralph` (record 48) | adapters 接线; execution arms = the 2 未开发治理执行臂 | e78 (open: minimal arms) | workflow-adapters (a749cd4cb rows + 9826881c fail-closed recheck); ralph declared_mount host-preset-off plane census | n/a |
| upstream Team 9 impls (`send_message`/`list_agents`/`interrupt_agent` dual etc.) | 未核→9c read | 9c (open) | root census: 86 names, dual impls noted | n/a |
| `cordis_inspect_list` `cordis_inspect_query` | 接线未测 (G1 pure-query trio) | (G1 lane, archived) | plane :175-179 | PROVEN(src); boot NOT_VERIFIED |

Counts at cb2a (root-conservative, not retro-greened): 54 接线未测 / 33 未接线 / 2 未开发治理执行臂(workflow+ralph arms) / 0 complete-tested; Team single-query smoke separately noted. Every "open" row has a live card; unknowns stay unknown (never silently 未开发).
