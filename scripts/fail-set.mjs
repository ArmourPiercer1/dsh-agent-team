#!/usr/bin/env node
// A4 baseline-diff tool (Alpha.4 plan A1.2.2).
//
// Purpose: make "no new failing identity" mechanically checkable. A PR gate must not have to
// read a human summary of the suite to decide whether it regressed anything, and it must not
// be allowed to claim "same debt as before" from counts alone: 19 failing tests at base and 19
// failing tests after a PR can be two disjoint sets. So this tool reduces a vitest JSON report
// to a sorted set of stable identity lines and diffs two such sets.
//
// Identity grammar (exactly two kinds, sorted, deduplicated, LF-terminated):
//   TEST <repo-relative/path>::<full test name>     a named test that failed
//   FILE <repo-relative/path>::COLLECTION-OR-UNHANDLED  the file failed without any named failing
//                                                   test (collection error / file-level error /
//                                                   unhandled failure). Recorded as one identity
//                                                   per file, because its "test name" is not
//                                                   stable across runs.
//
// Normalization rules (a baseline captured on another OS/worktree must diff cleanly):
//   - path separators collapse to '/', drive letters and absolute prefixes are removed by
//     cutting at the repo root marker (default "dsh-agent-team/", override --root-marker)
//   - interior whitespace runs collapse to a single space, name is trimmed
//   - a test whose fullName is empty falls back to ancestorTitles + title joined by ' '
//
// Usage:
//   node scripts/fail-set.mjs capture <vitest-json>... [--out <file>] [--root-marker <s>]
//   node scripts/fail-set.mjs diff <baseline-file> <current-file>
//   node scripts/fail-set.mjs --self-test
//
// Exit codes: capture 0 on success, 2 on unusable input. diff 0 when current adds no new
// identity, 1 when it does (gate failure), 2 on unusable input.

import { readFileSync, writeFileSync } from 'node:fs';

const DEFAULT_ROOT_MARKER = 'dsh-agent-team/';

function normalizePath(raw, rootMarker) {
  let p = String(raw ?? '').replaceAll('\\', '/').trim();
  const cut = p.lastIndexOf(rootMarker);
  if (cut >= 0) p = p.slice(cut + rootMarker.length);
  // A task worktree lives at <repoRoot>/.worktrees/<task>/… . An identity must not depend on
  // which checkout produced the report: PR #62's recorded baseline came from a worktree and did
  // not line up with root-run captures for exactly this reason.
  p = p.replace(/^\.worktrees\/[^/]+\//, '');
  return p.replace(/^\.\//, '');
}

function normalizeName(raw) {
  // vitest's fullName is copied VERBATIM (trim only): the pinned baseline format contract in
  // dev/agent-workflow/evidence/alpha4/baseline/BASELINE.md §7 requires it, so that two
  // independent normalizers — and a Windows- and a Linux-captured report — agree byte-for-byte.
  return String(raw ?? '').trim();
}

/** Reduce one parsed vitest JSON report to identity lines. */
export function identitiesFromReport(report, { rootMarker = DEFAULT_ROOT_MARKER } = {}) {
  const ids = new Set();
  const files = Array.isArray(report?.testResults) ? report.testResults : [];
  for (const file of files) {
    const rel = normalizePath(file?.name, rootMarker);
    if (!rel) continue;
    const assertions = Array.isArray(file?.assertionResults) ? file.assertionResults : [];
    const failed = assertions.filter((a) => a?.status === 'failed');
    if (failed.length > 0) {
      for (const a of failed) {
        const full =
          normalizeName(a?.fullName) ||
          normalizeName([...(a?.ancestorTitles ?? []), a?.title].filter(Boolean).join(' '));
        ids.add(`TEST ${rel}::${full || '<unnamed test>'}`);
      }
      continue;
    }
    if (file?.status === 'failed') ids.add(`FILE ${rel}::COLLECTION-OR-UNHANDLED`);
  }
  return [...ids].sort();
}

function parseArgs(argv) {
  const positional = [];
  const opts = { rootMarker: DEFAULT_ROOT_MARKER, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--root-marker') opts.rootMarker = argv[++i];
    else positional.push(a);
  }
  return { positional, opts };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    process.stderr.write(`[fail-set] cannot read JSON report ${path}: ${e.message}\n`);
    process.exit(2);
  }
}

function readIdentityFile(path) {
  try {
    return new Set(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    );
  } catch (e) {
    process.stderr.write(`[fail-set] cannot read identity file ${path}: ${e.message}\n`);
    process.exit(2);
  }
}

function cmdCapture(args) {
  const { positional, opts } = parseArgs(args);
  const reports = positional.filter((p) => !p.startsWith('--'));
  if (reports.length === 0) {
    process.stderr.write('[fail-set] capture needs at least one vitest JSON report\n');
    process.exit(2);
  }
  const ids = new Set();
  for (const r of reports) for (const id of identitiesFromReport(readJson(r), opts)) ids.add(id);
  const lines = [...ids].sort();
  const text = `${lines.length ? `${lines.join('\n')}\n` : ''}`;
  if (opts.out) writeFileSync(opts.out, text, 'utf8');
  else process.stdout.write(text);
  const tests = lines.filter((l) => l.startsWith('TEST ')).length;
  const files = lines.filter((l) => l.startsWith('FILE ')).length;
  process.stderr.write(
    `[fail-set] captured ${lines.length} identities (${tests} failing tests, ${files} collection-failing files) from ${reports.length} report(s)\n`,
  );
}

function cmdDiff(args) {
  const [basePath, currentPath] = args.filter((a) => !a.startsWith('--'));
  if (!basePath || !currentPath) {
    process.stderr.write('[fail-set] diff needs <baseline> <current>\n');
    process.exit(2);
  }
  const base = readIdentityFile(basePath);
  const current = readIdentityFile(currentPath);
  const added = [...current].filter((id) => !base.has(id));
  const fixed = [...base].filter((id) => !current.has(id));
  for (const id of added) process.stdout.write(`NEW  ${id}\n`);
  for (const id of fixed) process.stdout.write(`FIXED ${id}\n`);
  process.stderr.write(
    `[fail-set] baseline=${base.size} current=${current.size} NEW=${added.length} FIXED=${fixed.length}\n`,
  );
  process.exit(added.length > 0 ? 1 : 0);
}

function cmdSelfTest() {
  const report = {
    testResults: [
      {
        name: 'C:\\repo\\dsh-agent-team\\packages\\runtime\\test\\a.test.ts',
        status: 'failed',
        assertionResults: [
          { fullName: 'A  does   a thing', status: 'failed' }, // verbatim: whitespace is NOT collapsed
          { fullName: '', ancestorTitles: ['A', 'nested'], title: 'other', status: 'passed' },
          { fullName: '', ancestorTitles: ['A'], title: 'unnamed fails', status: 'failed' },
          { fullName: 'A passes', status: 'passed' },
        ],
      },
      {
        name: 'dsh-agent-team/packages/tools/test/b.test.ts',
        status: 'failed',
        assertionResults: [],
        message: 'collection boom',
      },
      {
        name: 'dsh-agent-team/packages/domain/test/c.test.ts',
        status: 'passed',
        assertionResults: [{ fullName: 'C ok', status: 'passed' }],
      },
      {
        name: '/home/x/dsh-agent-team/packages/domain/test/a.test.ts',
        status: 'failed',
        assertionResults: [{ fullName: 'A does a thing', status: 'failed' }],
      },
      {
        // captured from a task worktree: must yield the SAME identity as a root-run capture
        name: '/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr0/packages/domain/test/a.test.ts',
        status: 'failed',
        assertionResults: [{ fullName: 'A does a thing', status: 'failed' }],
      },
      {
        name: '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/other-task/packages/domain/test/a.test.ts',
        status: 'failed',
        assertionResults: [{ fullName: 'A does a thing', status: 'failed' }],
      },
    ],
  };
  const got = identitiesFromReport(report);
  const want = [
    'FILE packages/tools/test/b.test.ts::COLLECTION-OR-UNHANDLED',
    'TEST packages/domain/test/a.test.ts::A does a thing',
    'TEST packages/runtime/test/a.test.ts::A  does   a thing',
    'TEST packages/runtime/test/a.test.ts::A unnamed fails',
  ];
  const ok = JSON.stringify(got) === JSON.stringify(want);
  process.stdout.write(`${ok ? 'SELF-TEST PASS' : 'SELF-TEST FAIL'}\ngot:  ${JSON.stringify(got)}\nwant: ${JSON.stringify(want)}\n`);
  process.exit(ok ? 0 : 1);
}

const argv = process.argv.slice(2);
const [cmd, ...rest] = argv;
if (cmd === 'capture') cmdCapture(rest);
else if (cmd === 'diff') cmdDiff(rest);
else if (cmd === '--self-test' || cmd === 'self-test') cmdSelfTest();
else {
  process.stdout.write(
    'usage: node scripts/fail-set.mjs capture <vitest-json>... [--out f] | diff <baseline> <current> | --self-test\n',
  );
  process.exit(cmd ? 2 : 0);
}
