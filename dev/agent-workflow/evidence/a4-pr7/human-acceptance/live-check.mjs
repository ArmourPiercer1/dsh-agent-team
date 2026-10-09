#!/usr/bin/env node
/**
 * live-check.mjs — optional third leg: prove the corrupt record reaches the
 * read plane THROUGH A BOOTED HOST, still without a browser.
 *
 * `verify-corrupt-world.mjs` proves it offline (storage layer + control
 * service + the s6 dispatcher). This script proves the same thing over the
 * channel the browser actually uses: it reads the world's launch marker
 * (`<world>/.accept-launch.json`, written by `boot.mjs`), authenticates with
 * its token, and posts three closed `/team-remote` reads:
 *
 *   team.listCorruptControlLegs (v9)  — the warning bar's own payload
 *   team.getProjection          (v1)  — the Team page's main read
 *   team.getLedgerPage          (v1)  — the ledger read plane
 *
 * The last two are the answer to a question the offline leg cannot fully
 * settle on a live host: does ONE refused approval record make the rest of the
 * Team unreadable? It does not — and this prints the proof next to the count.
 *
 * Read-only by construction: no method here writes, and none is reachable
 * without the world's own token.
 *
 * Usage:
 *   node live-check.mjs [--world <dir>] [--repo <dir>] [--expect-count <n>]
 *
 * Exit codes: 0 all three reads answered and the count matched; 1 the host is
 * unreachable / not authenticated; 2 a read refused or the count disagreed.
 *
 * @module dev/agent-workflow/evidence/a4-pr7/human-acceptance/live-check
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEFAULT_WORLD_NAME, REPO_ROOT, fail, parseArgs, resolveWorld, TEST_PORTS } from './world-seam.mjs'

const { opts } = parseArgs(process.argv.slice(2))
const REPO = resolve(opts.get('repo') ?? REPO_ROOT)
const WORLD = resolveWorld(REPO, opts.get('world'), DEFAULT_WORLD_NAME, '--world')
const EXPECT_COUNT = Number.parseInt(opts.get('expect-count') ?? '1', 10)

const say = (line) => process.stdout.write(`${line}\n`)
const json = (v) => JSON.stringify(v, null, 2)

if (!Number.isInteger(EXPECT_COUNT) || EXPECT_COUNT < 0) fail('--expect-count must be a non-negative integer.')

let launch
try {
  launch = JSON.parse(readFileSync(join(WORLD, '.accept-launch.json'), 'utf8'))
} catch {
  fail(`no launch marker at ${join(WORLD, '.accept-launch.json')} — boot this world first (RECIPE.md, the boot step).`)
}
const port = Number(launch?.port)
if (!TEST_PORTS.has(port)) fail(`the launch marker records port ${port}, outside the test family — refusing to talk to it.`)
const origin = `http://127.0.0.1:${port}`
const token = String(launch?.token ?? '')
if (token === '') fail('the launch marker carries no token.')

say(`origin       : ${origin}   (world ${WORLD})`)

let cookie = ''
{
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    fail(`authentication did not complete (status ${res.status}). Is the host for THIS world still running?`)
  }
  cookie = setCookie.split(';')[0]
}
say('auth         : ok')

async function remote(method, params, version) {
  const res = await fetch(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `a4w5-${Math.random().toString(36).slice(2, 8)}`,
      method,
      payload: { version, params },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const body = await res.json().catch(() => null)
  if (res.status !== 200) return { ok: false, why: `HTTP ${res.status}`, body }
  const result = body?.result
  if (result === undefined) return { ok: false, why: 'no result envelope', body }
  if (result.ok !== true) return { ok: false, why: 'typed refusal', body: result.error ?? result }
  return { ok: true, value: result.value }
}

/** The Team this world is about: recorded by the injector, never guessed here. */
function teamSessionIdOfWorld() {
  const markerPath = join(WORLD, '.a4-w5-corrupt-world.json')
  let marker
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'))
  } catch {
    fail(`no world marker at ${markerPath} — this world was not built by make-corrupt-world.mjs.`)
  }
  const root = marker?.rootSessionId
  if (typeof root !== 'string' || root === '') {
    fail(`the world marker records no rootSessionId (was the injection step ever run?).`)
  }
  return root
}

const team = teamSessionIdOfWorld()

let bad = 0

const corruption = await remote('team.listCorruptControlLegs', { teamSessionId: team }, 9)
say('')
say('── team.listCorruptControlLegs (contract v9) ──')
if (!corruption.ok) {
  say(`REFUSED: ${corruption.why}`)
  say(json(corruption.body))
  bad += 1
} else {
  const cell = corruption.value?.data?.corruption ?? corruption.value?.corruption
  say(json(cell ?? corruption.value))
  if (cell?.corruptCount !== EXPECT_COUNT) {
    say(`MISMATCH: corruptCount=${cell?.corruptCount} !== expected ${EXPECT_COUNT}`)
    bad += 1
  }
}

for (const [method, params, version] of [
  ['team.getProjection', { teamSessionId: team }, 1],
  ['team.getLedgerPage', { teamSessionId: team, limit: 500 }, 1],
]) {
  say('')
  say(`── ${method} (contract v${version}) — the rest of the Team must still read ──`)
  const res = await remote(method, params, version)
  if (!res.ok) {
    say(`REFUSED: ${res.why}`)
    say(json(res.body))
    bad += 1
    continue
  }
  const data = res.value?.data ?? res.value
  if (method === 'team.getLedgerPage') {
    // Measured shape: { entries, nextAfterSequence, total }.
    const entries = Array.isArray(data?.entries) ? data.entries : []
    say(`total=${data?.total ?? 'n/a'} served=${entries.length} nextAfterSequence=${data?.nextAfterSequence ?? 'n/a'}`)
    say(`by factType: ${json(entries.reduce((acc, e) => ({ ...acc, [e.factType]: (acc[e.factType] ?? 0) + 1 }), {}))}`)
    const damaged = entries.find((e) => e.factType === 'control-request-recorded')
    say(damaged === undefined
      ? 'the damaged row is NOT served on this route'
      : `the damaged row IS served on this route: ${json({
          sequence: damaged.sequence,
          factType: damaged.factType,
          payloadKeys: Object.keys(damaged.payload ?? {}),
        })}`)
    continue
  }
  // Measured shape: { projection: { teamSessionId, blueprint, generation, root, templates, members… } }.
  const projection = data?.projection ?? data
  say(`keys: ${Object.keys(projection ?? {}).join(', ')}`)
  say(json({
    teamSessionId: projection?.teamSessionId ?? null,
    generation: projection?.generation ?? null,
    blueprint: projection?.blueprint ?? null,
    members: Array.isArray(projection?.members)
      ? projection.members.map((m) => ({ instanceId: m.instanceId ?? null, state: m.state ?? m.lifecycle ?? null }))
      : null,
  }))
}

say('')
if (bad > 0) {
  say(`VERDICT: ${bad} problem(s) — see the refusals above.`)
  process.exit(2)
}
say(`VERDICT: PASS — the booted host serves corruptCount=${EXPECT_COUNT} and the other Team reads answer too.`)
