# M2-READIMG-01 — 接管臂落地记录（image.mjs + image-attachment.mjs + 17 腿）

- 日期 2026-10-23（UTC）。worktree HEAD `c978eb2fc`（父方落地中）；宿主 pin639 porcelain 0（测前测后均验）。
- 交付（lane-owned 独占，五新文件，清单见 DIFF-PROPOSALS-MOUNT.md §D）：
  - `governed-families/image.mjs` —— B-IMAGE 前置接管臂：classify（纯解析零 fs 调用：闭参数根/未知顶层键拒/扩展名声明表/**词法越界 typed 拒**/I+F 闭集 effects 自过 `parseRequestedEffectSet` 失败即拒）→ prepare（一次票，零效果）→ execute（incarnation 复核→abort 前置→**effect-time 重锚 `resolveAnchoredPath`**（symlink-alias typed 拒先于内容读）→ stat 尺寸≤byteCap **先于读**→受控读 `readPort.readFile(maxBytes,signal)`→SERVICE 提交）→ cancel（诚实竞态报告）→ drain（无任何回落面）。
  - `governed-families/image-attachment.mjs` —— SERVICE adapter：真 store 口 DI（绑定校验）；`commitImage` 回执含 attachmentId+**指纹**；`referenceImage` namespace 绑定（外来 scope typed 拒 + **零 store 调用**；minted 全 ref 回呈）；stats 计数面。
  - 两份相邻 `.d.mts`（root-9e 先例，minimal consumed-only）。
  - `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts`（正式位，进根 vitest 收集）。

## 实跑（原件 runs/2026-10-23T07-28-55Z-arm/）

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts` | **17 passed / 17, rc=0**；census 身份 17 条 = `census-identities-arm.txt` |
| `pnpm exec eslint <五新文件>` | **rc=0 零输出** |
| `pnpm --filter @dsh-agent-team/runtime run typecheck` | **rc=2**——错误全在他人落地文件（`test/a5m2-governed-write-row-c1.test.ts` TS7016/TS2322 未落 d.mts+`'allow'` 字面量；`tools/a5p5-tools/src/write-slice.ts` 联合类型×5，`git status` 显示该二处为 write-lane M/??）。**本卡五文件在输出中零命中**（grep 亲验 0），typecheck.stdout 原件留档 |

## 首次真实失败（原文保留，诚实法；均已在测试注释中披露为 MEASURED fact）

1. `the attachment store refused the commit: Cannot read properties of undefined (reading 'run')` —— store 服务方法裸提取丢 receiver（`this.compression`）。修：装配口 `.bind(svc)`（已写进 diff 提案 §A4/B——装配方必须 bind，这是生产接线事实不是测试技巧）。
2. 取消腿 5003ms 超时 —— EventTarget 回调里 `throw` 是 uncaught event error 不是 rejection，hang 腿永挂。修：`reject(e)`。
3. `Stored attachment metadata does not match its reference.` —— store `readImage` 复核**完整 ref 元数据**，`{attachmentId}` 残 ref 被拒。修：adapter ledger 存 minted 全 ref，引用腿原样回呈。
4. `expected … to contain 'exceeds the 2px limit'`，实测 `Image exceeds the configured per-side pixel limit.` —— 维度臂文本无像素数；断言改钉真实文本（与 12 腿文件的 `2px` 文本来自**不同臂**，披露）。
5. `The "data" argument must be … Received an instance of Object` —— `readImage` 答 `{ref,data}` 对非裸字节。修：取 `.data`（d.mts 面同步）。

## row-7 对照原文（父方要求"修复前复现/修复后 typed 拒"）

腿 `row-7 contrast (pre-fix repro vs post-fix typed refusal, verbatim)`（vitest-run.stdout ✓ 341ms）：
- **修复前复现**：未动宿主面（full base-bundle，LocalFileSystem 无根）对越界绝对路径 `read_image` 成功返回含 `<type>image</type>`（isError=false——这就是在册主缺口的活体复现，跑在 pristine pin639 上，宿主树零写入）；
- **修复后**：同一目标在接管臂 classify ⇒ `P_IMAGE_CLASSIFY_TARGET_OUTSIDE_GOVERNED_ROOT`，detail 含 `BEFORE any filesystem call`，readPort `{stat:0, readFile:0}`，store commits 0、objects 0。
symlink-alias 走 execute 重锚臂：`P_IMAGE_TARGET_OUTSIDE_ROOT`（detail 含 symlink）+ `readFile 0` + `storeCalls 0`。

## 矩阵 B-IMAGE 行草案更新（供 parent 落 ⑥⑦⑧）

- **⑥**：宿主原生面 = 前轮 12 腿 + 本文件 nativeWorld 越界复现腿（fixture 面全绿）；治理面 = **接管臂+adapter 落地，lane 17 腿全绿**（runs/2026-10-23T07-28-55Z-arm/；typecheck 本卡文件零红、lint rc=0）。适用性 = dep-diff(宿主依赖面 attachment-local@pin639=baseline)=0；治理面装配未合（DIFF-PROPOSALS-MOUNT.md 在手），装配整合测与 Host 腿未跑 ⇒ ⑧ 仍 NOT_WIRED（生产未装配），**下一格 = CENTER 合 A/B/C ⇒ 本卡装配整合测 ⇒ Host 腿**。
- **⑦**：主缺口措辞可升级为：读面越界**在 governed 路径已闭合**（typed 拒先于内容读，对照腿为证；P_IMAGE_* 码集在测试钉住）；未闭合保留：宿主原生面本身不变（CORE PATCH BUDGET=0，strict Profile 须使原生面不可达——装配后验证）、attach-vision session-log/render 面未测（Host 腿）、跨重启 namespace 台账为内存面（durable 面 Host/plane）、审批 ask-lane 全链消费未测（Host 腿）、装配遮蔽生效未实证。
- **⑧**：`NOT_WIRED` 不变（行未装配），V@B=no；未闭合项如上，下一格=CENTER 合 diff。

## 边界与卫生

零宿主字节（porcelain 0 复验）；零 commit/push/add；世界 `tests/homes/m2-readimg-arm-*` 测后 0 残留；合成图仅 self-generated base64；他人文件零触碰（write-lane 红只报告不代修）。
