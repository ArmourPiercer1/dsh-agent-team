/**
 * tests/world-factory/suites/150-a5sf-read.mjs — the `a5sf-read` C2 suite:
 * BL-14 / P2-01, the FIRST P2 representative mechanism (native `read`).
 *
 * WHAT BL-14 ASKS FOR (ALPHA5-SANDBOX-BACKLOG.md BL-14): one integrable
 * minimal vertical slice for the native `read` tool —
 *   1. the tool is ALLOWED inside a compiled ceiling and actually reads
 *      through the Provider;
 *   2. a read OUTSIDE the compiled ceiling is REFUSED before the read (no
 *      content leak);
 *   3. the P2-01 specifics: a >10MiB file read through the native window /
 *      stream, a forbidden read is a real typed refusal, and two Members do
 *      not share authority (Member A's allow is not Member B's allow).
 *
 * THIS FILE SHIPS TWO MODES, AND SAYS WHICH ONE HAS BEEN RUN.
 *
 *   --dry  (host-free, runnable NOW, zero budget): the REAL P1 compiler
 *          (`compileMemberPolicy` / `projectToolIoRestriction` /
 *          `compileEffectiveIo`), the REAL shipped guard
 *          (`createMemberFsGuard`), the REAL locator algebra
 *          (`path-rules.ts#matchLocator`), the REAL R3 recorder
 *          (`lib/a5sf-evidence.mjs`) and the REAL R4 reader
 *          (`scripts/a5sf-diag.mjs`). The read itself is performed by a
 *          host-free `dry` driver over node:fs — it is NOT the native `read`
 *          tool and NOT a Host. Every dry leg is executed and asserted.
 *
 *   --live (needs a budget grant AND a live read driver, spawns ONE Host):
 *          the same scenario code driven through `A5SF_READ_DRIVER` — a
 *          module that mounts the compiled ceiling's confined Provider on the
 *          LIVE Host root and performs the native `read`. THAT DRIVER DOES NOT
 *          EXIST IN THIS TREE, and this suite still REFUSES at the seam probe
 *          (`LIVE_SEAM_UNAVAILABLE`) BEFORE the grant gate and BEFORE any
 *          World/ledger write — it spends ZERO host starts and prints why.
 *          See evidence/a5sf-p2-read/README.md §2/§5.
 *
 *          2026-11-12 DATED NOTE (the sentence above is no longer the whole
 *          truth, the REFUSAL is unchanged). A production caller of the realm
 *          mount DOES exist now for live Members: `agent-bindings.mjs` calls
 *          `mountMemberA5sfRealm`, and
 *          `evidence/a5sf-live-member/` drives a real Member turn through the
 *          shipped governed preset on a booted Host (admitted + denied reads,
 *          the Member's own transcript). That is a DIFFERENT seam and a
 *          DIFFERENT proposition: it proves the Member's confined `bash` on a
 *          `team_delegate` child, not this suite's native `read` on the LIVE
 *          root, and it is DEV-LIVE evidence only. Wiring `--live` to that
 *          driver would swap the proposition and launder a dev boot into a
 *          candidate run, so `resolveReadDriver` keeps refusing. The missing
 *          contract is unchanged: a module that runs where the compiled
 *          Provider is mounted (the Host process, or an RPC into it) and
 *          performs the native read.
 *
 * BUDGET PRE-REGISTRATION (the law this file exists to make enforceable).
 * The shared host-start budget pool is 0 and every new boot needs a USER
 * ruling. `preRegisterReadBudget()` therefore REQUIRES a recorded grant
 * (`{grantId, maxStarts, grantedBy, boundCommit}`) and refuses with the one
 * typed code `BUDGET_NOT_GRANTED` (reason in a closed vocabulary) when the
 * grant is absent / unreadable / ambiguous / malformed / exhausted / bound to
 * another commit / too small for the declared boots. A refusal happens BEFORE
 * any ledger write, any World creation and any spawn.
 *
 * 2026-11-09 OWNER RULING — TWO GRANT SCOPES, ONE GATE.
 * Development boots are no longer a fixed-cumulative, Integration-Owner-only
 * activity. A `dev-live` scope authorisation (a grant row with
 * `scope: "dev-live"`) authorises an IMPLEMENTER to start real Hosts
 * repeatedly on its own authority, inside its own isolated test World, for a
 * named face — provided every start still registers a ledger row and the
 * machine-wide cap of {@link DEV_LIVE_SLOT_LIMIT} concurrent dev Hosts holds.
 * The per-run `CANDIDATE-C2` grant is unchanged: it still needs
 * `maxStarts` + `boundCommit`, still reserves a row, still spends at most the
 * granted number of starts, and a dev-live grant can NEVER satisfy it (scopes
 * never cross: `GRANT_SCOPE_MISMATCH`). `preRegisterDevLiveBudget()` is the
 * dev-live half; `preRegisterBudget()` dispatches on the grant's own scope and
 * is what `run()` uses. A dev-live start additionally requires the run record
 * to be labelled `recordClass: "DEV-LIVE"` — a class that can never produce a
 * `V@B=yes` claim (`lib/acceptance-claim.mjs`).
 *
 * `maxStarts` counts SHARED-LEDGER ROWS, not spawns: the pre-registration row
 * this file appends is a BUDGET RESERVATION on that same ledger, so a grant of
 * `maxStarts` permits `maxStarts - 1` boots (BL-14 needs ONE boot ⇒ 2). There
 * is exactly ONE counter (`lib/run-record.mjs#ledgerStartCount`, read through
 * the ONE gate `hostStartBudgetPosition`) and exactly ONE writer
 * (`run-record.mjs#logHostStart`) — this suite keeps no counter of its own and
 * writes no ledger of its own. The reservation over-counts a crashed run
 * (fail-closed: the pool can only look MORE spent, never less).
 *
 * The intent row is appended through the caller's run record — the same object
 * `lib/a5sf-harness.mjs#createA5sfHarness` receives — and `lease.boot()` then
 * hands the actual boot to `harness.boot()`, which appends its own start row to
 * the SAME ledger BEFORE `world.startHost()`. Ordering is therefore
 * intent → start row → spawn.
 *
 * WHY A COLLECTED SUITE FILE IS NAMED `150-`: `lib/suites.mjs` enumerates
 * `^\d{3}-([a-z0-9][a-z0-9-]*)\.mjs$` and requires the suite name to equal the
 * file's name part, so the backlog's `suites/a5sf-read.mjs` is the suite NAME;
 * the file must carry the ordering prefix (150 = next free after 140).
 *
 * @module tests/world-factory/suites/150-a5sf-read
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readSync, openSync, closeSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { VERDICT_SEVERITY, hostStartBudgetPosition } from '../lib/run-record.mjs'
import { acquireDevLiveSlot, DEV_LIVE_SLOT_HEARTBEAT_MS } from '../lib/dev-live-slots.mjs'

export const SUITE_NAME = 'a5sf-read'

/** The scenario rows (case ids). Every row carries its acceptance criterion in
 *  the evidence README's scenario table and is recorded by `run()`. */
export const CASES = Object.freeze([
  /** (a) allow inside the compiled ceiling — the read reaches the Provider and
   *      returns bytes; the evidence chain lines the four links up. */
  'read:allowed-inside-ceiling',
  /** (b) a locator the compiled ceiling denies is REFUSED with the P1 typed
   *      denial, BEFORE any read: the driver is never invoked. */
  'read:denied-outside-ceiling',
  /** (c) the refusal leaked nothing: zero bytes escaped and the denied
   *      locator's content appears in no evidence artifact. */
  'read:denied-zero-bytes',
  /** (d) a >10MiB file read through the native window/stream (live only;
   *      dry mode records NOT_REACHED with the reason). */
  'read:window-over-10mib',
  /** (e) two Members do not share authority: A's allowed locator is denied
   *      for B under the SAME tool binding. */
  'read:two-member-isolation',
  /** (f) the suite's own rows end at `verdict=NO_BYPASS_FOUND` for the
   *      allowed call and a bypass finding for the synthetic out-of-ceiling
   *      allow (the R4 reader is the judge, not this file). */
  'read:chain-diag-no-bypass',
  /** (g) leak check over the evidence dir: no fixture content outside the
   *      allowed read. */
  'read:leak-check',
])

/**
 * The rows reserved on the shared ledger by ONE pre-registration. Named so the
 * `maxStarts` arithmetic ("rows, not spawns") is checkable, not implicit.
 */
export const INTENT_ROWS_PER_LEASE = 1

/** Closed GATE vocabulary: one typed code for "no budget", reasons closed. */
export const A5SF_READ_GATE_CODES = Object.freeze([
  /** the grant is absent / exhausted / foreign / malformed, or the ledger cannot be leased */
  'BUDGET_NOT_GRANTED',
  /** no live read driver is reachable — the C2 install seam does not exist at this base */
  'LIVE_SEAM_UNAVAILABLE',
])

/** Closed reason vocabulary for `BUDGET_NOT_GRANTED` (never string-matched). */
export const A5SF_READ_GATE_REASONS = Object.freeze([
  'GRANT_ABSENT',
  'GRANT_UNREADABLE',
  'GRANT_AMBIGUOUS',
  'GRANT_MALFORMED',
  'GRANT_TOO_SMALL',
  'GRANT_EXHAUSTED',
  'GRANT_FOREIGN_COMMIT',
  'GRANT_HEAD_UNKNOWN',
  'LEDGER_UNAVAILABLE',
  'INTENT_NOT_RECORDED',
  // 2026-11-09: the two scopes never cross. A dev-live grant cannot unlock a
  // candidate run and vice versa; the face/world a dev-live grant names must
  // match the caller's declared face/world.
  'GRANT_SCOPE_MISMATCH',
  'GRANT_FACE_MISMATCH',
  'GRANT_WORLD_MISMATCH',
  // A DEV-LIVE record is required for a dev-live grant, and a CANDIDATE-C2
  // record for a candidate grant: class and scope are bound both ways.
  'RECORD_CLASS_MISMATCH',
])

/** The two grant scopes (owner ruling 2026-11-09). */
export const A5SF_GRANT_SCOPES = Object.freeze(['DEV-LIVE', 'CANDIDATE-C2'])

export class A5sfReadGateError extends Error {
  /**
   * @param {string} code one of {@link A5SF_READ_GATE_CODES}
   * @param {string} reason one of {@link A5SF_READ_GATE_REASONS} (or a seam reason)
   * @param {string} detail human-readable
   * @param {object} [extra]
   */
  constructor(code, reason, detail, extra = {}) {
    super(`${code} reason=${reason}: ${detail}`)
    this.name = 'A5sfReadGateError'
    this.code = code
    this.reason = reason
    this.detail = detail
    Object.assign(this, extra)
  }
}

const isNonBlank = (v) => typeof v === 'string' && v.trim() !== ''
const SHA40 = /^[0-9a-f]{40}$/

// ─────────────────────────────────────────────────────────────────────────────
// the recorded budget grant (a ledger file, fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read ONE recorded budget grant.
 *
 * Accepts a JSON object file or a JSONL ledger file. A JSONL file with MORE
 * than one grant row is `GRANT_AMBIGUOUS` (this file never picks a winner: two
 * grants could differ in `maxStarts`).
 *
 * @param {string|null|undefined} grantPath
 * @returns {{ok: true, grant: object, source: string} | {ok: false, reason: string, detail: string}}
 */
export function readBudgetGrant(grantPath) {
  if (!isNonBlank(grantPath)) {
    return { ok: false, reason: 'GRANT_ABSENT', detail: 'no budget grant was supplied (--grant <ledger-file> or A5SF_BUDGET_GRANT); the shared host-start pool is 0 and a boot is not authorised without a recorded grant' }
  }
  const path = resolve(String(grantPath))
  if (!existsSync(path)) return { ok: false, reason: 'GRANT_ABSENT', detail: `budget grant '${path}' does not exist` }
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    return { ok: false, reason: 'GRANT_UNREADABLE', detail: `budget grant '${path}' is unreadable: ${String(error?.message ?? error)}` }
  }
  if (text.trim() === '') return { ok: false, reason: 'GRANT_ABSENT', detail: `budget grant '${path}' is empty` }

  const candidates = []
  if (text.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) candidates.push(...parsed)
      else candidates.push(parsed)
    } catch {
      /* fall through to the JSONL reading below */
    }
  }
  if (candidates.length === 0) {
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      try {
        candidates.push(JSON.parse(line))
      } catch {
        return { ok: false, reason: 'GRANT_MALFORMED', detail: `budget grant '${path}' holds a non-JSON line; a grant ledger must be parseable as a whole` }
      }
    }
  }
  const grants = candidates.filter((row) => row !== null && typeof row === 'object' && Object.hasOwn(row, 'grantId'))
  if (grants.length === 0) return { ok: false, reason: 'GRANT_ABSENT', detail: `budget grant '${path}' holds no row with a grantId` }
  if (grants.length > 1) {
    return { ok: false, reason: 'GRANT_AMBIGUOUS', detail: `budget grant '${path}' holds ${grants.length} grant rows; a second grant could carry a different maxStarts, so none is chosen` }
  }

  const grant = grants[0]
  const malformed = (field, why) => ({ ok: false, reason: 'GRANT_MALFORMED', detail: `budget grant '${path}' field '${field}' ${why}` })
  if (!isNonBlank(grant.grantId)) return malformed('grantId', 'must be a non-blank string')
  if (!isNonBlank(grant.grantedBy)) return malformed('grantedBy', 'must name who granted the budget (a non-blank string)')
  // Scope defaulting is deliberate: every pre-2026-11-09 grant row has no
  // `scope` field and MUST keep behaving exactly as the per-run C2 grant.
  const scope = grant.scope === undefined ? 'CANDIDATE-C2' : grant.scope
  if (!A5SF_GRANT_SCOPES.includes(scope)) return malformed('scope', `must be one of ${A5SF_GRANT_SCOPES.join(' | ')} (got ${JSON.stringify(grant.scope)})`)

  if (scope === 'CANDIDATE-C2') {
    // ── the unchanged per-run candidate grant ──────────────────────────────
    if (!Number.isInteger(grant.maxStarts) || grant.maxStarts < 1) return malformed('maxStarts', `must be a positive integer (got ${JSON.stringify(grant.maxStarts)})`)
    if (!SHA40.test(String(grant.boundCommit ?? ''))) return malformed('boundCommit', 'must be a full 40-hex commit sha')
    return {
      ok: true,
      source: path,
      grant: Object.freeze({
        grantId: grant.grantId,
        scope: 'CANDIDATE-C2',
        maxStarts: grant.maxStarts,
        grantedBy: grant.grantedBy,
        boundCommit: String(grant.boundCommit),
        face: null,
        world: null,
        note: isNonBlank(grant.note) ? grant.note : null,
      }),
    }
  }

  // ── the dev-live scope authorisation (2026-11-09) ────────────────────────
  // No fixed cumulative cap and no per-start human approval: the authorisation
  // is for a FACE, inside the implementer's own isolated World, and repeats
  // until it is revoked. Stale extra fields are not silently accepted: a
  // dev-live row that also carries `boundCommit` is fine (it is recorded), but
  // a bad one is still malformed rather than ignored.
  if (!isNonBlank(grant.face)) return malformed('face', 'must name the capability face this dev-live authorisation covers')
  if (!isNonBlank(grant.world)) return malformed('world', "must name the isolated test World line (or '*') this authorisation is confined to")
  if (grant.maxStarts !== undefined && (!Number.isInteger(grant.maxStarts) || grant.maxStarts < 1)) return malformed('maxStarts', `when present on a dev-live grant must be a positive integer (got ${JSON.stringify(grant.maxStarts)})`)
  if (grant.boundCommit !== undefined && !SHA40.test(String(grant.boundCommit))) return malformed('boundCommit', 'when present on a dev-live grant must be a full 40-hex commit sha (it is recorded, not used as a cap)')
  return {
    ok: true,
    source: path,
    grant: Object.freeze({
      grantId: grant.grantId,
      scope: 'DEV-LIVE',
      maxStarts: grant.maxStarts ?? null,
      grantedBy: grant.grantedBy,
      boundCommit: grant.boundCommit === undefined ? null : String(grant.boundCommit),
      face: String(grant.face),
      world: String(grant.world),
      note: isNonBlank(grant.note) ? grant.note : null,
    }),
  }
}

/** The worktree's HEAD, or null when git cannot answer (then the gate refuses). */
export function resolveHeadCommit(repoRoot) {
  const out = spawnSync('git', ['-C', String(repoRoot), 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  const sha = String(out.stdout ?? '').trim()
  return out.status === 0 && SHA40.test(sha) ? sha : null
}

/** Count the parsed rows of the shared ledger (the ONE counter's own file). */
function ledgerRows(ledgerPath) {
  if (!existsSync(ledgerPath)) return []
  return readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim() !== '').map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return { leg: 'UNPARSEABLE', raw: line.slice(0, 200) }
    }
  })
}

/**
 * THE PRE-REGISTRATION GATE. Validates the recorded grant, checks the SHARED
 * ledger position with the ONE imported formula, then writes ONE intent row to
 * that same ledger (a budget reservation, fail-closed) BEFORE any World exists.
 *
 * Returns a lease whose `boot(fn)` re-verifies the intent row, re-checks the
 * position and only then invokes `fn` — which in a real run is
 * `harness.boot()`, the one place that appends the start row and spawns.
 *
 * @param {object} input
 * @param {string} [input.grantPath] recorded grant ledger file
 * @param {string|null} input.headCommit the commit this run is bound to
 * @param {object} input.runRecord the run record that OWNS the shared ledger
 * @param {number} [input.requiredBoots] boots the caller intends to spend (default 1)
 * @param {number} [input.maxHostStarts] cap override (default: the grant's own)
 */
export async function preRegisterReadBudget({ grantPath, headCommit, runRecord, requiredBoots = 1, maxHostStarts } = {}) {
  const read = readBudgetGrant(grantPath)
  if (!read.ok) throw new A5sfReadGateError('BUDGET_NOT_GRANTED', read.reason, read.detail, { grantPath: grantPath ?? null })
  const { grant } = read

  // Scope is a one-way door: a dev-live authorisation can never pay for a
  // frozen-candidate run (and the candidate path must not be loosened).
  if (grant.scope !== 'CANDIDATE-C2') {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_SCOPE_MISMATCH', `grant '${grant.grantId}' is scope=${grant.scope}; a CANDIDATE-C2 run needs a per-run candidate grant (scope defaults to CANDIDATE-C2) and a dev-live authorisation cannot stand in for it`, { grant })
  }
  if (runRecord?.record?.recordClass !== undefined && runRecord.record.recordClass !== 'CANDIDATE-C2') {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'RECORD_CLASS_MISMATCH', `grant '${grant.grantId}' is scope=CANDIDATE-C2 but the run record is recordClass=${String(runRecord.record.recordClass)}; a candidate claim can only be carried by a CANDIDATE-C2 record`, { grant, recordClass: runRecord.record.recordClass })
  }

  // The grant is bound to ONE commit: a grant issued for another tree is not a
  // grant for this run (the evidence it authorises is a different artifact).
  if (!isNonBlank(headCommit) || !SHA40.test(String(headCommit))) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_HEAD_UNKNOWN', 'the run commit could not be resolved (git rev-parse HEAD); a grant cannot be matched to an unknown commit', { grant })
  }
  if (String(headCommit) !== grant.boundCommit) {
    throw new A5sfReadGateError(
      'BUDGET_NOT_GRANTED',
      'GRANT_FOREIGN_COMMIT',
      `grant '${grant.grantId}' is bound to commit ${grant.boundCommit}, but this run is at ${headCommit}; a foreign-commit grant authorises a different artifact and is refused`,
      { grant, headCommit },
    )
  }

  const cap = Number.isInteger(maxHostStarts) ? maxHostStarts : grant.maxStarts
  if (cap !== grant.maxStarts) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_MALFORMED', `maxHostStarts (${String(cap)}) must equal the grant's maxStarts (${String(grant.maxStarts)}); a caller cannot raise its own cap`)
  }
  if (grant.maxStarts < INTENT_ROWS_PER_LEASE + requiredBoots) {
    throw new A5sfReadGateError(
      'BUDGET_NOT_GRANTED',
      'GRANT_TOO_SMALL',
      `grant '${grant.grantId}' permits ${String(grant.maxStarts)} shared-ledger row(s), but this run needs ${String(INTENT_ROWS_PER_LEASE)} pre-registration row + ${String(requiredBoots)} boot(s) = ${String(INTENT_ROWS_PER_LEASE + requiredBoots)}`,
      { grant, requiredBoots },
    )
  }

  // The lease is the run record that OWNS the shared ledger. A record without a
  // ledger path could never be summed with the shared pool, so it is refused.
  const ledgerPath = runRecord?.record?.hostStarts?.ledgerPath
  if (runRecord === null || typeof runRecord !== 'object' ||
      typeof runRecord.logHostStart !== 'function' || typeof runRecord.ledgerStartCount !== 'function' ||
      !isNonBlank(ledgerPath)) {
    throw new A5sfReadGateError(
      'BUDGET_NOT_GRANTED',
      'LEDGER_UNAVAILABLE',
      'preRegisterReadBudget needs the run record that owns the SHARED host-start ledger (logHostStart + ledgerStartCount + record.hostStarts.ledgerPath); this suite keeps no counter and no ledger of its own',
      { grant },
    )
  }

  const used = ledgerRows(ledgerPath)
  const before = hostStartBudgetPosition(runRecord, grant.maxStarts)
  // PARTIAL-SPEND LAW (review C3): the grant must be able to pay for BOTH this
  // reservation row AND the declared boots. Checking `exhausted` alone would let
  // a half-spent pool (e.g. 1 prior row against maxStarts=2) reserve its row —
  // moving the pool to its cap — and then refuse at the boot, i.e. a refusal
  // that DID write. `position.remaining` is the same imported formula's answer
  // (`max(0, max - used)`); this file does not restate it.
  if (before.exhausted || before.remaining < INTENT_ROWS_PER_LEASE + requiredBoots) {
    throw new A5sfReadGateError(
      'BUDGET_NOT_GRANTED',
      'GRANT_EXHAUSTED',
      `the shared ledger holds ${String(before.used)}/${String(before.max)} row(s) (${String(before.remaining)} remaining) and this run needs ${String(INTENT_ROWS_PER_LEASE)} reservation row + ${String(requiredBoots)} boot(s) = ${String(INTENT_ROWS_PER_LEASE + requiredBoots)} under grant '${grant.grantId}'; refusing BEFORE the reservation, so a refused run writes nothing`,
      { grant, position: before },
    )
  }

  // The reservation: ONE row on the SAME ledger, through the SAME writer.
  const intentEntry = runRecord.logHostStart({
    kind: 'budget-intent',
    phase: `${SUITE_NAME}-intent`,
    world: `intent:${grant.grantId}`,
    suite: SUITE_NAME,
    grantId: grant.grantId,
    grantedBy: grant.grantedBy,
    boundCommit: grant.boundCommit,
    plannedStarts: requiredBoots,
  })
  const after = hostStartBudgetPosition(runRecord, grant.maxStarts)
  if (after.used > grant.maxStarts || after.remaining < requiredBoots) {
    // Defensive: cannot happen after the pre-check unless the writer over-counts
    // or another writer appended between the check and the reservation.
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_EXHAUSTED', `the shared ledger cannot fund ${String(requiredBoots)} boot(s) after reserving under grant '${grant.grantId}' (${String(after.used)}/${String(after.max)} rows, ${String(after.remaining)} remaining)`, { grant, position: after })
  }

  let booted = 0
  let spent = false

  const lease = Object.freeze({
    grant,
    grantPath: read.source,
    headCommit,
    ledgerPath,
    intentEntry,
    rowsBefore: used.length,
    rowsAfterIntent: after.used,
    maxStarts: grant.maxStarts,
    position: after,
    /** The shared ledger rows for this grant's intent (the reservation is checkable). */
    intentRows() {
      return ledgerRows(ledgerPath).filter((row) => row?.kind === 'budget-intent' && row?.grantId === grant.grantId)
    },
    /**
     * Spend ONE of the reserved boots. Order: re-verify the intent row → ask
     * the ONE gate for the position → invoke `fn` (harness.boot). A missing
     * intent row or an exhausted ledger refuses WITHOUT invoking `fn`.
     */
    async boot(fn) {
      if (typeof fn !== 'function') throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'INTENT_NOT_RECORDED', 'lease.boot needs the boot thunk (in a real run: () => harness.boot({world}))')
      const path = runRecord?.record?.hostStarts?.ledgerPath
      if (!isNonBlank(path) || resolve(String(path)) !== resolve(ledgerPath)) {
        throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'LEDGER_UNAVAILABLE', 'the run record no longer carries the shared ledger path the lease reserved on; refusing to boot unbudgeted')
      }
      if (lease.intentRows().length === 0) {
        throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'INTENT_NOT_RECORDED', `grant '${grant.grantId}' has no pre-registration row on the shared ledger; a boot without a reservation is refused`)
      }
      if (booted >= requiredBoots) {
        // Defense in depth (review C8): the lease declared how many boots it
        // would spend; a third party cannot spend one more by calling boot() again.
        throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_EXHAUSTED', `grant '${grant.grantId}' reserved ${String(requiredBoots)} boot(s) and the lease already spent ${String(booted)}; refusing the extra boot before the spawn`, { grant, requiredBoots })
      }
      const position = hostStartBudgetPosition(runRecord, grant.maxStarts)
      if (position.exhausted || position.remaining < 1) {
        throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_EXHAUSTED', `the shared ledger holds ${String(position.used)} >= ${String(position.max)} row(s) allowed by grant '${grant.grantId}'; refusing the boot before the spawn`, { grant, position })
      }
      spent = true
      booted += 1
      return fn()
    },
    /** Observation only (the lease is not a counter; it reports the shared ledger). */
    bootsSpent() {
      return booted
    },
    get spent() {
      return spent
    },
  })
  return lease
}

// ─────────────────────────────────────────────────────────────────────────────
// the dev-live scope authorisation (owner ruling 2026-11-09)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE DEV-LIVE PRE-REGISTRATION GATE. Same ledger, same run record, same
 * WorldFactory — only the AUTHORISATION changes: a `scope: "dev-live"` grant
 * authorises repeated starts inside its face/world without a human per-start
 * approval. Three things are still mandatory, so this is a relaxation of
 * authorisation, not of evidence:
 *
 *   1. every start registers a ledger row (the intent row below, then the
 *      harness's own start row, then the caller's outcome row);
 *   2. the run record must be `recordClass: "DEV-LIVE"` (a class that can
 *      never produce a `V@B=yes` claim — `lib/acceptance-claim.mjs`);
 *   3. one of the {@link DEV_LIVE_SLOT_LIMIT} machine-wide dev-Host slots must
 *      be acquired before the spawn (`lib/dev-live-slots.mjs`).
 *
 * There is NO cumulative cap and NO `boundCommit` equality check: a
 * development branch moves while the implementation is being developed. The
 * commit actually executed is still recorded in the intent row (`headCommit`),
 * so the ledger says which version each development start ran.
 *
 * @param {object} input
 * @param {string} input.grantPath recorded dev-live scope authorisation
 * @param {string} input.headCommit the commit this start executes (it is recorded)
 * @param {object} input.runRecord the run record that OWNS the shared ledger
 * @param {string} input.face capability face the caller declares
 * @param {string} input.world isolated World line the caller declares
 * @param {string} [input.leaseRoot] shared lease root (defaults to the run record's `bindings.leaseRoot`)
 * @param {number} [input.requiredBoots] boots this lease intends to spend (default 1)
 */
export async function preRegisterDevLiveBudget({ grantPath, headCommit, runRecord, face, world, leaseRoot, requiredBoots = 1 } = {}) {
  const read = readBudgetGrant(grantPath)
  if (!read.ok) throw new A5sfReadGateError('BUDGET_NOT_GRANTED', read.reason, read.detail, { grantPath: grantPath ?? null })
  const { grant } = read
  if (grant.scope !== 'DEV-LIVE') {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_SCOPE_MISMATCH', `grant '${grant.grantId}' is scope=${grant.scope}; a development boot needs a scope=DEV-LIVE authorisation (a per-run CANDIDATE-C2 grant is not reusable and is not accepted here)`, { grant })
  }
  if (!isNonBlank(face)) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_FACE_MISMATCH', 'the caller must declare the capability face it is developing; a dev-live authorisation is scoped to one face', { grant })
  }
  if (grant.face !== String(face)) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_FACE_MISMATCH', `grant '${grant.grantId}' authorises face '${grant.face}', but this start declares '${String(face)}'; a dev-live authorisation never widens to another face`, { grant, face })
  }
  if (!isNonBlank(world)) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_WORLD_MISMATCH', 'the caller must declare the isolated World line this start uses; a dev-live authorisation is confined to its own world', { grant })
  }
  if (grant.world !== '*' && grant.world !== String(world)) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_WORLD_MISMATCH', `grant '${grant.grantId}' authorises world '${grant.world}', but this start declares '${String(world)}'`, { grant, world })
  }
  if (!isNonBlank(headCommit) || !SHA40.test(String(headCommit))) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_HEAD_UNKNOWN', 'the development version could not be resolved (git rev-parse HEAD); every dev-live row must record the version it ran', { grant })
  }
  const ledgerPath = runRecord?.record?.hostStarts?.ledgerPath
  if (runRecord === null || typeof runRecord !== 'object' ||
      typeof runRecord.logHostStart !== 'function' || typeof runRecord.ledgerStartCount !== 'function' ||
      !isNonBlank(ledgerPath)) {
    throw new A5sfReadGateError(
      'BUDGET_NOT_GRANTED',
      'LEDGER_UNAVAILABLE',
      'preRegisterDevLiveBudget needs the run record that owns the SHARED host-start ledger (logHostStart + ledgerStartCount + record.hostStarts.ledgerPath); a dev-live start still registers a ledger row',
      { grant },
    )
  }
  if (runRecord?.record?.recordClass !== 'DEV-LIVE') {
    throw new A5sfReadGateError(
      'BUDGET_NOT_GRANTED',
      'RECORD_CLASS_MISMATCH',
      `grant '${grant.grantId}' is scope=DEV-LIVE but the run record is recordClass=${String(runRecord?.record?.recordClass)}; create the record with recordClass:'DEV-LIVE' (runner: --record-class DEV-LIVE) — a development boot must be labelled as such so it can never be read as candidate evidence`,
      { grant, recordClass: runRecord?.record?.recordClass ?? null },
    )
  }

  const resolvedLeaseRoot = isNonBlank(leaseRoot) ? String(leaseRoot) : (runRecord?.record?.bindings?.leaseRoot ?? null)
  if (!isNonBlank(resolvedLeaseRoot)) {
    throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'LEDGER_UNAVAILABLE', 'the run record carries no bindings.leaseRoot and no leaseRoot was supplied; the 2-concurrent dev-Host cap is a machine-wide counter and needs the shared lease root', { grant })
  }

  // The row: one per dev-live lease, on the SAME ledger as every other start.
  const intentEntry = runRecord.logHostStart({
    kind: 'budget-intent',
    scope: 'dev-live',
    phase: `${SUITE_NAME}-dev-live-intent`,
    world: `intent:${grant.grantId}`,
    suite: SUITE_NAME,
    grantId: grant.grantId,
    grantedBy: grant.grantedBy,
    face: grant.face,
    worldLine: grant.world,
    headCommit: String(headCommit),
    plannedStarts: requiredBoots,
  })

  let booted = 0
  let slot = null
  let finished = false
  let heartbeat = null

  const stopHeartbeat = () => {
    if (heartbeat === null) return
    clearInterval(heartbeat)
    heartbeat = null
  }
  /**
   * Keep this slot's mtime fresh while the lease is spending it. A peer in a
   * DIFFERENT PID namespace cannot probe our pid, so `lib/dev-live-slots.mjs`
   * treats such a slot as `unknown` and only reclaims it after a grace window.
   * The heartbeat is what keeps a live cross-namespace boot under that window
   * (a crashed one stops beating and is reclaimed).
   */
  const startHeartbeat = () => {
    if (heartbeat !== null || slot === null) return
    heartbeat = setInterval(() => {
      try {
        slot?.touch()
      } catch {
        /* liveness probe failure never fails a boot */
      }
    }, DEV_LIVE_SLOT_HEARTBEAT_MS)
    heartbeat.unref?.()
  }

  const releaseSlot = () => {
    stopHeartbeat()
    if (slot === null) return false
    const released = slot.release()
    slot = null
    return released
  }
  // Crash safety: the pid-liveness sweep in `lib/dev-live-slots.mjs` is the
  // primary recovery path; this handler merely frees the slot on a clean exit.
  process.once('exit', () => {
    try {
      releaseSlot()
    } catch {
      /* best effort on exit */
    }
  })

  const lease = Object.freeze({
    grant,
    scope: 'DEV-LIVE',
    grantPath: read.source,
    headCommit,
    face: grant.face,
    world,
    ledgerPath,
    intentEntry,
    requiredBoots,
    /** The shared ledger rows for this grant's dev-live intent. */
    intentRows() {
      return ledgerRows(ledgerPath).filter((row) => row?.kind === 'budget-intent' && row?.grantId === grant.grantId)
    },
    /**
     * Spend ONE start: re-verify the intent row, take a machine slot (refusing
     * a third concurrent dev Host), then invoke `fn`. There is no cumulative
     * cap; there IS the 2-concurrent cap and the one-intent-per-lease rule.
     */
    async boot(fn) {
      if (typeof fn !== 'function') throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'INTENT_NOT_RECORDED', 'lease.boot needs the boot thunk (in a real run: () => harness.boot({world}))')
      if (finished) throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_EXHAUSTED', `the dev-live lease '${grant.grantId}' is finished; open a new lease (a dev-live authorisation may be reused, a spent lease may not)`, { grant })
      if (lease.intentRows().length === 0) {
        throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'INTENT_NOT_RECORDED', `grant '${grant.grantId}' has no dev-live pre-registration row on the shared ledger; a boot without a reservation is refused`)
      }
      if (booted >= requiredBoots) {
        throw new A5sfReadGateError('BUDGET_NOT_GRANTED', 'GRANT_EXHAUSTED', `dev-live lease '${grant.grantId}' declared ${String(requiredBoots)} boot(s) and already spent ${String(booted)}; repeated starts use repeated leases, not an unbounded single lease`, { grant, requiredBoots })
      }
      if (slot === null) {
        slot = acquireDevLiveSlot({
          leaseRoot: resolvedLeaseRoot,
          runId: String(runRecord.record.runId),
          face: grant.face,
          world: String(world),
          headCommit: String(headCommit),
        })
        startHeartbeat()
      }
      booted += 1
      try {
        return await fn()
      } catch (error) {
        // A failed boot holds no Host: give the slot back instead of leaking it.
        releaseSlot()
        throw error
      }
    },
    bootsSpent() {
      return booted
    },
    /** True while this run holds one of the machine slots. */
    holdsSlot() {
      return slot !== null
    },
    /** Release the machine slot early (teardown); idempotent. */
    releaseSlot,
    /**
     * Record the OUTCOME row a dev-live run owes the ledger and release its
     * slot. `cases` / `overall` come from the run record; `teardown` is the
     * World teardown receipt. It is a ledger row, not a grade.
     */
    finish({ cases = [], overall = null, teardown = null } = {}) {
      if (finished) return null
      finished = true
      const entry = runRecord.logHostStart({
        kind: 'dev-live-outcome',
        scope: 'dev-live',
        phase: `${SUITE_NAME}-dev-live-outcome`,
        world: String(world),
        suite: SUITE_NAME,
        grantId: grant.grantId,
        face: grant.face,
        headCommit: String(headCommit),
        overall,
        cases,
        teardown,
      })
      releaseSlot()
      return entry
    },
    get finished() {
      return finished
    },
  })
  return lease
}

/**
 * Scope dispatcher: reads the recorded authorisation, then hands the call to
 * the matching gate. A CANDIDATE-C2 grant takes the UNCHANGED
 * `preRegisterReadBudget` path; a DEV-LIVE grant takes the repeated-start path.
 * No grant ⇒ the C2 path's `GRANT_ABSENT` refusal (zero writes, zero spawns).
 *
 * @param {object} input
 * @param {string} [input.grantPath]
 * @param {string} input.headCommit
 * @param {object} input.runRecord
 * @param {number} [input.requiredBoots]
 * @param {number} [input.maxHostStarts]
 * @param {string} [input.face] required for dev-live
 * @param {string} [input.world] required for dev-live
 * @param {string} [input.leaseRoot]
 */
export async function preRegisterBudget({ grantPath, headCommit, runRecord, requiredBoots = 1, maxHostStarts, face = null, world = null, leaseRoot = null } = {}) {
  const read = readBudgetGrant(grantPath)
  if (!read.ok) throw new A5sfReadGateError('BUDGET_NOT_GRANTED', read.reason, read.detail, { grantPath: grantPath ?? null })
  if (read.grant.scope === 'DEV-LIVE') {
    return preRegisterDevLiveBudget({ grantPath, headCommit, runRecord, face, world, leaseRoot, requiredBoots })
  }
  return preRegisterReadBudget({ grantPath, headCommit, runRecord, requiredBoots, maxHostStarts })
}

// ─────────────────────────────────────────────────────────────────────────────
// seam + driver resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The LIVE read driver contract (documented, unimplemented in this tree).
 *
 * A driver module must default-export `createReadDriver({ repoRoot, world,
 * harness, recorder, evidenceDir })` returning
 * `{ install({ identity, effective }) => { read({ locator, offset?, limit? }) },
 *    native: true }`. It is the ONLY place allowed to touch the live Host root:
 * it mounts the compiled ceiling's confined Provider through the shipped
 * `installToolBindingRealm` and performs the native `read` through that
 * Provider's surface, returning `{ bytes, text, windowed }`.
 *
 * WHY IT IS A PARAMETER AND NOT BUILT HERE: at this base NO production code
 * calls `installMemberIoProviders` / `installToolBindingRealm`
 * (grep: only `team-services/src/index.ts` re-exports them), so a booted Host
 * has no a5sf realm and a suite cannot reach its Cordis root across the process
 * boundary. Mounting one would be P2 wiring in `packages/runtime/**`, i.e. a
 * SCOPE EXPANSION this lane must not take. See the evidence README §5.
 */
export async function resolveReadDriver(opts = {}) {
  const injected = opts.readDriver
  if (injected !== undefined) return injected
  const spec = isNonBlank(opts.driver) ? opts.driver : process.env.A5SF_READ_DRIVER
  if (!isNonBlank(spec)) {
    throw new A5sfReadGateError(
      'LIVE_SEAM_UNAVAILABLE',
      'NO_READ_DRIVER',
      'no live read driver: no module in this tree mounts the compiled ceiling\'s confined Provider on a booted Host AND performs the native read through it. The Member realm now mounts for live Members (agent-bindings.mjs#mountMemberA5sfRealm, evidence a5sf-live-member), but that is the confined `bash` on a delegate child, not this suite\'s native `read` on the LIVE root, and it is DEV-LIVE only. Pass A5SF_READ_DRIVER=<module> once the read-driver contract exists. Zero host starts spent.',
    )
  }
  let mod
  try {
    mod = await import(pathToFileURL(resolve(String(spec))).href)
  } catch (error) {
    throw new A5sfReadGateError('LIVE_SEAM_UNAVAILABLE', 'DRIVER_IMPORT_FAILED', `read driver '${String(spec)}' did not import: ${String(error?.message ?? error)}`)
  }
  const factory = mod.default ?? mod.createReadDriver
  if (typeof factory !== 'function') throw new A5sfReadGateError('LIVE_SEAM_UNAVAILABLE', 'DRIVER_INVALID', `read driver '${String(spec)}' exports no createReadDriver()`)
  return { createReadDriver: factory }
}

// ─────────────────────────────────────────────────────────────────────────────
// the host-free DRY driver (this is NOT the native read tool — it is the
// control that proves the policy/guard/evidence plumbing is wired; the native
// tool + Host are what --live is for)
// ─────────────────────────────────────────────────────────────────────────────

function createDryDriver() {
  const calls = []
  return {
    native: false,
    kind: 'dry-node-fs',
    calls,
    /**
     * @param {{locator: string, window?: {offset:number, limit:number}}} input
     * @returns {{bytes: number, text: string, windowed: boolean}}
     */
    read({ locator, window } = {}) {
      calls.push({ locator, window: window ?? null })
      if (window !== undefined) {
        const fd = openSync(locator, 'r')
        try {
          const buf = Buffer.alloc(window.limit)
          const n = readSync(fd, buf, 0, window.limit, window.offset)
          return { bytes: n, text: buf.subarray(0, n).toString('utf8'), windowed: true }
        } finally {
          closeSync(fd)
        }
      }
      const bytes = readFileSync(locator)
      return { bytes: bytes.length, text: bytes.toString('utf8'), windowed: false }
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the shared scenario (host-free dry mode runs ALL of it; live mode reuses the
// policy/evidence half and lets its driver supply the reads)
// ─────────────────────────────────────────────────────────────────────────────

const MIB = 1024 * 1024
/** BL-14's threshold: strictly greater than 10 MiB (not `>=`). */
export const BIG_FILE_BYTES = 10 * MIB + 1
export const WINDOW = Object.freeze({ offset: 0, limit: 64 * 1024 })

/**
 * The verdict of `read:window-over-10mib` — deliberately a PURE function so the
 * C1 suite can pin it without a boot (review C4: the old case was PASS off an
 * admission-only assertion, i.e. a fake green).
 *
 * Laws:
 *  - a NON-native driver can never earn this case: the criteria are about the
 *    native tool's window/stream, so the verdict is `NOT_REACHED`
 *    (`NATIVE_WINDOW_UNAVAILABLE`), never PASS and never a product FAIL.
 *  - a native driver earns PASS only when the call was windowed AND returned
 *    EXACTLY the requested window (byte count and content), so "the whole file
 *    came back" cannot masquerade as a window read.
 *  - a native driver that was not windowed, or whose window is the wrong size
 *    or content, is a FAIL.
 *
 * @param {{native: boolean, windowed: boolean, bytes: number, expectedBytes: number, textOk: boolean, size: number}} input
 * @returns {{verdict: 'PASS'|'FAIL'|'NOT_REACHED', reason: string}}
 */
export function windowCaseVerdict({ native, windowed, bytes, expectedBytes, textOk, size } = {}) {
  if (native !== true) return { verdict: 'NOT_REACHED', reason: 'NATIVE_WINDOW_UNAVAILABLE' }
  if (!(typeof size === 'number' && size > 10 * MIB)) return { verdict: 'FAIL', reason: 'FILE_NOT_OVER_10MIB' }
  if (windowed !== true) return { verdict: 'FAIL', reason: 'NOT_WINDOWED' }
  if (bytes !== expectedBytes) return { verdict: 'FAIL', reason: 'WINDOW_LENGTH_MISMATCH' }
  if (textOk !== true) return { verdict: 'FAIL', reason: 'WINDOW_CONTENT_MISMATCH' }
  return { verdict: 'PASS', reason: 'NATIVE_WINDOW_EXACT' }
}

/**
 * Load the P1 seams a host-free run needs. Only modules whose import graph is
 * plain (type-only external deps) are touched; `team-services/src/fs.ts` is
 * deep-imported exactly as the R2 harness and the P1-05 test do (the barrel
 * pulls `manifest.ts` → `@deepseek-ai/cordis-plugin-include`, which a bare
 * checkout does not have).
 */
async function loadDrySeams(repoRoot) {
  const { register } = await import('node:module')
  const hooks = join(repoRoot, 'scripts', 'run-tests-hooks.mjs')
  if (!existsSync(hooks)) throw new A5sfReadGateError('LIVE_SEAM_UNAVAILABLE', 'SEAM_UNAVAILABLE', `no TS resolution hooks at ${hooks}`)
  register(pathToFileURL(hooks).href)
  const policy = await import(pathToFileURL(join(repoRoot, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
  const fsSeam = await import(pathToFileURL(join(repoRoot, 'packages', 'runtime', 'team-services', 'src', 'fs.ts')).href)
  const pathRules = await import(pathToFileURL(join(repoRoot, 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.ts')).href)
  // `fs.ts` imports TeamIoDenial but does not re-export it (the same seam
  // inconsistency R2 §4 / R4 §1 disclose); the class is taken from its owner.
  const serviceTypes = await import(pathToFileURL(join(repoRoot, 'packages', 'runtime', 'team-services', 'src', 'types.ts')).href)
  const blueprint = await import(pathToFileURL(join(repoRoot, 'packages', 'domain', 'blueprint', 'src', 'index.ts')).href)
  return {
    parseBlueprintV4: blueprint.parseBlueprintV4,
    compileMemberPolicy: policy.compileMemberPolicy,
    projectToolIoRestriction: policy.projectToolIoRestriction,
    compileEffectiveIo: policy.compileEffectiveIo,
    createMemberFsGuard: fsSeam.createMemberFsGuard,
    TeamIoDenial: serviceTypes.TeamIoDenial,
    matchLocator: pathRules.matchLocator,
  }
}

function ruleSet(allow, ask = [], deny = []) {
  return { mode: 'restricted', allow, ask, deny }
}
const netDeny = { mode: 'deny', default: 'deny' }

/** The v4 blueprint the scenario compiles against (two workers + a leader). */
export function buildBlueprintDoc({ teamId, rootAlpha, rootBeta }) {
  return {
    schemaVersion: 4,
    blueprintId: teamId,
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [
      { templateId: 'alpha', persona: 'Alpha member.' },
      { templateId: 'beta', persona: 'Beta member.' },
    ],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      // A's ceiling covers A's root; B's covers B's root. Neither covers the
      // other, which is exactly the "two Members do not share authority" fact.
      { templateId: 'alpha', io: { read: ruleSet([rootAlpha]), write: ruleSet([]), network: netDeny } },
      { templateId: 'beta', io: { read: ruleSet([rootBeta]), write: ruleSet([]), network: netDeny } },
      { templateId: 'leader', io: { read: ruleSet([rootAlpha]), write: ruleSet([]), network: netDeny } },
    ],
    toolBindings: [
      // The tool's OWN restriction is broader than either Member ceiling: the
      // effective lane is the intersection, so this binding cannot widen B.
      {
        owner: 'dsh.fs',
        name: 'read',
        authorization: 'allow',
        io: { read: ruleSet([dirname(rootAlpha)]), write: ruleSet([]), network: netDeny },
        execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
      },
    ],
  }
}

const memberOf = (templateId, blueprintId, generation = 1) => ({
  teamId: blueprintId,
  memberInstanceId: `mi-${templateId}-${generation}`,
  templateId,
  instanceGeneration: generation,
})

/**
 * Compile one Member ceiling + one bound invocation through the REAL P1
 * compiler and decide it with the REAL shipped guard.
 *
 * @returns {Promise<object>} the decision record the scene asserts on
 */
async function decide(seams, { parsed, blueprintId, templateId, callId, locator, authorityRevision }) {
  const member = memberOf(templateId, blueprintId)
  const compiled = seams.compileMemberPolicy({
    trustedMember: member,
    boundBlueprint: { teamId: blueprintId, blueprint: parsed },
    effectiveAuthority: { revision: authorityRevision, admitted: true, memberInstanceId: member.memberInstanceId, instanceGeneration: member.instanceGeneration },
  })
  if (!compiled.ok) throw new Error(`P1 compiler refused ${templateId}: ${compiled.code} ${compiled.detail}`)
  const policy = compiled.value
  const binding = {
    owner: 'dsh.fs',
    name: 'read',
    authorization: 'allow',
    io: parsed.toolBindings[0].io,
    execution: parsed.toolBindings[0].execution,
  }
  const tool = seams.projectToolIoRestriction(binding)
  if (!tool.ok) throw new Error(`P1 tool restriction refused: ${tool.code} ${tool.detail}`)
  const effective = seams.compileEffectiveIo(policy, tool.value, {
    memberIdentity: member.memberInstanceId,
    callId,
    policyRevision: policy.revision,
    toolBindingIdentity: tool.value.bindingIdentity,
    approvedOnce: false,
  })
  if (!effective.ok) throw new Error(`P1 effective-Io refused: ${effective.code} ${effective.detail}`)
  // The disposition is the P1 algebra's own answer (the same function the R4
  // reader and the guard use) — never this suite's guess.
  const disposition = seams.matchLocator(effective.value.read, locator)
  const guard = seams.createMemberFsGuard(effective.value)
  let lane = 'allow'
  let denial = null
  try {
    await guard('read', locator)
  } catch (error) {
    if (!(error instanceof seams.TeamIoDenial)) throw error
    denial = { name: error.name, code: error.code, detail: String(error.detail ?? error.message) }
    // The guard's typed code is the decision: *_DENIED is the compiled `deny`
    // lane; IO_POLICY_UNSUPPORTED is the compiled `ask` lane (never an allow).
    lane = String(error.code).endsWith('_DENIED') ? 'deny' : 'ask'
  }
  return { member, policy, effective: effective.value, disposition, lane, denial, guard }
}

/**
 * One whole scene: two Members, an allowed locator, a denied locator, a >10MiB
 * file, the recorder rows, the R4 reader and the R3 chain reader.
 *
 * @param {object} input
 * @param {'dry'|'live'} input.mode
 * @param {string} input.repoRoot
 * @param {string} input.evidenceDir
 * @param {object} input.driver `{ native, kind, read({locator, window}) }`
 * @param {object} [input.live] live-only extras (`{ world, harness }`)
 */
async function runScenario({ mode, repoRoot, evidenceDir, driver }) {
  const seams = await loadDrySeams(repoRoot)
  const work = mkdtempSync(join(tmpdir(), `a5sf-read-${mode}-`))
  const rootAlpha = join(work, 'alpha')
  const rootBeta = join(work, 'beta')
  const outside = join(work, 'outside')
  for (const dir of [rootAlpha, rootBeta, outside]) mkdirSync(dir, { recursive: true })
  const allowedFile = join(rootAlpha, 'doc.txt')
  const betaFile = join(rootBeta, 'doc.txt')
  const outsideFile = join(outside, 'secret.txt')
  const bigFile = join(rootAlpha, 'big.bin')
  const ALLOWED_TEXT = 'a5sf-p2-read: allowed content inside the compiled ceiling\n'
  const OUTSIDE_TEXT = 'a5sf-p2-read: THIS CONTENT MUST NEVER LEAVE A DENIED READ\n'
  const BETA_TEXT = 'a5sf-p2-read: beta content\n'
  writeFileSync(allowedFile, ALLOWED_TEXT)
  writeFileSync(betaFile, BETA_TEXT)
  writeFileSync(outsideFile, OUTSIDE_TEXT)
  writeFileSync(bigFile, Buffer.alloc(BIG_FILE_BYTES, 0x61))

  const blueprintId = 'team.a5sf.p201'
  const doc = buildBlueprintDoc({ teamId: blueprintId, rootAlpha, rootBeta })
  const parsed = seams.parseBlueprintV4(`---\n${JSON.stringify(doc, null, 2)}\n---\n`)
  if (parsed === null || typeof parsed !== 'object') throw new Error('the v4 blueprint fixture did not parse')

  const evidence = {}
  mkdirSync(evidenceDir, { recursive: true })
  const chainPath = join(evidenceDir, 'read-chain.jsonl')
  if (existsSync(chainPath)) unlinkSync(chainPath)
  const { createEvidenceRecorder } = await import(pathToFileURL(join(repoRoot, 'tests', 'world-factory', 'lib', 'a5sf-evidence.mjs')).href)
  const { createOracle } = await import(pathToFileURL(join(repoRoot, 'tests', 'world-factory', 'lib', 'oracle.mjs')).href)
  const recorder = createEvidenceRecorder({ path: chainPath, suite: SUITE_NAME, runId: `a5sf-read-${mode}` })

  // The oracle's three channels, pointed at THIS evidence dir: no marker, no
  // ledger row, no live host pid. The sound conjunction therefore answers
  // effect=false — which in dry mode is the honest answer (there is no Host to
  // attribute an effect to), and in live mode is replaced by the real World.
  const oracle = createOracle({
    markerDir: join(evidenceDir, 'oracle-markers'),
    ledgerPath: join(evidenceDir, 'oracle-ledger.jsonl'),
    ownershipPath: join(evidenceDir, 'oracle-ownership.json'),
  })
  mkdirSync(join(evidenceDir, 'oracle-markers'), { recursive: true })

  const authorityRevision = 'a4:a5sf-p2-read-fixture'
  const calls = []
  const plan = [
    { callId: 'call-read-alpha-allowed', templateId: 'alpha', locator: allowedFile, file: allowedFile, expectedLane: 'allow', role: 'allowed-inside-ceiling' },
    { callId: 'call-read-alpha-denied', templateId: 'alpha', locator: outsideFile, file: outsideFile, expectedLane: 'deny', role: 'denied-outside-ceiling' },
    { callId: 'call-read-beta-denied', templateId: 'beta', locator: allowedFile, file: allowedFile, expectedLane: 'deny', role: 'two-member-isolation' },
    { callId: 'call-read-alpha-window', templateId: 'alpha', locator: bigFile, file: bigFile, expectedLane: 'allow', role: 'window-over-10mib', window: WINDOW },
    { callId: 'call-read-alpha-window-edge', templateId: 'alpha', locator: bigFile, file: bigFile, expectedLane: 'allow', role: 'window-edge', window: Object.freeze({ offset: BIG_FILE_BYTES - WINDOW.limit, limit: WINDOW.limit }) },
  ]

  const ceilings = new Map()
  for (const step of plan) {
    const decision = await decide(seams, {
      parsed, blueprintId, templateId: step.templateId, callId: step.callId, locator: step.locator, authorityRevision,
    })
    if (!ceilings.has(decision.policy.memberIdentity)) {
      // ONE ceiling row per Member (a second is DUPLICATE_CEILING_MEMBER by R4's
      // law and would make the member's allows UNDECIDABLE).
      recorder.ceiling({ policy: decision.policy, tools: [{ tool: 'read', effective: decision.effective }] })
      ceilings.set(decision.policy.memberIdentity, true)
    }
    // THE READ HAPPENS ONLY AFTER THE GUARD ADMITTED. In dry mode the driver
    // is node:fs; in live mode it is the host driver's Provider read.
    const driverCallsBefore = driver.calls === undefined ? 0 : driver.calls.length
    let read = null
    let readError = null
    if (decision.lane === 'allow') {
      try {
        // THE DOCUMENTED INSTALL STEP, made real (2026-11-06). A live driver
        // mounts the compiled effective policy for THIS Member before its first
        // read; a driver without `install` (the dry one) is unchanged. Without
        // this call the live contract could not name the Member it mounted.
        if (typeof driver.install === 'function') {
          await driver.install({ identity: decision.member, effective: decision.effective })
        }
        read = await driver.read({ locator: step.locator, ...(step.window === undefined ? {} : { window: step.window }) })
      } catch (error) {
        readError = String(error?.message ?? error)
      }
    }
    const providerConsulted = (driver.calls === undefined ? (read !== null ? 1 : 0) : driver.calls.length - driverCallsBefore) > 0
    const observation = oracle.observe({ tag: step.callId })
    const verdict = oracle.effect(observation, {})
    const effectFact = { oracleId: oracle.id, tag: step.callId, effect: verdict.effect, basis: verdict.basis, observation: { observedAt: observation.observedAt } }
    const providerFact = {
      identity: {
        teamId: blueprintId,
        memberInstanceId: decision.member.memberInstanceId,
        templateId: step.templateId,
        instanceGeneration: decision.member.instanceGeneration,
      },
      toolBindingIdentity: decision.effective.toolBindingIdentity,
      policyRevision: decision.policy.revision,
      kind: driver.kind,
      native: driver.native === true,
    }
    recorder.call({
      policy: decision.policy,
      effective: decision.effective,
      disposition: decision.disposition,
      lane: decision.lane,
      callId: step.callId,
      tool: 'read',
      axis: 'read',
      locator: step.locator,
      provider: providerFact,
      consulted: providerConsulted,
      effect: effectFact,
    })
    calls.push({
      ...step,
      memberInstanceId: decision.member.memberInstanceId,
      policyRevision: decision.policy.revision,
      toolBindingIdentity: decision.effective.toolBindingIdentity,
      disposition: decision.disposition,
      lane: decision.lane,
      denial: decision.denial,
      bytes: read === null ? 0 : read.bytes,
      text: read === null ? null : read.text,
      windowed: read === null ? false : read.windowed === true,
      readError,
      providerConsulted,
      effect: effectFact.effect,
      fileBytes: statSync(step.file).size,
      /** Lane-supplied vs mechanically produced is recorded per fact, not implied. */
      provenance: {
        disposition: 'mechanical: path-rules.ts#matchLocator over the compiled EffectiveIo',
        lane: 'mechanical: createMemberFsGuard typed outcome (TeamIoDenial code)',
        consulted: mode === 'live'
          ? 'mechanical: the live driver reports the Provider call it performed (driver contract)'
          : 'mechanical for the DRY driver (node:fs call count); NOT the native tool\'s Provider',
        effect: 'mechanical: lib/oracle.mjs sound conjunction over three channels (no live pid ⇒ false)',
      },
    })
  }

  // ── the synthetic out-of-ceiling ALLOW (the negative control the R4 reader
  //    must catch). It is written to its OWN file so the real run's report
  //    stays clean; it never becomes a verdict about the lane. ──────────────
  const syntheticPath = join(evidenceDir, 'synthetic-bypass.jsonl')
  const chainRows = readFileSync(chainPath, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))
  const alphaCeiling = chainRows.find((row) => row.kind === 'ceiling' && row.member === calls[0].memberInstanceId)
  if (alphaCeiling === undefined) throw new Error('the allowed call has no recorded ceiling row to copy into the synthetic control')
  writeFileSync(syntheticPath, `${JSON.stringify(alphaCeiling)}\n${JSON.stringify({
    kind: 'call',
    callId: 'call-read-synthetic-outside',
    member: calls[0].memberInstanceId,
    tool: 'read',
    axis: 'read',
    locator: outsideFile,
    lane: 'allow', // SYNTHETIC: an allow at a locator the compiled ceiling denies
    disposition: 'deny',
    synthetic: 'BL-14 negative control: an allow that must be reported as a bypass',
  })}\n`)

  // ── the R4 reader (the judge) over BOTH files, via its real CLI ──────────
  const diag = (target) => {
    const out = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'a5sf-diag.mjs'), target], { cwd: repoRoot, encoding: 'utf8' })
    return { status: out.status, stdout: String(out.stdout ?? ''), stderr: String(out.stderr ?? '') }
  }
  const cleanDiag = diag(chainPath)
  const syntheticDiag = diag(syntheticPath)

  // ── the R3 chain reader over the same rows ───────────────────────────────
  const { alignEvidenceFile, renderChainReport } = await import(pathToFileURL(join(repoRoot, 'tests', 'world-factory', 'lib', 'a5sf-evidence.mjs')).href)
  const chain = alignEvidenceFile(chainPath)
  const chainByCall = new Map((chain.chains ?? []).map((entry) => [entry.callId, entry]))
  const chainCli = spawnSync(process.execPath, [join(repoRoot, 'tests', 'world-factory', 'lib', 'a5sf-evidence.mjs'), '--check', chainPath], { cwd: repoRoot, encoding: 'utf8' })

  const allowed = calls.find((c) => c.role === 'allowed-inside-ceiling')
  const denied = calls.find((c) => c.role === 'denied-outside-ceiling')
  const isolated = calls.find((c) => c.role === 'two-member-isolation')
  const windowed = calls.find((c) => c.role === 'window-over-10mib')
  const windowEdge = calls.find((c) => c.role === 'window-edge')

  const assertions = []
  const check = (id, ok, detail) => assertions.push({ id, ok: Boolean(ok), detail })

  check('allowed-inside-ceiling: the guard admitted and the Provider returned bytes', allowed.lane === 'allow' && allowed.disposition === 'allow' && allowed.bytes === Buffer.byteLength(ALLOWED_TEXT) && allowed.text === ALLOWED_TEXT, { lane: allowed.lane, disposition: allowed.disposition, bytes: allowed.bytes })
  check('denied-outside-ceiling: a typed P1 refusal, no read performed', denied.lane === 'deny' && denied.disposition === 'deny' && denied.denial?.code === 'IO_READ_DENIED' && denied.providerConsulted === false, { denial: denied.denial, consulted: denied.providerConsulted })
  check('denied-zero-bytes: zero bytes escaped', denied.bytes === 0 && denied.text === null, { bytes: denied.bytes })
  check('two-member-isolation: B is denied the locator A was allowed', isolated.memberInstanceId !== allowed.memberInstanceId && isolated.disposition === 'deny' && isolated.bytes === 0, { alpha: allowed.memberInstanceId, beta: isolated.memberInstanceId })
  check('window-over-10mib: the file is >10MiB and the ceiling admits it', windowed.fileBytes > 10 * MIB && windowed.disposition === 'allow', { size: windowed.fileBytes, disposition: windowed.disposition })
  // (C4) The window semantics are asserted, not assumed: exact byte count and
  // content at offset 0 and at the file's tail boundary. These pass for ANY
  // driver; they do not substitute for the native-tool case verdict below.
  check('window-over-10mib: the read returned exactly the requested window (bytes + content)', windowed.windowed === true && windowed.bytes === WINDOW.limit && windowed.text === 'a'.repeat(WINDOW.limit), { bytes: windowed.bytes, windowed: windowed.windowed })
  check('window-over-10mib: a window at the file-edge boundary returns exactly the requested length', windowEdge.windowed === true && windowEdge.bytes === WINDOW.limit && windowEdge.text === 'a'.repeat(WINDOW.limit), { bytes: windowEdge.bytes, offset: BIG_FILE_BYTES - WINDOW.limit })
  // (C1) The chain artifact does NOT carry the driver marker: `providerFactOf`
  // (`lib/a5sf-evidence.mjs:198`) whitelists seven identity fields, so a dry row
  // and a native row are indistinguishable IN THE CHAIN. The driver identity is
  // recorded once per run in the suite's own summary artifact. This assertion
  // keeps that boundary true instead of letting the README claim otherwise.
  check(
    'chain artifact does not carry the driver marker; the run summary does',
    chainRows.every((row) => row.kind !== 'call' || row.provider === undefined || (row.provider.kind === undefined && row.provider.native === undefined)) && driver.kind !== undefined,
    { chainProviderFields: [...new Set(chainRows.filter((r) => r.kind === 'call').flatMap((r) => Object.keys(r.provider ?? {})))], summaryDriver: { kind: driver.kind, native: driver.native === true } },
  )
  check('read:diag clean for the run rows', cleanDiag.status === 0 && /verdict=NO_BYPASS_FOUND/.test(cleanDiag.stdout), { status: cleanDiag.status, summary: cleanDiag.stdout.split('\n').find((l) => l.startsWith('SUMMARY')) ?? null })
  check('read:diag finds the synthetic bypass', syntheticDiag.status === 1 && /ALLOW_OUTSIDE_COMPILED_CEILING/.test(syntheticDiag.stdout), { status: syntheticDiag.status, findings: syntheticDiag.stdout.split('\n').filter((l) => l.includes('APPROVAL_BYPASS')) })
  check('read:chain - the refused call aligns across the four links', chainByCall.get(denied.callId)?.verdict === 'CHAIN_ALIGNED', chainByCall.get(denied.callId) ?? null)
  check('read:chain - the allowed call is missing ONLY the host-attributable effect link', chainByCall.get(allowed.callId)?.verdict === 'CHAIN_BROKEN' && chainByCall.get(allowed.callId)?.link === 'effect' && chainByCall.get(allowed.callId)?.reason === 'EFFECT_NOT_OBSERVED', chainByCall.get(allowed.callId) ?? null)
  const brokenChains = (chain.chains ?? []).filter((entry) => entry.verdict !== 'CHAIN_ALIGNED')
  check(
    'read:chain - every broken link is the host-attributable effect (no other link is missing or contradictory)',
    brokenChains.length === calls.filter((c) => c.lane === 'allow').length && brokenChains.every((entry) => entry.link === 'effect' && entry.reason === 'EFFECT_NOT_OBSERVED'),
    brokenChains.map(({ callId, verdict, link, reason }) => ({ callId, verdict, link, reason })),
  )
  check('read:leak-check - the denied content appears in no evidence artifact', !existsSync(chainPath) ? false : !readFileSync(chainPath, 'utf8').includes(OUTSIDE_TEXT.trim()), { outsideTextInChain: readFileSync(chainPath, 'utf8').includes(OUTSIDE_TEXT.trim()) })

  evidence.mode = mode
  evidence.driver = { kind: driver.kind, native: driver.native === true }
  evidence.fixtures = { allowedFile, outsideFile, bigFile, betaFile, workRoot: work, bigFileBytes: BIG_FILE_BYTES }
  evidence.calls = calls
  evidence.diag = {
    clean: { status: cleanDiag.status, stdout: cleanDiag.stdout, verdict: /verdict=NO_BYPASS_FOUND/.test(cleanDiag.stdout) ? 'NO_BYPASS_FOUND' : 'NOT_CLEAN' },
    synthetic: { status: syntheticDiag.status, stdout: syntheticDiag.stdout },
  }
  evidence.chain = { verdict: chain.summary?.verdict ?? 'NO_VERDICT', calls: chain.chains ?? [], summary: chain.summary ?? null, error: chain.error ?? null, cliStatus: chainCli.status, cliStdout: String(chainCli.stdout ?? ''), cliStderr: String(chainCli.stderr ?? '') }
  evidence.assertions = assertions

  // The per-case verdict map. A dry run is not a RUN record, but it must not
  // print a case as PASS off a weaker assertion than the live run would need
  // (review C4/C5): `read:window-over-10mib` is NOT_REACHED unless a NATIVE
  // driver supplied an exact window.
  const assertionById = new Map(assertions.map((a) => [a.id, a]))
  const caseVerdict = (id, assertionId, extra) => {
    const passed = assertionById.get(assertionId)?.ok === true
    if (extra !== undefined) return extra
    return { caseId: id, verdict: passed ? 'PASS' : 'FAIL', reason: passed ? 'ASSERTION_PASSED' : 'ASSERTION_FAILED', assertion: assertionId }
  }
  const windowTextOk = windowed.text === 'a'.repeat(WINDOW.limit)
  const windowVerdict = windowCaseVerdict({
    native: driver.native === true,
    windowed: windowed.windowed === true,
    bytes: windowed.bytes,
    expectedBytes: WINDOW.limit,
    textOk: windowTextOk,
    size: windowed.fileBytes,
  })
  evidence.cases = [
    caseVerdict('read:allowed-inside-ceiling', 'allowed-inside-ceiling: the guard admitted and the Provider returned bytes'),
    caseVerdict('read:denied-outside-ceiling', 'denied-outside-ceiling: a typed P1 refusal, no read performed'),
    caseVerdict('read:denied-zero-bytes', 'denied-zero-bytes: zero bytes escaped'),
    caseVerdict('read:window-over-10mib', 'window-over-10mib: the read returned exactly the requested window (bytes + content)', { caseId: 'read:window-over-10mib', ...windowVerdict, assertion: 'windowCaseVerdict(native, windowed, bytes, content)' }),
    caseVerdict('read:two-member-isolation', 'two-member-isolation: B is denied the locator A was allowed'),
    caseVerdict('read:chain-diag-no-bypass', 'read:diag clean for the run rows'),
    caseVerdict('read:leak-check', 'read:leak-check - the denied content appears in no evidence artifact'),
  ]
  evidence.cases.find((c) => c.caseId === 'read:chain-diag-no-bypass').synthetic = assertionById.get('read:diag finds the synthetic bypass')?.ok === true ? 'PASS' : 'FAIL'
  return { evidence, calls, assertions, cases: evidence.cases, chainText: renderChainReport(chain), work }
}

/**
 * Run the whole host-free scene with the `dry-node-fs` driver. Exported so the
 * C1 suite can enforce the dry path in CI (the CLI below uses exactly this).
 *
 * @param {{repoRoot: string, evidenceDir: string}} input
 */
export async function runDryScenario({ repoRoot, evidenceDir }) {
  const driver = createDryDriver()
  const result = await runScenario({ mode: 'dry', repoRoot, evidenceDir, driver })
  return { ...result, driver }
}

/**
 * The LIVE-SEAM half of the same scene, with a caller-supplied live driver and
 * NO Host boot. `runScenario` never touches a World (the reads go through the
 * driver's own mounted realm), so this is the CI-safe way to exercise the seam
 * the suite's `--live` path documents: it proves the driver measures, while the
 * `run()` path remains the one that additionally boots a Host.
 *
 * @param {{repoRoot: string, evidenceDir: string, driver: object}} input
 */
export async function runLiveSeamScenario({ repoRoot, evidenceDir, driver }) {
  if (driver === null || typeof driver !== 'object' || typeof driver.read !== 'function') {
    throw new A5sfReadGateError('LIVE_SEAM_UNAVAILABLE', 'DRIVER_INVALID', 'runLiveSeamScenario needs a driver with read()')
  }
  const result = await runScenario({ mode: 'live', repoRoot, evidenceDir, driver })
  return { ...result, driver }
}

// ─────────────────────────────────────────────────────────────────────────────
// the suite descriptor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} opts the u5-canary-runner hands `{ factory, record, rc, log, line, worlds, keepHome, evidence, runId }`
 * @param {object} ctx  `{ sleep, waitUntil, …, REPO_ROOT }`
 */
async function run(opts = {}, ctx = {}) {
  const repoRoot = ctx.REPO_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const evidenceDir = resolve(String(opts.evidence ?? join(repoRoot, '.artifacts', 'a5sf-read', opts.line ?? 'run')))
  const record = opts.record

  // 1) The live seam probe is FREE (no budget, no World). It runs first so a
  //    missing install seam refuses before the grant gate reserves a row.
  const driverSpec = await resolveReadDriver(opts)

  // 2) The authorisation gate: no grant ⇒ zero starts, zero ledger writes.
  //    A CANDIDATE-C2 grant takes the unchanged per-run path; a DEV-LIVE grant
  //    may be reused for repeated starts inside its declared face/world.
  const headCommit = isNonBlank(opts.headCommit) ? String(opts.headCommit) : resolveHeadCommit(repoRoot)
  const face = isNonBlank(opts.face) ? String(opts.face) : 'FS Provider'
  const worldLine = String(opts.line ?? 'a5sf-read')
  const lease = await preRegisterBudget({
    grantPath: opts.grant ?? process.env.A5SF_BUDGET_GRANT,
    headCommit,
    runRecord: record,
    requiredBoots: 1,
    face,
    world: worldLine,
  })

  // 3) The World + the one boot, through the merged harness (dynamic import so
  //    that loading this suite in the runner/CI does not drag the Host tree in).
  const { createA5sfHarness } = await import(pathToFileURL(join(repoRoot, 'tests', 'world-factory', 'lib', 'a5sf-harness.mjs')).href)
  const harness = createA5sfHarness({
    repoRoot,
    evidenceRoot: evidenceDir,
    suite: SUITE_NAME,
    line: String(opts.line ?? 'a5sf-read'),
    runRecord: record,
    ...(lease.maxStarts === null || lease.maxStarts === undefined ? {} : { maxHostStarts: lease.maxStarts }),
  })
  let driver = null
  if (typeof driverSpec.createReadDriver === 'function') {
    driver = await driverSpec.createReadDriver({ repoRoot, harness, evidenceDir, recorder: null })
  }
  const world = await harness.createWorld({ line: String(opts.line ?? 'a5sf-read') })
  if (Array.isArray(opts.worlds)) opts.worlds.push(world)
  // A dev-live run owes the ledger an OUTCOME row carrying the World teardown
  // receipt (owner ruling 2026-11-09: version, env, cases, result, teardown).
  // The runner owns teardown, so the lease records the outcome when teardown
  // actually happens; `lease.finish()` also releases the 2-concurrent slot.
  if (lease.scope === 'DEV-LIVE' && typeof lease.finish === 'function') {
    const originalTeardown = world.teardown.bind(world)
    world.teardown = async (teardownOpts = {}) => {
      let receipt = null
      try {
        receipt = await originalTeardown(teardownOpts)
        return receipt
      } finally {
        try {
          const observed = record?.record?.cases ?? []
          const overall = observed.reduce((worst, c) => {
            const v = c?.verdict ?? 'FAIL'
            return (VERDICT_SEVERITY[v] ?? VERDICT_SEVERITY.FAIL) > (VERDICT_SEVERITY[worst] ?? 0) ? v : worst
          }, 'PASS')
          lease.finish({ overall, cases: observed, teardown: receipt })
        } catch (error) {
          if (record !== undefined) record.record.devLiveOutcomeError = String(error?.message ?? error)
        }
      }
    }
  }
  await world.startMock({
    decide: () => ({ content: 'a5sf-read: the mock only bootstraps the Host; the read is driven through the Provider' }),
  })
  await lease.boot(() => harness.boot({ world, phase: 'a5sf-read-boot1' }))

  // 4) The SAME scenario, with the live driver supplying the read.
  const { evidence, assertions, cases } = await runScenario({ mode: 'live', repoRoot, evidenceDir, driver })
  writeFileSync(join(evidenceDir, 'live-summary.json'), `${JSON.stringify(evidence, null, 2)}\n`)

  // The per-case verdicts come from `runScenario`. `read:window-over-10mib` is
  // NOT_REACHED unless a NATIVE driver produced an exact window (review C4): a
  // policy admission is not a window read, so it can never make this PASS.
  for (const row of cases) {
    record?.addCase(row.caseId, row.verdict, { reason: row.reason, assertion: row.assertion ?? null, evidenceDir })
  }
  return { lease, evidence, assertions, cases }
}

export default Object.freeze({
  suite: SUITE_NAME,
  cases: CASES,
  totalRequests: 16,
  run,
})

// ─────────────────────────────────────────────────────────────────────────────
// direct CLI: `--dry` runs the whole host-free scene; `--live` refuses without
// a grant and, with one, would boot exactly once. Nothing here boots.
// ─────────────────────────────────────────────────────────────────────────────

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const args = process.argv.slice(2)
  const flag = (name) => {
    const at = args.indexOf(name)
    return at === -1 ? null : (args[at + 1] ?? null)
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const evidenceDir = resolve(flag('--evidence') ?? join(repoRoot, '.artifacts', 'a5sf-read', 'dry'))
  const mode = args.includes('--dry') ? 'dry' : (args.includes('--live') ? 'live' : null)

  if (mode === 'dry') {
    // The dry run is the host-free half: no World, no boot, zero budget.
    const { evidence, assertions } = await runDryScenario({ repoRoot, evidenceDir })
    const summary = {
      mode: 'dry',
      boot: false,
      hostStarts: 0,
      budgetRows: 0,
      driver: evidence.driver,
      assertions: assertions.map(({ id, ok, detail }) => ({ id, ok, detail })),
      checked: assertions.filter((a) => a.ok).length,
      total: assertions.length,
      cases: evidence.cases,
      diag: evidence.diag,
      chainVerdict: evidence.chain.verdict,
      notProven: [
        'the native `read` tool (dry mode reads through node:fs, not through the Host tool)',
        'Provider consultation inside a booted Host (no a5sf realm is mounted by production code)',
        'the >10MiB native window/stream semantics (only the policy admission is exercised here)',
        'a Host-attributable effect (the sound oracle needs a live host pid; dry mode answers effect=false)',
      ],
    }
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(join(evidenceDir, 'dry-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
    process.stdout.write(`A5SF-READ-DRY driver=${summary.driver.kind} native=${String(summary.driver.native)} hostStarts=0\n`)
    for (const a of assertions) process.stdout.write(`${a.ok ? 'PASS' : 'FAIL'} ${a.id}\n`)
    for (const row of summary.cases) process.stdout.write(`CASE ${row.verdict} ${row.caseId} reason=${row.reason}\n`)
    process.stdout.write(`A5SF-READ-DRY assertions=${summary.checked}/${summary.total} cases=${summary.cases.filter((c) => c.verdict === 'PASS').length}PASS/${summary.cases.filter((c) => c.verdict === 'NOT_REACHED').length}NOT_REACHED/${summary.cases.filter((c) => c.verdict === 'FAIL').length}FAIL diag=${summary.diag.clean.verdict} synthetic=${summary.diag.synthetic.status} chain=${summary.chainVerdict}\n`)
    process.stdout.write(`evidence: ${evidenceDir}\n`)
    if (summary.checked !== summary.total) process.exitCode = 1
  } else if (mode === 'live') {
    // Deliberately NO boot here: this CLI path refuses exactly as the suite's
    // `run()` does when no driver/grant exists, and reports what it would spend.
    try {
      await resolveReadDriver({ driver: flag('--driver') })
      const grant = flag('--grant') ?? process.env.A5SF_BUDGET_GRANT
      const read = readBudgetGrant(grant)
      if (!read.ok) throw new A5sfReadGateError('BUDGET_NOT_GRANTED', read.reason, read.detail)
      const g = read.grant
      process.stdout.write(`A5SF-READ-LIVE grant=${g.grantId} scope=${g.scope}${g.scope === 'DEV-LIVE' ? ` face=${String(g.face)} world=${String(g.world)}` : ` maxStarts=${String(g.maxStarts)} boundCommit=${String(g.boundCommit)}`}\n`)
      process.stdout.write('A5SF-READ-LIVE refused: this CLI does not boot; run it through u5-canary-runner.mjs --suite a5sf-read (see the evidence README).\n')
      process.exitCode = 2
    } catch (error) {
      process.stdout.write(`${String(error?.code ?? 'REFUSED')} ${String(error?.message ?? error)}\n`)
      process.exitCode = 1
    }
  } else {
    process.stdout.write('usage: node tests/world-factory/suites/150-a5sf-read.mjs --dry [--evidence <dir>]\n       node tests/world-factory/suites/150-a5sf-read.mjs --live [--grant <ledger>] [--driver <module>]\n')
    process.exitCode = 2
  }
}

export { run as runA5sfRead }
