#!/usr/bin/env bash
# AC-1 mutation controls: each mutation is applied to the port source, the
# AC-1 C1 suite is run, the source is restored byte-exactly (git checkout).
# Expected: every mutation turns at least one named leg RED.
set -u
cd "$(git rev-parse --show-toplevel)"
F=packages/tools/agent-control-family/src/agent-runtime-port.mjs
run() {
  echo "=== $1"
  (cd packages/runtime && npx vitest run test/u7-ac1-subagents-port-c1.test.ts 2>&1 | grep -E "^ +×|Tests ")
  git checkout -- "$F"
  git diff --quiet -- "$F" && echo "restored: $F clean"
}
# M1: drop the forced toolFilter from the child start request.
sed -i 's/^        toolFilter: TIER_A_CHILD_TOOL_FILTER,$/        \/\/ M1 mutation: toolFilter removed/' "$F"
grep -q "M1 mutation" "$F" || { echo "M1 not applied"; exit 1; }
run "M1 remove toolFilter"
# M2: resolve the experimental agentTeams face again (listAgents leg).
sed -i "s/face('listAgents', \['subagents'\]/face('listAgents', ['agentTeams', 'subagents']/" "$F"
grep -q "face('listAgents', \['agentTeams'" "$F" || { echo "M2 not applied"; exit 1; }
run "M2 resolve agentTeams for listAgents"
# M3: resolve agentTeams for the spawn leg.
sed -i "s/face(leg, \['subagents'\]/face(leg, ['agentTeams', 'subagents']/" "$F"
grep -q "face(leg, \['agentTeams'" "$F" || { echo "M3 not applied"; exit 1; }
run "M3 resolve agentTeams for spawn/fork"
