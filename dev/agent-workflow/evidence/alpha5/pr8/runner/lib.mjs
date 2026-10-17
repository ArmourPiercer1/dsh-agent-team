// lib.mjs — PR8 负例 runner 的观测面挂钩 + 三态判定 + 结构 lint + final_declaration 代码位。
// 纯 Node ESM，零依赖、零端口、零世界；所有观测均为 fixture/记录级（INTERFACES-v1 集成规则：
// "只可宣称对 fixture/stack 验证"，禁止宣称整链已验证）。
// writer: alpha5-pr8-runner（qwen3.8-flash-next；模型/harness 分列）。

import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { grepAssemblyAnchors, evidenceRefsCheck } from '../probes/probe-lib.mjs';

export const RESULTS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', NOT_RUN: 'NOT_RUN', RLW: 'REQUIRES-LIVE-WIRING' });

// IF-7 转态词表（W8 准备轮 alpha5-wire-pr8prep）：pending_probe 行的行级转态只允许这两个值。
// 它们是"行转态"而非三态观测值——与 RESULTS 分列，永不混入 PASS 计数。
export const PROBE_TRANSITIONS = Object.freeze({ LIVE: 'LIVE', PROBE_GATED: 'PROBE-GATED' });
export const RLW_PROBE_ROWS = Object.freeze(['M-04', 'M-05', 'M-08', 'M-09', 'M-13']);
export const PROBE_LANES = Object.freeze(['W4', 'W5', 'W7']);

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ---------------------------------------------------------------- 结构 lint

export function assertMachineFinalDeclarations (machine) {
  const issues = [];
  for (const row of machine.rows ?? []) {
    if (!Object.prototype.hasOwnProperty.call(row, 'final_declaration')) {
      issues.push(`${row.row_id}: 缺 final_declaration 键——缺键按红处理（undefined 不等于 null 声明，N1）`);
      continue;
    }
    if (row.final_declaration !== null) {
      issues.push(`${row.row_id}: final_declaration 必须为 null（PENDING-GATES 全关之前由代码位强制，任何非空声明=红）`);
    }
  }
  return issues;
}

// N1：doc 矩阵缺 final_declaration 键 ⇒ 不按 undefined 静默放行：显式点名清单（不判红——补齐属上游/集成
// owner 动作，转交项见 pr8/README.md）；显式非 null 声明仍走 lintCorrespondence 判红。
export function lintDocFinalDeclaration (machine, doc) {
  const missing_key = [];
  const declared_non_null = [];
  for (const row of doc.rows ?? []) {
    if (!Object.prototype.hasOwnProperty.call(row, 'final_declaration')) {
      missing_key.push({ row_id: row.row_id, note: 'doc 候选矩阵该行无 final_declaration 键；机检矩阵侧该行显式 null。补齐键=集成 owner 转交项（N1）' });
    } else if (row.final_declaration !== null) {
      declared_non_null.push({ row_id: row.row_id, value: row.final_declaration });
    }
  }
  return { missing_key, declared_non_null };
}

export function lintCorrespondence (machine, doc, repoRoot = null) {
  const issues = [];
  issues.push(...assertMachineFinalDeclarations(machine));
  issues.push(...assertProbeRegistrations(machine, doc, repoRoot));
  for (const row of doc.rows ?? []) {
    if (row.final_declaration !== null && row.final_declaration !== undefined) {
      issues.push(`doc ${row.row_id}: final_declaration 非空（doc 矩阵同样必须全 null）`);
    }
  }
  const mIds = (machine.rows ?? []).map((r) => r.row_id);
  const dIds = (doc.rows ?? []).map((r) => r.row_id);
  for (const idList of [['machine', mIds], ['doc', dIds]]) {
    const dup = idList[1].filter((v, i, a) => a.indexOf(v) !== i);
    if (dup.length) issues.push(`${idList[0]} 行 id 重复: ${dup.join(',')}`);
  }
  const mSet = new Set(mIds); const dSet = new Set(dIds);
  for (const id of mSet) if (!dSet.has(id)) issues.push(`machine 有 doc 无: ${id}`);
  for (const id of dSet) if (!mSet.has(id)) issues.push(`doc 有 machine 无: ${id}`);
  const gaq = machine._meta?.ga_ruling?.quote ?? '';
  if (!gaq.includes('17:52Z') || !gaq.includes('不回填为 17:02 合并时已批准')) issues.push('_meta.ga_ruling.quote 未含 17:52Z 裁决与不回填边界原文');
  if (!String(machine._meta?.g_g_contract?.grading ?? '').includes('§2.2'.replace('§2.2','')) && !String(machine._meta?.g_g_contract?.ref ?? '').includes('g-g-support-contract.md')) issues.push('_meta.g_g_contract 缺 g-g-support-contract.md 引注');
  if ((machine._meta?.row_count ?? machine.rows.length) !== machine.rows.length) {
    issues.push(`machine._meta.row_count=${machine._meta?.row_count} 与 rows.length=${machine.rows.length} 不符`);
  }
  const docRows = new Map(dIds.map((id, i) => [id, doc.rows[i]]));
  const LEVELS = new Set(['E', 'D', 'UR', 'U']);
  for (const row of machine.rows ?? []) {
    if (!LEVELS.has(row.evidence_level)) issues.push(`${row.row_id}: evidence_level 越表: ${row.evidence_level}`);
    if (row.automatable !== true && row.automatable !== false) issues.push(`${row.row_id}: automatable 非布尔`);
    if (row.automatable === false && !(row.live_gate_basis ?? []).length) issues.push(`${row.row_id}: automatable=false 且无 LIVE-GATED 依据`);
    if (row.automatable === false && (row.hooks ?? []).length) issues.push(`${row.row_id}: automatable=false 却挂 hooks（伪装配嫌疑）`);
    if (row.automatable === true && !(row.hooks ?? []).length) issues.push(`${row.row_id}: automatable=true 却无 hooks`);
    const d = docRows.get(row.row_id);
    if (!d) continue;
    if (row.carried_current_status !== d.current_status) issues.push(`${row.row_id}: carried_current_status 与 doc current_status 漂移`);
    if (row.known_partial !== (d.known_partial === true)) issues.push(`${row.row_id}: known_partial 与 doc 漂移`);
    if (row.criterion !== undefined && String(row.criterion).length < 20) issues.push(`${row.row_id}: criterion 过短，非可判据`);
    if (row.g_g_related === true) {
      const t = JSON.stringify(row);
      if (!t.includes('g-g-support-contract.md')) issues.push(`${row.row_id}: G-g 相关行未引 g-g-support-contract.md 分级`);
      issues.push(...phraseLint(t, { context: 'g_g', requireGradingRef: true, rowId: row.row_id }));
    }
    if (row.ga_semantics === true) {
      const t = JSON.stringify(row);
      if (!t.includes('17:52Z')) issues.push(`${row.row_id}: G-a 语义行未引 2026-10-16 17:52Z 裁决`);
      const stripped = t.replace(/不回填为 17:02 合并时已批准/g, '');
      if (/17:02[^]{0,12}(已批准|已裁|已授权|approved|ratified)/.test(stripped)) issues.push(`${row.row_id}: 出现 17:02 回填句式`);
    }
  }
  return issues;
}

// ---------------------------------------------------------------- pending_probe 转态自锁（IF-7；W8 正式轮 F-1/F-2 修后）
// 代码位一（提交时）：assertProbeRegistrations —— 5 个 RLW 行必须全挂 pending_probe，且其形态
//   自身不得留出 PASS 通道（automatable=false、无 hooks、词表=LIVE/PROBE-GATED、显式声明禁 PASS、
//   依赖面 lane 封闭集、status_now 词表封闭、TRANSITIONED 行必须带 transition_record 且其
//   evidence_refs 逐项存在于 repo_root（F-1 提交时位）、doc 行同步 probe_script+status_now）。违例=结构 lint 直接红。
// 代码位二（运行期）：deriveProbeTransition + evaluateRow —— probe 结论里 attempt PASS / 越词表
//   终态 = VIOLATION ⇒ 行结果 FAIL（转态违例）；LIVE 必须由 runner **亲验**：装配锚点由
//   grepAssemblyAnchors 现场 grep 装配面（F-2 行形匹配，receipt 自证布尔无效）+ evidence_refs
//   逐项存在性核验（repo_root 内真实在册，F-1），任一不过 ⇒ 降级 PROBE-GATED；NOT-RUN-READY/FAIL/
//   PROBE-GATED ⇒ PROBE-GATED + 最小复现引注。非 pending_probe 行不受此位管辖（返回 null）。

const STATUS_NOW_VOCAB = Object.freeze(['PREPARED-NOT-RUN-READY', 'TRANSITIONED-LIVE', 'TRANSITIONED-PROBE-GATED']);

export function assertProbeRegistrations (machine, doc, repoRoot = null) {
  const issues = [];
  const seen = [];
  for (const row of machine?.rows ?? []) {
    const pp = row.pending_probe;
    if (!pp) continue;
    seen.push(row.row_id);
    if (row.automatable !== false) issues.push(`${row.row_id}: pending_probe 行必须 automatable=false（fixture PASS 通道对转态行封闭）`);
    if ((row.hooks ?? []).length) issues.push(`${row.row_id}: pending_probe 行禁挂 hooks——行级 PASS 证据通道不得存在（IF-7）`);
    if (!Array.isArray(pp.allowed_transitions) || !pp.allowed_transitions.includes(PROBE_TRANSITIONS.LIVE) || !pp.allowed_transitions.includes(PROBE_TRANSITIONS.PROBE_GATED)) {
      issues.push(`${row.row_id}: allowed_transitions 必须同时含 LIVE 与 PROBE-GATED（且仅此二值）`);
    } else if (pp.allowed_transitions.some((t) => t !== PROBE_TRANSITIONS.LIVE && t !== PROBE_TRANSITIONS.PROBE_GATED)) {
      issues.push(`${row.row_id}: allowed_transitions 越词表: ${pp.allowed_transitions.filter((t) => t !== 'LIVE' && t !== 'PROBE-GATED').join(',')}`);
    }
    if (!(pp.forbidden_outcomes ?? []).includes('PASS')) issues.push(`${row.row_id}: forbidden_outcomes 必须显式声明禁 PASS（无证据 PASS 路径封死声明）`);
    if (!String(pp.probe_script ?? '').startsWith('dev/agent-workflow/evidence/alpha5/pr8/probes/')) issues.push(`${row.row_id}: probe_script 必须指向 pr8/probes/ 内脚本`);
    if (!STATUS_NOW_VOCAB.includes(String(pp.status_now))) issues.push(`${row.row_id}: pending_probe.status_now 越词表: ${pp.status_now}（允许 ${STATUS_NOW_VOCAB.join('/')}）`);
    const deps = pp.depends_on ?? [];
    if (!deps.length) issues.push(`${row.row_id}: depends_on 必须声明至少一个 lane 的观测面`);
    for (const d of deps) {
      if (!PROBE_LANES.includes(d.lane) || !d.surface) issues.push(`${row.row_id}: depends_on 项须 lane∈{W4,W5,W7} 且有 surface（依赖声明=哪个 lane 的哪个观测面）`);
    }
    if (String(pp.status_now).startsWith('TRANSITIONED-')) {
      const tr = pp.transition_record;
      if (!tr || typeof tr !== 'object') {
        issues.push(`${row.row_id}: TRANSITIONED 行必须带 transition_record（转态留痕：verdict+refs/repro+run_utc）`);
      } else {
        const want = pp.status_now === 'TRANSITIONED-LIVE' ? 'LIVE' : 'PROBE-GATED';
        if (tr.verdict !== want) issues.push(`${row.row_id}: transition_record.verdict=${tr.verdict} 与 status_now=${pp.status_now} 不符`);
        const refs = tr.evidence_refs ?? [];
        if (want === 'LIVE' && !refs.length) issues.push(`${row.row_id}: TRANSITIONED-LIVE 必须有 evidence_refs（F-1 无证据不 LIVE）`);
        if (repoRoot) {
          for (const chk of evidenceRefsCheck(repoRoot, refs)) {
            if (!chk.ok) issues.push(`${row.row_id}: transition_record.evidence_refs ${chk.ref} ${chk.reason}（F-1 提交时位：假 refs 即红）`);
          }
          if (want === 'PROBE-GATED' && !existsSync(join(repoRoot, String(tr.repro_ref ?? '')))) {
            issues.push(`${row.row_id}: TRANSITIONED-PROBE-GATED 的 repro_ref 未指向在册可复跑脚本: ${tr.repro_ref}`);
          }
          if (want === 'LIVE') {
            const lanes = [...new Set(deps.map((d) => d.lane))];
            const g = grepAssemblyAnchors(repoRoot, lanes);
            if (g.missing.length) issues.push(`${row.row_id}: TRANSITIONED-LIVE 但装配锚点亲验不在场（F-2）: ${g.missing.join('；')}`);
          }
        }
      }
    }
  }
  const missing = RLW_PROBE_ROWS.filter((id) => !seen.includes(id));
  if (missing.length) issues.push(`pending_probe 缺行: ${missing.join(',')}（5 个 RLW 行必须全挂）`);
  const extra = seen.filter((id) => !RLW_PROBE_ROWS.includes(id));
  if (extra.length) issues.push(`pending_probe 越表行（只准挂 5 个 RLW 行）: ${extra.join(',')}`);
  if (doc?.rows) {
    for (const row of machine?.rows ?? []) {
      if (!row.pending_probe) continue;
      const d = doc.rows.find((x) => x.row_id === row.row_id);
      if (!d?.pending_probe || d.pending_probe.probe_script !== row.pending_probe.probe_script) {
        issues.push(`${row.row_id}: doc 矩阵 pending_probe 未同步（probe_script 须同指针）`);
      } else if (d.pending_probe.status_now !== row.pending_probe.status_now) {
        issues.push(`${row.row_id}: doc 矩阵 pending_probe.status_now 未同步（${d.pending_probe.status_now} ≠ ${row.pending_probe.status_now}）`);
      }
    }
  }
  return issues;
}

// runner 亲验装配面（F-2）：row 声明的 lanes 全部 grep 过 ⇒ true。ctx.assembly_face_ok 显式给出时
// 以显式观测为准（自测注入用）；否则现场 grep（repo_root 缺省时视为未亲验 ⇒ false）。
function rowAssemblyFaceOk (row, ctx) {
  if (typeof ctx.assembly_face_ok === 'boolean') return ctx.assembly_face_ok;
  if (!ctx.repo_root) return false;
  const lanes = [...new Set((row.pending_probe?.depends_on ?? []).map((d) => d.lane))];
  return grepAssemblyAnchors(ctx.repo_root, lanes).missing.length === 0;
}

export function deriveProbeTransition (row, outcome, ctx = {}) {
  const pp = row?.pending_probe;
  if (!pp) return null;
  if (!outcome) {
    return { probe_transition: 'PREPARED-NOT-RUN-READY', basis: 'probe 未运行（准备层挂接态）；本行不产任何通过性结论' };
  }
  const v = outcome.verdict;
  if (v === 'PASS') {
    return { probe_transition: 'VIOLATION', violation: `转态违例：pending_probe 行 ${row.row_id} 试图取 PASS——行级 PASS 非转态词表成员（allowed_transitions=[LIVE, PROBE-GATED]，forbidden_outcomes 含 PASS）；无证据路径不存在` };
  }
  if (v === 'LIVE') {
    const refs = Array.isArray(outcome.evidence_refs) ? outcome.evidence_refs : [];
    const anchorsOk = rowAssemblyFaceOk(row, ctx);
    const refsOk = refs.length > 0 && ctx.repo_root
      ? evidenceRefsCheck(ctx.repo_root, refs).every((c) => c.ok)
      : false;
    if (refsOk && anchorsOk) {
      return { probe_transition: PROBE_TRANSITIONS.LIVE, evidence_refs: refs, basis: 'runner 亲验：装配锚点行形 grep 在场 + evidence_refs 逐项存在（行级转态提案值，终裁归 PR8 正式轮+独立 reviewer；F-1/F-2 双亲验位）' };
    }
    const why = !anchorsOk
      ? '装配锚点 runner 亲验不在场（receipt 自证布尔无效，F-2 行形 grep 为准）'
      : !refs.length
        ? '缺 evidence_refs（无证据不 LIVE）'
        : 'evidence_refs 亲验不过：存在指向不存在记录或逃逸 repo_root 的 ref（F-1 逐项存在性核验，refs 必须在树在册）';
    return { probe_transition: PROBE_TRANSITIONS.PROBE_GATED, repro_ref: outcome.repro_ref ?? pp.probe_script, basis: `probe 主张 LIVE 但 ${why} ⇒ 降级 PROBE-GATED（封死假证据路径）` };
  }
  if (v === 'PROBE-GATED' || v === 'NOT-RUN-READY' || v === 'FAIL') {
    return { probe_transition: PROBE_TRANSITIONS.PROBE_GATED, repro_ref: outcome.repro_ref ?? pp.probe_script, basis: `probe verdict=${v} ⇒ 按 IF-7 落 PROBE-GATED+最小复现（probe 脚本自身可复跑）` };
  }
  return { probe_transition: 'VIOLATION', violation: `转态违例：probe verdict "${String(v)}" 越出封闭词表 [LIVE, PROBE-GATED, NOT-RUN-READY, FAIL]` };
}

// ---------------------------------------------------------------- 措辞 lint（G-5 风格，本 lane 自用子集）

const FORBIDDEN_GG = [
  [/fail[-\s]?closed[^]{0,8}(已证|已验证|已确认|proven|confirmed|demonstrated)/i, 'G-g 语境禁 "fail-closed 已证/proven"（seam-record RETRACTION + 契约 §4.2）'],
  [/静默[^]{0,24}(已验收|已合规|compliant)/, 'G-g 语境禁"已验收/已合规"（PENDING-GATES G-g 行：收口前=UNSUPPORTED/待证）'],
  [/silent[^]{0,24}(fail[-\s]?closed[^]{0,8}(proven|confirmed))/i, 'G-g 语境禁 fail-closed proven（契约 §4.2 禁则）'],
  [/暴露恰为一次调用/, '"暴露恰为一次调用"口径已明文撤回（seam-record-post-door-resolution.md:99-122）'],
];

// 引注/禁则转述 allowlist（对齐契约 §3 G-5 的引注 allowlist 思路）：被禁止词以"禁则原文/转述"形态出现不算违规，
// 只有断言形态（fail-closed 已证 等）才算。剥除 allowlist 片段后再跑禁则。
const GG_ALLOWLIST_PATTERNS = [
  /禁\s*fail-closed\/closed\/已合规\/compliant\/无引注 SUPPORTED\/暴露恰为一次调用/g,
  /绝不输出 fail-closed 已证/g,
  /禁则[^]{0,80}?(转述|原文)/g,
];

export function phraseLint (text, opts = {}) {
  const issues = [];
  if (opts.context === 'g_g') {
    let stripped = text;
    for (const allow of GG_ALLOWLIST_PATTERNS) stripped = stripped.replace(allow, '');
    for (const [re, why] of FORBIDDEN_GG) {
      if (re.test(stripped)) issues.push(`措辞违规: ${why}`);
    }
  }
  if (opts.requireGradingRef && !/§2\.2|分级|P[1-9]\s*[=＝]/.test(text)) {
    issues.push('G-g 相关行须引用 g-g-support-contract.md §2.2 分级表');
  }
  return issues;
}

// ---------------------------------------------------------------- 观测面挂钩（全部 fixture/记录级）

function res (status, extra = {}) { return { status, ...extra }; }

export function runFixtureSurface (repoRoot, hook) {
  const missingFiles = [];
  const missingAnchors = [];
  for (const f of hook.files ?? []) {
    const abs = join(repoRoot, f.path);
    if (!existsSync(abs)) { missingFiles.push(f.path); continue; }
    const text = readFileSync(abs, 'utf8');
    for (const a of f.anchors ?? []) {
      if (!text.includes(a)) missingAnchors.push(`${f.path} :: ${a}`);
    }
    for (const a of f.absent_anchors ?? []) {
      if (text.includes(a)) missingAnchors.push(`${f.path} :: 不应出现而实存 [${a}]`);
    }
  }
  if (missingAnchors.length) return res(RESULTS.FAIL, { reason: `锚点缺失: ${missingAnchors.join(' | ')}` });
  if (missingFiles.length) {
    if (hook.environment_prerequisite) {
      return res(RESULTS.NOT_RUN, { reason: `观测面文件缺 (${missingFiles.join(', ')})：${hook.environment_prerequisite}` });
    }
    return res(RESULTS.FAIL, { reason: `面文件缺失（机检矩阵声称在册）: ${missingFiles.join(', ')}` });
  }
  return res(RESULTS.PASS, { scope: 'fixture-structural', files: (hook.files ?? []).length });
}

export function runRecordedEvidence (repoRoot, hook) {
  const abs = join(repoRoot, hook.path);
  if (!existsSync(abs)) {
    return res(RESULTS.NOT_RUN, { reason: `记录文件缺${hook.recorded_elsewhere_ref ? `（在册他处：${hook.recorded_elsewhere_ref}）` : ''}: ${hook.path}` });
  }
  let data;
  try { data = readJson(abs); } catch (e) { return res(RESULTS.FAIL, { reason: `记录 JSON 不可解析: ${hook.path}: ${e.message}` }); }
  let detail = {};
  if (hook.expect_field_path) {
    let cur = data;
    for (const seg of hook.expect_field_path.split('.')) { cur = cur?.[seg]; }
    if (cur === undefined) return res(RESULTS.FAIL, { reason: `${hook.path} 缺字段 ${hook.expect_field_path}` });
    if (hook.expect_field_value !== undefined && JSON.stringify(cur) !== JSON.stringify(hook.expect_field_value)) {
      return res(RESULTS.FAIL, { reason: `${hook.path} ${hook.expect_field_path}=${JSON.stringify(cur)} ≠ 期望 ${JSON.stringify(hook.expect_field_value)}` });
    }
    detail.field = { path: hook.expect_field_path, value: cur };
    if (!hook.collection) return res(RESULTS.PASS, { scope: 'recorded-evidence', path: hook.path, ...detail });
  }
  if (!hook.collection) return res(RESULTS.PASS, { scope: 'recorded-evidence-existence', path: hook.path });
  const coll = Array.isArray(data[hook.collection]) ? data[hook.collection] : null;
  if (coll === null) return res(RESULTS.FAIL, { reason: `${hook.path} 无集合 ${hook.collection}` });
  const passCount = coll.filter((x) => x && (x.ok === true || x.match === true || x.verdict === 'PASS')).length;
  detail = { ...detail, total: coll.length, pass: passCount };
  if (Number.isInteger(hook.expected_total) && coll.length !== hook.expected_total) {
    return res(RESULTS.FAIL, { reason: `${hook.path} ${hook.collection} 总数 ${coll.length} ≠ 期望 ${hook.expected_total}`, ...detail });
  }
  if (Number.isInteger(hook.expected_pass) && passCount !== hook.expected_pass) {
    return res(RESULTS.FAIL, { reason: `${hook.path} ${hook.collection} 判过数 ${passCount} ≠ 期望 ${hook.expected_pass}`, ...detail });
  }
  if (hook.verdict_token && data.verdict !== hook.verdict_token) {
    return res(RESULTS.FAIL, { reason: `${hook.path} verdict=${String(data.verdict)} ≠ 期望 ${hook.verdict_token}`, ...detail });
  }
  return res(RESULTS.PASS, { scope: 'recorded-evidence', path: hook.path, ...detail });
}

export function runKitRerun (repoRoot, hook) {
  const missing = [];
  for (const p of hook.prereq_paths ?? []) if (!existsSync(join(repoRoot, p))) missing.push(p);
  if (missing.length) {
    return Promise.resolve(res(RESULTS.NOT_RUN, {
      reason: `kit 前置不齐（拒绝伪造 PASS）: ${missing.join(' , ')}${hook.prereq_note ? ` — ${hook.prereq_note}` : ''}`,
    }));
  }
  return new Promise((resolveFn) => {
    const out = [];
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; resolveFn(r); } };
    let child;
    try {
      child = spawn(process.execPath, [join(repoRoot, hook.kit)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return finish(res(RESULTS.NOT_RUN, { reason: `spawn 失败: ${e.message}` }));
    }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } }, hook.timeout_ms ?? 120000);
    child.stdout.on('data', (b) => { if (out.join('').length < 400000) out.push(String(b)); });
    child.stderr.on('data', (b) => { if (out.join('').length < 400000) out.push(`[E] ${String(b)}`); });
    child.on('error', (e) => { clearTimeout(timer); finish(res(RESULTS.NOT_RUN, { reason: `kit spawn 错误: ${e.message}` })); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = out.join('');
      const lines = text.split('\n');
      const passLines = lines.filter((l) => /^PASS \S+:/.test(l));
      const failLines = lines.filter((l) => /^FAIL \S+:/.test(l));
      if (text.includes('FATAL')) return finish(res(RESULTS.NOT_RUN, { reason: `kit FATAL（环境前置，原文摘要）: ${text.slice(0, 300)}` }));
      if (!passLines.length && !failLines.length) return finish(res(RESULTS.FAIL, { reason: `kit 无判据输出行（exit=${String(code)}）` }));
      if (failLines.length || code !== 0) {
        return finish(res(RESULTS.FAIL, { reason: `criteria FAIL=${failLines.length} exit=${String(code)}；首条: ${failLines[0] ?? ''}`.slice(0, 400) }));
      }
      return finish(res(RESULTS.PASS, { scope: 'kit-criterion（fixture in-process，钉定 registry，无端口）', criteria_pass: passLines.length }));
    });
  });
}

export async function runP4t6ReadonlyScan (repoRoot, hook = {}) {
  const scanner = join(repoRoot, 'packages/testkit/fault-injection/session-event-scan.mjs');
  if (!existsSync(scanner)) return res(RESULTS.NOT_RUN, { reason: 'p4t6 scanner 模块不在树内' });
  const QUARANTINE = new Set(['packages/contracts/src/legacy-vocabulary.ts', 'packages/contracts/test/negative.test.ts']);
  try {
    const mod = await import(pathToFileURL(scanner).href);
    const scan = mod.scanSessionEventVocabulary({ repoRoot });
    const outside = (scan.hits ?? []).filter((h) => !QUARANTINE.has(h.file));
    if (outside.length) return res(RESULTS.FAIL, { reason: `隔离区外词表命中 ${outside.length} 条: ${outside.slice(0, 3).map((h) => `${h.file}:${h.line}`).join(' , ')}` });
    return res(RESULTS.PASS, { scope: 'p4t6 read-only query', scanned_files: scan.filesScanned, quarantine_hits: (scan.hits ?? []).length });
  } catch (e) {
    return res(RESULTS.NOT_RUN, { reason: `p4t6 只读查询不可执行: ${e.message}` });
  }
}

// ---------------------------------------------------------------- PENDING-GATES 台账与 final_declaration 代码位

// 台账唯一权威 = dev/agent-workflow/PENDING-GATES.md（PENDING-GATES.md「唯一权威声明」行）。
// 本 ref（origin/master）尚无该文件 ⇒ 台账状态只能按 ABSENT-AS-OPEN 处理（fail-closed：缺登记=门未关）。
export function readGatesLedger (repoRoot, overridePath) {
  const p = overridePath ? resolve(repoRoot, overridePath) : join(repoRoot, 'dev/agent-workflow/PENDING-GATES.md');
  if (!existsSync(p) || !lstatSync(p).isFile()) {
    return { present: false, status: 'ABSENT-AS-OPEN', open_ids: ['__ledger-absent__'], closed_ids: [], path: p,
      note: 'dev/agent-workflow/PENDING-GATES.md 不在本 ref 树内；按 fail-closed 视为全部门未关（G-a/G-g/G-d 等行在 origin/alpha5-pr1r-followup 台账中为开放/裁决态）' };
  }
  const text = readFileSync(p, 'utf8');
  const open = []; const closed = []; const rows = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*\*{0,2}(G-[a-g]|D-\d)\*{0,2}\s*\|(.*)$/);
    if (!m) continue;
    const cells = m[2].split('|').map((c) => c.trim());
    const statusCell = cells.join(' ');
    rows[m[1]] = statusCell;
    const isClosed = /\*\*(CLOSED|已关闭|收口)\*\*|(?:^|[\s|>])(CLOSED|已关闭|收口)(?:[\s|（(]|$)/i.test(statusCell)
      && !/(未关闭|仍开放|保持.?开放|不得默认关闭|开放|DEFERRED|延期|修复中|未开始|未裁|QUEUED|待)/.test(statusCell);
    (isClosed ? closed : open).push(m[1]);
  }
  if (!open.length && !closed.length) {
    return { present: true, status: 'ABSENT-AS-OPEN', open_ids: ['__no-gate-rows-parsed__'], closed_ids: [], path: p, note: '台账存在但未解析到 G-x/D-x 行；fail-closed 视为开放' };
  }
  return { present: true, status: open.length ? 'OPEN' : 'ALL-CLOSED', open_ids: open, closed_ids: closed, rows, path: p };
}

// 代码位强制：final_declaration 恒 null，直到 ①台账 ALL-CLOSED 且 ②该行在机检矩阵中带
// 显式 non-null 候选值——而 assertMachineFinalDeclarations 使"non-null 候选"在本轮任何提交里直接判红，
// 两道闸都过才可能有非空输出。当前矩阵 32 行候选全 null ⇒ 输出必为 null。
export function deriveFinalDeclaration (row, gates) {
  if (!gates || gates.status !== 'ALL-CLOSED') return null;
  const candidate = row?.final_declaration;
  if (candidate === null || candidate === undefined) return null;
  return candidate;
}

// ---------------------------------------------------------------- 三态判定

export async function evaluateRow (row, ctx = {}) {
  if (row.automatable !== true) {
    const out = {
      row_id: row.row_id,
      result: RESULTS.RLW,
      evidence_level: row.evidence_level,
      basis: row.live_gate_basis ?? [],
      note: 'REQUIRES-LIVE-WIRING：本行为 live 必需/未接线，未产任何通过性结论；不得计入 PASS/FAIL。',
    };
    if (row.pending_probe) {
      // 代码位二（运行期）：转态只可能 LIVE / PROBE-GATED；PASS 尝试 ⇒ FAIL+违例注记。
      // outcome 优先取本轮 fresh probe_outcomes，缺省回落行上 transition_record（W8 轮在册转态，
      // 复跑仍走同一亲验位：refs 存在性 + 装配锚点 grep，在册≠免检）。
      const fresh = ctx.probe_outcomes?.[row.row_id];
      const outcome = fresh ?? row.pending_probe.transition_record ?? undefined;
      const t = deriveProbeTransition(row, outcome, ctx);
      out.probe_transition = t.probe_transition;
      if (outcome) out.probe_outcome_source = fresh ? 'fresh' : 'recorded-transition_record';
      if (t.basis) out.probe_basis = t.basis;
      if (t.repro_ref) out.repro_ref = t.repro_ref;
      if (t.evidence_refs) out.evidence_refs = t.evidence_refs;
      if (t.probe_transition === PROBE_TRANSITIONS.LIVE) {
        out.result = PROBE_TRANSITIONS.LIVE;
        out.note = '行级转态提案=LIVE（receipt 证据在册）；终裁归 PR8 正式轮 + 独立 reviewer，本行永不落 PASS 桶。';
      } else if (t.probe_transition === PROBE_TRANSITIONS.PROBE_GATED) {
        out.result = PROBE_TRANSITIONS.PROBE_GATED;
        out.note = 'IF-7：REQUIRES-LIVE 非终态 ⇒ 落 PROBE-GATED+最小复现（repro_ref 在册）。';
      } else if (t.probe_transition === 'VIOLATION') {
        out.result = RESULTS.FAIL;
        out.violation = t.violation;
        out.note = `转态违例判红：${t.violation}`;
      }
    }
    return out;
  }
  const hookResults = [];
  for (const hook of row.hooks ?? []) {
    let r;
    try {
      if (hook.kind === 'fixture-surface') r = runFixtureSurface(ctx.repo_root, hook);
      else if (hook.kind === 'recorded-evidence') r = runRecordedEvidence(ctx.repo_root, hook);
      else if (hook.kind === 'kit-rerun') r = await runKitRerun(ctx.repo_root, hook);
      else if (hook.kind === 'p4t6-readonly-scan') r = await runP4t6ReadonlyScan(ctx.repo_root, hook);
      else r = res(RESULTS.FAIL, { reason: `未知 hook.kind: ${hook.kind}` });
    } catch (e) {
      r = res(RESULTS.FAIL, { reason: `hook 异常: ${e.message}` });
    }
    hookResults.push({ kind: hook.kind, label: hook.label ?? hook.kind, ...r });
  }
  const anyFail = hookResults.some((h) => h.status === RESULTS.FAIL);
  const anyNR = hookResults.some((h) => h.status === RESULTS.NOT_RUN);
  let result = anyFail ? RESULTS.FAIL : anyNR ? RESULTS.NOT_RUN : RESULTS.PASS;
  if (row.pending_probe && result === RESULTS.PASS) {
    // 运行期兜底第二道（提交时 lint 已封）：pending_probe 行即便被塞进 hooks，也永不落 PASS。
    return {
      row_id: row.row_id,
      result: RESULTS.FAIL,
      evidence_level: row.evidence_level,
      violation: '转态违例：pending_probe 行经 hooks 得到 PASS——fixture 通道不得为行级转态供证（IF-7）',
      hooks: hookResults,
    };
  }
  return {
    row_id: row.row_id,
    result,
    evidence_level: row.evidence_level,
    scope: 'criterion-level-fixture（不构成整链验收；final_declaration 维持 null）',
    hooks: hookResults,
  };
}

export function computeDistribution (rows) {
  const d = { PASS: 0, FAIL: 0, NOT_RUN: 0, REQUIRES_LIVE_WIRING: 0, LIVE: 0, PROBE_GATED: 0, TOTAL: rows.length, by_level: {} };
  for (const r of rows) {
    if (r.result === RESULTS.PASS) d.PASS += 1;
    else if (r.result === RESULTS.FAIL) d.FAIL += 1;
    else if (r.result === RESULTS.NOT_RUN) d.NOT_RUN += 1;
    else if (r.result === RESULTS.RLW) d.REQUIRES_LIVE_WIRING += 1;
    // 行级转态与三态观测分桶（IF-7）：LIVE/PROBE-GATED 永不计入 PASS。
    else if (r.result === PROBE_TRANSITIONS.LIVE) d.LIVE += 1;
    else if (r.result === PROBE_TRANSITIONS.PROBE_GATED) d.PROBE_GATED += 1;
    const key = `${r.evidence_level}|${r.result === RESULTS.RLW || r.result === PROBE_TRANSITIONS.LIVE || r.result === PROBE_TRANSITIONS.PROBE_GATED ? 'not-automatable' : 'automatable'}`;
    d.by_level[key] = (d.by_level[key] ?? 0) + 1;
  }
  return d;
}
