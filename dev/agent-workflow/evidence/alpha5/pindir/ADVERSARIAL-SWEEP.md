# ADVERSARIAL-SWEEP — C-16 同型洞对抗扫（协调者单，非根令）

基线 = 本分支已提交的 C-16 修复之上；扫描对象 = pin 宿主 @639ed01539（pristine，porcelain 已核）。
口径声明：**本件是协调者请求的对抗自查**（原 21:05Z 件的根令归因已被协调者更正撤回）。
本件**不做处置**：`subagent_codex`/`subagent_claude_code` 的钉/不钉口径由协调者呈根裁决中，
本文只呈事实与行号；未加任何新代码腿/豁免表腿（避免在裁决前替根做口径）。

## 三类非字面注册法 · 逐一现场扫（grep/读码于宿主树）

### A. 变量式/schema 式 `toolName: <var>`（config 驱动的注册名）

穷尽法：`grep -rn toolName packages --include=*.ts`（排除 lib/tests）→ config-schema 里带 toolName
的包**只有两个**：

| # | 注册名 | 注册点 file:line | 形态 | 口径 | 现装态（现场判定） | 钉名表状态 |
|---|--------|-----------------|------|------|--------------------|------------|
| A1 | `subagent` | packages/subagent/tool-subagent/src/index.ts:108（`toolName: z.string().default('subagent')`）；装载实例 base/cordis.patch.yml:374 | config 默认名 | catalog schemas（boot 默认） | **现装**（base + 三 preset 全启用） | 已钉（natexe 代） |
| A2 | `subagent_fork` | 同上 config；第二实例 base/cordis.patch.yml:387 + web-app presets cordis/ptc/standard :100/:101/:101 | config 路由名（bundle 组合实例） | shippedNames（gen-tool-catalog.ts:538；docs/tool-catalog.md:40）——boot names 列**不覆盖**它 | **现装**（全部出现处无 disabled） | 已钉（本单，root ④ 保留处置） |
| A3 | `subagent_codex` | 同上 config；实例 web-app presets cordis:103-107 / ptc:104-108 / standard:104-107 | config 路由名 | 不在 catalog 任何列 | **未装**（每一处均 `disabled: true`；standard:105、cordis/ptc 同型块） | 未钉——**处置待根裁**（协调者呈裁中；本文不置可否） |
| A4 | `subagent_claude_code` | 同上；实例 cordis:111-115 / ptc:112-116 / standard:112-113 | config 路由名 | 不在 catalog 任何列 | **未装**（每处 `disabled: true`） | 未钉——**处置待根裁** |
| A5 | `workflow` | packages/workflow/tool-workflow/src/index.ts:60（`toolName: z.string().default('workflow')`）；装载 base:398-399、standard:124（无 override） | config 默认名 | catalog schemas | **现装** | 已钉（本单 13 名） |

bundle/preset 注入面穷尽（含 preset 注入法=第三类的本体）：`grep -rn toolName packages/bundle apps --include=*.yml`
→ 命中**仅** A1-A4 四名（计数 4/3/3/4）+ apps/ 下两处**测试 fixture**（apps/cli/tests/profiles/headless/
subagent-inheritance-snapshot.patch.yml、apps/web/tests/auto-review-child.overlay.yml——非 shipped bundle 面，排除）。
宿主 bundle 里除 subagent 系外**无任何**其它 toolName 注入名；其余 bundle 条目的 `name:` 是包名非模型面名。

### B. 工厂循环/模板式注册（名字是运行时拼出来的）

穷尽法：全宿主 `grep -rn "\.tools\.register("`（排除 lib/tests）列站点 → 逐站看名字是否字面量：

| # | 注册名 | 注册点 file:line | 形态 | 口径 | 现装态 | 钉名表状态 |
|---|--------|-----------------|------|------|--------|------------|
| B1 | `stagehand_act/extract/navigate/observe/screenshot/tabs`（六名） | packages/experimental/browser-use-stagehand-native/src/index.ts:176-180（循环 `const toolName = \`stagehand_${method}\``，method 枚举自 browserInputs/BrowserMethod 六键） | **模板字符串工厂循环** | catalog schemas（boot 解析出六名；docs/tool-catalog.md 逐名成节） | **现装=catalog 发货面**（宿主自身"shipped plugin 模型面"口径收录）；注：bundle base/preset **不显式挂载**该实验包（挂载需 profile patch）——如实记双口径 | 已钉（本单 13 名，令内点名） |
| B2 | `mcp__<server>__<raw>` 动态族 | packages/mcp/mcp-client/src/tools.ts:82（`mcp__${serverName}__${rawName}` 组合）、:125、:149 循环注册 | 运行期任意名 | 前缀族（不可枚举） | 随 server 装载动态出现 | **前缀钉** PLANE_RESERVED_NATIVE_PREFIXES=['mcp__']（verifyPlaneNames 前缀判） |
| B3 | `run_code` | packages/core/tools/src/ptc.ts:30（`export const RUN_CODE_NAME = 'run_code'`）；注册表自带（index.ts:1024 PTC 面），ptc preset 启用 web-app/presets/ptc.patch.yml:147 `mode: ptc` | **注册表常量名**（非包内字面量） | catalog schemas（catalog 行 `@deepseek-ai/dsh-tools`） | **现装**（ptc shipped preset 的注册表唯一线面贡献；mode:ptc/both 下模型可见） | 已钉（本单 13 名） |

### C. preset/bundle 注入名

= A 节的 bundle-yml 穷尽（toolName 路由）；除 subagent 系四名外**零其他命中**。cordis patch 里的
插件 `name:` 字段全是包名（@deepseek-ai/...），非模型可见名。

## 假阳性排除（扫到但非注册面）

- packages/skill/tool-skill/src/index.ts:55、:149 `name: skill.name` = skill **目录条目/资源视图**，
  不是 ctx.tools 注册（skill 工具自身两名字面量 `skill`/`load_workspace_dependencies`，已钉）。
- packages/extensions/tool-cordis/src/host.ts:5 `export const name = 'cordis-inspect-providers'` = 插件名；
  工具两名字面量 `cordis_inspect_list/query`（已钉，钉时注"preset-gated"）。
- packages/session-query/tool-session-query/src/input.ts 各 `name: string` = 参数校验器形参。
- packages/hooks/hooks-claude-code/src/index.ts:345/348 `tool_name: exec.name` = 事件载荷字段。
- packages/schedule/schedule/src/tools.ts 的 schedule_* 四名 = **字面量**注册（如 :452），非循环；
  属第一刀漏收的原因是源在 boot 包外的 tools.ts 映射（catalog 列 A/B 之外已入钉，本单 13 名）。
- packages/boot/plugin-manager/src/tools.ts:20 `name: 'plugin_manager'` 字面量 + base:16-17 装载
  （本单 13 名）。

## 结论

1. 三类非字面注册法在 @639ed01539 的**穷尽**成员=A1-A5 + B1-B3（+ 上列假阳性排除）。
2. **未发现新的"现装且未钉"名字**：catalog 口径已被双向机检证明 forward=0/reverse=0；
   bundle 路由口径四个成员里两个已装已钉（A1/A2）、两个未装未钉（A3/A4，处置待根裁）；
   B1/B3 已钉（本单令内）；B2 前缀族已覆盖。
3. 口径裂缝记录（供裁决参考，不含建议倾向）：`subagent_fork` 型（shippedNames 列覆盖）与
   `stagehand` 型（catalog 发货但 bundle 默认不挂）说明"现装"存在 **catalog 发货口径** vs
   **shipped-default 挂载口径** 两读法；A3/A4 的裁决与机检腿加否，等根裁后另笔。
4. 本件为纯证据 commit（无代码/测试改动）；p4t6 扫描面不含 dev/ 证据，无需重 tie。

## 附记（根 21:15Z 裁决落地后销案）

③ 处置已裁：subagent_codex/subagent_claude_code = **补钉**（shipped 原生名，默认 disabled
不构成冒名许可；预防性拒绝声明面，零启用零权限变化）。本件"未置可否"段就此关闭；
钉名注释携带本件全部行号核据。stagehand 六名=**维持已钉**，"现装才钉"撤回后无冲突悬案（销案）。
"enabled 路由未钉=红"泛化腿未加（本件时点口径）；现行机检=双向漂移+来源反查+flip 漂移三件套。
