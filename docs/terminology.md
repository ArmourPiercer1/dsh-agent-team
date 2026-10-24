# Terminology — writing form and deprecated synonyms (EB1-B, v0)

Meaning lives in [glossary.md](glossary.md). This file only fixes how a concept
is written and which word mixes it with another.

**Machine-read contract:** the 4th column below is parsed by
`scripts/doc-checks.mjs` and enforced by `docs:probe` / `docs:sync` against
current-state documents. Therefore that column holds **bare comma-separated
tokens only** — no parentheses, no qualifiers, no prose. A token there is an
unconditional prohibition; anything that depends on context stays prose-only and
is deliberately **not** enforced (a context-blind check is worse than none,
because it trains people to disable checks). This file is the rule source and is
itself exempt from the scan.

| concept | 中文 | English (preferred) | do not write | why |
| --- | --- | --- | --- | --- |
| C-EB-0009 C1/C2/C3 | 分支内构建证明 / 真装配验证 / 发布截面验证 | C1 / C2 / C3 | 已测, 测过 | Undifferentiated "tested" is how a C1-only tool got reported as working; always name the level. |
| C-EB-0005 grant | 单次授权 / Grant | single-use grant | 长期权限 | A grant is consumed once; a standing-ability word misstates the law. |
| C-EB-0012 current authority | 当期执行权威 | `current_contract` | 双 current | Two editable current states is exactly the drift this baseline removes. |
| tool baseline | 来源驱动工具预期集 | expected tool baseline (source-driven) | 工具全集 | The census is derived and mutable; a closed-universe word overstates it. |
| vNext object model | 成员实例 id | `MemberInstance` id | memberId | Rejected field name at any depth in the frozen blueprint grammar. |
| C-EB-0013 non-pass | 未验证 / 拒绝 / 环境阻断 / 跳过 | `NOT_VERIFIED` / `REFUSED` / `ENV_BLOCK` / `SKIP` | | None of these may be reported as green; use the named verdict. |
| C-EB-0008 runtime approval vs code review | 运行时审批 / 代码评审 | runtime approval / code review | | Context-dependent: 审批 for a diff, or 评审 for a runtime gate, are both wrong — but the token alone cannot prove which is meant, so this row is prose-only and unenforced. |
| legacy vocabulary | 团队会话事件 | TeamDomain durable fact | | Legacy Team SessionEvent wording must not be presented as vNext law; naming it correctly in a red line is legitimate, so this row is prose-only and unenforced. |

## Rules

1. First use of a Team-specific term in a document uses the English form with the
   glossary id in parentheses; later uses may be short.
2. A token in the 4th column found in a **current-state** document is a probe
   finding. The same string in a historical log or a finished plan is preserved
   text and must not be "cleaned".
3. Adding a token here means adding or citing a glossary concept id first. A term
   whose correctness depends on context does not go in that column.
