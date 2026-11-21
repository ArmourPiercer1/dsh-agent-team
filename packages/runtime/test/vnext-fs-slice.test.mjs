/**
 * vnext-fs-slice.test.mjs — A1's vertical slice, on the REAL host tool runtime.
 *
 * THE CLAIM UNDER TEST, in the owner's terms: a member's native `read` must be served by THAT
 * member's provider, with no Team-authored tool body anywhere in the path. Everything below is
 * the pinned baseline's own code: the real `@deepseek-ai/dsh-tools` registry, the real
 * `@deepseek-ai/dsh-tool-fs` module (loaded from the pinned tree's built `lib/`), the real
 * `LocalFileSystem`, and Cordis' own scopes and isolation.
 *
 * WHAT EACH ASSERTION BUYS
 *   identity     the `read` the agent resolves is a DIFFERENT definition object from the one its
 *                preset scope installed — the mount took effect — while `execute` is the SAME
 *                FUNCTION SOURCE, which is what "the host's body, not a Team copy" means when a
 *                module builds a definition per apply(). A wrapper would fail the second check.
 *   inside       a path inside the member's ceiling reads, one provider call, correct bytes.
 *   outside      a path outside it is refused, and the refusal comes from the member's provider:
 *                its own counters show no successful read of that path, and the file's bytes
 *                never appear in the tool result.
 *   negative     the SAME world with the realm mount removed lets the outside read succeed. This
 *                is the control that makes the three assertions above falsifiable: if the arm
 *                could not fail, it would not be evidence.
 *
 * NOT PROVEN HERE, deliberately: approval, Stop, settlement, or any second member. Those are B.
 * This slice is one member, one face, one provider — the smallest thing that can be wrong.
 *
 * Run: node --test packages/runtime/test/vnext-fs-slice.test.mjs
 * Requires the pinned tree to be built (docs/TEST_METHODS.md §1).
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { hostNativeSpecs, mountHostModules } from '../src/plugin/vnext/realm-lane.mjs'
import { instrumentedFileSystemClass, loadFsContractSeams } from '../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

const IDENTITY = Object.freeze({
  teamId: 'team-vnext-slice',
  memberInstanceId: 'member-vnext-slice',
  templateId: 'worker',
  instanceGeneration: 1,
})

const lane = (allow) => Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })

/** Build one world. `mountRealm: false` is the negative control, not a second composition. */
async function buildWorld ({ mountRealm, dir }) {
  const seams = await loadFsContractSeams(REPO_ROOT)
  const { Context, ToolRuntime, SystemPrompt, LocalFileSystem, createScope, bindScopeParent, nativeToolModules, row } = seams

  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  const insideFile = join(inside, 'doc.txt')
  const outsideFile = join(outside, 'secret.txt')
  writeFileSync(insideFile, 'alpha beta\n', 'utf8')
  writeFileSync(outsideFile, 'SECRET-NOT-FOR-MEMBER\n', 'utf8')

  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  // The composition's provider: what a member would resolve if nothing confined it.
  await root.plugin(LocalFileSystem, { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 })

  // The PRESET topology: the standing scope installs the host's tool module. This is the
  // definition the member would inherit — the thing the realm mount must replace, not rename.
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)

  const agentKey = {
    session: {
      header: { cwd: inside },
      requestHeader: () => ({ config: { provider: 'mock-provider', model: 'mock-model' } }),
    },
    options: {},
  }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  const presetRead = root.get('tools').get('read', agentKey)

  const fsInstances = []
  let realm
  if (mountRealm) {
    const InstrumentedFs = instrumentedFileSystemClass(LocalFileSystem, fsInstances)
    realm = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: join(dir, 'guard-consult.jsonl') }),
      provider: () => ({
        compiledFor: () => ({
          members: [{
            identity: IDENTITY,
            policy: {
              ok: true,
              value: Object.freeze({
                memberIdentity: IDENTITY.memberInstanceId,
                templateId: IDENTITY.templateId,
                instanceGeneration: IDENTITY.instanceGeneration,
                revision: 'rev-vnext-slice',
                read: lane([inside]),
                write: lane([inside]),
                network: Object.freeze({ access: 'allow' }),
              }),
            },
            config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
          }],
          providerClass: InstrumentedFs,
        }),
      }),
      member: {
        sessionId: 'session-vnext-slice',
        instanceId: IDENTITY.memberInstanceId,
        teamRootSessionId: 'team-root-vnext-slice',
        templateId: IDENTITY.templateId,
      },
    })
    assert.notEqual(realm, undefined, 'the configured row must mount a realm')
    const specs = hostNativeSpecs([{
      url: '@deepseek-ai/dsh-tool-fs',
      module: nativeToolModules,
      // `read_image` is deliberately NOT declared: the pinned tool-fs registers it from a
      // deferred child that injects `attachments`, which this minimal world does not mount, so
      // the name is an ABSENT OPTIONAL CAPABILITY (mount.ts settle rule) rather than a missing
      // mount. Declaring it here would ask the lane to prove something this world cannot provide.
      expectedTools: ['read', 'write', 'edit'],
    }])
    await mountHostModules({ realm, root: agent.ctx, scope: agentKey, specs })
  }

  const dispatch = async (name, args, callId) => {
    const settled = await root.get('tools').execute({
      signal: new AbortController().signal,
      callId,
      name,
      arguments: args,
      agent: agentKey,
    })
    const text = Array.isArray(settled.content)
      ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
      : ''
    return { isError: settled.isError === true, text, errorMessage: settled.error?.message }
  }

  return {
    dir,
    inside,
    outside,
    insideFile,
    outsideFile,
    presetRead,
    resolvedRead: root.get('tools').get('read', agentKey),
    realm,
    fsInstances,
    dispatch,
    async dispose () {
      if (realm !== undefined) await realm.dispose()
      await root.dispose?.()
    },
  }
}

let dir
before(() => { dir = mkdtempSync(join(tmpdir(), 'vnext-fs-slice-')) })
after(() => { rmSync(dir, { recursive: true, force: true }) })

test('SLICE-1 — the member resolves the host module mounted on its own realm, by identity and by body', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'identity') })
  try {
    assert.notEqual(world.resolvedRead, undefined, 'the member must resolve `read`')
    assert.notEqual(world.resolvedRead, world.presetRead, 'the mount must CHANGE the definition the member resolves; an unchanged definition means the body would run on the inherited provider')
    // A module that builds a definition per apply() gives a different OBJECT per scope; the
    // BODY is what must be the host's. A Team wrapper would differ here even with the same name.
    assert.equal(
      String(world.resolvedRead.execute),
      String(world.presetRead.execute),
      'the mounted definition must be the host module\'s own body, not a Team-authored one',
    )
  } finally {
    await world.dispose()
  }
})

test('SLICE-2 — inside the ceiling the member read succeeds through its provider', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'inside') })
  try {
    assert.equal(statSync(world.insideFile).size, 11)
    const result = await world.dispatch('read', { file_path: world.insideFile }, 'slice-inside')
    assert.equal(result.isError, false, `an in-ceiling read must succeed: ${result.text}`)
    assert.match(result.text, /alpha beta/u)
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.readText + member.calls.streamText, 1, 'exactly one read reached the member provider')
  } finally {
    await world.dispose()
  }
})

test('SLICE-3 — outside the ceiling the member read is refused by ITS provider, and the bytes never arrive', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'outside') })
  try {
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'slice-outside')
    assert.equal(result.isError, true, `an out-of-ceiling read must fail: ${result.text}`)
    assert.doesNotMatch(result.text, /SECRET-NOT-FOR-MEMBER/u, 'the refusal must not carry the file it refused to read')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.readText, 0, 'the member provider must not have completed a buffered read of an out-of-ceiling path')
    // The refusal must come from the MEMBER'S OWN LANE, and it must refuse before the underlying
    // filesystem is touched at all: a refusal that read the file and then withheld it would be a
    // disclosure bug wearing a passing test.
    assert.match(String(result.errorMessage), /outside every allow subtree/u, `the refusal must name the member lane, not a caller above it: ${String(result.errorMessage)}`)
    assert.equal(member.calls.stat + member.calls.lstat + member.calls.readText + member.calls.streamText, 0, 'the confined provider must refuse BEFORE the real filesystem is reached')
    assert.ok(world.fsInstances.length >= 1, 'the confined provider instance is the only provider the member reached')
  } finally {
    await world.dispose()
  }
})

test('SLICE-5 — write: inside the ceiling the member writes through its provider, and the bytes land', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'write-inside') })
  try {
    const target = join(world.inside, 'written.txt')
    const result = await world.dispatch('write', { file_path: target, content: 'WRITTEN-BY-MEMBER\n' }, 'slice-write-inside')
    assert.equal(result.isError, false, `an in-ceiling write must succeed: ${result.text} ${String(result.errorMessage)}`)
    assert.equal(readFileSync(target, 'utf8'), 'WRITTEN-BY-MEMBER\n', 'the write must reach the member\'s filesystem')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText, 1, 'exactly one write reached the member provider')
  } finally {
    await world.dispose()
  }
})

test('SLICE-6 — write: outside the ceiling it is refused before the filesystem is touched', async () => {
  const world = await buildWorld({ mountRealm: true, dir: join(dir, 'write-outside') })
  try {
    const target = join(world.outside, 'forbidden.txt')
    const result = await world.dispatch('write', { file_path: target, content: 'ESCAPED\n' }, 'slice-write-outside')
    assert.equal(result.isError, true, `an out-of-ceiling write must fail: ${result.text}`)
    assert.match(String(result.errorMessage), /outside every allow subtree/u)
    assert.equal(existsSync(target), false, 'the refused write must not have created the file')
    const member = world.realm.installation.members[0].fs
    assert.equal(member.calls.writeText + member.calls.editText, 0, 'the member provider must not have been asked to write')
  } finally {
    await world.dispose()
  }
})

test('SLICE-4 — NEGATIVE CONTROL: without the realm mount the same outside read SUCCEEDS', async () => {
  const world = await buildWorld({ mountRealm: false, dir: join(dir, 'control') })
  try {
    assert.equal(world.resolvedRead, world.presetRead, 'with no mount the member resolves the preset definition')
    const result = await world.dispatch('read', { file_path: world.outsideFile }, 'control-outside')
    assert.equal(result.isError, false, `the control must be able to read what SLICE-3 refuses, or SLICE-3 proves nothing: ${result.text}`)
    assert.match(result.text, /SECRET-NOT-FOR-MEMBER/u)
  } finally {
    await world.dispose()
  }
})
