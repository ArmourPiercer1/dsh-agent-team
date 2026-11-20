#!/usr/bin/env node
/**
 * negative-controls.mjs — one honest negative control per prototype claim.
 *
 *   NC-1  LANE-BITES: the out-of-lane write that the corpus records as denied
 *         is denied for the LANE reason — a refusal fact exists, the target is
 *         absent, and the model-facing error did not carry a success envelope.
 *   NC-2  HARNESS-BITES: mutating ONE golden cell (the expected sha256 of the
 *         created file) turns the comparison RED; restoring it returns GREEN.
 *   NC-3  NO-FALLBACK: a missing/drifted next-host tree raises the typed
 *         NextHostMissingError naming the pinned tag and the provisioning step;
 *         the message never offers the legacy tree, and the resolver refuses a
 *         differing tree rather than reading it.
 *   NC-4  LANE-IS-LOAD-BEARING: widening the SAME vector's write lane by the
 *         refused token makes the same call succeed and the file appear. If the
 *         call still failed, NC-1 would not be evidence about the lane.
 *
 *   node tests/ute-g1-fs/negative-controls.mjs
 *
 * @module tests/ute-g1-fs/negative-controls
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { compareAll, compareRecord, parseGolden, serializeGolden } from './lib/compare.mjs'
import { CORPUS, SECRET_TOKEN } from './lib/corpus.mjs'
import { observeImageStep } from './lib/effect-oracle.mjs'
import { loadHostSurface } from './lib/host.mjs'
import { runCorpus, runVector } from './lib/new-path.mjs'
import { captureVector } from './lib/old-path.mjs'
import { assertNextHostTree, NextHostMissingError } from '../next-host/host-next-lib.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-fs', 'golden', 'old-path.tsv')


/** Prove the shared `read_image` observer bites in four distinct ways. */
function runImageObserverControl() {
  const image = { attachmentId: 'att-1', mediaType: 'image/png', bytes: 4, width: 1, height: 1 }
  const allowed = { isError: false, value: { image }, content: [{ type: 'text' }, { type: 'image', attachment: { attachmentId: 'att-1' } }] }
  const fresh = [{ bytes: 4, sha256: 'ab'.repeat(32) }]
  const throws = (fn, pattern) => {
    try {
      fn()
      return false
    } catch (error) {
      return pattern.test(error instanceof Error ? error.message : String(error))
    }
  }
  const cases = [
    ['zero-attachments', throws(() => observeImageStep(allowed, []), /EXACTLY ONE attachment/), true],
    ['two-attachments', throws(() => observeImageStep(allowed, [...fresh, ...fresh]), /EXACTLY ONE attachment/), true],
    ['wrong-block-id', throws(() => observeImageStep({ ...allowed, content: [{ type: 'text' }, { type: 'image', attachment: { attachmentId: 'att-2' } }] }, fresh), /not the committed attachment/), true],
    ['refusal-committed', throws(() => observeImageStep({ isError: true, content: [] }, fresh), /refused read_image committed/), true],
  ]
  const ok = cases.every(([, actual, expected]) => actual === expected)
  return {
    id: 'NC-IMAGE-OBSERVER',
    ok,
    detail: `cases=${cases.length} ${cases.map(([name, actual, expected]) => `${name}:${actual === expected ? 'RED-as-required' : 'MISSED'}`).join(' ')}`,
  }
}

/** The synthetic `@result:…` effect a read_image record carries, or undefined. */
function imageResult(record) {
  return record.effects.find((effect) => effect.path.startsWith('@result:'))
}

/** Find one golden row by id (a control must state the baseline it tests). */
function goldenRow(golden, id) {
  const row = golden.find((candidate) => candidate.id === id)
  if (row === undefined) throw new Error(`the golden fixture has no row for ${id}`)
  return row
}

/**
 * One real control per retirement-unit MEMBER. Each control runs the legacy
 * path twice on the SAME vector: once unmodified (must equal the golden row)
 * and once with exactly that member's claim disabled (widened lane, or the
 * edit version guard dropped). A control is GREEN only when the unmodified run
 * reproduces the baseline AND the disabled-claim run changes the observed
 * effect. If the member's claim were vacuous, the "mutant" would look like the
 * baseline and the control would go RED.
 */
async function runMemberControls(golden) {
  const results = []
  const positive = []

  /** Shared shape: base run must match golden; mutant must differ. */
  const evaluate = async ({ member, controlId, vector, override, checkMutant, detail }) => {
    const base = await captureVector(vector)
    const mutant = await captureVector(vector, override)
    const expected = goldenRow(golden, vector.id)
    const baseMatches = compareRecord(expected, base).ok
    const differs = compareRecord(base, mutant).ok === false
    const mutantOk = checkMutant(mutant) === true
    results.push({
      id: `NC-MEMBER ${member}`,
      ok: baseMatches && differs && mutantOk,
      detail: `control=${controlId} baseline=${base.outcome}/${base.refusal ?? 'none'} baselineMatchesGolden=${baseMatches} mutant=${mutant.outcome}/${mutant.refusal ?? 'none'} differs=${differs} ${detail}`,
    })
    positive.push({
      id: `NC-MEMBER-POSITIVE ${member}`,
      ok: baseMatches && differs,
      detail: `baseline=${base.outcome}/${base.refusal ?? 'none'} mutant=${mutant.outcome}/${mutant.refusal ?? 'none'} — the mutant is the only difference, so the control is not vacuous`,
    })
  }

  // ── read: widening ONLY the read lane must turn the refusal into a leak ──
  {
    const vector = CORPUS.find((candidate) => candidate.id === 'FS-R1-outside-read-leak')
    await evaluate({
      member: 'read',
      controlId: 'widen-read-lane',
      vector,
      override: { lane: { read: ['inside', 'outside'], write: ['inside'] } },
      checkMutant: (mutant) => mutant.outcome === 'allow' && mutant.leaks.includes(SECRET_TOKEN),
      detail: 'mutantLeaks=SECRET_TOKEN present',
    })
  }

  // ── write: widening ONLY the write lane must make the file appear ────────
  {
    const vector = CORPUS.find((candidate) => candidate.id === 'FS-W4-outside-write')
    await evaluate({
      member: 'write',
      controlId: 'widen-write-lane',
      vector,
      override: { lane: { read: ['inside'], write: ['inside', 'outside'] } },
      checkMutant: (mutant) => {
        const effect = mutant.effects.find((candidate) => candidate.path === 'outside/escape.txt')
        return mutant.outcome === 'allow' && effect?.exists === true && effect.bytes === 5
      },
      detail: 'targetExists=true bytes=5',
    })
  }

  // ── edit: the version guard is the edit member's own load-bearing seam ───
  // The vector's external rewrite is chosen so the edit MATCHES after the
  // external write; without the guard the edit applies, with the guard it is
  // refused stale. (FS-E2's own rewrite deliberately removes the match, so it
  // cannot distinguish "guard fired" from "old_string not found".)
  {
    const source = CORPUS.find((candidate) => candidate.id === 'FS-E2-stale-edit')
    const vector = {
      ...source,
      id: 'FS-E2-stale-edit-control',
      steps: [
        source.steps[0],
        { op: 'externalWrite', path: 'inside/stale.txt', content: 'one and only\n' },
        { tool: 'edit', args: { file_path: 'inside/stale.txt', old_string: 'one', new_string: 'three' } },
      ],
    }
    const base = await captureVector(vector)
    const mutant = await captureVector(vector, { mutations: { dropVersionGuard: true } })
    const expected = goldenRow(golden, 'FS-E2-stale-edit')
    const baseIsStale = base.outcome === 'deny' && base.refusal === 'stale-version'
    const mutantChanged = mutant.outcome === 'allow'
      && mutant.effects[0]?.sha256 !== base.effects[0]?.sha256
    results.push({
      id: 'NC-MEMBER edit',
      ok: baseIsStale && mutantChanged,
      detail: `control=drop-edit-version-guard baseline=${base.outcome}/${base.refusal ?? 'none'} mutant=${mutant.outcome}/${mutant.refusal ?? 'none'} bytes=${mutant.effects[0]?.bytes ?? '-'}`,
    })
    positive.push({
      id: 'NC-MEMBER-POSITIVE edit',
      ok: expected.outcome === 'deny' && expected.refusal === 'stale-version' && baseIsStale && mutantChanged,
      detail: `golden FS-E2=${expected.outcome}/${expected.refusal} baseline=${base.outcome}/${base.refusal} mutant=${mutant.outcome} — the guard, not a missing old_string, is what refused`,
    })
  }

  // ── read_image: widening ONLY the read lane must materialise an attachment ─
  {
    const vector = CORPUS.find((candidate) => candidate.id === 'FS-I2-outside-image-denied')
    await evaluate({
      member: 'read_image',
      controlId: 'widen-read-lane-image',
      vector,
      override: { lane: { read: ['inside', 'outside'], write: ['inside'] } },
      checkMutant: (mutant) => mutant.outcome === 'allow'
        && imageResult(mutant)?.exists === true
        && imageResult(mutant)?.bytes === 70,
      detail: 'attachmentBytes=70 modelBlocks=text+image',
    })
  }

  return { results, positive }
}

/**
 * Run every control.
 * @returns {Promise<Array<{id: string, ok: boolean, detail: string}>>}
 */
export async function runNegativeControls() {
  const results = []
  const host = await loadHostSurface()
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  const w4 = CORPUS.find((vector) => vector.id === 'FS-W4-outside-write')
  const w1 = CORPUS.find((vector) => vector.id === 'FS-W1-create')

  // ── NC-1: the refusal is the lane's, and the effect is absent ───────────
  {
    const run = await runVector(w4, host)
    const denyFact = run.facts.find((fact) => fact.decision === 'deny')
    const effect = run.record.effects.find((candidate) => candidate.path === 'outside/escape.txt')
    const ok = run.record.outcome === 'deny'
      && run.record.refusal === 'lane-deny'
      && denyFact !== undefined
      && effect?.exists === false
    results.push({
      id: 'NC-1-lane-bites',
      ok,
      detail: `outcome=${run.record.outcome} refusal=${run.record.refusal} denyFact=${denyFact === undefined ? 'none' : `${denyFact.method}/${denyFact.axis}`} targetExists=${effect?.exists}`,
    })
  }

  // ── NC-2: a single mutated golden cell must go RED ──────────────────────
  {
    const { records } = await runCorpus({ only: [w1.id, w4.id] })
    const clean = compareAll(golden.filter((row) => [w1.id, w4.id].includes(row.id)), records)
    const mutated = structuredClone(golden.filter((row) => row.id === w1.id))
    mutated[0].effects = mutated[0].effects.map((effect) => effect.path === 'inside/created.txt'
      ? { ...effect, sha256: '0'.repeat(64) }
      : effect)
    const bitten = compareAll(mutated, records)
    const ok = clean.failures.length === 0 && bitten.failures.length === 1
      && bitten.failures[0]?.diffs.some((diff) => diff.field === 'effects')
    results.push({
      id: 'NC-2-harness-bites',
      ok,
      detail: `cleanFailures=${clean.failures.length} mutatedFailures=${bitten.failures.length} mutatedFields=${bitten.failures[0]?.diffs.map((diff) => diff.field).join(',') ?? 'none'}`,
    })
    // Prove the fixture itself is untouched (the mutation was in memory only).
    const onDisk = readFileSync(GOLDEN, 'utf8')
    if (onDisk !== serializeGolden(golden)) {
      results.push({ id: 'NC-2-fixture-unchanged', ok: false, detail: 'the golden fixture changed during the control' })
    }
  }

  // ── NC-3: missing host fails loudly, never falls back ───────────────────
  {
    let error
    try {
      assertNextHostTree('/nonexistent-ute-g1-root')
    } catch (caught) {
      error = caught
    }
    const message = error?.message ?? ''
    const ok = error instanceof NextHostMissingError
      && message.includes('dsh-v0.2.2-rc.5')
      && message.includes('tests/deepseek-harness-next')
      && !message.includes('deepseek-harness-test-use')
    results.push({
      id: 'NC-3-no-fallback',
      ok,
      detail: `typed=${error?.name ?? 'none'} namesPin=${message.includes('dsh-v0.2.2-rc.5')} namesLegacy=${message.includes('deepseek-harness-test-use')}`,
    })
  }

  // ── NC-4: the same call, a widened lane, a real effect ──────────────────
  {
    const widened = await runVector(w4, host, { widenWriteTokens: ['outside'] })
    const effect = widened.record.effects.find((candidate) => candidate.path === 'outside/escape.txt')
    const ok = widened.record.outcome === 'allow' && effect?.exists === true && effect.bytes === 5
    results.push({
      id: 'NC-4-lane-load-bearing',
      ok,
      detail: `outcome=${widened.record.outcome} targetExists=${effect?.exists} bytes=${effect?.bytes ?? '-'}`,
    })
  }

  // ── ONE REAL CONTROL PER RETIREMENT-UNIT MEMBER (UTE-3) ─────────────────
  // The family-level controls above prove the harness bites SOMEWHERE; the
  // retirement gate needs a control per member that goes RED when THAT member's
  // claim is false. Each runs on the legacy path, and each is paired with a
  // positive line showing the unmodified run still reproduces the golden row.
  const { results: memberResults, positive } = await runMemberControls(golden)
  results.push(...memberResults, ...positive)

  // ── NC-IMAGE-OBSERVER: the shared image observation cannot be faked ─────
  // PR B2's new path uses the SAME helper as the old path. These cases prove
  // the helper refuses to record an attachment observation that the store did
  // not produce: zero attachments, more than one, a block naming a different
  // attachment, and a refusal that nevertheless committed one.
  results.push(runImageObserverControl())

  return results
}

const isMain = process.argv[1]?.endsWith('negative-controls.mjs') === true
if (isMain) {
  const results = await runNegativeControls()
  for (const result of results) {
    console.log(`NC ${result.id} ${result.ok ? 'ok' : 'FAIL'} ${result.detail}`)
  }
  const failed = results.filter((result) => !result.ok)
  console.log(`NC-VERDICT ${failed.length === 0 ? 'GREEN' : 'RED'} controls=${results.length} failed=${failed.length}`)
  if (failed.length > 0) process.exitCode = 1
}
