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
  BLOCKING_PREFIXES,
  contractShapeFindings,
  checkRatification,
} from './doc-checks.mjs';
import { run as runNotes } from './verify-agent-notes.mjs';
import { build as buildStateView, renderView } from './gen-current-state.mjs';
import { dualReadReport } from './authority-dual-read.mjs';

// Minimal classification wiring for this consumer ONLY (doc-checks' shared list is not
// edited): explicit-candidate diagnostics are blocking by definition — a named candidate
// that is missing, corrupt, digest-wrong, or divergent must stop the run, never rank.
const BLOCKING = BLOCKING_PREFIXES;
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
    // Source is source wherever it lives: package code outside src/ (shims, per-package
    // tests, manifests with logic) went to `other` before, so a change there produced no
    // owner-document advisory at all.
    else if (/^(packages|src)\/[\w./@-]+\.(?:ts|tsx|js|mjs|cjs|json)$/.test(p) || p.startsWith('scripts/')) out.source.push(p);
    else if (/(^|\/)(package\.json|tsconfig[^/]*\.json|cordis\.patch\.yml)$/.test(p) || p.startsWith('.github/')) out.config.push(p);
    else out.other.push(p);
  }
  return out;
}

export function probe(root, opts = {}) {
  const { base = null, worktreeOnly = false } = opts;
  // Presence, not truthiness (same discipline as build): an explicitly provided
  // authorityCandidate that is null/empty/one-sided is a refusal, never a quiet legacy run.
  const candidateMode = Object.hasOwn(opts, 'authorityCandidate');
  if (!existsSync(join(root, '.git')) && git(root, ['rev-parse', '--git-dir']) === null) {
    return { refused: 'NOT_A_GIT_REPO' };
  }
  const scope = worktreeOnly ? changeScope(root, null) : changeScope(root, base);
  if (scope.refused) return { refused: scope.refused };

  const buckets = classify(scope.all);
  let viewMirror = null; // graph#current_contract mirror, read-only, filled by the derived-view rule
  const commitExists = makeCommitExists(root);
  const findings = [];
  let shapes = { findings: [], applicable: false, coverage: null };
  const advisories = [];
  const selectedRules = [];
  let sourceBinding; let dualRead;

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
    const built = buildStateView(root, candidateMode ? { authorityCandidate: opts.authorityCandidate } : {});
    if (candidateMode) {
      // Candidate chain: the view (when the candidate validates) carries a recorded
      // source binding, and the SAME dual-read diagnostic compares candidate vs graph.
      // Nothing here falls back: no binding + named CANDIDATE_*/DUAL_READ_* blocking IS
      // the refusal. Derived-mirror freshness is a legacy-chain property and is checked
      // by the default path (and by docs:sync); this T0 diagnostic never consults it.
      if (built.refused) {
        findings.push({ code: 'CANDIDATE_VIEW_REFUSED', detail: `explicit authority candidate refused: ${built.refused}${built.detail ? ` (${built.detail})` : ''}; no fallback to the legacy source was attempted` });
      } else {
        sourceBinding = built.view.authority_source_binding;
        // The validated candidate IS this run's recorded authority for every rule that
        // consumes the mirror parameter (checkPlanCitationBlocks' PLAN_CITATION_CONFLICT
        // included): a plan citing a phase_id that contradicts the snapshot conflicts
        // exactly as it would against the graph. No new rule, no new parser — the same
        // existing rule reads the same six verified values through the existing parameter.
        viewMirror = built.view.legacy_authority;
        findings.push(...built.findings.map((f) => ({ code: f.code, detail: f.detail })));
        const dr = dualReadReport(opts.authorityCandidate?.file ?? '', root);
        if (dr.io) findings.push({ code: 'DUAL_READ_IO', detail: dr.io });
        else {
          dualRead = { ok: !dr.anyRed, compared: dr.compared };
          for (const v of dr.verdicts) if (v.red) findings.push({ code: `DUAL_READ_${v.code}`, detail: v.detail });
        }
        advisories.push({ code: 'CANDIDATE_MODE_T0', detail: 'explicit-candidate probe is T0 controlled-migration preparation: it records the source binding and dual-read divergences, selects nothing automatically, reads no live pointer or derived mirror, writes nothing, and does not change what the default (legacy) path serves' });
      }
    } else if (built.refused) {
      // A missing or unreadable registry/view is never a green run: the probe would
      // otherwise report "no findings" exactly when the record it checks has gone.
      // U2: a PRESENT-but-invalid pointer refuses the build too — that refusal keeps its
      // own POINTER_* name (blocking via the shared list), so the probe fails by name
      // instead of laundering it into the generic bridge-unavailable line.
      findings.push({
        code: String(built.refused).startsWith('POINTER') ? String(built.refused) : 'STATE_BRIDGE_UNAVAILABLE',
        detail: `derived view cannot be built (${built.refused}${built.detail ? `: ${built.detail}` : ''}); a probe without a buildable derived view cannot report green`,
      });
    } else {
      viewMirror = built.view.legacy_authority;
      if (built.view.authority_source_binding) sourceBinding = built.view.authority_source_binding;
      findings.push(...built.findings.map((f) => ({ code: f.code, detail: f.detail })));
      const viewPath = join(root, 'dev/engineering/current-state.json');
      if (!existsSync(viewPath)) {
        findings.push({ code: 'STALE_GENERATED_VIEW', detail: 'dev/engineering/current-state.json is missing; run pnpm docs:sync --write' });
      } else if (readFileSync(viewPath, 'utf8') !== renderView(built)) {
        findings.push({ code: 'STALE_GENERATED_VIEW', detail: 'dev/engineering/current-state.json does not match registry+git; run pnpm docs:sync --write' });
      }
    }
  }

  // Contracts shape/field-set agreement. Unconditional, unlike the rules above: the two
  // copies of a frozen DTO live in packages/, which is outside every document bucket, so a
  // scope filter here would skip the check for precisely the changes it exists to catch --
  // and latent drift would pass the fast gate while failing the full one.
  selectedRules.push('contracts-shape');
  shapes = contractShapeFindings(root);
  findings.push(...shapes.findings);

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
    // A rule marked enforce:true is a promise this line made to itself: the tool and
    // the document describing it move together. Advisory would have been the honest
    // setting for somebody else's code; for our own tooling, a footnote nobody reads
    // is how a tool and its documentation drift apart — which is the exact failure
    // this whole branch exists to catch in other people's repos.
    const staleStrict = staleOwners.filter((o) => o.enforce);
    const strictSeen = new Set();
    for (const o of staleStrict) {
      if (strictSeen.has(o.source)) continue;
      strictSeen.add(o.source);
      findings.push({
        code: 'DOC_OWNER_UPDATE_MISSING',
        detail: `${o.source} changed but its declared owner document did not: ${o.docs.join(', ')} (rule enforce:true)`,
      });
    }
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
        detail: `${ownership.unowned.length} source path(s) match no owner rule; coverage of dev/engineering/doc-ownership.yaml is ${ownership.owned.length}/${buckets.source.length}; e.g. ${ownership.unowned.slice(0, 4).join(', ')}`,
        candidates: ownership.unowned.slice(0, 12),
      });
    }
    advisories.push({
      code: 'SOURCE_CHANGED_DOC_IMPACT',
      detail: 'owning-document selection is advisory except where dev/engineering/doc-ownership.yaml marks a rule enforce:true; those are self-imposed refusals (DOC_OWNER_UPDATE_MISSING), and CI wiring (EB-ADR-0001) remains a separate coordination decision',
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
    ...(sourceBinding ? { authority_source_binding: sourceBinding } : {}),
    ...(dualRead ? { dual_read: dualRead } : {}),
    shapes_applicable: shapes.applicable,
    shapes_compared: shapes.coverage ? shapes.coverage.pairs_compared : 0,
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
  // A flag that is parsed and never read is worse than no flag: `--strict` was exactly
  // that, advertised by nothing and honoured by nothing, so `docs:probe --strict` reported
  // the ordinary verdict while pretending otherwise. Unknown flags are named and refused;
  // the CLI has no behaviour a typo can switch on.
  const known = new Set(['--root', '--base', '--worktree-only', '--json', '--authority-candidate', '--authority-expected-digest']);
  const unknown = args.filter((a) => a.startsWith('--') && !known.has(a));
  if (unknown.length) {
    console.log(`REFUSED UNKNOWN_FLAG: ${unknown.join(', ')} is not a flag of docs:probe (known: ${[...known].join(', ')})`);
    process.exit(2);
  }
  const probeOpts = { base, worktreeOnly: args.includes('--worktree-only') };
  // Either flag turns candidate mode ON (key present) — a half-given pair then gets the
  // structured CANDIDATE_* refusal downstream instead of a silent legacy run.
  if (args.includes('--authority-candidate') || args.includes('--authority-expected-digest')) {
    probeOpts.authorityCandidate = { file: flagValue('--authority-candidate'), expectedDigest: flagValue('--authority-expected-digest') };
  }
  const result = probe(root, probeOpts);
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
    console.log(`docs:probe blocking=${result.blocking.length} non_blocking=${result.non_blocking.length} advisories=${result.advisories.length} contracts=${result.shapes_applicable ? result.shapes_compared + ' pairs compared' : 'not applicable'}`);
  }
  process.exit(result.blocking.length ? 1 : 0);
}
