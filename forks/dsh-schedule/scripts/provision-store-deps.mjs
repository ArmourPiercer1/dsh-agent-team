#!/usr/bin/env node
/**
 * provision-store-deps.mjs — the fork's dependency SUPPLY (root c925 CI
 * correction): every dependency the fork imports is DECLARED in this
 * package's package.json and supplied here from the EXISTING pnpm store
 * (node_modules/.pnpm) by symlink. ZERO installs, ZERO network, no global
 * hoisting, no ts-ignore, no hidden dynamic specifiers: the declared list
 * below is the same list package.json declares.
 *
 * Idempotent; verifies each resolved directory's package name + version
 * before linking (a wrong-version store hit is a hard refusal, never a
 * silent fallback).
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(here, '..')
const repoRoot = resolve(pkgRoot, '..', '..')
const storeRoot = join(repoRoot, 'node_modules', '.pnpm')

// DECLARED deps (mirrors package.json "dependencies" exactly — keep in sync;
// the spec below pins the two files against each other).
const DECLARED = [
  ['@deepseek-ai/cordis', '4.0.4'],
  ['@deepseek-ai/dsh-agent', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-api-session-controller', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-brand', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-invariants', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-llm', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-session', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-storage-domain', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-tools', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-typert-protocol', '0.2.0-rc.2'],
  ['@deepseek-ai/dsh-workspace', '0.2.0-rc.2'],
  ['@deepseek-ai/schemastery', '3.18.4'],
  ['@js-temporal/polyfill', '0.5.1'],
  ['zod', 'any'],
]

const encodeScope = (name) => name.replace('/', '+')
function findStoreDir (name, version) {
  const prefix = `${encodeScope(name)}@`
  const entries = readdirSync(storeRoot)
  const hits = entries
    .filter((entry) => entry.startsWith(prefix))
    .filter((entry) => version === 'any' || entry.slice(prefix.length).startsWith(`${version}_`) || entry.slice(prefix.length) === version || entry.slice(prefix.length).startsWith(`${version}(`))
    .sort()
  return hits[0]
}
let linked = 0
for (const [name, version] of DECLARED) {
  const dest = join(pkgRoot, 'node_modules', name)
  if (existsSync(dest)) {
    // already provisioned (or a real directory) — verify and keep
    const pj = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'))
    if (pj.name !== name) throw new Error(`provisioning refuses ${dest}: package.json name ${pj.name} !== ${name}`)
    linked += 1
    continue
  }
  let source = null
  if (version === 'any') {
    source = join(repoRoot, 'node_modules', name) // root-declared (zod)
  } else {
    const storeDir = findStoreDir(name, version)
    if (storeDir !== undefined) source = join(storeRoot, storeDir, 'node_modules', name)
  }
  if (source === null || !existsSync(source)) {
    throw new Error(`store supply FAILED for ${name}@${version}: not present in ${storeRoot} — declaring it without supply is a CI lie, provisioning STOPS`)
  }
  const pj = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
  if (pj.name !== name) throw new Error(`store hit ${source} answers name ${pj.name} !== ${name}`)
  if (version !== 'any' && pj.version !== version) throw new Error(`store hit ${source} answers version ${pj.version} !== ${version}`)
  mkdirSync(dirname(dest), { recursive: true })
  rmSync(dest, { force: true, recursive: true })
  symlinkSync(source, dest, 'dir')
  linked += 1
}
console.log(`provision-store-deps: ${linked}/${DECLARED.length} declared deps supplied from the existing store (zero installs)`)

function safeLstat (p) { try { return lstatSync(p) !== null } catch { return false } }
