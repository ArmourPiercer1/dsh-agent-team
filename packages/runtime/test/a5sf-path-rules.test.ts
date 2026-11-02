/**
 * a5sf-path-rules — Alpha.5 P1-03 (Gate G1.3).
 *
 * The authorized-path law of the Member I/O data plane, machine-checked:
 *  - an `allow` locator is a SUBTREE ROOT (`/work/a` covers `/work/a/x`, never
 *    `/work/ab`); trailing separators and `.` are comparison-only
 *    normalizations; `..` never folds; Windows separators separate segments;
 *  - symlink escape: a link authored inside an allowed subtree that resolves
 *    OUTSIDE it is `deny` with a typed reason (the real filesystem is the
 *    oracle, via an injectable resolver);
 *  - legal hardlink aliasing is PATH-based, never inode/nlink-based: a hardlink
 *    is operable through an allowed path and still refused through a path
 *    outside the policy, even though both names share one inode;
 *  - a native `write`/`edit` that must read the target first is refused when
 *    the READ axis does not cover it, even when the WRITE axis allows it;
 *  - a Provider missing a needed `ctx.fs` method is a TYPED `unsupported`
 *    refusal naming every missing method — never "all read", never a raw Node
 *    fs fallback.
 *
 * Real-filesystem fixtures live under `<worktree>/.artifacts/tmp/` (created by
 * `fs.mkdtemp`, removed in `afterAll`); nothing here touches host instances,
 * `tests/homes`, or any network.
 *
 * @module test/a5sf-path-rules
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { link, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  checkWriteRequiresRead,
  coversLocator,
  locatorsEquivalent,
  matchLocator,
  toLocatorKey,
} from '../member-io-policy/src/path-rules.js'
import {
  MANAGED_FS_METHODS,
  evaluateLocatorAccess,
  requireProviderCapabilities,
  type PathIdentity,
  type PathIdentityResolver,
} from '../member-io-policy/src/provider-capabilities.js'
import { intersectPathRuleSets } from '../member-io-policy/src/path-rules.js'
import type { PathRuleSet } from '../member-io-policy/src/types.js'

// --- fixtures ----------------------------------------------------------------

function lane(
  mode: 'all' | 'restricted',
  allow: readonly string[] = [],
  ask: readonly string[] = [],
  deny: readonly string[] = [],
): PathRuleSet {
  return Object.freeze({
    mode,
    allow: Object.freeze([...allow]),
    ask: Object.freeze([...ask]),
    deny: Object.freeze([...deny]),
  })
}

const WORKTREE_ROOT = process.cwd()
const TMP_BASE = resolve(WORKTREE_ROOT, '.artifacts', 'tmp')
let root: string
let allowedDir: string
let outsideDir: string

beforeAll(async () => {
  await mkdir(TMP_BASE, { recursive: true })
  root = await mkdtemp(join(TMP_BASE, 'a5sf-p1-03-'))
  allowedDir = join(root, 'allowed')
  outsideDir = join(root, 'outside')
  await mkdir(allowedDir, { recursive: true })
  await mkdir(join(outsideDir, 'dir'), { recursive: true })

  // allowed content + an inside-pointing symlink
  await writeFile(join(allowedDir, 'inside.txt'), 'inside\n', 'utf8')
  await symlink(join(allowedDir, 'inside.txt'), join(allowedDir, 'inside-link.txt'))

  // symlink escape: authored under the allowed subtree, resolves outside it
  await writeFile(join(outsideDir, 'secret.txt'), 'secret\n', 'utf8')
  await symlink(join(outsideDir, 'secret.txt'), join(allowedDir, 'escape.txt'))

  // symlinked PARENT directory escape (the leaf itself is a regular file)
  await writeFile(join(outsideDir, 'dir', 'secret.txt'), 'secret\n', 'utf8')
  await symlink(join(outsideDir, 'dir'), join(allowedDir, 'escape-dir'))

  // legal hardlink alias: one inode, one name inside and one outside the policy
  await writeFile(join(outsideDir, 'source.txt'), 'linked\n', 'utf8')
  await link(join(outsideDir, 'source.txt'), join(allowedDir, 'alias.txt'))
})

afterAll(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
})

function allowedLane(): PathRuleSet {
  return lane('restricted', [allowedDir])
}

// --- 1. exact/subtree authoring law -----------------------------------------

describe('P1-03 · exact/subtree locator law', () => {
  it('an allow locator is a subtree root', () => {
    expect(coversLocator('/work/a', '/work/a')).toBe(true)
    expect(coversLocator('/work/a', '/work/a/f.txt')).toBe(true)
    expect(coversLocator('/work/a', '/work/a/x/y')).toBe(true)
    expect(coversLocator('/', '/work/a')).toBe(true)
  })

  it('a subtree root never covers a sibling that merely shares the prefix', () => {
    expect(coversLocator('/work/a', '/work/ab')).toBe(false)
    expect(coversLocator('/work/a', '/work/ab/x')).toBe(false)
    expect(coversLocator('/work/a/x', '/work/a')).toBe(false)
  })

  it('trailing separators and `.` are comparison-only normalizations', () => {
    expect(coversLocator('/work/a/', '/work/a/x')).toBe(true)
    expect(coversLocator('/work/a', '/work/a/./x')).toBe(true)
    expect(locatorsEquivalent('/work/a/', '/work/a')).toBe(true)
    expect(locatorsEquivalent('/work/a', '/work/a/.')).toBe(true)
    expect(locatorsEquivalent('./out', 'out')).toBe(true)
    expect(locatorsEquivalent('./out', './out/')).toBe(true)
    // ...but an absolute and a relative locator are never equivalent
    expect(locatorsEquivalent('/work/a', 'work/a')).toBe(false)
  })

  it('`..` never folds', () => {
    expect(toLocatorKey('/work/a/../b').segments).toEqual(['work', 'a', '..', 'b'])
    expect(locatorsEquivalent('/work/a/../b', '/work/b')).toBe(false)
    expect(coversLocator('/work/b', '/work/a/../b')).toBe(false)
  })

  it('Windows-style separators separate segments', () => {
    expect(coversLocator('C:\\work\\a', 'C:/work/a/x')).toBe(true)
    expect(coversLocator('C:\\work\\a', 'C:\\work\\ab')).toBe(false)
    expect(locatorsEquivalent('\\work\\a\\', '/work/a')).toBe(true)
    expect(locatorsEquivalent('C:\\work\\a', 'C:/work/a')).toBe(true)
  })

  it('lane decisions: deny wins, ask is stricter than allow, absence is deny', () => {
    const restricted = lane('restricted', ['/work/a'], ['/work/a/pending'], ['/work/a/secret'])
    expect(matchLocator(restricted, '/work/a/x')).toBe('allow')
    expect(matchLocator(restricted, '/work/a')).toBe('allow')
    expect(matchLocator(restricted, '/work/a/pending')).toBe('ask')
    expect(matchLocator(restricted, '/work/a/secret/key')).toBe('deny')
    expect(matchLocator(restricted, '/work/b')).toBe('deny')
    // deny also wins under an `all` lane, and it is subtree-aware
    expect(matchLocator(lane('all', [], [], ['/secret']), '/secret/x')).toBe('deny')
    expect(matchLocator(lane('all', [], [], ['/secret']), '/not-secret')).toBe('allow')
  })
})

// --- 2. symlink escape, resolved by the real filesystem ---------------------

describe('P1-03 · symlink escape is refused by provider-resolved identity', () => {
  it('denies a symlink authored inside an allowed subtree that resolves outside it', async () => {
    const decision = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(allowedDir, 'escape.txt'),
      access: 'read',
    })
    expect(decision.decision).toBe('deny')
    if (decision.decision !== 'deny') return
    expect(decision.code).toBe('PATH_SYMLINK_ESCAPE')
    expect(Object.isFrozen(decision)).toBe(true)
  })

  it('denies a symlinked PARENT directory that resolves outside the subtree', async () => {
    const decision = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(allowedDir, 'escape-dir', 'secret.txt'),
      access: 'read',
    })
    expect(decision.decision).toBe('deny')
    if (decision.decision !== 'deny') return
    expect(decision.code).toBe('PATH_SYMLINK_ESCAPE')
  })

  it('allows a symlink that resolves inside the allowed subtree', async () => {
    const decision = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(allowedDir, 'inside-link.txt'),
      access: 'read',
    })
    expect(decision.decision).toBe('allow')
    if (decision.decision !== 'allow') return
    expect(decision.resolved).toBe(await realpath(join(allowedDir, 'inside.txt')))
    expect(decision.symlink).toBe(true)
  })

  it('a write target that does not exist yet resolves through its parent', async () => {
    const decision = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(allowedDir, 'new-file.txt'),
      access: 'write',
    })
    expect(decision.decision).toBe('allow')

    const escaped = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(allowedDir, 'escape-dir', 'new-file.txt'),
      access: 'write',
    })
    expect(escaped.decision).toBe('deny')
    if (escaped.decision !== 'deny') return
    expect(escaped.code).toBe('PATH_SYMLINK_ESCAPE')
  })

  it('is injectable: a fake resolver can prove the same law without the disk', async () => {
    const fakeIdentity: PathIdentity = {
      isSymbolicLink: () => true,
      isFile: () => false,
      isDirectory: () => false,
    }
    const resolver: PathIdentityResolver = {
      lstat: async () => fakeIdentity,
      realpath: async () => join(outsideDir, 'secret.txt'),
    }
    const decision = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(allowedDir, 'escape.txt'),
      resolver,
    })
    expect(decision.decision).toBe('deny')
    if (decision.decision !== 'deny') return
    expect(decision.code).toBe('PATH_SYMLINK_ESCAPE')
  })

  it('fails closed to `unsupported` when identity cannot be resolved at all', async () => {
    const identity: PathIdentity = {
      isSymbolicLink: () => false,
      isFile: () => true,
      isDirectory: () => false,
    }
    const resolver: PathIdentityResolver = {
      lstat: async () => identity,
      realpath: async () => {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
      },
    }
    const decision = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(allowedDir, 'inside.txt'),
      resolver,
    })
    expect(decision.decision).toBe('unsupported')
    if (decision.decision !== 'unsupported') return
    expect(decision.code).toBe('PATH_RESOLUTION_UNSUPPORTED')
  })

  it('never resolves or allows a locator the authored lane already refuses', async () => {
    const decision = await evaluateLocatorAccess({
      lane: allowedLane(),
      locator: join(outsideDir, 'secret.txt'),
    })
    expect(decision.decision).toBe('deny')
    if (decision.decision !== 'deny') return
    expect(decision.code).toBe('PATH_NOT_ALLOWED')
  })

  it('refuses a write through a DANGLING symlink (never approves the link name)', async () => {
    const link = join(allowedDir, 'dangling')
    try {
      await rm(link, { force: true })
    } catch {
      // absent is fine
    }
    await symlink(join(outsideDir, 'never-created.txt'), link)
    const decision = await evaluateLocatorAccess({ lane: allowedLane(), locator: link, access: 'write' })
    expect(decision.decision).toBe('deny')
    if (decision.decision !== 'deny') return
    expect(decision.code).toBe('PATH_SYMLINK_ESCAPE')
    await rm(link, { force: true })
  })
})

// --- 3. legal hardlink alias: path-based, not inode-based -------------------

describe('P1-03 · legal hardlink aliasing is path-based', () => {
  it('allows a hardlink through its allowed path and refuses the denied path name', async () => {
    const allowedPath = join(allowedDir, 'alias.txt')
    const outsidePath = join(outsideDir, 'source.txt')

    // it really is one inode with two names (the old controlled-fs `nlink===1`
    // rule would have rejected the allowed name; the Member data plane must not)
    const viaAllowedStat = await stat(allowedPath)
    const viaOutsideStat = await stat(outsidePath)
    expect(viaAllowedStat.ino).toBe(viaOutsideStat.ino)
    expect(viaOutsideStat.nlink).toBe(2)

    const viaAllowed = await evaluateLocatorAccess({ lane: allowedLane(), locator: allowedPath })
    expect(viaAllowed.decision).toBe('allow')
    if (viaAllowed.decision !== 'allow') return
    expect(viaAllowed.resolved).toBe(allowedPath)

    const viaOutside = await evaluateLocatorAccess({ lane: allowedLane(), locator: outsidePath })
    expect(viaOutside.decision).toBe('deny')
    if (viaOutside.decision !== 'deny') return
    expect(viaOutside.code).toBe('PATH_NOT_ALLOWED')
  })

  it('a deny on the outside name does not leak into the allowed alias', async () => {
    const deniedOutside = lane('restricted', [allowedDir], [], [outsideDir])
    const viaAllowed = await evaluateLocatorAccess({
      lane: deniedOutside,
      locator: join(allowedDir, 'alias.txt'),
    })
    expect(viaAllowed.decision).toBe('allow')
  })
})

// --- 4. native write/edit requires read -------------------------------------

describe('P1-03 · native write/edit requires read', () => {
  it('refuses write/edit when the write axis allows but the read axis does not', () => {
    const read = lane('restricted', [])
    const write = lane('restricted', ['/work/b'])
    const result = checkWriteRequiresRead(read, write, '/work/b/out.txt')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('WRITE_REQUIRES_READ')
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('allows write/edit when both axes cover the target', () => {
    const read = lane('restricted', ['/work/b'])
    const write = lane('restricted', ['/work/b'])
    const result = checkWriteRequiresRead(read, write, '/work/b/out.txt')
    expect(result.ok).toBe(true)
  })

  it('is subtree-aware on both axes', () => {
    const read = lane('restricted', ['/work'])
    const write = lane('restricted', ['/work/b'])
    expect(checkWriteRequiresRead(read, write, '/work/b/deep/out.txt').ok).toBe(true)
    // a prefix-sharing sibling is not covered
    const siblingRead = lane('restricted', ['/work/bb'])
    expect(checkWriteRequiresRead(siblingRead, write, '/work/b/out.txt').ok).toBe(false)
  })

  it('an explicit read deny cannot be re-opened by an overlapping allow', () => {
    const read = lane('restricted', ['/work/b'], [], ['/work/b/secret'])
    const write = lane('restricted', ['/work/b'])
    const result = checkWriteRequiresRead(read, write, '/work/b/secret/out.txt')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('WRITE_REQUIRES_READ')
  })

  it('refuses a write target the write axis does not allow (write denial wins)', () => {
    const read = lane('all')
    const write = lane('restricted', ['/work/b'])
    const result = checkWriteRequiresRead(read, write, '/work/c/out.txt')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('WRITE_TARGET_NOT_WRITABLE')
  })
})

// --- 4b. mixed-mode intersection (all ∩ restricted) -------------------------

describe('P1-03 · mixed-mode intersection', () => {
  const all = (): PathRuleSet => Object.freeze({ mode: 'all', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) })
  const restricted = (...allow: string[]): PathRuleSet =>
    Object.freeze({ mode: 'restricted', allow: Object.freeze(allow), ask: Object.freeze([]), deny: Object.freeze([]) })

  it('Member `all` ∩ tool restricted keeps the TOOL lane (no deny-all collapse)', () => {
    const effective = intersectPathRuleSets(all(), restricted('/work/a/docs'))
    expect(effective.mode).toBe('restricted')
    expect([...effective.allow]).toEqual(['/work/a/docs'])
  })

  it('Member restricted ∩ tool `all` keeps the MEMBER lane', () => {
    const effective = intersectPathRuleSets(restricted('/work/a'), all())
    expect(effective.mode).toBe('restricted')
    expect([...effective.allow]).toEqual(['/work/a'])
  })

  it('both `all` stays `all` and both restricted intersects', () => {
    expect(intersectPathRuleSets(all(), all()).mode).toBe('all')
    const narrow = intersectPathRuleSets(restricted('/work/a'), restricted('/work/a/docs'))
    expect([...narrow.allow]).toEqual(['/work/a/docs'])
  })

  it('a deny on either side survives the mixed-mode intersection', () => {
    const denied = Object.freeze({
      mode: 'restricted' as const,
      allow: Object.freeze(['/work/a/docs']),
      ask: Object.freeze([]),
      deny: Object.freeze(['/work/a/docs/secret']),
    })
    const effective = intersectPathRuleSets(all(), denied)
    expect([...effective.allow]).toEqual(['/work/a/docs'])
    expect([...effective.deny]).toEqual(['/work/a/docs/secret'])
  })
})

// --- 5. Provider capability coverage ----------------------------------------

function providerWith(methods: readonly string[]): Readonly<Record<string, unknown>> {
  const provider: Record<string, unknown> = {}
  for (const method of methods) provider[method] = () => undefined
  return provider
}

describe('P1-03 · ctx.fs provider capability coverage', () => {
  it('declares the closed managed-path vocabulary', () => {
    expect(MANAGED_FS_METHODS.length).toBe(13)
    expect([...MANAGED_FS_METHODS]).toEqual([
      'resolve',
      'processPath',
      'contains',
      'stat',
      'lstat',
      'readText',
      'streamText',
      'readBytes',
      'readByteRange',
      'listDir',
      'watch',
      'writeText',
      'editText',
    ])
  })

  it('a complete provider passes and enumerates the needed methods', () => {
    const result = requireProviderCapabilities(providerWith(MANAGED_FS_METHODS))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.value.methods]).toEqual([...MANAGED_FS_METHODS])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('a provider missing one method is a typed unsupported refusal naming it', () => {
    const provider = providerWith(MANAGED_FS_METHODS.filter((method) => method !== 'watch'))
    const result = requireProviderCapabilities(provider)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.decision).toBe('unsupported')
    expect(result.code).toBe('PROVIDER_CAPABILITY_MISSING')
    expect([...result.missing]).toEqual(['watch'])
    expect(result.detail).toContain('watch')
  })

  it('names EVERY missing method, in declaration order', () => {
    const provider = providerWith(MANAGED_FS_METHODS.filter((method) => method !== 'readText' && method !== 'watch'))
    const result = requireProviderCapabilities(provider)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect([...result.missing]).toEqual(['readText', 'watch'])
    expect(result.detail).toContain('readText')
    expect(result.detail).toContain('watch')
  })

  it('never degrades to "all read" when a read method is absent', () => {
    const provider = providerWith(MANAGED_FS_METHODS.filter((method) => method !== 'readText'))
    const result = requireProviderCapabilities(provider, ['readText', 'streamText'])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('PROVIDER_CAPABILITY_MISSING')
    expect([...result.missing]).toEqual(['readText'])
    // and the refusal result carries no permission grant at all
    expect(result).not.toHaveProperty('value')
  })

  it('an unknown/extra method does not help a missing capability', () => {
    const provider = {
      ...providerWith(MANAGED_FS_METHODS.filter((method) => method !== 'watch')),
      rawNodeFs: () => undefined,
    }
    const result = requireProviderCapabilities(provider)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('PROVIDER_CAPABILITY_MISSING')
    expect([...result.missing]).toEqual(['watch'])

    // asking for a method outside the closed vocabulary is unsupported, even
    // when the provider happens to expose a same-named extra function
    const unknown = requireProviderCapabilities(provider, ['readText', 'rawNodeFs'])
    expect(unknown.ok).toBe(false)
    if (unknown.ok) return
    expect(unknown.code).toBe('PROVIDER_CAPABILITY_UNKNOWN')
    expect([...unknown.missing]).toEqual(['rawNodeFs'])
  })

  it('rejects a non-function capability slot even when the key exists', () => {
    const provider: Record<string, unknown> = { ...providerWith(MANAGED_FS_METHODS), readText: 'not a function' }
    const result = requireProviderCapabilities(provider)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect([...result.missing]).toEqual(['readText'])
  })
})
