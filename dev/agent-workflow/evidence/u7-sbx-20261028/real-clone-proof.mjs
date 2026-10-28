#!/usr/bin/env node
/**
 * real-clone-proof.mjs — the defect and the fix, on a REAL runtime checkout
 * created by the documented procedure (docs/TEST_METHODS.md §1), offline, zero
 * host boots.
 *
 *   git clone --local --no-hardlinks <main>/tests/deepseek-harness-test-use \
 *       .artifacts/tmp/sbx-clone/tests/deepseek-harness-test-use
 *   git -C <clone> checkout --detach <TEST_USE_BASELINE_SHA>
 *   # the built entry lib + the pnpm workspace link a runtime install/build
 *   # would produce (byte-identical to this SHA's build output) are copied in
 *
 * Then: factory pre-flight through the SAME code path a C2 runner uses.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { TestWorldFactory } from '../../../../tests/world-factory/lib/world-factory.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'

const tree = resolve(process.argv[2])
const git = (...args) => String(spawnSync('git', ['-C', tree, ...args], { encoding: 'utf8' }).stdout ?? '').trim()
const bin = join(tree, 'native/system/packages/linux-x64/bin')

console.log('# runtime checkout')
console.log('path                     :', tree)
console.log('HEAD                     :', git('rev-parse', 'HEAD'), '(pinned =', TEST_USE_BASELINE_SHA + ')')
console.log('git status --porcelain   :', JSON.stringify(git('status', '--porcelain')))
console.log('platform bin/ exists     :', existsSync(bin), existsSync(bin) ? JSON.stringify(readdirSync(bin, { recursive: true }).map(String)) : '')
console.log('launcher present         :', existsSync(join(bin, 'landlock-run')))

console.log('\n# gitignored native assets (the reason a clone has no binaries)')
for (const rel of ['native/system/packages/linux-x64/bin/landlock-run', 'native/system/packages/linux-x64/bin/glibc/system.node']) {
  console.log(rel, '\n   ->', String(spawnSync('git', ['-C', tree, 'check-ignore', '-v', rel], { encoding: 'utf8' }).stdout ?? '').trim() || '(not ignored!)')
}

console.log('\n# factory pre-flight (the path every C2 runner takes before its first host start)')
const factory = new TestWorldFactory({
  repoRoot: resolve(import.meta.dirname, '..', '..', '..', '..'),
  evidenceRoot: resolve(import.meta.dirname, '..', '..', '..', '..', '.artifacts', 'tmp', 'sbx-preflight-evidence'),
  hostTree: tree,
})
const record = { record: { bindings: { worldIds: ['(no world booted: 0 host starts)'] } } }
factory.bindRunRecord(record)
const p = await factory.preflightHostSandbox({})
console.log('verdicts                 :', p.verdicts.map((v) => `${v.phase}=${v.backend}`).join('  ->  '))
console.log('backend / usable         :', p.backend, '/', p.usable)
console.log('launcher present / digest :', p.launcherPresent, '/', p.launcherSha256)
console.log('porcelainEmpty           :', p.porcelainEmpty, JSON.stringify(p.porcelain.lines))
console.log('asset action / bytes     :', p.asset?.action, '/', p.asset?.bytesWritten)
console.log('asset source             :', p.asset?.source?.kind, p.asset?.source?.tree)
console.log('asset source HEAD        :', p.asset?.source?.runtimeHead, 'matches pinned:', p.asset?.source?.headMatchesPinnedBaseline)
for (const f of p.asset?.files ?? []) console.log('   ', f.relPath, f.state, f.sha256, f.mode)
console.log('\n# the RUN record bindings the factory wrote')
console.log('bindings.nativeConfinementBackend    :', record.record.bindings.nativeConfinementBackend)
console.log('bindings.sandboxPreflight.backend    :', record.record.bindings.sandboxPreflight?.backend)
console.log('bindings.nativeConfinementDisclosure :', record.record.bindings.nativeConfinementDisclosure ?? '(none: backend full)')
console.log('\n# the host launcher answers, post-provision')
console.log(spawnSync(join(bin, 'landlock-run'), ['--probe'], { encoding: 'utf8' }).stdout.trim())
console.log('\n# runtime checkout AFTER provisioning (must be byte-clean)')
console.log('git status --porcelain   :', JSON.stringify(git('status', '--porcelain')))
console.log('HEAD                     :', git('rev-parse', 'HEAD'))
console.log('\n# second pre-flight is a no-op (assets present, nothing rewritten)')
const p2 = await factory.preflightHostSandbox({ force: true })
console.log('verdicts                 :', p2.verdicts.map((v) => `${v.phase}=${v.backend}`).join('  ->  '))
