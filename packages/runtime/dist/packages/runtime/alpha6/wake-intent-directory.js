/**
 * Alpha.6 — the DIRECTORY-backed wake-intent store: ONE row per latch.
 *
 * The single-file store remains available for a one-latch world; this variant
 * keys each row by the coordinator's `ReviewWakeKey`, so two reviewers (the
 * Officer and a transferred Leader) never overwrite each other. A boot-time
 * recovery enumerates every row and adopts each one independently.
 *
 * The row carries no decision and no authority; it is the same tiny intent
 * record the single-file store writes.
 *
 * @module packages/runtime/alpha6/wake-intent-directory
 */
import { randomUUID } from 'node:crypto';
import { access, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFileWakeIntentStore } from './wake-intent-store.js';
/** Stable FNV-1a hash of the latch identity; no clock, no randomness. */
function keyHash(key) {
    const canonical = `${key.rootSessionId}\u001f${key.reviewerInstanceId}\u001f${String(key.sessionGeneration)}`;
    let hash = 0x811c9dc5;
    for (let index = 0; index < canonical.length; index += 1) {
        hash ^= canonical.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
export function createFileWakeIntentDirectory(directory) {
    return {
        pathFor(key) {
            return join(directory, `wake-${keyHash(key)}.json`);
        },
        stoppedPathFor(key) {
            return join(directory, `stopped-${keyHash(key)}.json`);
        },
        async isStopped(key) {
            // Existence is the Stop. A marker written by an older build (no key) or
            // left mid-write must still stop: read-side fail-closed, never open.
            try {
                await access(this.stoppedPathFor(key));
                return true;
            }
            catch {
                return false;
            }
        },
        async readStopped(key) {
            try {
                const parsed = JSON.parse(await readFile(this.stoppedPathFor(key), 'utf8'));
                if (parsed.key === undefined)
                    return null;
                return parsed.targetSessionId === undefined
                    ? { key: parsed.key }
                    : { key: parsed.key, targetSessionId: parsed.targetSessionId };
            }
            catch {
                return null;
            }
        },
        async listStopped() {
            let names;
            try {
                names = await readdir(directory);
            }
            catch (error) {
                if (error.code === 'ENOENT')
                    return [];
                throw error;
            }
            const markers = [];
            for (const name of names.filter((entry) => entry.startsWith('stopped-') && entry.endsWith('.json')).sort()) {
                try {
                    const parsed = JSON.parse(await readFile(join(directory, name), 'utf8'));
                    if (parsed.key !== undefined) {
                        markers.push(parsed.targetSessionId === undefined
                            ? { key: parsed.key }
                            : { key: parsed.key, targetSessionId: parsed.targetSessionId });
                    }
                }
                catch { /* an unreadable marker never becomes a Stop */ }
            }
            return markers;
        },
        async markStopped(key, targetSessionId) {
            const marker = targetSessionId === undefined
                ? { key }
                : { key, targetSessionId };
            // Atomic replace: a crash must leave either the old marker or the full
            // new one, never a truncated JSON that reads as "not stopped".
            const path = this.stoppedPathFor(key);
            const tmp = `${path}.tmp-${randomUUID()}`;
            await writeFile(tmp, `${JSON.stringify({ stopped: true, ...marker })}\n`, 'utf8');
            await rename(tmp, path);
        },
        async clearStopped(key) {
            await rm(this.stoppedPathFor(key), { force: true });
        },
        forKey(key) {
            return createFileWakeIntentStore({ filePath: this.pathFor(key) });
        },
        async list() {
            let names;
            try {
                names = await readdir(directory);
            }
            catch (error) {
                if (error.code === 'ENOENT')
                    return [];
                throw error;
            }
            const rows = [];
            for (const name of names.filter((entry) => entry.startsWith('wake-') && entry.endsWith('.json')).sort()) {
                const row = await createFileWakeIntentStore({ filePath: join(directory, name) }).read();
                if (row !== null)
                    rows.push(row);
            }
            return rows;
        },
    };
}
//# sourceMappingURL=wake-intent-directory.js.map