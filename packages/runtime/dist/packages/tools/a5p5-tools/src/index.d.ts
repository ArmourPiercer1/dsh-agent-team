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
export { renderSearchResult, renderShellResult, DEFAULT_MAX_STREAM_CHARS, META_PREFIX, BODY_PREFIX, type RenderOptions, type ShellRenderOptions } from './render.js';
export { A5P5_TOOL_NAMES, GREP_OUTPUT_MODES, TARGET_PLACEMENTS } from './types.js';
export type { A5P5ToolName, GrepOutputMode, ParsedShellArgs, ParsedGlobArgs, ParsedGrepArgs, ParsedTarget, ParsedToolArgs, PresentationMeta, RenderedPresentation, SearchCountRow, SearchMatchLine, SearchOutcome, SearchPresentationMeta, ShellOutcome, ShellPresentationMeta, SpillPointer, TargetPlacement, } from './types.js';
export { createSpillLease, openSpillStore, SPILL_ERROR_CLASSES, SPILL_LEASE_STATES, SPILL_REFUSAL_CODES, SETTLEMENT_EVENTS, type LeaseSettlement, type LeaseMoveResult, type OpenSinkResult, type OpenStoreResult, type ReadAuthorizer, type SettlementEvent, type SpillAttribution, type SpillErrorClass, type SpillFsPort, type SpillLease, type SpillLeaseState, type SpillRefusal, type SpillRefusalCode, type SpillResidueEntry, type SpillSink, type SpillStore, } from './spill.js';
export { BACKEND_STAGES, UNREADABLE_SETTLEMENT, type BackendCall, type BackendFailure, type BackendResult, type BackendRunIo, type BackendStage, type ScenarioFixture, type ScenarioTable, type ToolEffectBackend, } from './backend-contract.js';
export { createDirectBackend } from './backend-direct.js';
export { createContractStubBackend } from './backend-stub.js';
export { runToolCall, type AdmissionVerdict, type RunToolCallDeps, type SpillPointerFact, type ToolCallRequest, type ToolCallResult } from './pipeline.js';
export { createGovernedToolDefinitions, createGovernedShellRowDefinition, REFUSAL_PREFIX, type A5P5Assembly, type GovernedToolDefinition } from './register.js';
//# sourceMappingURL=index.d.ts.map