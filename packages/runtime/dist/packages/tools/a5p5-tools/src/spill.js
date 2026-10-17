/**
 * `a5p5-tools` Phase 2 — SPILL semantics: the controlled-path life of large
 * tool output inside the World (task slice ①; plan §8 "Spill 可正确归属且被
 * 读取时复核权限"; S0 D-4: the Adapter self-manages spill — the native
 * post-execute identity path of S-09 is deliberately NOT relied on).
 *
 * THE FOUR LAWS (each pinned by `test/a5p5-spill.test.ts`):
 *
 *  1. WORLD-BOUND CONTROLLED PATH. Every byte lands under a `rootDir` that is
 *     a STRICT descendant of the injected `worldRoot` (segment-law, `..`
 *     refused BEFORE any collapse — the same pre-collapse refusal as
 *     `args.ts`). A forged spillId (separators, `..`, absolutes, NUL, blank,
 *     over-length) is a typed refusal with ZERO port calls: refuse before
 *     touch, never "write then filter".
 *  2. LEASE-SHAPED LIFECYCLE (INTERFACES-v1.md C-GW): the closed states are
 *     ACTIVE → DRAINING → CLOSED; the ACTIVE→DRAINING edge is the ONE settled
 *     edge, and from DRAINING on every NEW write is typed-refused (the bytes
 *     already settled stay exactly as they were).
 *  3. RESIDUE NEVER VANISHES SILENTLY. Enumeration reads the DISK, not
 *     memory: residue of a cancelled or torn-down call is listed by a FRESH
 *     store handle with attribution and settlement class intact — and an
 *     ORPHAN file (no meta at all) is still enumerated, as unattributed.
 *     Cleanup is the explicit, listed alternative; after it a read is a
 *     typed `spill-missing` refusal, never silence (C-FS: hidden-read 永不
 *     静默 — the typed error classes here are exactly the C-FS triad
 *     denied/hidden/undetermined).
 *  4. READ RE-CHECKS AUTHORIZATION (S0 D-4). `readSpill` asks the INJECTED
 *     authorizer before any payload I/O; the lane decides nothing itself — it
 *     consumes a verdict, mirroring the C-ADM read-time law with no second
 *     authorization fact.
 *
 * The cancellation/settlement event vocabulary is the C-BIND v1.1 pin — the
 * six PR1r event names VERBATIM AS EMITTED by the merged dispatcher
 * (v1.1 勘正, integration wiring round): the master@452a04c0 emission face
 * carries the `dispatcher-call-` prefix on ALL SIX names
 * (`tool-dispatch/install.ts:651,662,673,686,763`); the mixed full/short
 * transcription in the pre-erratum INTERFACES line is superseded. Normal
 * completion is the one non-cancelled settlement. The delivery semantics of
 * these names ride the dispatcher's own channel — this lane only validates
 * the NAME at a settlement it was given; nothing here makes any statement
 * about that channel's delivery behaviour (PENDING-GATES G-g OPEN).
 *
 * Purity: no `node:*`, no I/O, no clock — all disk contact goes through the
 * injected `SpillFsPort`; the tests provide the `node:fs` adapter.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/spill
 */
import { deepFreezeContracts } from '../../../domain/tool-governance/src/parse-util.js';
/** C-GW lease-shape states, in transition order. */
export const SPILL_LEASE_STATES = ['active', 'draining', 'closed'];
/**
 * The C-BIND v1.1 PR1r cancellation event names — VERBATIM as the merged
 * dispatcher emits them (v1.1 勘正: all six carry the `dispatcher-call-`
 * prefix at master@452a04c0; closed set).
 */
export const SETTLEMENT_EVENTS = [
    'dispatcher-call-cancelled-before-body',
    'dispatcher-call-terminated-after-body-start',
    'dispatcher-call-completed-after-abort',
    'dispatcher-call-outcome-unreadable',
    'dispatcher-call-cancelled-by-others',
    'dispatcher-call-executed-unvalidated',
];
/** The C-FS typed-error triad (denied/hidden/undetermined) — closed set. */
export const SPILL_ERROR_CLASSES = ['denied', 'hidden', 'undetermined'];
/** The closed refusal vocabulary of this module. */
export const SPILL_REFUSAL_CODES = [
    'spill-root-outside-world',
    'spill-id-invalid',
    'spill-id-in-use',
    'spill-write-after-drain',
    'spill-write-after-close',
    'spill-settled-twice',
    'spill-settlement-event-unknown',
    'spill-close-without-settle',
    'spill-finalize-before-settle',
    'spill-finalized-twice',
    'spill-read-denied',
    'spill-missing',
];
const refuse = (code, detail, cls = 'denied') => ({
    ok: false,
    refusal: { code, detail, class: cls },
});
const SPILL_SUFFIX = '.spill';
const META_SUFFIX = '.spill.meta';
const MAX_SPILL_ID_LENGTH = 128;
const SPILL_ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
function validSpillId(spillId) {
    if (typeof spillId !== 'string' || spillId.length === 0)
        return { code: 'spill-id-invalid', class: 'denied', detail: 'a spill id must be a non-empty string' };
    if (spillId.length > MAX_SPILL_ID_LENGTH)
        return { code: 'spill-id-invalid', class: 'denied', detail: `a spill id is bounded at ${MAX_SPILL_ID_LENGTH} characters` };
    if (spillId.includes('..'))
        return { code: 'spill-id-invalid', class: 'denied', detail: 'a spill id may not carry a .. walk' };
    if (!SPILL_ID_SHAPE.test(spillId))
        return { code: 'spill-id-invalid', class: 'denied', detail: 'a spill id is [A-Za-z0-9][A-Za-z0-9._-]* — no separators, no absolutes, no control or blank bytes' };
    return null;
}
/** Segment law, refused BEFORE collapse: absolute, no `.`, no `..`. */
function pathSegments(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('/'))
        return null;
    const parts = raw.split('/');
    const out = [];
    for (const part of parts) {
        if (part === '' || part === '.')
            continue;
        if (part === '..')
            return null;
        out.push(part);
    }
    return out;
}
function joinUnder(root, name) {
    return `${root.endsWith('/') ? root.slice(0, -1) : root}/${name}`;
}
export function createSpillLease() {
    let state = 'active';
    let settled = null;
    return deepFreezeContracts({
        state: () => state,
        settlement: () => settled,
        settle(next) {
            if (state !== 'active')
                return refuse('spill-settled-twice', `the lease is already ${state}; the settled edge is single (C-GW)`);
            if (next.kind === 'cancelled' && !SETTLEMENT_EVENTS.includes(next.event))
                return refuse('spill-settlement-event-unknown', 'the cancellation event must be one of the six dispatcher-call-* names verbatim (v1.1 勘正: emission-face full names)');
            state = 'draining';
            settled = next;
            return { ok: true };
        },
        close() {
            if (state === 'active')
                return refuse('spill-close-without-settle', 'close is legal only across the settled edge (ACTIVE→DRAINING→CLOSED)');
            state = 'closed';
            return { ok: true };
        },
    });
}
export function openSpillStore(deps) {
    const world = pathSegments(deps.worldRoot);
    const root = pathSegments(deps.rootDir);
    if (world === null || root === null) {
        return refuse('spill-root-outside-world', 'worldRoot and rootDir must be absolute POSIX-style paths with no . or .. segments (refused before collapse)');
    }
    const strictDescendant = root.length > world.length && world.every((segment, i) => root[i] === segment);
    if (!strictDescendant) {
        return refuse('spill-root-outside-world', 'the spill root must be a STRICT descendant of the world root — the controlled path lives inside the World');
    }
    const rootFull = `/${root.join('/')}`;
    const registry = new Map();
    const spillPath = (spillId) => joinUnder(rootFull, `${spillId}${SPILL_SUFFIX}`);
    const metaPath = (spillId) => joinUnder(rootFull, `${spillId}${META_SUFFIX}`);
    function readMeta(spillId) {
        if (!deps.fs.exists(metaPath(spillId)))
            return null;
        try {
            const raw = JSON.parse(deps.fs.readText(metaPath(spillId)));
            return { attribution: raw.attribution ?? null, settlement: raw.settlement ?? null };
        }
        catch {
            return { attribution: null, settlement: null }; // a corrupt meta is UNATTRIBUTED, never an excuse to skip the residue
        }
    }
    const store = {
        openSink({ spillId, lease, attribution }) {
            const bad = validSpillId(spillId);
            if (bad)
                return { ok: false, refusal: bad }; // ZERO port calls: refuse before touch
            // Lane D ② (wiring gate): a spillId already on disk (payload OR meta) is
            // NOT re-openable. Re-opening used to rewrite the meta with
            // `settlement: null` — erasing a finalized record's terminal fact — and
            // appended onto the existing payload (append-penetration). A caller who
            // lost its sink reads through `readSpill` (authorization re-checked),
            // never through a fresh sink. Typed refusal before any port call.
            if (deps.fs.exists(spillPath(spillId)) || deps.fs.exists(metaPath(spillId))) {
                return refuse('spill-id-in-use', `spill ${spillId} already exists on disk — a settled record is read through readSpill, never re-opened for append`);
            }
            deps.fs.ensureDir(rootFull);
            deps.fs.writeFile(metaPath(spillId), JSON.stringify({ attribution, settlement: null }));
            registry.set(spillId, attribution);
            let bytes = 0;
            let finalized = false;
            return {
                ok: true,
                sink: deepFreezeContracts({
                    spillId,
                    bytes: () => bytes,
                    write(chunk) {
                        const state = lease.state();
                        if (state === 'draining')
                            return refuse('spill-write-after-drain', `spill ${spillId}: new writes are refused from the settled edge on (DRAINING)`);
                        if (state === 'closed')
                            return refuse('spill-write-after-close', `spill ${spillId}: the lease is closed`);
                        deps.fs.appendFile(spillPath(spillId), chunk);
                        bytes += chunk.length;
                        return { ok: true, bytes };
                    },
                    finalize(settlement) {
                        if (lease.state() === 'active')
                            return refuse('spill-finalize-before-settle', 'the terminal fact of a residue is recorded only across the settled edge');
                        if (finalized)
                            return refuse('spill-finalized-twice', `spill ${spillId} is already finalized`);
                        finalized = true;
                        deps.fs.writeFile(metaPath(spillId), JSON.stringify({ attribution, settlement }));
                        return { ok: true };
                    },
                }),
            };
        },
        listResidue() {
            const names = deps.fs.list(rootFull);
            const ids = new Set();
            for (const name of names) {
                if (name.endsWith(META_SUFFIX))
                    ids.add(name.slice(0, -META_SUFFIX.length));
                else if (name.endsWith(SPILL_SUFFIX))
                    ids.add(name.slice(0, -SPILL_SUFFIX.length));
            }
            const entries = [];
            for (const spillId of [...ids].sort()) {
                const meta = readMeta(spillId);
                const hasFile = deps.fs.exists(spillPath(spillId));
                entries.push(deepFreezeContracts({
                    spillId,
                    bytes: hasFile ? deps.fs.sizeBytes(spillPath(spillId)) : 0,
                    attribution: meta?.attribution ?? registry.get(spillId) ?? null,
                    settlement: meta?.settlement ?? null,
                }));
            }
            return deepFreezeContracts(entries);
        },
        cleanupResidue() {
            const names = [...deps.fs.list(rootFull)].sort();
            const removed = [];
            for (const name of names) {
                deps.fs.remove(joinUnder(rootFull, name));
                removed.push(name);
            }
            registry.clear();
            return { removed };
        },
        readSpill(spillId, authorize) {
            const bad = validSpillId(spillId);
            if (bad)
                return { ok: false, refusal: bad };
            // Read-time re-check BEFORE any payload I/O (S0 D-4): the lane consumes
            // a verdict it did not mint; a deny counts zero payload reads.
            const verdict = authorize(registry.get(spillId) ?? null);
            if (!verdict.allow)
                return refuse('spill-read-denied', `authorization at read time refused spill ${spillId}: ${verdict.detail}`);
            if (!deps.fs.exists(spillPath(spillId)))
                return refuse('spill-missing', `spill ${spillId} has no payload file (cleaned up, or never written)`, 'undetermined');
            return deepFreezeContracts({ ok: true, text: deps.fs.readText(spillPath(spillId)), attribution: registry.get(spillId) ?? readMeta(spillId)?.attribution ?? null });
        },
    };
    return { ok: true, store };
}
//# sourceMappingURL=spill.js.map