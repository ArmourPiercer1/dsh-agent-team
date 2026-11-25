/**
 * host-resolution-consistency.test.mjs — ONE selection authority, TWO adapters,
 * measured against each other.
 *
 * THE RULING THIS PINS (owner, 2026-11-25 review 20261125-2258). Node's ESM
 * resolve hook and Vite's resolver are different module systems; giving Vite an
 * adapter is not a second selection authority. But the two adapters must agree,
 * case by case, on:
 *
 *   1. the package specifier → subpath mapping chosen by the host's own
 *      `exports` (including `package.json` and an exported subpath);
 *   2. containment — the resolved file lives inside the selected host root;
 *   3. refusal — an unexported subpath and an unknown selector both refuse,
 *      typed, and NEVER fall back to the repo's rc.2 install;
 *   4. the per-selector host generation: `legacy` ⇒ 0.2.0-rc.2,
 *      `next` ⇒ 0.2.2-rc.5, on BOTH paths;
 *   5. the client population's source-preference path resolves into the SAME
 *      selected tree (no rc.2 source base under an rc.5 selector);
 *   6. the module actually loaded from the shared answer is inside the tree.
 *
 * HOW. Both measurements are the REAL adapter entry points, not a copy of
 * their rules: the Node side calls `resolve()` exported by
 * `scripts/run-tests-hooks.mjs` with a Team test file as the importer, and the
 * Vite side calls a real Vite server's `pluginContainer.resolveId()` with the
 * SAME plugin `vitest.config.ts` installs. Nothing here re-implements the
 * mapping; a divergence is a red.
 *
 * ENVIRONMENT. This suite needs a repo install (rc.2) AND the provisioned rc.5
 * tree, so it runs in the census lane after the repo build (leg `ute-vnext-a1`).
 * It sets `TEAM_TEST_HOST` only inside a try/finally around the Node hook call:
 * the hook consults the selector per call, and both modes are measured in one
 * process by construction, so no run-level env switch is needed.
 */
import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createViteServer } from 'vitest/node'

import { resolve as nodeHostResolve } from '../../scripts/run-tests-hooks.mjs'
import { createHostVitePlugin } from './host-vite-adapter.mjs'
import {
  HostSelectionError, createHostResolver, selectedHostPin, selectedHostResolveRoot, selectedHostTree, testHostMode,
} from './host-select.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TEAM_IMPORTER = join(REPO_ROOT, 'packages/runtime/test/vnext-fs-slice.test.mjs')
const MODES = ['legacy', 'next']

const real = (file) => realpathSync(file)
const teamRequire = createRequire(join(REPO_ROOT, 'packages/runtime/package.json'))
/** The runner's default (unredirected) resolution — the host's own `exports`. */
const defaultResolve = (spec) => teamRequire.resolve(spec)
const inside = (file, root) => {
  const target = real(file)
  const base = real(root)
  return target === base || target.startsWith(`${base}${sep}`)
}
const readVersion = (packageJsonPath) => JSON.parse(readFileSync(packageJsonPath, 'utf8')).version

/** The Node adapter's answer for one specifier, under one explicit selector. */
async function nodePath(spec, mode, onDecline) {
  const previous = process.env.TEAM_TEST_HOST
  process.env.TEAM_TEST_HOST = mode
  try {
    const answer = await nodeHostResolve(spec, { parentURL: pathToFileURL(TEAM_IMPORTER).href }, () => {
      if (onDecline !== undefined) return onDecline(spec)
      throw new Error(`the Node adapter declined ${spec}; the shared resolver must answer for a Team importer`)
    })
    return fileURLToPath(answer.url)
  } finally {
    if (previous === undefined) delete process.env.TEAM_TEST_HOST
    else process.env.TEAM_TEST_HOST = previous
  }
}

/** The Vite adapter's answer, through a REAL Vite server running the same plugin the configs install. */
async function withVite(mode, body) {
  const server = await createViteServer({
    configFile: false,
    root: REPO_ROOT,
    logLevel: 'silent',
    resolve: { preserveSymlinks: true },
    server: { middlewareMode: true, watch: null },
    plugins: [createHostVitePlugin({ repoRoot: REPO_ROOT, mode })],
  })
  try {
    return await body(server)
  } finally {
    await server.close()
  }
}

async function vitePath(server, spec) {
  const answer = await server.pluginContainer.resolveId(spec, TEAM_IMPORTER)
  assert.ok(answer !== null && answer !== undefined, `the Vite adapter must resolve ${spec}`)
  return fileURLToPath(answer.id.startsWith('file:') ? answer.id : pathToFileURL(answer.id).href)
}

for (const mode of MODES) {
  test(`[${mode}] Node and Vite agree on the package mapping, the subpath and containment`, async () => {
    const pin = selectedHostPin(REPO_ROOT, mode)
    const root = selectedHostResolveRoot(REPO_ROOT, mode)
    await withVite(mode, async (server) => {
      for (const spec of ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-tools/presentation', '@deepseek-ai/dsh-tools/package.json']) {
        const viaNode = await nodePath(spec, mode)
        const viaVite = await vitePath(server, spec)
        assert.equal(real(viaVite), real(viaNode), `[${mode}] ${spec}: the two adapters must resolve the SAME file`)
        assert.ok(inside(viaNode, root), `[${mode}] ${spec}: ${viaNode} escaped the selected host root ${root}`)
        assert.ok(inside(viaVite, root), `[${mode}] ${spec}: ${viaVite} escaped the selected host root ${root}`)
      }
      // The measured host GENERATION, not the environment's claim.
      const packageJson = await vitePath(server, '@deepseek-ai/dsh-tools/package.json')
      const measured = readVersion(packageJson)
      assert.equal(measured, pin.version, `[${mode}] the resolved host version must be the pin`)
      assert.equal(measured, mode === 'legacy' ? '0.2.0-rc.2' : '0.2.2-rc.5', `[${mode}] generation`)
    })
  })

  test(`[${mode}] the module the shared answer loads is inside the selected host tree`, async () => {
    const root = selectedHostResolveRoot(REPO_ROOT, mode)
    const entry = await nodePath('@deepseek-ai/dsh-scope', mode)
    assert.ok(inside(entry, root), `[${mode}] the loaded entry must be inside ${root}: ${entry}`)
    const loaded = await import(pathToFileURL(entry).href)
    assert.ok(Object.keys(loaded).length > 0, `[${mode}] the entry must actually evaluate`)
    // Same file through Vite, then evaluate the Vite-resolved URL too: the
    // "actually loaded" claim is about the adapter's answer, not a path guess.
    await withVite(mode, async (server) => {
      const viaVite = await vitePath(server, '@deepseek-ai/dsh-scope')
      assert.equal(real(viaVite), real(entry), `[${mode}] Vite must load the same file as Node`)
      assert.ok(inside(viaVite, root), `[${mode}] Vite loaded ${viaVite}, outside ${root}`)
      const viteLoaded = await import(pathToFileURL(viaVite).href)
      assert.ok(Object.keys(viteLoaded).length > 0, `[${mode}] the Vite-resolved entry must evaluate`)
    })
  })

  test(`[${mode}] an unexported subpath refuses on both paths (no source fallback, no rc.2 fallback)`, async () => {
    await withVite(mode, async (server) => {
      // Under `legacy` the adapter declines a miss and the runner's own
      // resolution answers — which must STILL refuse the unexported subpath.
      // Under `next` the adapter refuses typed. Either way: no source fallback.
      const viaNode = nodePath('@deepseek-ai/dsh-tools/not-an-exported-subpath', mode, defaultResolve)
      const viaVite = vitePath(server, '@deepseek-ai/dsh-tools/not-an-exported-subpath')
      const isExportsRefusal = (error) =>
        error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
        error instanceof HostSelectionError ||
        error?.name === 'NextHostMissingError' ||
        /not exported|not defined by "exports"/iu.test(String(error?.message ?? error))
      await assert.rejects(viaNode, isExportsRefusal, `[${mode}] Node must refuse the unexported subpath`)
      await assert.rejects(viaVite, isExportsRefusal, `[${mode}] Vite must refuse the unexported subpath`)
    })
  })

  test(`[${mode}] the client source-preference path resolves into the SAME selected tree`, () => {
    const resolver = createHostResolver(REPO_ROOT, mode)
    const tree = real(selectedHostTree(REPO_ROOT, mode))
    for (const spec of ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-client-ui-renderer/client']) {
      const answer = resolver.resolveSourceForImporter(spec)
      assert.ok(answer !== null, `[${mode}] ${spec} must resolve through the source path`)
      assert.ok(answer.file.endsWith('.ts') || answer.file.endsWith('.tsx'), `[${mode}] ${spec}: expected a TypeScript source, got ${answer.file}`)
      assert.ok(inside(answer.file, tree), `[${mode}] ${spec}: source ${answer.file} escaped ${tree}`)
    }
    assert.ok(resolver.hostTree === tree || real(resolver.hostTree) === tree)
  })

  test(`[${mode}] a host-internal importer is declined (the host answers for its own dependencies)`, async () => {
    const resolver = createHostResolver(REPO_ROOT, mode)
    // A REAL file inside the host root (the entry just resolved) is the importer.
    const internal = (await resolver.resolveForImporter('@deepseek-ai/dsh-scope', undefined))?.file
    assert.ok(typeof internal === 'string' && inside(internal, resolver.resolveRoot))
    assert.equal(resolver.resolveForImporter('@deepseek-ai/dsh-tools', internal), null)
    // The Vite plugin applies the same rule (its `resolveId` is what Vite
    // calls): undefined means "let the host's own resolution answer", never a
    // forced redirect of a host-internal import.
    const plugin = createHostVitePlugin({ repoRoot: REPO_ROOT, mode })
    assert.equal(plugin.resolveId('@deepseek-ai/dsh-tools', internal), undefined)
  })
}

test('an unknown selector is a TYPED refusal on both adapters, never a silent rc.2 fallback', async () => {
  assert.throws(
    () => testHostMode({ TEAM_TEST_HOST: 'rc2' }),
    (error) => error instanceof HostSelectionError && error.code === 'HOST_SELECTOR_UNKNOWN',
  )
  const previous = process.env.TEAM_TEST_HOST
  process.env.TEAM_TEST_HOST = 'rc2-typo'
  try {
    assert.throws(
      () => createHostVitePlugin({ repoRoot: REPO_ROOT }),
      (error) => error instanceof HostSelectionError && error.code === 'HOST_SELECTOR_UNKNOWN',
      'the Vite adapter must refuse at config load, not resolve the repo install',
    )
    await assert.rejects(
      nodeHostResolve('@deepseek-ai/dsh-tools', { parentURL: pathToFileURL(TEAM_IMPORTER).href }, () => {
        throw new Error('a bogus selector must never reach the default resolver')
      }),
      (error) => error instanceof HostSelectionError && error.code === 'HOST_SELECTOR_UNKNOWN',
      'the Node adapter must refuse, not fall back to rc.2',
    )
  } finally {
    if (previous === undefined) delete process.env.TEAM_TEST_HOST
    else process.env.TEAM_TEST_HOST = previous
  }
})

test('the two selectors pin DIFFERENT host generations (the matrix cannot be green by one host)', () => {
  const legacy = selectedHostPin(REPO_ROOT, 'legacy')
  const next = selectedHostPin(REPO_ROOT, 'next')
  assert.equal(legacy.version, '0.2.0-rc.2')
  assert.equal(next.version, '0.2.2-rc.5')
  assert.notEqual(real(legacy.tree), real(next.tree))
})
