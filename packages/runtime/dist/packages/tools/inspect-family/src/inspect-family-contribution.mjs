/**
 * inspect-family/src/inspect-family-contribution.mjs — the ONE contribution
 * descriptor of the inspect family (closed registration schema, the
 * search/fs pattern).
 *
 * DATA, NOT AUTHORITY: admission / grant mint / grant consume stay `kernel`
 * (CI-06 posture — self-approval is unexpressable). The digests are CONTENT
 * bindings over the placed rows and the lane's source as one canonical
 * lossless document; a content edit changes the digest, which is the point.
 *
 * @module inspect-family/inspect-family-contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import * as rowNames from './row-names.mjs'
import * as skillMechanics from './skill-mechanics.mjs'
import * as skillExecutor from './skill-executor.mjs'
import * as skillRow from './skill-row.mjs'
import * as inspectMechanics from './inspect-mechanics.mjs'
import * as inspectExecutor from './inspect-executor.mjs'
import * as inspectRows from './inspect-rows.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

function inputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    name: definition.name,
    parameters: definition.parameters,
    required: definition.parameters.required ?? null,
  }))
}

function outputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
  }))
}

export function buildInspectFamilyContribution({ skillDefinition, listDefinition, queryDefinition, cancelBoundary }) {
  const definitions = [skillDefinition, listDefinition, queryDefinition]
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
    rows: definitions.map((definition) => ({
      name: definition.name,
      parameters: definition.parameters,
      execute: definition.execute?.toString?.() ?? null,
    })),
    rowNames: sourceLossless(rowNames),
    skillMechanics: sourceLossless(skillMechanics),
    skillExecutor: sourceLossless(skillExecutor),
    skillRow: sourceLossless(skillRow),
    inspectMechanics: sourceLossless(inspectMechanics),
    inspectExecutor: sourceLossless(inspectExecutor),
    inspectRows: sourceLossless(inspectRows),
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.inspect-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/inspect-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh-agent-team/inspect-family',
      digest: sha256Hex(canonicalJsonStringify({ familyId: 'dsh.inspect-family', selector: 'packages/tools/inspect-family/src' })),
    },
    // 'fs-read' backs the governed skill load (a bounded anchored FILE read
    // over a host-sanctioned root); 'inspect-read' backs the two introspection
    // rows (a read of the host registry's declared read-only surface). The
    // kernel manifest must name both backings or registration fails closed.
    requiredCapabilities: ['fs-read', 'inspect-read'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The ALIAS mount spellings, bound-definition form (CI-04: each name
      // is carried by the definition the seam mints; the ARC-A L4 scan
      // reads every entry). row-names.mjs states the natexe law this choice
      // obeys: no reserved-native claim, so the takeover ledger stays the
      // complete truth. A second candidate claiming one of these is a
      // NAME_COLLISION refusal.
      nativeNames: [
        skillDefinition.name,
        listDefinition.name,
        queryDefinition.name,
      ],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      inputContractDigest: sha256Hex(canonicalJsonStringify(
        Object.fromEntries(definitions.map((definition) => [definition.name, inputContractDigestOf(definition)])),
      )),
      outputContractDigest: sha256Hex(canonicalJsonStringify(
        Object.fromEntries(definitions.map((definition) => [definition.name, outputContractDigestOf(definition)])),
      )),
      normalization: 'pure',
    },
    effects: {
      declared: true,
      // The effect-declaration namespace of this family's rows: a bounded
      // anchored FILE read (skill instructions) and metadata introspection
      // (the inspect registry's declared surface). NEVER write, connect, or
      // domain-ref — every per-call PA request set carries only these kinds
      // plus the row's tool-invoke arm.
      kinds: ['read', 'meta'],
      targets: ['absolute-path', 'metadata'],
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
