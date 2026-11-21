```json
{
  "officer": {
    "ok": true,
    "value": {
      "status": "executed",
      "action": "create-member",
      "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
      "callerRole": "leader",
      "effect": {
        "kind": "member-activated",
        "instanceId": "inst-143ehib1pse1",
        "templateId": "officer",
        "childSessionId": "session-team-child-04e3fdbdbbecad8786050178778e7adf",
        "operationId": "op-1bawgl31qa4kg200fqm69134",
        "replayed": false,
        "ledgerSequence": 3,
        "admissionCode": "ADMISSION_OPEN"
      },
      "requestToken": "joint-officer-2026-11-13T16-51-55-h0-r587c7d"
    }
  },
  "worker": {
    "ok": true,
    "value": {
      "status": "executed",
      "action": "create-member",
      "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
      "callerRole": "leader",
      "effect": {
        "kind": "member-activated",
        "instanceId": "inst-1jom8i51fdrb",
        "templateId": "worker",
        "childSessionId": "session-team-child-d16c0a36766631837d378f19207e0e13",
        "operationId": "op-0cqw0p308tij4u1pwj64p1bh",
        "replayed": false,
        "ledgerSequence": 4,
        "admissionCode": "ADMISSION_OPEN"
      },
      "requestToken": "joint-worker-2026-11-13T16-51-55-h0-r587c7d"
    }
  },
  "delegate": {
    "ok": true,
    "value": {
      "status": "executed",
      "action": "delegate",
      "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
      "callerRole": "leader",
      "effect": {
        "kind": "work-admitted",
        "instanceId": "inst-1jom8i51fdrb",
        "fromLifecycle": "CREATED",
        "lifecycleCommitted": true,
        "sequence": 5,
        "settled": false,
        "workStatus": "admitted"
      },
      "requestToken": "joint-delegate-2026-11-13T16-51-55-h0-r587c7d"
    }
  },
  "workerId": "inst-1jom8i51fdrb"
}
```
