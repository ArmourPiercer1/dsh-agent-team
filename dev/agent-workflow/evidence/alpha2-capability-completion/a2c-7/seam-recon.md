# A2C-7 — seam reconnaissance (pre-implementation, 2026-09-12)

> Recon of every public seam A2C-7 consumes (CORE PATCH BUDGET = 0 — public
> seams only). All paths verified on the pinned test-use checkout
> (`tests/deepseek-harness-test-use` @ `a66e470204`, `git status --porcelain`
> empty, `git rev-parse HEAD` = `a66e4702047846cdaa10c66c9d3df3951f5ea70d`)
> and on the worktree base `e95a57e`.

## 1. The containment authority (the ONLY legal predicate)

`packages/fs/fs/src/index.ts` (pinned upstream, abstract Service Definition):

| seam | line | signature |
|---|---|---|
| `FileSystem.contains` | 157 | `abstract contains(parent: FsTarget, child: FsTarget): boolean` — **synchronous** |
| `FileSystem.resolve` | 116 | `abstract resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTarget>` |
| `FileSystem` class | 86 | `export abstract class FileSystem extends Service` (constructor `super(ctx, 'fs')`) |

`FsTarget` (`packages/fs/fs/src/types.ts:60`): `{ targetKey: FsTargetKey; displayPath: string }`
where `FsTargetKey` is a **branded** string (`FsTargetKey` export, `types.ts`) — opaque by
contract (plan §1.5: never `startsWith`, never `node:path` parse, never assume local path).

Contract of `contains` (doc comment @ `fs/src/index.ts:150-156`): two canonical targets
**from the same provider**; `child` equals `parent` or is inside its descendant subtree;
the consumer does not parse `targetKey`.

## 2. The real local backend (the pinned test-use checkout)

`packages/fs/fs-local/src/index.ts` (pinned upstream):

- `export class LocalFileSystem extends FileSystem` (L64); **default export** (L269).
- `constructor(ctx: Context, config: Config)` (L79) with
  `Config = { cwd?: string; diffBasisMaxBytes?: number }` (L41-49).
  - `diffBasisMaxBytes` is **required at construction time** (the schemastery
    default is applied by the Cordis Loader, not by the constructor — the
    constructor validates a resolved config; L82-86 throws otherwise).
  - **Context construction (the seam-recon deliverable)**: the Cordis `Service`
    base constructor only needs `ctx.reflect.provide` — the minimal working
    double is `{ reflect: { provide() {} } }`. Precedent: this repo's A2
    real-backend helper constructs it exactly this way and passes on the
    baseline (see §5):
    ```js
    const fsx = new LocalFileSystem(
      { reflect: { provide() {} } },
      { cwd: tmp, diffBasisMaxBytes: 10 * 1024 * 1024 },
    )
    ```
- `resolve` (L116 impl): relative paths resolve against the bound `cwd`;
  returns `{ targetKey: realpath-like string, displayPath: absolute display
  path }`. Same file ⇒ same `targetKey` (realpath identity: alias spellings,
  separator variants, `..` traversal, case per-OS all canonicalize).
  Absent paths: realpaths the nearest existing ancestor and appends the
  missing suffix (stable identity for spellings, distinct for files).
- `contains` (L125-131 impl, verbatim semantics):
  ```ts
  contains(parent, child): boolean {
    const rel = relative(processPath(parent), processPath(child))
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  }
  ```
  where `processPath(target) = String(target.targetKey)`. The prefix trap is
  structurally handled: `relative('/x/src', '/x/src2/f') = '../src2/f'`
  → `false`. (This is the backend's own `node:path` over the backend's own
  canonical keys — the consumer-side string authority FORBIDDEN by plan
  §1.5/§9.4 is the CONSUMER doing `operation.key.startsWith(root.key)` on
  opaque keys, which this implementation is not.)

### Prebuilt lib (the import mechanism)

The test-use checkout carries the **prebuilt** lib at
`packages/fs/fs-local/lib/index.js` (plus `lib/types/`, `tsconfig.tsbuildinfo`)
at the pinned SHA — verified present and clean on 2026-09-12. Test-side import
is by absolute `pathToFileURL` (the same mechanism `a2-canonical-operation-realfs.mjs`
and `t12a-live-bridge.mjs` use); the lib's transitive imports resolve from the
test-use checkout's own pnpm layout. **No build step, no DSH instance, no
DSH_HOME** — the backend is a plain object bound to a temp dir.

## 3. The fsBackend accessor surface (the A6 glue)

`packages/runtime/src/plugin/host.ts`:

- L199-201 — the deps structural type:
  `fsBackend?: (agentCtx: unknown) => { resolve(path: string, options?: { cwd?: string }): Promise<unknown> }`
- L694-707 — the production accessor: per call, STRICT `ctx.get('fs')` (global
  service store; the property proxy `agentCtx.fs` is topology-sensitive and
  never resolves on the agent scope — V1 live-matrix fact), fail-closed
  `TEAM_PLUGIN_SERVICE_MISSING` when the service or `resolve` is absent.

The glue's `resolveTarget` closure (`packages/runtime/src/plugin/live/agent-bindings.mjs`
L1374-1389): reads the agent's live session cwd LAZILY (`agentCtx.agent?.session?.header?.cwd`,
FACT 3b — never captured at install), calls `fsBackend(agentCtx).resolve(path, { cwd })`,
unbrands `target.targetKey` → `{ key, display }`.

**A2C-7 extension of this surface** (public-seam only, no upstream change):
- the structural type gains `contains?: (parent: unknown, child: unknown) => boolean | Promise<boolean>`;
- the production accessor returns `{ resolve, contains }` (the real
  `FileSystem.contains` is synchronous; the union allows a future async backend);
- the glue's `resolveTarget` closure additionally returns the unbranded
  `FsTarget` handle (`handle: target`) — an OPAQUE, runtime-only, non-canonical
  field (the canonical identity stays `{key, display}`; A2 ignores the extra
  field — it destructures only `key`/`display`);
- a new glue closure `containsTargets = (parent, child) => fsBackend(agentCtx).contains(parent, child)`
  (same lazy `ctx.get('fs')` basis per call — both targets and the predicate
  come from the same live provider);
- both ride the same V1-1 availability check (`typeof fsBackend === 'function'`
  → otherwise `alpha2-permission-fs-unavailable` at install).

## 4. Where the adapter consumes it

`packages/runtime/operation-permission/pre-execute-adapter.ts`:

- R2/P1-3 (module doc L133-197): the existing LANE ASYMMETRY on rule
  canonicalization failure — failed exact ALLOW/ASK rule = non-match; failed
  exact DENY rule = fail-closed deny BEFORE A3 (stage
  `deny-canonicalization-failure`, reason prefix
  `"a static deny rule could not be canonicalized"` — pinned by a5a/h4 via
  `.includes()`, so the prefix text must survive A2C-7 verbatim);
- `canonicalRuleKey` (L680-704): fresh-per-decision rule-path resolution with
  result-shape fail-closed validation (non-plain / non-string / empty /
  `'undefined'`-sentinel key = failure, never a key);
- `canonicalLane` (L719-760) → `canonicalRulesFor` (L771-788) → `enforce`
  (L795+): the deny-lane failure is denied at L857-868 before
  `resolveOperationPermission` is called;
- `canonicalizeOperation` is called with the injected `resolveTarget` (L816-820);
  A2's `resolveResource` (`canonical-operation.ts` L770-808) validates
  `{key, display}` and ignores extra fields — an optional `handle` field on
  the resolver result is transparent to A2.

## 5. Precedent: real fs backend already used in this repo's tests

The brief stated this repo's tests "have never used a real fs backend" —
**partially inaccurate, recorded as deviation D-A2C7-1**: the A2
canonical-operation suite DOES use the real pinned backend via
`packages/runtime/test/a2-canonical-operation-realfs.mjs` (prebuilt-lib import,
`{ reflect: { provide() {} } }` ctx double, temp dir under `os.tmpdir`,
degrades to `{ available: false, reason }` when the build is absent). What it
never did — and what A2C-7 adds — is call **`contains()`** on the real backend
(A2 exercised only `resolve()`). A2C-7's real-backend section reuses the exact
construction pattern and adds the `contains()` cases (prefix trap, alias
identity, retarget). If the prebuilt lib is ever absent (fresh machine), the
section degrades to a recorded skip — the unit-level fake-backend groups still
pin the module semantics; the real-backend groups are the authority pin.

## 6. What A2C-7 deliberately does NOT touch

- upstream `tests/deepseek-harness-test-use` (zero writes; the prebuilt lib is
  consumed read-only);
- A4 control plane (the subtree decision feeds the existing frozen pipeline —
  request/wait/guard untouched);
- the A2 fingerprint projection (subtree changes rule matching, not operation
  identity — `canonicalizeOperation` is unchanged);
- A2C-1 shell vocabulary/lanes (shell + subtree = schema rejection, new branch
  beside the existing exact/any branches — byte-identical existing messages);
- A2C-2 coverage gate (the closed seven-tool vocabulary and the authority-owner
  classification are unchanged);
- the p4t6 aggregate pin (single-writer file — reported delta only).
