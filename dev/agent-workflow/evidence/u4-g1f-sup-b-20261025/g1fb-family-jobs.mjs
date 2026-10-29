/**
 * g1fb-family-jobs.mjs — FAMILY-OWNED declarations for the Jobs bridge ROWS
 * (PoC-3 / ARC-C). The ROWS are plain governed families (they ride the ONE
 * generic registration + the ONE ledger); the SPECIAL mechanism (owner fence,
 * attribution, abort-aware wait, host-face delta composition) lives ONLY in
 * the bridge module. Row bodies contain no decision logic and no second
 * ledger: they hand the dispatch-named caller to the bridge.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-family-jobs
 */
import { record } from './g1fb-lib.mjs'

const TEXT_OUT = {
  type: 'object',
  additionalProperties: false,
  properties: { text: { type: 'string' } },
  required: ['text'],
}

const allow = () => ({ lane: 'allow' })

function row(name, description, parameters) {
  return Object.freeze({
    familyId: 'P3-BRIDGE-JOBS',
    version: 1,
    name,
    description,
    parameters,
    outputSchema: TEXT_OUT,
    policy: allow,
    async execute(args, exec, deps) {
      const caller = String(exec?.agent?.id ?? '')
      record({ leg: 'body-start', name, tag: String(args?.tag ?? ''), callId: String(exec?.rootCallId ?? '') })
      const bridge = deps?.bridge?.bridgeFor?.(caller)
      if (bridge === undefined) return { text: 'refused: bridge-unavailable' }
      const out = name === 'job_list'
        ? await bridge.jobList(caller)
        : name === 'job_output'
          ? await bridge.jobOutput(args, caller, exec?.signal)
          : await bridge.jobKill(args, caller)
      record({ leg: 'body-end', name, tag: String(args?.tag ?? ''), text: String(out?.text ?? '').slice(0, 200) })
      return { text: String(out?.text ?? '') }
    },
  })
}

export const JOBS_FAMILIES = Object.freeze([
  row('job_list', 'G1F governed job_list (PoC, bridge-backed). Args {tag}.', {
    type: 'object', properties: { tag: { type: 'string' } }, required: [],
  }),
  row('job_output', 'G1F governed job_output (PoC, bridge-backed). Args {job_id, timeout_ms?, tag}.', {
    type: 'object', properties: { job_id: { type: 'string' }, timeout_ms: { type: 'number' }, tag: { type: 'string' } }, required: ['job_id'],
  }),
  row('job_kill', 'G1F governed job_kill (PoC, bridge-backed). Args {job_id, reason?, tag}.', {
    type: 'object', properties: { job_id: { type: 'string' }, reason: { type: 'string' }, tag: { type: 'string' } }, required: ['job_id'],
  }),
])
