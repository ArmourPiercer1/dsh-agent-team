/**
 * U6 ARC-A — the PROBE family's declaration (TEST-ONLY lane; see the
 * lane README). This is what "a new family contributes a DECLARATION
 * through the shipped schema" means, spelled by a consumer: every field is
 * what `validateFamilyContribution` (governance-center, PR1) demands, the
 * familyId is a literal, and `visibility.nativeNames` carries a STRING
 * LITERAL — the closedness form the fitness scanner reads (law L4).
 *
 * The family owns exactly ONE name, `u6arc_probe`; its only effect is a
 * marker file into the caller-supplied marker directory (targets
 * 'probe-marker-dir'); execution is its own family body.
 * @module tests/u6-arc-a-probe-family/probe-contribution
 */
import { createHash } from 'node:crypto'
// The public seam imports are ENV-OVERRIDABLE by absolute URL: the vitest
// world resolves them repo-relative (TS sources); the REAL Host world (C2,
// tests/world-factory u6-arc-a) points them at the SHIPPED dist faces — the
// exact files the production glue imports. Same lane law in both worlds,
// two resolutions of the same public seam, zero private API either way.
const CONTRACTS_URL = process.env['U6ARC_CONTRACTS_URL']
  ?? new URL('../../../packages/contracts/src/index.js', import.meta.url).href
const { canonicalJsonStringify } = await import(CONTRACTS_URL)

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

const sourceLossless = (value) => {
  if (typeof value === 'function') return value.toString()
  if (Array.isArray(value)) return value.map(sourceLossless)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sourceLossless(v)]))
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') return `[${typeof value}]`
  return value
}

/** The probe row's tool definition face (host-facing shape). */
export const PROBE_NAME = 'u6arc_probe'

/**
 * Build the probe family contribution descriptor.
 * @param {object} input
 * @param {{name: string, parameters?: unknown, execute?: Function}} input.definition
 * @param {string} input.cancelBoundary
 */
export function buildU6ProbeContribution({ definition, cancelBoundary }) {
  if (definition === null || typeof definition !== 'object' || definition.name !== PROBE_NAME) {
    throw new Error('U6_PROBE_DEFINITION_REQUIRED: the contribution binds the u6arc_probe definition')
  }
  const sourceDocument = canonicalJsonStringify({
    name: definition.name,
    parameters: definition.parameters ?? null,
    execute: definition.execute?.toString?.() ?? null,
    lane: sourceLossless({ PROBE_NAME }),
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.u6-probe-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'tests/u6-arc-a-probe-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh-agent-team/u6-arc-a-probe-family',
      digest: sha256Hex(canonicalJsonStringify({
        familyId: 'dsh.u6-probe-family',
        selector: 'tests/u6-arc-a-probe-family/src',
      })),
    },
    requiredCapabilities: ['marker-write'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // THE literal-name form (law L4's strongest shape) — a test-only lane
      // has no definition-mint to lean on, so it spells the name out.
      nativeNames: ['u6arc_probe'],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      inputContractDigest: sha256Hex(canonicalJsonStringify(definition.parameters ?? {})),
      outputContractDigest: sha256Hex(canonicalJsonStringify({ envelope: 'host', marker: true })),
      normalization: 'pure',
    },
    effects: {
      declared: true,
      kinds: ['marker-write'],
      targets: ['probe-marker-dir'],
    },
    execution: { declared: true, via: 'family-body' },
    lifecycle: { owner: 'kernel', drain: 'kernel-owned', cancelBoundary },
    result: { envelope: 'host', correlation: 'kernel' },
    obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
  }
}
