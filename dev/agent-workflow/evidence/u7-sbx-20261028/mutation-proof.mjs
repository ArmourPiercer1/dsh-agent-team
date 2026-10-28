#!/usr/bin/env node
/**
 * mutation-proof.mjs — prove the u7-sbx C1 legs are load-bearing.
 *
 * Each MUTATION edits the IMPLEMENTATION (never the test), runs
 * host-sandbox-assets.test.mjs, records which legs die, then restores the
 * file byte-for-byte from the pre-mutation backup (a failed mutation must not
 * be able to leave residue; the caller re-verifies with git diff).
 *
 *   node .tmp-sbx-evidence/mutation-proof.mjs            # all mutations
 *   node .tmp-sbx-evidence/mutation-proof.mjs a c        # a subset
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const TEST = 'tests/world-factory/host-sandbox-assets.test.mjs'
const LIB = 'tests/world-factory/lib/host-sandbox-assets.mjs'
const U74A = 'tests/world-factory/lib/u74a-jobs-assembly.mjs'
const ARCD = 'tests/world-factory/lib/u6-arc-d-assembly.mjs'

const sub = (file, from, to) => ({ file, apply: (s) => {
  if (!s.includes(from)) throw new Error(`mutation anchor missing in ${file}: ${JSON.stringify(from.slice(0, 60))}`)
  if (s.split(from).length !== 2) throw new Error(`mutation anchor not unique in ${file}`)
  return s.replace(from, to)
} })

const MUTATIONS = {
  a: {
    what: 'skip the hash verification (source/staged/published digests no longer refuse a mismatch)',
    edits: [
      sub(LIB, "    if (sha256 !== f.expectedSha256) {\n      throw new HostSandboxAssetError('SOURCE_DIGEST_MISMATCH'", "    if (false) {\n      throw new HostSandboxAssetError('SOURCE_DIGEST_MISMATCH'"),
      sub(LIB, "      if (stagedSha !== f.expectedSha256) {", "      if (false) {"),
      sub(LIB, "      if (published !== f.expectedSha256) {", "      if (false) {"),
    ],
  },
  b: {
    what: 'treat a missing binary as success instead of provisioning it',
    edits: [sub(LIB,
      "  // (2) Only a copy is needed from here on: resolve and validate the SOURCE.",
      "  return provenance({ layout, pinned, baseline, libc, action: 'present', bytesWritten: 0, source: null, porcelainBefore, files: destination.map((f) => ({ ...f, state: 'present', mode: '0o755', bytesWritten: 0 })) })\n  // (2) Only a copy is needed from here on: resolve and validate the SOURCE.")],
  },
  c: {
    what: 'judge the u74a native leg FAIL even when the probe says the backend is unusable',
    edits: [sub(U74A, "nativeConfinementEnvBlock({ observedText: ctl, preflight: opts.sandboxPreflight ?? null })", "nativeConfinementEnvBlock({ observedText: ctl, preflight: null })")],
  },
  d: {
    what: 'judge the ARC-D native-parity leg FAIL even when the probe says the backend is unusable',
    edits: [sub(ARCD, "nativeConfinementEnvBlock({ observedSignal: nativeLaneSignal, preflight: sandboxPreflight })", "nativeConfinementEnvBlock({ observedSignal: nativeLaneSignal, preflight: null })")],
  },
}

function runTest() {
  const r = spawnSync(process.execPath, ['--test', TEST], { cwd: ROOT, encoding: 'utf8' })
  const out = `${String(r.stdout ?? '')}${String(r.stderr ?? '')}`
  const dead = [...new Set([...out.matchAll(/^✖ (T\d+[^\n]*?) \(/gm)].map((m) => m[1].trim()))]
  const pass = /ℹ pass (\d+)/.exec(out)?.[1] ?? '?'
  const fail = /ℹ fail (\d+)/.exec(out)?.[1] ?? '?'
  return { dead, pass, fail, exit: r.status }
}

const wanted = process.argv.slice(2).filter((k) => k in MUTATIONS)
const list = wanted.length > 0 ? wanted : Object.keys(MUTATIONS)
const backup = mkdtempSync(join(ROOT, '.artifacts', 'tmp', 'sbx-mut-'))
const files = [...new Set(list.flatMap((k) => MUTATIONS[k].edits.map((e) => e.file)))]
for (const f of files) copyFileSync(join(ROOT, f), join(backup, f.split('/').pop()))
let worst = 0
try {
  for (const key of list) {
    const m = MUTATIONS[key]
    process.stdout.write(`\n=== MUTATION ${key}: ${m.what}\n`)
    for (const e of m.edits) {
      const p = join(ROOT, e.file)
      writeFileSync(p, e.apply(readFileSync(p, 'utf8')))
    }
    const r = runTest()
    for (const d of r.dead) process.stdout.write(`  KILLED ${d}\n`)
    process.stdout.write(`  result: pass=${r.pass} fail=${r.fail}\n`)
    for (const f of files) {
      const tmp = join(backup, f.split('/').pop())
      if (readFileSync(join(ROOT, f), 'utf8') !== readFileSync(tmp, 'utf8')) writeFileSync(join(ROOT, f), readFileSync(tmp, 'utf8'))
      else writeFileSync(join(ROOT, f), readFileSync(tmp, 'utf8'))
    }
    const clean = runTest()
    process.stdout.write(`  after revert: pass=${clean.pass} fail=${clean.fail}\n`)
    if (clean.exit !== 0) worst = 1
    if (r.dead.length === 0) { process.stdout.write('  !! SURVIVED — the legs are not load-bearing\n'); worst = 2 }
  }
} finally {
  rmSync(backup, { recursive: true, force: true })
}
process.exit(worst)
