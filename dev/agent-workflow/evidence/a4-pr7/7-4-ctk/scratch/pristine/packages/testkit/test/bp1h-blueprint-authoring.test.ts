/**
 * BP10 (issue #2 blueprint-loading parallel repair, plan §14) — the
 * minimal local authoring helper (scripts/blueprint-authoring.mjs):
 * `stage` / `validate-save` semantics + the plan's conditional FROZEN
 * guard (the same-process registry probe).
 *
 * Plan §14 invariants pinned here:
 *   - `stage`: writes/keeps `*.draft.yaml`, NO validation (an existing
 *     draft is kept byte-for-byte — the user edits it directly in their
 *     editor); the only refusal is the filename-safety guard.
 *   - `validate-save`: the format inspector (BP-B identity-level read) +
 *     the identity extraction + the atomic target replace — and NOTHING
 *     stronger: an inspector-ok but strong-parse-invalid source IS
 *     written (the catalog lists it; resolving it fails closed with the
 *     strong parser's exact diagnosis — the plan's logical-broken-file
 *     tolerance).
 *   - the conditional frozen guard: IF the helper can obtain the registry
 *     repository through the same process / a test harness, the FROZEN
 *     identity MUST directly reject a same-revision write (the probe
 *     path). The standalone CLI carries no probe (no public durable seam
 *     to the live runtime registry) and the runtime registry remains the
 *     authority (docs/blueprint-authoring.md — frozen = the authority no
 *     longer changes, NOT an OS file read-only bit).
 *
 * Runner: the plain-node shim runner (`node scripts/run-tests.mjs
 * testkit` or the single-file temp runner) — SYNC it bodies only.
 *
 * @module @dsh-agent-team/testkit/test/bp1h-blueprint-authoring
 */
import { describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  draftSkeleton,
  stageDraft,
  validateAndSave,
} from '../../../scripts/blueprint-authoring.mjs'

/**
 * The scratch root (the WORKTREE ROOT, outside packages/** — the p4t6
 * session-event scan must never see it; removed at the top of the suite
 * and in the teardown it below — the .tmp-fault residue discipline).
 */
const scratch = join(process.cwd(), '.tmp-bp1h')

try {
  rmSync(scratch, { recursive: true, force: true })
} catch {
  // Absent — fresh.
}
mkdirSync(scratch, { recursive: true })

describe('blueprint-authoring helper (BP10, plan §14)', () => {
  it('stage creates the minimal closed skeleton once, then keeps the existing draft byte-for-byte (no validation, no clobber)', () => {
    const first = stageDraft({ blueprintId: 'bp1-h-a', blueprintDir: join(scratch, 'bp') })
    expect(first.status).toBe('staged')
    if (first.status !== 'staged') return
    expect(first.created).toBe(true)
    expect(existsSync(first.path)).toBe(true)
    const written = readFileSync(first.path, 'utf8')
    expect(written).toBe(draftSkeleton('bp1-h-a'))
    // The user edits the draft directly in their editor.
    const edited = written.replace('member-1', 'member-1-edited')
    writeFileSync(first.path, edited, 'utf8')
    const second = stageDraft({ blueprintId: 'bp1-h-a', blueprintDir: join(scratch, 'bp') })
    expect(second.status).toBe('staged')
    if (second.status !== 'staged') return
    expect(second.created).toBe(false)
    expect(readFileSync(second.path, 'utf8')).toBe(edited)
  })

  it('stage refuses a filename-unsafe id (the only guard — NOT blueprint validation)', () => {
    const result = stageDraft({ blueprintId: 'bad/../id', blueprintDir: join(scratch, 'bp') })
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.reason).toBe('unsafe-id')
  })

  it('validate-save: the format inspector + the identity extraction + the atomic target replace (no strong validation)', () => {
    const staged = stageDraft({ blueprintId: 'bp1-h-b', blueprintDir: join(scratch, 'bp') })
    expect(staged.status).toBe('staged')
    if (staged.status !== 'staged') return
    const draftPath = staged.path
    const result = validateAndSave({ draftPath, blueprintDir: join(scratch, 'bp') })
    expect(result.status).toBe('saved')
    if (result.status !== 'saved') return
    expect(result.path).toBe(join(scratch, 'bp', 'bp1-h-b.yaml'))
    expect(result.identity).toEqual({ schemaVersion: 1, blueprintId: 'bp1-h-b', revision: '1' })
    expect(readFileSync(result.path, 'utf8')).toBe(readFileSync(draftPath, 'utf8'))
    // The draft survives (the authoring loop keeps iterating on it).
    expect(existsSync(draftPath)).toBe(true)
    // No tmp residue (the atomic replace completed).
    const leftovers = readdirSync(join(scratch, 'bp')).filter((name) => name.includes('.tmp-'))
    expect(leftovers.length).toBe(0)
  })

  it('validate-save: an inspector-rejected source is refused and NO target is written', () => {
    writeFileSync(join(scratch, 'broken.draft.yaml'), 'not a blueprint at all', 'utf8')
    const result = validateAndSave({
      draftPath: join(scratch, 'broken.draft.yaml'),
      blueprintDir: join(scratch, 'out'),
    })
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.reason).toBe('inspection-rejected')
    expect(existsSync(join(scratch, 'out'))).toBe(false)
  })

  it('validate-save: a missing draft is refused under draft-not-found', () => {
    const result = validateAndSave({ draftPath: join(scratch, 'absent.draft.yaml') })
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(result.reason).toBe('draft-not-found')
  })

  it('validate-save: an inspector-ok but strong-parse-invalid source IS written (no strong validation — the catalog lists it, resolution fails closed)', () => {
    writeFileSync(
      join(scratch, 'weak.draft.yaml'),
      [
        '---',
        'schemaVersion: 1',
        'blueprintId: BP1-H',
        'revision: "1"',
        'leader:',
        '  templateId: 42',
        'members: []',
        'requirements: []',
        'memberEnvelopes: []',
        'policyStates: []',
        'metadata: {}',
        '---',
        '',
      ].join('\n'),
      'utf8',
    )
    const result = validateAndSave({
      draftPath: join(scratch, 'weak.draft.yaml'),
      blueprintDir: join(scratch, 'out'),
    })
    expect(result.status).toBe('saved')
    if (result.status !== 'saved') return
    expect(result.identity).toEqual({ schemaVersion: 1, blueprintId: 'BP1-H', revision: '1' })
    expect(existsSync(result.path)).toBe(true)
  })

  it('validate-save: the FROZEN guard (the plan conditional — the same-process registry probe) refuses a same-revision write; an unfrozen identity saves', () => {
    const staged = stageDraft({ blueprintId: 'bp1-h-c', blueprintDir: join(scratch, 'frozen') })
    expect(staged.status).toBe('staged')
    if (staged.status !== 'staged') return
    const frozenProbe = (blueprintId: string, revision: string): unknown =>
      blueprintId === 'bp1-h-c' && revision === '1'
        ? { blueprintId: 'bp1-h-c', revision: '1', contentHash: 'sha256:deadbeef', source: 'frozen' }
        : null
    const refused = validateAndSave({
      draftPath: staged.path,
      blueprintDir: join(scratch, 'frozen'),
      registryProbe: frozenProbe,
    })
    expect(refused.status).toBe('rejected')
    if (refused.status !== 'rejected') return
    expect(refused.reason).toBe('frozen-revision')
    // The frozen identity is never written over.
    expect(existsSync(join(scratch, 'frozen', 'bp1-h-c.yaml'))).toBe(false)
    // The SAME identity through an unfrozen probe saves (the guard is
    // purely the probe's answer — no second authority).
    const allowed = validateAndSave({
      draftPath: staged.path,
      blueprintDir: join(scratch, 'frozen'),
      registryProbe: () => null,
    })
    expect(allowed.status).toBe('saved')
    if (allowed.status !== 'saved') return
    expect(existsSync(allowed.path)).toBe(true)
  })

  it('suite teardown: the scratch is removed (the p4t6 scan must never see it)', () => {
    rmSync(scratch, { recursive: true, force: true })
    expect(existsSync(scratch)).toBe(false)
  })
})
