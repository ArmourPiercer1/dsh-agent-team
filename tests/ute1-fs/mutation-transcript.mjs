/**
 * mutation-transcript.mjs — the recorded mutation transcript for UTE-1.
 *
 * WHAT IT PROVES. Each negative control must be RED without the behaviour and
 * GREEN with it. A control that only ever passes proves nothing, so every arm
 * in `lib/arms.mjs` is run twice: once against the SHIPPED product module
 * (all arms green) and once against a copy carrying ONE textual mutation that
 * removes exactly the behaviour the arm exists to protect. The transcript is
 * printed line by line and the process exits non-zero if any arm fails to go
 * red, or if the shipped module is not green.
 *
 * WHY THE MUTATION IS A SOURCE EDIT OF A COPY, NOT A MOCK: the module is
 * dependency-free (no imports at all), so a byte-copy of the shipped file loads
 * through the same Node type-stripping the product build uses. A mock would
 * replace the very code under test; a copy edits it and leaves the arm intact.
 *
 * Host-free by design: these arms test the binding's own decisions. The
 * real-effect assembly arms (which DO need the pinned rc.5 host) live in
 * `native-fs-binding.test.mjs` and are not duplicated here.
 *
 * @module tests/ute1-fs/mutation-transcript
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ARMS, runAllArms } from './lib/arms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const MODULE_SOURCE = join(REPO_ROOT, 'packages', 'tools', 'src', 'native-fs-binding.ts')
const SCRATCH = join(REPO_ROOT, '.artifacts', 'tmp', 'ute1-fs-mutations')

/**
 * One mutation: a named, textual removal of one behaviour.
 * `expectedRed` names the arms that MUST fail on the mutated copy.
 */
export const MUTATIONS = Object.freeze([
  Object.freeze({
    id: 'M1-remove-dispose-guard',
    behaviour: 'the scope-state check in assertLive (use-after-dispose)',
    expectedRed: Object.freeze(['a3-use-after-dispose']),
    apply(source) {
      return replaceOnce(
        source,
        '    if (state.status === \'open\') return',
        '    if (true) return',
        'assertLive no longer consults the scope state',
      )
    },
  }),
  Object.freeze({
    id: 'M2-lane-admits-everything',
    behaviour: 'the lane containment check in admit()',
    expectedRed: Object.freeze(['a2-lane-denial']),
    apply(source) {
      return replaceOnce(
        source,
        '    if (withinAny(roots, hostPath)) {',
        '    if (true) {',
        'the lane admits every resolved path',
      )
    },
  }),
  Object.freeze({
    id: 'M3-dispose-keeps-scope-open',
    behaviour: 'the monotonic open→disposed transition in dispose()',
    expectedRed: Object.freeze(['a4-double-dispose']),
    apply(source) {
      return replaceOnce(
        source,
        '      state.status = \'disposed\'',
        '      state.status = \'open\'',
        'disposal no longer closes the scope',
      )
    },
  }),
  Object.freeze({
    id: 'M4-shared-lane-across-scopes',
    behaviour: 'per-scope lane isolation (the lane becomes the last created)',
    expectedRed: Object.freeze(['a5-overlap-scopes']),
    apply(source) {
      let mutated = replaceOnce(
        source,
        '/** Reserved: the host code a write-without-read refusal carries. */\nconst WRITE_REQUIRES_READ_CODE = \'FS_NOT_OBSERVED\'',
        '/** Reserved: the host code a write-without-read refusal carries. */\nconst WRITE_REQUIRES_READ_CODE = \'FS_NOT_OBSERVED\'\n\nlet __sharedLane = null',
        'a module-level lane is introduced',
      )
      mutated = replaceOnce(
        mutated,
        '  const facts: NativeFsBindingFact[] = []',
        '  const facts: NativeFsBindingFact[] = []\n  __sharedLane = lane',
        'every scope overwrites the module-level lane',
      )
      return replaceOnce(
        mutated,
        '    const roots = axis === \'read\' ? lane.read : lane.write',
        '    const roots = axis === \'read\' ? __sharedLane.read : __sharedLane.write',
        'admission reads the module-level lane instead of the scope\'s own',
      )
    },
  }),
  Object.freeze({
    id: 'M5-drop-generation-pin',
    behaviour: 'the host-generation pin in mountNativeFsBinding',
    expectedRed: Object.freeze(['a7-generation-mismatch']),
    apply(source) {
      return replaceOnce(
        source,
        '  if (host.generation !== input.expectedGeneration) {',
        '  if (false) {',
        'a host of any generation is accepted',
      )
    },
  }),
  Object.freeze({
    id: 'M6-retain-previous-lane',
    behaviour: 'the fresh lane of a re-mounted scope (provider swap)',
    expectedRed: Object.freeze(['a6-provider-swap']),
    apply(source) {
      let mutated = replaceOnce(
        source,
        '/** Reserved: the host code a write-without-read refusal carries. */\nconst WRITE_REQUIRES_READ_CODE = \'FS_NOT_OBSERVED\'',
        '/** Reserved: the host code a write-without-read refusal carries. */\nconst WRITE_REQUIRES_READ_CODE = \'FS_NOT_OBSERVED\'\n\nlet __carriedLane = null',
        'a module-level carried lane is introduced',
      )
      mutated = replaceOnce(
        mutated,
        '  const lane: FsBindingLane = Object.freeze({\n    read: Object.freeze([...(base.read as readonly string[])]),\n    write: Object.freeze([...(base.write as readonly string[])]),\n  })',
        '  __carriedLane = __carriedLane ?? {\n    read: Object.freeze([...(base.read as readonly string[])]),\n    write: Object.freeze([...(base.write as readonly string[])]),\n  }\n  const lane: FsBindingLane = __carriedLane',
        'the first scope\'s lane is reused by every later scope',
      )
      return mutated
    },
  }),
])

/**
 * Replace exactly one literal, refusing a silent no-op.
 * @param {string} source
 * @param {string} needle
 * @param {string} replacement
 * @param {string} note
 * @returns {string}
 */
function replaceOnce(source, needle, replacement, note) {
  const index = source.indexOf(needle)
  if (index === -1) {
    throw new Error(`mutation anchor not found (the module drifted from the transcript): ${note}`)
  }
  if (source.indexOf(needle, index + 1) !== -1) {
    throw new Error(`mutation anchor is not unique (the module drifted from the transcript): ${note}`)
  }
  return `${source.slice(0, index)}${replacement}${source.slice(index + needle.length)}`
}

/**
 * Run the transcript.
 * @param {{log?: (line: string) => void}} [options]
 * @returns {Promise<{ok: boolean, lines: string[], failures: string[]}>}
 */
export async function runMutationTranscript({ log = () => {} } = {}) {
  const lines = []
  const failures = []
  const emit = (line) => {
    lines.push(line)
    log(line)
  }

  const shipped = await import(pathToFileURL(MODULE_SOURCE).href)
  emit(`MUTATION-MODULE ${MODULE_SOURCE}`)
  emit(`MUTATION-MODULE-ID ${shipped.NATIVE_FS_BINDING_MODULE_ID}`)
  const baseline = await runAllArms(shipped)
  for (const result of baseline) {
    emit(`MUTATION-BASELINE arm=${result.id} observed=${result.ok ? 'green' : 'red'} detail=${result.detail}`)
    if (!result.ok) failures.push(`shipped module is not green on ${result.id}: ${result.detail}`)
  }
  emit(`MUTATION-BASELINE-VERDICT ${failures.length === 0 ? 'GREEN' : 'RED'} arms=${baseline.length}`)

  const source = readFileSync(MODULE_SOURCE, 'utf8')
  for (const mutation of MUTATIONS) {
    let mutated
    try {
      mutated = mutation.apply(source)
    } catch (error) {
      failures.push(`${mutation.id}: ${error.message}`)
      emit(`MUTATION-ARM id=${mutation.id} verdict=TRANSCRIPT-BROKEN detail=${JSON.stringify(error.message)}`)
      continue
    }
    const dir = join(SCRATCH, mutation.id)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'native-fs-binding.ts')
    writeFileSync(file, mutated, 'utf8')
    const mod = await import(`${pathToFileURL(file).href}?v=${Date.now()}-${mutation.id}`)
    const results = await runAllArms(mod)
    const red = results.filter((result) => !result.ok).map((result) => result.id)
    const expectedRed = [...mutation.expectedRed]
    const missing = expectedRed.filter((id) => !red.includes(id))
    const verdict = missing.length === 0 ? 'RED-AS-REQUIRED' : 'UNEXPECTED-GREEN'
    emit(
      `MUTATION-ARM id=${mutation.id} removed=${JSON.stringify(mutation.behaviour)}`
        + ` expected-red=${expectedRed.join(',')} observed-red=${red.length === 0 ? '-' : red.join(',')} verdict=${verdict}`,
    )
    for (const result of results) {
      emit(`MUTATION-ARM-DETAIL mutation=${mutation.id} arm=${result.id} observed=${result.ok ? 'green' : 'red'} detail=${result.detail}`)
    }
    if (missing.length > 0) failures.push(`${mutation.id}: arm(s) stayed green without the behaviour: ${missing.join(',')}`)
  }

  emit(`MUTATION-TRANSCRIPT-VERDICT ${failures.length === 0 ? 'GREEN' : 'RED'} mutations=${MUTATIONS.length} arms=${ARMS.length}`)
  for (const failure of failures) emit(`MUTATION-TRANSCRIPT-FAILURE ${failure}`)
  return { ok: failures.length === 0, lines, failures }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runMutationTranscript({ log: (line) => console.log(line) })
  process.exit(result.ok ? 0 : 1)
}
