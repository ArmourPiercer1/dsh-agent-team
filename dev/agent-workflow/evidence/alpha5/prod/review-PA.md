# review-PA — PR23（P-A 生产装配类）独立审查件

- 审查人 = P-A 独立 reviewer（qwen3.8-flash-next，≠实现者 ba3d7a33）；审查基线 = `alpha5-prod-pr23` @ **`e25e7c350ac1d1363b6139cdbfe03d9ba8501205`**（父 = `d714a941`）。
- 一次性 worktree = `.worktrees/a5pa-rev-pa`（detached @ e25e7c35，node_modules 链接主检出，包级 node_modules 复制自实现 worktree 的同构链接树）。
- 逻辑面审查 + 回归复跑；dist 镜像补笔（GLUE 再生成）不在本件范围，仅做 drift=0 快查（§④）。最终合并 SHA 另核（parent lane）。
- 环境卫生：本审查零端口绑定（3186 备用未用）、零 :3080/:3180 触碰、零 test-use 触碰、零 DSH 实例启动；scratch 编译树 `tests/homes/.pa-smoke-rv/` 用后删除；审查 worktree tracked 树 porcelain 空。

## 判定：**通过（PASS）** — 0 BLOCK / 1 MAJOR-doc（转 GLUE-5/收口 forward-only，不阻塞逻辑）/ 3 MINOR/观察

安全方向全查无放松路径：投影只在紧方向偏置（allow 不可投影=跳过+note→no-authority⇒Ask；ask/deny 不可投影=构造拒）；default-deny 门在 kernel 之前；R-1a 版本信任读时闭合。以下逐项给证据。

---

## ① 真实授权输入链（fail-closed）

- **输入链亲读**：`agent-bindings.mjs:2031` `permissionPolicy = boundTemplate.capabilities?.permissions`（A1 规范化对象，亲验行在位）→ `deriveTeamPolicyAuthority`（`admission-kernel.ts:773`，注：非契约所称 approval-case.ts，见 N1）。防御性再验证 = 闭集词表 import（`schema.js` 的 `PERMISSION_TOOL_NAMES/PERMISSION_RESOURCE_KINDS/PERMISSION_RULE_FIELDS/PERMISSION_PATH_MAX_LENGTH`，零第二成员表；shell 成员 = `SHELL_PERMISSION_TOOL_VALUES` 单一来源）；`default:'allow'` 直接构造拒（:823 区域）。
- **投影律表 §5 亲读 + 抽 3 条对 PR0 冻结代数核语义**：
  1. **行1（read/write exact|subtree → 资源效应+meta+tool-invoke 同 lane，matcher 语义）**：投影 matcher 落 `realmId|canonical` = PR0 `effectApprovalScope` 拼写（`approval-case.ts:81-85`）；匹配语义 = `authority-envelope.ts:216-230`（exact 恒等；subtree=`subtreeContains(envelope.resource,target)`；缺缝=undetermined）。门的 `matcherCovers`（:845 引用域）与冻结 matcher 语义一致——subtree 缺缝构造已拒（`projection-subtree-seam-missing`），undetermined 分支持 unreachable。**语义一致**。
  2. **行9（`default:'ask'` 无需规则——PR0 no-authority 即 Ask）**：`planes.ts:145-159` 展开面 no-match ⇒ `CEILING_NO_AUTHORITY`；`evaluateEffectSetExpansion`（`approval-case.ts:199-203`）else 支 → needsApproval=Ask。**语义一致**。
  3. **行10（deny lane → R-1a 具名源，version 读时=authorityGeneration，ruling ① upgradable-Ask）**：投影 `sourceVersion: input.sourceVersion()` 每读执行（`admission-kernel.ts:938`），assembly 以 `sourceVersion: config.authorityGeneration` 同读口注入；冻结信任律在 `approval-case.ts:286-335`（F-1 去重/歧义拒、`sourceVersion !== authorityGeneration` ⇒ version-drift 精确拒、`rungAbove(owner)` 地板、owner-above-ladder）。合成腿实测 `denySources()` 读时 1→7 换代变值。**语义一致**。
- **default:'deny' 入口门 + kernel 零触达负控（复跑 PASS）**：门在 `admission-kernel.ts:1072-1090`——逐效应查 `coversEffect`，未覆盖 ⇒ typed `{kind:'denied', code:'IO_POLICY_UNSUPPORTED', refusal:'template-default-deny'}` 返回，**kernel.admit 未调用**（代码路径亲读 + 腿 `ledger.consumedCount()===0` 复跑绿；smoke criterion 9 同钉）。门只收紧（无 allow 能力）；domain-ref/未名工具在 deny 模板下一律拒 = 紧方向。
- 观察：文件工具的路径级 deny 会同 lane 拒 tool-invoke ⇒ 该工具**全部**调用（含其他路径）走 rung-above-owner 的 upgradable-Ask（ruling ① 冻结语义，§5 行1 "同 lane" 已披露）；模板作者须知 deny 一条 = 全工具升审，非静默断言问题，**属已披露语义**不另计 finding。

## ② 四绑定律不变 + R-1a 换代语义

- **构造面亲 grep（无绕过）**：全 `packages/**`（非测试）`createControlledFsLane(` 唯一调用点 = `createAdmissionGatedControlledFs`（`admission-binding.ts:133`）；生产 provider `gateCall` 唯一出口 = `createAdmissionGatedControlledFs`（:243），law1-4（`UNBOUND_ADMISSION_RECHECK`/指纹绑定/subtree 注入/`ARBITRARY_TREE_PROFILE_PUBLISHED=false`）零扰动（`a5w-integration-wiring` 14/14 绿）。provider 不暴露任何 lane/fs 面（返回面仅 realmId/instanceIds/gateCall，冻结）。
- **R-1a 读时版本=live authorityGeneration（换代即变语义，复跑一腿）**：`a5p2-admission-kernel.test.ts` "version stamped at READ time"（gen 1→7 读时变值）**PASS**；配套换代变语义两腿复跑 PASS——provider 侧 `authority-generation-stale`（admit 与 gateCall 之间换代 → lane revalidate 拒、grant 未消费、kernel 零触达）与 assembly 侧 stale-binding 恒拒（identityChecks 先行 ⇒ 生产接线内 version-drift 不可达 = 纵深防御）。
- provider 构造拒（TypeError 风格与 `bindAdmissionRecheck` 同型）：空实例/外 realm/fs id 重复/读口缺失，腿全绿。

## ③ 回归复跑（本审查 worktree 实跑，node v24.21.0 / vitest 4.1.11）

- **全量 197/197（14 文件）PASS**（命令 = 14 个 lane 文件 `pnpm exec vitest run …`，3.05s）：kernel 44 / composition 12 / approval-case 19 / grant-oneshot 12 / clock 9 / assurance 10 / a5w 14 / controlled-fs 16 / poc3-probes 13 / cf-errors 5 / cf-descriptor 8 / **共享钉 35 全绿（a5p0 4 + p4t6 10 + a3p3 21）**。与实现件 140→162(+35 共享钉)=197 算术吻合、per-file 计数逐一吻合（`pa-vitest.log` 对账一致）。
- **抽 4 命名腿（-t 过滤）全 PASS**：ASSEMBLY-door 门 / READ-time 版本 / stale-generation stops-before-port / exec dual-gate READ-TIME。
- **installed-smoke 12/12 PASS**：`tsc -p packages/runtime/tsconfig.build.json --outDir tests/homes/.pa-smoke-rv/out`（EXIT=0，提交态 dist 零触）→ `node dev/agent-workflow/evidence/alpha5/prod/pa-smoke-installed.mjs tests/homes/.pa-smoke-rv/out` → `CRITERIA 12/12 PASS`，EXIT=0，世界 teardown 实测 removed。

## ④ 零共享文件改（亲验）+ dist drift=0 快查

- `git diff d714a941..e25e7c35` = 12 文件，全部 ⊆ 契约声明范围（7 个 packages 文件 + 5 个 evidence 文件）。
- `agent-bindings.mjs`（src）**零字节**；`packages/runtime/dist/**` **零字节**；根配置（`vitest.config.ts`/`tsconfig*`）零字节；`a5p0-layer-audit`/`p4t6-session-event-scan` 零字节；`--diff-filter=A packages/**` = **空**（新增文件 0 ⇒ p4t6 tie=0 主张成立）。
- dist 快查：提交态 dist **无** `createProductionAdmissionAssembly/createProductionControlledFsProvider` 导出 = dist 落后 src（镜像补笔在途，与申报一致；本轮对 dist **零漂移引入**）。kit 消费路径由 installed-smoke 以 scratch 编译树先行钉死，GLUE-5 再生成后方可换装 kit（契约 §6 如实）。

## ⑤ 宿主调用点行号亲验（grep 亲验 @ 本树）

- **`:2031`** = `const permissionPolicy = boundTemplate.capabilities?.permissions` — **精确在位**。
- **`:2203`** = `if (permissionPolicy !== undefined) {`（guard 装填块起点）；**`installScopedToolGuard` 实际调用在 `:2261`**（import :433）— 契约把符号钉在块首行，行号漂移 +58 → **MAJOR-doc（N2）**：装配姿态主张（guard 装填之后、Agent 发布之前构造；失败=同姿态拒发）本身正确且可 grep 复现，仅行号失准。
- **`:2745`** = `policy: permissionPolicy,`（`installParameterPermissionListener` 调用体，:2744）— **真实在位**；但 pa-CONTRACT 正文只引 `:2031/:2203` 两锚（`:2745` 系 parent brief 锚，非契约文内引用），如实记录。

## Findings（severity + 条款映射）

| # | 严重度 | 内容 | 处置建议 |
|---|---|---|---|
| N1 | MINOR-doc | pa-CONTRACT §1.1 称 `deriveTeamPolicyAuthority`/`TemplatePolicyProjection*` 新增自 `approval-case.ts`，实际在 **`admission-kernel.ts:773`**（barrel 导出正确、行为正确）| 契约文一行改（随镜像补笔或收口 forward-only）|
| N2 | MAJOR-doc | §4 `:2203` 锚失准（实调用 :2261）；建议改为符号锚（`grep -n installScopedToolGuard`）| 契约文一行改；GLUE-5 装配时以符号 grep 为准 |
| N3 | 观察（fail-closed，GLUE-5 hygiene） | A1 规范化"保声明序不并条"允许重复/交叠 deny 规则；此类模板投影出多源同 scope ⇒ 冻结 F-1 判 `deny-source-ambiguous` 精确拒（比 upgradable-Ask 更紧，可致该 scope 全拒）。方向 = 紧，非漏洞 | 在 GLUE-5/模板作者文档记一行；如要按"等价重复折叠"放宽须新裁决（F-1 冻结语义，本审查不动）|
| N5 | 措辞 nit | `any` lane 的 note 文案对 ask lane 亦称 "allow over ALL resources"；default:'deny' 下该情形资源效应被门拒（比 note 所称 Ask 更紧）| 可随下轮并改 |

## 复现命令（本审查实跑）

```bash
# worktree: .worktrees/a5pa-rev-pa (detached @ e25e7c35)
pnpm exec vitest run <14 lane 文件>            # → 197 passed (14 files)
pnpm exec vitest run packages/runtime/test/a5p2-{composition,admission-kernel}.test.ts -t "<腿名>"  # ×4 → PASS
pnpm exec tsc -p packages/runtime/tsconfig.build.json --outDir tests/homes/.pa-smoke-rv/out  # EXIT=0
node dev/agent-workflow/evidence/alpha5/prod/pa-smoke-installed.mjs tests/homes/.pa-smoke-rv/out  # 12/12, EXIT=0
```
