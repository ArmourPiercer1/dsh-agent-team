// probe-lib.mjs — W8 正式轮（alpha5-wire-pr8）：RLW 行 live probe 的共享执行骨架（F-1/F-2 修后形态）。
// 契约（IF-7 判据语言）：probe 结论词表封闭为 LIVE / PROBE-GATED / NOT-RUN-READY / FAIL 四个 VERDICT，
// 永不输出 VERDICT PASS——PASS 不是行级终态（WIRING-PHASE-PLAN IF-7：REQUIRES-LIVE 禁为本阶段终态，
// 要么转 LIVE 要么 PROBE-GATED+最小复现；"fixture 冒充 LIVE"的路一并封死）。
//
// W8 正式轮两处机制修正（review-W8prep F-1/F-2，正式轮读机制前的前置必修）：
//  F-2 锚点契约改"装配面 + 行形匹配"：装配在场信号 = 已合并 lane kit 的装配面文件中，绑定级代码形
//     （工厂调用 / dist 公开 barrel 动态 import / lane 编译产物模块路径）在**非注释行**上出现。
//     注释提及、字符串裸子串一律不过（prep 轮的 agent-bindings 裸子串预检可被一行注释骗过，已废弃）。
//     装配面 = W4 `evidence/alpha5/w4/a5w4-provider-row.mjs`、W5 `evidence/alpha5/wiring/w5/a5w5-{assembly-row,fixtures}.mjs`、
//     W7 `tests/kits/a5-w7-jobs-wiring/{a5w7-jobs-plugin.mjs,tsconfig.lane.json}`（IF-1 公开 seam 装配 row，
//     均在 master 现势在册）。旧表把 registry 套件 run≠null / jobs-gateway tsconfig include 当装配信号——
//     二者实为 GLUE/PR8-build 后续工作项（F-6 已披露），不再是本 probe 的门；相应缺口如实登在
//     vnext-migration-gap-checklist.md 与矩阵 disclosed_gaps，不由锚点表隐藏。
//  F-1 证据真实性：LIVE 只能由 runner/probe **亲验**得出——(a) 装配锚点由本文件 grepAssemblyAnchors
//     现场 grep（receipt 里 assembly_anchors_verified 自证布尔无效，仅如实转印）；(b) evidence_refs
//     逐项存在性核验（repo_root 内相对路径；缺文件或逃逸 repo_root ⇒ 降级 PROBE-GATED）。
// 失败即真相：装配面不在场（如假想无装配根）⇒ 运行即 NOT-RUN-READY exit 3 并逐条打印缺装配原因
// （MISSING-ASSEMBLY），禁假 PASS。
// 零端口、零 DSH_HOME 世界、纯只读观测；不 import upstream。
// writer: alpha5-wire-pr8 W8 正式轮（qwen3.8-flash-next；模型/harness 分列；基线 prep 轮 ed259796）。

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERDICT = Object.freeze({
  LIVE: 'LIVE',
  PROBE_GATED: 'PROBE-GATED',
  NOT_RUN_READY: 'NOT-RUN-READY',
  FAIL: 'FAIL',
});

export const EXIT = Object.freeze({ LIVE: 0, FAIL: 2, NOT_RUN_READY: 3, PROBE_GATED: 4 });

// ---------------------------------------------------------------- 装配面锚点契约（F-2）
// 每 lane = 装配面文件集 × 绑定级代码形（regex source 串，逐行在**非注释行**上匹配）。
// lane 若改以别的面暴露装配，须回报协调者改此表——probe 内禁私放宽松判据。
export const ASSEMBLY_FACES = Object.freeze({
  W4: {
    lane: 'W4',
    surface: 'provider 工厂→测试会话装配（w4 kit row：真实 Landlock spawn+执行观测；不可用 profile 启动前 typed 拒 IO_POLICY_UNSUPPORTED；Landlock 在场/撤销对照）',
    files: [
      {
        path: 'dev/agent-workflow/evidence/alpha5/w4/a5w4-provider-row.mjs',
        shapes: [
          { re: String.raw`mod\.createConfinedProcessProvider\s*\(`, why: 'Lane C provider 工厂在装配 row 内被实际调用（调用形）' },
          { re: String.raw`import\(pathToFileURL\(join\(DIST,[^)]*'sandbox-provider'`, why: 'dist 公开 barrel（sandbox-provider/index.js）被实际动态 import' },
        ],
      },
    ],
  },
  W5: {
    lane: 'W5',
    surface: 'search/shell 工具面经 admission 门控装配（w5 kit row：编译 lane 装载 + bind→grant→exec-edge→spill 生命周期 + shell parity 双腿）',
    files: [
      {
        path: 'dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs',
        shapes: [
          { re: String.raw`fx\.loadA5W5Lanes\s*\(`, why: 'lane 编译产物经 fixtures 端口被装配 row 实际装载（调用形）' },
        ],
      },
      {
        path: 'dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-fixtures.mjs',
        shapes: [
          { re: String.raw`packages/tools/a5p5-tools/src`, why: 'a5p5 lane 模块路径在装载代码上（模块绑定形）' },
        ],
      },
    ],
  },
  W7: {
    lane: 'W7',
    surface: 'jobs 身份/lease 经 jobs-gateway 公开 barrel 装配（w7 kit row：两 member 同宿主隔离 + lease 互斥 + revocation；pinned absent-anchor job_start 仍如实 absent）',
    files: [
      {
        path: 'tests/kits/a5-w7-jobs-wiring/a5w7-jobs-plugin.mjs',
        shapes: [
          { re: String.raw`mod\.createJobsGateway\s*\(`, why: 'jobs-gateway 工厂在装配 row 内被实际调用（调用形）' },
          { re: String.raw`await import\(directive\.gatewayUrl\)`, why: 'lane 公开 barrel 经动态 import 实际装载（import 形）' },
        ],
      },
      {
        path: 'tests/kits/a5-w7-jobs-wiring/tsconfig.lane.json',
        shapes: [
          { re: String.raw`packages/runtime/jobs-gateway`, why: 'kit-local 编译面覆盖 lane 源（编译在场；runtime tsconfig include 归 GLUE 队列，缺口在差距检查表在册）' },
        ],
      },
    ],
  },
});

export const PROBE_LANES = Object.freeze(['W4', 'W5', 'W7']);

// 行形匹配核心：跳过整行注释（//、*、/*），剥行尾注释（保留 :// 如 file://），再测绑定形。
function stripInlineComment (line) {
  return line.replace(/(^|[^:\\])\/\/.*$/, '$1');
}
function isCodeLine (raw) {
  const t = raw.trim();
  if (!t) return false;
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
  return true;
}

// grepAssemblyAnchors(repoRoot, lanes) → { present: [lane…], missing: [detail…] }
// runner/probe 共用的亲验位：装配面文件缺、或任一绑定形在所有非注释代码行上都不出现 ⇒ missing（F-2）。
export function grepAssemblyAnchors (repoRoot, lanes = PROBE_LANES) {
  const present = [];
  const missing = [];
  for (const lane of lanes) {
    const face = ASSEMBLY_FACES[lane];
    if (!face) { missing.push(`${lane}: 锚点表无此 lane（越表）`); continue; }
    let laneOk = true;
    for (const f of face.files) {
      const abs = join(repoRoot, f.path);
      if (!existsSync(abs)) { missing.push(`${lane}: 装配面文件不在树内 ${f.path}`); laneOk = false; continue; }
      const lines = readFileSync(abs, 'utf8').split('\n');
      for (const s of f.shapes) {
        const re = new RegExp(s.re);
        const hit = lines.some((raw) => isCodeLine(raw) && re.test(stripInlineComment(raw)));
        if (!hit) { missing.push(`${lane}: ${f.path} 无绑定级锚点形 /${s.re}/（注释/裸子串不算；${s.why}）`); laneOk = false; }
      }
    }
    if (laneOk) present.push(lane);
  }
  return { present, missing };
}

// F-1 refs 存在性：repo_root 内相对路径、逐项存在（禁绝对路径/上跳逃逸）。
export function evidenceRefsCheck (repoRoot, refs) {
  const out = [];
  const rootAbs = resolve(repoRoot);
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.length || ref.startsWith('/') || /^[A-Za-z]:[\\/]/.test(ref) || ref.split(/[\\/]/).includes('..')) {
      out.push({ ref, ok: false, reason: 'ref 必须是 repo_root 内相对路径（禁绝对路径/..）' });
      continue;
    }
    const abs = resolve(rootAbs, ref);
    if (!abs.startsWith(rootAbs + sep) && abs !== rootAbs) { out.push({ ref, ok: false, reason: 'ref 解析后逃逸 repo_root' }); continue; }
    let isFile = false;
    try { isFile = existsSync(abs) && statSync(abs).isFile(); } catch { isFile = false; }
    out.push(isFile ? { ref, ok: true } : { ref, ok: false, reason: '指向不存在的记录' });
  }
  return out;
}

function fieldPath (obj, dotted) {
  let cur = obj;
  for (const seg of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return { found: false };
    cur = cur[seg];
  }
  return { found: true, value: cur };
}

// 断言子句 helper：receipt 数据缺 ⇒ NOT-EXECUTED（门禁态，不猜）；数据在而值不符 ⇒ VIOLATED（真违例）。
export function clauseField (receipt, path, expectEq, why) {
  const r = fieldPath(receipt, path);
  if (!r.found) return { status: 'NOT-EXECUTED', detail: `receipt 缺字段 ${path}（${why}）` };
  if (expectEq !== undefined && JSON.stringify(r.value) !== JSON.stringify(expectEq)) {
    return { status: 'VIOLATED', detail: `${path}=${JSON.stringify(r.value)} ≠ 期望 ${JSON.stringify(expectEq)}（${why}）` };
  }
  return { status: 'SATISFIED', detail: `${path}=${JSON.stringify(r.value)}（${why}）` };
}

export function clauseContains (receipt, arrayPath, matcher, why) {
  const r = fieldPath(receipt, arrayPath);
  if (!r.found || !Array.isArray(r.value)) return { status: 'NOT-EXECUTED', detail: `receipt 缺数组 ${arrayPath}（${why}）` };
  const hit = r.value.find((el) => el && Object.entries(matcher).every(([k, v]) => JSON.stringify(el[k]) === JSON.stringify(v)));
  if (!hit) return { status: 'VIOLATED', detail: `${arrayPath} 无满足 ${JSON.stringify(matcher)} 的记录（${why}）` };
  return { status: 'SATISFIED', detail: `${arrayPath} 含 ${JSON.stringify(matcher)}（${why}）` };
}

// preflight：kind='face' → 该 lane 装配面 grep（行形）；kind='lanes' → 多 lane 一次核。
// （prep 轮的 kind='anchor' 裸子串与 kind='registry-run' run≠null 预检已废——前者注释可骗、
// 后者是 GLUE/PR8-build 工作项而非装配信号，见头注与差距检查表。）
export function facePreflight (repoRoot, lanes) {
  return grepAssemblyAnchors(repoRoot, lanes);
}

export async function runProbe (spec, argv = process.argv.slice(2)) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const argVal = (name, dflt) => { const i = argv.indexOf(name); return i === -1 ? dflt : argv[i + 1]; };
  const repoRoot = resolve(argVal('--repo-root', resolve(HERE, '..', '..', '..', '..', '..', '..')));
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };
  const stamp = new Date().toISOString();
  say(`# probe-${spec.rowId} (${spec.family}) run-utc=${stamp} repo-root=${repoRoot}`);
  for (const d of spec.deps) say(`DEPEND ${d.lane} surface="${d.surface}" if=[${(d.if_refs ?? []).join(',')}]`);

  // 1) 装配预检（runner 亲验 grep 装配面）：任一缺失 ⇒ NOT-RUN-READY（先于一切断言；禁假 PASS 的第一道位）。
  const lanes = [...new Set(spec.preflight.map((c) => c.lane))];
  const face = grepAssemblyAnchors(repoRoot, lanes);
  for (const lane of lanes) {
    if (face.present.includes(lane)) say(`CHECK face:${lane} lane=${lane} present (binding-shape grep)`);
    else for (const m of face.missing.filter((x) => x.startsWith(`${lane}:`))) say(`MISSING-ASSEMBLY ${lane} ${(ASSEMBLY_FACES[lane] ?? {}).surface ?? lane} :: ${m}`);
  }
  const missing = face.missing;
  const finish = (verdict, exitCode, extra = []) => {
    for (const e of extra) say(e);
    say(`# VERDICT ${verdict} exit=${exitCode}`);
    process.exitCode = exitCode;
  };
  if (missing.length) {
    finish(VERDICT.NOT_RUN_READY, EXIT.NOT_RUN_READY, [
      `NOT-RUN-READY ${spec.rowId}：装配面未在场（上方 MISSING-ASSEMBLY 逐条为缺装配原因，行形 grep 亲验），本 probe 未执行任何通过性断言；转态只允许 LIVE/PROBE-GATED（见 matrix pending_probe.transition_rule）。`,
      `MINIMAL-REPRO ${spec.probeRelPath}（重跑本脚本即复现缺装配态）`,
    ]);
    return;
  }
  say('ANCHORS runner-grep=PRESENT (binding shapes on non-comment lines; receipt claim ignored)');

  // 2) 装配在场：读 receipt（live 轮记录）。receipt 缺 ⇒ PROBE-GATED（最小复现=本脚本+缺 receipt 说明）。
  const receiptRel = argVal('--receipt', spec.receiptRelPath);
  const receiptAbs = join(repoRoot, receiptRel);
  if (!existsSync(receiptAbs)) {
    finish(VERDICT.PROBE_GATED, EXIT.PROBE_GATED, [
      `PROBE-GATED ${spec.rowId}：装配锚点在场但 live receipt 缺（${receiptRel}）——无记录不判 LIVE；最小复现已登记。`,
      `MINIMAL-REPRO ${spec.probeRelPath} --receipt ${receiptRel}`,
    ]);
    return;
  }
  let receipt;
  try { receipt = JSON.parse(readFileSync(receiptAbs, 'utf8')); } catch (e) {
    finish(VERDICT.FAIL, EXIT.FAIL, [`FAIL ${spec.rowId}：receipt 不可解析: ${e.message}`]);
    return;
  }
  if (receipt.assembly_anchors_verified !== undefined) {
    say(`RECEIPT-CLAIM assembly_anchors_verified=${JSON.stringify(receipt.assembly_anchors_verified)} （转印备案；F-1 后本布尔不参与判定，锚点在场以 runner grep 为准）`);
  }

  // 3) 逐断言（观测 receipt 记录；全 SATISFIED 且 evidence_refs 逐项亲验存在 ⇒ LIVE）。
  let violated = 0; let notExecuted = 0;
  for (const a of spec.assertions) {
    let out;
    try { out = a.run(receipt); } catch (e) { out = { status: 'VIOLATED', detail: `断言异常: ${e.message}` }; }
    say(`ASSERT ${a.id} ${out.status} :: ${out.detail}`);
    if (out.status === 'VIOLATED') violated += 1;
    if (out.status === 'NOT-EXECUTED') notExecuted += 1;
  }
  const evidenceRefs = Array.isArray(receipt.evidence_refs) ? receipt.evidence_refs : [];
  if (violated) {
    finish(VERDICT.FAIL, EXIT.FAIL, [`FAIL ${spec.rowId}：${violated} 条断言违例（live 观测与判据冲突，行不得转 LIVE）`]);
    return;
  }
  const gate = (reason) => {
    finish(VERDICT.PROBE_GATED, EXIT.PROBE_GATED, [
      `PROBE-GATED ${spec.rowId}：${reason}`,
      `MINIMAL-REPRO ${spec.probeRelPath} --receipt ${receiptRel}`,
    ]);
  };
  if (notExecuted) {
    const gaps = spec.assertions.map((a) => a.id).filter((id) => lines.some((l) => l.startsWith(`ASSERT ${id} NOT-EXECUTED`)));
    return gate(`断言未闭环：[${gaps.join(', ')}] 无观测数据（receipt 字段缺=该观测腿在装配面上不存在，精确缺项见上 ASSERT 行）；保持门禁不猜。`);
  }
  if (!evidenceRefs.length) return gate('断言全 SATISFIED 但 evidence_refs 为空——无证据不 LIVE（转态自锁，IF-7）。');
  const refs = evidenceRefsCheck(repoRoot, evidenceRefs);
  const bad = refs.filter((r) => !r.ok);
  if (bad.length) return gate(`evidence_refs 亲验不过（F-1）：${bad.map((b) => `${b.ref}(${b.reason})`).join('；')}——refs 必须指向 repo_root 内真实在册记录。`);
  finish(VERDICT.LIVE, EXIT.LIVE, [
    `EVIDENCE ${evidenceRefs.join(' ')}`,
    `LIVE ${spec.rowId}：装配锚点 runner 亲验在场 + receipt 全断言 SATISFIED + evidence_refs 逐项存在性亲验过（行级转态提案值=LIVE，终裁归 PR8 正式轮 + 独立 reviewer）。`,
  ]);
}

export const probeRelPath = (rowId) => `dev/agent-workflow/evidence/alpha5/pr8/probes/probe-${rowId}.mjs`;
export const receiptRelPath = (rowId) => `dev/agent-workflow/evidence/alpha5/pr8/probes/receipts/${rowId}.receipt.json`;
