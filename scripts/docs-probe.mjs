#!/usr/bin/env node
// EB1-E docs:probe — fast document consistency probe (Engineering Baseline, first version).
//
//   pnpm docs:probe -- --base origin/master          PR / branch mode
//   pnpm docs:probe -- --worktree-only               local uncommitted work
//   node scripts/docs-probe.mjs --root <dir> --json  scratch fixture (controls)
//
// Scope is real Git state: merge-base..HEAD plus staged, unstaged and untracked
// paths. A --base that cannot be resolved is REFUSED (exit 2): an unknown base
// must never degrade into "nothing changed, all green".
//
// This is a T0 check. It proves document/graph facts and artifact existence. It
// does not prove behaviour: no C1/C2/C3, no security negative, no permission
// reasoning. The output says so in `limits` so a green line cannot be quoted as
// "verified".
//
// Exit codes: 0 pass | 1 blocking findings | 2 REFUSED

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeCommitExists,
  allDocsForFullCheck,
  checkLinks,
  checkDeprecatedTerms,
  checkClaimsHaveEvidence,
  checkIdUniqueness,
  checkContractAnchors,
  checkPlanCitationBlocks,
  selectOwningDocs,
  checkRatification,
} from './doc-checks.mjs';
import { run as runNotes } from './verify-agent-notes.mjs';
import { build as buildStateView, renderView } from './gen-current-state.mjs';

const BLOCKING = [
  'NOTE', 'ID_', 'PLAN_CITATION', 'DOC_OWNER', 'LINK_DANGLING', 'TERMINOLOGY_DEPRECATED', 'CLAIM_WITHOUT_EVIDENCE',
  'ID_DUPLICATE', 'CONTRACT_ANCHOR_MISSING', 'STALE_GENERATED_VIEW', 'REGISTRY', 'FAKE_VERIFICATION', 'ARTIFACT_MISSING',
];
const LIMITS = [
  'T0 only: proves document facts, id/reference integrity and artifact existence; proves no runtime behaviour',
  'no C1/C2/C3 substitution and no security negative control here',
  'complements scripts/ci-pr-gate.mjs (graph-parse / state-freshness legs own current_contract pointer grammar and stay the merge gate); this probe does not re-implement them and cannot replace a leg',
  'semantic equivalence of prose remains a Contract Owner judgement',
  'natural-language claims are matched by conservative patterns; a novel phrasing can evade the pattern (reported as a limit, not as a pass)',
];

function git(root, args, allowFail = true) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

/** Committed + staged + unstaged + untracked paths, as repo-relative posix paths. */
export function changeScope(root, base) {
  const sets = { committed: [], staged: [], unstaged: [], untracked: [] };
  const lines = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (base) {
    const mb = git(root, ['merge-base', base, 'HEAD']);
    if (!mb) return { refused: `BASE_UNRESOLVABLE:${base}` };
    sets.committed = lines(git(root, ['diff', '--name-only', `${mb.trim()}..HEAD`])).map(toPosix);
    sets.merge_base = mb.trim();
  }
  sets.staged = lines(git(root, ['diff', '--name-only', '--cached'])).map(toPosix);
  sets.unstaged = lines(git(root, ['diff', '--name-only'])).map(toPosix);
  sets.untracked = lines(git(root, ['ls-files', '--others', '--exclude-standard'])).map(toPosix);
  sets.all = [...new Set([...sets.committed, ...sets.staged, ...sets.unstaged, ...sets.untracked])].sort();
  return sets;
}

const toPosix = (p) => p.split(sep).join('/');

function classify(paths) {
  const out = { docs: [], notes: [], contracts: [], generated: [], source: [], config: [], other: [] };
  for (const p of paths) {
    if (p.startsWith('.agents/notes/') && p.endsWith('.md')) out.notes.push(p);
    else if (p.startsWith('docs/contracts/')) out.contracts.push(p);
    else if (p === 'dev/engineering/current-state.json' || p.startsWith('dev/engineering/')) out.generated.push(p);
    else if (p.endsWith('.md')) out.docs.push(p);
    else if (/^packages\/.*\/src\//.test(p) || p.startsWith('scripts/')) out.source.push(p);
    else if (/(^|\/)(package\.json|tsconfig[^/]*\.json|cordis\.patch\.yml)$/.test(p) || p.startsWith('.github/')) out.config.push(p);
    else out.other.push(p);
  }
  return out;
}

export function probe(root, { base = null, worktreeOnly = false, strict = false } = {}) {
  if (!existsSync(join(root, '.git')) && git(root, ['rev-parse', '--git-dir']) === null) {
    return { refused: 'NOT_A_GIT_REPO' };
  }
  const scope = worktreeOnly ? changeScope(root, null) : changeScope(root, base);
  if (scope.refused) return { refused: scope.refused };

  const buckets = classify(scope.all);
  let viewMirror = null; // graph#current_contract mirror, read-only, filled by the derived-view rule
  const commitExists = makeCommitExists(root);
  const findings = [];
  const advisories = [];
  const selectedRules = [];

  // R1 notes (id / status-dir / reference / evidence integrity)
  if (buckets.notes.length) {
    selectedRules.push('agent-notes');
    const { findings: nf } = runNotes(root);
    for (const f of nf) findings.push({ code: `NOTE_${f.code}`, detail: f.detail });
  }

  // R2 links in changed markdown (and in any doc next to a changed note)
  const docTargets = [...new Set([...buckets.docs, ...buckets.notes, ...buckets.contracts, ...buckets.generated.filter((p) => p.endsWith('.md'))])];
  if (docTargets.length) {
    selectedRules.push('md-links');
    findings.push(...checkLinks(root, docTargets));
  }

  // R4 derived-view integrity: always run. It is a handful of git calls, and a
  // hand-edited or stale view is the highest-value drift this bridge prevents.
  {
    selectedRules.push('derived-view');
    const built = buildStateView(root);
    viewMirror = built.refused ? null : built.view.legacy_authority;
    if (built.refused) {
      advisories.push({ code: 'DERIVED_VIEW_UNAVAILABLE', detail: built.refused });
    } else {
      findings.push(...built.findings.map((f) => ({ code: f.code, detail: f.detail })));
      const viewPath = join(root, 'dev/engineering/current-state.json');
      if (existsSync(viewPath) && existsSync(join(root, 'dev/engineering/registry.yaml'))) {
        if (readFileSync(viewPath, 'utf8') !== renderView(built)) {
          findings.push({ code: 'STALE_GENERATED_VIEW', detail: 'dev/engineering/current-state.json does not match registry+git; run pnpm docs:sync --write' });
        }
      }
    }
  }

  // R6 terminology, R7 claims-without-evidence (current-state docs only)
  if (docTargets.length || buckets.contracts.length) {
    selectedRules.push('terminology', 'claims-need-evidence');
    findings.push(...checkDeprecatedTerms(root, docTargets));
    findings.push(...checkClaimsHaveEvidence(root, docTargets, { commitExists }));
  }

  // R8 id uniqueness + contract anchors when the contract surface moved
  if (buckets.contracts.length || buckets.docs.some((d) => d === 'docs/glossary.md' || d === 'docs/terminology.md')) {
    selectedRules.push('id-uniqueness', 'contract-anchors');
    findings.push(...checkIdUniqueness(root));
    findings.push(...checkContractAnchors(root));
    findings.push(...checkRatification(root));
    const planDocs = docTargets.filter((d) => d.startsWith('docs/plans/'));
    const scanned = planDocs.length ? planDocs : allDocsForFullCheck(root).filter((d) => d.startsWith('docs/plans/'));
    const planCheck = checkPlanCitationBlocks(root, scanned, { mirror: viewMirror, commitExists });
    findings.push(...planCheck.findings);
    if (planCheck.declared === 0) {
      advisories.push({ code: 'PLAN_CITATION_ADOPTION', detail: 'no phase plan declares an eb-plan citation block yet; the interface exists and adoption is the phase owner decision — this line does not rewrite existing plans' });
    }
  }

  // R9 source change -> which owning document should be looked at (advisory in v0)
  if (buckets.source.length) {
    selectedRules.push('doc-ownership-impact');
    const ownership = selectOwningDocs(root, buckets.source, docTargets);
    findings.push(...ownership.findings);
    const staleOwners = ownership.owned.filter((o) => !o.touched);
    if (ownership.owned.length) {
      advisories.push({
        code: 'DOC_IMPACT_OWNED',
        detail: `${ownership.owned.length} source path(s) have declared owner documents`,
        review_needed: staleOwners.map((o) => ({ source: o.source, docs: o.docs })),
      });
    }
    if (ownership.unowned.length) {
      advisories.push({
        code: 'DOC_IMPACT_UNOWNED',
        detail: `${ownership.unowned.length} source path(s) match no owner rule; coverage of dev/engineering/doc-ownership.yaml is ${ownership.owned.length}/${buckets.source.length}`,
        candidates: ownership.unowned.slice(0, 12),
      });
    }
    advisories.push({
      code: 'SOURCE_CHANGED_DOC_IMPACT',
      detail: 'owning-document selection is advisory in v0 and becomes blocking only with CI wiring (EB-ADR-0001)',
    });
  }

  const blocking = findings.filter((f) => BLOCKING.some((b) => f.code.startsWith(b)));
  const nonBlocking = findings.filter((f) => !BLOCKING.some((b) => f.code.startsWith(b)));
  return {
    base: base || '(worktree-only)',
    head: git(root, ['rev-parse', 'HEAD']),
    merge_base: scope.merge_base || null,
    changed: { total: scope.all.length, buckets },
    selected_rules: selectedRules,
    blocking,
    non_blocking: nonBlocking,
    advisories,
    limits: LIMITS,
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const flagValue = (name) => {
    const i = args.indexOf(name);
    return i > -1 ? args[i + 1] : null;
  };
  const root = resolve(flagValue('--root') || resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const base = flagValue('--base');
  if (!base && !args.includes('--worktree-only')) {
    console.log('REFUSED BASE_REQUIRED: pass --base <verified-ref> or --worktree-only (a missing base is never treated as "no changes")');
    process.exit(2);
  }
  const result = probe(root, { base, worktreeOnly: args.includes('--worktree-only'), strict: args.includes('--strict') });
  if (result.refused) {
    console.log(`REFUSED ${result.refused}`);
    process.exit(2);
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`docs:probe base=${result.base} head=${String(result.head).slice(0, 9)} changed=${result.changed.total} rules=${result.selected_rules.join(',')}`);
    for (const f of result.blocking) console.log(`FAIL ${f.code}: ${f.detail}`);
    for (const f of result.non_blocking) console.log(`WARN ${f.code}: ${f.detail}`);
    for (const a of result.advisories) console.log(`ADVISORY ${a.code}: ${a.detail}`);
    for (const l of result.limits) console.log(`LIMIT ${l}`);
    console.log(`docs:probe blocking=${result.blocking.length} non_blocking=${result.non_blocking.length} advisories=${result.advisories.length}`);
  }
  process.exit(result.blocking.length ? 1 : 0);
}
