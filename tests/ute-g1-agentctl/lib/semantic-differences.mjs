/**
 * semantic-differences.mjs — the differences between the governed
 * agent-control old path and the native path, MEASURED and declared.
 *
 * These are not inherited from another family and not "the two paths look
 * different". Each entry names the repo source (or fixture) it is measured
 * from and the mechanical check that re-derives it. Every entry is blocking and
 * UNAPPROVED: there is no approval record, so `SemanticDifferencesResolved`
 * stays false and retirement stays refused.
 *
 * @module tests/ute-g1-agentctl/lib/semantic-differences
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { EVIDENCE_ROOT, REPO_ROOT } from './paths.mjs'
import { CORPUS } from './corpus.mjs'
import { parseGolden } from './compare.mjs'

/** The reviewed difference list (stable ids; a difference is retired by an
 *  approved edit that cites the measurement showing it gone — never by
 *  deletion). */
export const SEMANTIC_DIFFERENCES = Object.freeze([
  Object.freeze({
    id: 'SD-AGENTCTL-1-route-c-unserved',
    blocking: true,
    approval: null,
    summary: 'The product route-C composition does not serve ANY of the seven booked members: attachA5sfNativeToolModules appends confined shell/search/fs/skill/present/web shadows and NO agent-control spec, so every one of the seven dispatches is `unknown tool` with zero provider calls and zero guard facts. A retirement that swapped the family for “the route-C path” would swap it for nothing; the replacement has to be a new native binding that does not exist at B1.',
    evidence: 'dev/agent-workflow/evidence/ute3-agentctl-b1-20261121/composition-probe.txt (PROBE-ROUTE-C lines)',
  }),
  Object.freeze({
    id: 'SD-AGENTCTL-2-native-name-claim-not-graded',
    blocking: true,
    approval: null,
    summary: 'The governed family claims all seven RESERVED native spellings, but the natexe name ledger does not grade a family claim: PLANE_SUPPORTED_NATIVE_TAKEOVERS declares no agent-control class, verifyPlaneNames is closed to grep/glob/bash (so it cannot express these names at all), and family-assembly.mjs contains ZERO references to PLANE_RESERVED_NATIVE. Name ownership between the enabled family and the host preset is therefore unresolved by construction; retiring the family is a name/schema change the ledger never adjudicated.',
    evidence: 'dev/agent-workflow/evidence/ute3-agentctl-b1-20261121/composition-probe.txt (PROBE-PLANE lines) + packages/runtime/src/plugin/live/{team-tool-plane,family-assembly}.mjs',
  }),
  Object.freeze({
    id: 'SD-AGENTCTL-3-governed-admission-surface',
    blocking: true,
    approval: null,
    summary: 'Every ADMITTED governed row opens a real PA Control ask and consumes a fingerprint-bound one-shot grant before the port runs (the fixture records `control=1;decisions=approve` on every allow row and `control=0` on every pre-PA fence refusal). The host native rows do not ride this plane PA edge (route-C mounts no agent-control shadow), so removing the family removes an approval round-trip and a one-shot consume from the model-visible path — a permission-surface change, not a same-meaning switch.',
    evidence: 'tests/ute-g1-agentctl/golden/old-path.tsv (the `facts` column) + dev/agent-workflow/evidence/ute3-agentctl-b1-20261121/composition-probe.txt',
  }),
])

/** The `SEMANTIC-DIFF …` line a capture/verify run prints for one difference. */
export function semanticDifferenceLine(difference) {
  return `SEMANTIC-DIFF id=${difference.id} blocking=${difference.blocking ? 'yes' : 'no'} approval=${difference.approval === null ? 'none' : difference.approval}`
}

export function semanticDifferenceLines() {
  return SEMANTIC_DIFFERENCES.map(semanticDifferenceLine)
}

export const SEMANTIC_DIFF_LINE_RE = /^SEMANTIC-DIFF id=(\S+) blocking=(yes|no) approval=none$/u

/** Read the repo sources the measurements are bound to. */
function sources() {
  const realmRow = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
  const plane = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'team-tool-plane.mjs'), 'utf8')
  const seam = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'family-assembly.mjs'), 'utf8')
  const descriptor = readFileSync(join(REPO_ROOT, 'packages', 'tools', 'families', 'agent-control.mjs'), 'utf8')
  const census = JSON.parse(readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), 'utf8'))
  return { realmRow, plane, seam, descriptor, census }
}

/** The reserved-native names the plane pins. */
function reservedNative(planeText) {
  const block = planeText.slice(planeText.indexOf('export const PLANE_RESERVED_NATIVE = Object.freeze(['))
  const body = block.slice(0, block.indexOf('\n])'))
  return [...body.matchAll(/'([a-z0-9_]+)'/gu)].map((match) => match[1])
}

/** The takeover-ledger class keys. */
function takeoverClasses(planeText) {
  const block = planeText.slice(planeText.indexOf('const PLANE_SUPPORTED_NATIVE_TAKEOVERS = Object.freeze({'))
  const body = block.slice(0, block.indexOf('\n})'))
  return [...body.matchAll(/^\s{2}(\w+):/gmu)].map((match) => match[1])
}

/**
 * Re-derive the three differences from source + fixture.
 *
 * @returns {ReadonlyArray<{id: string, holds: boolean, facts: object}>}
 */
export function measureDifferences() {
  const { realmRow, plane, seam, census } = sources()
  const appended = realmRow.split('\n').find((line) => /const appended = \[/u.test(line)) ?? ''
  const unit = census.families.find((family) => family.familyId === 'dsh.agent-control-family')
  const members = (unit?.nativeNames ?? []).map((name) => name.replace('(bound-definition) ', ''))
  const reserved = reservedNative(plane)
  const takeover = takeoverClasses(plane)
  const seamReservedRefs = (seam.match(/PLANE_RESERVED_NATIVE|PLANE_SUPPORTED_NATIVE_TAKEOVERS|verifyPlaneNames|reserved native name/gu) ?? []).length
  const golden = parseGolden(readFileSync(join(REPO_ROOT, 'tests', 'ute-g1-agentctl', 'golden', 'old-path.tsv'), 'utf8'))
  const allowRows = golden.filter((row) => row.outcome === 'allow')
  // The pre-PA fences are a CLOSED set of codes; a post-PA runtime refusal whose
  // name happens to contain "amplification" must not be counted as one.
  const PRE_PA_FENCE_CODES = new Set([
    'agent-control-schema-refused',
    'agent-control-amplification-refused',
    'agent-control-scope-foreign',
    'agent-control-scope-unresolved',
    'agent-control-context-authority-refused',
    'template-default-deny',
    'cancelled',
  ])
  const fenceRows = golden.filter((row) => row.outcome === 'deny' && PRE_PA_FENCE_CODES.has(row.codes))
  return Object.freeze([
    Object.freeze({
      id: 'SD-AGENTCTL-1-route-c-unserved',
      holds: !/agent[-_]?control/iu.test(appended) && members.length === 7,
      facts: Object.freeze({ appended, agentControlSpec: /agent[-_]?control/iu.test(appended) ? 'PRESENT(!!)' : 'ABSENT', bookedMembers: members.length }),
    }),
    Object.freeze({
      id: 'SD-AGENTCTL-2-native-name-claim-not-graded',
      holds: takeover.every((key) => !/agent|control|subagent/u.test(key))
        && members.every((member) => reserved.includes(member))
        && seamReservedRefs === 0,
      facts: Object.freeze({ takeoverClasses: takeover, reservedCoversMembers: members.every((member) => reserved.includes(member)), seamReservedRefs }),
    }),
    Object.freeze({
      id: 'SD-AGENTCTL-3-governed-admission-surface',
      holds: allowRows.length > 0 && allowRows.every((row) => /(?:^|;)control=1(?:;|$)/u.test(row.facts) && /decisions=approve/u.test(row.facts))
        && fenceRows.every((row) => /(?:^|;)control=0(?:;|$)/u.test(row.facts)),
      facts: Object.freeze({ allowRows: allowRows.length, allowWithControlAsk: allowRows.filter((row) => /(?:^|;)control=1(?:;|$)/u.test(row.facts)).length, prePaFenceRows: fenceRows.length, prePaWithControlAsk: fenceRows.filter((row) => /(?:^|;)control=1(?:;|$)/u.test(row.facts)).length }),
    }),
  ])
}

/** The probe-transcript path (written by probe-composition.mjs). */
export function probeTranscriptPath() {
  return join(EVIDENCE_ROOT, 'composition-probe.txt')
}

/** The corpus ids, for the README/COVERAGE cross-check. */
export function corpusIds() {
  return CORPUS.map((vector) => vector.id)
}
