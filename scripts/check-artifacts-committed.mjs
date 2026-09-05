#!/usr/bin/env node
/**
 * PBA (plugin-prebuilt-artifacts, R131) — install-surface artifact freshness gate.
 *
 * The plugin's git-install surface (root `files` whitelist) ships PREBUILT artifacts:
 *
 *   - packages/runtime/dist
 *   - packages/client/composition-shim
 *
 * These are committed to the repository so that `pnpm dsh plugin add github:...`
 * executes NO build scripts at install time (root package.json declares zero
 * lifecycle scripts) and therefore needs no pnpm `allowBuilds` allowlist entry.
 *
 * This gate (wired into `pnpm build:composition`, standalone `pnpm check:artifacts`)
 * verifies, after a build, that the committed artifacts are exactly what a fresh
 * build produces — a three-way check against the git index (`git ls-files -s`):
 *
 *   A) tracked-but-absent          (a committed file no longer exists on disk after
 *                                   the build — deleted from source and cleaned, or
 *                                   removed by hand)
 *   B) produced-but-untracked      (new build output that was never committed)
 *   C) produced-but-modified       (content drift: `git hash-object` — with the same
 *                                   clean filters `git add` applies, e.g. autocrlf —
 *                                   differs from the staged blob)
 *
 * Any hit -> exit 1 with the file list (fail-loud: a source change that affects the
 * install surface must ship its rebuilt artifacts in the SAME commit).
 * Files that .gitignore covers under the two paths (e.g. *.tsbuildinfo) are excluded.
 *
 * Known narrow gap (accepted): if a source file is DELETED and the build tool leaves
 * its stale dist output on disk (tsc does not clean stale outputs), the leftover
 * stays in the produced set and passes A/C. Such a file is unreferenced (the build
 * would fail on dangling imports), so it is dead weight in the mirror, not a
 * behavioral drift — the mirror-trim minor task subsumes it.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PATHS = ['packages/runtime/dist', 'packages/client/composition-shim'];
const SEP = path.sep;

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function walk(rel, out) {
  for (const e of readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const child = rel + SEP + e.name;
    if (e.isDirectory()) walk(child, out);
    else if (e.isFile()) out.push(child.split(SEP).join('/'));
  }
}

/**
 * git blob object ids for a list of worktree files, computed with the same
 * clean filters `git add` applies (one spawn via --stdin-paths). This matches
 * what would be staged, so e.g. autocrlf-normalized copies (like the byte-copied
 * glue under core.autocrlf=true) compare equal to their staged blobs.
 */
function gitBlobShas(files) {
  if (files.length === 0) return new Map();
  const out = execFileSync('git', ['hash-object', '--stdin-paths'], {
    cwd: ROOT,
    encoding: 'utf8',
    input: files.join('\n'),
  });
  const shas = out.split('\n').map((s) => s.trim()).filter(Boolean);
  if (shas.length !== files.length) {
    console.error('[check-artifacts-committed] ERROR: hash-object count mismatch (git version?).');
    process.exit(1);
  }
  return new Map(files.map((f, i) => [f, shas[i]]));
}

const producedAll = [];
for (const p of PATHS) {
  try {
    walk(p, producedAll);
  } catch {
    console.error(`[check-artifacts-committed] ERROR: ${p} missing — run \`pnpm build && pnpm build:composition\` first.`);
    process.exit(1);
  }
}

const ignored = new Set(
  git('ls-files', '--ignored', '--exclude-standard', '-o', '--', ...PATHS)
    .split('\n').map((s) => s.trim()).filter(Boolean),
);
const produced = new Set(producedAll.filter((f) => !ignored.has(f)));

const tracked = new Map(); // path -> blob sha (index)
for (const line of git('ls-files', '-s', '--', ...PATHS).split('\n')) {
  const t = line.trim();
  if (!t) continue;
  const tab = t.indexOf('\t');
  if (tab < 0) continue;
  const meta = t.slice(0, tab).split(' ');
  tracked.set(t.slice(tab + 1), meta[1]);
}

const stale = [...tracked.keys()].filter((f) => !produced.has(f)).sort();
const untracked = [...produced].filter((f) => !tracked.has(f)).sort();
const toHash = [...produced].filter((f) => tracked.has(f));
const worktreeShas = gitBlobShas(toHash);
const drifted = toHash.filter((f) => worktreeShas.get(f) !== tracked.get(f)).sort();

if (stale.length === 0 && untracked.length === 0 && drifted.length === 0) {
  console.log(
    `[check-artifacts-committed] OK: ${produced.size} files; committed install-surface artifacts match the fresh build`,
  );
  process.exit(0);
}

console.error(
  '[check-artifacts-committed] STALE install-surface artifacts — rebuild output must be committed together with the source change (same commit):',
);
for (const f of stale) console.error(`  A tracked-but-absent (stale): ${f}`);
for (const f of untracked) console.error(`  B produced-but-untracked (git add): ${f}`);
for (const f of drifted) console.error(`  C content-drift (git add): ${f}`);
process.exit(1);
