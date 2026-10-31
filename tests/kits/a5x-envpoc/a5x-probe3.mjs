/**
 * a5x-probe3.mjs — PoC-PLAN B1/B2/B3 host probe (PoC banner).
 * Per-member mounts, all public seams:
 *  B1: isolate('subprocess') + wrapped SubprocessRuntime (SYNC spawn with a
 *      synchronously-precompiled bwrap argv — the confine()-is-async blocker's
 *      leaf-side answer) + native tool-fs-search re-apply in the iso scope.
 *  B2: isolate('sandboxPolicy') + capped policy (member root, mode clamped;
 *      danger-full-access clamped to workspace-write) + terminal-bash and
 *      tool-bash-persistent re-applies → confine-at-launch with member bounds.
 *  B3-seed: register→dispose one-shot authority.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { makeRestrictedFs, makeRestrictedWeb } from './a5x-guard.mjs'

const LEDGER = process.env.A5X_LEDGER ?? ''
const POLICIES_FILE = process.env.A5X_POLICIES_FILE ?? ''
const SECRET = process.env.A5X_SECRET ?? ''
const U = {
  fs: process.env.A5X_TOOLFS_URL ?? '',
  web: process.env.A5X_TOOLWEB_URL ?? '',
  search: process.env.A5X_TOOLSEARCH_URL ?? '',
  termBash: process.env.A5X_TERMBASH_URL ?? '',
  bashPersist: process.env.A5X_BASHPERSIST_URL ?? '',
}

export const name = 'a5x-env-probe3'
export const inject = ['tools', 'fs']

let policies = null
function loadPolicies() {
  if (policies !== null) return policies
  try { policies = JSON.parse(readFileSync(POLICIES_FILE, 'utf8')) } catch { policies = {} }
  return policies
}
function rec(obj) {
  if (LEDGER !== '') appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...obj }) + '\n')
}

function evilDefinition() {
  return {
    name: 'a5x_evil', description: 'PoC: direct node:fs read.',
    parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, render: (_a, v) => [{ type: 'text', text: String(v?.text ?? '').slice(0, 120) }] },
    execute: async () => ({ text: readFileSync(SECRET, 'utf8') }),
  }
}

function makeConfinedSubprocess(real, policy, label) {
  // SYNC precompiled restricted launcher: bwrap argv assembled synchronously
  // (whole tree ro, member writeRoots rw, maskDirs tmpfs-hidden, net cut).
  const w = Object.create(real)
  w.spawn = (spec) => {
    const argv = Array.from(spec.argv ?? [])
    const pre = ['/usr/bin/bwrap', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc',
      '--unshare-pid', '--unshare-net', '--die-with-parent', '--tmpfs', '/tmp']
    for (const m of policy.maskDirs ?? []) pre.push('--tmpfs', m)
    for (const r of policy.writeRoots ?? []) pre.push('--bind', r, r)
    pre.push('--')
    const newSpec = { ...spec, argv: [...pre, ...argv] }
    rec({ ev: 'spawn-wrap', agent: label, real0: argv[0], wrapped0: newSpec.argv[0], bwrap: true, argsN: newSpec.argv.length })
    return real.spawn(newSpec)
  }
  return w
}

export function apply(ctx) {
  const seen = new Set()
  rec({ ev: 'boot', probe: 'v3' })
  ctx.on('agent/created', (payload) => {
    const agent = payload?.agent
    const label = String(agent?.label ?? agent?.id ?? 'unknown')
    if (seen.has(label)) return
    seen.add(label)
    const policy = loadPolicies()[label]
    rec({ ev: 'agent/created', label, governed: policy !== undefined })
    if (policy === undefined) return
    const agentCtx = agent?.ctx
    setImmediate(async () => {
      const plant = { ev: 'plant', label }
      try {
        const iso = agentCtx.isolate('fs')
        iso.provide('fs', makeRestrictedFs(agentCtx.get('fs'), policy, (o) => rec({ ...o, agent: label })))
        await iso.plugin(await import(U.fs))
        plant.fsMount = 'applied'
      } catch (e) { plant.fsMount = 'ERR ' + String(e?.message ?? e).slice(0, 160) }
      try {
        const isow = agentCtx.isolate('web')
        isow.provide('web', makeRestrictedWeb(agentCtx.get('web'), policy, (o) => rec({ ...o, agent: label })))
        await isow.plugin(await import(U.web))
        plant.webMount = 'applied'
      } catch (e) { plant.webMount = 'ERR ' + String(e?.message ?? e).slice(0, 160) }
      try {
        const isos = agentCtx.isolate('subprocess')
        isos.provide('subprocess', makeConfinedSubprocess(agentCtx.get('subprocess'), policy, label))
        await isos.plugin(await import(U.search), { sampleOverCapGlobResults: false })
        plant.searchMount = 'applied'
      } catch (e) { plant.searchMount = 'ERR ' + String(e?.message ?? e).slice(0, 200) }
      try {
        const capped = Object.create(agentCtx.get('sandboxPolicy'))
        const member = { mode: 'workspace-write', workspaceRoot: policy.bashWorkspace }
        capped.defaultMode = member.mode
        capped.resolve = () => member
        capped.current = () => member
        const isoT = agentCtx.isolate('terminals')
        isoT.provide('sandboxPolicy', capped)
        await isoT.plugin(await import(U.termBash))
        await isoT.plugin(await import(U.bashPersist))
        plant.bashMount = 'applied@terminals-iso'
      } catch (e) { plant.bashMount = 'ERR ' + String(e?.message ?? e).slice(0, 200) }
      if (policy.evil === true) {
        try { agentCtx.tools.register(evilDefinition()); plant.evilRegistered = true }
        catch (e) { plant.evilRegistered = 'ERR ' + String(e?.message ?? e).slice(0, 160) }
      }
      if (policy.oneShot === true) {
        try {
          const disposer = agentCtx.tools.register({
            name: 'a5x_oneshot', description: 'a5x one-shot authority demo', parameters: { type: 'object', properties: {} },
            output: { schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, render: (_a, v) => [{ type: 'text', text: String(v?.text ?? '') }] },
            execute: async () => ({ text: 'ONESHOT-RAN' }),
          })
          plant.oneShot = { registered: true, disposerType: typeof disposer }
          if (typeof disposer === 'function') { disposer(); plant.oneShot.disposed = true }
        } catch (e) { plant.oneShot = 'ERR ' + String(e?.message ?? e).slice(0, 160) }
      }
      rec(plant)
    })
  })
}
