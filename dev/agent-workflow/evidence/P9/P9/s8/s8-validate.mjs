#!/usr/bin/env node
/**
 * S8 boot kit — bundle validator. Loads the adapter output exactly the way
 * the production shell will (window.__ModuleLoader__.load handoff →
 * factory(require) over module-table namespaces), then drives the frozen
 * plugin surface:
 *
 *   1. syntax + handoff capture (fake window/document, the facade file as
 *      the sole script);
 *   2. factory over REAL externals resolved from the P9 worktree
 *      node_modules (react, react/jsx-runtime, @deepseek-ai/
 *      dsh-client-store, @deepseek-ai/dsh-client-ui-primitives — the
 *      baseline set the bundle externalizes);
 *   3. the frozen plugin contract (name / inject / apply — D-T9-12);
 *   4. an apply() drive over a minimal structural ctx double (the same
 *      class of double as the T9 mount test): locale register + bind,
 *      the frozen Seam-5 carrier (connection.rpc = an OBJECT with
 *      call(channel, method, envelope) — the remote client calls
 *      carrier.call directly; the probe response is left pending),
 *      connection.generation subscribe, sessions open/create,
 *      remote.agentPresets, slots.inject→register capture for the three
 *      P9-S6 registrations, and the REAL on-demand cold read driven
 *      through the captured conversation.view spec.inject(sessionId).
 *      ensureProjection (mount itself issues no carrier call — plan §6.1
 *      mirror-wins; the single-flight pull must land exactly one
 *      /team-remote team.getProjection envelope, version 1).
 *
 * Usage: node s8-validate.mjs <client-pkg-dir> <out-dir>
 */
import { readFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [,, pkgDir, outDir] = process.argv
if (!pkgDir || !outDir) {
  console.error('usage: node s8-validate.mjs <client-pkg-dir> <out-dir>')
  process.exit(2)
}
const PKG = pkgDir
const OUT = outDir

function fail(msg) {
  console.error(`s8-validate: FAIL — ${msg}`)
  process.exit(1)
}

// ── 1. handoff capture ──────────────────────────────────────────────────
const bundleText = readFileSync(join(OUT, 'client-bundle.js'), 'utf8')
let handoff = null
const styleEls = []
const windowStub = {
  __ModuleLoader__: {
    load(h) {
      if (handoff !== null) fail('__ModuleLoader__.load called twice')
      handoff = h
    },
  },
}
const documentStub = {
  createElement(tag) {
    const el = { tag, attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v } }
    styleEls.push(el)
    return el
  },
  head: { appendChild(el) { el.appended = true } },
  documentElement: { appendChild(el) { el.appended = true } },
}
try {
  new Function('window', 'document', bundleText)(windowStub, documentStub)
} catch (e) {
  fail(`facade evaluation threw: ${e.message}`)
}
if (handoff === null) fail('no __ModuleLoader__.load handoff captured')
if (handoff.id !== '@dsh-agent-team/client') fail(`handoff id ${handoff.id} !== @dsh-agent-team/client`)
if (typeof handoff.factory !== 'function') fail('handoff.factory is not a function')
console.log(`ok: handoff id=${handoff.id}`)

// ── 2. factory over real externals ─────────────────────────────────────
const creq = createRequire(join(PKG, 'package.json'))
// The real ui-primitives ESM imports .module.css; Node has no css format,
// so register the identity class-map hook before any ESM import happens.
register(new URL('./s8-css-hook.mjs', import.meta.url))
const ext = {
  react: creq('react'),
  'react/jsx-runtime': creq('react/jsx-runtime'),
}
for (const spec of ['@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives']) {
  const resolved = creq.resolve(spec)
  const ns = await import(pathToFileURL(resolved))
  ext[spec] = ns
}
const plugin = handoff.factory((spec) => {
  if (!(spec in ext)) fail(`factory required non-external specifier '${spec}'`)
  return ext[spec]
})
console.log(`ok: factory returned module with keys [${Object.keys(plugin).join(', ')}]`)

// ── 3. frozen plugin contract (D-T9-12) ────────────────────────────────
if (plugin.name !== 'dsh-agent-team-client') fail(`plugin.name ${JSON.stringify(plugin.name)}`)
if (JSON.stringify(plugin.inject) !== JSON.stringify(['slots', 'locale', 'sessions', 'connection', 'remote', 'remote.agentPresets'])) {
  fail(`plugin.inject ${JSON.stringify(plugin.inject)}`)
}
if (typeof plugin.apply !== 'function') fail('plugin.apply is not a function')
console.log('ok: frozen plugin contract (name/inject/apply)')

// ── 4. apply() drive over a minimal structural ctx double ──────────────
const localeRegs = []
const registrations = []
const injected = []
const effects = []
const rpcCalls = []
const opened = []
const created = []
const genSubs = []
let presetListCalls = 0
const ctx = {
  effect(fn, label) {
    const rec = { label, error: null }
    effects.push(rec)
    try {
      fn()
    } catch (e) {
      rec.error = e
    }
  },
  locale: {
    register(ns, dicts) {
      localeRegs.push({ ns, dicts })
      return () => {}
    },
    bind(ns) {
      return (key) => `${ns}:${key}`
    },
  },
  connection: {
    // The frozen carrier shape (Seam 5 / ClientConnectionRpc of the served
    // web app): an OBJECT with call(channel, method, envelope) — not a
    // plain function. The team remote client calls carrier.call directly.
    rpc: {
      call(channel, method, envelope) {
        rpcCalls.push({ channel, method, envelope })
        return new Promise(() => {}) // pending: wiring proof, no envelope required
      },
    },
    generation: {
      subscribe(fn) {
        genSubs.push(fn)
        return () => {}
      },
      getSnapshot: () => ({ id: 1 }),
    },
  },
  sessions: {
    open(id) {
      opened.push(id)
    },
    create(opts) {
      created.push(opts)
      return { then: (r) => r('session-stub') }
    },
  },
  remote: {
    agentPresets: {
      list: async () => {
        presetListCalls++
        // The upstream public contract answers the RemoteResult envelope
        // (roster in `value`); the double mirrors that shape.
        return { ok: true, value: { presets: [], authorable: false } }
      },
    },
  },
  slots: {
    register(spec, Component) {
      registrations.push({ spec, Component })
      return () => {}
    },
    inject(name, cb) {
      injected.push(name)
      const dispose = cb()
      return () => dispose?.()
    },
  },
}
plugin.apply(ctx)

if (effects.some((e) => e.error !== null)) {
  const bad = effects.find((e) => e.error !== null)
  fail(`effect '${bad.label}' threw: ${bad.error?.message ?? bad.error}\n${bad.error?.stack ?? ''}`)
}
const regNames = registrations.map((r) => r.spec.name)
for (const want of ['conversation.view', 'conversation.input.dock', 'settings.section']) {
  if (!regNames.includes(want)) fail(`missing slot registration ${want} (got ${JSON.stringify(regNames)})`)
}
if (injected.length !== 3) fail(`slots.inject count ${injected.length} !== 3`)
if (localeRegs.length !== 1 || localeRegs[0].ns !== 'team') fail(`locale register: ${JSON.stringify(localeRegs)}`)
if (genSubs.length !== 1) fail(`generation subscribers ${genSubs.length} !== 1`)
// The mount issues NO carrier call at apply time (plan §6.1: the mirror
// wins; the single-flight cold read is on-demand, component-driven).
if (rpcCalls.length !== 0) fail(`mount must not issue carrier calls (got ${rpcCalls.length})`)
// Drive the REAL cold-read path through the captured conversation.view
// spec.inject(sessionId) → ensureProjection (single-flight pull via the
// frozen Remote client on the recorded carrier).
const viewReg = registrations.find((r) => r.spec.name === 'conversation.view')
if (viewReg === undefined || typeof viewReg.spec.inject !== 'function') fail('conversation.view spec has no inject(sessionId)')
const vi = viewReg.spec.inject('s8-cold-probe')
if (typeof vi.ensureProjection !== 'function') fail('view inject lacks ensureProjection')
if (vi.hooks === undefined || vi.hooks.projectionMirror === undefined || vi.hooks.teamLedgers === undefined) {
  fail('view inject lacks the hooks compartment (projectionMirror/teamLedgers)')
}
vi.ensureProjection('s8-cold-probe') // fire-and-forget: the pull stays pending on the never-resolving carrier
await new Promise((r) => setTimeout(r, 50))
if (rpcCalls.length !== 1) fail(`cold read carrier calls ${rpcCalls.length} !== 1`)
const probe = rpcCalls[0]
if (probe.channel !== '/team-remote') fail(`cold read channel ${JSON.stringify(probe.channel)} !== /team-remote`)
if (probe.method !== 'team.getProjection') fail(`cold read method ${JSON.stringify(probe.method)} !== team.getProjection`)
if (probe.envelope === undefined || probe.envelope.version !== 1) fail(`cold read envelope version ${JSON.stringify(probe.envelope === undefined ? null : probe.envelope.version)} !== 1`)
if (probe.envelope.params === undefined || probe.envelope.params.teamSessionId !== 's8-cold-probe') {
  fail(`cold read params ${JSON.stringify(probe.envelope.params)} — teamSessionId must be the probe session id`)
}
console.log(`ok: apply() drive — effects=${effects.length} (0 errors), registrations=[${regNames.join(', ')}], coldRead=${probe.channel}/${probe.method}, presetListCalls=${presetListCalls}`)
console.log('s8-validate: PASS')
