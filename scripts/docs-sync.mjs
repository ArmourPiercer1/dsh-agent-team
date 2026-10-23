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

import { existsSync, readFileSync } from 'node:fs';
import { checkGeneratedTarget, writeGenerated } from './generated-write.mjs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as runNotes } from './verify-agent-notes.mjs';
import { build as buildStateView, renderContractIndex, renderView, CATALOG_INDEX_PATH } from './gen-current-state.mjs';
import {
  makeCommitExists,
  checkLinks,
  checkDeprecatedTerms,
  checkClaimsHaveEvidence,
  checkIdUniqueness,
  checkContractAnchors,
  checkPlanCitationBlocks,
  isBlockingFinding,
  SELF_UPDATE_CODES,
  checkRatification,
  allDocsForFullCheck,
} from './doc-checks.mjs';

// Both entries are full paths, and both are mirrored in generated-write.mjs's
// GENERATED_FILES. Adding an area there is not enough to reach a file, and adding a path
// here is not enough either: the write goes through checkGeneratedTarget, which demands
// both lists. That is why ids.yaml, README.md and promotion-rules.md sit inside a named
// area and are still not writable.
const GENERATED_ALLOW_LIST = [
  'dev/engineering/current-state.json',
  CATALOG_INDEX_PATH,
];
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

  findings.push(...checkRatification(root));
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
  const planDocs = docs.filter((d) => d.startsWith('docs/plans/'));
  const planCheck = checkPlanCitationBlocks(root, planDocs, { mirror: built.refused ? null : built.view.legacy_authority, commitExists });
  findings.push(...planCheck.findings);
  return { findings, docs: docs.length, notes: notes.checked, plans_scanned: planDocs.length, plans_declaring: planCheck.declared };
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
    // The derived view is a record OF the registry. Writing it while the registry
    // fails its own integrity rules would launder the defect into a generated file
    // that reads like a verified statement.
    // Same classification as docs:sync --check and docs:probe: a claim that cites
    // nothing must not be writable by one entry point and only warned about by another.
    // A derivative is a record OF its inputs, so writing one while its inputs fail
    // their own integrity rules would launder the defect into a file that reads like a
    // verified statement. Classification is shared with --check and docs:probe.
    // One carve-out, named: the freshness of the files this command owns may be
    // repaired by this command. Refusing on STALE_GENERATED_* would block the very
    // regeneration that fixes them. Everything else still refuses.
    const blocking = built.findings.filter((f) => isBlockingFinding(f) && !SELF_UPDATE_CODES.includes(f.code));
    if (blocking.length) {
      for (const f of blocking) console.log(`FAIL ${f.code}: ${f.detail}`);
      console.log('REFUSED write: findings above');
      process.exit(1);
    }
    const DERIVATIVES = [
      { path: 'dev/engineering/current-state.json', render: () => renderView(built) },
      { path: CATALOG_INDEX_PATH, render: () => renderContractIndex(root) },
    ];
    const actions = [];
    for (const d of DERIVATIVES) {
      if (!isWriteAllowed(d.path)) {
        console.log(`REFUSED WRITE_TARGET_NORMATIVE: ${d.path}`);
        process.exit(2);
      }
      // Boundary BEFORE content. Comparing first let a symlinked target answer
      // "already fresh" and exit 0 without the location ever being checked — found by
      // NEG-27 rather than by reading, which is the point of the control.
      const place = checkGeneratedTarget(root, d.path);
      if (!place.ok) {
        console.log(`REFUSED WRITE_BOUNDARY: ${place.why}`);
        process.exit(2);
      }
      const next = d.render();
      const before = existsSync(join(root, d.path)) ? readFileSync(join(root, d.path), 'utf8') : '';
      if (before === next) {
        // Wording matters: this states content equality and that no bytes were
        // written. It is not a claim that a write was verified safe.
        actions.push(`no-op ${d.path} (bytes already match the rendered output; nothing written)`);
        continue;
      }
      const written = writeGenerated(root, d.path, next);
      if (!written.ok) {
        console.log(`REFUSED WRITE_BOUNDARY: ${written.why}`);
        process.exit(2);
      }
      // "1 -> 153 lines" would imply a one-line file existed. Report creation as
      // creation: an absent target has no line count.
      const from = before === '' ? 'absent' : `${before.split('\n').length} lines`;
      actions.push(`regenerated ${d.path} (${from} -> ${next.split('\n').length} lines)`);
    }
    console.log(`docs:sync --write: ${actions.join('; ')}; normative files untouched`);
    process.exit(0);
  }

  const result = check(root);
  // One finding set, one definition of a refusal, shared with docs:probe and the --write
  // gate. --check used to exit 1 on any finding whatsoever, so a fact worth recording
  // that is not a refusal (a derivative not generated yet) failed the check while the
  // probe called the same input non-blocking. Two tools disagreeing about one input is
  // worse than either verdict alone, so the classification is now the same everywhere.
  const blocking = result.findings.filter(isBlockingFinding);
  for (const f of result.findings) console.log(`${isBlockingFinding(f) ? 'FAIL' : 'WARN'} ${f.code}: ${f.detail}`);
  console.log(`docs:sync --check: docs=${result.docs} notes=${result.notes} plans=${result.plans_scanned}(${result.plans_declaring} declaring) findings=${result.findings.length} blocking=${blocking.length}`);
  console.log('LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof');
  process.exit(blocking.length ? 1 : 0);
}
