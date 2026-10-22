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
import type { RequestedEffectSet } from '../../../domain/tool-governance/src/index.js';
import type { ToolCancelSignal, ToolEffectBackend } from './backend-contract.js';
import { type AdmissionVerdict, type PaAdmitEdge } from './pipeline.js';
import type { SpillStore } from './spill.js';
/**
 * The execution context the host's dispatch hands as the SECOND argument
 * (`tool.execute(exec.arguments, exec)` — public ToolExecutionInput, whose
 * cooperative `signal` the host's own law says async work must observe).
 * B3: this is the lane's cancel INPUT — optional, so every pre-B3 single-arg
 * caller stays exact, and an absent signal means "never asked to cancel"
 * (the fact B2's X6 books). The lane names it structurally (ToolCancelSignal):
 * no host type, no node type, lane purity untouched.
 */
export interface GovernedToolExecContext {
    readonly signal?: ToolCancelSignal;
}
/** One registrable tool definition (the measured `tools.register` row shape). */
export interface GovernedToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
    readonly execute: (raw: unknown, exec?: GovernedToolExecContext) => Promise<{
        readonly text: string;
    }>;
}
/** The assembly inputs one governed tool family needs. `decide` is REQUIRED: no admission face, no definition. */
export interface A5P5Assembly {
    readonly realmId: string;
    /** The injected admission face (guard/Grant kernel on the assembly side). */
    readonly decide: (effectSet: RequestedEffectSet) => AdmissionVerdict;
    readonly searchBackend: ToolEffectBackend;
    readonly shellBackend: ToolEffectBackend;
    /** Optional glob backend; ABSENT reuses `searchBackend` (one graph, no second algebra). */
    readonly globBackend?: ToolEffectBackend;
    readonly spillStore?: SpillStore;
    /** Assembler-chosen model-facing names (scoped mounting is GLUE-4's ruling; ABSENT = the lane's own vocabulary). */
    readonly names?: {
        readonly grep?: string;
        readonly glob?: string;
        readonly bash?: string;
    };
    /** Deterministic call-id prefix for the assembly (audit join key); default `a5p5`. */
    readonly callIdPrefix?: string;
    /** M1 CENTER PA WIRING (frozen A): the async PA edge (admitCall → real
     *  Control ask when required → issueApprovedGrant → one-shot consume).
     *  The plane production mount injects it; archived pre-M1 kits omit it and
     *  keep their historical behavior untouched. */
    readonly pa?: PaAdmitEdge;
}
/** The prefix every refusal this face emits wears (renderer structure never leaks into refusals). */
export declare const REFUSAL_PREFIX = "a5p5-refused ";
/**
 * Build the governed search/shell tool definitions over the assembly's
 * backends and admission face. Returns definitions in the fixed lane order
 * (grep, glob, bash); the assembler decides WHICH of them to mount.
 */
export declare function createGovernedToolDefinitions(assembly: A5P5Assembly): readonly GovernedToolDefinition[];
//# sourceMappingURL=register.d.ts.map