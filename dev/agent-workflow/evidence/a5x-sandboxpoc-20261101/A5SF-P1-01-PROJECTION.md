# A5SF-P1-01 对表实验（PoC banner）：现有 v4 `io` 逐调用投影 vs D7 `MemberPolicy`

> 目的：检验「 enforcement 语义是否必须 v5 新语法」——PR #531 审计发现 1 的最小验证。
> 方法：v4 语法取我方仓库**已合并、有 CI 的冻结解析器** `packages/domain/blueprint/src/blueprint-v4.ts`（封闭字段表 :77-86，类型 :131-137）；样本取其 CI 测试中的真实 v4 绑定（`a5sr2-blueprint-v4-grammar.test.ts:84/:256/:269`）；对照 ADR D7 字段表。零代码改动。
> 披露：未读取 :3080（probe-only 纪律），仓库内无其他真实蓝图语料；样本为冻结 grammar 的合法实例，非生产模板全集。

## 1. v4 实际语法（源证）

```ts
read/write ∈ { {mode:'all', deny[]}, {mode:'restricted', allow[], ask[], deny[]} }   // 互相独立
network    ∈ { {mode:'allow'}, {mode:'restricted', allow[], ask[], deny[], default}, {mode:'deny', default:'ask'|'deny'} }
// 路径为工作区相对串（'.'、'./secret'、'.git'）；closed-set 字段表按 mode 封闭
```

## 2. 逐调用投影规则（被检对象）

调用工具 T（分派时 T 已知，toolBinding 可寻）→ 执行边界 = T 的 binding.io：
`allow` 路径=硬允许，`deny`=硬拒绝，`ask`=交 Alpha.4 审批（D1.4 唯一准入源，语义不变）。
"成员只能读蓝图允许的路径"（D1.1 措辞）在逐工具强制下成立：任一调用可读集 ⊆ 蓝图允许集。

## 3. 字段对照

| D7 `MemberPolicy` | v4 投影 | 结论 |
| --- | --- | --- |
| `read: PathRuleSet` | read `{all,deny}` ≙ 全集−deny；`{restricted,allow,ask,deny}` ≙ allow-list 硬边界 | **无损**（PathRuleSet 无 v4 之外的可表达物） |
| `write: PathRuleSet` | 同上；读写独立 | **无损**，且 D1.2「不因写赠读」per-tool 天然成立 |
| `network: allow\|deny` | `allow`→allow；`deny{default}`→deny；**`restricted{...}`→？** | **有缺口**：降级规则必须由用户裁决（见 4.2），缺口来自"网络布尔化"裁决本身，不是投影能力 |
| `memberIdentity/revision` | 运行期对象，非 authoring | 与 v4/v5 语法无关（InvocationAuthority 同理，lease 已声明复用 Alpha.4） |
| 无工具绑定时的成员默认、Leader 映射、同模板多成员 | v4 无"未绑定工具"语义 | **真缺口但极小**：补一条模板级默认绑定规则即可，不需要新语法代 |

样本核验（三个 CI 实例逐一投影均无剩余语义）：`:84` restricted+deny secret 名单、`:256` read 无 mode（默认）+write all+network deny{default}、`:269` 缺 network 字段（语法拒绝，非模糊态）。

## 4. 结论

4.1 **强制面无需 v5**：执行边界的语义 100% 可由 v4 词汇逐调用编译得到；`MemberPolicy` 相对 v4 的净新增只有 authoring 便利（成员级默认、模板级聚合视图），属 UI/糖层，可用「模板默认绑定」小规则补齐，不产生第三套 schema 世代。
4.2 **投影必须携带的裁决**：既有 v4 蓝图中 `network:restricted` 在布尔语义下的降级规则（→deny 是收紧、→allow 是放大——两者都不能静默选）。这是"网络布尔化"裁决引出的**兼容性缺口**，请裁决默认方向（建议：restricted→deny + 迁移报告点名，fail-closed）。
4.3 **P1-01 建议改道**：「v4 io 编译规范 + 模板默认绑定扩展」为正本；v5 若仍要做，降级为 authoring-sugar 路线后续评审（不再阻塞 P1）。

**verdict**：CONDITIONAL-GO（对"编译现有 v4"路线）；待用户裁决 = ① I/O 作用域的呈现粒度（成员级 vs 逐工具，产品 UI 问题）、② restricted→boolean 降级默认方向。
