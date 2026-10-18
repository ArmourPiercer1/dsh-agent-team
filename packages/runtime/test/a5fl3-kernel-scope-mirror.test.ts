/**
 * a5fl3 — the KERNEL MIRROR half of the M-3 atomic pair (grammar/coverage
 * half: `packages/domain/test/a5fl2-envelope-scope-mirror.test.ts`).
 *
 * The flip-PREP atom says the flip must not leave a v4 declaration pointing
 * at a hole: whatever the envelope Scope grammar newly names, the kernel
 * must either already mean or explicitly, loudly not-yet-mean. This suite
 * pins the kernel side of that sentence:
 *
 *  1. the kernel's tables ARE the leaf's tables (object identity, the
 *     a3p3 precedent): the flip added no parallel ladder, no parallel
 *     matcher-kind set, no parallel coverage function on the runtime side;
 *  2. the write-time classifier still answers `unknown` for every
 *     v4-scope token — grammar is NOT acceptance: nothing may yet declare
 *     an `fs-metadata`/`network-destination`/`domain-reference` envelope
 *     rule, and the three `opClass === 'unknown'` refusal sites keep
 *     refusing them exactly like any other unknown token;
 *  3. the resource vocabulary the effect round will canonicalize INTO is
 *     already present on the resource mirror (`metadata`,
 *     `network-destination` in the closed `RESOURCE_KINDS`) — the delta
 *     classes NAME shapes, they do not invent surfaces;
 *  4. the authority-ceiling reader now follows the RUN SET (the flip's
 *     runtime atom, re-measured): a v4-bound Team gets the SAME governed
 *     ceiling context as v3 — never the unreadable refusal — while a
 *     never-defined binding still answers the refusal.
 *
 * @module test/a5fl3-kernel-scope-mirror
 */
import { describe, expect, it } from 'vitest'
import {
  AUTHORITY_EFFECT_PRECEDENCE,
  AUTHORITY_MATCHER_KINDS,
  AUTHORITY_V4_SCOPE_CLASSES,
  matcherCovers as LEAF_matcherCovers,
} from '../../domain/authority-envelope/src/index.js'
import { RESOURCE_KINDS } from '../../domain/tool-governance/src/resource.js'
import {
  classifyPermissionOperationClass,
  matcherCovers,
  PERMISSION_EFFECT_PRECEDENCE,
  PERMISSION_RESOURCE_MATCHER_KINDS,
} from '../governance/permission-mutation.js'
import { createAuthorityCeilingReader } from '../src/plugin/permission-plane.js'

describe('a5fl3 kernel mirror — same objects, same functions (zero parallel ladders)', () => {
  it('the kernel tables are IDENTITY re-exports of the leaf (toBe: a rebuilt table cannot pass)', () => {
    expect(PERMISSION_EFFECT_PRECEDENCE).toBe(AUTHORITY_EFFECT_PRECEDENCE)
    expect(PERMISSION_RESOURCE_MATCHER_KINDS).toBe(AUTHORITY_MATCHER_KINDS)
    expect(matcherCovers).toBe(LEAF_matcherCovers)
  })
})

describe('a5fl3 grammar is not acceptance — the write-time gate still refuses the delta by name', () => {
  it('classifyPermissionOperationClass answers `unknown` for every v4-scope token, like any other unknown', () => {
    for (const cls of AUTHORITY_V4_SCOPE_CLASSES) {
      expect(classifyPermissionOperationClass(cls)).toBe('unknown')
    }
    // The v3 tokens keep their classes (the classifier did not move).
    expect(classifyPermissionOperationClass('read')).toBe('fs')
    expect(classifyPermissionOperationClass('bash')).toBe('exec')
  })
})

describe('a5fl3 the resource surface the effect round maps INTO already exists', () => {
  it('the closed resource-kind set already carries the fs-metadata and network-destination shapes', () => {
    // The delta CLASSES are envelope operation types; their resources are
    // the resource plane's existing kinds. `domain-reference` deliberately
    // has no resource kind — a TeamDomain reference is session-domain
    // identity, matched by exact identity, never canonicalized as a
    // resource path (the exact-only law in a5fl2 is its whole semantics).
    expect(RESOURCE_KINDS).toContain('metadata')
    expect(RESOURCE_KINDS).toContain('network-destination')
    expect([...RESOURCE_KINDS]).not.toContain('domain-reference')
    expect([...RESOURCE_KINDS]).toEqual([
      'workspace',
      'realm-home',
      'absolute-path',
      'directory',
      'metadata',
      'network-destination',
    ])
  })
})

describe('a5fl3 the ceiling reader follows the RUN SET (the flip runtime atom, re-measured here)', () => {
  const factsFor = (schemaVersion: number | undefined) => ({
    blueprintSchemaVersion: () => schemaVersion,
    blueprintContentHash: () => (schemaVersion === undefined ? undefined : 'sha256:'.padEnd(71, '0')),
    teamHardEnvelope: async () => ({ status: 'declared' as const, document: { rules: [] } }),
    permissionEnvelope: async () => ({ rules: [] }),
  })

  it('a v4-bound Team is a GOVERNED context, exactly like v3 — the unreadable refusal it took pre-flip is gone', async () => {
    const reader4 = createAuthorityCeilingReader({ facts: factsFor(4) as never })
    const ctx4 = await reader4('team-1', 'member-1', 'leader')
    expect(ctx4).toBeDefined()
    expect(ctx4?.documents.teamHardEnvelope).toMatchObject({ status: 'declared' })
    const reader3 = createAuthorityCeilingReader({ facts: factsFor(3) as never })
    const ctx3 = await reader3('team-1', 'member-1', 'leader')
    expect(ctx3?.documents.teamHardEnvelope).toMatchObject({ status: 'declared' })
    // Same shape both versions: the v4 core face IS the v3 output, so the
    // ceiling lane reads the same documents.
    expect(Object.keys(ctx4?.documents ?? {}).sort()).toEqual(Object.keys(ctx3?.documents ?? {}).sort())
  })

  it('the arms the flip did NOT move stay put: {1,2} still take the existential skip, a never-defined version still refuses unreadable', async () => {
    for (const retired of [1, 2]) {
      const reader = createAuthorityCeilingReader({ facts: factsFor(retired) as never })
      expect(await reader('team-1', 'member-1', 'leader')).toBeUndefined()
    }
    for (const unknownVersion of [5, 99, undefined]) {
      const reader = createAuthorityCeilingReader({ facts: factsFor(unknownVersion) as never })
      const ctx = await reader('team-1', 'member-1', 'leader')
      expect(ctx?.documents.teamHardEnvelope).toMatchObject({ status: 'unavailable' })
    }
  })
})
