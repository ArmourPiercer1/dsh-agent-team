## HOLD（根终态令 2026-10-20）——本 PR 按其宣称 fix 不再推进，先修账

**撤回声明（root @639ed01539 独立核实 + reviewer fe2d6cf7 实测）**：首笔 2cb7169e 正文的前提——「shipped tool-lsp schema 键=filePath@input schema、故 schema 形调用一律死在 canonicalization、lsp 治理车道事实不可用」——**系虚构，全部撤回**。实况：输入 schema=file_path @ tool-lsp/index.ts:120（required:true；:131=输出 schema）；body 读 args.file_path（render.ts:46-58，parseLspArgs）；camel 仅宿主内部 LSP-seam 词汇（index.ts:183-191 / types.ts:42）；schema 编译器逐字保留键（core/tools/src/schema.ts:295-301）；全历史 pickaxe 空；**pre-PR canonicalizer 对 shipped 形 3/3 通过（cad5cf03 dist 实测）**。首笔 commit message 不可重写（无 force-push 律），撤回载体=本正文 + bf8bb125 正文 + evidence README / 生产注释 / 测试头。

**F-leg 根因重钉（读既有 runs 档，不为既有 patch 编新需求）**：F 探针自以 filePath 为 shipped 形发出→死于 file-path-missing（当时律下拒得**正确**）——症状系探针自造键形；**未证任何真装端到端 lsp 失败**。已披露未做：installed schema→authorization→host parser→真 LSP body 链级腿（重型 live 候 G4 空间审计后）。

**范围诚实（根增量事实）**：alias **不重写/转发 args**——camel-only 调用仍死在 host parser（parseLspArgs 读 args.file_path）；两形执行均=零，只移动应答层（canonicalizer 拒→宿主 body 失败）。本 PR 机械内容收窄为：canonicalizer 层漂移可见性（路径可键/可指纹/车道可判）+ 双键确定性法（同值 ACCEPT【根 11:0xZ 终裁】/ 异值独立码 file-path-key-conflict / malformed 先于冲突 / 双缺不变）。

**alias 保留与否=单列产品决定（候裁，载体 evidence/alpha5/lsp-keyfix/ALIAS-DECISION.md）**：A 保留 / B 拆分（法留、camel ACCEPT 腿可去）/ C 整枝弃（未证任何缺陷）。

测试口径如实：a5lsp-keyshape 8/8 全=fake-resolver/直调 canonicalizer **单测级**，不构成 installed 链验证；回归 a2+a5a 81/81；p4t6 10/10（1206→1207 实测；与 MCP 分支合成树预期 1208 届时实测重锚）。CI 口径=对 9 项已知具名红无新增 identity failure。
