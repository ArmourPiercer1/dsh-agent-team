```json
{
  "first": {
    "instanceId": "inst-1jom8i51fdrb",
    "templateId": "worker"
  },
  "second": {
    "instanceId": "inst-188kqjj1en8j",
    "templateId": "worker"
  },
  "firstRelay": {
    "status": 200,
    "body": {
      "type": "server-response",
      "rpcId": "joint-j09-first-9l4upjbr3y",
      "result": {
        "ok": true,
        "value": {
          "data": {
            "outcome": {
              "status": "delivered",
              "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
              "action": "send-message",
              "callerRole": "human",
              "recipientInstanceId": "inst-1jom8i51fdrb",
              "deliveryMode": "direct",
              "deliveredToInstanceId": "inst-1jom8i51fdrb",
              "deliveredToSessionId": "session-team-child-d16c0a36766631837d378f19207e0e13",
              "factSequence": 37,
              "deliveredSequence": 38,
              "requestToken": "joint-j09-first-2026-11-13T16-51-55-h0-r587c7d"
            }
          },
          "provenance": {
            "origin": "team-remote",
            "method": "member.send",
            "endpoint": "member.send",
            "contractVersion": 4,
            "requestToken": "joint-j09-first-2026-11-13T16-51-55-h0-r587c7d",
            "projectionGeneration": null,
            "effectSequence": 37
          }
        }
      }
    }
  },
  "secondRelay": {
    "status": 200,
    "body": {
      "type": "server-response",
      "rpcId": "joint-j09-second-g8gud06moj",
      "result": {
        "ok": true,
        "value": {
          "data": {
            "outcome": {
              "status": "delivered",
              "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
              "action": "send-message",
              "callerRole": "human",
              "recipientInstanceId": "inst-188kqjj1en8j",
              "deliveryMode": "direct",
              "deliveredToInstanceId": "inst-188kqjj1en8j",
              "deliveredToSessionId": "session-team-child-2df2405b20dd132cb7247385e363d5f4",
              "factSequence": 40,
              "deliveredSequence": 41,
              "requestToken": "joint-j09-second-2026-11-13T16-51-55-h0-r587c7d"
            }
          },
          "provenance": {
            "origin": "team-remote",
            "method": "member.send",
            "endpoint": "member.send",
            "contractVersion": 4,
            "requestToken": "joint-j09-second-2026-11-13T16-51-55-h0-r587c7d",
            "projectionGeneration": null,
            "effectSequence": 40
          }
        }
      }
    }
  },
  "wakeSeen": 13,
  "cancel": {
    "status": 200,
    "body": {
      "type": "server-response",
      "rpcId": "joint-j09-stop-fowvgh5d9o",
      "result": {
        "ok": true,
        "value": {
          "accepted": true
        }
      }
    }
  },
  "markers": [
    "stopped-b4114a24.json"
  ],
  "markersAfterSecondAsk": [
    "stopped-b4114a24.json"
  ],
  "wakesBefore": 12,
  "wakesAfter": 13,
  "markerBytesStable": true,
  "secondAskLegs": 1,
  "gate": {
    "holding": true,
    "releasedBy": "driver"
  }
}
```
