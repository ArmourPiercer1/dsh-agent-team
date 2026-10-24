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

const pkgRoot = new URL('../', import.meta.url).href
const BINDINGS_SRC = fileURLToPath(new URL('src/plugin/live/agent-bindings.mjs', pkgRoot).href)
const BINDINGS_DIST = fileURLToPath(new URL('dist/packages/runtime/src/plugin/live/agent-bindings.mjs', pkgRoot).href)
const PLANE_SRC = fileURLToPath(new URL('src/plugin/live/team-tool-plane.mjs', pkgRoot).href)

const backendsAssembly = (text: string) => {
  const guardLine = text.split('\n').find((line) => line.includes('? {} : { backends: {'))
  if (guardLine === undefined) throw new Error('the shared backends guard line is gone from the real bindings source')
  const from = text.indexOf(guardLine)
  const close = text.indexOf('\n          } }),', from)
  if (close < 0) throw new Error('the shared backends literal does not close')
  // comment-only lines are not rows (a commented-out spread must read as LOST)
  const slice = text.slice(from, close).split('\n').filter((line) => !line.trim().startsWith('//')).join('\n')
  const rows: Array<{ condVar: string | null; cond: string; key: string }> = []
  for (const [, condRaw, keyRaw] of slice.matchAll(/\.\.\.\(([\s\S]*?)\? \{\} : \{ ([A-Za-z0-9]+):/g)) {
    if (keyRaw === undefined || condRaw === undefined) continue // groups participate by construction; the skip is belt-and-braces, never a silent accept
    if (keyRaw === 'backends') continue // the guard line itself opens with ...( and hands over `backends:` itself
    const cond = condRaw.trim()
    const vars = [...cond.matchAll(/a5[A-Za-z0-9]+/g)].map((v) => v[0]).filter((v): v is string => v !== undefined)
    rows.push({ condVar: vars.length === 1 ? vars[0] ?? null : null, cond, key: keyRaw })
  }
  // A5M2-CENTER (2026-10-24, e78 re-anchor merge): the WHOLE-BACKENDS spread
  // class — `...(a5X === null ? {} : a5X.backends)` — hands over MANY keys
  // through ONE gated row (the G2 mount's frozen face). Same zero-flip law
  // (null = no keys at all), but no literal key follows the `:`, so the
  // pattern above cannot see it; recognizing it here keeps the lost-row law
  // TOTAL, and the key pairing moves to the dedicated center leg below.
  const wholeSpreads: string[] = []
  for (const [, varRaw] of slice.matchAll(/\.\.\.\((a5[A-Za-z0-9]+) === null \? \{\} : \1\.backends\)/g)) {
    if (varRaw !== undefined) wholeSpreads.push(varRaw)
  }
  return { guardLine, slice, rows, wholeSpreads }
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
      const { guardLine, slice, rows, wholeSpreads } = backendsAssembly(text)
      const guardVars = [...new Set([...guardLine.matchAll(/a5[A-Za-z0-9]+/g)].map((m) => m[0]))]
      expect(guardVars, 'the guard must keep naming the terminal inject').toContain('a5G3TerminalInject')
      for (const variable of guardVars) {
        const carriers = rows.filter((row) => row.cond.includes(variable)).length
          + wholeSpreads.filter((v) => v === variable).length
        expect(carriers, `${variable} must be carried by exactly one backends spread row (guard names it; a lost row is the 760364998 regression)`).toBe(1)
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
      // A5M2-G3 B-PTC run_code (root 04:4x card): the audited pair, pinned
      // verbatim — a5G3RunCodeInject -> key runCode. A lost row here is the
      // same 760364998 class the guard-carrier loop above measures; the
      // explicit pin names it for THIS family.
      const rc = rows.find((row) => row.cond.includes('a5G3RunCodeInject'))
      expect(rc?.key, 'the run_code inject rides the runCode key').toBe('runCode')
      expect(planeKeys.has('runCode'), 'the real plane must read input.backends?.runCode').toBe(true)
    }
  })

  it('no unconditional backends row exists (zero-flip: every family row is gated by its own test)', () => {
    for (const text of [src, dist]) {
      const { slice, rows, wholeSpreads } = backendsAssembly(text)
      const spreadCount = [...slice.matchAll(/\.\.\.\(/g)].length
      // rows + the guard line's own ...( + the inverted-ternary g1Arm row
      // + whole-backends spreads (each still `=== null`-gated, center 2026-10-24)
      expect(spreadCount, 'every ...( inside the union is a gated row (none bare)').toBe(rows.length + wholeSpreads.length + 2)
    }
  })

  // A5M2-CENTER leg (2026-10-24, e78 re-anchor merge; root law: a whole-
  // backends spread is legal ONLY as a gated `=== null ? {} : X.backends`
  // row AND its keys must be exactly the keys the plane's G2 surface table
  // reads). The G2 mount hands over g2Mcp/g2Browser/g2Web as ONE frozen
  // face (builder g2-team-mount.mjs backends.g2Mcp/:163 g2Browser/:228
  // g2Web/:279); the plane never reads them as `input.backends?.<key>`
  // literals — it reads them DYNAMICALLY at `input.backends?.[surface
  // .injectKey]` over its own surface table. So THIS leg pins the key set
  // against the surface table instead of the literal-read set the loop
  // above uses; a builder key renamed/added without the matching surface
  // row is RED, and the spread silently losing its row is RED through the
  // guard-carrier law above.
  const G2_MOUNT_SRC = fileURLToPath(new URL('src/plugin/live/governed-families/g2-team-mount.mjs', pkgRoot).href)
  it('the whole-backends spread class stays gated and its key set equals the plane G2 surface injectKey table (center 2026-10-24)', () => {
    for (const text of [src, dist]) {
      const { wholeSpreads } = backendsAssembly(text)
      expect(wholeSpreads, 'exactly one whole-backends spread today: the G2 mount').toEqual(['a5G2Mount'])
      expect(text, 'the G2 spread keeps its null-gated form verbatim').toContain('...(a5G2Mount === null ? {} : a5G2Mount.backends),')
    }
    const mount = readFileSync(G2_MOUNT_SRC, 'utf8')
    const builderKeys = new Set([...mount.matchAll(/^\s*backends\.([A-Za-z0-9]+) =/gm)].map((m) => m[1]))
    const surfaceKeys = new Set([...plane.matchAll(/injectKey: '([A-Za-z0-9]+)'/g)].map((m) => m[1]))
    expect(builderKeys, 'the builder must still hand exactly the G2 trio').toEqual(new Set(['g2Mcp', 'g2Browser', 'g2Web']))
    for (const key of builderKeys) {
      expect(surfaceKeys.has(key), `plane G2 surface table must read backends.${key} via its injectKey`).toBe(true)
    }
    expect(plane, 'the plane must read the face dynamically through the surface table').toContain('input.backends?.[surface.injectKey]')
  })
})
