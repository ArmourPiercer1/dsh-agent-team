#!/usr/bin/env node
/**
 * a5g6-install-kit.mjs — the GLUE-6 fix round's proof kit (install-surface
 * self-sufficiency + the render contract), one posture per run:
 *
 *   --posture red-install  (--surface strict, PRE-FIX bytes)
 *       RED-A reproduced on THIS round's base commit: a strict unfolding of
 *       the runtime package's public install face
 *       (`git archive HEAD -- packages/runtime/dist packages/runtime/package.json`
 *       — exactly the surface its `files: ["dist"]` declares), booted against
 *       the pinned host, dies in the plugin bootstrap with
 *       `ERR_MODULE_NOT_FOUND … upstream-resolver.mjs`.
 *
 *   --posture red-render   (--surface aux, PRE-FIX bytes)
 *       RED-② reproduced: the face is patched with the tracked siblings (the
 *       way a git install of the WHOLE repo would have them on disk) so the
 *       host boots, a governed team delegates, and the member's own-layer
 *       trio call reaches the host's result assembly — which throws
 *       `content.some is not a function`, because the plane's
 *       PLANE_PRESENTATION_FACE.render returned a String where the host law
 *       declares ContentBlock[]. The lane's verdict never reaches the model.
 *
 *   --posture green        (--surface strict, POST-FIX bytes)
 *       Both gaps closed on the SAME strict face RED-A unfolded: the row
 *       applies, the load graph is foreign-free, and the SAME live trio leg
 *       delivers the lane's refusal text to the model as legal text blocks
 *       with zero assembly errors.
 *
 * Mechanics are the INSTALL-ENTRY kit's (dev/agent-workflow/evidence/alpha5/
 * install-entry/a5ie-install-kit.mjs), copied rather than re-invented: the
 * public profile-patch seam for rows + the preset declaration, the mock
 * model as wire witness, the discovery-derived deny list, the storm guard,
 * the redacted evidence trail. Rig: TEST_METHODS §5/§7 (host =
 * tests/deepseek-harness-test-use pristine @ 639ed01539, DSH_HOME inside the
 * workspace, ports 3183/3491, :3080 probed read-only).
 *
 * Usage:
 *   node a5g6-install-kit.mjs --posture <green|red-install|red-render> \
 *        [--worktree <tree-under-test>] [--surface strict|aux] [--keep]
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, homeDir, testUseTree } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (name, d) => { const i = args.indexOf(`--${name}`); return i === -1 ? d : args[i + 1] }
const has = (name) => args.includes(`--${name}`)

const POSTURE = argValue('posture', 'green')
if (!['green', 'red-install', 'red-render'].includes(POSTURE)) throw new Error(`--posture must be green|red-install|red-render, got ${POSTURE}`)
// The install face under test. `strict` = exactly what the runtime package's
// own manifest ships (files:["dist"]); `aux` = that plus the tracked files a
// git install of the REPO would also have on disk (the two runtime siblings
// the fix replaces, + the root skills) — the only way PRE-FIX bytes boot at
// all, which is what makes the RED-② leg reachable.
const SURFACE = argValue('surface', POSTURE === 'red-render' ? 'aux' : 'strict')
if (!['strict', 'aux'].includes(SURFACE)) throw new Error(`--surface must be strict|aux, got ${SURFACE}`)

const HERE = dirname(new URL(import.meta.url).pathname)
const FIX_ROOT = HERE
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const WORKTREE = resolve(argValue('worktree', REPO_ROOT))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', `${POSTURE}-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const MOCK_PORT = Number(argValue('mock-port', 3491))
const MODEL = 'a5g6-model'
const PRESET_ID = 'a5g6-base'
const RUN_ID = RUN_STAMP.replace(/[:\-T]/g, '').slice(0, 12)
const WORLD = `a5g6-${POSTURE}-${RUN_ID}`
const ROOT = `session-a5g6-root-${RUN_ID}`
const CREATE_ROOT = `session-a5g6-team-${RUN_ID}`
const BP_ANCHOR_ID = 'team.a5g6.anchor'
const BP_MAIN_ID = 'team.a5g6.main'
const TK_DELG = 'a5g6-delg-1'
const MK = `A5G6_${RUN_ID}`
const MU = 'T'
const MK_DISC = `${MK}_${MU}_DISC`
const MK_L0 = `${MK}_${MU}_L0`
const MK_TASK = `${MK}_${MU}_TASK`
const ALIASES = ['team_grep', 'team_glob', 'team_bash']
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const STORM_LIMIT = Number(argValue('storm-limit', 300))
const KEEP = has('keep')

const TESTUSE = resolve(argValue('testuse', testUseTree(WORKTREE)))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const HOME = homeDir(WORKTREE, WORLD)
const DEPS_SRC = resolve(argValue('deps-src', join(REPO_ROOT, '..', 'a5-glue5-entry', 'packages', 'runtime', 'node_modules')))
const DEPS_STORE = resolve(argValue('deps-store', join(REPO_ROOT, '..', 'a5-glue5-entry', 'node_modules', '.pnpm')))
const EXP = resolve(argValue('expansion', join(REPO_ROOT, '..', '.a5g6-expansion', `${POSTURE}-${RUN_STAMP}`)))

// The file the delegated directive points team_grep at — INSIDE the world's
// workspace (the host's own workspace rules accept the path).
const TARGET_FILE = join(HOME, 'workspace', 'a5g6-target.txt')
/**
 * The delegated directive: the two trio calls, in order. The blueprint
 * persona and the mock's team_delegate prompt quote the SAME builder, so the
 * directive the leader passes cannot drift from the script the member runs.
 */
const delegatedTask = () => `${MK_TASK} TARGET=${TARGET_FILE} Work EXACTLY in this order: (1) call the tool team_bash with arguments {"command":"echo a5g6"}; (2) then call the tool team_grep with arguments {"pattern":"A5G6_GREP_TARGET","path":"${TARGET_FILE}","output_mode":"content"}; (3) then finish with ONE line starting A5G6_MEMBER_RESULT quoting the two tool-result texts you received.`

const STRICT_SURFACES = ['packages/runtime/dist', 'packages/runtime/package.json']
const AUX_EXTRA = ['packages/runtime/src/plugin/upstream-resolver.mjs', 'packages/runtime/root-binding/harness/seam.mjs', '.agents/skills']
const SURFACES = SURFACE === 'strict' ? STRICT_SURFACES : [...STRICT_SURFACES, ...AUX_EXTRA]

const REL_ENTRY = 'packages/runtime/dist/packages/runtime/src/plugin/host.js'
const REL_RESOLVER_IN_MIRROR = 'packages/runtime/dist/packages/runtime/src/plugin/upstream-resolver.mjs'
const REL_SEAM_IN_MIRROR = 'packages/runtime/dist/packages/runtime/root-binding/harness/seam.mjs'
const ENTRY_PATH = join(EXP, REL_ENTRY)
const ENTRY_URL = pathToFileURL(ENTRY_PATH).href
const OBSERVER_URL = pathToFileURL(join(FIX_ROOT, 'a5g6-observer-row.mjs')).href
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

const REDACTIONS = [
  [/token=[A-Za-z0-9_-]+/g, 'token=<REDACTED>'],
  [/authorization:\s*\S+/gi, 'authorization: <REDACTED>'],
  [/"token":"[^"]+"/g, '"token":"<REDACTED>"'],
  [/Bearer\s+\S+/gi, 'Bearer <REDACTED>'],
  [/dsh_session=[^;"'\s]+/g, 'dsh_session=<REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)

const CRITERIA = []
function check(id, description, pass, evidence) {
  CRITERIA.push({ id, description, pass: pass === true, evidence: redact(String(evidence)).slice(0, 1200) })
  console.log(`${pass === true ? 'PASS' : 'FAIL'} ${id}: ${redact(String(evidence)).slice(0, 400)}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const gitAt = (cwd, ...a) => String(spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8', timeout: 180_000 }).stdout).trim()
const writeEvidence = (name, data) => writeFileSync(join(EVIDENCE_DIR, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n')
async function fetchJson(url, init = {}, timeoutMs = 30_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body, text: redact(text) }
}
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await sleep(250)
  }
}
async function waitQuiet(deadlineMs, fn) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    try { const v = await fn(); if (v) return v } catch { /* transient */ }
    if (Date.now() >= deadline) return false
    await sleep(400)
  }
}
function walkFiles(root, rel = '') {
  const out = []
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`
    if (e.isDirectory()) out.push(...walkFiles(root, r))
    else if (e.isFile()) out.push(r)
  }
  return out
}
async function portFree(port) {
  return await new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.listen(port, '127.0.0.1', () => { s.close(() => res(true)) }) })
}
async function portFreeWait(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port)) return true
    if (Date.now() >= deadline) return false
    await sleep(300)
  }
}
/** :3080 probe, READ-ONLY (a GET of the boot page; never POSTed). */
async function stableProbe() {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}

// ────────────────────────── YAML emitter (patch layer) ──────────────────────────
function yamlScalar(value) {
  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  const s = String(value)
  return /[:#{}[\],&*?|>%@`"'—\n]|^\s|\s$/.test(s) ? JSON.stringify(s) : s
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`]
    return [`${pad}${key}:`, ...value.flatMap((item) => yamlEmitItem(item, indent + 1))]
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return [`${pad}${key}: {}`]
    return [`${pad}${key}:`, ...entries.flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

// ───────────────────────────── expansion (the face) ─────────────────────────────
function expandSurface() {
  const facts = { worktree: WORKTREE, head: gitAt(WORKTREE, 'rev-parse', 'HEAD'), surface: SURFACE, surfaces: SURFACES }
  rmSync(EXP, { recursive: true, force: true })
  mkdirSync(EXP, { recursive: true })
  const arch = spawnSync('git', ['-C', WORKTREE, 'archive', 'HEAD', '--', ...SURFACES], { encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 })
  if ((arch.status ?? -1) !== 0) die(`git archive failed: ${String(arch.stderr).slice(0, 300)}`)
  const unp = spawnSync('tar', ['-xf', '-', '-C', EXP], { input: arch.stdout, timeout: 240_000 })
  if ((unp.status ?? -1) !== 0) die(`untar failed: ${String(unp.stderr).slice(0, 300)}`)
  const files = walkFiles(EXP)
  facts.expandedFileCount = files.length
  writeEvidence('expansion-manifest.json', files.map((f) => ({ path: f, bytes: statSync(join(EXP, f)).size, sha256: sha256File(join(EXP, f)) })))
  facts.entryPresent = existsSync(ENTRY_PATH)
  // The discriminator this whole round turns on: does the unfolded face carry
  // the two runtime .mjs the entry loads — INSIDE the face?
  facts.inFace = {
    resolver: existsSync(join(EXP, REL_RESOLVER_IN_MIRROR)),
    seam: existsSync(join(EXP, REL_SEAM_IN_MIRROR)),
  }
  facts.outOfFaceSiblings = {
    resolver: existsSync(join(EXP, 'packages/runtime/src/plugin/upstream-resolver.mjs')),
    seam: existsSync(join(EXP, 'packages/runtime/root-binding/harness/seam.mjs')),
  }
  writeEvidence('expansion-facts.json', facts)
  check('E1', `EXPANSION: strict \`git archive HEAD\` of the runtime package's PUBLIC face (${SURFACES.join(' + ')}) unfolded byte-exactly; per-file sha256 manifest written`,
    facts.entryPresent === true && facts.expandedFileCount > 1000,
    `head=${facts.head.slice(0, 10)} files=${String(facts.expandedFileCount)} entry=${String(facts.entryPresent)} inFace=${JSON.stringify(facts.inFace)} outOfFace=${JSON.stringify(facts.outOfFaceSiblings)}`)
  return facts
}

/**
 * The expansion carries its OWN node_modules: the sandbox resolves nothing
 * outside it, and a node_modules discovered by walking up out of a .tmp-ish
 * path would silently be someone else's tree. BFS over the declared deps of
 * the runtime package (and of each reached dependency), copied byte-identical
 * from the pinned 0.2.0-rc.2 tree.
 */
function installClosure() {
  const facts = { closureBfs: [], closureAddedFromStore: [] }
  const nm = join(EXP, 'node_modules')
  // Start from the runtime package's OWN installed dependency directory (the
  // 0.2.0-rc.2 tree this checkout was installed against), dereferenced so the
  // expansion has real files and no symlink can point back into the repo.
  const cpRoot = spawnSync('cp', ['-aL', `${DEPS_SRC}/.`, nm], { timeout: 600_000 })
  facts.copiedDeclaredTree = cpRoot.status === 0
  if (cpRoot.status !== 0 && !existsSync(nm)) facts.closureMiss = `cp ${DEPS_SRC}`
  // Then BFS the declared dependency graph (dependencies + peers + optionals:
  // pnpm materializes peers as real entries, so a peer-only package such as
  // `@deepseek-ai/cordis` is part of what an installed face must carry) and
  // fill anything the declared tree did not cover from the pnpm store.
  const declared = Object.keys(JSON.parse(readFileSync(join(EXP, 'packages/runtime/package.json'), 'utf8')).dependencies ?? {})
  const seen = new Set()
  const queue = [...declared]
  // Platform-specific optional natives: the installed tree only carries this
  // host's flavour, and a sibling `…-darwin-arm64` package is NOT a missing
  // dependency — it is unreachable by resolution here. Skipping (and
  // RECORDING) them is what keeps "BFS-complete" an honest claim instead of
  // one that breaks on the first foreign-platform entry.
  const HERE_OS = process.platform
  const HERE_ARCH = process.arch
  const KNOWN_OS_TOKENS = ['darwin', 'win32', 'macos', 'freebsd', 'openbsd', 'netbsd', 'sunos', 'android', 'aix', 'linux']
  const isForeignPlatform = (pkg) => {
    const tokens = pkg.toLowerCase().split(/[-/@_]/)
    const os = tokens.find((t) => KNOWN_OS_TOKENS.includes(t))
    if (os === undefined) return false
    return !(os === HERE_OS && tokens.includes(HERE_ARCH))
  }
  while (queue.length > 0) {
    const pkg = queue.shift()
    if (seen.has(pkg) || pkg.startsWith('@dsh-agent-team/')) continue
    seen.add(pkg)
    if (isForeignPlatform(pkg)) { (facts.closureSkippedForeignPlatform ??= []).push(pkg); continue }
    facts.closureBfs.push(pkg)
    const inner = join(nm, pkg)
    const srcDir = join(DEPS_SRC, pkg)
    if (!existsSync(join(inner, 'package.json'))) {
      let source = existsSync(srcDir) ? srcDir : null
      if (source === null && existsSync(DEPS_STORE)) {
        for (const dir of readdirSync(DEPS_STORE)) {
          const withInner = join(DEPS_STORE, dir, 'node_modules', pkg)
          if (existsSync(withInner)) { source = withInner; break }
        }
      }
      if (source === null) { facts.closureMiss = pkg; break }
      mkdirSync(dirname(inner), { recursive: true })
      const cp = spawnSync('cp', ['-aL', source, inner], { timeout: 180_000 })
      if (cp.status !== 0) { facts.closureMiss = `cp ${pkg}`; break }
      if (source !== srcDir) facts.closureAddedFromStore.push(pkg)
    }
    const pkgJson = join(inner, 'package.json')
    if (existsSync(pkgJson)) {
      const j = JSON.parse(readFileSync(pkgJson, 'utf8'))
      queue.push(...Object.keys(j.dependencies ?? {}), ...Object.keys(j.peerDependencies ?? {}), ...Object.keys(j.optionalDependencies ?? {}))
    }
  }
  facts.nodeModulesTop = existsSync(nm) ? readdirSync(nm).filter((n) => !n.startsWith('.')).length : 0
  writeEvidence('dependency-closure.json', facts)
  check('E2', 'the expansion carries its OWN node_modules: the runtime package\'s installed dependency tree copied dereferenced from the pinned 0.2.0-rc.2 install, BFS-verified over declared deps + peers + optionals (store-filled where absent; foreign-platform optional natives skipped and recorded)',
    facts.closureMiss === undefined && facts.nodeModulesTop > 0 && facts.copiedDeclaredTree === true,
    `bfs=${String(facts.closureBfs.length)} fromStore=${String(facts.closureAddedFromStore.length)} nmTop=${String(facts.nodeModulesTop)} skippedForeign=${JSON.stringify(facts.closureSkippedForeignPlatform ?? []).slice(0, 160)}${facts.closureMiss === undefined ? '' : ` miss=${facts.closureMiss}`}`)
  return facts
}

/**
 * The load graph, MEASURED through a module.resolve hook: the seven production
 * loads an installed row performs — the entry, the three live rows, the a5p5
 * register face, and the two files the entry loads LAZILY at apply time (the
 * resolve-hook file `module.register` names, and the seam candidate the entry
 * derives from its own module URL). `module.register` is LAZY — it never
 * throws for a missing file — so this load plus the real boot (A1) is what
 * settles the claim.
 */
function loadGraphProbe() {
  const rows = [ENTRY_PATH,
    join(EXP, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs'),
    join(EXP, 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs'),
    join(EXP, 'packages/runtime/dist/packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs'),
    join(EXP, 'packages/runtime/dist/packages/tools/a5p5-tools/src/register.js'),
    join(EXP, REL_RESOLVER_IN_MIRROR),
    join(EXP, REL_SEAM_IN_MIRROR)]
  // NO existence filter: a missing in-face runtime file must show up HERE as
  // ERR_MODULE_NOT_FOUND (that is the RED-A shape at load level), not be
  // silently skipped.
  const probe = spawnSync(process.execPath, ['-e', `
import { registerHooks } from 'node:module'
const EXP = ${JSON.stringify(pathToFileURL(EXP + '/').href)}
const foreign = []
let loaded = 0
registerHooks({
  resolve(specifier, context, nextResolve) {
    const r = nextResolve(specifier, context)
    const url = (r !== null && typeof r === 'object' && typeof r.url === 'string') ? r.url : (typeof r === 'string' ? r : undefined)
    if (url !== undefined && url.startsWith('file:')) {
      loaded += 1
      if (!url.startsWith(EXP)) foreign.push({ specifier, url: url.replace(/^file:\\/\\/\\/?[^/]*\\//, '<fs>/') })
    }
    return r
  },
})
const errors = []
for (const r of ${JSON.stringify(rows.map((p) => pathToFileURL(p).href))}) {
  try { await import(r) } catch (e) { errors.push({ row: r.replace(EXP, '<EXP>'), error: String(e && e.code ? e.code + ': ' + e.message : e).replace(EXP, '<EXP>').slice(0, 260) }) }
}
console.log(JSON.stringify({ rows: ${String(rows.length)}, loaded, errors, foreign: foreign.slice(0, 12), foreignCount: foreign.length }))
`], { encoding: 'utf8', timeout: 240_000 })
  let facts = { rows: 0, loaded: 0, errors: [], parseError: String(probe.stderr ?? '').slice(0, 400) }
  try { facts = JSON.parse(String(probe.stdout ?? '').trim()) } catch { /* keep parseError */ }
  writeEvidence('load-graph-probe.json', facts)
  return facts
}

// ───────────────────────────── blueprints (skill 口径) ─────────────────────────────
const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  '  persona: "You are the leader of the a5g6 GLUE-6 team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5g6 GLUE-6 team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

/**
 * The governed blueprint: v3, ONE complete LeaderTemplate, member `wa`, BOTH
 * governed through capabilities.permissions; the member allow-lanes the READ
 * CLASS and DENIES the shell class (team-blueprint-authoring §5.1 — no
 * positive shell permission for a member), which is what makes the trio's
 * team_bash a real DENY-LANE refusal instead of an accident; builtinToolDeny
 * = the discovery-derived deny list (never hardcoded).
 */
function mainBlueprintYaml(denyList) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const task = delegatedTask()
  const leaderPersona = `You are the leader of the a5g6 GLUE-6 team. On your directive: FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_DELG}, delegationTemplateId "wa", label "g6-a", async false, and the prompt ${JSON.stringify(task)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_DELG}"]; THIRD finish with one line starting A5G6_LEADER_DONE.`
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "a5g6 GLUE-6 governed team"',
    'description: "GLUE-6: the own-layer trio driven through the SHIPPED install face, to observe what the host delivers as tool result content."',
    'leader:', '  templateId: leader', `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5g6 worker A"',
    '    persona: "You are worker A of the a5g6 GLUE-6 team. Follow delegated work exactly."',
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []',
    '        deny:', '          - tool: bash', '            resource:', '              kind: any',
    'memberEnvelopes:', '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function rowConfig(blueprintDir) {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: ANCHOR_YAML,
    blueprintDir,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: MODEL },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    teamToolPlane: { realmId: `a5g6-realm-${POSTURE}` },
  }
}

// ───────────────────────────── wire digest (mock) ─────────────────────────────
function digestRequest(parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  const sys = typeof parsed?.system === 'string' ? parsed.system : Array.isArray(parsed?.system) ? JSON.stringify(parsed.system) : ''
  const toolNames = Array.isArray(parsed?.tools) ? parsed.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '') : null
  let text = sys
  const assistantToolNames = []
  const toolResults = []
  for (const m of msgs) {
    if (typeof m?.content === 'string') { text += '\u0001' + m.content; continue }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'text') text += '\u0001' + String(b.text ?? '')
      else if (b?.type === 'tool_use') { assistantToolNames.push(String(b.name ?? '')); text += '\u0001tool_use:' + String(b.name ?? '') + JSON.stringify(b.input ?? {}) }
      else if (b?.type === 'tool_result') {
        // The OBSERVATION POINT of GLUE-6: `content` is exactly what the
        // host's createSuccessResult put there — render()'s return value,
        // projected by the host onto the model-facing block list.
        const blocks = Array.isArray(b.content) ? b.content : null
        const rep = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        toolResults.push({
          toolUseId: String(b.tool_use_id ?? ''),
          wireType: blocks === null ? typeof b.content : 'array',
          blockTypes: blocks === null ? null : blocks.map((x) => String(x?.type ?? '??')),
          content: rep.slice(0, 500),
        })
        text += '\u0001tool_result:' + rep
      }
    }
  }
  const users = msgs.filter((m) => m?.role === 'user')
  const lastUser = users.length > 0 ? users[users.length - 1] : null
  return {
    msgCount: msgs.length,
    toolCount: toolNames === null ? 0 : toolNames.length,
    toolNames,
    assistantToolNames,
    toolResults,
    lastUserHead: String(typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content ?? '')).slice(0, 300),
    systemHead: sys.slice(0, 260),
    markerHits: [],
    hasDenyLane: text.includes('template-deny-lane'),
    hasIoRefusal: text.includes('IO_POLICY_UNSUPPORTED'),
    hasAssemblyCrash: text.includes('content.some is not a function'),
    _text: text,
  }
}

// ─────────────────────────────── world driver ───────────────────────────────
/**
 * Write the world's home + patch layer and spawn the pinned host from it.
 * Shared by both legs: `drive: false` (the RED-A posture) stops at the boot
 * line — the bootstrap outcome IS the measurement there, and driving a
 * broken world would only add noise.
 */
async function bootHost({ blueprintDir, drive, label, mock = null }) {
  const facts = { posture: POSTURE, surface: SURFACE, home: HOME, expansion: EXP, ok: false }
  if (existsSync(HOME)) die(`refusing to touch pre-existing home ${HOME}`)
  mkdirSync(join(HOME, 'workspace'), { recursive: true })
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  if (!(await portFreeWait(HOST_PORT))) die(`port ${HOST_PORT} not free before the ${label} world`)
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${POSTURE}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${POSTURE}.log`)
  mkdirSync(blueprintDir, { recursive: true })
  writeFileSync(join(blueprintDir, 'anchor.yaml'), ANCHOR_YAML)
  writeFileSync(TARGET_FILE, 'a5g6 target line one\nprefix A5G6_GREP_TARGET suffix\nthird line\n', 'utf8')

  const basePlugins = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5g6 GLUE-6 patch (run ${RUN_STAMP}, posture ${POSTURE}, surface ${SURFACE}): the UNFOLDED install face (${EXP}) + observer row + smoke preset — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: ENTRY_URL, config: rowConfig(blueprintDir) }, 2),
    ...yamlEmitItem({ id: 'a5g6-observer', name: OBSERVER_URL, config: {} }, 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: PRESET_ID, displayName: 'a5g6 base',
      description: `a5g6 base preset (run ${RUN_STAMP}) = smoke preset`,
      plugins: basePlugins,
    }), 2),
    '',
  ].join('\n'))

  const reqBase = mock === null ? 0 : mock.requests.length
  const stormCheck = (where) => {
    if (mock === null) return
    const mine = mock.requests.length - reqBase
    if (mine > STORM_LIMIT) {
      writeEvidence(`storm-diagnostic-${POSTURE}.json`, {
        where, worldRequests: mine, limit: STORM_LIMIT,
        sample: mock.requests.slice(reqBase, reqBase + 8).map((r) => ({
          seq: r.seq, path: r.path, status: r.status, error: r.error,
          digest: r.digest === undefined ? null : { ...r.digest, _text: undefined },
          reply: r.reply === undefined ? null : JSON.stringify(r.reply).slice(0, 200),
        })),
      })
      die(`MODEL-CALL STORM (${POSTURE}): ${String(mine)} requests at "${where}" (> ${String(STORM_LIMIT)})`)
    }
  }

  const outFd = openSync(INSTANCE_RAW, 'a')
  let hostExit = null
  const host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: join(HOME, 'workspace'),
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${String(MOCK_PORT)}`,
      DEEPSEEK_API_KEY: 'a5g6-mock-key',
    },
  })
  host.on('exit', (code, signal) => { hostExit = { code, signal } })

  const rawText = () => (existsSync(INSTANCE_RAW) ? readFileSync(INSTANCE_RAW, 'utf8') : '')
  const scanLines = (re) => rawText().split('\n').filter((l) => re.test(l)).map((l) => redact(l).slice(0, 500)).slice(0, 12)

  let cookie = null
  let origin = null
  try {
    if (drive === false) {
      // RED-A leg: the failing bootstrap and the boot marker are ORDER-
      // INDEPENDENT in the log (the row loads while the server is still
      // coming up; the historical capture has the failure FIRST and the
      // marker after). So wait for BOTH signals — the marker is the rig claim
      // that the host itself ran, the failure is the measurement — and stop
      // early when the host exits on its own.
      const deadline = Date.now() + 120_000
      for (;;) {
        const t = rawText()
        const m = BOOT_MARKER.exec(t)
        if (m !== null && facts.bootLine === undefined) {
          facts.bootLine = redact(String(m[0])).slice(0, 200)
          origin = `http://127.0.0.1:${String(m[1])}`
        }
        if (/bootstrap FAILED|ERR_MODULE_NOT_FOUND|Cannot find module/.test(t)) facts.bootstrapFailed = true
        if (facts.bootLine !== undefined && facts.bootstrapFailed === true) break
        if (hostExit !== null && facts.bootLine !== undefined) break
        if (Date.now() >= deadline) break
        await sleep(250)
      }
      await sleep(1_000)
    } else {
      const boot = await waitFor(120_000, () => {
        const m = BOOT_MARKER.exec(rawText())
        return m === null ? false : m
      }, `${label} boot marker`)
      facts.bootLine = redact(String(boot[0])).slice(0, 200)
      origin = `http://127.0.0.1:${String(boot[1])}`
      if (Number(boot[1]) !== HOST_PORT) die(`boot port mismatch ${String(boot[1])} (expected ${String(HOST_PORT)})`)
      const auth = await fetch(`${origin}/?token=${String(boot[2])}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
      cookie = auth.headers.get('set-cookie')
      if (!(auth.status === 303 && cookie !== null)) die(`${label} token gate ${String(auth.status)}`)
      const health = await waitFor(30_000, async () => {
        const h = await fetchJson(`${origin}/__a5g6/health`).catch(() => null)
        return h?.status === 200 && h.body?.applied === true ? h : false
      }, `${label} observer applied`)
      facts.observerHealth = { status: health.status, body: redact(health.text).slice(0, 200) }
    }
  } catch (e) {
    facts.bootError = String(e).slice(0, 400)
  }

  if (drive === false) {
    try {
      facts.moduleNotFoundLines = scanLines(/ERR_MODULE_NOT_FOUND|bootstrap FAILED|Cannot find module/)
      facts.assemblyCrashLines = scanLines(/content\.some is not a function/)
      facts.observerHealthReached = origin === null ? null : (await fetchJson(`${origin}/__a5g6/health`).catch(() => null))?.status ?? null
      facts.ok = true
    } catch (e) { facts.error = String(e).slice(0, 400) }
  } else {
    try {
      stormCheck('post-boot (NO prompt sent yet)')
      const wireHit = (needle) => mock.requests.slice(reqBase).find((r) => r.digest !== undefined && r.digest.markerHits.includes(needle) && r.digest.toolCount > 0)

      async function promptBarrier({ sessionId, textBase, rpcTag, attempts = 8, perAttemptMs = 25_000 }) {
        let lastStatus = 0
        for (let k = 1; k <= attempts; k += 1) {
          stormCheck(`barrier ${textBase.slice(0, 28)} attempt ${String(k)}`)
          const res = await fetchJson(`${origin}/api/session/prompt`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
            body: JSON.stringify({
              type: 'client-request', rpcId: `${rpcTag}-a${String(k)}`, method: 'session/prompt',
              payload: { args: { request: { requestId: `${rpcTag}-a${String(k)}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${textBase} (barrier probe ${String(k)}) This is a setup turn. Do not call any tools. Reply OK.` }] } } },
            }),
          }, 240_000)
          lastStatus = res.status
          const hit = await waitQuiet(perAttemptMs, async () => (wireHit(textBase) ?? false) !== false)
          const found = wireHit(textBase)
          if (found !== undefined) return { hit: found, attempts: k, lastStatus }
        }
        die(`barrier: no wire request for "${textBase}" after ${String(attempts)} prompt attempts (last HTTP ${String(lastStatus)})`)
      }

      // DISCOVERY turn on the BOOT root → the governed deny list (a5w7 law).
      const disc = await promptBarrier({ sessionId: ROOT, textBase: MK_DISC, rpcTag: 'a5g6-d' })
      facts.discPrompt = { attempts: disc.attempts, status: disc.lastStatus }
      const surface = [...new Set(disc.hit.digest.toolNames ?? [])].sort()
      const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
      facts.discoverySurface = surface
      facts.denyList = denyList
      writeFileSync(join(blueprintDir, 'main.yaml'), mainBlueprintYaml(denyList))

      // LIVE PRE-FLIGHT (team-blueprint-authoring §7): catalog.list + catalog.get.
      const cl = await fetchJson(`${origin}/team-remote/catalog.list`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'a5g6-pre-1', method: 'catalog.list', payload: { version: 4, params: {} } }),
      }, 30_000)
      const listed = JSON.stringify(cl.body ?? '').includes(BP_MAIN_ID)
      const cg = await fetchJson(`${origin}/team-remote/catalog.get`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'a5g6-pre-2', method: 'catalog.get', payload: { version: 4, params: { blueprintId: BP_MAIN_ID, blueprintRevision: 1 } } }),
      }, 30_000)
      facts.catalogPreflight = { listStatus: cl.status, listed, getStatus: cg.status, getErr: cg.status !== 200 ? redact(JSON.stringify(cg.body)).slice(0, 300) : null }
      facts.catalogPreflightOk = listed && cg.status === 200
      if (!(listed && cg.status === 200)) die(`blueprint pre-flight failed: ${JSON.stringify(facts.catalogPreflight).slice(0, 300)}`)

      const created = await fetchJson(`${origin}/team-remote/team.create`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'a5g6-tc', method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK_L0} Begin your directive.` } } } }),
      }, 90_000)
      facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 1400) }

      const first = await waitFor(240_000, async () => wireHit(MK_L0) ?? false, `${label} leader turn at the mock`)
      facts.leaderWireSeq = first.seq
      facts.leaderWireCatalog = first.digest.toolNames
      const chain = await waitFor(420_000, async () => {
        stormCheck('leader chain')
        const reqs = mock.requests.slice(reqBase).filter((r) => r.digest?.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
        if (reqs.length === 0) return false
        if (!reqs.some((r) => JSON.stringify(r.reply ?? '').includes('A5G6_LEADER_DONE'))) return false
        const last = reqs[reqs.length - 1]
        return { toolCalls: last.digest.assistantToolNames, backToLeader: last.digest._text.includes('A5G6_MEMBER_RESULT') }
      }, `${label} leader chain (delegate + collect + final reply)`)
      facts.leaderToolCalls = chain.toolCalls
      facts.memberResultBackToLeader = chain.backToLeader

      const memberReqs = mock.requests.slice(reqBase).filter((r) => r.digest?.markerHits.includes(MK_TASK) && !r.digest.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
      facts.memberRequestCount = memberReqs.length
      facts.memberWireCatalog = memberReqs[0]?.digest.toolNames ?? null
      const lastM = memberReqs[memberReqs.length - 1]
      facts.memberToolResults = lastM?.digest.toolResults ?? []
      facts.memberSawDenyLane = lastM?.digest.hasDenyLane ?? false
      facts.memberSawIoRefusal = lastM?.digest.hasIoRefusal ?? false
      facts.memberSawAssemblyCrash = memberReqs.some((r) => r.digest.hasAssemblyCrash === true)
      facts.memberFinalReply = memberReqs.find((r) => JSON.stringify(r.reply ?? '').includes('A5G6_MEMBER_RESULT'))?.reply ?? null
      const finalText = typeof facts.memberFinalReply === 'string' ? facts.memberFinalReply : JSON.stringify(facts.memberFinalReply ?? '')
      facts.memberFinalQuotedDenyLane = finalText.includes('template-deny-lane')
      facts.memberFinalQuotedIoRefusal = finalText.includes('IO_POLICY_UNSUPPORTED')
      // How many lane verdicts the member actually quoted back (its receipt of
      // what crossed the wire) — the chain claim, independent of WHICH stage.
      facts.memberVerdictCount = (/\bverdicts=([A-Za-z0-9_,-]+)/.exec(finalText)?.[1] ?? '').split(',').filter((c) => c.length > 0 && c !== 'none').length

      const factsRes = await fetchJson(`${origin}/__a5g6/facts`, { headers: { cookie: cookie ?? '' } }, 30_000)
      try {
        const parsed = JSON.parse(factsRes.text)
        facts.planeObservations = parsed.planeObservations ?? []
        facts.observerAgents = (parsed.agents ?? []).map((a) => ({
          session: a.session,
          scopedTeamNames: (a.scopedNames ?? []).filter((n) => n.startsWith('team_')),
          perName: a.perName,
        }))
        facts.globalAliasPresent = (parsed.globalNames ?? []).filter((n) => ALIASES.includes(n))
      } catch { facts.observerFactsParseError = redact(factsRes.text).slice(0, 200) }
      facts.ok = true
    } catch (e) {
      facts.error = String(e).slice(0, 600)
      facts.recentRequests = mock.requests.slice(-6).map((r) => ({
        seq: r.seq, path: r.path, status: r.status,
        textHead: String(r.digest?.lastUserHead ?? '').slice(0, 160),
        toolCalls: r.digest?.assistantToolNames ?? [],
        replyHead: r.reply === undefined ? null : JSON.stringify(r.reply).slice(0, 160),
      }))
    }
  }

  try {
    const lines = (mock === null ? [] : mock.requests.slice(reqBase)).map((r) => JSON.stringify({
      seq: r.seq, path: r.path, status: r.status,
      reply: r.reply === undefined ? null : redact(JSON.stringify(r.reply)).slice(0, 300),
      digest: r.digest === undefined ? null : {
        ...r.digest,
        markerHits: r.digest.markerHits.filter((x) => x.startsWith('A5G6')),
        systemHead: redact(r.digest.systemHead),
        lastUserHead: redact(r.digest.lastUserHead),
        toolResults: r.digest.toolResults.map((x) => ({ ...x, content: redact(x.content) })),
        _text: `${r.digest._text.length} chars`,
      },
    }))
    writeFileSync(join(EVIDENCE_DIR, `wire-digests-${POSTURE}.jsonl`), lines.join('\n') + (lines.length > 0 ? '\n' : ''))
  } catch { /* best effort */ }
  try { host.kill('SIGTERM') } catch { /* gone */ }
  await waitFor(15_000, async () => (hostExit !== null ? true : false), 'host exit').catch(() => { try { host.kill('SIGKILL') } catch { /* gone */ } })
  await sleep(500)
  try { writeFileSync(INSTANCE_LOG, redact(rawText())); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
  facts.swept = !existsSync(HOME)
  facts.hostExit = hostExit
  if (facts.moduleNotFoundLines === undefined) facts.moduleNotFoundLines = scanLines(/ERR_MODULE_NOT_FOUND|bootstrap FAILED|Cannot find module/)
  if (facts.assemblyCrashLines === undefined) facts.assemblyCrashLines = scanLines(/content\.some is not a function/)
  return facts
}

// ─────────────────────────────────── main ───────────────────────────────────
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })
async function main() {
  const t0 = Date.now()
  console.log(`# a5g6-install-kit posture=${POSTURE} surface=${SURFACE} stamp=${RUN_STAMP}`)
  console.log(`# worktree=${WORKTREE} testuse=${TESTUSE} hostBin=${existsSync(HOST_BIN) ? 'present' : 'MISSING'} exp=${EXP}`)
  if (!existsSync(HOST_BIN)) die(`host runtime not built at ${HOST_BIN}`)

  const stableBefore = await stableProbe()
  const porcelainBefore = String(spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout).trim()
  check('H3a', 'rig: :3080 probed READ-ONLY before the run (stable instance never signalled) and the test-use host tree is porcelain 0 before',
    porcelainBefore === '', `:3080=${String(stableBefore)} porcelain=${porcelainBefore === '' ? '0' : 'DIRTY'}`)

  const expFacts = expandSurface()
  installClosure()
  const graph = loadGraphProbe()

  const inFaceOk = expFacts.inFace.resolver === true && expFacts.inFace.seam === true
  check('E3', 'install face SELF-SUFFICIENCY (the fix under test / the gap under reproduction): the entry\'s two runtime .mjs — the module.register resolve hook and the default storage seam — sit INSIDE the unfolded face, at the package-internal paths the entry derives from its own module URL',
    POSTURE === 'green' ? inFaceOk : (inFaceOk === false),
    `posture=${POSTURE} inFace=${JSON.stringify(expFacts.inFace)} outOfFace=${JSON.stringify(expFacts.outOfFaceSiblings)} (a RED posture REQUIRES inFace=false: on pre-fix bytes the face carries neither file — that is the gap)`)

  const graphGreen = graph.rows === 7 && (graph.errors ?? []).length === 0 && graph.foreignCount === 0
  // A RED posture must fail on EXACTLY the two in-face runtime files and on
  // nothing else: a third error means the harness (or the closure) is broken,
  // which is not evidence about the install face.
  const inFaceNames = ['upstream-resolver.mjs', 'seam.mjs']
  const graphRed = (graph.errors ?? []).length === 2
    && (graph.errors ?? []).every((e) => /ERR_MODULE_NOT_FOUND/.test(String(e.error))
      && inFaceNames.some((n) => String(e.row).endsWith(n)))
    && graph.foreignCount === 0
  check('E4', 'load graph MEASURED through a module.resolve hook: the seven production loads (entry, three live rows, a5p5 register face, resolve-hook file, seam candidate) import from the expansion with FOREIGN file: modules = 0 — and on pre-fix bytes the ONLY failures are the two in-face runtime files',
    POSTURE === 'green' ? graphGreen : graphRed,
    `rows=${String(graph.rows)} loaded=${String(graph.loaded)} foreign=${String(graph.foreignCount ?? -1)} errors=${JSON.stringify(graph.errors ?? graph.parseError ?? null).slice(0, 300)}`)

  const mock = POSTURE === 'red-install' ? null : await startMockModel({
    port: MOCK_PORT,
    log: () => { /* quiet */ },
    decide: ({ req }) => {
      const digest = digestRequest(req)
      digest.markerHits = [MK_DISC, MK_L0, MK_TASK, 'A5G6_MEMBER_RESULT', 'A5G6_LEADER_DONE'].filter((mk) => digest._text.includes(mk))
      const rec = mock.requests[mock.requests.length - 1]
      if (rec !== undefined) rec.digest = digest
      const text = digest._text
      // The host's session-title generator quotes the transcript, so the
      // markers appear in ITS request text too. Answer it plainly: scripting a
      // tool call there would put a delegation into a title request.
      if (text.includes('Generate the session title')) return { kind: 'text', content: 'a5g6 governed trio proof' }
      if (digest.markerHits.includes(MK_DISC)) return { kind: 'text', content: 'A5G6_DISCOVERY_OK' }
      if (digest.markerHits.includes(MK_L0)) {
        const calls = digest.assistantToolNames
        if (calls.length === 0) {
          // ONE tool-call reply (the mock's only tool shape: kind
          // 'tool-call' with a toolCalls array — 'tool-calls' is not a kind
          // and the harness answers it 500).
          return toolCall(`call-a5g6-del-${rnd()}`, 'team_delegate', {
            rootSessionId: CREATE_ROOT, delegationTemplateId: 'wa', label: 'g6-a', requestToken: TK_DELG, async: false,
            prompt: delegatedTask(),
          })
        }
        if (calls.length === 1) return toolCall(`call-a5g6-collect-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestTokens: [TK_DELG] })
        return { kind: 'text', content: 'A5G6_LEADER_DONE' }
      }
      if (digest.markerHits.includes(MK_TASK)) {
        const calls = digest.assistantToolNames
        const target = /TARGET=(\S+)/.exec(text)?.[1] ?? '/a5g6-missing'
        if (calls.length === 0) return toolCall(`call-a5g6-bash-${rnd()}`, 'team_bash', { command: 'echo a5g6' })
        if (calls.length === 1) return toolCall(`call-a5g6-grep-${rnd()}`, 'team_grep', { pattern: 'A5G6_GREP_TARGET', path: target, output_mode: 'content' })
        // Quote the verdict codes the member ACTUALLY received, in order: the
        // final line is a receipt of what crossed the wire, not a restating of
        // what the script hoped the lane would answer.
        const verdicts = [...text.matchAll(/a5p5-refused kind=\S+ code=(\S+)/g)].map((m) => m[1])
        return {
          kind: 'text',
          content: `A5G6_MEMBER_RESULT verdicts=${verdicts.length > 0 ? verdicts.join(',') : 'none'} crash=${digest.hasAssemblyCrash ? 'content.some-is-not-a-function' : 'n/a'}`,
        }
      }
      return { kind: 'text', content: 'a5g6-mock: unscripted request, completing quietly.' }
    },
  })

  let w = {}
  try {
    w = await bootHost({
      blueprintDir: join(EVIDENCE_DIR, 'blueprints'),
      drive: POSTURE !== 'red-install',
      label: POSTURE,
      mock,
    }) ?? {}
  } finally {
    if (mock !== null) { try { await mock.close() } catch { /* gone */ } }
  }
  const results = w.memberToolResults ?? []
  const bashResult = results[0]?.content ?? ''
  const grepResult = results[1]?.content ?? ''
  const bashCode = /code=(\S+)/.exec(bashResult)?.[1] ?? ''
  const grepCode = /code=(\S+)/.exec(grepResult)?.[1] ?? ''
  const blocksLegal = results.length >= 2
    && results.every((r) => r.wireType === 'array' && (r.blockTypes ?? ['??']).length > 0 && (r.blockTypes ?? []).every((t) => t === 'text'))

  // A0 — RIG FIRST: the pinned host's web server must have come up in EVERY
  // posture. Without this a broken runtime (a missing dependency in the test
  // checkout, a port clash) would print as "ERR_MODULE_NOT_FOUND" and read
  // exactly like the gap this round is about — a criterion must not be
  // satisfiable by the rig falling over.
  check('A0', 'RIG: the pinned host (0.2.0-rc.2 @ 639ed01539) started its web server and answered the token gate in this posture (the boot marker line was written) — so every ERR_MODULE_NOT_FOUND below belongs to the PLUGIN bootstrap, not to the harness',
    typeof w.bootLine === 'string' && w.bootLine.includes('dsh web:'),
    `bootLine=${JSON.stringify(String(w.bootLine ?? '')).slice(0, 160)} bootError=${JSON.stringify(String(w.bootError ?? '')).slice(0, 200)} bootstrapFailedBeforeMarker=${String(w.bootstrapFailedBeforeMarker ?? false)}`)

  if (POSTURE === 'red-install') {
    const redA = (w.moduleNotFoundLines ?? []).some((l) => /ERR_MODULE_NOT_FOUND|Cannot find module/.test(l)
      && /upstream-resolver\.mjs|root-binding\/harness\/seam\.mjs/.test(l))
    check('A1', 'RED-A REPRODUCED ON THIS BASE COMMIT: the strict face FAILS THE PLUGIN BOOTSTRAP with ERR_MODULE_NOT_FOUND NAMING the in-face runtime file the shipped entry loads (the resolve hook it registers / the storage seam it imports) — the same defect the INSTALL-ENTRY kit recorded on 2026-10-17T17-06-56Z',
      redA === true, `moduleNotFoundLines=${JSON.stringify(w.moduleNotFoundLines ?? []).slice(0, 700)} bootError=${JSON.stringify(String(w.bootError ?? '')).slice(0, 240)}`)
  } else if (POSTURE === 'green') {
    check('A1', 'BOOT ON THE STRICT FACE (the same unfolding RED-A booted RED): the shipped entry APPLIES — zero ERR_MODULE_NOT_FOUND / bootstrap-FAILED lines — the resolve hook and the storage seam load from INSIDE the install face, and the observer row answers /__a5g6/health applied:true',
      (w.moduleNotFoundLines ?? []).length === 0 && String(w.observerHealth?.body ?? '').includes('"applied":true'),
      `observerHealth=${JSON.stringify(w.observerHealth ?? null).slice(0, 200)} moduleNotFound=${JSON.stringify(w.moduleNotFoundLines ?? []).slice(0, 300)} bootError=${JSON.stringify(String(w.bootError ?? '')).slice(0, 240)}`)
  } else {
    check('A1', 'AUX surface BOOTS on pre-fix bytes (the tracked siblings patched in, as a git install of the whole repo would have them): the RED-② leg needs a running host to crash in',
      String(w.observerHealth?.body ?? '').includes('"applied":true'),
      `observerHealth=${JSON.stringify(w.observerHealth ?? null).slice(0, 200)} bootError=${JSON.stringify(String(w.bootError ?? '')).slice(0, 240)}`)
  }

  // The live legs need a driven world; the RED-A posture stops at the boot
  // line on purpose (the bootstrap outcome IS the measurement — driving a
  // world whose plugin never applied would only add noise).
  if (POSTURE !== 'red-install') {
  const planePlaced = (w.planeObservations ?? []).some((o) => String(o).includes('a5-plane: placed'))
  check('L0', 'the plane mounted on this governed world and the placement reached the MODEL-FACING WIRE of the governed member (own-layer trio in the member tool catalog; the assembly logged its placement rows)',
    planePlaced === true && ALIASES.every((n) => (w.memberWireCatalog ?? []).includes(n)),
    `planeObservations=${JSON.stringify((w.planeObservations ?? []).slice(0, 3)).slice(0, 300)} memberWire team_*=${JSON.stringify([...new Set((w.memberWireCatalog ?? []).filter((n) => n.startsWith('team_')))].slice(0, 8))} globalAliases=${JSON.stringify(w.globalAliasPresent ?? [])}`)

  if (POSTURE === 'red-render') {
    check('L1', 'RED-② REPRODUCED LIVE: the member\'s own-layer trio call reached the host and what the MODEL RECEIVED as tool result content is the host ASSEMBLY CRASH (content.some is not a function) — a String from render() is not ContentBlock[], so the lane verdict never arrives',
      w.memberSawAssemblyCrash === true && w.memberSawDenyLane === false,
      `crash=${String(w.memberSawAssemblyCrash)} sawDenyLane=${String(w.memberSawDenyLane)} crashLines=${JSON.stringify(w.assemblyCrashLines ?? []).slice(0, 240)} results=${JSON.stringify(results).slice(0, 400)}`)
  } else {
    check('L1', 'RENDER CONTRACT HOLDS LIVE: both own-layer trio calls produced tool results whose model-facing content is a LEGAL ContentBlock[] (one typed text block each) and NO content.some crash appears anywhere in the instance log',
      blocksLegal === true && w.memberSawAssemblyCrash === false && (w.assemblyCrashLines ?? []).length === 0,
      `blocksLegal=${String(blocksLegal)} crash=${String(w.memberSawAssemblyCrash)} results=${JSON.stringify(results).slice(0, 500)} crashLines=${JSON.stringify(w.assemblyCrashLines ?? []).slice(0, 200)}`)
    check('L2', 'THE LANE VERDICT IS WHAT THE MODEL RECEIVES: each own-layer trio call came back as an `a5p5-refused kind=… code=…` lane verdict delivered as refusal TEXT inside a legal block — the verdict reaches the model instead of crashing the assembly (which stage produced it is recorded by G1, not assumed here)',
      /a5p5-refused kind=\S+ code=\S+/.test(bashResult) && /a5p5-refused kind=\S+ code=\S+/.test(grepResult),
      `bash=${JSON.stringify(bashResult).slice(0, 300)} grep=${JSON.stringify(grepResult).slice(0, 300)}`)
    check('L3', 'the chain is intact end-to-end: the leader scripted team_delegate + team_collect, the delegated directive ran on the member, and the member final — quoting the verdict codes it received — came back into the leader transcript',
      ['team_delegate', 'team_collect'].every((n) => (w.leaderToolCalls ?? []).includes(n)) && w.memberResultBackToLeader === true && w.memberVerdictCount >= 2,
      `leaderToolCalls=${JSON.stringify(w.leaderToolCalls ?? [])} memberReqs=${String(w.memberRequestCount)} backToLeader=${String(w.memberResultBackToLeader)} verdictCount=${String(w.memberVerdictCount ?? -1)} final=${JSON.stringify(w.memberFinalReply ?? null).slice(0, 240)}`)
    // G1 — GAP PROBE (RECORDED, NOT fixed by this round): the plane's lane
    // re-check is keyed on the mounted ALIAS names while the lane's effect
    // declaration speaks the NATIVE class name, so what stops these calls is
    // not the template deny lane. This round's contract is the RENDER shape
    // (a verdict reaches the model at all); which stage refuses belongs to the
    // lane decide and is reported here, not silently expanded.
    check('G1', 'GAP PROBE — recorded, NOT fixed here: the member template DENIES the bash class and gives no grep/glob coverage, so the deny lane (code=template-deny-lane) is where these calls should be answered. The MEASURED stage is recorded: any code other than template-deny-lane means createLaneDecide (team-tool-plane.mjs:205-226 — bashNames/fileNames hold the mounted ALIASES) never matches the effect the lane declares (a5p5 effects-schema.ts:77 `toolName = parsed.tool`, the NATIVE class), i.e. the deny-lane fast path is inert for the plane tools. Reported to the parent; outside GLUE-6 scope',
      bashCode.length > 0 && grepCode.length > 0,
      `bashCode=${bashCode || 'none'} grepCode=${grepCode || 'none'} denyLaneExpected=template-deny-lane denyLaneSeen=${String(w.memberSawDenyLane)}`)
  }
  }

  const stableAfter = await stableProbe()
  const porcelainAfter = String(spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout).trim()
  check('H3b', 'rig: :3080 unchanged (identical read-only probe before/after; never POSTed) and the test-use host tree porcelain 0 after',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? '0' : 'DIRTY'}`)
  check('C1', 'cleanup: the DSH_HOME world swept (TEST_METHODS §7)', w.swept === true, `home=${HOME} swept=${String(w.swept)}`)
  if (!KEEP) { try { rmSync(EXP, { recursive: true, force: true }) } catch { /* best effort */ } }
  const leakScan = []
  for (const f of readdirSync(EVIDENCE_DIR)) {
    if (!/\.(log|json|jsonl|yml|txt|yaml)$/.test(f)) continue
    const t = readFileSync(join(EVIDENCE_DIR, f), 'utf8')
    if (/token=[A-Za-z0-9]{12,}|dsh_session=[A-Za-z0-9]{12,}/.test(t)) leakScan.push(f)
  }
  check('C2', 'evidence hygiene: every written file passes the token/cookie leak scan (redactions applied at write time)', leakScan.length === 0, `leaks=${JSON.stringify(leakScan)} dir=${EVIDENCE_DIR}`)

  writeEvidence('world-facts.json', w)
  writeEvidence('criteria.json', {
    posture: POSTURE, surface: SURFACE, runStamp: RUN_STAMP,
    worktree: WORKTREE, worktreeHead: expFacts.head,
    hostRuntime: { path: relative(WORKTREE, TESTUSE), sha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    ports: { host: HOST_PORT, mock: MOCK_PORT },
    passCount: CRITERIA.filter((c) => c.pass).length, failCount: CRITERIA.filter((c) => !c.pass).length, criteria: CRITERIA,
  })
  console.log(`SUMMARY posture=${POSTURE} pass=${String(CRITERIA.filter((c) => c.pass).length)} fail=${String(CRITERIA.filter((c) => !c.pass).length)} of ${String(CRITERIA.length)} in ${String(Math.round((Date.now() - t0) / 1000))}s dir=${EVIDENCE_DIR}`)
  if (CRITERIA.some((c) => !c.pass)) process.exitCode = 1
}

// The mock's delegate prompt needs the target path, which lives inside the
// world's workspace: TARGET_FILE (top of file) is its single source.

main().catch((e) => {
  CRITERIA.push({ id: 'FATAL', description: 'kit run threw', pass: false, evidence: String(e && e.stack ? e.stack : e).slice(0, 800) })
  try { writeEvidence('criteria.json', { posture: POSTURE, surface: SURFACE, runStamp: RUN_STAMP, threw: String(e).slice(0, 900), criteria: CRITERIA }) } catch { /* dir gone */ }
  console.error('FATAL:', String(e && e.stack ? e.stack : e).slice(0, 1600))
  process.exitCode = 1
})
