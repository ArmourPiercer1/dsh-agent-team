#!/usr/bin/env node
/**
 * invert-check.mjs — discrimination check (RED-first by inversion, computed offline
 * from the recorded canonical round; it re-runs nothing and binds no port).
 *
 * A negative control that can never fail proves nothing. This takes each negative-control
 * claim of the round and re-evaluates it against the DATA OF THE POSTURE THAT SHOULD
 * VIOLATE IT (the unconfined realm arm / the disclosed unconfined live leg). Claims that
 * still "pass" there are not measuring the confinement — those are reported as
 * NON-DISCRIMINATING and stay out of the verdict.
 *
 *   node invert-check.mjs --run-dir runs/outer-<stamp>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(new URL(import.meta.url).pathname)
const argValue = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const runDir = resolve(argValue('run-dir', HERE))
const read = (p) => JSON.parse(readFileSync(join(runDir, p), 'utf8'))

const realm = read('realm-truth-table.json')
const legA = read('legA-state.json')
const legC = read('legC-state.json')
const rowOf = (arm, probe) => (realm[arm].rows ?? []).find((r) => r.probe === probe) ?? {}

// Each entry: the claim, the confined/default data, and the violating-posture data.
const claims = [
  {
    claim: 'direct fs WRITE into the forbidden zone is refused and creates no file',
    guarding: 'R-CONFINED-WRITE-OSDENIED',
    confined: { classified: rowOf('confined', 'write_forbidden').classified, fileCreated: realm.confined.census.writeTargetExists },
    keys: ['classified', 'fileCreated'],
    violatingPosture: 'realm unconfined arm (same child, same program, no OS domain)',
    violating: { classified: rowOf('unconfined', 'write_forbidden').classified, fileCreated: realm.unconfined.census.writeTargetExists },
  },
  {
    claim: 'the effect reaches the forbidden zone THROUGH a spawned child too (domain inherited across fork/execve)',
    guarding: 'R-CONFINED-SPAWN-WRITE-OSDENIED',
    keys: ['classified', 'fileCreated'],
    confined: { classified: rowOf('confined', 'spawn_write_forbidden').classified, fileCreated: realm.confined.census.childTargetExists },
    violatingPosture: 'realm unconfined arm',
    violating: { classified: rowOf('unconfined', 'spawn_write_forbidden').classified, fileCreated: realm.unconfined.census.childTargetExists },
  },
  {
    claim: 'the confined domain is selective, not a blanket failure (in-workspace write still works)',
    guarding: 'R-CONFINED-CONTROL-RUNS',
    expectDiscriminating: false, // a selectivity control, not a refusal claim
    confined: { controlWrite: realm.confined.census.controlWriteExists, marker: realm.confined.census.markerExists },
    violatingPosture: 'a broken/over-broad grant would show controlWrite=false here — recorded, not inverted',
    violating: { controlWrite: realm.confined.census.controlWriteExists, marker: realm.confined.census.markerExists },
  },
  {
    claim: 'in the default posture nothing at all is written, so the refusal is whole-program',
    guarding: 'A-ZERO-SIDE-EFFECTS',
    keys: ['writeTarget', 'childTarget', 'marker', 'connections'],
    confined: { writeTarget: legA.census.writeTargetExists, childTarget: legA.census.childTargetExists, marker: legA.census.markerExists, connections: legA.census.listenerConnections },
    violatingPosture: 'live LEG C (disclosed per-session switch, same program on its own -legc paths)',
    violating: { writeTarget: legC.census.writeTargetExists, childTarget: legC.census.childTargetExists, marker: legC.census.markerExists, connections: legC.census.listenerConnections },
  },
  {
    claim: 'no outer OS process ever existed in the default posture',
    guarding: 'A-NO-OUTER-OS-CHILD',
    keys: ['outerChildren'],
    confined: { outerChildren: legA.outerChildren ?? [] },
    violatingPosture: 'live LEG C',
    violating: { outerChildren: legC.outerChildren ?? [] },
  },
  {
    // Deliberately NON-discriminating by design, and booked as such: network is not a
    // file effect, so no file-domain posture can refuse it. Listing it here keeps the
    // over-claim out of the verdict instead of hiding it.
    claim: 'direct net.connect reaches a listener outside the realm',
    guarding: 'R-CONFINED-NET (informational)',
    keys: ['classified'],
    // The one row that MUST NOT discriminate: if a file-domain posture ever "refused"
    // the socket, that would be a different mechanism (and would still not be net policy).
    countsAsProtection: false,
    confined: { classified: rowOf('confined', 'net_connect').classified, connections: realm.confined.census.listenerConnections, bytes: realm.confined.census.listenerBytes },
    violatingPosture: 'realm unconfined arm',
    violating: { classified: rowOf('unconfined', 'net_connect').classified, connections: realm.unconfined.census.listenerConnections, bytes: realm.unconfined.census.listenerBytes },
  },
]

/** Compare only the fields that carry the claim (byte counts and run tags differ
 * between arms for reasons that say nothing about confinement). */
const pick = (obj, keys) => Object.fromEntries((keys ?? Object.keys(obj)).map((k) => [k, obj[k]]))
const rows = claims.map((c) => ({
  ...c,
  comparedConfined: pick(c.confined, c.keys),
  comparedViolating: pick(c.violating, c.keys),
  discriminates: JSON.stringify(pick(c.confined, c.keys)) !== JSON.stringify(pick(c.violating, c.keys)),
}))
const nonDiscriminating = rows.filter((r) => !r.discriminates && r.expectDiscriminating !== false).map((r) => r.claim)
const asDesignedSame = rows.filter((r) => !r.discriminates && r.expectDiscriminating === false).map((r) => r.claim)
const overClaims = rows.filter((r) => r.discriminates === false && r.countsAsProtection === true).map((r) => r.claim)
const out = {
  caliber: 'offline re-evaluation of this round’s recorded data; nothing re-ran, no port bound',
  runDir: runDir.replace(/.*\/evidence\//, 'evidence/'),
  rows,
  nonDiscriminating,
  asDesignedSame,
  overClaims,
  reading: 'a claim that changes value between the confined/default posture and the posture that should violate it is measuring the confinement; the network row is expected NOT to discriminate (Landlock ABI 4 grants no network right) and is therefore booked as the gap, never as protection',
}
writeFileSync(join(runDir, 'red-first-inversion.json'), JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify({ rows: rows.map((r) => ({ claim: r.claim.slice(0, 60), guarding: r.guarding, discriminates: r.discriminates })), nonDiscriminating }, null, 2))
