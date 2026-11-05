/**
 * Alpha.6 — a FILE-BACKED `ReviewWakeIntentStore` (one durable row per latch).
 *
 * This is the production-shaped implementation of the existing narrow port:
 * `persistQueued` writes the row BEFORE delivery, `markAccepted` records Inbox
 * acceptance, `clear` removes it, and `read` answers the row (or `null`).
 * Writes are atomic (temp file + rename) so a crash leaves either the old row
 * or the new one, never a torn JSON document.
 *
 * It is NOT a second ledger: the row carries only latch identity, wakeId and
 * work fingerprint — no decision, no authority, no payload.
 *
 * @module packages/runtime/alpha6/wake-intent-store
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
function isRow(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const row = value;
    const key = row['key'];
    if (typeof key !== 'object' || key === null)
        return false;
    const k = key;
    return (typeof k['rootSessionId'] === 'string' &&
        typeof k['reviewerInstanceId'] === 'string' &&
        typeof k['sessionGeneration'] === 'number' &&
        typeof row['wakeId'] === 'string' &&
        typeof row['workFingerprint'] === 'string' &&
        (row['status'] === 'queued' || row['status'] === 'accepted'));
}
/**
 * Per-file mutation gate. The notifier dispatch and the turn-end release are
 * fire-and-forget siblings in ONE Host process; without this, their
 * read-modify-write pairs (markAccepted / clear / persistQueued) can clobber a
 * newer row. Cross-process writers remain excluded by the single-writer
 * worktree contract (atomic rename still prevents torn rows).
 */
const mutationTails = new Map();
async function withMutationGate(file, run) {
    const previous = mutationTails.get(file) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    mutationTails.set(file, tail);
    await previous.catch(() => undefined);
    try {
        return await run();
    }
    finally {
        release();
        if (mutationTails.get(file) === tail)
            mutationTails.delete(file);
    }
}
export function createFileWakeIntentStore(options) {
    const file = options.filePath;
    async function write(row) {
        await mkdir(dirname(file), { recursive: true });
        // A UNIQUE temp name per write: two async writers of the same latch must
        // never share a scratch file (one rename would publish the other's bytes,
        // or fail ENOENT after the first rename). The rename stays the atomic
        // publish point; an orphaned temp is ignored by every reader.
        const tmp = `${file}.${randomUUID()}.tmp`;
        await writeFile(tmp, `${JSON.stringify(row)}\n`, 'utf8');
        await rename(tmp, file);
    }
    return {
        async persistQueued(intent) {
            await withMutationGate(file, async () => write({ ...intent, status: 'queued' }));
        },
        async markAccepted(wakeId) {
            await withMutationGate(file, async () => {
                const row = await readRow();
                if (row === null || row.wakeId !== wakeId)
                    return;
                await write({ ...row, status: 'accepted' });
            });
        },
        async clear(wakeId) {
            await withMutationGate(file, async () => {
                if (wakeId !== undefined) {
                    const row = await readRow();
                    if (row !== null && row.wakeId !== wakeId)
                        return;
                }
                try {
                    await unlink(file);
                }
                catch (error) {
                    if (error.code !== 'ENOENT')
                        throw error;
                }
            });
        },
        async read() {
            return readRow();
        },
    };
    async function readRow() {
        let raw;
        try {
            raw = await readFile(file, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return null;
            throw error;
        }
        const parsed = JSON.parse(raw);
        if (!isRow(parsed))
            throw new Error('alpha6: the wake-intent row is malformed');
        return parsed;
    }
}
//# sourceMappingURL=wake-intent-store.js.map