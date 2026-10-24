# A5-M2 FS-PROC — bounded raw-bytes read kernel (C1) — evidence

Date: 2026-10-23 (UTC). Owner: FS binary-read kernel implementation owner (Alpha.5 M2).
Verification tree: `.worktrees/a5-m1-kernel` @ branch `feat/a5-m1-center-kernel`.
Zero commit / zero push / zero mount / zero merge; `:3080` untouched; no Host-world runs.

## Deliverables (exactly two NEW files — nothing else created or modified)

1. `packages/runtime/controlled-fs/src/bounded-bytes-read.ts` — sole export
   `readBoundedBytes(handle, { maxBytes, signal?, chunkBytes? })`.
2. `packages/runtime/test/a5m2-fs-bounded-read-c1.test.ts` — real temp files, real fds
   (`fsPromises.open` in the TEST only), 12 cases pinning legs ①–⑦ plus a structural
   law check (T8).

`index.ts` export registration is CENTER's (not touched, per hard constraint). Census
registration intentionally NOT done here (CENTER owns it) — file paths handed back instead.

## Gates (real rc, `set -o pipefail`, rc also landed in `rc.txt`)

| gate | command | rc |
| --- | --- | --- |
| unit | `pnpm exec vitest run packages/runtime/test/a5m2-fs-bounded-read-c1.test.ts` | **0** — 12 passed / 12 (repeated 4× total incl. `--reporter=verbose`: rc 0 each, race legs T6b/T6c stable) |
| typecheck | `pnpm --filter @dsh-agent-team/runtime run typecheck` | **0** (baseline run before my files: rc 0 too — tree was tsc-clean; no errors anywhere, hence none in my files) |
| lint | `pnpm exec eslint packages/runtime/controlled-fs/src/bounded-bytes-read.ts packages/runtime/test/a5m2-fs-bounded-read-c1.test.ts` | **0** |

Raw logs: `vitest-c1.log` (verbose list of the 12 named cases), `typecheck.log`, `eslint.log`.

## Law provenance

- Ring law copied item-for-item from the M1-proven read-row loop
  (`packages/runtime/src/plugin/live/plane-effect-backends.mjs:1466-1475`, read-only
  reference, NOT modified): `while (total < maxBytes + 1)`; `want = Math.min(chunkBytes,
  maxBytes + 1 - total)`; `bytesRead === 0` → break; cumulative judgement = ACTUAL
  `bytesRead`.
- Cap is FACT not refusal: kernel stops at `maxBytes + 1` and returns observed
  `byteLength`; refusal wording stays at call-sites (`read-too-large` row /
  `READ_TOO_LARGE` image arm, `governed-families/image.mjs:449-484`).
- New per-chunk cooperative cancellation law (`FileHandle.read` takes no AbortSignal):
  `signal?.aborted === true` before EVERY chunk ⇒ `{ ok:false, kind:'cancelled',
  byteLength }` with the observed count.
- `chunkBytes` default `65536` (same numeric value as READ_ROW_CHUNK_BYTES, own constant,
  no cross-import).
- Kernel: zero path / zero open / zero realpath-stat / zero utf8 decode / zero ledger /
  zero global state; `bytes` carries exactly the observed bytes (per-chunk copy out of a
  reused scratch, exact-size concat — never a preallocated buffer's trailing zeros).

## Leg → test map (assertions verbatim in the test file)

- ① T1: byte-exact vs source incl. non-utf8 binary; fatal-utf8 probe over the source
  throws → byte-equality proves raw fidelity; `bytes.length === 1000` (not cap+1, not
  scratch size).
- ② T2: `==cap` ⇒ `byteLength === 1024`.
- ③ T3: `==cap+1` ⇒ `ok:true`, `byteLength === 1025`, bytes equal the WHOLE file
  (nothing truncated); stop-itself pinned by T4.
- ④ T4: 65543-byte file vs cap 1024 ⇒ exactly `1025`; prefix-equal; sha differs from
  whole file (stopped, not slurped); source file untouched.
- ⑤ T5: 9-byte file, cap 10, chunk 4 ⇒ 4+4+1(actual short read)+0(EOF probe) ⇒
  `byteLength === 9`; requested-based counting would falsely answer 11 > cap.
- ⑥ T6a pre-aborted ⇒ `byteLength 0`; T6b getter signal flips at 4th check ⇒ cancelled
  with EXACTLY 12 observed bytes; T6c real `AbortController` aborts a 60001-byte ring
  mid-stream ⇒ cancelled, honest partial count (chunk-quantum multiple, < 60001);
  T6d non-aborted signal (plain object + real AbortSignal) changes nothing.
- ⑦ T7: chunk 1000 vs ring 5001 ⇒ 5×1000+1 = 5001 exact; T7b default 65536 chunk vs
  ring 100001 ⇒ 65536+34465 = 100001 (cap+1) across the default-chunk boundary.
- T8 (structural, comment-stripped source): exactly one `export`; the only `import` is
  the erased `import type { FileHandle }`; code matches none of
  open/realpath/stat/path/utf8/TextDecoder/Buffer/toString/consume/ledger/grant/refus/
  TOO_LARGE/code/detail/drift; every `ok: false` site is the `kind: 'cancelled'` arm.

## NOT_PROVEN (disclosed, not claimed)

1. Non-EOF mid-file short reads cannot be forced on regular files with real fds on this
   platform — ⑤ exercises the genuinely short reads the OS returns (partial final chunk +
   zero-byte EOF probe), not a mocked short read.
2. Port-layer validation depth (grantRef handling, same-FD re-anchor, O_NOFOLLOW,
   `observedKind`, verbatim `ok:false` pass-through toward `TARGET_NOT_A_FILE` /
   `READ_TOO_LARGE`) is CENTER's port/call-site law — out of scope here, unproven here.
3. win32 behaviour not exercised (Linux only).
4. An abort landing DURING a syscall is honoured at the next check boundary only
   (cooperative law); in-flight syscall timing is not (and cannot be) proven here.
5. Non-regular fds (FIFO/pipe short-read rhythm) not exercised — outside the governed
   regular-file target this kernel serves.

## Side-effect audit

`git status --porcelain`: the only tree changes attributable to this round are the two
`??` new files above. `git diff` for `controlled-fs/src/index.ts`,
`controlled-fs/src/controlled-fs.ts`, `plane-effect-backends.mjs`, and
`governed-families/**` is EMPTY (others' in-flight files untouched, unstashed,
unreverted). Test worlds live under `tests/homes/a5m2fsbr-<runId>` (gitignored) and are
`rmSync`-removed in `afterAll`.
