/**
 * a5mcp-native-trust-filter.test.ts — G2-MCP-B (branch `a5-mcp-binding`,
 * MCP-WIRING-PROPOSAL option B, root 09:5xZ ②): the Guard's trusted-native
 * harvest EXCLUDES the `mcp__` prefix family, so an unbound MCP tool lands
 * in the UNVERIFIED lane and is refused at dispatch with the existing
 * typed no-fallback refusal — PLAN:70's already-approved semantics at the
 * DECISION layer. The wording law applies throughout: this is unbound
 * `mcp__` per-call refusal (decision layer); the server-side effect
 * boundary is NOT covered (PR7 deferred line booked).
 *
 * Three shapes, per the root brief:
 *  1. COLLECTION — `mcp__` names never enter `nativeNames` (the harvest
 *     shape), non-`mcp__` names are untouched (non-mcp 不扰);
 *  2. UNBOUND — with the filtered list, an `mcp__` name binds UNVERIFIED
 *     and every call denies TOOL_BINDING_UNVERIFIED with the verbatim
 *     no-fallback message (the F leg3 read-landing form, now as the
 *     mcp__ name's own verdict);
 *  3. BOUND — a trusted assembly that binds the name EXPLICITLY (PR0
 *     Binding algebra, before the inherited-surface sweep) still passes:
 *     the filter changes nothing on the explicit-Binding lane.
 *
 * The live flip of this lane on the pinned Host is F leg3's suite (its
 * criteria live in the a5-legs-runner F-RESULTS notes; the row-handle
 * decision rows + the non-increasing fixture counter are ITS receipts,
 * not this file's).
 *
 * @module test/a5mcp-native-trust-filter
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  parseToolBinding,
  type ToolBinding,
} from '../../domain/tool-governance/src/index.js'
import {
  GUARD_DENIAL_REASONS,
  createGovernedSurface,
  guardDecision,
  untestedAssurance,
  type GuardExecView,
} from '../tool-dispatch/index.js'

const GLUE_URL = new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url)
// fileURLToPath takes the href STRING: the repo pattern (a5b3/a5g6 use
// `new URL(...).href` for the dynamic import edge); passing the URL object
// through a binding hits the DOM-lib URL vs node:url URL declaration clash.
const GLUE_PATH = fileURLToPath(GLUE_URL.href)

const SCOPE = { agentScopeKey: 'session-m1', trustedIdentities: ['session-m1', 'agent-m1'] }

/** The name under test — the same spelling the F leg3 fixture mounts. */
const MCP_NAME = 'mcp__a5probe__echo'

/** identity map for `bindInheritedSurface` (scope == global in the fixture). */
function pin(names: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of names) out[n] = `def:${n}`
  return out
}

/** A trusted explicit Binding for one name (the PR0 team-own shape). */
function bindingFor(name: string): ToolBinding {
  const raw = {
    bindingId: `team-own:session-m1:${name}`,
    agentScopeKey: 'session-m1',
    toolName: name,
    definitionIdentity: `team-own:${name}`,
    providerId: 'dsh-agent-team',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  }
  const parsed = parseToolBinding(raw)
  if (!parsed.ok) throw new Error(`fixture binding is not a valid ToolBinding: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

describe('G2-MCP-B collection — the trusted-native harvest excludes the mcp__ family', () => {
  it('the exported predicate excludes exactly the mcp__ prefix family', async () => {
    const glue = (await import(GLUE_URL.href)) as {
      GUARD_NATIVE_TRUST_EXCLUDED_MCP_PREFIX: string
      guardNativeTrustExcludedMcpName: (name: unknown) => boolean
    }
    expect(glue.GUARD_NATIVE_TRUST_EXCLUDED_MCP_PREFIX).toBe('mcp__')
    // excluded: the MCP family (server-qualified model-facing spellings)
    expect(glue.guardNativeTrustExcludedMcpName(MCP_NAME)).toBe(true)
    expect(glue.guardNativeTrustExcludedMcpName('mcp__srv__tool')).toBe(true)
    expect(glue.guardNativeTrustExcludedMcpName('mcp__')).toBe(true)
    // not excluded: host natives, Team tools, plane names — 非 mcp 不扰
    expect(glue.guardNativeTrustExcludedMcpName('bash')).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName('read')).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName('read_image')).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName('team_delegate')).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName('team_grep')).toBe(false)
    // near-miss spellings are NOT the family (prefix is exact, double underscore)
    expect(glue.guardNativeTrustExcludedMcpName('mcp_single_underscore')).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName('mcpx')).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName('prefix_mcp__x')).toBe(false)
    // non-strings never earn native trust either way (the harvest also filters them)
    expect(glue.guardNativeTrustExcludedMcpName(undefined)).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName(null)).toBe(false)
    expect(glue.guardNativeTrustExcludedMcpName(42)).toBe(false)
  })

  it('the harvest at the Guard assembly wires the predicate (source witness, no second channel)', () => {
    // The collection-shape pin: the nativeNames filter chain applies the
    // exclusion at the ONE harvest site (grep-verifiably unique), so an
    // `mcp__` name cannot re-enter the trusted native list behind the
    // predicate's back. Text witness is the repo pattern for glue wiring
    // (f15 §9.2 precedent); the predicate's behavior is the dynamic leg.
    const glueSource = readFileSync(GLUE_PATH, 'utf8')
    const harvest = glueSource.match(
      /nativeNames = globalSchemas\s*\n\s*\.map\(\(row\) => row\?\.name\)\s*\n\s*\.filter\(\(name\) => ([^\n]+)\)/,
    )
    expect(harvest, 'the single nativeNames harvest exists').not.toBeNull()
    expect(harvest![1]).toContain("typeof name === 'string'")
    expect(harvest![1]).toContain('!guardNativeTrustExcludedMcpName(name)')
    // exactly one harvest feeds installScopedToolGuard — the wiring is not duplicated
    expect(glueSource.match(/nativeNames = globalSchemas/g) ?? []).toHaveLength(1)
  })

  it('collecting a mixed global surface yields NO mcp__ name (collection form)', async () => {
    const glue = (await import(GLUE_URL.href)) as {
      guardNativeTrustExcludedMcpName: (name: unknown) => boolean
    }
    // the EXACT map/filter shape of the harvest:
    const globalSchemas = [
      { name: 'bash' },
      { name: MCP_NAME },
      { name: 'mcp__other__tool' },
      { name: 'team_delegate' },
      { name: 'read' },
      { name: undefined },
      { name: '' },
    ]
    const nativeNames = globalSchemas
      .map((row) => row?.name)
      .filter((name) => typeof name === 'string' && name.length > 0 && !glue.guardNativeTrustExcludedMcpName(name))
    expect(nativeNames).toEqual(['bash', 'team_delegate', 'read'])
    expect(nativeNames.some((n) => typeof n === 'string' && n.startsWith('mcp__'))).toBe(false)
  })
})

describe('G2-MCP-B unbound — an mcp__ name lands UNVERIFIED and every call is refused', () => {
  it('the filtered native list binds bash verified and the mcp__ name unverified', () => {
    const surface = createGovernedSurface({
      agentScopeKey: 'session-m1',
      nativeNames: ['bash'], // mcp__ excluded from the trusted list at assembly
    })
    const result = surface.bindInheritedSurface([MCP_NAME, 'bash'], pin([MCP_NAME, 'bash']), pin([MCP_NAME, 'bash']))
    expect(result.verifiedBound).toBe(1)
    expect(result.unverified).toEqual([MCP_NAME])
    // the mcp__ name is GOVERNED (present, visible to the Coverage diff), just not verified
    const entry = surface.entryOf(MCP_NAME)
    expect(entry).toBeDefined()
    expect(entry!.verified).toBe(false)
    expect(entry!.binding.bindingId).toBe(`unbound-observed:session-m1:${MCP_NAME}`)
  })

  it('dispatch refuses the unbound mcp__ name with the verbatim no-fallback refusal', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['bash'] })
    surface.bindInheritedSurface([MCP_NAME, 'bash'], pin([MCP_NAME, 'bash']), pin([MCP_NAME, 'bash']))
    const exec: GuardExecView = { name: MCP_NAME, agentIdentity: 'session-m1' }
    const verdict = guardDecision({
      exec,
      scope: SCOPE,
      surface,
      active: true,
      policyGeneration: 0,
      authorityGeneration: 0,
      definition: { ok: true, fingerprint: `def:${MCP_NAME}` },
    })
    expect(verdict.kind).toBe('deny')
    if (verdict.kind !== 'deny') return
    expect(verdict.error.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(verdict.reason).toBe(GUARD_DENIAL_REASONS.BINDING_UNVERIFIED)
    // the SAME verbatim refusal the F leg3 read-landing recorded — decision-layer
    // refusal is the whole claim (no effect-boundary wording here).
    expect(verdict.error.message).toBe(
      `team tool guard: the Tool Binding for "${MCP_NAME}" cannot be verified at dispatch time (no fallback to the native body)`,
    )
  })

  it('a non-mcp native called on the same filtered list is untouched (非 mcp 不扰)', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['bash'] })
    surface.bindInheritedSurface([MCP_NAME, 'bash'], pin([MCP_NAME, 'bash']), pin([MCP_NAME, 'bash']))
    const verdict = guardDecision({
      exec: { name: 'bash', agentIdentity: 'session-m1' },
      scope: SCOPE,
      surface,
      active: true,
      policyGeneration: 0,
      authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'def:bash' },
    })
    expect(verdict).toEqual({ kind: 'abstain', reason: 'governed-and-verified' })
  })
})

describe('G2-MCP-B bound — a trusted explicit Tool Binding still passes', () => {
  it('an explicit team-own Binding on an mcp__ name survives the inherited sweep and abstains', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1', nativeNames: ['bash'] })
    // the trusted assembly binds it EXPLICITLY (the PR0 algebra path), then
    // the inherited-surface sweep runs — it must SKIP the already-bound name,
    // never downgrade it to unbound-observed.
    const bound = surface.bind({ name: MCP_NAME, origin: 'team-own', binding: bindingFor(MCP_NAME), verified: true })
    expect(bound.ok).toBe(true)
    const result = surface.bindInheritedSurface([MCP_NAME], pin([MCP_NAME]), pin([MCP_NAME]))
    expect(result.verifiedBound).toBe(0)
    expect(result.unverified).toEqual([])
    expect(surface.entryOf(MCP_NAME)!.binding.bindingId).toBe(`team-own:session-m1:${MCP_NAME}`)
    const verdict = guardDecision({
      exec: { name: MCP_NAME, agentIdentity: 'session-m1' },
      scope: SCOPE,
      surface,
      active: true,
      policyGeneration: 0,
      authorityGeneration: 0,
      definition: { ok: true, fingerprint: `team-own:${MCP_NAME}` },
    })
    expect(verdict).toEqual({ kind: 'abstain', reason: 'governed-and-verified' })
  })
})
