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
import type { RequestedEffectSet } from '../../../domain/tool-governance/src/index.js';
import type { ToolEffectBackend } from './backend-contract.js';
import { type AdmissionVerdict } from './pipeline.js';
import type { SpillStore } from './spill.js';
/** One registrable tool definition (the measured `tools.register` row shape). */
export interface GovernedToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
    readonly execute: (raw: unknown) => Promise<{
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