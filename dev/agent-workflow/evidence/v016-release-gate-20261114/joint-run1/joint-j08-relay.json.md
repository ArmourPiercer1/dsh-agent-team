```json
{
  "member": {
    "label": "g-joint-8",
    "instanceId": "inst-04bwigu0swb0",
    "childSessionId": "session-team-child-8d9aa93ffc0fb758dc08c14f94495bdd",
    "refusal": null,
    "raw": {
      "ok": true,
      "value": {
        "status": "executed",
        "action": "create-member",
        "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
        "callerRole": "leader",
        "effect": {
          "kind": "member-activated",
          "instanceId": "inst-04bwigu0swb0",
          "templateId": "goal-worker",
          "childSessionId": "session-team-child-8d9aa93ffc0fb758dc08c14f94495bdd",
          "operationId": "op-0svyekp0ulj54s17etkov0yp",
          "replayed": false,
          "ledgerSequence": 20,
          "admissionCode": "ADMISSION_OPEN"
        },
        "requestToken": "joint-g-joint-8-2026-11-13T16-51-55-h0-r587c7d"
      }
    }
  },
  "machineRelay": {
    "status": 200,
    "body": {
      "type": "server-response",
      "rpcId": "joint-j08-machine-6k3lbi2g64",
      "result": {
        "ok": true,
        "value": {
          "data": {
            "outcome": {
              "status": "delivered",
              "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
              "action": "send-message",
              "callerRole": "leader",
              "recipientInstanceId": "inst-04bwigu0swb0",
              "deliveryMode": "direct",
              "deliveredToInstanceId": "inst-04bwigu0swb0",
              "deliveredToSessionId": "session-team-child-8d9aa93ffc0fb758dc08c14f94495bdd",
              "factSequence": 21,
              "deliveredSequence": 22,
              "requestToken": "joint-j08-machine-2026-11-13T16-51-55-h0-r587c7d"
            }
          },
          "provenance": {
            "origin": "team-remote",
            "method": "member.send",
            "endpoint": "member.send",
            "contractVersion": 4,
            "requestToken": "joint-j08-machine-2026-11-13T16-51-55-h0-r587c7d",
            "projectionGeneration": null,
            "effectSequence": 21
          }
        }
      }
    }
  },
  "refusalText": null,
  "bashText": null,
  "goal": null,
  "ledgerBefore": {
    "requests": [
      {
        "sequence": 7,
        "factType": "control-request-recorded",
        "requestId": "ctrl-10bcyw908dtd2k12cfdq71gm",
        "kind": "leader-approval",
        "toolName": "bash",
        "actionName": "parameter-permission",
        "targetInstanceId": "inst-1jom8i51fdrb",
        "correlation": "call-c1-ntbhfm2y",
        "approvalCaseId": "case-0xk6mh30dackd614riitl0hm",
        "legOrdinal": 1,
        "reviewAuthority": "leader",
        "operationOwnerTemplateId": "worker",
        "operationToolOwner": "dsh-agent-team",
        "operationToolName": "bash",
        "operationToolDefinitionIdentity": "def#34",
        "authorityGeneration": 0,
        "blueprintContentHash": "sha256:0785409bf02905fc6333dc6edd49d92528f4b161fcc64426f1f61d0e2fca4f6f",
        "blueprintRevision": "1",
        "perEffectRequiredAuthorities": [
          "leader"
        ],
        "createdAt": "2026-11-13T16:52:11.261Z"
      },
      {
        "sequence": 10,
        "factType": "control-request-recorded",
        "requestId": "ctrl-0cnhwlz03fockk1ggtmlx1iw",
        "kind": "leader-approval",
        "toolName": "bash",
        "actionName": "team-tool-execute",
        "targetInstanceId": "inst-1jom8i51fdrb",
        "correlation": "pa:tadm:session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d:inst-1jom8i51fdrb:sha256:77b14744144ea4ac367ea6695ffebcdc03c603c4b25650ffc239c08559048b56:g0:team-inst-1jom8i51fdrb-native-bash:hexec:nb-1794588730957-1839089064-1",
        "approvalCaseId": "case-1t1kdsn1qzh0v60du1gs501i",
        "legOrdinal": 1,
        "reviewAuthority": "leader",
        "operationOwnerTemplateId": "worker",
        "operationToolOwner": "dsh-agent-team",
        "operationToolName": "bash",
        "operationToolDefinitionIdentity": "def#34",
        "authorityGeneration": 0,
        "blueprintContentHash": "sha256:0785409bf02905fc6333dc6edd49d92528f4b161fcc64426f1f61d0e2fca4f6f",
        "blueprintRevision": "1",
        "perEffectRequiredAuthorities": [
          "leader"
        ],
        "createdAt": "2026-11-13T16:52:11.692Z"
      }
    ],
    "decisions": [
      {
        "sequence": 8,
        "factType": "control-decision-recorded",
        "requestId": "ctrl-10bcyw908dtd2k12cfdq71gm",
        "decision": "allow",
        "decider": {
          "instanceId": "inst-143ehib1pse1",
          "kind": "instance",
          "role": "member"
        },
        "createdAt": "2026-11-13T16:52:11.437Z"
      },
      {
        "sequence": 11,
        "factType": "control-decision-recorded",
        "requestId": "ctrl-0cnhwlz03fockk1ggtmlx1iw",
        "decision": "allow",
        "decider": {
          "instanceId": "inst-143ehib1pse1",
          "kind": "instance",
          "role": "member"
        },
        "createdAt": "2026-11-13T16:52:11.874Z"
      }
    ],
    "consumptions": [
      {
        "sequence": 9,
        "factType": "control-allow-consumed",
        "requestId": "ctrl-10bcyw908dtd2k12cfdq71gm",
        "createdAt": "2026-11-13T16:52:11.623Z"
      },
      {
        "sequence": 12,
        "factType": "control-allow-consumed",
        "requestId": "ctrl-0cnhwlz03fockk1ggtmlx1iw",
        "createdAt": "2026-11-13T16:52:12.062Z"
      }
    ],
    "abandonments": [],
    "transfers": [],
    "escalations": [],
    "executionResults": [
      {
        "sequence": 13,
        "factType": "control-execution-result",
        "requestId": "ctrl-0cnhwlz03fockk1ggtmlx1iw",
        "callId": "team-inst-1jom8i51fdrb-native-bash:hexec:nb-1794588730957-1839089064-1",
        "outcome": "succeeded",
        "recordedAt": "2026-11-13T16:52:12.421Z",
        "createdAt": "2026-11-13T16:52:12.421Z"
      },
      {
        "sequence": 14,
        "factType": "control-execution-result",
        "requestId": "ctrl-10bcyw908dtd2k12cfdq71gm",
        "callId": "call-c1-ntbhfm2y",
        "outcome": "succeeded",
        "recordedAt": "2026-11-13T16:52:12.440Z",
        "createdAt": "2026-11-13T16:52:12.440Z"
      }
    ],
    "error": null
  },
  "turnSeen": true,
  "texts": [
    "Error: this goal operation requires a direct human turn on a top-level agent",
    "Error: A5_NATIVE_ADMISSION_UNAVAILABLE: the Team admission edge is not published for this agent, so this native `bash` call cannot be decided or consumed; refusing instead of executing an unapproved native call"
  ],
  "refusalForm": "sentence",
  "refusalObserved": "Error: this goal operation requires a direct human turn on a top-level agent",
  "bashFile": null,
  "askLegs": 0
}
```
