/**
 * carrier-import-preflight.mjs — import-only preflight of a test carrier's plugin entry.
 *
 * WHY THIS EXISTS (measured, run 2026-10-04T09-45-40Z, retained): `git worktree add` produces a
 * carrier whose COMMITTED build artifacts are byte-identical to the task worktree — dist/ and the
 * composition-shim are unignored and shipped in the commit — but with NO node_modules. The pinned
 * commit's own plugin graph imports bare specifiers (`yaml`, `zod`, `@deepseek-ai/dsh-*`), so the
 * cordis loader reported only `dsh-agent-team (…/plugin/host.js): failed to import`, the
 * `/team-remote` channel was never registered, frontend-static answered 405 to every unmatched
 * POST, and the kit sat watching 405 for its whole readiness budget. That is a provisioning
 * failure, and it was only visible in a host log three minutes after the wrapper had already
 * given up. This preflight says the real thing, before anything is launched:
 *
 *   PREFLIGHT_FAIL … code=ERR_MODULE_NOT_FOUND
 *   message=Cannot find package 'yaml' imported from …/dist/packages/domain/blueprint/src/parse.js
 *
 * SCOPE / SAFETY — this is test setup, not product code:
 *   • import-only: it imports the module and reads export NAMES. It never calls `apply`, never
 *     touches `inject`, never builds a cordis context, never starts a host, server or browser.
 *     (A cordis entry's registration lives behind `apply(ctx, config)`; module scope is plain
 *     declarations, so importing it has no side effect worth naming.)
 *   • no network, no env output: it prints the target, the Node error code/message and stack
 *     frames only — never process.env, tokens or config values.
 *   • it adds no product assertion; the kit's own verdicts stay untouched.
 *
 * Usage:
 *   node carrier-import-preflight.mjs [--timeout-ms N] [--require-exports a,b,c] file:///… [file:///…]
 *
 * Exit codes: 0 every target imported and exports the contract; 1 a target failed or is missing an
 * expected export; 2 usage error.
 *
 * @module tests/kits/team-view-sync-complete-e2e/carrier-import-preflight
 */
import process from 'node:process'

const DEFAULT_REQUIRED = ['name', 'inject', 'apply', 'validateTeamPluginConfig']

const argv = process.argv.slice(2)
// One left-to-right pass: `--flag value` consumes its value, anything else is a target. This keeps
// a flag's VALUE (a number, an export list) from being mistaken for a file URL.
const opts = new Map()
const targets = []
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]
  if (!a.startsWith('--')) { targets.push(a); continue }
  const v = argv[i + 1]
  if (v === undefined || v.startsWith('--')) {
    process.stdout.write(`--${a.slice(2)} requires a value\n`)
    process.exit(2)
  }
  opts.set(a.slice(2), v)
  i += 1
}
const timeoutRaw = Number(opts.get('timeout-ms') ?? '20000')
const TIMEOUT_MS = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 20000
const required = String(opts.get('require-exports') ?? DEFAULT_REQUIRED.join(','))
  .split(',').map((s) => s.trim()).filter((s) => s !== '')

if (targets.length === 0 || targets.some((t) => !t.startsWith('file://'))) {
  process.stdout.write('USAGE node carrier-import-preflight.mjs [--timeout-ms N] [--require-exports a,b] file:///abs/entry.js …\n')
  process.exit(2)
}

/** One target: resolve + evaluate its graph, then look at NAMES only. */
async function probeOne(url) {
  const t0 = Date.now()
  let timer = null
  try {
    // The timer is deliberately REF'd: an entry with an unsettled top-level await empties the event
    // loop, and an unref'd timer would let Node exit 13 (unsettled TLA) instead of reporting a
    // bounded preflight timeout.
    const mod = await Promise.race([
      import(url),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('PREFLIGHT_TIMEOUT')), TIMEOUT_MS) }),
    ])
    const names = Object.keys(mod).sort()
    const missing = required.filter((k) => !Object.prototype.hasOwnProperty.call(mod, k))
    if (missing.length > 0) {
      return `PREFLIGHT_FAIL ${url}\ncode=MISSING_PLUGIN_EXPORTS\nmissing_exports=${missing.join(',')}\nexports=${names.join(',')}\n`
    }
    // Names only: `apply` is never invoked, so no context, host or browser can come from here.
    return `PREFLIGHT_OK ${url} in ${Date.now() - t0}ms exports=${names.join(',')}\n`
  } catch (e) {
    const msg = String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 400)
    if (msg.startsWith('PREFLIGHT_TIMEOUT')) {
      return `PREFLIGHT_FAIL ${url}\ncode=PREFLIGHT_TIMEOUT\nmessage=import did not settle within ${TIMEOUT_MS}ms\n`
    }
    const frames = String(e?.stack ?? '').split('\n').filter((l) => l.trim().startsWith('at ')).slice(0, 3)
    return `PREFLIGHT_FAIL ${url}\ncode=${e?.code ?? e?.name ?? '(none)'}\nmessage=${msg}\nframes=${frames.length}\n`
      + frames.map((f) => `  ${f.trim().slice(0, 200)}\n`).join('')
  } finally {
    if (timer) clearTimeout(timer)
  }
}

let bad = 0
for (const url of targets) {
  const out = await probeOne(url)
  process.stdout.write(out)
  if (out.startsWith('PREFLIGHT_FAIL')) bad += 1
}
process.stdout.write(`PREFLIGHT_SUMMARY targets=${targets.length} failed=${bad} timeout_ms=${TIMEOUT_MS} require_exports=${required.join(',')}\n`)
process.exit(bad === 0 ? 0 : 1)
