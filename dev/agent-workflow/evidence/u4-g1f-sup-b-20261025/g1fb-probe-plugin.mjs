/**
 * g1fb-probe-plugin.mjs — the center plugin for the G1-F supplement PoC set
 * (executor G1F-SUP-B). ONE plugin row through the public profile-patch seam
 * provides: the GOVERNED CENTER (approved table + registry + one ledger +
 * jobs bridge mount), the GUARD (outermost tools/execute listener), the
 * DYNAMIC-SOURCE monitor (mcp__* late binding, admission, drift), and the
 * management-plane tool `g1fb_ctl` (fixture knob, not governed).
 *
 * GUARD FORM: the sealed H0 form — identity check against the CENTER-OWNED
 * approved table at the outermost (`prepend`) `tools/execute` listener;
 * mismatch/not-visible → refusal WITHOUT `next()` (built-in dispatch and its
 * late resolve never run); approved → SELF-DISPATCH of the verified function
 * object (`observed.execute(...)`, listener returns `{ value }`). Executor A
 * is concurrently hardening the next()-calling Host-equivalent form; per the
 * brief, EITHER form is admissible — THIS package runs the H0-verified
 * self-dispatch form and states so (README §guard-form).
 *
 * Scope discipline (CI-03): governance applies ONLY to ENROLLED agents (the
 * PoC's Team-analog sessions, enrolled via ctl). Every non-enrolled session
 * passes straight to `next()` — native behavior, no shadow mounted.
 *
 * No guard-off shortcut exists here; sensitivity plants are per-mechanism
 * switches (pathGuard/ledger/identityLaw/dynamicAdmission), each proving one
 * cell's forbidden effect actually occurs when THAT check is removed.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-probe-plugin
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { record, refusal, marker, sha256File } from './g1fb-lib.mjs'
import { createCenterLedger } from './g1fb-ledger.mjs'
import { createGovernedFamilyRegistry } from './g1fb-registry.mjs'
import { createPocJobsMount } from './g1fb-jobs-bridge.mjs'
import { WRITE_FAMILY } from './g1fb-family-write.mjs'
import { EDIT_FAMILY } from './g1fb-family-edit.mjs'
import { READ_FAMILY } from './g1fb-family-read.mjs'
import { GREP_FAMILY } from './g1fb-family-grep.mjs'
import { BASH_FAMILY } from './g1fb-family-bash.mjs'
import { JOBS_FAMILIES } from './g1fb-family-jobs.mjs'

const CTL = 'g1fb_ctl'
const MASTER = process.env['G1F_MASTER_REPO'] ?? ''
const MCP_PREFIX = 'mcp__'

/* ── CENTER ───────────────────────────────────────────────────────────────── */
const center = {
  centerId: 'g1fb-center-1',
  approved: new Map(), // name -> { def, familyId, generation }  (approved-identity table, H0 condition 1)
  flags: {
    guardEnabled: true,
    pathGuardEnabled: true,     // PLANT 1 (PoC-1 path lane)
    ledgerEnabled: true,        // PLANT 2 (PoC-2 shared lifecycle)
    identityLawEnabled: true,   // PLANT 3 (PoC-3 mount identity law / CI-08)
    dynamicAdmissionEnabled: true, // PLANT 4 (PoC-4b dynamic admission)
  },
}

const ledger = createCenterLedger({ centerId: center.centerId, flags: center.flags })

/** Master mount law, UNMODIFIED (zero-import plain-JS module on master). */
async function loadMountRegistry() {
  if (MASTER !== '') {
    const p = join(MASTER, 'packages', 'runtime', 'src', 'plugin', 'live', 'pa-mount-registry.mjs')
    if (existsSync(p)) {
      const mod = await import(pathToFileURL(p).href)
      record({ leg: 'master-reuse', module: 'pa-mount-registry.mjs', phase: 'imported-unmodified', path: p, sha256: sha256File(p) })
      return { publishPaMount: mod.publishPaMount, revokePaMount: mod.revokePaMount, resolvePaMount: mod.resolvePaMount }
    }
    record({ leg: 'master-reuse', module: 'pa-mount-registry.mjs', phase: 'FAILED-missing', path: p })
    throw new Error('G1F: master pa-mount-registry.mjs missing — center refuses to start (no silent fallback)')
  }
  record({ leg: 'master-reuse', module: 'pa-mount-registry.mjs', phase: 'FAILED-env', detail: 'G1F_MASTER_REPO unset' })
  throw new Error('G1F: G1F_MASTER_REPO unset — center refuses to start (no silent fallback)')
}
const mountRegistry = await loadMountRegistry()

const state = {
  guardArmed: new Map(),          // callId -> { def, ac, agent }
  enrolled: new Map(),            // agentId -> { label, tools }
  mountDisposers: new Map(),      // name -> CURRENT generation disposer
  staleDisposers: new Map(),      // name -> previous generation disposer (dispose-old cell)
  lastAgent: undefined,
  dynamic: {                      // PoC-4b center-owned admission view
    seen: new Map(),              // full mcp__ name -> first-observed identity
    admitted: new Map(),          // full name -> { identity, admittedAt }
    lateAfterSession: [],         // names discovered after the session existed
  },
  sessionCreatedAt: 0,            // set by ctl 'session-created' (runner stamps it)
  jobsMount: undefined,
}

const deps = {
  flags: center.flags,
  jobs: () => apiCtx?.jobs ?? apiCtx?.get?.('jobs'),
  get bridge() { return state.jobsMount },
}

let apiCtx = undefined

/** Public service access on the agent's scoped ctx (H0 postmortem pattern). */
function scopedTools(agentCtx) {
  if (agentCtx === undefined || agentCtx === null) return undefined
  if (agentCtx.tools !== undefined && agentCtx.tools !== null) return agentCtx.tools
  try { return agentCtx.get?.('tools') } catch { return undefined }
}

function isEnrolled(exec) {
  const id = exec?.agent?.id
  return id !== undefined && state.enrolled.has(String(id))
}

const FAMILY_DECLARATIONS = [WRITE_FAMILY, EDIT_FAMILY, READ_FAMILY, GREP_FAMILY, BASH_FAMILY, ...JOBS_FAMILIES]

/** DUPE declaration used ONLY by the collision cell (family-owned shape). */
const DUPE_WRITE = {
  familyId: 'P1-DUPE-WRITE2',
  version: 1,
  name: 'write',
  description: 'colliding claim on the governed write name (must be refused)',
  parameters: { type: 'object', properties: { tag: { type: 'string' } }, required: [] },
  outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  policy: () => ({ lane: 'allow' }),
  execute: async () => ({ ok: true }),
}

function enrollAgent(agentId, label, tools) {
  if (state.enrolled.has(agentId)) return { ok: true, detail: 'already-enrolled' }
  state.enrolled.set(agentId, { label, tools })
  const results = []
  for (const decl of FAMILY_DECLARATIONS) {
    if (center.approved.has(decl.name)) {
      results.push({ name: decl.name, ok: true, detail: 'mount-shared' }) // families mount once, globally, on first enroll
      continue
    }
    const r = registry.register(decl, tools, deps)
    if (r.ok === true) state.mountDisposers.set(decl.name, r.dispose)
    results.push({ name: decl.name, ok: r.ok === true, detail: r.ok === true ? `gen${String(r.generation)}` : r.refusal })
  }
  record({ leg: 'enroll', agentId, label, results })
  return { ok: true, detail: JSON.stringify(results) }
}

let registry = undefined // needs ledger+center+mountRegistry; wired in apply()

/* ── APPLY ────────────────────────────────────────────────────────────────── */
export const name = 'g1fb-probe'
// 'jobs' MUST be injected: cordis refuses ctx.get('jobs') without inject
// (suite-A E2 evidence: "cannot get property \"jobs\" without inject").
export const inject = ['tools', 'jobs']

export function apply(ctx) {
  apiCtx = ctx
  registry = createGovernedFamilyRegistry({ center, ledger, mountRegistry })
  state.jobsMount = createPocJobsMount({ ctx, center })

  // ── GUARD: outermost tools/execute listener (H0 identity-check form) ─────
  ctx.on('tools/execute', async (exec, next) => {
    const nameOf = String(exec?.name ?? '')
    const governedFamily = center.approved.has(nameOf)
    const governedDynamic = nameOf.startsWith(MCP_PREFIX)
    if ((!governedFamily && !governedDynamic) || !isEnrolled(exec)) return next()
    const callId = String(exec?.rootCallId ?? 'unknown')
    const tag = String(exec?.arguments?.tag ?? '')
    if (!center.flags.guardEnabled) {
      record({ leg: 'guard', phase: 'disabled-passthrough', name: nameOf, callId, tag })
      return next()
    }
    let observed
    try { observed = ctx.tools.get(nameOf, exec.agent) }
    catch (error) {
      record({ leg: 'guard', phase: 'veto', reason: `get-threw:${String(error?.message ?? error)}`, name: nameOf, callId, tag })
      return refusal('G1F_GUARD_VETO', 'observation failed')
    }
    if (governedFamily) {
      const approved = center.approved.get(nameOf)
      if (observed === undefined || approved === undefined || observed !== approved.def) {
        record({ leg: 'guard', phase: 'veto', reason: observed === undefined ? 'not-visible' : 'identity-mismatch', name: nameOf, callId, tag })
        return refusal('G1F_GUARD_VETO', 'observed Definition is not the approved binding')
      }
      record({ leg: 'guard', phase: 'approve', name: nameOf, callId, tag })
      const returned = await observed.execute(exec.arguments, exec)
      record({ leg: 'guard', phase: 'settled', name: nameOf, callId, tag })
      return { value: returned }
    }
    // dynamic class (mcp__): admission BEFORE any body, keyed by the FULL
    // public name (server-qualified) — CI-11 collision/drift discipline.
    // NOT-YET-REGISTERED is its own honest row (no phantom discovery): the
    // server simply had not bound the name yet; refusal is unchanged.
    if (observed === undefined) {
      record({ leg: 'refused-before-body', decision: 'refused', reason: 'unknown-dynamic-source-not-yet-bound', name: nameOf, callId, tag })
      return refusal('G1F_UNKNOWN_DYNAMIC_SOURCE', `${nameOf} is not bound by any server yet — nothing to admit, nothing to run`)
    }
    if (!state.dynamic.seen.has(nameOf)) {
      state.dynamic.seen.set(nameOf, observed)
      record({ leg: 'mcp-watch', phase: 'discovered', name: nameOf, afterSessionCreated: state.sessionCreatedAt > 0 && Date.now() > state.sessionCreatedAt, via: 'first-call' })
    }
    const admitted = state.dynamic.admitted.get(nameOf)
    if (admitted === undefined) {
      if (center.flags.dynamicAdmissionEnabled === false) {
        record({ leg: 'mcp-guard', phase: 'PLANT-admission-disabled', name: nameOf, callId, tag })
        return next()
      }
      record({ leg: 'refused-before-body', decision: 'refused', reason: 'unknown-dynamic-source', name: nameOf, callId, tag })
      return refusal('G1F_UNKNOWN_DYNAMIC_SOURCE', `${nameOf} is UNKNOWN until a DynamicSourceAdmissionRecord admits it (no auto-authorize)`)
    }
    if (observed !== admitted.identity) {
      record({ leg: 'refused-before-body', decision: 'refused', reason: 'identity-drift', name: nameOf, callId, tag })
      return refusal('G1F_DYNAMIC_DRIFT', `${nameOf} binding moved since admission — re-admission required`)
    }
    const admit = ledger.admit(nameOf, exec.arguments, { callId })
    if (admit.decision !== 'execute') {
      record({ leg: 'refused-before-body', name: nameOf, decision: admit.decision, callId, tag })
      return refusal(`G1F_${String(admit.decision).toUpperCase()}`, `pre-body admission ${String(admit.decision)}`)
    }
    record({ leg: 'mcp-guard', phase: 'approve', name: nameOf, callId, tag })
    const returned = await observed.execute(exec.arguments, exec)
    record({ leg: 'mcp-guard', phase: 'settled', name: nameOf, callId, tag })
    return { value: returned }
  }, true)

  // ── DYNAMIC-SOURCE monitor: discover mcp__* bindings on tools/change ────
  ctx.on('tools/change', () => {
    try {
      for (const schema of ctx.tools.schemas()) {
        const n = String(schema?.name ?? '')
        if (n.startsWith(MCP_PREFIX) && !state.dynamic.seen.has(n)) {
          let def
          try { def = ctx.tools.get(n) } catch { def = undefined }
          state.dynamic.seen.set(n, def)
          record({ leg: 'mcp-watch', phase: 'discovered', name: n, afterSessionCreated: state.sessionCreatedAt > 0 && Date.now() > state.sessionCreatedAt })
        }
      }
    } catch (error) {
      record({ leg: 'mcp-watch-threw', error: String(error?.message ?? error) })
    }
  }, true)

  // ── CTL (management plane; not governed) ─────────────────────────────────
  ctx.effect(() => ctx.tools.register({
    name: CTL,
    description: 'G1F PoC management. Actions: status | enroll | dupe-attempt | approve | revoke | grants | admit-mcp | forget-mcp | plant | regen | dispose-old | session-created | bridge-dump | svc-calls | heal | settle.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        label: { type: 'string' },
        name: { type: 'string' },
        by: { type: 'string' },
        requestId: { type: 'string' },
        flag: { type: 'string' },
        on: { type: 'boolean' },
        tag: { type: 'string' },
        jobId: { type: 'string' },
        asViewer: { type: 'string' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: { ok: { type: 'boolean' }, action: { type: 'string' }, detail: { type: 'string' } },
        required: ['ok', 'action', 'detail'],
      },
      render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => {
      const action = String(args?.action ?? '')
      let ok = true
      let detail = ''
      if (exec?.agent !== undefined) state.lastAgent = exec.agent
      const agentCtx = state.lastAgent?.ctx
      const agentId = String(state.lastAgent?.id ?? 'unknown')
      try {
        if (action === 'status') {
          detail = JSON.stringify({
            enrolled: [...state.enrolled.keys()].map((k) => `${k}:${state.enrolled.get(k).label}`),
            approved: [...center.approved.keys()],
            flags: center.flags,
            mounts: registry.mounts(),
            dynamic: { seen: [...state.dynamic.seen.keys()], admitted: [...state.dynamic.admitted.keys()] },
          })
        } else if (action === 'enroll') {
          const t = scopedTools(agentCtx)
          if (t?.register === undefined) throw new Error('agent scoped tools unavailable')
          const r = enrollAgent(agentId, String(args?.label ?? 'S'), t)
          detail = r.detail
        } else if (action === 'dupe-attempt') {
          const t = scopedTools(agentCtx) ?? (apiCtx.tools)
          const r = registry.register({ ...DUPE_WRITE, familyId: String(args?.by ?? DUPE_WRITE.familyId) }, t, deps)
          detail = r.ok === true ? 'COLLISION-NOT-REFUSED (oracle violation!)' : `refused:${r.refusal}`
          ok = r.ok !== true
        } else if (action === 'approve') {
          const byName = String(args?.name ?? '')
          const d = ledger.dump().find((g) => g.state === 'pending' && (byName === '' || g.name === byName) && (String(args?.requestId ?? '') === '' || g.requestId === args.requestId))
          const r = ledger.approve(d?.requestId ?? String(args?.requestId ?? ''))
          detail = r.detail; ok = r.ok
        } else if (action === 'revoke') {
          const byName = String(args?.name ?? '')
          const d = ledger.dump().find((g) => ['pending', 'issued'].includes(g.state) && (byName === '' || g.name === byName))
          const r = ledger.revoke(d?.requestId ?? String(args?.requestId ?? ''))
          detail = r.detail; ok = r.ok
        } else if (action === 'grants') detail = JSON.stringify(ledger.dump())
        else if (action === 'admit-mcp') {
          const n = String(args?.name ?? '')
          let def
          try { def = ctx.tools.get(n) } catch { def = undefined }
          if (def === undefined) throw new Error(`not visible: ${n}`)
          state.dynamic.admitted.set(n, { identity: def, admittedAt: new Date().toISOString() })
          ledger.registerPolicy(n, 'DYNAMIC-MCP', () => ({ lane: 'allow' }))
          record({ leg: 'mcp-admit', phase: 'admitted', name: n, identitySeenAtDiscover: state.dynamic.seen.get(n) === def })
          detail = `admitted:${n}`
        } else if (action === 'forget-mcp') {
          state.dynamic.admitted.delete(String(args?.name ?? ''))
          detail = `forgotten:${String(args?.name ?? '')}`
        } else if (action === 'plant') {
          const flag = String(args?.flag ?? '')
          if (!(flag in center.flags)) throw new Error(`unknown flag ${flag}`)
          center.flags[flag] = args?.on === true
          record({ leg: 'plant', phase: 'set', flag, on: args?.on === true })
          detail = `${flag}=${String(center.flags[flag])}`
        } else if (action === 'regen') {
          // Generation change for one family mount: the SAME family
          // re-registers through the SAME generic function (collision law
          // admits the owner only). The previous generation's disposer is
          // parked for the dispose-old cell; its host layer stays in place
          // (same-scope insert replaced it) exactly like a Host-side regen.
          const n = String(args?.name ?? '')
          const held = center.approved.get(n)
          if (held === undefined) throw new Error(`no approved mount ${n}`)
          const decl = FAMILY_DECLARATIONS.find((d) => d.name === n)
          if (decl === undefined) throw new Error(`no declaration for ${n}`)
          const t = scopedTools(agentCtx) ?? apiCtx.tools
          const prev = state.mountDisposers.get(n)
          const retired = prev === undefined ? { detail: 'no-previous' } : prev() // clean retire of gen N (law path)
          const fresh = { ...decl } // fresh object identity for the SAME declaration
          const r = registry.register(fresh, t, deps)
          record({ leg: 'regen', phase: 'retired-previous', name: n, result: String(retired?.detail ?? '') })
          if (r.ok === true) {
            if (prev !== undefined) state.staleDisposers.set(n, prev)
            state.mountDisposers.set(n, r.dispose)
          }
          detail = r.ok === true ? `regen-ok:gen${String(r.generation)}` : `regen-refused:${r.refusal}`
          ok = r.ok === true
        } else if (action === 'dispose-old') {
          // The OLD disposer (captured generation N) called AFTER generation
          // N+1 is mounted — CI-08 cell. With the identity law: refused, new
          // mount KEPT. With the plant (identityLawEnabled=false): the naive
          // shape tears down the NEW mount (forbidden effect — the plant).
          const n = String(args?.name ?? '')
          const old = state.staleDisposers.get(n)
          if (old === undefined) throw new Error(`no stale disposer for ${n}`)
          const r = old()
          detail = `old-disposer:${r.detail}`
        } else if (action === 'bridge-fence') {
          // Exercise the BRIDGE's owner fence from a SYNTHETIC viewer (a
          // foreign member scope): the gateway must refuse and the host
          // layer must NEVER be reached (svc-calls proves non-reach).
          const jobId = String(args?.jobId ?? '')
          const viewer = String(args?.asViewer ?? 'synthetic-viewer')
          const bridge = state.jobsMount.bridgeFor(viewer)
          const ans = await bridge.jobKill({ job_id: jobId, tag: String(args?.tag ?? '') }, viewer)
          const text = String(ans?.text ?? ans?.code ?? JSON.stringify(ans ?? null))
          record({ leg: 'bridge', phase: text.includes('foreign-attribution') ? 'fence-refused' : 'fence-answer', jobId, viewer, answer: text.slice(0, 140) })
          detail = text.slice(0, 140)
        } else if (action === 'session-created') {
          state.sessionCreatedAt = Date.now()
          detail = `stamped:${String(state.sessionCreatedAt)}`
        } else if (action === 'bridge-dump') detail = JSON.stringify(state.jobsMount.attributionDump())
        else if (action === 'svc-calls') detail = JSON.stringify(state.jobsMount.svcCalls())
        else if (action === 'heal') {
          center.flags.guardEnabled = true
          center.flags.pathGuardEnabled = true
          center.flags.ledgerEnabled = true
          center.flags.identityLawEnabled = true
          center.flags.dynamicAdmissionEnabled = true
          detail = 'flags-restored'
        } else if (action === 'settle') {
          marker(`settle-${String(args?.tag ?? 'x')}.done`, 'ok')
          detail = `settle:${String(args?.tag ?? '')}`
        } else { ok = false; detail = `unknown action ${action}` }
      } catch (error) {
        ok = false
        detail = String(error?.message ?? error)
      }
      record({ leg: 'ctl', action, ok, detail, tag: String(args?.tag ?? ''), agentId })
      return { ok, action, detail }
    },
  }))

  record({ leg: 'center-ready', centerId: center.centerId, ledger: ledger.instanceId, families: FAMILY_DECLARATIONS.map((f) => f.name) })
}
