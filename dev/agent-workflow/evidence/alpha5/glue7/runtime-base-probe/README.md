# runtime_base '/' READ_DIR — 契约考证（只查不改）

问题：`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py:330`
硬编码 `add_rule(rs, odir("/"), FS['READ_DIR'], abi)`（policy 面 =
provider.ts:480 `runtime_base: true`，launcher 端 `pol.get("runtime_base", True)`
为真即授）。这是复审名单类泄露的承重件。**原约定是否明示过"目录枚举不受限"？**

## 结论：查无授权原句 = **实现走样候选**（base 可读有出处，'/' 全树枚举无出处且被反向原句点名）

三份计划原句（全部指反方向）：

1. `architecture.md:77` — 受禁子进程所需的是"an explicitly documented
   **trusted execution runtime base** (interpreter, libraries, devices),
   distinct from Blueprint business-data mounts. **Do not accidentally expose
   host home** or unrelated projec…"
   → base 有定义且是**列举面**（解释器/库/设备），并明文警告勿暴露 host home。
   launcher 的 /usr /etc /proc 三条与此相合；**'/' 全树 READ_DIR 不在该定义内**。
2. `architecture.md:243` — "Current pinned DSH `fs-sandbox` fences writes but
   **leaves reads unrestricted** … and therefore **does NOT meet** restricted
   business-file read policy … **motivations** for Controlled FS and Confined
   Spawn."
   → "读不受限"是本轮治理要修的**旧现状批评**，不是新授权。
3. `architecture.md:257`（P0 gate 句） — "… **environment base readability
   without arbitrary host-home access**."
   → 原约定明确带限定从句：**base 可读，任意 host-home 访问除外**。

provider 包内无 README；`real-lsp/README.md:186-188` 只旁证 `/usr`
EXECUTE|READ_FILE|READ_DIR 的运行时用途（clangd 镜像），未涉 '/'。
docs/ 全树 grep `runtime_base` 零命中（除我方本轮新写的披露文）。
**没有任何原句说"沙箱只禁写不禁读/目录枚举不在治理面"。**

## 影响面（若裁定收窄——如 '/' READ_DIR 撤除或改 base 集合——各行受益/受累）

* **shell 行（真实 Landlock）**：受累（行为收紧）——成员现可在沙箱内
  `ls /home/<other>` 枚举他处目录名（字节读仍被 read_file 规则 kernel-refused）；
  收窄后该类枚举变 EACCES。治理面收益 = host-home 名单不再上线。
* **grep 行**：中性——dir/file 目标的 argv 全部先行过 resolveAnchored（越界名
  到不了 grep）；沙箱内枚举面只在 shell 行为主动发起时可达。
* **glob 行（CANDIDATE-A，已摘）**：受累最大即其死因——swap-cwd 落点外目录的
  名单枚举（3/10700）正走 '/' READ_DIR；任何 glob 集成（含 093aaded 独立件）
  在该规则收窄前都自带名单类残留。
* **LSP 腿（real-lsp lane）**：/usr 三条保留则 clangd 不受影响。

## 最小需裁点（一行）

**撤除/收窄 `odir("/") READ_DIR`（保留 :77 列举面的 base 集合）是对既有可观测
行为（沙箱内全树目录名枚举）的语义变更，属计划语义裁决面——归根裁；实现侧
不擅动 provider 字节。**
