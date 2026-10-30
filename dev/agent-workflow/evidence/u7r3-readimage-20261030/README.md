# u7r3 — read_image (M-05) 离线 PoC 证据目录

创建（real UTC，`date -u` 写时取值）：**2026-10-30T12:25Z**
Lane：`task/u7r3-readimage-poc-20261030` @ `1d884efdb8839b0d6efedd969793c8ca3ef15c5b`（origin/master tip；worktree `.worktrees/u7r3-readimage`）；OFFLINE PoC，零 boot。执行 seat/model 披露见 POC-REPORT.md 头（qwen3.8-flash-next，非 participant）。

## 文件

| 文件 | 说明 |
| --- | --- |
| **POC-REPORT.md** | 五问裁决（Q1 host 原生注册 PASS；Q2 平面名处理 PASS；Q3 附件公开面 PASS 无 CORE_SEAM_BLOCKER；Q4 bytes 平面执法/pixels store 执法；Q5 C1 条件不可用 PASS）+ 决定性提问（正腿经 ask 通道可达）+ 路线 + 建议矩阵行措辞 |
| future-boot-probe-sketch.md | 腿 A（C2 正腿 boot 验收）/ 腿 B（原生遮蔽呈现）/ 腿 C（deny-default 不可达 boot 复现）的 exact 环境 + asserts；仅在后续 C-pool 轮开启 |
| probe-citations.mjs | 全部 H:/P: 引用行号 + marker 机械核验（只读；host 走 walk-up 定位 `tests/deepseek-harness-test-use`） |
| probe-citations-output.txt | 其输出：**57/57 OK，exit 0**（2026-10-30T12:25Z；host HEAD `639ed01539…` porcelain 空） |
| probe-u7-9a-image-c1-transcript.txt | `vitest run test/u7-9a-fs-mutation-c1.test.ts -t "read_image"` 复跑：**13 passed / 24 skipped, exit 0**（12:20:14Z） |
| probe-askleg-transcript.txt | ask-lane 决定性探针 4/4（12:22:52Z）：A-1/A-3 default-ask+批准 → 一次 commit；A-2 拒批 → 零 commit；A-4 default-deny → `IO_POLICY_UNSUPPORTED (domain-ref)` 零 commit |
| probe-askleg.scratch.test.ts.txt | 上述探针 scratch 源码存档（**非 committed test**；运行副本置于 `packages/runtime/test/` 后即删） |

## 复现

```bash
cd <本仓库 worktree 根>            # 需先 pnpm install --offline --store-dir <lane store>
pnpm --filter @deepseek-ai/dsh-runtime exec vitest run test/u7-9a-fs-mutation-c1.test.ts -t "read_image"
# ask-lane 探针：把 probe-askleg.scratch.test.ts.txt 复制为
# packages/runtime/test/scratch-u7r3-readimage-askleg.test.ts 后
#   ../../node_modules/.bin/vitest run test/scratch-u7r3-readimage-askleg.test.ts
# 跑完删除该副本（scratch 不进 committed 树）
cd dev/agent-workflow/evidence/u7r3-readimage-20261030 && node probe-citations.mjs   # exit 0 = 引用全核验
```

## 边界披露

- host 引用根 = `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`（主工作树副本，detached @ pin `639ed01539…`，porcelain 空；各 worktree 未单独 provision，本 lane 亦未新建副本——wfpoc 同约定，路径在 transcript 头部披露）。
- vitest 运行只在 gitignored `tests/homes/u7r3-rimg-*` 世界内写盘（自动清理）。
- A-1/A-3 批准腿 = C1 stand-in 控制腿（`issueApprovedGrant` 真落授，无耐久 Control 行——其头注自披露）；全义务链属未来 C2 腿（sketch 腿 A）。
