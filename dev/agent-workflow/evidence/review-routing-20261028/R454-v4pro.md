# R454 cross-family escalation recheck — PR #454 (R-AUDIT-DEPTH b1/b2/b3)

- **Seat:** dsh-opencode-go/deepseek-v4-pro (cross-family vs. effective implementer qwen3.8-flash-next). This restores the substance the flash seat could not supply; the flash seat itself disclosed its effective-route collapse and flagged the need for this seat. Prior report read: `.artifacts/reviews/R454-27b.md`.
- **Subject:** branch `task/u7r3-auditdepth-20261029` @ `fe8d315c7`, base `e0c60bc43` (verified via `git rev-parse origin/...` = fe8d315c7; merge-base = e0c60bc43). 3 files (src + dist mirror + audit test), +242/−30.
- **Method:** own detached worktree `.worktrees/rr-454v` (disclosed: `node_modules` is a symlink to the main checkout's install; `preserveSymlinks:true` + node:* only in the lane under test makes the two test files and the b1 probe immune to the cross-worktree hoist issues the flash seat hit). No merge/comment/push.

## (1) b1 — VERIFIED
`ledgerBytes` (src:466-479) now `fsp.lstat`s, answers `0` only for ENOENT, and throws typed `AGENT_STATE_STORE_LEDGER_UNREADABLE` for any non-regular name. My OWN probe (temp dir under /tmp, deleted, not committed), importing the worktree module directly:

| shape | result |
| --- | --- |
| absent (ENOENT) | 0 |
| regular 42 B | 42 |
| symlink → 64 KiB | THREW `AGENT_STATE_STORE_LEDGER_UNREADABLE` (target size never answers) |
| dangling symlink | THREW `LEDGER_UNREADABLE` |
| directory | THREW `LEDGER_UNREADABLE` |
| AF_UNIX socket (live) | THREW `LEDGER_UNREADABLE` |

Never followed, never answered as a size, never treated as absent. (First probe's socket row read `0` only because my script closed the server — unlinking the socket — before measuring; the live-socket re-probe throws as expected.)

## (2) b2 — VERIFIED, zero skips remain
`grep` over the audit test: no `isRoot` / `skipIf` / `chmodSync` / `getuid` tokens except the explanatory comment at line 35; the `isRoot()` helper is gone. The injection is `mkdirSync(writesPath())` (a directory at the ledger name): `lstat` answers it for every uid and the append open answers EISDIR for every uid (POSIX forbids opening a directory write-mode, root included) — privilege-independent by structure, not by chmod.

## (3) b3 — VERIFIED, no overclaim
The `appendLineIn` comment (src:408-424) claims exactly three things, each pinned 1:1 by the HL3 leg (test:254-305), and the code path is real (I traced it): (a) at-open-only — comment says `nlink===1` proves "NO ALIAS EXISTED AT OPEN TIME" and disclaims the post-open window; test opens the fd, fstats nlink===1, THEN `linkSync` post-open. (b) link(2) EEXIST direction — comment says "link(2) refuses an existing target (EEXIST)"; test asserts `refused.code === 'EEXIST'` and the pre-existing file stays byte-unchanged. (c) next append — `appendLineIn` fstats its own fd (src:433), sees nlink 2, throws `AGENT_STATE_STORE_ALIAS_REFUSED` → `shortErrorCode` → `write.audit` → `r.audit`; test asserts `toEqual({ status:'UNCONFIRMED', error:'AGENT_STATE_STORE_ALIAS_REFUSED' })` and the aliased name stopped growing. No claim in the comment exceeds what the leg asserts.

## (4) DIST — VERIFIED
`node scripts/check-artifacts-at-head.mjs` in the worktree → `verdict=ok compared=1883 drift=0` (HEAD carries its own build). Spot-check: dist mirror carries `fsp.lstat` (469) + `!stat.isFile()` (474) + the append nlink check (434-435).

## (5) Tests — VERIFIED by me
`vitest run u7-agentstate-fs-store-audit.test.ts u7-agentstate-fs-store-c1.test.ts` → **2 files passed, 59/59** = audit **9/9** + c1 **50/50**.

## Wording note (prior seat, non-blocking) — CONCUR
"no external bytes smuggled in" holds for link(2) proper (EEXIST on an existing target; a hardlink only ever adds a name for OUR inode). unlink+link / rename of a single-name inode is a name-swap inside the trusted directory — the directory-trust premise the module header declares (CONTAINMENT ON EVERY OPERATION, src:26-36) — not a gap the comment hides. The comment is explicitly scoped ("a hardlink creates… link(2) refuses…"). Accurate, non-blocking.

## Verdict: **APPROVE**
No blocking findings. b1 is a strict honest-absent tightening (lstat + regular-file only), b2 removes the root blind spot with a privilege-free injection, b3 documents-and-pins the residual window with zero overclaim, dist is in sync (drift=0), and both suites are green under my own runs.
