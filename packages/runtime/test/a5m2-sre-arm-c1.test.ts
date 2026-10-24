/**
 * A5M2 FS-EDIT card PART D — the B-SRE arm + grammar leaf pin.
 *
 * The four command groups walk the REAL signed grammar
 * (validatePaFamilyTarget answers each minted manifest), the closed effect
 * sets per branch are asserted leg-for-leg (view has NO write; create has
 * NO read; str_replace/insert carry the M-02 paired read), the bound law
 * leaves are verified as PAIRED CONSTANTS (a swapped never-creates literal
 * denies), and the arm's plane-mount laws (identity pairing, anchor,
 * grant pairing) mirror the edit arm's pins.
 *
 * @module packages/runtime/test/a5m2-sre-arm-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'
import { validatePaFamilyTarget } from '../control/types.js'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-sre-arm: no repo root carrying tests/paths.mjs — failing closed')
const WORLD = mkdtempSync(join(homeRoot(REPO), `a5m2-sre-arm-${Date.now().toString(36)}-`))
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const MOD = (await import(new URL('../src/plugin/live/governed-families/sre.mjs', import.meta.url).href)) as {
  A5_SRE_FAMILY_ID: string
  A5_SRE_ADAPTER_REVISION: number
  A5_SRE_TOOL_NAME: string
  createGovernedSreArm: (deps: Record<string, unknown>) => {
    familyId: string
    adapterRevision: number
    classify: (args: unknown, exec: Record<string, unknown>, callId: string) => { ok: boolean; code?: string; detail?: string; plan?: unknown; manifest?: Record<string, unknown>; effects?: Array<{ kind: string; toolName?: string; resource?: { canonicalLocator?: string } | null }> }
    prepare: (plan: unknown, grant: Record<string, unknown>) => { ok: boolean; code?: string }
    execute: (plan: unknown, consumed: Record<string, unknown>) => Promise<{ ok: boolean; code?: string; detail?: string }>
    cancel: (plan: unknown) => Record<string, unknown>
    drain: () => void
  }
}
const { A5_SRE_FAMILY_ID, A5_SRE_ADAPTER_REVISION, A5_SRE_TOOL_NAME, createGovernedSreArm } = MOD

function mkArm(): ReturnType<typeof createGovernedSreArm> {
  return createGovernedSreArm({
    definitionIdentity: 'sha256:captured-native-sre-identity',
    providerId: 'a5p5-plane',
    realmId: 'realm-sre-arm',
    memberAgentId: 'agent-worker',
    sessionHeaderId: 'ses-sre-header',
    instanceRootDir: WORLD,
    bindingFacts: () => ({ bindingId: 'b-sre', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
    observe: () => {},
  })
}
const EXEC = { agent: { id: 'agent-worker', session: { header: { id: 'ses-sre-header' } } } }

describe('A5M2 B-SRE arm + grammar (PART D)', () => {
  it('family identity: B-SRE revision 1 behind the native tool name', () => {
    expect(A5_SRE_FAMILY_ID).toBe('B-SRE')
    expect(A5_SRE_TOOL_NAME).toBe('str_replace_editor')
    expect(A5_SRE_ADAPTER_REVISION).toBe(1)
  })

  it('view: I + R ONLY (no write); the manifest validates against the signed view group; the bound never-creates literal is a PAIRED constant', () => {
    const arm = mkArm()
    const r = arm.classify({ command: 'view', path: 'notes.txt' }, EXEC, 'call-v')
    expect(r.ok, String(r.detail)).toBe(true)
    expect((r.effects ?? []).map((e) => e.kind)).toEqual(['tool-invoke', 'read'])
    expect(JSON.stringify(r.effects)).toContain('"canonicalLocator"')
    const m = r.manifest as Record<string, unknown>
    expect(m.operation).toBe('sre-view')
    expect(m.sreVariant).toBe('view')
    expect(m.creationPossible).toBe(false)
    expect(m.viewRange).toBe('none')
    expect(m.maxOutputChars).toBe(16_000)
    expect(String(m.readEffectLaw)).toContain('另需 read effect')
    expect(validatePaFamilyTarget('B-SRE', m)).toBeUndefined()
    // the bound literal is a paired constant, not an arbitrary string:
    expect(validatePaFamilyTarget('B-SRE', { ...m, neverCreatesLaw: 'anything' }))
      .toBe("neverCreatesLaw: not the 'view' variant constant of the B-SRE typed plan")
    // a write leg smuggled into the view manifest's own effect set cannot be
    // validated away — the GROUP closed-key law refuses an extra leaf:
    expect(validatePaFamilyTarget('B-SRE', { ...m, fileTextFingerprint: 'sha256:x' }))
      .toBe("fileTextFingerprint: not part of the B-SRE typed plan")
  })

  it('view_range rides at FULL VALUE; a malformed one never earns an approval', () => {
    const arm = mkArm()
    const r = arm.classify({ command: 'view', path: 'notes.txt', view_range: [2, -1] }, EXEC, 'call-vr')
    expect(r.ok).toBe(true)
    expect((r.manifest as Record<string, unknown>).viewRange).toBe('[2, -1]')
    expect(validatePaFamilyTarget('B-SRE', r.manifest as Record<string, unknown>)).toBeUndefined()
    const bad = arm.classify({ command: 'view', path: 'notes.txt', view_range: [0, 3] }, EXEC, 'call-vb')
    expect(bad.ok).toBe(false)
    const three = arm.classify({ command: 'view', path: 'notes.txt', view_range: [1, 2, 3] }, EXEC, 'call-v3')
    expect(three.ok).toBe(false)
  })

  it('create: I + F ONLY (no read, no echo); creationPossible TRUE rides the bound creation law (the only group allowed to)', () => {
    const arm = mkArm()
    const r = arm.classify({ command: 'create', path: 'fresh.txt', file_text: 'hello\n' }, EXEC, 'call-c')
    expect(r.ok, String(r.detail)).toBe(true)
    expect((r.effects ?? []).map((e) => e.kind)).toEqual(['tool-invoke', 'write'])
    const m = r.manifest as Record<string, unknown>
    expect(m.creationPossible).toBe(true)
    expect(String(m.fileTextFingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(String(m.createFileLaw)).toContain('O_EXCL')
    expect(m.readEffectLaw).toBeUndefined()
    expect(m.echoLaw).toBeUndefined()
    expect(validatePaFamilyTarget('B-SRE', m)).toBeUndefined()
    // the bound creation law is a PAIRED constant: the literal swapped, the
    // create group denies (the required boolean leaf itself rides arm+
    // vertical law; the grammar binds only adds leaves — disclosed):
    expect(validatePaFamilyTarget('B-SRE', { ...m, creationLaw: 'anything' }))
      .toBe("creationLaw: not the 'create' variant constant of the B-SRE typed plan")
  })

  it('str_replace: I + R + F (M-02 paired read); old/new fingerprints; new_str null is the native typed refusal', () => {
    const arm = mkArm()
    const r = arm.classify({ command: 'str_replace', path: 'notes.txt', old_str: 'a', new_str: 'b' }, EXEC, 'call-s')
    expect(r.ok, String(r.detail)).toBe(true)
    expect((r.effects ?? []).map((e) => e.kind)).toEqual(['tool-invoke', 'read', 'write'])
    const m = r.manifest as Record<string, unknown>
    expect(m.sreVariant).toBe('str_replace')
    expect(String(m.readEffectLaw)).toContain('同一受治理读臂')
    expect(validatePaFamilyTarget('B-SRE', m)).toBeUndefined()
    const nullNew = arm.classify({ command: 'str_replace', path: 'notes.txt', old_str: 'a', new_str: null }, EXEC, 'call-sn')
    expect(nullNew.ok).toBe(false)
    expect(String(nullNew.detail)).toContain('new_str null')
    const emptyOld = arm.classify({ command: 'str_replace', path: 'notes.txt', old_str: '', new_str: 'b' }, EXEC, 'call-se')
    expect(emptyOld.ok).toBe(false)
  })

  it('insert: I + R + F; insertLine rides at FULL VALUE; missing new_str refuses', () => {
    const arm = mkArm()
    const r = arm.classify({ command: 'insert', path: 'notes.txt', insert_line: 2, new_str: 'l' }, EXEC, 'call-i')
    expect(r.ok, String(r.detail)).toBe(true)
    expect((r.effects ?? []).map((e) => e.kind)).toEqual(['tool-invoke', 'read', 'write'])
    const m = r.manifest as Record<string, unknown>
    expect(m.insertLine).toBe(2)
    expect(String(m.newStrFingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(validatePaFamilyTarget('B-SRE', m)).toBeUndefined()
    const noNew = arm.classify({ command: 'insert', path: 'notes.txt', insert_line: 2 }, EXEC, 'call-in')
    expect(noNew.ok).toBe(false)
  })

  it('the CLOSED parameter set + per-command law (no escalation lane, view_range confined to view)', () => {
    const arm = mkArm()
    const unknown = arm.classify({ command: 'view', path: 'x', sandbox_permissions: 'danger-full-access' }, EXEC, 'call-u')
    expect(unknown.ok).toBe(false)
    expect(String(unknown.code)).toContain('UNKNOWN_PARAMETER')
    const strayRange = arm.classify({ command: 'str_replace', path: 'x', old_str: 'a', view_range: [1, 2] }, EXEC, 'call-sr')
    expect(strayRange.ok).toBe(false)
    expect(String(strayRange.detail)).toContain('not allowed')
    const badCommand = arm.classify({ command: 'delete', path: 'x' }, EXEC, 'call-bc')
    expect(badCommand.ok).toBe(false)
  })

  it('identity pairing + anchor law mirror the edit arm (foreign session refuses; absolute spelling refuses)', () => {
    const arm = mkArm()
    const foreign = arm.classify({ command: 'view', path: 'x' }, { agent: { id: 'someone-else', session: { header: { id: 'ses-sre-header' } } } }, 'call-f')
    expect(foreign.ok).toBe(false)
    expect(String(foreign.code)).toContain('FOREIGN_SESSION')
    const abs = arm.classify({ command: 'view', path: '/etc/passwd' }, EXEC, 'call-a')
    expect(abs.ok).toBe(false)
    expect(String(abs.code)).toContain('ANCHOR_ESCAPE')
    const up = arm.classify({ command: 'view', path: '../escape' }, EXEC, 'call-u2')
    expect(up.ok).toBe(false)
  })

  it('execute answers only to the REAL consumed proof (the write/edit rows law)', async () => {
    const arm = mkArm()
    const r = arm.classify({ command: 'view', path: 'notes.txt' }, EXEC, 'call-x')
    expect(r.ok).toBe(true)
    const noProof = await arm.execute((r as { plan: unknown }).plan, { consumed: false })
    expect(noProof.ok).toBe(false)
    expect(String(noProof.code)).toContain('NOT_ADMITTED')
    // prepare BEFORE the pairing check (the arm's own law):
    arm.prepare((r as { plan: unknown }).plan, { grantId: 'g-x' })
    const mismatch = await arm.execute((r as { plan: unknown }).plan, { consumed: true, grant: { grantId: 'g-x', callId: 'other', parametersFingerprint: 'sha256:zz', bindingId: 'b-sre', bindingRevision: 1 } })
    expect(mismatch.ok).toBe(false)
    expect(String(mismatch.code)).toContain('GRANT_MISMATCH')
  })

  it('the grammar leaf itself: an unknown variant selects nothing; a missing group leaf denies', () => {
    expect(validatePaFamilyTarget('B-SRE', {
      familyId: 'B-SRE', adapterRevision: 1, operation: 'sre-x', realmId: 'r', canonicalTarget: '/x', sreVariant: 'delete', creationPossible: false,
    })).toContain('selects no B-SRE variant group')
    expect(validatePaFamilyTarget('B-SRE', {
      familyId: 'B-SRE', adapterRevision: 1, operation: 'sre-view', realmId: 'r', canonicalTarget: '/x', sreVariant: 'view', creationPossible: false,
    })).toContain('viewRange: required by the B-SRE typed plan, absent')
  })
})
