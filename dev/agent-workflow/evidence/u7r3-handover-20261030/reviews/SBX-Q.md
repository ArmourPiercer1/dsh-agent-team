# SBX-Q

**Answer: FALSE.**

Evidence does not establish that this machine cannot sandbox native workspace-write bash. The main native launcher resolves to an existing executable and probes `partial`; the worktree result is `unusable` because that worktree has no `landlock-run` binary, while the main checkout does. The direct bubblewrap probe failed because unprivileged user namespaces are unavailable, but that is only the bwrap backend and does not negate the available native launcher. Recorded Jobs evidence independently reports `landlock-run: partial enforcement (older Landlock ABI)`. Therefore the stated implication that the Jobs native control-plane leg cannot run here is unsupported/false (with partial enforcement caveat).

## Command outputs (trimmed)

1.
```text
MAIN /srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run partial
```

2.
```text
WT /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-g4r2/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run unusable
```

3.
```text
/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/:
total 52
-rwxr-xr-x 1 user user 38552 Oct  1 12:31 landlock-run
/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-g4r2/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/:
total 12
```

4.
```text
.gitignore:12:tests/deepseek-harness-test-use/ tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run
```

5.
```text
Error: sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined.
... bwrap: No permissions to create new namespace, likely because the kernel does not allow non-privileged user namespaces.
```

6.
```text
54:  "ctlResult": "U74A_CTL_CLAIM_u5u74a-20261026t11-57-55z\n[stderr]\nlandlock-run: partial enforcement (older Landlock ABI)\n",
```
