/**
 * host-executor.mjs — WHERE the selected host's own tool-executor plugin lives.
 *
 * WHY THIS EXISTS. From `@deepseek-ai/dsh-tools` 0.2.2-rc.5 on, `ToolsService`
 * has NO built-in dispatch: a scope dispatches through the one executor a
 * composition selected for it (`tools.setExecutor`), and
 * `tools.selectExecutor(scope)` throws `TOOL_EXECUTOR_UNAVAILABLE` when there is
 * none. The executor itself is a SEPARATE plugin package
 * (`@deepseek-ai/dsh-tool-executor-native`); a real deployment's bundle mounts
 * it (`tests/deepseek-harness-next/packages/bundle/base/cordis.patch.yml`) and
 * the Member's agent scope simply INHERITS that selection.
 *
 * A synthetic world does not run the bundle: it assembles a bare `ToolRuntime`
 * out of the pinned tree. There is therefore nothing to inherit, and the
 * package is NOT visible to plain Node resolution from this repo (the repo
 * install is rc.2, which does not carry it). The PRODUCT seam must not guess a
 * host layout or sniff a version to find it, so the COMPOSITION says where the
 * module is — this helper is the test infrastructure's answer to that question:
 * the pinned tree's own copy of the package, addressed as a `file:` URL.
 *
 * `legacy` returns `undefined` ON PURPOSE: 0.2.0-rc.2 still dispatches through
 * the tool registry (`tools.modeFor` / `defaultMode`), so there is nothing to
 * mount and no module to name.
 */
import { pathToFileURL } from 'node:url'
import { resolveSelectedHostModule, testHostMode } from './host-select.mjs'

/** The host package that provides the native (in-process) tool executor. */
export const HOST_TOOL_EXECUTOR_PACKAGE = '@deepseek-ai/dsh-tool-executor-native'

/**
 * The module specifier a world forwards as `hostToolExecutorSpecifier`.
 *
 * @param {string} repoRoot - the Team checkout the harness lives in.
 * @param {'legacy'|'next'} [mode] - selected host generation.
 * @returns {string|undefined} a `file:` URL inside the selected pinned tree, or
 *   `undefined` when the selected host needs no mount (rc.2 registry dispatch).
 */
export function hostToolExecutorSpecifier(repoRoot, mode = testHostMode()) {
  if (mode !== 'next') return undefined
  return pathToFileURL(resolveSelectedHostModule(HOST_TOOL_EXECUTOR_PACKAGE, repoRoot, mode)).href
}
