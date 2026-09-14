/**
 * mcp-supply-config.test.ts — multi-mcp Task A (contract 00-contract.md
 * I1/I2/I3): the MCP config contract + normalization — 0..N named MCP
 * servers (C1), serverName unique and the identity (C2), the legacy
 * single `mcpServer` still accepted during this alpha (C7), and the
 * ambiguous dual configuration failing closed (plan §2.1).
 *
 * Pure unit tests (no bridge, no I/O):
 *  - the normalization rules of `configuredMcpServers` (the single
 *    canonical read path, I1);
 *  - the fail-closed details of `mcpSupplyValidationIssue` (check order
 *    1→5 and the message strings verbatim per I1 — the legacy path 5 is
 *    pinned byte-identical to the pre-multi-mcp host check, C7);
 *  - the host integration surface: `host.validateTeamPluginConfig` (the
 *    row-config boundary) — the SAME family as
 *    pbf-default-artifact-urls.test.ts (direct source-entry import, the
 *    single fail() error envelope, the TEAM_PLUGIN_CONFIG_INVALID code).
 *
 * Runner note: the plain-node shim forbids async `it()` bodies — all
 * assertions here are synchronous (the entry is a static module import,
 * exactly like p8s5a-host-loadability).
 * @module @dsh-agent-team/runtime/test/mcp-supply-config
 */

import { describe, expect, it } from 'vitest'
import * as host from '../src/plugin/host.js'
import { configuredMcpServers, mcpSupplyValidationIssue } from '../src/plugin/mcp-supply.js'
import type {
  TeamPluginConfig,
  TeamPluginMcpServer,
} from '../src/plugin/types.js'
import {
  TEAM_PLUGIN_ERROR_CODES,
  isTeamPluginError,
} from '../src/plugin/types.js'

// The exact detail strings, verbatim per contract I1.
const DETAIL_NOT_ARRAY = 'mcpServers must be an array of { name, port: number|null }'
const DETAIL_BAD_ENTRY =
  'mcpServers must be an array of { name: non-empty string, port: number|null }'
const DETAIL_AMBIGUOUS =
  'ambiguous MCP configuration: both mcpServers and a non-null mcpServer are present'
const LEGACY_DETAIL = 'mcpServer must be { name, port: number|null } or null'

/**
 * The MCP-supply projection the validator and the read path consume.
 * Presence-aware builder: a key is set ONLY when the override object
 * carries it (`in`), so `{}` = both keys absent at runtime (the
 * pre-multi-mcp row shape) and explicit `null` stays distinct.
 */
type McpSupplyConfig = Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>

function supplyConfig(
  overrides: { mcpServer?: unknown; mcpServers?: unknown },
): McpSupplyConfig {
  const raw: Record<string, unknown> = {}
  if ('mcpServer' in overrides) raw.mcpServer = overrides.mcpServer
  if ('mcpServers' in overrides) raw.mcpServers = overrides.mcpServers
  return raw as unknown as McpSupplyConfig
}

/**
 * Assert the pure validator returns exactly `detail` (or null for a
 * passing config).
 */
function expectIssue(
  overrides: { mcpServer?: unknown; mcpServers?: unknown },
  detail: string | null,
): void {
  expect(mcpSupplyValidationIssue(supplyConfig(overrides))).toBe(detail)
}

describe('multi-mcp: configuredMcpServers — the single canonical read path (I1)', () => {
  it('mcpServers present → returned as-is (same element references, a NEW array)', () => {
    const alpha: TeamPluginMcpServer = { name: 'alpha', port: 3494 }
    const beta: TeamPluginMcpServer = { name: 'beta', port: null }
    const cfg = supplyConfig({ mcpServers: [alpha, beta], mcpServer: null })
    const out = configuredMcpServers(cfg)
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(alpha) // element references stay the config originals
    expect(out[1]).toBe(beta)
    expect(out).not.toBe(cfg.mcpServers) // the returned array is a fresh copy
  })

  it('mcpServers absent + legacy object → [mcpServer]', () => {
    const legacy: TeamPluginMcpServer = { name: 'legacy', port: 3496 }
    const out = configuredMcpServers(supplyConfig({ mcpServer: legacy }))
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(legacy)
  })

  it('mcpServers absent + mcpServer null → []', () => {
    expect(configuredMcpServers(supplyConfig({ mcpServer: null }))).toEqual([])
  })

  it('both absent (legacy key missing, pre-multi-mcp row) → []', () => {
    expect(configuredMcpServers(supplyConfig({}))).toEqual([])
  })

  it('mcpServers present as an empty array → [] (as-is; [] is the legal zero-MCP form)', () => {
    const out = configuredMcpServers(supplyConfig({ mcpServers: [], mcpServer: null }))
    expect(out).toEqual([])
  })

  it('returns a defensive copy: mutating the result never flows back into the config', () => {
    const alpha: TeamPluginMcpServer = { name: 'alpha', port: 3494 }
    const beta: TeamPluginMcpServer = { name: 'beta', port: 3495 }
    const cfg = supplyConfig({ mcpServers: [alpha], mcpServer: null })
    const out = configuredMcpServers(cfg)
    ;(out as TeamPluginMcpServer[]).push(beta)
    expect(out).toHaveLength(2)
    expect(cfg.mcpServers).toHaveLength(1) // the row config is untouched
    expect(cfg.mcpServers?.[0]).toBe(alpha)

    // The legacy path returns a fresh single-element array too.
    const legacy: TeamPluginMcpServer = { name: 'legacy', port: 3496 }
    const cfgLegacy = supplyConfig({ mcpServer: legacy })
    const outLegacy = configuredMcpServers(cfgLegacy)
    ;(outLegacy as TeamPluginMcpServer[]).push(beta)
    expect(outLegacy).toHaveLength(2)
    expect(cfgLegacy.mcpServer).toBe(legacy) // still the original object
  })
})

describe('multi-mcp: mcpSupplyValidationIssue — check order 1→5, verbatim details (I1)', () => {
  it('check 1: mcpServers present as a non-array (string) fails closed', () => {
    expectIssue({ mcpServers: 'alpha', mcpServer: null }, DETAIL_NOT_ARRAY)
  })

  it('check 1: mcpServers present as JSON null fails closed (the read path can never see it)', () => {
    expectIssue({ mcpServers: null, mcpServer: null }, DETAIL_NOT_ARRAY)
  })

  it('check 2: a non-object entry (string) fails closed', () => {
    expectIssue(
      { mcpServers: ['alpha'], mcpServer: null },
      DETAIL_BAD_ENTRY,
    )
  })

  it('check 2: a null entry fails closed', () => {
    expectIssue({ mcpServers: [null], mcpServer: null }, DETAIL_BAD_ENTRY)
  })

  it('check 2: an entry with an empty-string name fails closed (C2 identity must be non-empty)', () => {
    expectIssue(
      { mcpServers: [{ name: '', port: 3494 }], mcpServer: null },
      DETAIL_BAD_ENTRY,
    )
  })

  it('check 2: an entry with a non-string name fails closed', () => {
    expectIssue(
      { mcpServers: [{ name: 7, port: 3494 }], mcpServer: null },
      DETAIL_BAD_ENTRY,
    )
  })

  it('check 2: an entry with a wrong port type (string) fails closed', () => {
    expectIssue(
      { mcpServers: [{ name: 'alpha', port: '3494' }], mcpServer: null },
      DETAIL_BAD_ENTRY,
    )
  })

  it('check 2: an entry missing the port key fails closed (port must be number|null)', () => {
    expectIssue(
      { mcpServers: [{ name: 'alpha' }], mcpServer: null },
      DETAIL_BAD_ENTRY,
    )
  })

  it('check 3: duplicate names fail closed, the name named in the detail', () => {
    expectIssue(
      {
        mcpServers: [
          { name: 'A', port: 3494 },
          { name: 'A', port: 3495 },
        ],
        mcpServer: null,
      },
      "duplicate mcpServers name 'A'",
    )
  })

  it('check 3: the FIRST duplicate hit is reported', () => {
    expectIssue(
      {
        mcpServers: [
          { name: 'B', port: 3494 },
          { name: 'A', port: 3495 },
          { name: 'A', port: null },
        ],
        mcpServer: null,
      },
      "duplicate mcpServers name 'A'",
    )
  })

  it('well-formed distinct servers pass (port null on an entry is legal — not mounted)', () => {
    expectIssue(
      {
        mcpServers: [
          { name: 'alpha', port: 3494 },
          { name: 'beta', port: null },
        ],
        mcpServer: null,
      },
      null,
    )
  })

  it('check 4: mcpServers + a non-null mcpServer fail closed as ambiguous', () => {
    expectIssue(
      {
        mcpServers: [{ name: 'A', port: 3494 }],
        mcpServer: { name: 'B', port: 3495 },
      },
      DETAIL_AMBIGUOUS,
    )
  })

  it('check 4: even an EMPTY mcpServers array + a non-null mcpServer is ambiguous (no implicit precedence)', () => {
    expectIssue(
      {
        mcpServers: [],
        mcpServer: { name: 'B', port: 3495 },
      },
      DETAIL_AMBIGUOUS,
    )
  })

  it('mcpServers + a NULL mcpServer is NOT ambiguous (null = absent)', () => {
    expectIssue(
      { mcpServers: [{ name: 'A', port: 3494 }], mcpServer: null },
      null,
    )
  })

  it('mcpServers + an ABSENT mcpServer key is NOT ambiguous (absent ≠ present)', () => {
    expectIssue({ mcpServers: [{ name: 'A', port: 3494 }] }, null)
  })

  it('check order: a malformed entry (check 2) beats ambiguous (check 4)', () => {
    expectIssue(
      {
        mcpServers: [{ name: '', port: 3494 }],
        mcpServer: { name: 'B', port: 3495 },
      },
      DETAIL_BAD_ENTRY,
    )
  })

  it('check order: a duplicate (check 3) beats ambiguous (check 4)', () => {
    expectIssue(
      {
        mcpServers: [
          { name: 'A', port: 3494 },
          { name: 'A', port: 3495 },
        ],
        mcpServer: { name: 'B', port: 3496 },
      },
      "duplicate mcpServers name 'A'",
    )
  })

  it('check order: a non-array mcpServers (check 1) beats ambiguous (check 4)', () => {
    expectIssue(
      { mcpServers: 'nope', mcpServer: { name: 'B', port: 3495 } },
      DETAIL_NOT_ARRAY,
    )
  })

  // --- check 5: the legacy path (mcpServers absent) — C7 pin ----------
  // The detail and the acceptance/rejection boundaries are BYTE-IDENTICAL
  // to the pre-multi-mcp host check (plan §2.1 兼容期; no semantic drift).

  it('check 5: a valid legacy single server passes (name string, port number)', () => {
    expectIssue({ mcpServer: { name: 'A', port: 3494 } }, null)
  })

  it('check 5: a valid legacy single server with port null passes', () => {
    expectIssue({ mcpServer: { name: 'A', port: null } }, null)
  })

  it('check 5: an EMPTY legacy name is NOT rejected (current behavior pinned — C7)', () => {
    expectIssue({ mcpServer: { name: '', port: 3494 } }, null)
  })

  it('check 5: a legacy non-string name fails closed with the byte-identical detail', () => {
    expectIssue({ mcpServer: { name: 42, port: 3494 } }, LEGACY_DETAIL)
  })

  it('check 5: a legacy wrong port type (string) fails closed with the byte-identical detail', () => {
    expectIssue({ mcpServer: { name: 'A', port: '3494' } }, LEGACY_DETAIL)
  })

  it('check 5: a legacy non-object value (string) fails closed with the byte-identical detail', () => {
    expectIssue({ mcpServer: 'garbage' }, LEGACY_DETAIL)
  })

  it('check 5: a null legacy mcpServer passes', () => {
    expectIssue({ mcpServer: null }, null)
  })

  it('check 5: an ABSENT legacy mcpServer key fails closed (current behavior pinned — the field is required)', () => {
    // `{}` = neither key present: the legacy path applies and the missing
    // key fails exactly as the pre-multi-mcp host check did.
    expectIssue({}, LEGACY_DETAIL)
  })
})

describe('multi-mcp: host.validateTeamPluginConfig — the row-config boundary (I3)', () => {
  /** The minimal valid row config (the pbf-default-artifact-urls shape,
   *  own ids — the entry's ONLY input channel). */
  function minimalConfig(): Record<string, unknown> {
    return {
      bootPhase: 'create',
      rootSessionId: 'session-mmsupply',
      blueprintSource: 'schemaVersion: 1\nblueprintId: MMSUPPLY-BP\nrevision: "1"\n',
      generation: 1,
      seedMembers: [],
      staticModel: { provider: 'p', model: 'm' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    }
  }

  /** Assert the validator rejects with the single fail() envelope:
   *  TeamPluginError(TEAM_PLUGIN_CONFIG_INVALID, 'dsh-agent-team row
   *  config: <detail>') — exact code AND exact message. */
  function expectConfigInvalid(
    raw: Record<string, unknown>,
    detail: string,
  ): void {
    let thrown: unknown
    try {
      host.validateTeamPluginConfig(raw)
    } catch (err) {
      thrown = err
    }
    expect(isTeamPluginError(thrown)).toBe(true)
    if (!isTeamPluginError(thrown)) {
      throw new Error(`expected a TeamPluginError, got ${String(thrown)}`)
    }
    expect(thrown.code).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID)
    expect(thrown.message).toBe(`dsh-agent-team row config: ${detail}`)
  }

  it('a canonical mcpServers row (legacy key ABSENT) passes and round-trips', () => {
    // Explicit Record typing: the row config is plain JSON; deleting the
    // legacy key exercises the new canonical form (no `mcpServer` at all).
    const raw: Record<string, unknown> = {
      ...minimalConfig(),
      mcpServers: [
        { name: 'alpha', port: 3494 },
        { name: 'beta', port: null },
      ],
    }
    delete raw.mcpServer
    const validated = host.validateTeamPluginConfig(raw)
    expect(validated.rootSessionId).toBe('session-mmsupply')
    expect(validated.mcpServers).toEqual([
      { name: 'alpha', port: 3494 },
      { name: 'beta', port: null },
    ])
  })

  it('a mcpServers row with a NULL legacy mcpServer passes (the migration shape)', () => {
    const validated = host.validateTeamPluginConfig({
      ...minimalConfig(),
      mcpServers: [{ name: 'alpha', port: 3494 }],
      mcpServer: null,
    })
    expect(validated.mcpServers).toEqual([{ name: 'alpha', port: 3494 }])
    expect(validated.mcpServer).toBeNull()
  })

  it('a duplicate mcpServers name is rejected as TEAM_PLUGIN_CONFIG_INVALID (the field named)', () => {
    expectConfigInvalid(
      {
        ...minimalConfig(),
        mcpServers: [
          { name: 'A', port: 3494 },
          { name: 'A', port: 3495 },
        ],
      },
      "duplicate mcpServers name 'A'",
    )
  })

  it('a non-array mcpServers is rejected as TEAM_PLUGIN_CONFIG_INVALID (detail 1)', () => {
    expectConfigInvalid(
      { ...minimalConfig(), mcpServers: 'nope' },
      DETAIL_NOT_ARRAY,
    )
  })

  it('an ambiguous dual configuration is rejected as TEAM_PLUGIN_CONFIG_INVALID (detail 4)', () => {
    expectConfigInvalid(
      {
        ...minimalConfig(),
        mcpServers: [{ name: 'A', port: 3494 }],
        mcpServer: { name: 'B', port: 3495 },
      },
      DETAIL_AMBIGUOUS,
    )
  })

  it('the legacy single-server row is still accepted (C7 — no regression)', () => {
    const validated = host.validateTeamPluginConfig({
      ...minimalConfig(),
      mcpServer: { name: 'A', port: 3494 },
    })
    expect(validated.mcpServer).toEqual({ name: 'A', port: 3494 })
    expect(validated.mcpServers).toBeUndefined()
  })

  it('a malformed legacy mcpServer is still rejected with the byte-identical detail (C7 — no regression)', () => {
    expectConfigInvalid(
      { ...minimalConfig(), mcpServer: { name: 42, port: 3494 } },
      LEGACY_DETAIL,
    )
  })
})
