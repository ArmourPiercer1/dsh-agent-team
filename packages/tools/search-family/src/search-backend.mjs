/**
 * search-backend.mjs — the anchored, CONFINED real-ripgrep `grep` effect backend.
 *
 * WHAT THIS IS: the effect body the governed tool plane's `team_grep` row needs
 * at rg parity. The plan names it verbatim
 * (`docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md`
 * :33 — "PR5 | `grep/glob` R3 + Bash/Pwsh Tool Adapter + 原生等价层"; :132 —
 * "`grep/glob` 真实固定 rg 版行为回归（原生 vs Team 的结构化 value、meta/render、
 * 错误、binary、ignore/hidden/VCS、路径、溢出 Spill、本机/并发/Cancel/timeout）"),
 * and the GLUE-7 independent review named the gap this file closes
 * (`dev/agent-workflow/evidence/alpha5/glue7-independent-review-a5g7rev/VERDICT.md`
 * ②: the delivered search row was a grep(1) port, so the ignore / hidden / VCS
 * classes the plan's regression list names were unreachable — on the parity
 * fixture the grep row finds 12 files where this row finds 5).
 *
 * IT RIDES THE SAME PUBLIC ENTRY POINTS THE GLOB ROW DOES: the packaged ripgrep
 * binary (`resolveRgPath`), the host's fixed argv (`buildGrepCommand`, which
 * bakes `--json --regexp=<P> [--glob=<inc>]`), the host's record reader
 * (`parseGrepMatches` — the ONLY thing that turns rg's NDJSON into matches here,
 * and it fails the whole search on a non-JSON line), and the host's fixed prefix
 * `--no-config` (the one that keeps `RIPGREP_CONFIG_PATH`, and through it a
 * `--pre` program, from steering a search). The execution face is the confined
 * Process provider, so the read scope is kernel enforced — "Confined Spawn
 * around the actual rg process — no post-filter as substitute for read
 * isolation" (`architecture.md:234`, the requirement the glob row cites too).
 *
 * THE ANCHOR LAW IS IMPORTED, NOT COPIED: `openAnchoredWalkRoot` and
 * `verifyGlobResultsBeneath` are `glob-backend.mjs`'s exported A1–A4
 * implementation (component-wise `O_NOFOLLOW|O_DIRECTORY` opens starting at the
 * governed root, a `/proc/self/fd/<n>` re-read per open, the escape/drift/
 * undeterminable words of the controlled-fs open-at-exec law, a pinned anchor
 * handle whose identity is re-checked at verification time). One implementation
 * of that law exists in this package; this file borrows it instead of forking a
 * second copy that could drift. `verifyAnchorStillGoverned` below is the A3 arm
 * in the shape a search needs (the anchor that produced the answer is still the
 * anchor being verified, and the governed root is still the same object).
 * Refusals coming out of that shared law are RE-WRAPPED here (`mapSharedLaw`)
 * so this row's own code/family/detail table is the only vocabulary the wire
 * ever sees.
 *
 * THE FIXED ARGV — every token is a measurement. The raw runs are in
 * `dev/agent-workflow/evidence/alpha5/srgp/probes/` (what each one settled, and
 * which early legs were invalid, is written in that directory's `README.md`),
 * and every fact below is re-measured in-repo by
 * `packages/runtime/test/alpha5-search-backend.test.ts`:
 *
 *   rg --no-config                        the host's own prefix (its `runRipgrep`):
 *                                         blocks a config file — and through it a
 *                                         `--pre` program — from steering a search
 *      --json --regexp=<P> [--glob=<inc>] `buildGrepCommand` verbatim: `=`-attached,
 *                                         so a leading-dash pattern is data, never
 *                                         a flag
 *      (no --no-messages)       DELIBERATE ABSENCE, and it is a law, not taste.
 *                               The flag was in this argv until the coverage
 *                               measurement (probes `coverage-probe.mjs`, legs
 *                               G-on-nogrants vs B-off-nogrants): with it, a walk
 *                               the KERNEL refuses end to end answers `summary`
 *                               present, `stats.searches=0`, `stats.bytes_searched
 *                               =0` and an EMPTY stderr — a silent "no matches"
 *                               for a tree that was never read. Without it the
 *                               same walk says `rg: .: Permission denied (os error
 *                               13)`, which is the only evidence that an empty
 *                               answer is a refusal rather than a fact. What the
 *                               flag also silences — the upward-discovery noise
 *                               (`/…/.git: Permission denied` on every walk of a
 *                               root that is not its own git root) — is NOT lost:
 *                               it names an ABSOLUTE path, the refusal evidence
 *                               names a path RELATIVE to the search element, and
 *                               the coverage law below reads only the second
 *                               class. Nothing from stderr is ever PRESENTED:
 *                               stderr is a count on the wire and an internal-face
 *                               line at most (A8), so silencing it bought nothing
 *                               and cost the one signal that matters.
 *      --no-ignore-parent       additions: rules from ABOVE the governed root, or
 *      --no-ignore-global       from a user profile, never steer the answer. Both
 *                               are selection-neutral on every fixture measured
 *                               (identical record sets with and without), and both
 *                               remove a nondeterminism the confined child cannot
 *                               even read — the sandbox denies those files.
 *      -- <path>                LOAD-BEARING, not cosmetic. Inside the confined
 *                               child fd 0 is a readable SOCKET, so rg 15's stdin
 *                               heuristic ("…is_socket=true … concluded that
 *                               is_stdin_readable=true", "heuristic chose to search
 *                               stdin") replaces the walk with an EMPTY stdin
 *                               search: exit 0, zero records, zero stderr. An
 *                               explicit search path disables the heuristic. The row
 *                               spells that path as the CONSTANT `.` for a directory
 *                               target (the child's cwd IS the anchored directory,
 *                               so argv carries no path string at all), and as the
 *                               target file's own name for a file target.
 *
 * MODELS MEASURED, NOT ASSUMED (each is pinned by a parity leg):
 *   - binary class: a file whose matching line carries a NUL produces NO record
 *     in `--json` mode (rg's binary law), and `parseGrepMatches` yields nothing
 *     for it; the grep(1) row's `--binary-files=without-match` agrees. The suite
 *     pins both sides rather than asserting a preference.
 *   - ignore / hidden / VCS classes: rg's own defaults (`.gitignore` honored,
 *     dotfiles skipped, `.git`/`.svn` skipped) — the classes grep(1) cannot
 *     express at all. This is the reason the row exists.
 *   - framing: a file named `newline\nname.ts` is ONE record under `--json`
 *     (the path is JSON-escaped) and TWO lines under grep(1) — and under rg's own
 *     `-l`/`-c` output. So every mode of this row runs `--json` and PROJECTS the
 *     lane's three modes from the record stream; the parity suite pins that
 *     projection against the native `-l`/`-c` oracles.
 *   - THE COMPLETION LAW, because the confined face has NO exit code to read:
 *     the pre-launcher supervises the payload, records its rc in its own
 *     bookkeeping, and exits 0 whatever the child did (measured: `/bin/sh -c
 *     'exit 7'` settles `{code: 0}` through this face). So the host's exit law
 *     (`1` = no matches, `≥ 2` = error, the rule `classifyRunFailure` sits on)
 *     CANNOT be transplanted — a row that trusted `exit 0` would trust a walk
 *     that never ran. What this face DOES carry is the protocol: a `--json` walk
 *     that ran to completion always ends with a `summary` record (measured on a
 *     zero-match walk and on an absent target), while a walk ripgrep refused to
 *     start produces ZERO bytes. Completion is therefore proved from the stream,
 *     and the host's own classification rule (`/regex parse error|error parsing
 *     glob/i` → a pattern refusal, anything else a generic search error) is
 *     applied to that case as a CODE only: the walker's words are foreign
 *     enumeration data and go to the internal face, never to the wire (A8).
 *
 * THE OUTPUT LAW (the glob row's A5–A8, restated because this file is reviewed
 * on its own):
 *   - ONE producer of presented paths: `projectMatches` builds every presented
 *     string from `anchor.anchorPath` (fixed when the anchor was taken) joined to
 *     a record path admitted only if root-relative (`presentPath`); nothing after
 *     it re-parses, re-splits or re-resolves.
 *   - ONE sink write per call, AFTER the verdict, from admitted rows only
 *     (C-SPILL). A refused search writes zero bytes; an admitted one writes
 *     precisely what it admits, in the lane's own line form. The stream handler
 *     holds no channel object at all — no sink, no `io`, no log call carrying
 *     rows.
 *   - the walker's stderr is a diagnostic bounded by `SEARCH_MAX_STDERR_BYTES`
 *     and reaches the internal face only: never the wire, never the sink.
 *   - an observable failure is a CLOSED CODE, a FAMILY word, table prose and
 *     FINITE INTEGERS (`SEARCH_REFUSAL_TEXT` / `SEARCH_REFUSAL_FAMILIES`); no
 *     call site builds a detail string — `failure()` looks the prose up in a
 *     frozen table, so a new arm cannot invent a channel by accident.
 *   - `run()` NEVER throws: an unexpected fault is `internal-error`, whose text
 *     goes to the internal face (default OFF, and not an output channel).
 *   - `observe` carries codes, families, call ids and arithmetic only.
 *   - the cancelled arm settles `settlement.kind === 'cancelled'` with an empty
 *     outcome and writes nothing (C-TIMEOUT).
 *
 * HONEST RESIDUA (disclosed, not hidden):
 *   - a FILE target's name DOES ride argv (the constant `.` only covers
 *     directory targets), so a name swap inside the governed root between the
 *     anchor and the child's open can point the walk at a different IN-ROOT
 *     object. It cannot point it OUTSIDE the root: the confine denies the bytes
 *     (measured: `escape-link.txt` → `rg: …: Permission denied`, exit 2, zero
 *     records — where the native unconfined run happily prints the outside
 *     file's content), the object is verified under the pinned anchor BEFORE the
 *     spawn, and A3 refuses the answer if the anchor moved afterwards.
 *   - per-MATCH handle verification (the glob row's per-entry A4 arm) is NOT
 *     applied to every match here: a search emits a record stream whose objects
 *     the walker already read under the confine, not a list of names this row
 *     later trusts. What IS applied: the file-target pre-spawn A4 verification,
 *     the root-relative record law, and A3 after the walk.
 *   - `multiline` and `contextLines` are refused BY NAME. The grep(1) row mapped
 *     `contextLines` to `-C n` and returned grep's context lines as ordinary
 *     matches — bytes the lane's `SearchMatchLine` cannot distinguish from a
 *     match; a RED leg pins that old behaviour as the fact it is. The walker CAN
 *     say better — `-C n` under `--json` emits a distinct `context` record type
 *     (measured: probes table N9) — but the lane's arm has nowhere to put the
 *     distinction, so forwarding those records as matches would repeat the same
 *     mislabelling under a better-looking protocol. Refusal by name stays the
 *     honest answer until the lane carries an arm for it.
 *   - the lane's `realm-home` placement is refused BY NAME: this row's anchor law
 *     governs the instance root and an absolute path inside it, and a third
 *     placement word would have to be GUESSED at (the grep row ignored
 *     `placement` entirely, which is the same silent-widening class).
 *   - the network dimension makes NO claim (same PoC-4b honesty as the shell and
 *     glob rows).
 *
 * Fail-closed law (shared with the plane): every refusal is the CLOSED
 * `BackendFailure` triad (`denied` / `hidden` / `undetermined`) with a stable
 * code; `run()` never throws; a pre-execute refusal never increments
 * `execCount()`.
 *
 * THE CANCEL LEG (a5-cancel; mechanics in `./cancel-leg.mjs`, owned here): the
 * host's cooperative cancel signal rides the call (`register.ts` forwards
 * `exec?.signal`, the pipeline carries it untouched), and this row ANSWERS it.
 * Additive in both directions — no signal on the call, no leg; a signal that
 * never fires changes no outcome. A cancelled search is a typed FAILURE of THIS
 * table (`call-aborted` when the stop is confirmed — including the honest case
 * of a call that never spawned anything — `termination-unconfirmed` when the
 * provider could not prove the stop), NEVER an `ok: true` empty result: an empty
 * match list is a statement about the tree, and a cancelled walk has made no
 * such statement. The boundary law: the channel is checked before the first
 * await and re-checked after every one, so a pre-abort costs ZERO provider work
 * and ZERO sink bytes; a handle that arrives after the caller already gave up is
 * ADOPTED into the row's one owned terminate instead of being raced away; the
 * settle race's winner (`exited > timedOut > aborted`) is never rewritten by a
 * later fact, which is why an abort that lands after the exit is honoured before
 * the sink write rather than as a different walk outcome. The row's TIMEOUT
 * budget keeps its own historical shape (an `ok: true` cancelled settlement with
 * its own event word): that arm is out of this leg's scope, and rewriting it
 * would change a disclosed behaviour no law here asks about. `signal.reason` is
 * never read and never echoed: it is caller-owned text, and this face publishes
 * codes plus arithmetic.
 *
 * @module search-family/search-backend
 */

import { realpathSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { buildGrepCommand, parseGrepArgs, parseGrepMatches, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'
import { createConfinedProcessProvider } from '../../../runtime/sandbox-provider/index.js'
import { openAnchoredWalkRoot, verifyGlobResultsBeneath } from './glob-backend.mjs'
import { CANCEL_CODE_ABORTED, CANCEL_CODE_UNCONFIRMED, callAborted, createOwnedStop, raceConfinedSettle } from './cancel-leg.mjs'
import { STREAM_DRAIN_MS, awaitBounded, watchStreamEnd } from './stream-drain.mjs'

/** The row's identity, quoted by the mount and by the suites. */
export const SEARCH_BACKEND_ID = 'a5srgp-anchored-confined-rg-grep'

/** Cooperative walk budget (the host's own search budget is 30 s; the plane's
 *  effect budget is 60 s — this row keeps the plane's, disclosed). */
export const SEARCH_WALK_TIMEOUT_MS = 60_000
/** Buffered `--json` ceiling. Over it: typed refusal and ZERO sink bytes — never
 *  a partial parse (the host's own raw-output-overflow law, same shape). */
export const SEARCH_MAX_JSON_BYTES = 8 * 1024 * 1024
/** The diagnostic channel is bounded too: a chatty walker is not a memory cap. */
export const SEARCH_MAX_STDERR_BYTES = 8 * 1024
/** The placements this row's anchor law can interpret. `realm-home` is
 *  deliberately ABSENT: it names a scope this row does not govern, and the
 *  alternative to refusing it is guessing at it (see the header residuum). */
export const SEARCH_PLACEMENTS = Object.freeze(['workspace', 'relative', 'absolute-path'])
/** The row's ONLY additions to the host's fixed argv, in the order they ride. */
export const SEARCH_ARGV_ADDITIONS = Object.freeze(['--no-ignore-parent', '--no-ignore-global'])
/** The search element for a directory target: the child's cwd IS the anchor. */
export const SEARCH_WALK_PATH_ELEMENT = '.'

/** Closed code table: the wire detail is this table's value, never a built string. */
export const SEARCH_REFUSAL_TEXT = Object.freeze({
  'wrong-tool-for-backend': 'the search backend received a call for a different tool',
  'multiline-unsupported': 'multiline search is not implemented (refused by name, never reinterpreted)',
  'context-unsupported': 'context lines are not implemented by the ripgrep search row (refused by name, never reinterpreted)',
  'fixed-string-unsupported': 'fixed-string search is not implemented by the ripgrep search row (refused by name, never reinterpreted)',
  'ignore-case-unsupported': 'case-insensitive search is not implemented by the ripgrep search row (refused by name, never reinterpreted)',
  'placement-unsupported': 'the target placement is outside this row\'s anchor law (refused by name, never guessed at)',
  'pattern-invalid': 'the pattern or file filter was rejected by the search vocabulary',
  'rg-unavailable': 'the packaged ripgrep binary could not be resolved',
  'confined-unavailable': 'the confined process provider is unavailable',
  'confined-refused': 'the confined process provider refused the spawn',
  'spawn-failed': 'the confined child could not be spawned',
  'walker-invalid-pattern': 'ripgrep rejected the pattern',
  'walker-error': 'ripgrep reported a search error',
  'walker-permission-refused': 'ripgrep could not read the searched path — an empty answer here would be a refusal, not a fact',
  'output-too-large': 'the raw search output exceeded the buffered cap',
  'protocol-error': 'ripgrep output did not match its protocol',
  'record-out-of-scope': 'a ripgrep record named something outside the anchored tree',
  'anchor-drift': 'the pinned anchor is not the object the search ran under',
  'root-drift': 'the governed root was swapped or replaced after the anchor was taken',
  'exec-time-escape': 'an opened anchor component resolved outside the governed root',
  'anchor-unverifiable': 'the anchor cannot be verified on this platform',
  'anchor-law-unavailable': 'this platform does not provide the anchor law',
  'anchor-open-failed': 'the anchor open failed',
  'locator-rejected': 'the target locator was rejected',
  'placement-mismatch': 'the target placement does not match its locator',
  'target-outside-governed-root': 'the target lexically escapes the governed root',
  'symlink-alias': 'the target resolves through a symlink alias — refused, never followed',
  'target-unresolvable': 'the target does not exist at anchor time',
  'not-a-directory': 'the target is not a directory',
  'root-unavailable': 'the governed root could not be opened',
  'root-symlink-alias': 'the governed root is a symlink alias',
  'walk-contaminated': 'a searched object is not a plain file inside the anchor',
  'walk-unverifiable': 'a searched object could not be verified',
  'call-aborted': 'the search call was cancelled cooperatively before its answer could be committed, and its confined walk is confirmed stopped',
  'termination-unconfirmed': 'the search call was cancelled cooperatively and its confined walk could not be confirmed stopped',
  'internal-error': 'an unexpected internal fault occurred',
})

/** Every code belongs to exactly one family; the family is the audit word. */
export const SEARCH_REFUSAL_FAMILIES = Object.freeze({
  'wrong-tool-for-backend': 'a5srgp-refused/pre-execute',
  'multiline-unsupported': 'a5srgp-refused/pre-execute',
  'context-unsupported': 'a5srgp-refused/pre-execute',
  'fixed-string-unsupported': 'a5srgp-refused/pre-execute',
  'ignore-case-unsupported': 'a5srgp-refused/pre-execute',
  'placement-unsupported': 'a5srgp-refused/pre-execute',
  'pattern-invalid': 'a5srgp-refused/pre-execute',
  'rg-unavailable': 'a5srgp-refused/pre-execute',
  'confined-unavailable': 'a5srgp-refused/pre-execute',
  'anchor-law-unavailable': 'a5srgp-refused/pre-execute',
  'confined-refused': 'a5srgp-refused/transport',
  'spawn-failed': 'a5srgp-refused/transport',
  'walker-invalid-pattern': 'a5srgp-refused/walker',
  'walker-error': 'a5srgp-refused/walker',
  'walker-permission-refused': 'a5srgp-refused/walker',
  'output-too-large': 'a5srgp-refused/transport',
  'protocol-error': 'a5srgp-refused/transport',
  'record-out-of-scope': 'a5srgp-refused/verification',
  'anchor-drift': 'a5srgp-refused/verification',
  'root-drift': 'a5srgp-refused/verification',
  'exec-time-escape': 'a5srgp-refused/verification',
  'anchor-unverifiable': 'a5srgp-refused/verification',
  'anchor-open-failed': 'a5srgp-refused/verification',
  'locator-rejected': 'a5srgp-refused/pre-execute',
  'placement-mismatch': 'a5srgp-refused/pre-execute',
  'target-outside-governed-root': 'a5srgp-refused/verification',
  'symlink-alias': 'a5srgp-refused/verification',
  'target-unresolvable': 'a5srgp-refused/verification',
  'not-a-directory': 'a5srgp-refused/verification',
  'root-unavailable': 'a5srgp-refused/verification',
  'root-symlink-alias': 'a5srgp-refused/verification',
  'walk-contaminated': 'a5srgp-refused/verification',
  'walk-unverifiable': 'a5srgp-refused/verification',
  'call-aborted': 'a5srgp-refused/cancel',
  'termination-unconfirmed': 'a5srgp-refused/cancel',
  'internal-error': 'a5srgp-refused/transport',
})

/**
 * THE UNIFIED OUTPUT LAW, mechanically: an observable refusal is built HERE and
 * nowhere else — a CLOSED CODE, a FAMILY word, table prose and FINITE INTEGERS.
 * `counts` is filtered to finite integers, so the only dynamic content a refusal
 * can ever carry is arithmetic; `debugText` goes to the internal face (if one is
 * assembled) and is dropped otherwise. The shape is the glob row's byte for
 * byte, so the plane's renderer sees one refusal vocabulary.
 */
const failure = (cls, code, counts = {}, debug = undefined, debugText = '') => {
  const safeCounts = {}
  for (const [key, value] of Object.entries(counts)) {
    if (typeof value === 'number' && Number.isFinite(value)) safeCounts[key] = Math.trunc(value)
  }
  if (debug !== undefined && debugText.length > 0) emitDebug(debug, code, debugText)
  return {
    ok: false,
    failure: {
      class: cls,
      code,
      family: SEARCH_REFUSAL_FAMILIES[code] ?? 'a5srgp-refused/unclassified',
      detail: SEARCH_REFUSAL_TEXT[code] ?? 'the search was refused; the reason is carried by the code, not by echoed data',
      counts: safeCounts,
    },
  }
}

/**
 * A refusal produced by the SHARED anchor law (`glob-backend.mjs`) arrives with
 * that row's own family word. It is re-wrapped here: same class, same code,
 * THIS row's table. Nothing else travels — no path, no entry, no message.
 */
function mapSharedLaw(refusal, debug) {
  const f = refusal?.failure
  const cls = f?.class === 'denied' || f?.class === 'hidden' || f?.class === 'undetermined' ? f.class : 'undetermined'
  const code = typeof f?.code === 'string' && SEARCH_REFUSAL_TEXT[f.code] !== undefined ? f.code : 'anchor-unverifiable'
  const counts = {}
  for (const [key, value] of Object.entries(f?.counts ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) counts[key] = value
  }
  return failure(cls, code, counts, debug, `shared-law code=${safeToken(f?.code)} family=${safeToken(f?.family)}`)
}

/** The internal face is called through here so a throwing sink cannot change a verdict. */
function emitDebug(debug, code, text) {
  try {
    debug(`${code} ${String(text).slice(0, 2000)}`)
  } catch {
    /* a debug face is never allowed to alter an outcome */
  }
}

/** No debug face: the default. OFF means OFF — nothing is retained anywhere. */
const NO_DEBUG = () => {}

/** An error `code` token is a bounded identifier, never free text (A8 clause 3). */
const safeToken = (value) => {
  const text = String(value ?? '')
  return /^[A-Za-z0-9._:-]{1,40}$/.test(text) ? text : 'unspecified'
}

/** System paths a confined native binary needs to boot (rx only, never writable). */
const SYSTEM_RX = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })

/** `/lib64` is absent on some hosts; a confined allow-entry for a missing path would refuse. */
let lib64Present = null
function hasLib64() {
  if (lib64Present === null) {
    try {
      lib64Present = realpathSync('/lib64').length > 0
    } catch {
      lib64Present = false
    }
  }
  return lib64Present
}

function isBeneath(anchorPath, candidate) {
  if (candidate === anchorPath) return true
  return candidate.startsWith(`${anchorPath}/`) && !candidate.slice(anchorPath.length).split('/').includes('..')
}

/**
 * THE ONE argv builder. `pathElt` is the row's own search element (`.` for a
 * directory anchor, the target file's own name for a file anchor). The host's
 * builder is called WITHOUT a path so its own `--`/path push never happens, and
 * the row appends its fixed additions plus that element — so this function, and
 * nothing else, decides what ripgrep is asked to do.
 */
export function searchArgv(parsed, pathElt = SEARCH_WALK_PATH_ELEMENT) {
  // The host's own prefix (`runRipgrep` prepends it before any argv it builds):
  // a config file — and through it a `--pre` program — never steers a search.
  const host = ['--no-config', ...buildGrepCommand({
    pattern: parsed.pattern,
    ...(typeof parsed.globFilter === 'string' && parsed.globFilter.length > 0 ? { include: parsed.globFilter } : {}),
  })]
  return [...host, ...SEARCH_ARGV_ADDITIONS, '--', pathElt]
}

/**
 * The row-local A3 arm, in the shape a search needs: the handle that produced the
 * answer must STILL resolve, by REALPATH, inside the governed root, and still be
 * the inode the walk ran under. Complementary to the shared verifier by
 * measurement (leg `V11`): an unlinked anchor keeps its inode and keeps a
 * `/proc/self/fd` view, so the shared law's checks pass on it while THIS arm,
 * which resolves the view, reports it — and the shared law's root-identity arm
 * catches the case this one cannot (leg `V11b`). The row runs both; the words are
 * the controlled-fs open-at-exec vocabulary: `escape` / `drift` / `undeterminable`
 * / `confirmed`.
 */
export async function verifyAnchorStillGoverned(anchor) {
  if (anchor?.ok !== true || anchor.handle === undefined) {
    return { verdict: 'undeterminable', detail: 'no accepted anchor handle' }
  }
  const view = `/proc/self/fd/${String(anchor.handle.fd)}`
  let resolved = null
  try {
    resolved = await realpath(view)
  } catch {
    return { verdict: 'undeterminable', detail: 'the pinned anchor fd has no canonical /proc view' }
  }
  if (!isBeneath(anchor.rootReal, resolved)) {
    return { verdict: 'escape', detail: 'the pinned anchor resolves outside the governed root', resolvedPath: resolved }
  }
  try {
    const now = await anchor.handle.stat({ bigint: false })
    if (anchor.identity !== undefined
      && (Number(now.dev) !== anchor.identity.dev || Number(now.ino) !== anchor.identity.ino)) {
      return {
        verdict: 'drift',
        detail: 'the anchor inode changed after the walk',
        snapshot: anchor.identity,
        actual: { dev: Number(now.dev), ino: Number(now.ino) },
      }
    }
  } catch {
    return { verdict: 'undeterminable', detail: 'the pinned anchor fd could not be stat-ed' }
  }
  return { verdict: 'confirmed', resolvedPath: resolved }
}

/**
 * THE PRESENTATION LAW: one producer, from anchor-owned data. A record path is
 * admitted only when root-relative (ripgrep prints `./x` under a `.` search
 * element and `x` under a named one); anything absolute, `..`-bearing or
 * NUL-bearing is a refusal — never a walk into the caller's namespace, and never
 * a re-resolution of the walker's bytes.
 */
export function presentPath(anchor, recordPath) {
  const raw = String(recordPath)
  if (raw.length === 0 || raw.includes('\0') || raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)) {
    return { ok: false, code: 'record-out-of-scope' }
  }
  const parts = raw.split('/')
  if (parts.some((p) => p === '..')) return { ok: false, code: 'record-out-of-scope' }
  const rel = parts.filter((p) => p.length > 0 && p !== '.')
  return { ok: true, path: rel.length === 0 ? anchor.anchorPath : `${anchor.anchorPath}/${rel.join('/')}` }
}

/**
 * THE PROJECTION: the lane's three output modes from ONE `--json` record stream
 * (measured reason: newline-framed modes are NOT injective — `newline\nname.ts`
 * is one object and two records; the JSON stream escapes it, so one record is
 * one object). Admitted rows are returned in full (the spill writes those), the
 * `maxResults` window is an array slice and nothing else, so `truncated` is
 * arithmetic rather than a re-parse.
 */
export function projectMatches(records, outputMode, maxResults, present) {
  const cap = Number.isInteger(maxResults) && maxResults > 0 ? maxResults : records.length
  if (outputMode === 'content') {
    const rows = []
    for (const rec of records) {
      const shown = present(rec.path)
      if (shown.ok !== true) return { ok: false, code: shown.code }
      rows.push({ path: shown.path, line: rec.lineNumber, text: rec.line })
    }
    const matches = rows.slice(0, cap)
    return {
      ok: true,
      rows,
      outcome: { outputMode: 'content', matches, counts: [], files: [], totalMatches: rows.length, truncated: rows.length > matches.length },
    }
  }
  const grouped = []
  const index = new Map()
  for (const rec of records) {
    const shown = present(rec.path)
    if (shown.ok !== true) return { ok: false, code: shown.code }
    const at = index.get(shown.path)
    if (at === undefined) {
      index.set(shown.path, grouped.length)
      grouped.push({ path: shown.path, count: 1 })
    } else {
      const entry = grouped[at]
      entry.count += 1
    }
  }
  if (outputMode === 'files_with_matches') {
    const files = grouped.slice(0, cap).map((e) => e.path)
    return {
      ok: true,
      rows: grouped,
      outcome: { outputMode, matches: [], counts: [], files, totalMatches: grouped.length, truncated: grouped.length > files.length },
    }
  }
  const counts = grouped.slice(0, cap).map((e) => ({ path: e.path, count: e.count }))
  return {
    ok: true,
    rows: grouped,
    outcome: {
      outputMode: 'count',
      matches: [],
      counts,
      files: [],
      totalMatches: counts.reduce((s, e) => s + e.count, 0),
      truncated: grouped.length > counts.length,
    },
  }
}

/**
 * THE ONE RENDER (the spill text is exactly the admitted rows, in the lane's own
 * line form — the same shape the grep row spilled, so the reviewed renderer and
 * spill law downstream stay single-owned).
 */
export function renderRows(rows, outputMode) {
  if (outputMode === 'files_with_matches') return rows.map((r) => r.path).join('\n')
  if (outputMode === 'count') return rows.map((r) => `${r.path}:${String(r.count)}`).join('\n')
  return rows.map((r) => `${r.path}:${String(r.line)}:${r.text}`).join('\n')
}

/**
 * THE COVERAGE LAW — the second half of the completion law, and the answer to
 * "an empty answer is not proof of an empty tree". Measured on the confined face
 * (probes `coverage-probe.mjs`, six shapes):
 *
 *   walk completed, files read      stats.searches>0, stderr: absolute noise only
 *   walk of a genuinely empty tree  stats.searches=0, stderr: absolute noise only
 *   every file ignored by the law   stats.searches=0, stderr: absolute noise only
 *   THE WHOLE WALK REFUSED          stats.searches=0, stderr: `rg: .: Permission
 *                                   denied (os error 13)` — a path RELATIVE to the
 *                                   search element, i.e. about THIS walk
 *   a searched file unreadable      stats.searches=0, `rg: ./src/a.ts: Permission
 *                                   denied …` — same class, partial refusal
 *
 * So `searches=0` alone cannot separate "nothing to search" from "refused": only
 * the RELATIVE permission error can, and it must therefore reach the row — which
 * is why `--no-messages` is absent above. A refusal naming an ABSOLUTE path is
 * rg's upward discovery of a parent `.git` it cannot read: it is a fact about the
 * host's tree above the governed root, never about this answer, so it must not
 * turn a completed walk into a refusal either. The row reads the CLASS of the
 * error, never its text: the returned value is a code, and the walker's sentence
 * stays internal (A8).
 */
export function walkerCoverageRefusal(stderrText) {
  const lines = String(stderrText).split('\n')
  for (const line of lines) {
    const match = /^rg: (.*): (Permission denied|Operation not permitted)/.exec(line)
    if (match === null) continue
    const named = match[1] ?? ''
    if (named.startsWith('/') || /^[A-Za-z]:[\\/]/.test(named)) continue // upward noise
    return 'walker-permission-refused'
  }
  return null
}

/** The host's own failure classification (`search-core`'s `classifyRunFailure`),
 *  kept as the ONE place its rule is written down: a stderr naming a regex or a
 *  glob parse problem is a PATTERN refusal, anything else a generic search
 *  error. The walker's sentence itself never travels — only the fact it named a
 *  pattern error becomes a different CODE.
 */
function classifyWalkerStderr(stderrText) {
  return /regex parse error|error parsing glob/i.test(stderrText) ? 'walker-invalid-pattern' : 'walker-error'
}

/**
 * Build the ripgrep search effect backend.
 *
 * @param options {
 *   realmId: string,
 *   rootDir: string,                                  // governed controlled-fs instance root
 *   confined: { trustRoot, scratchRoot, runnerCommand?, assembly? }, // provider entries, never widened by default
 *   templateId?: string, instanceId?: string,
 *   maxJsonBytes?: number,                            // buffered ceiling, <= SEARCH_MAX_JSON_BYTES
 *   timeoutMs?: number,
 *   observe?: (line: string) => void,                 // audit face: codes + arithmetic only
 *   internalLog?: ((line: string) => void) | null,    // INTERNAL FACE, default OFF — not an output channel
 * }
 */
export function createAnchoredRgSearchBackend(options) {
  const {
    realmId,
    rootDir,
    confined,
    templateId = 'plane',
    instanceId = 'member',
    maxJsonBytes = SEARCH_MAX_JSON_BYTES,
    timeoutMs = SEARCH_WALK_TIMEOUT_MS,
    observe = () => {},
    internalLog = null,
  } = options
  const debug = typeof internalLog === 'function' ? internalLog : NO_DEBUG
  const walkBufferBytes = Math.max(1, Math.min(Number(maxJsonBytes) || SEARCH_MAX_JSON_BYTES, SEARCH_MAX_JSON_BYTES))
  const provider = createConfinedProcessProvider({
    realmId,
    trustRoot: confined?.trustRoot ?? null,
    // The provider writes its scratch PARENT-side; rooted inside the governed
    // root it would show up in every search result, so the DEFAULT is a sibling
    // of the root and never the root itself (the glob row's measured law,
    // `plane-effect-backends.mjs` probe-cwd note). A configured scratchRoot rules.
    scratchRoot: typeof confined?.scratchRoot === 'string' && confined.scratchRoot.length > 0
      ? confined.scratchRoot
      : `${rootDir}.a5srgp-search-scratch`,
    ...(confined?.runnerCommand === undefined ? {} : { runnerCommand: confined.runnerCommand }),
    assembly: confined?.assembly ?? {},
  })
  let probed = null
  let rgPath = null
  let executed = 0
  let trace = []
  const lastRuns = []

  return {
    backendId: SEARCH_BACKEND_ID,
    get lastStageTrace() { return trace },
    execCount: () => executed,
    /** Diagnostics for the reviewer's own runs; never part of a compared value. */
    lastRuns,

    async run(call, io) {
      // A8: THIS METHOD NEVER THROWS, and a fault never becomes a string
      // channel either — an unexpected fault is a code plus arithmetic whose
      // text goes to the internal face, not into an answer.
      try {
        return await runGoverned(call, io)
      } catch (error) {
        trace = [...trace, 'internal-fault']
        observe(`anchored-search INTERNAL-FAULT realm=${safeToken(realmId)} call=${safeToken(call?.callId)}`)
        return failure('undetermined', 'internal-error', {}, debug, `fault code=${safeToken(error?.code)} ${String(error?.stack ?? error?.message ?? error)}`)
      }
    },
  }

  /** The governed search itself, kept whole so `run` can wrap it without gaps. */
  async function runGoverned(call, io) {
    const parsed = call?.parsedArgs
    if (parsed?.tool !== 'grep') {
      return failure('denied', 'wrong-tool-for-backend', {}, debug, `tool=${safeToken(parsed?.tool)}`)
    }
    trace = ['probe']
    // ---- THE CANCEL LEG (a5-cancel) ---------------------------------------
    // The host's cooperative cancel signal rides the call (`register.ts`
    // forwards `exec?.signal`; the pipeline carries it untouched). ADDITIVE IN
    // BOTH DIRECTIONS: a call with no channel runs no new branch at all, and a
    // channel that never fires changes no outcome. The rule this leg enforces
    // is a boundary rule, not a race: ask BEFORE the first await and RE-ASK
    // after every one, so a pre-abort costs zero provider work and zero sink
    // byte, and a fact that arrives late never rewrites a winner (the tie law
    // `exited > timedOut > aborted` lives in `./cancel-leg.mjs`).
    // `signal.reason` is never read: it is caller-owned text, and this face
    // publishes codes plus arithmetic.
    const cancelSignal = call.signal
    const owned = createOwnedStop()
    /** THE one cancel terminal, built by THIS row's own `failure()` face:
     *  closed code + family word + frozen table prose + arithmetic. It takes
     *  the call's ONE owned stop (idempotent, so any number of boundaries ask
     *  and exactly one terminate happens) and READS its result: only a
     *  provider-confirmed `terminated` lease — or the honest case of a call
     *  that never adopted a child — may claim `call-aborted`; a refused,
     *  throwing or non-`terminated` settle is reported as
     *  `termination-unconfirmed`, because this row refuses to claim a stop it
     *  cannot prove. A cancelled search is a FAILURE, never an `ok: true`
     *  empty result: the empty list would be a statement about the tree. */
    const cancelRefusal = async (stage) => {
      // Every cancel boundary reads THE stop of this call — the one memoized
      // reading of the one owned terminate. A second boundary costs no second
      // terminate, and no boundary is allowed to guess at the outcome instead of
      // asking what the provider reported.
      const stop = await owned.stop()
      trace = [...trace, 'cancel']
      const code = stop.stopped === true ? CANCEL_CODE_ABORTED : CANCEL_CODE_UNCONFIRMED
      observe(`anchored-search cancel code=${safeToken(code)} stage=${safeToken(stage)} stop=${safeToken(stop.form)} children=${owned.child() === null ? '0' : '1'} realm=${safeToken(realmId)} call=${safeToken(call?.callId)}`)
      return failure('undetermined', code, { children: owned.child() === null ? 0 : 1 }, debug, `stage=${safeToken(stage)} stop=${safeToken(stop.form)}`)
    }
    // The FIRST boundary, before any await exists: an aborted channel here
    // costs no capability probe, no anchor, no plan file, no child.
    if (callAborted(cancelSignal)) return await cancelRefusal('entry')
    // The knobs this row cannot answer honestly, refused BEFORE anything runs.
    if (parsed.multiline === true) {
      observe(`anchored-search REFUSED multiline-unsupported call=${safeToken(call?.callId)}`)
      return failure('denied', 'multiline-unsupported', {}, debug)
    }
    if (typeof parsed.contextLines === 'number' && parsed.contextLines > 0) {
      observe(`anchored-search REFUSED context-unsupported call=${safeToken(call?.callId)} lines=${String(parsed.contextLines)}`)
      return failure('denied', 'context-unsupported', { lines: parsed.contextLines }, debug)
    }
    // `fixed_string` and `ignore_case` are lane vocabulary (the lane's own grep
    // argument law, `src/args.ts:148-149`) and the grep(1) port honours them
    // (`-F`, `-i`), but
    // the host's PUBLIC ripgrep vocabulary has no arm for them: `buildGrepCommand`
    // accepts `pattern`/`path`/`include` only. Both have encodings — `(?i)` as a
    // pattern prefix works on this walker, and `\Q…\E`-style literal escaping can
    // be emulated by escaping the metacharacters — and BOTH are this row inventing
    // a mapping the host does not own, i.e. a semantic expansion of the frozen
    // argv. The refusal form costs no new semantics and is the same shape as the
    // `context`/`multiline` refusals above, so it is what this row does until the
    // host's own vocabulary grows an arm (then the mapping belongs to the host,
    // and this row picks it up through `buildGrepCommand` without changing).
    if (parsed.fixedString === true) {
      observe(`anchored-search REFUSED fixed-string-unsupported call=${safeToken(call?.callId)}`)
      return failure('denied', 'fixed-string-unsupported', {}, debug)
    }
    if (parsed.ignoreCase === true) {
      observe(`anchored-search REFUSED ignore-case-unsupported call=${safeToken(call?.callId)}`)
      return failure('denied', 'ignore-case-unsupported', {}, debug)
    }
    const placement = String(parsed.target?.placement ?? '')
    if (!SEARCH_PLACEMENTS.includes(placement)) {
      observe(`anchored-search REFUSED placement-unsupported call=${safeToken(call?.callId)} placement=${safeToken(placement)}`)
      return failure('denied', 'placement-unsupported', {}, debug, `placement=${safeToken(placement)}`)
    }
    // The host's own public argument law as a SECOND gate: the lane already
    // parsed strictly, and this keeps the pattern/filter vocabulary single-owned.
    try {
      parseGrepArgs({
        pattern: parsed.pattern,
        ...(typeof parsed.globFilter === 'string' && parsed.globFilter.length > 0 ? { include: parsed.globFilter } : {}),
      })
    } catch (error) {
      return failure('denied', 'pattern-invalid', {}, debug, String(error?.message ?? error))
    }
    if (rgPath === null) {
      try {
        rgPath = await resolveRgPath()
      } catch (error) {
        return failure('undetermined', 'rg-unavailable', {}, debug, String(error?.message ?? error))
      }
    }
    if (callAborted(cancelSignal)) return await cancelRefusal('after-rg-path')
    if (probed === null) {
      probed = await provider.probe()
      if (probed.ok !== true) {
        trace = ['probe', 'terminate']
        observe(`anchored-search capability REFUSED realm=${safeToken(realmId)} code=${safeToken(probed.error?.code)}`)
        return failure('denied', 'confined-unavailable', {}, debug, `probe code=${safeToken(probed.error?.code)}`)
      }
      observe(`anchored-search capability OK realm=${safeToken(realmId)} legs=${String(probed.value.length)}`)
    }
    if (callAborted(cancelSignal)) return await cancelRefusal('after-capability')

    // ---- A1/A2: anchor BEFORE the child exists; a refusal costs no process ---
    // A directory target anchors at itself and carries the constant `.`; a FILE
    // target anchors at its PARENT directory and carries its own name (the
    // disclosed residuum), verified under that anchor before the spawn.
    const locator = typeof parsed.target?.locator === 'string' ? parsed.target.locator : ''
    let anchor = await openAnchoredWalkRoot(rootDir, { placement, locator }, debug)
    let fileTarget = null
    if (anchor.ok !== true && anchor.failure?.code === 'not-a-directory') {
      const trimmed = locator.replace(/\/+$/, '')
      const cut = trimmed.lastIndexOf('/')
      const name = cut < 0 ? trimmed : trimmed.slice(cut + 1)
      const parent = cut <= 0 ? (trimmed.startsWith('/') ? '/' : '.') : trimmed.slice(0, cut)
      if (name.length === 0) return mapSharedLaw(anchor, debug)
      const parentPlacement = parent.startsWith('/') ? 'absolute-path' : placement
      anchor = await openAnchoredWalkRoot(rootDir, { placement: parentPlacement, locator: parent }, debug)
      if (anchor.ok !== true) return mapSharedLaw(anchor, debug)
      fileTarget = name
    } else if (anchor.ok !== true) {
      trace = ['probe', 'terminate']
      observe(`anchored-search refused code=${safeToken(anchor.failure?.code)} call=${safeToken(call?.callId)} realm=${safeToken(realmId)}`)
      return mapSharedLaw(anchor, debug)
    }
    if (anchor.ok !== true) return mapSharedLaw(anchor, debug)
    // A cancel landing while the anchor is being taken is honoured BEFORE the
    // spawn, and the one resource this call already holds — the pinned
    // descriptor — goes back before the terminal is handed up. No child was ever
    // adopted, so the owned stop settles as never-spawned: the stopped-confirmed
    // form is the honest one here, not an unconfirmed-stop claim.
    if (callAborted(cancelSignal)) {
      await anchor.handle.close().catch(() => undefined)
      return await cancelRefusal('after-anchor')
    }
    const searchElement = fileTarget ?? SEARCH_WALK_PATH_ELEMENT

    // A4 for the file case, BEFORE the spawn: the one object this walk is about
    // is proven a real non-symlink file inside the pinned anchor.
    if (fileTarget !== null) {
      const one = await verifyGlobResultsBeneath(anchor, [fileTarget], debug)
      if (one.ok !== true) {
        await anchor.handle.close().catch(() => undefined)
        trace = ['probe', 'anchor-refused']
        observe(`anchored-search file-refused code=${safeToken(one.failure?.code)} call=${safeToken(call?.callId)}`)
        return mapSharedLaw(one, debug)
      }
      if (callAborted(cancelSignal)) {
        await anchor.handle.close().catch(() => undefined)
        return await cancelRefusal('after-target-verify')
      }
    }

    trace = ['probe', 'prepare', 'execute']
    // The boundary the row books WHEN IT CONSULTS ITS CHANNEL at the last step
    // before it would ask for a child, and only for a call that carries a cancel
    // channel (a call without one books exactly what it booked before — this line
    // is part of the leg, not of the walk). The word names the instruction, not an
    // intention: the row is ASKING its channel here, and that stays true whichever
    // way the answer goes, so a refusal below never leaves behind an audit claim
    // that this row was going to spawn. Being booked one instruction before the
    // final check is what makes "the cancel landed at the last boundary before the
    // provider was asked" a fact a test can pin; the answer to it is a refusal that
    // costs zero provider work.
    if (cancelSignal !== undefined && cancelSignal !== null) {
      observe(`anchored-search cancel-leg stage=pre-spawn-check realm=${safeToken(realmId)} call=${safeToken(call?.callId)}`)
    }
    // THE LAST BOUNDARY BEFORE THE SPAWN. A cancel landing here still costs zero
    // provider work: no plan, no child, no byte of output, no sink write.
    if (callAborted(cancelSignal)) {
      await anchor.handle.close().catch(() => undefined)
      return await cancelRefusal('pre-spawn')
    }
    const rgBinDir = rgPath.slice(0, rgPath.lastIndexOf('/'))
    const argv = [rgPath, ...searchArgv(parsed, searchElement)]
    const request = {
      grantFingerprint: `a5srgp:${realmId}:${templateId}:${String(call.callId)}`,
      realmId,
      bindingId: `a5srgp-search:${templateId}`,
      memberScope: instanceId,
      argv,
      // The anchored directory. The walk rides the child's cwd, which the
      // launcher sets before its own self-lock, so the string never re-enters
      // argv — and for a directory target no path string exists to re-enter.
      cwd: anchor.anchorPath,
      env: [['PATH', '/usr/bin:/bin']],
      allowPaths: [
        SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
        ...(hasLib64() ? [SYSTEM_RX('/lib64')] : []),
        SYSTEM_RX(rgBinDir),
        { path: anchor.rootReal, accessBits: { readFile: true, readDir: true } },
      ],
    }
    let handle
    try {
      handle = await provider.spawnStreaming(request)
    } catch (error) {
      await anchor.handle.close().catch(() => undefined)
      trace = [...trace, 'terminate']
      return failure('undetermined', 'spawn-failed', {}, debug, `code=${safeToken(error?.code)}`)
    }
    if (handle.ok !== true) {
      await anchor.handle.close().catch(() => undefined)
      trace = ['probe', 'prepare', 'terminate']
      observe(`anchored-search spawn REFUSED realm=${safeToken(realmId)} code=${safeToken(handle.error?.code)}`)
      return failure('denied', 'confined-refused', {}, debug, `spawn code=${safeToken(handle.error?.code)}`)
    }
    executed += 1
    const child = handle.value
    // THE ADOPTION LAW: a handle this call caused to exist is owned the instant
    // it exists — including the case where the caller gave up while
    // `spawnStreaming` was still awaiting. A `Promise.race` that had let the
    // cancel win the spawn await would have thrown this handle away with the
    // payload live; this row awaits the promise to its end, adopts what came
    // back, and the ONE owned terminate below is what stops it.
    owned.adopt(child)
    // The second boundary the row books for a channel-carrying call: the child
    // EXISTS and this call owns it. Like `pre-spawn` above it is part of the
    // cancel leg, not of the walk — a call with no channel books nothing new —
    // and it is what turns "the cancel landed while the payload was live" into a
    // fact a test can pin instead of a timing bet.
    if (cancelSignal !== undefined && cancelSignal !== null) {
      observe(`anchored-search cancel-leg stage=child-live realm=${safeToken(realmId)} call=${safeToken(call?.callId)}`)
    }
    // THE STDIN LAW (measured): fd 0 inside the child is a socket, so rg's
    // heuristic can replace the walk with an empty stdin search. The explicit
    // `-- <path>` element above already prevents that; this closes the channel
    // anyway, before a single byte of the grant is live.
    try { child.stdin.end() } catch { /* already closed: the path element rules */ }
    // THE UNIFIED RELEASE of everything this block attaches to the child's pipes.
    // It is a slot installed the instant the listeners are attached and called
    // from the `finally` at the end of this block, so EVERY exit gives them back:
    // the cancel arms, an early failure return, an unexpected fault, and the
    // admitted path too (whose streams have ended by then, so the release is
    // invisible there — what it removes is the row's ability to leak a listener
    // down a path nobody thought about). Idempotent by construction, and a no-op
    // for an exit that happens before anything is attached.
    let releaseStreamListeners = () => {}
    try {
      // The first boundary after the adoption: the payload is stopped through
      // the owned terminate BEFORE this row says anything about the call.
      if (callAborted(cancelSignal)) return await cancelRefusal('after-spawn')
      let stdout = ''
      let stderr = ''
      let overflow = false
      const onStdoutData = (chunk) => {
        // NO CHANNEL IS WRITTEN HERE. The bytes arriving from the child are
        // unverified until the verdict below admits them, and the spill channel
        // is a channel like any other: writing it as it arrives would let a
        // search refused a moment later leak its raw rows into spill.
        const text = String(chunk)
        if (stdout.length + text.length <= walkBufferBytes) stdout += text
        else overflow = true
      }
      const onStderrData = (chunk) => {
        // Bounded, like every other buffer: the diagnostic channel cannot be
        // turned into a memory channel by a chatty walker.
        if (stderr.length < SEARCH_MAX_STDERR_BYTES) stderr += String(chunk)
      }
      child.stdout.on('data', onStdoutData)
      child.stderr.on('data', onStderrData)
      // THE DRAIN WATCH (u7 grep-drain), installed BEFORE the settle race so a
      // terminal event that arrives first is never missed. `exited` is the
      // launcher's 'exit', and Node may fire it while 'data' callbacks are still
      // pending: a verdict read at `exited` judges a walk this row has not heard
      // to its end — the hosted P8 red (late `regex parse error` read as the
      // generic `walker-error`), and on the coverage law a FALSE ADMIT (a late
      // `Permission denied` line missed, a partial walk answered as complete).
      const stdoutDrain = watchStreamEnd(child.stdout)
      const stderrDrain = watchStreamEnd(child.stderr)
      // Listener release, and LAST in the release order: the terminate of the
      // payload is what has to be confirmed first (the pipes are held by the
      // living child), the pinned descriptor goes back in the `finally`, and
      // nothing holds the caller's channel past the settle race itself.
      releaseStreamListeners = () => {
        releaseStreamListeners = () => {} // idempotent: the `finally` may call it again
        try { child.stdout.off('data', onStdoutData) } catch { /* already torn down */ }
        try { child.stderr.off('data', onStderrData) } catch { /* already torn down */ }
        try { stdoutDrain.release() } catch { /* already torn down */ }
        try { stderrDrain.release() } catch { /* already torn down */ }
      }
      const exit = await raceConfinedSettle({ exited: child.exited, timeoutMs, signal: cancelSignal })
      // THE ONE TERMINATE, read by whoever is owed the answer. The ARM is the same
      // single owned call either way (`owned` memoizes it); what differs is the
      // READING, and that is a deliberate asymmetry:
      //  - A call nobody cancelled keeps this row's own contract, unchanged since
      //    before this leg existed: `await owned.rawStop()` hands back the very
      //    promise `await child.terminate()` used to be, so a lease arm that throws
      //    still lands in `run`'s catch and answers `internal-error`. The cancel
      //    leg does not get to soften a fault on a path where nobody cancelled —
      //    swallowing it here would turn a broken lease arm into a walk that
      //    carries on to the sink.
      //  - A call the caller DID withdraw from reads the classified stop, which
      //    cannot throw and whose only two answers are 'the provider confirmed the
      //    stop' and 'it did not'. A throwing arm on THAT path is the second one:
      //    the throw's own text never reaches the answer.
      const cancelled = callAborted(cancelSignal)
      const timedOut = exit?.timedOut === true
      if (cancelled && !timedOut) await owned.stop()
      else {
        // THE OLD CONTRACT, HELD IN BOTH DIRECTIONS. The timeout winner takes the
        // raw arm even when the caller has already withdrawn: swallowing a fault
        // there would be this leg inventing a success shape the row never had. On
        // any OTHER winner, a fault that arrives while the caller is withdrawing is
        // an answer the caller is owed — and it is read through the SAME settled
        // arm (`owned.stop()` derives from the promise that just rejected, so no
        // second terminate is ever issued) and says 'termination-unconfirmed'.
        // A fault on a call nobody withdrew from is rethrown untouched, exactly as
        // `await child.terminate()` did before this leg existed.
        try {
          await owned.rawStop()
        } catch (fault) {
          if (timedOut || !callAborted(cancelSignal)) throw fault
          await owned.stop()
        }
      }
      trace = [...trace, 'terminate']
      if (timedOut) {
        observe(`anchored-search TIMEOUT realm=${safeToken(realmId)} call=${safeToken(call.callId)}`)
        return {
          ok: true,
          outcome: { outputMode: parsed.outputMode ?? 'content', matches: [], counts: [], files: [], totalMatches: 0, truncated: false },
          settlement: { kind: 'cancelled', event: 'search-walk-terminated-after-timeout' },
        }
      }
      // THE DRAIN, after the owned terminate (the provider's pipes are held by the
      // supervised child, so 'end' cannot be promised while it lives — the glob
      // row's measured law) and only on the path that is about to judge the walk:
      // the timeout arm above and the cancel arm below make no claim about the
      // tree, so they never wait for it. BOUNDED by the glob row's own measured
      // constant (`./stream-drain.mjs`). The channel ask right below is the
      // boundary after this await, so a withdrawal during the drain is still
      // answered as the cancellation it is.
      const drained = cancelled ? null : await awaitBounded(Promise.all([stdoutDrain.ended, stderrDrain.ended]), STREAM_DRAIN_MS)
      if (cancelled || callAborted(cancelSignal)) {
        // Either the abort won the race (the walk was stopped, it did not finish)
        // or it landed DURING the stop await just above — which is an await like
        // any other, so it gets a boundary of its own rather than being allowed to
        // slip through to the verdict. The answer is THIS row's cancel refusal,
        // carrying what the owned terminate actually reported — and never the
        // timeout arm's `ok: true` empty result above, which would read as "the
        // tree holds nothing" when in fact nobody looked at the tree.
        return await cancelRefusal(exit?.aborted === true ? 'walk-aborted' : 'after-settle')
      }
      // The provider's settled shape is `{ code, signal }` with signal the EMPTY
      // STRING on a normal exit (measured: {"code":0,"signal":""}) — treating
      // `""` as a signal would refuse every successful search.
      const signal = typeof exit?.signal === 'string' && exit.signal.length > 0 ? exit.signal : null
      const launcherCode = typeof exit?.code === 'number' ? exit.code : null
      const stderrText = stderr.trim().slice(0, SEARCH_MAX_STDERR_BYTES)
      if (overflow) {
        observe(`anchored-search OUTPUT-TOO-LARGE realm=${safeToken(realmId)} call=${safeToken(call.callId)} budget=${String(walkBufferBytes)}`)
        return failure('undetermined', 'output-too-large', { budget: walkBufferBytes }, debug, 'the search exceeded the buffered budget')
      }
      if (signal !== null || launcherCode === null) {
        observe(`anchored-search KILLED realm=${safeToken(realmId)} call=${safeToken(call.callId)} signal=${safeToken(signal)}`)
        return failure('undetermined', 'walker-error', { killed: 1 }, debug, `signal=${safeToken(signal)}`)
      }
      if (launcherCode !== 0) {
        // The ONLY thing a non-zero code can mean here: the launcher itself
        // failed (its own refusal/exec classes). It is never the walker's
        // verdict — see the completion law below.
        observe(`anchored-search LAUNCHER-ERROR realm=${safeToken(realmId)} call=${safeToken(call.callId)} code=${String(launcherCode)}`)
        return failure('undetermined', 'walker-error', { launcher: launcherCode }, debug, `launcher code=${String(launcherCode)}`)
      }
      // THE DRAIN VERDICT. A walk is judged only once BOTH streams were heard to
      // their 'end': a bound that expired, a pipe torn down without an 'end'
      // ('close'), or a dead one ('error') leaves the stdout record stream or the
      // stderr coverage/pattern speech possibly short, and this row's completion
      // law cannot be established over a channel it did not hear out. TYPED
      // refusal on the existing table entry, NEVER a success — a missed
      // `Permission denied` line is exactly the partial walk the coverage law
      // exists to refuse. No code is added to the frozen table.
      const stdoutForm = drained === null ? 'pending' : drained[0]
      const stderrForm = drained === null ? 'pending' : drained[1]
      if (stdoutForm !== 'end' || stderrForm !== 'end') {
        observe(`anchored-search DRAIN-INCOMPLETE realm=${safeToken(realmId)} call=${safeToken(call.callId)} stdout=${safeToken(stdoutForm)} stderr=${safeToken(stderrForm)} boundMs=${String(STREAM_DRAIN_MS)}`)
        return failure('undetermined', 'walker-error', { drainIncomplete: 1, outBytes: stdout.length, stderrBytes: stderr.length }, debug, `streams not drained stdout=${stdoutForm} stderr=${stderrForm}`)
      }
      // THE COMPLETION LAW — why an exit code is not this row's discriminator.
      // The confined face does NOT carry the payload's exit status: the
      // pre-launcher supervises the child, records its rc in its own
      // bookkeeping, and `sys.exit(0)`s regardless — measured by leg `P8b`
      // (`/bin/sh -c 'exit 7'` settles `{code: 0}` through this face). So a law that read `exit 2` as "ripgrep errored"
      // would be reading the LAUNCHER and seeing success forever. What the face
      // DOES carry is the protocol: a `--json` walk that ran to completion
      // always ends with a `summary` record — measured on a zero-match walk and
      // on a walk of an absent target (both emit the summary), while a walk
      // ripgrep refused to start emits NOTHING at all (zero bytes, and the
      // reason on stderr). Completion is therefore PROVED, never assumed:
      //   no summary record   -> the walker never completed -> typed refusal,
      //                           classified by the host's own stderr rule and
      //                           carried as a CODE + byte counts (A8: the
      //                           walker's sentence is enumeration data).
      //   summary present     -> the walk completed; its records are the answer,
      //                        including the empty answer (the exit-1 class of
      //                        the unconfined host, which this face reports as
      //                        a completed walk with zero match records).
      if (!stdout.includes('"type":"summary"')) {
        const incompleteCode = classifyWalkerStderr(stderrText)
        observe(`anchored-search WALKER-INCOMPLETE realm=${safeToken(realmId)} call=${safeToken(call.callId)} code=${safeToken(incompleteCode)} stderrBytes=${String(stderrText.length)}`)
        return failure('undetermined', incompleteCode, { stderrBytes: stderrText.length, outBytes: stdout.length }, debug, `stderr=${stderrText}`)
      }
      // ---- coverage: a completed walk that read nothing may not answer empty --
      const coverage = walkerCoverageRefusal(stderrText)
      if (coverage !== null) {
        observe(`anchored-search COVERAGE-REFUSED realm=${safeToken(realmId)} call=${safeToken(call.callId)} stderrBytes=${String(stderrText.length)} records=${String(stdout.length)}`)
        return failure('undetermined', coverage, { stderrBytes: stderrText.length, outBytes: stdout.length }, debug, `stderr=${stderrText}`)
      }
      const code = launcherCode
      // ---- the record stream: the host's own reader, nothing else -----------
      let records
      try {
        records = [...parseGrepMatches(stdout)]
      } catch (error) {
        // `SEARCH_FAILED` is the host's uniform malformed-output fault. Its
        // sentence never travels (A8): only the fact that the protocol broke.
        observe(`anchored-search PROTOCOL realm=${safeToken(realmId)} call=${safeToken(call.callId)} code=${safeToken(error?.code)}`)
        return failure('undetermined', 'protocol-error', {}, debug, String(error?.message ?? error))
      }
      // ---- A3, BOTH arms, for BOTH target kinds -----------------------------
      // (1) the row's own arm: the pinned view still resolves inside the governed
      // root and the anchor is still the inode the walk ran under — the arm that
      // notices an object removed under the walk;
      // (2) the SHARED law, with the file target's own name or the EMPTY list for
      // a directory target, which additionally re-checks that the governed ROOT the
      // anchor was taken under is still the same object — the arm an anchor-inode
      // check cannot see, and the one a directory target used to skip entirely
      // (review finding this round: legs `V11` / `V11b` measure that each arm
      // catches a case the other misses, which is why both run).
      const recheck = await verifyAnchorStillGoverned(anchor)
      // THE BOUNDARY IMMEDIATELY AFTER THIS AWAIT, and it comes BEFORE the verdict
      // branch: a withdrawal that landed during the verification is answered here
      // rather than behind a failure the row was about to return anyway. The
      // verdict still stands for a call nobody withdrew from — this check only
      // reorders WHO answers, never WHAT the walk proved.
      if (callAborted(cancelSignal)) return await cancelRefusal('after-governed-recheck')
      if (recheck.verdict !== 'confirmed') {
        observe(`anchored-search exec-refused:${safeToken(recheck.verdict)} realm=${safeToken(realmId)} call=${safeToken(call.callId)}`)
        return recheck.verdict === 'escape'
          ? failure('denied', 'exec-time-escape', {}, debug, String(recheck.detail))
          : recheck.verdict === 'drift'
            ? failure('denied', 'anchor-drift', { records: records.length }, debug, String(recheck.detail))
            : failure('undetermined', 'anchor-unverifiable', {}, debug, String(recheck.detail))
      }
      const shared = await verifyGlobResultsBeneath(anchor, fileTarget === null ? [] : [fileTarget], debug)
      // Same law on the second verification leg: ask the channel before the row
      // hands up the shared law's own refusal.
      if (callAborted(cancelSignal)) return await cancelRefusal('after-shared-law')
      if (shared.ok !== true) {
        observe(`anchored-search exec-refused:${safeToken(shared.failure?.code)} realm=${safeToken(realmId)} call=${safeToken(call.callId)}`)
        return mapSharedLaw(shared, debug)
      }
      // THE BOUNDARY AFTER THE VERIFICATION AWAITS. Both governed-root checks above
      // awaited, so a cancel that landed while they ran is answered HERE, before
      // the projection, the rendering and the spill decision — not only at the
      // sink. Two boundaries on this stretch is the point: the one after the awaits
      // catches the withdrawal as early as the code allows, and the one below is
      // the last word before the answer exists.
      if (callAborted(cancelSignal)) return await cancelRefusal('after-verify')
      const projected = projectMatches(records, parsed.outputMode ?? 'content', parsed.maxResults, (p) => presentPath(anchor, p))
      if (projected.ok !== true) {
        observe(`anchored-search ${safeToken(projected.code)} realm=${safeToken(realmId)} call=${safeToken(call.callId)} records=${String(records.length)}`)
        return failure('denied', projected.code, { records: records.length }, debug)
      }
      const text = renderRows(projected.rows, projected.outcome.outputMode)
      // THE LAST BOUNDARY BEFORE THE ANSWER EXISTS. A cancel that landed while
      // the verdict and both verification legs were running does not rewrite the
      // settle race's winner (the walk DID finish) — it prevents the
      // publication: no sink byte, no spill, no result, and the terminal is this
      // row's cancel refusal carrying what the owned stop reported (the stop
      // settled with the walk, so asking again costs no second terminate). After
      // the write below there is no retroactive arm: what was admitted is the
      // answer, exactly as the pre-existing spill law has always had it.
      if (callAborted(cancelSignal)) return await cancelRefusal('before-commit')
      // C-SPILL: the ONLY sink write in this module, after the verdict, from the
      // admitted rows. A refused search writes zero bytes; an admitted one writes
      // precisely what it admits.
      // NOTE on the release order: what this row attached to the child's pipes is
      // given back once, by the `finally` at the end of this block, after the payload
      // was stopped and confirmed — on every path, the admitted one included. No arm
      // releases by hand any more.
      if (text.length > 0) io?.sink?.write(text)
      trace = [...trace, 'terminate']
      lastRuns.push({
        callId: call.callId,
        argv: argv.map((a) => (a === rgPath ? '<rg>' : a)).join(' '),
        exit: code,
        records: records.length,
        totalMatches: projected.outcome.totalMatches,
      })
      observe(`anchored-search OK realm=${safeToken(realmId)} call=${safeToken(call.callId)} records=${String(records.length)} total=${String(projected.outcome.totalMatches)} truncated=${String(projected.outcome.truncated === true)}`)
      return { ok: true, outcome: projected.outcome, settlement: { kind: 'completed' } }
    } finally {
      // THE RELEASE ORDER of the cancel law, on every path: the payload is
      // stopped first (the arms above read the provider's confirmation before
      // they answer), then the pipes this row attached are given back, and the
      // pinned descriptor goes last.
      releaseStreamListeners()
      await anchor.handle.close().catch(() => undefined)
    }
  }
}
