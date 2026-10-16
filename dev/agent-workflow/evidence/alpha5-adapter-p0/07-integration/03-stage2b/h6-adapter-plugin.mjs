/**
 * h6-adapter-plugin.mjs — Alpha.5 P0-6 GO-clauses leg (h6): the multi-adapter
 * preset plugin (read shadow + grep shadow + self-registration probes).
 *
 * SHAPE: same public composition as the proven a5p0-adapter-preset-plugin
 * (stage2b PASS run 2026-10-15T22-44-01): an ordinary composable row mounted
 * INSIDE the member preset, riding `agent/created` and assembling on each
 * agent's OWN scope (restrict-first -> same-name register). Per-agent arming
 * rides a `tools/pre-execute` listener watching call arguments for directive
 * arm tokens.
 *
 * LEGS (each armed independently, per agent):
 *  - READ  : restrict(['read']) + same-name read Adapter. Policy: realpath the
 *            target; allow ONLY inside allowedRoot AND not under any path
 *            segment named privateDirName (fail-closed on the name even if a
 *            realpath quirk would hide it). Every open actually issued and
 *            every denial is appended as one JSON line to the access ledger
 *            (the OS-side-effect evidence channel; plan §1.2). Allowed reads
 *            return the REAL file bytes (positive control = real I/O).
 *  - GREP  : same-name grep Adapter (name already masked at setup by the
 *            blueprint builtinToolDeny; the Adapter registers on the own
 *            layer on top). Body = the PINNED host's tool-fs-search package
 *            root build artifact imported by file:// URL
 *            (parseGrepArgs / buildGrepCommand / parseGrepMatches /
 *            formatGrepMatches / runRipgrep — public exports of the package
 *            root, verified against lib/index.js of the pinned tree) executed
 *            through the plugin's injected PUBLIC ctx.subprocess service.
 *            Fallback (disclosed when used): child_process spawn of the
 *            pinned-tree @vscode ripgrep binary with the same buildGrepCommand
 *            argv. Policy: a path that fails realpath into allowedRoot (and
 *            not under the private name) is DENIED before anything spawns.
 *  - BASH  : NO restriction is done by this plugin — the blueprint's
 *            builtinToolDeny already masked bash at setup (Team assembly).
 *            The probe REGISTERS a same-name "bash" definition on the agent's
 *            own layer and records the registration outcome; if its body
 *            ever executes it writes a marker file (that would prove the
 *            shielded tool reappeared through self-registration — the clause
 *            says it must not).
 *  - RUNCODE: same-name register attempt for the reserved `run_code`
 *            transport; the outcome (expected: typed registry rejection) is
 *            recorded VERBATIM (PTC-01, host version).
 *  - DYN   : register an undeclared dynamic tool (h6_dyn_probe) — records
 *            registration + whether its body is reachable (fail-closed probe;
 *            observation only).
 *
 * Directive ($DSH_HOME/h6-adapter-directive.json, written by the kit BEFORE
 * boot): { allowedRoot, privateDirName, arms: {read,grep,bash,runcode,dyn},
 *   markRead, markGrep, ledgerFile, logFile, resultFile, searchEntryUrl,
 *   fallbackRgBinary, ownBashMarkerFile, dynMarkerFile }.
 */
import { appendFileSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve, sep } from 'node:path'

export const name = 'h6-adapter-plugin'
export const inject = ['tools', 'subprocess']

const DIRECTIVE = 'h6-adapter-directive.json'

/** @type {any} */
let directive = null

function note(line) {
  try {
    appendFileSync(directive.logFile, `[${new Date().toISOString()}] ${line}\n`)
  } catch { /* evidence best-effort */ }
}
function record(leg, payload) {
  try {
    appendFileSync(directive.resultFile, JSON.stringify({ ts: new Date().toISOString(), leg, ...payload }) + '\n')
  } catch { /* evidence best-effort */ }
}
function ledger(entry) {
  try {
    appendFileSync(directive.ledgerFile, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
  } catch { /* evidence best-effort */ }
}

function loadDirective() {
  const home = process.env.DSH_HOME ?? ''
  if (home === '') throw new Error('h6-adapter: DSH_HOME is not set (directive not locatable)')
  directive = JSON.parse(readFileSync(join(home, DIRECTIVE), 'utf8'))
  for (const key of ['allowedRoot', 'privateDirName', 'markRead', 'markGrep', 'ledgerFile', 'logFile', 'resultFile', 'searchEntryUrl', 'ownBashMarkerFile', 'dynMarkerFile']) {
    if (typeof directive[key] !== 'string' || directive[key] === '') throw new Error(`h6-adapter: directive.${key} missing`)
  }
  if (typeof directive.arms !== 'object' || directive.arms === null) throw new Error('h6-adapter: directive.arms missing')
}

function agentLabel(agent) {
  try { return String(agent?.id ?? agent?.session?.header?.id ?? '(unknown-agent)') } catch { return '(unreadable-agent)' }
}

/** The policy verdict over one requested path (fail-closed). */
function policyVerdict(rawPath) {
  const abs = resolve(process.cwd(), String(rawPath))
  let real = null
  try { real = realpathSync(abs) } catch {
    return { ok: false, abs, real: null, reason: 'realpath-failed (unresolvable target; fail-closed)' }
  }
  let allowedReal = directive.allowedRoot
  try { allowedReal = realpathSync(directive.allowedRoot) } catch { /* keep configured */ }
  const inside = real === allowedReal || real.startsWith(allowedReal + sep)
  const seg = `/${directive.privateDirName}/`
  const privateNamed = real.split(sep === '/' ? '/' : sep).includes(directive.privateDirName)
  if (!inside) return { ok: false, abs, real, reason: 'outside-allowedRoot' }
  if (privateNamed) return { ok: false, abs, real, reason: `path-segment-${directive.privateDirName} (fail-closed name check)` }
  return { ok: true, abs, real, reason: 'inside-allowedRoot' }
}

function argPathKey(args) {
  for (const k of ['file_path', 'path', 'filename', 'filePath']) if (args !== null && typeof args === 'object' && k in args) return k
  return null
}

/** The grep helpers: pinned package-root build artifact via file:// URL. */
let helpersPromise = null
function grepHelpers() {
  if (helpersPromise === null) {
    helpersPromise = import(directive.searchEntryUrl).then(
      (mod) => mod,
      (error) => {
        note(`GREP HELPERS IMPORT FAILED (fallback path will be used): ${String(error?.message ?? error)}`)
        record('grep-import-fail', { error: String(error?.message ?? error), url: directive.searchEntryUrl })
        helpersPromise = null
        throw error
      },
    )
  }
  return helpersPromise
}

/** Run one confined grep; returns { text, matches, impl } or throws. */
async function runAdapterGrep(ctx, policyReal, args) {
  const grepArgs = { pattern: String(args.pattern) }
  if (typeof args.path === 'string' && args.path !== '') grepArgs.path = policyReal
  if (typeof args.include === 'string' && args.include !== '') grepArgs.include = args.include
  let h = null
  try { h = await grepHelpers() } catch { h = null }
  if (h !== null) {
    const argv = h.buildGrepCommand(h.parseGrepArgs(grepArgs))
    const run = await h.runRipgrep(ctx, { signal: new AbortController().signal }, 'grep', argv, h.RAW_OUTPUT_MAX_BYTES, h.SEARCH_GRACE_MS, h.SEARCH_STDERR_MAX_BYTES)
    const matches = h.parseGrepMatches(run.stdout ?? '')
    const body = matches.length > 0 ? h.formatGrepMatches(matches) : 'No matches found'
    return { text: `found=${String(matches.length)}\n${body}`, count: matches.length, impl: 'package-root' }
  }
  // Disclosed fallback: run the pinned-tree ripgrep binary directly.
  if (typeof directive.fallbackRgBinary !== 'string' || directive.fallbackRgBinary === '') throw new Error('grep: package-root helpers unavailable AND no fallback rg binary configured')
  record('grep-fallback-used', { binary: directive.fallbackRgBinary, disclosure: 'package-root helper import failed; the Adapter ran the pinned @vscode ripgrep binary directly (no isolation; line-oriented plain output)' })
  const inner = ['--no-heading', '-n', '--color', 'never', `--regexp=${grepArgs.pattern}`, ...(grepArgs.include !== undefined ? [`--glob=${grepArgs.include}`] : []), '--', policyReal]
  const res = spawnSync(directive.fallbackRgBinary, inner, { encoding: 'utf8', timeout: 60_000 })
  if (res.error !== undefined && res.error !== null && res.status === null) throw res.error
  const lines = String(res.stdout ?? '').split('\n').filter((l) => l.length > 0)
  const body = lines.map((l) => {
    const m = /^(.*?):(\d+):(.*)$/.exec(l)
    return m !== null ? `${m[1]}\nLine ${m[2]}: ${m[3]}` : l
  }).join('\n\n')
  return { text: `found=${String(lines.length)}\n${body === '' ? 'No matches found' : body}`, count: lines.length, impl: 'fallback-rg-binary' }
}

export function apply(ctx) {
  loadDirective()
  const cfg = directive
  const disposables = []
  note(`PLUGIN APPLIED (preset scope; allowedRoot=${cfg.allowedRoot})`)

  disposables.push(ctx.on('agent/created', ({ agent }) => {
    const label = agentLabel(agent)
    try {
      const st = { readArmed: false, grepArmed: false, bashArmed: false, rcArmed: false, dynArmed: false, readCalls: 0, grepCalls: 0 }
      disposables.push(agent.ctx.on('tools/pre-execute', (exec, next) => {
        try {
          const argText = JSON.stringify(exec?.arguments ?? null)

          if (!st.readArmed && argText.includes(String(cfg.arms.read ?? '\u0000'))) {
            st.readArmed = true
            const nativeDef = agent.ctx.tools.get('read', agent)
            agent.ctx.tools.restrict({ deny: ['read'] })
            const def = {
              name: 'read',
              description: 'h6 restricted-read Adapter PoC (policy: realpath inside allowedRoot, never under the private name)',
              parameters: nativeDef?.parameters ?? { type: 'object', properties: { file_path: { type: 'string' } } },
              output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
              execute: async (args) => {
                const key = argPathKey(args)
                const raw = key !== null ? args[key] : String(args ?? '')
                const v = policyVerdict(raw)
                if (!v.ok) {
                  ledger({ agent: label, op: 'read', phase: 'DENY', arg: String(raw), abs: v.abs, real: v.real, reason: v.reason })
                  return `H6_ADAPTER_DENY(op=read) reason=${v.reason} arg=${String(raw)} — no bytes were read`
                }
                const bytes = readFileSync(v.real)
                st.readCalls += 1
                ledger({ agent: label, op: 'read', phase: 'OPEN', arg: String(raw), real: v.real, bytes: bytes.length })
                return `${cfg.markRead} call=${String(st.readCalls)} agent=${label} real=${v.real} bytes=${String(bytes.length)}\n${bytes.toString('utf8')}`
              },
            }
            disposables.push(agent.ctx.tools.register(def))
            note(`ARMED read agent=${label} nativeVisibleBeforeMask=${nativeDef !== undefined ? 'yes' : 'no'}`)
          }

          if (!st.grepArmed && argText.includes(String(cfg.arms.grep ?? '\u0000'))) {
            st.grepArmed = true
            const nativeDef = agent.ctx.tools.get('grep', agent)
            // The blueprint builtinToolDeny already masked grep/glob at setup;
            // the same-name Adapter registers on the agent's OWN layer on top.
            const def = {
              name: 'grep',
              description: 'h6 restricted-grep Adapter PoC (pinned package-root helpers; deny outside allowedRoot / private name)',
              parameters: nativeDef?.parameters ?? { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, include: { type: 'string' } } },
              output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
              execute: async (args) => {
                if (typeof args?.path !== 'string' || args.path === '') {
                  ledger({ agent: label, op: 'grep', phase: 'DENY', arg: '(no path)', reason: 'fail-closed: explicit path under allowedRoot required' })
                  return 'H6_ADAPTER_DENY(op=grep) reason=fail-closed-no-explicit-path — nothing was spawned'
                }
                const v = policyVerdict(args.path)
                if (!v.ok) {
                  ledger({ agent: label, op: 'grep', phase: 'DENY', arg: String(args.path), abs: v.abs, real: v.real, reason: v.reason, pattern: String(args.pattern ?? '') })
                  return `H6_ADAPTER_DENY(op=grep) reason=${v.reason} arg=${String(args.path)} — nothing was spawned (zero OS reads, zero hits)`
                }
                try {
                  const out = await runAdapterGrep(ctx, v.real, args)
                  st.grepCalls += 1
                  ledger({ agent: label, op: 'grep', phase: 'SPAWN', arg: String(args.path), real: v.real, pattern: String(args.pattern ?? ''), matches: out.count, impl: out.impl })
                  return `${cfg.markGrep} call=${String(st.grepCalls)} agent=${label} impl=${out.impl}\n${out.text}`
                } catch (error) {
                  ledger({ agent: label, op: 'grep', phase: 'ERROR', arg: String(args.path), reason: String(error?.message ?? error) })
                  return `H6_ADAPTER_ERROR(op=grep) ${String(error?.message ?? error)}`
                }
              },
            }
            disposables.push(agent.ctx.tools.register(def))
            note(`ARMED grep agent=${label} nativeVisibleAtArm=${nativeDef !== undefined ? 'yes(inherited,masked by builtinToolDeny before dispatch)' : 'no'}`)
          }

          if (!st.bashArmed && argText.includes(String(cfg.arms.bash ?? '\u0000'))) {
            st.bashArmed = true
            // NO restrict here: bash was masked at SETUP by builtinToolDeny
            // (the Team assembly). This probe only registers the same name on
            // the agent's OWN layer — the clause test is whether it can then
            // become executable again.
            try {
              agent.ctx.tools.register({
                name: 'bash',
                description: 'h6 self-registration probe for the builtinToolDeny-shielded bash (must not become reachable)',
                parameters: { type: 'object', properties: { command: { type: 'string' } } },
                output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
                execute: async (args) => {
                  writeFileSync(cfg.ownBashMarkerFile, `OWNLAYER_BASH_RAN ${JSON.stringify(args ?? null)}\n`)
                  return `H6_OWNLAYER_BASH_RAN ${JSON.stringify(args ?? null)}`
                },
              })
              record('bash-register', { agent: label, ok: true, note: 'own-layer same-name registration of the builtinToolDeny-shielded name SUCCEEDED at the runtime layer (reachability is the clause question)' })
            } catch (error) {
              record('bash-register', { agent: label, ok: false, error: String(error?.message ?? error) })
            }
            note(`ARMED bash-probe agent=${label}`)
          }

          if (!st.rcArmed && argText.includes(String(cfg.arms.runcode ?? '\u0000'))) {
            st.rcArmed = true
            try {
              agent.ctx.tools.register({
                name: 'run_code',
                description: 'h6 PTC-01 probe: same-name registration of the reserved run_code transport',
                parameters: { type: 'object', properties: { code: { type: 'string' } } },
                output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
                execute: async () => 'H6_RUNCODE_RAN (unexpected)',
              })
              record('runcode-register', { agent: label, ok: true, note: 'UNEXPECTED: reserved name registration accepted' })
            } catch (error) {
              record('runcode-register', { agent: label, ok: false, error: String(error?.message ?? error) })
            }
            note(`ARMED runcode-probe agent=${label}`)
          }

          if (!st.dynArmed && argText.includes(String(cfg.arms.dyn ?? '\u0000'))) {
            st.dynArmed = true
            try {
              agent.ctx.tools.register({
                name: 'h6_dyn_probe',
                description: 'h6 undeclared-dynamic-tool probe (fail-closed observation)',
                parameters: { type: 'object', properties: {} },
                output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
                execute: async () => {
                  writeFileSync(cfg.dynMarkerFile, 'H6_DYN_RAN\n')
                  return 'H6_DYN_RAN'
                },
              })
              record('dyn-register', { agent: label, ok: true })
            } catch (error) {
              record('dyn-register', { agent: label, ok: false, error: String(error?.message ?? error) })
            }
            note(`ARMED dyn-probe agent=${label}`)
          }

        } catch (error) {
          note(`ERROR agent=${label} pre-execute: ${String(error?.message ?? error)}`)
          record('plugin-error', { agent: label, error: String(error?.stack ?? error) })
        }
        return next()
      }))
      note(`agent/created: per-agent listener installed agent=${label}`)
    } catch (error) {
      note(`ERROR agent=${label} created: ${String(error?.message ?? error)}`)
    }
  }))

  ctx.effect(() => () => {
    for (const dispose of disposables) {
      try { dispose() } catch { /* already disposed */ }
    }
    note('PLUGIN DISPOSED (preset scope fiber stopped)')
  }, 'h6-adapter teardown')
}
