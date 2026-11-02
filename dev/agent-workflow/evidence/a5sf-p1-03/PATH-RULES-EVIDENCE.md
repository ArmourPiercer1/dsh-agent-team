# P1-03 · authorized paths, hardlink/symlink semantics, Provider capability gate

- **Task**: P1-03 (Gate **G1.3**) of `docs/plans/memo/alpha5-sandbox-first-20261101/IMPLEMENTATION-PLAN.md`.
- **Branch/worktree**: `task/a5sf-p1-01-20261102` @ `.worktrees/a5sf-p1-01`.
- **Lane**: `packages/runtime/member-io-policy/src/{path-rules.ts,provider-capabilities.ts}`.
- **Tests**: `packages/runtime/test/a5sf-path-rules.test.ts` — **27/27**; lane total incl.
  P1-02 regression **43/43** (`green-tests.log`), `tsc -p packages/runtime/tsconfig.json` rc=0.

## 1. Laws pinned (real filesystem where the law is about the filesystem)

| Law | Test fact |
|---|---|
| an allow locator is a **subtree root** | `/work/a` covers `/work/a/x`; **not** `/work/ab` |
| comparison-only normalization | trailing `/`, `.`/`./` and `\` separators normalize for matching only; `..` never folds |
| disposition order | deny > ask > allow; absence of allow = deny |
| **symlink escape** | authored-inside → resolved-outside is `deny` `PATH_SYMLINK_ESCAPE` (leaf and symlinked-parent); a symlink resolving inside stays allowed |
| **hardlink alias** | one inode with two names (`ino` equal, `nlink === 2`): allowed through the authorized path, `PATH_NOT_ALLOWED` through the outside path. The old `controlled-fs` `nlink===1` rule is **retired for the Member data plane only** (control-plane integrity untouched) |
| write target not yet created | resolves through the parent realpath; an escaping parent still denies |
| resolution failure | `unsupported` `PATH_RESOLUTION_UNSUPPORTED` (fail closed, never allow) |
| native write/edit needs read | `write` allowed + `read` denied ⇒ `WRITE_REQUIRES_READ`; `ask` is never a read; write outside the write axis ⇒ `WRITE_TARGET_NOT_WRITABLE` |
| Provider capability gate | closed 12-method `ctx.fs` vocabulary (`resolve/contains/stat/lstat/readText/streamText/readBytes/readByteRange/listDir/watch/writeText/editText`); a missing method is a typed `unsupported` naming **every** missing method; no "all read" degrade, no raw Node fs fallback; unknown extra methods never help; a non-function slot counts as missing |

The path guard is **injectable** (`PathIdentityResolver`, default `node:fs/promises`), so
the same law is testable with a fake resolver and the disk.

## 2. What this does NOT claim

- It does not decide *whether a Provider's own path semantics match*: it consumes the
  resolver the deployment injects. A deployment that injects a resolver that lies gets
  a lying answer — that is the Trusted-Realm boundary, disclosed, not hidden.
- `realpath !== path.resolve(authored)` is used as the "aliased/symlinked" signal. On a
  case-insensitive filesystem a case-only difference would be labelled
  `PATH_SYMLINK_ESCAPE`; the DECISION is still fail-closed deny, only the label is coarse.
- A write whose parent directory does not exist is `unsupported` rather than allowed: the
  guard refuses to guess where a not-yet-created tree will land.
- Method presence is checked, not per-method behavior or per-scope binding — that is
  P1-05 (service identity) and P1-07 (OS effect).

## 3. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/runtime/test/a5sf-path-rules.test.ts
```
