{
  "schema": "a1-bash-governance/1",
  "recordClass": "DEV-LIVE",
  "tree": {
    "branch": "HEAD",
    "productSha": "3a7303ca215d8544eb3f35c2785161a7bce7f85a",
    "masterTipAtRun": "3a7303ca215d8544eb3f35c2785161a7bce7f85a",
    "blueprintHash": "sha256:6ba2dd5562e4e36b0f4e672f0211b5e99e890a67d0ad2e2df99bcbadb6b17b84"
  },
  "composition": {
    "preset": "native",
    "mode": "a6-off",
    "blueprint": "schemaVersion: 5, memberIoCeilings + reviewRouting on ONE document",
    "planeTakeover": true,
    "alpha6ReviewRouting": false,
    "alpha6WakeIntentPathConfigured": false,
    "reviewRoutingBlocksInert": true,
    "approvalPath": "legacy Leader notification (durable [team-control] -> team_list_pending_control + team_resolve_control)",
    "governedRealm": true,
    "hostDefaultSandboxMode": "danger-full-access",
    "nativeBash": "the PINNED persistent bash over the governed PTY (cd/export persist; the plane adopts it and mounts no shell row)"
  },
  "counts": {
    "PASS": 7
  },
  "arms": [
    {
      "arm": "A1-1",
      "proposition": "a write INSIDE the Member root is allowed and its bytes are on disk",
      "verdict": "PASS",
      "detail": "path=WORKSPACE/a1-inside.txt exists=true size=40 bytesMatch=true toolSawExit0=true",
      "facts": {
        "file": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace/a1-inside-2026-11-13T18-19-17-h0-r51dd78.txt",
        "size": 40
      }
    },
    {
      "arm": "A1-2",
      "proposition": "a write OUTSIDE the Member ceiling is refused by the OS sandbox — zero bytes on disk",
      "verdict": "PASS",
      "detail": "path=DSH_HOME/a1-outside.txt exists=false size=0 readErr=ENOENT osSignal=bash: /home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/a1-outside-2026-11-13T18-19-17-h0-r51dd78.txt: Read-only file system\nA1_OUTSIDE_EXIT=1\n[Command finished with exit code 0]",
      "facts": {
        "file": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/a1-outside-2026-11-13T18-19-17-h0-r51dd78.txt",
        "statExists": false
      }
    },
    {
      "arm": "A1-3",
      "proposition": "the same Member keeps `cd` + `export` state across consecutive calls",
      "verdict": "PASS",
      "detail": "callA=[pwd=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace/a1-sub pid=2 tty=/dev/console] callB=[pwd=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace/a1-sub var=a1-value pid=2 file=persisted-2026-11-13T18-19-17-h0-r51dd78 tty=/dev/console] markerReadBack=true",
      "facts": {
        "stateA": "A1_STATE_1|/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace/a1-sub|2|/dev/console|120690425\n[Command finished with exit code 0]",
        "stateB": "A1_STATE_2|/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace/a1-sub|a1-value|2|persisted-2026-11-13T18-19-17-h0-r51dd78|/dev/console\n[Command finished with exit code 0]"
      }
    },
    {
      "arm": "A1-4",
      "proposition": "a second Member cannot see the first Member's PTY state (own cwd, no export, different shell pid)",
      "verdict": "PASS",
      "detail": "w1=[pwd=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace/a1-sub tty=/dev/console] w2=[pwd=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace var= tty=/dev/console] startTimeDiffers=true hostPtyFdsBefore=1 after=2 newPty=true w2SawFirstCwd=false w2SawFirstExport=false",
      "facts": {
        "w1": [
          "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace/a1-sub",
          "2",
          "/dev/console",
          "120690425"
        ],
        "w2": [
          "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/workspace",
          "",
          "2",
          "/dev/console",
          "120690912"
        ],
        "ptyCountGrew": true
      }
    },
    {
      "arm": "A1-5",
      "proposition": "a wrong or prefixed session id is refused BEFORE a PTY exists (no PTY fd, no turn, gate named)",
      "verdict": "PASS",
      "detail": "sufficedStatus=200 truncatedStatus=200 relayStatus=200 gate=session/not-found,session/not-found,TEAM_REMOTE_FOREIGN_TEAM allRefused=true ptyFdsBefore=2 ptyFdsAfter=2 turnsBefore=45 turnsAfter=45 quiesced=true precreationQuiesceMs=2004",
      "facts": {
        "gate": "session/not-found,session/not-found,TEAM_REMOTE_FOREIGN_TEAM",
        "ptyBefore": [
          "/dev/pts/ptmx",
          "/dev/pts/ptmx"
        ],
        "ptyAfter": [
          "/dev/pts/ptmx",
          "/dev/pts/ptmx"
        ],
        "windowTurns": [],
        "refusals": [
          "{\"type\":\"server-response\",\"rpcId\":\"c1-viuuyr8d92\",\"result\":{\"ok\":false,\"error\":{\"code\":\"session/not-found\",\"message\":\"session \\\"session-a1-root-2026-11-13T18-19-17-h0-r51dd78x\\\" not found\",\"details\":{\"sessionId\":\"session-a1-root-2026-11-13T18-19-17-h0-r51dd78x\"}}}}",
          "{\"type\":\"server-response\",\"rpcId\":\"c1-2orcaoij0o\",\"result\":{\"ok\":false,\"error\":{\"code\":\"session/not-found\",\"message\":\"session \\\"session-a1-root-2026-11-13T18-19-17-h0-r51dd\\\" not found\",\"details\":{\"sessionId\":\"session-a1-root-2026-11-13T18-19-17-h0-r51dd\"}}}}",
          "{\"type\":\"server-response\",\"rpcId\":\"a1-wrong-relay-9ejzqamjd9\",\"result\":{\"ok\":false,\"error\":{\"code\":\"TEAM_REMOTE_FOREIGN_TEAM\",\"message\":\"remote method 'member.send' addresses TeamSession 'session-a1-root-2026-11-13T18-19-17-h0-r51dd78x' which this host does not own (bound root 'session-c1-smoke-root-2026-11-13T18-19-17-h0-r51dd78')\",\"details\":{\"method\":\"member.send\",\"endpoint\":\"member.send\",\"contr"
        ]
      }
    },
    {
      "arm": "A1-6",
      "proposition": "with the Host default at danger-full-access the Member ceiling still narrows it (root writes, Member refused)",
      "verdict": "PASS",
      "detail": "hostDefault=danger-full-access rootWrite=bytes-on-disk rootFileBytes=41 memberOutsideFileAbsent=true memberRefusalProven=true",
      "facts": {
        "rootFile": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/a1-root-outside-2026-11-13T18-19-17-h0-r51dd78.txt",
        "memberFile": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T18-19-17-h0-r51dd78/a1-outside-2026-11-13T18-19-17-h0-r51dd78.txt"
      }
    },
    {
      "arm": "A1-7",
      "proposition": "a DENIED approval produces zero native bash executions (no marker, no fact, no bytes)",
      "verdict": "PASS",
      "detail": "legOwner=inst-1t4iwct1venh isDenyMember=true decision=deny executions=0 consumptions=0 bytesOnDisk=false requestId=ctrl-0kn9w5e10gmlvf0axjsck1e5 toolRefusal=Error: the approval was denied",
      "facts": {
        "requestId": "ctrl-0kn9w5e10gmlvf0axjsck1e5"
      }
    }
  ],
  "osLevelNetworkIsolationClaimed": false,
  "readScopeClaim": "none — this PTY path carries no PD-13 lexical read allowlist; read scope rests on the OS profile",
  "note": "DEV-LIVE: this record can never produce a V@B=yes or any frozen-candidate claim."
}