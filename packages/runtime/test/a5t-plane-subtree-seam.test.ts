/**
 * alpha.5 A-route — the plane SubtreeContains seam law (pin-set; the mount
 * injection leg itself lives in `live/agent-bindings.mjs` and its authoritative
 * receipt is the REAL-install lanes world (RED 2026-10-19T08-26-03Z refusal
 * archived verbatim in evidence/alpha5/tools-gov/TOOLS.md R-2; GREEN = the same
 * world after the injection leg). Per the root ruling, module tests NEVER
 * substitute for the wiring; this file pins only the CONSUMER contract the
 * injected seam must satisfy — the never-guess asymmetry.
 *
 * The law (admission-kernel projection-subtree-seam-missing + the frozen lane
 * asymmetry of createLaneDecide):
 *  - a policy carrying a subtree rule WITHOUT the seam is a typed refusal at
 *    projection (mount), never a silent match or a silent pass;
 *  - WITH the seam, containment is answered BY THE SEAM (inside true, outside
 *    false — a false answer is a clean non-match, the lane default decides);
 *  - a THROWING seam (provider fault) tightens on the deny fast-path (match)
 *    — undeterminable is never read as "not covered" (never widen);
 *  - no seam at all on the lane fast-path also matches (fail closed).
 */
import { describe, expect, it } from 'vitest'

import { createLaneDecide, createTeamToolPlaneAssembly } from '../src/plugin/live/team-tool-plane.mjs'

const NAMES = Object.freeze({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' })
const ROOT_PATH = '/world/governed'
/** The injection-leg seam shape (authority-envelope SubtreeContains): a clean
 *  boolean over (rulePath, canonicalChildKey); the production leg answers with
 *  the provider's pinned FileSystem.contains over provider handles. */
const seam = (rulePath: string, childKey: string): boolean =>
  childKey === rulePath || childKey.startsWith(`${rulePath}/`)

const subtreePolicy = {
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_PATH } }],
  ask: [],
  deny: [{ tool: 'read', resource: { kind: 'subtree', path: '/world/governed/secret' } }],
}

const fileReadEffectSet = (locator: string) => ({ effects: [{ kind: 'read', resource: { locator } }] })

describe('alpha.5 plane subtree seam — the never-guess contract the injection leg must satisfy', () => {
  it('refuses the projection when a subtree policy carries no seam (typed, loud)', () => {
    const built = createTeamToolPlaneAssembly({
      permissionPolicy: subtreePolicy,
      realmId: 'realm-a5t',
      templateId: 'wa',
      role: 'member',
      instanceId: 'inst-a5t',
      plane: { realmId: 'realm-a5t' },
    })
    expect(built.ok).toBe(false)
    expect(String((built as { message?: string }).message ?? (built as { code?: string }).code))
      .toMatch(/subtree|SubtreeContains|TOOL_BINDING_UNVERIFIED/)
  })

  it('accepts the SAME policy once the seam is injected (the assembly face the mount leg rides)', () => {
    const built = createTeamToolPlaneAssembly({
      permissionPolicy: subtreePolicy,
      realmId: 'realm-a5t',
      templateId: 'wa',
      role: 'member',
      instanceId: 'inst-a5t',
      plane: { realmId: 'realm-a5t' },
      fs: { subtreeContains: seam },
    })
    expect(built.ok === true ? 'ok' : `refused: ${(built as { message?: string }).message}`).toBe('ok')
  })

  it('answers containment BY THE SEAM: inside-root deny matches, outside-root is a clean non-match', () => {
    const decide = createLaneDecide(subtreePolicy, NAMES, seam)
    expect(decide(fileReadEffectSet('/world/governed/secret/inner.txt')))
      .toEqual({ kind: 'deny', code: 'template-deny-lane' })
    // a path covered by the allow-subtree and outside the deny-subtree is a
    // clean non-match — the seam's FALSE answer is an answer, never a fault.
    expect(decide(fileReadEffectSet('/world/governed/plain.txt'))).toEqual({ kind: 'allow' })
  })

  it('a throwing seam tightens, never widens (deny fast-path matches on undeterminable)', () => {
    const decide = createLaneDecide(subtreePolicy, NAMES, () => {
      throw new Error('provider contains() fault')
    })
    expect(decide(fileReadEffectSet('/world/governed/anything.txt')))
      .toEqual({ kind: 'deny', code: 'template-deny-lane' })
  })

  it('no seam on the lane fast-path also matches (fail closed — why the projection must refuse up front)', () => {
    const decide = createLaneDecide(subtreePolicy, NAMES, undefined)
    expect(decide(fileReadEffectSet('/world/anything-at-all.txt')))
      .toEqual({ kind: 'deny', code: 'template-deny-lane' })
  })
})
