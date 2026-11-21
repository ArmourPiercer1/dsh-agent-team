# UTE-3 / G1 AGENT-CONTROL — old-path vector coverage

The census unit `dsh.agent-control-family` books **seven** members and this fixture covers **seven**.
Stage-0 measured **two implementations per member** (governed family-body row + the pinned host native row), so **7 dual / 0 single**: no member could be honestly booked as a non-retirement single-implementation case, and there is no exclusion to declare.

Rows: **42**. Members: **7**. Exclusions: **0**.

| member | rows | success/effect | wrong-input | permission/out-of-lane | abort/deadline |
| --- | --- | --- | --- | --- | --- |
| `subagent` | 6 | `AC-SUB-1-spawn` | `AC-SUB-2-schema`<br>`AC-SUB-6-replay` | `AC-SUB-3-amplification`<br>`AC-SUB-4-template-deny` | `AC-SUB-5-abort` |
| `subagent_fork` | 6 | `AC-FORK-1-inherit` | `AC-FORK-2-schema` | `AC-FORK-3-context-authority`<br>`AC-FORK-4-template-deny`<br>`AC-FORK-6-amplification` | `AC-FORK-5-abort` |
| `send_message` | 6 | `AC-MSG-1-steer` | `AC-MSG-2-schema` | `AC-MSG-3-foreign`<br>`AC-MSG-4-off-roster`<br>`AC-MSG-5-template-deny` | `AC-MSG-6-abort` |
| `interrupt_agent` | 6 | `AC-INT-1-interrupt` | `AC-INT-2-schema` | `AC-INT-3-foreign`<br>`AC-INT-4-no-roster`<br>`AC-INT-5-template-deny` | `AC-INT-6-abort` |
| `list_agents` | 6 | `AC-LIST-1-enumerate`<br>`AC-LIST-6-descendants` | `AC-LIST-2-schema` | `AC-LIST-3-template-deny` | `AC-LIST-4-abort` |
| `list_subagent_models` | 6 | `AC-MODELS-1-list` | `AC-MODELS-2-schema` | `AC-MODELS-3-template-deny`<br>`AC-MODELS-6-authority` | `AC-MODELS-4-abort` |
| `workflow` | 6 | `AC-WF-1-run` | `AC-WF-2-schema`<br>`AC-WF-6-replay` | `AC-WF-3-step-amplification`<br>`AC-WF-4-template-deny` | `AC-WF-5-abort` |

## Per-row reading

`outcome=allow` rows carry a payload and a changed state cell; every `deny` row carries a refusal CODE and an imported refusal CATEGORY. `facts` records the port calls per leg (`legs`), the enumeration scope (`scopes`), the PA decision (`control`/`decisions`) and the exec-token uses (`tokens`).

| id | member | outcome | codes | state/effect |
| --- | --- | --- | --- | --- |
| `AC-SUB-1-spawn` | `subagent` | allow | `-` | roster=member-alpha:running\|member-beta:inactive\|member-child-1:running;inbox=-;children=member-child-1:spawnChild:delegate;workflow=- |
| `AC-SUB-2-schema` | `subagent` | deny | `agent-control-schema-refused` | — |
| `AC-SUB-3-amplification` | `subagent` | deny | `agent-control-amplification-refused` | — |
| `AC-SUB-4-template-deny` | `subagent` | deny | `template-default-deny` | — |
| `AC-SUB-5-abort` | `subagent` | deny | `cancelled` | — |
| `AC-SUB-6-replay` | `subagent` | deny | `agent-control-replay-refused` | — |
| `AC-FORK-1-inherit` | `subagent_fork` | allow | `-` | roster=member-alpha:running\|member-beta:inactive\|member-child-1:running;inbox=-;children=member-child-1:forkChild:continue;workflow=- |
| `AC-FORK-2-schema` | `subagent_fork` | deny | `agent-control-schema-refused` | — |
| `AC-FORK-3-context-authority` | `subagent_fork` | deny | `agent-control-context-authority-refused` | — |
| `AC-FORK-4-template-deny` | `subagent_fork` | deny | `template-default-deny` | — |
| `AC-FORK-5-abort` | `subagent_fork` | deny | `cancelled` | — |
| `AC-FORK-6-amplification` | `subagent_fork` | deny | `agent-control-amplification-refused` | — |
| `AC-MSG-1-steer` | `send_message` | allow | `-` | roster=member-alpha:running\|member-beta:inactive;inbox=member-alpha:1:hello;children=-;workflow=- |
| `AC-MSG-2-schema` | `send_message` | deny | `agent-control-schema-refused` | — |
| `AC-MSG-3-foreign` | `send_message` | deny | `agent-control-scope-foreign` | — |
| `AC-MSG-4-off-roster` | `send_message` | deny | `agent-control-scope-foreign` | — |
| `AC-MSG-5-template-deny` | `send_message` | deny | `template-default-deny` | — |
| `AC-MSG-6-abort` | `send_message` | deny | `cancelled` | — |
| `AC-INT-1-interrupt` | `interrupt_agent` | allow | `-` | roster=member-alpha:running\|member-beta:interrupted;inbox=-;children=-;workflow=- |
| `AC-INT-2-schema` | `interrupt_agent` | deny | `agent-control-schema-refused` | — |
| `AC-INT-3-foreign` | `interrupt_agent` | deny | `agent-control-scope-foreign` | — |
| `AC-INT-4-no-roster` | `interrupt_agent` | deny | `agent-control-scope-unresolved` | — |
| `AC-INT-5-template-deny` | `interrupt_agent` | deny | `template-default-deny` | — |
| `AC-INT-6-abort` | `interrupt_agent` | deny | `cancelled` | — |
| `AC-LIST-1-enumerate` | `list_agents` | allow | `-` | roster=member-alpha:running\|member-beta:inactive;inbox=-;children=-;workflow=- |
| `AC-LIST-2-schema` | `list_agents` | deny | `agent-control-schema-refused` | — |
| `AC-LIST-3-template-deny` | `list_agents` | deny | `template-default-deny` | — |
| `AC-LIST-4-abort` | `list_agents` | deny | `cancelled` | — |
| `AC-LIST-5-no-port` | `list_agents` | deny | `agent-runtime-leg-unwired` | — |
| `AC-LIST-6-descendants` | `list_agents` | allow | `-` | roster=member-alpha:running\|member-beta:inactive;inbox=-;children=-;workflow=- |
| `AC-MODELS-1-list` | `list_subagent_models` | allow | `-` | roster=member-alpha:running\|member-beta:inactive;inbox=-;children=-;workflow=- |
| `AC-MODELS-2-schema` | `list_subagent_models` | deny | `agent-control-schema-refused` | — |
| `AC-MODELS-3-template-deny` | `list_subagent_models` | deny | `template-default-deny` | — |
| `AC-MODELS-4-abort` | `list_subagent_models` | deny | `cancelled` | — |
| `AC-MODELS-5-no-port` | `list_subagent_models` | deny | `agent-runtime-leg-unwired` | — |
| `AC-MODELS-6-authority` | `list_subagent_models` | deny | `agent-control-runtime-agent-runtime-authority-refused` | — |
| `AC-WF-1-run` | `workflow` | allow | `-` | roster=member-alpha:running\|member-beta:inactive\|member-child-1:running;inbox=-;children=member-child-1:spawnChild:workflow-child;workflow=workflow-run-1:1:enumerate>spawn |
| `AC-WF-2-schema` | `workflow` | deny | `agent-control-schema-refused` | — |
| `AC-WF-3-step-amplification` | `workflow` | deny | `agent-control-runtime-agent-control-amplification-refused` | — |
| `AC-WF-4-template-deny` | `workflow` | deny | `template-default-deny` | — |
| `AC-WF-5-abort` | `workflow` | deny | `cancelled` | — |
| `AC-WF-6-replay` | `workflow` | deny | `agent-control-replay-refused` | — |
