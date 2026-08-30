/**
 * @dsh-agent-team/testkit/domain — the P3-T6 domain-integration test bundle.
 *
 * Shared, deterministic building blocks used by the t6 test files under
 * `packages/testkit/test/`:
 *
 * - `scenario` — one Blueprint → N MemberInstances composition builder and
 *   the canonical composition serializer / re-parser (G3-2, G3-8 surfaces);
 * - `import-graph` — the closed import graph of the bundle and its six
 *   composed modules, driving the G3-1 "no live Agent dependency" negative
 *   test.
 *
 * Pure data + pure functions: no I/O, no live Agent, no Node builtins.
 * @module @dsh-agent-team/testkit/domain
 */

export {
  T6_ROOT_SESSION_ID,
  T6_CREATED_AT,
  T6_DEFAULT_TEMPLATE_ID,
  T6_DEFAULT_LABEL,
  t6Pad2,
  t6InstanceIdAt,
  t6ChildSessionIdAt,
  buildTeamComposition,
  serializeComposition,
  parseComposition,
} from './scenario.js'
export type {
  TeamComposition,
  TeamCompositionOptions,
  ParsedComposition,
} from './scenario.js'
export {
  T6_BANNED_PATH_SEGMENTS,
  T6_BANNED_BARE_SPECIFIERS,
  T6_BUNDLE_DIRECT_IMPORTS,
  T6_CLOSURE_IMPORT_SPECIFIERS,
  T6_FULL_IMPORT_CLOSURE,
  isBareSpecifier,
  isBannedSpecifier,
  isAllowedBareSpecifier,
} from './import-graph.js'
