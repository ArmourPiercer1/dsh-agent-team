#!/usr/bin/env node
/**
 * recover-boot1.mjs — OFFLINE reconstruction of run-shv2-1.json (zero host
 * starts; rerunnable). The boot-1 phase itself SUCCEEDED (all governed legs
 * ran; see logs/<stamp>/instance-port3181.log), but the driver crashed with a
 * ReferenceError (`state.realm` in the real-home census line — fixed in
 * drive-shv2.mjs) AFTER capturing every artifact and BEFORE persisting the
 * record. Budget law forbids re-spawning start #1, so this script rebuilds
 * the RUN record from the surviving witnesses:
 *
 *   - capture-boot1/**      frozen boot-1 realm bytes (walked pre-crash)
 *   - logs/<stamp>/instance-port3181.log  host log: mount line, placement-feed,
 *                                         every RAN/refusal line
 *   - disk ledger + scopes  typed-OK witness: a REFUSED apply NEVER persists
 *                           (STATE_APPLY_REPLAY/refusals are zero-write), so a
 *                           committed scope record + its writes.jsonl line ARE
 *                           the typed-OK proof, runner-side
 *   - profile-patch-boot1.yml  the exact production row bytes (no testHomeGuard)
 *   - fresh second-consumer probes (negative laws, HOME derivation) rerun now
 *
 * HONEST LIMITS (disclosed, not laundered):
 *   - /proc/<pid>/environ of the boot-1 host was read in-memory and proven
 *     DSH_HOME-absent BEFORE the crash, but never persisted. The joint witness
 *     for boot-1's env is (a) the spawn-time assertion `!('DSH_HOME' in env)`
 *     that must pass for the spawn to happen at all, (b) the DISK-LOCATION LAW
 *     itself: resolveDshHome prefers $DSH_HOME over $HOME/.dsh — the realm
 *     landed under HOME/.dsh only because DSH_HOME was ABSENT in boot-1's
 *     actual child env, and (c) the byte-identical buildChildEnv manifest
 *     re-proven via /proc on boot-2 (same code path). Cases that would rest
 *     on the /proc witness ALONE are marked NOT_CAPTURED_BOOT1_JOINT, not
 *     PASS.
 *   - the clean-SIGTERM stop path was not exercised for boot-1 (the PID
 *     namespace teardown reaped the host when the crashed driver shell exited;
 *     port 3181 observed free). Boot-2 exercises SIGTERM + port-free cleanly.
 *
 * @module evidence/u7r3-shomev2-20261030/recover-boot1
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, lstatSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..')
const OPS = join(REPO, 'opshome')
const DSHH = join(OPS, '.dsh')
const EV = HERE
const LOGS = join(EV, 'logs')
const now = () => new Date().toISOString()
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const log = (m) => process.stdout.write(`[recover] ${now()} ${m}\n`)

const state = JSON.parse(readFileSync(join(EV, 'boot-state.json'), 'utf8'))
if (state.stamp === undefined) throw new Error('no stamp in boot-state.json')
const assemblyMod = await import(pathToFileURL(join(REPO, 'tests/world-factory/lib/u7astore-assembly.mjs')).href)
const storeMod = await import(pathToFileURL(join(REPO, 'packages/runtime/dist/packages/tools/agent-state-family/src/fs-state-store.mjs')).href)
const paths = await import(pathToFileURL(join(REPO, 'tests/paths.mjs')).href)
const assembly = assemblyMod.createU7AStoreAssembly({ repoRoot: REPO, home: DSHH, runStamp: state.stamp, reportDir: join(LOGS, state.stamp) })
const realmRoot = assembly.STORE_ROOT

function walk(root, rel = '') {
  const out = []
  let names = []
  try { names = readdirSync(join(root, rel)) } catch { return out }
  for (const n of names.sort()) {
    const r = rel === '' ? n : `${rel}/${n}`
    const st = lstatSync(join(root, r))
    if (st.isDirectory()) out.push(...walk(root, r))
    else if (st.isFile()) out.push({ rel: r, bytes: st.size, sha256: sha256(join(root, r)), mtime: st.mtime.toISOString() })
  }
  return out
}

const rec = {
  schema: 'u5-run-record/1',
  runId: `u7r3v2-shv2-1-${state.stamp}`,
  suite: 'u7r3-shv2',
  recovered: true,
  recoveredAt: now(),
  recoveryRca: 'drive-shv2.mjs boot1 threw ReferenceError (`state.realm` — variable only defined on the boot2 path) in the post-capture real-home census line; every artifact had already been captured. Fixed in drive-shv2.mjs. Start #1 was NOT re-spawned (budget law): this record is reconstructed OFFLINE from the surviving witnesses listed here.',
  startedAt: '2026-10-30T12:22:33.293Z (budget line)',
  selectedCases: [
    'shv2:environ-dsh-home-unset', 'shv2:environ-home-opshome', 'shv2:production-config',
    'shv2:store-mounted', 'shv2:state-under-opshome', 'shv2:member-write-leg-typed-ok',
    'shv2:leader-write-legs', 'shv2:real-home-untouched', 'shv2:locks-recorded',
    'shv2:negative-probes', 'shv2:stable-unchanged', 'shv2:leak-check',
  ],
}

// bindings (rebuilt from bytes on disk; identical code path to the spawn)
rec.bindings = {
  teamSha: '1d884efdb8839b0d6efedd969793c8ca3ef15c5b',
  hostSha: '639ed015397290b3745d163aafe02ffee4aa3f84',
  hostTree: join(REPO, 'tests/deepseek-harness-test-use'),
  leaseRoot: join(REPO, '.artifacts/tmp/port-leases'),
  leasedHost: 3181, leasedMock: 3491,
  opshome: OPS,
  hostDerivedHome: DSHH,
  planeConfigBytesWitness: {
    realmId: assembly.PLANE_REALM_ID ?? assembly.markers.MK_DISC.split('_').join('-'), // not authoritative; realm from disk below
    source: 'profile-patch-boot1.yml (written pre-spawn by the SAME code path boot2 reruns; the code THROWS if testHomeGuard survives the delete — the spawn happened, so the check passed)',
    patchFile: 'profile-patch-boot1.yml',
  },
  storeBaseRelativeToOpsHome: 'dsh/team-state/agent-state/' + readdirSync(join(DSHH, 'team-state', 'agent-state'))[0],
  bootBudget: 'pool C2, EXACTLY 2 starts; this is start #1 of 2 (host-start-budget.jsonl line 1)',
}
const realmOnDisk = readdirSync(join(DSHH, 'team-state', 'agent-state'))
if (realmOnDisk.length !== 1) throw new Error(`unexpected realm dirs: ${realmOnDisk.join(',')}`)
rec.bindings.planeConfigBytesWitness.realmId = realmOnDisk[0]
rec.bindings.realmId = realmOnDisk[0]

// env manifest (reconstructed; the spawn-time guard is part of the evidence)
rec.envManifest = {
  setKeys: ['HOME', 'DSH_CLIENT_COMMIT_HASH', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY(fake)'],
  homeValue: OPS,
  dshClientCommitHash: paths.CLIENT_COMMIT_HASH,
  dshHomeInChildEnv: false,
  note: 'buildChildEnv SCRUBS every DSH_* key and the spawn is GATED by if (DSH_HOME in env) throw — the host spawned, so the guard passed. /proc persistence was lost in the crash; boot-2 re-proves the identical manifest via /proc.',
  reconstructed: true,
}

// /proc witness — honest status
rec.environProof = {
  captured: false,
  status: 'NOT_CAPTURED_PERSISTED',
  inMemoryAtSpawn: 'procEnvironProof ran immediately after spawn (code path before any await that could pass a failure); the boot proceeded past it',
  jointWitnesses: [
    'spawn-gate: the phase throws BEFORE spawning if DSH_HOME is in the child env',
    'disk law: resolveDshHome = configured ?? $DSH_HOME ?? homedir()/.dsh — the realm under HOME/.dsh PROVES $DSH_HOME was absent in boot-1 env',
    'boot-2 /proc proof of the byte-identical buildChildEnv output (run-shv2-2.json)',
  ],
}

// host log witnesses (bounded excerpts; full log lives in logs/<stamp>/)
const logPath = join(LOGS, state.stamp, 'instance-port3181.log')
const logLines = readFileSync(logPath, 'utf8').split('\n')
const grepRe = (re) => logLines.filter((l) => re.test(l))
rec.hostLog = {
  path: `logs/${state.stamp}/instance-port3181.log`,
  bootMarker: grepRe(/^dsh web: /).map((l) => l.replace(/\?token=.*/, '?token=<redacted>')),
  mount: grepRe(/remote mount: MOUNTED/),
  storeLine: grepRe(/agent-state store=fs/),
  placement: grepRe(/placement-feed rows=/).map((l) => l.slice(0, 300)),
  ran: grepRe(/a5-agent-state:.*(RAN|state-refusal)/),
}
rec.hostLog.placementCreateGoal = rec.hostLog.placement.filter((l) => l.includes('create_goal'))

// disk = typed-OK witnesses (a refused apply never persists)
const disk = assembly.readStoreOnDisk()
rec.disk = disk
rec.realmTree = walk(realmRoot)
rec.locks = rec.realmTree.filter((f) => f.rel.startsWith('locks/'))
rec.appliedMarkers = rec.realmTree.filter((f) => f.rel.startsWith('applied/'))

// boot-1 frozen capture + crash-window identity (disk vs capture BEFORE boot2)
const capture = walk(join(EV, 'capture-boot1'))
rec.captureManifest = capture.map((f) => ({ ...f, mtime: undefined }))
const capByRel = new Map(capture.map((f) => [f.rel, f.sha256]))
const driftVsCapture = rec.realmTree.filter((f) => capByRel.get(f.rel) !== f.sha256)
rec.crashWindowIdentity = { captureFiles: capture.length, drift: driftByRel(driftVsCapture), verdict: driftVsCapture.length === 0 ? 'IDENTICAL' : 'DRIFT' }
function driftByRel(list) { return list.map((f) => ({ rel: f.rel, expected: capByRel.get(f.rel), actual: f.sha256 })) }

// team session ids from the log (runner-side)
const teamRoot = /scope=agent:(session-u7as-team-[a-z0-9-]+)/.exec(logLines.join('\n'))
rec.digest = {
  teamSessionId: teamRoot ? teamRoot[1] : null,
  lanes: { goalTurn: true, workerDone: 'witnessed via log (mock transcript lost with the crashed driver process)', leaderDone: 'same' },
  exchanges: [],
  exchangesNote: 'mock transcripts lived in the crashed driver process; write-leg typed-OK rests on the disk ledger (primary runner-side witness) + host-log RAN lines',
}

// negative legs (second consumers, rerun offline — no boot)
const { resolveAgentStateHome } = storeMod
const probes = []
const push = (name, r, expect) => probes.push({
  name, expect,
  got: r.ok === true ? { ok: true, home: r.home } : { ok: false, code: r.code, detail: String(r.detail).slice(0, 180) },
  matches: expect === 'ok' ? r.ok === true : r.code === expect,
})
push('relative-DSH_HOME/production-arm', resolveAgentStateHome({ env: { DSH_HOME: 'relative/path' }, testHomeGuard: false }), 'AGENT_STATE_STORE_HOME_INVALID')
push('nonexistent-DSH_HOME/production-arm', resolveAgentStateHome({ env: { DSH_HOME: join(OPS, 'definitely-not-there') }, testHomeGuard: false }), 'AGENT_STATE_STORE_HOME_INVALID')
push('unset-DSH_HOME/test-guard-true', resolveAgentStateHome({ env: {}, testHomeGuard: true }), 'AGENT_STATE_STORE_HOME_MISSING')
push('relative-DSH_HOME/test-guard-true', resolveAgentStateHome({ env: { DSH_HOME: 'relative/path' }, testHomeGuard: true }), 'AGENT_STATE_STORE_HOME_INVALID')
rec.negativeProbes = { at: now(), rerunOffline: true, law: 'same dist face the host mounted; independent second consumer; pure resolves, zero writes', probes }

// home derivation child probe (exact manifest shape)
const src = [
  `const m = await import(${JSON.stringify(pathToFileURL(join(REPO, 'packages/runtime/dist/packages/tools/agent-state-family/src/fs-state-store.mjs')).href)});`,
  `const hp = await import(${JSON.stringify(pathToFileURL(join(REPO, 'tests/deepseek-harness-test-use/packages/util/home-paths/lib/index.js')).href)}).catch(() => null);`,
  'const r = m.resolveAgentStateHome({ testHomeGuard: false });',
  'process.stdout.write(JSON.stringify({',
  '  storeLaw: r.ok === true ? { ok: true, home: r.home } : { ok: false, code: r.code },',
  '  upstreamResolveDshHome: hp?.resolveDshHome ? hp.resolveDshHome(undefined, process.env) : null,',
  '  envHome: process.env.HOME ?? null, hasDSH: "DSH_HOME" in process.env }));',
].join('\n')
const pr = spawnSync(process.execPath, ['--input-type=module', '-e', src], { env: { PATH: process.env.PATH, HOME: OPS }, encoding: 'utf8', timeout: 30_000 })
let parsed = null
try { parsed = JSON.parse(pr.stdout ?? '') } catch { /* null */ }
rec.homeSourceProbeBoot1 = { at: now(), spawnOk: pr.status === 0, parsed, note: 'child process under HOME=<opshome>, DSH_HOME absent by construction' }

// real-home census (baseline marker from preflight)
const touched = (() => {
  const r = spawnSync('find', ['/home/user/.dsh', '-maxdepth', '3', '-newer', join(EV, 'census-marker')], { encoding: 'utf8', timeout: 30_000 })
  const lines = (r.stdout ?? '').split('\n').filter((l) => l !== '')
  return { count: lines.length, paths: lines.slice(0, 30) }
})()
rec.realHomeCheck = {
  teamStateExists: existsSync('/home/user/.dsh/team-state'),
  touchedSinceBaseline: touched,
  laneRealmOrTeamStateAmongTouched: touched.paths.filter((p) => p.includes('team-state') || p.includes(rec.bindings.realmId)).length,
}
const st3080 = await fetch('http://127.0.0.1:3080/', { redirect: 'manual' }).then((r) => r.status).catch((e) => `ERR ${e.code}`)
rec.stablePostHoc = { at: now(), status: st3080, note: 'read-only probe NOW (post-crash); the :3080 pre/post pair is completed by boot-2' }
rec.stop = {
  cleanSigterm: false,
  observed: 'host process gone; port 3181 observed free (checked below)',
  leakPortFree: await (async () => {
    const net = await import('node:net')
    return new Promise((res) => {
      const s = net.createConnection({ host: '127.0.0.1', port: 3181 }, () => { s.destroy(); res(false) })
      s.on('error', () => { s.destroy(); res(true) })
      s.setTimeout(2000, () => { s.destroy(); res(true) })
    })
  })(),
  note: 'boot-1 host was reaped by the sandbox PID-namespace teardown when the crashed driver shell exited (DISCLOSED deviation; boot-2 exercises SIGTERM + waitForPortFree)',
}
rec.hostBasePost = (() => {
  const head = spawnSync('git', ['-C', rec.bindings.hostTree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const porcelain = spawnSync('git', ['-C', rec.bindings.hostTree, 'status', '--porcelain'], { encoding: 'utf8' }).stdout
  return { head, porcelainEmpty: porcelain === '', ok: head === rec.bindings.hostSha && porcelain === '' }
})()

// verdicts (honest three-state: PASS / FAIL / NOT_CAPTURED_*)
const V = {}
V['shv2:environ-dsh-home-unset'] = 'NOT_CAPTURED_PERSISTED_JOINT_WITNESS'
V['shv2:environ-home-opshome'] = 'NOT_CAPTURED_PERSISTED_JOINT_WITNESS'
const patchYaml = readFileSync(join(EV, 'profile-patch-boot1.yml'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n') // header prose mentions the key names; the LAW is in the YAML body
V['shv2:production-config'] = patchYaml.includes('agentStateEnabled: true') && !patchYaml.includes('testHomeGuard') ? 'PASS' : 'FAIL'
V['shv2:store-mounted'] = rec.hostLog.storeLine.length > 0 && rec.hostLog.placementCreateGoal.length > 0 ? 'PASS' : 'FAIL'
V['shv2:state-under-opshome'] = disk.rootExists === true && disk.realUnderHome === true ? 'PASS' : 'FAIL'
V['shv2:member-write-leg-typed-ok'] = (disk.writes ?? []).some((w) => w.op === 'todos/apply') && (disk.records ?? []).some((r) => Array.isArray(r.todos) && r.todos.some((t) => String(t.content).startsWith('U7AS_TODO_CLAIM'))) && rec.hostLog.ran.some((l) => l.includes('todo_write RAN')) ? 'PASS' : 'FAIL'
V['shv2:leader-write-legs'] = (disk.writes ?? []).filter((w) => w.op === 'goal/apply').length >= 2 && (disk.records ?? []).some((r) => r.goal !== null) && rec.hostLog.ran.some((l) => /create_goal RAN/.test(l)) && rec.hostLog.ran.some((l) => /update_goal RAN.*revision=2/.test(l)) ? 'PASS' : 'FAIL'
V['shv2:real-home-untouched'] = rec.realHomeCheck.teamStateExists === false && rec.realHomeCheck.laneRealmOrTeamStateAmongTouched === 0 ? 'PASS' : 'REVIEW'
V['shv2:locks-recorded'] = 'RECORDED'
V['shv2:negative-probes'] = probes.every((p) => p.matches) ? 'PASS' : 'FAIL'
V['shv2:stable-unchanged'] = st3080 === 401 ? 'PASS_POST_HOC_401' : 'REVIEW'
V['shv2:leak-check'] = rec.stop.leakPortFree === true && rec.hostBasePost.ok === true ? 'PASS_WITH_DISCLOSED_DEVIATION' : 'FAIL'
V['shv2:homeSource-derived-home-boot1'] = parsed?.storeLaw?.home ?? null
rec.verdict = V
rec.finishedAt = now()

writeFileSync(join(EV, 'run-shv2-1.json'), JSON.stringify(rec, null, 2) + '\n')
writeFileSync(join(EV, 'boot-state.json'), JSON.stringify({
  ...state,
  realm: rec.bindings.realmId,
  root: assembly.ROOT,
  create: assembly.CREATE_ROOT,
  boot1RunId: rec.runId,
}, null, 2) + '\n')
log(`recovered run-shv2-1.json; crashWindow=${rec.crashWindowIdentity.verdict} verdicts=${JSON.stringify(V)}`)
