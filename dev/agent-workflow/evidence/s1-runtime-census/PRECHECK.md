# S1 Runtime Census — 纯预检报告（不启动 Host，止于 root 唯一启动裁决）

## 0. 时间与计数（实测）
- REAL_START_UTC = 2026-10-25T01:02:11Z；REAL_END_UTC（本报告落笔）= 2026-10-25T01:05:08Z 后收尾（写报告/哈希 <1min），20 分钟上限内。
- 计数：Host 启动 **0**（仅 --dry-run 18/18 OK，无写入外部世界）；paid 0；子代理 0；cleanup 0；对本目录外写入 0。PoC 4/20、Host 4/12 **不增**（拟 5/20、5/12 未启动，不记完成）。

## 1. Skill 核验（在册 ≠ 已读，本轮实际读取）
- 目录会话开始即核（catalog：browser/cordis×3/gpt/team×2）。本任务确为 Cordis 插件任务：**实际 read 了 `cordis-plugin-development` 一项**（唯一相关项，未读其余 skills，未扩研究）。
- 该 skill 知识序 = inspect → package README → source（`packages/<group>/<name>/src`）。本任务绑定冻结 HTU@639ed015 源码即其第三层公开接口的定点读（get/schemas 行号，见 §3）；**未调用** `cordis_inspect_query`（那是产品工具，本轮禁调产品工具；且稳定实例 build ≠ 钉住的 639 artifact）。skill 的 install_bundle/常驻 profile 路径不适用（本插件是一次性测试世界的 profile-patch 公共 seam 挂载行，沿 M3 已审通道）。

## 2. 模型/能力实测
- 本会话运行时声明 `qwen3.8-flash-next`；稳定实例 profile 配置 `agent-default-model: provider=qiyuan-self, model=qwen3.8-flash-next`（只读 grep /home/user/.dsh/profiles/web/cordis.patch.yml:64-68）与声明一致。model-presented 线级证据留待真实 run 由 mock wire 记录（合法呈现，非私有读取）。

## 3. 锚与 Host 公共 seam（全部实测 @639ed0153972…，tag dsh-v0.2.0-rc.2，porcelain 空）
- master 钉 = `4aaaa7b2`（= origin/master，PR #362 merge；本地 master 6259cf4b = 冻结回执记录的既有漂移，非锚）；计划钉 = `1310b959`（存在，"disambiguate gate unlock scope…"）；build provenance **NOT_VERIFIED**（只冻结实际 artifact）。
- `packages/core/tools/src/index.ts`：**get:1230 public、schemas:1260 public**（原文复读确认，schemas 契约注明 deep-cloned rows）。私有回避登记（仅记录行号，永不引用）：modeFor :922 / wireSchemas :1008 / view :1178 / resolveExecution :1247。
- launcher preflight 对插件字节强制扫描：四私有名、`.view(`、identity-式 toString、eval/Function、ctx monkeypatch 赋值 → 命中即 fail-closed。**曾捕获真实一次命中**（本插件头注释字面列出私有名），定点修复（注释转述）后 0 命中 —— 属"一次初始实现 + 最多一包定点修复"内。

## 4. 派生与差分（真实小 diff，封存原件 byte-untouched）
- 只读复用已核 M1 helper/mocks + 封存 M3 runner/probe（哈希实测匹配 d581e559…/181fc9a7…/a6f3124c…patch 语义随 EXT_CONTRIBUTOR_ROWS 继承，noext/mock 限定原样继承）。
- 新文件：`census-probe-plugin.mjs`（机制逐字继承 M3，唯一小差分 = 恢复A控制臂内 census 块）、`s1c-run.mjs`（launcher，import 复用封存 makeDecideM3/evaluateM3Oracle，加 census 扩展 oracle + seeds 差集 + mode 证据）、`seeds-union-offline.json`。
- 真实 diff 存证：`diff-probe-to-census.patch`（+70/-54，主体=重命名/env/头注+~25 行 census 块）、`diff-runner-to-launcher.patch`（+161/-247，oracle 改为 import 故净删多于净增）。
- census 语义：同一个真实 `exec.agent` 引用 → `ctx.tools.schemas(scope)` + `ctx.tools.get(name,scope)`；WeakMap 身份（Definition 对象 + execute 引用 + scope 引用）、rootCallId、registered-visible 名集入 ledger `leg:'census'`；`===` 与 WeakMap 记身份，**无 toString 身份**；schemas 行为 deep clone（契约 :1259），其身份只记行数/名，不作注册身份证据；不执行任何其他工具 body。

## 5. Seeds 并集与差集（离线半边已完成）
- 独立保全 `s1-m0-closure-v3-seeds/route-records-v3c.json`（实测 sha 55233426…c929 = 其 MANIFEST 锚）：records=93、distinct=90 → **86 tool 名 + 4 surface 义务单列保留**（surface:domain_family / mcp_http_dynamic / mcp_stdio / neg4_preset_selfregister；非工具，不入名集差）。fixture 探针名 `s1_m1_probe` 实测不在并集 → **账外成立**。
- 在线半边（registered-visible 实测名集）须真实 run；launcher 已内置差集算法与字段（only_in_registered_visible / only_in_seeds_93_union / fixture_off_book），seals sha 2ce3e3e2… 钉入 preflight。
- 分桶：registered-visible（schemas）/ model-presented（mock 记录 wire：tools 数组有无+名集+计数，`modelPresentedFromMock`）/ 直调与嵌套规则 **NOT_TESTED**；**Guard 准入、非 fixture 功能执行 NOT_TESTED**；包归属允许 UNKNOWN（不要求 pluginId）。不把 93 并集当"都支持"。

## 6. 限定继承与诚实副作用
- 真实 provider 0（env scrub + loopback mock）；mock/noext 限定原样继承。
- 真实 run 中 fixture marker/read(哨兵)/`/bin/echo` 三条腿**确有写入**（run dir + world 内），**不能称整个实验零写入**；本轮预检仅写本目录 8 个文件。不调产品工具。
- M3 限制全部保留（incoming 监听处理等机制限制、PASS≠身份绑定/生命周期/完整 H0）；Census 将独立检自己的身份文件/配置/差集，不以原 M3 PASS 代替。不新治理实现。

## 7. 预算
累计原 16 Owner-h 上限不变；此前保守 ~12h21 + 近期 A/B 与协调时间继续累加；真实精确消耗 UNKNOWN（勿编）。绝对截止 2026-10-25T13:00:00Z 不变。

## 8. 停止态
预检完备、fail-closed 全绿（dry-run 18/18）。**止。等待 root 对唯一 Host 启动（--go，1 次、0 重试）的裁决**；未启动即不记任何 census 完成。

## 9. root 复审修复包（唯一一包；0 paid / 0 Host / 仅本目录；截止 2026-10-25T01:21:40Z 内）
四处定点修复（注释 scan 命中属初始纯检查修复，不计入本包）：
1. **逐名 get 身份循环**（插件 census 块重写）：schemas(scope) 后对每个实际可见 name 逐项 public `get(name, 同一 exec.agent)` 并重复一次验 `repeatGetSameRef`；每行记 defRefId/execRefId(WeakMap)、scopeRefId、present/defType/execType、重复引用一致；不调用 body；fixture A `===` 校准仅作一行不代替其余项；缺字段/丢行由 oracle 拒绝 PASS。
2. **oracle 完整对应**（导出纯函数 `censusExtChecks`）：identity_rows ↔ visible names 1:1、无重复、同 scope、全部真实 def/execute 引用已记、repeat-get 稳定、fixture defId 与 guard-armed 跨腿一致；**纯负控 `selfcheck-negative.mjs`（无 Host）实测 4/4 OK**：删一身份行/错scope/仅名无身份必FAIL、calibration 不能顶门——门未扩大。
3. **wire 形状去断言**：`modelPresentedFromMock` 只记协议形状+实际名集（支持 name/function.name），注明 PTC 亦可带 tools[]（run_code）；mode 结论移至 `mode_evidence.native_support_this_sample_only`（direct probe 成功 + public schemas/get 不含 reserved run_code + 固定 standard/base 无 preset 三线，仅样本内，nested/guard 未测，不外推）。
4. **RUN 绑定 `run_binding`**：HTU 实际 HEAD+porcelain、HOST_ENTRY/TOOLS_LIB 实际 sha256（注明覆盖=两个具名构建产物非全树，build provenance 仍 NOT_VERIFIED）、world 实际 patch sha+rows+base 配置摘要+preset=none、sessionId、world 内 fixture 副本 sha、封存 M1/M3 与 seeds sha——summary 不可脱离 RUN 单读。
纯检查证据：语法 3/3、负控 4/4（SELFCHECK_RC=0）、dry-run 18/18 OK 0 FAIL、插件字节扫描 0 命中、diff 重生成 +70/-67 与 +215/-245（± 总行 137/460）。旧 artifact/router 未动。止于此包，等 root 复审；未获 GO 不自动运行。
