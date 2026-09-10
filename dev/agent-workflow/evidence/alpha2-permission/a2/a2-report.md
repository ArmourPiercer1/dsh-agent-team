# A2 (alpha.2) — canonical operation + exact fingerprint — task report

Branch: `task/alpha2-a2-canonical-operation` (base `3aa6838`, worktree
`.worktrees/alpha2-a2`). TaskDoc: alpha.2 detailed plan §7 (A2) / §14
(boundary) / §17 (DoD).

## Deliverables

| Artifact | Path |
| --- | --- |
| Module core (4 files) | `packages/runtime/operation-permission/{types,errors,canonical-operation,index}.ts` |
| Unit spec (fake resolver, plan §7.6 full list) | `packages/runtime/test/a2-canonical-operation.test.ts` |
| Real-backend spec (test-use fs-local) + type surface | `packages/runtime/test/a2-canonical-operation-realfs.mjs` / `.d.mts` |
| Build wiring (mechanical, 1 line) | `packages/runtime/tsconfig.build.json` `include` += `operation-permission` |
| Committed dist (rebuilt) | `packages/runtime/dist/packages/runtime/operation-permission/**` (16 files) |
| p4t6 pin (DEC-1) | `packages/testkit/test/p4t6-session-event-scan.test.ts` 642 → **659** |

CORE PATCH BUDGET = 0: zero upstream edits; `references/` byte-clean
(verified at start and end: test-use HEAD `a66e470204`/rc.1 baseline,
porcelain empty).

## Export surface (what A3/A5 consume)

Module: `packages/runtime/operation-permission/index.js`
(dist mirror: `packages/runtime/dist/packages/runtime/operation-permission/index.js`).

Functions:
- `canonicalizeOperation(input: CanonicalizeOperationInput): Promise<CanonicalOperation>` —
  the canonicalization entrypoint (fail-closed typed throw).
- `classifyPermissionTool(name: string): PermissionToolClass` — the closed
  three-way class `{kind:'file',tool} | {kind:'tool-level',tool:'bash'} |
  {kind:'unsupported'}`; A5 calls this FIRST and may `next()` on
  `unsupported` without entering the resolver (plan §7.5).
- `isPermissionToolName(name: string): boolean` — closed-six membership.
- `isOperationPermissionError(value): value is OperationPermissionError`.
- `canonicalizationFailed(tool, reason, context?)` — internal-failure
  constructor (exported for A5's error mapping convenience).
- `toCanonicalizationDetail(value): RemoteSafeJsonValue` — lossless-JSON
  detail coercion (re-exported contracts helper).

Types:
- `CanonicalOperation { tool: PermissionTool; resource: CanonicalResource;
  fingerprint: string }`.
- `CanonicalResource { kind: 'file'|'tool'; key: string; display: string }` —
  `key` = opaque authority identity (never parse/normalize/transform);
  `display` = UI/debug only, never in the fingerprint.
- `PathTargetResolver = (path: string) => Promise<{key: string; display: string}>`
  — the injected seam (A5 wraps `ctx.fs.resolve(path, { cwd: sessionCwd,
  signal })` and unbrands `FsTarget.targetKey`).
- `PermissionTool`, `FilePermissionTool`, `ToolLevelPermissionTool`,
  `PermissionToolClass`.
- `OperationPermissionError` (`.code`, `.details?`),
  `OperationPermissionErrorCode`, `CanonicalizationFailureReason`.

Constants (closed vocabularies + normalization):
- `OPERATION_PERMISSION_ERROR_CODES = { OPERATION_CANONICALIZATION_FAILED }`
  + `OPERATION_PERMISSION_ERROR_CODE_VALUES`.
- `CANONICALIZATION_FAILURE_REASONS` (21 closed reasons — file-path /
  per-tool arg-shape / resolver / tool-unsupported).
- `PERMISSION_TOOL_VALUES` (six), `FILE_PERMISSION_TOOL_VALUES` (five).
- `READ_OFFSET_DEFAULT = 1`, `READ_LIMIT_DEFAULT = 2000`,
  `LSP_OPERATION_VALUES` (four, mirrored from upstream tool-lsp),
  `BASH_TOOL_RESOURCE_KEY = 'bash'`.

A1 import-swap note: `PermissionTool` is a LOCAL alias of the A1
blueprint type (A1 defines the identical union in
`packages/domain/blueprint` on its parallel branch; A2 must not depend on
that branch — plan §6.2). A3/A5: once A1 merges, import `PermissionTool`
from the A1 module and retire (or re-export) this alias; the two
definitions must never diverge.

## Design decisions (documented per plan §7)

1. **Effective `read` window** (`{tool, resourceKey, offset, limit}`):
   `offset ?? 1`, `limit ?? 2000`. The fixed 2000 = the upstream
   `tool-fs` `readLimit` config default (`READ_LIMIT`,
   `packages/fs/tool-fs/src/read.ts`) — a DOCUMENTED fixed constant, NOT
   the live deployment cap (plan §7.3: "document which"). Consequence:
   omitted-limit calls canonicalize identically across deployments.
   Residual (documented): a deployment with a non-default `readLimit`
   sees an omitted-limit read fingerprint-equal to an explicit
   `limit: 2000` read even though the tool would read a different number
   of lines there. A present-but-invalid offset/limit (not a positive
   integer — the tool would reject it) FAILS CLOSED: a doomed call has no
   effective window, and canonicalization of a doomed call can never
   collide with a live call (at pre-execute the call is not yet schema-
   validated).
2. **Resolver-injection shape**: `PathTargetResolver` is a plain
   `(path) => Promise<{key, display}>` closure — the module has NO
   `node:` imports, NO upstream `@deepseek-ai/*` imports, NO
   `process.cwd()`, and the signal/cwd binding happens in A5's closure.
   This keeps the module unit-testable (deterministic fake) and
   backend-agnostic (any FsTarget shape works). The raw `file_path` is
   passed UNMODIFIED (pinned by test: the resolver receives `./a/b`,
   `a\b`, `/workspace/a/../a/b` verbatim).
3. **Over-strictness = the tool's own validation**: args the tool would
   reject (whitespace file_path; write content non-string; edit
   old_string empty / old===new / non-boolean replace_all; lsp
   unknown operation / non-positive-integer line/character) fail closed
   with the closed reason vocabulary. Rationale: at pre-execute the
   arguments are not yet schema-validated, and "values the tool would
   reject have no effective value".
4. **Per-tool projections** (plan §7.3, fingerprint input via
   contracts `canonicalJsonStringify` + domain/blueprint `sha256Hex`):
   read `{tool, resourceKey, offset, limit}`; read_image
   `{tool, resourceKey}`; write `{tool, resourceKey, contentHash}`
   (`'sha256:'+hex` — content never persisted); edit `{tool, resourceKey,
   oldHash, newHash, replaceAll}` (replaceAll defaulted false, the
   tool's own default); lsp `{tool, resourceKey, operation, line,
   character}` (RAW one-based model coordinates — the tool's 1→0-based
   conversion is bijective, so model coordinates fully determine the
   operation; documented); bash `{tool}` (command string deliberately
   excluded — plan §4/§7.3).
5. **Fingerprint**: `'sha256:' + sha256Hex(canonicalJsonStringify(projection))`
   — deterministic, key-sorted stable JSON, no timestamp/random/display
   (plan §7.4). Shape pinned by test: `sha256:` + 64 lowercase hex.
6. **Fail-closed contract** (plan §7.5): `OperationPermissionError` with
   closed code `OPERATION_CANONICALIZATION_FAILED` + closed
   `details.reason` (21-value vocabulary) + lossless-JSON context. A5
   maps it to a `deny` PreToolDecision — never `next()`. Argument
   validation runs BEFORE the resolver call (zero backend round-trips for
   doomed calls — pinned by test).
7. **Windows emphasis** (plan §7.6): ALL path semantics (separator
   normalization, case, relative-vs-absolute, `..`, symlink/junction)
   are owned by the resolver seam; the module defines none itself. The
   real-backend spec pins the upstream contract (below).

## Tests

Command (repo standard): `node scripts/run-tests.mjs runtime` (and
`... testkit`). Vitest cross-check: `pnpm exec vitest run
a2-canonical-operation` in `packages/runtime`.

- `a2-canonical-operation.test.ts`: **30/30 pass** (plain-node shim AND
  vitest). Covers the full plan §7.6 minimum: same spellings → same key
  (relative / backslash / absolute-with-`..`; raw-path pass-through
  pinned); different file → different key; write same file ± content →
  same/diff fingerprint; edit old/new/replaceAll → fingerprint changes
  (omitted replace_all == false pinned); read offset/limit → fingerprint
  changes (omitted == explicit 1/2000 pinned); display change → same
  fingerprint (authority ≠ display); malformed path/args/seam → 18
  typed-fail-closed cases with closed reasons; bash tool-level (resolver
  never called; command excluded); unsupported-tool classification +
  typed failure (resolver never called); fingerprint determinism
  (byte-identical, shape check); projection display-free.
- `a2-canonical-operation-realfs.mjs` (real `@deepseek-ai/dsh-fs-local`
  from the pristine test-use checkout, temp dir under `os.tmpdir`,
  created/destroyed in-place; never-throwing → `{available:false,reason}`
  degradation on environments without the test-use build):
  **available=true** on this host — relative/absolute/forward-slash/`..`
  all → identical key; **case semantics pinned**: NTFS case-insensitive,
  `casefile.txt` → key of `CaseFile.txt` while the display keeps the
  input case (display ≠ authority, live proof); **directory junction
  pinned**: `jlink/g.txt` → same key as `sub/g.txt`; file symlink
  skipped with `EPERM` (Windows file-symlink privilege — recorded, not
  fatal); absent-file identity stable across `..` spellings, distinct
  for different files.

## Baseline parity (pre-existing failures IDENTICAL to 3aa6838)

`node scripts/run-tests.mjs runtime` at 3aa6838 vs after A2 (file-level
diff, logs in this directory):

- BEFORE: 6 failing files — d1-member-base-tools (3/6), d1-s6-remote-v3
  (6/14), d1-team-ownership-index (5/16), d2-s6-ensure-root-live (5/10),
  d3-member-identity-context (1/5), d5-instance-contract (2/9) — then the
  runner CRASHES at d5 (top-level `toHaveLength` outside the shim surface
  → process exit "Node.js v24.20.0"); files after d5 never run.
- AFTER: the SAME six failing files with the SAME counts, the SAME crash,
  plus exactly one new line: `PASS packages\runtime\test\a2-canonical-
  operation.test.ts (30 tests)`. No other diff.
- testkit: BEFORE 1 failure (p4t6 pin 642 vs actual 652 — stale); AFTER
  **exit 0, all 15 files pass** (pin updated to 659, see below).

## p4t6 pin (DEC-1)

642 → **659** = 642 + 10 + 7. The pin was stale at the 3aa6838 tip: the
alpha.1 T1-T4 capability work merged after the repair-r1 pin commit
`5bcb4b6` added TEN scannable files without recording the increment
(domain/policy static-capability-source + t1 spec; agent-setup
capability mcp-adapter/skill-adapter/skill-catalog + t3/t4a specs;
tools tool-selector/builtin-deny + t2 spec). A2 adds SEVEN
(operation-permission 4 module .ts + a2 test .ts + realfs .mjs + .d.mts).
Only the pin value + the `it` title + an explanatory comment changed
(scanner `.mjs` byte-unchanged; quarantine hit set unchanged at 15;
required-suite lists untouched). Independently re-verified: the
committed scanner's own run reports 659/659 and its file list names
exactly the seventeen files.

## Deviations from the literal task list

1. `packages/runtime/tsconfig.build.json` `include` +=
   `operation-permission` — the ONE mechanical build-wiring file outside
   the new module dirs (without it the module is absent from committed
   dist, breaking A5's dist import and the artifact check's intent).
   One line; flagged here per the red-line discipline.
2. The realfs spec is a `.mjs` + `.d.mts` pair (repo precedent:
   t12a-live-bridge, p7t5-no-creation-scan, file-seam) rather than a
   `.ts` file: the test-use prebuilt lib is imported by absolute file URL
   and the helper uses `node:` builtins — the established pattern for
   node-side test helpers.
3. A transient dev convenience script `scripts/dev-run-a2.mjs` was used
   for single-file iteration and DELETED before commit (not part of the
   committed surface).
4. Test file name: `a2-canonical-operation.test.ts` (the task suggested
   `a2a-canonical-operation.test.ts`; `a2-` chosen to match the task id
   and sort before the d1/d2/d3/d5 baseline files so it runs first under
   the plain-node runner).

## Verification summary

- `pnpm --filter @dsh-agent-team/runtime typecheck` → exit 0.
- `npx eslint` (new module + specs) → exit 0.
- `node scripts/run-tests.mjs runtime` → baseline + 1 PASS line (see
  parity above); `node scripts/run-tests.mjs testkit` → exit 0.
- `pnpm exec vitest run a2-canonical-operation` (runtime) → 30/30.
- `pnpm --filter @dsh-agent-team/runtime build` → exit 0; dist diff =
  exactly the new 16 `operation-permission` files (nothing else touched).
- `node scripts/check-artifacts-committed.mjs` → **exit 0** (1072 files,
  committed install-surface artifacts match the fresh build).

Evidence logs (this directory): `baseline-runtime-runtests.log`,
`baseline-testkit-runtests.log` (3aa6838), `after-runtime-runtests.log`,
`after-testkit-runtests.log` (post-A2).
