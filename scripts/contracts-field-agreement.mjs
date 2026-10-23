#!/usr/bin/env node
/**
 * contracts-field-agreement.mjs — do the TypeScript shape and the runtime closed field
 * set of a contracts DTO still say the same thing?
 *
 * Why this exists and not a TS-to-JSON-Schema check: `packages/contracts` has no JSON
 * Schema. There is nothing to be equivalent TO. What the package does carry, twice over,
 * is (a) the `export interface ...` declaration and (b) a hand-maintained
 * `export const X_FIELDS: readonly string[]` naming the same frozen field set, which its
 * validators enforce at runtime through `assertNoUnknownFields`. A third copy exists as
 * hardcoded literals in the package's own tests. So the checkable equivalence here is
 * (a) against (b), which no existing test does directly: the tests compare each of them
 * to a separate literal list, so all three can agree with the list and still drift apart
 * the moment someone renames a field in one place... actually no, if each is compared to
 * the same literal, a rename in one breaks that test. The gap is narrower and real: the
 * literal lists live in `test/`, which needs vitest and node_modules to run, and the
 * pairing between an interface and its FIELDS array is nowhere recorded. This script
 * records the pairing explicitly and compares the two artifacts to each other, with no
 * dependencies and no build step, so it can run where vitest cannot.
 *
 * Honesty rules this file holds itself to:
 *   - It parses a declared subset. An interface body containing anything that is not a
 *     single-line `readonly? name?: Type` property is reported NOT_CHECKED with the line
 *     that defeated it. A construct it could not read is never counted as agreement.
 *   - Barrels are excluded: `export type { A, B } from './x.js'` is a re-export, and 37 of
 *     the 67 lines a naive `grep '^export type'` finds in this package are those.
 *   - Pairings are written out below by hand, not guessed from names. `TEAM_PROJECTION_FIELDS`
 *     for `TeamProjectionDto` is a judgement about two names that a string-similarity rule
 *     would get wrong in both directions. Anything not paired is reported as uncovered.
 *   - It reads. It never writes, never gates, and is not wired into docs:sync or
 *     docs:probe: a documentation line has no authority over someone else's package.
 *
 * Exit: 0 no findings, 1 findings, 2 refused (missing package, no pairs readable).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTRACTS_SRC = 'packages/contracts/src';

/**
 * Every pairing this checker claims. `interface` is the TS declaration, `fields` the
 * runtime closed set it is supposed to mirror; `optional` names a subset array where the
 * package records which of those fields may be absent. Added by hand, one line per
 * shape, because a guessed pairing is a false equivalence with a confident face.
 */
/**
 * An `*Input` declaration is only paired where the package ships an input-shaped array
 * (LEADER_INSTANCE_RECORD_INPUT_FIELDS). `MemberInstanceRecordInput` deliberately has no
 * counterpart: the record array includes `schemaVersion`, which the parser stamps and an
 * input must not carry. Pairing it anyway produced a confident false finding on the first
 * run, which is the exact failure this file warns about.
 *
 * `fieldsV1` is not a second equality claim. These shapes are versioned additively -- the
 * V2 arrays are the v1 set plus new DURATIONAL-optional fields, and the declaration is
 * single (there is no TeamProjectionDtoV2 to compare against). So the v1 array must be a
 * SUBSET of the declaration; requiring equality would refuse the documented design and
 * report the package as broken because it grew.
 */
export const PAIRS = [
  { interface: 'TeamSessionRecordDto', fields: 'TEAM_SESSION_RECORD_FIELDS' },
  { interface: 'MemberInstanceRecordDto', fields: 'MEMBER_INSTANCE_RECORD_FIELDS' },
  { interface: 'LeaderInstanceRecordDto', fields: 'LEADER_INSTANCE_RECORD_FIELDS' },
  { interface: 'LeaderInstanceRecordInput', fields: 'LEADER_INSTANCE_RECORD_INPUT_FIELDS' },
  { interface: 'BlueprintSnapshotRef', fields: 'BLUEPRINT_SNAPSHOT_FIELDS' },
  { interface: 'TeamProjectionDto', fields: 'TEAM_PROJECTION_FIELDS_V2', fieldsV1: 'TEAM_PROJECTION_FIELDS' },
  { interface: 'MemberProjectionDto', fields: 'MEMBER_PROJECTION_FIELDS_V2', fieldsV1: 'MEMBER_PROJECTION_FIELDS' },
  { interface: 'TemplateProjectionDto', fields: 'TEMPLATE_PROJECTION_FIELDS' },
  { interface: 'TeamRootProjectionDto', fields: 'TEAM_ROOT_PROJECTION_FIELDS' },
  { interface: 'CompatibilitySummaryDto', fields: 'COMPATIBILITY_SUMMARY_FIELDS' },
  { interface: 'ActivityIntervalSummary', fields: 'ACTIVITY_INTERVAL_FIELDS' },
  { interface: 'MemberActivitySummaryDto', fields: 'MEMBER_ACTIVITY_SUMMARY_FIELDS' },
  { interface: 'MemberLiveActivityDto', fields: 'MEMBER_LIVE_ACTIVITY_FIELDS' },
  { interface: 'EffectiveConfigEntry', fields: 'EFFECTIVE_CONFIG_ENTRY_FIELDS' },
  { interface: 'EffectiveConfigEntryV2', fields: 'EFFECTIVE_CONFIG_ENTRY_FIELDS_V2' },
  { interface: 'EffectiveConfigDto', fields: 'EFFECTIVE_CONFIG_FIELDS' },
  { interface: 'LedgerSummaryDto', fields: 'LEDGER_SUMMARY_FIELDS' },
  { interface: 'DisposedMemberHistoryDto', fields: 'DISPOSED_MEMBER_HISTORY_FIELDS', optional: 'DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS' },
  { interface: 'MemberModelStateDto', fields: 'MODEL_STATE_FIELDS', optional: 'MODEL_STATE_OPTIONAL_FIELDS' },
  { interface: 'ModelStateEntryDto', fields: 'MODEL_STATE_ENTRY_FIELDS', optional: 'MODEL_STATE_ENTRY_OPTIONAL_FIELDS' },
  { interface: 'ModelStateProvenanceDto', fields: 'MODEL_STATE_PROVENANCE_FIELDS' },
];

const PROPERTY_RE = /^(readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*(.+)$/;

/** Strip comments a property parser must not mistake for content. */
function stripComments(lines) {
  const out = [];
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (!line || line.startsWith('//')) continue;
    out.push(line);
  }
  return out;
}

/**
 * Read every `export interface X { ... }` in a file.
 * Returns { props: {name: {fields:Set, optional:Set, notChecked:[]}}, all: [names] }
 */
export function parseInterfaces(text) {
  const lines = text.split(/\r?\n/);
  const found = {};
  let cur = null;
  let depth = 0;
  let insideNested = false;
  for (let i = 0; i < lines.length; i += 1) {
    const start = lines[i].match(/^export\s+interface\s+([A-Za-z0-9_]+)[^{]*\{/);
    if (start && !cur) {
      cur = { name: start[1], fields: new Set(), optional: new Set(), notChecked: [] };
      depth = 1;
      continue;
    }
    if (!cur) continue;
    const line = lines[i].trim();
    if (line === '' || line.startsWith('*') || line.startsWith('/*') || line.startsWith('//')) continue;

    // The body closes when brace depth returns to zero, not when a line happens to start
    // with `}`. It used to be the latter, and it silently truncated: a property written as
    // a multi-line object ended the interface at its own closing brace, so the nested
    // member was adopted as a top-level field and every field after it vanished without a
    // word. A set with holes is worse than a refusal -- it then agrees with a runtime array
    // that omits the same names, and the comparison reports clean.
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth += opens - closes;
    if (depth <= 0) {
      found[cur.name] = cur;
      cur = null;
      continue;
    }

    // A nested object, one line or several, is outside the subset this reader claims:
    // refuse it at its start and ignore the interior already refused with it.
    if (opens > 0) {
      cur.notChecked.push(`L${i + 1}: nested object type is outside the parsed subset: ${line.slice(0, 72)}`);
      insideNested = depth > 1;
      continue;
    }
    if (insideNested) {
      if (depth <= 1) insideNested = false;
      continue;
    }

    const clean = line.replace(/;$/, '');
    if (/^\[.*\]\s*:/.test(clean) || /^readonly\s+\[/.test(clean)) {
      cur.notChecked.push(`L${i + 1}: index signature: ${line.slice(0, 72)}`);
      continue;
    }
    const m = clean.match(PROPERTY_RE);
    if (!m) {
      cur.notChecked.push(`L${i + 1}: not a single-property declaration: ${line.slice(0, 72)}`);
      continue;
    }
    // Group 4 is the type text, captured so this guard is reachable. With three groups the
    // previous check read `m[4]`, always undefined: the inline-object refusal the header
    // advertised had never run once, and EffectiveConfigDto was caught only because its
    // inline object also happened to contain an index signature.
    if (m[4].includes('{') || m[4].includes('}')) {
      cur.notChecked.push(`L${i + 1}: inline object type on a property line: ${line.slice(0, 72)}`);
      continue;
    }
    cur.fields.add(m[2]);
    if (m[3]) cur.optional.add(m[2]);
  }
  return found;
}

/**
 * Read every `export const NAME ... = [ ... ]` of string literals in a file.
 * Spread elements (`...OTHER_FIELDS`) are resolved against constants seen in the same
 * file; an unresolvable spread is a refusal for that constant, not a guess.
 */
export function parseFieldArrays(text) {
  const out = {};
  const arrayRe = /export\s+const\s+([A-Z0-9_]+)\s*:[^=]*=\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = arrayRe.exec(text))) {
    const [, name, body] = m;
    const values = new Set();
    let refused = null;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/,$/, '');
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
      const spread = line.match(/^\.\.\.([A-Z0-9_]+)$/);
      if (spread) {
        // Spreads are resolved against constants already parsed in this file. A spread of
        // something declared later, or of something that was itself refused, is a refusal
        // here rather than a partially-built set: a set with a hole in it looks complete.
        const src = out[spread[1]];
        if (!src || src.refused || !src.values) {
          refused = `unresolved spread ...${spread[1]}`;
          break;
        }
        for (const v of src.values) values.add(v);
        continue;
      }
      // One element per line is the common layout, not a rule: a short array is written
      // `['correlation', 'openedAt']` on one line and that is still a closed literal set.
      for (const part of line.split(',')) {
        const tok = part.trim();
        if (!tok) continue;
        const lit = tok.match(/^'([^']*)'$/) || tok.match(/^"([^"]*)"$/);
        if (!lit) {
          refused = `non-literal element: ${tok.slice(0, 60)}`;
          break;
        }
        values.add(lit[1]);
      }
      if (refused) break;
    }
    if (refused) out[name] = { refused, values: null };
    else out[name] = { refused: null, values };
  }
  return out;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

/** The comparison itself. Pure over (root), returns findings + coverage facts. */
/**
 * `opts.only` restricts the comparison to the named interfaces. A caller testing one
 * shape -- a fixture, or a reviewer looking at one DTO -- must not be told about the
 * twenty other pairings the tree in front of it does not contain. Coverage counts follow
 * the same restriction, so a scoped run reports what it actually covered.
 */
export function checkContractsFieldAgreement(root, opts = {}) {
  const srcRoot = join(root, CONTRACTS_SRC);
  if (!existsSync(srcRoot)) return { refused: `PACKAGE_ABSENT: ${CONTRACTS_SRC}`, findings: [], coverage: null };

  const files = walk(srcRoot).map((f) => relative(root, f));
  const interfaces = {};
  const arrays = {};
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    for (const [name, val] of Object.entries(parseInterfaces(text))) interfaces[name] = { ...val, file: rel };
    for (const [name, val] of Object.entries(parseFieldArrays(text))) arrays[name] = { ...val, file: rel };
  }

  const pairs = Array.isArray(opts.only) && opts.only.length
    ? PAIRS.filter((p) => opts.only.includes(p.interface))
    : PAIRS;
  const findings = [];
  const compared = [];
  const notPresent = [];
  const notChecked = [];
  const unpaired = { interfaces: [], arrays: [] };
  const pairedInterfaces = new Set(pairs.map((p) => p.interface));
  const pairedArrays = new Set(pairs.flatMap((p) => [p.fields, p.optional, p.fieldsV1].filter(Boolean)));

  for (const pair of pairs) {
    const iface = interfaces[pair.interface];
    const arr = arrays[pair.fields];
    // A pairing with neither side present is not drift, it is a root that does not carry
    // that shape -- a fixture, or an older checkout. Calling that a finding would make the
    // gate red for the absence of a file it never had, and the honest response to noise is
    // never to widen the tolerance. One side present and the other gone is exactly drift:
    // something was renamed or deleted on one side of the mirror only.
    if (!iface && !arr) {
      notPresent.push(`${pair.interface} / ${pair.fields}`);
      continue;
    }
    if (!iface) {
      findings.push({ code: 'CONTRACT_PAIR_INTERFACE_MISSING', detail: `${pair.fields} exists but ${pair.interface} does not: the runtime set lost its declared shape (${arr.file})` });
      continue;
    }
    if (!arr) {
      findings.push({ code: 'CONTRACT_PAIR_ARRAY_MISSING', detail: `${pair.interface} exists but ${pair.fields} does not: the declaration lost the closed set that guards it at runtime (${iface.file})` });
      continue;
    }
    if (arr.refused) {
      notChecked.push(`${pair.fields} in ${arr.file}: ${arr.refused}`);
      continue;
    }
    if (iface.notChecked.length) {
      notChecked.push(`${pair.interface} in ${iface.file}: ${iface.notChecked.join(' | ')}`);
      // A partially unreadable declaration cannot support a set comparison in either
      // direction: the missing line might have declared the very field being asked about.
      continue;
    }
    const missing = [...iface.fields].filter((f) => !arr.values.has(f));
    const extra = [...arr.values].filter((f) => !iface.fields.has(f));
    if (missing.length) {
      findings.push({ code: 'CONTRACT_FIELD_NOT_IN_RUNTIME', detail: `${pair.interface} declares ${missing.join(', ')} but ${pair.fields} does not name them, so the runtime closed set rejects a record its own type allows (${iface.file})` });
    }
    if (extra.length) {
      findings.push({ code: 'CONTRACT_FIELD_NOT_IN_TYPE', detail: `${pair.fields} names ${extra.join(', ')} which ${pair.interface} does not declare, so the runtime set admits a field the type forbids (${arr.file})` });
    }
    if (pair.optional) {
      const opt = arrays[pair.optional];
      if (!opt || opt.refused) {
        notChecked.push(`${pair.optional}: ${opt ? opt.refused : 'not found'}`);
      } else {
        const wrong = [...opt.values].filter((f) => !iface.optional.has(f) || !iface.fields.has(f));
        if (wrong.length) findings.push({ code: 'CONTRACT_OPTIONAL_MISPLACED', detail: `${pair.optional} lists ${wrong.join(', ')} which ${pair.interface} declares as required or not at all` });
      }
    }
    if (pair.fieldsV1) {
      const v1 = arrays[pair.fieldsV1];
      if (!v1) findings.push({ code: 'CONTRACT_PAIR_ARRAY_MISSING', detail: `${pair.fieldsV1} (paired with ${pair.interface}) not found` });
      else if (v1.refused) notChecked.push(`${pair.fieldsV1}: ${v1.refused}`);
      else {
        const gone = [...v1.values].filter((x) => !iface.fields.has(x));
        if (gone.length) findings.push({ code: 'CONTRACT_V1_FIELD_NOT_DECLARED', detail: `${pair.fieldsV1} names ${gone.join(', ')} which ${pair.interface} no longer declares: the v1 set is meant to be a subset of the shape, so either the field was removed from the type or the older array was not updated (${v1.file})` });
        else compared.push(`${pair.interface} >= ${pair.fieldsV1} (v1 subset, ${v1.values.size} fields)`);
      }
    }
    compared.push(`${pair.interface} <-> ${pair.fields} (${iface.fields.size} fields)`);
  }

  for (const [name, val] of Object.entries(interfaces)) if (!pairedInterfaces.has(name)) unpaired.interfaces.push(`${name} (${val.file})`);
  for (const [name, val] of Object.entries(arrays)) if (!pairedArrays.has(name) && /_FIELDS$|_FIELDS_V2$/.test(name)) unpaired.arrays.push(`${name} (${val.file})`);

  return {
    refused: null,
    findings,
    coverage: {
      ts_files: files.length,
      interfaces_found: Object.keys(interfaces).length,
      field_arrays_found: Object.keys(arrays).filter((n) => /_FIELDS$|_FIELDS_V2$/.test(n)).length,
      pairs_declared: pairs.length,
      pairs_compared: compared.filter((c) => c.includes(' <-> ')).length,
      subset_checks: compared.filter((c) => c.includes(' >= ')).length,
      not_checked: notChecked,
      not_present: notPresent,
      applicable: true,
      unpaired,
      compared,
    },
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const at = args.indexOf('--root');
  if (at !== -1 && args[at + 1]) root = resolve(args[at + 1]);
  const result = checkContractsFieldAgreement(root);
  if (result.refused) {
    console.log(`REFUSED ${result.refused}`);
    process.exit(2);
  }
  for (const f of result.findings) console.log(`FAIL ${f.code}: ${f.detail}`);
  const c = result.coverage;
  console.log(`contracts field agreement: ts_files=${c.ts_files} interfaces=${c.interfaces_found} field_arrays=${c.field_arrays_found} pairs_compared=${c.pairs_compared}/${c.pairs_declared} findings=${result.findings.length}`);
  if (c.not_checked.length) console.log(`NOT_CHECKED (${c.not_checked.length}): ${c.not_checked.join(' | ')}`);
  console.log(`unpaired interfaces=${c.unpaired.interfaces.length} unpaired field arrays=${c.unpaired.arrays.length}`);
  console.log(`equality_pairs=${c.pairs_compared} v1_subset_checks=${c.subset_checks}`);
  console.log('LIMIT: field NAMES only. No type comparison, no minItems/length/uniqueness, no cross-field rule: those live in the parse functions and are not derivable from a declaration. The findings also reach docs:sync --check and docs:probe, where a missing counterpart is drift; a pairing absent on both sides is not applicable, not a pass.');
  process.exit(result.findings.length ? 1 : 0);
}
