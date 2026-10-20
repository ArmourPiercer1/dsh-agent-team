// a5rp pilot mount — runs the PINNED governed-fs READ pilot under node's
// native type-stripping (via a5rp-hooks.mjs resolving './x.js' -> './x.ts').
// Phases: serve (parity vectors) | forms (allow/deny/ask) | cancel (pre/mid).
// Witnesses: envelope bytes, fd deltas, observer open/read counts, error codes.
// NEVER imports any host/native read implementation (the hooks file counts
// any resolution touching tool-fs/read-render — expected: zero).
import { appendFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const arg = (n) => argv[argv.indexOf(`--${n}`) + 1]
const PHASE = arg('phase')
const FIXTURES = arg('fixtures') // THE world's fixture dir (same bytes native reads)
const TREE = process.env.A5RP_TREE ?? ''
const OUT = arg('out')

const pilot = await import(pathToFileURL(join(TREE, 'packages/tools/src/governed-fs/index.ts')).href)
const { createGovernedReadDefinition, fingerprintParameters } = pilot

const fdCount = () => readdirSync('/proc/self/fd').length
const rootIdentity = (() => { const st = statSync(FIXTURES); return { dev: st.dev, ino: st.ino } })()
const VECTORS = JSON.parse(process.env.A5RP_VECTORS ?? '[]')

const GRANT = 'a5rp-live-grant'
function makeDef (over = {}) {
  const observer = { opens: [], stats: [], reads: 0 }
  const config = {
    rootDir: FIXTURES,
    rootIdentity,
    ioProfile: 'pinned-trusted-root',
    liveAdmission: () => ({ revoked: false, generation: 1, bindingRevision: 1, grantId: GRANT }),
    observer: {
      onStat: (p) => { observer.stats.push(p) },
      onOpen: (p) => { observer.opens.push(p) },
      onRead: () => { observer.reads += 1 },
    },
    expectationFor (filePath, offset, limit) {
      return { bindingRevision: 1, generation: 1, canonicalLocator: filePath, parametersFingerprint: fingerprintParameters(filePath, offset, limit), grantId: GRANT }
    },
    ...over.config,
  }
  const def = createGovernedReadDefinition(config)
  const binding = (filePath, offset = 1, limit = 2000) => ({ bindingRevision: 1, generation: 1, canonicalLocator: filePath, parametersFingerprint: fingerprintParameters(filePath, offset, limit), grantId: GRANT })
  return { def, binding, observer }
}

const records = []
const rec = (r) => { records.push(r); appendFileSync(OUT + '.partial.jsonl', JSON.stringify(r) + '\n') }

if (PHASE === 'serve') {
  for (const v of VECTORS) {
    const { def, binding, observer } = makeDef()
    const loc = join(FIXTURES, v.rel)
    const fdBefore = fdCount()
    const t0 = Date.now()
    let entry = { id: v.id, loc, phase: 'serve' }
    try {
      const args = { file_path: loc, ...(v.offset !== undefined ? { offset: v.offset } : {}), ...(v.limit !== undefined ? { limit: v.limit } : {}) }
      const outcome = await def.execute(args, { admissionBinding: binding(loc, v.offset ?? 1, v.limit ?? 2000) })
      const rendered = def.output.render(args, outcome)
      entry = { ...entry, ok: true, envelope: rendered[0]?.text ?? '', lines: outcome.lines.length, totalLines: outcome.totalLines }
    } catch (e) {
      entry = { ...entry, ok: false, code: String(e?.code ?? 'UNKNOWN'), message: redactish(String(e?.message ?? e)) }
    }
    rec({ ...entry, fdDelta: fdCount() - fdBefore, opens: observer.opens.length, reads: observer.reads, ms: Date.now() - t0 })
  }
} else if (PHASE === 'forms') {
  const v = VECTORS[0]
  const loc = join(FIXTURES, v.rel)
  // ALLOW form: valid admission serves bytes (witness = fd delta 0 net + opens>0)
  {
    const { def, binding, observer } = makeDef()
    const fdBefore = fdCount()
    const args = { file_path: loc }
    const outcome = await def.execute(args, { admissionBinding: binding(loc) })
    const envelope = def.output.render(args, outcome)[0]?.text ?? ''
    rec({ id: 'form-allow', ok: true, envelopeLen: envelope.length, fdDelta: fdCount() - fdBefore, opens: observer.opens.length, reads: observer.reads })
  }
  // DENY form: revocation at the live view -> typed refusal, reads=0
  {
    const { def, binding, observer } = makeDef({ config: { liveAdmission: () => ({ revoked: true, generation: 1, bindingRevision: 1, grantId: GRANT }) } })
    const fdBefore = fdCount()
    const err = await def.execute({ file_path: loc }, { admissionBinding: binding(loc) }).catch((e) => e)
    rec({ id: 'form-deny', code: String(err?.code ?? 'SERVED?!'), message: redactish(String(err?.message ?? '')), fdDelta: fdCount() - fdBefore, opens: observer.opens.length, reads: observer.reads })
  }
  // ASK form: no admission binding yet (pending) -> typed refusal BEFORE any
  // open; then RESOLVED (binding rides) -> serves. Both states recorded.
  {
    const { def, binding, observer } = makeDef()
    const fdBefore = fdCount()
    const err = await def.execute({ file_path: loc }, {}).catch((e) => e)
    rec({ id: 'form-ask-pending', code: String(err?.code ?? 'SERVED?!'), fdDelta: fdCount() - fdBefore, opens: observer.opens.length, reads: observer.reads })
    const fd2 = fdCount()
    const outcome = await def.execute({ file_path: loc }, { admissionBinding: binding(loc) })
    rec({ id: 'form-ask-resolved', ok: true, lines: outcome.lines.length, fdDelta: fdCount() - fd2, opens: observer.opens.length, reads: observer.reads })
  }
} else if (PHASE === 'cancel') {
  const v = VECTORS.find((x) => x.big === true) ?? VECTORS[0]
  const loc = join(FIXTURES, v.rel)
  // PRE-abort: typed refusal, zero opens.
  {
    const { def, binding, observer } = makeDef()
    const ctrl = new AbortController()
    ctrl.abort()
    const fdBefore = fdCount()
    const err = await def.execute({ file_path: loc }, { admissionBinding: binding(loc), signal: ctrl.signal }).catch((e) => e)
    rec({ id: 'cancel-pre', code: String(err?.code ?? 'SERVED?!'), fdDelta: fdCount() - fdBefore, opens: observer.opens.length, reads: observer.reads })
  }
  // MID-abort: the abort fires at the effect boundary seam (between chain and
  // read) — deterministic; typed refusal, fd delta 0 (finally-closed), reads 0.
  {
    const ctrl = new AbortController()
    const { def, binding, observer } = makeDef({ config: { effectBoundarySeam: () => { ctrl.abort() } } })
    const fdBefore = fdCount()
    const err = await def.execute({ file_path: loc }, { admissionBinding: binding(loc), signal: ctrl.signal }).catch((e) => e)
    rec({ id: 'cancel-mid', code: String(err?.code ?? 'SERVED?!'), fdDelta: fdCount() - fdBefore, opens: observer.opens.length, reads: observer.reads })
  }
} else {
  throw new Error(`unknown phase ${PHASE}`)
}

function redactish (s) { return s.replace(/token=[A-Za-z0-9_-]+/g, 'token=<REDACTED>') }
writeFileSync(OUT, JSON.stringify({ phase: PHASE, records }, null, 2) + '\n')
console.log(`a5rp-pilot ${PHASE}: ${String(records.length)} records`)
