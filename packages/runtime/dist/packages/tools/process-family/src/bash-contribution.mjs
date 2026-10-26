/**
 * process-family/src/bash-contribution.mjs — the PROCESS family's
 * `bash`/shell contribution DESCRIPTOR (U6 PR3; U6-SLICE-PLAN PR3: the
 * family "extends … with the confined-shell contribution via the PR1
 * schema + Registry"). The PR2 fs-family precedent in both shape and law.
 *
 * DATA, NOT AUTHORITY: this factory describes the six §4 boundaries of the
 * governed shell row and states, as data, that admission / grant mint /
 * grant consume stay `kernel` (§ CI-06 — self-approval is unexpressable).
 * The descriptor is validated by the Kernel's closed schema at
 * registration; nothing here decides, admits, or grants.
 *
 * CI-07 (the provider is NAMED and REVIEWED, never a family
 * self-attestation): the execution body drives the repository's confined
 * process provider — `packages/runtime/sandbox-provider/` (the Landlock
 * launcher, the byte-pin double gate, the frozen lease/terminate law).
 * The provider pairing (trustRoot ⇄ launcher digest, Gate 0c) stays the
 * TRUSTED MOUNT's law; its validated config enters the executor unchanged
 * and the launcher pin rides the source digest computed below. `source.kind`
 * stays `family-owned` (the selector names the family lane code, exactly
 * like fs-read) — the named-bridge backing is the PR4 Jobs-bridge family
 * (ARC-C), not this lane.
 *
 * The digests are CONTENT bindings computed here (the registering side
 * computes what it claims to bind; the schema validator checks shape):
 * inputContractDigest binds the row's closed parameter schema; the source
 * digest binds the family's shell code as one canonical document (the
 * placed definition, the confined executor body, the settle/cancel/drain
 * mechanics, the pure normalizer, and the mount's launcher pin when the
 * assembly carries one). A content edit changes the digest; the Kernel's
 * registration ledger then records a DIFFERENT contribution — which is
 * exactly the point.
 *
 * @module process-family/bash-contribution
 */
import { createHash } from 'node:crypto'
import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import * as shellMechanics from './shell-mechanics.mjs'
import * as bashRow from './bash-row.mjs'
import * as confinedShellExecutor from './confined-shell-executor.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The row's closed parameter schema, exactly as `buildBashRowDefinition`
 *  places it (the digest must bind the PLACED contract, not a copy). */
function inputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    name: definition.name,
    parameters: definition.parameters,
    required: definition.parameters.required ?? null,
  }))
}

/** The output/Result boundary digest: the presentation schema the mount
 *  decorates the placed row with (the plane's pinned presentation face). */
function outputContractDigestOf(definition) {
  return sha256Hex(canonicalJsonStringify({
    output: definition.output?.schema ?? null,
    render: definition.output?.render?.toString?.() ?? null,
    presentationMeta: definition.output?.presentationMeta?.toString?.() ?? null,
  }))
}

/**
 * Build the process-shell contribution descriptor for registration.
 *
 * @param {object} input
 * @param {object} input.definition - the live row Definition from
 *   `buildBashRowDefinition` (digests bind the placed artifact).
 * @param {string} input.cancelBoundary - the documented cancel-boundary
 *   text for the §4 Lifecycle boundary (the mount states what its executor
 *   row honestly guarantees).
 * @param {string} [input.launcherPin] - the mount's reviewed launcher
 *   digest when the assembly carries one (CI-07 provider pin; rides the
 *   source digest so a pin change is a DIFFERENT contribution).
 * @returns a plain descriptor object (closed-world; the Kernel's validator
 *   re-checks every key fail-closed).
 */
export function buildProcessShellContribution({ definition, cancelBoundary, launcherPin }) {
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
    name: definition.name,
    parameters: definition.parameters,
    execute: definition.execute?.toString?.() ?? null,
    executor: sourceLossless(confinedShellExecutor),
    mechanics: sourceLossless(shellMechanics),
    row: sourceLossless(bashRow),
    launcherPin: launcherPin ?? null,
  })
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId: 'dsh.process-family',
    familyVersion: '0.1.0',
    source: {
      kind: 'family-owned',
      selector: 'packages/tools/process-family/src',
      digest: sha256Hex(sourceDocument),
    },
    provider: {
      // CI-07: the NAMED, reviewed confined process provider this family's
      // execution drives (never a self-attestation; the Gate 0c pairing
      // stays the mount's).
      id: 'dsh-agent-team/sandbox-provider',
      digest: sha256Hex(canonicalJsonStringify({
        familyId: 'dsh.process-family',
        provider: 'packages/runtime/sandbox-provider',
        launcherPin: launcherPin ?? null,
      })),
    },
    // 'process-spawn' is the Kernel capability this family REQUIRES; the
    // kernel's manifest must name it (and its backing) or registration
    // fails closed (CAPABILITY_UNKNOWN / CAPABILITY_UNBACKED).
    requiredCapabilities: ['process-spawn'],
    optionalCapabilities: [],
    visibility: {
      owner: 'family',
      // The takeover spelling law (§ CI-04): the row carries the mount
      // spelling validated by Gate 0b (native 'bash' takeover or the
      // managed `team_bash` alias — same row, same mechanism).
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
      // The a5p5 effect-declaration namespace: one `tool-invoke` arm keyed
      // by the NATIVE class ('bash'); the opaque command's process spawn
      // is the class's effect (the authority hashes the command verbatim —
      // bash-normalizer.ts; no parsing, no claimed granularity).
      kinds: ['tool-invoke', 'process-spawn'],
      targets: ['confined-process-realm'],
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
