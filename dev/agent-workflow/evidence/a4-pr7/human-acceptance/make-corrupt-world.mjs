#!/usr/bin/env node
/**
 * make-corrupt-world.mjs — build (once, idempotently) a REAL durable world that
 * carries exactly one corrupt approval record, so the Alpha.4 human acceptance
 * (§7.7) can SEE the corrupt-record warning bar instead of imagining it.
 *
 * WHAT IT DOES, in order:
 *   1. COPY the existing acceptance world
 *      `tests/homes/a4-accept-20261007T16-57-26Z` (its README.md/boot.mjs say
 *      DSH_HOME = that directory, port 3180 family) into a NEW world under
 *      `tests/homes/` — default `tests/homes/a4-w5-corrupt-acceptance`.
 *      The source is read, never written.
 *   2. With the app NOT running, append EXACTLY ONE `control-request-recorded`
 *      row the strict reader refuses and that discloses no member, through the
 *      repository's own write API (world-seam.mjs explains why that IS the
 *      production write path; `damagedControlRow()` carries the measured shape).
 *
 * IT REFUSES, loudly, to:
 *   - write anywhere outside `<repo>/tests/homes/<world>`;
 *   - run against a world whose host is still listening (a running host holds
 *     the whole unit in memory, and its next write would drop the appended row);
 *   - adopt a pre-existing destination it did not create (marker check);
 *   - write anything at all while `--dry-run` is set.
 *
 * IDEMPOTENCE: the damaged row carries
 * `requestId = req-a4w5-human-acceptance-damage`. A second run that finds that
 * row writes NOTHING and reports the sequence it is on.
 *
 * Usage:
 *   node make-corrupt-world.mjs [--dry-run] [--adopt] [--copy-only]
 *        [--repo <dir>]            default: the checkout this file is in
 *        [--source-world <dir>]    default: tests/homes/a4-accept-20261007T16-57-26Z
 *        [--world <dir>]           default: tests/homes/a4-w5-corrupt-acceptance
 *        [--root <rootSessionId>]  default: the world's single team_sessions row
 *
 * `--copy-only` stops after the copy, so the BEFORE reading of the SAME world
 * can be taken (`verify-corrupt-world.mjs --expect-count 0`) before anything is
 * appended. `--dry-run` writes nothing anywhere.
 *
 * Exit codes: 0 done (created / already present / dry-run), 1 refused.
 *
 * @module dev/agent-workflow/evidence/a4-pr7/human-acceptance/make-corrupt-world
 */

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  COPY_EXCLUDES,
  DAMAGE_REQUEST_ID,
  DEFAULT_WORLD_NAME,
  LEDGER_REL_PATH,
  REPO_ROOT,
  SOURCE_WORLD_NAME,
  WORLD_MARKER,
  damagedControlRow,
  fail,
  findDamagedRowSequence,
  loadBuilt,
  openWorld,
  parseArgs,
  refuseRunningHost,
  resolveWorld,
} from './world-seam.mjs'

const { flags, opts } = parseArgs(process.argv.slice(2))
const DRY_RUN = flags.has('dry-run')
const REPO = resolve(opts.get('repo') ?? REPO_ROOT)
const SOURCE = resolveWorld(REPO, opts.get('source-world'), SOURCE_WORLD_NAME, '--source-world')
const DEST = resolveWorld(REPO, opts.get('world'), DEFAULT_WORLD_NAME, '--world')
const LEDGER_FILE = join(DEST, LEDGER_REL_PATH)
const MARKER_PATH = join(DEST, WORLD_MARKER)

const say = (line) => process.stdout.write(`${line}\n`)

/** Every write of this script goes through here, so "outside the world" is impossible. */
function writeInsideWorld(absolutePath, text, what) {
  const rel = relative(DEST, absolutePath)
  if (rel === '' || rel.startsWith('..') || resolve(absolutePath) === resolve(DEST)) {
    fail(`refusing to write ${what} at ${absolutePath}: not strictly inside ${DEST}.`)
  }
  writeFileSync(absolutePath, text)
}

if (DEST === SOURCE) fail(`--world and --source-world are the same directory (${DEST}).`)
if (!relative(SOURCE, DEST).startsWith('..')) {
  fail(`--world ${DEST} is inside the source world ${SOURCE}; the copy would nest and then be written.`)
}
if (!relative(DEST, SOURCE).startsWith('..')) {
  fail(`--source-world ${SOURCE} is inside --world ${DEST}; the copy would nest the source.`)
}

// ── 1. the source world must be a real, stopped world ───────────────────────
if (!existsSync(join(SOURCE, LEDGER_REL_PATH))) {
  fail(
    `source world ${SOURCE} has no durable TeamDomain (${LEDGER_REL_PATH}).\n` +
    `           Create it once: cd dev/agent-workflow/evidence/a4-pr76-acceptance-world && node boot.mjs --detach && node boot.mjs --stop`,
  )
}
await refuseRunningHost('the source world', SOURCE)
await refuseRunningHost('the destination world', DEST)

// ── 2. the built production tree must exist (the write path IS that code) ───
await loadBuilt(REPO, 'packages/runtime/root-binding/harness/seam.mjs')
await loadBuilt(REPO, 'packages/runtime/dist/packages/storage/repositories/team-domain.js')

// ── 3. copy (or adopt) the world ────────────────────────────────────────────
const destExists = existsSync(LEDGER_FILE)
if (!destExists) {
  if (existsSync(DEST) && readdirSync(DEST).length > 0 && !existsSync(MARKER_PATH)) {
    fail(
      `destination ${DEST} already exists and is not a world this tool created ` +
      `(no ${WORLD_MARKER}). Pick another --world name, or remove that directory yourself.`,
    )
  }
  if (DRY_RUN) {
    say(`[dry-run] would COPY  ${SOURCE}`)
    say(`[dry-run]        ->   ${DEST}`)
    say(`[dry-run]      skipping (per-boot state of the source instance): ${COPY_EXCLUDES.join(', ')}`)
  } else {
    mkdirSync(DEST, { recursive: true })
    const excluded = new Set(COPY_EXCLUDES.map((rel) => join(SOURCE, rel)))
    cpSync(SOURCE, DEST, { recursive: true, filter: (src) => !excluded.has(src) })
    say(`copied world   : ${SOURCE}`)
    say(`            -> ${DEST}`)
    say(`skipped        : ${COPY_EXCLUDES.join(', ')}`)
  }
} else if (!existsSync(MARKER_PATH) && !flags.has('adopt')) {
  fail(
    `destination ${DEST} is already a booted world but was not created by this tool ` +
    `(no ${WORLD_MARKER}). Pass --adopt only if you are sure it is yours to corrupt.`,
  )
} else {
  say(`world already present (copy skipped): ${DEST}`)
}

const row = damagedControlRow()

/** Record what this tool did to the world (ownership + cross-checkable facts). */
function writeMarker(fields) {
  writeInsideWorld(MARKER_PATH, `${JSON.stringify({
    tool: 'dev/agent-workflow/evidence/a4-pr7/human-acceptance/make-corrupt-world.mjs',
    at: new Date().toISOString(),
    sourceWorld: SOURCE,
    world: DEST,
    damagedRequestId: DAMAGE_REQUEST_ID,
    ledgerFile: LEDGER_FILE,
    ...fields,
  }, null, 2)}\n`, 'the world marker')
}

if (DRY_RUN && !destExists) {
  say('')
  say('[dry-run] nothing opened, nothing written (the world does not exist yet).')
  say('[dry-run] after the copy it would append ONE control-request-recorded row:')
  say('[dry-run]   rootSessionId: the world\'s single team_sessions row')
  say(`[dry-run]   payload      : ${JSON.stringify(row)}`)
  say(`[dry-run]   ledger file  : ${LEDGER_FILE}`)
  say('[dry-run] then: node verify-corrupt-world.mjs')
  process.exit(0)
}

// ── 4. append through the repository's own write API ────────────────────────
if (!destExists && !DRY_RUN) {
  // The copy step owns the world from now on; record it before any injection.
  writeMarker({ created: 'copy', rootSessionId: null, damagedSequence: null })
}
if (flags.has('copy-only')) {
  say('')
  say(`--copy-only    : the copy is in place and NOTHING WAS APPENDED (ledger untouched).`)
  say(`WORLD        : ${DEST}`)
  say(`LEDGER FILE  : ${LEDGER_FILE}`)
  say('next: node verify-corrupt-world.mjs --expect-count 0   (the BEFORE reading)')
  say('then: node make-corrupt-world.mjs                      (appends exactly one row)')
  process.exit(0)
}

const opened = await openWorld(REPO, DEST)
try {
  const repositories = opened.domain.repositories
  const sessions = repositories.teamSessions.list()
  let root = opts.get('root')
  if (root === undefined) {
    if (sessions.length !== 1) {
      fail(
        `this recipe corrupts ONE Team's ledger and found ${sessions.length} team_sessions rows in ${DEST}. ` +
        `Pass --root <rootSessionId> to pick one.`,
      )
    }
    root = String(sessions[0]?.['rootSessionId'] ?? '')
    if (root === '') fail(`the single team_sessions row of ${DEST} carries no rootSessionId.`)
  }

  const entries = repositories.ledger.list()
  const existing = findDamagedRowSequence(entries)

  if (existing !== undefined) {
    say(`already injected : the damaged row is durable at sequence ${existing} — NOTHING WRITTEN (idempotent).`)
  } else if (DRY_RUN) {
    say('')
    say('[dry-run] would append ONE control-request-recorded row:')
    say(`[dry-run]   world        : ${DEST}`)
    say(`[dry-run]   ledger file  : ${LEDGER_FILE}`)
    say(`[dry-run]   rootSessionId: ${root}`)
    say(`[dry-run]   payload      : ${JSON.stringify(row)}`)
    say('[dry-run]   why refused  : actionName/correlation empty, toolName/operationFingerprint wrong type,')
    say('[dry-run]                  subject unreadable, targetInstanceId empty => the strict reader refuses the')
    say('[dry-run]                  row, and no compared member is disclosed (disclosesMember: false).')
  } else {
    const sequence = await repositories.ledger.allocateSequence()
    await repositories.ledger.put({
      schemaVersion: 2,
      sequence,
      rootSessionId: root,
      factType: 'control-request-recorded',
      payload: row,
      createdAt: new Date().toISOString(),
    })
    const totalAfter = repositories.ledger.list().length
    say(`appended row     : sequence ${sequence} (factType control-request-recorded)`)
    say(`ledger rows      : ${entries.length} -> ${totalAfter}`)
    writeMarker({ created: destExists ? 'adopted' : 'copy+inject', rootSessionId: root, damagedSequence: sequence })
  }

  if (!DRY_RUN && !existsSync(MARKER_PATH)) {
    // Reached on the --adopt path when no row was written (already injected,
    // or a dry-run of a world that already had it).
    writeMarker({ adopted: true, rootSessionId: root, damagedSequence: existing ?? null })
  }

  say('')
  say(`WORLD        : ${DEST}`)
  say(`LEDGER FILE  : ${LEDGER_FILE}`)
  say(`TEAM (root)  : ${root}`)
  if (!DRY_RUN) {
    say('')
    say('next: node verify-corrupt-world.mjs    (production read plane, no GUI, no server)')
    say('then: RECIPE.md step "boot it" points boot.mjs --world at this directory.')
  }
} finally {
  await opened.close()
}
