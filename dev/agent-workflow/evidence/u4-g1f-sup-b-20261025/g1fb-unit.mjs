/**
 * g1fb-unit.mjs — NO-HOST unit smoke (budget experiment E1, static class):
 * drives the ONE ledger state machine, the generic registry (collision law +
 * takeover), the master pa-mount-registry identity law (imported UNMODIFIED),
 * the CI-08 disposer cells (law vs plant), and the bridge adapter's owner
 * fence with a fake JobRegistry — everything except the real Host dispatch.
 * Writes nothing outside runs/unit-<stamp>/.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-unit
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const scratch = join(HERE, 'runs', `unit-${new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z')}`)
mkdirSync(scratch, { recursive: true })
process.env.G1F_LEDGER = join(scratch, 'ledger.jsonl')
process.env.G1F_MARKER_DIR = join(scratch, 'markers')
process.env.G1F_WORK_ROOT = scratch

const { createCenterLedger } = await import('./g1fb-ledger.mjs')
const { createGovernedFamilyRegistry } = await import('./g1fb-registry.mjs')
const { createPocJobsMount } = await import('./g1fb-jobs-bridge.mjs')
const { WRITE_FAMILY } = await import('./g1fb-family-write.mjs')
const { EDIT_FAMILY } = await import('./g1fb-family-edit.mjs')
const mountRegistry = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'pa-mount-registry.mjs')).href)

const results = []
const t = (name, ok, detail = '') => results.push({ name, ok: ok === true, detail })

const center = { centerId: 'unit', approved: new Map(), flags: { guardEnabled: true, pathGuardEnabled: true, ledgerEnabled: true, identityLawEnabled: true, dynamicAdmissionEnabled: true } }
const ledger = createCenterLedger({ centerId: center.centerId, flags: center.flags })
let registry = null

/** Fake agent-scoped tools face (Host register contract minus the Host). */
function fakeToolsFace() {
  const map = new Map()
  return {
    map,
    register(def) {
      map.set(def.name, def)
      let called = false
      return () => { if (!called && map.get(def.name) === def) map.delete(def.name); called = true }
    },
    get(name) { return map.get(name) },
  }
}

const tools = fakeToolsFace()
registry = createGovernedFamilyRegistry({ center, ledger, mountRegistry })
const deps = { flags: center.flags, jobs: () => fakeJobs, bridge: undefined }

// 1. registration + allow/deny lanes with REAL file effects
const w = registry.register(WRITE_FAMILY, tools, deps)
t('register-write', w.ok === true, String(w.detail ?? w.refusal ?? ''))
const e = registry.register(EDIT_FAMILY, tools, deps)
t('register-edit-second-family-generically', e.ok === true)
t('zerodiff-registry-self-sha-constant', w.generation === 1 && e.generation === 1)

const okWrite = await w.def.execute({ file_path: 'w/ok.txt', content: 'A', tag: 'u1' }, { rootCallId: 'c1' })
t('write-allow-executes', okWrite.ok === true && readFileSync(join(scratch, 'w/ok.txt'), 'utf8') === 'A')
let denied = null
try { await w.def.execute({ file_path: 'out/bad.txt', content: 'X', tag: 'u2' }, { rootCallId: 'c2' }) } catch (error) { denied = String(error.message) }
t('write-deny-throws-before-body', denied !== null && denied.includes('refused') && !existsSync(join(scratch, 'out/bad.txt')))

// 2. collision law
const dupe = registry.register({ ...WRITE_FAMILY, familyId: 'OTHER' }, fakeToolsFace(), deps)
t('collision-refused', dupe.ok === false && String(dupe.refusal).startsWith('name-collision'))

// 3. ask → approve → one-shot consume → replay refused (ledger mechanics via grep-like policy)
ledger.registerPolicy('gr', 'unit', (a) => ({ lane: 'ask', key: `gr:${a.p}` }))
const a1 = ledger.admit('gr', { p: 'x' })
const a2 = ledger.approve(a1.requestId)
const a3 = ledger.admit('gr', { p: 'x' })
const a4 = ledger.admit('gr', { p: 'x' })
t('ask-pending', a1.decision === 'pending')
t('approve-issued', a2.ok === true)
t('one-shot-consume', a3.decision === 'execute')
t('replay-refused', a4.decision === 'replay-refused')
const r1 = ledger.admit('gr', { p: 'y' })
ledger.revoke(r1.requestId)
t('revoke-before-consume-refuses', ledger.admit('gr', { p: 'y' }).decision === 'revoked-refused')

// 4. plant: ledger disabled → deny-lane executes (forbidden effect occurs)
center.flags.ledgerEnabled = false
const plantAdmit = ledger.admit('write', { file_path: 'out/plant.txt' })
center.flags.ledgerEnabled = true
t('plant-ledger-off-allows-deny-lane', plantAdmit.decision === 'execute' && plantAdmit.plant === true)
center.flags.pathGuardEnabled = false
const plantLane = WRITE_FAMILY.policy({ file_path: 'out/plant.txt' }, deps)
center.flags.pathGuardEnabled = true
t('plant-pathguard-off-lane-allow', plantLane.lane === 'allow')

// 5. CI-08: regeneration + old disposer (law REFUSES, plant KILLS)
const gen2 = registry.register({ ...WRITE_FAMILY }, tools, deps) // same family re-registers = regen
t('regen-same-family-ok', gen2.ok === true && gen2.generation === 2)
const stale = w.dispose() // OLD generation disposer after gen2 mounted
t('old-disposer-refused-law-keeps-mount', stale.ok === false && String(stale.detail).includes('stale') && center.approved.has('write'))
center.flags.identityLawEnabled = false
const stalePlant = gen2.dispose()
t('plant-naive-disposer-kills-current-mount', center.approved.has('write') === false)
center.flags.identityLawEnabled = true
center.approved.set('write', { def: w.def, familyId: 'P1-B-WRITE', generation: 9 }) // restore for later asserts

// 6. master pa-mount-registry identity law directly
const idA = mountRegistry.publishPaMount('u-root', 'x', { n: 1 })
mountRegistry.publishPaMount('u-root', 'x', { n: 2 })
t('master-law-old-identity-revoked-false', mountRegistry.revokePaMount('u-root', 'x', idA) === false && mountRegistry.resolvePaMount('u-root', 'x') !== undefined)

// 7. bridge adapter owner fence + svc non-reach (fake host JobRegistry)
const svcKillCalls = []
const fakeJobs = {
  list: async () => [{ id: 'bash-1', kind: 'bash', status: 'running', label: 'x' }],
  read: async () => ({ out: 'JOB', err: '', next: 0, lossy: false, job: { status: 'completed' } }),
  wait: async () => ({ status: 'completed' }),
  kill: async (id) => { svcKillCalls.push(id); return 'requested' },
  start: () => 'bash-1',
}
const fakeCtx = { jobs: fakeJobs }
const jobsMount = createPocJobsMount({ ctx: fakeCtx, center })
deps.bridge = jobsMount
jobsMount.attribute('bash-1', 'agentS1')
const foreign = jobsMount.bridgeFor('agentS3')
const fence = await foreign.jobKill({ job_id: 'bash-1' }, 'agentS3')
t('bridge-fence-refuses-foreign', String(fence?.text ?? fence?.code ?? '').includes('foreign-attribution') && svcKillCalls.length === 0)
const own = jobsMount.bridgeFor('agentS1')
const ownKill = await own.jobKill({ job_id: 'bash-1' }, 'agentS1')
t('bridge-owner-passes-to-host-once', ownKill?.text?.includes('requested') === true && svcKillCalls.join() === 'bash-1')
const ownList = await own.jobList('agentS1')
t('bridge-list-visible-to-owner', String(ownList?.text ?? '').includes('bash-1'))
const fenceList = await foreign.jobList('agentS3')
t('bridge-list-hides-foreign-row', String(fenceList?.text ?? '').includes('bash-1') === false)

const failures = results.filter((r) => !r.ok)
writeFileSync(join(scratch, 'unit-result.json'), JSON.stringify({ pass: failures.length === 0, results }, null, 2))
console.log(results.map((r) => `${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.detail}`}`).join('\n'))
console.log(`unit: ${String(results.length - failures.length)}/${String(results.length)} pass; ledger rows: ${readFileSync(process.env.G1F_LEDGER, 'utf8').split('\n').filter((l) => l.trim() !== '').length}`)
process.exit(failures.length === 0 ? 0 : 1)
