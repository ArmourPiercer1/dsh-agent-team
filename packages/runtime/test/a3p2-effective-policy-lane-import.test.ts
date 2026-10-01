/**
 * A3P2 — the effective-policy LANE EXPORT hygiene (Alpha.3 PR2).
 *
 * The assembler is exported through `packages/runtime/effective-policy/index.ts`
 * because that is the lane's public surface. This lane is imported by the
 * admission surface (`admission/types.ts`), so what the lane re-exports is a
 * LOAD-ORDER decision, not a cosmetic one.
 *
 * This spec exists because the first version of PR2 got that wrong: re-exporting
 * the assembler while importing `../operation-permission/index.js` (that lane's
 * barrel) put the operation-permission canonicalizer — and through it the
 * admission surface — into an initialization cycle with `admission/types.ts`.
 * The symptom was not a permission bug: 73 runtime and tools spec files failed to
 * COLLECT with `TypeError: Cannot read properties of undefined (reading
 * 'LEADER')` at `admission/actions.ts`, because a closed constant table had not
 * finished initializing. The fix is to take the frozen resolver from its OWN leaf
 * module. These legs pin both halves: the load order, and that the kernel reused
 * through the leaf is the same function the lane barrel exports (so the narrower
 * import does not silently mean a second implementation).
 *
 * Offline, host-free; the only I/O is reading this package's own source text.
 *
 * @module test/a3p2-effective-policy-lane-import
 */

// ORDER-SENSITIVE ON PURPOSE: the admission constant table is imported first,
// the way the 73 affected spec files reach it. If the effective-policy lane
// re-creates the initialization cycle, THIS import is what fails — at module
// evaluation, before a single test runs.
import { CALLER_ROLE_VALUES, CALLER_ROLES } from '../admission/types.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as lane from '../effective-policy/index.js'
import * as assemblerModule from '../effective-policy/permission-assembler.js'
import { resolveOperationPermission } from '../operation-permission/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ASSEMBLER_SOURCE = readFileSync(join(HERE, '../effective-policy/permission-assembler.ts'), 'utf8')

describe('the effective-policy lane stays loadable from the admission surface', () => {
  it('the admission constant tables are initialized when this lane loads', () => {
    // The exact undefined-member the cycle produced. A closed table read at
    // module-init time is the canary: an initialization cycle makes it
    // `undefined` rather than throwing at the import site.
    expect(CALLER_ROLES.LEADER).toBe('leader')
    expect(CALLER_ROLES.MEMBER).toBe('member')
    expect(CALLER_ROLE_VALUES).toEqual(['human', 'leader', 'member'])
  })

  it('the lane barrel and the module are one instantiation, not a second copy', () => {
    // Two live instantiations of the assembler would mean two error classes and
    // two frozen constant tables: `instanceof` and identity checks downstream
    // would silently disagree.
    expect(lane.assembleEffectivePermission).toBe(assemblerModule.assembleEffectivePermission)
    expect(lane.EffectivePermissionAssemblyError).toBe(assemblerModule.EffectivePermissionAssemblyError)
    expect(lane.EFFECTIVE_PERMISSION_LAYERS).toBe(assemblerModule.EFFECTIVE_PERMISSION_LAYERS)
  })

  it('the resolver reached through the leaf module IS the frozen Alpha.2 kernel', () => {
    // The narrow import path must not mean a re-implementation or a wrapper: the
    // reused kernel is literally the same function object the
    // operation-permission lane exports. The assembler's own entry point stays
    // distinct — it composes the kernel per layer, it does not alias it.
    expect(assemblerModule.resolveEffectiveOperationPermission).not.toBe(resolveOperationPermission)
    expect(ASSEMBLER_SOURCE).toContain("from '../operation-permission/permission-resolver.js'")
    expect(ASSEMBLER_SOURCE).not.toContain("from '../operation-permission/index.js'")
  })

  it('the lane keeps its overlay import type-only (no runtime edge to storage)', () => {
    // PR2 consumes the PR1 vocabulary; it must not gain a runtime dependency on
    // the storage package or the permission-governance barrel. `import type` is
    // the only permitted form on both edges.
    expect(ASSEMBLER_SOURCE).toContain("import type {\n  PermissionOverlayEffect")
    expect(ASSEMBLER_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\.\/\.\.\/storage\//m)
    expect(ASSEMBLER_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\.\/permission-governance\//m)
    expect(ASSEMBLER_SOURCE).toContain('resolveOperationPermission(a1PolicyOf(layer.fallback, canonical), operation, canonical)')
  })

  it('the module has exactly two runtime edges and zero I/O surface (the pure-in-memory claim, structurally)', () => {
    // The PR2 scope line is "pure in-memory", and a scope line stated in prose
    // rots. Every import of the assembler is therefore pinned to the closed set:
    // two RUNTIME edges (the contracts helpers it must reuse, and the frozen
    // resolver it composes) plus the type-only vocabulary edges. Anything else —
    // a storage binding, a notification import, a `node:` builtin — fails here.
    const specifiers = [...ASSEMBLER_SOURCE.matchAll(/^import\s+(type\s+)?[\s\S]*?from '([^']+)'/gm)].map((m) => ({
      typeOnly: m[1] !== undefined,
      specifier: m[2] as string,
    }))
    const runtime = specifiers.filter((entry) => !entry.typeOnly).map((entry) => entry.specifier)
    expect(runtime.sort()).toEqual([
      '../../contracts/src/index.js',
      '../operation-permission/permission-resolver.js',
    ])
    const typeOnly = specifiers.filter((entry) => entry.typeOnly).map((entry) => entry.specifier)
    expect(typeOnly.sort()).toEqual([
      '../../domain/blueprint/src/index.js',
      '../operation-permission/permission-resolver.js',
      '../operation-permission/types.js',
      '../permission-governance/types.js',
    ])
    for (const entry of specifiers) {
      expect(entry.specifier).not.toMatch(/^node:/)
    }
    expect(ASSEMBLER_SOURCE).not.toMatch(/\brequire\(/)
  })

  it('the module reads no clock and no randomness (its determinism is structural)', () => {
    // `the same input yields the same decision` is a tested property, but the
    // cheap honest guarantee is that the module has no way to read anything
    // time- or entropy-varying: the timestamp in the provenance is COPIED from
    // the snapshot, never produced here.
    expect(ASSEMBLER_SOURCE).not.toMatch(/\bDate\.now\(|new Date\(|performance\.now\(|Math\.random\(|crypto\.randomUUID\(/)
  })
})
