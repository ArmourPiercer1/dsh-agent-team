/**
 * p09-shared.mjs — Alpha.5 P0-9 (web/jobs/MCP fixture-level loopback/mock legs).
 * Shared helpers for the three p09 runners. Team-owned PoC evidence only.
 *
 * Discipline (user-confirmed for this round):
 *  - Loopback/mock ONLY: every socket target is 127.0.0.1; the loopback
 *    tripwire (installLoopbackTripwire) makes any non-loopback fetch attempt
 *    a recorded BLOCK + rejection, never an issued request. No third-party
 *    egress, no proxy use (proxy env vars are deleted in-process and the
 *    deletion is recorded), no :3080 touch, no privilege changes, no writes
 *    into the pinned test-use tree.
 *  - Import mechanism: p00-fixture junctions (cordis/dsh-scope/dsh-system-
 *    prompt/dsh-tools/dsh-llm) are REUSED as-is; additional pinned packages
 *    are imported via absolute file URL of their built lib/index.js — NO new
 *    junctions are created here.
 *
 * @module evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-shared
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { release } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { WORKTREE_ROOT } from '../00-baseline/p00-fixture.mjs'

export { WORKTREE_ROOT }
export const HERE = dirname(new URL(import.meta.url).pathname)
export const TEST_USE = resolve(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')

/** File-URL import of a built lib entry inside the pinned tree (read-only). */
export const libUrl = (...parts) => pathToFileURL(join(TEST_USE, 'packages', ...parts, 'lib', 'index.js')).href

/** git facts helper. */
export const git = (args, cwd) => {
  try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}

/** Frozen environment header shared by all three runners. */
export function envHeader(extra = {}) {
  return {
    recorded_at_utc: new Date().toISOString(),
    team_HEAD: git(['rev-parse', 'HEAD'], WORKTREE_ROOT),
    team_branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], WORKTREE_ROOT),
    test_use_HEAD: git(['rev-parse', 'HEAD'], TEST_USE),
    test_use_porcelain: git(['status', '--porcelain'], TEST_USE).length === 0 ? 'CLEAN' : 'DIRTY(FATAL-PATH)',
    node: process.version,
    platform: `${process.platform} ${release()}`,
    model_verbatim: 'You are a coding agent powered by the qwen3.8-flash-next model.',
    ...extra,
  }
}

/** Assertion ledger factory (PASS/FAIL per leg, mirrored to stdout). */
export function makeLedger(tag) {
  const results = []
  const expect = (id, cond, detail) => {
    results.push({ id: `${tag}.${id}`, verdict: cond ? 'PASS' : 'FAIL', detail })
    console.log(`${cond ? 'PASS' : 'FAIL'} ${tag}.${id} — ${detail}`)
    return cond
  }
  return { results, expect }
}

/**
 * Loopback tripwire around globalThis.fetch. Every attempt is recorded;
 * targets outside `allowed` (a Set of host:port on 127.0.0.1) are REJECTED
 * without ever issuing a request — the rejection itself is the evidence that
 * a policy denial prevented connection establishment.
 */
export function installLoopbackTripwire(allowed) {
  const real = globalThis.fetch
  const attempts = []
  const blocked = []
  globalThis.fetch = (input, init) => {
    let url
    try { url = new URL(typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url)) } catch { url = null }
    const port = url ? (url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80') : '?'
    const target = url ? `${url.hostname}:${port}` : String(input)
    attempts.push({ at: Date.now(), target, href: url?.href ?? String(input) })
    if (url === null || url.hostname !== '127.0.0.1' || !allowed.has(target)) {
      blocked.push({ at: Date.now(), target, href: url?.href ?? String(input) })
      return Promise.reject(new Error(`P09_LOOPBACK_TRIPWIRE_BLOCKED ${target} (fixture forbids any non-allowed target)`))
    }
    return real(input, init)
  }
  return {
    attempts,
    blocked,
    restore() { globalThis.fetch = real },
  }
}

/** Delete proxy env vars in-process (fixture must never route through a proxy). Recorded by caller. */
export function stripProxyEnv() {
  const names = ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy']
  const removed = {}
  for (const n of names) { if (process.env[n] !== undefined) { removed[n] = process.env[n]; delete process.env[n] } }
  return removed
}

/** Idempotent scratch dir: recreated on every run. */
export function scratch(sub) {
  const dir = join(HERE, 'probe-scratch')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, sub)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  return target
}
