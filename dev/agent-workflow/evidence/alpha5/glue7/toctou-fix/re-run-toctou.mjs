/**
 * GLUE-7 TOCTOU FIX — adversarial re-run (①(c) closure).
 * Same-SHAPE reproduction of the independent review's attack driver
 * (a5g7rev re-probe C1/C2/C3): a SEPARATE /bin/bash attacker swaps the
 * anchored path between a clean regular file/dir and a symlink onto the
 * outside secret while the production backends (driven through the COMPILED
 * DIST MIRROR — the face the host loads) hammer the call. Any response
 * containing the secret = exploit proof. Green = ZERO leaks:
 *   C1 read       20 000 iterations (reviewer leaked at 23)
 *   C2 grep file  400 iterations   (reviewer leaked at 1)
 *   C3 grep dir   400 iterations   (reviewer 0/400 — kept un-exempted,
 *                                   the asymmetric-follow law is DISCLOSED
 *                                   in README §4, this leg re-proves it)
 * Sanity legs pin non-regression: real read bytes, real grep hits, fd-view
 * remapping (results must present the ANCHORED path, never /proc/self/fd/N),
 * final-symlink still refused.
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WT = resolve(HERE, '../../../../../..') // the a5g7-backend worktree
const DIST = join(WT, 'packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs')
const WORLD = join(WT, 'tests/homes', `a5g7-toctou-${new Date().toISOString().replace(/[:.]/g, '')}`)
const ROOT = join(WORLD, 'root')
const OUT = join(WORLD, 'outside')
fs.mkdirSync(join(ROOT, 'pkg/sub'), { recursive: true })
fs.mkdirSync(OUT, { recursive: true })
const SECRET = 'A5G7-TOCTOU-CANARY-9d4c2a-DO-NOT-LEAK'
fs.writeFileSync(join(OUT, 'secret.txt'), `prelude ${SECRET} trailer\n`)
fs.writeFileSync(join(ROOT, 'pkg/a.txt'), 'needle alpha\n')
fs.writeFileSync(join(ROOT, 'pkg/sub/b.txt'), 'needle beta\n')

const mod = await import(pathToFileURL(DIST).href)
const { createAnchoredSearchBackend, createGovernedReadExecutor, createAnchoredGlobBackend } = mod
const LAUNCHER = join(WT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LSHA = createHash('sha256').update(fs.readFileSync(LAUNCHER)).digest('hex')
const mkGlob = () => createAnchoredGlobBackend({
  realmId: 'a5g7-toctou', rootDir: ROOT,
  confined: { trustRoot: `sha256:${LSHA.slice(0, 16)}#${LAUNCHER}`, assembly: { launcherPath: LAUNCHER, launcherSha256: LSHA, minAbiVersion: 3 } },
})
const results = []
const log = (leg, ok, detail) => { results.push({ leg, ok }); console.log(`${ok ? 'PASS' : '***FAIL***'} ${leg} :: ${detail}`) }
const sinkAll = () => { const parts = []; return { sink: { write: (s) => parts.push(String(s)) }, text: () => parts.join('') } }
const mkSearch = () => createAnchoredSearchBackend({ realmId: 'a5g7-toctou', rootDir: ROOT })
const grepCall = (over = {}) => ({ callId: `c-${Math.random().toString(36).slice(2)}`, parsedArgs: { tool: 'grep', pattern: 'A5G7-TOCTOU-CANARY|needle|clean', target: { placement: 'workspace', locator: 'pkg' }, outputMode: 'content', globFilter: undefined, multiline: false, maxResults: 250, ...over } })
const mkRead = () => createGovernedReadExecutor({ realmId: 'a5g7-toctou', rootDir: ROOT, policy: { default: 'allow', allow: [], ask: [] }, decide: () => ({ kind: 'allow' }) })

// ---- sanity: non-regression ----------------------------------------------
{
  const read = mkRead()
  const t = await read({ file_path: 'pkg/a.txt' })
  log('S1/read-still-runs', String(t).includes('needle alpha') && !String(t).includes('refused-'), String(t).slice(0, 60))
  const s = mkSearch(); const io = sinkAll()
  const r = await s.run(grepCall(), io)
  log('S2/grep-dir-still-runs', r?.ok === true && io.text().includes('needle') && !io.text().includes('/proc/self/fd'), `ok=${r?.ok} fdview=${io.text().includes('/proc/self/fd')}`)
  const s2 = mkSearch(); const io2 = sinkAll()
  const r2 = await s2.run(grepCall({ target: { placement: 'relative', locator: 'pkg/a.txt' } }), io2)
  log('S3/grep-file-fd-view-remapped', r2?.ok === true && io2.text().includes('needle') && !io2.text().includes('/proc/self/fd'), `out=${io2.text().slice(0, 90)}`)
  fs.symlinkSync(join(OUT, 'secret.txt'), join(ROOT, 'link.txt'))
  const t2 = await read({ file_path: 'link.txt' })
  log('S4/final-symlink-refused', String(t2).includes('symlink-alias') && !String(t2).includes(SECRET), String(t2).slice(0, 100))
  fs.rmSync(join(ROOT, 'link.txt'), { force: true })
}

// ---- C1/C2: file-target swap race (the two measured leak classes) --------
async function toctouFile(rel, mkCall, extract, iters) {
  const anchored = resolve(ROOT, rel)
  const reg = join(WORLD, 'swap.reg'), lnk = join(WORLD, 'swap.lnk')
  fs.writeFileSync(reg, 'clean content A5G7-TOCTOU-CANARY-clean\n')
  try { fs.unlinkSync(lnk) } catch { /* fresh */ }
  fs.symlinkSync(join(OUT, 'secret.txt'), lnk)
  fs.rmSync(anchored, { recursive: true, force: true })
  fs.copyFileSync(reg, anchored)
  const atk = spawn('/bin/bash', ['-c', `while :; do ln -sfn ${JSON.stringify(join(OUT, 'secret.txt'))} ${JSON.stringify(lnk)}; mv -f ${JSON.stringify(lnk)} ${JSON.stringify(anchored)} 2>/dev/null; mv -f ${JSON.stringify(reg)} ${JSON.stringify(anchored)} 2>/dev/null; done`])
  let hit = null, refusals = 0, oks = 0
  const t0 = Date.now()
  for (let i = 0; i < iters && hit === null; i++) {
    const r = await mkCall()
    const txt = extract(r)
    if (String(txt).includes(SECRET)) hit = { iter: i, sample: String(txt).slice(0, 200) }
    else if (String(txt).includes('refused-') || r?.ok === false) refusals++
    else oks++
  }
  const ms = Date.now() - t0
  atk.kill('SIGKILL'); await new Promise((res) => atk.once('exit', res))
  fs.rmSync(anchored, { recursive: true, force: true })
  fs.writeFileSync(anchored, 'clean content\n')
  return { hit, refusals, oks, iters, ms }
}
{
  const read = mkRead()
  const res = await toctouFile('pkg/race.txt', () => read({ file_path: 'pkg/race.txt' }), (r) => r, 20_000)
  log('C1/toctou/read', res.hit === null, `iters=20000 ok=${res.oks} refused=${res.refusals} windowMs=${res.ms} leaked=${res.hit !== null}${res.hit ? ' ' + JSON.stringify(res.hit) : ''}`)
}
{
  const s = mkSearch()
  const res = await toctouFile('pkg/raceg.txt', async () => { const io = sinkAll(); const r = await s.run(grepCall({ pattern: '.', target: { placement: 'relative', locator: 'pkg/raceg.txt' } }), io); return { r, io } }, ({ r, io }) => `${JSON.stringify(r?.failure ?? '')}|${io.text()}`, 400)
  log('C2/toctou/grep-filearg', res.hit === null, `iters=400 ok=${res.oks} refused=${res.refusals} windowMs=${res.ms} leaked=${res.hit !== null}${res.hit ? ' ' + JSON.stringify(res.hit) : ''}`)
}
// ---- C3: directory-target swap (disclosed residual — re-prove 0/400) -----
{
  const rel = 'raceDir'
  const anchored = resolve(ROOT, rel)
  const reg = join(WORLD, 'swapd.dir')
  fs.rmSync(anchored, { recursive: true, force: true })
  fs.rmSync(reg, { recursive: true, force: true })
  fs.mkdirSync(reg); fs.writeFileSync(join(reg, 'inner-clean.txt'), 'clean dir content\n')
  const A = JSON.stringify(anchored), R = JSON.stringify(reg), O = JSON.stringify(OUT)
  const atk = spawn('/bin/bash', ['-c', `while :; do rm -f ${A}; ln -sfn ${O} ${A}; sleep 0.02; rm -f ${A}; cp -a ${R} ${A}; sleep 0.002; rm -f ${A} || true; done`])
  const s = mkSearch()
  let hit = null, oks = 0, refusals = 0, unres = 0
  const t0 = Date.now()
  for (let i = 0; i < 400 && hit === null; i++) {
    const io = sinkAll()
    const r = await s.run(grepCall({ pattern: 'A5G7-TOCTOU-CANARY', target: { placement: 'workspace', locator: rel } }), io)
    if (io.text().includes(SECRET)) hit = { iter: i, sample: io.text().slice(0, 240) }
    else if (r?.ok === true) oks++
    else if (String(r?.failure?.code) === 'symlink-alias') refusals++
    else unres++
  }
  const ms = Date.now() - t0
  atk.kill('SIGKILL'); await new Promise((res) => atk.once('exit', res))
  fs.rmSync(anchored, { recursive: true, force: true })
  log('C3/toctou/grep-dirarg', hit === null, `iters=400 ok=${oks} symlinkAliasRefused=${refusals} otherRefused=${unres} windowMs=${ms} leaked=${hit !== null}${hit ? ' ' + JSON.stringify(hit) : ''} (residual DISCLOSED in README §4, not exempted)`)
}
// ---- C4: glob walk-root dir swap (the row ships NEW: same-shape attack) --
// rg FOLLOWS command-line symlinked dirs (measured — unlike grep -r), so the
// row must answer the same ①(c) attack: pre-open+verify refuses the swapped
// string; anything through the microsecond window meets the Landlock
// allowPaths backstop (outside target = kernel refusal, zero bytes).
{
  const rel = 'raceGlob'
  const anchored = resolve(ROOT, rel)
  const reg = join(WORLD, 'swapg.dir')
  fs.rmSync(anchored, { recursive: true, force: true })
  fs.rmSync(reg, { recursive: true, force: true })
  fs.mkdirSync(reg); fs.writeFileSync(join(reg, 'inner-clean.txt'), 'clean glob content\n')
  const A = JSON.stringify(anchored), R = JSON.stringify(reg), O = JSON.stringify(OUT)
  const atk = spawn('/bin/bash', ['-c', `while :; do rm -f ${A}; ln -sfn ${O} ${A}; sleep 0.02; rm -f ${A}; cp -a ${R} ${A}; sleep 0.002; rm -f ${A} || true; done`])
  const be = mkGlob()
  let hit = null, oks = 0, refusals = 0, other = 0
  const t0 = Date.now()
  for (let i = 0; i < 200 && hit === null; i++) {
    const io = sinkAll()
    const r = await be.run({ callId: `g-${i}-${Math.random().toString(36).slice(2)}`, parsedArgs: { tool: 'glob', pattern: '*', target: { placement: 'relative', locator: rel } } }, io)
    const txt = `${JSON.stringify(r?.failure ?? '')}|${io.text()}`
    if (String(txt).includes(SECRET)) hit = { iter: i, sample: String(txt).slice(0, 220) }
    else if (r?.ok === true) oks++
    else if (['symlink-alias', 'exec-time-escape'].includes(String(r?.failure?.code))) refusals++
    else other++
  }
  const ms = Date.now() - t0
  atk.kill('SIGKILL'); await new Promise((res) => atk.once('exit', res))
  fs.rmSync(anchored, { recursive: true, force: true })
  const ioPos = sinkAll()
  fs.mkdirSync(anchored, { recursive: true }); fs.writeFileSync(join(anchored, 'clean.txt'), 'still walks clean\n')
  const rPos = await be.run({ callId: 'g-pos', parsedArgs: { tool: 'glob', pattern: '*', target: { placement: 'relative', locator: rel } } }, ioPos)
  // the PRESENTED face (outcome.files, root-relative) is the contract; the
  // sink carries the raw rg bytes of the `.`-rooted walk
  const posHit = rPos?.ok === true && (rPos.outcome?.files ?? []).includes(`${rel}/clean.txt`)
  log('C4/toctou/glob-dirwalk', hit === null && posHit, `iters=200 ok=${oks} anchorOrExecRefused=${refusals} otherRefused=${other} windowMs=${ms} leaked=${hit !== null}${hit ? ' ' + JSON.stringify(hit) : ''} positive-walk=${posHit}`)
}
const bad = results.filter((r) => !r.ok)
console.log(`\nTOCTOU-RE-RUN VERDICT ${bad.length === 0 ? 'GREEN' : 'RED'} (${results.length - bad.length}/${results.length})`)
fs.rmSync(WORLD, { recursive: true, force: true })
process.exit(bad.length === 0 ? 0 : 1)
