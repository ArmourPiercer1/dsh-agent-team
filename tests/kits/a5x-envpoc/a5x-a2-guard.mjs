/**
 * a5x-a2-guard.mjs — PoC-PLAN A2 guard-level suite (in-process; no host).
 * Exercises the SAME a5x-guard.mjs the host kit uses, against a fake provider
 * that mirrors fs-local identity semantics (targetKey = realpath identity,
 * displayPath = requested spelling; opens happen by displayPath after an
 * injectable delay → TOCTOU window is observable).
 * Run: node a5x-a2-guard.mjs <evidence-dir>
 */
import { linkSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { makeRestrictedFs } from './a5x-guard.mjs'

const EV = process.argv[2]
if (!EV) throw new Error('usage: node a5x-a2-guard.mjs <evidence-dir>')
rmSync(EV, { recursive: true, force: true })
mkdirSync(join(EV, 'rootA'), { recursive: true })
mkdirSync(join(EV, 'rootB'), { recursive: true })
mkdirSync(join(EV, 'secretC'), { recursive: true })
mkdirSync(join(EV, 'wOnly'), { recursive: true })
const ROOT_A = realpathSync(join(EV, 'rootA'))
const ROOT_B = realpathSync(join(EV, 'rootB'))
const SECRET = realpathSync(join(EV, 'secretC'))
const WONLY = realpathSync(join(EV, 'wOnly'))
writeFileSync(join(ROOT_A, 'inside.md'), 'INSIDE-OK')
writeFileSync(join(ROOT_B, 'other.md'), 'OTHER-OK')
writeFileSync(join(SECRET, 'x.md'), 'OUTSIDE-SECRET')
writeFileSync(join(WONLY, 'target.md'), 'OLD-CONTENT')
symlinkSync(join(SECRET, 'x.md'), join(ROOT_A, 'esc.md'))
linkSync(join(SECRET, 'x.md'), join(ROOT_A, 'hard.md'))

// fake provider mirroring fs-local semantics
function makeFakeReal(delayMs = 0) {
  const mk = (p) => {
    const abs = resolve(p)
    let key
    try { key = realpathSync(abs) } catch { const missing = []; let cur = abs; for (;;) { try { key = realpathSync(cur); break } catch { missing.unshift(cur.split('/').pop()); cur = cur.slice(0, cur.lastIndexOf('/')) } } key = realpathSync(cur) + '/' + missing.join('/') }
    return { targetKey: key, displayPath: abs }
  }
  const open = async (t) => { if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); return readFileSync(String(t.displayPath), 'utf8') }
  return {
    resolve: async (p) => mk(p),
    stat: async (t) => ({ type: 'file', size: 1 }),
    lstat: async (p) => ({ type: 'file' }),
    listDir: async (t) => ['inside.md'],
    readText: (t) => open(t),
    streamText: async (t) => [await open(t)][Symbol.asyncIterator](),
    readBytes: async (t) => Buffer.from(await open(t)),
    readByteRange: async (t, { offset, length }) => Buffer.from(await open(t), 'utf8').subarray(offset, offset + length),
    writeText: async (t, content) => { writeFileSync(String(t.displayPath), content) },
    editText: async (t, patch) => { const old = readFileSync(String(t.displayPath), 'utf8'); writeFileSync(String(t.displayPath), old + '+EDIT'); return { ok: true } },
    watch: async () => () => {},
  }
}
const mkPolicy = (mode) => ({ readRoots: [ROOT_A], writeRoots: [ROOT_A], mode })
const results = []
const T = async (id, fn) => {
  try { const r = await fn(); results.push({ id, ...r }) }
  catch (e) { results.push({ id, crash: String(e?.message ?? e).slice(0, 160) }) }
}
const refused = async (p, mode = 'targetKey', extra = {}) => {
  const w = makeRestrictedFs(makeFakeReal(extra.delayMs ?? 0), { ...mkPolicy(mode), ...extra.policy }, () => {}, extra.opts)
  try { const t = await w.resolve(p); const out = await w[extra.method ?? 'readText'](t, extra.arg); return { leaked: true, head: String(out ?? '').slice(0, 30) } }
  catch (e) { return { leaked: false, err: String(e?.message ?? e).slice(0, 90) } }
}

await T('T1-in-scope-read', async () => {
  const w = makeRestrictedFs(makeFakeReal(), mkPolicy('targetKey'), () => {})
  const t = await w.resolve(join(ROOT_A, 'inside.md'))
  return { ok: (await w.readText(t)).includes('INSIDE-OK') }
})
await T('T2-outside-read', () => refused(join(SECRET, 'x.md')))
await T('T3-symlink-escape-targetKey', () => refused(join(ROOT_A, 'esc.md')))
await T('T3b-symlink-escape-displayPath-mode', () => refused(join(ROOT_A, 'esc.md'), 'displayPath'))
await T('T4-hardlink-targetKey', () => refused(join(ROOT_A, 'hard.md')))
await T('T4b-hardlink-displayPath', () => refused(join(ROOT_A, 'hard.md'), 'displayPath'))
await T('T5-toctou-swap-to-symlink', async () => {
  // guard passes (real file inside), then the file is swapped for a symlink to
  // the secret BEFORE the provider opens by displayPath.
  const w = makeRestrictedFs(makeFakeReal(60), mkPolicy('targetKey'), () => {}, { delayMs: 1 })
  const t = await w.resolve(join(ROOT_A, 'race.md'))
  writeFileSync(join(ROOT_A, 'race.md'), 'TEMP-OK')
  const p = w.readText(t)
  unlinkSync(join(ROOT_A, 'race.md'))
  symlinkSync(join(SECRET, 'x.md'), join(ROOT_A, 'race.md'))
  try { const out = await p; return { leaked: String(out).includes('OUTSIDE-SECRET') ? 'LEAKED' : 'other', head: String(out).slice(0, 20) } }
  catch { return { leaked: false } }
  finally { unlinkSync(join(ROOT_A, 'race.md')) }
})
await T('T6-dotdot-traversal', () => refused(join(ROOT_A, '..', 'secretC', 'x.md')))
await T('T7-case-variant', () => refused(join(ROOT_A, 'Inside.md').replace('/rootA/', '/RootA/')))
await T('T8-relative-path-cwd', () => refused('inside.md'))
await T('T9-write-only-root', async () => {
  const led = []
  const w = makeRestrictedFs(makeFakeReal(), { readRoots: [], writeRoots: [WONLY], mode: 'targetKey' }, (x) => led.push(x))
  const out = { readRefused: false, writeOk: false, editOldReadEscalation: 'unknown' }
  try { const t = await w.resolve(join(WONLY, 'target.md')); await w.readText(t) } catch { out.readRefused = true }
  const t2 = await w.resolve(join(WONLY, 'target.md'))
  try { await w.writeText(t2, 'NEW'); out.writeOk = true } catch { out.writeOk = false }
  try { await w.editText(t2, {}); out.editOldReadEscalation = readFileSync(join(WONLY, 'target.md'), 'utf8').includes('+EDIT') ? 'YES-READ-WITHOUT-READ-ROOT' : 'no' }
  catch { out.editOldReadEscalation = 'refused' }
  return out
})
await T('T10-watch-outside', async () => {
  const w = makeRestrictedFs(makeFakeReal(), mkPolicy('targetKey'), () => {})
  try { await w.watch(await makeFakeReal().resolve(join(SECRET, 'x.md')), () => {}, new AbortController().signal); return { refused: false } } catch { return { refused: true } }
})
await T('T11-10MiB-window', async () => {
  const big = join(ROOT_A, 'big.txt')
  const line = 'x'.repeat(60) + '\n'
  writeFileSync(big, line.repeat(Math.ceil((10 * 1024 * 1024) / line.length)))
  const raw = makeFakeReal()
  const w = makeRestrictedFs(raw, mkPolicy('targetKey'), () => {})
  const t = await w.resolve(big)
  const t0 = Date.now(); const full = await w.readText(t); const guardedMs = Date.now() - t0
  const t1 = Date.now(); const r = await w.readByteRange(t, { offset: 5 * 1024 * 1024, length: 40 }); const rangeMs = Date.now() - t1
  return { sizeOk: full.length > 9_900_000, marker: String(Buffer.from(r).toString()).trim().length > 0, guardedReadMs: guardedMs, guardRangeMs: rangeMs }
})
await T('T12-lstat-outside-metadata', async () => {
  const w = makeRestrictedFs(makeFakeReal(), mkPolicy('targetKey'), () => {})
  try { await w.lstat(join(SECRET, 'x.md')); return { refused: false } } catch { return { refused: true } }
})
await T('T13-listdir', async () => {
  const w = makeRestrictedFs(makeFakeReal(), mkPolicy('targetKey'), () => {})
  const a = await w.listDir(await w.resolve(ROOT_A)).then(() => true, () => false)
  const s = await w.listDir(makeFakeReal().resolve ? await makeFakeReal().resolve(SECRET) : { targetKey: SECRET, displayPath: SECRET }).then(() => true, () => false)
  return { insideOk: a, outsideRefused: !s }
})
await T('T14-resolve-existence-sidechannel', async () => {
  const w = makeRestrictedFs(makeFakeReal(), { readRoots: [ROOT_A], writeRoots: [WONLY], mode: 'targetKey' }, () => {})
  const secVisible = await w.resolve(join(SECRET, 'x.md')).then(() => true, () => false)
  const wOnlyVisible = await w.resolve(join(WONLY, 'target.md')).then(() => true, () => false)
  return { secretResolveRefused: !secVisible, writeOnlyRootResolveAllowed: wOnlyVisible, note: 'write-only roots keep an existence signal by design (disclosed)' }
})

await T('T3c-symlink-method-only-no-resolve-guard', async () => {
  const w = makeRestrictedFs(makeFakeReal(), mkPolicy('targetKey'), () => {}, { resolveGuard: false })
  const t = await w.resolve(join(ROOT_A, 'esc.md'))
  try { const out = await w.readText(t); return { leaked: String(out).includes('OUTSIDE-SECRET') ? 'LEAK' : 'other', head: String(out).slice(0, 20) } }
  catch { return { leaked: false } }
})
await T('T5b-stored-key-trust-hazard', async () => {
  // production-hazard class: guard trusts the targetKey computed at resolve()
  // time and does not re-derive identity at use time.
  const w = makeRestrictedFs(makeFakeReal(30), mkPolicy('targetKey'), () => {}, { recomputeAtUseTime: false })
  const t = await w.resolve(join(ROOT_A, 'race2.md'))
  writeFileSync(join(ROOT_A, 'race2.md'), 'TEMP-OK')
  const p = w.readText(t)
  unlinkSync(join(ROOT_A, 'race2.md'))
  symlinkSync(join(SECRET, 'x.md'), join(ROOT_A, 'race2.md'))
  try { const out = await p; return { leaked: String(out).includes('OUTSIDE-SECRET') ? 'LEAK' : 'other' } }
  catch { return { leaked: false } } finally { unlinkSync(join(ROOT_A, 'race2.md')) }
})

const out = join(EV, 'a2-guard.json')
writeFileSync(out, JSON.stringify({ ran: new Date().toISOString(), ev: EV, results }, null, 2))
console.log(JSON.stringify(Object.fromEntries(results.map((r) => [r.id, r.leaked === true ? 'LEAK' : r.refused === true || r.ok === true ? 'pass' : r]))))
