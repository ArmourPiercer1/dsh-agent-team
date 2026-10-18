// root 21:15Z flip-drift RAW round-trip transcript (coordinator unit 2 deliverable).
// Loads the COMMITTED DIST surface (byte-identical mirror of src) so plain node
// resolves the cross-package .js imports; the host bundle is only ever READ —
// the disabled->enabled flip is an in-memory fixture. Prints the actual refusal
// verdicts for subagent_codex / subagent_claude_code in BOTH directions.
// Run: node dev/agent-workflow/evidence/alpha5/pindir/flip-drift-repro.mjs <repo>
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(process.argv[2] ?? '.')
const { findTestRepoRoot, TEST_USE_REL, TEST_USE_BASELINE_SHA } = await import(pathToFileURL(path.resolve(REPO, 'tests/paths.mjs')).href)
const plane = await import(pathToFileURL(path.resolve(REPO, 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
const LAUNCHER = path.join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = path.join(REPO, 'tests/homes', `a5pindir-flip-repro-${Date.now().toString(36)}`)
const ROOT_DIR = path.join(WORLD, 'root')
mkdirSync(path.join(ROOT_DIR, 'data'), { recursive: true })
writeFileSync(path.join(ROOT_DIR, 'data', 'x.txt'), 'TOK\n')
const tree = path.join(findTestRepoRoot(REPO), TEST_USE_REL)
const sha = execFileSync('git', ['-C', tree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const ALLOW_ALL = { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] }
const names = ['subagent_codex', 'subagent_claude_code']
const presets = ['web-app/presets/cordis.patch.yml', 'web-app/presets/ptc.patch.yml', 'web-app/presets/standard.patch.yml']
const blocks = (doc, name) => doc.split(/\n(?=\s*- id:)/).filter((b) => b.includes(`toolName: ${name}`) && /provider:\s*(codex|claude-code)\b/.test(b))
const flip = (doc) => doc.split(/\n(?=\s*- id:)/)
  .map((b) => (names.some((n) => blocks(doc, n).includes(b)) ? b.replace(/disabled:\s*true/, 'enabled: by-fixture') : b))
  .join('\n')
const assemblyVerdict = (name) => {
  const built = plane.createTeamToolPlaneAssembly({
    permissionPolicy: ALLOW_ALL, realmId: 'r', templateId: 't', role: 'member', instanceId: 'i',
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'f', rootDir: ROOT_DIR, realmId: 'r', kind: 'absolute-path' },
      confinedProvider: { trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`, assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 } },
      names: { ...plane.DEFAULT_PLANE_NAMES, glob: name },
    },
  })
  return built.ok === true ? JSON.stringify({ ok: true, ownNames: built.value.ownNames }) : JSON.stringify({ ok: false, code: built.code })
}
console.log(`host tree @ ${sha.slice(0, 10)} (pin ${sha === TEST_USE_BASELINE_SHA ? 'MATCH' : 'MOVED'})`)
for (const name of names) {
  console.log(`\n==== ${name} ====`)
  console.log(`pinned in PLANE_RESERVED_NATIVE: ${plane.PLANE_RESERVED_NATIVE.includes(name)}`)
  for (const rel of presets) {
    const doc = readFileSync(path.join(tree, 'packages/bundle', rel), 'utf8')
    const pre = blocks(doc, name)
    const post = blocks(flip(doc), name)
    console.log(`  ${rel}`)
    console.log(`    direction A shipped-disabled: block disabled=[${pre.map((b) => /disabled:\s*true/.test(b))}]`)
    console.log(`    direction B flipped-enabled : block disabled=[${post.map((b) => /disabled:\s*true/.test(b))}] fixture-marker=[${post.map((b) => /enabled: by-fixture/.test(b))}]`)
  }
  const D = plane.DEFAULT_PLANE_NAMES
  for (const direction of ['A shipped-disabled', 'B flipped-enabled']) {
    const v = plane.verifyPlaneNames({ ...D, glob: name }, 'read')
    const a = assemblyVerdict(name)
    console.log(`  [${direction}] verifyPlaneNames(glob='${name}') -> code=${v.code} message="${v.message}"`)
    console.log(`  [${direction}] assembly(names.glob='${name}')  -> ${a}`)
  }
  console.log(`  host bundle after fixture: git status --porcelain = "${execFileSync('git', ['-C', tree, 'status', '--porcelain'], { encoding: 'utf8' }).trim()}"`)
}
rmSync(WORLD, { recursive: true, force: true })
