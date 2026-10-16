/**
 * a5p4-poc4-probe — PoC4: the authoritative probe surface (ruling in
 * pr4-pre/findings-landlock-probe-divergence.md §3, adopted into C-PROC):
 *
 *   AUTHORITATIVE SURFACE = bare syscall GET_VERSION  +  REAL enforcement,
 *   both legs, run inside a self-confining subprocess (P1 entry self-lock;
 *   prctl(PR_SET_NO_NEW_PRIVS) + landlock_restrict_self act on the probe
 *   process itself only — the host system is never modified).
 *
 * Discriminators pinned here:
 *  - `denyall`   : handled = every supported bit, ZERO rules ⇒ once the domain
 *                  is live every fresh open must EACCES (ruleset-semantics
 *                  discriminator).
 *  - `badhandled`: handled = MAKE_REG only ⇒ the read negative control MUST
 *                  still read (reproduces the historical FALSE ABSENT — a
 *                  probe that never shows this cannot prove enforcement).
 *  - `selective` : the per-path ENFORCE-CONFIRMED shape with raw errno words.
 *
 * Host honesty: a kernel without the ABI yields ABI-UNAVAILABLE and the test
 * pins the honest degradation; on the ruling host (Linux 6.8, ENFORCE-WORKS)
 * the full double evidence is asserted. Nothing here claims anything about
 * kernels this probe did not measure.
 *
 * @module packages/runtime/test/a5p4-poc4-probe.test
 */

import { afterAll, describe, expect, it } from 'vitest'
import {
  probeToCapabilities,
  runAbiProbe,
  runEnforcementLeg,
  type LegName,
} from '../sandbox-provider/probe-abi.js'
import { createDefaultLauncherDeps, makeScratchWorld, removeScratchWorld } from './a5p4-harness.js'

const world = makeScratchWorld('poc4')
afterAll(() => removeScratchWorld(world))

describe('a5p4 PoC4 bare-syscall ABI probe', () => {
  it('GET_VERSION answers through syscall 444 and reports the version (or honest unavailable)', () => {
    const v = runAbiProbe(createDefaultLauncherDeps())
    expect(v.syscall).toContain('GET_VERSION')
    if (v.kind === 'abi-unavailable') {
      expect(v.abiVersion).toBeNull()
      expect(v.rawLines.length).toBeGreaterThan(0)
      return
    }
    expect(v.abiVersion).not.toBeNull()
    expect(typeof v.abiVersion).toBe('number')
  })

  it('every enforcement leg runs INSIDE the launcher process (the parent provider never self-locks)', () => {
    // Shape guard: the leg API only takes a deps seam + scratch dir — there is
    // no in-process entry point that could confine the calling (host) process.
    expect(typeof runEnforcementLeg).toBe('function')
    expect(runEnforcementLeg.length).toBe(3) // (deps, leg, scratchDir)
  })
})

describe('a5p4 PoC4 enforcement discriminators', () => {
  const deps = createDefaultLauncherDeps()
  const abi = runAbiProbe(deps)

  const legs = new Map<LegName, ReturnType<typeof runEnforcementLeg>>()
  for (const leg of ['selective', 'denyall', 'badhandled'] as const) {
    legs.set(leg, runEnforcementLeg(deps, leg, `${world}/${leg}`))
  }

  if (abi.kind === 'abi-unavailable') {
    it('degrades honestly — every leg says ABI-UNAVAILABLE and no capability is claimed', () => {
      for (const leg of legs.values()) expect(leg.verdict).toBe('ABI-UNAVAILABLE')
      const rows = probeToCapabilities(abi, Object.fromEntries(legs), {
        realmId: 'realm-poc4',
        trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
        evidenceRef: 'evidence://a5p4/absent',
      })
      const cr = rows.find((r) => r.dimension === 'content-read')
      expect(cr?.level).not.toBe('enforced')
      expect(cr?.level).not.toBe('author-trusted')
    })
  } else {
    it('selective + denyall BOTH confirm ⇒ double evidence; badhandled reproduces the false-ABSENT trap', () => {
      expect(legs.get('selective')?.verdict).toBe('ENFORCE-CONFIRMED')
      expect(legs.get('denyall')?.verdict).toBe('ENFORCE-CONFIRMED')
      const bad = legs.get('badhandled')
      expect(bad?.verdict).toBe('DEMO-CONFIRMED')
      // the trap check: with READ_FILE unhandled the secret stayed readable —
      // this is what a missing enforcement would look like, reproduced on purpose.
      const trap = bad?.checks.find((c) => c.name === 'TRAP secret readable (READ_FILE unhandled)')
      expect(trap?.got).toBe('OK')
      expect(trap?.match).toBe(true)
    })

    it('the selective leg carries RAW errno words (EACCES) for every negative control', () => {
      const checks = legs.get('selective')?.checks ?? []
      const negs = checks.filter((c) => c.name.startsWith('NEG '))
      expect(negs.length).toBeGreaterThanOrEqual(2)
      for (const n of negs) {
        expect(n.expect).toBe('EACCES')
        expect(n.got).toBe('EACCES')
        expect(n.match).toBe(true)
      }
    })

    it('probeToCapabilities applies the double-evidence law and keeps the honest rows', () => {
      const rows = probeToCapabilities(abi, Object.fromEntries(legs), {
        realmId: 'realm-poc4',
        trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
        evidenceRef: 'evidence://a5p4/poc4-run',
      })
      const by = new Map(rows.map((r) => [r.dimension, r]))
      // content-read / write: enforced ONLY on the double confirmation.
      expect(by.get('content-read')?.level).toBe('enforced')
      expect(by.get('write')?.level).toBe('enforced')
      // metadata & alias: this lane never overclaims (PoC-4a posture).
      expect(by.get('directory-metadata')?.level).toBe('unsupported')
      expect(by.get('alias')?.level).toBe('unsupported')
      // network: unsupported regardless of TCP bits (PoC-4b posture).
      expect(by.get('network-destination')?.level).toBe('unsupported')
      // every row states the realm and the evidence ref it was earned in.
      for (const r of rows) {
        expect(r.realmId).toBe('realm-poc4')
        if (r.level === 'enforced') {
          expect(r.evidence).toBe('evidence://a5p4/poc4-run')
          expect(r.mechanism).not.toBeNull()
        }
      }
    })

    it('one MISSING leg of the double evidence is enough to demote content-read (never one-legged enforcement)', () => {
      const rows = probeToCapabilities(abi, { selective: legs.get('selective')!, denyall: undefined, badhandled: legs.get('badhandled')! }, {
        realmId: 'realm-poc4',
        trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
        evidenceRef: 'evidence://a5p4/partial',
      })
      expect(rows.find((r) => r.dimension === 'content-read')?.level).not.toBe('enforced')
    })

    it('a MIXED/FAILED denyall leg demotes enforcement too (the discriminator actually bites)', () => {
      const broken = { ...legs.get('denyall')!, verdict: 'MIXED/FAILED' as const }
      const rows = probeToCapabilities(abi, {
        selective: legs.get('selective')!,
        denyall: broken,
        badhandled: legs.get('badhandled')!,
      }, {
        realmId: 'realm-poc4',
        trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
        evidenceRef: 'evidence://a5p4/broken',
      })
      expect(rows.find((r) => r.dimension === 'content-read')?.level).not.toBe('enforced')
    })
  }
})
