# A2C-5 — offset/limit recon ruling (pinned upstream, read-only)

> 计划 §8.2 授权 recon 裁决 offset 语义；本文件留痕裁决依据。
> Pinned checkout: `tests/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`（0.1.2-rc.1，pristine 复核：porcelain 0 + HEAD 一致，2026-09-12 派发前 & 本任务运行后两次）。

## Recon 对象

- `packages/fs/tool-fs/src/read.ts`（pinned @ a66e470204）
  - L15 `export const READ_LIMIT = 2000` — "Default and maximum number of lines returned by one `read` call (the `readLimit` config)."
  - L55-61 `parseReadArgs(args, maxLimit)`:
    ```ts
    const offset = args.offset === undefined ? 1 : parsePositiveInteger(args.offset, 'offset')
    const limit  = args.limit  === undefined ? maxLimit : parsePositiveInteger(args.limit, 'limit')
    if (limit > maxLimit) throw new Error(`limit must be less than or equal to ${maxLimit}`)
    ```
  - L79+ 工具 schema：`offset` 文档 "Defaults to 1"（one-based first line）；`limit` 文档 "Maximum number of lines to return. Defaults to the deployment readLimit."
- `packages/fs/tool-fs/src/index.ts`（pinned @ a66e470204）
  - L37 `readLimit: z.number().default(READ_LIMIT)` — `readLimit` 是 **deployment-configurable** 的插件配置，缺省 2000。

## 裁决

| 语义 | 裁决 | 依据 |
|---|---|---|
| offset omitted | **不变**：= 1（one-based 固定默认） | `parseReadArgs` L57：`offset === undefined ? 1`——upstream 固定语义，与 deployment 无关；schema 文档同。计划 §8.2 假设成立。 |
| limit omitted | **改**：identity = **null**（caller 未显式给定） | `parseReadArgs` L58：`limit === undefined ? maxLimit`——omitted 的实际值是 **deployment `readLimit` 配置**（默认 2000、可配置），不是固定语义。旧投影把 deployment 常量 2000 代入 identity = §8.1 伪等价。按 §8.2 冻结修法：omitted → null（保守 identity；不读 deployment-private 配置，§8.3）。 |
| limit explicit N | **不变**：= N（正整数校验逐字保留） | `parsePositiveInteger` L42-47（finite integer ≥ 1）与 canonical 模块既有 `isPositiveInteger` 镜像一致——T10 逐字保留（`read-limit-invalid` / `read-offset-invalid` 闭集 reason 不变）。 |
| `limit > maxLimit` 拒绝 | **不镜像**（维持现状） | `maxLimit` 是 deployment-private（`readLimit` 配置）——§8.3 禁止读取 private tool config / 不引入 live readLimit dependency。canonical 层只做与 deployment 无关的正整数镜像校验；超 cap 的显式 limit 由 upstream 工具在执行时拒绝（该调用永不执行，Team 层不为其铸造 authority——与 shell 类 sandboxPermissions 合法性同理）。 |

**结论**：offset 语义假设 **成立，不偏离**（omitted 仍 = 1 起点）；limit omitted → null identity 按 §8.2 执行。无 deviation 触发（§8.3 的 recon 偏离条款未被激活）。

## 兼容性留痕（主 Agent 裁决，记录在案）

read 类 fingerprint 变化 = 旧的 in-flight pending-ask 行（旧规则铸造，omitted 行带 `limit: 2000` 投影）在新代码下失配 → 自然 fail-closed 失效（无 allow 消费、无错误扩大）——计划可接受的 strictness 提升；RED 测试已证明旧伪等价行为消失（T1：两 identity 不同；T6/T7：one-shot 不跨 identity 消费）。
