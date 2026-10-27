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
 * NO PA EDGE, NO READ: a mount without the PA admission edge refuses
 * (`PA_EDGE_UNAVAILABLE`); the row never bypasses, never falls back to a
 * native face, and holds no authority (admission / grant mint / grant
 * consume stay the Kernel's — the contribution states it as data).
 *
 * @module inspect-family/skill-executor
 */
import { readFile, lstat } from 'node:fs/promises'
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import { lexicalAnchor, resolveAnchoredPath } from '../../fs-family/src/fs-mechanics.mjs'
import {
  SKILL_FILE_NAME,
  SKILL_MAX_BYTES,
  isSkillNameGrammar,
  parseSkillMarkdown,
} from './skill-mechanics.mjs'

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
      { kind: 'tool-invoke', toolName: 'skill', resource: null },
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
    if (tokenKey !== undefined) {
      const prior = tokenLedger.get(tokenKey)
      if (prior !== undefined && prior.settled) {
        ledgerCorrelation = prior.correlation
        replaySettled = true
      } else {
        ledgerCorrelation = `plane-skill:${mountNonce}-${String(paSeq)}`
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
        callId: ledgerCorrelation ?? `plane-skill-${mountNonce}-${String(paSeq)}`,
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
    // ── POST-CONSUME: the anchored read over the declared candidates. ────
    try {
      for (const candidate of candidates) {
        // The anchor law BY REFERENCE (fs-mechanics): lexical containment,
        // existence, and the realpath re-check that refuses a symlink alias
        // — the same double proof the fs read row runs post-consume. The
        // declared lexical locator was the APPROVED effect; this is the
        // proof, and any deviation is a refusal, never a follow.
        const resolved = resolveAnchoredPath(candidate.root, relative)
        if (resolved.ok === true) {
          const stat = await lstat(resolved.path)
          if (!stat.isFile()) return refused('io', 'skill-not-a-file', `a non-file stands at ${candidate.locator}`)
          if (stat.size > SKILL_MAX_BYTES) {
            return refused('io', 'skill-oversized', `the skill file exceeds the ${String(SKILL_MAX_BYTES)}-byte bound of the governed loader`)
          }
          const text = await readFile(resolved.path, { encoding: 'utf8', ...(skillSignal === undefined ? {} : { signal: skillSignal }) })
          const parsed = parseSkillMarkdown(text)
          if (parsed.ok !== true) return refused('schema', parsed.code, String(parsed.detail))
          if (parsed.name !== name) {
            return refused('schema', 'skill-name-mismatch', `the skill file declares name "${parsed.name.slice(0, 120)}" under directory "${name}"`)
          }
          if (parsed.modelInvocable !== true) {
            return refused('admission', 'skill-not-model-invocable', `skill "${name}" is not available for model invocation`)
          }
          observe(`governed-skill RAN name=${name} bytes=${String(stat.size)}`)
          return {
            kind: 'ok',
            value: {
              name: parsed.name,
              provider: 'filesystem',
              resourceBase: { kind: 'directory', path: candidate.root + '/' + name },
              content: parsed.content,
            },
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
