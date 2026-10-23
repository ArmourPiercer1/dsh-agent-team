/**
 * `a5p5-tools` M2-WRITE-01 — the GOVERNED WRITE SLICE: the write-face row body
 * a future plane write-takeover row mounts (the `write` native spelling at the
 * pin), expressed as a pure module the assembly injects its faces into.
 *
 * REVISION (root security ruling 07:13, fix round 1). The first revision
 * froze the plan as the EFFECT-SET fingerprint and left `call.member` unused
 * — reproduced defects: (1) cross member/call authorization, (2) two
 * concurrent writes over one grant, (3) a root swapped to a symlink during
 * the PA wait overwrote OUTSIDE the anchor. This revision closes all three
 * by REUSING the M1-VERIFIED fact objects — no new ledger, no second
 * fingerprint system:
 *
 *  - THE FULL PLAN (law 5): the call freezes through the pinned canonicalizer
 *    (`operation-permission/canonical-operation.ts` — the M1 fact: the write
 *    projection carries the CONTENT digest plus the resolved target key;
 *    A2C-5: distinct contents mint DISTINCT fingerprints). The canonical
 *    fingerprint — NOT the effect-set fingerprint — is what the PA edge and
 *    the exec-time recheck bind. A content swap under a frozen approval is a
 *    different plan and never answers the old approval.
 *  - THE FIVE TRUSTED BINDINGS (law 2): every call carries its REAL identity
 *    — exec token (object|symbol, never a string), member, callId, and the
 *    definition/provider binding facts. The approved `request`/`grant` handed
 *    back by the PA edge must agree with them FIELD-FOR-FIELD
 *    (`admission-identity-mismatch:*` refuses otherwise): a grant minted for
 *    member A / call X never authorizes member B / call Y.
 *  - ONE CONSUMPTION POINT (law 12/13): the PA edge here is the OPEN half
 *    (admit / ask / durable Control lane — it consumes NOTHING). The single
 *    consumption point is the admission-GATED lane's exec-time recheck
 *    through the injected `makePort` (production: `createFsAdmissionPort` =
 *    the kernel's one-shot `consumeForExecution`). The slice never consumes
 *    and never re-consumes; `onWriteCommitted` RECORDS the committed fact
 *    only — it never authorizes anything and is never a consumption. A
 *    concurrent or sequential replay over the same grant answers
 *    `grant-consumed` (`APPROVAL_STALE`) from the REAL ledger view.
 *  - THE ANCHOR DRIFTS = STALE (law 11): after approval and before the open,
 *    the injected drift seam re-runs the READ side's law — approved-target
 *    agreement incl. the root itself and its ancestors (the read row's
 *    `ANCHOR-DRIFT`). Any drift is a stale refusal with zero write and zero
 *    re-approval. The final FD check (O_NOFOLLOW open + exec-time re-read)
 *    remains the gated C-FS lane's own law and still runs after this.
 *  - CANCELLATION IS NOT A WRITE AND NOT A REFUSAL (law 8/9): an aborted
 *    signal before the edge, an `allow + cancelled` verdict, or an abort
 *    landing during the wait all answer `{ kind: 'cancelled' }` — never the
 *    allow branch, never a re-approval, zero bytes.
 *  - `undetermined` STAYS HONEST (`mapLaneError`): an `undetermined` lane
 *    error keeps its `sideEffectPossible` fact (mirroring the frozen
 *    `sideEffectUnknown` spelling; unstated = conservative TRUE).
 *    `edit`/`replace`-family faces additionally need a READ effect — a
 *    write-only grant never covers them (this face is `write`:
 *    create-or-replace, no read of the old text).
 *
 * The host argument law at the pin stands: `file_path` (required string),
 * `content` (required string; EMPTY is legitimate) — host
 * `packages/fs/tool-fs/src/write.ts:24-27,75-79`; the escalation pair
 * (`sandbox_permissions`/`justification`, host `sandbox.ts:59-72`) has NO
 * governed lane here and is REFUSED typed, never silently dropped.
 *
 * The success result carries the write receipt ONLY
 * (`canonicalLocator` + `writtenFingerprint`): prior content NEVER travels
 * back (ruling D-C2-1; the host `before`/`after` echo is the C2-full
 * increment riding a PAIRED read effect through the governed read arm).
 *
 * Purity: no `node:*`, no I/O, no clock — external faces are injected (the
 * `backend-contract.ts` structural-view precedent). The injected
 * `canonicalize`/`resolveTarget`/`checkDrift`/`makePort` arms ARE the M1
 * fact objects; the slice consumes them, never re-implements them.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/write-slice
 */
/** The closed refusal classes of this face: before admission, at admission, at the fs edge. */
export const WRITE_SLICE_REFUSAL_CLASSES = ['schema', 'admission', 'fs'];
/**
 * The host value law plus this face's escalation refusal. Mirrors the pinned
 * host check (blank `file_path` is the only shape the schema cannot express;
 * empty `content` is legitimate) and adds the governed-face rule: the
 * escalation pair has NO meaning here and is refused, not ignored.
 */
export function parseWriteSliceArgs(args) {
    if (args === null || typeof args !== 'object') {
        return refuse('schema', 'write-args-not-a-record', 'the write arguments must be a record');
    }
    const filePath = args['file_path'];
    const content = args['content'];
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
        return refuse('schema', 'write-args-file-path-blank', 'file_path must be a non-empty string');
    }
    if (typeof content !== 'string') {
        return refuse('schema', 'write-args-content-not-string', 'content must be a string (the empty string writes an empty file)');
    }
    if (args['sandbox_permissions'] !== undefined || args['justification'] !== undefined) {
        return refuse('schema', 'write-escalation-ungoverned', 'sandbox_permissions/justification ride the host-native escalation face, which this governed write assembles NOT; a governed write carries no escalation lane');
    }
    return { ok: true, filePath, content };
}
/**
 * PURE-LEXICAL anchor projection (zero fs access — the read row's fix-5
 * pre-gate law restated for the write side): every lexical target that
 * escapes the governed root is refused BEFORE anything else runs.
 */
export function lexicalWriteAnchor(rootDir, rawPath) {
    if (rawPath.includes('://')) {
        return refuse('schema', 'locator-rejected', 'a filesystem locator never wears a URI scheme');
    }
    if (rawPath.startsWith('\\')) {
        return refuse('schema', 'locator-rejected', 'UNC/leading-backslash targets are refused');
    }
    const posix = rootDir.startsWith('/');
    const sep = posix ? '/' : '\\';
    const normalizedRoot = normalizeLexical(rootDir, sep);
    const isAbsolute = rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath);
    const joined = isAbsolute ? normalizeLexical(rawPath, sep) : resolveAgainst(normalizedRoot, rawPath, sep);
    const inside = joined === normalizedRoot
        || joined.startsWith(normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep);
    if (!inside) {
        return refuse('schema', 'locator-rejected', `the lexical target escapes the governed root (${joined})`);
    }
    return { ok: true, path: joined };
}
function splitLexical(p, sep) {
    return p.split(sep === '\\' ? /[\\/]/ : /\//);
}
function normalizeLexical(p, sep) {
    const out = [];
    const segments = splitLexical(p, sep);
    const absolute = segments[0] === '';
    for (const segment of segments) {
        if (segment === '' || segment === '.')
            continue;
        if (segment === '..') {
            if (out.length > 0 && out[out.length - 1] !== '..') {
                out.pop();
            }
            else if (!absolute) {
                out.push('..');
            }
            continue;
        }
        out.push(segment);
    }
    const body = out.join(sep);
    return absolute ? sep + body : body;
}
function resolveAgainst(root, rel, sep) {
    if (rel.startsWith('/') || rel.startsWith('\\'))
        return normalizeLexical(rel, sep);
    return normalizeLexical(`${root}${sep}${rel}`, sep);
}
/** Pure mapping law: an `undetermined` fs outcome KEEPS its side-effect honesty. */
export function mapLaneError(result) {
    const cfClass = result.error.details?.['cfClass'];
    const cfReason = result.error.details?.['cfReason'];
    const sideEffectUnknown = result.error.details?.['sideEffectUnknown'];
    const refusal = {
        kind: 'refused',
        ok: false,
        refusalClass: 'fs',
        code: result.error.code,
        // message + code ONLY — the lane's messages carry locators and reasons,
        // never file content; this slice never appends content anywhere.
        text: `refused-fs ${result.error.code} — ${result.error.message}`,
        ...(typeof cfClass === 'string' ? { cfClass } : {}),
        ...(typeof cfReason === 'string' ? { cfReason } : {}),
    };
    // The ruling's honesty law: `undetermined` ALWAYS keeps sideEffectPossible
    // (unstated = conservative TRUE; a stated false is mirrored verbatim).
    if (cfClass === 'undetermined') {
        return { ...refusal, sideEffectPossible: sideEffectUnknown !== false };
    }
    return sideEffectUnknown === true ? { ...refusal, sideEffectPossible: true } : refusal;
}
/**
 * The governed write executor — the row body a future plane write-takeover
 * row mounts. `run(raw, call)` walks the closed law order; every exit is a
 * typed outcome and no refusal path has touched the filesystem or spent an
 * approval.
 */
export function createGovernedWriteExecutor(deps) {
    const observeLine = (line) => { deps.observe?.(line); };
    // THE TOKEN LEDGER (the read row's ledger law, same object discipline):
    // ONE allocation per execution token for the token's whole life. An
    // in-flight replay and a settled replay are BOTH refused — a write never
    // re-runs on one identity. This is a CORRELATION ledger, not a second
    // authority: consumption stays ONLY in the kernel (one-shot).
    const writeTokenLedger = new Map();
    let tokenSeq = 0;
    const ruleCovers = (rules, locator) => (rules ?? []).some((rule) => {
        if (rule?.tool !== 'write')
            return false;
        const kind = rule?.resource?.kind;
        if (kind === 'any')
            return true;
        if (kind === 'exact')
            return typeof rule.resource?.path === 'string' && rule.resource.path === locator;
        // subtree without the injected containment seam proves NOTHING (the read row's law): refuse.
        return false;
    });
    return {
        async run(raw, call) {
            // 1 — host value law + escalation refusal (zero fs, zero PA).
            const args = parseWriteSliceArgs((raw !== null && typeof raw === 'object') ? raw : null);
            if (!args.ok) {
                observeLine(`governed-write schema-refused code=${args.code}`);
                return args;
            }
            // 2 — THE FIVE TRUSTED BINDINGS: a governed write without its real
            // identity is refused BEFORE anything else (defect 1 root fix: the
            // identity is now load-bearing, never decorative).
            const identity = checkCallIdentity(call);
            if (!identity.ok) {
                observeLine(`governed-write schema-refused code=${identity.refusal.code}`);
                return identity.refusal;
            }
            // 3 — token single-flight (defect 2, identity half): one write per
            // execution token, ever.
            const tokenKey = call.execToken;
            const prior = writeTokenLedger.get(tokenKey);
            if (prior !== undefined) {
                observeLine('governed-write admission-refused code=exec-token-replay');
                return refuse('admission', 'exec-token-replay', prior.settled
                    ? 'this host execution already ran a governed write; a spent identity is never re-armed and a write never re-runs'
                    : 'this host execution already owns an in-flight governed write (single-flight)');
            }
            tokenSeq += 1;
            const correlation = typeof call.correlation === 'string' && call.correlation.length > 0
                ? call.correlation
                : `plane-write-${String(tokenSeq)}`;
            writeTokenLedger.set(tokenKey, { correlation, settled: false });
            try {
                return await walkWrite(args.filePath, args.content, call, correlation, observeLine);
            }
            finally {
                writeTokenLedger.set(tokenKey, { correlation, settled: true });
            }
        },
    };
    async function walkWrite(filePath, content, call, correlation, emit) {
        // 4 — PURE-LEXICAL anchor (zero realpath/exists/stat).
        const lex = lexicalWriteAnchor(deps.rootDir, filePath);
        if (!lex.ok) {
            emit(`governed-write lexical-refused code=${lex.code}`);
            return lex;
        }
        // 5 — THE FULL PLAN FREEZE (defect 1, plan half): the M1 canonicalizer —
        // the write projection binds the CONTENT digest and the resolved target
        // KEY; distinct contents mint distinct fingerprints (A2C-5). This — not
        // the effect-set fingerprint — is what every downstream edge answers.
        // A canonicalization failure is a typed refusal, NEVER a pass-through
        // (the pinned §7.5 law).
        let plan;
        try {
            plan = await deps.canonicalize({ name: 'write', arguments: { file_path: filePath, content }, resolveTarget: deps.resolveTarget });
        }
        catch (error) {
            const detail = error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160);
            emit('governed-write schema-refused code=canonicalization-failed');
            return refuse('schema', 'canonicalization-failed', `the canonical plan could not be frozen: ${detail}`);
        }
        if (plan.resource.kind !== 'file' || typeof plan.fingerprint !== 'string' || plan.fingerprint.length === 0) {
            emit('governed-write schema-refused code=canonical-plan-malformed');
            return refuse('schema', 'canonical-plan-malformed', 'the canonical operation is not a file plan with a non-empty fingerprint');
        }
        // The effect set still walks the frozen grammar (the kernel validates it
        // separately); its fingerprint is NOT the plan fingerprint.
        const set = deps.parser.parseRequestedEffectSet([
            { kind: 'tool-invoke', toolName: 'write', resource: null },
            { kind: 'write', resource: { realmId: deps.realmId, kind: 'absolute-path', canonicalLocator: lex.path, rights: ['write'] } },
        ]);
        if (!set.ok) {
            emit('governed-write schema-refused code=effect-set-rejected');
            return refuse('schema', 'effect-set-rejected', 'the requested effect set is rejected by the frozen grammar');
        }
        const writeEffect = set.value.effects.find((effect) => effect.kind === 'write');
        const ref = writeEffect?.resource ?? null;
        if (ref === null) {
            return refuse('schema', 'effect-set-rejected', 'the canonicalized set carries no write resource');
        }
        // 6 — template lane fast deny.
        const verdict = deps.decide({ effects: set.value.effects });
        if (verdict.kind === 'deny') {
            emit(`governed-write lane-denied code=${verdict.code}`);
            return refuse('admission', verdict.code, 'the template lane denies this write effect');
        }
        // 7 — deny-default re-check at the effect's own granularity.
        if (deps.policy?.default === 'deny' && !ruleCovers([...(deps.policy?.allow ?? []), ...(deps.policy?.ask ?? [])], lex.path)) {
            emit(`governed-write default-deny refusal path=${lex.path}`);
            return refuse('admission', 'template-default-deny', 'the policy defaults to DENY and no rule covers this write effect');
        }
        // 8 — cancellation BEFORE the edge: a call that already stopped existing
        // never asks for approval (zero walk, zero consumption, not a refusal).
        if (isAborted(call.signal)) {
            emit('governed-write cancelled-before-edge');
            return { kind: 'cancelled' };
        }
        // 9 — the PA OPEN edge (full identity in, nothing consumed). Pending is
        // a denial with its own code, NEVER an allow stand-in.
        const gate = await deps.pa({
            realmId: deps.realmId,
            callId: call.callId,
            member: call.member,
            binding: call.binding,
            correlation,
            parametersFingerprint: plan.fingerprint,
            requestedEffects: set.value,
            ...(call.signal === undefined ? {} : { signal: call.signal }),
        });
        if (gate.kind === 'pending') {
            emit('governed-write pa-pending refusal=PA_PENDING_NOT_ALLOW');
            return refuse('admission', 'PA_PENDING_NOT_ALLOW', 'the admission edge is PENDING; pending is a denial with its own code, never a synchronous allow');
        }
        if (gate.kind === 'deny') {
            emit(`governed-write pa-denied code=${gate.code}`);
            return refuse('admission', gate.code, gate.detail ?? 'the admission edge refused this write');
        }
        if (gate.kind === 'allow') {
            // defect 2 (cancel half): the ONLY allow-spelling this edge answers is
            // `{ allow, cancelled: true }` — a PRESENTED fact. The old revision
            // walked the allow branch and WROTE. Never again.
            emit('governed-write cancelled-at-edge');
            return { kind: 'cancelled' };
        }
        // 10 — THE IDENTITY SEAM (defect 1 verbatim fix): the approved request
        // and grant must agree with the call's trusted bindings FIELD-FOR-FIELD.
        // A grant minted for another member, another call, another plan
        // fingerprint, another effect set or another binding answers typed and
        // writes nothing.
        const mismatch = identityMismatch(gate, call, plan.fingerprint, set.value.fingerprint);
        if (mismatch !== null) {
            emit(`governed-write admission-refused code=${mismatch}`);
            return refuse('admission', mismatch, 'the approved request/grant does not answer THIS execution: the plan is bound to its member, call, fingerprint, effect set and definition');
        }
        // An abort that landed DURING the walk stops the write before the open
        // (recomputed — the signal flips OUTSIDE this module's view, so no
        // narrowing may be trusted across the await).
        if (isAborted(call.signal)) {
            emit('governed-write cancelled-before-open');
            return { kind: 'cancelled' };
        }
        // 11 — THE ANCHOR-DRIFT LAW (defect 3): approved-target agreement AFTER
        // approval — the root itself and its ancestors included (the read row's
        // `ANCHOR-DRIFT` law, injected seam). Any drift is stale: zero write,
        // zero re-approval; the approved fact is never rewritten here. The
        // FINAL FD check (O_NOFOLLOW open + exec-time re-read) stays the gated
        // C-FS lane's own law and runs after this.
        const drift = await deps.checkDrift(lex.path);
        if (!drift.ok) {
            emit(`governed-write drift-refused code=${drift.code} path=${lex.path}`);
            return refuse('admission', drift.code, `the anchor drifted between approval and execution: ${drift.detail}`);
        }
        // 12 — the admission-GATED controlled-fs call. THE ONE consumption point
        // lives here: the port (production `createFsAdmissionPort`) answers the
        // exec-time recheck with the kernel's one-shot `consumeForExecution` —
        // bound to the CANONICAL plan fingerprint, never the effect-set one.
        const lane = deps.gatedFs.createAdmissionGatedControlledFs({
            instances: [{ fs: deps.fsId, rootDir: deps.rootDir, realmId: deps.realmId, kind: 'absolute-path' }],
            now: deps.clock,
            currentAuthorityGeneration: deps.authorityGeneration,
            consumed: deps.consumed,
            ...(deps.visibility === undefined ? {} : { visibility: deps.visibility }),
            admission: {
                admission: deps.makePort?.(gate.request, gate.grant) ?? refusingPort(),
                parametersFingerprint: plan.fingerprint,
            },
        });
        const result = await lane.fs.writeText(gate.grant, ref, content);
        if (!result.ok) {
            const mapped = mapLaneError(result);
            emit(`governed-write fs-refused code=${mapped.code} cfClass=${String(mapped.cfClass ?? '?')} cfReason=${String(mapped.cfReason ?? '?')}`);
            return mapped;
        }
        // 13 — the committed fact: the receipt ONLY (D-C2-1 — no old content
        // travels back). `onWriteCommitted` RECORDS it; it authorizes nothing,
        // is consulted by nothing, and consumes nothing.
        deps.onWriteCommitted?.({
            grant: gate.grant,
            canonicalLocator: result.value.canonicalLocator,
            writtenFingerprint: result.value.writtenFingerprint,
            callId: call.callId,
            member: call.member,
        });
        emit(`governed-write committed path=${result.value.canonicalLocator}`);
        return {
            kind: 'written',
            canonicalLocator: result.value.canonicalLocator,
            writtenFingerprint: result.value.writtenFingerprint,
            laneLedger: [...lane.ledger],
        };
    }
}
function checkCallIdentity(call) {
    const isIdentity = (typeof call.execToken === 'object' && call.execToken !== null) || typeof call.execToken === 'symbol';
    if (!isIdentity) {
        return { ok: false, refusal: refuse('schema', 'identity-token-missing', 'a governed write requires the REAL execution token (object | symbol); a string is never an identity') };
    }
    const member = call.member;
    if (member === null || typeof member !== 'object'
        || typeof member.teamSessionId !== 'string' || member.teamSessionId.length === 0
        || typeof member.instanceId !== 'string' || member.instanceId.length === 0) {
        return { ok: false, refusal: refuse('schema', 'identity-member-malformed', 'a governed write requires the real member pair (teamSessionId + instanceId)') };
    }
    if (typeof call.callId !== 'string' || call.callId.length === 0) {
        return { ok: false, refusal: refuse('schema', 'identity-call-missing', 'a governed write requires the real callId') };
    }
    const binding = call.binding;
    if (binding === null || typeof binding !== 'object'
        || typeof binding.bindingId !== 'string' || binding.bindingId.length === 0
        || !Number.isInteger(binding.revision) || binding.revision < 1
        || typeof binding.definitionIdentity !== 'string' || binding.definitionIdentity.length === 0
        || typeof binding.providerId !== 'string' || binding.providerId.length === 0) {
        return { ok: false, refusal: refuse('schema', 'identity-binding-malformed', 'a governed write requires the definition/provider binding facts (bindingId, revision, definitionIdentity, providerId)') };
    }
    return { ok: true };
}
function identityMismatch(gate, call, planFingerprint, effectFingerprint) {
    const request = gate.request;
    const grant = gate.grant;
    if (request.member.teamSessionId !== call.member.teamSessionId || request.member.instanceId !== call.member.instanceId) {
        return 'admission-identity-mismatch:member';
    }
    if (request.callId !== call.callId)
        return 'admission-identity-mismatch:call';
    if (request.parametersFingerprint !== planFingerprint)
        return 'admission-identity-mismatch:fingerprint';
    if (request.requestedEffects.fingerprint !== effectFingerprint)
        return 'admission-identity-mismatch:effect-set';
    if (grant.bindingId !== undefined && grant.bindingId !== call.binding.bindingId)
        return 'admission-identity-mismatch:binding';
    if (grant.bindingRevision !== undefined && grant.bindingRevision !== call.binding.revision)
        return 'admission-identity-mismatch:binding-revision';
    return null;
}
/** Recomputed on every read: an AbortSignal flips OUTSIDE this module view. */
function isAborted(signal) {
    return signal?.aborted === true;
}
/** The honest default for an unwired exec-time port: it REFUSES. */
function refusingPort() {
    return { recheckCall: async () => ({ ok: false, reason: 'recheck-port-unbound' }) };
}
function refuse(refusalClass, code, detail) {
    return { kind: 'refused', ok: false, refusalClass, code, text: `refused-${refusalClass} ${code} — ${detail}` };
}
//# sourceMappingURL=write-slice.js.map