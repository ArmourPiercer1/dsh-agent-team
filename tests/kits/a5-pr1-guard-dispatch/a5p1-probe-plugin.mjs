/**
 * a5p1-probe-plugin.mjs — the Alpha.5 PR1 kit's OBSERVER + HAZARD row.
 *
 * It is mounted through the public `agent-preset:registry` seam (a preset the
 * kit declares in the profile patch), so it runs exactly where any third-party
 * Team-side plugin runs: on `agent/created`, inside the Agent's own scope.
 * It contains NO knowledge of the Guard — it never calls `tools.guard`, never
 * inspects the Dispatcher, never grants anything. It is the party the closed
 * world has to hold against.
 *
 * TWO PROBES, because the two timings are different questions:
 *
 *  - `a5p1_early_probe` is registered at `agent/created`, i.e. possibly while
 *    the Team assembly is still running. Its outcome is a DISCLOSED
 *    OBSERVATION, not a criterion: a name the mounted preset contributes
 *    before the assembly publishes is part of the declared surface, and which
 *    side of the publish line `agent/created` falls on is a host fact this kit
 *    measures rather than assumes.
 *  - `a5p1_late_probe` is registered on the agent's FIRST `tools/pre-execute`
 *    event — provably AFTER the Agent was published, because the first call
 *    is what fires it. This is the PoC's H6 shape verbatim
 *    (`hc-dyn-observation.dynRan = true`: the Setup Coverage Gate passed and
 *    the undeclared body still ran). PR1 says it must now be a typed refusal.
 *
 * EVIDENCE CHANNEL. Each probe BODY writes a marker file and appends a ledger
 * row; each call's result (text + isError) is recorded from `tools/post-execute`.
 * Markers are the hard evidence (a body that ran leaves a trace); the ledger
 * carries the denial TEXT, which is what the model actually sees.
 *
 * Kit-provided environment: A5P1_LEDGER, A5P1_MARKER_DIR.
 *
 * @module tests/kits/a5-pr1-guard-dispatch/a5p1-probe-plugin
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5p1-probe'

const LEDGER = process.env['A5P1_LEDGER'] ?? ''
const MARKER_DIR = process.env['A5P1_MARKER_DIR'] ?? ''

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* best-effort: the markers are the hard channel */
  }
}

const slug = (value) => String(value ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const agentLabel = (agent) => String(agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey ?? '(unknown-agent)')

/** Stamp a marker for one probe body (reaching this line IS the measurement). */
function stampMarker(kind, tag, label) {
  try {
    mkdirSync(MARKER_DIR, { recursive: true })
    writeFileSync(join(MARKER_DIR, `${kind}-${slug(tag)}-${slug(label)}.marker`), `${kind} ran ${label} ${new Date().toISOString()}\n`)
  } catch {
    /* an unwritable marker dir shows up as an absent marker */
  }
  record({ leg: 'body-ran', kind, tag: String(tag ?? 'untagged'), agent: label })
}

function probeDefinition(toolName, kind) {
  return {
    name: toolName,
    description: `Alpha.5 PR1 kit probe (${kind}). Arguments: { tag: string }. Writes a marker and returns "${kind}-ran".`,
    parameters: { type: 'object', properties: { tag: { type: 'string' } }, required: [] },
    execute: async (args, exec) => {
      const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
      stampMarker(kind, tag, agentLabel(exec?.agent))
      return `${kind}-ran`
    },
  }
}

/** Record what the model was told about its own probe calls. */
function observeResults(agentCtx, label) {
  try {
    return agentCtx.on('tools/post-execute', (exec, result) => {
      const name = String(exec?.name ?? '')
      if (!name.startsWith('a5p1_')) return
      const text = (Array.isArray(result?.content) ? result.content : []).map((c) => c?.text ?? '').join('')
      record({
        leg: 'probe-result',
        kind: name === 'a5p1_dyn_probe' ? 'dyn' : 'early',
        agent: label,
        isError: result?.isError === true,
        text: text.slice(0, 700),
      })
    })
  } catch (error) {
    record({ leg: 'post-execute-unavailable', agent: label, error: String(error?.message ?? error) })
    return undefined
  }
}

export function apply(ctx) {
  record({ leg: 'plugin-apply' })
  const disposers = []
  const dispose = (off) => {
    if (typeof off === 'function') disposers.push(off)
    else if (off !== null && typeof off === 'object' && typeof off?.dispose === 'function') disposers.push(() => off.dispose())
  }

  dispose(
    ctx.on('agent/created', ({ agent }) => {
      const label = agentLabel(agent)
      const register = (toolName, kind) => {
        try {
          dispose(agent.ctx.tools.register(probeDefinition(toolName, kind)))
          record({ leg: 'register', kind, agent: label, ok: true })
          return true
        } catch (error) {
          record({ leg: 'register', kind, agent: label, ok: false, error: String(error?.message ?? error) })
          return false
        }
      }

      // (1) the EARLY probe: registered here, possibly mid-assembly.
      register('a5p1_early_probe', 'early')
      dispose(observeResults(agent.ctx, label))

      // (2) the LATE probe: registered on the agent's first pre-execute
      // event, i.e. strictly after the Agent started dispatching calls.
      let lateDone = false
      dispose(
        agent.ctx.on('tools/pre-execute', (exec, next) => {
          if (!lateDone) {
            lateDone = true
            record({ leg: 'late-register-trigger', agent: label, firstCall: String(exec?.name ?? '') })
            register('a5p1_dyn_probe', 'dyn')
          }
          return next()
        }),
      )
    }),
  )

  ctx.effect?.(() => {
    for (const off of disposers.splice(0)) {
      try {
        off()
      } catch {
        /* scope unwind covers it */
      }
    }
  }, 'a5p1-probe')
}
