```json
{
  "member": {
    "label": "g-joint-10",
    "instanceId": "inst-13eyrjh0nadb",
    "childSessionId": "session-team-child-126248bdda1d9650f75ac57417ebba12",
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
          "instanceId": "inst-13eyrjh0nadb",
          "templateId": "worker",
          "childSessionId": "session-team-child-126248bdda1d9650f75ac57417ebba12",
          "operationId": "op-1gekxtu1isglpz1f1jymk0k5",
          "replayed": false,
          "ledgerSequence": 23,
          "admissionCode": "ADMISSION_OPEN"
        },
        "requestToken": "joint-g-joint-10-2026-11-13T16-51-55-h0-r587c7d"
      }
    }
  },
  "relay": {
    "status": 200,
    "body": {
      "ok": true,
      "value": {
        "status": "executed",
        "action": "delegate",
        "rootSessionId": "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
        "callerRole": "leader",
        "effect": {
          "kind": "work-admitted",
          "instanceId": "inst-13eyrjh0nadb",
          "fromLifecycle": "CREATED",
          "lifecycleCommitted": true,
          "sequence": 24,
          "settled": false,
          "workStatus": "admitted"
        },
        "requestToken": "joint-j10-delegate-2026-11-13T16-51-55-h0-r587c7d"
      }
    }
  },
  "before": {
    "pp": "ctrl-0mnvyk509lq73o0zmyqqz1x2",
    "pa": "ctrl-19lbnoq0dgocoh0tuxbok19o",
    "ppConsumed": 1,
    "paConsumed": 1,
    "ppFacts": 0,
    "paFacts": 0,
    "bodyStarted": "body-started\n",
    "requests": 4
  },
  "after": {
    "ppConsumed": 1,
    "paConsumed": 1,
    "ppFacts": [
      {
        "sequence": 32,
        "factType": "control-execution-result",
        "requestId": "ctrl-0mnvyk509lq73o0zmyqqz1x2",
        "callId": "call-c1-tc2n5j5i",
        "outcome": "unknown",
        "recordedAt": "2026-11-13T16:53:37.159Z",
        "createdAt": "2026-11-13T16:53:37.159Z"
      }
    ],
    "paFacts": [
      {
        "sequence": 34,
        "factType": "control-execution-result",
        "requestId": "ctrl-19lbnoq0dgocoh0tuxbok19o",
        "callId": "team-inst-13eyrjh0nadb-native-bash:hexec:nb-1794588812435-1317898764-1",
        "outcome": "unknown",
        "recordedAt": "2026-11-13T16:53:37.193Z",
        "createdAt": "2026-11-13T16:53:37.193Z"
      }
    ],
    "abandonments": [
      {
        "sequence": 33,
        "factType": "control-request-abandoned",
        "requestId": "ctrl-0mnvyk509lq73o0zmyqqz1x2",
        "reason": "execution-outcome-unknown",
        "createdAt": "2026-11-13T16:53:37.175Z"
      },
      {
        "sequence": 35,
        "factType": "control-request-abandoned",
        "requestId": "ctrl-19lbnoq0dgocoh0tuxbok19o",
        "reason": "execution-outcome-unknown",
        "createdAt": "2026-11-13T16:53:37.209Z"
      }
    ],
    "requests": 4
  },
  "restartOk": true,
  "booted": {
    "origin": "http://127.0.0.1:3188",
    "cookie": "dsh-auth-KtEvNIXqpKBGD_wc9uooBYC_rI3oXjz62fvqXirJuxU=v1.eyJ2ZXJzaW9uIjoxLCJhdXRob3JpdHkiOiIxMjcuMC4wLjE6MzE4OCIsImlzc3VlZEF0IjoxNzk0NTg4ODE3MTkxLCJleHBpcmVzQXQiOjE3OTcxODA4MTcxOTF9.VxxBM8ptyuh0SvtCN5ev6zyKs6DZc4C16lbMkHKYnvc",
    "host": {
      "child": {
        "_events": {},
        "_eventsCount": 2,
        "_closesNeeded": 1,
        "_closesGot": 0,
        "connected": false,
        "signalCode": null,
        "exitCode": null,
        "killed": false,
        "spawnfile": "/home/armourpiercer/.nvm/versions/node/v24.21.0/bin/node",
        "_handle": {
          "pid": 603
        },
        "spawnargs": [
          "/home/armourpiercer/.nvm/versions/node/v24.21.0/bin/node",
          "/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/apps/cli/lib/bin.js",
          "web",
          "--port",
          "3188",
          "--no-open"
        ],
        "pid": 603,
        "stdin": null,
        "stdout": null,
        "stderr": null,
        "stdio": [
          null,
          null,
          null
        ]
      },
      "exitInfo": {
        "exited": false
      },
      "logPath": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/dev/agent-workflow/evidence/v016-release-gate-20261114/joint-run1/instance.log"
    }
  },
  "mockRequestsAtKill": 2,
  "mockRequestsAfterRestart": 2,
  "samples": [
    {
      "at": "2026-11-13T16:53:32.564Z",
      "requests": 2,
      "last": [
        "parameter-permission:ctrl-10bcyw908dtd2k12cfdq71gm",
        "team-tool-execute:ctrl-0cnhwlz03fockk1ggtmlx1iw"
      ],
      "consumptions": 2,
      "mockRequests": 27,
      "bodyStart": false,
      "wakes": 6
    },
    {
      "at": "2026-11-13T16:53:32.816Z",
      "requests": 3,
      "last": [
        "team-tool-execute:ctrl-0cnhwlz03fockk1ggtmlx1iw",
        "parameter-permission:ctrl-0mnvyk509lq73o0zmyqqz1x2"
      ],
      "consumptions": 2,
      "mockRequests": 30,
      "bodyStart": false,
      "wakes": 7
    },
    {
      "at": "2026-11-13T16:53:33.068Z",
      "requests": 3,
      "last": [
        "team-tool-execute:ctrl-0cnhwlz03fockk1ggtmlx1iw",
        "parameter-permission:ctrl-0mnvyk509lq73o0zmyqqz1x2"
      ],
      "consumptions": 2,
      "mockRequests": 32,
      "bodyStart": false,
      "wakes": 9
    },
    {
      "at": "2026-11-13T16:53:33.320Z",
      "requests": 4,
      "last": [
        "parameter-permission:ctrl-0mnvyk509lq73o0zmyqqz1x2",
        "team-tool-execute:ctrl-19lbnoq0dgocoh0tuxbok19o"
      ],
      "consumptions": 3,
      "mockRequests": 34,
      "bodyStart": false,
      "wakes": 11
    },
    {
      "at": "2026-11-13T16:53:33.571Z",
      "requests": 4,
      "last": [
        "parameter-permission:ctrl-0mnvyk509lq73o0zmyqqz1x2",
        "team-tool-execute:ctrl-19lbnoq0dgocoh0tuxbok19o"
      ],
      "consumptions": 4,
      "mockRequests": 35,
      "bodyStart": false,
      "wakes": 12
    },
    {
      "at": "2026-11-13T16:53:33.822Z",
      "requests": 4,
      "last": [
        "parameter-permission:ctrl-0mnvyk509lq73o0zmyqqz1x2",
        "team-tool-execute:ctrl-19lbnoq0dgocoh0tuxbok19o"
      ],
      "consumptions": 4,
      "mockRequests": 35,
      "bodyStart": true,
      "wakes": 12
    }
  ],
  "membersAfterRestart": 6,
  "memberSurvived": true,
  "officerSurvived": true,
  "bodyStartAfter": "body-started\n"
}
```
