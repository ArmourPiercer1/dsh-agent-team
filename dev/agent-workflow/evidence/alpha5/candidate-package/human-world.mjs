#!/usr/bin/env node
/* human-world.mjs — human persistent world: init from the VERIFIED install face,
 * and a no-secrets config check gate (root 00:57Z closure order, minimal form).
 *
 *   node human-world.mjs init  --state <candidate-INSTALLED.json> --homes <dir> --template <yml>
 *   node human-world.mjs check --state <candidate-INSTALLED.json> <human-world-dir>
 *
 * Laws:
 *  - the human world lives at <homes>/candidate-human-<stamp>: that prefix is
 *    EXCLUDED from every automated cleanup record and from the sweep case gates
 *    (rollback-candidate.sh carries an explicit negative gate; the kit refuses
 *    any .CANDIDATE-HUMAN-USE sentinel).
 *  - init copies the verified install face (cp -a semantics) — it never re-runs
 *    a moving install; provenance goes into the sentinel file.
 *  - check is a fast gate only: paths exist / no template placeholders / no
 *    mock residue / no references to swept trial worlds. It never starts a host.
 */
import { existsSync, cpSync, readFileSync, writeFileSync, accessSync, constants, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const MODE = argv[0]
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const die = (m) => { console.error(`FATAL: ${m}`); process.exit(1) }
const ok = (m) => { console.log(`  PASS ${m}`); return true }
const bad = (m) => { console.log(`  FAIL ${m}`); return false }

const STATE_FILE = arg('state', '')
existsSync(STATE_FILE) || die(`no state file at ${STATE_FILE} — run the install first (README §2)`)
const STATE = JSON.parse(readFileSync(STATE_FILE, 'utf8'))

// ── the three-path field verification (launcher sha / plugin trust root / DSH_HOME) ──
function verify3(world) {
  let pass = true
  const launcher = join(world, 'deployment', 'landlock-prelauncher.py')
  if (!existsSync(launcher)) { pass = bad(`launcherPath missing: ${launcher}`) | pass }
  else {
    const sha = createHash('sha256').update(readFileSync(launcher)).digest('hex')
    pass = (sha === STATE.launcher?.sha256 ? ok(`launcher sha256 == INSTALLED record (${sha.slice(0, 16)}…)`) : bad(`launcher sha256 ${sha.slice(0, 16)}… != record ${String(STATE.launcher?.sha256).slice(0, 16)}…`)) && pass
  }
  const pluginRoot = join(world, 'profiles', 'web', 'node_modules', 'dsh-agent-team')
  try {
    const pj = JSON.parse(readFileSync(join(pluginRoot, 'package.json'), 'utf8'))
    ok(`plugin trust root present: ${pluginRoot} (name=${pj.name} version=${pj.version})`)
  } catch { pass = bad(`plugin trust root missing/unreadable: ${pluginRoot}`) && pass }
  try { accessSync(world, constants.W_OK); ok(`DSH_HOME exists and is writable: ${world}`) }
  catch { pass = bad(`DSH_HOME not writable: ${world}`) && pass }
  return pass
}


// ── minimal block-YAML subset (template shape only): maps, seqs, inline [] {},
//    scalars (null/int/quoted/bare), whole-line comments. Anything fancier is a
//    parse failure — the gate then says so rather than guessing. ──
function parseYamlSubset(text) {
  const lines = text.split('\n').map((l, i) => ({ raw: l, i })).filter((l) => !/^\s*#/.test(l.raw) && l.raw.trim() !== '')
  let pos = 0
  const indentOf = (l) => l.raw.match(/^ */)[0].length
  function parseScalar(v) {
    v = v.trim()
    if (v === '[]') return []
    if (v === '{}') return {}
    if (v === 'null' || v === '~') return null
    if (v === 'true') return true
    if (v === 'false') return false
    if (/^-?\d+$/.test(v)) return Number(v)
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1)
    return v
  }
  function parseBlock(indent) {
    if (pos >= lines.length) return null
    if (lines[pos].raw.slice(indent, indent + 1) === '-' || /^\s*-\s/.test(lines[pos].raw)) {
      const arr = []
      while (pos < lines.length && indentOf(lines[pos]) === indent && lines[pos].raw.trimStart().startsWith('- ')) {
        const rest = lines[pos].raw.trimStart().slice(2)
        const m = rest.match(/^([A-Za-z_][\w.-]*):(.*)$/)
        if (m) {
          const obj = {}
          const inline = m[2].trim()
          lines[pos] = { raw: ' '.repeat(indent + 2) + rest, i: lines[pos].i }
          Object.assign(obj, parseMap(indent + 2))
          if (inline === '' && undefined === obj[m[1]]) { /* noop */ }
          arr.push(obj)
        } else { pos += 1; arr.push(parseScalar(rest)) }
      }
      return arr
    }
    return parseMap(indent)
  }
  function parseMap(indent) {
    const obj = {}
    while (pos < lines.length && indentOf(lines[pos]) === indent) {
      const t = lines[pos].raw.trimStart()
      if (t.startsWith('- ') || t === '-') break
      const m = t.match(/^([A-Za-z_][\w.-]*):(.*)$/)
      if (!m) throw new Error(`YAML subset parse: line ${lines[pos].i + 1} is not "key: value": ${t.slice(0, 60)}`)
      const key = m[1]; const inline = m[2].trim()
      pos += 1
      if (inline !== '') { obj[key] = parseScalar(inline); continue }
      if (pos < lines.length && indentOf(lines[pos]) > indent) obj[key] = parseBlock(indentOf(lines[pos]))
      else obj[key] = null
    }
    return obj
  }
  const out = parseBlock(indentOf(lines[0]))
  if (pos !== lines.length) throw new Error('YAML subset parse: trailing unparsed content')
  return out
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')

if (MODE === 'init') {
  const homes = arg('homes', '')
  existsSync(homes) || die(`homes root missing: ${homes}`)
  const src = STATE.installHome
  existsSync(src) || die(`installHome from state does not exist: ${src} — reinstall per README §2 first`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dst = join(homes, `candidate-human-${stamp}`)
  existsSync(dst) && die(`refusing to overwrite: ${dst}`)
  cpSync(src, dst, { recursive: true }) // copy the VERIFIED install face byte-for-byte (no network, no moving ref)
  // an inherited active layer would smuggle trial/mock config into the human path:
  const active = join(dst, 'profiles', 'web', 'cordis.patch.yml')
  let note = 'no inherited active layer (clean)'
  if (existsSync(active)) {
    const body = readFileSync(active, 'utf8')
    rename_note: {
      writeFileSync(`${active}.imported-from-probe`, body)
      writeFileSync(active, '# inert placeholder — the probe layer was moved to cordis.patch.yml.imported-from-probe;\n# configure the human path from cordis.patch.TEMPLATE.yml (README §3b: configure FIRST).\n')
      note = `inherited probe layer moved aside -> ${active}.imported-from-probe`
    }
  }
  const tpl = arg('template', '')
  existsSync(tpl) || die(`template missing: ${tpl}`)
  cpSync(tpl, join(dst, 'profiles', 'web', 'cordis.patch.TEMPLATE.yml'))
  const sentinel = join(dst, '.CANDIDATE-HUMAN-USE')
  writeFileSync(sentinel, [
    '.CANDIDATE-HUMAN-USE — HUMAN-RETAINED DATA. Automated tooling must never delete this directory.',
    `origin_installHome=${src}`,
    `origin_sha=${STATE.sha}`,
    `origin_rootSha=${STATE.rootSha}`,
    `copied_at=${new Date().toISOString()}`,
    'protection: candidate-human-* prefix is excluded from all state/history records AND from',
    'the sweep case gates (rollback-candidate.sh negative gate); the kit refuses any sentinel.',
  ].join('\n'))
  console.log(`human world created: ${dst}`)
  console.log(`  sentinel: ${sentinel}`)
  console.log(`  note: ${note}`)
  console.log('  template: profiles/web/cordis.patch.TEMPLATE.yml (inactive name — the host loads only cordis.patch.yml)')
  let pass = verify3(dst)
  // byte-pin: launcher copy must hash identically to the source world's copy
  try {
    const a = sha(join(src, 'deployment', 'landlock-prelauncher.py'))
    const b = sha(join(dst, 'deployment', 'landlock-prelauncher.py'))
    pass = (a === b ? ok('copied launcher bytes identical to source world') : bad('launcher copy differs from source!')) && pass
  } catch { pass = bad('launcher compare failed') && pass }
  console.log(pass ? 'START-CHECKLIST' : 'START-CHECKLIST (NOT READY — fix FAILs first)')
  console.log([
    ` 1) cp ${join(dst, 'profiles', 'web', 'cordis.patch.TEMPLATE.yml')} ${active}`,
    ` 2) edit that file: replace every REPLACE_ME (the REAL provider's three lines go into the ENV at boot — keys NEVER in the file)`,
    ` 3) gate:  node ${process.argv[1]} check --state ${STATE_FILE} "${dst}"`,
    ` 4) boot:  DSH_HOME="${dst}" DSH_CLIENT_COMMIT_HASH=${String(STATE.testUseHead).slice(0, 10)} \\`,
    `            DEEPSEEK_BASE_URL=<real-base> DEEPSEEK_API_KEY=<real-key> \\`,
    `            node ${STATE.testUse}/apps/cli/lib/bin.js web --port <FREE_PORT_3180-3186> --no-open &  echo $! > /tmp/candidate-human.pid`,
    `           (configure FIRST, then boot — edits after boot do not take effect; stop = kill $(cat /tmp/candidate-human.pid);`,
    `            resume later = boot the SAME directory again: the world keeps its state; nothing here ever cleans it)`,
    ` 5) this world is NEVER touched by install/try/rollback automated cleanup (prefix exclusion + negative gate + sentinel).`,
  ].join('\n'))
  process.exit(pass ? 0 : 2)
}

if (MODE === 'check') {
  const world = argv[argv.length - 1]
  existsSync(world) || die(`world path does not exist: ${world}`)
  statSync(world).isDirectory() || die(`not a directory: ${world}`)
  let pass = true
  existsSync(join(world, '.CANDIDATE-HUMAN-USE'))
    ? ok('human sentinel present (this gate only runs on human worlds)')
    : (pass = bad('no .CANDIDATE-HUMAN-USE — this is not an --init-human-world world') && pass)
  const active = join(world, 'profiles', 'web', 'cordis.patch.yml')
  if (!existsSync(active)) { pass = bad(`no active layer yet: ${active} — configure FIRST (copy the TEMPLATE), then check, then boot`) && pass }
  else {
    const body = readFileSync(active, 'utf8')
    const inert = body.includes('inert placeholder') // init moved a probe layer aside and left this marker: not a configuration
    if (inert) pass = bad('active layer is the inert placeholder left by init — copy the TEMPLATE over it and configure (README §3b)') && pass
    const placeholder = body.includes('REPLACE_ME')
    pass = (placeholder ? bad('template placeholders REPLACE_ME still present — replace with real values') : ok('no REPLACE_ME placeholders')) && pass
    const mock = /cand-mock|127\.0\.0\.1:34\d\d|mock-deepseek/i.test(body)
    pass = (mock ? bad('mock residue in the active layer (a human world must point at a real provider)') : ok('no mock residue')) && pass
    const sweptRef = /candidate-pos-|candidate-globoff-|candidate-pin(ok|codex|cc|fork)?-|candidate-install-/.test(body)
    pass = (sweptRef ? bad('reference to a trial/automation world (those get cleaned; do not reference them)') : ok('no references to swept trial worlds')) && pass
    if (/teamToolPlane:/.test(body) && /^\s+realm:/m.test(body) && !/realmId:/.test(body)) {
      pass = bad('teamToolPlane uses `realm:` — the contract key is `realmId` (dist agent-bindings reads config.teamToolPlane.realmId)') && pass
    }
    // SHAPE GATE: call the INSTALLED validator itself (root 01:20Z item 1:
    // "门的判据=能过 validateTeamPluginConfig 形状面" — so the gate IS that function,
    // imported from the verified install face; the final word stays the real boot).
    try {
      const rows = parseYamlSubset(body)
      const row = Array.isArray(rows) && rows.find((r) => r && r.id === 'dsh-agent-team')
      if (!row) pass = bad('no dsh-agent-team row found in the active layer') && pass
      else {
        const hostMod = join(world, 'profiles', 'web', 'node_modules', 'dsh-agent-team', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
        existsSync(hostMod) || die(`installed host.js not found: ${hostMod}`)
        const { validateTeamPluginConfig } = await import('file://' + hostMod)
        validateTeamPluginConfig(row.config)
        ok('shape gate: validateTeamPluginConfig (INSTALLED dist) ACCEPTS the config row')
      }
    } catch (e) {
      if (e && e.code === undefined && /YAML subset parse/.test(String(e?.message))) pass = bad(`YAML shape: ${String(e.message).slice(0, 140)}`) && pass
      else pass = bad(`validateTeamPluginConfig REFUSES the config: ${String(e?.message ?? e).slice(0, 180)}`) && pass
    }
  }
  pass = verify3(world) && pass
  console.log(pass ? 'CHECK-CONFIG: PASS — safe to boot (README §3b order: config -> check -> boot)' : 'CHECK-CONFIG: FAIL — fix above, do not boot yet')
  process.exit(pass ? 0 : 2)
}
die(`unknown mode: ${MODE} (want init|check)`)
