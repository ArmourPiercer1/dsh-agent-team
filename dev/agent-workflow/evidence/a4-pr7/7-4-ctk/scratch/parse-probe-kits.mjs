// Throwaway (lane C-testkit §7.4): parse every emitted document with the
// tree's own strong parser and record its declared version; in the
// CURRENT world also run the probe rule (rewrite the declared version to
// 9 -> the parser MUST refuse: probe-RED proves the version is read,
// which is what licenses migrate-by-hand over delete-lie).
// V1_ANCHOR_SOURCE is the exception: historical evidence, expected to
// parse AT v1 and to derive exactly the pinned contentHash; never probed.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseBlueprint } from '../../../../../../packages/runtime/dist/packages/domain/blueprint/src/validate.js'

const world = process.argv[2]
const docs = JSON.parse(readFileSync(`dev/agent-workflow/evidence/a4-pr7/7-4-ctk/scratch/kit-docs/docs-${world}.json`, 'utf8'))
const PINNED_V1_HASH = 'sha256:6a7fba9ffce952639cf85b01714b1ca61a7d4816efe32607f3d7061da0c15a37'
let bad = 0
for (const [mod, map] of Object.entries(docs)) {
  if (map.error) { console.log(`${mod}: HARNESS-ERROR ${map.error.slice(0, 120)}`); bad++; continue }
  for (const [name, doc] of Object.entries(map)) {
    const anchor = name === 'V1_ANCHOR_SOURCE'
    let rec
    try {
      rec = parseBlueprint(doc)
    } catch (e) {
      console.log(`${mod} :: ${name}: PARSE-FAIL ${String(e?.code ?? e?.message ?? e).slice(0, 100)}`)
      bad++
      continue
    }
    const v = rec?.document?.schemaVersion ?? rec?.schemaVersion
    let line = `${mod} :: ${name}: v${v}`
    if (anchor) {
      const h = `sha256:${createHash('sha256').update(JSON.stringify(rec.document ?? rec)).digest('hex')}`
      // the contentHash is on the parsed record, not re-derivable from its
      // own JSON here; take the pipeline's value directly:
      const derived = rec.contentHash ?? rec.document?.contentHash
      line += ` anchor hash ${derived === PINNED_V1_HASH ? 'MATCHES pinned 6a7fba9f…' : `DERIVED ${String(derived)} != PINNED`}`
      if (derived !== PINNED_V1_HASH) bad++
    } else if (world === 'current') {
      let refused = false
      try { parseBlueprint(doc.replace(/schemaVersion: \d+/, 'schemaVersion: 9')) } catch { refused = true }
      line += `; probe(v9) refused=${refused}`
      if (!refused) bad++
    }
    console.log(line)
  }
}
console.log(bad === 0 ? `ALL-OK (${world})` : `PROBLEMS: ${bad} (${world})`)
process.exitCode = bad === 0 ? 0 : 1
