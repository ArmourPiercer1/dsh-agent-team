/**
 * search-family/src/search-contribution.mjs — the SEARCH family's
 * grep+glob contribution DESCRIPTOR (U6 PR5; U6-SLICE-PLAN PR5: the moved
 * real family joins the Kernel through the PR1 closed schema, the same form
 * fs-read (PR2) and process-shell (PR3) carry).
 *
 * DATA, NOT AUTHORITY: this factory describes the six §4 boundaries of the
 * two governed search rows and states, as data, that admission / grant mint
 * / grant consume stay `kernel` (§ CI-06 — self-approval is unexpressable).
 * The descriptor is validated by the Kernel's closed schema
 * (`governance-center/contribution-schema`) at registration; nothing here
 * decides, admits, or grants.
 *
 * CI-07 (the provider is NAMED and REVIEWED, never a family
 * self-attestation): the rg rows drive the repository's confined process
 * provider — `packages/runtime/sandbox-provider/` (the Landlock launcher,
 * the byte-pin double gate, the frozen lease/terminate law) — the SAME
 * reviewed provider the process family names; the confined-rg walk is
 * read-scoped by its own allowPaths law (system rx dirs + the rg bin dir +
 * a READ_DIR/READ_FILE grant on the anchored root — the rw lane stays
 * exclusively the shell row's). The provider pairing (trustRoot ⇄ launcher
 * digest, Gate 0c) stays the TRUSTED MOUNT's law; the launcher pin rides
 * the source digest computed below, so a pin change is a DIFFERENT
 * contribution.
 *
 * The digests are CONTENT bindings computed here (the registering side
 * computes what it claims to bind; the schema validator checks shape):
 * each row's inputContractDigest binds the PLACED closed parameter schema
 * (the live definitions), and the source digest binds the family's whole
 * moved implementation as one canonical document (both row definitions,
 * the mechanics namespace, the two confined-rg backends, the shared cancel
 * leg, and the pure row face). A content edit changes the digest; the
 * Kernel's registration ledger then records a different contribution —
 * exactly the point.
 *
 * @module search-family/search-contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import * as searchMechanics from './search-mechanics.mjs'
import * as rgSearchBackend from './search-backend.mjs'
import * as rgGlobBackend from './glob-backend.mjs'
import * as cancelLeg from './cancel-leg.mjs'
import * as searchRow from './search-row.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The row's closed parameter schema, exactly as placed (digest binds the
 *  PLACED contract, not a copy — the live definitions are handed in). */
function inputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    name: definition.name,
    parameters: definition.parameters,
    required: definition.parameters.required ?? null,
  }))
}

/** The output/Result boundary digest over one live row Definition. */
function outputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
    presentationMeta: definition.output?.presentationMeta?.toString?.() ?? null,
    presentResult: definition.presentResult?.toString?.() ?? null,
  }))
}

/**
 * Build the search contribution descriptor (grep + glob, ONE family — the
 * two rows share the reviewed rg provider, the cancel leg, and the mount's
 * kernel; they land as TWO claimed native names on one candidate).
 *
 * @param {object} input
 * @param {object} input.grepDefinition - the live grep row Definition
 *   (from `buildSearchRowDefinitions`; digests bind the placed artifact).
 * @param {object} input.globDefinition - the live glob row Definition.
 * @param {string} input.cancelBoundary - the documented cancel-boundary
 *   text the trusted mount supplies (the row law, not a decision).
 * @param {string} [input.launcherPin] - the mount's validated launcher
 *   digest when present (CI-07 provider pin; rides the source digest so a
 *   pin change is a DIFFERENT contribution).
 * @returns a plain descriptor object (closed-world; the Kernel's validator
 *   re-checks every key fail-closed).
 */
export function buildSearchContribution({ grepDefinition, globDefinition, cancelBoundary, launcherPin }) {
  // LOSSLESS-JSON law (contracts canonicalJsonStringify): the bound source
  // document is DATA — every function in the lane's module namespaces is
  // pinned as its SOURCE TEXT; anything non-JSON-safe degrades to a stable
  // marker, never to silence.
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
    grep: { name: grepDefinition.name, parameters: grepDefinition.parameters, execute: grepDefinition.execute?.toString?.() ?? null },
    glob: { name: globDefinition.name, parameters: globDefinition.parameters, execute: globDefinition.execute?.toString?.() ?? null },
    mechanics: sourceLossless(searchMechanics),
    rgSearchBackend: sourceLossless(rgSearchBackend),
    rgGlobBackend: sourceLossless(rgGlobBackend),
    cancelLeg: sourceLossless(cancelLeg),
    row: sourceLossless(searchRow),
    launcherPin: launcherPin ?? null,
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.search-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/search-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      // CI-07: the NAMED, reviewed confined process provider these rows'
      // execution drives (never a self-attestation; the Gate 0c pairing
      // stays the mount's; the rw lane never rides — read-scoped allowPaths
      // are the rows' own law).
      id: 'dsh-agent-team/sandbox-provider',
      digest: sha256Hex(canonicalJsonStringify({
        familyId: 'dsh.search-family',
        provider: 'packages/runtime/sandbox-provider',
        launcherPin: launcherPin ?? null,
      })),
    },
    // 'fs-search' is the Kernel capability this family REQUIRES; the
    // kernel's manifest must name it (and its backing) or registration
    // fails closed (CAPABILITY_UNKNOWN / CAPABILITY_UNBACKED).
    requiredCapabilities: ['fs-search'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The two mount spellings validated by Gate 0b (§ CI-04: dispatch
      // resolves THESE placements; the names are claimed exclusively — a
      // second candidate claiming either is a NAME_COLLISION refusal).
      nativeNames: [grepDefinition.name, globDefinition.name],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      // The ONE inputContractDigest binds BOTH rows' closed schemas (the
      // candidate covers both; the closed set is {grep, glob}).
      inputContractDigest: sha256Hex(canonicalJsonStringify({
        grep: inputContractDigestOf(grepDefinition),
        glob: inputContractDigestOf(globDefinition),
      })),
      outputContractDigest: sha256Hex(canonicalJsonStringify({
        grep: outputContractDigestOf(grepDefinition),
        glob: outputContractDigestOf(globDefinition),
      })),
      normalization: 'pure',
    },
    effects: {
      declared: true,
      // The a5p5 effect-declaration namespace: read/list arms keyed by the
      // NATIVE classes ('grep'/'glob' — realm reads, never writes; the
      // rg/grep processes are confined READ-scoped walks, the rw lane stays
      // the shell row's exclusively).
      kinds: ['read', 'list'],
      // Every target stays inside the member's admitted file root; escaping
      // targets are refused by the anchor law (resolveAnchored via the
      // fs-family face) BEFORE any spawn.
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
