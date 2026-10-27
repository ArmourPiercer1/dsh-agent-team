/**
 * dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/backfill-bindings.mjs
 *
 * EB3-D (RUN manifest, strict --new mode) requires every record CHANGED by
 * this PR to bind `bindings.teamSha` (this tree at boot) and
 * `bindings.hostSha` (the asserted host-base HEAD). The boot-4/boot-5
 * runner wrote records through the shared lib but omitted those two
 * provenance fields (the u7-4a suite's binding shape has them; my runner
 * predated learning that). This script adds ONLY the two omitted provenance
 * fields plus this disclosure — no case, verdict, detail, overall, or
 * finishedAt byte is touched — and the runner is fixed so every FUTURE
 * boot fills them itself. The values are the boot-time truths:
 *
 *   teamSha  292558f70 — `git rev-parse HEAD` at both boots (07:22Z/07:32Z;
 *            the review-round fixes were in the working tree, committed
 *            minutes later as edefd724f, the gate-ledger commits after).
 *   hostSha  639ed01539… — the pinned host base HEAD the boots asserted
 *            through factory.assertHostBase (would have thrown otherwise),
 *            tests/paths.mjs TEST_USE_BASELINE_SHA.
 *
 * Run: node dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/backfill-bindings.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEAM_SHA = '292558f70'
const HOST_SHA = '639ed015397290b3745d163aafe02ffee4aa3f84'
const NOTE = 'Provenance backfilled by c2/backfill-bindings.mjs (see its header): bindings.teamSha/hostSha are the boot-time truths; no verdict, case, detail, overall, or finishedAt was altered. The team tree was additionally carrying the uncommitted review-round fixes (later edefd724f) at both boots, disclosed there.'
for (const f of ['c2-verdicts.json', join('boot4-record', 'c2-verdicts.json')]) {
  const p = join(HERE, f)
  const rec = JSON.parse(readFileSync(p, 'utf8'))
  const before = JSON.stringify({ cases: rec.cases, overall: rec.overall, finishedAt: rec.finishedAt })
  rec.bindings = { ...rec.bindings, teamSha: TEAM_SHA, hostSha: HOST_SHA, provenanceNote: NOTE }
  const after = JSON.stringify({ cases: rec.cases, overall: rec.overall, finishedAt: rec.finishedAt })
  if (before !== after) throw new Error(`${f}: verdict payload changed — refusing`)
  writeFileSync(p, JSON.stringify(rec, null, 2) + '\n')
  console.log(`backfilled ${f} (verdict payload byte-identical)`)
}
