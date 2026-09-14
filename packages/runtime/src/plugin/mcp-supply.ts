/**
 * multi-mcp Task A (contract 00-contract.md I1) — the single canonical
 * MCP-supply read path + the fail-closed row-config validation of the
 * 0..N `mcpServers` input (C1), the unique-name identity (C2), and the
 * legacy single `mcpServer` value that remains accepted during this alpha
 * (C7).
 *
 * Pure module: no I/O, no `node:` builtins — the row `config` is plain
 * JSON and the validation is a pure function over it. The caller
 * (`host.ts` `validateTeamPluginConfig`) consumes the returned detail and
 * keeps the single error envelope
 * `TeamPluginError(TEAM_PLUGIN_CONFIG_INVALID, 'dsh-agent-team row
 * config: <detail>')`.
 * @module @dsh-agent-team/runtime/plugin/mcp-supply
 */
import type { TeamPluginConfig, TeamPluginMcpServer } from './types.js'

/**
 * The raw JSON shape one `mcpServer` value (or one `mcpServers` entry)
 * has BEFORE validation: the row `config` is plain JSON, so at runtime
 * any value is possible (the typed surface of {@link TeamPluginConfig}
 * only describes the validated shape).
 */
type RawMcpEntry = { name?: unknown; port?: unknown }

/**
 * 唯一 canonical 读取路径（C1/C7）。语义：
 *  - `mcpServers` present（!== undefined）→ 原样返回（调用方已验证）；
 *  - 否则 `mcpServer` 非 null/undefined → `[mcpServer]`；
 *  - 否则 → `[]`。
 * 返回新数组（防御性拷贝），元素引用保持 config 原对象。
 */
export function configuredMcpServers(
  config: Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>,
): readonly TeamPluginMcpServer[] {
  const mcpServers = config.mcpServers
  if (mcpServers !== undefined) {
    // Defensive copy: the caller never aliases the row-config array
    // (mutating the result must not flow back into the config).
    return [...mcpServers]
  }
  // The typed surface declares `mcpServer` required, but the row
  // `config` is plain JSON: a pre-multi-mcp row may omit the key entirely
  // (runtime `undefined`). The validator (mcpSupplyValidationIssue)
  // fail-closes both spellings before any read, so this read is
  // defensive, not permissive.
  const mcpServer = (config as unknown as { mcpServer?: RawMcpEntry | null }).mcpServer
  if (mcpServer === null || mcpServer === undefined) return []
  // The caller has ALREADY validated (fail-closed before any read).
  return [mcpServer as TeamPluginMcpServer]
}

/**
 * fail-closed 校验（纯函数：返回 detail 或 null，不抛错）。
 * 调用方（host.ts）用 detail 走自己的 fail()，保持
 * `TeamPluginError(TEAM_PLUGIN_CONFIG_INVALID, 'dsh-agent-team row config: <detail>')`
 * 单一错误封套。检查顺序（首个命中即返回）：
 *  1. mcpServers present 且非 array
 *     → 'mcpServers must be an array of { name, port: number|null }'
 *  2. 任一 entry 非 object / name 非非空 string / port 非 number|null
 *     → 'mcpServers must be an array of { name: non-empty string, port: number|null }'
 *  3. 重名
 *     → "duplicate mcpServers name '<name>'"
 *  4. mcpServers present 且 mcpServer 非 null
 *     → 'ambiguous MCP configuration: both mcpServers and a non-null mcpServer are present'
 *  5. mcpServers absent：保持现有 legacy 单值检查原文（字节级保留现有 message）
 *     → 'mcpServer must be { name, port: number|null } or null'
 *     （legacy 路径语义与现状完全一致，包括现状未拒空 name 的行为 — C7）
 */
export function mcpSupplyValidationIssue(
  config: Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>,
): string | null {
  const mcpServers = config.mcpServers
  // The raw JSON reality of the legacy single value: although the typed
  // surface declares `mcpServer` required, the key may be ABSENT at
  // runtime (pre-multi-mcp row) — see configuredMcpServers.
  const mcpServer = (config as unknown as { mcpServer?: RawMcpEntry | null }).mcpServer

  if (mcpServers !== undefined) {
    // 1. mcpServers present 且非 array (a JSON `null` is present but not
    //    an array — fail closed here, so the read path above can assume
    //    a real array on every validated config).
    if (!Array.isArray(mcpServers)) {
      return 'mcpServers must be an array of { name, port: number|null }'
    }
    // 2. 任一 entry 非 object / name 非非空 string / port 非 number|null.
    for (const rawEntry of mcpServers as readonly unknown[]) {
      const entry = rawEntry as RawMcpEntry | null | undefined
      if (
        entry === null ||
        entry === undefined ||
        typeof entry !== 'object' ||
        typeof entry.name !== 'string' ||
        entry.name.length === 0 ||
        (entry.port !== null && typeof entry.port !== 'number')
      ) {
        return 'mcpServers must be an array of { name: non-empty string, port: number|null }'
      }
    }
    // 3. 重名 (server name is the identity — C2; a duplicate makes the
    //    policy/tool-namespace target undecidable, plan §6.4).
    const seen = new Set<string>()
    for (const entry of mcpServers) {
      if (seen.has(entry.name)) {
        return `duplicate mcpServers name '${entry.name}'`
      }
      seen.add(entry.name)
    }
    // 4. mcpServers present 且 mcpServer 非 null — no implicit
    //    "who overrides whom" precedence is built (plan §2.1). An ABSENT
    //    (undefined) legacy key is NOT present, so it is not ambiguous.
    if (mcpServer !== null && mcpServer !== undefined) {
      return 'ambiguous MCP configuration: both mcpServers and a non-null mcpServer are present'
    }
    return null
  }

  // 5. mcpServers absent: the EXISTING legacy single-value check, kept
  //    byte-identical (condition shape and detail message — C7),
  //    including the current behavior of failing an ABSENT `mcpServer`
  //    key and of NOT rejecting an empty `name`.
  if (
    mcpServer !== null &&
    (mcpServer === undefined ||
      typeof mcpServer !== 'object' ||
      typeof mcpServer.name !== 'string' ||
      (mcpServer.port !== null && typeof mcpServer.port !== 'number'))
  ) {
    return 'mcpServer must be { name, port: number|null } or null'
  }
  return null
}
