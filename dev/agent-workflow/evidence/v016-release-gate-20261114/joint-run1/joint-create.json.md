```json
{
  "type": "server-response",
  "rpcId": "joint-create-uxhl042srk",
  "result": {
    "ok": true,
    "value": {
      "data": {
        "path": "fresh-root",
        "durable": {
          "teamSession": {
            "schemaVersion": 1,
            "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
            "blueprint": {
              "blueprintId": "team.c1-a6-officer",
              "revision": "1",
              "contentHash": "sha256:0785409bf02905fc6333dc6edd49d92528f4b161fcc64426f1f61d0e2fca4f6f"
            },
            "createdAt": "2026-11-13T16:52:10.437Z",
            "generation": 1,
            "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/workspace"
          },
          "binding": {
            "schemaVersion": 1,
            "kind": "team-root",
            "sessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d"
          },
          "wrote": true,
          "leaderRow": {
            "schemaVersion": 2,
            "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
            "instanceId": "inst-leader",
            "templateId": "leader",
            "label": "leader",
            "createdAt": "2026-11-13T16:52:10.456Z",
            "activityVersion": 1
          }
        },
        "bind": {
          "requested": "fresh-root",
          "bound": true,
          "installed": true,
          "identity": {
            "kind": "root",
            "sessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
            "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d"
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
