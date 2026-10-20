#!/usr/bin/env node
/* REAL-HOST RECEIPT @639ed01539 (machine check): runs the PINNED HOST's OWN
 * installed built code (tests/deepseek-harness-test-use/packages/jobs/
 * tool-jobs/lib/types/render.js - the §2-chain build output, the same bytes
 * the host ships) over the SAME mixed-channel / two-shape reads our governed
 * bridge was fed, side by side. The host lib import here is a RECEIPT
 * instrument only - our plugin never imports host internals at runtime.
 * Sanctioned divergence recorded in the output: the bridge presents the
 * spill SCOPED (file name only) where the host presents the absolute path -
 * the isolation law, asserted (host path absent from the bridge body). */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
// the pinned host tree: worktree-local clone when present, else the main
// checkout - both are the pristine 639ed01539 host (porcelain 0 verified).
const HERE = new URL('.', import.meta.url)
const CANDIDATES = [
  new URL('../../../../../tests/deepseek-harness-test-use/packages/jobs/tool-jobs/lib/types/render.js', HERE),
  new URL('../../../../../../../../../tests/deepseek-harness-test-use/packages/jobs/tool-jobs/lib/types/render.js', HERE),
]
const HOST_RENDER = CANDIDATES.find((u) => existsSync(u.pathname))
if (HOST_RENDER === undefined) { console.log('{\"check\":\"host-lib-found\",\"ok\":false}'); process.exit(1) }
const { renderModelDelta, statusLine, publicJob } = await import(HOST_RENDER.href)
// our side = the DIST MIRROR (the committed installed face - plain-node runnable,
// the same bytes a deployment loads; src .mjs carries workspace imports plain node cannot resolve)
const { createGovernedJobsBridge } = await import(new URL('../../../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs', import.meta.url).href)

const asm = { definitions: { register: () => {} }, checkManagementAccess: () => ({ ok: true, corded: false, record: null }) }
const mkBridge = (read) => createGovernedJobsBridge({
  scopeKey: 'receipt-realm',
  viewer: { rootSessionId: 'root-r', instanceId: 'inst-r' },
  gatewayRow: () => asm,
  planeRow: () => null,
  jobsService: () => ({ read: async () => read }),
})
const out = []
const check = (name, ok, detail) => { out.push(JSON.stringify({ check: name, ok, ...(detail === undefined ? {} : { detail }) })); if (!ok) { console.log(out.join('\n')); process.exit(1) } }

// ── mixed channel: host truth vs bridge body ─────────────────────────────
const chunks = [
  { at: 0, channel: 'stdout', text: 'hi\n' },
  { at: 3, channel: 'log', text: 'PRODUCER-NARRATION-42' },
  { at: 9, channel: 'stderr', text: 'bad\n' },
]
const jobRunning = { id: 'jb1', kind: 'bash', label: 'l', status: 'running', progress: 'step 2', startedAt: 0 }
const hostMixed = `${renderModelDelta(chunks, false, [])}\n${statusLine(publicJob(jobRunning))}`
const bridgeMixed = (await mkBridge({ chunks, lossy: false, job: jobRunning }).jobOutput({ job_id: 'jb1' }, 'agent-r')).text
check('mixed.host-sees-stderr', hostMixed.includes('[stderr]\nbad'))
check('mixed.host-NEVER-sees-log', !hostMixed.includes('PRODUCER-NARRATION-42'))
check('mixed.bridge-matches-host-on-narration', !bridgeMixed.includes('PRODUCER-NARRATION-42'))
check('mixed.bridge-matches-host-on-stdout-stderr', bridgeMixed.includes('hi\n') && bridgeMixed.includes('[stderr]\nbad'))
check('mixed.status-line-parity', hostMixed.includes('[status: running, step 2]') && bridgeMixed.includes('[status: running, step 2]'))

// ── gap/spill: host carries absolute paths; the bridge scopes them (law) ─
const spill = ['/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/a5p3-w/controlled/spill/job-1.log']
const hostGap = renderModelDelta([{ at: 5, channel: 'stdout', text: 'tail-bytes', gapBefore: true }], false, spill)
const bridgeGap = (await mkBridge({ chunks: [{ at: 5, channel: 'stdout', text: 'tail-bytes', gapBefore: true }], lossy: false, job: { ...jobRunning, output: { total: 4096, earliest: 5, spillPaths: spill } } }).jobOutput({ job_id: 'jb1' }, 'agent-r')).text
check('gap.host-names-dropped-output', hostGap.includes('[some output was dropped from memory; full output: '))
check('gap.bridge-names-dropped-output', bridgeGap.includes('[some output was dropped from memory; full output: '))
check('gap.bridge-scoped-no-host-path', !bridgeGap.includes('/srv/workspace') && bridgeGap.includes('job-1.log'), 'sanctioned divergence: scoped presentation')

// ── running-timedout vs finished-empty: BOTH host and bridge distinguish ─
const jobFinished = { id: 'jb1', kind: 'bash', label: 'l', status: 'completed', detail: 'exit 0', startedAt: 0, finishedAt: 7 }
const hostRunning = `${'(no new output)'}\n${statusLine(publicJob(jobRunning))}`
const hostFinished = `${'(no new output)'}\n${statusLine(publicJob(jobFinished))}`
const bridgeRunning = (await mkBridge({ chunks: [], lossy: false, job: jobRunning }).jobOutput({ job_id: 'jb1' }, 'agent-r')).text
const bridgeFinished = (await mkBridge({ chunks: [], lossy: false, result: '(job completed)', job: jobFinished }).jobOutput({ job_id: 'jb1' }, 'agent-r')).text
check('two-shapes.host-distinguishes', hostRunning !== hostFinished && hostRunning.includes('[status: running') && hostFinished.includes('[status: completed, exit 0]'))
check('two-shapes.bridge-distinguishes', bridgeRunning !== bridgeFinished && bridgeRunning.includes('[status: running') && bridgeFinished.includes('[status: completed, exit 0]') && bridgeFinished.includes('(job completed)'))
check('two-shapes.status-last-parity', bridgeFinished.endsWith(statusLine(publicJob(jobFinished))))
console.log(out.join('\n'))
console.log('RECEIPT-VERDICT all-checks-passed host=@639ed01539 built tool-jobs/lib/types/render.js')
