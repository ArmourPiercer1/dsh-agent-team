#!/usr/bin/env node
// EB1-A / EB1-B document validators (Engineering Baseline, first version).
//
// Pure Node, no third-party dependency: this must run in an isolated worktree
// that has no node_modules installed. The YAML it reads is the strict subset
// described in .agents/notes/README.md; unsupported syntax FAILS loudly rather
// than being silently mis-parsed.
//
// Exit codes: 0 = pass, 1 = findings, 2 = refused (unusable input).

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIFECYCLE = ['proposed', 'implemented', 'rejected', 'archived'];
const ID_RE = /^EB-ADR-\d{4}$/;
const REQID_RE = /^(REQ|INV|AC|IDEA)-[A-Z0-9-]+$/;
const CONCEPT_RE = /^C-EB-\d{4}$/;
const REQUIRED_SECTIONS = ['## Context', '## Decision', '## Consequences'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse the strict frontmatter subset. Returns {data, body, errors}. */
export function parseFrontmatter(text) {
  const errors = [];
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { data: null, errors: ['frontmatter-missing'] };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { data: null, errors: ['frontmatter-unclosed'] };
  const data = {};
  let currentListKey = null;
  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const listItem = raw.match(/^\s+-\s+(.*)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(strip(listItem[1]));
      continue;
    }
    const kv = raw.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kv) {
      errors.push(`frontmatter-unsupported-syntax:L${i + 1}:${raw.trim()}`);
      currentListKey = null;
      continue;
    }
    const [, key, rawValue] = kv;
    const value = rawValue.trim();
    if (value === '') {
      data[key] = [];
      currentListKey = key;
      continue;
    }
    currentListKey = null;
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner ? inner.split(',').map((s) => strip(s.trim())) : [];
    } else {
      data[key] = strip(value);
    }
  }
  const body = lines.slice(end + 1).join('\n');
  return { data, body, errors };
}

function strip(s) {
  return s.replace(/^['"]|['"]$/g, '').trim();
}

/** Read the stable-id index (docs/contracts/engineering-baseline/ids.yaml). */
export function loadContractIds(root) {
  const file = join(root, 'docs/contracts/engineering-baseline/ids.yaml');
  if (!existsSync(file)) return { ids: new Set(), errors: ['contract-id-index-missing'] };
  const ids = new Set();
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*-?\s*id:\s*(\S+)/);
    if (m) ids.add(m[1]);
  }
  return { ids, errors: [], file: relative(root, file) };
}

/** Read concept ids declared in docs/glossary.md table rows. */
export function loadGlossaryConcepts(root) {
  const file = join(root, 'docs/glossary.md');
  if (!existsSync(file)) return new Set();
  const concepts = new Set();
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\|\s*(C-EB-\d{4})\s*\|/);
    if (m) concepts.add(m[1]);
  }
  return concepts;
}

function isPathReference(ref) {
  return ref.includes('/') || ref.endsWith('.md') || ref.endsWith('.yaml');
}

/** Validate one note file. Returns findings array of {code, detail}. */
export function validateNote(root, absPath, ctx) {
  const findings = [];
  const rel = relative(root, absPath).split(sep).join('/');
  const text = readFileSync(absPath, 'utf8');
  const { data, body, errors } = parseFrontmatter(text);
  for (const e of errors) findings.push({ code: 'note-frontmatter', detail: `${rel}: ${e}` });
  if (!data) return findings;

  const parentDir = rel.split('/').slice(-2, -1)[0];
  if (!LIFECYCLE.includes(parentDir)) {
    findings.push({ code: 'note-location', detail: `${rel}: not under a lifecycle directory` });
  } else if (data.status !== parentDir) {
    findings.push({
      code: 'note-status-dir-mismatch',
      detail: `${rel}: status=${String(data.status)} but directory=${parentDir}`,
    });
  }
  if (!ID_RE.test(String(data.id || ''))) {
    findings.push({ code: 'note-id-grammar', detail: `${rel}: id=${String(data.id)}` });
  } else if (ctx.seenIds.has(data.id)) {
    findings.push({
      code: 'note-id-duplicate',
      detail: `${rel}: id ${data.id} already declared in ${ctx.seenIds.get(data.id)}`,
    });
  } else {
    ctx.seenIds.set(data.id, rel);
  }
  if (!data.title) findings.push({ code: 'note-title-missing', detail: rel });
  if (data.status !== 'proposed' && !DATE_RE.test(String(data.decided || ''))) {
    findings.push({ code: 'note-decided-required', detail: `${rel}: status=${data.status} needs decided: YYYY-MM-DD` });
  }
  if (data.status === 'archived' && !data.supersedes) {
    findings.push({ code: 'note-archived-needs-successor', detail: rel });
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(section)) {
      findings.push({ code: 'note-section-missing', detail: `${rel}: ${section}` });
    }
  }

  for (const ref of Array.isArray(data.references) ? data.references : []) {
    if (CONCEPT_RE.test(ref)) {
      if (!ctx.concepts.has(ref)) {
        findings.push({ code: 'note-reference-unknown-concept', detail: `${rel}: ${ref} not declared in docs/glossary.md` });
      }
    } else if (REQID_RE.test(ref)) {
      if (!ctx.contractIds.has(ref)) {
        findings.push({ code: 'note-reference-unknown-id', detail: `${rel}: ${ref}` });
      }
    } else if (isPathReference(ref)) {
      if (!existsSync(join(root, ref))) {
        findings.push({ code: 'note-reference-missing-path', detail: `${rel}: ${ref}` });
      }
    } else {
      findings.push({ code: 'note-reference-unclassified', detail: `${rel}: ${ref}` });
    }
  }

  const verified = Array.isArray(data.verified_by) ? data.verified_by : [];
  if (data.status === 'implemented' && verified.length === 0) {
    findings.push({ code: 'note-implemented-needs-evidence', detail: rel });
  }
  if (data.status !== 'implemented' && verified.length > 0) {
    findings.push({ code: 'note-false-delivery-claim', detail: `${rel}: status=${data.status} must not carry verified_by` });
  }
  for (const v of verified) {
    if (!existsSync(join(root, v))) {
      findings.push({ code: 'note-verified-by-missing', detail: `${rel}: ${v} (NOT_VERIFIED)` });
    }
  }
  return findings;
}

export function walkNotes(root) {
  const out = [];
  const base = join(root, '.agents/notes');
  if (!existsSync(base)) return out;
  for (const dir of readdirSync(base)) {
    const full = join(base, dir);
    if (!statSync(full).isDirectory() || !LIFECYCLE.includes(dir)) continue;
    for (const name of readdirSync(full)) {
      if (name.endsWith('.md') && name !== 'README.md') out.push(join(full, name));
    }
  }
  return out.sort();
}

export function run(root) {
  const contract = loadContractIds(root);
  const ctx = { seenIds: new Map(), contractIds: contract.ids, concepts: loadGlossaryConcepts(root) };
  const findings = contract.errors.map((e) => ({ code: 'contract-index', detail: e }));
  const notes = walkNotes(root);
  for (const n of notes) findings.push(...validateNote(root, n, ctx));
  return { checked: notes.length, findings };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const argRoot = (() => {
    const i = process.argv.indexOf('--root');
    return i > -1 && process.argv[i + 1]
      ? resolve(process.argv[i + 1])
      : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  })();
  if (!existsSync(join(argRoot, '.agents'))) {
    console.error(`REFUSED: ${argRoot} has no .agents directory`);
    process.exit(2);
  }
  const { checked, findings } = run(argRoot);
  for (const f of findings) console.log(`FAIL ${f.code}: ${f.detail}`);
  console.log(`verify-agent-notes: root=${argRoot} notes=${checked} findings=${findings.length}`);
  process.exit(findings.length ? 1 : 0);
}
