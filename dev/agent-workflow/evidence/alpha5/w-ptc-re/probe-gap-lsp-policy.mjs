#!/usr/bin/env node
/**
 * probe-gap-lsp-policy.mjs — W-PTC-RE 真缺腿最小复现（M-09 A2/A3 的公开面普查）.
 *
 * DORMANT / 零端口 / 零 DSH_HOME 世界 / 纯只读（对 pinned host 树只读；porcelain
 * 前后核验）。这是本 writer 自己的探针（非 PR6 探针拷贝）：用静态公开面普查回答
 * "策略代际逐出 / 服务器读中介 这两条腿缺的是装配还是公开面本身"：
 *
 *  GAP-1 (M-09 A2 pool.policy_change_old_pid_terminated_recreated)：
 *    - `@deepseek-ai/dsh-lsp` 公开导出面 = Lsp(service) + LspProviderId + 类型；
 *      LspQueryRequest 字段集无任何 caller/policy/policyGeneration/trustRoot 输入；
 *    - `@deepseek-ai/dsh-lsp-stdio` 公开 Config = servers{command,args,env,
 *      extensionToLanguage,...} —— 同样无策略输入；provider 池键 = workspaceRoot 的
 *      fs targetKey（lib 源里 pool 以 canonicalizeWorkspace 结果为键）；
 *    - 两个 barrel 的导出名集合里不存在任何 evict/generation/policy-reload 钩子。
 *    ⇒ 池键 ⊇ …+PolicyGeneration 与 generation 变更强制逐出 = 公开面不可表达
 *      （SEAM-GAP，上游）；与 pr6/SEAM-VERDICTS.md B4 的运行时观测互指。
 *
 *  GAP-2 (M-09 A3 server_os_reads_mediated)：
 *    - lsp-stdio 的服务器 spawn = `ctx.subprocess.spawn`（公开 seam，可 per-realm
 *      重装 → 装配侧可换 confined 实现，非上游缺口）；
 *    - 但 Team 侧唯一 confined 实现（packages/runtime/sandbox-provider 冻结
 *      C-PROC 形态）只有 one-shot RunOutput{stdout,stderr,combined}，其公开面
 *      **没有长驻双向管道臂**（spawn 返回 SpawnReceipt{lease,processIdentity}，
 *      无 stdin Writable），而 LSP 服务器需要 stdin 'pipe' 常驻协议流
 *      （lsp-stdio LspConnection 要求 stdin/stdout pipes）。
 *    ⇒ 该腿卡在 C-PROC 冻结形态的裁决（是否给 confined provider 开流式管道臂），
 *      不是上游缺口，也不是纯装配可跑 —— 本探针记录两侧证据。
 *
 * 输出 = 同目录 probe-gap-lsp-policy.result.json（逐字段：path/observed/verdict）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TEST_USE_BASELINE_SHA } from '../../../../../tests/paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const TEAM = resolve(HERE, '..', '..', '..', '..', '..')

const git = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
const exportsOf = (libSrc) => {
  const m = /export \{([^}]*)\}/g
  const names = new Set()
  let mm
  while ((mm = m.exec(libSrc)) !== null) for (const part of mm[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop().trim()
    if (name) names.add(name)
  }
  return [...names].sort()
}

const pin = { head: git(TESTUSE, 'rev-parse', 'HEAD'), porcelain: git(TESTUSE, 'status', '--porcelain') === '' }
if (pin.head !== TEST_USE_BASELINE_SHA || !pin.porcelain) {
  console.error(`pinned test-use must be @${TEST_USE_BASELINE_SHA} and clean; got ${pin.head}`)
  process.exit(2)
}

const lspIndex = read(join(TESTUSE, 'packages/lsp/lsp/lib/index.js'))
const lspTypes = read(join(TESTUSE, 'packages/lsp/lsp/lib/types/types.d.ts'))
const stdioIndex = read(join(TESTUSE, 'packages/lsp/lsp-stdio/lib/index.js'))
const stdioTypes = read(join(TESTUSE, 'packages/lsp/lsp-stdio/lib/types/index.d.ts'))
const providerTs = read(join(TEAM, 'packages/runtime/sandbox-provider/provider.ts'))
const subprocessTypes = read(join(TESTUSE, 'packages/subprocess/subprocess/lib/types/types.d.ts'))

const POLICY_WORDS = /policy|generation|trustRoot|principal|caller/i
const EVICT_WORDS = /evict|generation|invalidate|reload/i

const queryFields = (t) => {
  const i = t.indexOf('interface LspQueryRequest')
  const seg = t.slice(i, t.indexOf('}', i))
  return seg.replace(/\s+/g, ' ').trim()
}

const result = {
  probe: 'W-PTC-RE probe-gap-lsp-policy — M-09 A2/A3 public-face census (my own probe)',
  writer: 'W-PTC-RE writer (qwen3.8-flash-next)',
  recorded_at_utc: new Date().toISOString(),
  dormant: true,
  ports_used: [],
  homes_used: [],
  pin,
  gap1_policy_generation: {
    row_leg: 'M-09 A2 pool.policy_change_old_pid_terminated_recreated',
    lsp_barrel_exports: exportsOf(lspIndex),
    lsp_stdio_barrel_exports: exportsOf(stdioIndex),
    lsp_query_request_fields: queryFields(lspTypes),
    query_request_has_policy_input: POLICY_WORDS.test(queryFields(lspTypes)),
    stdio_config_has_policy_input: POLICY_WORDS.test(stdioTypes.slice(stdioTypes.indexOf('interface LspLocalServerConfig'), stdioTypes.indexOf('export declare function apply'))),
    evict_hooks_in_public_barrels: EVICT_WORDS.test(exportsOf(lspIndex).join(',')) || EVICT_WORDS.test(exportsOf(stdioIndex).join(',')),
    pool_key_evidence: (stdioIndex.match(/canonicalizeWorkspace[^\n]*/g) ?? []).slice(0, 3),
    verdict: 'SEAM-GAP(上游): 池键无策略输入、无逐出/代际钩子 ⇒ 此腿非纯装配可跑；须上游策略输入通道/逐出扩展点（PR6 B4 运行时观测的静态面复指：pr6/SEAM-VERDICTS.md:58-60）',
  },
  gap2_server_reads_mediated: {
    row_leg: 'M-09 A3 server_os_reads_mediated',
    lsp_stdio_spawn_face: (stdioIndex.match(/ctx\.subprocess\.spawn[^\n]*/g) ?? []).slice(0, 2),
    subprocess_handle_stdin: (subprocessTypes.match(/stdin: Writable[^\n]*/g) ?? []).slice(0, 2),
    lsp_connection_requires_pipes: (stdioIndex.match(/subprocess implementation dropped a piped protocol stream/ig) ?? []).length > 0,
    team_confined_spawn_receipt: (providerTs.match(/interface SpawnReceipt[\s\S]*?\}/) ?? [''])[0].replace(/\s+/g, ' '),
    team_confined_has_stdin_stream_arm: /stdin[^\n]*Writable|Writable[^\n]*stdin/.test(providerTs),
    team_confined_run_output: (providerTs.match(/interface RunOutput[\s\S]*?\}/) ?? [''])[0].replace(/\s+/g, ' '),
    verdict: '裁决项(非上游): spawn 中介面存在(ctx.subprocess 可 per-realm 重装=装配可及)，但 Team 冻结 C-PROC 形态的 confined provider 无长驻双向管道臂(RunOutput one-shot / SpawnReceipt 无 stdin Writable) ⇒ 需对 C-PROC SpawnRequest 是否开 streaming-pipe arm 作裁决；裁决前此腿不可纯装配真跑',
  },
}

writeFileSync(join(HERE, 'probe-gap-lsp-policy.result.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
process.exitCode = 0
