/**
 * a5sf-native-provider-row.mjs — the BOOT COMPOSITION half that supplies the
 * a5sf compiled realm to the product row (`packages/runtime/src/plugin/host.ts`
 * reads the OPTIONAL `teamA5sfRealm` service; `agent-bindings.mjs` mounts a
 * Member's realm iff BOTH `config.a5sfEvidencePath` AND that service exist).
 *
 * WHY THIS FILE EXISTS AT ALL: at this base NO product code provides
 * `teamA5sfRealm` (grep: only the consumer in `host.ts` and the type doc in
 * `plugin/types.ts`). The a5sf wiring README (`evidence/a5sf-p2-wiring/README.md`
 * §7.6) says so explicitly: "A row must provide `teamA5sfRealm`
 * (`compiledFor`) + `config.a5sfEvidencePath` for the wiring to activate.
 * Whichever lane supplies the compiled ceilings is still the missing production
 * half." This row is that supplier for ONE boot — test composition, not product
 * code. It is mounted as a plain profile-patch row (the same public seam the
 * production Team row uses) and calls `ctx.provide('teamA5sfRealm', …)`, the
 * same API `host.ts` uses for `teamRoot`.
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
 * @module dev/agent-workflow/evidence/a5sf-live-native/a5sf-native-provider-row
 */

export const name = 'a5sf-native-provider-row'
/** Only `ctx.provide` is used; no service injection is required. */
export const inject = []

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
        teamId: 'team-a5sf-live-native',
        memberInstanceId: instanceId,
        templateId,
        instanceGeneration,
      })
      const policy = Object.freeze({
        memberIdentity: instanceId,
        templateId,
        instanceGeneration,
        revision: `a5sf-live:${instanceId}:g${String(instanceGeneration)}`,
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
}
