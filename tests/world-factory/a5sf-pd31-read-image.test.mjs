/**
 * tests/world-factory/a5sf-pd31-read-image.test.mjs — PD-31: the model route
 * gate that made `read_image` `UNMEASURED`, measured and satisfied through a
 * PUBLIC config seam.
 *
 * WHY THIS SUITE EXISTS. PD-24's ledger recorded `read_image` as the one
 * governed row whose live branch could not run: the test World pointed the Team
 * row at `deepseek-v4-flash`, which the pinned host catalog does not carry, so
 * `resolveModelInfo` answered `['text']` and the native tool's
 * `assertImageCapableRoute` refused with
 * `model "deepseek-v4-flash" does not declare image input`.
 *
 * This suite is HOST-FREE (no boot, no port, no DSH_HOME) and pins the SEAM the
 * live driver uses, so the live arm cannot be a story:
 *
 *   MODEL-SEAM    the pinned host catalog declares `deepseek-flash` with
 *                 `inputModalities: ['text','image']`; the shipped composition
 *                 ships `deepseek-v4-flash` (uncatalogued). The ONE public
 *                 `staticModel` config key is therefore sufficient to declare
 *                 image capability; no upstream source patch is involved.
 *   ROUTE-GATE    the pinned BUILT `tool-fs` artifact still refuses a text-only
 *                 route with the exact sentence the driver's mutation control
 *                 edits and restores; the mutation needle is anchored.
 *   FIXTURES      the driver's PNG fixtures are valid images and its over-limit
 *                 fixtures cross the store's OWN pinned laws (20 MiB / 8192 px /
 *                 64 Mpx), read from the pin rather than restated.
 *   PRESET        the shipped governed preset mounts the host `tool-fs` package
 *                 (where `read_image` comes from) and no Team fs-family plane,
 *                 which is why the LIVE surface is the native row.
 *   ARMS          the driver's arm/mutation matrix is closed: `A5SF_PD31_PIN=1`
 *                 selects the pre-fix (text-only) arm, and the two mutations
 *                 move the allow verdict in opposite, named directions.
 *
 * Run: node --test tests/world-factory/a5sf-pd31-read-image.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const require_ = createRequire(join(REPO, 'package.json'))
const HOST = process.env.A5SF_PD31_HOST_TREE ?? (() => {
  // A worktree has no pristine host checkout of its own: fall back to the main
  // checkout's tests/deepseek-harness-test-use, exactly as the driver does.
  const local = join(REPO, 'tests', 'deepseek-harness-test-use')
  const m = /^(.*)\/\.worktrees\/[^/]+$/u.exec(REPO)
  return existsSync(local) ? local : join(m?.[1] ?? REPO, 'tests', 'deepseek-harness-test-use')
})()

const COMPOSITION = join(REPO, 'cordis.patch.yml')
const DRIVER = join(REPO, 'tests', 'world-factory', 'drivers', 'a5sf-pd31-read-image', 'run-boot.mjs')
const PRESET_ID = 'a5sf-governed-member'
const IMAGE_CAPABLE_MODEL = 'deepseek-flash'
const TEXT_ONLY_MODEL = 'deepseek-v4-flash'

const driverText = readFileSync(DRIVER, 'utf8')

function shippedRows() {
  const YAML = require_('yaml')
  const raw = readFileSync(COMPOSITION, 'utf8')
  const evaluated = raw.replace(/!!js[ \t]+([^\n]+)/gu, () => 'null')
  const doc = YAML.parse(evaluated)
  const rows = []
  const visit = (list) => {
    for (const row of list ?? []) {
      if (Array.isArray(row?.insert)) { visit(row.insert); continue }
      rows.push(row)
    }
  }
  visit(doc)
  return rows
}

function presetPlugins() {
  const preset = shippedRows().find((row) => row?.config?.id === PRESET_ID)
  assert.notEqual(preset, undefined, `the shipped composition carries preset '${PRESET_ID}'`)
  const flatten = (list) => (list ?? []).flatMap((p) => (p?.group === true ? flatten(p.config) : [p]))
  return flatten(preset.config.plugins).map((p) => String(p.id))
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL-SEAM
// ─────────────────────────────────────────────────────────────────────────────
test('PD31-MODEL-SEAM: image capability is declarable through the public staticModel key, not an upstream patch', () => {
  const models = readFileSync(join(HOST, 'packages', 'llm', 'llm-deepseek', 'src', 'models.ts'), 'utf8')
  const entry = new RegExp(`id: '${IMAGE_CAPABLE_MODEL}'([\\s\\S]*?)\\}`, 'u').exec(models)
  assert.notEqual(entry, null, `the pinned catalog carries '${IMAGE_CAPABLE_MODEL}'`)
  assert.match(entry[1], /inputModalities:\s*\['text',\s*'image'\]/u, 'the catalog id DECLARES image input')

  const shipped = shippedRows().find((row) => row?.name === 'dsh-agent-team/host')
  assert.notEqual(shipped, undefined, 'the shipped composition carries the host row')
  assert.equal(shipped.config.staticModel.model, TEXT_ONLY_MODEL, 'the shipped row points at the uncatalogued text-only id')
  assert.equal(shipped.config.staticModel.provider, 'deepseek-official', 'the provider route is stable')

  assert.match(driverText, new RegExp(`const IMAGE_CAPABLE_MODEL = '${IMAGE_CAPABLE_MODEL}'`, 'u'),
    'the driver names the catalog id it declares')
  assert.match(driverText, /staticModel: \{ provider: MODEL_PROVIDER, model: MODEL_ID \}/u,
    'the driver moves ONLY the public staticModel key')
  assert.match(driverText, /NO upstream source is patched|No upstream source is patched/iu,
    'the driver discloses the zero-patch budget')
})

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE-GATE
// ─────────────────────────────────────────────────────────────────────────────
test('PD31-ROUTE-GATE: the pinned BUILT tool-fs still carries the capability gate, and the mutation needle is anchored', () => {
  const built = readFileSync(join(HOST, 'packages', 'fs', 'tool-fs', 'lib', 'index.js'), 'utf8')
  const sentence = 'does not declare image input; switch to an image-capable model to read images'
  assert.equal(built.includes(sentence), true, 'the built artifact still refuses a text-only route with the native sentence')
  const needleRe = /const GATE_NEEDLE = '(.+)'\n/u
  const needle = needleRe.exec(driverText)?.[1]
  assert.equal(typeof needle, 'string', 'the driver declares its mutation needle')
  // The needle is a single-quoted JS string with no embedded single quote.
  assert.equal(needle.includes("'"), false, 'the needle contains no single quote (it is a literal)')
  assert.equal(built.includes(needle), true, 'the needle is present verbatim in the pinned built artifact')
  // The FIRST mutation attempt edited this source artifact and changed nothing:
  // the Host resolves the bare specifier from the repo's INSTALLED tree. Pin the
  // real target so the control cannot silently miss again.
  const installed = readFileSync(require_.resolve('@deepseek-ai/dsh-tool-fs'), 'utf8')
  assert.equal(installed.includes(sentence), true, 'the resolved installed module carries the gate')
  assert.equal(installed.includes(needle), true, 'and the needle verbatim — the live control edits THIS file')
  assert.match(driverText, /createRequire\(join\(REPO_ROOT, 'package\.json'\)\)\.resolve\('@deepseek-ai\/dsh-tool-fs'\)/u, 'the driver resolves the module the Host actually loads')
  assert.match(driverText, /resolves the[\s\S]{0,40}bare specifier/u, 'the driver records why the source artifact was the wrong target')
  assert.match(driverText, /GATE_REPLACEMENT = 'void active;/, 'the mutation replaces the gate with an inert statement')
  assert.match(driverText, /if \(restoredSha !== beforeSha\) throw new Error/u, 'the driver refuses to pass unless the host artifact is restored byte-identically')
})

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES + STORE LAWS
// ─────────────────────────────────────────────────────────────────────────────
function hostLimit(name) {
  const src = readFileSync(join(HOST, 'packages', 'attachment', 'attachment-local', 'src', 'index.ts'), 'utf8')
  const m = new RegExp(`export const ${name} = ([0-9_ *]+)`, 'u').exec(src)
  assert.notEqual(m, null, `the pin exports ${name}`)
  // eslint-disable-next-line no-new-func
  return Number(new Function(`"use strict";return (${m[1]});`)())
}

test('PD31-FIXTURES: the over-limit fixtures cross the store\'s own pinned laws, and the driver reads those laws rather than restating them', () => {
  assert.equal(hostLimit('DEFAULT_MAX_IMAGE_BYTES'), 20 * 1024 * 1024, 'the store byte cap is 20 MiB')
  assert.equal(hostLimit('DEFAULT_MAX_IMAGE_DIMENSION'), 8192, 'the store per-side cap is 8192 px')
  assert.equal(hostLimit('DEFAULT_MAX_IMAGE_PIXELS'), 64_000_000, 'the store pixel cap is 64 Mpx')
  assert.equal(driverText.includes('const STORE_MAX_BYTES = 20 * 1024 * 1024'), true, 'the driver bytes law matches')
  assert.equal(driverText.includes('const STORE_MAX_DIMENSION = 8192'), true, 'the driver dimension law matches')
  assert.equal(driverText.includes('const BIG_DIM_WIDTH = 9000'), true, 'the over-dimension fixture crosses 8192 on one side')
  assert.equal(9000 <= 64_000_000, true, 'and stays inside the pixel law, so the refusal is the DIMENSION law')
  assert.match(driverText, /const b = Buffer\.alloc\(STORE_MAX_BYTES \+ 1, 0\)/u, 'the byte-cap fixture is exactly cap+1')
  assert.match(driverText, /deflateSync\(raw\)/u, 'the PNG fixtures are real zlib-compressed rasters, not stubs')
})

// ─────────────────────────────────────────────────────────────────────────────
// PRESET (why the live row is native)
// ─────────────────────────────────────────────────────────────────────────────
test('PD31-PRESET: the governed preset mounts the host tool-fs package and no Team fs-family plane, so the live read_image is the native row', () => {
  const plugins = presetPlugins()
  assert.equal(plugins.includes('tool-fs'), true, 'the preset mounts @deepseek-ai/dsh-tool-fs')
  assert.equal(plugins.some((id) => /fs-family|family-assembly/i.test(id)), false, 'no fs-family plane row is mounted')
  assert.equal(plugins.includes('tool-bash'), true, 'the positive control row is present')
  assert.equal(plugins.includes('tool-fs-search'), true, 'the search control row is present')
  const host = shippedRows().find((row) => row?.name === 'dsh-agent-team/host')
  assert.equal(host.config.teamToolPlane, undefined, 'the host row carries no teamToolPlane in the shipped layer')
})

// ─────────────────────────────────────────────────────────────────────────────
// ARMS
// ─────────────────────────────────────────────────────────────────────────────
test('PD31-ARMS: the pin selects the text-only arm and the two mutations move the allow verdict in named, opposite directions', () => {
  assert.match(driverText, /process\.env\.A5SF_PD31_PIN === '1' \? 'prefix' : 'postfix'/u, 'A5SF_PD31_PIN=1 selects the pre-fix arm')
  assert.match(driverText, /value !== 'model-text' && value !== 'route-gate-off'/u, 'the mutation vocabulary is closed to the two controls')
  assert.match(driverText, /MUTATION === 'route-gate-off' \? 'served' : 'refused'/u, 'route-gate-off expects the allow arm SERVED; model-text expects it REFUSED')
  assert.match(driverText, /ARM === 'prefix' \|\| MUTATION === 'model-text' \|\| MUTATION === 'route-gate-off'/u, 'every non-normal arm carries the text-only declaration')
  assert.match(driverText, /--boots must be 1 or 2/u, 'the driver documents its boot budget')
  assert.match(driverText, /const BOOTS_WANTED = \(\(\) => \{[\s\S]*?return 2/u, 'the default run is the agreeing PAIR')
})

test('PD31-EVIDENCE-BOUND: the driver binds its run to a real commit and declares DEV-LIVE (never a candidate claim)', () => {
  assert.match(driverText, /recordClass: 'DEV-LIVE'/u, 'the record class is DEV-LIVE')
  assert.match(driverText, /candidateClaimEligibility is false by construction/u, 'the disclosure is explicit')
  assert.match(driverText, /resolveHeadCommit\(REPO_ROOT\)/u, 'the run is bound to the branch HEAD')
  assert.match(driverText, /bindings: runBindings\(head, authorization\)/u, 'the binding carries the head and the authorization')
  assert.equal(/\bamend\b/u.test(driverText), false, 'the driver never amends')
})
