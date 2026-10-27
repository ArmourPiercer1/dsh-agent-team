/**
 * web-family/src/web-family-contribution.mjs — the WEB family's
 * contribution DESCRIPTOR: ONE candidate carrying the two governed rows
 * (`web_fetch`, `web_search`), mounted together or not at all (u7-f, the
 * first network-effect family, familyId `dsh.web-family`).
 *
 * DATA, NOT AUTHORITY (CI-06): admission / grant mint / grant consume are
 * stated `kernel`, and nothing here decides, admits or grants.
 *
 * THE EFFECTS DECLARATION is the family's whole network truth in one
 * closed shape: kind `connect`, target `network-destination` — the only
 * pair the frozen effect vocabulary binds network to (`effects.ts` /
 * `resource.ts`: a `connect` right lives ONLY on a canonical-origin
 * destination). Every executed call requests exactly the declared kinds
 * per call (the PR #390 declared==requested law); the family declares
 * NOTHING ELSE (over-claiming is as illegal as under-claiming — the
 * family holds no read/write/exec face, no file authority at all).
 *
 * THE CAPABILITY is the NEW kernel-declared `network-egress`,
 * `backsExecution: 'family-body'` (manifest.json — the reviewed set's
 * kernel manifest; registration fails closed if the kernel does not name
 * it). It exists because the contribution-schema's
 * requiredCapabilities must resolve against the kernel manifest: a network
 * family must ASK for network by name, visibly, in the reviewed manifest —
 * not ride `fs-read` or any other reviewed capability by accident.
 *
 * CONFINEMENT HONESTY rides the digest, not prose (u7 DECISION-3-ANSWER):
 * the host sandbox claims FILE effects only (no `--unshare-net` in the
 * bwrap profile; partial Landlock ABI without TCP rules). The assurance
 * THIS candidate states is therefore admission-time Team authority
 * (per-call PA over `tool-invoke + connect`, one-shot grant, the closed
 * mechanics bound the bound source pins), boundary trusted Host, never
 * local confinement. The PR body repeats the limit verbatim.
 *
 * @module web-family/web-family-contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** LOSSLESS-JSON law (fs-family precedent): every function anywhere in
 *  the bound namespaces is pinned as its SOURCE TEXT; anything non-JSON-
 *  safe degrades to a stable marker, never to silence. */
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
 * Build the FULL web-family contribution descriptor for one mount.
 *
 * @param {object} input
 * @param {{definition: object, executorFactory: object}} input.fetch
 * @param {{definition: object, executorFactory: object}} input.search
 * @param {object} input.mechanics - the web-mechanics module namespace.
 * @param {object} input.transport - the web-transport module namespace.
 * @param {object} input.providerLaw - the web-search-provider module namespace.
 * @param {readonly string[]} input.destinations - the provider effect-truth
 *   destinations mounted on THIS assembly ([] when no provider).
 * @param {{allowedSchemes: readonly string[], httpLoopbackAllowed: boolean,
 *          maxBytes: number, timeoutMs: number}} input.bound - the trusted
 *   bound actually driving this mount (pinned into the digest: a bound
 *   change is a DIFFERENT candidate).
 * @param {string} input.cancelBoundary
 */
export function buildWebFamilyContribution({ fetch, search, mechanics, transport, providerLaw, destinations, bound, cancelBoundary }) {
  for (const [cls, part] of [['web_fetch', fetch], ['web_search', search]]) {
    if (part === null || part === undefined || part.definition === undefined || part.executorFactory === undefined) {
      throw new TypeError(`buildWebFamilyContribution: the '${cls}' row is missing — the web family mounts its two rows together or not at all (fail closed)`)
    }
  }
  const fetchDefinition = fetch.definition
  const searchDefinition = search.definition
  const names = [fetchDefinition.name, searchDefinition.name]
  if (new Set(names).size !== names.length) {
    throw new TypeError('buildWebFamilyContribution: duplicate native name claims — the two rows carry two distinct spellings')
  }
  const inputContractDigest = sha256Hex(canonicalJsonStringify([fetchDefinition, searchDefinition].map((definition) => ({
    name: definition.name,
    parameters: definition.parameters,
    required: definition.parameters.required ?? null,
  }))))
  const outputContractDigest = sha256Hex(canonicalJsonStringify([fetchDefinition, searchDefinition].map((definition) => ({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
    presentationMeta: definition.output?.presentationMeta?.toString?.() ?? null,
  }))))
  const sourceDocument = canonicalJsonStringify({
    rows: [
      {
        name: fetchDefinition.name,
        parameters: fetchDefinition.parameters,
        execute: fetchDefinition.execute?.toString?.() ?? null,
        executor: fetch.executorFactory?.toString?.() ?? null,
      },
      {
        name: searchDefinition.name,
        parameters: searchDefinition.parameters,
        execute: searchDefinition.execute?.toString?.() ?? null,
        executor: search.executorFactory?.toString?.() ?? null,
      },
    ],
    mechanics: sourceLossless(mechanics),
    transport: sourceLossless(transport),
    providerLaw: sourceLossless(providerLaw),
    // The trusted bound and the mounted provider destinations ride the
    // digest: changing the byte/time scheme bound, or mounting a different
    // provider (a different effect truth), is a DIFFERENT reviewed
    // candidate — never a silent drift of a live family.
    bound: {
      allowedSchemes: [...bound.allowedSchemes],
      httpLoopbackAllowed: bound.httpLoopbackAllowed === true,
      maxBytes: bound.maxBytes,
      timeoutMs: bound.timeoutMs,
    },
    providerDestinations: [...destinations],
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.web-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/web-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      id: 'dsh-agent-team/web-family',
      digest: sha256Hex(canonicalJsonStringify({
        familyId: 'dsh.web-family',
        selector: 'packages/tools/web-family/src',
        rows: ['web_fetch', 'web_search'],
      })),
    },
    // The NEW named network capability (manifest.json kernelCapabilities,
    // backsExecution 'family-body'). One family-body execution drives both
    // rows through the ONE transport port, so one capability backs both.
    requiredCapabilities: ['network-egress'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The fixed-native takeover law (§ CI-04): both rows carry their
      // NATIVE spellings; the reviewed family manifest (sha256) + the arc-A
      // census are what pin these claims — the Gate 0b ledger covers only
      // the four configurable rows and is DISCLOSED as not carrying this
      // pair (the seam family's fixed-native precedent: fs
      // write/edit/read_image, jobs trio).
      nativeNames: ['web_fetch', 'web_search'],
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
      // `connect` on `network-destination` is the CLOSED pair the frozen
      // vocabulary binds network to — the family declares exactly this and
      // nothing else.
      kinds: ['connect'],
      targets: ['network-destination'],
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
