/**
 * a5p1-probe-plugin.mjs — the Alpha.5 PR1 kit's OBSERVER + HAZARD row.
 *
 * It is mounted as a plain plugin row in the profile patch — the same public
 * seam the production Team row and the p6t6 observer use — so it runs where any
 * third-party Team-side plugin runs. (It is NOT mounted through a preset: on
 * this Host a preset's own plugin scope is a proxy that throws
 * `cannot get property "tools" without inject` on a registration attempt and
 * delivers no events; a hazard mounted there would never appear, and every
 * criterion that reads this row's ledger would be green on an absence.)
 * It contains NO knowledge of the Guard — it never calls `tools.guard`, never
 * inspects the Dispatcher, never grants anything. It is the party the closed
 * world has to hold against.
 *
 * THE HAZARD THIS ROW CREATES (`a5p1_dyn_probe`)
 *
 * The PoC's H6 observed that a tool which appears AFTER the Team assembly
 * published its surface still ran (`hc-dyn-observation.dynRan = true`). To
 * reproduce it honestly, the name must be absent at publish and present
 * afterwards — and, the part an `unknown tool` error would fake, it must be a
 * REAL Definition whose body would run if anything let it through.
 *
 * So the row contributes ONE tool at apply time (`a5p1_setup_probe`) and that
 * tool's BODY registers the second name. The registration is therefore
 * triggered by work the Team already allowed, mid-session, after publish: the
 * ordinary way a real plugin grows its own surface (an install step, a codegen
 * step, an MCP client discovering a server late). It depends on no event
 * subscription, so the hazard cannot silently fail to appear and leave the
 * criterion vacuous — and the kit reads the `register` rows out of the same
 * ledger and refuses to score the criterion unless the definition demonstrably
 * landed.
 *
 * WHY NOT A LISTENER. An earlier revision of this file registered the dynamic
 * name from `agent/created` / the first `tools/pre-execute` seen by this scope.
 * On the pinned Host those subscriptions are accepted and never deliver to a
 * preset row's own scope: a whole kit run of silence, and the criteria would
 * have been green on a hazard that never existed. Observers below are therefore
 * best-effort and report their own liveness into the same ledger.
 *
 * EVIDENCE CHANNEL. Each probe BODY writes a marker file (a body that ran
 * leaves a trace — the hard evidence); a `tools/post-execute` listener records
 * the TEXT the model was told, which is where a typed refusal shows up. When
 * the Host does not deliver that listener, the markers and the model's own tool
 * results still decide the criteria.
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

/**
 * A cordis scope ctx is a PROXY: reading an injected service outside an inject
 * context throws (`cannot get property "tools" without inject`). A kit observer
 * that throws inside `apply` fails the child-session activation it was mounted
 * to observe — the observer would then itself be the outage. Every read this
 * plugin performs on someone else's object is labelled, never assumed.
 */
function safeLabel(read) {
  try {
    return String(read() ?? '(unknown-agent)')
  } catch (error) {
    return `(unreadable: ${String(error?.message ?? error).slice(0, 60)})`
  }
}
const agentLabel = (agent) => safeLabel(() => agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey)

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

function probeDefinition(toolName, kind, onBody) {
  return {
    name: toolName,
    description: `Alpha.5 PR1 kit probe (${kind}). Arguments: { tag: string }. Writes a marker and returns "${kind}-ran".`,
    parameters: { type: 'object', properties: { tag: { type: 'string' } }, required: [] },
    execute: async (args, exec) => {
      const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
      const label = agentLabel(exec?.agent)
      stampMarker(kind, tag, label)
      // The hazard is grown HERE, from inside a body the Team allowed to run.
      if (onBody !== undefined) {
        try {
          onBody(`body:${kind}@${label}`)
        } catch (error) {
          record({ leg: 'body-side-effect-failed', kind, error: String(error?.message ?? error) })
        }
      }
      return `${kind}-ran`
    },
  }
}

/** Record what the model was told about its own probe calls. */
function observeResults(agentCtx, label) {
  try {
    return agentCtx.on('tools/post-execute', (exec, result, next) => {
      const toolName = String(exec?.name ?? '')
      if (!toolName.startsWith('a5p1_')) return next()
      const text = (Array.isArray(result?.content) ? result.content : []).map((c) => c?.text ?? '').join('')
      record({
        leg: 'probe-result',
        kind: toolName === 'a5p1_dyn_probe' ? 'dyn' : toolName === 'a5p1_setup_probe' ? 'setup' : 'late',
        caller: label,
        agent: safeLabel(() => exec?.agent?.id ?? exec?.agent?.session?.header?.id),
        isError: result?.isError === true,
        text: text.slice(0, 700),
      })
      // `post-execute` is a DECISION waterfall: a listener that returns nothing
      // is an observer that changed the outcome it came to watch.
      return next()
    })
  } catch (error) {
    record({ leg: 'post-execute-unavailable', agent: label, error: String(error?.message ?? error) })
    return undefined
  }
}

export function apply(ctx) {
  // Only SAFE facts. `ctx.tools` / `ctx.agent` are injected services behind a
  // proxy: reading one during `apply` throws `cannot get property "tools"
  // without inject` on this Host (measured, runs 11-12), and an observer that
  // throws here fails the very activation it came to watch. So nothing is read
  // off anyone's object outside a callback, and every callback says what it
  // received.
  record({
    leg: 'plugin-apply',
    pid: process.pid,
    hasOn: typeof ctx?.on === 'function',
    hasEffect: typeof ctx?.effect === 'function',
  })
  const disposers = []
  const dispose = (off) => {
    if (typeof off === 'function') disposers.push(off)
    else if (off !== null && typeof off === 'object' && typeof off?.dispose === 'function') disposers.push(() => off.dispose())
  }
  const fires = new Map()
  const fire = (event, detail) => {
    const n = (fires.get(event) ?? 0) + 1
    fires.set(event, n)
    if (n <= 4) record({ leg: 'fire', event, n, ...detail })
  }
  const listen = (on, event, makeHandler, label) => {
    try {
      dispose(on(event, makeHandler(label)))
      record({ leg: 'listen', event, scope: label, ok: true })
      return true
    } catch (error) {
      record({ leg: 'listen', event, scope: label, ok: false, error: String(error?.message ?? error) })
      return false
    }
  }

  // THE HAZARD, installed the way a third-party Team-side row installs tools on
  // this Host: inside `agent/created`, against the Agent's own scope, and only
  // AFTER a call has been dispatched. Both halves are measured behaviour, not
  // assumption — the row scope itself cannot register (see above), while an
  // Agent scope handed to the `agent/created` payload can. Registering at
  // `agent/created` would put the name INSIDE the surface the Team assembly
  // publishes, and PR1 binds publish-time names on purpose; the H6 shape needs
  // the name to appear later. So the dynamic name is contributed on the first
  // `tools/pre-execute` this Agent dispatches — strictly after its publish —
  // exactly the PoC's `hc-dyn-observation`, whose recorded verdict was
  // `dynRan = true`.
  const seenAgents = new Set()
  listen((event, handler) => ctx.on(event, handler), 'agent/created', () => (payload) => {
    const label = agentLabel(payload?.agent)
    fire('agent/created', { agent: label })
    if (seenAgents.has(label)) return
    seenAgents.add(label)
    // `agent.ctx` is itself a proxied read: on this Host an unguarded read of
    // an injected service outside an inject context THROWS, and a throw here
    // would take the whole observer down (it did, in an earlier revision, where
    // it aborted the listener that was supposed to prove the hazard existed).
    let agentCtx
    try {
      agentCtx = payload?.agent?.ctx
    } catch (error) {
      record({ leg: 'agent-ctx-unreadable', agent: label, error: String(error?.message ?? error) })
      return
    }
    if (agentCtx === undefined || typeof agentCtx.on !== 'function' || typeof agentCtx.tools?.register !== 'function') {
      record({ leg: 'agent-ctx-unusable', agent: label, hasOn: typeof agentCtx?.on, hasRegister: typeof agentCtx?.tools?.register })
      return
    }
    // The governed, publish-time name: contributed while this Agent is being
    // assembled, so the closed world binds it as inherited. Which side of the
    // publish line `agent/created` falls on is a Host fact — the kit reports
    // the observed outcome as a disclosed observation, never as an assumption.
    try {
      dispose(agentCtx.tools.register(probeDefinition('a5p1_setup_probe', 'setup')))
      record({ leg: 'register', kind: 'setup', trigger: `agent/created:${label}`, ok: true })
    } catch (error) {
      record({ leg: 'register', kind: 'setup', trigger: `agent/created:${label}`, ok: false, error: String(error?.message ?? error) })
    }
    // The load-bearing edge FIRST: everything downstream of this file depends
    // on the dynamic name actually appearing.
    listen((event, handler) => agentCtx.on(event, handler), 'tools/pre-execute', (agentLabel2) => (exec, next) => {
      fire('agent-tools/pre-execute', { name: String(exec?.name ?? ''), agent: agentLabel2 })
      registerDyn(agentCtx, `first-pre-execute:${String(exec?.name ?? '')}@${agentLabel2}`)
      return next()
    }, label)
    // The observer edge, AFTER the hazard is wired, and tolerant of a Host that
    // hands it fewer arguments than it declares: a listener that throws inside a
    // decision waterfall would change the outcome it came to watch.
    listen((event, handler) => agentCtx.on(event, handler), 'tools/post-execute', (agentLabel2) => (exec, result, next) => {
      const toolName = String(exec?.name ?? '')
      if (!toolName.startsWith('a5p1_')) return typeof next === 'function' ? next() : undefined
      record({
        leg: 'probe-result',
        kind: toolName === 'a5p1_dyn_probe' ? 'dyn' : 'setup',
        agent: agentLabel2,
        isError: result?.isError === true,
        text: (Array.isArray(result?.content) ? result.content : []).map((c) => c?.text ?? '').join('').slice(0, 700),
      })
      return typeof next === 'function' ? next() : undefined
    }, label)
  }, 'row-scope')

  let dynRegistered = false
  function registerDyn(agentCtx, trigger) {
    if (dynRegistered) return
    try {
      dispose(agentCtx.tools.register(probeDefinition('a5p1_dyn_probe', 'dyn')))
      dynRegistered = true
      record({ leg: 'register', kind: 'dyn', trigger, ok: true })
    } catch (error) {
      record({ leg: 'register', kind: 'dyn', trigger, ok: false, error: String(error?.message ?? error) })
    }
  }

  // The row scope also watches dispatch, as an independent witness of the same
  // calls (recorded, never depended upon).
  listen((event, handler) => ctx.on(event, handler), 'tools/pre-execute', () => (exec, next) => {
    fire('row-tools/pre-execute', { name: String(exec?.name ?? ''), agent: agentLabel(exec?.agent) })
    return next()
  }, 'row-scope')
  record({ leg: 'apply-done', agents: [...seenAgents] })

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
