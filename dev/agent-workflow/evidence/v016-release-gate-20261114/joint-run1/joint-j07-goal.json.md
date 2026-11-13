```json
{
  "member": {
    "label": "g-joint-7",
    "instanceId": "inst-15pbf4p0066d",
    "childSessionId": "session-team-child-ca34a4b032c11c4de39b9d08616007e1",
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
          "instanceId": "inst-15pbf4p0066d",
          "templateId": "goal-worker",
          "childSessionId": "session-team-child-ca34a4b032c11c4de39b9d08616007e1",
          "operationId": "op-1yuzjod01m3t240kerp4r1px",
          "replayed": false,
          "ledgerSequence": 17,
          "admissionCode": "ADMISSION_OPEN"
        },
        "requestToken": "joint-g-joint-7-2026-11-13T16-51-55-h0-r587c7d"
      }
    }
  },
  "humanRelay": {
    "status": 200,
    "body": {
      "type": "server-response",
      "rpcId": "joint-j07-human-pz5xhkt374",
      "result": {
        "ok": true,
        "value": {
          "data": {
            "outcome": {
              "status": "delivered",
              "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
              "action": "send-message",
              "callerRole": "human",
              "recipientInstanceId": "inst-15pbf4p0066d",
              "deliveryMode": "direct",
              "deliveredToInstanceId": "inst-15pbf4p0066d",
              "deliveredToSessionId": "session-team-child-ca34a4b032c11c4de39b9d08616007e1",
              "factSequence": 18,
              "deliveredSequence": 19,
              "requestToken": "joint-j07-human-2026-11-13T16-51-55-h0-r587c7d"
            }
          },
          "provenance": {
            "origin": "team-remote",
            "method": "member.send",
            "endpoint": "member.send",
            "contractVersion": 4,
            "requestToken": "joint-j07-human-2026-11-13T16-51-55-h0-r587c7d",
            "projectionGeneration": null,
            "effectSequence": 18
          }
        }
      }
    }
  },
  "goalBefore": null,
  "goalAfterEdit": {
    "ok": true,
    "goal": {
      "id": "goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5",
      "revision": 2,
      "objective": "C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d edited",
      "phase": "active",
      "maxGoalRounds": 6,
      "roundsStarted": 2,
      "createdAt": 1794588733255,
      "updatedAt": 1794588733309,
      "activation": "armed"
    },
    "raw": {
      "type": "server-response",
      "rpcId": "joint-j07-get-1p77qt2brk",
      "result": {
        "ok": true,
        "value": {
          "id": "goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5",
          "revision": 2,
          "objective": "C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d edited",
          "phase": "active",
          "maxGoalRounds": 6,
          "roundsStarted": 2,
          "createdAt": 1794588733255,
          "updatedAt": 1794588733309,
          "activation": "armed"
        }
      }
    }
  },
  "roundRequests": 2,
  "stop": {
    "status": 200,
    "body": {
      "type": "server-response",
      "rpcId": "joint-j07-stop-5ndrpbwm5t",
      "result": {
        "ok": true,
        "value": {
          "accepted": true
        }
      }
    }
  },
  "goalAfterStop": {
    "id": "goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5",
    "revision": 3,
    "objective": "C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d edited",
    "phase": "paused",
    "maxGoalRounds": 6,
    "roundsStarted": 2,
    "createdAt": 1794588733255,
    "updatedAt": 1794588733626,
    "activation": "disarmed"
  },
  "phaseAfterStop": "paused",
  "roundsAfterStop": 2,
  "humanTurnSeen": true,
  "roundsAtStop": 2,
  "gateHeld": true,
  "gate": {
    "holding": true,
    "releasedBy": "driver"
  },
  "goalAfterWindow": {
    "id": "goal-ed9c9fa6-92b5-4f8e-ae83-51b4231db4f5",
    "revision": 3,
    "objective": "C1_J07 human goal C1MK_J07_2026-11-13T16-51-55-h0-r587c7d edited",
    "phase": "paused",
    "maxGoalRounds": 6,
    "roundsStarted": 2,
    "createdAt": 1794588733255,
    "updatedAt": 1794588733626,
    "activation": "disarmed"
  },
  "roundsStartedAtStop": 2,
  "roundsStartedAfterWindow": 2,
  "phaseAfterWindow": "paused",
  "roundTrace": [
    {
      "round": 1,
      "at": "2026-11-13T16:52:13.469Z"
    },
    {
      "round": 2,
      "at": "2026-11-13T16:52:13.566Z"
    }
  ]
}
```
