#!/usr/bin/env node
/**
 * a5intr3-plane-mount-kit.mjs — this lane's OWN criteria over the FLIPPED plane mount.
 *
 * Derivation (recorded honestly): the ASSEMBLY base is the natexe live runner
 * (`../natexe/run-natexe-live.mjs`:382 `rowConfig` + :427 `cfg.teamToolPlane = planeCfg(...)`,
 * which is what proves the plane mounts on a real confined provider); the criteria SHAPE
 * is `../glue7/a5g7-live-kit.mjs`. Neither kit's criteria are reused or edited — the
 * criteria below belong to alpha5-int-r3.
 *
 * FACE THIS KIT RUNS (stated plainly so nobody over-reads it): it drives the PRODUCTION
 * mount function (`createTeamToolPlaneAssembly`) with a REAL confined provider/launcher,
 * so the rows really spawn confined rg/bash children — but it does NOT boot the host or
 * route through a member wire. The Team-entry/wire face remains the open item; the natexe
 * 26/26 run (E8.1 placement-feed carries `bash`) is the wire-side evidence that exists.
 *
 * Criteria:
 *   A1 read POS / A2 read NEG      real inside bytes in the NATIVE window shape; BOTH
 *                                  escaping shapes must THROW the named refusal, the
 *                                  outside secret never in the thrown text
 *   B1 search POS / B2 search NEG  inside hit line; BOTH escaping shapes recorded
 *                                  (absolute out-of-root path, relative `../outside`)
 *   C1 glob POS / C2 glob NEG      inside pattern really matches; cross-root shape is
 *                                  RECORDED as measured (zero-results vs named refusal vs
 *                                  other) — never bent to a wish
 *   D1 shell POS / D2 shell NEG    inside write lands (host-side verified); out-of-root
 *                                  write refused with no outside file appearing (E6.1 shape)
 *   E  non-team Δ=[]               with no plane configured every row is the typed shut
 *                                  face, executing changes nothing, listing hash identical
 *   F  homes=[]                    teardown leaves no a5intr3-kit-* world
 *   G  :3080 probe                 read-only GET before/after, answer unchanged
 *
 * Exit: 0 = all PASS, 2 = any FAIL, 1 = fatal.
 */
import { createHash } from 'node:crypto'
import {
  mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync, statSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
// The mount's PA durable attribution needs the REAL host TeamSession root (no
// synthetic `plane:<template>` identity is mounted), and this kit's policy is
// `default: 'ask'`, so every governed row is a requires-approval outcome that
// never runs its body without a Control leg. The leg is the established C1
// stand-in the runtime test tree already uses — it lands the kernel's own grant
// through `issueApprovedGrant(request, approval)`. Nothing is invented here and
// the mount guard is not bypassed; the world carries no dispatcher surface, so
// the row lane stays the rev.0/revision-1 law it always used in this fixture.
import { approvingControlLeg } from '../../../../../packages/runtime/test/a5-m1-control-legs.mjs'

const REPO = fileURLToPath(new URL('../../../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const STAMP = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)
const HOME_ROOT = join(REPO, 'tests/homes')
const WORLD = join(HOME_ROOT, `a5intr3-kit-${STAMP}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const REALM = `a5intr3-kit-${STAMP}`
const STABLE_URL = process.env.DSH_STABLE_URL ?? 'http://127.0.0.1:3080/'

const INSIDE_TOK = `A5INTR3-INSIDE-${STAMP}`
const OUTSIDE_SECRET = `A5INTR3-OUTSIDE-SECRET-${STAMP}`

const log = (m) => process.stdout.write(`${new Date().toISOString()} ${m}\n`)

export async function runKit() {
const criteria = []
let fatal = null
const check = (id, ok, detail) => {
  criteria.push({ id, ok: ok === true })
  log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`)
}
const shapeOf = (res) => String(res?.text ?? JSON.stringify(res ?? null)).replace(/\s+/g, ' ').slice(0, 200)

function listingHash(dir) {
  const walk = (d, acc) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p, acc)
      else acc.push(`${relative(dir, p)}:${statSync(p).size}`)
    }
    return acc
  }
  return createHash('sha256').update(walk(dir, []).join('\n')).digest('hex').slice(0, 16)
}

async function probeStable() {
  try {
    const r = await fetch(STABLE_URL, { method: 'GET', signal: AbortSignal.timeout(4000) })
    return `http-${r.status}`
  } catch (err) {
    return `unreachable-${String(err?.cause?.code ?? err?.name ?? 'err').slice(0, 24)}`
  }
}

try {
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'data', 'needle.txt'), `first line\n${INSIDE_TOK}\nlast line\n`)
  writeFileSync(join(ROOT_DIR, 'data', 'other.txt'), 'no token here\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), `${OUTSIDE_SECRET}\n`)

  const plane = await import(new URL('../../../../../packages/runtime/src/plugin/live/team-tool-plane.mjs', import.meta.url).href)
  const POLICY = Object.freeze({
    default: 'ask',
    allow: [{ tool: 'read', resource: { kind: 'any' } }],
    ask: [],
    deny: [],
  })
  const build = (extra = {}) => plane.createTeamToolPlaneAssembly({
    // THE PA durable attribution identity: the REAL host TeamSession root this
    // kit world stands for (same `a5intr3-kit-*` keying as REALM/instanceId —
    // never a synthetic `plane:<template>` stand-in, which the mount refuses).
    teamSessionId: `a5intr3-kit-session-${STAMP}`,
    permissionPolicy: POLICY,
    realmId: REALM,
    templateId: 'a5intr3-kit',
    role: 'member',
    instanceId: `a5intr3-kit-${STAMP}`,
    // `default: 'ask'` makes every governed row a requires-approval outcome;
    // without a Control leg the center pending-refuses and no body ever runs.
    controlLeg: approvingControlLeg(),
    onObserve: () => {},
    ...extra,
  })

  const stableBefore = await probeStable()
  const built = build({
    plane: {
      fsInstance: { fs: 'a5intr3-kit-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        // #337 closing round (review-B item 5 law): provider scratch is a LAW, not
        // an option — the provider refuses an absent/relative scratchRoot (the
        // plans/out/probe trees would land in the process cwd). A WORLD-sibling
        // (NOT under the governed ROOT_DIR: the row's own comment says parent-side
        // or every walk would see the scratch) inside the kit world the cleanup
        // below already deletes. The fourth keying of this family
        // (glue7 -> a5b3 -> globoff -> this kit), found by the nine-root census.
        scratchRoot: join(WORLD, 'scratch-kit'),
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
      // flip 3: the only matrix-ACCEPTED native claim for this lane
      names: { grep: 'team_grep', glob: 'team_glob', bash: 'bash' },
    },
  })
  if (built.ok !== true) throw new Error(`plane assembly refused: ${JSON.stringify(built)}`)
  const def = (name) => built.value.definitions.find((d) => d.name === name)
  log(`MOUNT definitions=[${built.value.definitions.map((d) => d.name).join(',')}] `
    + `backends=[glob:${built.value.backends.glob.backendId},search:${built.value.backends.search.backendId},shell:${built.value.backends.shell.backendId}]`)

  // A — read row (A5-READ-SLICE face: the def RESOLVES the native window
  // {lines:[{number,text}],offset,path,totalLines} and THROWS every refusal —
  // the throw transport is the slice law. Checked on the REAL shapes, not the
  // legacy {text} surface; criteria ids and count are unchanged.)
  const rPos = await def('read').execute({ file_path: 'data/needle.txt' })
  const a1Text = Array.isArray(rPos?.lines) ? rPos.lines.map((l) => String(l?.text ?? '')).join('\n') : ''
  check('A1 read POS', a1Text.includes(INSIDE_TOK), `inside bytes came back: ${shapeOf(rPos).slice(0, 80)}`)
  for (const target of ['../outside/secret.txt', join(OUTSIDE_DIR, 'secret.txt')]) {
    let a2ok = false
    let a2detail
    try {
      const rNeg = await def('read').execute({ file_path: target })
      a2detail = `target="${target}" -> EXPECTED A THROW, got: ${shapeOf(rNeg)}`
    } catch (err) {
      const errText = String(err?.message ?? err)
      a2ok = errText.length > 0
        && /UNSUPPORTED|DENIED|REFUS|ESC|INVALID|OUTSIDE|beneath|outside|schema/i.test(errText)
        && !errText.includes(OUTSIDE_SECRET)
      a2detail = `target="${target}" -> threw: ${errText.replace(/\s+/g, ' ').slice(0, 160)}`
    }
    check('A2 read NEG', a2ok, a2detail)
  }

  // B — search row (confined rg after flip 1)
  const sPos = await def('team_grep').execute({ pattern: INSIDE_TOK, path: '.', output_mode: 'content' })
  check('B1 search POS', String(sPos.text).includes(INSIDE_TOK), `hit line: ${shapeOf(sPos).slice(0, 100)}`)
  const sAbs = await def('team_grep').execute({ pattern: OUTSIDE_SECRET, path: OUTSIDE_DIR, output_mode: 'content' })
  check('B2a search NEG (absolute out-of-root)', !String(sAbs.text).includes(OUTSIDE_SECRET), `measured: ${shapeOf(sAbs)}`)
  const sRel = await def('team_grep').execute({ pattern: OUTSIDE_SECRET, path: '../outside', output_mode: 'content' })
  check('B2b search NEG (relative escaping locator)', !String(sRel.text).includes(OUTSIDE_SECRET), `measured: ${shapeOf(sRel)}`)

  // C — glob row, the flipped face
  const gPos = await def('team_glob').execute({ pattern: '*.txt' })
  check('C1 glob POS', /\.txt/.test(String(gPos.text)) && !/IO_POLICY_UNSUPPORTED|PENDING/.test(String(gPos.text)),
  `measured: ${shapeOf(gPos)}`)
  const gCross = await def('team_glob').execute({ pattern: '../outside/*' })
  const gCrossText = String(gCross.text ?? '')
  const gShape = /NO_MATCH|no match|0 (?:match|result)|empty|no files/i.test(gCrossText) ? 'ZERO-RESULTS'
    : /UNSUPPORTED|DENIED|REFUS|INVALID|OUTSIDE|beneath|outside|PENDING/i.test(gCrossText) ? 'NAMED-REFUSAL'
      : (gCrossText.trim() === '' ? 'EMPTY-TEXT' : 'OTHER')
  check('C2 glob NEG (cross-root pattern; shape RECORDED)', !gCrossText.includes(OUTSIDE_SECRET),
  `shape=${gShape} (recorded as measured, not bent): ${shapeOf(gCross)}`)
  const gAbs = await def('team_glob').execute({ pattern: '*', path: OUTSIDE_DIR })
  check('C2b glob NEG (absolute out-of-root path)', !String(gAbs.text).includes(OUTSIDE_SECRET), `measured: ${shapeOf(gAbs)}`)

  // D — shell row under the native `bash` name (flip 3)
  const insideFile = join(ROOT_DIR, 'shell-wrote.txt')
  const dPos = await def('bash').execute({ command: `printf '%s\n' SHELL-WROTE > '${insideFile}' && echo SHELL-WROTE` })
  check('D1 shell POS (inside write)', existsSync(insideFile),
  `host-side file=${existsSync(insideFile)}; wire: ${shapeOf(dPos).slice(0, 80)}`)
  const escapeFile = join(OUTSIDE_DIR, 'escaped.txt')
  const dNeg = await def('bash').execute({ command: `printf 'x' > '${escapeFile}' && echo ESCAPED` })
  check('D2 shell NEG (out-of-root write refused)', !existsSync(escapeFile),
  `outside file created=${existsSync(escapeFile)} (must be false); wire: ${shapeOf(dNeg).slice(0, 110)}`)

  // E — non-team control: no plane configured => typed shut everywhere and delta = []
  const bare = build()
  if (bare.ok !== true) throw new Error(`bare plane assembly refused: ${JSON.stringify(bare)}`)
  const shutIds = ['search', 'glob', 'shell'].map((k) => String(bare.value.backends[k].backendId))
  const before = listingHash(ROOT_DIR)
  for (const d of bare.value.definitions) {
    await d.execute({ pattern: INSIDE_TOK, file_path: 'data/needle.txt', command: 'true', path: '.' })
  }
  const after = listingHash(ROOT_DIR)
  check('E non-team delta=[]', shutIds.every((id) => id === 'a5-effect-face-pending') && before === after,
  `shut rows=[${shutIds.join(',')}] listing ${before} -> ${after}`)

  const stableAfter = await probeStable()
  check('G :3080 probe (read-only, unchanged)', stableBefore === stableAfter, `${stableBefore} -> ${stableAfter} (GET only)`)
} catch (err) {
  fatal = err
  log(`FATAL ${err?.stack ? String(err.stack).split('\n').slice(0, 4).join(' | ') : String(err)}`)
} finally {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
  const survivors = existsSync(HOME_ROOT) ? readdirSync(HOME_ROOT).filter((n) => n.startsWith('a5intr3-kit-')) : ['<no homes dir>']
  check('F homes=[]', survivors.length === 0, `surviving a5intr3-kit-* worlds: ${survivors.length}`)
}

  const failed = criteria.filter((c) => !c.ok)
  return { criteria, failed, fatal }
}

// Direct invocation (under a TS-aware loader) prints the criteria lines and exits 0/2/1;
// imported, it only exports runKit(). THE SUPPORTED PATH IN THIS ENVIRONMENT IS THE
// VITEST SHIM (`packages/runtime/test/a5intr3-kit-runner.test.ts`): bare `node` cannot
// resolve the production source graph this mounts, so `node <this file>` reaches the
// guard only after a loader-level failure — the round-12 review ⑤ point, stated here
// rather than claimed away.
const invokedDirectly = process.argv[1] !== undefined
  && process.argv[1].endsWith('a5intr3-plane-mount-kit.mjs')
if (invokedDirectly) {
  const { criteria, failed, fatal } = await runKit()
  log(fatal ? `KIT FATAL (criteria recorded: ${criteria.length})`
    : failed.length === 0 ? `ALL GREEN: ${criteria.length}/${criteria.length} criteria`
      : `RED: ${failed.length}/${criteria.length} failed -> ${failed.map((f) => f.id).join(', ')}`)
  process.exit(fatal ? 1 : failed.length === 0 ? 0 : 2)
}
