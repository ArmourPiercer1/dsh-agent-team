/**
 * lib/arm-verdict.mjs — R-ENVBLOCK-1: the three-way law for an UNWITNESSED arm.
 *
 * A C2 arm whose expected witness (an approval row, a wired call, a typed
 * refusal) is absent can mean three different things, and this repo has been
 * sloppy about which claim it is making:
 *
 *   1. FAIL          the drive DID reach the expected step and the product did
 *                    not produce the witness → a product fact.
 *   2. NOT_REACHED   the drive never got to that step → a fact about THIS TEST
 *                    HARNESS (drive order, cadence, budget). It says NOTHING
 *                    about the environment and must never be read as one.
 *   3. ENV_BLOCK     the environment itself could not provide what the arm
 *                    needs (the host refuses to provision the governed surface,
 *                    a kit cannot be provisioned, the sandbox backend is
 *                    unusable, a port/permission wall) → an environment fact,
 *                    and it is only usable as evidence when the SIGNAL IS
 *                    QUOTED AND VERIFIABLE.
 *
 * Before this helper, a suite could (and did: `web:fetch-positive`) write
 * ENV_BLOCK with nothing but an in-test sentence — an environment claim with
 * no environment evidence, which launders a harness gap into "the host is at
 * fault". `envSignal()` is now the only way to earn ENV_BLOCK, and
 * `gateEnvBlock()` is the door a suite's `add()` runs every verdict through,
 * so a future writer cannot emit ENV_BLOCK without a signal: it is demoted to
 * NOT_REACHED with the would-be reason kept.
 *
 * The shape mirrors the existing precedent in lib/host-sandbox-assets.mjs
 * (`nativeConfinementEnvBlock`): return `null` unless hard proof exists, and
 * quote the typed signal inside the returned object.
 */

export const NOT_REACHED = 'NOT_REACHED'

/**
 * The closed set of channels a signal may be quoted FROM. A channel is a place
 * a human can go re-read the same text: the captured host log, the host's
 * captured stderr/stdout, the kit-provisioning record, the sandbox pre-flight
 * record, the OS bind result. Anything else is inference, not observation.
 */
export const ENV_SIGNAL_CHANNELS = Object.freeze([
  'host-log',
  'host-stderr',
  'host-stdout',
  'kit-provision',
  'sandbox-preflight',
  'port-bind',
])

/**
 * Environment-class signals: the host/platform could not provide the thing the
 * arm needs. Deliberately narrow — every pattern names a provider of a
 * resource, not a decision about a request.
 */
const ENV_SIGNAL_PATTERNS = Object.freeze([
  // the plane refused to hand the member the governed surface at all
  /a5-plane: (?:mount|placement)-REFUSED/,
  // kit / runtime provisioning refused or impossible
  /kit[- ](?:provision|provisioning|install)\S*\s+(?:REFUSED|refused|failed|FAILED)/,
  /no (?:usable|available) sandbox backend|sandbox backend:?\s*unusable|probe\S{0,16}unusable/,
  // OS-level walls observed while binding a listener or touching the home
  /EADDRINUSE|EACCES|EPERM|ENOENT[\s:]/,
])

/**
 * PRODUCT refusal classes. A governed tool refusing a destination, a binding
 * or a request is the product working — it is the WITNESS a great many arms
 * are asserting, and it must never be promoted into an environment claim.
 * Checked BEFORE the environment patterns.
 */
const PRODUCT_REFUSAL_PATTERNS = Object.freeze([
  /PLANE_WEB_[A-Z_]+/,
  /PLANE_AGENT_STATE_[A-Z_]+/,
  /governed-web-\w+ (?:REFUSED|pa-refused|lane-denied|default-deny)/,
  /APPROVAL_DENIED/,
  /WEB_SEARCH_NO_PROVIDER/,
])

/**
 * Prove (or fail to prove) an environment-unavailability signal.
 *
 * @param {object} input
 * @param {string} input.channel        one of ENV_SIGNAL_CHANNELS
 * @param {string} input.text           the VERBATIM observed line the writer
 *                                      wants to stand behind
 * @param {string[]} input.observed     the corpus this run actually captured
 *                                      from that channel (host-log lines read
 *                                      off disk, provisioning records, …)
 * @param {object} [input.preflight]    required for `sandbox-preflight`: the
 *                                      run's pre-flight record; only
 *                                      `backend === 'unusable'` proves it
 * @returns {{channel: string, text: string, proof: string, observedCount: number}|null}
 *          the quotable signal, or null (= there is NO environment evidence)
 */
export function envSignal({ channel = null, text = null, observed = [], preflight = null } = {}) {
  if (!ENV_SIGNAL_CHANNELS.includes(channel)) return null
  const quote = typeof text === 'string' ? text.trim() : ''
  if (quote.length === 0) return null
  if (!Array.isArray(observed) || observed.length === 0) return null
  // Membership, not fuzzy matching: the quote must be a line this run really
  // captured, so a writer cannot paraphrase, summarise, or invent one.
  const index = observed.findIndex((l) => typeof l === 'string' && l.trim() === quote)
  if (index < 0) return null
  if (PRODUCT_REFUSAL_PATTERNS.some((re) => re.test(quote))) return null
  if (!ENV_SIGNAL_PATTERNS.some((re) => re.test(quote))) return null
  if (channel === 'sandbox-preflight' && preflight?.backend !== 'unusable') return null
  return {
    channel,
    text: quote,
    proof: `verbatim line ${String(index)} of ${String(observed.length)} captured on the "${channel}" channel`,
    observedCount: observed.length,
  }
}

/**
 * Classify an arm whose expected witness is absent.
 *
 * @param {object} input
 * @param {string} input.step            human name of the expected step, for the reason
 * @param {boolean} input.reachedStep    did the drive reach that step? (witnessed arrival)
 * @param {object|null} [input.signal]   the result of envSignal(), nothing else
 * @param {object} [input.extra]         facts folded into the recorded detail
 * @returns {{verdict: string, detail: object}}
 */
export function classifyUnwitnessedArm({ step = 'the expected step', reachedStep = false, signal = null, extra = {} } = {}) {
  if (reachedStep === true) {
    return {
      verdict: 'FAIL',
      detail: { reason: `the drive reached ${step} and the expected witness is absent — product behavior`, ...extra },
    }
  }
  if (signal !== null && typeof signal === 'object' && typeof signal.text === 'string') {
    return {
      verdict: 'ENV_BLOCK',
      detail: {
        reason: `the drive never reached ${step}; the environment itself refused what this arm needs — quoted signal (${signal.channel}): ${signal.text}`,
        envSignal: signal,
        ...extra,
      },
    }
  }
  return {
    verdict: NOT_REACHED,
    detail: {
      reason: `the drive never reached ${step} and no environment-unavailability signal was observed — a TEST-HARNESS fact, NOT an environment claim`,
      ...extra,
    },
  }
}

/**
 * The door every suite `add()` runs a verdict through. ENV_BLOCK is the only
 * verdict it rewrites: an ENV_BLOCK without a well-formed `envSignal` is a
 * harness non-arrival wearing an environment's clothes, so it is demoted and
 * the writer's reason is kept for the reader.
 *
 * @param {string} verdict
 * @param {object} detail
 * @returns {{verdict: string, detail: object}}
 */
export function gateEnvBlock(verdict, detail = {}) {
  if (verdict !== 'ENV_BLOCK') return { verdict, detail }
  const sig = detail?.envSignal
  const ok = sig !== null && typeof sig === 'object'
    && ENV_SIGNAL_CHANNELS.includes(sig.channel)
    && typeof sig.text === 'string' && sig.text.trim().length > 0
  if (ok) return { verdict, detail }
  return {
    verdict: NOT_REACHED,
    detail: {
      ...detail,
      reason: `ENV_BLOCK demoted by the R-ENVBLOCK-1 gate: no verifiable environment signal was supplied. Original writer reason: ${String(detail?.reason ?? '(none)')}`,
    },
  }
}
