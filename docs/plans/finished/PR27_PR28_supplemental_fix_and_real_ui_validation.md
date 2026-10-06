# PR #27 / PR #28 补充修复与真实 UI 验收指导

> 适用仓库：`ArmourPiercer1/dsh-agent-team`  
> 当前基线：`master @ 904ca7a`（PR #26 已合并）  
> 目标 PR：
> - PR #27：`fix/team-tab-width-column`
> - PR #28：`fix/member-command-dialogs`
>
> 本轮性质：**补充修复 + 真实浏览器 UI 回归**。  
> **不得自动 merge PR。** 完成修复、推送到原 PR 后等待用户审查。

---

## 0. 本轮目标

本轮不是重新设计 Team UI，而是关闭当前审查发现的两个真实布局缺口，并用真实浏览器截图证明修复成立：

1. **PR #27**
   - 保留“Team 标签页跟随宿主 `--dsh-chat-content-width`”这一设计。
   - 修复 `.body/.zero` 的 content-box 溢出问题。
   - 真实验证：
     - section 标题与卡片一起跟随会话宽度；
     - Governance 与其他 section 的几何行为一致；
     - 窄窗口/窄会话宽度下不发生横向溢出。

2. **PR #28**
   - 保留“成员命令对话框复用宿主共享 `Modal` primitive”的设计。
   - 修复 `.actions` 仅加 `flex-wrap` 但自身不可 shrink、因此仍可能被裁剪的问题。
   - 修复 Modal 内 input/select/textarea 的 content-box 宽度问题。
   - 真实验证：
     - SETTLED 行的“恢复…”等 dialog 型操作立即在当前 viewport 中央出现；
     - 窄宽度下所有 action button 均完整可见，可折行但不可裁剪；
     - Modal 内表单左右边距正常，无右侧越界；
     - ARCHIVED 状态的真正“恢复”仍按既有契约直接执行，不错误改成确认 Modal。

3. **强制补充验收**
   - 必须使用已经安装的 **`browser-skill-dsh-plugin`** 拉起/操作真实 DSH Web UI。
   - 必须使用已经安装的 **DSH Vision Toolkit** 对真实截图进行 VLM 视觉检查。
   - **jsdom / React Testing Library / DOM 单测不能替代本轮真实截图验收。**
   - 如果浏览器或 Vision Toolkit 无法完成真实验收，最终状态必须写为 **NOT MERGE-READY / ENV_RENDER_GAP**，不得用“代码看起来正确”代替。

---

# 1. 开始工作前必须读取

严格遵守仓库既有 agent 纪律，先读：

1. `AGENTS.md`
2. `docs/ROUTER_RULES.md`
3. `docs/TEST_METHODS.md`
4. `dev/agent-workflow/graph.yaml`
5. `dev/agent-workflow/SESSION_ROUTER_LOG.md` 末尾本轮相关条目
6. PR #27 / #28 当前 head、diff、PR body

同时确认：

```text
origin/master == 904ca7a... 或者更晚
```

如果 master 已经在本指导执行前再次前进：

- 不得把下面写死的 SHA 当作新基线；
- 先确认新 master 包含哪些 PR；
- 将目标 PR rebase 到最新 master；
- 重新执行本指导要求的全部 gate 和真实 UI 测试；
- `graph.yaml` / router log 按 append-only / union 规则处理。

---

# 2. 全局红线

本轮仍遵守：

- `CORE PATCH BUDGET = 0`
- 不修改 DSH upstream 源码
- 不 patch-package / pnpm patch / postinstall 改写宿主
- 不使用 upstream 私有 API
- 不触碰稳定实例 `:3080`
- 真实 UI 测试只使用 `docs/TEST_METHODS.md` 规定的测试 DSH checkout / DSH_HOME / `3180` 族端口
- 不为了修 UI 改 runtime/storage/tools/remote authority
- 不改变 Team lifecycle / permission 语义
- 不改变 ARCHIVED `restore` 的既有直接执行语义
- 不新增第二套 Modal / Overlay primitive
- 不自动 merge
- 当前两个 PR 已经存在：**补充提交应正常 fast-forward push 到原分支；除非 master 前进导致必须 rebase，否则不得无意义重写历史**

---

# 3. PR #27：Team 标签页宽度修复

## 3.1 当前设计保留

当前 PR 的总体方向正确：

```css
--dsh-chat-content-width
```

是宿主 conversation 的共享宽度轴。Team tab 应显式消费该轴，而不是依赖偶然的宿主 descendant 布局。

不要改回 JS 测量，不要单独给 Governance 打特殊补丁。

---

## 3.2 必修问题：`width: 100% + padding` 的 content-box 溢出

当前 `.body` / `.zero` 同时存在：

```css
width: 100%;
max-width: var(--dsh-chat-content-width, none);
padding: ... 24px;
```

默认 `box-sizing: content-box` 时，窄容器下实际 border-box 会变成：

```text
parent width + 48px
```

这与 PR 自己的“窄窗口不溢出”验收目标冲突。

### 推荐实现

优先保持“外层含 24px padding，真正内容列宽度仍为 W”的几何关系。

推荐写法：

```css
.body {
  box-sizing: border-box;
  width: 100%;
  max-width: calc(var(--dsh-chat-content-width, 100%) + 48px);
  margin: 0 auto;

  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  padding: 16px 24px;
}

.zero {
  box-sizing: border-box;
  width: 100%;
  max-width: calc(var(--dsh-chat-content-width, 100%) + 48px);
  margin: 0 auto;

  /* 其余现有规则 */
}
```

这里的目标是：

- 宽屏：
  - outer border-box cap = `W + 48px`
  - 左右 padding 各 24px
  - **真正 section content width = W**
- 窄屏：
  - `width:100%` 收缩到父容器
  - padding 被算入 border-box
  - **绝不产生 parent + 48px 横向越界**
- 没有宿主变量：
  - `var(..., 100%)`
  - 保持 legacy full-width fallback

### 允许等价实现

可以改 JSX，使用：

```text
full-width padded outer shell
  └─ max-width: W inner content column
```

如果采用这一结构，必须证明：

1. 标题和卡片位于同一 inner column；
2. Governance 不特殊；
3. zero state 同样没有窄屏 overflow；
4. 不产生额外 horizontal scroll。

不要仅仅给现有元素加：

```css
box-sizing: border-box;
max-width: var(--dsh-chat-content-width);
```

然后宣称完成。这样在宽屏时会让实际 content width 变成 `W - 48px`，与“钉到宿主 chat content width”这一目标产生新的几何偏差。

---

## 3.3 PR #27 必补测试

### 单元 / 静态层

保留原有 gate。

如仓库已有 CSS contract/spec 模式，可补一个轻量 source contract，至少防止未来回退到：

```text
width:100% + padding + content-box
```

但不要为了 CSS 写脆弱的“字符串精确等于某段源码”测试。

### 强制真实浏览器测试

详见本文第 5 节。

PR #27 必须至少完成：

- `27-A` 默认宽度 Team tab
- `27-B` 使用 DSH 会话宽度拖动柄明显缩窄
- `27-C` 浏览器 viewport 进一步缩窄

三个状态都要真实截图 + Vision Toolkit 审核。

---

# 4. PR #28：Member actions / Modal 修复

## 4.1 保留共享 Modal 方案

继续使用：

```ts
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
```

已确认目标 rc.2 宿主的 Modal 契约包含：

- `open`
- `title`
- `closeLabel`
- `onClose`
- `description`
- `children`
- `footer`
- portal to `document.body`
- mask
- Escape close
- `role="dialog"`
- `aria-modal="true"`

不要重新自制 overlay / mask / portal。

---

## 4.2 必修问题一：`.actions` 必须真正允许 shrink

当前：

```css
.actions {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 4px;
}
```

问题是：

```text
flex: none ≈ flex: 0 0 auto
```

按钮簇自身仍不可 shrink。父 `.instanceRow` 即使 `flex-wrap`，也可能只是把整个 actions block 移到下一行，但 actions 的 intrinsic width 仍然大于卡片，内部 wrap 没有真正获得较窄 used width，最终继续被：

```css
.group {
  overflow: hidden;
}
```

裁剪。

### 推荐实现

优先尝试：

```css
.actions {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
  max-width: 100%;
  gap: 4px;
}
```

必须在真实浏览器中验证。

如果实际布局仍有不稳定，可使用更确定的布局：

```css
.actions {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
  max-width: 100%;
  gap: 4px;
}
```

这会让 action cluster 在需要时稳定占一整行，牺牲一点横向紧凑性，但优先保证：

```text
完整可见 > 强行同一行
```

也允许使用 CSS Grid / 独立 second-row action region，只要：

- 不改变操作集合
- 不改变 action 顺序
- 不隐藏 action
- 不靠 horizontal scroll 解决
- 窄宽度下所有 button 完整可见

最终选择必须以真实截图结果为准，而不是只根据 CSS 推理。

---

## 4.3 必修问题二：Modal 内表单控件盒模型

当前：

```css
.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid ...;
}
```

默认 content-box 会使实际 outer width 大于 Modal body content width。

统一修为：

```css
.field input,
.field select,
.field textarea {
  box-sizing: border-box;
  width: 100%;
}
```

可以保留其余 padding / border / font 规则。

真实截图中必须确认：

- input/select/textarea 左右边距视觉对称；
- 不侵入 Modal 右侧 padding；
- textarea resize 不造成初始化时横向破版。

---

## 4.4 不得误改“恢复”语义

这里有两个中文表面很像的操作，必须严格区分。

### SETTLED 行的“恢复…”

它实际对应：

```ts
kind === 'followup'
```

只是 lifecycle-specific label 为：

```text
恢复…
```

它应该打开“发送新工作/跟进”的 Modal。

这正是本次“点击像死按钮”的主要目标之一。

### ARCHIVED 行的“恢复”

它对应真正的：

```ts
kind === 'restore'
```

既有契约：

```text
ARCHIVED → SETTLED
direct click
no confirmation dialog
```

不要为了“所有按钮都有视觉反馈”擅自给真正的 restore 增加 Modal。

保留并继续验证现有测试：

```text
restore is a direct click — no confirmation dialog (§23.4)
```

PR body 的 live verification 也必须改成准确描述，不能再写：

> 点成员任意操作按钮（发消息 / 恢复 / 归档 / 处置等）→ 都弹 Modal

正确描述应区分：

- message / followup(包括 SETTLED 的“恢复…”) / archive / dispose / create → Modal
- archived restore → direct command，无 Modal

---

## 4.5 PR #28 测试补充

现有 React/DOM 测试继续保留，包括：

- Modal portal
- aria-modal
- Escape cancel
- command 不被误执行
- restore direct click

如容易实现，补一个 CSS/layout contract，防止 `.actions` 回退到：

```css
flex: none;
```

但真实 layout 仍以浏览器测试为最终证据。

---

# 5. 强制真实浏览器 + 截图 + VLM 验收

这是本轮的 **hard gate**。

必须同时使用：

1. **`browser-skill-dsh-plugin`**
   - 启动/连接真实测试 DSH Web
   - 打开 Team tab
   - 操作会话宽度拖动柄
   - 点击 member action
   - 调整 viewport
   - 保存截图

2. **DSH Vision Toolkit**
   - 对保存下来的每张关键截图执行视觉分析
   - 不得只保存图片不分析
   - 不得只依赖 DOM query
   - 把 VLM 的结论整理进 evidence markdown

---

## 5.1 测试实例约束

严格按 `docs/TEST_METHODS.md`：

- 使用测试 upstream checkout
- 使用测试 DSH_HOME
- 使用 `3180` 族端口
- 禁止触碰 `:3080`
- 测试结束清理浏览器/测试实例/端口
- test-use checkout 最终保持 pristine

如果 browser skill 需要 Chromium / Chrome / Edge：

- 使用当前已经为 `browser-skill-dsh-plugin` / Vision Toolkit 配好的受支持浏览器；
- 不允许因为浏览器缺失偷偷改成 jsdom；
- 浏览器无法启动时记录精确错误，最终 verdict = `ENV_RENDER_GAP / NOT MERGE-READY`。

---

# 5.2 真实测试矩阵

建议 evidence 目录：

```text
dev/agent-workflow/evidence/ui-fix-round-20260921/live-browser/
```

其中至少包含：

```text
README.md
27-A-default.png
27-B-drag-narrow.png
27-C-small-viewport.png
28-A-actions-wrap.png
28-B-followup-modal.png
28-C-message-modal.png
28-D-archive-modal.png
28-E-restore-direct.png
vision-review.md
browser-run.md
```

如果仓库现行 evidence 规则对 PNG 另有规定，遵循现行规则，但必须保留可审查的截图工件及其路径/摘要/hash。

---

## 5.3 PR #27 截图场景

### 27-A：默认宽度

操作：

1. 打开真实 Team 会话。
2. 切到“团队”标签页。
3. 保持默认 conversation width。
4. 截整页 Team tab。

检查：

- 时间线
- 成员组
- 活动与进度
- 团队事件
- 治理

所有 section：

- 标题左缘一致；
- 卡片左缘一致；
- Governance 不再独占全 viewport；
- 标题不锚在页面最左边。

Vision Toolkit 必须明确回答：

```text
1. 五个 section 是否处于同一内容列？
2. 标题与对应卡片是否共享水平几何？
3. Governance 是否仍异常全宽？
4. 是否观察到横向溢出或裁剪？
```

---

### 27-B：拖窄会话宽度

操作：

1. 使用 DSH 自带 conversation width handle。
2. 把内容宽度明显拖窄。
3. 保持同一 Team tab。
4. 截图。

必须观察：

- 五个 section 一起缩窄；
- section title 一起移动；
- Governance 同步；
- 无单独留在 full-width 的区域；
- 无水平 scrollbar。

如果 browser skill 支持 DOM evaluate，额外记录：

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

或针对 conversation scroll container 的等价断言。

---

### 27-C：小 viewport

再把浏览器 viewport 明显缩窄，例如：

```text
900×800
或
800×800
```

具体尺寸以真实 DSH 能正常操作为准。

要求：

- Team view 仍在 viewport 内；
- `.body/.zero` 不出现 +48px 溢出；
- card/title 不被右侧裁掉；
- scrollbar 只允许垂直，不应由本轮布局产生横向滚动。

---

# 5.4 PR #28 截图场景

优先准备至少一个 **SETTLED member**，这样一行会出现：

```text
发送消息…
恢复…
归档
处置
```

这正好覆盖用户截图中的问题表面。

---

### 28-A：窄宽 action cluster

操作：

1. 打开成员组。
2. 使用 conversation width handle 或浏览器 viewport，把行宽缩到足以触发按钮换行。
3. 不打开任何 Modal。
4. 截图。

强制检查：

- “发送消息…”
- “恢复…”
- “归档”
- “处置”

全部完整可见。

允许：

- 折到第二行；
- actions 独占第二行。

禁止：

- 最右按钮被 `.group overflow:hidden` 截掉；
- 文本只剩半个按钮；
- horizontal scroll 作为补救。

Vision Toolkit 必须明确回答：

```text
1. 四个 action 是否全部完整可见？
2. 是否存在右缘裁剪？
3. 换行后的间距是否正常？
4. 是否有按钮与邻近行/卡片边界重叠？
```

---

### 28-B：SETTLED “恢复…” Modal

点击：

```text
恢复…
```

注意：这是 `followup`，不是 archived restore。

截图必须证明：

- 点击后 Modal 立即出现在**当前 viewport 中央**；
- 背景有 mask；
- 有标题；
- 有右上关闭按钮；
- footer 操作可见；
- 不需要滚到 members section 底部才能找到对话框；
- input 完整位于 Modal body 内。

使用 Vision Toolkit 检查：

```text
1. Modal 是否位于当前 viewport 中央附近？
2. 是否明显为覆盖层而非 inline card？
3. 表单控件是否超出右侧 padding？
4. close / cancel / submit 是否完整可见？
```

---

### 28-C：发送消息 Modal

点击：

```text
发送消息…
```

截图包含：

- subject
- textarea
- footer

重点检查：

- textarea 右边缘；
- 左右 padding；
- resize handle 初始状态不破版。

---

### 28-D：Archive / Dispose 至少一个确认 Modal

任选一条真实可用 lifecycle，打开：

```text
归档
或
处置
```

验证共享 Modal 在 confirm-only 模式下同样正常。

---

### 28-E：真正的 ARCHIVED restore

准备 ARCHIVED member。

点击：

```text
恢复
```

要求：

- **不出现 Modal**
- direct command 被调用
- UI 出现正常 pending / projection refresh / lifecycle 更新中的至少一种真实反馈
- 不得把 direct restore 错改成确认框

截图或短序列证据应证明该行为与 dialog 型“恢复…”不同。

---

# 5.5 Vision Toolkit 的证据要求

不要只记录：

```text
Vision check: PASS
```

必须形成：

```markdown
## Screenshot: 28-A-actions-wrap.png

Viewport:
Conversation width:
DSH version:
Plugin branch/head:

Vision observations:
- ...
- ...
- ...

Potential defects:
- none / ...

Verdict:
PASS / FAIL
```

每张关键图片都要有独立结论。

如果 Vision Toolkit 发现：

- 对齐偏差；
- 按钮裁剪；
- Modal 偏出 viewport；
- input 越界；
- 文本截断；
- 卡片重叠；

必须回到代码修复，重新截图，不能只在 evidence 中记录为“known issue”。

---

# 6. 建议增加真实浏览器几何断言

截图是本轮必须项；同时建议 browser skill 在真实页面执行少量 geometry probe，避免纯主观视觉判断。

例如 action cluster：

```js
const group = document.querySelector('[data-member-group]')
const actions = document.querySelector('[data-member-actions]')

const g = group.getBoundingClientRect()
const a = actions.getBoundingClientRect()

({
  groupLeft: g.left,
  groupRight: g.right,
  actionsLeft: a.left,
  actionsRight: a.right,
  contained:
    a.left >= g.left - 1 &&
    a.right <= g.right + 1
})
```

Team tab：

```js
const sections = [...document.querySelectorAll('[data-team-view] section, /* use actual stable selectors */')]

/* 使用真实现有 selector，不要为了 probe 改产品 DOM */
```

目标是记录：

```text
no horizontal overflow
actions contained by group
content column stays inside conversation viewport
```

注意：geometry probe 是截图验收的补充，**不是截图替代品**。

---

# 7. 常规 gates

两个 PR 各自完成修改后重新运行：

```bash
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
pnpm lint
pnpm test
```

并按仓库已有 protocol：

- 跑 client focused suite；
- 对比 full-suite failure set；
- p4t6 scanner/pin；
- zero-core；
- test-use pristine；
- `:3080` untouched；
- 真实测试实例 stop 后端口释放。

如果出现已知：

```text
TCM-M4
p6t1-parallel
```

只能在与最新 master baseline **逐项一致** 时归为既有债务。

不要把新的 CSS/browser failure 混入既有 flaky debt。

---

# 8. PR body / bookkeeping 必须同步修正

## PR #27

当前 PR body 中的陈旧信息必须修正：

- base 应为当前实际 base，而不是旧 `0597757`
- full-suite 数字更新为 rebase 后真实值
- p4t6 pin 更新为当前真实值
- “问题② = 独立 PR #27”改为 **PR #28**
- 增加本轮补修说明
- 增加真实浏览器截图 evidence
- 增加 Vision Toolkit verdict

不要删除旧历史；使用新增 “Supplemental review fix” / “补充修复轮” 小节。

---

## PR #28

必须修正：

- base / gate 数字 / pin
- “所有 data-* anchor 保留”的过度陈述
- “任意操作按钮都会弹 Modal”的错误描述

明确写成：

```text
Modal 型命令：
create / message / followup（含 SETTLED 行显示为“恢复…”）/ archive / dispose

direct 命令：
ARCHIVED restore（“恢复”）保持 direct-click，无确认 Modal
```

增加：

- action wrapping real-browser screenshot
- followup Modal screenshot
- form-control box-model screenshot
- restore-direct evidence
- Vision Toolkit review 结果

---

# 9. 两 PR 的合并顺序与共享文件冲突

两个 PR 都会触碰：

- `dev/agent-workflow/graph.yaml`
- `dev/agent-workflow/SESSION_ROUTER_LOG.md`
- `packages/client/composition-shim/client-bundle.js`

产品源码本身基本正交，但 merge 顺序仍会造成 bookkeeping / bundle 冲突。

因此：

1. 本轮只把补充提交分别 push 到原 PR。
2. **不要自行 merge。**
3. 用户先 merge 任意一个后：
   - 另一个 PR rebase 到新 master；
   - graph/log 做 union；
   - 重新生成 composition bundle；
   - `check:artifacts`；
   - 重新跑必要 gates；
   - **至少重跑与该 PR 直接相关的真实浏览器截图场景**。
4. rebase 后不得直接沿用旧 screenshot 作为最终 merge evidence。

---

# 10. 完成条件

## PR #27 merge-ready checklist

- [ ] width-axis 设计保留
- [ ] padded content-box overflow 已修
- [ ] default width screenshot PASS
- [ ] dragged narrow width screenshot PASS
- [ ] small viewport screenshot PASS
- [ ] Vision Toolkit 三场景均 PASS
- [ ] 无 horizontal overflow
- [ ] Governance 与其他 section 同列
- [ ] title 与 card 同步移动
- [ ] typecheck/build/artifacts/lint/full suite 无新增回归
- [ ] PR body 更新
- [ ] graph/log 更新
- [ ] 已 push 到 PR #27
- [ ] 未 merge

## PR #28 merge-ready checklist

- [ ] `.actions` 不再 `flex:none` 导致不可 shrink
- [ ] 窄宽真实页面所有按钮完整显示
- [ ] form control `box-sizing` 闭合
- [ ] SETTLED “恢复…” Modal 在当前 viewport 中央
- [ ] message Modal 真实截图正常
- [ ] confirm Modal 正常
- [ ] ARCHIVED restore 保持 direct click
- [ ] Vision Toolkit 全部关键截图 PASS
- [ ] typecheck/build/artifacts/lint/full suite 无新增回归
- [ ] PR body 区分 “恢复…” 与真正 restore
- [ ] graph/log 更新
- [ ] 已 push 到 PR #28
- [ ] 未 merge

---

# 11. 最终汇报格式

本地 agent 完成后，请返回：

```markdown
# Supplemental UI Fix Result

## PR #27
Head:
Commits:
Files changed:

### Code fix
...

### Automated gates
...

### Real browser
- browser-skill-dsh-plugin: PASS/FAIL
- screenshots:
  - ...
- geometry probes:
  - ...

### Vision Toolkit
- 27-A: PASS/FAIL — ...
- 27-B: PASS/FAIL — ...
- 27-C: PASS/FAIL — ...

### Remaining risk
...

## PR #28
Head:
Commits:
Files changed:

### Code fix
...

### Automated gates
...

### Real browser
- browser-skill-dsh-plugin: PASS/FAIL
- screenshots:
  - ...

### Vision Toolkit
- 28-A: PASS/FAIL — ...
- 28-B: PASS/FAIL — ...
- 28-C: PASS/FAIL — ...
- 28-D: PASS/FAIL — ...
- 28-E: PASS/FAIL — ...

### Remaining risk
...

## Final verdict
PR #27: MERGE-READY / NOT MERGE-READY
PR #28: MERGE-READY / NOT MERGE-READY

No PR was merged.
```

---

# 12. 裁决原则

本轮最重要的一条：

> **“单测通过”不等于“UI 修好了”。**

PR #27 和 #28 本质上都是浏览器布局/视觉反馈问题。本轮已经具备 `browser-skill-dsh-plugin` 和 DSH Vision Toolkit，因此必须把真实 UI 跑起来、截图、让 VLM 查看截图并给出诊断。

如果真实页面与 CSS 推理冲突：

```text
真实页面 > jsdom > 静态推理
```

以真实页面为准继续修复，直到截图验收闭合。
