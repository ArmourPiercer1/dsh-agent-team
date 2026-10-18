/**
 * GLUE-8 — the v4 EXECUTION FEED assembly units (alpha5-glue8-v4feed).
 *
 * Scope (root ruling, verbatim in the evidence README): the v4-flip 14/14 is
 * the v4 DOCUMENT/CREATION chain; dispatch stayed binding fail-closed; that
 * round is NOT the v4 tool-execution acceptance. These units pin the
 * ASSEMBLY facts the live kit (`dev/agent-workflow/evidence/alpha5/
 * glue8-v4feed/run-v4-feed-live.mjs`) rides:
 *
 *   U1  the v4 authoring family (toolBindings) PARSES and rides the hash —
 *       and its CLOSED SHAPE is pinned to have NO implementation-identity
 *       field (no digest, no def-anchor). This is the STOP evidence for the
 *       assembly-side consumption of the document face: the Guard's verified
 *       identity is the placement-time runtime fingerprint (`def#N`), and
 *       nothing in the authoring family names it — mapping the two WOULD BE
 *       new semantics, root's to adjudicate, not this round's to invent.
 *   U2  the identity algebra the feed DOES use: definitionIdentityOf is a
 *       stable per-object fingerprint (same body -> same id, different body
 *       -> different id, non-object -> null).
 *   U3  the plane assembly answers the placement feed with THAT identity for
 *       the defs it places (the #313 channel, era-agnostic by construction —
 *       the SAME objects the v4 world's row config will place).
 *   U4  the live kit artifact itself carries the assembled face (anti-drift):
 *       the row config gains teamToolPlane with the governed root + confined
 *       provider, and the v4 blueprint keeps the full toolBindings family.
 *
 * The version-clean fence (A4-PR7): every version/digit rides a named
 * constant through a template — no `key: <digit>` string sites here.
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests/homes', `a5g8-unit-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')

type TD = { definitionIdentityOf: (target: unknown) => string | null }
type PlaneRow = {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
}
type PlaneDef = { name: string; execute: (raw: unknown) => Promise<{ text: string }> }
type PlaneValue = {
  ownNames: readonly string[]
  placementNames: readonly string[]
  definitions: readonly PlaneDef[]
  /** the pb §6 provider-side feed (the seam's flat BindingFeedEntry shape) */
  placementFeed: (name: string) => { definitionIdentity: string; realmId: string } | undefined
}
type BlueprintMod = {
  // THE production entry: parse -> validate -> derive hash in one call
  // (a5fl1:198 — the returned blueprint is validated AND hashed; the
  // pre-hash core stage is validateBlueprintDocument on a hashless input).
  parseBlueprint: (source: string) => Record<string, unknown>
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS: readonly number[]
}

const ALLOW_ALL = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})
const REALM = 'a5g8-unit-realm'
let row: PlaneRow
let td: TD

beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  td = (await import(new URL('../tool-dispatch/index.js', import.meta.url).href)) as unknown as TD
  mkdirSync(ROOT_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'g8-unit.txt'), 'A5G8-UNIT-BYTES-7 token G8QZ\n')
})
afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

/** Named constant — the sanctioned carrier of the version digit (a5fl1 law). */
const V4_DIGIT = 4 // position of the v4 digit is NOT assumed: U1 asserts it

function v4AuthoringYaml(): string {
  return [
    '---',
    `schemaVersion: ${String(V4_DIGIT)}`,
    'blueprintId: team.a5g8-unit',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "a5g8 unit leader"',
    '  capabilities:',
    '    teamTools: { kind: allow, items: [team_delegate, team_create_member, team_collect, team_list_members, team_list_templates] }',
    '    builtinToolDeny: []',
    '    skills: { kind: allow, items: [] }',
    '    mcp: { kind: allow, items: [] }',
    'members:',
    '  - templateId: worker',
    '    persona: "a5g8 unit worker"',
    '    capabilities:',
    '      teamTools: { kind: deny }',
    '      builtinToolDeny: []',
    '      skills: { kind: allow, items: [] }',
    '      mcp: { kind: allow, items: [] }',
    '      permissions: { default: ask, allow: [], ask: [], deny: [] }',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope: { allow: [send-message, report-progress, request-control], deny: [] }',
    `requirements: []`,
    'teamEnvelope:',
    '  allow: [create-member, assign-task, send-message, report-progress, request-control, resolve-control]',
    '  deny: []',
    'permissionMutationEnvelope: { rules: [] }',
    'teamHardEnvelope: { rules: [] }',
    `policyStates: []`,
    'metadata: {}',
    'toolBindings:',
    '  - owner: dsh.core',
    '    name: bash',
    '    authorization: allow',
    '    io:',
    '      read: { mode: all, deny: [] }',
    '      write: { mode: restricted, allow: ["."], ask: [], deny: [".git"] }',
    '      network: { mode: deny, default: deny }',
    '    execution:',
    '      implementationOrigin: dsh-native',
    '      executionBoundary: confined-subprocess',
    '---',
    '',
  ].join('\n')
}

describe('GLUE-8 v4 execution feed — assembly facts', () => {
  it('U1 the v4 authoring family parses, rides the hash, and carries NO implementation-identity field (the stop pin: mapping it onto def#N would be NEW semantics)', async () => {
    const bp = (await import(new URL('../../domain/blueprint/src/index.js', import.meta.url).href)) as BlueprintMod
    expect(bp.SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS).toContain(V4_DIGIT)
    // the a5fl1 API law: the production entry RETURNS the document and
    // THROWS a contract error on refusal — no ok-wrapper.
    const doc = bp.parseBlueprint(v4AuthoringYaml())
    expect(doc['schemaVersion']).toBe(V4_DIGIT)
    // present-only hash: the family rides the content hash (two documents
    // differing only in toolBindings hash differently — the flip round pins
    // the general law; here: THIS doc hashes with the family present).
    expect(String(doc['contentHash'])).toMatch(/^sha256:/)
    const bindings = doc['toolBindings'] as readonly Record<string, unknown>[]
    expect(Array.isArray(bindings)).toBe(true)
    expect(bindings.length).toBe(1)
    const b = bindings[0] as Record<string, unknown>
    // CLOSED authoring shape — pinned against drift in BOTH directions:
    const keys = Object.keys(b).sort()
    expect(keys).toEqual(['authorization', 'execution', 'io', 'name', 'owner'])
    // THE STOP PIN: no digest / no definition identity / no placement anchor
    // anywhere in the authoring family (deep). The Guard's verified identity
    // is the placement-time fingerprint; the document face never names it.
    const flat = JSON.stringify(b)
    expect(flat).not.toContain('digest')
    expect(flat).not.toContain('def#')
    expect(flat).not.toContain('identity')
  })

  it('U2 the feed identity algebra: definitionIdentityOf is the stable per-object body fingerprint (def#N), NOT a name or a document field', () => {
    const bodyA = { execute: () => undefined }
    const bodyB = { execute: () => undefined }
    const idA1 = td.definitionIdentityOf(bodyA)
    const idA2 = td.definitionIdentityOf(bodyA)
    const idB = td.definitionIdentityOf(bodyB)
    expect(idA1).toMatch(/^def#\d+$/)
    expect(idA2).toBe(idA1) // stable across calls (WeakMap memo)
    expect(idB).not.toBe(idA1) // distinct bodies, distinct identities
    expect(td.definitionIdentityOf(null)).toBeNull()
    expect(td.definitionIdentityOf('a string is never a body')).toBeNull()
  })

  it('U3 the plane answers the placement feed with exactly that identity for the defs it places (the era-agnostic #313 channel the v4 row config rides)', () => {
    const built = row.createTeamToolPlaneAssembly({
      permissionPolicy: ALLOW_ALL,
      realmId: REALM,
      templateId: 'worker',
      role: 'member',
      instanceId: 'a5g8-unit-inst',
      plane: {
        realmId: REALM,
        fsInstance: { fs: 'a5g8-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
      },
    })
    expect(built.ok, JSON.stringify(built)).toBe(true)
    if (!built.ok) return
    // The placement rows the v4 world rides: read/grep/bash placed, glob the
    // honest typed shut (CANDIDATE-A never shipped — its row stays shut until
    // the standalone integration round).
    expect(built.value.placementNames).toEqual(expect.arrayContaining(['team_grep', 'team_bash', 'team_glob', 'read']))
    for (const name of built.value.placementNames) {
      const d = built.value.definitions.find((x) => x.name === name)
      if (d === undefined) throw new Error(`no def ${name}`)
      const id = td.definitionIdentityOf(d)
      expect(id, `no feed identity mintable for ${name}`).not.toBeNull()
      // The provider-side pb §6 feed answers with the SAME fingerprint the
      // seam mints off the placed def, paired with this realm — one algebra,
      // no name fallback, no guessed identity for unplaced names.
      const fed = built.value.placementFeed(name) as { definitionIdentity: string; realmId: string } | undefined
      expect(fed).toBeDefined()
      expect(fed?.definitionIdentity).toBe(id)
      expect(fed?.realmId).toBe(REALM)
    }
    // Unplaced name: NO feed row (the Guard's no-feed refusal is the honest
    // landing — fail closed, never a guessed identity).
    expect(built.value.placementFeed('no-such-tool-a5g8')).toBeUndefined()
  })

  it('U4 anti-drift on the live kit artifact: the assembled row config carries the plane, the governed root, the confined provider, and the v4 document keeps the full authoring family', () => {
    const kit = join(REPO, 'dev/agent-workflow/evidence/alpha5/glue8-v4feed/run-v4-feed-live.mjs')
    expect(existsSync(kit)).toBe(true)
    const src = readFileSync(kit, 'utf8')
    expect(src).toContain("cfg.teamToolPlane = {")
    expect(src).toContain("rootDir: GOV_DIR")
    expect(src).toContain("launcherPath: LAUNCHER")
    expect(src).toContain("a5g8-v4-realm")
    // the fail-closed RED face exists too (the preassembly branch is real,
    // not a comment): realm suffixed -pre, no fsInstance/confinedProvider.
    expect(src).toContain("a5g8-v4-realm-pre")
    // and the kit still authors the FULL v4 family into the blueprint:
    expect(src).toContain("'    execution:'")
    expect(src).toContain('executionBoundary: confined-subprocess')
  })
})
