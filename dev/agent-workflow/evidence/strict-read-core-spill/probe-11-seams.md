# Strict-read + Core-spill — RED compatibility probes (implementation guide §1)

**Date**: 2026-09-20
**Baseline**: `dsh-agent-team` master @ `119aee9` (the PR #23 merge — the plan's pinned
baseline `d63cb71441e0b7af0c6bd167ab4c4ccf24040777` is a direct ancestor; no relevant
plugin surface moved between them); DSH `0.1.5-rc.2` @ `fb2c4b9e69`
(`tests/deepseek-harness-test-use`, pristine, porcelain 0).

Every claim below was verified by reading the pinned DSH source (file:line references
below) — the source of record for public seams. Runtime-level confirmation (subclass
instantiation, row activation, fs round-trips) is carried by the Phase C unit tests and
the real-profile smoke in the same evidence directory.

## 1. `@deepseek-ai/dsh-spill-local` exports `LocalSpillStore`

`packages/spill/spill-local/src/index.ts:113` — `export class LocalSpillStore extends
SpillStore`; `export default LocalSpillStore` (line 170). Class extends the abstract
`SpillStore` (`packages/spill/spill/src/index.ts`), which registers as the `spillStore`
service via `super(ctx, 'spillStore')`. **PASS.**

## 2. A subclass can override `saveText` and call `super.saveText`

`LocalSpillStore.saveText` (`packages/spill/spill-local/src/index.ts:150`) is a public
instance method with no `private`/`#` surface; it takes `SaveTextSpill` and returns
`Promise<SpillRef>`. `SpillRef = { locator: SpillLocator, bytes: number,
retrievalHint: string }` (`packages/spill/spill/src/types.ts`). The storage mechanics
(`saveTextFile`) are module functions, not class members — a subclass overrides
`saveText` cleanly and `super.saveText(input)` is the only storage path. **PASS.**

## 3. The subclass still provides normal `ctx.spillStore`

The base class constructor (`super(ctx)`) calls `Service` registration with the
`'spillStore'` service name; a subclass inherits the constructor chain. The duplicate
registration that would throw fires only when a SECOND `spillStore` implementation
loads — our composition disables the base `spill-local` row (probe 4), so exactly one
provider exists. **PASS (by construction; composition-verified in Phase C).**

## 4. The effective bundle can replace the base row id `spill-local`

Cordis patch semantics (`cordis-plugin-include` `applyEntryPatches`,
`packages/boot/app-boot/node_modules/@deepseek-ai/cordis-plugin-include/src/index.ts`):
a patch `{ id, name?, ...overrides }` — `name` is a **mismatch guard only** (never
applied), all other keys replace the target's keys wholesale. Consequence: a row's
`name` (the loaded module) CANNOT be rewritten by a patch; the mechanism the shipped
composition uses is **disable + insert** — exactly the pattern the upstream
`packages/experimental/agent-team-profile/cordis.patch.yml` itself uses (`- id:
tool-subagent-control` / `disabled: true` + `- insert:` new rows). Our bundle layer:

```yaml
- id: spill-local
  disabled: true
- insert:
    - id: team-spill-local
      name: 'dsh-agent-team/spill-local'
```

The inserted row loads the Team provider class (default export, the same module shape
the loader accepts: function/class/`{apply}` — `ctx.registry.plugin`). The upstream
`spill-policy` row is untouched. **PASS (mechanism: disable + insert, documented
adaptation of the guide's "replace" wording).**

## 5. Generic spill-policy uses the replaced provider

`packages/spill/spill-policy/src/index.ts:150` — `ref = await
spillStore.saveText(save)` (the `ctx.spillStore` service). **PASS.**

## 6. Over-cap grep/glob use the replaced provider

`packages/fs/tool-fs-search/src/search-core.ts:402` — `return await
spillStore.saveText(save)` (the formatted-result recovery path). **PASS.**

## 7. Session-reference uses the replaced provider

`packages/context/session-reference/src/spill.ts:42` — `saved = await
store.saveText(request)`. **PASS.**

## 8. `ctx.fs.resolve(locator)` + `ctx.fs.stat(target)` sees the saved artifact

`packages/fs/fs/src/types.ts` — `FileSystem.resolve(path, opts) → FsTarget {
targetKey: FsTargetKey, displayPath }`; `stat(target) → FsInfo { version: FsVersion,
type: 'file'|'directory'|'other', size? } | undefined` (undefined = absent).
fs-local: `resolveLocalTarget` (`packages/fs/fs-local/src/fsio.ts:146`) derives
`targetKey = realpath(displayPath)` (ancestor fallback when absent); `probe` (line
230) derives `version` from high-resolution stat fields. **PASS.**

## 9. Replacing the file changes current target/version identity

fs-local `targetKey` is realpath-derived (a replaced file has a different realpath/
inode identity); `version` is derived from stat identity + freshness fields (a
rewrite at the same path changes mtime/size → new version). Both tokens are branded
opaque strings (`Branded<'FsTargetKey'>` / `Branded<'FsVersion'>`) that consumers
must not parse — we hash them (domain-separated SHA-256) and compare digests.
**PASS.**

## 10. Foreground bash/pwsh result exposes structured `stdout.spillPath` / `stderr.spillPath`

`packages/shell/tool-bash/src/index.ts` — `canonicalBashResult` returns
`{ exitCode, signal, timedOut, aborted, timeoutMs, stdout: { text, truncated,
spillPath? }, stderr: { text, truncated, spillPath? }, sandbox? }`; the tool returns
`{ kind: 'foreground', ...canonicalBashResult(result) }` as its canonical value, and
the declared output schema marks `stdout.spillPath` / `stderr.spillPath` as optional
strings. `tool-pwsh` is the same shape (`packages/shell/tool-pwsh/src/index.ts:80-81,
163, 310-320`). The `tools/result` event
(`packages/core/tools/src/index.ts:189`) is an agent-scoped `emit` receiving
`(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>)`; on success
`result.value` is the canonical JSON value (deep-frozen). **PASS.**

## 11. Permission resolver provenance distinguishes explicit rule-deny from default-deny

`packages/runtime/operation-permission/permission-resolver.ts` (A3, frozen) —
`PermissionProvenance = { source: 'rule' | 'default', effect: PermissionLane,
lane?: PermissionLane, ruleIndex?: number }`: `source 'rule'` + `lane 'deny'` = an
explicit deny rule decided; `source 'default'` = no rule matched, `effect =
policy.default` (a default-deny policy yields `decision 'deny'` with
`provenance.source === 'default'`). The grant lane keys on exactly this distinction.
**PASS.**

## Summary

11/11 probes PASS at source level against the pinned baseline. The one documented
adaptation: the "replace row `spill-local`" wording is realized as **disable + insert**
(probe 4) — the only mechanism the Cordis patch dialect provides, and the same pattern
the upstream legacy agent-team profile ships. No DSH edits; CORE PATCH BUDGET = 0.
