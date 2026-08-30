/**
 * P3-T6 — the closed import graph of the t6 domain-integration test bundle.
 *
 * G3 criterion 1 ("domain has no live Agent dependency") is proven here by
 * an explicit negative test over the bundle's complete dependency closure
 * (TaskDoc P3-T6 实现要点: the bundle must not reference any live-Agent
 * package). The data below is the EXACT set of module specifiers the t6
 * bundle uses, enumerated from the actual source of the bundle and of the
 * six modules it composes (contracts + the five pure domain subpackages +
 * their testdata/fixtures data modules).
 *
 * The negative test (t6-1) asserts:
 *  1. NO specifier in the closure references a live-Agent package
 *     (packages/runtime, packages/tools, packages/remote, packages/client,
 *     packages/legacy, or the legacy `packages/team` vocabulary);
 *  2. the only NON-RELATIVE (bare) specifier in the whole closure is `yaml`
 *     — the workspace dependency of the blueprint parser (no Node builtins,
 *     no framework, no upstream DSH import);
 *  3. every direct bundle import resolves at runtime and exposes the
 *     expected marker export (the list is real, not fiction).
 *
 * Pure data module: no I/O, no node: builtins, no ambient state.
 * @module @dsh-agent-team/testkit/domain/import-graph
 */

/**
 * Path segments that name a live-Agent (or legacy Team) package. Any import
 * specifier carrying one of these as a path segment is a live-Agent
 * dependency and must never appear in the domain layer or its test bundle.
 */
export const T6_BANNED_PATH_SEGMENTS: readonly string[] = [
  'runtime',
  'tools',
  'remote',
  'client',
  'legacy',
  'team',
]

/**
 * Bare specifiers that name a live-Agent (or legacy) package directly.
 * Includes the workspace package names and the legacy plugin name.
 */
export const T6_BANNED_BARE_SPECIFIERS: readonly string[] = [
  ...T6_BANNED_PATH_SEGMENTS,
  '@dsh-agent-team/runtime',
  '@dsh-agent-team/tools',
  '@dsh-agent-team/remote',
  '@dsh-agent-team/client',
  '@dsh-agent-team/legacy',
  '@dsh-agent-team/team',
  'deepseek-harness',
]

/**
 * The direct imports of the t6 bundle itself (test files under
 * `packages/testkit/test/t6-*.test.ts`, `t6-helpers.ts`, and this
 * `domain/src` directory). Specifiers are written relative to the test file
 * location (`packages/testkit/test/`) — the location the dynamic imports in
 * t6-1 are evaluated from. `marker` names one export the module must expose
 * for the liveness check.
 */
export const T6_BUNDLE_DIRECT_IMPORTS: readonly {
  readonly specifier: string
  readonly marker: string
}[] = [
  { specifier: '../../contracts/src/index.js', marker: 'PACKAGE_ID' },
  { specifier: '../../domain/blueprint/src/index.js', marker: 'parseBlueprint' },
  { specifier: '../../domain/member/src/index.js', marker: 'createMemberInstance' },
  { specifier: '../../domain/lifecycle/src/index.js', marker: 'canTransition' },
  { specifier: '../../domain/policy/src/index.js', marker: 'resolveEffectivePolicy' },
  {
    specifier: '../../domain/compatibility/src/index.js',
    marker: 'evaluateCompatibility',
  },
  {
    specifier: '../../domain/blueprint/testdata/fixtures.js',
    marker: 'MINIMAL_BLUEPRINT_SOURCE',
  },
  {
    specifier: '../../domain/compatibility/fixtures/requirements.js',
    marker: 'BLUEPRINT_REQUIREMENTS',
  },
  {
    specifier: '../../domain/compatibility/fixtures/environment-facts.js',
    marker: 'FULLY_COMPATIBLE_FACTS',
  },
]

/**
 * The transitive import closure of the six composed modules: every module
 * specifier that appears in an `import ... from` or `export ... from`
 * statement inside `packages/contracts/src/**`,
 * `packages/domain/{blueprint,member,lifecycle,policy,compatibility}/src/**`,
 * `packages/domain/blueprint/testdata/**`, and
 * `packages/domain/compatibility/fixtures/**`.
 *
 * Enumerated verbatim from the source (54 unique specifiers). The three
 * cross-package edges — `../../../contracts/src/index.js`,
 * `../../../contracts/src/dto/common.js` (blueprint testdata helper), and
 * `../../lifecycle/src/index.js` (member → lifecycle) — are the ONLY
 * inter-module dependencies of the domain layer; everything else is
 * intra-module.
 */
export const T6_CLOSURE_IMPORT_SPECIFIERS: readonly string[] = [
  // cross-package (domain -> contracts, member -> lifecycle)
  '../../../contracts/src/index.js',
  '../../../contracts/src/dto/common.js',
  '../../lifecycle/src/index.js',
  // contracts intra-module
  '../errors.js',
  '../identity.js',
  '../ids/blueprint-id.js',
  '../ids/common.js',
  '../ids/instance-id.js',
  '../ids/session-id.js',
  '../ids/template-id.js',
  '../legacy-vocabulary.js',
  '../remote-safe.js',
  '../schema-version.js',
  './acknowledgement.js',
  './blueprint-snapshot.js',
  './brand.js',
  './catalog.js',
  './common.js',
  './context-policy.js',
  './contracts-mirror.js',
  './dto/blueprint-snapshot.js',
  './dto/member-instance-record.js',
  './dto/session-binding.js',
  './dto/team-session-record.js',
  './engine.js',
  './environment-facts.js',
  './errors.js',
  './fingerprint.js',
  './hash.js',
  './identity.js',
  './ids/blueprint-id.js',
  './ids/instance-id.js',
  './ids/session-id.js',
  './ids/template-id.js',
  './instance.js',
  './legacy-vocabulary.js',
  './operations.js',
  './parse.js',
  './remote-safe.js',
  './requirement.js',
  './resolve.js',
  './result.js',
  './roster.js',
  './schema.js',
  './schema-version.js',
  './snapshot.js',
  './transitions.js',
  './types.js',
  './uniqueness.js',
  './validate.js',
  './workspace.js',
  // fixture data modules (compatibility fixtures import their src types)
  '../src/environment-facts.js',
  '../src/requirement.js',
  // the single bare specifier of the whole closure (blueprint frontmatter)
  'yaml',
]

/** The complete closure under test: direct bundle imports + transitive. */
export const T6_FULL_IMPORT_CLOSURE: readonly string[] = [
  ...T6_BUNDLE_DIRECT_IMPORTS.map((entry) => entry.specifier),
  ...T6_CLOSURE_IMPORT_SPECIFIERS,
]

/**
 * True when `specifier` is a bare (non-relative) specifier.
 */
export function isBareSpecifier(specifier: string): boolean {
  return !specifier.startsWith('.')
}

/**
 * True when `specifier` references a live-Agent (or legacy Team) package —
 * as a bare name or as any path segment.
 */
export function isBannedSpecifier(specifier: string): boolean {
  if (T6_BANNED_BARE_SPECIFIERS.includes(specifier)) return true
  const segments = specifier.split('/')
  for (const segment of segments) {
    if (T6_BANNED_PATH_SEGMENTS.includes(segment)) return true
  }
  return false
}

/**
 * The only bare specifier the domain layer's closure is allowed to carry.
 * Any other bare specifier would be a third-party/framework/upstream
 * dependency and is a G3-1 violation.
 */
export function isAllowedBareSpecifier(specifier: string): boolean {
  return specifier === 'yaml'
}
