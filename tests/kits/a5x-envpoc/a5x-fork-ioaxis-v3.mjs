/**
 * a5x-fork-ioaxis-v3.mjs — D-FS-02 独立读写轴 PoC wrapper（PoC banner, disposable）.
 *
 * FORK-DECISION shape (ADR D6):
 *   upstream   : @deepseek-ai/dsh-terminal-bash @ 639ed015397290b3745d163aafe02ffee4aa3f84
 *   mechanism  : ZERO-COPY WRAP of the public exports {name, inject, Config, apply};
 *                native ToolDefinition/params untouched ({command} only).
 *   v3 deltas vs v2 (a5x-fork-capped-v2.mjs):
 *     - caps may carry an additive `io` field:
 *         { writeRoots: [abs paths], maskPaths: [abs paths], exposeFiles: {hostPath: nsPath} }
 *       resolve() attaches it to the returned policy (minimal vocabulary extension;
 *       native code still only reads {mode, workspaceRoot} — the extra fields are inert
 *       to it and consumed ONLY by the sandbox-confine shadow below).
 *     - ctx.get('sandbox') returns a shadow provider (Proxy over the REAL
 *       LocalSandboxProvider): confine() builds the dual-axis bwrap argv when
 *       policy.io is present; otherwise DELEGATES to the real confine (passthrough
 *       for every other consumer / session — additive, never replacing by default).
 *   dual-axis argv = native baseline (ro / / + /dev + /proc + unshare-pid +
 *     die-with-parent + tmpfs /tmp, same shape as bwrapProfileArgs) +
 *     rw-ancestor binds -> per-root --bind / --tmpfs / --ro-bind -> remount-ro ancestors
 *     (construction validated empirically: a5x-dfs02-step1.sh, bwrap 0.11).
 *   NOT production: caps table is a deployer-provided file (PoC stand-in for the
 *     TeamDomain binding); no referential integrity, no ledger.
 */
import { apply as nativeApply, inject, name, Config } from '../../../tests/deepseek-harness-test-use/packages/terminal/terminal-bash/lib/index.js'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'

const BWRAP = '/usr/bin/bwrap'
const NAT_BASE = ['--ro-bind', '/', '/', '--dev', '/dev', '--unshare-pid', '--proc', '/proc', '--die-with-parent', '--tmpfs', '/tmp']

const caps = () => JSON.parse(readFileSync(process.env.A5X_IOAXIS_CAPS ?? '{}', 'utf8'))
const sidOf = (raw) => (typeof raw === 'string' ? raw : String(raw?.id ?? ''))

function buildDualAxisMounts(io) {
  const ops = []
  for (const p of io.writeRoots ?? []) ops.push({ p, kind: 'write' })
  for (const p of io.maskPaths ?? []) ops.push({ p, kind: 'mask' })
  for (const [host, ns] of Object.entries(io.exposeFiles ?? {})) ops.push({ host, ns, kind: 'expose' })
  const ancestors = [...new Set(ops.map((o) => dirname(o.p)))]
  const mounts = []
  // 1) rw-bind ancestors shallowest-first (bwrap 0.11 needs rw parent chains to
  //    place mounts under a ro /; validated T9–T13)
  for (const a of ancestors.sort((x, y) => x.split('/').length - y.split('/').length)) mounts.push('--bind', a, a)
  // 2) the per-path rules themselves
  for (const op of ops) {
    if (op.kind === 'write') mounts.push('--bind', op.p, op.p)
    else if (op.kind === 'mask') mounts.push('--tmpfs', op.p)
    else mounts.push('--ro-bind', op.host, op.ns)
  }
  // 3) remount ancestors ro (deepest-first; non-recursive => child mounts keep rw)
  for (const a of [...ancestors].sort((x, y) => y.split('/').length - x.split('/').length)) mounts.push('--remount-ro', a)
  return mounts
}

function wrapSandbox(real) {
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'confine') {
        return async (argv, policy, signal) => {
          const sid = policy?.__a5xSid ?? '?'
          if (policy?.io === undefined) {
            console.error(`[ioaxis] confine sid=${sid} io=NONE passthrough-to-real`)
            return target.confine(argv, policy, signal)
          }
          const mounts = buildDualAxisMounts(policy.io)
          const out = [BWRAP, ...NAT_BASE, ...mounts, '--', ...argv]
          console.error(
            `[ioaxis] confine sid=${sid} writeRoots=${JSON.stringify(policy.io.writeRoots ?? [])} ` +
            `maskPaths=${JSON.stringify(policy.io.maskPaths ?? [])} exposeFiles=${JSON.stringify(policy.io.exposeFiles ?? {})} ` +
            `argv=${out.slice(0, 10).join(' ')} …`,
          )
          return { argv: out, enforcement: 'full' }
        }
      }
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function capPolicy(real) {
  return {
    ...real,
    defaultMode: 'workspace-write',
    resolve(request) {
      const base = real.resolve(request)
      const session = sidOf(request?.session)
      const entry = caps()[session]
      console.error(`[ioaxis] resolve sid=${session} base.mode=${base.mode} base.root=${base.workspaceRoot} mapped=${entry ? `gen${entry.gen}` : 'NONE'}`)
      if (entry === undefined) {
        // fail-closed: unmapped session is refused, never base (v2 rule, kept)
        throw new Error(`ioaxis: no member ceiling registered for session ${session} — refusing to spawn (fail-closed)`)
      }
      console.error(`[ioaxis] CAP applied sid=${session} gen=${entry.gen} mode=${entry.mode} root=${entry.workspaceRoot} io=${entry.io ? 'yes' : 'no'}`)
      const out = { ...base, mode: entry.mode, workspaceRoot: entry.workspaceRoot }
      if (entry.io) {
        out.io = entry.io
        out.__a5xSid = session
      }
      return out
    },
  }
}

function wrapCtx(ctx) {
  const capped = capPolicy(ctx.sandboxPolicy)
  let sandboxShadow
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'sandboxPolicy') return capped
      const value = Reflect.get(target, prop)
      if (prop === 'get' && typeof value === 'function') {
        return (serviceName) => {
          if (serviceName === 'sandboxPolicy') return capped
          if (serviceName === 'sandbox') {
            // LAZY: the real provider may not be registered at apply() time;
            // it is guaranteed present at spawn time (native throws otherwise).
            if (sandboxShadow === undefined) {
              const real = value.call(target, serviceName)
              sandboxShadow = real === undefined ? real : wrapSandbox(real)
            }
            return sandboxShadow
          }
          return value.call(target, serviceName)
        }
      }
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export { Config, inject, name }

export function apply(ctx, config) {
  console.error('[ioaxis] capped terminal-bash v3 apply() engaged (exact-id keys, fail-closed, additive io + sandbox-confine shadow)')
  return nativeApply(wrapCtx(ctx), config)
}
