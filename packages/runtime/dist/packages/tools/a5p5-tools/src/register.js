/**
 * `a5p5-tools` — THE REGISTRATION FACE (PR4/5 install round, pb-CONTRACT.md §2).
 *
 * What governance a model-visible search/shell tool needs from this lane is
 * fixed and reviewable: strict argument parsing (closed keys, typed bounds,
 * `..` refusal) → effect derivation → the injected admission verdict → the
 * ONE pipeline (deny-before-backend) → renderer-only presentation. This file
 * packages exactly that body into plain tool DEFINITIONS — name, description,
 * closed parameter schema, and an `execute(raw, exec?)` closure returning
 * `{ text }` — the shape every public assembly seam's `tools.register` takes
 * (the measured W5 row form, `evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs`).
 * Since B3 the optional second argument is READ, not dropped: it carries the
 * host's cooperative cancel signal, which this face forwards onto the backend
 * call and nothing else (see GovernedToolExecContext).
 *
 * What this file deliberately does NOT do (the mount ruling is GLUE-4's, not
 * this lane's): it names no host module, knows no Agent/session scope, never
 * calls any registry, and imports nothing outside the lane + the read-only
 * `domain/tool-governance` algebra it already shares with `pipeline.ts`.
 * WHICH scope mounts these definitions, under WHICH names (aliases /
 * namespaces), and in WHICH order relative to the guard publish are
 * ASSEMBLY decisions — see pb-CONTRACT.md §2 (scoped 挂载归 GLUE-4 裁决).
 *
 * Purity: no `node:*`, no I/O, no clock — same law as `pipeline.ts`. The
 * verdicts come from `decide` (the injected admission face); a definition
 * built WITHOUT an admission face cannot be built here at all: `decide` is
 * a required field, so "registered ungated" is not expressible through this
 * face (the W5 ungated RED leg stays evidence-side on purpose).
 *
 * @module @dsh-agent-team/tools/a5p5-tools/register
 */
import { canonicalJsonFingerprint } from '../../../domain/tool-governance/src/index.js';
import { parseBashArgs, parseGlobArgs, parseGrepArgs } from './args.js';
import { runToolCall } from './pipeline.js';
import { GREP_OUTPUT_MODES } from './types.js';
/** The one JSON-schema fragment every closed target string shares. */
const TARGET_SCHEMA = { type: 'string' };
/** The model-facing parameter schemas — field sets EXACTLY the parsers accept (closedRecordKeys parity). */
const GREP_PARAMETERS = {
    type: 'object',
    properties: {
        pattern: { type: 'string' },
        path: TARGET_SCHEMA,
        glob: { type: 'string' },
        output_mode: { type: 'string', enum: [...GREP_OUTPUT_MODES] },
        fixed_string: { type: 'boolean' },
        ignore_case: { type: 'boolean' },
        multiline: { type: 'boolean' },
        context: { type: 'integer', minimum: 0, maximum: 20 },
        max_results: { type: 'integer', minimum: 1, maximum: 5000 },
    },
    required: ['pattern'],
    additionalProperties: false,
};
const GLOB_PARAMETERS = {
    type: 'object',
    properties: { pattern: { type: 'string' }, path: TARGET_SCHEMA },
    required: ['pattern'],
    additionalProperties: false,
};
const BASH_PARAMETERS = {
    type: 'object',
    properties: {
        command: { type: 'string' },
        cwd: TARGET_SCHEMA,
        timeout: { type: 'integer', minimum: 1, maximum: 600_000 },
        background: { type: 'boolean' },
    },
    required: ['command'],
    additionalProperties: false,
};
/** The prefix every refusal this face emits wears (renderer structure never leaks into refusals). */
export const REFUSAL_PREFIX = 'a5p5-refused ';
/** One deterministic single-line refusal fact (kind + code + bounded detail). */
function refusalText(kind, code, detail) {
    return `${REFUSAL_PREFIX}kind=${kind} code=${code} detail=${detail.slice(0, 240).replace(/\s+/g, ' ')}`;
}
/**
 * Build the governed search/shell tool definitions over the assembly's
 * backends and admission face. Returns definitions in the fixed lane order
 * (grep, glob, bash); the assembler decides WHICH of them to mount.
 */
export function createGovernedToolDefinitions(assembly) {
    const prefix = assembly.callIdPrefix ?? 'a5p5';
    const globBackend = assembly.globBackend ?? assembly.searchBackend;
    const names = assembly.names ?? {};
    let callSeq = 0;
    // fix-2b: fallback ids carry a per-mount nonce — a rebuilt plane can never
    // re-issue a call id a previous mount already spent a pending/allow on.
    const mountNonce = ((globalThis.crypto?.randomUUID?.() ?? `n-${String(Date.now())}-${String(Math.floor(Math.random() * 2 ** 31))}`));
    // PR358-A1: the REAL host token (object | symbol — never String(), which
    // would collide distinct symbol identities and let a forged string replay
    // an execution) is the in-process Map key. One token allocates ONE
    // correlation for its whole life; in-flight and terminal tokens are both
    // refused for a second call (the allocation is never reused).
    const tokenLedger = new Map();
    // 9e fix-1: the REAL signal for this execution is the host exec.signal;
    // a ledger-replay of a SETTLED token must be refused even before the
    // pipeline sees the call, so when the token is terminal the runner hands
    // the pipeline an ALREADY-ABORTED signal — the PA edge answers
    // `cancelled` with zero backend and zero consumption (the A2 law).
    const settledTokenSignals = new WeakMap();
    const makeAbortedSignal = () => ({ aborted: true, reason: 'exec-token-terminal', addEventListener: (_t, _l) => { }, removeEventListener: (_t, _l) => { } });
    const alreadyAbortedSignal = (token) => {
        if (typeof token === 'symbol')
            return makeAbortedSignal();
        const existing = settledTokenSignals.get(token);
        if (existing !== undefined)
            return existing;
        const settled = makeAbortedSignal();
        settledTokenSignals.set(token, settled);
        return settled;
    };
    const makeExecute = (toolKind, parse, backend) => async (raw, exec) => {
        const parsed = parse(raw);
        if (!parsed.ok) {
            return { text: refusalText('refused-schema', parsed.problems[0]?.code ?? 'unknown', JSON.stringify(parsed.problems).slice(0, 200)) };
        }
        // PR358-A1: ONLY a real per-execution token (object | symbol — the
        // Host's own ToolExecutionToken shape) anchors a correlation. A
        // stringy token is NOT an identity: it falls back to the mount-unique
        // per-call id, and no String() of it ever rides the wire.
        const tokenKey = typeof exec?.token === 'object' && exec.token !== null ? exec.token
            : typeof exec?.token === 'symbol' ? exec.token
                : undefined;
        const existing = tokenKey !== undefined ? tokenLedger.get(tokenKey) : undefined;
        if (existing !== undefined && !existing.settled) {
            // IN-FLIGHT replay: a second concurrent call for one live execution
            // is a contract violation — refused outright (9e: the CANCELLED form
            // belongs to a TERMINAL token only; an in-flight call must not also
            // be running while the first is unanswered).
            return { text: refusalText('refused-replay', 'exec-token-replay', 'this host execution already owns an in-flight governed call') };
        }
        // 9e fix-1 (terminal replay): a SETTLED token re-used allocates
        // NOTHING new — the run proceeds under the token's ORIGINAL
        // correlation with an already-aborted signal, so the PA edge settles
        // the fact as `cancelled` (zero backend, zero consumption) instead
        // of a non-row text refusal.
        const replaySettled = existing !== undefined && existing.settled;
        callSeq += 1;
        const callSeq2 = callSeq;
        const callId = replaySettled
            ? (tokenLedger.get(tokenKey)?.correlation ?? `${prefix}-${toolKind}:hexec:${mountNonce}-${String(callSeq2)}`)
            : `${prefix}-${toolKind}:${tokenKey !== undefined ? 'hexec' : 'mount'}:${mountNonce}-${String(callSeq2)}`;
        if (tokenKey !== undefined && !replaySettled) {
            tokenLedger.set(tokenKey, { correlation: callId, settled: false });
        }
        // 9e: a terminal-token replay keeps the ledger entry terminal — the
        // replay run never re-arms it (settled is NEVER re-opened).
        const settleTokenKey = replaySettled ? undefined : tokenKey;
        // 9e fix-1: the pipeline (and any plane executor reached through it)
        // consumes the ledger correlation as a STRING on the ctx — the real
        // token never travels as text.
        const runCtx = { ...(exec ?? {}), tokenKey: callId };
        const execSignal = replaySettled && exec?.token !== undefined
            ? alreadyAbortedSignal(exec.token)
            : (exec?.signal ?? undefined);
        let result;
        try {
            result = await runToolCall({
                request: {
                    realmId: assembly.realmId,
                    callId,
                    parsedArgs: parsed.value,
                    // M1: the canonical parameter fingerprint (Alpha.2 canonical-operation
                    // law), computed here from the CLOSED parsed args — the fact the PA
                    // edge asks, consumes and rechecks against.
                    parametersFingerprint: canonicalJsonFingerprint(parsed.value),
                    // B3: the host's cancel signal rides the call untouched. This face
                    // only CARRIES it — the cancelled fact belongs to the row that can
                    // actually stop a payload (the shell arm), never to the presentation.
                    ...(execSignal === undefined ? {} : { signal: execSignal }),
                },
                decide: assembly.decide,
                ...(assembly.pa === undefined ? {} : { pa: assembly.pa }),
                backend,
                ...(assembly.spillStore === undefined ? {} : { spill: { store: assembly.spillStore } }),
            });
        }
        finally {
            if (settleTokenKey !== undefined) {
                const entry = tokenLedger.get(settleTokenKey);
                if (entry !== undefined)
                    tokenLedger.set(settleTokenKey, { correlation: entry.correlation, settled: true });
            }
        }
        if (result.kind === 'presented')
            return { text: result.rendered.text };
        if (result.kind === 'refused-schema')
            return { text: refusalText(result.kind, result.problems[0]?.code ?? 'unknown', JSON.stringify(result.problems).slice(0, 200)) };
        if (result.kind === 'refused-admission')
            return { text: refusalText(result.kind, result.denyCode, result.effectFingerprint) };
        if (result.kind === 'refused-spill')
            return { text: refusalText(result.kind, result.refusal.code, result.refusal.detail) };
        return { text: refusalText(result.kind, result.failure.code, result.failure.detail) };
    };
    return Object.freeze([
        Object.freeze({
            name: names.grep ?? 'grep',
            description: 'Governed search (a5p5 lane): strict pattern search over the realm; effects derived read-time, admission-gated before any backend runs.',
            parameters: GREP_PARAMETERS,
            execute: makeExecute('grep', parseGrepArgs, assembly.searchBackend),
        }),
        Object.freeze({
            name: names.glob ?? 'glob',
            description: 'Governed filename traversal (a5p5 lane): pattern + target ONLY; admission-gated before any backend runs.',
            parameters: GLOB_PARAMETERS,
            execute: makeExecute('glob', parseGlobArgs, globBackend),
        }),
        Object.freeze({
            name: names.bash ?? 'bash',
            description: 'Governed shell (a5p5 lane): opaque command text decided by admission + the confined backend; deny-before-backend.',
            parameters: BASH_PARAMETERS,
            execute: makeExecute('bash', parseBashArgs, assembly.shellBackend),
        }),
    ]);
}
//# sourceMappingURL=register.js.map