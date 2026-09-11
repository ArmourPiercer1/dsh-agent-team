# H5 upstream contract — pinned-upstream facts for the bash effect fingerprint

**Upstream checkout**: `D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use`
**Pinned baseline**: upstream `deepseek-ai/deepseek-harness` 0.1.2-rc.1 @ `a66e470204` (read-only; CORE PATCH BUDGET = 0)
**Purpose**: the parent-verified upstream facts the H5 projection ruling and the H5-B8 fail-closed validation rest on. Every line reference below was re-verified against the pinned checkout during H5 (2026-09-11). No upstream file was modified (git status --porcelain empty @ a66e470204 — gate 5).

---

## 1. The Bash DTO — `BashToolArgs`

`packages/shell/tool-bash/src/index.ts` **L44–52**:

```ts
/** Parsed tool args; execute validates value constraints absent from ParameterSchemaSpec. */
interface BashToolArgs {
  command: string
  description: string
  timeoutMs?: number
  workdir?: string
  run_in_background?: boolean
  sandbox_permissions?: string
  justification?: string
}
```

Key behavior: exactly FOUR fields beyond `command` change the execution effect — `workdir` (where the shell runs), `run_in_background` (detached job vs foreground), `timeoutMs` (explicit per-call timeout), `sandbox_permissions` (requested sandbox mode). `description` / `justification` are display/explanation metadata (upstream's validation domain — `justification` is paired with `sandbox_permissions` by the shared escalation rule, see §5).

## 2. `validateBashArgs` and its INSIDE-execute position

`packages/shell/tool-bash/src/index.ts` **L54–67**:

```ts
function validateBashArgs(args: BashToolArgs): void {
  if (args.command.trim().length === 0) {
    throw new Error('invalid command: expected a non-empty string')
  }
  if (args.description.trim().length === 0) {
    throw new Error('invalid description: expected a non-empty string')
  }
  if (args.timeoutMs !== undefined && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
    throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(args.timeoutMs)}`)
  }
  // The escalation pairing (sandbox_permissions ⇔ justification, non-empty) is
  // the shared rule both enforcing families validate identically.
  validateEscalationArgs(args.sandbox_permissions, args.justification)
}
```

Key behavior: value validation (non-empty command/description, `timeoutMs` present ⇒ finite and `> 0`, escalation pairing) runs **INSIDE `execute`** — the call at **L330** (`async execute(args: BashToolArgs, exec) { validateBashArgs(args)` — the FIRST statement of the body, L329–330). I.e. it runs AFTER the pre-execute waterfall (§7) — the Team listener sees the raw, unvalidated arguments. The H5 `extractBashEffects` mirrors the `timeoutMs` check (L61–63) verbatim in its `bash-timeout-ms-invalid` fail-closed reason, and deliberately does NOT mint the pairing check (it stays upstream's).

## 3. `resolveWorkdir` — the workdir defaulting + the current-composition basis

`packages/shell/tool-bash/src/index.ts` **L143–155**:

```ts
function resolveWorkdir(
  modelWorkdir: string | undefined,
  exec: { agent?: Agent },
  policyWorkspaceRoot?: string,
): string | undefined {
  const headerCwd = exec.agent?.session.header.cwd
  const sessionCwd = policyWorkspaceRoot ?? (headerCwd === undefined ? undefined : canonicalPath(headerCwd))
  if (modelWorkdir === undefined) return sessionCwd
  if (sessionCwd !== undefined && !isAbsolute(modelWorkdir)) {
    return resolvePath(sessionCwd, modelWorkdir)
  }
  return modelWorkdir
}
```

Key behavior (the H5 workdir-seam ruling, projection-ruling.md §2, mirrors this):
- `policyWorkspaceRoot` (the sandbox policy's workspace root, passed from `standingPolicy?.workspaceRoot` at the L339 call site) **wins** when present — workdir and confinement then share the exact same per-call identity;
- otherwise the basis is the **session cwd** (`canonicalPath(headerCwd)`) — lazily read from the live session header at call time;
- omitted `workdir` ⇒ session cwd; relative `workdir` ⇒ `resolvePath(sessionCwd, rel)` (session-cwd-relative); absolute ⇒ as-is.

**Current Team composition note**: no sandbox executor is mounted (there is no `sandboxPolicy` for bash in the Team composition), so `policyWorkspaceRoot` is `undefined` and the basis IS the session cwd — the SAME lazy basis the H5 seam (`resolveTarget` over `ctx.fs.resolve(path, { cwd: sessionCwd })`) uses for the operation and the rules. This is why `resolveTarget(args.workdir ?? '.')` satisfies the ideal property in the current composition (see projection-ruling.md; a sandbox-mounted composition is a V2 consideration — there the fingerprint's workdir key would be relative to `policyWorkspaceRoot` while the operation's effective workdir is also resolved against it, so the identity would still be consistent, but the composition change must re-derive the ruling).

## 4. Background execution — detached job vs foreground

`packages/shell/tool-bash/src/index.ts` **L348–378** (inside `execute`):

```ts
if (args.run_in_background === true) {
  // Undeclared keys are allowed, so schema omission also needs enforcement.
  if (!backgroundEnabled) { throw new Error('run_in_background is disabled ...') }
  const jobs = ctx.get('jobs')
  ...
  const id = jobs.start({
    kind: 'bash',
    label: args.command,
    ...exec.agent ? { owner: exec.agent } : {},
    run: () => {
      const proc = ctx.shell.start(ctx.shell.resolve(request))
      return { cancel: ..., done: ..., readOutput: ... }
    },
  })
  return { kind: 'background' as const, jobId: id }
}
const result = await ctx.shell.run(ctx.shell.resolve({ ...request, signal: exec.signal, ... }))
```

Key behavior: `run_in_background: true` ⇒ `jobs.start` — a DETACHED job (the call returns a job id immediately; the timeout does not apply — L256: "No timeout applies."); anything else ⇒ foreground `ctx.shell.run` with the caller signal. Two different execution effects (detached vs foreground, timeout applicability) — hence the projection's `runInBackground` field.

## 5. The sandbox escalation path

`packages/shell/tool-bash/src/index.ts`:

- **L258–268** (the parameter schema): `sandbox_permissions` (a string constrained to the `escalationModes` enum) and `justification` are advertised **only when a sandboxing executor is mounted** (`...escalationModes.length > 0 ? {...} : {}`, with `escalationModes = defaultMode === undefined ? [] : ESCALATION_TARGETS` at L192 — `defaultMode` from the mounted sandbox executor's config);
- **L332–338** (inside `execute`): the approval — `approvedMode = args.sandbox_permissions !== undefined && args.justification !== undefined ? await approveBashEscalation(...) : undefined`; the approved mode then replaces the standing policy's mode for this call.

Key behavior: the requested mode changes the execution effect (which sandbox confinement the command runs under — an escalation). The pinned-upstream mode vocabulary is `ESCALATION_TARGETS` = `['workspace-write', 'danger-full-access']` (`packages/sandbox/sandbox/src/escalation.ts` L41; pinned by `packages/sandbox/sandbox/tests/escalation.spec.ts` L28) — the H5-B5 probe uses exactly these two modes. The Team layer records the REQUESTED mode string only (`sandboxPermissions ?? null`); mode LEGALITY is upstream's authority at execution (the Team layer does not mint authority for a value upstream would reject — such a call never executes).

## 6. fs-local `resolveLocalTarget` — realpath + existence tolerance

`packages/fs/fs-local/src/fsio.ts` **L146–194**:

```ts
export async function resolveLocalTarget(cwd: string, path: string): Promise<LocalTarget> {
  if (path.trim().length === 0) throw new FsError('file_path must be a non-empty string', 'FS_NOT_FOUND')
  const displayPath = resolve(cwd, path)
  try {
    return { displayPath, targetKey: FsTargetKey(await realpath(displayPath)) }
  } catch (error: unknown) {
    if (isENOTDIR(error)) throw new FsError(...'a parent path segment is not a directory'...)
    if (!isENOENT(error)) throw error
  }
  // File absent: realpath the nearest existing ancestor and re-append the
  // missing suffix ... so the key is stable across creation of those dirs.
  const missing = [basename(displayPath)]
  let ancestor = dirname(displayPath)
  while (true) {
    try {
      const realAncestor = await realpath(ancestor)
      ...
      return { displayPath, targetKey: FsTargetKey(join(realAncestor, ...missing)) }
    } catch (error: unknown) { ... nearest-existing-ancestor walk ... }
  }
}
```

Key behavior (why the existing `resolveTarget` seam is the right workdir authority — projection-ruling.md §2):
- the key is **realpath-derived** — a symlinked/junctioned workdir binds its REAL identity;
- it is **existence-tolerant** — a not-yet-created workdir directory resolves via the nearest-existing-ancestor realpath + missing suffix, so it gets a STABLE key (a workdir the command is about to create is bindable);
- only an EMPTY/whitespace-only path or a through-file segment fails (typed `FS_NOT_FOUND`). Note: an empty-string workdir never reaches the seam in the H5 design — the Team layer normalizes `''` → `'.'` BEFORE the resolver call (upstream `resolvePath(cwd, '')` = cwd: an empty-string workdir is EFFECTIVELY the session cwd — the ruling is recorded in projection-ruling.md §2).

The seam the H5 projection uses is the EXISTING glue closure (`packages/runtime/src/plugin/live/agent-bindings.mjs` L1233–1248): `resolveTarget(path)` reads `agentCtx.agent?.session?.header?.cwd` LAZILY and wraps `fsBackend(agentCtx).resolve(path, { cwd })` → `{ key: String(target.targetKey), display: String(target.displayPath) }`.

## 7. The dsh-tools `prepareExecution` ordering — the waterfall precedes ANY argument validation (the H5-B8 reachability proof)

`packages/core/tools/src/index.ts` (the ToolRuntime that dispatches every tool call):

- **L1402–1407** (`createExecution`): the arguments are MATERIALIZED losslessly-JSON-only — `const detached = snapshotJsonValue(exec.arguments)` (rejecting only non-losslessly-JSON-serializable values) → `const execution = { ...base, arguments: deepFreeze(detached) }`. **No parameter-schema validation happens here or anywhere before the gate** — malformed effect-field types (non-string `workdir`, non-boolean `run_in_background`, invalid `timeoutMs`, non-string `sandbox_permissions`) survive materialization verbatim;
- **L1466–1469** (`prepareExecution`): the `tools/pre-execute` WATERFALL runs over the materialized exec — `const gate = await this.ctx.waterfall(carrier, 'tools/pre-execute', exec, () => ...allow)` — the Team listener's `canonicalizeOperation` runs INSIDE this waterfall;
- **L1523–1540** (`dispatchToolBody`, the stage AFTER the gate + the monotonic guard): the tool body dispatches — `const returned = await tool.execute(exec.arguments, exec)` (L1540) — where the tool's OWN `validateBashArgs` runs INSIDE (tool-bash L330, §2).

Key behavior (WHY H5-B8 is reachability-required, not defense-in-depth): the ordering is `materialize (lossless JSON only) → pre-execute waterfall (Team canonicalization) → guard → dispatch → tool.execute → validateBashArgs`. The Team listener is the ONLY stage between materialization and execution, and it sees the raw unvalidated arguments — so malformed effect fields DO reach `canonicalizeOperation`, and a call that would never execute (upstream would reject it) must not be authorized: the four new fail-closed reasons close exactly that gap. (The lossless-JSON note matters for `Infinity`: upstream materialization turns `Infinity` into `null` at the wire, but the in-process tool call path hands the deep-frozen object to the waterfall as-is — `timeoutMs: Infinity` reaches the listener in-process, which is why the check is `Number.isFinite(value) && value > 0`, mirroring upstream L61 verbatim.)
