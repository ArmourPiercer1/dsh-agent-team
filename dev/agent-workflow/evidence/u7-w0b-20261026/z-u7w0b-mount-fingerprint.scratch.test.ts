// u7-w0b identity probe (scratch — the root vitest.config.ts EXCLUDES
// *.scratch.test.ts, CI never collects it). Mounts the governed plane of the
// tree named by FP_ROOT under a fixed config matrix and writes a canonical
// fingerprint of everything observable about each mount: placed names in
// order, row description/parameters, registered candidates (familyId,
// source/provider digests, claimed names, state, generation, origin), kernel
// ownership and bound-entry familyId over a fixed name list, diagnostics
// backend ids, and refusal codes/messages. Equal output on two trees =
// identical mount surface. Run (from the worktree root):
//   FP_ROOT=<tree> FP_OUT=<file> npx vitest run -c vitest.scratch.config.ts \
//     packages/runtime/test/z-u7w0b-mount-fingerprint.scratch.test.ts
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { it } from 'vitest'

it('fingerprint', async () => {
const root = process.env.FP_ROOT as string
const plane: any = await import(pathToFileURL(join(root, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
const bridgeMod: any = await import(pathToFileURL(join(root, 'packages/runtime/src/plugin/live/jobs-family-bridge.mjs')).href)
const leg = async () => ({ kind: 'approved' })
const REALM = 'fp-realm'
const fsInstance = { fs: 'fp-ctl', rootDir: '/fp-root', realmId: REALM, kind: 'absolute-path' }
const NAMES = ['read', 'write', 'edit', 'read_image', 'team_bash', 'bash', 'team_grep', 'team_glob', 'grep', 'glob', 'job_output', 'job_list', 'job_kill', 'nope']
const bridge = () => bridgeMod.createGovernedJobsBridge({ scopeKey: 'fp', viewer: { rootSessionId: 'fp-root', instanceId: 'fp-inst' }, gatewayRow: () => null, planeRow: () => null, jobsService: () => undefined })
const fakeBackend = (id) => ({ backendId: id, run: async () => ({ ok: false, failure: { class: 'denied', code: 'X', detail: 'x' } }), execCount: () => 0, lastStageTrace: [] })
const matrix = {
  default: {},
  noFs: { plane: { fsInstance: null } },
  globOff: { plane: { fsInstance, globEnabled: false } },
  globBad: { plane: { fsInstance, globEnabled: 'yes' } },
  globOn: { plane: { fsInstance, globEnabled: true } },
  renamed: { plane: { fsInstance, names: { grep: 'my_grep', glob: 'my_glob', bash: 'bash' } } },
  jobsNoBridge: { plane: { fsInstance, jobsEnabled: true } },
  jobsBridge: { plane: { fsInstance, jobsEnabled: true }, backends: { jobs: bridge() } },
  jobsBad: { plane: { fsInstance, jobsEnabled: 1 } },
  injectedSearch: { plane: { fsInstance }, backends: { search: fakeBackend('kit-search') } },
  injectedGlobOff: { plane: { fsInstance, globEnabled: false }, backends: { search: fakeBackend('kit-search'), glob: fakeBackend('kit-glob') } },
  noLifecycle: { plane: { fsInstance }, dropLifecycle: true },
}
const out: Record<string, unknown> = {}
for (const [k, over] of Object.entries(matrix) as [string, any][]) {
  const input: Record<string, any> = {
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'fp-root', controlLeg: leg,
    permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [] },
    realmId: REALM, templateId: 'fp-tpl', role: 'member', instanceId: 'fp-inst', onObserve: () => {},
    plane: { fsInstance, ...(over.plane ?? {}) },
    ...(over.backends ? { backends: over.backends } : {}),
  }
  if (over.dropLifecycle) delete input.dispatcherLifecycle
  const built = plane.createTeamToolPlaneAssembly(input)
  if (built.ok !== true) { out[k] = { refused: built.code, message: built.message }; continue }
  const v = built.value
  const ck = v.centerKernel
  const rec = {
    placed: v.definitions.map((d: any) => d.name),
    rows: v.definitions.map((d: any) => ({ name: d.name, description: d.description, parameters: d.parameters, hasOutput: typeof d.output?.render === 'function' })),
    ownNames: v.ownNames,
    candidates: ck.registry.view().candidates.map((c: any) => ({ familyId: c.familyId, state: c.state, origin: c.origin, gen: c.registeredGeneration, src: c.contribution.source.digest, prov: c.contribution.provider.digest, names: c.contribution.visibility.nativeNames, caps: c.contribution.requiredCapabilities })),
    familyIds: ck.familyIds,
    owns: Object.fromEntries(NAMES.map((n: string) => [n, v.kernelGuard.owns(n)])),
    bound: Object.fromEntries(NAMES.map((n: string) => { v.placementFeed(n); const e = ck.kernel.approvalFor(ck.scopeKey, n); return [n, e ? e.familyId : null] })),
    backends: Object.fromEntries(Object.entries(v.backends).map(([n, b]: [string, any]) => [n, String(b?.backendId ?? typeof b)])),
    hasHandoff: v.paReadHandoff !== undefined,
  }
  out[k] = rec
}
const text = JSON.stringify(out, null, 1)
writeFileSync(process.env.FP_OUT as string, `${text}\nFINGERPRINT ${createHash('sha256').update(text).digest('hex')}\n`)
})
