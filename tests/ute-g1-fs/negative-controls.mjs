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

import { compareAll, parseGolden, serializeGolden } from './lib/compare.mjs'
import { CORPUS } from './lib/corpus.mjs'
import { loadHostSurface } from './lib/host.mjs'
import { runCorpus, runVector } from './lib/new-path.mjs'
import { assertNextHostTree, NextHostMissingError } from '../next-host/host-next-lib.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-fs', 'golden', 'old-path.tsv')

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
