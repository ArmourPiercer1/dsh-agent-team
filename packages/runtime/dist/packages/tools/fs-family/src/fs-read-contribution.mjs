/**
 * fs-family/src/fs-read-contribution.mjs — the FS family's `read`
 * contribution DESCRIPTOR (U6 PR2; U6-SLICE-PLAN PR2: the family "contributes
 * the governed `read` row via the PR1 schema + Registry").
 *
 * DATA, NOT AUTHORITY: this factory describes the six §4 boundaries of the
 * governed read row and states, as data, that admission / grant mint / grant
 * consume stay `kernel` (the § CI-06 posture — self-approval is
 * unexpressable). The descriptor is validated by the Kernel's closed schema
 * (`governance-center/contribution-schema`) at registration; nothing here
 * decides, admits, or grants.
 *
 * The digests are CONTENT bindings computed here (the registering side
 * computes what it claims to bind — the schema validator only checks shape):
 * inputContractDigest binds the row's closed parameter schema; the source
 * digest binds the family's moved code as one canonical document (the exact
 * functions the center places — schema text, presentation render, executor
 * body). A content edit changes the digest; the Kernel's registration ledger
 * then records a different contribution, which is exactly the point.
 *
 * @module fs-family/fs-read-contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The row's closed parameter schema, exactly as `buildReadRowDefinition`
 *  places it (the digest must bind the PLACED contract, not a copy — so the
 *  factory is given the live definition and digests THAT). */
function inputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    name: definition.name,
    parameters: definition.parameters,
    required: definition.parameters.required ?? null,
  }))
}

/** The output/Result boundary digest: the presentation schema plus the two
 *  pure functions' source — the complete Result contract the Family owns. */
function outputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
    presentationMeta: definition.output?.presentationMeta?.toString?.() ?? null,
    presentResult: definition.presentResult?.toString?.() ?? null,
  }))
}

/**
 * Build the read contribution descriptor for registration.
 *
 * @param {object} input
 * @param {object} input.definition - the live row Definition from
 *   `buildReadRowDefinition` (digests bind the placed artifact).
 * @param {object} input.executorFactory - the `createGovernedReadExecutor`
 *   function whose body is part of the bound source document.
 * @param {object} input.mechanics - the fs-mechanics module namespace
 *   (anchor/window law functions are part of the bound source).
 * @param {object} input.presentation - the read-presentation module
 *   namespace (part of the bound source).
 * @param {string} cancelBoundary - the documented cancel boundary text.
 * @returns a plain descriptor object (closed-world; the Kernel's validator
 *   re-checks every key fail-closed).
 */
export function buildFsReadContribution({ definition, executorFactory, mechanics, presentation, cancelBoundary }) {
  // LOSSLESS-JSON law (contracts canonicalJsonStringify): the bound source
  // document is DATA — every function anywhere in the module namespaces (the
  // presentation FACE nests `render` one level deep) is pinned as its
  // SOURCE TEXT; anything non-JSON-safe degrades to a stable marker, never
  // to silence.
  const sourceLossless = (value) => {
    if (typeof value === 'function') return value.toString()
    if (Array.isArray(value)) return value.map(sourceLossless)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sourceLossless(v)]))
    }
    if (typeof value === 'bigint' || typeof value === 'symbol') return `[${typeof value}]`
    return value
  }
  const sourceDocument = canonicalJsonStringify({
    name: definition.name,
    parameters: definition.parameters,
    execute: definition.execute?.toString?.() ?? null,
    executor: executorFactory?.toString?.() ?? null,
    mechanics: sourceLossless(mechanics),
    presentation: sourceLossless(presentation),
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.fs-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/fs-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh-agent-team/fs-family',
      digest: sha256Hex(canonicalJsonStringify({ familyId: 'dsh.fs-family', selector: 'packages/tools/fs-family/src' })),
    },
    // 'fs-read' is the Kernel capability this family REQUIRES; the kernel's
    // manifest must name it (and its backing) or registration fails closed
    // (CAPABILITY_UNKNOWN / CAPABILITY_UNBACKED are the validator's).
    requiredCapabilities: ['fs-read'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The takeover spelling law (§ CI-04): the governed row carries the
      // NATIVE name; the center validated Gate 0b before placing it.
      nativeNames: [definition.name],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      inputContractDigest: inputContractDigestOf(definition),
      outputContractDigest: outputContractDigestOf(definition),
      normalization: 'pure',
    },
    effects: {
      declared: true,
      kinds: ['read'],
      // Every target stays inside the member's admitted file root; escaping
      // targets are refused by the anchor law (fs-mechanics) BEFORE any I/O.
      targets: ['realm-file-root'],
    },
    execution: {
      declared: true,
      via: 'family-body',
    },
    lifecycle: {
      owner: 'kernel',
      drain: 'kernel-owned',
      cancelBoundary,
    },
    result: {
      envelope: 'host',
      correlation: 'kernel',
    },
    obligations: {
      admission: 'kernel',
      grantMint: 'kernel',
      grantConsume: 'kernel',
    },
  }
}
