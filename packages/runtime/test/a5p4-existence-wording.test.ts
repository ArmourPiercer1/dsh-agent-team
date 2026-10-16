/**
 * a5p4-existence-wording — the probe-surface ruling (pr4-pre findings §3,
 * adopted by C-PROC): existence checks (launcher on PATH, runnerCommand,
 * python3) are PRECONDITION REPORTS ONLY, and their failure wording must
 * never contain a kernel-capability assertion — the host bash backend's
 * historical defect was exactly that ("a missing binary probes `unusable`
 * the same way an unenforcing kernel does", and the "Landlock-enforcing
 * kernel" guidance string). The fix on THIS side is the lane law pinned here;
 * the host-side copy fix is an upstream seam REQUEST (lane doc §S), not an
 * edit this lane may make.
 *
 * @module packages/runtime/test/a5p4-existence-wording.test
 */

import { describe, expect, it } from 'vitest'
import { KERNEL_ASSERTION_FORBIDDEN, runAvailabilityPreflight } from '../sandbox-provider/probe-abi.js'

describe('a5p4 existence preflight wording law', () => {
  it('reports presence per subject without ever asserting kernel capability', () => {
    const rows = runAvailabilityPreflight({
      pythonPath: '/nonexistent/a5p4/python3',
      launcherPath: '/nonexistent/a5p4/launcher.py',
      runnerCommand: null,
    })
    expect(rows.map((r) => r.subject)).toEqual(['python3', 'launcher-script', 'runner-command'])
    const python = rows.find((r) => r.subject === 'python3')
    expect(python?.present).toBe(false)
    for (const row of rows) {
      const lower = row.note.toLowerCase()
      for (const banned of KERNEL_ASSERTION_FORBIDDEN) {
        expect(lower, `${row.subject}: "${row.note}" must not assert "${banned}"`).not.toContain(banned)
      }
      // Presence reports state exactly what was looked for and not found.
      expect(lower).toMatch(/precondition|not found|present/)
    }
  })

  it('a missing runnerCommand is reported as a configuration absence, never as an inability of the platform', () => {
    const rows = runAvailabilityPreflight({
      pythonPath: 'python3',
      launcherPath: 'launcher.py',
      runnerCommand: null,
    })
    const runner = rows.find((r) => r.subject === 'runner-command')
    expect(runner?.present).toBe(false)
    expect(runner?.note.toLowerCase()).not.toMatch(/kernel|unable|unsupported/)
  })

  it('the forbidden-token list itself names the kernel-assertion vocabulary it guards', () => {
    expect(KERNEL_ASSERTION_FORBIDDEN).toContain('kernel')
    expect(KERNEL_ASSERTION_FORBIDDEN.some((t) => /enforc/i.test(t))).toBe(true)
  })
})
