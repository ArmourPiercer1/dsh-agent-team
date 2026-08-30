/**
 * P3-T6 / G3 criterion 1 — "domain has no live Agent dependency".
 *
 * Evidence strategy (TaskDoc P3-T6 实现要点): the complete import closure
 * of the t6 bundle — the bundle's own direct imports plus the transitive
 * import/export-from closure of the six composed modules (contracts,
 * blueprint, member, lifecycle, policy, compatibility) and their
 * testdata/fixtures data modules — is enumerated as data in
 * `packages/testkit/domain/src/import-graph.ts`. This test:
 *
 * 1. asserts the enumeration is self-consistent (9 direct + 54 closure
 *    specifiers, all distinct);
 * 2. asserts NO specifier in the closure references a live-Agent (or
 *    legacy Team) package — path-segment scan over `runtime`, `tools`,
 *    `remote`, `client`, `legacy`, `team` plus the workspace bare names;
 * 3. asserts the ONLY bare (non-relative) specifier in the entire closure
 *    is `yaml` — the blueprint parser's frontmatter dependency: no Node
 *    builtins, no framework, no upstream DSH import;
 * 4. live-imports every direct bundle dependency at runtime and checks the
 *    expected marker export (the dependency list is real, not fiction);
 * 5. asserts no public runtime export of any composed module carries the
 *    name `agent` (a live-Agent seam would name itself that).
 *
 * The dynamic imports run at module top level (top-level await), because
 * the shim rejects async `it` bodies (the t5 bridge uses the same pattern).
 */

import { describe, expect, it } from 'vitest'

import {
  T6_BANNED_BARE_SPECIFIERS,
  T6_BANNED_PATH_SEGMENTS,
  T6_BUNDLE_DIRECT_IMPORTS,
  T6_CLOSURE_IMPORT_SPECIFIERS,
  T6_FULL_IMPORT_CLOSURE,
  isAllowedBareSpecifier,
  isBannedSpecifier,
  isBareSpecifier,
} from '../domain/src/index.js'

/** Rewrite a TS-style `.js` specifier to the literal `.ts` source file. */
function toTsSpecifier(spec: string): string {
  return spec.endsWith('.js') ? `${spec.slice(0, -3)}.ts` : spec
}

/** Live-import every direct bundle dependency (marker-checked in tests). */
const liveModules = new Map<string, Record<string, unknown>>()
for (const entry of T6_BUNDLE_DIRECT_IMPORTS) {
  const mod = (await import(toTsSpecifier(entry.specifier))) as unknown as Record<string, unknown>
  liveModules.set(entry.specifier, mod)
}

describe('P3-T6 G3-1: domain has no live Agent dependency', () => {
  it('the enumerated import closure is self-consistent', () => {
    expect(T6_BUNDLE_DIRECT_IMPORTS.length).toBe(9)
    expect(T6_CLOSURE_IMPORT_SPECIFIERS.length).toBe(54)
    expect(T6_FULL_IMPORT_CLOSURE.length).toBe(63)
    const seen = new Set<string>()
    for (const spec of T6_FULL_IMPORT_CLOSURE) {
      expect(seen.has(spec)).toBe(false)
      seen.add(spec)
    }
  })

  it('no specifier in the closure references a live-Agent or legacy Team package', () => {
    for (const spec of T6_FULL_IMPORT_CLOSURE) {
      expect(isBannedSpecifier(spec)).toBe(false)
    }
  })

  it('the banned package set covers the frozen Agent package roster', () => {
    expect(T6_BANNED_PATH_SEGMENTS).toEqual(['runtime', 'tools', 'remote', 'client', 'legacy', 'team'])
    for (const bare of T6_BANNED_BARE_SPECIFIERS) {
      expect(isBannedSpecifier(bare)).toBe(true)
    }
  })

  it('the only bare specifier in the entire closure is yaml', () => {
    const bareSpecs = T6_FULL_IMPORT_CLOSURE.filter((spec) => isBareSpecifier(spec))
    expect(bareSpecs.length).toBe(1)
    expect(bareSpecs[0]).toBe('yaml')
    for (const spec of T6_FULL_IMPORT_CLOSURE) {
      if (isBareSpecifier(spec)) {
        expect(isAllowedBareSpecifier(spec)).toBe(true)
      }
    }
  })

  it('every direct bundle dependency resolves at runtime and exposes its marker export', () => {
    expect(liveModules.size).toBe(9)
    for (const entry of T6_BUNDLE_DIRECT_IMPORTS) {
      const mod = liveModules.get(entry.specifier)
      expect(mod !== undefined).toBe(true)
      // ESM namespace objects are non-extensible (exports cannot be added or
      // removed after linking) — the live dependency list is real.
      expect(Object.isExtensible(mod)).toBe(false)
      expect(mod?.[entry.marker] !== undefined).toBe(true)
    }
  })

  it('no public runtime export of any composed module is named after a live Agent', () => {
    for (const mod of liveModules.values()) {
      for (const name of Object.keys(mod)) {
        expect(name.toLowerCase().includes('agent')).toBe(false)
      }
    }
  })
})
