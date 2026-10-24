/**
 * A5M2-G3A-BINDINGS-UNION-C1 — the REAL bindings->plane activation pairing
 * (root narrow audit on merge 760364998: the guard named a5G3TerminalInject
 * but the backends object lost the terminal spread -> the plane read nothing
 * at its `input.backends?.terminal` and the post-publish registration was
 * mount-refused by construction).
 *
 * Why a SOURCE-PAIR leg instead of a runtime mount: the real createAgentBindings
 * member-setup path has NO offline world in this suite (every bindings-level
 * test to date runs the p8s5a STUB glue, not the real closure — that is exactly
 * the coverage hole this regression slipped through; named gap, disclosed,
 * not papered over). A live member mount needs the Host (接线未测 law), so the
 * faithful offline proof of THIS class is machine-pairing the real production
 * bytes: the guard expression of the shared backends union, the conditional
 * spread rows it gates, and the keys the REAL plane reads — over the src file
 * AND its committed dist mirror (byte-identical law), so the shipped install
 * surface is covered, not just the working tree.
 *
 * The class is closed in both directions:
 *   - every a5*-inject the guard names MUST have exactly one conditional
 *     spread row inside the same backends literal (a lost row = RED here;
 *     RED-PROVEN by stripping the terminal row and watching this leg fail);
 *   - every key a spread hands over MUST be read by the real plane
 *     (`input.backends?.<key>`), so a renamed/orphan key is RED too.
 * Zero-flip stays where it lives: the guard short-circuit semantics are the
 * assembly's own, unchanged by this leg.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pkgRoot = new URL('../', import.meta.url)
const BINDINGS_SRC = fileURLToPath(new URL('src/plugin/live/agent-bindings.mjs', pkgRoot))
const BINDINGS_DIST = fileURLToPath(new URL('dist/packages/runtime/src/plugin/live/agent-bindings.mjs', pkgRoot))
const PLANE_SRC = fileURLToPath(new URL('src/plugin/live/team-tool-plane.mjs', pkgRoot))

const backendsAssembly = (text: string) => {
  const guardLine = text.split('\n').find((line) => line.includes('? {} : { backends: {'))
  if (guardLine === undefined) throw new Error('the shared backends guard line is gone from the real bindings source')
  const from = text.indexOf(guardLine)
  const close = text.indexOf('\n          } }),', from)
  if (close < 0) throw new Error('the shared backends literal does not close')
  // comment-only lines are not rows (a commented-out spread must read as LOST)
  const slice = text.slice(from, close).split('\n').filter((line) => !line.trim().startsWith('//')).join('\n')
  const rows: Array<{ condVar: string | null; cond: string; key: string }> = []
  for (const match of slice.matchAll(/\.\.\.\(([\s\S]*?)\? \{\} : \{ ([A-Za-z0-9]+):/g)) {
    if (match[2] === 'backends') continue // the guard line itself opens with ...( and hands over `backends:` itself
    const cond = match[1].trim()
    const vars = [...cond.matchAll(/a5[A-Za-z0-9]+/g)].map((v) => v[0])
    rows.push({ condVar: vars.length === 1 ? vars[0] : null, cond, key: match[2] })
  }
  return { guardLine, slice, rows }
}

describe('A5M2-G3A-BINDINGS-UNION-C1 — guard/spread/plane-read pairing on the REAL bytes', () => {
  const src = readFileSync(BINDINGS_SRC, 'utf8')
  const dist = readFileSync(BINDINGS_DIST, 'utf8')
  const plane = readFileSync(PLANE_SRC, 'utf8')
  const planeKeys = new Set([...plane.matchAll(/input\.backends\?\.([A-Za-z0-9]+)/g)].map((m) => m[1]))

  it('the shipped mirror IS the source (byte-identical glue law — the pairing below covers the install face)', () => {
    expect(Buffer.from(dist).equals(Buffer.from(src))).toBe(true)
  })

  it('the guard names the G3 inject and EVERY guard-named a5 inject has exactly one conditional spread row (the audited lost-row class)', () => {
    for (const text of [src, dist]) {
      const { guardLine, slice, rows } = backendsAssembly(text)
      const guardVars = [...new Set([...guardLine.matchAll(/a5[A-Za-z0-9]+/g)].map((m) => m[0]))]
      expect(guardVars, 'the guard must keep naming the terminal inject').toContain('a5G3TerminalInject')
      for (const variable of guardVars) {
        const carriers = rows.filter((row) => row.cond.includes(variable))
        expect(carriers.length, `${variable} must be carried by exactly one backends spread row (guard names it; a lost row is the 760364998 regression)`).toBe(1)
      }
      for (const row of rows) {
        expect(planeKeys.has(row.key), `backends spread hands the plane a key it never reads: ${row.key}`).toBe(true)
      }
      // the g1Arm row uses the INVERTED ternary (cond ? { g1Arm: .. } : {})
      // — it must stay gated too, and the plane must read its key.
      expect(slice, 'the g1Arm row must stay a gated ternary').toMatch(/planeCfg\?\.g1PureQuery !== undefined[\s\S]{0,240}\? \{ g1Arm:/)
      expect(planeKeys.has('g1Arm'), 'the real plane must read input.backends?.g1Arm').toBe(true)
      // the audited pair, pinned verbatim: a5G3TerminalInject -> key terminal.
      const g3 = rows.find((row) => row.cond.includes('a5G3TerminalInject'))
      expect(g3?.key, 'the terminal inject rides the terminal key').toBe('terminal')
      expect(planeKeys.has('terminal'), 'the real plane must read input.backends?.terminal').toBe(true)
    }
  })

  it('no unconditional backends row exists (zero-flip: every family row is gated by its own test)', () => {
    for (const text of [src, dist]) {
      const { slice, rows } = backendsAssembly(text)
      const spreadCount = [...slice.matchAll(/\.\.\.\(/g)].length
      // rows + the guard line's own ...( + the inverted-ternary g1Arm row
      expect(spreadCount, 'every ...( inside the union is a gated row (none bare)').toBe(rows.length + 2)
    }
  })
})
