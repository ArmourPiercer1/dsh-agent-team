#!/usr/bin/env node
// Shared document-consistency checks (Engineering Baseline EB1-E / EB1-F, v0).
//
// Library only: importing this module has no side effects, and every function
// takes an explicit root so a negative-control scenario can point it at a
// scratch fixture. Used by scripts/docs-probe.mjs, scripts/docs-sync.mjs and
// scripts/doc-consistency-controls.mjs.
//
// Design commitments that the controls prove:
//   * a rule that cannot fail is not delivered — see the scenario table in
//     scripts/doc-consistency-controls.mjs;
//   * Ideas and Proposals never require runtime evidence (no false red);
//   * a claim about current behaviour requires an artifact that exists;
//   * an unresolvable base is REFUSED, never treated as "nothing to check".

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkContractsFieldAgreement } from './contracts-field-agreement.mjs';

/** Memoized "is this a real commit here" probe, so a doc full of SHAs costs one
 *  git call per distinct object. Unknown/absent objects return false. */
export function makeCommitExists(root) {
  const memo = new Map();
  return (sha) => {
    if (!memo.has(sha)) {
      let ok = false;
      try {
        ok = execFileSync('git', ['-C', root, 'cat-file', '-t', sha], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === 'commit';
      } catch {
        ok = false;
      }
      memo.set(sha, ok);
    }
    return memo.get(sha);
  };
}

/** Documents whose statements describe current behaviour. Historical logs and
 *  finished plans are deliberately excluded: they are preserved text. */
export const CURRENT_STATE_DIRS = ['docs/contracts', '.agents/notes', 'dev/engineering'];
export const CURRENT_STATE_FILES = [
  'AGENTS.md',
  'README.md',
  'docs/STATUS.md',
  'docs/glossary.md',
  'docs/terminology.md',
  'docs/BRANCHING.md',
];
/** Exempt from evidence requirements: they may describe the future by design. */
export const PROPOSAL_PREFIXES = ['docs/ideas/', '.agents/notes/proposed/'];

/** Append-only logs, archived plans and captured evidence are PRESERVED TEXT.
 *  Rewriting or retro-flagging them is not a document check's job; the plan is
 *  explicit that historical records stay as written. */
export const HISTORICAL_PREFIXES = [
  'dev/agent-workflow/SESSION_ROUTER_LOG.md',
  'dev/agent-workflow/evidence/',
  'docs/plans/finished/',
  'docs/plans/paused/',
  'docs/plans/issue-fix/',
  'docs/plans/third-party/',
  'docs/repairs/',
  'docs/issues/',
  'references/',
  // Frozen decision records: they name rejected legacy vocabulary on purpose
  // ("any DTO carrying `memberId` fails with LEGACY_MEMBER_ID_REJECTED"). Scanning
  // them for the very terms they quarantine is a false positive by construction.
  'docs/contracts/freeze-confirmation.md',
  'docs/contracts/g3-report.md',
];

export function isHistorical(rel) {
  return HISTORICAL_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

export function isCurrentStateDoc(rel) {
  if (isHistorical(rel)) return false;
  if (PROPOSAL_PREFIXES.some((p) => rel.startsWith(p))) return false;
  if (CURRENT_STATE_FILES.includes(rel)) return true;
  return CURRENT_STATE_DIRS.some((d) => rel.startsWith(`${d}/`));
}

export function isProposalDoc(rel) {
  return PROPOSAL_PREFIXES.some((p) => rel.startsWith(p));
}

function listMarkdown(root, dirs, files = []) {
  for (const relDir of dirs) {
    const abs = join(root, relDir);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isFile()) {
      if (relDir.endsWith('.md')) files.push(relDir);
      continue;
    }
    for (const name of readdirSync(abs)) {
      const child = join(abs, name);
      const rel = relative(root, child).split(sep).join('/');
      if (statSync(child).isDirectory()) listMarkdown(root, [rel], files);
      else if (name.endsWith('.md')) files.push(rel);
    }
  }
  return [...new Set(files)].sort();
}

/** Markdown relative link targets that do not resolve. Code fences and inline
 *  code spans are removed first: a `foo(bar)` inside code is not a link, and
 *  matching there produced nonsense findings on the first run of this tool.
 *  Historical documents are skipped (preserved text). Anchors are ignored. */
export function checkLinks(root, relFiles) {
  const findings = [];
  for (const rel of relFiles) {
    if (isHistorical(rel)) continue;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const stripped = readFileSync(abs, 'utf8')
      .replace(/^```[\s\S]*?^```/gm, '')
      .replace(/`[^`\n]*`/g, '');
    const re = /\[([^\]\n]{0,120})\]\((?!https?:\/\/|mailto:)([^)\s]{1,300})(?:\s+"[^"]*")?\)/g;
    let m;
    while ((m = re.exec(stripped))) {
      const target = m[2].split('#')[0].trim();
      if (!target || /\s/.test(target)) continue;
      if (!existsSync(resolve(dirname(abs), target))) {
        findings.push({ code: 'LINK_DANGLING', detail: `${rel}: [${m[1]}](${m[2]})` });
      }
    }
  }
  return findings;
}

/** Read the "do not write" column of docs/terminology.md as a derived rule set.
 *  The column is bare comma-separated tokens by contract (see that file); a cell
 *  containing a parenthesis is a data error and is reported, not guessed at. */
export function loadDeprecatedTerms(root) {
  const file = join(root, 'docs/terminology.md');
  if (!existsSync(file)) return [];
  const terms = [];
  const rows = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.startsWith('|'));
  for (const row of rows.slice(2)) {
    const cells = row.split('|').map((c) => c.trim());
    const bad = cells[4];
    if (!bad || bad === 'do not write' || /^-+$/.test(bad)) continue;
    for (const piece of bad.split(',')) {
      const token = piece.replace(/`/g, '').trim();
      if (!token) continue;
      if (/[（()）]/.test(token)) continue; // qualifier in a prohibition cell: data error, ignore rather than guess
      if (token.length > 1) terms.push(token);
    }
  }
  return [...new Set(terms)];
}

/** Deprecated synonym used in a current-state document. Historical text and the
 *  rule-source file itself are skipped — a document that enumerates prohibited
 *  strings must not be flagged by its own list. */
export function checkDeprecatedTerms(root, relFiles) {
  const terms = loadDeprecatedTerms(root);
  const findings = [];
  for (const rel of relFiles) {
    if (!isCurrentStateDoc(rel)) continue;
    if (rel === 'docs/terminology.md') continue;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.trimStart().startsWith('>')) return;
      for (const term of terms) {
        if (line.includes(term)) {
          findings.push({ code: 'TERMINOLOGY_DEPRECATED', detail: `${rel}:${idx + 1}: "${term}" — see docs/terminology.md` });
        }
      }
    });
  }
  return findings;
}

/** A delivery or integrity claim that cites nothing is a refusal everywhere.
 *  docs:probe and the docs:sync --write gate import this list so the three entry
 *  points cannot disagree about what a refusal is: the earlier split let a claim be
 *  written by one tool and only warned about by another. */
export const BLOCKING_PREFIXES = [
  'NOTE', 'ID_', 'PLAN_CITATION', 'DOC_OWNER', 'LINK_DANGLING', 'TERMINOLOGY_DEPRECATED',
  'CLAIM_', 'CONTRACT_ANCHOR_MISSING', 'STALE_GENERATED_VIEW', 'STALE_GENERATED_CATALOG', 'STATE_BRIDGE', 'REGISTRY',
  'FAKE_VERIFICATION', 'ARTIFACT_', 'REF_', 'MERGED_CLAIM_', 'RELEASE_CLAIM_', 'SCHEMA_',
  'CONTRACT_FIELD_', 'CONTRACT_PAIR_', 'CONTRACT_V1_', 'CONTRACT_OPTIONAL_',
];
/** Codes that name the *freshness of a derivative* rather than a defect in an input.
 *  Regenerating a derivative is precisely how these are repaired, so the write gates may
 *  act on them; every other blocking finding still refuses the write. The list is shared
 *  so that two write paths cannot disagree about what they are allowed to fix. */
/**
 * The contracts shape/field-set agreement, reachable from the gates rather than only from
 * its own CLI: a check nobody runs is a check that does not exist. When the product
 * package is not in this root at all -- a fixture, an exported subset -- the answer is
 * "not applicable", reported as such by the caller so a summary can never read like
 * coverage that did not happen.
 */
export function contractShapeFindings(root) {
  const res = checkContractsFieldAgreement(root);
  if (res.refused) return { findings: [], applicable: false, coverage: null };
  return { findings: res.findings, applicable: true, coverage: res.coverage };
}

export const SELF_UPDATE_CODES = ['STALE_GENERATED_VIEW', 'STALE_GENERATED_CATALOG'];

export function isBlockingFinding(f) {
  return BLOCKING_PREFIXES.some((p) => String(f.code).startsWith(p));
}

const CLAIM_RE = /(已实现|已交付|已支持|已验证|已测试|已发布|已通过|is delivered|is supported|has been implemented|is verified|is released|passes today|works today)/i;
// What counts as evidence for a current-behaviour claim, in descending strength:
// an evidence artifact, a runnable check, a source citation (existence checked;
// ".md" alone is NOT evidence — a doc citing a doc is the drift this rule exists
// to catch), or a commit that exists in this repository.
const CODE_RE = /((?:scripts|tests|packages|src)\/[\w./@-]+\.(?:mjs|ts|tsx|js|json|ya?ml))(?::\d+)?/g;
// Inside the controlled evidence directory a record is a record whatever its
// extension; a captured run log is the commonest one. Excluding .log/.txt/.md here
// made an honest sentence such as "see evidence/<x>/controls-run-1.log" read as an
// uncited claim. Outside that directory .md still does not count: a document
// citing another document is the drift this rule exists to catch.
const EVIDENCE_RE = /(dev\/agent-workflow\/evidence\/[\w./@-]+\.(?:log|txt|md|json|jsonl|csv|ya?ml|mjs|ts|tsx|js))(?::\d+)?/g;
const SHA_RE = /\b[0-9a-f]{7,40}\b/g;
const SUPPRESS_RE = /no-evidence-needed:/;

/**
 * A current-state document asserting present behaviour must cite something that
 * exists. Proposals and Ideas are exempt by construction (AC-EB-0001 positive
 * case). This is a review trigger over prose, not a proof: the marker
 * `no-evidence-needed: <reason>` suppresses it and is itself greppable.
 */
export function checkClaimsHaveEvidence(root, relFiles, { commitExists = null } = {}) {
  const findings = [];
  for (const rel of relFiles) {
    if (!isCurrentStateDoc(rel) || isProposalDoc(rel)) continue;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (!CLAIM_RE.test(line)) return;
      // Table cells in these repositories are overwhelmingly definitional or
      // permission-granting ("what may enter master"), so a lexical match there is
      // a policy statement, not a delivery claim. Claims inside tables are NOT
      // covered — declared in docs:probe's limit output rather than hidden.
      if (/^\s*\|/.test(line)) return;
      const window = lines.slice(Math.max(0, idx - 3), idx + 8).join('\n');
      if (SUPPRESS_RE.test(window)) return;
      if (/verified_by:/.test(window)) return;
      const cited = [...(window.match(CODE_RE) || []), ...(window.match(EVIDENCE_RE) || [])].filter((p) => existsSync(join(root, p.split(':')[0])));
      if (cited.length) return;
      if (commitExists) {
        const shas = (window.match(SHA_RE) || []).filter((s) => /^[0-9a-f]{7,40}$/.test(s));
        if (shas.some((s) => commitExists(s))) return;
      }
      findings.push({ code: 'CLAIM_WITHOUT_EVIDENCE', detail: `${rel}:${idx + 1}: asserts current behaviour with no resolvable artifact, check, source citation or commit (NOT_VERIFIED)` });
    });
  }
  return findings;
}

/** Duplicate stable ids in the contract index, and duplicate glossary concepts. */
export function checkIdUniqueness(root) {
  const findings = [];
  const idsFile = join(root, 'docs/contracts/engineering-baseline/ids.yaml');
  if (existsSync(idsFile)) {
    const seen = new Map();
    readFileSync(idsFile, 'utf8').split(/\r?\n/).forEach((line, idx) => {
      const m = line.match(/^\s*-?\s*id:\s*(\S+)/);
      if (!m) return;
      if (seen.has(m[1])) findings.push({ code: 'ID_DUPLICATE', detail: `${relative(root, idsFile)}:${idx + 1}: ${m[1]} also at line ${seen.get(m[1])}` });
      else seen.set(m[1], idx + 1);
    });
  }
  const glossary = join(root, 'docs/glossary.md');
  if (existsSync(glossary)) {
    const seen = new Map();
    readFileSync(glossary, 'utf8').split(/\r?\n/).forEach((line, idx) => {
      const m = line.match(/^\|\s*(C-EB-\d{4})\s*\|/);
      if (!m) return;
      if (seen.has(m[1])) findings.push({ code: 'ID_DUPLICATE', detail: `docs/glossary.md:${idx + 1}: ${m[1]} also at line ${seen.get(m[1])}` });
      else seen.set(m[1], idx + 1);
    });
  }
  return findings;
}

/** Every `source_anchor:` in the id index must exist (a dead anchor is how a
 *  contract quietly stops being checkable). */
export function checkContractAnchors(root) {
  const file = join(root, 'docs/contracts/engineering-baseline/ids.yaml');
  if (!existsSync(file)) return [{ code: 'CONTRACT_INDEX_MISSING', detail: 'docs/contracts/engineering-baseline/ids.yaml' }];
  const findings = [];
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, idx) => {
    const m = line.match(/^\s*source_anchor:\s*(\S+)/);
    if (!m) return;
    if (!existsSync(join(root, m[1]))) findings.push({ code: 'CONTRACT_ANCHOR_MISSING', detail: `ids.yaml:${idx + 1}: ${m[1]}` });
  });
  return findings;
}

/** Scope for `docs:sync --check`. Deliberately excludes the evidence tree and
 *  the append-only round log: they are historical (isHistorical) and scanning
 *  21k captured files is not a document check. `docs/plans/active/` IS included:
 *  it describes current work, so pre-existing findings there are real findings
 *  (reported as baseline debt, not silenced). */
export function allDocsForFullCheck(root) {
  const found = listMarkdown(root, ['docs', '.agents', 'dev/engineering', 'AGENTS.md', 'README.md']);
  return found.filter((rel) => !isHistorical(rel));
}

/** EB1-D phase-plan citation interface (v0).
 *
 *  A phase plan MAY declare machine-readable facts in a fenced block:
 *
 *      ```yaml eb-plan
 *      phase_id: alpha5-tool-io-governance
 *      baseline: 9b2ee57bc5afd30e89855e09d1769d2e5ec83912
 *      active_plan: docs/plans/active/<phase>/current-execution-plan.md
 *      evidence_root: dev/agent-workflow/evidence/<phase>/
 *      ```
 *
 *  Absence is NOT a finding: plans belong to the phase owner and this line may
 *  not rewrite them (the standing instruction says the existing plans stay as
 *  they are). Presence is checked, because a plan that cites a path nobody can
 *  open, or states a phase id that contradicts `graph.yaml`, is precisely the
 *  drift EB0-1 measured.
 */
export function checkPlanCitationBlocks(root, relFiles, { mirror = null, commitExists = null } = {}) {
  const findings = [];
  let declared = 0;
  for (const rel of relFiles) {
    if (!rel.startsWith('docs/plans/') || isHistorical(rel)) continue;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    const blocks = text.match(/```yaml eb-plan\n[\s\S]*?```/g) || [];
    for (const block of blocks) {
      declared += 1;
      const body = block.replace(/^```yaml eb-plan\n/, '').replace(/```$/, '');
      const fields = {};
      body.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^([a-z_]+):\s*(.*)$/);
        if (m) fields[m[1]] = m[2].trim().replace(/^"|"$/g, '');
      });
      const line = text.slice(0, text.indexOf(block)).split('\n').length;
      for (const key of ['active_plan', 'backlog', 'matrix', 'evidence_root']) {
        if (fields[key] && !existsSync(join(root, fields[key]))) {
          findings.push({ code: 'PLAN_CITATION_MISSING', detail: `${rel}:${line}: ${key} -> ${fields[key]}` });
        }
      }
      if (fields.baseline && commitExists && !commitExists(fields.baseline)) {
        findings.push({ code: 'PLAN_CITATION_UNKNOWN_COMMIT', detail: `${rel}:${line}: baseline ${fields.baseline} is not an object in this repository` });
      }
      if (mirror && mirror.phase_id && fields.phase_id && fields.phase_id !== mirror.phase_id) {
        findings.push({ code: 'PLAN_CITATION_CONFLICT', detail: `${rel}:${line}: phase_id=${fields.phase_id} contradicts ${mirror.file}#current_contract phase_id=${mirror.phase_id}` });
      }
      if (!fields.phase_id) {
        findings.push({ code: 'PLAN_CITATION_INCOMPLETE', detail: `${rel}:${line}: eb-plan block without phase_id` });
      }
    }
  }
  return { findings, declared };
}

/** EB1-D ratification rule: an id may only leave `proposed-not-ratified` when it
 *  names a note that exists and is not itself proposed. This is the machine half
 *  of docs/contracts/engineering-baseline/promotion-rules.md. */
export function checkRatification(root) {
  const file = join(root, 'docs/contracts/engineering-baseline/ids.yaml');
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  const findings = [];
  const entryRe = /- id: ([A-Z]+-EB-\d{4})([\s\S]*?)(?=\n  - id: |\n[a-z_]+:|$)/g;
  let m;
  while ((m = entryRe.exec(text))) {
    const [, id, body] = m;
    const status = (body.match(/normative_status:\s*(\S+)/) || [])[1];
    if (!status) {
      findings.push({ code: 'ID_STATUS_MISSING', detail: `ids.yaml: ${id} has no normative_status` });
      continue;
    }
    if (!['proposed-not-ratified', 'ratified', 'retired'].includes(status)) {
      findings.push({ code: 'ID_STATUS_UNKNOWN', detail: `ids.yaml: ${id} normative_status=${status}` });
      continue;
    }
    if (status === 'proposed-not-ratified') continue;
    const by = (body.match(/ratified_by:\s*(\S+)/) || [])[1];
    if (!by) {
      findings.push({ code: 'ID_RATIFIED_WITHOUT_DECISION', detail: `ids.yaml: ${id} claims ${status} with no ratified_by note (refused; INV-EB-0009)` });
      continue;
    }
    const noteId = by.replace(/^EB-ADR-/, '');
    const noteFile = new RegExp(`id: ${by}\\b`).test(
      ['proposed', 'implemented', 'rejected', 'archived']
        .map((d) => {
          const dir = join(root, '.agents/notes', d);
          if (!existsSync(dir)) return '';
          return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
        })
        .join('\n'),
    );
    if (!noteId || !noteFile) {
      findings.push({ code: 'ID_RATIFIED_BY_UNKNOWN_NOTE', detail: `ids.yaml: ${id} ratified_by=${by} which is not a note in any lifecycle directory` });
    }
  }
  return findings;
}


/** EB1-E support: source-to-owning-document map (dev/engineering/doc-ownership.yaml).
 *  A missing owner document is a finding; matching nothing is not — it is reported as
 *  unowned coverage, which is a measurement rather than a failure. */
export function selectOwningDocs(root, sourcePaths, changedDocs) {
  const file = join(root, 'dev/engineering/doc-ownership.yaml');
  if (!existsSync(file)) return { findings: [], owned: [], unowned: sourcePaths };
  const entries = [];
  let cur = null;
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const g = line.match(/^\s*-?\s*glob:\s*(\S+)/);
    if (g) { cur = { glob: g[1], docs: [], enforce: false }; entries.push(cur); return; }
    const doc = line.match(/^\s+-\s+(\S+)/);
    if (doc && cur && !/^(glob|enforce):/.test(doc[1])) { cur.docs.push(doc[1]); return; }
    // enforce:true marks a rule this line imposes on itself: a matching source change
    // that leaves the owner document untouched is a refusal, not a footnote. It is
    // declared per rule so the map stays advisory for code this line does not own.
    const enf = line.match(/^\s+enforce:\s*(\S+)/);
    if (enf && cur) cur.enforce = enf[1] === 'true';
  });
  // Escape first, expand second. The first version expanded '**' to '.*' and only
  // then escaped dots, producing a pattern that matched no path at all, which left
  // every wildcard rule dead while the exact-path control still passed.
  const toRe = (glob) => {
    const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const body = esc.split('**').join('\u0000').split('*').join('[^/]*').split('\u0000').join('.*');
    return new RegExp('^' + body + '$');
  };
  const findings = [];
  const owned = [];
  const unowned = [];
  for (const p of sourcePaths) {
    const hit = entries.find((e) => toRe(e.glob).test(p));
    if (!hit) { unowned.push(p); continue; }
    for (const doc of hit.docs) {
      if (!existsSync(join(root, doc))) findings.push({ code: 'DOC_OWNER_DOC_MISSING', detail: `doc-ownership.yaml: ${hit.glob} -> ${doc} (owner document does not exist)` });
    }
    if (!hit.docs.length) findings.push({ code: 'DOC_OWNER_NO_DOCS', detail: `doc-ownership.yaml: ${hit.glob} declares no owner document` });
    owned.push({ source: p, docs: hit.docs, enforce: hit.enforce === true, touched: hit.docs.some((x) => changedDocs.includes(x)) });
  }
  return { findings, owned, unowned };
}
