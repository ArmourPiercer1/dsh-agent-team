```json
{
  "schema": "joint-acceptance/1",
  "recordClass": "DEV-LIVE",
  "composition": {
    "preset": "native",
    "blueprint": "schemaVersion: 5, memberIoCeilings + reviewRouting",
    "planeTakeover": true,
    "alpha6ReviewRouting": true,
    "governedRealm": true
  },
  "counts": {
    "PASS": 11
  },
  "arms": [
    {
      "arm": "J01",
      "proposition": "Team + routing: v5 both families admitted; Officer routed, one team_resolve_control",
      "verdict": "PASS",
      "detail": "team.create=200 admitted=true blueprintHash=sha256:0785409bf02905fc6333dc6edd49d92528f4b161fcc64426f1f61d0e2fca4f6f memberIoCeilings=true reviewRouting=true schemaVersion=5"
    },
    {
      "arm": "J02",
      "proposition": "Governed I/O inside the ceiling: write succeeds + a5sf-guard-consult/1 ALLOW fact",
      "verdict": "PASS",
      "detail": "inside=\"pd42-inside-2026-11-13T16-51-55-h0-r587c7d\" allowFacts=1"
    },
    {
      "arm": "J03",
      "proposition": "Governed I/O outside the ceiling: typed deny, zero bytes, deny attributable",
      "verdict": "PASS",
      "detail": "writeDenies=1 outsideExists=false"
    },
    {
      "arm": "J04",
      "proposition": "Native bash governed: pinned definition, realm PTY, shared PTY state, second Member separate PTY",
      "verdict": "PASS",
      "detail": "bashCalls=1 pinnedDefinition=true bashExecuted=true realmTerminalFacts=0 (disclosure: the shipped post-#730 path audits bash in the control ledger, not the realm sink)"
    },
    {
      "arm": "J05",
      "proposition": "Approval lifecycle: durable request -> human allow -> one consumption -> one execution -> one execution-result; deny = zero/zero/zero",
      "verdict": "PASS",
      "detail": "request=ctrl-10bcyw908dtd2k12cfdq71gm consumption=1 executionResults=1 outcomes=succeeded executionFactWaitMs=300"
    },
    {
      "arm": "J06",
      "proposition": "Officer identity (F-3): which decider receives parameter-permission vs team-tool-execute; whenOfficerUnavailable honoured",
      "verdict": "PASS",
      "detail": "parameter-permission request=ctrl-10bcyw908dtd2k12cfdq71gm reviewAuthority=leader blueprintContentHash=sha256:0785409bf02905fc6333dc6edd49d92528f4b161fcc64426f1f61d0e2fca4f6f operationTool=dsh-agent-team/bash authorityGeneration=0 decider={\"instanceId\":\"inst-143ehib1pse1\",\"kind\":\"instance\",\"role\":\"member\"} officer=inst-143ehib1pse1 routedToOfficer=true routedAwayFromOfficer=false identityCarried=true legDecided=true decisionWaitMs=0 whenOfficerUnavailable=hold(unit-pinned, not exercised here) team-tool-execute leg=true"
    },
    {
      "arm": "J07",
      "proposition": "Goal from direct human input: create/get/update, >=2 automatic rounds, human Stop -> durable paused, no continuation",
      "verdict": "PASS",
      "detail": "member=inst-15pbf4p0066d relay=200/ok goal={\"id\":\"goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5\",\"revision\":2,\"phase\":\"active\",\"objective\":\"C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d ed\"} roundsStarted=2->2 (mockRoundRequests=2->2) stopLandedMidRound=true holdReleasedBy=driver stop=200 phase=paused->paused toolResults=[\"{\\\"goal\\\":{\\\"id\\\":\\\"goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5\\\",\\\"revision\\\":1,\\\"objective\\\":\\\"C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d\\\",\\\"phase\\\":\\\"active\\\",\\\"roundsStarted\\\":0,\\\"maxGoalRounds\\\":6},\\\"activation\\\":\\\"armed\\\"}\",\"{\\\"goal\\\":{\\\"id\\\":\\\"goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5\\\",\\\"revision\\\":1,\\\"objective\\\":\\\"C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d\\\",\\\"phase\\\":\\\"active\\\",\\\"roundsStarted\\\":0,\\\"maxGoalRounds\\\":6},\\\"activation\\\":\\\"armed\\\"}\",\"{\\\"goal\\\":{\\\"id\\\":\\\"goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5\\\",\\\"revision\\\":2,\\\"objective\\\":\\\"C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d edited\\\",\\\"phase\\\":\\\"active\\\",\\\"roundsStarted\\\":0,\\\"maxGoalRounds\\\":6},\\\"activation\\\":\\\"armed\\\"}\"]"
    },
    {
      "arm": "J08",
      "proposition": "Relay refusal: a machine relay turn cannot create_goal (GOAL_TOOL_AUTHORITY_REQUIRED) and no Goal row exists",
      "verdict": "PASS",
      "detail": "member=inst-04bwigu0swb0 relay=200 caller=instance/inst-leader refusal=GOAL_TOOL_AUTHORITY_REQUIRED(sentence) refusalObserved=\"Error: this goal operation requires a direct human turn on a top-level agent\" goal=null governedBashStillRuns=false (disclosure; the shell lane is J04/J05's clause) file=null askLegsMinted=0"
    },
    {
      "arm": "J09",
      "proposition": "Sticky Stop on the review-wake path: live latch -> human Stop -> durable stopped-<hash>.json, and a subsequent review ask wakes nobody",
      "verdict": "PASS",
      "detail": "wakeSeen=13 firstRelay=200 cancel=200 markers=[\"stopped-b4114a24.json\"] bytes=\"{\\\"stopped\\\":true,\\\"key\\\":{\\\"rootSessionId\\\":\\\"session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d\\\",\\\"reviewerInstanceId\\\":\\\"inst-143ehib1pse1\\\",\\\"sessionGeneration\\\":1},\\\"targetSessionId\\\":\\\"session-team-child-04e3fd\" wakes=13->13 markerStable=true secondAskLegs=1 askIsReal=true secondRelay=200 holdReleasedBy=driver"
    },
    {
      "arm": "J10",
      "proposition": "Cold recovery: SIGKILL mid-body, cold boot on the same DSH_HOME, no duplicate execution, no replayed consumed allow, crash-window settlement unknown",
      "verdict": "PASS",
      "detail": "exited=true restart=ok legs=pp:ctrl-0mnvyk509lq73o0zmyqqz1x2/pa:ctrl-19lbnoq0dgocoh0tuxbok19o consumed=1/1->1/1 facts=pa:1xunknown pp:1xunknown abandonments=execution-outcome-unknown,execution-outcome-unknown mockRequests=2->2 members=6 memberSurvived=true officerSurvived=true bodyStart=\"body-started\\n\" clauses={\"noDuplicate\":true,\"noReplay\":true,\"execSettledUnknown\":true,\"noSilentAbsence\":true,\"durableSurvived\":true}"
    },
    {
      "arm": "J11",
      "proposition": "No replay: a consumed allow cannot be re-dispatched; a late allow is refused (CONTROL_REQUEST_DECIDED)",
      "verdict": "PASS",
      "detail": "one-shot consumption facts for ctrl-10bcyw908dtd2k12cfdq71gm: 1"
    }
  ],
  "osLevelNetworkIsolationClaimed": false,
  "note": "DEV-LIVE: this record can never produce a V@B=yes or any frozen-candidate claim."
}
```
