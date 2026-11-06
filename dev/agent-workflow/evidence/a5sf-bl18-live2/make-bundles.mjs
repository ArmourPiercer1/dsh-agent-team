#!/usr/bin/env node
/**
 * make-bundles.mjs — (re)write `preflight-bundle.json` bound to the CURRENT
 * HEAD and the MEASURED authority pointer.
 *
 * Why a separate entry point: the run's grant is bound to the commit the Host
 * executes on. Any commit made after `--plan` (the driver's own commit, an
 * evidence commit) moves HEAD, and a bundle naming the old commit is a foreign
 * grant the read gate refuses. This re-emits the bundle from the SAME builder
 * the driver uses, with no World and no host start.
 *
 * @module dev/agent-workflow/evidence/a5sf-bl18-live2/make-bundles
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveHeadCommit } from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import { ROW_IDS, buildPreflightBundle } from './run-boot.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')

const head = resolveHeadCommit(REPO_ROOT)
if (head === null) throw new Error('git rev-parse HEAD failed')
const bundle = buildPreflightBundle({ head, rowIds: [...ROW_IDS] })
writeFileSync(join(HERE, 'preflight-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`)
// eslint-disable-next-line no-console
console.log(`preflight-bundle.json head=${head} pointerSha256=${bundle.authority.pointerSha256} cases=${bundle.cases.map((c) => c.id).join(',')}`)
