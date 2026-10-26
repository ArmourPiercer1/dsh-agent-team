/**
 * fs-family/src/fs-family-contribution.mjs — the FS family's full
 * contribution DESCRIPTOR: ONE candidate carrying the FOUR governed rows
 * (`read`, `write`, `edit`, `read_image`) U7-9a mounts together (U7-9a,
 * the first per-family delivery proving CA-01: new family members join
 * through the closed schema with ZERO center diff).
 *
 * WHY ONE CANDIDATE: the Registry law is ONE live candidate per familyId
 * (DUP_FAMILY_ID refuses a second), and the closed schema keys NAME claims
 * per candidate (NAME_COLLISION) — so the family that already speaks as
 * `dsh.fs-family` for `read` carries its new members in the SAME reviewed
 * descriptor: one source digest binding the whole lane, one effects
 * declaration covering the whole lane, one ledger entry per native name on
 * the SAME kernel.
 *
 * DATA, NOT AUTHORITY (CI-06): admission / grant mint / grant consume are
 * stated as `kernel`, and nothing here decides, admits, or grants. The
 * effects declaration is HONEST about the dual effect of `read_image`: the
 * realm-file read (`realm-file-root`) PLUS the durable attachment commit
 * (`attachment-store`) — the second target's own enforcement is the host
 * store's capacity law + the injected-port shape (the family holds no fs
 * face and no delete face over the store), and the mount REFUSES the row's
 * commit path entirely when no store is mounted.
 *
 * @module fs-family/fs-family-contribution
 */
import { ATTACHMENT_STORE_DOMAIN_AUTHORITY } from './fs-mutation-mechanics.mjs'
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import { buildFsReadContribution } from './fs-read-contribution.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** LOSSLESS-JSON law (same as the read descriptor): every function anywhere
 *  in the bound namespaces is pinned as its SOURCE TEXT; anything
 *  non-JSON-safe degrades to a stable marker, never to silence. */
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
 * Build the FULL fs-family contribution descriptor for one mount.
 *
 * @param {object} input - ALL FOUR placed rows (the fs lane mounts them as
 *   one family over the ONE controlled-fs instance root, or mounts none; a
 *   partial set is a broken assembly and throws fail-closed).
 * @param {{definition: object, executorFactory: object}} input.read
 * @param {{definition: object, executorFactory: object}} input.write
 * @param {{definition: object, executorFactory: object}} input.edit
 * @param {{definition: object, executorFactory: object, readPortFactory?: object}} input.readImage
 * @param {object} input.mechanics - the fs-mechanics module namespace.
 * @param {object} input.mutationMechanics - the fs-mutation-mechanics namespace.
 * @param {object} input.presentation - the read-presentation namespace.
 * @param {string} input.cancelBoundary
 * @returns the closed descriptor (the Kernel's validator re-checks it).
 */
export function buildFsFamilyContribution({
  read, write, edit, readImage,
  mechanics, mutationMechanics, presentation, cancelBoundary,
}) {
  const parts = [['read', read], ['write', write], ['edit', edit], ['read_image', readImage]]
  for (const [cls, part] of parts) {
    if (part === null || part === undefined || part.definition === undefined || part.executorFactory === undefined) {
      throw new TypeError(`buildFsFamilyContribution: the '${cls}' row is missing — the fs family mounts its four rows together or not at all (fail closed)`)
    }
  }
  const readDefinition = read.definition
  const writeDefinition = write.definition
  const editDefinition = edit.definition
  const imageDefinition = readImage.definition
  const names = [readDefinition.name, writeDefinition.name, editDefinition.name, imageDefinition.name]
  if (new Set(names).size !== names.length) {
    throw new TypeError('buildFsFamilyContribution: duplicate native name claims — the four rows must carry four distinct spellings')
  }
  const inputContractDigest = sha256Hex(canonicalJsonStringify(names.map((name) => {
    const definition = [readDefinition, writeDefinition, editDefinition, imageDefinition][names.indexOf(name)]
    return {
      name: definition.name,
      parameters: definition.parameters,
      required: definition.parameters.required ?? null,
    }
  })))
  const outputContractDigest = sha256Hex(canonicalJsonStringify([readDefinition, writeDefinition, editDefinition, imageDefinition].map((definition) => ({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
    presentationMeta: definition.output?.presentationMeta?.toString?.() ?? null,
    presentResult: definition.presentResult?.toString?.() ?? null,
  }))))
  const sourceDocument = canonicalJsonStringify({
    rows: [
      {
        name: readDefinition.name,
        parameters: readDefinition.parameters,
        execute: readDefinition.execute?.toString?.() ?? null,
        executor: read.executorFactory?.toString?.() ?? null,
      },
      {
        name: writeDefinition.name,
        parameters: writeDefinition.parameters,
        execute: writeDefinition.execute?.toString?.() ?? null,
        executor: write.executorFactory?.toString?.() ?? null,
      },
      {
        name: editDefinition.name,
        parameters: editDefinition.parameters,
        execute: editDefinition.execute?.toString?.() ?? null,
        executor: edit.executorFactory?.toString?.() ?? null,
      },
      {
        name: imageDefinition.name,
        parameters: imageDefinition.parameters,
        execute: imageDefinition.execute?.toString?.() ?? null,
        executor: readImage.executorFactory?.toString?.() ?? null,
        readPort: readImage.readPortFactory?.toString?.() ?? null,
      },
    ],
    mechanics: sourceLossless(mechanics),
    mutationMechanics: sourceLossless(mutationMechanics),
    presentation: sourceLossless(presentation),
    // The read row's reviewed descriptor (U6 PR2) rides INSIDE the bound
    // source: the full-family candidate is a strict extension of it, and a
    // drift in the read half is visible in the whole family's digest.
    readContribution: buildFsReadContribution({
      definition: readDefinition,
      executorFactory: read.executorFactory,
      mechanics,
      presentation,
      cancelBoundary,
    }),
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.fs-family',
    familyVersion: '0.2.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/fs-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh-agent-team/fs-family',
      digest: sha256Hex(canonicalJsonStringify({ familyId: 'dsh.fs-family', selector: 'packages/tools/fs-family/src', rows: ['read', 'write', 'edit', 'read_image'] })),
    },
    // 'fs-read' backs the read + image byte bodies; 'fs-write' backs the
    // write/edit bodies (both family-body executions over the controlled-fs
    // provider's post-consume closures). The kernel manifest must name
    // BOTH or registration fails closed.
    requiredCapabilities: ['fs-read', 'fs-write'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The takeover spelling law (§ CI-04): every governed row carries its
      // NATIVE name; the center validated the spellings before placing them.
      // Four bound definitions, four claims — the L4 census reads them here.
      nativeNames: [readDefinition.name, writeDefinition.name, editDefinition.name, imageDefinition.name],
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
      kinds: ['read', 'write'],
      // Realm-file effects live and die inside the member's admitted root
      // (the anchor law refuses escapes BEFORE any I/O); the image row's
      // durable attachment commit names its SECOND target honestly — the
      // host attachment store, enforced by the injected-store shape (no
      // store mounted = no commit path at all) and the store's own
      // capacity law. The family holds no fs face and no delete face over
      // the store.
      // U7-9a R1: the SECOND target's identity is the shared constant the
      // executor requests as a domain-ref effect — one name, two faces,
      // pinned equal by C1 (a declared effect without an admitted rung is
      // refused with zero commit).
      targets: ['realm-file-root', ATTACHMENT_STORE_DOMAIN_AUTHORITY],
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
