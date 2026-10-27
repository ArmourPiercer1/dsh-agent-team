# C2 boot budget — u7-agent-control (lane u7fa*)

DECLARED: 3 host boots for C2 (per plan). ACTUAL accounting (verdict ledger +
budget-ledger.jsonl are the machine records; this is the human one):

| boot | line | outcome | why |
| --- | --- | --- | --- |
| 1 | u7fa1 | START_FAILED (all cases FAIL pre-judgment) | infrastructure: the host's web server hit EADDRINUSE on :3183 (a transient outside holder in the leased band; the TeamDomainError line in the same log is CASCADE noise from the activation abort, not a lane finding). Zero verdicts produced. |
| 2 | u7fa2 | FAIL before any governed witness | lane-assembly defect (pre-fix): the world's writePreBootFiles missed `p6t6-directive.json` + `anchor.yaml` (the shared kit shape u74a@332). The host booted, p6t6 health answered ENOENT, no cases judged. Zero verdicts produced. |
| 3 | u7fa3 | FIRST REAL BOOT — mount PROVEN live | placement-feed on the production glue listed all SEVEN governed agent-control rows; the pilot's `list_agents` reached the family row and my own default-deny arm answered typed `template-default-deny` VERBATIM (proving the plane policy channel reaches the family). The two remaining required arms did not execute: the mock lane had a member-follow-up defect (envelope matched only the FIRST user message, so the pilot parked after step 0) and the pilot template was default:deny where the C2 authorized-enumeration arm requires the ask lane. |
| 4 | u7fa4 | **OVER-BUDGET FIX ROUND — DECLARED HERE** | boots 1–2 produced ZERO verdict material (infra + my pre-fix assembly); boot 3's two fixes (mock laneOf all-user-text envelope law; pilot template `default: ask`; mount judge witness moved to the placement-feed + pilot transcript, which is the correct governed-session witness) are lane-harness fixes, not law changes. Hard cap: boot 5 absolute stop regardless of outcome; unfinished arms recorded verbatim (REFUSED/FAIL), never flipped. |

No boot other than these touches :3080 (the stable instance probe is read-only
401, `stable-instance-unchanged` PASS every run). All boots land inside the
leased bands (3181-3184 hosts observed; hosts self-release).

Boot-4 verdicts (VERBATIM): ac:mounted PASS (placement-feed carries all seven
governed rows; pilot RANS on the governed session); ac:enumerate-governed
REFUSED — the AUTHORIZED walk RAN end to end (durable Control row
`ctrl-0qfreo113ibh4e0gjngnr1k6` toolName=list_agents, PA fingerprint in its
summary, settled ONCE by the runner via resolveControl, status 200; grant
CONSUMED) and the port leg then answered typed `agent-runtime-leg-unwired
(leg 'listAgents')` — at this pin the only `agentTeams` provider is the
upstream EXPERIMENTAL agent-team runtime, which has no face for a vNext
governed member's roster; the roster face for vNext members is a plugin-plane
exposure named as a follow-up round (same round as the callerAuthority
injection). Never flipped to PASS. ac:spawn-failclosed REFUSED (DESIGNED: the
no-amplification fence fails CLOSED before PA — `agent-control-
amplification-refused`, zero Control rows, zero spawn; the mount carries no
trusted caller-authority snapshot — production fail-closed posture proven
live). ac:interrupt-foreign-zero FAIL — mock payload bug (the pilot sent
`message`, outside the closed grammar; the family's own schema refused with
zero reach — a live proof of the grammar but not the C2 foreign-scope arm).

| 5 | u7fa5 | **BOOT 5 — ABSOLUTE CAP (declared)** | mock payload fix only (`interrupt_agent {agent_id}` — grammar-exact), so the required foreign-scope arm reaches the scope fence. No lane-law changes after boot 3's fix round. Whatever stands after boot 5 stands verbatim. |
