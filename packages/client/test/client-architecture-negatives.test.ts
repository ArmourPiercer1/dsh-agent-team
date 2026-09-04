/**
 * P9-T10 (P9-S7) — the seven negative architecture tests over the client
 * source plane (`packages/client/src`), runner-executable (plan §P9-S7
 * "Negative architecture tests").
 *
 * Each test is a source-text absence scan over EVERY `.ts` / `.tsx` file
 * under `packages/client/src` (the executed and the value graph alike).
 * The scan is the committed, re-runnable evidence that the vNext client
 * stays on the frozen public seams and never re-couples to the host-owned
 * planes.
 *
 * Token ↔ plan-bullet mapping (frozen plan lines, quoted verbatim):
 *
 *   1. `@dsh-agent-team/domain`            — "client src contains no
 *      domain imports" (the TeamDomain is host-owned: the client reads
 *      projections, never the domain store);
 *   2. `@dsh-agent-team/storage`           — "client src contains no
 *      storage imports" (persistence is host-owned);
 *   3. `sessions.teams`                    — "no ctx.sessions.teams mirror
 *      dependency" (the native sessions seam exposes `open` / `create`
 *      only — there is no `teams` mirror property to depend on);
 *   4. `messagesBefore` (case-insensitive) — "no pageMessagesBefore /
 *      messagesBefore Team history path" (both spellings and casings: Team
 *      history is the frozen team-wide ledger, never a page of session
 *      messages);
 *   5. `conversation.chat.node`            — "no team-marker conversation
 *      node registration" (the frozen legacy slot name the dropped marker
 *      registered into; native Chat stays exactly what native DSH
 *      renders);
 *   6. `querySelector`                     — "no document.querySelector tab
 *      navigation" (tab activation rides the frozen `openTeamTab` seam
 *      face — a no-op degradation outside a team session);
 *   7. `TEAM_MARKER_KIND` / `teamMarkerDefinition` /
 *      `ConversationNodeDefinition` / `team-marker` — "no synthetic
 *      Chat/Trajectory event generation". DIVERGENCE (recorded): the plan
 *      bullet is worded over the legacy mechanism, and the literal word
 *      "trajectory" occurs LEGITIMATELY in the vNext src plane (the
 *      `degradedTo: 'native-chat-trajectory'` degradation-target enum
 *      value in model/team-legacy.ts, the user-facing locale strings, and
 *      the jscpd exclusion comments) — a bare-word scan would false-
 *      positive on accepted code. The frozen legacy mechanism IS the four
 *      identifiers below (the marker kind, its definition export, the
 *      runtime node type, and its registration key); the four `team/*`
 *      SessionEvent strings the mechanism consumed are additionally
 *      pinned by the repo-wide p4t6 session-event denylist. Asserting the
 *      four identifiers therefore pins exactly the synthetic-event
 *      generation surface with zero false positives.
 *
 * Comment handling: a hit in a PURE comment line (a line whose first
 * non-whitespace characters are `//`, `*`, or `/*`) is NOT a path, a
 * registration, or a call — the vNext src files document their own
 * non-registrations in doc comments, which would otherwise false-positive.
 * Code lines are always scanned (a token on a code line that carries a
 * trailing comment is still a hit). Verified for this source plane: no
 * line begins a single-line block comment and then carries code after
 * the close.
 *
 * A detector-live control (one synthetic sample carrying every token)
 * proves the scanner flags each pattern, so a green negative cannot be a
 * vacuous scan.
 *
 * Shim-constrained spec (run-tests.mjs): all work is at module level (the
 * scan runs once at import); every `it()` body asserts on the single
 * module-level scan result.
 * Matchers used: toBe / toEqual / toBeGreaterThan (+ .not) only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** One scanned file (path relative to `packages/client/src`, slash form). */
interface ScannedFile {
  readonly path: string
  /** The code-line text (pure comment lines removed) — what is scanned. */
  readonly codeText: string
}

const SRC_ROOT = fileURLToPath(new URL('../src', import.meta.url))

/** Recursively list the absolute paths under one directory. */
function listFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`
    if (statSync(full).isDirectory()) {
      for (const nested of listFiles(full)) out.push(nested)
    } else {
      out.push(full)
    }
  }
  return out
}

/**
 * The code lines of one source file: every line whose first non-
 * whitespace characters are NOT a comment opener (`//`, `*`, `/*`).
 */
function toCodeText(text: string): string {
  const kept: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t === '') continue
    if (t.startsWith('//')) continue
    if (t.startsWith('*')) continue
    if (t.startsWith('/*')) continue
    kept.push(line)
  }
  return kept.join('\n')
}

/** Every `.ts` / `.tsx` file under `packages/client/src`, in walk order. */
const scanned: ScannedFile[] = listFiles(SRC_ROOT)
  .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
  .map((path) => ({
    path: path.slice(SRC_ROOT.length + 1).replace(/\\/g, '/'),
    codeText: toCodeText(readFileSync(path, 'utf8')),
  }))

/**
 * The paths whose CODE text contains `token`.
 * `ci` scans lowercased text for the lowercased token (the
 * `messagesBefore` bullet covers both spellings' casings).
 */
function hits(token: string, ci = false): string[] {
  return scanned
    .filter((file) =>
      ci
        ? file.codeText.toLowerCase().includes(token.toLowerCase())
        : file.codeText.includes(token),
    )
    .map((file) => file.path)
}

/**
 * The token ↔ bullet table — the single source of truth for both the
 * detector-live control and the seven negative tests.
 */
const CHECKS: readonly (readonly [token: string, ci: boolean])[] = [
  ['@dsh-agent-team/domain', false],
  ['@dsh-agent-team/storage', false],
  ['sessions.teams', false],
  ['messagesBefore', true],
  ['conversation.chat.node', false],
  ['querySelector', false],
  ['TEAM_MARKER_KIND', false],
  ['teamMarkerDefinition', false],
  ['ConversationNodeDefinition', false],
  ['team-marker', false],
]

/**
 * The detector-live control: one synthetic code line carrying every token
 * in exactly the casing each check scans for. The probe scan must flag it
 * for EVERY pattern — otherwise a green negative could be a vacuous scan.
 */
const controlCode =
  "import domain from '@dsh-agent-team/domain'; " +
  "import storage from '@dsh-agent-team/storage'; " +
  'const teams = ctx.sessions.teams; ' +
  'const page = pageMessagesBefore(sessionId); ' +
  "slots.inject('conversation.chat.node', () => slots.register({ name: 'conversation.chat.node' })); " +
  "const tab = document.querySelector('.team-tab'); " +
  "const marker = TEAM_MARKER_KIND + teamMarkerDefinition + 'ConversationNodeDefinition' + 'team-marker';"
const controlHits = (token: string, ci: boolean): number =>
  (ci
    ? controlCode.toLowerCase().includes(token.toLowerCase())
    : controlCode.includes(token))
    ? 1
    : 0

describe('P9-T10 (P9-S7) negative architecture — client src plane', () => {
  it('the scan covers the complete source plane (a meaningful, non-empty walk)', () => {
    expect(scanned.length).toBeGreaterThan(20)
    expect(scanned.some((file) => file.path === 'plugin/client.ts')).toBe(true)
    expect(scanned.some((file) => file.path === 'plugin/team-mount-core.ts')).toBe(true)
    expect(scanned.some((file) => file.path === 'ui/TeamView.tsx')).toBe(true)
  })

  it('the detector is live: the control sample is flagged for every pattern', () => {
    for (const [token, ci] of CHECKS) {
      expect(controlHits(token, ci)).toBe(1)
    }
  })

  it('no @dsh-agent-team/domain imports (the TeamDomain is host-owned)', () => {
    expect(hits('@dsh-agent-team/domain')).toEqual([])
  })

  it('no @dsh-agent-team/storage imports (persistence is host-owned)', () => {
    expect(hits('@dsh-agent-team/storage')).toEqual([])
  })

  it('no ctx.sessions.teams mirror dependency (the sessions seam is open/create only)', () => {
    expect(hits('sessions.teams')).toEqual([])
  })

  it('no pageMessagesBefore/messagesBefore Team history path (history is the team ledger)', () => {
    expect(hits('messagesBefore', true)).toEqual([])
  })

  it('no team-marker conversation node registration (the marker is dropped, never registered)', () => {
    expect(hits('conversation.chat.node')).toEqual([])
  })

  it('no document.querySelector tab navigation (activation rides the frozen seam face)', () => {
    expect(hits('querySelector')).toEqual([])
  })

  it('no synthetic Chat/Trajectory event generation (zero legacy synthetic-event identifiers)', () => {
    expect(hits('TEAM_MARKER_KIND')).toEqual([])
    expect(hits('teamMarkerDefinition')).toEqual([])
    expect(hits('ConversationNodeDefinition')).toEqual([])
    expect(hits('team-marker')).toEqual([])
  })
})
