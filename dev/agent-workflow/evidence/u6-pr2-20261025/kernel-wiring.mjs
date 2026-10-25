import { readFileSync, writeFileSync } from 'node:fs'
const F = 'packages/runtime/src/plugin/live/team-tool-plane.mjs'
let src = readFileSync(F, 'utf8')
const must = (needle) => { if (!src.includes(needle)) throw new Error('anchor missing: ' + needle.slice(0, 80)) }

// (1) dispose: kernel lifecycle transitions ride the mount disposal.
must('            readExecutor?.paHandoffCloseAll?.()\n')
src = src.replace(
  '            readExecutor?.paHandoffCloseAll?.()\n',
  `            readExecutor?.paHandoffCloseAll?.()
            // U6 PR2: the kernel's lifecycle rides its mount — drain,
            // tombstone, revoke the candidate, release (observations of the
            // §5 state machine; every transition is best-effort and each
            // refusal leaves the state machine honest, never throws).
            if (readKernel !== null) {
              try {
                readKernel.kernel.beginDrain()
                readKernel.kernel.tombstone()
                readKernel.registry.revoke('dsh.fs-family', 'the governed read mount was disposed')
                readKernel.kernel.release()
              } catch {
                /* idempotent drain best-effort — the plane tears down anyway */
              }
            }
`)

// (2) handle: the ENFORCING guard port (omitted when there is no read row).
must('      placementNames: Object.freeze(allDefs.map((d) => d.name)),\n')
src = src.replace(
  '      placementNames: Object.freeze(allDefs.map((d) => d.name)),\n',
  `      placementNames: Object.freeze(allDefs.map((d) => d.name)),
      /**
       * U6 PR2 ENFORCEMENT WIRING (install.ts seam, no new Host hook): the
       * kernel guard port for kernel-owned names. The Guard's IDENTITY law
       * is NOT restated here — install.ts already (a) binds the placement
       * identity from the §6 feed (which for the owned name now answers from
       * the kernel's approval TABLE), (b) re-verifies live resolution against
       * the binding before dispatch, and (c) aborts in-flight calls on a
       * tools/change drift. This port adds exactly the two table-backed
       * verdicts the seam asks for: \`owns(name)\` selects the enforcing
       * posture (post-success drift becomes a fail-closed veto instead of the
       * armed-once alarm), \`identityFor(name)\` answers the ONE identity the
       * table binds (null = unbound name → nothing may execute under it).
       * A plane without the governed read row OMITS the field entirely —
       * presence is the capability signal, same law as paReadHandoff.
       */
      ...(readKernel === null ? {} : { kernelGuard: readKernel.guard }),
      /** U6 PR2 diagnostics/tests: the plane's center assembly (kernel +
       *  registry faces; observation only — no authority crosses here). */
      ...(readKernel === null ? {} : { centerKernel: Object.freeze({ kernel: readKernel.kernel, registry: readKernel.registry }) }),
`)

// (3) the center assembly + table-backed placementFeed.
const oldFeed = `  const placedByName = new Map(allDefs.map((d) => [d.name, d]))
  const placementFeed = (name) => {
    const d = placedByName.get(name)
    if (d === undefined) return undefined
    const identity = definitionIdentityOf(d)
    return identity === null ? undefined : Object.freeze({ definitionIdentity: identity, realmId })
  }
`
must(oldFeed)
src = src.replace(oldFeed, `  const placedByName = new Map(allDefs.map((d) => [d.name, d]))

  // ── U6 PR2: the CENTER ASSEMBLY for the read family (ENFORCING) ─────────
  // The kernel (governance-center lane) owns this placement's approval entry:
  // ONE table, center-side, binding native name → placement definition
  // identity (sup-a §5 cond 1/2). The FAMILY registers through the PR1
  // closed schema (origin 'reviewed-manifest' — this plane is a reviewed
  // assembly point, not a dynamic source; cond 9); a registration refusal
  // means the read row is NOT verifiable and the whole assembly FAILS CLOSED
  // (no row mounts — the old center path is gone, dual-keep is forbidden).
  // The kernel's ports are bound HERE at the trusted seam (PR1's open item):
  // grantConsume wraps the existing tool-admission face — composed, never
  // re-implemented; the family lane never sees any of it (familyFace carries
  // no authority, CI-06).
  const readNameOwned = readRowDef !== null
  if (readNameOwned) {
    const registry = createGovernedFamilyRegistry({
      kernelManifest: { capabilities: { 'fs-read': { backsExecution: 'family-body' } } },
    })
    const contribution = buildFsReadContribution({
      definition: readRowDef,
      executorFactory: createGovernedReadExecutor,
      mechanics: fsFamilyReadMechanics,
      presentation: fsFamilyReadPresentation,
      cancelBoundary: 'the governed read body checks the injected signal at every await edge; the dispatcher-side arm + tools/change watcher lands ABORTED_BEFORE_DISPATCH before the body runs (install.ts seams, U6 PR2)',
    })
    const registered = registry.register(contribution, { origin: 'reviewed-manifest' })
    if (registered.ok !== true) {
      return {
        ok: false,
        code: 'PLANE_READ_REGISTRATION_REFUSED',
        message: \`the read family contribution was refused by the closed schema (\${registered.code}: \${registered.detail}) — an unverified family row mounts nowhere (fail closed; the retired center read path does not come back)\`,
      }
    }
    const kernel = createGovernanceKernel({
      registry,
      ports: {
        grantConsume: {
          // THE PR2 PORT BINDING (PR1-open-1): kernel → tool-admission
          // one-shot face. Synchronous under the wrapper (no await between
          // reading facts and consuming — the one-shot + cancel-first laws
          // depend on run-to-completion); the FULL legacy answer is captured
          // beside the call so the live deny codes/messages survive the
          // kernel's narrower verdict shape (the kernel only reads ok/reason).
          consumeForExecution: async (grant, facts) => {
            const answer = assembly.consumeForExecution(grant, facts)
            kernelPortAnswer.current = answer
            return answer.ok === true
              ? { ok: true }
              : {
                  ok: false,
                  reason: \`\${String(answer.error?.code ?? 'GRANT_CONSUMPTION_REFUSED')}:\${String(answer.error?.details?.refusal ?? '')}\`,
                }
          },
        },
      },
    })
    const published = kernel.publish()
    if (published.ok !== true) {
      return {
        ok: false,
        code: 'PLANE_READ_KERNEL_UNAVAILABLE',
        message: \`the read kernel could not enter ACTIVE (\${published.code}: \${published.detail}) — no approval entry can back the governed read\`,
      }
    }
    readKernel = {
      registry,
      kernel,
      guard: Object.freeze({
        owns: (name) => typeof name === 'string' && name === readName,
        identityFor: (name) => {
          if (typeof name !== 'string' || name !== readName) return null
          const entry = ensureReadApprovalEntry()
          return entry === null ? null : entry.definitionIdentity
        },
      }),
    }
  }

  const ensureReadApprovalEntry = () => {
    if (readKernel === null) return null
    const existing = readKernel.kernel.approvalFor(readName)
    if (existing !== undefined) return existing
    const d = placedByName.get(readName)
    if (d === undefined) return null
    const identity = definitionIdentityOf(d)
    // Not minted yet (never installed through the seam's fingerprint pass):
    // NO entry — the feed stays silent and the Guard's no-feed refusal lands.
    if (identity === null) return null
    const added = readKernel.kernel.addApprovalEntry({ nativeName: readName, definitionIdentity: identity })
    if (added.ok !== true) return null // dup/non-ACTIVE — fail closed, never rebind
    return readKernel.kernel.approvalFor(readName) ?? null
  }

  const placementFeed = (name) => {
    const d = placedByName.get(name)
    if (d === undefined) return undefined
    if (readKernel !== null && name === readName) {
      // U6 PR2 (cond 1/2/6): for the kernel-OWNED name the approval TABLE is
      // the identity source. The entry binds ONCE, lazily, at first consult
      // — the def#N mint still rides the seam's install pass (the pb §6
      // lookup-time law is untouched). It is NEVER silently re-bound: when a
      // later live resolution disagrees with the table, this feed keeps
      // answering the TABLE identity and the Guard's own live-vs-feed
      // comparison refuses (cond 6: an identity mismatch never executes).
      const entry = ensureReadApprovalEntry()
      return entry === null
        ? undefined
        : Object.freeze({ definitionIdentity: entry.definitionIdentity, realmId })
    }
    const identity = definitionIdentityOf(d)
    return identity === null ? undefined : Object.freeze({ definitionIdentity: identity, realmId })
  }
`)

// (4) consume edge: kernel-routed for the owned name.
const oldEdge = `    const edge = assembly.consumeForExecution(grant, {
      ...(signal === undefined ? {} : { cancelRequested: signal.aborted === true }),
      currentAuthorityGeneration: freshGeneration,
      member: paMember,
      callId,
      realmId: callRealm,
      bindingId: grant.bindingId,
      bindingRevision: freshRevision,
      parametersFingerprint,
      requestedEffects,
    })
`
must(oldEdge)
src = src.replace(oldEdge, `    const consumeFacts = {
      ...(signal === undefined ? {} : { cancelRequested: signal.aborted === true }),
      currentAuthorityGeneration: freshGeneration,
      member: paMember,
      callId,
      realmId: callRealm,
      bindingId: grant.bindingId,
      bindingRevision: freshRevision,
      parametersFingerprint,
      requestedEffects,
    }
    // U6 PR2 (port binding, PR1-open-1): a KERNEL-OWNED placement consumes
    // its one-shot grant through the kernel's consumeOnce — replay-guarded
    // BEFORE the port (double replay: kernel set + durable ledger, both
    // refusals, neither ever un-spends), and a kernel outside ACTIVE refuses
    // the edge outright (drain/tombstone semantics). The port wrapper
    // captured the FULL legacy answer, so every live deny code
    // (APPROVAL_STALE / TOOL_BINDING_UNVERIFIED / …) rides the unchanged
    // mapping below. A name the kernel does not own keeps the direct edge
    // byte-for-byte.
    let edge
    if (readKernel !== null && placementName === readName) {
      const grantId = typeof grant?.grantId === 'string' ? grant.grantId : ''
      kernelPortAnswer.current = null
      const verdict = await readKernel.kernel.consumeOnce(grant, grantId, consumeFacts)
      edge = verdict.portCalled && kernelPortAnswer.current !== null
        ? kernelPortAnswer.current
        : {
            ok: false,
            error: {
              code: String(verdict.code ?? 'GRANT_CONSUMPTION_REFUSED'),
              message: String(verdict.detail ?? 'the kernel refused the one-shot consumption'),
            },
          }
    } else {
      edge = assembly.consumeForExecution(grant, consumeFacts)
    }
`)

// (5) forward declarations before paAdmitEdge (the edge body reads them).
const edgeHead = '  const paAdmitEdge = async ({ grant, paDurableMint, request, placementName, paConstructionBinding, realmId: callRealm, callId, parametersFingerprint, requestedEffects, signal }) => {\n'
must(edgeHead)
src = src.replace(edgeHead, `  // U6 PR2: the plane's center assembly for the read family (filled AFTER
  // construction, before any call — the edge/guard closures below read the
  // binding at CALL time). \`kernelPortAnswer\` is the one-slot capture beside
  // the consume port (see the port wrapper).
  let readKernel = null
  const kernelPortAnswer = { current: null }

` + edgeHead)

writeFileSync(F, src)
console.log('KERNEL-WIRING-OK')
