/**
 * `a5p5-tools` — THE REGISTRATION FACE (PR4/5 install round, pb-CONTRACT.md §2).
 *
 * What governance a model-visible search/shell tool needs from this lane is
 * fixed and reviewable: strict argument parsing (closed keys, typed bounds,
 * `..` refusal) → effect derivation → the injected admission verdict → the
 * ONE pipeline (deny-before-backend) → renderer-only presentation. This file
 * packages exactly that body into plain tool DEFINITIONS — name, description,
 * closed parameter schema, and an `execute(raw)` closure returning
 * `{ text }` — the shape every public assembly seam's `tools.register` takes
 * (the measured W5 row form, `evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs`).
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
    const makeExecute = (toolKind, parse, backend) => async (raw) => {
        const parsed = parse(raw);
        if (!parsed.ok) {
            return { text: refusalText('refused-schema', parsed.problems[0]?.code ?? 'unknown', JSON.stringify(parsed.problems).slice(0, 200)) };
        }
        const callId = `${prefix}-${toolKind}-${String(++callSeq)}`;
        const result = await runToolCall({
            request: { realmId: assembly.realmId, callId, parsedArgs: parsed.value },
            decide: assembly.decide,
            backend,
            ...(assembly.spillStore === undefined ? {} : { spill: { store: assembly.spillStore } }),
        });
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