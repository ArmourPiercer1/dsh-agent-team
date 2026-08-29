/**
 * P2-T5 negative fixture — private subpath import (red line: public surface only).
 *
 * Imports a module path the upstream package does NOT export:
 * `@deepseek-ai/dsh-subagent/lib/continuation.js` exists inside the pinned
 * tree but is outside the package exports map (which admits only `.`,
 * `./invariant`, `./client`, `./typert`, `./remote`, `./src/*`,
 * `./package.json`). Node's ESM loader must reject the import with
 * ERR_PACKAGE_PATH_NOT_EXPORTED before any of the module's code runs. The
 * probe group imports this file directly and records the rejection, and its
 * static admission scan must flag the same specifier. Never mounted.
 */
import * as continuation from '@deepseek-ai/dsh-subagent/lib/continuation.js'

export const name = 'p2t5-private-import'
export const continuationRef = continuation

export function apply() {}
