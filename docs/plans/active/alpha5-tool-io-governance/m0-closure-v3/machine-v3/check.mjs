// M0-CLOSURE machine-v2 纯候选 checker — 只读：仅 node:fs 的 readFileSync/readdirSync/existsSync。
// 无网络、无子进程、无产品/Host 调用、无写操作（不写盘；收据由外层 shell 重定向保存）。
// 语义三桶分离（P3-A2）：candidateErrors=被审对象（route-records-v3c.json）错误；
//   fixtureResults=每个 fixture 的 actual codes 与 expected 的精确多重集比较（符合预期的负例不污染全局）；
//   三态输出：fixtureSuitePass / candidateShapePass / freezeEligible(恒 false，P1/P4 未闭)。
// 中心合同 = ../M0-A-LIFECYCLE-CONTRACT-v1.1.md（208ba98c…）；本件为其机器侧候选，非已实现声称。
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const schema = J(path.join(DIR, 'route-record.schema.json'));
const vocab = new Set(J(path.join(DIR, 'eff-vocabulary.json')).tokens);
const priority = J(path.join(DIR, 'error-priority-closure.json')).priority.map((e) => e.code);
const rank = (c) => priority.indexOf(c);
const byPriority = (codes) => [...codes].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
const isStr = (v) => typeof v === 'string';
const badStr = (v) => !isStr(v) || v.length === 0;
const has = (o, k) => o !== undefined && o !== null && Object.prototype.hasOwnProperty.call(o, k);

// ---------------- records ----------------
export function checkRecord(rec, errs) {
  for (const [f, spec] of Object.entries(schema.recordFields)) {
    if (!has(rec, f)) { if (spec.required) errs.push('E_MISSING'); continue; }
    const v = rec[f];
    if (spec.type === 'string') {
      if (!isStr(v)) { errs.push(f.endsWith('Route') ? 'E_ROUTE' : 'E_TYPE'); continue; }
      if (v === '') { if (spec.required || spec.nonempty) errs.push('E_MISSING'); continue; }
      if (spec.enum && !spec.enum.includes(v)) errs.push('E_ENUM');
    } else if (spec.type === 'array') {
      if (!Array.isArray(v)) { errs.push('E_TYPE'); continue; }
      if (spec.minItems && v.length < spec.minItems) errs.push('E_TYPE');
      for (const e of v) { if (badStr(e)) errs.push('E_MISSING'); else if (spec.items.inVocabulary && !vocab.has(e)) errs.push('E_EFF_UNKNOWN'); }
    }
  }
  const isSurface = isStr(rec.name) && rec.name.startsWith('surface:');
  if (rec.req === 'N-A-TOOL' && !isSurface) errs.push('E_NA_SCOPE');
  if (!isSurface && badStr(rec.targetCeiling)) errs.push('E_CEILING_MISSING');
  const ownScope = rec.scope === 'own-layer';
  const ownTarget = rec.fc === 'FC-TEAM15' && rec.targetGovernedRoute === 'GOVERNED_OWN_LAYER';
  if (ownScope !== ownTarget) errs.push('E_OWN_LAYER'); // 双向
}
export function checkRecordFile(file) {
  const errs = [];
  const d = J(file);
  for (const m of schema.metaFieldsRequired) if (!has(d.meta, m)) errs.push('E_META');
  for (const [i, r] of d.records.entries()) { const before = errs.length; checkRecord(r, errs); if (errs.length > before) errs.push('AT:records[' + i + '](' + (r.name ?? '?') + ')'); }
  // coverage：固定矩阵实时解析为唯一来源（P3-C2 精确集合）
  const mxPath = path.resolve(DIR, schema.fixedInputs.matrix);
  const mxBytes = readFileSync(mxPath);
  const sha = createHash('sha256').update(mxBytes).digest('hex');
  if (sha !== schema.fixedInputs.matrixSha256) errs.push('E_FIXED_INPUT');
  const lines = mxBytes.toString('utf8').split('\n').slice(schema.coverage.appendix.startLine - 1, schema.coverage.appendix.endLine); // startLine/endLine 均 1-based 含端
  const mx = new Set();
  for (const ln of lines) { const m = ln.match(/^- \*\*([^*]+)\*\*/); if (m) mx.add(m[1]); }
  if (mx.size !== schema.coverage.matrixNameCount) errs.push('E_FIXED_INPUT'); // 附录层级读取断言（=83）
  const cov = schema.coverage.additionalImplNames;
  const surface = new Set(cov.surface);
  const names = d.records.map((r) => r.name);
  const namesSet = new Set(names);
  for (const n of mx) if (!namesSet.has(n)) errs.push('E_COVERAGE_MISSING');
  for (const n of namesSet) if (!mx.has(n) && !cov.aliases.includes(n) && !surface.has(n)) errs.push('E_COVERAGE_NAME');
  const dupNames = [...namesSet].filter((n) => names.filter((x) => x === n).length > 1).sort();
  const trio = [...schema.coverage.duplicatePolicy.allowedDuplicates].sort();
  if (dupNames.join() !== trio.join()) errs.push('E_UNIQUE_KEY');
  for (const n of dupNames) {
    const rows = d.records.filter((r) => r.name === n);
    if (rows.length !== 2 || new Set(rows.map((r) => r.scope)).size !== 2) errs.push('E_UNIQUE_KEY');
  }
  const expectedRows = mx.size + cov.aliases.length + cov.surface.length + schema.coverage.duplicatePolicy.allowedDuplicates.length;
  if (d.records.length !== expectedRows) errs.push('E_COVERAGE');
  // 固定 93 name#scope 键集双向差分（第8条；来源=已核 P1 route-records-v3c.json pin，数量不变不豁免）
  const ks = J(path.join(DIR, 'coverage-keys-expected.json'));
  if (ks.sourceSha256 !== schema.fixedInputs.recordsSha256) errs.push('E_FIXED_INPUT');
  const wantKeys = new Set(ks.keys);
  const gotKeys = new Set(d.records.map((r) => r.name + '#' + r.scope));
  for (const k of wantKeys) if (!gotKeys.has(k)) errs.push('E_COVERAGE');
  for (const k of gotKeys) if (!wantKeys.has(k)) errs.push('E_COVERAGE');
  return errs.filter((e) => !e.startsWith('AT:'));
}

// ---------------- lifecycle（严格状态图，P3-B） ----------------
const G = schema.lifecycleGraph;
const EDGE = new Set(G.edges.map(([a, b]) => a + '>' + b));
const ASK_STATES = ['ASK_WAIT', 'ASK_VERIFIED', 'ASK_RESERVED'];
const FIXTURE_TOKEN = ['trusted-test-fixture'];
function need(t, dotted, errs) {
  let cur = t;
  for (const k of dotted.split('.')) { if (!has(cur, k)) { errs.push('E_MISSING'); return false; } cur = cur[k]; }
  return true;
}
export function checkTrace(t) {
  const errs = [];
  if (t.branch === undefined) errs.push('E_MISSING');
  else if (!['ask', 'all-allow'].includes(t.branch)) errs.push('E_ENUM');
  const states = Array.isArray(t.states) ? t.states : [];
  if (states.length === 0) errs.push('E_MISSING');
  for (const s of states) if (!G.states.includes(s)) errs.push('E_ENUM');
  for (let i = 0; i + 1 < states.length; i++) if (!EDGE.has(states[i] + '>' + states[i + 1])) errs.push('E_TRANSITION');
  const seen = new Set(); for (const s of states) { if (seen.has(s)) errs.push('E_REPLAY'); seen.add(s); }
  if (!G.finalStates.includes(t.terminal)) errs.push('E_ENUM');
  if (states.length && t.terminal !== states[states.length - 1]) errs.push('E_TERMINAL');
  const inS = (s) => states.includes(s);
  // 1 入口/分支：states 首项必须 RECEIVED；ask 禁 ALL_ADMITTED；all-allow 禁 ASK_*/control/consumptionProof
  if (states.length && states[0] !== 'RECEIVED') errs.push('E_TRANSITION');
  if (t.branch === 'all-allow' && (t.control !== undefined || t.consumptionProof !== undefined || ASK_STATES.some(inS))) errs.push('E_FORGED_APPROVAL'); // 7 all-allow 禁 Control 证据
  if (t.branch === 'ask' && inS('ALL_ADMITTED')) errs.push('E_WRONG_BRANCH');
  // 4 基础字段按 d.ts：hostToken 对象/枚举/serialized=false；binding；member/realm/correlation/callId/fingerprint 非空
  if (!has(t, 'hostToken')) errs.push('E_MISSING');
  else if (t.hostToken === null || typeof t.hostToken !== 'object') errs.push('E_TYPE');
  else {
    if (t.hostToken.serialized !== false) errs.push('E_IDENTITY');
    if (!FIXTURE_TOKEN.includes(t.hostToken.fixtureRef)) errs.push('E_ENUM');
  }
  if (!has(t, 'binding')) errs.push('E_MISSING');
  else if (t.binding === null || typeof t.binding !== 'object') errs.push('E_TYPE');
  else {
    if (badStr(t.binding.bindingId)) errs.push('E_MISSING');
    if (t.binding.bindingRevisionCurrent !== true || t.binding.status !== 'ACTIVE') errs.push('E_STALE');
  }
  for (const f of ['invocationCorrelation', 'hostCallId', 'realmId']) if (!has(t, f) || badStr(t[f])) errs.push('E_MISSING');
  if (!has(t, 'member')) errs.push('E_MISSING');
  else if (t.member === null || typeof t.member !== 'object') errs.push('E_TYPE');
  else { for (const f of ['teamSessionId', 'instanceId']) if (badStr(t.member[f])) errs.push('E_MISSING'); }
  if (!has(t, 'requestedEffects')) errs.push('E_MISSING');
  else if (t.requestedEffects === null || typeof t.requestedEffects !== 'object') errs.push('E_TYPE');
  else if (badStr(t.requestedEffects.fingerprint)) errs.push('E_MISSING');
  // 2/7 Ask 分阶段证据：ASK_WAIT 只须 request；进入 ASK_VERIFIED 及以后才须 decision allow
  if (t.branch === 'ask') {
    if (!need(t, 'control.request.requestId', errs)) { /* E_MISSING 已记 */ }
    else if (badStr(t.control.request.requestId)) errs.push('E_MISSING');
    if (t.control?.request && t.control.request.invocationCorrelation !== t.invocationCorrelation) errs.push('E_OWNERSHIP');
    if (inS('ASK_VERIFIED')) {
      if (t.control?.decision === undefined) errs.push('E_MISSING');
      else {
        if (!has(t.control.decision, 'decisionSequence')) errs.push('E_MISSING');
        if (t.control.decision.decision !== 'allow') errs.push('E_LEDGER_CLAIM'); // 未获批却称已验证
      }
    }
    if (inS('ASK_RESERVED')) {
      if (need(t, 'consumptionProof.requestId', errs) && need(t, 'consumptionProof.decisionSequence', errs)) {
        if (t.consumptionProof.requestId !== t.control?.request?.requestId) errs.push('E_IDENTITY');
        if (t.consumptionProof.decisionSequence !== t.control?.decision?.decisionSequence) errs.push('E_IDENTITY');
      }
    }
  }
  // 3 Grant 字段：进入 ALL_ADMITTED/ASK_VERIFIED 即全量非空+等值
  const entered = inS('ALL_ADMITTED') || inS('ASK_VERIFIED');
  if (entered && t.grant === undefined) errs.push('E_MISSING');
  if (t.grant !== undefined) {
    if (entered) {
      if (badStr(t.grant.grantId)) errs.push('E_MISSING');
      if (badStr(t.grant.effectsFingerprint)) errs.push('E_MISSING');
      else if (t.requestedEffects && t.grant.effectsFingerprint !== t.requestedEffects.fingerprint) errs.push('E_IDENTITY');
      if (!has(t.grant, 'issuedTo') || t.grant.issuedTo === null || typeof t.grant.issuedTo !== 'object' || badStr(t.grant.issuedTo.invocationCorrelation)) errs.push('E_MISSING');
      else if (t.grant.issuedTo.invocationCorrelation !== t.invocationCorrelation) errs.push('E_IDENTITY');
      if (t.branch === 'ask') {
        if (badStr(t.grant.logicalQuestionId)) errs.push('E_MISSING');
        if (t.grant.presenter?.trustedFromDecider !== true) errs.push('E_MISSING');
      }
      if (t.branch === 'all-allow' && t.grant.paCallIdEqCorrelation !== true) errs.push('E_IDENTITY');
    }
    if (t.grant.grantFromPriorProcess === true) errs.push('E_COLD_RECOVERY');
  }
  // 5 两条 PA 消费边统一（DISPATCHED 与 LEASE_UNCONFIRMED）：本 grant + ledgerChanged + 无 secondUse + fresh 全真
  if (inS('DISPATCHED') || inS('LEASE_UNCONFIRMED')) {
    if (need(t, 'paConsume.grantId', errs)) {
      if (t.grant && t.paConsume.grantId !== t.grant.grantId) errs.push('E_IDENTITY');
      if (t.paConsume.ledgerChanged !== true) errs.push('E_LEDGER_CLAIM');
      if (t.paConsume.secondUse === true) errs.push('E_REPLAY');
    }
    if (need(t, 'freshValidation.generationsRechecked', errs)) {
      if (t.freshValidation.generationsRechecked !== true) errs.push('E_STALE');
      if (t.freshValidation.bindingRevisionCurrent !== true) errs.push('E_STALE');
      if (t.freshValidation.cancelRequested !== false) errs.push('E_STALE'); // 根条5复核裁决：严格 ===false；缺失/null/其他值均拒
    }
  }
  if (inS('LEASE_UNCONFIRMED')) {
    if (t.bodyStarted !== false) errs.push('E_LEDGER_CLAIM');
    if (t.refundClaimed !== false) errs.push('E_LEDGER_CLAIM');
  }
  // 6 终态互斥（cancel.ledgerUnchanged 语义限定 PA ledger）
  if (['REJECTED', 'PREPARE_FAILED', 'STALE', 'CANCELLED'].includes(t.terminal) && t.bodyStarted === true) errs.push('E_LEDGER_CLAIM');
  if ((t.terminal === 'PREPARE_FAILED' || (t.cancel && t.cancel.point === 'before-pa-consume'))
    && (t.paConsumed === true || t.paConsume?.ledgerChanged === true)) errs.push('E_LEDGER_CLAIM');
  if (inS('PREPARE_FAILED')) {
    if (need(t, 'cleanupScoped', errs) && t.cleanupScoped !== true) errs.push('E_MISSING');
    if (need(t, 'refundClaimed', errs) && t.refundClaimed !== false) errs.push('E_LEDGER_CLAIM');
  }
  if (t.cancel) {
    if (t.cancel.ledgerUnchanged === true && (t.cancel.point !== 'before-pa-consume' || inS('DISPATCHED'))) errs.push('E_LEDGER_CLAIM');
  }
  if (inS('STALE')) need(t, 'generationsOrScopeDriftObserved', errs);
  if (inS('SETTLED')) need(t, 'leaseSettleEvidence', errs);
  return byPriority(errs);
}

// ---------------- main ----------------
export function run(recordsFile, exampleDir) {
  const candidateErrors = checkRecordFile(recordsFile);
  const fixtureResults = [];
  for (const f of readdirSync(exampleDir).filter((x) => x.endsWith('.json')).sort()) {
    const d = J(path.join(exampleDir, f));
    const actual = d.kind === 'lifecycle' ? checkTrace(d) : (() => { const e = []; for (const r of d.records) checkRecord(r, e); return byPriority(e); })();
    const expected = byPriority(Array.isArray(d.expected) ? d.expected : (d.expected === 'ACCEPT' ? [] : ['E_MISSING']));
    fixtureResults.push({ file: f, pass: actual.length === expected.length && actual.every((c, i) => c === expected[i]), expected, actual });
  }
  const fixtureSuitePass = fixtureResults.every((r) => r.pass);
  return {
    fixtureSuitePass,
    candidateShapePass: candidateErrors.length === 0,
    freezeEligible: false,
    freezeReasons: ['P1/P4-closure-root-pending', 'center-contract-v1.1-PROPOSED-not-frozen', 'v2-freeze-line-preserved', 'root-declares-M0-not-frozen'],
    fixtureResults, candidateErrors,
  };
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const recordsFile = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(DIR, '..', 'route-records-v3c.json');
  const exampleDir = process.argv[3] ? path.resolve(process.argv[3]) : path.join(DIR, 'examples');
  const out = run(recordsFile, exampleDir);
  process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  process.exitCode = out.fixtureSuitePass && out.candidateShapePass ? 0 : 1;
}
