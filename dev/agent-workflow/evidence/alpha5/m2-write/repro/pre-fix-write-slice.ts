/**
 * `a5p5-tools` M2-WRITE-01 — the GOVERNED WRITE SLICE: the write-face row body
 * a future plane write-takeover row mounts (the `write` native spelling at the
 * pin), expressed as a pure module the assembly injects its faces into.
 *
 * WHAT THIS IS: the law order a governed write must walk, ported from the
 * read row's already-live discipline (deny fast path → default-deny re-check
 * → the ASYNC admission edge → the admission-GATED controlled-fs call), with
 * the write-side facts taken verbatim from the pinned host source:
 *
 *  - the tool's arguments are `file_path` (required string) and `content`
 *    (required string); `content` may be EMPTY (it writes an empty file) —
 *    host `packages/fs/tool-fs/src/write.ts:24-27,75-79`;
 *  - the two escalation fields (`sandbox_permissions`, `justification`) are
 *    advertised only under a confining host fs backend and resolved by the
 *    host's own sandbox controller
 *    (`packages/fs/tool-fs/src/sandbox.ts:59-72`). THIS face assembles no
 *    escalation semantics, so a call carrying either field is REFUSED typed
 *    (`write-escalation-ungoverned`) — silently dropping a model-visible
 *    escalation request is not an option;
 *  - the pre-admission projection is PURE LEXICAL (zero realpath/exists/stat,
 *    the read row's fix-5 law): pending or refused admission must never have
 *    touched the filesystem;
 *  - `pending` is a denial with its own code, NEVER a synchronous allow
 *    (`PA_PENDING_NOT_ALLOW`);
 *  - bytes move ONLY through the injected admission-GATED controlled-fs face
 *    (grant-per-call, checks-before-open, alias walk, exec-time re-read);
 *  - the success result carries the write receipt ONLY
 *    (`canonicalLocator` + `writtenFingerprint`): prior content NEVER travels
 *    back (the M-02 no-diff-reading law of the C-FS receipt). The pinned host
 *    tool returns `before`/`after` (host write.ts:80-105); this governed face
 *    deliberately returns NO `before` — the "diff suppressed, write happened"
 *    variant is stated, pinned by the spec's zero-echo leg, and the C2 row
 *    body must disclose it in its result contract rather than fake the
 *    native four-field echo.
 *
 * Purity: no `node:*`, no I/O, no clock — the effect I/O is reached ONLY
 * through the injected faces (the same structural-view discipline as
 * `backend-contract.ts`: this module names neither node nor host types).
 *
 * @module @dsh-agent-team/tools/a5p5-tools/write-slice
 */

/** The closed refusal classes of this face: before admission, at admission, at the fs edge. */
export const WRITE_SLICE_REFUSAL_CLASSES = ['schema', 'admission', 'fs'] as const
export type WriteSliceRefusalClass = (typeof WRITE_SLICE_REFUSAL_CLASSES)[number]

/** One typed refusal. `text` carries code + reason ONLY — never file content. */
export interface WriteSliceRefusal {
  readonly kind: 'refused'
  /** Discriminant shared with the helpers' `{ ok: true }` arms. */
  readonly ok: false
  readonly refusalClass: WriteSliceRefusalClass
  readonly code: string
  readonly text: string
  readonly cfClass?: string
  readonly cfReason?: string
}

/** One success: the C-FS receipt ONLY (no old content, no diff payload). */
export interface WriteSliceWritten {
  readonly kind: 'written'
  readonly canonicalLocator: string
  readonly writtenFingerprint: string
  /** The gated lane's decision ledger for THIS call (append-only, open-issued/fd-closed lines). */
  readonly laneLedger: readonly unknown[]
}

export type WriteSliceOutcome = WriteSliceWritten | WriteSliceRefusal

/** The host `write` argument view (closed: unknown keys are IGNORED here, the host validator owns rejection). */
export interface WriteToolArgsView {
  readonly file_path?: unknown
  readonly content?: unknown
  readonly sandbox_permissions?: unknown
  readonly justification?: unknown
}

/**
 * The host value law plus this face's escalation refusal. Mirrors the pinned
 * host check (blank `file_path` is the only shape the schema cannot express;
 * empty `content` is legitimate) and adds the governed-face rule: the
 * escalation pair has NO meaning here and is refused, not ignored.
 * @param args - the raw tool arguments of one call.
 * @returns the validated `{ filePath, content }` or a typed schema refusal.
 */
export function parseWriteSliceArgs(args: WriteToolArgsView | null): { ok: true; filePath: string; content: string } | WriteSliceRefusal {
  if (args === null || typeof args !== 'object') {
    return refuse('schema', 'write-args-not-a-record', 'the write arguments must be a record')
  }
  const filePath = args['file_path']
  const content = args['content']
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return refuse('schema', 'write-args-file-path-blank', 'file_path must be a non-empty string')
  }
  if (typeof content !== 'string') {
    return refuse('schema', 'write-args-content-not-string', 'content must be a string (the empty string writes an empty file)')
  }
  if (args['sandbox_permissions'] !== undefined || args['justification'] !== undefined) {
    return refuse('schema', 'write-escalation-ungoverned',
      'sandbox_permissions/justification ride the host-native escalation face, which this governed write assembles NOT; a governed write carries no escalation lane')
  }
  return { ok: true, filePath, content }
}

/**
 * PURE-LEXICAL anchor projection (zero fs access — the read row's fix-5
 * pre-gate law restated for the write side). Absolute spellings are accepted
 * (the host resolves them through its fs backend); every lexical target that
 * escapes the governed root is refused BEFORE admission, and nothing after
 * this point runs for it.
 * @param rootDir - the governed instance root.
 * @param rawPath - the raw `file_path` spelling.
 * @returns the normalized in-root absolute path, or a typed schema refusal.
 */
export function lexicalWriteAnchor(rootDir: string, rawPath: string): { ok: true; path: string } | WriteSliceRefusal {
  if (rawPath.includes('://')) {
    return refuse('schema', 'locator-rejected', 'a filesystem locator never wears a URI scheme')
  }
  if (rawPath.startsWith('\\')) {
    return refuse('schema', 'locator-rejected', 'UNC/leading-backslash targets are refused')
  }
  const posix = rootDir.startsWith('/')
  const sep = posix ? '/' : '\\'
  const normalizedRoot = normalizeLexical(rootDir, sep)
  const isAbsolute = rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath)
  const joined = isAbsolute ? normalizeLexical(rawPath, sep) : resolveAgainst(normalizedRoot, rawPath, sep)
  const inside = joined === normalizedRoot
    || joined.startsWith(normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep)
  if (!inside) {
    return refuse('schema', 'locator-rejected', `the lexical target escapes the governed root (${joined})`)
  }
  return { ok: true, path: joined }
}

function splitLexical(p: string, sep: string): string[] {
  return p.split(sep === '\\' ? /[\\/]/ : /\//)
}

/** Lexical normalization WITHOUT touching the filesystem (no path module: purity). */
function normalizeLexical(p: string, sep: string): string {
  const out: string[] = []
  const segments = splitLexical(p, sep)
  const absolute = segments[0] === ''
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop()
      } else if (!absolute) {
        out.push('..')
      }
      continue
    }
    out.push(segment)
  }
  const body = out.join(sep)
  return absolute ? sep + body : body
}

function resolveAgainst(root: string, rel: string, sep: string): string {
  if (rel.startsWith('/') || rel.startsWith('\\')) return normalizeLexical(rel, sep)
  return normalizeLexical(`${root}${sep}${rel}`, sep)
}

// ---------------------------------------------------------------------------
// Injected faces (structural views — this module owns no second contract)
// ---------------------------------------------------------------------------

/** One resource of the frozen effect grammar (view). */
export interface SliceResourceRefView {
  readonly realmId: string
  readonly kind: string
  readonly canonicalLocator: string
  readonly rights: readonly string[]
}

/** The frozen canonical effect set (view). */
export interface SliceEffectSetView {
  readonly effects: readonly { readonly kind: string; readonly resource: SliceResourceRefView | null }[]
  readonly fingerprint: string
}

/** The frozen parser face this slice consumes (only the effect-set parse). */
export interface SliceEffectParser {
  parseRequestedEffectSet(raw: unknown):
    | { readonly ok: true; readonly value: SliceEffectSetView }
    | { readonly ok: false; readonly problems: readonly unknown[] }
}

/** One gated-lane write outcome (view of the frozen GovernanceResult). */
export type SliceGatedWriteResult =
  | { readonly ok: true; readonly value: { readonly canonicalLocator: string; readonly writtenFingerprint: string } }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details?: Readonly<Record<string, string | number | boolean | null>> } }

/** The admission-GATED controlled-fs face (view of `createAdmissionGatedControlledFs`). */
export interface SliceGatedControlledFs {
  createAdmissionGatedControlledFs(config: SliceGatedLaneConfig): {
    readonly fs: {
      writeText(grant: unknown, ref: SliceResourceRefView, content: string): Promise<SliceGatedWriteResult>
    }
    readonly ledger: readonly unknown[]
  }
}

/** The exec-time admission port the gated lane re-ASKS (view). */
export interface SliceAdmissionPort {
  recheckCall(intent: { readonly op: string; readonly canonicalLocator: string; readonly parametersFingerprint: string }): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }>
}

/** The gated-lane config this slice assembles per call (view). */
export interface SliceGatedLaneConfig {
  readonly instances: readonly { readonly fs: string; readonly rootDir: string; readonly realmId: string; readonly kind: 'absolute-path' }[]
  readonly now: () => number
  readonly currentAuthorityGeneration: number
  readonly consumed: (grantId: string) => boolean
  readonly visibility?: (member: unknown, desc: { readonly fs: string; readonly path: string }) => 'visible' | 'hidden'
  readonly admission: { readonly admission: SliceAdmissionPort; readonly parametersFingerprint: string }
}

/** The PA (plan-admission) edge verdicts this face walks. `pending` is terminal-refusal here. */
export type SlicePaVerdict =
  | { readonly kind: 'allow'; readonly grant: unknown }
  | { readonly kind: 'deny'; readonly code: string; readonly detail?: string }
  | { readonly kind: 'pending'; readonly detail?: string }

/** The per-call PA request this face states. */
export interface SlicePaRequest {
  readonly realmId: string
  readonly callId: string
  readonly parametersFingerprint: string
  readonly requestedEffects: SliceEffectSetView
}

/** One policy rule (the operation-permission shape the plane rows consume). */
export interface SlicePolicyRule {
  readonly tool?: string
  readonly resource?: { readonly kind?: string; readonly path?: string }
}

/** The template policy view (deny-default + rule lanes). */
export interface SlicePolicyView {
  readonly default?: string
  readonly allow?: readonly SlicePolicyRule[]
  readonly ask?: readonly SlicePolicyRule[]
}

/** The lane (template-lane fast path) verdict. */
export type SliceLaneVerdict = { readonly kind: 'allow' } | { readonly kind: 'deny'; readonly code: string }

/** Construction arms of {@link createGovernedWriteExecutor}. */
export interface GovernedWriteExecutorDeps {
  readonly parser: SliceEffectParser
  readonly gatedFs: SliceGatedControlledFs
  readonly realmId: string
  readonly fsId: string
  readonly rootDir: string
  readonly clock: () => number
  readonly authorityGeneration: number
  /** The grant-consumption VIEW (the durable ledger's read side; never mutated here). */
  readonly consumed: (grantId: string) => boolean
  readonly policy?: SlicePolicyView
  readonly decide: (request: { readonly effects: readonly unknown[] }) => SliceLaneVerdict
  readonly pa: (request: SlicePaRequest) => Promise<SlicePaVerdict>
  /** The exec-time re-ask answer for the gated lane (fixture-graded until the wired port lands). */
  readonly recheckPort?: SliceAdmissionPort
  readonly visibility?: (member: unknown, desc: { readonly fs: string; readonly path: string }) => 'visible' | 'hidden'
  /** Observation sink for the mount log (same posture as the read row's `observe`). */
  readonly observe?: (line: string) => void
  /** Wired after a COMMITTED write — the assembly's landing edge for the one-shot consumption fact. */
  readonly onWriteCommitted?: (grant: unknown) => void
}

/** One call identity pair the row supplies (host exec correlation lands at C2). */
export interface GovernedWriteCall {
  readonly member: unknown
  readonly callId: string
}

/**
 * The governed write executor — the row body a future plane write-takeover
 * row mounts. `run(raw, call)` walks the closed law order; every exit is a
 * typed outcome and no refusal path has touched the filesystem.
 * @param deps - the injected faces (parser, gated C-FS factory, lane/PA edges, readers).
 * @returns the row body.
 */
export function createGovernedWriteExecutor(deps: GovernedWriteExecutorDeps): {
  run(raw: WriteToolArgsView | unknown, call: GovernedWriteCall): Promise<WriteSliceOutcome>
} {
  const observe = deps.observe ?? (() => {})
  const ruleCovers = (rules: readonly SlicePolicyRule[] | undefined, locator: string): boolean =>
    (rules ?? []).some((rule) => {
      if (rule?.tool !== 'write') return false
      const kind = rule?.resource?.kind
      if (kind === 'any') return true
      if (kind === 'exact') return typeof rule.resource?.path === 'string' && rule.resource.path === locator
      // subtree without the injected containment seam proves NOTHING (the read row's law): refuse.
      return false
    })

  return {
    async run(raw, call) {
      // 1 — host value law + escalation refusal (zero fs, zero PA).
      const args = parseWriteSliceArgs((raw !== null && typeof raw === 'object') ? raw as WriteToolArgsView : null)
      if (!args.ok) {        observe(`governed-write schema-refused code=${args.code}`)
        return args
      }
      // 2 — PURE-LEXICAL anchor (zero realpath/exists/stat — pending ⇒ resolver=0).
      const lex = lexicalWriteAnchor(deps.rootDir, args.filePath)
      if (!lex.ok) {
        observe(`governed-write lexical-refused code=${lex.code}`)
        return lex
      }
      // 3 — the frozen effect grammar (one value: the approved locator, the
      // effect locator and the consumed target are the SAME lex path until the
      // C2 resolver lands behind the PA edge with the drift law).
      const set = deps.parser.parseRequestedEffectSet([
        { kind: 'tool-invoke', toolName: 'write', resource: null },
        { kind: 'write', resource: { realmId: deps.realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: ['write'] } },
      ])
      if (!set.ok) {
        observe('governed-write schema-refused code=effect-set-rejected')
        return refuse('schema', 'effect-set-rejected', 'the requested effect set is rejected by the frozen grammar')
      }
      const writeEffect = set.value.effects.find((effect) => effect.kind === 'write')
      const ref = writeEffect?.resource ?? null
      if (ref === null) {
        return refuse('schema', 'effect-set-rejected', 'the canonicalized set carries no write resource')
      }
      // 4 — template lane fast deny.
      const verdict = deps.decide({ effects: set.value.effects })
      if (verdict.kind === 'deny') {
        observe(`governed-write lane-denied code=${verdict.code}`)
        return refuse('admission', verdict.code, 'the template lane denies this write effect')
      }
      // 5 — deny-default re-check at the effect's own granularity.
      if (deps.policy?.default === 'deny' && !ruleCovers([...(deps.policy?.allow ?? []), ...(deps.policy?.ask ?? [])], lex.path)) {
        observe(`governed-write default-deny refusal path=${lex.path}`)
        return refuse('admission', 'template-default-deny', 'the policy defaults to DENY and no rule covers this write effect')
      }
      // 6 — the ASYNC admission edge. Pending is a denial with its own code —
      // NEVER an allow stand-in; nothing below runs until PA says allow.
      const gate = await deps.pa({
        realmId: deps.realmId,
        callId: call.callId,
        parametersFingerprint: set.value.fingerprint,
        requestedEffects: set.value,
      })
      if (gate.kind === 'pending') {
        observe('governed-write pa-pending refusal=PA_PENDING_NOT_ALLOW')
        return refuse('admission', 'PA_PENDING_NOT_ALLOW', 'the admission edge is PENDING; pending is a denial with its own code, never a synchronous allow')
      }
      if (gate.kind === 'deny') {
        observe(`governed-write pa-denied code=${gate.code}`)
        return refuse('admission', gate.code, gate.detail ?? 'the admission edge refused this write')
      }
      // 7 — the admission-GATED controlled-fs call: this is the ONLY place a
      // byte moves. Grant-per-call through the gated factory (its recheck is
      // bound to the canonical fingerprint; a diverging intent never reaches
      // the port).
      const lane = deps.gatedFs.createAdmissionGatedControlledFs({
        instances: [{ fs: deps.fsId, rootDir: deps.rootDir, realmId: deps.realmId, kind: 'absolute-path' }],
        now: deps.clock,
        currentAuthorityGeneration: deps.authorityGeneration,
        consumed: deps.consumed,
        ...(deps.visibility === undefined ? {} : { visibility: deps.visibility }),
        admission: {
          admission: deps.recheckPort ?? refusingPort(),
          parametersFingerprint: set.value.fingerprint,
        },
      })
      const result = await lane.fs.writeText(gate.grant, ref, args.content)
      if (!result.ok) {
        const cfClass = result.error.details?.['cfClass']
        const cfReason = result.error.details?.['cfReason']
        observe(`governed-write fs-refused code=${result.error.code} cfClass=${String(cfClass ?? '?')} cfReason=${String(cfReason ?? '?')}`)
        return {
          kind: 'refused',
          ok: false,
          refusalClass: 'fs',
          code: result.error.code,
          // message + code ONLY — the lane's messages carry locators and reasons,
          // never file content; this slice never appends content anywhere.
          text: `refused-fs ${result.error.code} — ${result.error.message}`,
          ...(typeof cfClass === 'string' ? { cfClass } : {}),
          ...(typeof cfReason === 'string' ? { cfReason } : {}),
        }
      }
      // 8 — the committed fact: the receipt ONLY (M-02 — no old content travels
      // back), then the wired consumption landing edge (the durable ledger's
      // write side belongs to the assembly, never to this module).
      deps.onWriteCommitted?.(gate.grant)
      observe(`governed-write committed path=${result.value.canonicalLocator}`)
      return {
        kind: 'written',
        canonicalLocator: result.value.canonicalLocator,
        writtenFingerprint: result.value.writtenFingerprint,
        laneLedger: [...lane.ledger],
      }
    },
  }
}

/** The honest default for an unwired exec-time port: it REFUSES (nothing is ever silently re-asked-ok). */
function refusingPort(): SliceAdmissionPort {
  return { recheckCall: async () => ({ ok: false as const, reason: 'recheck-port-unbound' }) }
}

function refuse(refusalClass: WriteSliceRefusalClass, code: string, detail: string): WriteSliceRefusal {
  return { kind: 'refused', ok: false, refusalClass, code, text: `refused-${refusalClass} ${code} — ${detail}` }
}
