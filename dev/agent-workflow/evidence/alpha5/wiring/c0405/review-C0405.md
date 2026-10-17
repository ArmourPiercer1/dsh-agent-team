# review-C0405 — C-04/05 双 TRANSITIONED-LIVE 宣称独立终审（从严）

- **reviewer**: C-04/05 独立 reviewer（qwen3.8-flash-next；≠a5e320b6，≠writer，≠c08 reviewer）
- **受审 SHA**: `alpha5-gap-c0405` @ **923d8301**（一次性 worktree `.worktrees/a5c0405-rev-c0405`，detached，porcelain 0 起步）
- **端口/世界**: host 口 **3185**（启动前 `ss` 自证空闲）；mock 自动择 3491；世界 `a5c45-rev-gated-2026-10-17T06-17-11Z` / `a5c45-rev-ungated-2026-10-17T06-19-49Z`（评审毕即删）
- **宿主**: 只读复用 0.2.0-rc.2 构建体 @ `639ed01539`，porcelain 0 pre/post、HEAD 不动；:3080 全程仅 GET 探针（401，与操作前一致）
- **裁决**: **通过**（无阻塞、无补充要求；三项 minor 注记见文末）

## ① 六判据独立复跑（非引用，逐字/逐字节自算）

复跑方式：kit 全链真跑两遍于本人 worktree（gated `--keep` 保世界做盘上重算 + ungated RED 对照），随后仅用**独立重算**核验。

| # | 判据 | 独立复算结果 |
|---|---|---|
| 1 | 编辑往返+undo **sha 级逐字节复原** | 本人自算：seed 字节 `"before-edit-line\nsecond line\n"` → `sha256:d98a5f736b08…` == 记录 str_replace shaB；undo 后盘上 doc → `sha256:62d961ad2ea0…` == str_replace shaA == history 台账 insert.before_sha == undo.restored_sha；盘上内容插入行确已移除。**逐字节复原成立** |
| 2 | delete/undo_all `IO_POLICY_UNSUPPORTED` **admit 前**零副作用 ×2 | 两条 stage=`io-policy-unsupported`、`grantIds=0`（kernel census 无 mint 增量）、shaB==shaA、负控在册 `side_effects=0/grants_minted_delta=0/file_unchanged=true`；且 ungated 对照面同判据照绿（row law 双模承载） |
| 3 | read_image 链真解码 1×1 PNG **sha==磁盘** | 本人自读世界 `shot.png.b64`（96B）→ base64 解码 70B → PNG 签名 `89504e470d0a1a0a` 亲验 + IHDR 1×1 → 自算 `sha256:c414cd0e204d…` == receipt `decoded_sha_matches_disk`；lane 读回 b64 文本 sha `e427046b…` == receipt `lane_content_fingerprint` |
| 4 | 缩略图旁路 typed-deny 零字节 | 双路均拒（kernel `requires-approval` g=0；lane `effect-outside-grant` 于 open 前）；盘上 thumb sha `b9814cf7…` 自算不变；`THUMB-LEAK-MARKER` 在 gated transcript/journal **零出现**，对照 ungated run 中该 marker 逐字泄漏在册（红承载实证） |
| 5 | grant-consumed 重放**逐字**拒 | 三+腿 `execEdgeReplay.error.message` 逐字 `grant "grant:<id>" refused at the consumption edge: grant-consumed (frozen PR0 precedence; no retry, no fallback, design §4.3)`；与生产发射面 `packages/runtime/dist/packages/runtime/tool-admission/grant-mint.js:104` 模板**逐字比对一致**（非 kit 造词） |
| 6 | 事件流 13/12 + grant 台账 15/16 差额 | 本人 run 亲测 census：`dispatcher-call-begin=13 / call-end=12 / result-observed=12 / guard-denial=1 / call-refused=1`（13=12 治理调用+post-publish unbound 探针调用边拒无 end）；kernel `minted=16/admitted=16/requires-approval=1`、`consumed=15`；逐调用 grantIds 求和=16，**唯一未耗=缩略图 lane 旁路腿 grant（scope 拒先于 exec-edge 不记账）**——与 README/receipt 披露逐字一致；8 个事件名逐一 grep 生产 dist 发射面在册 |

复跑总结论：gated **GREEN 37/37**（`runs/gated-2026-10-17T06-17-11Z/`）；ungated **RED 25/37 且红腿集合与 writer run 逐名恒等**（12 条全为 Team 门控腿：GUARD/GOVERN-EDIT/UNDO-IO/SPILL/IMG-CHAIN/THUMB×3/ONESHOT/LEDGER/EVENTS/UNBOUND；`runs/ungated-2026-10-17T06-19-49Z/`）。spill 252000B 盘上字节与读回等值（自算 sha `cc4ed6d5…`==big view 记录）、`probeBodyCount=0`、`rawReadsInGatedChain=0`。

## ② union 完整性（对照 ce1085ed / d82ca288 / 37f56897 三亲本逐键 diff）

- `ce1085ed` vs `d82ca288` 的 M-05 receipt：**逐键恒等**（c08 评审轮未动 receipt）。
- `c08_round_receipt_view` vs `d82ca288`：**全 17 键值语义无损**（顺序无关深度相等全过；`image_read`/`negative_controls` 两处仅为 JSON 键名字母序归一，叶子值逐字节恒等——见 F-1）。
- `37f56897` 全部键：在 923d8301 中逐一存活（同名同值 / `c08_round_receipt_view` 逐字 / `*_prevmaster` 逐字），**零丢失零改值**。
- 全部 `*_prevmaster` 键：923d8301 == 37f56897（原样携带）且逐一 == 预合并 master `148c3f49` 对应键值（追祖再验）。
- `_merge_union_note` 明示 canonical/mirrored/prevmaster 三层规则与 parent 合并裁决出处。
- M-04 轮替（见 F-2）不违本项：union 裁决范围=M-05；M-04 canonical 与其 gated run draft **逐键值恒等**（活体直写非手写，亲验）。

## ③ 矩阵行外零触碰（亲验）

- `pr8/matrix-machine.json`（37f56897→923d8301）：32 行中**仅 M-04/M-05 两行变**（且仅 `pending_probe[.transition_record]` 与 M-05 `note` 字段）；`_meta` 与其余 30 行**顺序无关逐行深度相等**；行集合不变。
- `docs/plans/memo/.../pr8-accept/acceptance-matrix.json`：仅 M-04 一行 `pending_probe.status_now`（`2 +-` 恰一行；M-05 该行自 37f56897 已 LIVE，本回合未再触）。
- `pr8/vnext-migration-gap-checklist.md`：append-only 附录（自注不改上文）；W-E2/W8 旧行逐字保留。
- 全程 diff `37f56897→923d8301` = 证据/kit/矩阵注记 only：`packages/`、`scripts/`、根 `vitest.config.ts`、`pnpm-workspace.yaml` **零文件**（IF-5 亲验）。

## ④ runner + probe 复跑

- `run-pr8-negative.mjs`（无 flag=transition_record 亲验位）：**PASS=27 FAIL=0 NOT_RUN=0 LIVE=3 PROBE-GATED=2 TOTAL=32，exit=0**（LIVE=3=M-04/M-05/M-13），与宣称逐数一致；`pr8-runner-self.test.mjs` **exit=0**。
- `probe-M-04.mjs` / `probe-M-05.mjs`：**各 exit=0，VERDICT LIVE**（纯只读：装配锚点在场亲验 + receipt 全断言 SATISFIED + evidence_refs 逐项存在性亲验）。
- pre 态对照（exit=4 三缺腿点名）在 runs/ 目录在册（a5c45-pre-*），RED-first 序成立。

## ⑤ 措辞诚实二分

**成立**：LIVE 宣称处处限定为 **Team-owned Definition 在公开 seam 的材料化装配面**（receipt `caliber`、matrix `transition_record`、checklist 附录、README 判据行同口径）；「宿主原生 `edit`/`read_image` 定义 pin 进 bind 的面」在 receipt `not_observed`（含『definition unreadable at the public seam』逐字引文）、README 诚实披露 #1、checklist 旧行三处保持在册，无任何原生工具被治理的升格表述；`current_status`/`known_partial` 未动、行级词表标注「提案值，终裁归 PR8 正式轮+独立 reviewer」；无 ENFORCE、无任意树宣称（`ARBITRARY_TREE_PROFILE_PUBLISHED=false` 有 runtime 读回 + A4 probe 封禁断言）。

## minor 注记（不阻塞）

- **F-1（记录）**：`c08_round_receipt_view` 的 `image_read`/`negative_controls` 相对 d82ca288 为键名字母序归一（JSON 语义等价）；「无损」按值语义成立，若下游做逐字节文本比对需知此归一。
- **F-2（记录）**：M-04 receipt 旧 W-E2 代键值被轮替替换、未加 `*_prevmaster`（与 M-05 双代并存不同）。不违本回合 union 裁决（范围=M-05 双装配点）；W-E2 证据在 git 历史与其 run 目录完整可溯，且 M-04 `not_observed` 逐字保留 W-E2 差距引文。若 PR8 正式轮需跨代审计，按 git 史取回。
- **F-3（环境注记）**：本宿主工作区网络文件系统在长会话中出现过间歇性 negative-dentry 抖动（读世界文件偶发 ENOENT、重试即中）；系环境噪声非 kit 缺陷，复核者复跑时如遇同现象以重试/整目录快照为准。

## 收口留痕

世界 `a5c45-rev-*` 与字节快照 `.c0405-review-bytes`、lane 缓存 `.a5c45-build` 评审毕删除；3185/3491 已释放（`ss` 亲验空闲）；宿主 porcelain=0、HEAD `639ed01539` 未动；:3080 仅 401 只读探针；token 未落盘（runner 捕获即脱敏）。本评审复跑证据目录（gated/ungated 两个）随本 commit 入库。
