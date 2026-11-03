/**
 * a5sf-native-provider-row.mjs — the BOOT COMPOSITION half that supplies the
 * a5sf compiled realm to the product row (`packages/runtime/src/plugin/host.ts`
 * reads the OPTIONAL `teamA5sfRealm` service; `agent-bindings.mjs` mounts a
 * Member's realm iff BOTH `config.a5sfEvidencePath` AND that service exist).
 *
 * COPIED FROM `evidence/a5sf-live-native/a5sf-native-provider-row.mjs` (the
 * first boot) with the module doc re-pointed at this evidence directory. The
 * ceiling shape is unchanged on purpose: this run is about the QUESTION
 * (does a model-visible native `read` execute through the confined provider
 * now that the scope key is supplied by the product?), not about plumbing.
 *
 * WHY THIS FILE EXISTS AT ALL: at this base NO product code provides
 * `teamA5sfRealm` (grep: only the consumer in `host.ts` and the type doc in
 * `plugin/types.ts`). The a5sf wiring README (`evidence/a5sf-p2-wiring/README.md`
 * §7.6) says so explicitly. This row is that supplier for ONE boot — test
 * composition, not product code. It is mounted as a plain profile-patch row
 * (the same public seam the production Team row uses) and calls
 * `ctx.provide('teamA5sfRealm', …)`, the same API `host.ts` uses for
 * `teamRoot`.
 *
 * WHAT IT IS NOT: it is not a policy compiler and not a second authority. The
 * `MemberPolicy` it answers with is a COMPILED-SHAPED fixture (`{ ok: true,
 * value }`), i.e. exactly the shape `installMemberIoProviders` consumes. The
 * production compiler (`packages/runtime/member-io-policy/src/compile.ts`, P1-02)
 * consumes a v4 blueprint + an Alpha.4 effective authority; this boot's Team
 * blueprint is v3 and no product code bridges v3 → compiled ceilings, so the
 * ceiling here is composed by the RUNNER and disclosed as such in the evidence
 * README. The guard semantics under test are the SHIPPED ones
 * (`createMemberFsGuard` + `TeamConfinedFileSystem`, P1-05): the fixture only
 * chooses WHICH abs-path subtree is the ceiling.
 *
 * CEILING SHAPE: `read`/`write` = restricted lane with ONE allow locator (the
 * canonical workspace root). `matchLocator` treats a locator as covering its
 * descendants, so a file inside the root is allowed and a file outside it is
 * denied (`decision: deny` → the guard's `IO_READ_DENIED`).
 *
 * WHY THE READ COUNTER LIVES IN *THIS* FILE (and not a second row): the boot
 * spent on 2026-11-03T13:02:54Z failed at Loader compose — the client-modules
 * registry refused TWO file-URL profile rows that both resolve to the repo-root
 * package `dsh-agent-team`:
 *   `package dsh-agent-team resolves from multiple active Loader sources: …a5sf-base-read-counter-row.mjs …, …a5sf-native-provider-row.mjs …; remove one entry`
 * (evidence `logs/u5a5sflive2-20261103T13-02-54Z/instance-port3183.log`; the
 * first boot got away with ONE such row). So there is exactly ONE evidence
 * row per package: the counter is installed here, behind `config.counterPath`,
 * as test-composition instrumentation. The shipped host `fs` provider has NO
 * read counter of its own, and this module does not claim to be one.
 *
 * THE COUNTER: at `ctx.inject(['fs'], …)` time it samples the LIVE root `fs`
 * instance and wraps `readText` / `streamText` / `readBytes` / `readByteRange`
 * ON ITS CLASS PROTOTYPE, passing every call through unchanged and appending
 * `{ leg: 'read-call', method, path, instance, isBase }` per call. `isBase`
 * means the call was served by the ROOT/base provider INSTANCE; the a5sf
 * confined provider is a DIFFERENT instance (the realm installs
 * `createConfinedFileSystemClass(Base, guard)` into `root.isolate('fs', …)`),
 * so a call it serves is recorded with `isBase: false`. A call the Guard
 * REFUSES never reaches a provider method at all (the guard's `stat` throws
 * first). The prototype wrap is required because the confined class reaches
 * the base through `super.readText(...)` on its OWN instance.
 *
 * @module dev/agent-workflow/evidence/a5sf-live-native2/a5sf-native-provider-row
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const name = 'a5sf-native-provider-row'
/** `ctx.provide` needs no injection; the counter adds itself through
 *  `ctx.inject(['fs'], …)` so this row's apply order is exactly the first
 *  boot's (it must still be mounted before the Team row). */
export const inject = []

const READ_METHODS = Object.freeze(['readText', 'streamText', 'readBytes', 'readByteRange'])
const COUNTER_MARK = Symbol.for('a5sf.live-native2.base-read-counter')

/** Test-composition read counter (see the module doc). Never decides anything. */
function installBaseReadCounter(fsCtx, ledgerPath) {
  const baseFs = fsCtx.get('fs')
  if (baseFs === undefined || baseFs === null) return
  const ctor = Object.getPrototypeOf(baseFs)?.constructor
  if (typeof ctor !== 'function') return
  const proto = ctor.prototype
  const record = (row) => {
    try {
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendFileSync(ledgerPath, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
    } catch {
      /* instrumentation is best-effort: never break a host read */
    }
  }
  if (proto[COUNTER_MARK] === true) {
    record({ leg: 'counter-present', baseCtor: ctor.name })
    return
  }
  const instanceIds = new WeakMap()
  let nextInstance = 0
  const instanceOf = (instance) => {
    if (!instanceIds.has(instance)) {
      instanceIds.set(instance, `fs-${String(nextInstance)}`)
      nextInstance += 1
    }
    return instanceIds.get(instance)
  }
  const baseInstance = instanceOf(baseFs)
  const patchedMethods = []
  for (const method of READ_METHODS) {
    const original = proto[method]
    if (typeof original !== 'function') continue
    Object.defineProperty(proto, method, {
      configurable: true,
      writable: true,
      value: function instrumentedRead(...args) {
        const target = args[0]
        const path = typeof target === 'object' && target !== null
          ? String(target.targetKey ?? target.displayPath ?? '')
          : String(target ?? '')
        record({ leg: 'read-call', method, path, instance: instanceOf(this), isBase: this === baseFs })
        return original.apply(this, args)
      },
    })
    patchedMethods.push(method)
  }
  Object.defineProperty(proto, COUNTER_MARK, { configurable: true, writable: true, value: true })
  record({
    leg: 'counter-installed',
    baseCtor: ctor.name,
    baseInstance,
    methods: patchedMethods,
    note: 'test composition instrumentation; the shipped host fs provider has no read counter of its own',
  })
}

function restrictedLane(allowRoot) {
  return Object.freeze({
    mode: 'restricted',
    allow: Object.freeze([allowRoot]),
    ask: Object.freeze([]),
    deny: Object.freeze([]),
  })
}

export function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  if (allowRoot === '') {
    throw new TypeError('a5sf-native-provider-row: config.allowRoot (the compiled ceiling root) is required')
  }
  const ceiling = restrictedLane(allowRoot)
  const provider = {
    /**
     * The lazy `{ compiledFor }` accessor `host.ts` forwards. It receives the
     * admitted Member descriptor `{ sessionId, instanceId, teamRootSessionId,
     * templateId, bindPath }` and must answer `{ members: [...], bindings?: [] }`
     * or `undefined`.
     */
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'worker')
      const instanceGeneration = 1
      const identity = Object.freeze({
        teamId: 'team-a5sf-live-native2',
        memberInstanceId: instanceId,
        templateId,
        instanceGeneration,
      })
      const policy = Object.freeze({
        memberIdentity: instanceId,
        templateId,
        instanceGeneration,
        revision: `a5sf-live2:${instanceId}:g${String(instanceGeneration)}`,
        read: ceiling,
        write: ceiling,
        network: Object.freeze({ access: 'allow' }),
      })
      // ONE Member ceiling, no binding realms: the ceiling is the Member-wide
      // lane and the only thing this boot measures. `providerClass` is omitted
      // on purpose — the shipped sample Provider (the host's own `fs`) must be
      // the base, never a test double.
      return { members: [{ identity, policy: { ok: true, value: policy } }] }
    },
  }
  ctx.provide('teamA5sfRealm', provider)
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  if (counterPath !== '') {
    ctx.inject(['fs'], (fsCtx) => installBaseReadCounter(fsCtx, counterPath))
  }
}
