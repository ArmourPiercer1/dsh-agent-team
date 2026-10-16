/**
 * `a5p5-render` — POSITIVE shape law of the Team-drawn presentation (S0 D-3:
 * the R3 renderer draws `presentationMeta` itself). RED-first.
 *
 * The contract: renderer lines are header / `stderr:` / `> ` body /
 * `a5p5-meta ` footer; the structured meta twin is returned ALONGSIDE the
 * text and never has to be re-parsed from it.
 *
 * @module test/a5p5-render
 */
import { describe, expect, it } from 'vitest'

import { renderSearchResult, renderShellResult } from '../src/render.js'
import type { SearchOutcome, ShellOutcome } from '../src/types.js'

const search = (overrides: Partial<SearchOutcome> = {}): SearchOutcome => ({
  outputMode: 'content',
  matches: [
    { path: 'src/app.ts', line: 7, column: 3, text: 'const x = 1' },
    { path: 'src/lib.ts', line: 2, text: 'let y = 2' },
  ],
  counts: [],
  files: [],
  totalMatches: 2,
  truncated: false,
  ...overrides,
})

const shell = (overrides: Partial<ShellOutcome> = {}): ShellOutcome => ({
  exitCode: 0,
  stdout: 'hello\nworld',
  stderr: '',
  timedOut: false,
  cancelled: false,
  truncated: false,
  ...overrides,
})

describe('a5p5-render: search', () => {
  it('renders content mode with one indented line per match and the meta twin', () => {
    const rendered = renderSearchResult(search())
    expect(rendered.presentationMeta).toEqual({ kind: 'search', outputMode: 'content', totalMatches: 2, truncated: false })
    const lines = rendered.text.split('\n')
    expect(lines[0]).toBe('search · content · 2 matches')
    expect(lines[1]).toBe('> src/app.ts:7:3: const x = 1')
    expect(lines[2]).toBe('> src/lib.ts:2: let y = 2')
    expect(lines[lines.length - 1]).toBe('a5p5-meta {"kind":"search","outputMode":"content","totalMatches":2,"truncated":false}')
    expect(Object.isFrozen(rendered)).toBe(true)
    expect(Object.isFrozen(rendered.presentationMeta)).toBe(true)
  })

  it('count and files modes render their own rows', () => {
    const counted = renderSearchResult({
      outputMode: 'count',
      matches: [],
      counts: [{ path: 'a.ts', count: 3 }],
      files: [],
      totalMatches: 3,
      truncated: false,
    })
    expect(counted.text).toContain('> a.ts: 3')
    const files = renderSearchResult({
      outputMode: 'files_with_matches',
      matches: [],
      counts: [],
      files: ['a.ts', 'b.ts'],
      totalMatches: 2,
      truncated: true,
    })
    expect(files.text).toContain('> a.ts')
    expect(files.text).toContain('> b.ts')
    expect(files.text).toContain('truncated')
    expect(files.presentationMeta.truncated).toBe(true)
  })

  it('zero matches is a truthful empty body, never a missing result', () => {
    const none = renderSearchResult({ outputMode: 'content', matches: [], counts: [], files: [], totalMatches: 0, truncated: false })
    expect(none.text.split('\n')).toEqual([
      'search · content · 0 matches',
      '> (no matches)',
      'a5p5-meta {"kind":"search","outputMode":"content","totalMatches":0,"truncated":false}',
    ])
  })
})

describe('a5p5-render: shell', () => {
  it('a clean exit prints the true code and both streams', () => {
    const rendered = renderShellResult(shell({ stderr: 'warn!' }))
    expect(rendered.presentationMeta).toEqual({ kind: 'shell', exitCode: 0, timedOut: false, cancelled: false, truncated: false })
    expect(rendered.text.split('\n')).toEqual([
      'bash · exit=0',
      '> hello',
      '> world',
      'stderr:',
      '> warn!',
      'a5p5-meta {"kind":"shell","exitCode":0,"timedOut":false,"cancelled":false,"truncated":false}',
    ])
  })

  it('timeout kills are honest: exit NOT OBSERVED, distinct from any code', () => {
    const rendered = renderShellResult(shell({ exitCode: null, stdout: '', timedOut: true }))
    expect(rendered.text).toContain('bash · exit=not-observed · timed-out')
    expect(rendered.text).toContain('> (empty stdout)')
    expect(rendered.presentationMeta.exitCode).toBe(null)
    expect(rendered.text).not.toContain('exit=0')
  })

  it('cancel is a distinct third shape (never "stopped-clean", never a timeout)', () => {
    const rendered = renderShellResult(shell({ exitCode: null, stdout: '', cancelled: true }))
    expect(rendered.text.split('\n')[0]).toBe('bash · cancelled')
    expect(rendered.text).not.toContain('timed-out')
  })

  it('renderer-side bound truncates and says so in meta', () => {
    const big = 'x'.repeat(5000)
    const rendered = renderShellResult(shell({ stdout: big }), { maxBytes: 100 })
    expect(rendered.presentationMeta.truncated).toBe(true)
    expect(rendered.text).toContain('> ' + 'x'.repeat(100))
    expect(rendered.text).toContain('> … output truncated …')
  })
})
