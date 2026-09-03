// @vitest-environment jsdom
/**
 * P9-T10 (P9-S7) — the vNext team client plugin surface (the frozen
 * 14-row migrate table: `team-plugin.client.spec.tsx` = ADAPT "new
 * registrations + explicit absence of marker").
 *
 * The legacy spec targeted the legacy fork's `src/client/index.ts`
 * surface — the `conversation.chat.node` marker registration (keyed
 * `team-marker`), the `applyNode` / `applyInvariant` entrypoints, and the
 * legacy package-ownership invariant. None of that exists in the vNext
 * package (the P9-S7 DROP list removes the marker entirely; vNext has no
 * Team SessionEvents to register a node for). The vNext surface is the
 * D-T9-13 core/glue split:
 *
 *   - `src/plugin/client.ts` — the plugin object (`name` / `inject` /
 *     `apply`) and the ONLY `.tsx` value import of the package (glue);
 *   - `src/plugin/team-mount-core.ts` — the mount behavior (pinned by the
 *     EXECUTED `client-plugin-mount.test.ts`; not re-pinned here).
 *
 * This spec therefore pins exactly what the mount test cannot: the plugin
 * object is the frozen Cordis shape; the glue wires the REAL components
 * (identity — the mount test uses throwing doubles); the registrations are
 * EXACTLY the frozen three, in the frozen order, with the frozen
 * id/order/label/inject options; the explicit ABSENCE of any
 * `conversation.chat.node` registration (no marker, no synthetic
 * Chat/Trajectory node); the locale dictionaries register once under the
 * `team` namespace with the en+zh pair; and the settings section renders
 * through the migrated zh dictionary.
 *
 * P9-S7 binding: this file carries no client-runtime import at all
 * (the marker's runtime node API is gone with the marker).
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import {
  REMOTE_CONTRACT_VERSION,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  apply,
  inject,
  name,
  type Config,
  type TeamPluginClientContext,
} from '../src/plugin/client.js'
import type {
  TeamAgentPresetRow,
  TeamPluginEffect,
  TeamSlots,
} from '../src/plugin/team-mount-core.js'
import type { TeamRpcCarrier } from '../src/transport/host-seams.js'
import { en, zh } from '../src/ui/locales.js'
import { TeamDock } from '../src/ui/TeamDock.js'
import { TeamSettingsSection, type TeamSettingsSectionProps } from '../src/ui/TeamSettingsSection.js'
import { TeamView } from '../src/ui/TeamView.js'

afterEach(cleanup)

// ---------------------------------------------------------------------------
// The seam doubles (the five public seams + the fiber effect — the same
// recording doubles as the executed mount test; here the REAL components
// ride the mount, the doubles only record).
// ---------------------------------------------------------------------------

interface Registration {
  readonly options: Record<string, unknown>
  readonly component: unknown
}

interface Fixture {
  readonly ctx: TeamPluginClientContext
  readonly localeRegs: Array<{ readonly ns: string; readonly dicts: unknown }>
  readonly injects: Array<{ readonly key: string; readonly dispose: () => void }>
  readonly registers: Registration[]
  readonly effects: Array<{ readonly label: string | undefined; readonly dispose: () => void }>
}

function makeFixture(): Fixture {
  // The carrier double: returns the RemoteResponse verbatim (the carrier
  // result IS the frozen dispatcher result) and records every call. No
  // session is opened by this spec, so no call is ever made.
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint) => {
      if (channel !== '/team-remote') {
        throw new Error(`plugin spec: unexpected channel ${String(channel)}`)
      }
      return buildRemoteSuccess({}, {
        method: endpoint,
        endpoint,
        contractVersion: REMOTE_CONTRACT_VERSION,
        requestToken: null,
      })
    },
  }

  // The connection generation double (starts connected, id 1).
  let generationSnapshot: { readonly id: number } | undefined = { id: 1 }
  const generationListeners = new Set<() => void>()
  const generation = {
    getSnapshot: (): { readonly id: number } | undefined => generationSnapshot,
    subscribe: (listener: () => void): (() => void) => {
      generationListeners.add(listener)
      return () => {
        generationListeners.delete(listener)
      }
    },
    set: (snapshot: { readonly id: number } | undefined): void => {
      generationSnapshot = snapshot
      for (const listener of [...generationListeners]) listener()
    },
  }

  // The public sessions seam double (Seam 3, open/create).
  const sessions = {
    create: async (o?: { readonly workspaceId?: string }): Promise<string> => {
      void o
      return 'root-1'
    },
    open: (sessionId: string): void => {
      void sessionId
    },
  }

  // The public remote seam double (Seam 6).
  const presets: readonly TeamAgentPresetRow[] = []
  const remote = {
    agentPresets: {
      list: async (): Promise<readonly TeamAgentPresetRow[]> => presets,
    },
  }

  // The locale runtime double (records registrations; bound translator
  // echoes `ns:key` so label assertions are exact).
  const localeRegs: Array<{ readonly ns: string; readonly dicts: unknown }> = []
  const locale = {
    register: (ns: string, ...rest: unknown[]): (() => void) => {
      localeRegs.push({ ns, dicts: rest[0] })
      return () => {}
    },
    bind: (ns: string) => (key: string): string => `${ns}:${key}`,
  }

  // The slots seam double: `register` records the option literal +
  // component; `inject` runs the callback immediately and collects its
  // effect.
  const registers: Registration[] = []
  const injects: Array<{ readonly key: string; readonly dispose: () => void }> = []
  const slots: TeamSlots = {
    register: (options: object, component: unknown) => {
      registers.push({ options: options as Record<string, unknown>, component })
      return () => {}
    },
    inject: (key: string, callback: () => TeamPluginEffect) => {
      const entry: { key: string; dispose: () => void } = { key, dispose: () => {} }
      injects.push(entry)
      const effectResult = callback()
      if (typeof effectResult === 'function') {
        entry.dispose = effectResult
      } else {
        const disposers: Array<() => void> = [...effectResult]
        entry.dispose = () => {
          for (const dispose of disposers) dispose()
        }
      }
      return entry.dispose
    },
  }

  // The fiber effect double: runs the executor now; stores the disposer.
  const effects: Array<{ readonly label: string | undefined; readonly dispose: () => void }> = []
  const effect = (execute: () => TeamPluginEffect, label?: string): void => {
    const result = execute()
    let dispose: () => void
    if (typeof result === 'function') {
      dispose = result
    } else {
      const disposers: Array<() => void> = [...result]
      dispose = () => {
        for (const d of disposers) d()
      }
    }
    effects.push({ label, dispose })
  }

  const ctx: TeamPluginClientContext = {
    slots,
    locale,
    sessions,
    connection: { rpc: carrier, generation },
    remote,
    effect,
  }

  return { ctx, localeRegs, injects, registers, effects }
}

/** The plugin row config under test (the dshHome-bound full face, D-T9-1). */
const CONFIG: Config = { dshHome: 'D:/dsh-home' }

/** Apply the REAL plugin entrypoint onto one fixture. */
function applyOnFixture(): Fixture {
  const fixture = makeFixture()
  apply(fixture.ctx, CONFIG)
  return fixture
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P9-T10 (P9-S7) client plugin — the vNext surface (legacy spec ADAPT)', () => {
  it('the plugin object is the frozen Cordis shape', () => {
    expect(name).toBe('dsh-agent-team-client')
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'connection', 'remote'])
    expect(typeof apply).toBe('function')
  })

  it('apply registers exactly the frozen three slots, in the frozen order', () => {
    const f = applyOnFixture()
    expect(f.registers).toHaveLength(3)
    const options = f.registers.map((r) => r.options)
    expect(options.map((o) => o.name)).toEqual([
      'settings.section',
      'conversation.view',
      'conversation.input.dock',
    ])
    expect(options.map((o) => o.id)).toEqual(['team', 'team', 'team'])
    expect(options.map((o) => o.order)).toEqual([50, 20, 15])
    // The frozen label/inject option faces (settings + view carry labels;
    // view + dock carry the inject face; dock has no label).
    expect(typeof options[0]!.label).toBe('function')
    expect(options[0]!.inject).toBeUndefined()
    expect(typeof options[1]!.label).toBe('function')
    expect(typeof options[1]!.inject).toBe('function')
    expect(options[2]!.label).toBeUndefined()
    expect(typeof options[2]!.inject).toBe('function')
  })

  it('the registered components are the REAL components (glue identity, not doubles)', () => {
    const f = applyOnFixture()
    expect(f.registers[0]!.component).toBe(TeamSettingsSection)
    expect(f.registers[1]!.component).toBe(TeamView)
    expect(f.registers[2]!.component).toBe(TeamDock)
  })

  it('explicit absence: no conversation.chat.node registration (the marker is dropped)', () => {
    const f = applyOnFixture()
    const names = f.registers.map((r) => r.options.name)
    expect(names).toEqual(['settings.section', 'conversation.view', 'conversation.input.dock'])
    expect(names.includes('conversation.chat.node')).toBe(false)
  })

  it('the locale dictionaries register once under the team namespace (the en+zh pair)', () => {
    const f = applyOnFixture()
    expect(f.localeRegs).toHaveLength(1)
    expect(f.localeRegs[0]).toEqual({ ns: 'team', dicts: { zh, en } })
  })

  it('the settings section renders through the migrated zh dictionary', () => {
    const settingsProps = { t: makeTranslate(zh) } as unknown as TeamSettingsSectionProps
    render(<TeamSettingsSection {...settingsProps} />)
    expect(screen.getByText('团队成员配置')).toBeTruthy()
    // The legacy "renders the read-only configuration instructions"
    // assertion, ported: the empty-state instruction block renders the
    // migrated zh strings verbatim (locales.ts, the `team` namespace).
    expect(screen.getByText('未配置团队成员')).toBeTruthy()
    expect(screen.getByText('在以下目录创建 Markdown 定义文件以配置团队成员：')).toBeTruthy()
    expect(screen.getByText('全局：$DSH_HOME/teammates/*.md')).toBeTruthy()
    expect(screen.getByText('项目级：.dsh/teammates/*.md')).toBeTruthy()
    expect(screen.getByText('需要恰好一个 role: leader 的定义')).toBeTruthy()
  })

  it('every registration and effect leaves with the fiber (clean disposal)', () => {
    const f = applyOnFixture()
    expect(f.injects.map((e) => e.key)).toEqual([
      'settings.section',
      'conversation.view',
      'conversation.input.dock',
    ])
    expect(() => {
      for (const entry of [...f.injects].reverse()) entry.dispose()
      for (const entry of [...f.effects].reverse()) entry.dispose()
    }).not.toThrow()
  })
})
