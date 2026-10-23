import sys
p = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/dev/agent-workflow/evidence/a5m2-g6host/kit/g6-host-kit.mjs'
s = open(p).read()
n = 0
def rep(old, new):
    global s, n
    assert old in s, 'MISSING: ' + old[:90].replace('\n', '\\n')
    assert s.count(old) == 1, 'AMBIGUOUS: ' + old[:60].replace('\n', '\\n')
    s = s.replace(old, new, 1)
    n += 1

# root 874-validator card: ONE config commit; minimal legal EMPTY shapes only —
# an empty facts array asserts "no static declarations", never a capability,
# and no persona/provider/tool-availability may be fabricated to pass.
rep(R"""function writeG6PatchFile(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const rowConfig = {""",
R"""/** THE single source of the row config (root card): preflight validates the
 *  SAME object that lands in the patch layer — via the installed pack's REAL
 *  exported validateTeamPluginConfig, never a YAML parse stand-in. */
function rowConfigFields() {
  return {""")
rep(R"""    teamToolPlane: { sessionQuery: true },""",
R"""    teamToolPlane: { sessionQuery: true },
    // Root-ruled minimal LEGAL shapes (874 validateTeamPluginConfig fails
    // closed on ABSENT keys; the first boot died exactly here): null/empty
    // means NO static declaration — it asserts nothing about capabilities
    // and no fact is fabricated to please the validator (real authority is a
    // later, separate verification).
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },""")
rep(R"""    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const lines = [""",
R"""    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
}

function writeG6PatchFile(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const rowConfig = rowConfigFields()
  const lines = [""")

# preflight: replay the REAL exported validator against the FINAL row object
rep(R"""  ck('installed-seam-present', existsSync(INSTALLED_SEAM), INSTALLED_SEAM)""",
R"""  ck('installed-seam-present', existsSync(INSTALLED_SEAM), INSTALLED_SEAM)
  // The row's REAL validator replay, BEFORE any spawn: the installed pack's
  // own EXPORTED validateTeamPluginConfig answers on the FINAL row object
  // (this same object is what lands in the patch layer). No YAML stand-in.
  let rowValidator = 'validator-export-unavailable'
  try {
    const hostMod = await import(pathToFileURL(INSTALLED_HOST_JS).href)
    if (typeof hostMod.validateTeamPluginConfig === 'function') {
      hostMod.validateTeamPluginConfig(rowConfigFields())
      rowValidator = 'validated-OK'
    }
  } catch (e) {
    rowValidator = `REJECTED: ${String(e?.message ?? e).slice(0, 180)}`
  }
  ck('row-validator-replay-on-real-row', rowValidator === 'validated-OK', rowValidator)""")

open(p, 'w').write(s)
print(f'row-config card applied: {n} replacements')
