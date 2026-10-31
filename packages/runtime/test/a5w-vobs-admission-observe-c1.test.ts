/**
 * a5w-vobs C1 (dated 2026-10-31, real UTC) — THE KERNEL AUDIT ROWS ON THE
 * MOUNT FACE.
 *
 * THE FAILURE THIS SUITE OWNS (bw8 evidence, real host): the governed rows
 * RAN (the instance log carries `governed-image RAN bytes=69`) while the SAME
 * log carries ZERO admission audit rows — the L4 governance-chain acceptance
 * reads the instance log, so a run that admitted, approved and minted is
 * indistinguishable there from one that never reached the kernel. The event
 * source is real (packages/runtime/tool-admission/admission-kernel.ts —
 * :450 requires-approval, :307 grant-minted, :578 approved-grant-issued,
 * :490 approval-stale); what was missing is the MOUNT FACE: the assembly
 * sink in packages/runtime/src/plugin/live/team-tool-plane.mjs rendered each
 * object row as `a5p2prod: <event-name-only>` — callId, grantId, case ids
 * (the fields that make a row an AUDIT row) were dropped, so nothing on the
 * channel pairs a grant to a call.
 *
 * WHAT THIS SUITE PINS (all at the REAL assembly behind the real mount —
 * `createTeamToolPlaneAssembly` constructs the production
 * `createProductionAdmissionAssembly` over the REAL kernel; the legs run the
 * kernel's own landing edge through the C1 stand-in control leg,
 * `a5-m1-control-legs.mjs` — no fixture re-statement of the kernel):
 *  1. THE RENDERED SEQUENCE: an ask→approve→mint flow on a governed read
 *     leaves `a5-admission: event=…` rows in the kernel's own emission order
 *     (admission-requires-approval → admission-grant-minted →
 *     admission-approved-grant-issued), every row carrying the callId, and
 *     the mint/approval rows carrying the grantId / caseId that pair them to
 *     the ask row. NOT REACHABLE AT THIS FACE, named honestly:
 *     `admission-grant-consumed` — the kernel emits it only when the consume
 *     edge carries an `executionKind` (admission-kernel.ts:610 returns
 *     `{ lease: null }` WITHOUT observing before that leg), and the plane's
 *     row consume edge never passes one (team-tool-plane.mjs builds
 *     `consumeFacts` without executionKind) — pinned here as ZERO so a
 *     future wiring that DOES pass it must re-admit this disclosure.
 *  2. THE RENDER WHITELIST: rows carry ONLY the kernel's scalar identity
 *     fields. `detail` (a refusal message), `note` (prose embedding governed
 *     rule resource paths) and the structural `deniedEffects` / effect
 *     arrays are OMITTED: no row carries the stale message text, no row
 *     carries the world's absolute root path, no row stringifies an object.
 *     (A stale row is produced FOR REAL by a leg that forges a foreign case
 *     identity — the kernel's :490 arm with its live `detail` field.)
 *  3. THE ABSENT-SINK BASE: a mount that passes NO onObserve at all behaves
 *     byte-identically (the kernel's `options.onObserve ?? noop` leg,
 *     admission-kernel.ts:223 — the approval flow lands, the body runs).
 *
 * THE OTHER HALF OF THE FIX, pinned by leg 1's stdout witness: the plane
 * mount ECHOES every `a5-admission:` row to stdout in the shipped
 * `[dsh-agent-team]` style — the memory-only `observations` array never
 * reaches the instance log, and this is the exact logBackend law of the
 * same file (the bw8 log's `governed-image RAN` line is that face's own
 * witness). The echo lives on the mount face in team-tool-plane.mjs; the
 * digest-locked center (agent-bindings.mjs, ARC-A ledger) is NOT touched —
 * no override entry, no drift.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'

type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message?: string }
interface Definition {
  name: string
  execute: (raw: Record<string, unknown>) => Promise<Record<string, unknown>>
}
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  ownNames: readonly string[]
}

let row: { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built }

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests', 'homes', `a5w-vobs-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const TARGET = join(ROOT_DIR, 'audit-target.txt')
const REALM = 'a5w-vobs-realm'

beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as typeof row
  mkdirSync(ROOT_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'audit-target.txt'), 'a5w-vobs-before\n')
})

afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')

// Template default ASK with NO rules: every governed effect falls to the
// named ask lane default and must earn its authority through an ApprovalCase
// — the exact shape the bw8 ask→allow→mint→consume maneuver walks.
const POLICY_ASK_DEFAULT = Object.freeze({ default: 'ask', allow: [], ask: [] as unknown[], deny: [] as unknown[] })

function mountPlane(opts: { observe?: string[]; controlLeg?: unknown }): PlaneValue {
  const built = row.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'a5w-vobs-test-team-root',
    permissionPolicy: POLICY_ASK_DEFAULT,
    realmId: REALM,
    templateId: 'a5w-vobs-tpl',
    role: 'member',
    instanceId: 'a5w-vobs-instance',
    fs: { subtreeContains },
    plane: { fsInstance: { fs: 'a5w-vobs-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' } },
    ...(opts.observe === undefined ? {} : { onObserve: (r: unknown) => { opts.observe!.push(String(r)) } }),
    ...(opts.controlLeg === undefined ? {} : { controlLeg: opts.controlLeg }),
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  return built.value
}

const readRow = (plane: PlaneValue): Definition => {
  const d = plane.definitions.find((x) => x.name === 'read')
  if (d === undefined) throw new Error('no read definition on the governed plane')
  return d
}
const attempt = async (fn: () => Promise<unknown>): Promise<{ ok: true; value: unknown } | { ok: false; msg: string }> => {
  try { return { ok: true as const, value: await fn() } } catch (e) { return { ok: false as const, msg: String((e as Error)?.message ?? e) } }
}
const admissionRows = (observe: string[]): string[] => observe.filter((l) => l.startsWith('a5-admission: event='))
const rowFor = (observe: string[], event: string): string | undefined => admissionRows(observe).find((l) => l.includes(`event=${event} `) || l.endsWith(`event=${event}`))
const field = (line: string, key: string): string | undefined => {
  const m = new RegExp(`(?:^| )${key}=(\\S+)`).exec(line)
  return m === null || m === undefined ? undefined : m[1]
}

describe('a5w-vobs C1 — the admission kernel audit rows on the mount face (rendered sequence, whitelist, absent-sink base)', () => {
  it('C1-1 ask→approve→mint on a governed read renders the kernel sequence with pairing ids; consumed stays the disclosed zero at this face', async () => {
    const observe: string[] = []
    // THE STDOUT WITNESS: the instance log captures the plugin host's
    // stdout, so the echo face is asserted exactly there (spy law = the
    // globalThis.console.log the mount itself calls, logBackend law of the
    // same file). The mount is INSIDE the window: the mount-time rows echo
    // at construction too.
    const stdout: string[] = []
    type ConsoleLike = { log: (...args: unknown[]) => void }
    const g = globalThis as unknown as { console: ConsoleLike }
    const realLog = g.console.log
    g.console.log = (...args: unknown[]) => { stdout.push(args.map(String).join(' ')) }
    let plane: PlaneValue
    let r: { ok: true; value: unknown } | { ok: false; msg: string }
    try {
      plane = mountPlane({ observe, controlLeg: approvingControlLeg([]) })
      r = await attempt(() => readRow(plane).execute({ file_path: TARGET }))
    } finally {
      g.console.log = realLog
    }
    expect(r.ok).toBe(true)

    const requiresApproval = rowFor(observe, 'admission-requires-approval')
    const minted = rowFor(observe, 'admission-grant-minted')
    const issued = rowFor(observe, 'admission-approved-grant-issued')
    expect(requiresApproval, `requires-approval row missing from: ${JSON.stringify(admissionRows(observe))}`).toBeDefined()
    expect(minted, 'grant-minted row missing').toBeDefined()
    expect(issued, 'approved-grant-issued row missing').toBeDefined()

    // THE ORDER IS THE KERNEL'S OWN (admission-kernel.ts :450 before the
    // landing edge :307/:578 inside issueApprovedGrant).
    const idx = (l: string) => observe.indexOf(l)
    expect(idx(requiresApproval!)).toBeLessThan(idx(minted!))
    expect(idx(minted!)).toBeLessThan(idx(issued!))

    // THE AUDIT PAIRS: one callId across the three rows; the mint/approval
    // rows carry the grantId; the case id of the ask row is the case id the
    // grant was issued for (kernel field names: approvalCaseId at :450,
    // caseId at :578 — rendered VERBATIM, not renamed).
    const callId = field(requiresApproval!, 'callId')
    expect(callId, `callId missing on ${requiresApproval}`).toBeDefined()
    for (const line of [minted!, issued!]) {
      expect(field(line, 'callId')).toBe(callId)
    }
    const grantId = field(minted!, 'grantId')
    expect(grantId, `grantId missing on ${minted}`).toBeDefined()
    expect(field(issued!, 'grantId')).toBe(grantId)
    expect(field(issued!, 'caseId')).toBe(field(requiresApproval!, 'approvalCaseId'))

    // The RAN face stays the executor's own row; the audit rows ride beside it.
    expect(observe.some((l) => l.includes('governed-read RAN'))).toBe(true)

    // THE INSTANCE-LOG FACE: the SAME audit rows echo VERBATIM (channel row
    // byte-equal behind the shipped `[dsh-agent-team] ` prefix) beside the
    // executor's RAN line — one stdout log carrying BOTH faces is what the
    // L4 governance-chain acceptance reads. bw8: the RAN line was there,
    // the admission lines were zero; this leg is that failure's pin.
    const loggedAdmission = stdout.filter((l) => l.startsWith('[dsh-agent-team] a5-admission: event='))
    for (const event of ['admission-requires-approval', 'admission-grant-minted', 'admission-approved-grant-issued']) {
      const channelRow = rowFor(observe, event)
      expect(channelRow, `${event} absent on the channel`).toBeDefined()
      expect(loggedAdmission.includes(`[dsh-agent-team] ${channelRow!}`), `stdout lacks the verbatim ${event} row`).toBe(true)
    }
    expect(stdout.some((l) => l.startsWith('[dsh-agent-team] a5g7-read: governed-read RAN'))).toBe(true)

    // DISCLOSED UNREACHABLE AT THIS FACE: the kernel emits
    // `admission-grant-consumed` only behind an executionKind-bearing
    // consume (admission-kernel.ts:610-624); the plane row edge never
    // carries one, so this face pins ZERO — a wiring that changes that
    // must update this disclosure, not silently count a new row here.
    expect(rowFor(observe, 'admission-grant-consumed')).toBeUndefined()
  })

  it('C1-2 render whitelist: the kernel detail/note/structural fields never ride the rendered row (stale arm forged for real)', async () => {
    const observe: string[] = []
    // A leg that FORGES the approval identity moves the kernel's :490 arm —
    // the one emission whose row carries a live `detail` MESSAGE.
    const forgingLeg = async ({ callId, request, plan, assembly }: { callId: string; request: unknown; plan: Record<string, unknown>; assembly: { issueApprovedGrant: (r: unknown, a: Record<string, unknown>) => Promise<{ ok: boolean; error?: { message?: string } }> } }) => {
      const issued = await assembly.issueApprovedGrant(request, {
        approvalCaseId: 'FOREIGN-CASE-IDENTITY',
        reviewerAuthority: plan.requiredAuthority,
        beneficiaryAuthority: 'member',
        requiredAuthorityAtCreation: plan.requiredAuthority,
        effectSetFingerprint: plan.effectSetFingerprint,
        authorityGenerationAtCreation: plan.authorityGeneration,
        deniedEffectsAtCreation: plan.deniedEffects,
      })
      expect(issued.ok).toBe(false)
      return { decision: 'deny', requestId: `forged-${String(callId)}` }
    }
    const plane = mountPlane({ observe, controlLeg: forgingLeg })
    const r = await attempt(() => readRow(plane).execute({ file_path: TARGET }))
    expect(r.ok).toBe(false) // the body never runs on a stale approval

    const stale = rowFor(observe, 'admission-approval-stale')
    expect(stale, `stale row missing from: ${JSON.stringify(admissionRows(observe))}`).toBeDefined()
    // identity fields DO ride (callId, caseId — the kernel's own field name)…
    expect(field(stale!, 'caseId')).toBe('FOREIGN-CASE-IDENTITY')
    expect(field(stale!, 'callId')).toBeDefined()
    // …the MESSAGE field never does: `detail` is off the whitelist, so the
    // kernel sentence ("foreign case identity") appears nowhere on the row.
    expect(stale).not.toContain('foreign case identity')
    expect(stale).not.toContain('detail=')

    // WHOLE-FACE LAW: no a5-admission row carries the world's absolute root
    // path (the effect sets DO carry it — only the whitelist keeps it out),
    // no row stringifies an object/array, no row is multiline, no row
    // carries the projection-note prose (its text embeds rule paths).
    for (const line of admissionRows(observe)) {
      expect(line).not.toContain(ROOT_DIR)
      expect(line).not.toContain('[object')
      expect(line).not.toContain('{')
      expect(line).not.toContain('\n')
      expect(line.startsWith('a5-admission: event=')).toBe(true)
    }
    const requiresApproval = rowFor(observe, 'admission-requires-approval')
    expect(requiresApproval).toBeDefined()
    expect(requiresApproval).not.toContain('deniedEffects=')
    expect(requiresApproval).not.toContain('requiredEffects=')
    // the mount-time constructed/note rows also ride this channel: the note
    // PROSE is omitted, the constructed row keeps only identifier scalars.
    for (const line of admissionRows(observe).filter((l) => l.includes('event=production-admission-'))) {
      expect(line).not.toContain('note=')
      expect(line).not.toContain('rule ')
    }
  })

  it('C1-3 absent sink: a mount that passes NO onObserve behaves byte-identically (kernel noop leg)', async () => {
    writeFileSync(TARGET, 'a5w-vobs-before\n')
    const plane = mountPlane({ controlLeg: approvingControlLeg([]) })
    const r = await attempt(() => readRow(plane).execute({ file_path: TARGET }))
    expect(r.ok).toBe(true) // observe absence changes nothing: the approval lands, the body runs
    expect(readFileSync(TARGET, 'utf8')).toBe('a5w-vobs-before\n')
  })
})
