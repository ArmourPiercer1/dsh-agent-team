#!/usr/bin/env node
// EB1-F docs:sync — complete document verification, and explicit regeneration
// (Engineering Baseline, first version).
//
//   pnpm docs:sync -- --check     read-only; CI uses only this mode
//   pnpm docs:sync -- --write     regenerate derived views, print the diff
//
// --write touches generated derivatives ONLY. Any target under a normative path
// (contracts, notes bodies, glossary, terminology, plans, active instructions) is
// REFUSED, so "make the check green by editing the contract" is not available
// through this tool. The legacy authority file (dev/agent-workflow/graph.yaml) is
// never a write target either.
//
// Exit codes: 0 ok | 1 findings | 2 REFUSED

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as runNotes } from './verify-agent-notes.mjs';
import { build as buildStateView, renderView } from './gen-current-state.mjs';
import {
  makeCommitExists,
  checkLinks,
  checkDeprecatedTerms,
  checkClaimsHaveEvidence,
  checkIdUniqueness,
  checkContractAnchors,
  allDocsForFullCheck,
} from './doc-checks.mjs';

const GENERATED_ALLOW_LIST = ['dev/engineering/current-state.json'];
const NORMATIVE_PREFIXES = [
  'docs/contracts/', 'docs/plans/', '.agents/notes/', 'dev/agent-workflow/',
  'docs/glossary.md', 'docs/terminology.md', 'docs/STATUS.md', 'AGENTS.md',
];

export function isWriteAllowed(rel) {
  if (GENERATED_ALLOW_LIST.includes(rel)) return true;
  if (NORMATIVE_PREFIXES.some((p) => rel === p || rel.startsWith(p))) return false;
  return false; // anything else is not a known derivative
}

export function check(root) {
  const commitExists = makeCommitExists(root);
  const findings = [];
  const notes = runNotes(root);
  for (const f of notes.findings) findings.push({ code: `NOTE_${f.code}`, detail: f.detail });

  const docs = allDocsForFullCheck(root);
  findings.push(...checkLinks(root, docs));
  findings.push(...checkIdUniqueness(root));
  findings.push(...checkContractAnchors(root));
  findings.push(...checkDeprecatedTerms(root, docs));
  findings.push(...checkClaimsHaveEvidence(root, docs, { commitExists }));

  const built = buildStateView(root);
  if (built.refused) {
    findings.push({ code: 'DERIVED_VIEW_UNAVAILABLE', detail: built.refused });
  } else {
    findings.push(...built.findings);
    const viewPath = join(root, 'dev/engineering/current-state.json');
    const rendered = renderView(built);
    if (!existsSync(viewPath)) findings.push({ code: 'STALE_GENERATED_VIEW', detail: 'missing; run --write' });
    else if (readFileSync(viewPath, 'utf8') !== rendered) findings.push({ code: 'STALE_GENERATED_VIEW', detail: 'out of date; run --write' });
  }
  return { findings, docs: docs.length, notes: notes.checked };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const root = (() => {
    const i = args.indexOf('--root');
    return i > -1 ? resolve(args[i + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  })();
  const write = args.includes('--write');
  const checkMode = args.includes('--check');
  if (!write && !checkMode) {
    console.error('usage: docs-sync.mjs --check | --write [--root <dir>]');
    process.exit(2);
  }

  if (write) {
    const built = buildStateView(root);
    if (built.refused) {
      console.log(`REFUSED ${built.refused}`);
      process.exit(2);
    }
    const blocking = built.findings.filter((f) => f.code === 'FAKE_VERIFICATION' || f.code.startsWith('REGISTRY'));
    if (blocking.length) {
      for (const f of blocking) console.log(`FAIL ${f.code}: ${f.detail}`);
      console.log('REFUSED write: findings above');
      process.exit(1);
    }
    const target = 'dev/engineering/current-state.json';
    if (!isWriteAllowed(target)) {
      console.log(`REFUSED WRITE_TARGET_NORMATIVE: ${target}`);
      process.exit(2);
    }
    const next = renderView(built);
    const before = existsSync(join(root, target)) ? readFileSync(join(root, target), 'utf8') : '';
    if (before === next) {
      console.log(`docs:sync --write: ${target} already fresh`);
      process.exit(0);
    }
    writeFileSync(join(root, target), next);
    const beforeLines = before.split('\n').length;
    console.log(`docs:sync --write: regenerated ${target} (${beforeLines} -> ${next.split('\n').length} lines); normative files untouched`);
    process.exit(0);
  }

  const result = check(root);
  for (const f of result.findings) console.log(`FAIL ${f.code}: ${f.detail}`);
  console.log(`docs:sync --check: docs=${result.docs} notes=${result.notes} findings=${result.findings.length}`);
  console.log('LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof');
  process.exit(result.findings.length ? 1 : 0);
}
