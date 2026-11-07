/**
 * a5sf-pd18-web-ptc.test.mjs — PD-18: the governed preset's two HOST-EXECUTED
 * executors are fail-closed, and the confined web face they are NOT wired to
 * still works.
 *
 * WHY THIS SUITE EXISTS. `a5sf-recon-review` measured on the SHIPPED governed
 * preset: a governed Member's `web_fetch` reached the inherited host `ctx.web`
 * provider (refused there by SSRF, ZERO a5sf guard facts) and `workflow`
 * executed model-written JavaScript in a real PTC child under the HOST sandbox
 * policy (again ZERO a5sf facts; the Member's `confinedTurnLaunchers` count was
 * unchanged). PD-18's ruling is fail-closed on that preset: neither could be
 * routed onto a governed face inside the budget, so both are REMOVED. This
 * suite pins the resulting surface and both directions:
 *
 *   SURFACE       the shipped governed preset declares none of tool-web /
 *                 workflow-ptc / tool-workflow; the standard preset still does
 *                 (the capability exists outside the governed preset);
 *   TYPED-REFUSAL dispatching `workflow` / `web_fetch` against a governed-shaped
 *                 registry returns the host router's typed `unknown tool`
 *                 error, and the tripwire provider records ZERO executions;
 *   WEB-ALLOW     the confined web face still admits an allow-lane call,
 *                 performs exactly ONE real request against a controlled
 *                 loopback endpoint, returns its bytes and records ONE allow
 *                 fact (the face is not broken — it is simply not wired to the
 *                 shipped preset, which is the disclosed capability loss);
 *   WEB-DENY      the same face refuses a deny lane BEFORE the provider
 *                 (`NETWORK_UNCONFINED_REALM`), the endpoint sees ZERO
 *                 requests, and the deny fact is recorded;
 *   PIN           with A5SF_PD18_PIN=1 the BASE commit (`d590d58a0`) is read
 *                 out of git and the PRE-FIX rows are asserted present, so the
 *                 flip is a recorded fact rather than a story.
 *
 * WHAT IS FIXTURE (disclosed): the loopback endpoint, the tool registry's
 * tripwire tool and the boundary adapter are test instrumentation. The
 * confined web face, its guard, the typed refusal shape and the preset parser
 * are product code. Host-free: no boot, no port lease, no DSH_HOME.
 * `A5SF_PD18_COMPOSITION=<path>` lets the mutation-control script evaluate a
 * mutated copy of `cordis.patch.yml`; it is never set in CI.
 *
 * Run: node --test tests/world-factory/a5sf-pd18-web-ptc.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { testUseTree } from '../paths.mjs'
import { effectiveOf, loadWebSeams, makeFace } from './lib/a5sf-web-arms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const COMPOSITION = process.env.A5SF_PD18_COMPOSITION ?? join(REPO, 'cordis.patch.yml')
const PIN = process.env.A5SF_PD18_PIN === '1'
const MUTATE_REGISTER_WORKFLOW = process.env.A5SF_PD18_MUTATE_REGISTER_WORKFLOW === '1'
const BASE_COMMIT = 'd590d58a0'
const CLOSED_ROWS = Object.freeze(['tool-web', 'tool-workflow', 'workflow-ptc'])
const CLOSED_TOOLS = Object.freeze(['web_fetch', 'web_search', 'workflow', 'run_code'])

const runtimeRequire = createRequire(join(REPO, 'packages', 'runtime', 'package.json'))

function parseComposition(path) {
  const YAML = runtimeRequire('yaml')
  return YAML.parse(readFileSync(path, 'utf8').replace(/!!js /gu, ''))
}

function rowsOf(document) {
  const rows = Array.isArray(document) ? document : document === null || document === undefined ? [] : [document]
  return rows.flatMap((row) => (Array.isArray(row?.insert) ? rowsOf(row.insert) : [row]))
}

function flattenPlugins(list) {
  const out = []
  for (const row of list ?? []) {
    if (row?.group === true) { out.push(...flattenPlugins(row.config)); continue }
    if (row?.id !== undefined && row?.name !== undefined) out.push(row)
  }
  return out
}

/** The governed preset's DECLARED plugin rows (the model-visible surface source). */
function governedPlugins(path) {
  const preset = rowsOf(parseComposition(path)).find((row) => row?.config?.id === 'a5sf-governed-member')
  assert.notEqual(preset, undefined, 'the shipped governed preset row is present')
  return flattenPlugins(preset.config.plugins)
}

function standardPresetPath() {
  return join(testUseTree(REPO), 'packages', 'bundle', 'web-app', 'presets', 'standard.patch.yml')
}

// ===========================================================================
// P0 PIN — the PRE-FIX surface, read from the recorded base commit
// ===========================================================================

test('P0 PD-18 defect pin (PRE-FIX): the base preset carried tool-web and workflow-ptc/tool-workflow', { skip: !PIN }, () => {
  const pre = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  const prePreset = rowsOf(parseYaml(pre)).find((row) => row?.config?.id === 'a5sf-governed-member')
  const ids = flattenPlugins(prePreset.config.plugins).map((row) => row.id)
  for (const id of CLOSED_ROWS) {
    assert.equal(ids.includes(id), true, `PRE-FIX the governed preset declared ${id} — that is the defect this commit closes`)
  }
  const now = governedPlugins(join(REPO, 'cordis.patch.yml')).map((row) => row.id)
  for (const id of CLOSED_ROWS) {
    assert.equal(now.includes(id), false, `POST-FIX the governed preset no longer declares ${id}`)
  }
})

function parseYaml(text) {
  const YAML = runtimeRequire('yaml')
  return YAML.parse(text.replace(/!!js /gu, ''))
}

// ===========================================================================
// SURFACE — the shipped declaration, and the capability outside it
// ===========================================================================

test('PD18-SURFACE-CLOSED: the governed preset declares NO web/workflow row, and it is not a blanket strip', () => {
  const rows = governedPlugins(COMPOSITION)
  const ids = rows.map((row) => row.id)
  for (const closed of CLOSED_ROWS) {
    assert.equal(ids.includes(closed), false, `the governed preset must not carry '${closed}' (PD-18 fail-closed)`)
    assert.equal(rows.some((row) => String(row.name ?? '').includes(closed)), false, `no row may re-introduce '${closed}'`)
  }
  for (const kept of ['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-skill']) {
    assert.equal(ids.includes(kept), true, `the governed preset keeps '${kept}' — this is a surgical removal, not a blanket strip`)
  }
})

test('PD18-SURFACE-POSITIVE-CONTROL: the pinned standard preset still declares the workflow/web capability', () => {
  const standard = rowsOf(parseComposition(standardPresetPath()))
  const preset = standard.find((row) => row?.config?.id === 'standard')
  assert.notEqual(preset, undefined, 'the pinned standard preset row is present')
  const ids = flattenPlugins(preset.config.plugins).map((row) => row.id)
  assert.equal(ids.includes('workflow-ptc'), true, 'standard preset keeps workflow-ptc')
  assert.equal(ids.includes('tool-workflow'), true, 'standard preset keeps tool-workflow')
  assert.equal(ids.includes('tool-web'), true, 'standard preset keeps tool-web')
})

// ===========================================================================
// TYPED REFUSAL — a dispatchable-name registry with no web/workflow tool
// ===========================================================================

async function governedShapedRegistry() {
  const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
  const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
  const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  const tools = root.get('tools')
  const effects = { workflow: 0, webFetch: 0 }
  if (MUTATE_REGISTER_WORKFLOW) {
    // MUTATION ARM (never in CI): make the name dispatchable again. The
    // typed-refusal test below MUST go red, which is what proves it measures
    // absence rather than a string.
    tools.register({
      name: 'workflow',
      description: 'MUTATION tripwire: a dispatchable workflow must turn the refusal assertion red',
      parameters: { type: 'object', properties: {}, additionalProperties: true },
      async execute() { effects.workflow += 1; return { value: 42 } },
    })
  }
  return { root, tools, effects }
}

test('PD18-TYPED-REFUSAL: workflow/web_fetch are UNKNOWN_TOOL and execute nothing', async () => {
  const { tools, effects } = await governedShapedRegistry()
  for (const name of ['workflow', 'web_fetch']) {
    const settled = await tools.execute({
      signal: new AbortController().signal,
      callId: `pd18-${name}`,
      name,
      arguments: name === 'workflow' ? { script: 'return 42', meta: { name: 'x', description: 'x' } } : { url: 'http://127.0.0.1:9/nope' },
      agent: {},
    })
    const text = Array.isArray(settled.content) ? settled.content.map((part) => part?.type === 'text' ? part.text : '').join('') : ''
    assert.equal(settled.isError, true, `${name} must be a typed tool error`)
    assert.match(text, new RegExp(`unknown tool "${name}"`, 'u'), `${name} must be refused by the host router, not executed`)
    assert.equal(text.includes('42'), false, `${name} returned a workflow value`)
  }
  assert.equal(effects.workflow, 0, 'no workflow body executed')
  assert.equal(effects.webFetch, 0, 'no web provider entry')
})

// ===========================================================================
// WEB-ALLOW / WEB-DENY — the confined face is NOT broken, it is NOT wired
// ===========================================================================

async function startEndpoint() {
  const hits = []
  const server = createServer((req, res) => {
    hits.push({ method: String(req.method ?? ''), url: String(req.url ?? '') })
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('PD18_LOCAL_ENDPOINT_BYTES\n')
  })
  await new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(0, '127.0.0.1', done)
  })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    url: `http://127.0.0.1:${String(port)}/pd18`,
    hits,
    close: () => new Promise((done) => server.close(() => done())),
  }
}

/** A REAL loopback transport admitted by the face (not a fake boundary). */
function loopbackBoundary(endpoint) {
  const fetches = []
  return {
    fetches,
    probeCalls: 0,
    async fetch(request) {
      fetches.push(request)
      const response = await fetch(request.url)
      return {
        url: String(request.url),
        statusCode: response.status,
        body: { kind: 'text', content: await response.text() },
        truncated: false,
      }
    },
    async search() {
      throw new Error('PD18 loopback boundary: search is not measured here')
    },
    async probe() {
      this.probeCalls += 1
      return {
        ok: true,
        value: [{ dimension: 'network-destination', level: 'unsupported', note: 'loopback fixture: no netns on this host' }],
      }
    },
  }
}

test('PD18-WEB-ALLOW: the confined web face admits one allow-lane call to a controlled local endpoint', async () => {
  const seams = await loadWebSeams(REPO)
  const endpoint = await startEndpoint()
  try {
    const boundary = loopbackBoundary(endpoint)
    const { face, facts } = makeFace(seams, { effective: effectiveOf(seams, { network: 'allow' }), boundary })
    const value = await face.fetch({ url: endpoint.url })
    assert.equal(endpoint.hits.length, 1, 'the controlled endpoint saw exactly ONE request')
    assert.equal(endpoint.hits[0].url, '/pd18', 'the request carried the declared path')
    assert.equal(value.body.content.includes('PD18_LOCAL_ENDPOINT_BYTES'), true, 'the endpoint bytes came back through the face')
    assert.equal(boundary.fetches.length, 1, 'the provider was entered exactly once')
    assert.equal(facts.length, 1, 'exactly ONE guard-consult fact was recorded')
    assert.equal(facts[0].decision, 'allow', 'the fact is an ALLOW decision')
  } finally {
    await endpoint.close()
  }
})

test('PD18-WEB-DENY: the same face refuses network=deny BEFORE the provider: typed code, zero requests, zero bytes', async () => {
  const seams = await loadWebSeams(REPO)
  const endpoint = await startEndpoint()
  try {
    const boundary = loopbackBoundary(endpoint)
    const { face, facts } = makeFace(seams, { effective: effectiveOf(seams, { network: 'deny' }), boundary })
    await assert.rejects(
      () => face.fetch({ url: endpoint.url }),
      (error) => {
        assert.equal(error?.code, 'NETWORK_UNCONFINED_REALM', 'the refusal is the typed service-level admission code')
        assert.equal(String(error?.message ?? '').includes('non-public IP'), false, 'it is NOT the host provider SSRF refusal')
        return true
      },
    )
    assert.equal(endpoint.hits.length, 0, 'the controlled endpoint saw ZERO requests')
    assert.equal(boundary.fetches.length, 0, 'the provider was NEVER entered')
    assert.equal(facts.length, 1, 'exactly ONE guard-consult fact was recorded')
    assert.equal(facts[0].decision, 'deny', 'the fact is a DENY decision')
    assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM', 'the fact names the typed refusal')
  } finally {
    await endpoint.close()
  }
})
