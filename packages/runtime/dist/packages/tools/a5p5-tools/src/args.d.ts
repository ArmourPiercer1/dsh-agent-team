/**
 * `a5p5-tools` Phase 1 — STRICT argument parsing for `grep` / `glob` / `bash`
 * (design pipeline stage 1: "parse args").
 *
 * THE PARSE LAW IS IMPORTED, NOT RESTATED: unknown fields are reported with
 * the frozen `closeRecordKeys` law, required strings with `reqString`, closed
 * enumerations with `closedValue`, and every outcome — good or bad — finishes
 * through `finish` into the PR0 `ParseResult`/`ToolContractProblem`
 * vocabulary. This lane adds NO second problem code and NO partial
 * acceptance: a refusal lists every defect, a success materializes every
 * default (nothing hidden), and results are deep-frozen.
 *
 * TARGET CLASSIFICATION (architecture.md target-path law + `resource.ts`
 * locator law, enforced BEFORE any canonicalization): blank, URI-scarred and
 * leading-`\` locators are refused; a relative `..` segment is refused on
 * EVERY spelling before any lexical collapse; `~/` classifies as realm-home,
 * POSIX/Windows absolutes as absolute-path, everything else as
 * workspace-relative. Legal whitespace is PRESERVED — `trim()` would rename
 * a file. Canonicalization to an OS path stays the trusted provider's job at
 * exec time (Alpha.4 A2-3: this layer manufactures no canonical key).
 *
 * RANGES REFUSE, NEVER CLAMP (a silent clamp is a policy the model never
 * asked for): `context` ∈ [0, 20], `max_results` ∈ [1, 5000], `timeout` ∈
 * [1, 600000] ms.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/args
 */
import { type ParseResult } from '../../../domain/tool-governance/src/parse-util.js';
import { type ParsedShellArgs, type ParsedGlobArgs, type ParsedGrepArgs } from './types.js';
/** Upper bound of the `context` leg (a wider window is a presentation change, not a search). */
export declare const MAX_CONTEXT_LINES = 20;
/** Upper bound of `max_results` (bounded output; Spill attribution is a later slice). */
export declare const MAX_SEARCH_RESULTS = 5000;
/** Default result window when the caller does not ask for one. */
export declare const DEFAULT_MAX_SEARCH_RESULTS = 250;
/** Upper bound of `timeout` in ms (the provider default may be smaller, never this lane larger). */
export declare const MAX_TIMEOUT_MS = 600000;
/** Strictly parse raw `grep` arguments (closed shape; every default materialized). */
export declare function parseGrepArgs(raw: unknown): ParseResult<ParsedGrepArgs>;
/** Strictly parse raw `glob` arguments (filename traversal: pattern + target ONLY). */
export declare function parseGlobArgs(raw: unknown): ParseResult<ParsedGlobArgs>;
/**
 * Strictly parse raw `bash` arguments. The command text is kept OPAQUE —
 * nothing here inspects it for side effects (law 2 of `types.ts`); its real
 * file/network reach is decided by admission + the confined provider.
 */
export declare function parseBashArgs(raw: unknown): ParseResult<ParsedShellArgs>;
//# sourceMappingURL=args.d.ts.map