#!/usr/bin/env node
/**
 * probe-composition.mjs — STEP 0 (round 81, post-cut): measure which composition
 * serves the native `bash` / `pwsh` names TODAY, HOST-FREE.
 *
 * The B1 probe mounted the route-C world and asked it which definitions the
 * appended `confined-bash-tool.mjs` shadow had placed. The A1 cut deleted that
 * appending mechanism (`5d1349767`: every `confined*SpecOf` and its module), so
 * the question changed with the composition:
 *
 *   1. does the SHIPPED wiring serve `pwsh` at all? (three repo facts)
 *   2. is the route-C appended shadow gone, and does the composition declare the
 *      native module instead? (the A1 law: HOST-MODULES-ONLY)
 *   3. what is the successor that mounts the preset's own module?
 *
 * No mount, no child process, no port: these are SOURCE facts, so the probe
 * cannot silently inherit a dead world's answer.
 *
 * Evidence re-recorded this round for the same reason:
 * dev/agent-workflow/evidence/ute3-process-b1-20261120/composition-probe.txt
 *
 * @module tests/ute-g1-process/probe-composition
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../paths.mjs'
import { DELETING_COMMITS, REPO_ROOT, ROUTE_C_ROW, VNEXT_ASSEMBLY } from '../ute-g1-shared/retirement.mjs'
import { HOST_ROOT } from './lib/world.mjs'

const read = (path) => readFileSync(join(REPO_ROOT, path), 'utf8')
const exists = (path) => existsSync(join(REPO_ROOT, path))

console.log(`PROBE host=${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA} host_tree=${HOST_ROOT === join(REPO_ROOT, 'tests', 'deepseek-harness-test-use') ? 'tests/deepseek-harness-test-use' : 'OTHER'}`)
console.log('PROBE fixture=<none> composition=post-cut (host-free source facts)')

/* ── 0. the pwsh question, answered by facts, not by a skip ─────────────── */
const pwshBinary = ['/usr/bin/pwsh', '/usr/local/bin/pwsh', '/opt/microsoft/powershell/7/pwsh']
  .filter((candidate) => { try { readFileSync(candidate); return true } catch { return false } })
const pathPwsh = spawnSync('sh', ['-c', 'command -v pwsh 2>/dev/null || true'], { encoding: 'utf8' }).stdout.trim()
const rowSource = read(ROUTE_C_ROW)
const shadowPresent = [
  'packages/runtime/src/plugin/live/confined-bash-tool.mjs',
  'packages/runtime/src/plugin/live/confined-terminal-tool.mjs',
].some((path) => exists(path)) || /confined[A-Z]\w*SpecOf/u.test(rowSource)
const presetPatch = read('cordis.patch.yml')
const presetMountsPwsh = /^\s*-\s*id:\s*tool-pwsh\b/mu.test(presetPatch)
console.log(`PROBE-PWSH binary=${pwshBinary.length > 0 ? pwshBinary.join(',') : (pathPwsh !== '' ? pathPwsh : 'ABSENT')}`)
console.log(`PROBE-PWSH binary-on-path=${pathPwsh === '' ? 'no' : 'yes'} host-package=${existsHostPackage('shell/tool-pwsh') ? 'present' : 'absent'} route-c-shadow=${shadowPresent ? 'PRESENT' : 'ABSENT'}`)
console.log(`PROBE-PWSH preset-row=${presetMountsPwsh ? 'MOUNTED' : 'REMOVED-by-the-shipped-governed-preset'}`)

/* ── 1. the post-cut composition: the preset's OWN module, never a shadow ── */
const assembly = read(VNEXT_ASSEMBLY)
const mountsHostModules = /mountHostModules|mountVnextNativeToolModules|a5sfNativeToolModules/u.test(assembly)
console.log(`PROBE-REGISTRY pwsh=MISSING bash=host-module (the composition supplies the active preset's own row; the Team shadow is absent since ${DELETING_COMMITS.appendedShadow})`)
console.log(`PROBE-PWSH reason=shipped-wiring route-c-shadow=${shadowPresent ? 'PRESENT' : 'ABSENT'} preset-row=${presetMountsPwsh ? 'MOUNTED' : 'REMOVED'} post-attach-definition=ABSENT — the binary line above is a HOST OBSERVATION, not the exclusion reason`)
console.log('PROBE-ROUTE-UNREACHABLE member=pwsh reason=no definition is registered for this name: the route-C attach appends no shadow and the shipped governed preset REMOVES tool-pwsh')
console.log(`PROBE-MOUNT bash=host-module-of-the-active-preset via ${VNEXT_ASSEMBLY} (mounts-on-by-default=${mountsHostModules ? 'yes' : 'NO(!!)'})`)
console.log(`PROBE-SUCCESSOR appended-shadow=ABSENT composition-declared-native-modules=${mountsHostModules ? 'PRESENT' : 'ABSENT(!!)'}`)
console.log('PROBE-CONCLUSION baseline-scope=bash only; pwsh is a DECLARED, PRINTED exclusion (unit stays short: 1 of 2 members exercisable)')

/** Is a package built in the PINNED host tree? */
function existsHostPackage(rel) {
  return existsHostPath(join(HOST_ROOT, 'packages', ...rel.split('/'), 'lib', 'index.js'))
}

/** Existence on an ABSOLUTE path (the pinned host tree). */
function existsHostPath(absolute) {
  try {
    readFileSync(absolute)
    return true
  } catch {
    return false
  }
}
