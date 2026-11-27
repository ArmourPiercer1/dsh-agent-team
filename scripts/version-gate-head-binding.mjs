#!/usr/bin/env node
/**
 * version-gate-head-binding.mjs — the ONE place the version gate decides WHICH commit it grades.
 *
 * THE GAP THIS CLOSES (round 127). `candidate-acceptance.yml` accepted
 * `workflow_dispatch` with `head=<40-hex>` and checked that SHA out, while
 * `github.sha` stayed the commit of the DISPATCHED REF. A workflow that is
 * triggered at commit A could therefore grade commit B: the receipt says B, the
 * run's identity says A, and "the version gate passed" would describe a run that
 * never saw the tree it certified. Secrets, environments, concurrency and the
 * protected-branch rules all attach to the triggering ref, so grading a different
 * SHA is not a convenience — it is a confused deputy.
 *
 * THE RULE (explicit, not inferred). The graded head MUST equal the triggering
 * commit (`github.sha`) for EVERY event, including `workflow_dispatch`. A dispatch
 * whose requested `head` differs is refused with the typed code
 * `VERSION_GATE_SHA_BINDING_REFUSED` before checkout.
 *
 * THE SUPPORTED FROZEN-SHA PATH. To grade a commit that is not the tip of a
 * version ref, do not point a dispatch at it. Push a `candidate/**` or
 * `release/**` branch AT that commit (the push trigger sets `github.sha` to the
 * pushed head) and let the push run the gate — or dispatch ON that branch/ref,
 * whose commit is then the frozen SHA. The gate grades exactly what the trigger
 * ran on; that is the property a receipt needs.
 *
 *   node scripts/version-gate-head-binding.mjs \
 *     --requested "$REQUESTED" --github-sha "$GITHUB_SHA" --event "$EVENT"
 *     prints the bound 40-hex SHA on success; on refusal prints
 *     `::error::VERSION-GATE refused (<CODE>): …` and exits 1.
 *
 * Exported for scripts/version-gate-verify.test.mjs (unit) and
 * scripts/eb3-ci-required.mjs (workflow-shape assertion `checkVersionGateBinding`).
 *
 * @module scripts/version-gate-head-binding
 */

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** A dispatch asked the gate to grade a commit other than the one that triggered it. */
export const VERSION_GATE_SHA_BINDING_REFUSED = 'VERSION_GATE_SHA_BINDING_REFUSED'

/** The requested head is not a full 40-hex commit id at all. */
export const VERSION_GATE_HEAD_NOT_SHA = 'VERSION_GATE_HEAD_NOT_SHA'

/** The documented way to put an arbitrary frozen commit in front of the gate. */
export const FROZEN_SHA_SUPPORTED_PATH = 'push a candidate/** or release/** branch AT the frozen SHA (that push runs with github.sha = the frozen SHA), then dispatch on that branch — a dispatch can never name a SHA the trigger did not run on'

/** The single script token the workflow MUST execute; the shape check greps for it. */
export const HEAD_BINDING_SCRIPT = 'scripts/version-gate-head-binding.mjs'

/**
 * Bind the graded head to the triggering commit.
 *
 * @param {{eventName?: string, requestedSha?: string, githubSha?: string}} p
 * @returns {{ok: true, sha: string} | {ok: false, code: string, message: string}}
 */
export function bindVersionGateHead({ eventName = '', requestedSha = '', githubSha = '' } = {}) {
  const requested = String(requestedSha ?? '').trim()
  const github = String(githubSha ?? '').trim()
  if (!/^[0-9a-f]{40}$/u.test(requested)) {
    return {
      ok: false,
      code: VERSION_GATE_HEAD_NOT_SHA,
      message: `requested head ${JSON.stringify(requested)} is not a full 40-hex commit id; a branch, tag or abbreviated SHA cannot be frozen`,
    }
  }
  if (!/^[0-9a-f]{40}$/u.test(github)) {
    return {
      ok: false,
      code: VERSION_GATE_HEAD_NOT_SHA,
      message: `github.sha ${JSON.stringify(github)} is not a full 40-hex commit id; refusing to bind a head to an unidentifiable trigger`,
    }
  }
  if (requested !== github) {
    const event = String(eventName ?? '') || 'unknown-event'
    return {
      ok: false,
      code: VERSION_GATE_SHA_BINDING_REFUSED,
      message: `event ${event} ran at github.sha ${github} but asked to grade ${requested}; the gate grades ONLY the triggering commit. Supported frozen-SHA path: ${FROZEN_SHA_SUPPORTED_PATH}`,
    }
  }
  return { ok: true, sha: requested }
}

/**
 * The WORKFLOW-SHAPE assertion (used by `eb3-ci-required.mjs`): the version-gate
 * workflow must execute this script in its head-resolution step, so the rule above
 * is the one the run actually applies rather than prose in a comment.
 *
 * @param {unknown} doc parsed workflow YAML
 * @returns {Array<{code: string, detail: string}>}
 */
export function checkVersionGateBinding(doc) {
  const findings = []
  const text = JSON.stringify(doc ?? {})
  if (!text.includes(HEAD_BINDING_SCRIPT)) {
    findings.push({
      code: 'CI_VERSION_GATE_SHA_BINDING_MISSING',
      detail: `the version-gate workflow no longer executes ${HEAD_BINDING_SCRIPT} — the graded head can drift from the triggering commit again (a dispatch would be able to certify a commit the run did not trigger on)`,
    })
  }
  return findings
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const arg = (name) => {
    const i = argv.indexOf(name)
    return i > -1 ? argv[i + 1] : undefined
  }
  const result = bindVersionGateHead({
    eventName: arg('--event') ?? '',
    requestedSha: arg('--requested') ?? '',
    githubSha: arg('--github-sha') ?? '',
  })
  if (!result.ok) {
    console.error(`::error::VERSION-GATE refused (${result.code}): ${result.message}`)
    process.exit(1)
  }
  console.log(result.sha)
}
