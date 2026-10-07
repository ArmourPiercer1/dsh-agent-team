// Throwaway (lane C-testkit §7.4): assemble every Blueprint document a
// kit/mock-emitter emits BY ITS OWN CODE, in two worlds — PRISTINE (bytes
// from the pre-migration copies under scratch/pristine/) and CURRENT
// (working tree) — so (a) the harness is provably faithful (it runs the
// file's own builders/consts at the file's own directory depth, so every
// relative import resolves exactly as the real module's do), and (b) the
// emitted-byte diff per document IS the migration.
//
// Nothing ever boots: main-guarded kits are imported with their own entry
// guard CLOSED (argv[1] is the driver, not the copy); unguarded emitters
// are copied TRUNCATED to the line before `async function main`
// (definitions only) under a dot-name in their own directory, and both
// temp files are deleted right after the spawn. No host, no port, no
// writes under tests/homes/**.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const PRISTINE = 'dev/agent-workflow/evidence/a4-pr7/7-4-ctk/scratch/pristine'
const OUT = 'dev/agent-workflow/evidence/a4-pr7/7-4-ctk/scratch/kit-docs'
mkdirSync(OUT, { recursive: true })

// docs: JS expression evaluated INSIDE the (copied) module scope; must
// produce {docName: yamlString}. import:true => the module's own entry
// guard keeps main() closed when imported, so the FULL text is used.
// Guard sites: mcp-initial-grant L1402-1406, model-pref L1563-1567,
// f15 L1765-1774, rc2 L2095; exec-contract blueprint.mjs is a pure
// library module (no entry section at all).
const SPEC = {
  'tests/mock/scripts/boot.mjs': {
    docs: `({ 'BLUEPRINT_DOC': BLUEPRINT_DOC })`,
  },
  'tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs': {
    docs: `({ 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'saved/empty-deny': savedBlueprintYaml('team.c1-saved', 'lp', 'wp', []), 'saved/deny': savedBlueprintYaml('team.c1-saved', 'lp', 'wp', ['subagent']) })`,
  },
  'tests/kits/exec-contract-live-smoke/blueprint.mjs': {
    import: true, // pure library module: no entry section, no side effects
    docs: `({ 'scenario/exec-token-false': scenarioBlueprintYaml('team.exec', 'lp', 'wp', false, []), 'scenario/exec-token-true': scenarioBlueprintYaml('team.exec', 'lp', 'wp', true, []), 'anchor': anchorBlueprintYaml('team.exec-anchor', 'persona') })`,
  },
  'tests/kits/f15-mcp-live-loss-smoke/f15-mcp-live-loss-smoke.mjs': {
    import: true,
    docs: `({ 'f15': f15BlueprintYaml('lp', 'wp'), 'BP_ANCHOR_YAML': BP_ANCHOR_YAML })`,
  },
  'tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs': {
    import: true,
    docs: `({ 'saved': savedBlueprintYaml('team.mgis', 'lp', ['mcp-a'], []), 'BP_ANCHOR_YAML': BP_ANCHOR_YAML })`,
  },
  'tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs': {
    import: true,
    docs: `({ 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'main': savedMainBlueprintYaml(), 'role': savedRoleBlueprintYaml('team.mpr-role', 'm1', 'm2') })`,
  },
  'tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs': {
    docs: `({ 'T_PS': T_PS_BLUEPRINT_YAML, 'BOOT_SAVED': BOOT_BLUEPRINT_SAVED_YAML })`,
  },
  'tests/kits/pr-c-mcp-isolation-smoke/pr-c-mcp-isolation-smoke.mjs': {
    docs: `({ 'mcp-team': mcpTeamBlueprintYaml('team.prc-t1', 'lp', ['A', 'B']), 'workflow-team': workflowTeamBlueprintYaml('team.prc-tw', 'lp', 'wp'), 'BP_ANCHOR_YAML': BP_ANCHOR_YAML })`,
  },
  'tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs': {
    docs: `({ 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'saved/empty-deny': savedBlueprintYaml('team.prd', []), 'saved/deny': savedBlueprintYaml('team.prd', ['web_search']) })`,
  },
  'tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs': {
    docs: `({ 'main': mainTeamBlueprintYaml(), 'iso': isoTeamBlueprintYaml(), 'persona': personaTeamBlueprintYaml(), 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'V1_ANCHOR_SOURCE': V1_ANCHOR_SOURCE })`,
  },
  'tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs': {
    docs: `({ 'main': mainTeamBlueprintYaml(), 'subagent': subagentTeamBlueprintYaml(), 'spill': spillTeamBlueprintYaml(), 'iso': isoTeamBlueprintYaml(), 'persona': personaTeamBlueprintYaml(), 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'V1_ANCHOR_SOURCE': V1_ANCHOR_SOURCE })`,
  },
  'tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs': {
    import: true,
    docs: `({ 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'saved/empty-deny': savedBlueprintYaml('team.rc2', 'lp', 'wp', []), 'saved/deny': savedBlueprintYaml('team.rc2', 'lp', 'wp', ['web_search']) })`,
  },
  'tests/kits/send-message-liveness-smoke/send-message-liveness-smoke.mjs': {
    docs: `({ 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'saved/empty-deny': savedBlueprintYaml('team.sml', 'lp', 'wp', []), 'saved/deny': savedBlueprintYaml('team.sml', 'lp', 'wp', ['subagent']) })`,
  },
  'tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs': {
    docs: `({ 'TVS': TVS_BLUEPRINT_YAML })`,
  },
  'tests/kits/work-completion-wakeup-smoke/work-completion-wakeup-smoke.mjs': {
    docs: `({ 'BP_ANCHOR_YAML': BP_ANCHOR_YAML, 'saved/empty-deny': savedBlueprintYaml('team.wcn', 'lp', 'wp', []), 'saved/deny': savedBlueprintYaml('team.wcn', 'lp', 'wp', ['subagent']) })`,
  },
}

const world = process.argv[2] // 'pristine' | 'current'
if (world !== 'pristine' && world !== 'current') throw new Error('world arg required')
const results = {}
for (const [kitPath, spec] of Object.entries(SPEC)) {
  const text = world === 'pristine'
    ? readFileSync(join(PRISTINE, kitPath), 'utf8')
    : readFileSync(join(ROOT, kitPath), 'utf8')
  const kitDir = join(ROOT, dirname(kitPath))
  const copyName = `.a474ctk-harness-${world}.mjs`
  const copyPath = join(kitDir, copyName)
  let body
  if (spec.import) {
    body = `${text}\nexport const __A474_DOCS__ = await (${spec.docs});\n`
  } else {
    const m = text.match(/^async function main\b/m)
    if (!m) throw new Error(`no main boundary in ${kitPath}`)
    body = `${text.slice(0, m.index)}\nexport const __A474_DOCS__ = await (${spec.docs});\n`
  }
  writeFileSync(copyPath, body, 'utf8')
  const driver = join(kitDir, `.a474ctk-driver-${world}.mjs`)
  writeFileSync(driver, `const m = await import(${JSON.stringify('./' + copyName)})\nconsole.log(JSON.stringify(m.__A474_DOCS__))\n`, 'utf8')
  const run = spawnSync(process.execPath, [driver], { cwd: ROOT, encoding: 'utf8', timeout: 60_000 })
  rmSync(copyPath, { force: true })
  rmSync(driver, { force: true })
  if (run.status !== 0) {
    results[kitPath] = { error: (run.stderr || run.stdout).slice(0, 2000) }
    console.error(`FAIL ${kitPath}\n${(run.stderr || run.stdout).slice(0, 700)}`)
    continue
  }
  try {
    results[kitPath] = JSON.parse(run.stdout.slice(run.stdout.indexOf('{')))
  } catch {
    results[kitPath] = { error: `unparsable stdout: ${run.stdout.slice(0, 400)}` }
  }
}
const outFile = join(OUT, `docs-${world}.json`)
writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8')
const errs = Object.entries(results).filter(([, v]) => v.error)
console.log(`wrote ${outFile}; modules=${Object.keys(results).length}; errors=${errs.length}`)
for (const [k] of errs) console.error(`  errored: ${k}`)
