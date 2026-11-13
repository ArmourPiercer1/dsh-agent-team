{
  "type": "server-response",
  "rpcId": "a1-create-dofr3x2gf1",
  "result": {
    "ok": true,
    "value": {
      "data": {
        "path": "fresh-root",
        "durable": {
          "teamSession": {
            "schemaVersion": 1,
            "rootSessionId": "session-a1-root-2026-11-13T18-19-17-h0-r51dd78",
            "blueprint": {
              "blueprintId": "team.a1-gov",
              "revision": "1",
              "contentHash": "sha256:6ba2dd5562e4e36b0f4e672f0211b5e99e890a67d0ad2e2df99bcbadb6b17b84"
            },
            "createdAt": "2026-11-13T18:19:30.693Z",
            "generation": 1,
            "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace"
          },
          "binding": {
            "schemaVersion": 1,
            "kind": "team-root",
            "sessionId": "session-a1-root-2026-11-13T18-19-17-h0-r51dd78"
          },
          "wrote": true,
          "leaderRow": {
            "schemaVersion": 2,
            "rootSessionId": "session-a1-root-2026-11-13T18-19-17-h0-r51dd78",
            "instanceId": "inst-leader",
            "templateId": "leader",
            "label": "leader",
            "createdAt": "2026-11-13T18:19:30.722Z",
            "activityVersion": 1
          }
        },
        "bind": {
          "requested": "fresh-root",
          "bound": true,
          "installed": true,
          "identity": {
            "kind": "root",
            "sessionId": "session-a1-root-2026-11-13T18-19-17-h0-r51dd78",
            "rootSessionId": "session-a1-root-2026-11-13T18-19-17-h0-r51dd78"
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