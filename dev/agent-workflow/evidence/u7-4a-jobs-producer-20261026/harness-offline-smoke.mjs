// Offline smoke for the U7-4a C2 harness (no host): config law, decide
// machines, judge totality/saturation. Run: node .artifacts/tmp/u74a-harness-smoke.mjs
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-4a'
const mod = await import(pathToFileURL(join(ROOT, 'tests/world-factory/lib/u74a-jobs-assembly.mjs')).href)
const { createU74aAssembly, makeU74aDecide, judgeU74a, U74A_MAIN_CASES, U74A_PLANT_CASES, U74A_PLANTED_JOB_ID } = mod

const home = join(ROOT, '.artifacts/tmp/u74a-smoke-home')
rmSync(home, { recursive: true, force: true })
mkdirSync(home, { recursive: true })

const main = createU74aAssembly({ repoRoot: ROOT, home, runStamp: 'smoke1', reportDir: home, plant: false })
const plant = createU74aAssembly({ repoRoot: ROOT, home, runStamp: 'smoke1p', reportDir: home, plant: true })
main.writePreBootFiles()
plant.writePreBootFiles()

// ── config law: the shipped patch carries the U7-4a keys ───────────────────
const cfg = main.teamRowConfig()
const plane = cfg.teamToolPlane
const checks = []
const ok = (name, cond) => { checks.push([name, cond === true]); if (cond !== true) console.log(`MISS: ${name}`) }
ok('main jobsEnabled', plane.jobsEnabled === true)
ok('main backgroundJobs', plane.backgroundJobs === true)
ok('main names bash', plane.names?.bash === 'bash')
ok('main confinedProvider', plane.confinedProvider?.assembly?.launcherSha256?.length === 64)
const planeP = plant.teamRowConfig().teamToolPlane
ok('plant backgroundJobs ABSENT', !('backgroundJobs' in planeP))
ok('plant names bash kept', planeP.names?.bash === 'bash')
ok('launcher file exists', readFileSync(main.LAUNCHER).length > 0)
ok('rows include probe row', main.teamRows().some((r) => String(r.name).includes('u74a-ctl-probe-host')))
ok('rows include production row', main.teamRows().some((r) => r.id === 'dsh-agent-team'))
main.writeMainBlueprint(['web_search'])
plant.writeMainBlueprint(['web_search'])
const bp = readFileSync(join(main.blueprintDir, 'main.yaml'), 'utf8')
ok('blueprint worker default ask', /default: ask/.test(bp))
ok('blueprint has foreign', /templateId: foreign/.test(bp))
ok('blueprint denies web', /web_search/.test(bp))

// ── decide machines (synthetic transcripts) ────────────────────────────────
const decide = makeU74aDecide({ assembly: main, plant: false })
const decideP = makeU74aDecide({ assembly: plant, plant: true })
const req = (messages) => ({ req: { body: { messages } } })
const user = (content) => ({ role: 'user', content })
const asstTool = (id, name, input) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name, input }] })
const toolResult = (id, text) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] }] })
const tokenOf = (tok) => `[team-work requestToken=${main.tokens(tok)}`

// bg lane: birth call, then DONE with the host id
const bg0 = decide(req([user(`${tokenOf('d-bg')}\n${main.markers.MK_BG}`)]))
ok('bg0 tool bash', bg0.kind !== 'text' && JSON.stringify(bg0).includes('"bash"'))
ok('bg0 background:true (governed closed grammar)', JSON.stringify(bg0).includes('"background":true')) && ok('bg0 no description key', !JSON.stringify(bg0).includes('u74a governed background birth'))
const bg1 = decide(req([
  user(`${tokenOf('d-bg')}\n${main.markers.MK_BG}`),
  asstTool('t1', 'bash', { command: main.cmds().bg }),
  toolResult('t1', 'bash · exit=not-observed\n> started background job bash-77 (governed: manage it with the job_list / job_output / job_kill trio)'),
]))
ok('bg1 DONE id', String(bg1.content ?? '').startsWith('U74A_BG_DONE id=bash-77'))

// killlive machine incl. the late follow-up
const klBase = [user(`${tokenOf('d-kl')}\n${main.markers.MK_KLLIVE}`)]
const kl = (extra = []) => decide(req([...klBase,
  asstTool('k0', 'bash', {}), toolResult('k0', 'started background job bash-90 (governed: …)'),
  ...extra]))
ok('kl ex1 -> job_kill', JSON.stringify(kl()).includes('job_kill'))
const kl1 = kl([asstTool('k1', 'job_kill', {}), toolResult('k1', 'requested cancellation of job bash-90')])
ok('kl ex2 -> job_output early', JSON.stringify(kl1).includes('job_output'))
const kl2 = kl([
  asstTool('k1', 'job_kill', {}), toolResult('k1', 'requested cancellation of job bash-90'),
  asstTool('k2', 'job_output', {}), toolResult('k2', `${main.claims.liveWarm}\n[status: cancelled]`),
])
ok('kl ex3 no-follow -> DONE', String(kl2.content ?? '').startsWith('U74A_KILLLIVE_DONE id=bash-90'))
const kl3 = decide(req([...klBase,
  asstTool('k0', 'bash', {}), toolResult('k0', 'started background job bash-90 (governed: …)'),
  asstTool('k1', 'job_kill', {}), toolResult('k1', 'requested cancellation of job bash-90'),
  asstTool('k2', 'job_output', {}), toolResult('k2', `${main.claims.liveWarm}\n[status: cancelled]`),
  user(main.markers.T_KLFOLLOW),
]))
ok('kl ex3 follow -> job_output late', JSON.stringify(kl3).includes('job_output'))

// out machine self-contained (boot-2 law: attribution is mount-scoped)
const out0 = decide(req([user(`${tokenOf('d-out')}\n${main.markers.MK_OUT}`)]))
ok('out0 own bash birth (background)', JSON.stringify(out0).includes('\"background\":true'))
const out1 = decide(req([
  user(`${tokenOf('d-out')}\n${main.markers.MK_OUT}`),
  asstTool('o0', 'bash', {}), toolResult('o0', 'started background job bash-88 (governed: …)'),
]))
ok('out1 wait:true read of own id', JSON.stringify(out1).includes('job_output') && JSON.stringify(out1).includes('bash-88') && JSON.stringify(out1).includes('wait'))

// leader machine first call = create member; title lane answered
const leader0 = decide(req([user(main.markers.MK_L1)]))
ok('leader0 create', JSON.stringify(leader0).includes('team_create_member'))
ok('title lane', JSON.stringify(decide(req([user('Generate the session title for this session')]))).includes('u74a assembly session'))
// plant bg refuses-honest DONE
const pbg = decideP(req([user(`${plant.tokens('d-bg') ? `[team-work requestToken=${plant.tokens('d-bg')}` : ''}\n${plant.markers.MK_BG}`)]))
ok('plant bg0 background:true', JSON.stringify(pbg).includes('"background":true'))

// ── judge: saturation digest must be ALL PASS; empty digest must NOT ──────
const c = main.claims
const outOk = `${c.bg}\n[status: exited(0)]`
const sat = {
  claims: c,
  kernelHits: {
    'a5g7: placement-feed rows=': { count: 3 }, 'job_output': { count: 5 },
    'a5bg: producer-mounted': { count: 1 },
    'a5-plane: mount-REFUSED': { count: 0 }, 'a5-plane: placement-REFUSED': { count: 0 },
    'PLANE_KERNEL_UNAVAILABLE': { count: 0 }, 'PLANE_JOBS_REGISTRATION_REFUSED': { count: 0 },
    'PLANE_PROCESS_REGISTRATION_REFUSED': { count: 0 },
  },
  attributedLog: ['a5bg: attributed hostJobId=bash-77 instance=inst-1 tool=bash', 'a5bg: attributed hostJobId=bash-78 instance=inst-2 tool=bash'],
  startedJobReceipts: 2,
  laneDone: { bg: true, out: true, list: true, killLive: true, killDone: true, foreignOut: true, foreignPlanted: true, leader: true, ctl: true },
  jobIds: ['bash-77'],
  bgReceipt: `started background job bash-77 (governed: …)`,
  outResult: outOk,
  listJobId: 'bash-78',
  listResult: 'bash-77 [bash] completed — u74a-bg\nbash-78 [bash] running — u74a-list',
  killLiveJobId: 'bash-78',
  killLiveKill: 'requested cancellation of job bash-78',
  killLiveOutEarly: `${c.liveWarm}\n[status: running]`,
  killLiveOutLate: '(no new output)\n[status: killed, u74a-kill-live; signal: ; u74a-kill-live]',
  killDoneJobId: 'bash-79',
  killDoneOutput: `${c.done}\n[status: exited(0)]`,
  killDoneKill: 'job bash-79 had already finished',
  foreignOut: 'job bash-77: refused: owner-mismatch — this viewer is not the job owner',
  foreignPlanted: `job ${U74A_PLANTED_JOB_ID}: refused: unattributed-job — this mount manages only jobs it created`,
  ctlResult: `${c.ctl}\nu74a-ctl-ran`,
  rootKernelMentions: 0,
  trioUses: 7,
  askRows: [{ requestId: 'r1', targetInstanceId: 'inst-1', resolutions: 1, ok: true }, { requestId: 'r2', targetInstanceId: 'inst-2', resolutions: 1, ok: true }],
  askResolutionsTotal: 2,
  trioControlRows: [],
  armingRows: [],
  memberIds: ['inst-1', 'inst-2', 'inst-3'],
  settle: { killLiveLines: 2, plantedLines: 0 },
}
const satVerdicts = judgeU74a(sat, true)
const satFails = satVerdicts.filter(([, v]) => v !== 'PASS')
ok(`judge saturated all-PASS (${satVerdicts.length} legs)`, satFails.length === 0)
for (const [id, v, det] of satFails) console.log(`  saturate FAIL ${id}: ${JSON.stringify(det).slice(0, 220)}`)
ok('main cases covered', U74A_MAIN_CASES.every((id) => satVerdicts.some(([x]) => x === id)) && satVerdicts.length === U74A_MAIN_CASES.length)
const emptyVerdicts = judgeU74a({}, true)
ok('judge empty digest not pass', emptyVerdicts.every(([, v]) => v === 'FAIL'))
const plantSat = { ...sat, plant: true, jobIds: [], startedJobReceipts: 0, attributedLog: [], bgReceipt: 'a5p5-refused kind=backend-failed code=background-not-supported detail=background spawn is not implemented by the confined-exec row (refused by name, never reinterpreted as a foreground run)', trioUses: 0, kernelHits: { ...sat.kernelHits, 'a5bg: producer-mounted': { count: 0 }, 'background-not-supported': { count: 1 } } }
const plantVerdicts = judgeU74a(plantSat, true)
const plantFails = plantVerdicts.filter(([, v]) => v !== 'PASS')
ok(`judge plant all-PASS (${plantVerdicts.length} legs)`, plantFails.length === 0)
for (const [id, v, det] of plantFails) console.log(`  plant FAIL ${id}: ${JSON.stringify(det).slice(0, 220)}`)
ok('plant cases covered', U74A_PLANT_CASES.every((id) => plantVerdicts.some(([x]) => x === id)))

const bad = checks.filter(([, v]) => !v).length
console.log(`\nSMOKE ${bad === 0 ? 'ALL PASS' : bad + ' FAIL'} — ${checks.length} checks`)
process.exit(bad === 0 ? 0 : 1)
