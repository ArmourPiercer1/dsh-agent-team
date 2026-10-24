/**
 * a5m2-g1-control-handover-c1 — the SAME-LAYER DUPLICATE fix on the B-CONTROL
 * supply rows (root limited card 2026-10-24, 694b real-window evidence):
 * the raw Team-selected loop registered the four control rows (83/84/87/88)
 * natively, then the B-CONTROL supply arm registered its governed def under
 * the SAME name in the SAME setup on the SAME ctx — a product-side double
 * registration the host lawfully refuses ("already registered in this
 * scope"), which failed team.create at leader root-start.
 *
 * THE FIX UNDER TEST (mirrored law + source pair, this lane's review
 * precedent):
 *  - ONLY under the exact mount eligibility AND the closed `control === true`
 *    key, the four rows exit RAW registration through a claim of the names
 *    ACTUALLY VISIBLE in this agent's selected catalog (record-85 pattern);
 *  - the assembly captures the EXACT selected instance — never a scoped
 *    re-read that could mis-capture a parent layer's same-named ancestor;
 *  - names absent from selected are NOT hidden and NOT fabricated (honest
 *    ABSENT census; their scoped takeover law is untouched);
 *  - control not `true` ⇒ zero exclusions, byte-for-byte the old world.
 *
 * Disclosed stand-ins: the scoped registry mock (real host law: a same-layer
 * duplicate register THROWS) and the governed wrapper stand in for the host
 * seam and the assembly's def; the placement law they pin (exactly ONE
 * registration per name, the exact captured instance) is the card's whole
 * surface. The SOURCE-PAIR leg binds this mirror to the shipped bytes.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
const here = dirname(fileURLToPath(import.meta.url))
const BINDINGS = resolve(here, '../src/plugin/live/agent-bindings.mjs')

// DERIVED from the real frozen table (root constant-card ruling 2026-10-24:
// hand-written name/record pairs reversed 83 and 85 — the truth is ONLY
// what the shipped module answers). Loaded through a computed specifier:
// the module's shipped d.mts does not yet declare the supply-arm exports
// (a real type-surface gap disclosed to root, NOT patched under the
// product-untouched ruling), so a static TS import would resolve the
// declaration file, not the runtime table.
const WIRING_MODULE = '../src/plugin/live/governed-families/g1-query-wiring.mjs'
const wiring = await import(WIRING_MODULE) as {
  g1ControlSupplySubset: () => readonly { name: string; recordIndex: number }[]
  A5_G1_CONTROL85_HANDOVER: { name: string }
}
const SUPPLY = wiring.g1ControlSupplySubset().map((row) => ({ recordIndex: row.recordIndex, name: row.name }))
const ANCHOR85 = { recordIndex: 85, name: wiring.A5_G1_CONTROL85_HANDOVER.name }
const TEAM_OPS = ['team_delegate', 'team_follow_up', 'team_collect', 'team_send_message'] as const

interface Def { name: string; marker: string; execute: () => string }

/** A scoped tool registry under the REAL host law: the same layer refuses a
 * duplicate name; a parent layer's same-named def is NOT a duplicate (it is
 * an ancestor the takeover law may see through get — the mis-capture trap). */
function scopedRegistry(ancestorNames: string[]) {
  const ancestor = new Map<string, Def>()
  for (const name of ancestorNames) ancestor.set(name, { name, marker: `ANCESTOR:${name}`, execute: () => `ANCESTOR:${name}` })
  const layer = new Map<string, Def>()
  const registrations: Array<{ name: string; marker: string }> = []
  return {
    get: (name: string): Def | undefined => layer.get(name) ?? ancestor.get(name),
    register: (def: Def): (() => void) => {
      if (layer.has(def.name)) throw new TypeError(`tool "${def.name}" is already registered in this scope`)
      layer.set(def.name, def)
      registrations.push({ name: def.name, marker: def.marker })
      return () => { layer.delete(def.name) }
    },
    layerNames: () => [...layer.keys()],
    registrations,
    registrationsNow: () => registrations.length,
  }
}

type World = {
  selected: Def[]
  controlArmed: boolean
  ancestorNames?: string[]
}

/** Mirror of the shipped decision surface (the two edited sites), kept
 * line-for-line equivalent to the source-pair assertions below. */
function runWorld(w: World) {
  const reg = scopedRegistry(w.ancestorNames ?? [])
  const observations: string[] = []
  const sessionId = 'session-handover'
  const selected = w.selected
  // SITE 1 — the raw Team-selected block: claim ONLY under eligibility +
  // the closed control === true key; ONLY visible names claim.
  const supplyNames = new Set<string>()
  const supplyNatives = new Map<string, Def>()
  if (w.controlArmed) {
    for (const row of SUPPLY) {
      const exact = selected.find((def) => def.name === row.name)
      if (exact === undefined) {
        observations.push(`control-supply handover census ${row.name}:ABSENT for ${sessionId}`)
        continue
      }
      supplyNames.add(row.name)
      supplyNatives.set(row.name, exact)
      observations.push(`control-supply handover census ${row.name}:VISIBLE for ${sessionId}`)
    }
  }
  const teamOps = new Set<string>(TEAM_OPS)
  const names85 = new Set<string>() // 85 hand-over untouched (own law)
  const rawSelected = teamOps.size === 0 && names85.size === 0 && supplyNames.size === 0
    ? selected
    : selected.filter((def) => !teamOps.has(def.name) && !names85.has(def.name) && !supplyNames.has(def.name))
  // the raw registrations (the duplicate half of the old bug — now excluded)
  for (const def of rawSelected) reg.register(def)
  // SITE 2 — the B-CONTROL supply loop (it runs ONLY under control ===
  // true — the shipped gate; the DARK world never reaches this loop):
  // capture the EXACT claimed instance, never a scoped re-read; place
  // exactly ONE governed def per row.
  if (!w.controlArmed) return { reg, observations, rawSelected }
  for (const entry of SUPPLY) {
    const captured = supplyNatives.get(entry.name) ?? reg.get(entry.name)
    if (captured === undefined) {
      observations.push(`control row ${entry.name}:ABSENT zero placement`)
      continue
    }
    const governed: Def = { name: entry.name, marker: `GOVERNED(${captured.marker})`, execute: () => captured.execute() }
    reg.register(governed) // host seam: same duplicate law applies
  }
  return { reg, observations, rawSelected }
}

function selectedWorld(overrides: Partial<World> = {}): World {
  const rows = [...TEAM_OPS.map((name) => ({ name })), ANCHOR85, ...SUPPLY]
  const defs = rows.map((row) => ({
    name: row.name, marker: `SELECTED:${row.name}`, execute: () => `SELECTED:${row.name}`,
  }))
  return { selected: defs, controlArmed: true, ...overrides }
}

describe('a5m2-g1-control-handover-c1', () => {
  it('control:true: the four visible rows exit raw, EACH lands EXACTLY ONCE (no same-layer duplicate under the host refusal law), governed and from the exact SELECTED instance', () => {
    const { reg, observations, rawSelected } = runWorld(selectedWorld())
    for (const row of SUPPLY) {
      expect(rawSelected.some((def) => def.name === row.name)).toBe(false)
      const landed = reg.registrations.filter((r) => r.name === row.name)
      expect(landed.length).toBe(1) // ONE registration — the duplicate mock never fired
      expect(landed[0]?.marker).toBe(`GOVERNED(SELECTED:${row.name})`) // the exact captured instance
    }
    // 85 rides its own 03:05 law UNTOUCHED (still raw here — its claim is a
    // separate block); the teamOps exit raw through their OWN B-TEAM claim
    // (out of this card's scope; the B-TEAM arm re-places them elsewhere).
    expect(reg.layerNames()).toContain(ANCHOR85.name)
    for (const name of TEAM_OPS) expect(rawSelected.some((def) => def.name === name)).toBe(false)
    for (const row of SUPPLY) expect(observations).toContain(`control-supply handover census ${row.name}:VISIBLE for session-handover`)
  })

  it('an ancestor with the SAME name never gets mis-captured: the claimed selected instance is the only capture source', () => {
    const { reg } = runWorld(selectedWorld({ ancestorNames: SUPPLY.map((row) => row.name) }))
    for (const row of SUPPLY) {
      const landed = reg.registrations.filter((r) => r.name === row.name)
      expect(landed.length).toBe(1)
      expect(landed[0]?.marker).toBe(`GOVERNED(SELECTED:${row.name})`) // never ANCESTOR
    }
  })

  it('a name NOT in selected is neither fabricated nor hidden: ABSENT census, scoped law intact, zero placement', () => {
    const without84 = selectedWorld().selected.filter((def) => def.name !== 'team_resolve_control')
    const { reg, observations } = runWorld({ selected: without84, controlArmed: true })
    expect(observations).toContain('control-supply handover census team_resolve_control:ABSENT for session-handover')
    expect(reg.registrations.filter((r) => r.name === 'team_resolve_control').length).toBe(0)
    expect(observations).toContain('control row team_resolve_control:ABSENT zero placement')
    // the other three still hand over exactly once
    expect(reg.registrations.filter((r) => r.name === 'team_list_pending_control').length).toBe(1)
  })

  it('control NOT true: ZERO exclusions — byte-for-byte the old world (raw registers the four, no hand-over census)', () => {
    const { reg, observations, rawSelected } = runWorld(selectedWorld({ controlArmed: false }))
    for (const row of SUPPLY) {
      expect(rawSelected.some((def) => def.name === row.name)).toBe(true)
      // raw holds it; the supply loop would then collide — this is exactly
      // the pre-fix world, kept for the DARK (control-not-true) key where
      // the loop never runs at all: assert the RAW state only.
      expect(reg.layerNames()).toContain(row.name)
    }
    expect(observations.length).toBe(0)
  })

  it('THE REFUSAL MOCK IS REAL: a second same-layer register of a name throws (the window error this card closes)', () => {
    const reg = scopedRegistry([])
    const def: Def = { name: 'team_resolve_control', marker: 'X', execute: () => 'X' }
    reg.register(def)
    expect(() => reg.register({ ...def, marker: 'SECOND' })).toThrow(/already registered in this scope/)
  })
})

describe('a5m2-g1-control-handover-c1 source pair (shipped bytes)', () => {
  const SRC = readFileSync(BINDINGS, 'utf8')

  it('the claim fires ONLY under the 85-eligibility block AND control === true; visible-only claiming with honest ABSENT rows', () => {
    expect(SRC).toContain('if (a5G1PlaneCfgHere.control === true) {')
    expect(SRC).toContain("observations.push(`a5m2-g1: control-supply handover census ${row.name}:ABSENT for ${sessionId}`)")
    expect(SRC).toContain("observations.push(`a5m2-g1: control-supply handover census ${row.name}:VISIBLE for ${sessionId}`)")
    const block = SRC.slice(SRC.indexOf('if (a5G1PlaneCfgHere.control === true) {'))
    const body = block.slice(0, block.indexOf('}\n          }\n        }'))
    expect(body.indexOf(':ABSENT for ${sessionId}')).toBeGreaterThan(0)
    expect(body).toContain('a5G1ControlSupplyNames.add(row.name)')
    expect(body).toContain('a5G1ControlSupplyNatives.set(row.name, exact)')
  })

  it('the raw filter drops ONLY claimed names (the exclusion is set-driven, never a global hard-list)', () => {
    expect(SRC).toContain('&& !a5G1ControlSupplyNames.has(def.name))')
    // and the exclusion set can ONLY be filled under the control===true gate
    expect(SRC).toContain('const a5G1ControlSupplyNatives = new Map()')
  })

  it('the B-CONTROL capture reads the EXACT claimed instance first, scoped only for UNCLAIMED names; the 85 anchor law is untouched', () => {
    const arm = SRC.slice(SRC.indexOf('THE B-CONTROL SUPPLY LOOP'))
    expect(arm).toContain('a5G1ControlSupplyNatives.get(name) ?? agentCtx.tools.get(name, agent)')
    expect(SRC).toContain('entry.recordIndex === 85 ? a5G1Control85Native') // 85 law intact
    // the ABSENT branch claims nothing
    const claim = SRC.slice(SRC.indexOf('if (a5G1PlaneCfgHere.control === true) {'))
    expect(claim).toContain('continue')
  })
})
