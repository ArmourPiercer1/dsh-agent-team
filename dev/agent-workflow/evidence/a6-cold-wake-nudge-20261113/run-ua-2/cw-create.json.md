```json
{
  "type": "server-response",
  "rpcId": "cw-create-xw1yjj33k7",
  "result": {
    "ok": true,
    "value": {
      "data": {
        "path": "fresh-root",
        "durable": {
          "teamSession": {
            "schemaVersion": 1,
            "rootSessionId": "session-a1-root-2026-11-13T15-14-01-h0-r8abd59",
            "blueprint": {
              "blueprintId": "team.a1-gov",
              "revision": "1",
              "contentHash": "sha256:57a81dbf82a6547ad9d950acc1daa5e6b546a0ebab601613da72cecdfdf68414"
            },
            "createdAt": "2026-11-13T15:14:09.701Z",
            "generation": 1,
            "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a6-cold-wake-nudge-20261113/tests/homes/c1-smoke-2026-11-13T15-14-01-h0-r8abd59/workspace"
          },
          "binding": {
            "schemaVersion": 1,
            "kind": "team-root",
            "sessionId": "session-a1-root-2026-11-13T15-14-01-h0-r8abd59"
          },
          "wrote": true,
          "leaderRow": {
            "schemaVersion": 2,
            "rootSessionId": "session-a1-root-2026-11-13T15-14-01-h0-r8abd59",
            "instanceId": "inst-leader",
            "templateId": "leader",
            "label": "leader",
            "createdAt": "2026-11-13T15:14:09.719Z",
            "activityVersion": 1
          }
        },
        "bind": {
          "requested": "fresh-root",
          "bound": true,
          "installed": true,
          "identity": {
            "kind": "root",
            "sessionId": "session-a1-root-2026-11-13T15-14-01-h0-r8abd59",
            "rootSessionId": "session-a1-root-2026-11-13T15-14-01-h0-r8abd59"
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
