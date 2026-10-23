/**
 * A5M2-G1-SURFACE — the G1 thin surface adapters (14 records: B-CONTROL×5,
 * B-HUMAN×2, B-PRESENT, B-PLUGIN, B-INSPECT×2, B-SKILL, B-DEPENDENCY,
 * B-DOMAIN) proven against NATIVE DOUBLES:
 *
 *  - capture-present: the mounted row passes the double's OWN description
 *    and registration-face parameters through (by reference), classify is
 *    pure and answers the closed effect summary + full-VALUES fingerprint,
 *    and delegate enters EXACTLY the captured function value once;
 *  - capture-absent: every entry refuses the TYPED code
 *    `P_G1_NATIVE_CAPTURE_ABSENT` with zero native entry (and there is no
 *    name-based fallback to fall back to);
 *  - definition drift after bind: the delegate refuses
 *    `P_G1_DEFINITION_DRIFT`, the body never re-runs;
 *  - the record set equals the frozen dispatch index exactly (read from the
 *    shipped M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json, family-filtered);
 *  - r9 idiom, parameters direction: one nested-required CANONICAL
 *    registration face passes through the row UNCHANGED and is proven
 *    against the REAL Host639 validator
 *    (tests/deepseek-harness-test-use …/packages/core/tools/lib/index.js
 *    `assertSupportedJsonSchema` + `validateJsonSchemaValue`): parent
 *    `required` arrays at root/items/nested levels, NO property-level
 *    `required: true` marker ANYWHERE (deep sweep), constraints bind.
 *
 * Scope: NO Host process, NO network, NO mount. Windows-only execution
 * dimensions are NOT_RUN here (this Linux harness never claims them).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g1-surface-adapters
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

type ClassifyRefusal = { ok: false; code: string; detail: string }
type ClassifySuccess = {
  ok: true
  name: string
  familyId: string
  adapterRevision: number
  effects: Array<{ kind: string; toolName?: string; domainAuthorityId?: string; resource: null }>
  effectDeltaNotes: readonly string[]
  targetManifest: Record<string, unknown>
  parametersFingerprint: string
}
type ClassifyResult = ClassifySuccess | ClassifyRefusal

type G1Row = {
  name: string
  familyId: string
  recordIndex: number
  capturePresent: boolean
  descriptionFrom: string
  description: string | null
  parameters: Record<string, unknown> | null
  classify: (args: unknown) => ClassifyResult
  delegate: (ctx: { args: unknown; exec?: unknown }) => Promise<unknown>
}
type G1RecordSpec = {
  recordIndex: number
  family: string
  scope: string
  ownerRole: string
  nativeFace: string
  effectDeltaNotes: readonly string[]
}
type G1Module = {
  A5_G1_FAMILY_GROUP: string
  A5_G1_ADAPTER_REVISION: number
  A5_G1_TYPED_CODES: Record<
    'CAPTURE_ABSENT' | 'CLASSIFY_INVALID_ARGUMENTS' | 'CLASSIFY_UNKNOWN_PARAMETER' | 'CLASSIFY_MISSING_PARAMETER' | 'DEFINITION_DRIFT',
    string
  >
  A5_G1_RECORD_SPECS: Record<string, G1RecordSpec>
  g1SurfaceAdapterNames: () => string[]
  mountG1SurfaceAdapter: (
    recordName: string,
    deps?: { native?: unknown; providerId?: string; observe?: (row: { event: string; name: string; detail?: string }) => void },
  ) => G1Row
}

const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as G1Module

/** The nested-required CANONICAL registration face the ask_user_question
 * native double carries (the host tool-ask-user face @639ed01539 authored in
 * the defineTool INPUT DSL with per-property `required: true`; the
 * REGISTRATION face — what `tools.get` hands the glue — is the canonical
 * parent-array spelling below). */
const ASK_USER_CANONICAL_PARAMETERS = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: 'Questions to ask the user before continuing.',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string', description: 'Stable id for this question; echoed in the answer.' },
          question: { type: 'string', description: 'The specific question to ask the user.' },
          options: {
            type: 'array',
            description: 'Optional choices to show the user.',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                label: { type: 'string', description: 'Short user-facing option label.' },
                description: { type: 'string', description: 'One sentence explaining the tradeoff.' },
              },
              required: ['label'],
            },
          },
        },
        required: ['id', 'question'],
      },
    },
  },
  required: ['questions'],
}

type NativeCall = { args: unknown; exec: unknown }

/** The native double: a ToolDefinition-shaped object (or the Domain port for
 * the surface row) that RECORDS every entry — the row must enter exactly
 * this object, exactly once, with the arguments unchanged. */
function makeNativeDouble(recordName: string, spec: G1RecordSpec): { native: Record<string, unknown>; calls: NativeCall[] } {
  const calls: NativeCall[] = []
  const parameters = recordName === 'ask_user_question'
    ? structuredClone(ASK_USER_CANONICAL_PARAMETERS)
    : { type: 'object', properties: {}, }
  const body = async (args: unknown, exec: unknown): Promise<unknown> => {
    calls.push({ args, exec })
    return { nativeRan: recordName, family: spec.family }
  }
  if (spec.scope === 'surface') {
    return {
      native: {
        name: recordName,
        description: `native double (Domain effect-boundary port) of ${recordName}`,
        decide: body,
      },
      calls,
    }
  }
  return {
    native: {
      name: recordName,
      description: `native double of ${recordName}`,
      parameters,
      execute: body,
    },
    calls,
  }
}

/** One valid argument object per frozen record (the closed parameter sets
 * read from the fixed sources the specs record). */
const GOOD_ARGS: Record<string, Record<string, unknown>> = {
  skill: { name: 'gpt' },
  load_workspace_dependencies: {},
  ask_user_question: { questions: [{ id: 'q1', question: 'Which target?', options: [{ label: 'A' }] }] },
  exit_plan_mode: { plan: '# Plan\n\nDo the governed thing.' },
  present: { files: [{ path: 'out.md' }] },
  plugin_manager: { action: 'list_plugins' },
  cordis_inspect_list: {},
  cordis_inspect_query: { platform: 'host', provider: 'p', method: 'm' },
  team_request_control: {
    rootSessionId: 'root-1',
    requestToken: 'tok-1',
    kind: 'leader-approval',
    targetInstanceId: 'member-2',
    actionName: 'deploy',
  },
  team_resolve_control: { rootSessionId: 'root-1', requestToken: 'tok-2', requestId: 'req-1', decision: 'allow' },
  team_list_pending_control: { rootSessionId: 'root-1', requestToken: 'tok-3' },
  team_grant_permission: {
    rootSessionId: 'root-1',
    requestToken: 'tok-4',
    targetInstanceId: 'member-2',
    rules: [{ operationClass: 'file', matcher: { kind: 'exact', value: 'a.txt' }, effect: 'allow' }],
  },
  team_revoke_permission: {
    rootSessionId: 'root-1',
    requestToken: 'tok-5',
    targetInstanceId: 'member-2',
    rules: [{ operationClass: 'file', matcher: { kind: 'exact', value: 'a.txt' }, effect: 'allow' }],
  },
  'surface:domain_family': { toolName: 'write', domainAuthorityId: 'domain-acme', targetDigest: 'sha256:deadbeef' },
}

const NAMES = G1.g1SurfaceAdapterNames()
const byName = (name: string): G1RecordSpec => G1.A5_G1_RECORD_SPECS[name] as G1RecordSpec

describe('a5m2-g1-surface-adapters: 14 G1 records against native doubles', () => {
  it('the record set equals the frozen dispatch index (family-filtered, recordIndex-exact)', () => {
    const indexPath = fileURLToPath(new URL(
      '../../../docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json',
      import.meta.url,
    ).href)
    expect(existsSync(indexPath)).toBe(true)
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
      records: Array<{ recordIndex: number; name: string; family: string; scope: string; implementationOwnerRole: string }>
    }
    const g1Families = new Set(['B-CONTROL', 'B-HUMAN', 'B-PRESENT', 'B-PLUGIN', 'B-INSPECT', 'B-SKILL', 'B-DEPENDENCY', 'B-DOMAIN'])
    const expected = index.records.filter((r) => g1Families.has(r.family))
    expect(expected.length).toBe(14)
    expect(NAMES.length).toBe(14)
    for (const record of expected) {
      const spec = byName(record.name)
      expect(spec, `record ${record.name} is covered`).toBeDefined()
      expect(spec.recordIndex).toBe(record.recordIndex)
      expect(spec.family).toBe(record.family)
      expect(spec.scope).toBe(record.scope)
      expect(spec.ownerRole).toBe(record.implementationOwnerRole)
      expect(spec.nativeFace.length).toBeGreaterThan(0)
    }
    for (const name of NAMES) {
      expect(expected.some((r) => r.name === name), `module carries no extra record beyond the index: ${name}`).toBe(true)
    }
  })

  for (const name of NAMES) {
    describe(name, () => {
      it('capture-present: description + registration face pass through, classify is pure, delegate enters the captured body exactly once', async () => {
        const spec = byName(name)
        const { native, calls } = makeNativeDouble(name, spec)
        const row = G1.mountG1SurfaceAdapter(name, { native, providerId: 'g1-spec' })
        expect(row.capturePresent).toBe(true)
        expect(row.descriptionFrom).toBe('native-captured')
        expect(row.description).toBe(native.description)
        if (spec.scope !== 'surface') {
          // PASSTHROUGH BY REFERENCE: the row carries the captured face
          // itself — no copy, no rewrite, no re-spelling.
          expect(row.parameters).toBe(native.parameters)
        }
        const classified = row.classify(GOOD_ARGS[name])
        expect(classified.ok, JSON.stringify(classified)).toBe(true)
        const ok = classified as ClassifySuccess
        expect(ok.effects.length).toBe(1)
        if (spec.scope === 'surface') {
          expect(ok.effects[0]?.kind).toBe('domain-ref')
          expect(ok.effects[0]?.domainAuthorityId).toBe('domain-acme')
          expect(ok.effects[0]?.resource).toBeNull()
        } else {
          expect(ok.effects[0]?.kind).toBe('tool-invoke')
          expect(ok.effects[0]?.toolName).toBe(name)
          expect(ok.effects[0]?.resource).toBeNull()
        }
        expect(ok.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
        // FULL VALUES: one argument byte changes the fingerprint.
        const shifted = structuredClone(GOOD_ARGS[name]) as Record<string, unknown>
        const perturbFirstString = (value: unknown): boolean => {
          if (typeof value === 'string') return true
          if (Array.isArray(value)) return value.some(perturbFirstString)
          if (value !== null && typeof value === 'object') return Object.values(value).some(perturbFirstString)
          return false
        }
        const perturb = (value: unknown): void => {
          if (value === null || typeof value !== 'object') return
          if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === 'string') { value[value.indexOf(item)] = `${item}-x`; return }
              if (item !== null && typeof item === 'object') { perturb(item); }
            }
            return
          }
          const rec = value as Record<string, unknown>
          for (const key of Object.keys(rec)) {
            const child = rec[key]
            if (typeof child === 'string') { rec[key] = `${child}-x`; return }
            if (child !== null && typeof child === 'object') perturb(child)
          }
        }
        if (perturbFirstString(shifted)) {
          perturb(shifted)
          const again = row.classify(shifted)
          expect(again.ok, JSON.stringify(again)).toBe(true)
          if (again.ok) expect(again.parametersFingerprint).not.toBe(ok.parametersFingerprint)
        }
        const exec = { callId: 'call-1' }
        const value = await row.delegate({ args: GOOD_ARGS[name], exec })
        expect(value).toEqual({ nativeRan: name, family: spec.family })
        expect(calls.length).toBe(1)
        expect(calls[0]?.args).toBe(GOOD_ARGS[name])
        expect(calls[0]?.exec).toBe(exec)
      })

      it('capture-absent: every entry refuses P_G1_NATIVE_CAPTURE_ABSENT typed, zero native entry, no re-resolution', async () => {
        const row = G1.mountG1SurfaceAdapter(name, { native: undefined, providerId: 'g1-spec' })
        expect(row.capturePresent).toBe(false)
        expect(row.description).toBeNull()
        expect(row.parameters).toBeNull()
        const classified = row.classify(GOOD_ARGS[name])
        expect(classified.ok).toBe(false)
        expect((classified as ClassifyRefusal).code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
        const delegated = await row.delegate({ args: GOOD_ARGS[name], exec: {} })
        expect((delegated as ClassifyRefusal).ok).toBe(false)
        expect((delegated as ClassifyRefusal).code).toBe('P_G1_NATIVE_CAPTURE_ABSENT')
      })

      it('classify refuses undeclared top-level parameters (closed root) and missing required parameters', () => {
        const row = G1.mountG1SurfaceAdapter(name, { native: makeNativeDouble(name, byName(name)).native, providerId: 'g1-spec' })
        const polluted = row.classify({ ...GOOD_ARGS[name], __smuggled: 1 })
        expect(polluted.ok).toBe(false)
        expect((polluted as ClassifyRefusal).code).toBe('P_G1_CLASSIFY_UNKNOWN_PARAMETER')
        const required = (byName(name) as unknown as { requiredTopLevel: string[] })
        if (required.requiredTopLevel.length > 0) {
          const stripped: Record<string, unknown> = { ...GOOD_ARGS[name] }
          delete stripped[required.requiredTopLevel[0] as string]
          const missing = row.classify(stripped)
          expect(missing.ok).toBe(false)
          expect((missing as ClassifyRefusal).code).toBe('P_G1_CLASSIFY_MISSING_PARAMETER')
        }
      })

      it('definition drift after bind: the delegate refuses typed and never runs a moved body', async () => {
        const { native, calls } = makeNativeDouble(name, byName(name))
        const row = G1.mountG1SurfaceAdapter(name, { native, providerId: 'g1-spec' })
        const bodyKey = byName(name).scope === 'surface' ? 'decide' : 'execute'
        native[bodyKey] = async () => ({ nativeRan: 'IMPOSTOR' })
        const refused = (await row.delegate({ args: GOOD_ARGS[name], exec: {} })) as ClassifyRefusal
        expect(refused.ok).toBe(false)
        expect(refused.code).toBe('P_G1_DEFINITION_DRIFT')
        expect(calls.length).toBe(0)
      })
    })
  }

  it('a present-but-wrong capture (name mismatch) is a config defect: it throws at assembly, never mounts', () => {
    expect(() => G1.mountG1SurfaceAdapter('skill', {
      native: { name: 'skill-shadow', description: 'wrong face under the right name', parameters: {}, execute: async () => ({}) },
    })).toThrow(TypeError)
    expect(() => G1.mountG1SurfaceAdapter('not-a-record', { native: undefined })).toThrow(TypeError)
  })

  it('r9: the passed-through nested-required face IS a canonical host registration face — REAL Host639 validator, no property-level markers, constraints bind', async () => {
    const { native } = makeNativeDouble('ask_user_question', byName('ask_user_question'))
    const row = G1.mountG1SurfaceAdapter('ask_user_question', { native, providerId: 'g1-spec' })
    const face = row.parameters
    if (face === null) throw new Error('the captured registration face did not pass through')
    const repo = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
    if (repo === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
    const hostTools = join(repo, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
    if (!existsSync(hostTools)) throw new Error(`pristine host lib absent (${hostTools}); failing closed`)
    const host = (await import(pathToFileURL(hostTools).href)) as unknown as {
      assertSupportedJsonSchema: (schema: unknown) => void
      validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
    }
    // FIXED POINT: the canonical face enters the row unchanged and leaves it
    // unchanged — the host's own registration validator accepts it verbatim.
    expect(() => host.assertSupportedJsonSchema(face)).not.toThrow()
    expect(row.parameters).toBe(native.parameters)
    // NO property-level marker survives ANYWHERE (the r9 defect class, deep-
    // swept): `required` is only ever the parent's string array.
    const marker = (node: unknown): boolean => {
      if (node === null || typeof node !== 'object') return false
      const rec = node as Record<string, unknown>
      if (Object.hasOwn(rec, 'required') && rec.required === true) return true
      const props = rec.properties
      if (props !== null && typeof props === 'object') {
        for (const child of Object.values(props as Record<string, unknown>)) if (marker(child)) return true
      }
      if (rec.items !== undefined && marker(rec.items)) return true
      return false
    }
    expect(marker(face)).toBe(false)
    // Parent required arrays at EVERY nesting level (root → questions →
    // items → options.items), and the constraints BIND:
    expect(face.required).toEqual(['questions'])
    const props = face.properties as Record<string, {
      required?: string[]
      items?: { required?: string[]; properties?: Record<string, { items?: { required?: string[] } }> }
    }>
    expect(props.questions?.required).toBeUndefined()
    expect(props.questions?.items?.required).toEqual(['id', 'question'])
    expect(props.questions?.items?.properties?.options?.items?.required).toEqual(['label'])
    const partial = host.validateJsonSchemaValue(face, {
      questions: [{ question: 'missing id', options: [{ description: 'missing label' }] }],
    }, '').join(';')
    expect(partial).toMatch(/id/)
    expect(partial).toMatch(/label/)
    expect(host.validateJsonSchemaValue(face, {
      questions: [{ id: 'q1', question: 'Which one?', options: [{ label: 'A' }] }],
    }, '')).toEqual([])
  })
})
