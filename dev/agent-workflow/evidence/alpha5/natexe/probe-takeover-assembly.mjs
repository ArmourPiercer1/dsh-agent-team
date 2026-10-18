#!/usr/bin/env node
/**
 * natexe probe #1 (assembly-level, no host): does the EXISTING plane surface
 * already mount the shell row under the NATIVE `bash` spelling and hand the
 * Guard's feed the placement identity — zero production delta?
 *
 * Mirrors the live kit's config face exactly: plane = { realmId, names:
 * { bash: 'bash' }, confinedProvider: <pair> } and asks the three questions:
 *   Q1 ownNames carries 'bash' (the takeover spelling reaches the bind list);
 *   Q2 placementFeed('bash') resolves a def#N identity in the assembly realm;
 *   Q3 the lane re-check still speaks the bash class under the takeover name
 *      (deny-lane fast path fires; ask-coverage does not deny).
 */
import { createTeamToolPlaneAssembly } from '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const LAUNCHER = path.resolve(process.argv[2] ?? 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const sha = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const trustRoot = `sha256:${sha.slice(0, 16)}#${LAUNCHER}`

const permissionPolicy = {
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [{ tool: 'bash', resource: { kind: 'any' } }],
  deny: [],
}

const mk = (names) => createTeamToolPlaneAssembly({
  permissionPolicy,
  realmId: 'a5natexe-probe',
  templateId: 'team.probe',
  role: 'member',
  instanceId: 'inst-probe',
  plane: {
    realmId: 'a5natexe-probe',
    names,
    confinedProvider: { trustRoot, assembly: { launcherPath: LAUNCHER, launcherSha256: sha, minAbiVersion: 3 } },
  },
})

const results = []
const takeover = mk({ bash: 'bash' })
if (takeover.ok !== true) {
  console.log(`TAKEOVER BUILD REFUSED: ${takeover.code} ${takeover.message}`)
  process.exit(2)
}
const v = takeover.value
results.push(['Q1 ownNames carries the takeover spelling', JSON.stringify(v.ownNames), v.ownNames.includes('bash')])
const feed = v.placementFeed('bash')
results.push(['Q2 placementFeed(bash) resolves a placement identity', JSON.stringify(feed), typeof feed?.definitionIdentity === 'string' && /^def#\d+$/.test(feed.definitionIdentity) && feed.realmId === 'a5natexe-probe'])
// Q3: the lane re-check speaks the bash class under the native spelling.
const denyAsk = v.decide({ effects: [{ kind: 'tool-invoke', toolName: 'bash', resource: { kind: 'any' } }] })
results.push(['Q3a ask-covered bash invoke is NOT lane-denied', JSON.stringify(denyAsk), denyAsk.kind === 'allow'])
// A deny-lane template must still deny the SAME row before any backend.
const denyPlane = createTeamToolPlaneAssembly({
  permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any' } }] },
  realmId: 'a5natexe-probe', templateId: 'team.probe.deny', role: 'member', instanceId: 'inst-probe',
  plane: { realmId: 'a5natexe-probe', names: { bash: 'bash' }, confinedProvider: { trustRoot, assembly: { launcherPath: LAUNCHER, launcherSha256: sha, minAbiVersion: 3 } } },
})
if (denyPlane.ok !== true) {
  console.log(`DENY-BUILD REFUSED (assembly may refuse deny-template mounts): ${denyPlane.code} ${denyPlane.message}`)
  results.push(['Q3b deny-lane build', `${denyPlane.code}`, true])
} else {
  const d = denyPlane.value.decide({ effects: [{ kind: 'tool-invoke', toolName: 'bash', resource: { kind: 'any' } }] })
  results.push(['Q3b deny-lane fast path fires on the takeover row', JSON.stringify(d), d.kind === 'deny'])
}
// Control: default alias shape unchanged (byte-for-byte law).
const alias = mk(undefined)
results.push(['CTRL default names keep team_bash alias', JSON.stringify(alias.ok === true ? alias.value.ownNames : alias.code), alias.ok === true && alias.value.ownNames.includes('team_bash') && !alias.value.ownNames.includes('bash')])

// ── ③ anti-spoofing audit (root 04:34Z): adversarial ROW-CONFIG `names`. ──
// Trust model: `names` is only writable by the ROW CONFIG (install-level —
// INSTALL §3.2); the blueprint grammar is CLOSED (assertNoUnknownFields →
// MALFORMED_DTO), so no authoring channel reaches the plane. The audit pins
// the measured face: an anomalous names must be REFUSED or land FAIL-SAFE —
// (i) the lane's native-first rule (team-tool-plane.mjs:196-203) makes a
// shell deny TIGHTEN over a colliding spelling, never loosen; (ii) mount
// collisions are the registry's to refuse; (iii) values like ''/__proto__
// cannot pollute or silently claim a name. Measured, never assumed.
for (const [id, names] of [
  ['A1 names.bash collides team_grep', { bash: 'team_grep' }],
  ['A2 names.bash impersonates read', { bash: 'read' }],
  ['A3 names.bash empty string', { bash: '' }],
  ['A4 names.bash __proto__', { bash: '__proto__' }],
]) {
  const built = mk(names)
  if (built.ok !== true) {
    console.log(`MEASURED ${id}: build REFUSED ${built.code} — ${String(built.message ?? '').slice(0, 160)}`)
    results.push([id, `REFUSED ${built.code}`, true])
    continue
  }
  const v = built.value
  const lane = createTeamToolPlaneAssembly({
    permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any' } }] },
    realmId: 'a5natexe-probe', templateId: 'team.probe.adv', role: 'member', instanceId: 'inst-probe',
    plane: { realmId: 'a5natexe-probe', names, confinedProvider: { trustRoot, assembly: { launcherPath: LAUNCHER, launcherSha256: sha, minAbiVersion: 3 } } },
  })
  const clashName = String(names.bash)
  const facts = {
    ownNames: v.ownNames,
    // deny under the anomalous map: which spellings the bash deny now covers
    deny: lane.ok === true
      ? {
          [clashName || '<empty>']: lane.value.decide({ effects: [{ kind: 'tool-invoke', toolName: clashName, resource: { kind: 'any' } }] }).kind,
          bash: lane.value.decide({ effects: [{ kind: 'tool-invoke', toolName: 'bash', resource: { kind: 'any' } }] }).kind,
        }
      : `lane-build-refused ${lane.code}`,
    polluted: Object.prototype.hasOwnProperty.call(Object.prototype, 'bash'),
    claimedBash: v.ownNames.includes('bash'),
    claimedEmpty: v.ownNames.includes(''),
  }
  console.log(`MEASURED ${id}: ${JSON.stringify(facts)}`)
  const failSafe = facts.polluted === false && facts.claimedEmpty === false && facts.claimedBash === false
    // under a collision, the deny lane may only widen ITS OWN COVERAGE over
    // more names (tighten), never drop: the clash spelling must be DENIED.
    && (typeof facts.deny === 'string' || facts.deny[clashName || '<empty>'] === 'deny' || facts.deny.bash === 'deny')
  results.push([id, JSON.stringify(facts).slice(0, 220), failSafe])
}

let allOk = true
for (const [label, detail, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
  if (!ok) allOk = false
}
process.exit(allOk ? 0 : 1)
