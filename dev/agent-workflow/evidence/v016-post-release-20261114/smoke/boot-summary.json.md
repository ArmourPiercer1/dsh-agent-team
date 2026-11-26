{
  "instrument": "boot-installed.mjs",
  "dshHome": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114/tests/homes/v016post-20261114-pinned",
  "port": 3191,
  "checks": {
    "teamRemoteMounted": {
      "httpStatus": 200,
      "bodyKind": "server-response",
      "bodyPreview": "{\"type\":\"server-response\",\"rpcId\":\"v016post-team.getProjection-80loolx4\",\"result\":{\"ok\":false,\"error\":{\"code\":\"internal-error\",\"message\":\"remote method 'team.getProjection' is unavailable while the team runtime is not ready (state: starting) — the live boot is still starting or it failed; the route stays registered and the catalog reads stay servable\",\"details\":{\"method\":\"team.getProjection\",\"endpoint\":\"team.getProjection\",\"contractVersion\":1,\"requestToken\":null,\"reason\":\"runtime-not-ready\"}}}}"
    },
    "projectionWhenReady": {
      "httpStatus": 200,
      "bodyPreview": "{\"type\":\"server-response\",\"rpcId\":\"v016post-team.getProjection-0roqy3mj\",\"result\":{\"ok\":true,\"value\":{\"data\":{\"projection\":{\"schemaVersion\":2,\"teamSessionId\":\"team-root\",\"blueprint\":{\"blueprintId\":\"my-team-bp-1\",\"revision\":\"1\",\"contentHash\":\"sha256:9ee498574d6651ab131a87b50fd435993fc7647252466da1608f7d542384152f\"},\"generation\":2,\"generatedAt\":\"2026-11-13T18:23:39.011Z\",\"root\":{\"teamSessionId\":\"team-root\",\"createdAt\":\"2026-11-13T18:23:37.996Z\",\"policyState\":\"default\",\"admission\":\"OPEN\",\"compatibility\":{\"status\":\"OPEN\",\"probeGeneration\":1,\"requirementFingerprint\":\"none\",\"environmentFingerprint\":\"fp-v1:496d1037b98199e1\",\"warningCount\":0,\"fatalCount\":0,\"acknowledgedWarningCount\":0,\"lastProbedAt\":\"2026-11-13T18:23:38.049Z\"},\"creationBudgetConsumed\":0,\"defaultWorkspace\":\"/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114\"},\"templates\":[{\"kind\":\"leader\",\"templateId\":\"leader\",\"displayName\":\"leader\",\"contextPolicy\":\"persistent\"},{\"kind\":\"member\",\"templateId\":\"worker\",\"displayName\":\"Worker A\",\"contextPolicy\":\"persistent\",\"instanceQuota\":4}],\"members\":[{\"instanceId\":\"inst-leader\",\"templateId\":\"leader\",\"label\":\"leader\",\"workspace\":\"/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114\",\"createdAt\":\"2026-11-13T18:23:38.024Z\",\"lifecycle\":\"RUNNING\",\"contextPolicy\":\"persistent\",\"effectiveConfig\":{\"model\":{\"value\":\"deepseek-official/deepseek-v4-flash\",\"source\":\"capability\",\"state\":\"inherited\"},\"workspace\":{\"value\":\"/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114\",\"source\":\"blueprint\",\"state\":\"locked\",\"locked\":true},\"permissions\":{},\"autonomy\":{\"value\":null,\"source\":\"autonomy-overlay\",\"state\":\"inherited\"}},\"liveActivity\":{\"residency\":\"resident\",\"lastActivityAt\":\"2026-11-13T18:23:39.011Z\"},\"modelState\":{\"current\":{\"value\":\"deepseek-official/deepseek-v4-flash\",\"source\":\"capability\",\"state\":\"inherited\"},\"provenance\":{\"layer\":\"unspecified\",\"origin\":\"static\",\"recordId\":null,\"explanation\":\"model: effective deny; team none(origin=static) deny (fail-closed: no team layer grants this cell); external exists=yes, hard=unspecified\"},\"availability\":\"available\"}}],\"ledger\":{\"latestSequence\":0,\"totalEntries\":0,\"byCategory\":{\"team\":0,\"member\":0,\"lifecycle\":0,\"message\":0,\"control\":0,\"policy\":0,\"compatibility\":0,\"progress\":0},\"pendingControlCount\":0}}},\"provenance\":{\"origin\":\"team-remote\",\"method\":\"team.getProjection\",\"endpoint\":\"team.getProjection\",\"contractVersion\":4,\"requestToken\":null,\"projectionGeneration\":2,\"effectSequence\":null}}}}"
    },
    "listRoots": {
      "httpStatus": 200,
      "bodyPreview": "{\"type\":\"server-response\",\"rpcId\":\"v016post-team.listRoots-dphnlcs8\",\"result\":{\"ok\":true,\"value\":{\"data\":{\"roots\":[{\"rootSessionId\":\"team-root\",\"blueprintId\":\"my-team-bp-1\",\"revision\":\"1\",\"defaultWorkspace\":\"/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114\",\"createdAt\":\"2026-11-13T18:23:37.996Z\",\"generation\":2,\"memberCount\":0}]},\"provenance\":{\"origin\":\"team-remote\",\"method\":\"team.listRoots\",\"endpoint\":\"team.listRoots\",\"contractVersion\":3,\"requestToken\":null,\"projectionGeneration\":null,\"effectSequence\":null}}}}"
    }
  },
  "team": {
    "ok": true,
    "value": {
      "data": {
        "projection": {
          "schemaVersion": 2,
          "teamSessionId": "team-root",
          "blueprint": {
            "blueprintId": "my-team-bp-1",
            "revision": "1",
            "contentHash": "sha256:9ee498574d6651ab131a87b50fd435993fc7647252466da1608f7d542384152f"
          },
          "generation": 2,
          "generatedAt": "2026-11-13T18:23:39.011Z",
          "root": {
            "teamSessionId": "team-root",
            "createdAt": "2026-11-13T18:23:37.996Z",
            "policyState": "default",
            "admission": "OPEN",
            "compatibility": {
              "status": "OPEN",
              "probeGeneration": 1,
              "requirementFingerprint": "none",
              "environmentFingerprint": "fp-v1:496d1037b98199e1",
              "warningCount": 0,
              "fatalCount": 0,
              "acknowledgedWarningCount": 0,
              "lastProbedAt": "2026-11-13T18:23:38.049Z"
            },
            "creationBudgetConsumed": 0,
            "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114"
          },
          "templates": [
            {
              "kind": "leader",
              "templateId": "leader",
              "displayName": "leader",
              "contextPolicy": "persistent"
            },
            {
              "kind": "member",
              "templateId": "worker",
              "displayName": "Worker A",
              "contextPolicy": "persistent",
              "instanceQuota": 4
            }
          ],
          "members": [
            {
              "instanceId": "inst-leader",
              "templateId": "leader",
              "label": "leader",
              "workspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114",
              "createdAt": "2026-11-13T18:23:38.024Z",
              "lifecycle": "RUNNING",
              "contextPolicy": "persistent",
              "effectiveConfig": {
                "model": {
                  "value": "deepseek-official/deepseek-v4-flash",
                  "source": "capability",
                  "state": "inherited"
                },
                "workspace": {
                  "value": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-post-release-20261114",
                  "source": "blueprint",
                  "state": "locked",
                  "locked": true
                },
                "permissions": {},
                "autonomy": {
                  "value": null,
                  "source": "autonomy-overlay",
                  "state": "inherited"
                }
              },
              "liveActivity": {
                "residency": "resident",
                "lastActivityAt": "2026-11-13T18:23:39.011Z"
              },
              "modelState": {
                "current": {
                  "value": "deepseek-official/deepseek-v4-flash",
                  "source": "capability",
                  "state": "inherited"
                },
                "provenance": {
                  "layer": "unspecified",
                  "origin": "static",
                  "recordId": null,
                  "explanation": "model: effective deny; team none(origin=static) deny (fail-closed: no team layer grants this cell); external exists=yes, hard=unspecified"
                },
                "availability": "available"
              }
            }
          ],
          "ledger": {
            "latestSequence": 0,
            "totalEntries": 0,
            "byCategory": {
              "team": 0,
              "member": 0,
              "lifecycle": 0,
              "message": 0,
              "control": 0,
              "policy": 0,
              "compatibility": 0,
              "progress": 0
            },
            "pendingControlCount": 0
          }
        }
      },
      "provenance": {
        "origin": "team-remote",
        "method": "team.getProjection",
        "endpoint": "team.getProjection",
        "contractVersion": 4,
        "requestToken": null,
        "projectionGeneration": 2,
        "effectSequence": null
      }
    }
  },
  "errors": [],
  "boot": {
    "origin": "http://127.0.0.1:3191",
    "authStatus": 303,
    "command": [
      "node",
      "/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/apps/cli/lib/bin.js",
      "web",
      "--port",
      "3191",
      "--no-open"
    ]
  }
}
