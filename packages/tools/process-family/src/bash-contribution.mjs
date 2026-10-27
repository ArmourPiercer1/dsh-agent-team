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
import * as pwshMechanics from './pwsh-mechanics.mjs'
import * as pwshRow from './pwsh-row.mjs'
import * as pwshExecutor from './pwsh-executor.mjs'
import * as pwshConfined from './pwsh-confined.mjs'

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/**
 * DECLARED→REQUESTED effect mapping (REVIEW-402 round-1 ruling; makes an
 * IMPLICIT mapping explicit — implicit is how the #390 real gap slipped).
 *
 * The contribution below declares `process-spawn` as an honest capability
 * statement, but `process-spawn` is NOT a requestable kind: the requestable
 * vocabulary is the closed `EFFECT_KINDS`
 * (`packages/domain/tool-governance/src/effects.ts`: tool-invoke, read,
 * write, list, meta, connect, domain-ref). Under A2C-1 the shell row's
 * process spawn is authorized by the `tool-invoke(<class>)` arm — the
 * COMMAND IS the authority key, hashed verbatim
 * (`process-family/src/bash-normalizer.ts`; no parsing, no claimed
 * granularity), so the spawn carries no separate requestable arm.
 *
 * DATA ONLY — read by tests and reviewers, never by an executor or the
 * Kernel: both executors' requested sets are byte-for-byte what they were
 * before this table existed, and admission semantics did not move.
 */
export const DECLARED_TO_REQUESTED = Object.freeze({
  'tool-invoke': 'tool-invoke',
  'process-spawn': 'tool-invoke',
})

/** The family's closed parameter contracts as ONE canonical document: the
 *  fs-family multi-row form — per-name `{name, parameters, required}` facts
 *  in placement order (bash first, then pwsh). The digest binds the PLACED
 *  contracts, not copies. */
function inputContractDigestOf(rowDefs) {
  return sha256Hex(canonicalJsonStringify(rowDefs.map((rowDef) => ({
    name: rowDef.name,
    parameters: rowDef.parameters,
    required: rowDef.parameters.required ?? null,
  }))))
}

/** The output/Result boundary digest over the same placement-ordered row
 *  set: the presentation schema the mount decorates each placed row with
 *  (the plane's pinned presentation face). */
function outputContractDigestOf(rowDefs) {
  return sha256Hex(canonicalJsonStringify(rowDefs.map((rowDef) => ({
    output: rowDef.output?.schema ?? null,
    render: rowDef.output?.render?.toString?.() ?? null,
    presentationMeta: rowDef.output?.presentationMeta?.toString?.() ?? null,
  }))))
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
 * @param {object} input.pwsh - U7-F: the shell-class SECOND row carried in
 *   the SAME reviewed candidate (the Registry law is one live candidate per
 *   familyId — DUP_FAMILY_ID refuses a second; the fs family carries its
 *   four rows the same way). `{ definition, cancelBoundary }` over the live
 *   `buildPwshRowDefinition` artifact. REQUIRED: a one-row shell candidate
 *   is no longer a shape this family ships, and a silently-degraded
 *   contribution is exactly what the fail-closed law refuses — the factory
 *   throws a typed error rather than place half the reviewed family.
 * @returns a plain descriptor object (closed-world; the Kernel's validator
 *   re-checks every key fail-closed).
 */
export function buildProcessShellContribution({ definition, cancelBoundary, launcherPin, pwsh }) {
  if (pwsh === undefined || pwsh === null || pwsh.definition === undefined) {
    throw new TypeError('PROCESS_CONTRIBUTION_PWSH_REQUIRED: the process family ships ONE candidate over BOTH shell rows (bash + pwsh); pass the pwsh row part — a half-family contribution is refused fail-closed, never placed')
  }
  // ONE identifier per row definition: the ARC-A fitness scanner binds each
  // `nativeNames` entry to a reviewable `<identifier>.name` spelling.
  const pwshDefinition = pwsh.definition
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
    // U7-F: the pwsh row joins the SAME bound source document — the second
    // shell row's placed definition, its family body, its confined backend,
    // its mechanics and its row face are all pinned HERE; a change to any
    // of them is a DIFFERENT contribution on the kernel ledger.
    pwshName: pwsh.definition.name,
    pwshParameters: pwsh.definition.parameters,
    pwshExecute: pwsh.definition.execute?.toString?.() ?? null,
    pwshRow: sourceLossless(pwshRow),
    pwshExecutor: sourceLossless(pwshExecutor),
    pwshConfined: sourceLossless(pwshConfined),
    pwshMechanics: sourceLossless(pwshMechanics),
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
      // managed `team_bash` alias — same row, same mechanism). U7-F: the
      // pwsh row mounts at its FIXED native spelling (the jobs / fs-mutation
      // precedent — never the renamable `names` map); A2C-1 keeps the two
      // shell authorities apart (`bash authority != pwsh authority`).
      nativeNames: [definition.name, pwshDefinition.name],
      aliases: [],
      profileRequirements: [],
    },
    definition: {
      owner: 'family',
      // The fs-family multi-row form: ONE digest over the per-name closed
      // contracts, in placement order (bash first, then pwsh).
      inputContractDigest: inputContractDigestOf([definition, pwsh.definition]),
      outputContractDigest: outputContractDigestOf([definition, pwsh.definition]),
      normalization: 'pure',
    },
    effects: {
      declared: true,
      // The a5p5 effect-declaration namespace: one `tool-invoke` arm keyed
      // by the NATIVE class ('bash'; U7-F adds 'pwsh' — the same arm, a
      // DIFFERENT authority key per A2C-1); the opaque command's process
      // spawn is the class's effect (the authority hashes the command
      // verbatim — bash-normalizer.ts; no parsing, no claimed granularity).
      // DECLARED→REQUESTED law (REVIEW-402): EVERY kind listed here maps
      // through the exported `DECLARED_TO_REQUESTED` table above onto a
      // kind both shell rows actually request (`tool-invoke`), and the
      // mapping is pinned by test, per row, against EFFECT_KINDS — an
      // unmapped declared kind is a red test, never an implicit read.
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
      // ONE closed field, BOTH rows' honest boundaries (the fs-family
      // multi-row contribution carries its per-row legs the same way).
      cancelBoundary: pwsh.cancelBoundary === undefined
        ? cancelBoundary
        : `${cancelBoundary} || pwsh: ${pwsh.cancelBoundary}`,
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
