#!/usr/bin/env node
/**
 * Composition smoke (plain node, no harness).
 *
 * Imports the BUILT host/client plugin entries and verifies the public
 * Cordis composition plugin shape and the fail-loud contract of the
 * production entries:
 *
 *   1. the module namespace exports a stable non-empty string `name`
 *      (pinned to the expected plugin name);
 *   2. it exports `apply` as a function (the Cordis plugin contract:
 *      a module whose named exports form the plugin object);
 *   3. optional plugin metadata (`inject`) is well-formed when present;
 *   4. applying to a degenerate structural-only context (no row config,
 *      no injected services) FAILS LOUDLY per the entry's documented
 *      contract — and subscribes to no events:
 *
 *      - host (`contract: "ready-rejection"`): `apply` RESOLVES — it
 *        provides the `teamRoot` facade synchronously (before the first
 *        await) and tracks every setup failure through the facade `ready`
 *        promise; `ready` must REJECT with the pinned typed code
 *        (`TeamPluginError`, `code === 'TEAM_PLUGIN_CONFIG_INVALID'` —
 *        plan §19.2: "a malformed composition must reject apply, not
 *        degrade");
 *      - client (`contract: "throw"`): `apply` THROWS — the mount
 *        dereferences the seam services it injects, so a degenerate
 *        context cannot mount silently.
 *
 * Check 4 is the production replacement for the P1-T4 skeleton
 * expectation "apply(minimalContext) runs side-effect-free": the entries
 * are real bootstraps now, and a degenerate apply can never succeed.
 * Fiber-tracked effects registered around a failed bootstrap are torn
 * down with the fiber in a real host, so this stub asserts listeners
 * only, not `effect` residue.
 *
 * The built client entry's module graph imports static assets (`.css` —
 * the linked upstream UI packages style with CSS modules); browsers and
 * bundlers give those files meaning, plain node has none of that
 * machinery. `./composition-smoke-assets-loader.mjs` (registered via
 * `module.register`) maps asset specifiers to an inert module so the
 * graph loads; component render functions never execute during import.
 *
 * This script is the fixture basis for the zero-core check: it proves the
 * built plugin entries are loadable, shape-valid, and fail-loud without
 * any DSH process involved.
 *
 * Output: one PASS/FAIL line per target plus a final PASS/FAIL line.
 * Exit code: 0 on full PASS, 1 on any FAIL.
 *
 * Run: `pnpm smoke:composition` (or `node scripts/composition-smoke.mjs`)
 * from the repository root, after `pnpm build`.
 */
import { register } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Asset specifiers in the client graph resolve to an inert module (see
// header); must be registered before the first target import below.
register(new URL('./composition-smoke-assets-loader.mjs', import.meta.url))

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  {
    label: 'host plugin (packages/runtime)',
    rel: 'packages/runtime/dist/packages/runtime/src/plugin/host.js',
    expectedName: 'dsh-agent-team',
    contract: 'ready-rejection',
    // The documented fail-loud contract of validateTeamPluginConfig:
    // a degenerate (config-less) bootstrap rejects `ready` with this
    // typed code.
    expectCode: 'TEAM_PLUGIN_CONFIG_INVALID',
  },
  {
    label: 'client plugin (packages/client)',
    rel: 'packages/client/dist/packages/client/src/plugin/client.js',
    expectedName: 'dsh-agent-team-client',
    contract: 'throw',
  },
]

/**
 * Degenerate structural Cordis plugin context: exposes only the lookup,
 * subscription, effect-registration, and service-provision surface — no
 * row config, no injected services. A production `apply` must fail loud
 * against it.
 */
function minimalContext() {
  const listeners = []
  const effects = []
  const provided = new Map()
  const ctx = {
    get: () => undefined,
    on: (event, _handler) => {
      listeners.push(event)
      return () => {}
    },
    effect: (disposer) => {
      effects.push(disposer)
    },
    provide: (name, value) => {
      provided.set(name, value)
    },
  }
  return { ctx, listeners, effects, provided }
}

let failed = false

for (const target of targets) {
  const abs = join(repoRoot, target.rel)
  try {
    const mod = await import(pathToFileURL(abs).href)
    if (mod === null || typeof mod !== 'object') {
      throw new Error('module namespace missing')
    }
    if (typeof mod.name !== 'string' || mod.name.length === 0) {
      throw new Error('missing non-empty string export: name')
    }
    if (mod.name !== target.expectedName) {
      throw new Error(`name mismatch: got "${mod.name}", expected "${target.expectedName}"`)
    }
    if (typeof mod.apply !== 'function') {
      throw new Error('missing function export: apply')
    }
    if ('inject' in mod && !Array.isArray(mod.inject)) {
      throw new Error('optional metadata "inject" must be an array')
    }
    const { ctx, listeners, provided } = minimalContext()
    let applyFailure
    try {
      const result = mod.apply(ctx)
      if (result !== undefined && typeof result.then === 'function') {
        await result
      }
    } catch (error) {
      applyFailure = error
    }
    if (target.contract === 'ready-rejection') {
      if (applyFailure !== undefined) {
        throw new Error(
          `apply rejected where the entry contract expects a resolve (failures belong to the facade \`ready\` promise): ${
            applyFailure instanceof Error ? applyFailure.message : String(applyFailure)
          }`,
        )
      }
      const facade = provided.get('teamRoot')
      if (facade === undefined || typeof facade !== 'object') {
        throw new Error('apply provided no "teamRoot" service on the degenerate context')
      }
      if (typeof facade.ready?.then !== 'function') {
        throw new Error('the "teamRoot" facade carries no `ready` promise')
      }
      let readyFailure
      try {
        await facade.ready
      } catch (error) {
        readyFailure = error
      }
      if (readyFailure === undefined) {
        throw new Error('facade `ready` resolved; a degenerate apply must fail loud through `ready`')
      }
      const code = readyFailure instanceof Error ? readyFailure.code : undefined
      if (code !== target.expectCode) {
        throw new Error(
          `ready rejected without the pinned typed code: got ${String(code)}, expected "${target.expectCode}"`,
        )
      }
    } else {
      if (applyFailure === undefined) {
        throw new Error('apply on a degenerate context must fail loud, but it succeeded silently')
      }
    }
    if (listeners.length !== 0) {
      throw new Error(`apply subscribed to listeners before failing: ${listeners.join(', ')}`)
    }
    console.log(
      `PASS ${target.label}: name="${mod.name}", apply fails loud on degenerate context` +
        (target.contract === 'ready-rejection' ? ` (ready code=${target.expectCode})` : ''),
    )
  } catch (error) {
    failed = true
    console.log(`FAIL ${target.label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed) {
  console.log('FAIL composition-smoke')
  throw new Error('composition smoke failed')
}
console.log('PASS composition-smoke')
