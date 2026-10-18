#!/usr/bin/env node
/**
 * natexe solo-review 06:43Z ruling, leg ①: MEASURE the coarse-category
 * claims BEFORE the fix, three faces, per shape. No wording hedging: every
 * line below is either a measured value or a cited code location.
 */
import { createTeamToolPlaneAssembly, verifyPlaneNames, DEFAULT_PLANE_NAMES as D }
  from '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const LAUNCHER = path.resolve('packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const sha = createHash('sha256').update((await import('node:fs')).readFileSync(LAUNCHER)).digest('hex')
const trustRoot = `sha256:${sha.slice(0, 16)}#${LAUNCHER}`
const root = mkdtempSync(path.resolve('') + '/natexe-claim-')
writeFileSync(path.join(root, 'secret.txt'), 'TOP-SECRET-CONTENT\n')

const policy = { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [{ tool: 'bash', resource: { kind: 'any' } }], deny: [] }
const asm = (plane) => createTeamToolPlaneAssembly({
  permissionPolicy: policy, realmId: 'a5claim-probe', templateId: 'team.claim', role: 'member', instanceId: 'i-1',
  plane: { realmId: 'a5claim-probe', fsInstance: { fs: 'a5claim-ctl', rootDir: root, realmId: 'a5claim-probe', kind: 'absolute-path' }, confinedProvider: { trustRoot, assembly: { launcherPath: LAUNCHER, launcherSha256: sha, minAbiVersion: 3 } }, ...plane },
})

console.log('== FACE A (assembly / verifyPlaneNames) ==')
for (const [id, names, readName] of [
  ['readName=write', D, 'write'], ['readName=edit', D, 'edit'], ['readName=read_image', D, 'read_image'],
  ['readName=lsp', D, 'lsp'], ['names.bash=pwsh', { ...D, bash: 'pwsh' }, 'read'],
]) {
  const v = verifyPlaneNames(names, readName)
  console.log(`A ${id}: ${v.ok === true ? 'ACCEPTED' : `refused ${v.code}`}`)
}

console.log('== FACE B (schema/execution: what the host dispatches when it calls the misnamed row) ==')
{
  const built = asm({ readName: 'write' })
  if (built.ok !== true) { console.log('B readName=write: assembly REFUSED (post-fix expectation)', built.code) }
  else {
    const v = built.value
    const def = v.definitions.find((d) => d.name === 'write')
    console.log(`B ownNames=${JSON.stringify(v.ownNames)} — native host 'write' is MASKED by the placement (own layer wins)`)
    console.log(`B schema under 'write': params keys=${JSON.stringify(Object.keys(def.parameters.properties ?? {}))} (host 'write' takes a content face; this row declares ${JSON.stringify(Object.keys(def.parameters.properties ?? {}))})`)
    console.log(`B description under 'write': "${def.description.slice(0, 60)}..." — a READER answering as 'write'`)
    const out = await def.execute({ path: 'secret.txt' }, {})
    console.log(`B execute('write', {path}) -> read result: ${JSON.stringify(String(out?.text ?? out).slice(0, 40))} — zero bytes written, read semantics`)
    const feed = v.placementFeed('write')
    console.log(`B placementFeed('write') -> ${JSON.stringify(feed)} — the guard would VERIFY this reader as the 'write' placement and abstain`)
  }
}
{
  const built = asm({ names: { ...D, bash: 'pwsh' } })
  if (built.ok !== true) console.log('B names.bash=pwsh: assembly REFUSED (post-fix expectation)', built.code)
  else {
    const v = built.value
    const dec = v.decide({ effects: [{ kind: 'tool-invoke', toolName: 'pwsh', resource: { kind: 'any' } }] })
    console.log(`B bash row under 'pwsh': ownNames=${JSON.stringify(v.ownNames)}; lane judge of a 'pwsh' invoke = ${JSON.stringify(dec)} (the lane maps it to the BASH class while the durable exec-approval face speaks the PWSH exec token — two authority identities, one call)`)
  }
}

console.log('== FACE C (permission classification: class vs name) ==')
{
  const denyRead = createTeamToolPlaneAssembly({
    permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [{ tool: 'write', resource: { kind: 'exact', path: path.join(root, 'secret.txt') } }] },
    realmId: 'a5claim-probe', templateId: 'team.claim2', role: 'member', instanceId: 'i-2',
    plane: { realmId: 'a5claim-probe', readName: 'write', fsInstance: { fs: 'a5claim-ctl', rootDir: root, realmId: 'a5claim-probe', kind: 'absolute-path' }, confinedProvider: { trustRoot, assembly: { launcherPath: LAUNCHER, launcherSha256: sha, minAbiVersion: 3 } } },
  })
  if (denyRead.ok !== true) console.log('C readName=write: assembly REFUSED (post-fix expectation)', denyRead.code)
  else {
    const asRead = denyRead.value.decide({ effects: [{ kind: 'read', resource: { kind: 'exact', locator: 'secret.txt' } }] })
    console.log(`C plane lane judges the row's effect by CLASS kind='read' -> ${JSON.stringify(asRead)} (the {tool:'write'} deny rule misses: class-based)`)
    console.log('C_note: the durable permission-lifecycle face projects rules keyed by the DISPATCHED tool identity (packages/runtime/permission-lifecycle/decision-lane.ts:174-184 — operationClass derived from the dispatched name); the same reader is judged under the write-operation identity there while this plane lane judged the read CLASS above. One call, two verdict identities.')
  }
}
