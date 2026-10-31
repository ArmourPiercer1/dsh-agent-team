/**
 * a5x-guard.mjs — shared restricted-provider guard (PoC, Team-side code;
 * never part of a native tool). Extracted from the wave-11 probe so the A2
 * standalone suite and the host kit exercise the SAME guard code.
 *
 * Identity rule (POC-PLAN A2 / ADR "真实资源身份"): guard on FsTarget.targetKey
 * first — fs-local derives targetKey from realpath(resolvedPath), so symlinked
 * files/ancestors collapse to a stable real identity. displayPath is the
 * requested spelling and is NOT an identity (wave-11 guard used it and would
 * have leaked via a symlinked file; the A2 suite measures both modes).
 */
import { lstatSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve as resolvePath } from 'node:path'

const READ_METHODS = ['stat', 'lstat', 'listDir', 'readText', 'streamText', 'readBytes', 'readByteRange', 'watch']
const WRITE_METHODS = ['writeText', 'editText']

export function canonicalize(pathLike) {
  const p = typeof pathLike === 'string' ? pathLike
    : typeof pathLike?.targetKey === 'string' ? String(pathLike.targetKey)
    : typeof pathLike?.displayPath === 'string' ? pathLike.displayPath
    : typeof pathLike?.path === 'string' ? pathLike.path : String(pathLike)
  const abs = isAbsolute(p) ? p : resolvePath(p)
  try { return realpathSync(abs) } catch { /* fall through to ancestor walk */ }
  const missing = []
  let cur = abs
  while (true) {
    try { const real = realpathSync(cur); return missing.length ? real + '/' + missing.reverse().join('/') : real }
    catch { missing.push(basename(cur)); const up = dirname(cur); if (up === cur) return abs; cur = up }
  }
}

export function inside(candidate, roots) {
  return roots.some((r) => { const rel = relative(r, candidate); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)) })
}

/**
 * @param real the underlying FileSystem provider (host-global or in-memory fake)
 * @param policy { readRoots, writeRoots, mode? }  mode: 'targetKey' (default) | 'displayPath' (wave-11 class, for A2 comparison)
 * @param ledger optional rec(obj)
 */
export function makeRestrictedFs(real, policy, ledger, opts = {}) {
  const { readRoots = [], writeRoots = [] } = policy
  const mode = policy.mode ?? 'targetKey'
  const identity = (x) => (mode === 'displayPath'
    ? canonicalize(typeof x === 'string' ? x : (typeof x?.displayPath === 'string' ? x.displayPath : x))
    : canonicalize(x))
  const guarded = (method, kind, rootsArg) => (target) => {
    const roots = rootsArg ?? (kind === 'read' ? readRoots : writeRoots)
    const p = opts.recomputeAtUseTime === false
      ? (typeof target === 'string' ? canonicalize(target) : String(target?.targetKey ?? target?.displayPath ?? target))
      : identity(target)
    const ok = inside(p, roots)
    if (ledger) ledger({ ev: 'fs-guard', method, kind, mode, path: p, verdict: ok ? 'allow' : 'refuse' })
    if (!ok) throw new Error(`A5X-ENFORCE-REFUSE: ${kind} '${p}' outside the member's ${kind} roots (provider-enforced)`)
  }
  const wrap = (method, kind) => async (...args) => {
    if (opts.delayMs && kind === 'read') await new Promise((r) => setTimeout(r, opts.delayMs))
    if (method !== 'lstat') guarded(method, kind)(args[0])
    else guarded(method, kind, kind === 'read' ? readRoots : writeRoots)(args[0])
    return real[method](...args)
  }
  const w = Object.create(real)
  for (const m of READ_METHODS) if (typeof real[m] === 'function') w[m] = wrap(m, 'read')
  for (const m of WRITE_METHODS) if (typeof real[m] === 'function') w[m] = wrap(m, 'write')
  // watch is not promise-friendly in every backend; same wrapper is fine (returns fn).
  w.watch = (target, ...rest) => { guarded('watch', 'read')(target); return real.watch(target, ...rest) }
  // resolve: guarded by read∪write roots → existence outside the member's
  // declared scope is hidden (disclosed: write-only roots still resolve =
  // existence signal for write roots only).
  w.resolve = async (path, ...rest) => {
    if (opts.resolveGuard === false) return real.resolve(path, ...rest)
    const roots = [...readRoots, ...writeRoots]
    const p = identity(typeof path === 'string' ? { displayPath: resolvePath(path), targetKey: canonicalize(path) } : path)
    const ok = inside(p, roots)
    if (ledger) ledger({ ev: 'fs-guard', method: 'resolve', kind: 'resolve', mode, path: p, verdict: ok ? 'allow' : 'refuse' })
    if (!ok) throw new Error(`A5X-ENFORCE-REFUSE: resolve '${p}' outside the member's declared roots`)
    return real.resolve(path, ...rest)
  }
  return w
}

export function makeRestrictedWeb(realWeb, policy, ledger) {
  const allow = policy.network === 'allow' ? (policy.allowUrls ?? null) : null
  const w = Object.create(realWeb)
  const decide = (api, url) => {
    let ok = policy.network === 'allow'
    if (ok && allow) ok = allow.some((pre) => String(url).startsWith(pre))
    if (ledger) ledger({ ev: 'net-guard', api, url: String(url), policy: policy.network ?? 'deny', verdict: ok ? 'allow' : 'refuse' })
    if (!ok) throw new Error(`A5X-NETWORK-REFUSE: ${api} '${url}' (member network=${policy.network ?? 'deny'})`)
  }
  w.fetch = async (url, ...rest) => { decide('fetch', typeof url === 'object' ? String(url?.url ?? url) : url); return realWeb.fetch(url, ...rest) }
  w.search = async (arg, ...rest) => { decide('search', typeof arg === 'object' ? JSON.stringify(arg).slice(0, 120) : String(arg)); return realWeb.search(arg, ...rest) }
  return w
}

export { lstatSync }
