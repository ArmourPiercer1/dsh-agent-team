# c0405 — C-04/05 差距回合 kit（editor/read_image Team Definition 公开面装配）

回合：`alpha5-gap-c0405` @ 基线 f26c3971（WE2 审 tip）· 世界 `a5c45-*`（跑毕删除）· host 口 3183（自证空闲）· mock 349x · 宿主 `tests/deepseek-harness-test-use` @639ed01539（0.2.0-rc.2，只读复用，porcelain 0 pre/post）。
用户口径：**『gated 拒只是证据不是完工——原计划内治理装配若可补就补』**；RED-first；IF-5 零改；不发明新生产源——装配走 kit+公开 seam。

## 判据结论（实录）

| 面 | 结果 |
|---|---|
| gated | **GREEN 37/37**（`runs/gated-2026-10-17T04-42-34Z/`） |
| ungated（RED-first 对照） | **RED 25/37**，红且仅红 Team 门控腿（GUARD/GOVERN-EDIT/UNDO-IO/SPILL/IMG-CHAIN/THUMB×3/ONESHOT/LEDGER/EVENTS/UNBOUND）；真实编辑字节双模照常流动（EDIT-RT/UNDO/VIEW 照绿）；`IO_POLICY_UNSUPPORTED`（row law）与 `admission-unbound`（C-FS lane law）双模照拒照绿=门独立承载（`runs/ungated-2026-10-17T04-42-31Z/`） |
| probe 复跑 | M-04/M-05 **exit=0 LIVE**（`pr8/probes/runs/a5c45-post-M-0{4,5}.log`；pre=exit4 三缺腿点名在册） |
| 矩阵 | M-04/M-05 `status_now=TRANSITIONED-LIVE` + `transition_record`（machine+doc 双矩阵同步）；runner 复跑 **PASS=27 FAIL=0 NOT_RUN=0 LIVE=3 PROBE-GATED=2 TOTAL=32 exit=0**；self-test exit=0 |

模型驱动 13 调用链（真实会话+mock 序列）：view → str_replace → insert → undo → undo_all(typed 拒) → delete(typed 拒) → create → big view(spill 指针) → read_image(链) → thumbnail:true(kernel 先于 open 拒) → thumbnail:'grant'(lane scope 拒) → cf_probe unbound(lane law 拒) → post-publish unbound probe(guard 调用边拒，body=0)。

## 文件

- `a5c45-fixtures.mjs` — dist barrel 装载（domain/tool-governance、runtime/tool-admission、tool-dispatch/install、controlled-fs/src）+ kit-local a5p5 lane（spill）+ PR2 栈（kernel/ledger/grant/admitOp）+ gated lane 工厂（含一次耗重放位、unbound lane、PNG 解码）。
- `a5c45-editor-image-row.mjs` — 插件行（IF-1 公开 profile-patch seam 挂载）：三 Team Definition 注册→guard install→bindOwnTools→publish→post-publish unbound 探针；子命令 I/O 映射表（不可映射=admit 前 typed `IO_POLICY_UNSUPPORTED`，零副作用）；undo 历史 I/O 全走同一 gated face；spill 生命周期；读图链 chain=`admission-gated-controlled-fs`；缩略图双路负控；路由 `/__a5c45/{health,journal,state,agents,assemble}`。
- `run-a5c45-live.mjs` — RED-first runner（模式 `--mode ungated|gated`；GREEN gated 加 `--write-receipts` 从活体 route 读回直写 `pr8/probes/receipts/M-0{4,5}.receipt.json`；token 捕获即脱敏 `REDACTED-<sha8>`；世界跑毕删除；:3080 只读探针；宿主 porcelain 前后各验）。
- `runs/` — gated-04-42-34Z（GREEN）；ungated-04-42-31Z（RED 终版）；ungated-04-40-35Z / ungated-04-41-49Z = **判据迭代实录**（前者 mock 去重假融合、后者 ungated 历史语义修正前——保留以实证明改动为判据修正而非判据放水）。

## 治理观测增量（gated 全在册）

事件流 census（begin=13/end=12/guard-denial=1/call-refused=1，全名=master 发射面逐名 grep 亲验）· grant ledger consumed=15 vs minted=16（唯一差额=缩略图旁路腿 scope 拒先于 exec-edge，不记账，如实）· exec-edge 重放逐字 `grant "…" refused at the consumption edge: grant-consumed` 拒（str_replace/undo/image 三腿各一）· spill 252000B settle/finalize/close 盘上字节等值 + 指针呈报 · 负控在册：IO_POLICY_UNSUPPORTED×2（side_effects=0）· thumbnail typed-deny×2（0 字节，盘上 thumb 不变、marker 不入 transcript）· admission-unbound（消息逐字携名，§5 闭集 cfReason=effect-outside-grant 面如实，bytes_leaked=0 而原文件可证可读）· unbound body=0。

## 诚实披露（不宣称项）

1. **host-native `edit`/`read_image` 定义 pin 进 bind 的面 = W-E2 实测差距保持在册**（『definition unreadable at the public seam』逐字仍真）；本行只材料化 **Team-owned Definition**，不宣称原生工具被治理。
2. kernel 信任输入 fixture 级（W5/W7/W-E2 同口径）；**无 ENFORCE 宣称**（in-process 治理链，OS 强制天花板不变）。
3. 附件字节走 gated lane 文本读（base64 附件 fixture 选择）；真实渲染管线/OS 附件存储 not_observed 如实。
4. `ARBITRARY_TREE_PROFILE_PUBLISHED=false` runtime 读回在册；无任意树宣称。
5. LIVE=行级转态提案值（终裁归 PR8 正式轮+独立 reviewer）；本 kit 证据为装配 row 级，非整链验收。
6. receipt 由 runner 从活体观测直写（`--write-receipts`），非手写；draft 同件另存 run 目录。

## 重跑

```bash
# 0) lane 编译（kit-local，产物 gitignored）
node dev/agent-workflow/evidence/alpha5/wiring/w5/build-lane-esm.mjs "$PWD" tests/homes/.a5c45-build \
  /srv/workspace/dsh-plugins/dsh-agent-team/node_modules/typescript/lib/tsc.js
# 1) RED（必红且仅红 Team 门控腿）
node dev/agent-workflow/evidence/alpha5/wiring/c0405/run-a5c45-live.mjs --mode ungated --port 3183
# 2) GREEN + 收据直写
node dev/agent-workflow/evidence/alpha5/wiring/c0405/run-a5c45-live.mjs --mode gated --port 3183 --write-receipts
# 3) 探针 + 矩阵复跑
node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-04.mjs; node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-05.mjs
node dev/agent-workflow/evidence/alpha5/pr8/runner/run-pr8-negative.mjs
```

前置：`tests/deepseek-harness-test-use` 符号链接（gitignored，指向已构建 0.2.0-rc.2 运行时——a5-w8 已核准先例）；本 worktree `packages/runtime/dist` 已提交在分支内。

## 收口三件套

- 世界零残留：`tests/homes/a5c45-*` 跑毕即删（runner 内建）；lane 编译缓存 `.a5c45-build` 收口删除（重跑按上重建）。
- 端口释放：3183 与 mock 349x 随进程终止；启动前自证空闲。
- 宿主 pristine：@639ed01539 porcelain=0 pre/post、HEAD 不动；:3080 全程仅 401 只读探针；token 捕获即脱敏，原始 instance.raw.log 脱敏后即删。
