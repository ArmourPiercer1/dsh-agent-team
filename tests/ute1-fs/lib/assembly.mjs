/**
 * assembly.mjs — the REAL Team-Agent assembly of a bound FS tool, on rc.5.
 *
 * WHAT "REAL" MEANS HERE. This is not an isolate+plugin sketch written by a
 * test: it calls the same product entries the live Member setup calls —
 * `mountMemberA5sfRealm` and `attachA5sfNativeToolModules`
 * (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`) — with a compiled
 * realm answer whose `providerClass` is the UTE-1 product module. The realm
 * installs the confined provider on the agent's own isolated `fs` scope, the
 * attach re-mounts the host's own `@deepseek-ai/dsh-tool-fs` module into that
 * realm and verifies definition coverage. Dispatch then goes through the host's
 * own `ToolsService.execute` batch (`executeModelToolFixture`), for a real
 * session/agent created by the pinned host's agent-loop testkit.
 *
 * The Member CEILING is deliberately WIDE (the world root on both axes): this
 * suite measures the BINDING's lane, not the P1 compiler, and a narrow ceiling
 * would make the two refusals indistinguishable. The product guard still runs —
 * it is installed by `installMemberIoProviders` from the same compiled answer —
 * so the lane refusal observed here is provably the lane's and not a permission
 * decision made by this test.
 *
 * `withProviderClass: false` is the assembly-path negative control: the same
 * mount without the product module's class falls back to the base provider the
 * preset exposes, and the SAME out-of-lane write succeeds. That is what proves
 * the deny arm really measured the native binding.
 *
 * @module tests/ute1-fs/lib/assembly
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { register } from 'node:module'

import { hostToolExecutorSpecifier } from '../../next-host/host-executor.mjs'
import { loadNextHostSurface } from './host.mjs'
import { createNativeFsBindingScope } from '../../../packages/tools/src/native-fs-binding.ts'

/** Scratch root: inside the worktree (workspace-write), gitignored. */
export const ASSEMBLY_SCRATCH = join(process.cwd(), '.artifacts', 'tmp', 'ute1-fs-assembly')

let hooksRegistered = false
let rowModule

/** Register the repo's TS resolution hooks and load the product row once. */
async function productRow(repoRoot) {
  if (!hooksRegistered) {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    hooksRegistered = true
  }
  if (rowModule === undefined) {
    rowModule = await import(pathToFileURL(join(repoRoot, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')).href)
  }
  return rowModule
}

/** One frozen policy lane (`restricted` + allow roots). */
function policyLane(allow) {
  return Object.freeze({
    mode: 'restricted',
    allow: Object.freeze([...allow]),
    ask: Object.freeze([]),
    deny: Object.freeze([]),
  })
}

/**
 * Build one assembled Member world.
 *
 * @param {object} input
 * @param {string} input.repoRoot - worktree root.
 * @param {{read: readonly string[], write: readonly string[]}} input.lane - the binding lane tokens
 *   (`inside` / `outside`, resolved against the world root).
 * @param {string} input.generation - the pinned host generation.
 * @param {string} [input.label]
 * @param {boolean} [input.withProviderClass] - false = assembly fallback control.
 * @returns {Promise<object>} the world; always call `dispose()`.
 */
export async function makeAssembledMemberWorld({
  repoRoot,
  lane,
  generation,
  label = 'ute1',
  withProviderClass = true,
}) {
  const host = await loadNextHostSurface(repoRoot)
  if (host.generation !== generation) {
    throw new Error(`assembly: the pinned next host answers ${host.generation}, not ${generation}`)
  }
  const row = await productRow(repoRoot)
  mkdirSync(ASSEMBLY_SCRATCH, { recursive: true })
  const dir = mkdtempSync(join(ASSEMBLY_SCRATCH, `${label}-`))
  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })

  const facts = []
  const scope = createNativeFsBindingScope({
    id: `assembly-${label}`,
    generation: host.generation,
    lane: {
      read: lane.read.map((token) => join(dir, token)),
      write: lane.write.map((token) => join(dir, token)),
    },
    Base: host.LocalFileSystem,
    FsError: host.FsError,
    record: (fact) => facts.push(fact),
    label: `ute1-assembly-${label}`,
  })

  const ctx = new host.Context()
  let agent
  let realm
  try {
    await host.mountAgentLoopTestDependencies(ctx, { workingDirectory: true, tools: { mode: 'native' } })
    await ctx.plugin(host.observationPolicy)
    // The PRESET row the attach's surface check compares against (the real
    // composition mounts the host FS module before the realm shadows it).
    await ctx.plugin(host.toolFs, { applyPatch: false })
    const harness = await host.mountAgentLoopTestHarness(ctx)
    agent = await harness.create(host.SessionId(`ute1-${label}`), {}, { cwd: inside })

    const identity = Object.freeze({
      teamId: `team-${label}`,
      memberInstanceId: `member-${label}`,
      templateId: 'worker',
      instanceGeneration: 1,
    })
    const ceiling = Object.freeze({
      memberIdentity: identity.memberInstanceId,
      templateId: identity.templateId,
      instanceGeneration: identity.instanceGeneration,
      revision: `rev-${label}`,
      read: policyLane([dir]),
      write: policyLane([dir]),
      network: Object.freeze({ access: 'allow' }),
    })

    const evidencePath = join(dir, 'guard-consult.jsonl')
    realm = await row.mountMemberA5sfRealm({
      // ROUND 121: this is a bare `ToolRuntime` assembly on the pinned rc.5
      // host (no deployment bundle), so the composition names the host's own
      // executor module; rc.5 has no built-in dispatch to fall back on.
      hostToolExecutorSpecifier: hostToolExecutorSpecifier(process.cwd(), 'next'),
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: evidencePath }),
      provider: () => ({
        compiledFor: () => ({
          members: [{
            identity,
            policy: { ok: true, value: ceiling },
            config: { cwd: dir },
          }],
          ...(withProviderClass ? { providerClass: scope.providerClass } : {}),
        }),
      }),
      member: {
        sessionId: `session-${label}`,
        instanceId: identity.memberInstanceId,
        teamRootSessionId: `root-${label}`,
        templateId: identity.templateId,
      },
    })
    if (realm === undefined) throw new Error('assembly: the configured row must mount a realm')

    await row.attachA5sfNativeToolModules(
      realm,
      agent.ctx,
      row.a5sfRealmConfigOf({
        a5sfEvidencePath: evidencePath,
        // The HOST's own module, resolved from the pinned rc.5 tree. Declaring
        // `expectedTools` also keeps the row's FS shadow silent: this
        // composition owns the FS face, and a second copy would be a duplicate
        // registration, not a shadow.
        a5sfNativeToolModules: [{
          url: pathToFileURL(host.toolFsEntry).href,
          config: { applyPatch: false },
          expectedTools: ['read', 'write', 'edit'],
        }],
      }),
      agent,
    )

    const signal = new AbortController().signal
    const toolSet = await ctx.tools.resolve({
      agent,
      modelSelection: { provider: 'mock', model: 'mock' },
      signal,
    })

    let disposed = false
    return {
      host,
      row,
      dir,
      inside,
      outside,
      ctx,
      agent,
      agentCtx: agent.ctx,
      realm,
      scope,
      facts,
      toolSet,
      signal,
      providerClass: scope.providerClass,
      memberProvider: realm.installation.members[0].fs,
      nativeAttachRecord: realm.nativeAttachRecord,
      /** Dispatch one model-facing tool call through the host's real executor. */
      async dispatch(name, args) {
        const result = await host.executeModelToolFixture(ctx, {
          callId: `ute1-${label}-${name}-${Math.random().toString(16).slice(2)}`,
          name,
          arguments: args,
          signal,
          agent,
          toolSet,
        })
        const content = Array.isArray(result.content) ? result.content : []
        const text = content
          .map((part) => (part?.type === 'text' ? part.text : part?.type === 'image' ? '<image>' : ''))
          .join('')
        return {
          isError: result.isError === true,
          text: `${text}\n${result.error?.message ?? ''}`,
          code: result.error?.info?.code,
        }
      },
      async dispose() {
        if (disposed) return
        disposed = true
        // The binding scope closes FIRST so a call that races the teardown is
        // refused by name rather than hitting a torn-down service; then the
        // realm (which owns the native + provider fibers); then the root.
        await scope.dispose('assembly-world-disposed')
        if (realm !== undefined) await realm.dispose()
        await ctx.fiber.dispose()
        rmSync(dir, { recursive: true, force: true })
      },
    }
  } catch (error) {
    await scope.dispose('assembly-mount-failed')
    if (realm !== undefined) await realm.dispose().catch(() => undefined)
    await ctx.fiber.dispose().catch(() => undefined)
    rmSync(dir, { recursive: true, force: true })
    throw error
  }
}
