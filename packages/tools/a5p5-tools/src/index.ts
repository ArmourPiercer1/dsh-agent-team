/**
 * `@dsh-agent-team/tools/a5p5-tools` — the Alpha.5 PR5 lane barrel (Phase 1:
 * Search/Shell effect schema + argument parsing + result rendering).
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

export { parseBashArgs, parseGlobArgs, parseGrepArgs, DEFAULT_MAX_SEARCH_RESULTS, MAX_CONTEXT_LINES, MAX_SEARCH_RESULTS, MAX_TIMEOUT_MS } from './args.js'
export { deriveToolEffectSet, targetLocatorOf } from './effects-schema.js'
export { renderSearchResult, renderShellResult, DEFAULT_MAX_STREAM_CHARS, META_PREFIX, BODY_PREFIX, type ShellRenderOptions } from './render.js'
export { A5P5_TOOL_NAMES, GREP_OUTPUT_MODES, TARGET_PLACEMENTS } from './types.js'
export type {
  A5P5ToolName,
  GrepOutputMode,
  ParsedShellArgs,
  ParsedGlobArgs,
  ParsedGrepArgs,
  ParsedTarget,
  ParsedToolArgs,
  PresentationMeta,
  RenderedPresentation,
  SearchCountRow,
  SearchMatchLine,
  SearchOutcome,
  SearchPresentationMeta,
  ShellOutcome,
  ShellPresentationMeta,
  TargetPlacement,
} from './types.js'
