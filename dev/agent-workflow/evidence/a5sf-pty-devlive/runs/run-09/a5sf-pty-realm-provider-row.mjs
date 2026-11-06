/**
 * a5sf-pty-realm-provider-row.mjs — the BOOT COMPOSITION half of the Shell/PTY
 * DEV-LIVE lane (a5sf-pty-devlive).
 *
 * DERIVED FROM `evidence/a5sf-bl17-live2/a5sf-bl17-live-realm-provider-row.mjs`
 * (the BL-17 live-half composition that was never reached: boot #4 died at
 * `team.create`). Two substantive differences, both forced by a measured fact
 * this lane found BEFORE the first start:
 *
 *   1. THE CALLER TOOL IS ALSO ON THE PRESET (see `a5sf-pty-bash-probe-tool.mjs`).
 *      Route C refuses to ADD a model-visible name (`a5sf-realm-row.mjs`
 *      `agent-bindings: the configured a5sfNativeToolModules would CHANGE the
 *      Member's model-visible tool surface (added: [...])`), so a probe tool
 *      declared ONLY in `a5sfNativeToolModules` can never attach. The BL-17
 *      composition would have failed there. This lane declares the probe on the
 *      preset as well; the realm shadow is then surface-neutral.
 *   2. THE MEMBER'S COMPILED REALM ANSWER IS RECORDED (`leg: realm-member`),
 *      including whether it carries a `terminals` face. That is the live half of
 *      Q1: the governed realm the Member's tools ride answers with a confined
 *      `subprocess` face and NOTHING for a terminal.
 *
 * WHAT IT SUPPLIES: the `teamA5sfRealm` service the production row reads
 * (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`). The row mounts a
 * Member realm whose confined `subprocess` face is the shipped one, over the
 * shipped P1-07 Landlock provider, with the shipped launcher pin.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (stated so it cannot be read as more):
 *   - the CEILING / RESTRICTION lane INPUTS and the per-template network choice
 *     are TEST COMPOSITION (no product v3 blueprint -> compiled lane bridge
 *     exists at this base);
 *   - the INTERSECTION is the PRODUCT's algebra (`intersectPathRuleSets` /
 *     `matchLocator` from the emitted member-io-policy);
 *   - the confined process class, the shell-class admission, the write-lane
 *     guard, the network capability probe, the OS profile (P1-07 Landlock) and
 *     the realm installer are the SHIPPED ones, reached through the product row;
 *   - the raw OS provider is P1-07's, created here because the composition that
 *     owns the launcher pin is this row;
 *   - COUNTERS are test instrumentation (the shipped provider has no counter):
 *     the confined provider wrapper records every `spawnStreaming` call, so
 *     "refused before any process" is a counter rather than a claim. They decide
 *     nothing and never break the host call they observe.
 *
 * NOT CLAIMED: that the live preset supplies this face by itself. It does not —
 * no product composition declares a shell class; this row is test composition.
 *
 * @module dev/agent-workflow/evidence/a5sf-pty-devlive/a5sf-pty-realm-provider-row
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'a5sf-pty-realm-provider'
/** `ctx.provide` needs no injection; the counters inject their own services. */
export const inject = []

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')

const pathRules = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'path-rules.js')).href)
const providerModule = await import(pathToFileURL(join(DIST, 'sandbox-provider', 'provider.js')).href)

const LAUNCHER = join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const SUB_COUNTER_MARK = Symbol.for('a5sf.pty.baseSubprocessCounter')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

function recorder(ledgerPath) {
  return (row) => {
    try {
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendFileSync(ledgerPath, `${JSON.stringify({ at: new Date().toISOString(), ...row })}\n`)
    } catch {
      /* instrumentation never breaks the host call it observes */
    }
  }
}

/** Wrap the raw provider so every spawn attempt and every OS exit is visible.
 *  The wrapper is pass-through: the confined face consumes the same handle. */
function countedProvider(inner, ledgerPath, realmTag) {
  const record = recorder(ledgerPath)
  return {
    async spawnStreaming(request, streaming) {
      const argv = Array.isArray(request?.argv) ? request.argv.map((a) => String(a)) : []
      const cwd = String(request?.cwd ?? '')
      record({ leg: 'confined-spawn-attempt', realm: realmTag, argv, cwd })
      const spawned = await inner.spawnStreaming(request, streaming)
      if (spawned === null || spawned === undefined || spawned.ok !== true || spawned.value === null || spawned.value === undefined) {
        record({ leg: 'confined-spawn-refused', realm: realmTag, argv, cwd })
        return spawned
      }
      const handle = spawned.value
      record({ leg: 'confined-spawn', realm: realmTag, argv, cwd, pid: handle.pid ?? null })
      // Observe the raw handle's own exit arm. NOT the stderr stream: attaching a
      // consumer here would race the confined face's collector (the face attaches
      // its reader a microtask later). The face already collects stderr for the
      // caller; this record only needs the pid and the launcher's exit code.
      if (typeof handle.exited?.then === 'function') {
        handle.exited.then((outcome) => {
          record({ leg: 'confined-exit', realm: realmTag, argv, pid: handle.pid ?? null, code: outcome?.code ?? null, signal: outcome?.signal ?? null })
        }).catch(() => undefined)
      }
      return spawned
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function lane(mode, allow) {
  return Object.freeze({ mode, allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function disposition(laneValue, locator) {
  return {
    locator,
    decision: pathRules.matchLocator(laneValue, locator),
  }
}

export function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  const readAllow = Array.isArray(config?.readAllow) ? config.readAllow.filter((e) => typeof e === 'string' && e.trim() !== '') : []
  const writeAllow = Array.isArray(config?.writeAllow) ? config.writeAllow.filter((e) => typeof e === 'string' && e.trim() !== '') : []
  if (allowRoot === '') throw new TypeError('a5sf-pty-realm-provider: config.allowRoot is required')
  if (readAllow.length === 0) throw new TypeError('a5sf-pty-realm-provider: config.readAllow is required')
  if (writeAllow.length === 0) throw new TypeError('a5sf-pty-realm-provider: config.writeAllow is required')
  const shellPrograms = Array.isArray(config?.shellPrograms) ? config.shellPrograms.filter((e) => typeof e === 'string' && e.trim() !== '') : []
  if (shellPrograms.length === 0) throw new TypeError('a5sf-pty-realm-provider: config.shellPrograms is required (the composition shell class)')
  const denyTemplates = Array.isArray(config?.networkDenyTemplates)
    ? config.networkDenyTemplates.filter((e) => typeof e === 'string' && e.trim() !== '')
    : []
  const scratchRoot = typeof config?.scratchRoot === 'string' ? config.scratchRoot.trim() : ''
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  const reportPath = typeof config?.laneReportPath === 'string' ? config.laneReportPath.trim() : ''
  if (scratchRoot === '') throw new TypeError('a5sf-pty-realm-provider: config.scratchRoot is required')
  if (counterPath === '') throw new TypeError('a5sf-pty-realm-provider: config.counterPath is required')
  const bindingIdentity = typeof config?.bindingIdentity === 'string' && config.bindingIdentity.trim() !== ''
    ? config.bindingIdentity.trim()
    : 'dsh.subprocess/spawn'
  const probePaths = Array.isArray(config?.laneProbePaths) ? config.laneProbePaths.filter((e) => typeof e === 'string') : []

  const record = recorder(counterPath)

  // ── the two authored factors (fixtures) and the product intersection ─────
  const ceilingRead = lane('restricted', [allowRoot])
  const ceilingWrite = lane('restricted', [allowRoot])
  const restrictionRead = lane('restricted', readAllow)
  const restrictionWrite = lane('restricted', writeAllow)
  const effectiveRead = pathRules.intersectPathRuleSets(ceilingRead, restrictionRead)
  const effectiveWrite = pathRules.intersectPathRuleSets(ceilingWrite, restrictionWrite)

  const report = {
    schema: 'a5sf-tool-binding-lane-report/1',
    kind: 'shell-pty',
    computedBy: 'packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js # intersectPathRuleSets / matchLocator',
    bindingIdentity,
    ceiling: { read: ceilingRead, write: ceilingWrite },
    restriction: { read: restrictionRead, write: restrictionWrite },
    effective: { read: effectiveRead, write: effectiveWrite },
    network: { denyTemplates: denyTemplates, others: 'allow' },
    shellClass: { programs: shellPrograms },
    probePaths: probePaths.map((locator) => ({
      locator,
      ceilingRead: disposition(ceilingRead, locator).decision,
      restrictionRead: disposition(restrictionRead, locator).decision,
      effectiveRead: disposition(effectiveRead, locator).decision,
      effectiveWrite: disposition(effectiveWrite, locator).decision,
    })),
    note: 'the CEILING/RESTRICTION inputs and the per-template network choice are test-composition fixtures; the intersection and every disposition are the product functions, called here. The confined subprocess face is a MEMBER-realm face.',
  }
  if (reportPath !== '') {
    mkdirSync(dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  }

  /** One raw OS provider per Member (the launcher pin belongs to this row). */
  const providers = new Map()
  const providerFor = (instanceId) => {
    const cached = providers.get(instanceId)
    if (cached !== undefined) return cached
    const raw = providerModule.createConfinedProcessProvider({
      realmId: `member:${instanceId}`,
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(scratchRoot, instanceId),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    const counted = countedProvider(raw, counterPath, `member:${instanceId}`)
    providers.set(instanceId, counted)
    return counted
  }

  const provider = {
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'worker')
      const revision = `a5sf-pty:${instanceId}:g1`
      const networkAccess = denyTemplates.includes(templateId) ? 'deny' : 'allow'
      const identity = Object.freeze({ teamId: 'team-a5sf-pty', memberInstanceId: instanceId, templateId, instanceGeneration: 1 })
      const policy = Object.freeze({
        memberIdentity: instanceId,
        templateId,
        instanceGeneration: 1,
        revision,
        read: ceilingRead,
        write: ceilingWrite,
        network: Object.freeze({ access: networkAccess }),
      })
      const effective = Object.freeze({
        memberIdentity: instanceId,
        toolBindingIdentity: bindingIdentity,
        invocationId: `a5sf-pty:${instanceId}:${bindingIdentity}`,
        policyRevision: revision,
        read: effectiveRead,
        write: effectiveWrite,
        network: Object.freeze({ access: networkAccess }),
      })
      // Q1's live half: the FACE SET this governed realm answers with. Recorded
      // before the answer is returned, so the fact survives any later refusal.
      record({
        leg: 'realm-member',
        memberInstanceId: instanceId,
        templateId,
        sessionId: String(member?.sessionId ?? ''),
        teamRootSessionId: String(member?.teamRootSessionId ?? ''),
        bindPath: member?.bindPath === undefined ? null : String(member.bindPath),
        networkAccess,
        realmFaces: ['subprocess'],
        hasTerminalsFace: false,
        note: 'the governed realm answer for this Member; no terminal face exists in RealmServiceFaces (PD-3), so this list is the whole confined surface',
      })
      return {
        members: [{ identity, policy: { ok: true, value: policy } }],
        subprocess: {
          effective,
          provider: providerFor(instanceId),
          realmId: `member:${instanceId}`,
          bindingId: bindingIdentity,
          memberScope: instanceId,
          shellClass: Object.freeze({ programs: Object.freeze([...shellPrograms]) }),
        },
      }
    },
  }
  ctx.provide('teamA5sfRealm', provider)

  ctx.inject(['subprocess'], (subCtx) => {
    const base = subCtx.subprocess
    if (base === undefined || base === null) return
    const ctor = Object.getPrototypeOf(base)?.constructor
    if (typeof ctor !== 'function') return
    const proto = ctor.prototype
    if (proto[SUB_COUNTER_MARK] === true) return
    const original = proto.spawn
    if (typeof original !== 'function') return
    Object.defineProperty(proto, 'spawn', {
      configurable: true,
      writable: true,
      value: function instrumentedBaseSpawn(spec) {
        const argv = Array.isArray(spec?.argv) ? spec.argv.map((a) => String(a)) : []
        const cwd = String(spec?.cwd ?? '')
        record({ leg: 'base-spawn', argv, cwd, instance: this === base })
        return original.call(this, spec)
      },
    })
    Object.defineProperty(proto, SUB_COUNTER_MARK, { configurable: true, writable: true, value: true })
    record({ leg: 'base-subprocess-counter-installed', baseCtor: ctor.name, note: 'test composition instrumentation; records only the inherited service arm' })
  })
}
