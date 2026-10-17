#!/usr/bin/env node
/**
 * review-PC-build-liveprobe.mjs — reviewer instrument builder (P-C round).
 *
 * Produces `review-PC-liveprobe.mjs`: a copy of the reviewed W7 kit with ONLY
 * mechanical edits —
 *   (1) the three relative import specifiers rewritten to absolute (the copy
 *       lives in the evidence directory; the modules it loads are unchanged);
 *   (2) KIT_DIR / REPO_ROOT pinned to the reviewed worktree, so the copy boots
 *       THE SAME rows the kit boots: the production dist of ce44fd4e, the
 *       reviewed a5w7 row, the pinned host;
 *   (3) the leg region (W3..W7b) replaced by the reviewer's own legs PC1..PC4
 *       (verbatim text in `pc-legs-block.txt`), which measure what the kit
 *       does not book: the LIVE `owner-not-durable` veto with a state-delta-0
 *       reading over the row's own state face, the LIVE admit-edge reader pin
 *       with its unregistered/withdrawn negative controls, and the LIVE
 *       assembly-owned window driven to RELEASED with the reviewer's tokens.
 * Everything else runs as reviewed: W0a/W0b, the W1 assembly legs, the W2
 * durable-member legs, W8 anchor, W9 wording, W10 discipline.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc'
const HERE = join(ROOT, 'dev/agent-workflow/evidence/alpha5/prod')
const KIT = join(ROOT, 'tests/kits/a5-w7-jobs-wiring/a5w7-kit.mjs')
const OUT = join(HERE, 'review-PC-liveprobe.mjs')

let text = readFileSync(KIT, 'utf8')
text = text
  .replace("'../../../packages/tools/harness/mock-deepseek.mjs'", JSON.stringify(join(ROOT, 'packages/tools/harness/mock-deepseek.mjs')))
  .replace("'../../kits/_shared/preset-seam.mjs'", JSON.stringify(join(ROOT, 'tests/kits/_shared/preset-seam.mjs')))
  .replace("'../../paths.mjs'", JSON.stringify(join(ROOT, 'tests/paths.mjs')))
  .replace('const KIT_DIR = dirname(new URL(import.meta.url).pathname)', 'const KIT_DIR = ' + JSON.stringify(join(ROOT, 'tests/kits/a5-w7-jobs-wiring')))
  .replace("const REPO_ROOT = resolve(KIT_DIR, '..', '..', '..')", 'const REPO_ROOT = ' + JSON.stringify(ROOT))
  .replace('const RUN_STAMP = new Date().toISOString()', 'const RUN_STAMP = process.env.PC_STAMP || new Date().toISOString()')
  // The reviewed W8 leg read its roster off the W7 leg's final state fetch;
  // with that leg replaced, W8 takes its own fetch (same route, same moment).
  .replace('    const roster = stateEnd.body?.roster ?? []', '    const stateEnd = await fetchJson(origin + \'/__a5w7/state\', undefined, 30_000)\n    const roster = stateEnd.body?.roster ?? []')

const lines = text.split('\n')
const from = lines.findIndex((l) => l.includes('── W3 identity leg'))
const to = lines.findIndex((l) => l.includes('── W8 anchor, live + post'))
if (from < 0 || to < 0 || to <= from) throw new Error('leg region not found: ' + String(from) + '/' + String(to))
const block = readFileSync(join(HERE, 'pc-legs-block.txt'), 'utf8').replace(/\n$/, '').split('\n')
writeFileSync(OUT, lines.slice(0, from).concat(block, lines.slice(to)).join('\n'))
console.log('built ' + OUT + ' :: replaced leg lines ' + String(from + 1) + '-' + String(to) + ' with PC1..PC4')
