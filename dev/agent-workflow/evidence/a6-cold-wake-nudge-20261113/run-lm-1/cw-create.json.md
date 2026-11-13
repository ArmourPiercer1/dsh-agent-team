```json
{
  "type": "server-response",
  "rpcId": "cw-create-2wnvqv5cs1",
  "result": {
    "ok": true,
    "value": {
      "data": {
        "path": "fresh-root",
        "durable": {
          "teamSession": {
            "schemaVersion": 1,
            "rootSessionId": "session-a1-root-2026-11-13T15-03-46-h0-r4caae5",
            "blueprint": {
              "blueprintId": "team.a1-gov",
              "revision": "1",
              "contentHash": "sha256:15810fa87577a3013393865efcdcd2974950bebfcb93f8a2a1f682672e1aa976"
            },
            "createdAt": "2026-11-13T15:04:01.702Z",
            "generation": 1,
            "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a6-cold-wake-nudge-20261113/tests/homes/c1-smoke-2026-11-13T15-03-46-h0-r4caae5/workspace"
          },
          "binding": {
            "schemaVersion": 1,
            "kind": "team-root",
            "sessionId": "session-a1-root-2026-11-13T15-03-46-h0-r4caae5"
          },
          "wrote": true,
          "leaderRow": {
            "schemaVersion": 2,
            "rootSessionId": "session-a1-root-2026-11-13T15-03-46-h0-r4caae5",
            "instanceId": "inst-leader",
            "templateId": "leader",
            "label": "leader",
            "createdAt": "2026-11-13T15:04:01.719Z",
            "activityVersion": 1
          }
        },
        "bind": {
          "requested": "fresh-root",
          "bound": true,
          "installed": true,
          "identity": {
            "kind": "root",
            "sessionId": "session-a1-root-2026-11-13T15-03-46-h0-r4caae5",
            "rootSessionId": "session-a1-root-2026-11-13T15-03-46-h0-r4caae5"
          },
          "admitted": true,
          "admissionCode": "ADMISSION_OPEN",
          "emittedEvents": [
            {
              "name": "agent-setup/overlay-installed",
              "detail": "persona"
            },
            {
              "name": "agent-setup/overlay-installed",
              "detail": "model"
            },
            {
              "name": "agent-setup/overlay-installed",
              "detail": "capability"
            },
            {
              "name": "agent-setup/admission-decided",
              "detail": "ADMISSION_OPEN"
            }
          ]
        }
      },
      "provenance": {
        "origin": "team-remote",
        "method": "team.create",
        "endpoint": "team.create",
        "contractVersion": 1,
        "requestToken": null,
        "projectionGeneration": null,
        "effectSequence": null
      }
    }
  }
}
```
