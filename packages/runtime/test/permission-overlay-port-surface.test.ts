/**
 * permission-overlay-port-surface — the PR1 isolation proof.
 *
 * ADR §1 makes PermissionOverlayRepository a persistence port that MUST NOT
 * validate authority, perform envelope checks, bypass mutation serialization,
 * or become an alternative write path, and the Alpha.3 plan forbids PR1 from
 * adding resolver logic, notification or UI. That has to be more than a
 * docstring claim, so this spec pins it four ways:
 *
 * 1. the SURFACE — the port exposes append/latest/history and nothing else:
 *    no authority, envelope, mutation, lifecycle or notification member;
 * 2. the IMPORT GRAPH — no module of the permission-governance package (or of
 *    the new storage schema/repository) imports a resolver, assembler,
 *    governance-mutation, control, notification, projection or lifecycle
 *    module;
 * 3. the CONTRACT TEXT — the docstring assigning mutation authority to the
 *    future GovernanceMutationService is part of the pinned contract;
 * 4. the PLACEMENT SEAM — the durable domain name is literalized in exactly
 *    one module, so the open placement decision stays a one-file flip.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { openWorld } from './permission-overlay-helpers.js'

/** packages/ — this spec lives in packages/runtime/test. */
const PACKAGE_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const GOVERNANCE_DIR = join(PACKAGE_ROOT, 'runtime', 'permission-governance')
const OWNED_SOURCES: readonly string[] = [
  ...readdirSync(GOVERNANCE_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(GOVERNANCE_DIR, name)),
  join(PACKAGE_ROOT, 'storage', 'schema', 'permission-overlay.ts'),
  join(PACKAGE_ROOT, 'storage', 'repositories', 'permission-overlays.ts'),
]

/** Members that would turn a persistence port into an authority. */
const AUTHORITY_SURFACE: readonly string[] = [
  'authorize',
  'authenticate',
  'checkAuthority',
  'validateAuthority',
  'validateEnvelope',
  'checkEnvelope',
  'envelope',
  'grant',
  'revoke',
  'expand',
  'tighten',
  'approve',
  'admit',
  'admitInitialWork',
  'resolve',
  'resolveOperationPermission',
  'assemble',
  'assembleEffective',
  'effectivePolicy',
  'notify',
  'publish',
  'archive',
  'restore',
  'dispose',
  'inherit',
  'transition',
  'serializeMutation',
  'mutation',
  'applyMutation',
]

/** Module path fragments this PR must not depend on. */
const FORBIDDEN_IMPORT_FRAGMENTS: readonly string[] = [
  'operation-permission',
  'effective-policy',
  'governance/',
  'mutation/',
  'control/',
  'notification',
  'work-completion',
  'projection',
  'admission',
  'lifecycle',
  'agent-setup',
  'requirement',
]

/** Every static or dynamic module specifier a source file mentions. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) specifiers.push(match[1]!)
  return specifiers
}

function surface(value: object): string[] {
  const names = new Set<string>(Object.getOwnPropertyNames(value))
  const proto = Object.getPrototypeOf(value) as object | null
  if (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) names.add(name)
  }
  names.delete('constructor')
  return [...names].sort()
}

describe('permission-overlay port surface (ADR §1 non-responsibilities)', () => {
  it('exposes exactly append/latest/history — no authority, envelope, mutation or lifecycle member', async () => {
    const world = await openWorld('surface-port')
    expect(surface(world.port)).toEqual(['append', 'history', 'latest'])
    expect(Object.keys(world.port)).toHaveLength(3)
    for (const member of AUTHORITY_SURFACE) {
      expect(surface(world.port), `port.${member}`).not.toContain(member)
      expect(surface(world.store.repository), `repository.${member}`).not.toContain(member)
      expect(world.port instanceof Object ? member in world.port : false).toBe(false)
    }
    for (const name of surface(world.port)) {
      expect(typeof (world.port as unknown as Record<string, unknown>)[name]).toBe('function')
    }
    world.destroy()
  })

  it('imports no resolver, assembler, governance-mutation, control, notification, projection or lifecycle module', () => {
    expect(OWNED_SOURCES.length).toBeGreaterThanOrEqual(6)
    for (const file of OWNED_SOURCES) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        for (const forbidden of FORBIDDEN_IMPORT_FRAGMENTS) {
          expect(specifier, `${file} imports ${specifier}`).not.toContain(forbidden)
        }
      }
    }
  })

  it('pins the docstring contract: persistence-only, and GMS stays the sole mutation authority', () => {
    const portSource = readFileSync(join(GOVERNANCE_DIR, 'port.ts'), 'utf8')
    const indexSource = readFileSync(join(GOVERNANCE_DIR, 'index.ts'), 'utf8')
    const repositorySource = readFileSync(join(GOVERNANCE_DIR, 'overlay-repository.ts'), 'utf8')
    const combined = `${portSource}\n${indexSource}\n${repositorySource}`
    for (const phrase of [
      'persistence',
      'authority',
      'envelope',
      'GovernanceMutationService',
      'alternative write path',
      'mutation authority',
    ]) {
      expect(combined, `the pinned contract text must mention ${phrase}`).toContain(phrase)
    }
    expect(portSource).toContain('NO authority surface')
    expect(portSource).toContain('NO envelope surface')
    expect(portSource).toContain('NO mutation or lifecycle surface')
    expect(portSource).toContain('NO resolver or notification surface')
  })

  it('keeps the durable placement literalized in ONE module (a one-file flip for the open decision)', () => {
    const literalSites: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (['node_modules', 'dist', 'test', '.tmp-fault'].includes(entry.name)) continue
          walk(path)
          continue
        }
        if (!entry.name.endsWith('.ts')) continue
        // The single sanctioned literalization site.
        if (path.endsWith(join('storage', 'schema', 'permission-overlay.ts'))) continue
        if (readFileSync(path, 'utf8').includes("'team_permission_overlay'")) literalSites.push(path)
      }
    }
    walk(join(PACKAGE_ROOT, 'storage'))
    walk(join(PACKAGE_ROOT, 'runtime'))
    expect(literalSites).toEqual([])
  })
})
