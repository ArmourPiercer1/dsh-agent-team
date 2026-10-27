/**
 * inspect-family/src/skill-executor.mjs — the governed `team_skill` body.
 *
 * THE LAW (composed in the write-executor's order, the family's admitted
 * pattern): PURE front first — closed parameters ({name}), the host-pin name
 * grammar, and a pure-lexical candidate `<root>/<name>/SKILL.md` per
 * sanctioned root (zero realpath/exists/stat/fs before the PA edge). Then
 * the lane re-check (decide), the template-default-deny re-check, the PA
 * admission edge with the EXACT declared effect set, and only AFTER
 * consumption the anchored read runs: the fs family's anchor law
 * (`resolveAnchoredPath`, referenced not copied) decides the winner per root
 * rank, a symlink that is not the plain file is a typed `symlink-alias`
 * refusal, the file read is bounded, and the frontmatter law decides the
 * published body. Every refusal is typed, stable-text, and carries ZERO
 * effect: no read happened on any refusal that precedes consumption, and no
 * WRITE effect is ever declared or performed — this row's whole vocabulary
 * is {tool-invoke, read}.
 *
 * THE OPEN IS FD-PINNED (U7-F review round 1, finding H-1): the check-time
 * path string never carries the open. After the anchor resolution the row
 * takes an identity snapshot, opens ONCE with `O_RDONLY | O_NOFOLLOW`, and
 * runs the fs family's OWN opened-handle law — `verifyOpenedHandle` (fd
 * containment via `/proc/self/fd` + fstat-vs-snapshot drift; escape/drift/
 * undeterminable refused BEFORE any byte, zero disclosed) — reading the
 * bytes and the size bound from the SAME verified fd (a cap+1 metered ring:
 * overshoot is MEASURED and the file refused whole). This closes the
 * check-then-use window a path-based `readFile` leaves (a SKILL.md swapped
 * for a symlink after a separate `lstat` would otherwise be followed). The
 * law is REUSED (`verifyOpenedHandle` via the fs family's public face), not
 * re-invented — the same primitive the read/write/edit/image rows run.
 *
 * NO PA EDGE, NO READ: a mount without the PA admission edge refuses
 * (`PA_EDGE_UNAVAILABLE`); the row never bypasses, never falls back to a
 * native face, and holds no authority (admission / grant mint / grant
 * consume stay the Kernel's — the contribution states it as data).
 *
 * @module inspect-family/skill-executor
 */
import { statSync, constants as fsConstants } from 'node:fs'
import { open as fsOpen } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
// The anchor law AND the opened-handle identity law are borrowed through the
// fs family's PUBLIC face (its barrel exports lexicalAnchor/resolveAnchoredPath
// and re-exports verifyOpenedHandle), never the sibling's internals: EB3
// family-boundary law (scripts/eb3-family-boundaries.mjs) — reaching past a
// sibling's index.mjs is cross-family influence (sibling-internals).
import { lexicalAnchor, resolveAnchoredPath, verifyOpenedHandle } from '../../fs-family/src/index.mjs'
import { SKILL_ROW_NAME } from './row-names.mjs'
import {
  SKILL_FILE_NAME,
  SKILL_MAX_BYTES,
  isSkillNameGrammar,
  parseSkillMarkdown,
} from './skill-mechanics.mjs'

// The cap+1 metered ring's chunk size — the same bound the image row's
// bounded read port runs, so a skill file is never buffered past cap+1.
const READ_CHUNK_BYTES = 64 * 1024

export function createGovernedSkillExecutor({ realmId, skillRoots, policy, decide, pa, observe = () => {} }) {
  const roots = skillRoots
  let paSeq = 0
  const mountNonce = String(globalThis.crypto?.randomUUID?.() ?? `n-${Date.now()}-${Math.floor(Math.random() * 2 ** 31)}`)
  // ONE correlation per host execution token for the token's whole life (the
  // write entry's ledger law, ported): a SETTLED token re-used answers under
  // an already-aborted signal; an IN-FLIGHT replay is refused outright; a
  // stringy token is not an identity.
  const tokenLedger = new Map()
  const settledTokenSignals = new WeakMap()
  const signalForSettled = (token) => {
    const cached = settledTokenSignals.get(token)
    if (cached !== undefined) return cached
    const settled = { aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => {}, removeEventListener: (_t, _l) => {} }
    settledTokenSignals.set(token, settled)
    return settled
  }
  const refused = (refusalClass, code, detail) => ({
    kind: 'refused', refusalClass, code, text: `refused-${refusalClass} ${String(code)} — ${detail}`,
  })

  return async (raw, corr = {}) => {
    const token = corr.token
    const tokenKey = (typeof token === 'object' && token !== null) || typeof token === 'symbol' ? token : undefined
    if (tokenKey !== undefined) {
      const prior = tokenLedger.get(tokenKey)
      if (prior !== undefined && !prior.settled) {
        return refused('admission', 'exec-token-replay', 'this host execution already owns an in-flight governed skill load')
      }
    }
    let ledgerCorrelation
    let replaySettled = false
    // ── PURE front: closed parameters + grammar + lexical candidates. ────
    const name = raw?.name
    if (typeof name !== 'string' || name.trim().length === 0) {
      return refused('schema', 'skill-name-required', 'the governed skill load takes exactly one non-empty {name}')
    }
    if (Object.keys(raw ?? {}).some((key) => key !== 'name')) {
      return refused('schema', 'unexpected-parameter', 'the governed skill load accepts exactly {name}; no other parameter is part of this row\'s contract')
    }
    if (!isSkillNameGrammar(name)) {
      return refused('schema', 'invalid-skill-name', `invalid skill name "${name.slice(0, 160)}" — kebab-case only (no separators, no parent segments)`)
    }
    const relative = `${name}/${SKILL_FILE_NAME}`
    const candidates = []
    for (const root of roots) {
      const lex = lexicalAnchor(root, relative)
      if (lex.ok !== true) {
        return refused('schema', lex.code, String(lex.detail ?? `the skill target could not be anchored under the sanctioned root ${root}`))
      }
      candidates.push(Object.freeze({ root, locator: lex.path }))
    }
    const effects = [
      // S3 spelling law (measured live, C2 boot-3): the tool-invoke arm
      // carries the PLACEMENT name — paPlacementNameOf resolves a call only
      // through seamPlacementNames / the names map; the native-class
      // spelling answers undefined and the call dies TOOL_BINDING_UNVERIFIED
      // (entry-cause=no-placement-name), exactly the fs-family boot
      // u7fsmut3 law the plane comment at team-tool-plane.mjs:963 records.
      { kind: 'tool-invoke', toolName: SKILL_ROW_NAME, resource: null },
      // The READ effect over each candidate instruction file (the frozen
      // vocabulary: an anchored absolute sanctioned root). The row reads at
      // most ONE of these and writes none.
      ...candidates.map((candidate) => ({
        kind: 'read',
        resource: { realmId, kind: 'absolute-path', canonicalLocator: candidate.locator, rights: ['read'] },
      })),
    ]
    const verdict = decide({ effects })
    if (verdict.kind === 'deny') {
      observe(`governed-skill lane-denied code=${String(verdict.code)} name=${name}`)
      return refused('admission', verdict.code, 'the template lane denies this skill-read effect')
    }
    if (policy?.default === 'deny') {
      // A deny-default template denies what its rules cannot name: no rule
      // vocabulary exists for this row's class, so nothing can cover it.
      observe(`governed-skill default-deny name=${name}`)
      return refused('admission', 'template-default-deny', 'the policy defaults to DENY and no rule covers this skill-read effect')
    }
    if (typeof pa !== 'function') {
      return refused('admission', 'PA_EDGE_UNAVAILABLE', 'this mount carries no PA admission edge, so no skill may be loaded')
    }
    const set = parseRequestedEffectSet(effects)
    if (!set.ok) return refused('schema', 'effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
    paSeq += 1
    // The host-allocated call correlation (`exec.tokenKey`, forwarded by the
    // row): the PA call-level facts entry resolves the live dispatcher
    // binding behind THAT identity — a synthetic call is an identity gap and
    // stale-refs the call fail-closed (measured live, C2 boot-2:
    // identity-gap=no-answer-object). The fs read row carries the same law.
    const execCorrelation = typeof corr.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
    if (tokenKey !== undefined) {
      const prior = tokenLedger.get(tokenKey)
      if (prior !== undefined && prior.settled) {
        ledgerCorrelation = prior.correlation
        replaySettled = true
      } else {
        ledgerCorrelation = prior?.correlation ?? execCorrelation ?? `plane-skill:${mountNonce}-${String(paSeq)}`
        tokenLedger.set(tokenKey, { correlation: ledgerCorrelation, settled: false })
      }
    }
    const execSignal = corr.signal
    const skillSignal = replaySettled && tokenKey !== undefined ? signalForSettled(tokenKey) : execSignal
    const settleToken = () => {
      if (tokenKey !== undefined) {
        const entry = tokenLedger.get(tokenKey)
        if (entry !== undefined) entry.settled = true
      }
    }
    let gate
    try {
      gate = await pa({
        realmId,
        callId: ledgerCorrelation ?? execCorrelation ?? `plane-skill-${mountNonce}-${String(paSeq)}`,
        ...(skillSignal === undefined ? {} : { signal: skillSignal }),
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      })
    } catch (error) {
      // A failing admission edge is a CLOSED door, never an open one.
      settleToken()
      return refused('admission', 'pa-edge-failed', `the PA admission edge failed (${String(error?.message ?? error).slice(0, 160)}); no skill file was read`)
    }
    if (gate.kind === 'deny') {
      settleToken()
      observe(`governed-skill pa-refused code=${String(gate.code)}`)
      return refused('admission', String(gate.code), String(gate.detail ?? 'the PA execution edge refused this skill load'))
    }
    if (gate.kind === 'allow' && gate.cancelled === true) {
      settleToken()
      observe('governed-skill cancelled-at-pa-edge')
      return { kind: 'cancelled' }
    }
    // ── POST-CONSUME: the anchored, fd-pinned read over the candidates. ──
    try {
      for (const candidate of candidates) {
        // The anchor law BY REFERENCE (fs-mechanics): lexical containment,
        // existence, and the realpath re-check that refuses a symlink alias
        // — the same double proof the fs read row runs post-consume. The
        // declared lexical locator was the APPROVED effect; this is the
        // proof, and any deviation is a refusal, never a follow.
        const resolved = resolveAnchoredPath(candidate.root, relative)
        if (resolved.ok === true) {
          // Identity snapshot FIRST, then the open rides the FD, never the
          // path string (the family's image/read law, referenced not
          // copied): a swap between this stat and the open dies at the OS
          // (ELOOP under O_NOFOLLOW) or under the fd-identity re-read —
          // BEFORE any byte is taken from the swapped object.
          let stat
          try {
            stat = statSync(resolved.path)
          } catch {
            return refused('io', 'skill-target-unreadable', 'the anchored target could not be stat-ed at open time')
          }
          if (!stat.isFile()) return refused('io', 'skill-not-a-file', `a non-file stands at ${candidate.locator}`)
          let handle
          try {
            handle = await fsOpen(resolved.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
          } catch (error) {
            const code = String(error?.code ?? '')
            if (code === 'ELOOP') return refused('io', 'symlink-alias', `the OS refused the open (ELOOP): the sanctioned path wore a symlink alias at open time; zero bytes read`)
            if (code === 'ENOENT') return refused('io', 'skill-target-unreadable', 'the object does not exist at open time')
            if (code === 'EISDIR') return refused('io', 'skill-not-a-file', `a non-file stands at ${candidate.locator}`)
            return refused('io', 'open-failed', code.slice(0, 80))
          }
          try {
            const snapshot = { dev: Number(stat.dev), ino: Number(stat.ino), size: stat.size, mtimeMs: stat.mtimeMs }
            const recheck = await verifyOpenedHandle(handle, resolved.rootReal, snapshot)
            if (recheck.verdict !== 'confirmed') {
              const detail = recheck.verdict === 'escape'
                ? `exec-time re-read: the fd resolved to ${recheck.resolvedPath} — OUTSIDE the sanctioned anchor`
                : recheck.verdict === 'drift'
                  ? `snapshot ${String(recheck.snapshot.dev)}:${String(recheck.snapshot.ino)} != opened ${String(recheck.actual.dev)}:${String(recheck.actual.ino)}`
                  : recheck.detail
              observe(`governed-skill exec-refused:${recheck.verdict} path=${candidate.locator}`)
              return refused('io', `exec-time-${recheck.verdict}`, `${String(detail).slice(0, 200)}; zero bytes disclosed`)
            }
            // The size bound rides the FD BYTES (cap+1 metered ring on the
            // SAME verified fd): overshoot is measured, never truncated, and
            // the file is refused whole. The earlier stat.size never
            // decides anything the fd does not re-measure.
            const chunk = Buffer.alloc(READ_CHUNK_BYTES)
            const parts = []
            let total = 0
            while (total < SKILL_MAX_BYTES + 1) {
              if (skillSignal?.aborted === true) return { kind: 'cancelled' }
              const want = Math.min(READ_CHUNK_BYTES, SKILL_MAX_BYTES + 1 - total)
              const { bytesRead } = await handle.read(chunk, 0, want, total)
              if (bytesRead === 0) break
              parts.push(Buffer.from(chunk.subarray(0, bytesRead)))
              total += bytesRead
            }
            if (total > SKILL_MAX_BYTES) {
              return refused('io', 'skill-oversized', `the skill file exceeds the ${String(SKILL_MAX_BYTES)}-byte bound of the governed loader (measured on the verified fd); refused whole`)
            }
            const text = Buffer.concat(parts, total).toString('utf8')
            const parsed = parseSkillMarkdown(text)
            if (parsed.ok !== true) return refused('schema', parsed.code, String(parsed.detail))
            if (parsed.name !== name) {
              return refused('schema', 'skill-name-mismatch', `the skill file declares name "${parsed.name.slice(0, 120)}" under directory "${name}"`)
            }
            if (parsed.modelInvocable !== true) {
              return refused('admission', 'skill-not-model-invocable', `skill "${name}" is not available for model invocation`)
            }
            observe(`governed-skill RAN name=${name} bytes=${String(total)}`)
            return {
              kind: 'ok',
              value: {
                name: parsed.name,
                provider: 'filesystem',
                resourceBase: { kind: 'directory', path: candidate.root + '/' + name },
                content: parsed.content,
              },
            }
          } finally {
            await handle.close().catch(() => undefined)
          }
        }
        if (resolved.code === 'symlink-alias') {
          return refused('admission', 'symlink-alias', `the skill target under the sanctioned root is a symlink alias and escapes the anchor law: ${candidate.locator}`)
        }
        if (resolved.code !== 'target-unresolvable' && resolved.code !== 'target-outside-governed-root') {
          return refused('io', String(resolved.code), String(resolved.detail ?? 'the anchored resolution failed'))
        }
        if (resolved.code === 'target-outside-governed-root') {
          return refused('admission', 'ANCHOR-DRIFT', 'the target escapes the sanctioned root at resolution time; nothing is loaded')
        }
        // target-unresolvable: no file at this candidate — the next root's
        // rank decides, exactly the native provider's layered lookup shape.
      }
      return refused('admission', 'skill-unknown', `skill "${name}" is unknown or no longer available under the sanctioned skill roots`)
    } catch (error) {
      // A failed bounded read is a typed io refusal (no stack, no detail
      // beyond the boundary), never a crash smuggled into the row form.
      if (error !== null && typeof error === 'object' && (error.name === 'AbortError' || String(error?.code ?? '') === 'ABORTED')) {
        return { kind: 'cancelled' }
      }
      return refused('io', 'skill-read-failed', `the bounded skill read could not complete: ${String(error?.message ?? error).slice(0, 200)}`)
    } finally {
      settleToken()
    }
  }
}
