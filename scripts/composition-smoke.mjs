#!/usr/bin/env node
/**
 * P1-T4 — empty-plugin composition smoke (plain node, no harness).
 *
 * Imports the BUILT host/client plugin entries and verifies the public Cordis
 * composition plugin shape:
 *
 *   1. the module namespace exports a stable non-empty string `name`
 *      (pinned to the expected plugin name);
 *   2. it exports `apply` as a function (Cordis Plugin.Object / Function
 *      contract: an object with a callable `apply`);
 *   3. optional plugin metadata (`inject`) is well-formed when present;
 *   4. `apply(minimalContext)` runs without throwing and registers no
 *      listeners, effects, or other side effects on a minimal structural
 *      context.
 *
 * This script is the fixture basis for the P1-T5 zero-core check: it proves
 * the skeleton plugin entries are loadable and side-effect-free without any
 * DSH process involved.
 *
 * Output: one PASS/FAIL line per target plus a final PASS/FAIL line.
 * Exit code: 0 on full PASS, 1 on any FAIL.
 *
 * Run: `pnpm smoke:composition` (or `node scripts/composition-smoke.mjs`)
 * from the repository root, after `pnpm build`.
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  {
    label: 'host plugin (packages/runtime)',
    rel: 'packages/runtime/dist/plugin/host.js',
    expectedName: 'dsh-agent-team',
  },
  {
    label: 'client plugin (packages/client)',
    rel: 'packages/client/dist/plugin/client.js',
    expectedName: 'dsh-agent-team-client',
  },
]

/**
 * Minimal structural Cordis plugin context: the skeleton `apply` may look up
 * services, subscribe, or register effects — and must not do any of it.
 */
function minimalContext() {
  const listeners = []
  const effects = []
  const ctx = {
    get: () => undefined,
    on: (event, _handler) => {
      listeners.push(event)
      return () => {}
    },
    effect: (disposer) => {
      effects.push(disposer)
    },
  }
  return { ctx, listeners, effects }
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
    const { ctx, listeners, effects } = minimalContext()
    const result = mod.apply(ctx)
    if (result !== undefined && typeof result.then === 'function') {
      await result
    }
    if (listeners.length !== 0) {
      throw new Error(`apply registered listeners: ${listeners.join(', ')}`)
    }
    if (effects.length !== 0) {
      throw new Error(`apply registered ${effects.length} effect(s)`)
    }
    console.log(`PASS ${target.label}: name="${mod.name}", apply is callable and side-effect-free`)
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
