/**
 * pwsh-exclusion.mjs — the LAW that makes the `pwsh` exclusion conditional on
 * the SHIPPED WIRING, never on the measuring host.
 *
 * Why this file exists: the first revision of `lane-suite.test.mjs` asserted
 * `PROBE-PWSH binary=ABSENT` as a constant. That is true on the author's laptop
 * and FALSE on a GitHub runner (which ships PowerShell), and hosted run
 * 44843401144 red on exactly that assertion. The assertion encoded a machine,
 * not the repository: "we cannot cover what the shipped wiring does not serve"
 * is the rule, and the presence of a `pwsh` binary is an OBSERVATION about a
 * host, not a reason.
 *
 * So the exclusion is derived here from three REPO facts — all measured by
 * `probe-composition.mjs` — and the corpus is obliged to carry a `pwsh` vector
 * the moment ANY of them starts serving the name:
 *
 *   1. a route-C shadow exists for `pwsh` (`PROBE-PWSH route-c-shadow`),
 *   2. the shipped governed preset mounts the `tool-pwsh` row
 *      (`PROBE-PWSH preset-row`),
 *   3. a definition for `pwsh` is registered on the post-attach Member scope
 *      (`PROBE-REGISTRY`).
 *
 * If one of them is true and the corpus has no `pwsh` vector, this module
 * REFUSES the exclusion loudly (`PWSH-EXCLUSION-UNJUSTIFIED`) instead of letting
 * a machine that really serves `pwsh` inherit a stale exclusion.
 *
 * @module tests/ute-g1-process/lib/pwsh-exclusion
 */

/** The named refusal code. A conditional exclusion must be able to say "no". */
export const PWSH_EXCLUSION_REFUSAL = 'PWSH-EXCLUSION-UNJUSTIFIED'

/** A refused exclusion. */
export class PwshExclusionError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(`${code}: ${message}`)
    this.name = 'PwshExclusionError'
    this.code = code
  }
}

/**
 * @typedef {object} PwshWiringFacts
 * @property {boolean} shadowPresent - a route-C shadow exists for `pwsh`.
 * @property {boolean} presetMountsPwsh - the shipped governed preset mounts `tool-pwsh`.
 * @property {boolean} registered - the post-attach Member scope has a `pwsh` definition.
 * @property {readonly {entry: string}[]} vectors - the corpus rows.
 */

/**
 * Build the facts from the corpus and the three measured wiring booleans.
 * @param {object} input
 * @param {boolean} input.shadowPresent
 * @param {boolean} input.presetMountsPwsh
 * @param {boolean} input.registered
 * @param {readonly {entry: string}[]} input.vectors
 * @returns {PwshWiringFacts}
 */
export function wiringFacts({ shadowPresent, presetMountsPwsh, registered, vectors }) {
  for (const [name, value] of Object.entries({ shadowPresent, presetMountsPwsh, registered })) {
    if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean, got ${JSON.stringify(value)}`)
  }
  return Object.freeze({
    shadowPresent,
    presetMountsPwsh,
    registered,
    vectors: Object.freeze([...vectors]),
  })
}

/**
 * Does this wiring serve `pwsh` at all?
 * @param {PwshWiringFacts} facts
 * @returns {boolean}
 */
export function wiringServesPwsh(facts) {
  return facts.shadowPresent === true || facts.presetMountsPwsh === true || facts.registered === true
}

/**
 * The obligation: an exclusion is allowed ONLY while the wiring serves no
 * `pwsh`; the moment it does, the corpus must carry a vector for the member.
 *
 * @param {PwshWiringFacts} facts
 * @returns {{status: 'EXCLUDED'|'COVERED', reasons: string[]}}
 * @throws {PwshExclusionError} `PWSH-EXCLUSION-UNJUSTIFIED` when the wiring
 *   serves `pwsh` and the corpus has no `pwsh` vector.
 */
export function coverageObligation(facts) {
  const serves = wiringServesPwsh(facts)
  const hasVector = facts.vectors.some((vector) => vector.entry === 'pwsh')
  if (serves && !hasVector) {
    const serving = [
      facts.shadowPresent ? 'route-c-shadow=PRESENT' : null,
      facts.presetMountsPwsh ? 'preset-row=MOUNTS-tool-pwsh' : null,
      facts.registered ? 'post-attach-definition=REGISTERED' : null,
    ].filter((value) => value !== null)
    throw new PwshExclusionError(
      PWSH_EXCLUSION_REFUSAL,
      `the shipped wiring serves pwsh (${serving.join(', ')}) but no corpus vector covers member "pwsh" — the exclusion is conditional on the wiring, so it cannot be inherited by a composition that really serves the name`,
    )
  }
  if (serves && hasVector) return { status: 'COVERED', reasons: ['wiring serves pwsh and the corpus covers it'] }
  if (hasVector) return { status: 'COVERED', reasons: ['the corpus carries a pwsh vector even though this wiring does not serve it'] }
  return {
    status: 'EXCLUDED',
    reasons: ['route-c-shadow=ABSENT', 'preset-row=REMOVED', 'post-attach-definition=ABSENT'],
  }
}

/**
 * Read the three wiring facts OUT of the probe's own printed output. Sharing
 * this parser between the lane suite and the controls keeps ONE law: a control
 * that "passes" while the suite reads different facts would prove nothing.
 *
 * The probe's `binary=…` fields are deliberately NOT read here: they describe
 * the host, and no rule may depend on them.
 *
 * @param {string} probeOutput
 * @returns {{shadowPresent: boolean, presetMountsPwsh: boolean, registered: boolean}}
 */
export function measureWiring(probeOutput) {
  const lines = String(probeOutput ?? '').split('\n')
  const pwsh = lines.filter((line) => line.startsWith('PROBE-PWSH '))
  const registry = lines.find((line) => line.startsWith('PROBE-REGISTRY '))
  if (pwsh.length === 0) throw new PwshExclusionError(PWSH_EXCLUSION_REFUSAL, 'the probe printed no PROBE-PWSH line, so the wiring facts cannot be measured')
  if (registry === undefined) throw new PwshExclusionError(PWSH_EXCLUSION_REFUSAL, 'the probe printed no PROBE-REGISTRY line, so the post-attach definition fact cannot be measured')
  const shadowLine = pwsh.find((line) => line.includes('route-c-shadow='))
  const presetLine = pwsh.find((line) => line.includes('preset-row='))
  if (shadowLine === undefined) throw new PwshExclusionError(PWSH_EXCLUSION_REFUSAL, 'no route-c-shadow fact was measured')
  if (presetLine === undefined) throw new PwshExclusionError(PWSH_EXCLUSION_REFUSAL, 'no preset-row fact was measured')
  const shadowMatch = /route-c-shadow=(ABSENT|PRESENT)/u.exec(shadowLine)
  const presetMatch = /preset-row=(REMOVED|MOUNTED)/u.exec(presetLine)
  const registryMatch = /pwsh=(MISSING|registered)\b/u.exec(registry)
  if (shadowMatch === null || presetMatch === null || registryMatch === null) {
    throw new PwshExclusionError(PWSH_EXCLUSION_REFUSAL, `a wiring fact could not be parsed: ${JSON.stringify({ shadowLine, presetLine, registry })}`)
  }
  return {
    shadowPresent: shadowMatch[1] === 'PRESENT',
    presetMountsPwsh: presetMatch[1] === 'MOUNTED',
    registered: registryMatch[1] === 'registered',
  }
}

/** The one printable line describing the measured wiring. */
export function wiringLine(facts) {
  return `PWSH-WIRING shadow=${facts.shadowPresent ? 'PRESENT' : 'ABSENT'} preset=${facts.presetMountsPwsh ? 'MOUNTS' : 'REMOVED'} registered=${facts.registered ? 'yes' : 'no'} vectors=${facts.vectors.filter((vector) => vector.entry === 'pwsh').length}`
}
