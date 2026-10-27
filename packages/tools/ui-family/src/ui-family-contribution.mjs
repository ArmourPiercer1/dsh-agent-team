/**
 * ui-family/src/ui-family-contribution.mjs — the UI family's contribution
 * DESCRIPTOR: ONE candidate carrying the two governed rows
 * (`ask_user_question`, `present`) u7-f mounts together.
 *
 * DATA, NOT AUTHORITY (CI-06): admission / grant mint / grant consume are
 * stated as `kernel`, and nothing here decides, admits, or grants.
 *
 * THE EFFECTS DECLARATION IS THE WHOLE TRUTH, per row:
 *  - `ask_user_question` carries the interaction effect over the
 *    `user-interaction` Domain Authority (the suspended human exchange);
 *  - `present` carries the publication effect over the `ui-presentation`
 *    Domain Authority PLUS one realm-file READ per presented file (the
 *    O_NOFOLLOW probe is what pays for them — presenting does not get to
 *    publish what the member could not read).
 * The Domain Authority identities are the SAME constants the executors
 * REQUEST as domain-ref effects — one name, two faces, pinned equal by C1
 * (the attachment-store precedent; the PR #390 declared-vs-requested bug
 * made structural). The second targets' enforcement is the INJECTED-PORT
 * shape: the family holds no UI face at all, so no port mounted = no
 * interaction path at all, and every call fails closed.
 *
 * @module ui-family/ui-family-contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import {
  ASK_USER_QUESTION_NATIVE_NAME,
  UI_PRESENTATION_DOMAIN_AUTHORITY,
  USER_INTERACTION_DOMAIN_AUTHORITY,
} from './ui-mechanics.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** LOSSLESS-JSON law (the fs lane's): every function anywhere in the bound
 *  namespaces is pinned as its SOURCE TEXT; anything non-JSON-safe degrades
 *  to a stable marker, never to silence. */
function sourceLossless(value) {
  if (typeof value === 'function') return value.toString()
  if (Array.isArray(value)) return value.map(sourceLossless)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sourceLossless(v)]))
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') return `[${typeof value}]`
  return value
}

/**
 * Build the FULL ui-family contribution descriptor for one mount.
 *
 * @param {object} input - BOTH placed rows (the family mounts them as one
 *   family or not at all; a partial set is a broken assembly and throws
 *   fail-closed).
 * @param {{definition: object, executorFactory: object}} input.ask
 * @param {{definition: object, executorFactory: object}} input.present
 * @param {object} input.mechanics - the ui-mechanics module namespace.
 * @param {object} input.port - the ui-interaction-port module namespace.
 * @param {string} input.cancelBoundary
 * @returns the closed descriptor (the Kernel's validator re-checks it).
 */
export function buildUiFamilyContribution({ ask, present, mechanics, port, cancelBoundary }) {
  for (const [cls, part] of [['ask_user_question', ask], ['present', present]]) {
    if (part === null || part === undefined || part.definition === undefined || part.executorFactory === undefined) {
      throw new TypeError(`buildUiFamilyContribution: the '${cls}' row is missing — the ui family mounts its two rows together or not at all (fail closed)`)
    }
  }
  const askDefinition = ask.definition
  const presentDefinition = present.definition
  const names = [askDefinition.name, presentDefinition.name]
  if (new Set(names).size !== names.length) {
    throw new TypeError('buildUiFamilyContribution: duplicate native name claims — the two rows must carry two distinct spellings')
  }
  if (askDefinition.name !== ASK_USER_QUESTION_NATIVE_NAME) {
    throw new TypeError('buildUiFamilyContribution: the ask row must carry the native ask_user_question spelling (the fixed-spelling takeover law)')
  }
  const definitions = [askDefinition, presentDefinition]
  const inputContractDigest = sha256Hex(canonicalJsonStringify(definitions.map((definition) => ({
    name: definition.name,
    parameters: definition.parameters,
    required: definition.parameters.required ?? null,
  }))))
  const outputContractDigest = sha256Hex(canonicalJsonStringify(definitions.map((definition) => ({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
    presentationMeta: definition.output?.presentationMeta?.toString?.() ?? null,
    presentResult: definition.presentResult?.toString?.() ?? null,
  }))))
  const sourceDocument = canonicalJsonStringify({
    rows: definitions.map((definition, i) => ({
      name: definition.name,
      parameters: definition.parameters,
      execute: definition.execute?.toString?.() ?? null,
      executor: [ask.executorFactory, present.executorFactory][i]?.toString?.() ?? null,
    })),
    mechanics: sourceLossless(mechanics),
    port: sourceLossless(port),
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.ui-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/ui-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh-agent-team/ui-family',
      digest: sha256Hex(canonicalJsonStringify({ familyId: 'dsh.ui-family', selector: 'packages/tools/ui-family/src', rows: [ASK_USER_QUESTION_NATIVE_NAME, 'present'] })),
    },
    // ONE kernel capability backs BOTH bodies: the human-facing interaction
    // (question/answer + publication) over the injected port. The kernel
    // manifest (the reviewed family manifest's kernelCapabilities block)
    // must name it or registration fails closed.
    requiredCapabilities: ['ui-interaction'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The takeover spelling law (§ CI-04): both rows carry their NATIVE
      // spellings (the fs-mutation/jobs precedent — never the renamable
      // names map); the same-name same-meaning claim rides the reviewed
      // descriptor. Two bound definitions, two claims — the L4 census
      // reads them here.
      nativeNames: [askDefinition.name, presentDefinition.name],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      inputContractDigest,
      outputContractDigest,
      normalization: 'pure',
    },
    effects: {
      declared: true,
      kinds: ['read', 'domain-ref'],
      // The realm-file reads live and die inside the member's admitted
      // root (the anchor law refuses escapes BEFORE any I/O); the two
      // interaction arms name their SECOND targets honestly — the human
      // question exchange and the human-facing publication — each enforced
      // by the injected-port shape (no port = no interaction path at all).
      targets: ['realm-file-root', USER_INTERACTION_DOMAIN_AUTHORITY, UI_PRESENTATION_DOMAIN_AUTHORITY],
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
