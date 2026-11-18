```json
{
  "schema": "dsh-boot-preflight/1",
  "generatedAt": "2026-11-13T15:12:11.920Z",
  "selectedArms": [
    "A1-1",
    "A1-2",
    "A1-3",
    "A1-4",
    "A1-5",
    "A1-6",
    "A1-7"
  ],
  "knownArms": [
    "A1-1",
    "A1-2",
    "A1-3",
    "A1-4",
    "A1-5",
    "A1-6",
    "A1-7"
  ],
  "verdict": "PASS",
  "reason": "every check passed",
  "counts": {
    "PASS": 10,
    "FAIL": 0,
    "NOT_REACHED": 0,
    "NOT_SELECTED": 0,
    "UNSUPPORTED": 0,
    "ENV_BLOCK": 0
  },
  "checks": [
    {
      "id": "arms.selection",
      "arm": null,
      "state": "PASS",
      "detail": "selected=[A1-1, A1-2, A1-3, A1-4, A1-5, A1-6, A1-7]"
    },
    {
      "id": "env.required",
      "arm": null,
      "state": "PASS",
      "detail": "0 required env var(s) present"
    },
    {
      "id": "host.pin",
      "arm": null,
      "state": "PASS",
      "detail": "host 639ed0153972 (dirtiness not measured)"
    },
    {
      "id": "candidate.sha",
      "arm": null,
      "state": "PASS",
      "detail": "candidate 1f31539bde83 matches DEV-LIVE branch head (not a frozen candidate)"
    },
    {
      "id": "modality.text",
      "arm": null,
      "state": "PASS",
      "detail": "text supported"
    },
    {
      "id": "modality.tool-call",
      "arm": null,
      "state": "PASS",
      "detail": "tool-call supported"
    },
    {
      "id": "officer.count",
      "arm": "A1-6",
      "state": "PASS",
      "detail": "exactly one live Officer"
    },
    {
      "id": "port.13020",
      "arm": null,
      "state": "PASS",
      "detail": "13020 free (loopback)"
    },
    {
      "id": "port.13070",
      "arm": null,
      "state": "PASS",
      "detail": "13070 free (loopback)"
    },
    {
      "id": "world.dsh-home",
      "arm": null,
      "state": "PASS",
      "detail": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a6-cold-wake-nudge-20261113/tests/homes/c1-smoke-2026-11-13T15-12-06-h0-rd45bb3 (fresh world, not yet created)"
    }
  ],
  "blocking": [],
  "skipped": [],
  "startAllowed": true
}
```
