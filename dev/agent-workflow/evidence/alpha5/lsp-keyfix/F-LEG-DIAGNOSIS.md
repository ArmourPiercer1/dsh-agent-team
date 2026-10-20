# F-LEG-DIAGNOSIS — 真实 F-leg 根因（轻量深挖 @2026-10-20，重窗方案备妥未跑）

## 层级重构（既有 runs 档逐字，a5-legs-runner @ .../gap-legs-f/runs/a5legs-leg1-2026-10-19T09-10-55Z/）

真装世界（boot root 形，显式 tool-lsp 行挂载面，L1-MOUNT `surfaceHasLsp=true`；真 clangd 未配=诚实环境注）内，
leader-transcript.json 的 `tool_use` **调用载荷逐字**：

| 探针 | 调用体（逐字） | 应答层 | 落地（逐字） |
| --- | --- | --- | --- |
| 1 | `{"operation":"hover","filePath":…}` (camel-only) | **canonicalizer** | `canonicalization failed for tool "lsp": file-path-missing`（当时律下正确拒） |
| 2 | `{"operation":"hover","file_path":…secret.c}` (真拼写, deny 道) | **车道** | `lsp[…secret.c]: effective deny; decided by template(leader) deny[lane index 0, source 0]` |
| 3 | `{"operation":"hover","file_path":…hello.c}` (真拼写, allow 道) | **过治理后 body/provider 层** | `Error: no LSP provider handles "…hello.c"` |

**根因钉（修正我此前的"探针伪产"过窄定性）**：F-leg 的"真装 lsp 通道失败"**确实存在真拼写的端到端失败**——但死点在
**provider 挂载层**（该世界 realm 无任何 .c 文档类的 LSP provider 注册；`clangdAnswer=false providerDispatchLanding=true`），
与 canonicalization/车道/guard **均无因果**（探针 2/3 证两真拼写调用分别获正确车道裁决并穿过治理到达 body）。
与 REWORK-2026-10-18:82 行独立吻合：`lsp ❌ 未挂载（preset 不挂 lsp；profile 缺项）`——**世界配置缺口，非产品缺陷**。
F 首报把死点记在 canonicalizer（因探针 1 优先出镜），层级归属错了一层。

残留未知（不冒称已闭）：provider 配齐后各形态是否返回真服务器答案（正形收据至今**无**）；治理成员（strict）形对 lsp
的行绑定/UNVERIFIED 归属未测。

## 重窗诊断方案（备妥，候 G4 盘窗令解除；mock 只站 LLM 位；端口 3187/3495 族纪律）

世界 = 真装面 + **显式 tool-lsp 行** + **provider 行 + provider/toolName config 两行**（挂载形=file-URL tool 行教训同款）
+ clangd（`/usr/bin/clangd-18` 在位，#306 REAL-LSP 同款二进制；先 `--version` 预检入 run 头）。判据（逐层正负）：

1. **P-pos 正形**：legacy root，allow 道 `file_path` hover/definition on planted .c → **clangd 真答**（serverInfo/位置结果逐字）——闭合残留①。
2. **P-camel 形**：同调用 camel-only → **host parseLspArgs 失败**（根增量事实端到端首证；预期 TypeError 形/非零落地，逐字档）。
3. **P-strict 形**：strict 成员 + 显式 lsp 行 → 行绑定可验证则达 body（=lsp 与文件类的治理差异首证），否则 `BINDING_UNVERIFIED`——两答案都是层3 事实，逐字归档不猜。
4. **P-deny 负控**：deny 道 → typed 拒 + **clangd 零起子进程**（ps/lease 观察零足迹）。
5. **P-symlink 身份**：symlink 指向 deny 靶 → canonicalizer 目标身份拒（read 类无写面，只测身份层）。
取证=**row-handle in-process 观察读**（trace 读法教训）+ wire 逐字 + drain 归零 + 三门（H1/T1/T2/T3 同款）。p4t6 若新增 scannable 文件按实测续链。

## 与 #350 关系（终口径）
#350 HOLD 继续；alias 产品裁=根"此时不索取"（ALIAS-DECISION.md 留档不催，可选/延期项）。本诊断**不为**既有 patch 辩护：
它把 F-leg 死点从 canonicalizer 改钉到 provider-mount，结论恰是 **#350 未解也不需解任何已证缺陷**。
