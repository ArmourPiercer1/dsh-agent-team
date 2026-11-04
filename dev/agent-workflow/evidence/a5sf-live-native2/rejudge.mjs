#!/usr/bin/env node
/**
 * rejudge.mjs — re-dispose the RUN RECORD of the 2026-11-03T13:02:54Z boot with
 * the honest verdict vocabulary, WITHOUT editing the machine record.
 *
 * WHY: `run-record.mjs` maps any abort to `FAIL` (its conservative default:
 * "the runner could not finish" must never read as PASS). This boot never
 * reached the DRIVE at all — the Host process exited before its boot marker
 * ("process exited (code=1 signal=none)"), so no Member existed, no model turn
 * happened and no tool call was issued. The record's own vocabulary defines
 * `NOT_REACHED` as "the DRIVE never arrived at the asserted step", which is the
 * exact case. This file writes the re-disposition to `rejudged.json` and leaves
 * `run-record.json` byte-identical, so both the machine record and the honest
 * reading are on disk.
 *
 * It performs NO boot, NO ledger row and NO spawn.
 *
 * @module dev/agent-workflow/evidence/a5sf-live-native2/rejudge
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const record = JSON.parse(readFileSync(join(HERE, 'run-record.json'), 'utf8'))

/** The failure condition each case would have needed a live drive for. */
const REASONS = {
  'live:member-activated-surface-one-read': 'no Host reached its boot marker: the process exited (code=1) at Loader compose, so no Member was ever admitted and no model-visible surface could be read',
  'live:native-read-outside-refused': 'no Member existed and no model turn ran: no native `read` call was issued, so neither a refusal nor its text could be observed',
  'live:sink-exactly-one-deny-fact': 'the sink file is written by the Guard at consultation time; no consultation happened (the Host never got past compose), so an absent sink is NOT a "zero facts" observation',
  'live:native-read-inside-allowed': 'no model turn ran; no inside-ceiling read was issued or served',
  'live:base-read-counter-did-not-move': 'the counter installs at plugin apply time and records per read; the Host never applied the rows, so no counter rows exist (again: absent ≠ "zero movement" as a product claim)',
  'live:teardown-no-shadow': 'there was no live Member to archive and no subsequent read; the seam enumeration in the driver was never reached',
  'live:deny-native-surface-refusal': 'no Member setup ran, so neither the surface-neutrality refusal nor the unscoped-ctx TypeError could be observed',
}

const cases = (record.cases ?? []).map((entry) => {
  const reason = REASONS[entry.id]
  return {
    id: entry.id,
    machineVerdict: entry.verdict,
    verdict: reason === undefined ? entry.verdict : 'NOT_REACHED',
    reason: reason ?? 'not part of this run',
    machineDetail: entry.detail ?? null,
  }
})

const rejudged = {
  runId: record.runId,
  machineRecord: 'run-record.json (untouched)',
  dispositionRule: 'a case that needed a live drive the Host never reached is NOT_REACHED, never FAIL (FAIL would claim the product was exercised and refused)',
  overall: 'NOT_REACHED',
  cases,
  note: 'all seven cases are NOT_REACHED for the SAME precondition: no Host reached its boot marker. The one finding of this boot is the composition failure quoted in README.md §3.',
}
writeFileSync(join(HERE, 'rejudged.json'), JSON.stringify(rejudged, null, 2) + '\n')
process.stdout.write(`rejudged overall=NOT_REACHED cases=${String(cases.length)} -> rejudged.json\n`)
