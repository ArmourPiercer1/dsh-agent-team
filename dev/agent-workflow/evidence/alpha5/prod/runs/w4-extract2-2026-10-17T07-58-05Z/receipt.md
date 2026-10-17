# pb W4-extract-2 re-run receipt — 2026-10-17T07-58-05Z

- base: worktree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pb-pr45` @ branch alpha5-prod-pr45
- launcher (tracked source copy; dist carries no .py — disclosed): `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pb-pr45/packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`
- build dist (gitignored build product under tests/homes, NOT a world): `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pb-pr45/tests/homes/.pb-w4x-build-2026-10-17T07-58-05Z`
- world (fixtures/scratch): `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-pb-pr45/tests/homes/a5pb-w4x-2026-10-17T07-58-05Z`
- criteria: 7/7 PASS

- [x] **PB-BUILD** — runtime tsconfig.build.json emits the provider lane to the build dist (public barrel importable) (rc=0)
- [x] **PB-R1-W4-POS-SPAWN** — extracted W4 criterion 1 (POS spawn) via assembly.launcherPath/launcherSha256/minAbiVersion: provider ok, launcher rc=0, payload pid real, lease terminated (rc=0 pid=29 lease=terminated offeredMismatch=0)
- [x] **PB-R1-SPILL-MATCH** — extracted W4 spill observation: provider read-back matches the ALLOWED fixture content (bytes=41)
- [x] **PB-R1-NO-ARGV-REWRITE** — NEW assembly-face claim: every launcher call was OFFERED the trusted path (the W4 spy rewrite workaround is no longer needed): offered==trusted, rewritten=false (runs=5 mismatch=0)
- [x] **PB-R2-W4-NEG-MISSING** — extracted W4 criterion 2 (缺件 class) via assembly.launcherPath: launcher absent → SANDBOX_UNAVAILABLE typed with ZERO confined-exec; preflight rows recorded as precondition probes (no kernel wording) (code=SANDBOX_UNAVAILABLE confinedExec=0)
- [x] **PB-R3-SHA-GATE** — launcher sha 校验路径 (regression): a PIN MISMATCH at the configured path refuses SANDBOX_UNAVAILABLE through the integrity gate before ANY launcher invocation (zero probe legs, zero spawn) (code=SANDBOX_UNAVAILABLE runs=0)
- [x] **PB-PORT-3183-IDLE** — port 3183 proven IDLE before and after (bind test + ss): this provider-face re-run booted no host and touched no 3180-family port (ss -ltnp: no listener on :3183)

Ledger: ledger.jsonl (8 rows)
