/**
 * `@dsh-agent-team/tools/a5p5-tools` — the Alpha.5 PR5 lane barrel (Phase 1:
 * Search/Shell effect schema + argument parsing + result rendering; Phase 2:
 * spill semantics + the parity backend contract).
 *
 * THIS IS A LANE BARREL, NOT THE SHARED ONE. The shared
 * `packages/tools/src/index.ts`, the registry, the tsconfig solution and any
 * scanner deliberately do NOT know this directory — `a5p5-dormant-audit`
 * fails the moment shipped production code names the lane, and wiring it is
 * a reviewed integration move (PR0 `a5p0-layer-audit` precedent).
 *
 * DORMANT: nothing registers, nothing dispatches; the algebra consumed here
 * lives (read-only) in `domain/tool-governance`.
 *
 * @module @dsh-agent-team/tools/a5p5-tools
 */
export { parseBashArgs, parseGlobArgs, parseGrepArgs, DEFAULT_MAX_SEARCH_RESULTS, MAX_CONTEXT_LINES, MAX_SEARCH_RESULTS, MAX_TIMEOUT_MS } from './args.js';
export { deriveToolEffectSet, targetLocatorOf } from './effects-schema.js';
export { renderSearchResult, renderShellResult, DEFAULT_MAX_STREAM_CHARS, META_PREFIX, BODY_PREFIX } from './render.js';
export { A5P5_TOOL_NAMES, GREP_OUTPUT_MODES, TARGET_PLACEMENTS } from './types.js';
// Phase 2 — spill semantics + the backend contract both parity paths share.
export { createSpillLease, openSpillStore, SPILL_ERROR_CLASSES, SPILL_LEASE_STATES, SPILL_REFUSAL_CODES, SETTLEMENT_EVENTS, } from './spill.js';
export { BACKEND_STAGES, UNREADABLE_SETTLEMENT, } from './backend-contract.js';
export { createDirectBackend } from './backend-direct.js';
export { createContractStubBackend } from './backend-stub.js';
export { runToolCall } from './pipeline.js';
// PR4/5 install round — THE REGISTRATION FACE (pb-CONTRACT.md §2): tool
// DEFINITIONS over the one pipeline. The mount (which scope, which names,
// which order) stays with the assembler — GLUE-4 owns the scoped-mount
// ruling; this lane only produces the definitions and never registers.
// U6 PR3: the single governed SHELL row face (the process family lane
// contributes the bash row to the governance Kernel through it — ONE
// `makeExecute`, the trio face unchanged).
export { createGovernedToolDefinitions, createGovernedShellRowDefinition, REFUSAL_PREFIX } from './register.js';
//# sourceMappingURL=index.js.map