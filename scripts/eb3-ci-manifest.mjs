/**
 * eb3-ci-manifest.mjs — the ONE loader for dev/ci/eb3-ci-manifest.json.
 *
 * Dependency-free on purpose: the Required summary job grades `toJSON(needs)` with
 * this manifest, and that job must not need `pnpm install` to state a verdict (an
 * install failure there would be a red with no layer named). The workflow-YAML
 * checks that DO need a parser live in eb3-ci-required.mjs and re-export this.
 *
 * @module scripts/eb3-ci-manifest
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const MANIFEST_REL = 'dev/ci/eb3-ci-manifest.json'

export function loadManifest(root = ROOT) {
  const abs = join(root, MANIFEST_REL)
  if (!existsSync(abs)) throw new Error(`EB3 CI manifest absent: ${MANIFEST_REL}`)
  const m = JSON.parse(readFileSync(abs, 'utf8'))
  if (m.schema !== 'eb3-ci-manifest/1') throw new Error(`${MANIFEST_REL}: unknown schema ${String(m.schema)}`)
  if (!Array.isArray(m.layers) || m.layers.length === 0) throw new Error(`${MANIFEST_REL}: no layers declared`)
  if (m.aggregate === undefined) throw new Error(`${MANIFEST_REL}: no aggregate (summary) job declared`)
  const ids = m.layers.map((l) => l.id)
  if (new Set(ids).size !== ids.length) throw new Error(`${MANIFEST_REL}: duplicate layer id`)
  return m
}
