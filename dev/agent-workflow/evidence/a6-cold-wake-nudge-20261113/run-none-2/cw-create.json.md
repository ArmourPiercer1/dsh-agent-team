```json
{
  "type": "server-response",
  "rpcId": "cw-create-6gf2u5gvkb",
  "result": {
    "ok": true,
    "value": {
      "data": {
        "path": "fresh-root",
        "durable": {
          "teamSession": {
            "schemaVersion": 1,
            "rootSessionId": "session-a1-root-2026-11-13T15-06-50-h0-r242387",
            "blueprint": {
              "blueprintId": "team.a1-gov",
              "revision": "1",
              "contentHash": "sha256:02b4976bd172f96ecca5906e581fa06a796c45eb4d15d8a40cdbcba389c14ad1"
            },
            "createdAt": "2026-11-13T15:06:59.017Z",
            "generation": 1,
            "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a6-cold-wake-nudge-20261113/tests/homes/c1-smoke-2026-11-13T15-06-50-h0-r242387/workspace"
          },
          "binding": {
            "schemaVersion": 1,
            "kind": "team-root",
            "sessionId": "session-a1-root-2026-11-13T15-06-50-h0-r242387"
          },
          "wrote": true,
          "leaderRow": {
            "schemaVersion": 2,
            "rootSessionId": "session-a1-root-2026-11-13T15-06-50-h0-r242387",
            "instanceId": "inst-leader",
            "templateId": "leader",
            "label": "leader",
            "createdAt": "2026-11-13T15:06:59.036Z",
            "activityVersion": 1
          }
        },
        "bind": {
          "requested": "fresh-root",
          "bound": true,
          "installed": true,
          "identity": {
            "kind": "root",
            "sessionId": "session-a1-root-2026-11-13T15-06-50-h0-r242387",
            "rootSessionId": "session-a1-root-2026-11-13T15-06-50-h0-r242387"
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
