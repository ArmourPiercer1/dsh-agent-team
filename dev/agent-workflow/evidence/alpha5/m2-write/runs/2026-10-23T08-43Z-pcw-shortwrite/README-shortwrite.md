# M2-WRITE-01 — short-write blocking fix (root review `bce6173a` round)

Blocking item (single `handle.write` ignored `bytesWritten`) fixed with the
minimal delta; zero commits, zero push, zero Host.

## What changed (delta only)

`packages/runtime/controlled-fs/src/post-consume-write.ts`
1. The write now LOOPS until the full UTF-8 length has landed:
   `Buffer.from(content,'utf8')`, cumulative `bytesWritten`, offset advances,
   `bytesWritten <= 0` (no-progress) is treated as a failure. Success is
   reported ONLY after every byte landed.
2. Any failure/stall inside that loop (post-truncation ⇒ partial bytes may
   have landed) returns the EXISTING law verbatim:
   `cfsUndetermined('write-side-effect-unconfirmed', { sideEffectPossible: true })`
   — never success, never "zero side effect".
3. Header name-vs-code fixes (wording follows the CODE, not the reverse):
   the P2 line previously read `O_WRONLY | O_CREAT | O_NOFOLLOW` (early
   wording drift) — now states the true `O_WRONLY | O_NOFOLLOW`, NO O_TRUNC,
   NO O_CREAT. The `zero O_CREAT` claim and the construction-violation
   `TypeError` sentence WERE checked against the code and ARE accurate
   (grep: no `O_CREAT` in any open call; TypeErrors are construction-only —
   the docs never claimed extra ARGUMENTS throw; the zero-arg law is
   `write.length === 0`, pinned by leg T-P1).
4. Maintained-scope wording added (no implementation change): new-file path
   stays HELD pending the root ruling; the real final-edge ASSEMBLY is
   unproven/unwired in this commit (no production path creates the
   closure yet); the root/FD helper windows ride a RESTRICTED deployment
   under the governed root — NOT physical safety for an arbitrary mutable
   directory tree.

`packages/runtime/test/a5m2-post-consume-write-c1.test.ts` — three new legs:

## Short-write case assertions (verbatim outcomes in `c1-shortwrite.raw`)

- **T-C3 TRUE short write** — `FileHandle`'s prototype is intercepted through
  a REAL handle instance (Node 24 exports no `FileHandle` class by name;
  `handlePrototype()` takes `Object.getPrototypeOf(await open(...))` — the
  same prototype the closure's handle uses; not a mock counter): round one
  performs a REAL half-length write through the genuine syscall, round two
  throws EIO. Asserted: ① `r.ok === false` (no success while plan bytes
  have not all landed); ② `error.code === 'EXECUTION_TERMINATION_UNCONFIRMED'`,
  `cfReason === 'write-side-effect-unconfirmed'`, `sideEffectUnknown === true`;
  ③ the file on disk holds EXACTLY the 8 bytes that really landed
  (`landed.length === 8`, `'AAAABBBB'` — truncation + partial content proved,
  not claimed); ④ the interception was hit exactly twice.
- **T-C4 loop completion** — every `write` capped at 6 real bytes for a
  20-byte payload: success ONLY with `landed.length === Buffer.byteLength
  (content,'utf8')` and exact content (the loop, not one-call luck).
- **T-C2 multi-byte success leg** — content `héllo — 世界 🌍 multi-byte ✓`
  (non-ASCII, 4-byte codepoints): success asserts byte count equals the
  UTF-8 length and the fingerprint equals `sha256:<hex>` of the content.

## Gates (real rc, raw in this dir)

- vitest `packages/runtime/test/a5m2-post-consume-write-c1.test.ts`:
  **16/16, RUNNER_EXIT=0** (`c1-shortwrite.raw`).
- combined run incl. the controlled-fs lane suites: 5 files, **58/58 passed**.
- `tsc -p packages/runtime/controlled-fs/tsconfig.lane.json`: **EXIT=0**.
- scoped `tsc` over exactly my two files (runtime compilerOptions):
  **EXIT=0** (`tsc-scoped-mine.txt`).
- full `tsc -p packages/runtime/tsconfig.json`: **EXIT=2 — NOT from my
  files**: both errors are `packages/runtime/web-gateway/src/index.ts`
  (`Cannot find name 'sig'` ×2, another card's WIP; verbatim in
  `tsc-runtime.txt`). Disclosed, not touched.
- eslint on both my files: **EXIT=0**. audit: **EXIT=0** (module listed,
  no FINDING).
- `git status --porcelain` at capture: `git-status.txt`.
