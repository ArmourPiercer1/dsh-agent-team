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

i0 = s.index('const BLUEPRINT_YAML = `---')
i1 = s.index('\n`\n', i0) + 3
NEW_BP = '''// SCHEMA v3 (root final minimal-field card, anchored on the image lane's
// RUN BP_ANCHOR_YAML/savedBlueprintYaml STRUCTURE ONLY — no image rules, no
// worker-message permissions, no available:true copied): schemaVersion 1->3,
// the two new v3 top-level envelopes with empty rule sets, explicit
// memberEnvelopes: [] (workers inherit NOTHING from the leader), and the
// skills/mcp grammar {kind: deny, items: []} -> {kind: deny} (denial kept,
// never allow). EVERYTHING ELSE IS UNCHANGED: leader tool list, teamEnvelope
// (archive/resolve included), permissions default ask + empty lanes,
// requirements persona/standard, quotas, policyStates, displayName/description.
// If the REAL 874 parser rejects any retained field, that is reported as the
// actual blocker — no silent semantic edits.
const BLUEPRINT_YAML = `---
schemaVersion: 3
blueprintId: ${BLUEPRINT_ID}
revision: "1"
displayName: "G6 session-query acceptance world"
description: "One boot; leader + archivable worker w1 + fresh worker w2 (C8 shape)."
leader:
  templateId: leader
  persona: "You lead this team. Follow the scripted instructions literally; never improvise extra tool calls."
  capabilities:
    teamTools:
      kind: allow
      items:
        - team_list_members
        - team_list_templates
        - team_inspect_config
        - team_create_member
        - team_delegate
        - team_follow_up
        - team_collect
        - team_send_message
        - team_report_progress
        - team_request_control
        - team_resolve_control
        - team_list_pending_control
        - team_archive_member
    builtinToolDeny:
      - subagent_fork
    skills:
      kind: deny
    mcp:
      kind: deny
    permissions:
      default: ask
      allow: []
      ask: []
      deny: []
teamEnvelope:
  allow:
    - assign-task
    - create-member
    - send-message
    - report-progress
    - request-control
    - resolve-control
    - archive-member
    - restore-member
  deny: []
members:
  - templateId: worker
    displayName: "Worker"
    persona: "You are a worker. Do exactly what each prompt says and answer briefly."
    capabilities:
      teamTools:
        kind: deny
      builtinToolDeny:
        - subagent_fork
      skills:
        kind: deny
      mcp:
        kind: deny
      permissions:
        default: ask
        allow: []
        ask: []
        deny: []
memberEnvelopes: []
requirements:
  - domain: persona
    name: standard
permissionMutationEnvelope:
  rules: []
teamHardEnvelope:
  rules: []
policyStates:
  - id: default
    description: "Default state."
quotas:
  team:
    maxInstances: 4
    maxConcurrent: 3
  members:
    maxInstances: 2
    maxConcurrent: 2
metadata: {}
---
`
'''
s = s[:i0] + NEW_BP + s[i1:]
n += 1

rep(R"""const INSTALLED_GLUE = realpathSync(join(PACK_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs'))""",
R"""const INSTALLED_GLUE = realpathSync(join(PACK_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs'))
const INSTALLED_BLUEPRINT_VALIDATE = realpathSync(join(PACK_ROOT, 'packages/runtime/dist/packages/domain/blueprint/src/validate.js'))""")

# preflight #14: the REAL canonical parser (parseBlueprint -> validateBlueprintDocument)
rep(R"""  ck('row-validator-replay-on-real-row', rowValidator === 'validated-OK', rowValidator)""",
R"""  ck('row-validator-replay-on-real-row', rowValidator === 'validated-OK', rowValidator)
  // The blueprint's OWN canonical parser in the installed 874 (exported
  // parseBlueprint; the row validator does NOT substitute): answers on the
  // EXACT inline source that lands in blueprintSource. Non-empty, non-row.
  let bpParser = 'parser-export-unavailable'
  try {
    const bpMod = await import(pathToFileURL(INSTALLED_BLUEPRINT_VALIDATE).href)
    if (typeof bpMod.parseBlueprint === 'function') {
      const core = bpMod.parseBlueprint(BLUEPRINT_YAML)
      bpParser = core?.schemaVersion === 3 && typeof core?.contentHash === 'string'
        ? `OK schemaVersion=3 contentHash=${String(core.contentHash).slice(0, 16)}…`
        : `UNEXPECTED shape: schemaVersion=${String(core?.schemaVersion)}`
    }
  } catch (e) {
    bpParser = `REJECTED: ${String(e?.message ?? e).slice(0, 240)}`
  }
  ck('blueprint-parser-replay-on-real-source', bpParser.startsWith('OK schemaVersion=3'), bpParser)""")

open(p, 'w').write(s)
print(f'v3 final card: {n} operations')
