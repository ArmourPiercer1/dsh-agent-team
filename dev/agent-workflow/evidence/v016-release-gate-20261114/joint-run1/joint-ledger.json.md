```json
{
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
}
```
