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
 * THREE STATES, NOT TWO (A4-PR7 7.5). A step is reported `PASS`, `FAIL`,
 * or — when it cannot be executed here at all — `SKIP`, and `SKIP` names
 * what it skipped and why (plan ADR X12: "a gate step that cannot be run
 * is not a gate step"). Exactly one step qualifies today: the client
 * entry statically imports `@deepseek-ai/dsh-client-ui-primitives`, whose
 * published manifest declares no runtime dependencies at all while its
 * `lib/index.js` imports 23 bare packages; seventeen of them are not
 * installed in this workspace, and the production path externalizes that
 * specifier anyway (the host supplies it), so loading our tsc-ESM entry
 * from an empty workspace never tested our artifact. The classifier lives
 * in `./composition-smoke-closure.mjs` and it is deliberately
 * unsympathetic: `SKIP` requires the real import attempt to have failed on
 * a bare package that a file OUTSIDE this repo asked for, so a genuine
 * defect — an undeclared dependency of ours, a module-evaluation throw, a
 * dangling path in our own dist — still prints `FAIL` and exits non-zero.
 * The host-plugin step is not closure-gated and is unchanged.
 *
 * WHAT THE SKIP DOES NOT MUTE. A gate that stops checking has to be
 * replaced by a gate that checks, so step 3 verifies the COMPOSED client
 * artifact (`packages/client/composition-shim/`, the thing a real host
 * actually loads) entirely offline: its row registrations, its plugin
 * exports, its external-specifier set, its recorded manifest values, and
 * the glue/seam URLs the built host derives at runtime. See
 * `./composition-smoke-bundle.mjs`. That is also the honest limit of this
 * round: the client plugin's behaviour inside a real host — where the
 * upstream closure exists and `apply` can mount — is still the host-side
 * acceptance run (plan Task 7.6/7.7), not this script.
 *
 * Output: one PASS/FAIL/SKIP line per step plus a final summary line. The
 * bundle arms are additionally required by NAME (`REQUIRED_CHECK_IDS`): an
 * expected arm that is not reported is a FAIL line of its own, because a step
 * that stopped reporting would otherwise vanish into the summary.
 * Exit code: 0 with no FAIL (a SKIP is allowed), 1 on any FAIL.
 *
 * Run: `pnpm smoke:composition` (or `node scripts/composition-smoke.mjs`)
 * from the repository root, after `pnpm build`.
 */
import { existsSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { INSTALL_SURFACES } from './client-composition-surface.mjs'
import { PLACEMENTS } from './place-dist-glue.mjs'
import {
  classifyClosureStep,
  formatSkipDetail,
  scanModuleClosure,
} from './composition-smoke-closure.mjs'
import { checkCompositionSurface, checkSetDifferences } from './composition-smoke-bundle.mjs'

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
    // Closure-gated: this entry links upstream UI packages this workspace
    // cannot install (see the header). Its checks run whenever the closure
    // is available; otherwise the step says so by name.
    closureGate: true,
  },
]

/**
 * The closed set of host seam events a production `apply()` is allowed to
 * subscribe before (or while) it fails loud on a degenerate context: the C1
 * activation fence (`agent/created` awaited + `agent/disposed` rollback,
 * restart-recovery guide §4.1) and the 0.1.5+ remote-channel compatibility
 * seam (`internal/get`, the `webServer` property-read waterfall). Anything
 * outside this list is an undocumented side effect and fails the gate.
 */
const PRE_BOOTSTRAP_SEAM_EVENTS = Object.freeze(['agent/created', 'agent/disposed', 'internal/get'])

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

/**
 * The plugin-shape + fail-loud contract of a loaded entry. Throws on any
 * violation; the caller turns a throw into a FAIL line. Identical checks for
 * both entries, exactly as this script ran them before the skip arm existed.
 */
async function checkPluginContract(mod, target) {
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
  // Side-effect discipline on a degenerate context.
  //
  // The original assertion here was `listeners.length === 0` ("no listener
  // may be subscribed before failing loud"). It predates the C1 Team Session
  // Activation Fence (commit e951344b, restart-017rc1 round), which is a
  // frozen contract: the `agent/created` / `agent/disposed` activation
  // listeners must register at the VERY FRONT of `apply()` — before the
  // bootstrap's first await — because a Session resume can fire while the
  // Team bootstrap is still running (restart-recovery guide §4.1), and the
  // `internal/get` remote-channel compatibility seam registers in the same
  // pre-bootstrap region. Both registrations are gated solely by
  // `typeof ctx.on === 'function'` (no host-version input), so the newer
  // frozen design mandates exactly this small prefix of subscriptions.
  //
  // The assertion keeps its teeth through the CLOSED documented set: a
  // degenerate apply may subscribe ONLY these seam listeners, each at most
  // once — any other subscription (RPC channel mounts, projection wiring,
  // session plumbing, …) still fails this gate.
  const undocumented = listeners.filter((event) => !PRE_BOOTSTRAP_SEAM_EVENTS.includes(event))
  if (undocumented.length !== 0) {
    throw new Error(
      `apply subscribed to undocumented listeners before failing: ${undocumented.join(', ')} `
      + `(the only pre-bootstrap seam events the frozen design permits are ${PRE_BOOTSTRAP_SEAM_EVENTS.join(', ')})`,
    )
  }
  const duplicated = listeners.filter((event, index) => listeners.indexOf(event) !== index)
  if (duplicated.length !== 0) {
    throw new Error(`apply subscribed to seam listeners more than once: ${duplicated.join(', ')}`)
  }
}

let failed = false
const skipped = []

for (const target of targets) {
  const abs = join(repoRoot, target.rel)
  if (!target.closureGate) {
    try {
      const mod = await import(pathToFileURL(abs).href)
      await checkPluginContract(mod, target)
      console.log(
        `PASS ${target.label}: name="${mod.name}", apply fails loud on degenerate context` +
          (target.contract === 'ready-rejection' ? ` (ready code=${target.expectCode})` : ''),
      )
    } catch (error) {
      failed = true
      console.log(`FAIL ${target.label}: ${error instanceof Error ? error.message : String(error)}`)
    }
    continue
  }

  // Closure-gated step: scan, attempt the load, then classify. The load is
  // attempted even when the scan already knows the closure is incomplete —
  // the attempt is what proves the failure is the closure and not something
  // else wearing the same clothes.
  const entryExists = existsSync(abs)
  const closure = entryExists ? scanModuleClosure({ entryFile: abs, repoRoot }) : null
  let mod
  let loadError
  if (entryExists) {
    try {
      mod = await import(pathToFileURL(abs).href)
    } catch (error) {
      loadError = error
    }
  }
  const decision = classifyClosureStep({ entryExists, closure, loadError })
  if (decision.status === 'skip') {
    skipped.push(target.label)
    console.log(`SKIP ${target.label}: ${formatSkipDetail(decision.missing)}`)
    continue
  }
  if (decision.status === 'fail') {
    failed = true
    console.log(`FAIL ${target.label}: ${decision.why}`)
    continue
  }
  try {
    await checkPluginContract(mod, target)
    console.log(`PASS ${target.label}: name="${mod.name}", apply fails loud on degenerate context`)
  } catch (error) {
    failed = true
    console.log(`FAIL ${target.label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Step 3: the composed client artifact, checked offline. This step is the
// reason the client SKIP costs the gate nothing it ever had: it inspects the
// artifact a real host loads, with no upstream closure involved.
try {
  const hostEntry = join(repoRoot, targets[0].rel)
  const hostModule = existsSync(hostEntry) ? await import(pathToFileURL(hostEntry).href) : null
  const surface = await checkCompositionSurface({
    repoRoot,
    installSurfaces: INSTALL_SURFACES,
    hostEntryFile: hostEntry,
    hostModule,
    gluePlacementDist: PLACEMENTS[0]?.dist ?? null,
  })
  for (const check of surface.checks) {
    const label = `client bundle ${check.id} (packages/client/composition-shim)`
    if (check.ok) {
      console.log(`PASS ${label}: ${check.detail}`)
    } else {
      failed = true
      console.log(`FAIL ${label}: ${check.detail}`)
    }
  }
  // The arms a caller must SEE. Printing one line per returned check and
  // failing only on `ok === false` means an arm that is never returned is not
  // a red line, it is a missing line — and a missing line still ends in
  // `PASS composition-smoke`. Measured before this guard: dropping one arm
  // printed 8 PASS lines and exit 0; returning no arms at all printed 0 lines
  // and exit 0. The required set is named in `composition-smoke-bundle.mjs`,
  // by id, in both directions (a renamed arm fails as missing AND unexpected).
  const arms = checkSetDifferences(surface.checks)
  if (arms.missing.length > 0 || arms.unexpected.length > 0) {
    failed = true
    const parts = []
    if (arms.missing.length > 0) parts.push(`never reported [${arms.missing.join(', ')}]`)
    if (arms.unexpected.length > 0) parts.push(`reported but not required [${arms.unexpected.join(', ')}]`)
    console.log(
      `FAIL client bundle check-set (packages/client/composition-shim): ${parts.join('; ')} — `
      + 'an arm that stopped reporting is a closed gate, not a green one',
    )
  }
} catch (error) {
  failed = true
  console.log(`FAIL client bundle composition surface: ${error instanceof Error ? error.message : String(error)}`)
}

if (failed) {
  console.log('FAIL composition-smoke')
  throw new Error('composition smoke failed')
}
console.log(
  'PASS composition-smoke'
  + (skipped.length === 0
    ? ''
    : ` — ${skipped.length} step NOT RUN and NOT passed: ${skipped.join('; ')}. `
      + 'A skipped step is an unverified claim, not a green one.'),
)
