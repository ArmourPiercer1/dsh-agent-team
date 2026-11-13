```json
{
  "type": "server-response",
  "rpcId": "cw-create-feezmk5b1u",
  "result": {
    "ok": true,
    "value": {
      "data": {
        "path": "fresh-root",
        "durable": {
          "teamSession": {
            "schemaVersion": 1,
            "rootSessionId": "session-a1-root-2026-11-13T15-03-43-h0-r1386cd",
            "blueprint": {
              "blueprintId": "team.a1-gov",
              "revision": "1",
              "contentHash": "sha256:5459ccedd62de74ea690728fd67ae9fb6f51966b368151440ff9eabee597d1d1"
            },
            "createdAt": "2026-11-13T15:03:51.998Z",
            "generation": 1,
            "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a6-cold-wake-nudge-20261113/tests/homes/c1-smoke-2026-11-13T15-03-43-h0-r1386cd/workspace"
          },
          "binding": {
            "schemaVersion": 1,
            "kind": "team-root",
            "sessionId": "session-a1-root-2026-11-13T15-03-43-h0-r1386cd"
          },
          "wrote": true,
          "leaderRow": {
            "schemaVersion": 2,
            "rootSessionId": "session-a1-root-2026-11-13T15-03-43-h0-r1386cd",
            "instanceId": "inst-leader",
            "templateId": "leader",
            "label": "leader",
            "createdAt": "2026-11-13T15:03:52.015Z",
            "activityVersion": 1
          }
        },
        "bind": {
          "requested": "fresh-root",
          "bound": true,
          "installed": true,
          "identity": {
            "kind": "root",
            "sessionId": "session-a1-root-2026-11-13T15-03-43-h0-r1386cd",
            "rootSessionId": "session-a1-root-2026-11-13T15-03-43-h0-r1386cd"
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
