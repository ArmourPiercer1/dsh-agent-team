/**
 * p4-08 — SessionEvent-independence negatives (AC: "Team control-plane
 * authority 可独立于 SessionEvent 存储").
 *
 * The TeamDomain sidecar is proven independent of any SessionEvent
 * storage by data-driven checks over the declared import closure of the
 * 22 production modules (pinned to exactly 22 production + 18 frozen
 * contracts modules), banned-vocabulary scans (no references/**, no
 * upstream/deepseek-harness paths, no bare specifiers, no legacy Team
 * SessionEvent names anywhere in the closure), and live imports of all
 * 22 production modules verifying each one's marker export plus a
 * negative export-name scan (nothing SessionEvent/agent-shaped).
 *
 * @module @dsh-agent-team/storage/test/p4-08-independence-negative
 */

import { describe, expect, it } from 'vitest'

import {
  P4_BANNED_PATH_SEGMENTS,
  P4_BANNED_SUBSTRINGS,
  P4_CONTRACT_MODULES,
  P4_EXPECTED_CLOSURE_SIZE,
  P4_IMPORT_EDGE_TARGETS,
  P4_LEGACY_EVENT_NAMES,
  P4_LIVE_IMPORT_MARKERS,
  P4_PRODUCTION_MODULES,
  P4_RAW_SPECIFIERS,
  capture,
  computeP4Closure,
} from './p4-helpers.js'

const closureResult = await capture(() => computeP4Closure())
const closure = closureResult.value ?? []

const known = new Set<string>([...P4_PRODUCTION_MODULES, ...P4_CONTRACT_MODULES])
const allSpecifiers = [
  ...Object.values(P4_RAW_SPECIFIERS).flat(),
  ...closure,
]

function segmentsOf(spec: string): string[] {
  return spec
    .toLowerCase()
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/\.(ts|js)$/, ''))
}

const rawSpecifiers = Object.values(P4_RAW_SPECIFIERS).flat()
const bannedSegmentHits: string[] = []
const bannedSubstringHits: string[] = []
const bareSpecifiers = rawSpecifiers.filter((spec) => !spec.startsWith('./') && !spec.startsWith('../'))
const legacyNameHits: string[] = []
for (const spec of allSpecifiers) {
  const segments = segmentsOf(spec)
  for (const segment of segments) {
    if (P4_BANNED_PATH_SEGMENTS.includes(segment)) bannedSegmentHits.push(`${spec}#${segment}`)
  }
  for (const banned of P4_BANNED_SUBSTRINGS) {
    if (spec.toLowerCase().includes(banned)) bannedSubstringHits.push(spec)
  }
  for (const name of P4_LEGACY_EVENT_NAMES) {
    if (spec.includes(name)) legacyNameHits.push(`${spec}~${name}`)
  }
}

const edgeTargetsKnown = Object.entries(P4_IMPORT_EDGE_TARGETS).every(
  ([module, targets]) => known.has(module) && targets.every((target) => known.has(target)),
)

const liveModules: Array<Record<string, unknown>> = []
const missingMarkers: string[] = []
for (const marker of P4_LIVE_IMPORT_MARKERS) {
  const mod = (await import(marker.module)) as Record<string, unknown>
  liveModules.push(mod)
  if (mod[marker.exportName] === undefined) missingMarkers.push(`${marker.module}#${marker.exportName}`)
}

function normalized(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const normalizedLegacy = P4_LEGACY_EVENT_NAMES.map(normalized)
const badExportNames: string[] = []
for (const mod of liveModules) {
  for (const name of Object.keys(mod)) {
    const n = normalized(name)
    if (n.includes('sessionevent')) badExportNames.push(`${name}#sessionevent`)
    if (n.startsWith('agent')) badExportNames.push(`${name}#agent-prefix`)
    if (normalizedLegacy.includes(n)) badExportNames.push(`${name}#legacy-event-name`)
  }
}

describe('p4-08 SessionEvent-independence negatives', () => {
  it('the import closure is self-consistent and pinned to 40 modules (22 production + 18 contracts)', () => {
    expect(closureResult.ok).toBe(true)
    expect(closure.length).toBe(P4_EXPECTED_CLOSURE_SIZE)
    expect(closure.length).toBe(40)
    for (const module of P4_PRODUCTION_MODULES) {
      expect(closure.includes(module)).toBe(true)
    }
    for (const module of P4_CONTRACT_MODULES) {
      expect(closure.includes(module)).toBe(true)
    }
    expect(edgeTargetsKnown).toBe(true)
  })

  it('no banned path segment or substring appears in any closure specifier', () => {
    expect(bannedSegmentHits).toEqual([])
    expect(bannedSubstringHits).toEqual([])
  })

  it('every import specifier in the production sources is relative (zero bare specifiers)', () => {
    expect(bareSpecifiers).toEqual([])
  })

  it('no legacy Team SessionEvent name appears anywhere in the closure', () => {
    expect(P4_LEGACY_EVENT_NAMES.length).toBe(5)
    expect(legacyNameHits).toEqual([])
  })

  it('all 22 production modules import live and expose their marker export', () => {
    expect(liveModules.length).toBe(22)
    expect(missingMarkers).toEqual([])
  })

  it('no live module export is SessionEvent- or agent-shaped', () => {
    expect(badExportNames).toEqual([])
  })
})
