#!/usr/bin/env node
// U2 (G2 switchover) — the ONE shared loader for the single editable current authority.
//
// The authority model after the switch:
//   POINTER   dev/engineering/current-authority.json — the single editable file, carrying
//             EXACTLY {snapshot_version, content_digest} (dev/engineering/README.md documents
//             it; schema x-carriers names it). It is the only current the tree edits.
//   HISTORY   dev/engineering/authority-snapshots/<version>.json — immutable published
//             snapshots, written ONLY by scripts/publish-authority.mjs.
//
// Read law (MACHINE-CONSUMERS.json MC list; AUTHORITY-MIGRATION-MAP §7.4):
//   - every machine consumer reads the CURRENT contract through this loader;
//   - missing pointer  = status ABSENT. That is the PRE-switch state only while
//                        graph.yaml#current_contract still exists (REQ-EB-0003); consumers
//                        that are switched over treat ABSENT-without-block as RED.
//                        There is no fallback from a PRESENT-but-invalid pointer — an
//                        invalid pointer is a failure, never a reason to re-read graph.yaml
//                        or the derived mirror (dev/engineering/current-state.json is a
//                        generated view and is never consulted here at all);
//   - digest mismatch, wrong version, symlinked pointer or snapshot, extra pointer keys,
//     schema violation, statement-semantics violation: all structured refusals.
// Two-current guard: while the pointer exists, the legacy `current_contract:` block in
// graph.yaml must be GONE; `twoCurrentFindings()` is the named finding every gate shares.
//
// PURE READ module: it never writes, never creates, never repairs.
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCandidateAuthority } from './authority-candidate-source.mjs';

export const POINTER_REL = 'dev/engineering/current-authority.json';
export const POINTER_KEYS = ['content_digest', 'snapshot_version']; // exactly these two, sorted
export const SNAPSHOTS_REL = 'dev/engineering/authority-snapshots';
export const GRAPH_REL = 'dev/agent-workflow/graph.yaml';
export const EXPECTED_BASELINE_REF = POINTER_REL; // Q6 carriers aim at this value after the switch

const VERSION_RE = /^as[0-9]{8}r[0-9]{1,3}$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/** Pointer file present and regular enough to attempt a read? (Absence is a legal
 *  PRE-switch state; an unreadable present file is handled by loadPointerAuthority.) */
export function pointerExists(root) {
  try { lstatSync(join(root, POINTER_REL)); return true; } catch { return false; }
}

/** The legacy block is present in the given graph text (or on disk when text omitted).
 *  Same block grammar the legacy wrapper uses: a top-level `current_contract:` line. */
export function graphBlockPresent(root, graphText) {
  let g = graphText;
  if (typeof g !== 'string') {
    try { g = readFileSync(join(root, GRAPH_REL), 'utf8'); } catch { return false; }
  }
  return /^current_contract:[ \t]*$/m.test(String(g));
}

/** The two-current guard, shared by every gate: a present pointer AND a present legacy
 *  block means two places claim the six current values. That is exactly what the switch
 *  removed, so its reappearance is a named RED finding, never an auto-pick. */
export function twoCurrentFindings(root, graphText) {
  if (!pointerExists(root)) return [];
  if (!graphBlockPresent(root, graphText)) return [];
  return [`TWO_CURRENT_AUTHORITY: ${POINTER_REL} exists while ${GRAPH_REL}#current_contract is also present — exactly one current is allowed; the graph block was retired at the switch and must not come back (revert the switch commit set to roll back, never re-add the block beside the pointer)`];
}

/**
 * Resolve the pointer to its snapshot and verify everything the consumer may rely on:
 * pointer shape → snapshot path (version-grammar-bounded) → frozen schema shape →
 * recorded digest === pointer digest → recomputed F0 digest === pointer digest →
 * publisher-side statement semantics → version agreement. Any failure is { ok:false,
 * status:'INVALID', refused } with NO values to fall back on.
 */
export function loadPointerAuthority(root) {
  const pointerAbs = join(root, POINTER_REL);
  let st;
  try { st = lstatSync(pointerAbs); } catch (e) {
    if (e.code === 'ENOENT') return { ok: false, status: 'ABSENT', refused: 'POINTER_ABSENT', detail: `${POINTER_REL} does not exist; the pointer is the only current after the switch — the derived mirror is not a source and was not consulted` };
    return { ok: false, status: 'INVALID', refused: `POINTER_IO_${e.code}`, detail: e.message };
  }
  // A pointer that is a symlink (or through a symlinked directory) is refused, never
  // followed: the whole safety boundary of this file class is "read the bytes git handed".
  if (st.isSymbolicLink()) return { ok: false, status: 'INVALID', refused: 'POINTER_SYMLINK', detail: `${POINTER_REL} is a symlink; the authority pointer must be a regular file` };
  if (!st.isFile()) return { ok: false, status: 'INVALID', refused: 'POINTER_NOT_REGULAR', detail: `${POINTER_REL} is not a regular file` };
  let ptr;
  try { ptr = JSON.parse(readFileSync(pointerAbs, 'utf8')); } catch (e) { return { ok: false, status: 'INVALID', refused: 'POINTER_PARSE', detail: e.message }; }
  if (ptr === null || typeof ptr !== 'object' || Array.isArray(ptr)) return { ok: false, status: 'INVALID', refused: 'POINTER_SHAPE', detail: 'pointer must be a JSON object' };
  const keys = Object.keys(ptr).sort();
  if (keys.join(',') !== POINTER_KEYS.join(',')) return { ok: false, status: 'INVALID', refused: 'POINTER_KEYS', detail: `pointer carries [${keys.join(',')}], exactly [${POINTER_KEYS.join(',')}] is allowed — a third key is a second authority smuggled into the pointer` };
  const { snapshot_version: version, content_digest: digest } = ptr;
  if (typeof version !== 'string' || !VERSION_RE.test(version)) return { ok: false, status: 'INVALID', refused: 'POINTER_VERSION', detail: `snapshot_version "${String(version)}" is not asYYYYMMDDrN` };
  if (typeof digest !== 'string' || !DIGEST_RE.test(digest)) return { ok: false, status: 'INVALID', refused: 'POINTER_DIGEST', detail: `content_digest "${String(digest)}" is not sha256:<64 hex>` };

  // The version is the only pointer value that becomes a path component; the grammar above
  // is what makes this join safe, and the loader beneath re-validates shape and digests.
  const snapshotRel = join(SNAPSHOTS_REL, `${version}.json`);
  const c = loadCandidateAuthority({ file: join(root, snapshotRel), expectedDigest: digest });
  if (!c.ok) return { ok: false, status: 'INVALID', refused: `POINTER_${c.refused}`, detail: `${snapshotRel}: ${c.detail ?? c.refused}` };
  if (c.snapshot_version !== version) return { ok: false, status: 'INVALID', refused: 'POINTER_VERSION_VS_SNAPSHOT', detail: `pointer says ${version}, the file at ${snapshotRel} says ${c.snapshot_version}` };
  return {
    ok: true,
    status: 'POINTER',
    pointer_file: POINTER_REL,
    snapshot_file: snapshotRel,
    snapshot_version: c.snapshot_version,
    content_digest: c.content_digest,
    current_phase_statement: c.current_phase_statement,
    six: c.six,
  };
}

/** One entry for every consumer (MC-01..MC-10, MC-13..MC-15 wiring):
 *   - opts.authorityCandidate = { file, expectedDigest }  → explicit candidate OVERRIDE
 *     (kept for the controlled-migration CLI flags; it never becomes the default),
 *   - otherwise the POINTER is the default path whenever it exists,
 *   - with no pointer: status ABSENT — the caller decides (pre-switch legacy path, or
 *     RED where the switch has already retired it; see the read law in this header).
 *  A PRESENT-but-invalid pointer is always fail-closed: ABSENT is never inferred from
 *  a failure, and graph.yaml / current-state.json are never consulted as a fallback. */
export function loadAuthority(root, opts = {}) {
  if (Object.hasOwn(opts, 'authorityCandidate')) {
    const c = loadCandidateAuthority(opts.authorityCandidate);
    return c.ok
      ? { ...c, status: 'CANDIDATE' }
      : { ok: false, status: 'INVALID', refused: c.refused, ...(c.detail ? { detail: c.detail } : {}) };
  }
  return loadPointerAuthority(root);
}

// Import-safety: under `node -` (stdin) argv[1] is "-" and realpathSync THROWS — a loader
// imported by another tool must never crash on how its importer was launched.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (invokedDirectly) {
  // Read-only CLI for hooks, workflows and humans.
  //   status          one JSON line; exit 0 pointer-ok / 3 ABSENT (legal pre-switch) / 2 invalid or two-current
  //   --print-baseline  the snapshot's baseline sha, ONE line on stdout; exit 0/2. This is the
  //                     census precheck's reader: the workflow's awk-on-graph.yaml line was
  //                     replaced by THIS call, so the awk second regex set over the retired
  //                     block no longer exists anywhere (MC-08).
  const mode = process.argv[2] ?? 'status';
  const rootArg = process.argv.indexOf('--root');
  const root = rootArg > -1 ? process.argv[rootArg + 1] : process.cwd();
  if (mode === '--print-baseline') {
    const r = loadPointerAuthority(root);
    if (!r.ok) { process.stderr.write(`${r.refused}${r.detail ? `: ${r.detail}` : ''} — the baseline resolves only from a verified pointer+snapshot; no graph read, no mirror, no default\n`); process.exit(2); }
    const two = twoCurrentFindings(root);
    if (two.length) { process.stderr.write(`${two.join('; ')}\n`); process.exit(2); }
    process.stdout.write(`${r.six.baseline}\n`);
    process.exit(0);
  }
  if (mode !== 'status') {
    process.stderr.write('usage: current-authority.mjs [status | --print-baseline] [--root <dir>] (read-only; the switch is scripts/switch-authority.mjs)\n');
    process.exit(1);
  }
  const r = loadPointerAuthority(root);
  const two = twoCurrentFindings(root);
  process.stdout.write(`${JSON.stringify({ ...r, two_current_findings: two })}\n`);
  process.exit(r.ok ? (two.length ? 2 : 0) : r.status === 'ABSENT' ? 3 : 2);
}
