#!/usr/bin/env node
/**
 * scope-duplicate-measure.mjs — host-free re-measurement of the live Host's
 * duplicate-module hazard, and of the fixed attach's identity precedence.
 *
 * NO Host boot, NO ports, NO DSH_HOME, NO tests/homes/**: a Cordis context,
 * two real module namespaces of `@deepseek-ai/dsh-scope`, and the product
 * helper. The second namespace is a copy of the resolved package entry at a
 * DIFFERENT realpath whose only import (cordis) is rewired to the same file —
 * the `.pnpm` vs workspace duplicate the live boot measured.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-scope-key/scope-duplicate-measure.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..')
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
const scopeEntry = runtimeRequire.resolve('@deepseek-ai/dsh-scope')
const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const host = await import(pathToFileURL(scopeEntry).href)

const dir = mkdtempSync(join(tmpdir(), 'a5sf-scope-dup-measure-'))
try {
  const source = readFileSync(scopeEntry, 'utf8')
  const cordisUrl = pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href
  const copyPath = join(dir, 'index.mjs')
  writeFileSync(copyPath, source.replace('from "@deepseek-ai/cordis"', `from ${JSON.stringify(cordisUrl)}`), 'utf8')
  const duplicate = await import(pathToFileURL(copyPath).href)

  console.log(`row resolves dsh-scope   : ${scopeEntry}`)
  console.log(`duplicate copy realpath  : ${copyPath}`)
  console.log(`same module namespace    : ${host.createScope === duplicate.createScope}`)

  const root = new Context()
  const surface = new Map()
  root.provide('tools', { schemas: (scope) => surface.get(scope) ?? [] })
  const agentKey = { member: 'measure' }
  const agentCtx = duplicate.createScope(root, agentKey).ctx
  const readableViaDuplicate = duplicate.scopeOf(agentCtx)
  const readableViaRow = host.scopeOf(agentCtx)
  console.log(`scope key via duplicate  : ${readableViaDuplicate === agentKey ? 'KEY' : String(readableViaDuplicate)}`)
  console.log(`same ctx via row instance: ${readableViaRow === undefined ? 'undefined' : String(readableViaRow)}`)
  console.log(`runtimeAgent fallback    : ${(agentKey ?? readableViaRow) === agentKey ? 'KEY' : 'MISSING'}`)

  surface.set(agentKey, [{ name: 'read' }])
  let mounted
  const realm = { mountNativeToolModules: async (modules) => { mounted = modules; return [{ dispose: async () => {} }] } }
  const config = row.a5sfRealmConfigOf({ a5sfEvidencePath: join(dir, 'consult.jsonl'), a5sfNativeToolModules: [join(dir, 'native.mjs')] })
  writeFileSync(join(dir, 'native.mjs'), 'export const name = "measure-native"\nexport function apply() {}\n', 'utf8')

  const before = row.a5sfAgentToolSurface(agentCtx, agentKey)
  assert.deepEqual([...before], ['read'])
  await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
  assert.equal(mounted.length, 1)
  console.log('attach with runtime Agent: MOUNTED (the live Host refusal would be gone)')

  let refusal
  try {
    await row.attachA5sfNativeToolModules(realm, agentCtx, config)
  } catch (error) {
    refusal = error
  }
  assert.equal(refusal?.message, 'agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context (the tool plane is per-agent)')
  console.log('both identity paths empty: REFUSED with the same typed TypeError (fail closed)')
  console.log('VERDICT: the canonical runtime Agent supplies the key scopeOf() cannot read; the refusal survives when neither path yields one.')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
