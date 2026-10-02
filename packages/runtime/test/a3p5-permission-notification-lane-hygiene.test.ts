/**
 * Alpha.3 PR5 — LANE HYGIENE for the permission notification/projection
 * layer. Four legs, each pinning one structural contract the PR owns:
 *
 * 1. THE CLOSED EXPORT SURFACE ("notification/projection output is never
 *    consumed as authorization input", ADR §9): the runtime export set is
 *    EXACTLY the allow-list (two factories, one pure builder, one pure
 *    renderer, the inject-only delivery binding + adapter + detached
 *    dispatcher, one typed drop error), and no export name — value or
 *    type — carries decision/authority vocabulary (authorize / resolve /
 *    assemble / mutate / grant / revoke / envelope / admit / approve /
 *    decide / permit). The module exposes NO PATH to a decision or
 *    mutation input: there is nothing to feed a resolver, an assembler,
 *    or the mutation service, in either direction — the lane's own inputs
 *    are type-only snapshots, never the reverse.
 *
 * 2. THE IMPORT GRAPH (PR60-safety + purity): every REPO cross-directory
 *    edge of the module is TYPE-ONLY to the stable PR1 overlay vocabulary
 *    (`../permission-governance/*`); the only admitted cross-package
 *    edges are the two PUBLIC upstream packages of the parent GO binding
 *    ruling — `@deepseek-ai/dsh-agent` TYPE-ONLY and `@deepseek-ai/dsh-llm`
 *    with EXACTLY one value member (`createUserMessage`). NO edge at all
 *    to the governance mutation lane, the effective-policy lane, the
 *    resolver, storage, the mutation plane, admission, the plugin WIP
 *    files (host.ts / permission-plane / blueprint schema) or anything
 *    under `src/` — so PR60's in-flight envelope/authority-schema and
 *    host/plane rewrites cannot collide with this lane.
 *
 * 3. THE ZERO-CONSUMER WALK (PR1/PR2/PR3 precedent): the layer lands
 *    DORMANT — no production source outside the module directory and the
 *    test directory imports it. The wiring splice (post-commit emission
 *    + production read-projection wiring + integration test) is a
 *    deliberate follow-up after PR60 stabilizes; landing it must update
 *    this leg ON PURPOSE, not by accident.
 *
 * 4. THE MIRRORED DURABLE BOUNDS: the renderer mirrors the overlay
 *    audit-reason bound instead of importing storage (keeping the lane
 *    runtime-free); the pin compares the mirror against the storage
 *    authority so neither side can drift silently (PR3 precedent).
 *
 * Offline, host-free. The only I/O is reading this package's own source.
 *
 * @module @dsh-agent-team/runtime/test/a3p5-permission-notification-lane-hygiene
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as lane from '../permission-notification/index.js'
import { PERMISSION_OVERLAY_MAX_REASON_LENGTH } from '../../storage/schema/permission-overlay.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME_ROOT = join(HERE, '..')
const MODULE_DIR = join(RUNTIME_ROOT, 'permission-notification')

/** Every scannable source line of the lane, tagged with its file. */
function moduleSources(): { file: string; source: string }[] {
  return ['types.ts', 'notification.ts', 'projection.ts', 'binding.ts', 'index.ts'].map((file) => ({
    file,
    source: readFileSync(join(MODULE_DIR, file), 'utf8'),
  }))
}

/** Import specifiers across ALL import forms (value + type) of one source. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/^import\b[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1] as string)
}

describe('leg 1 — the export surface is closed and carries no authority vocabulary', () => {
  it('the runtime exports are EXACTLY the allow-list', () => {
    expect(Object.keys(lane).sort()).toEqual([
      'PermissionNoticeDropped',
      'createPermissionChangeNotifier',
      'createPermissionDeliveryAdapter',
      'createPermissionDeliveryBinding',
      'createPermissionReadProjection',
      'detachPermissionNotice',
      'permissionChangeNotificationFromSnapshot',
      'renderPermissionChangeNotification',
    ])
  })

  it('no export NAME (value or type) names a decision / authority input', () => {
    // The vocabulary a RESOLVER, ASSEMBLER or the MUTATION SERVICE eats.
    // Nothing exported here carries it — the awareness layer has no
    // surface that could be wired "backwards" into a decision.
    const forbiddenName = /authoriz|resolve|assembl|mutat|grant|revoke|envelope|admit|approv|decid|permit|deny|policystate/i
    const offenders = Object.keys(lane).filter((name) => forbiddenName.test(name))
    expect(offenders).toEqual([])
    // The barrel's TYPE exports too (names as they appear in index.ts).
    const indexSource = readFileSync(join(MODULE_DIR, 'index.ts'), 'utf8')
    const typeExports = [...indexSource.matchAll(/^export type \{([^}]*)\}/gm)].flatMap((block) =>
      (block[1] as string).split(',').map((name) => name.trim()).filter((name) => name.length > 0),
    )
    expect(typeExports.length).toBeGreaterThan(0)
    expect(typeExports.filter((name) => forbiddenName.test(name))).toEqual([])
  })

  it('the lane never names the mutation/envelope/authority INPUT vocabularies', () => {
    // Not as an import, not as an identifier: the notification/projection
    // types are structurally incapable of standing in for decision input.
    for (const { source } of moduleSources()) {
      expect(source).not.toMatch(/PermissionMutation(?!Notification)/)
      expect(source).not.toMatch(/MutationEnvelope|MutationAuthority|PermissionMutationEnvelope/)
      expect(source).not.toMatch(/GovernancePermissionMutation/)
    }
  })
})

describe('leg 2 — the import graph: repo edges TYPE-ONLY; public upstream edges as pinned', () => {
  it('every cross-directory import is TYPE-ONLY to the PR1 overlay vocabulary (plus the two pinned PUBLIC upstream edges)', () => {
    // PUBLIC upstream packages the parent GO admitted for the binding
    // module — the exact closed allow-list, nothing else may cross by name.
    const upstreamAllow = new Set(['@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-agent'])
    for (const { file, source } of moduleSources()) {
      for (const specifier of importSpecifiers(source)) {
        const local = specifier.startsWith('./')
        const pr1TypeOnly = specifier === '../permission-governance/types.js' ||
          specifier === '../permission-governance/port.js'
        const upstream = upstreamAllow.has(specifier)
        expect(local || pr1TypeOnly || upstream, `${file} -> ${specifier}`).toBe(true)
      }
      // …repo cross-directory edges are TYPE imports only (no runtime
      // value enters from PR1).
      const runtimeImports = [...source.matchAll(/^import\s+(?!type\s)[\s\S]*?from\s+'(\.\.[^']+)'/gm)]
      expect(runtimeImports.map((m) => m[1]), file).toEqual([])
      // PUBLIC upstream edges, pinned to EXACTLY the binding surface:
      // dsh-agent TYPE-ONLY (Pick over Agent); dsh-llm contributes the
      // single createUserMessage value import — nothing else by value.
      for (const line of source.split('\n').filter((l) => /^\s*import\b/.test(l) && l.includes('@deepseek-ai/'))) {
        if (line.includes("'@deepseek-ai/dsh-agent'")) {
          expect(line, `${file}: dsh-agent must enter as a TYPE import only`).toMatch(/^import\s+type\s/)
        }
        if (line.includes("'@deepseek-ai/dsh-llm'") && !/^\s*import\s+type\s/.test(line)) {
          expect(line.trim(), `${file}: only createUserMessage enters from dsh-llm by value`)
            .toBe("import { createUserMessage } from '@deepseek-ai/dsh-llm'")
        }
      }
    }
  })

  it('the lane reaches NO forbidden surface (PR60-safety boundary)', () => {
    const forbidden = [
      // (^|/) keeps the ALLOWED permission-governance/* edge from matching
      // as a name-substring of this governance-lane pattern.
      /(^|\/)governance\/(service|types|permission-mutation|slot)\.js/,
      /effective-policy/,
      /operation-permission/,
      /\.\.\/src\//,
      /host\.ts|host\.js/,
      /permission-plane/,
      /blueprint/,
      /\.\.\/\.\.\/storage/,
      /\/mutation\/|mutation\/types\.js|override-admission/,
      /admission/,
      /resolver|resolve/,
    ]
    for (const { file, source } of moduleSources()) {
      const importLines = source
        .split('\n')
        .filter((line) => /^\s*import\b/.test(line) || /^\s*export\s+(type\s+)?\{[^}]*from/.test(line))
        .join('\n')
      for (const pattern of forbidden) {
        expect(importLines, `${file} matched ${String(pattern)}`).not.toMatch(pattern)
      }
    }
  })
})

describe('leg 3 — ZERO production consumers (PR5 lands dormant / unwired)', () => {
  it('no shipped source outside the lane directory and the tests imports permission-notification', () => {
    const offenders: string[] = []
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const st = statSync(full)
        if (st.isDirectory()) {
          if (entry === 'node_modules' || entry === 'dist' || entry === 'test') continue
          visit(full)
          continue
        }
        if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) continue
        const rel = relative(RUNTIME_ROOT, full)
        // The lane itself may of course import its own modules.
        if (rel.startsWith(`permission-notification${sep}`)) continue
        const text = readFileSync(full, 'utf8')
        if (/permission-notification/.test(text)) offenders.push(rel)
      }
    }
    const packagesRoot = join(RUNTIME_ROOT, '..')
    for (const pkg of ['runtime', 'tools', 'remote', 'client']) {
      const pkgRoot = pkg === 'runtime' ? RUNTIME_ROOT : join(packagesRoot, pkg)
      try {
        statSync(pkgRoot)
      } catch {
        continue
      }
      visit(pkgRoot)
    }
    expect(offenders).toEqual([])
  })

  it('the lane ships OUT of the tsc install-surface build too (PR1 precedent for unwired layers)', () => {
    // tsconfig.build.json does NOT include this directory: nothing in the
    // produced dist ships it, so the artifact surface is untouched and
    // there is zero dist-level collision surface with PR60. (The module is
    // still type-checked: tsconfig.json pulls it in through the specs.)
    const buildConfig = readFileSync(join(RUNTIME_ROOT, 'tsconfig.build.json'), 'utf8')
    expect(buildConfig).not.toContain('permission-notification')
  })
})

describe('leg 4 — mirrored durable bounds and awareness text', () => {
  it('the renderer mirrors the durable reason bound verbatim', () => {
    const notificationSource = readFileSync(join(MODULE_DIR, 'notification.ts'), 'utf8')
    expect(notificationSource).toContain(`const REASON_BOUND = ${String(PERMISSION_OVERLAY_MAX_REASON_LENGTH)}`)
  })

  it('the rendered text states the awareness-only contract verbatim (ADR §9)', () => {
    const notificationSource = readFileSync(join(MODULE_DIR, 'notification.ts'), 'utf8')
    expect(notificationSource).toContain('AWARENESS ONLY')
    expect(notificationSource).toContain('never authorization evidence')
    // And the module docs are honest about the wiring state.
    const readme = readFileSync(join(MODULE_DIR, 'README.md'), 'utf8')
    expect(readme).toContain('UNWIRED')
    expect(readme).toContain('PENDING')
  })
})
