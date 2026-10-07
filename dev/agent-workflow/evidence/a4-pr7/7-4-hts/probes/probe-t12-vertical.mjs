// Evidence probe — packages/tools/harness/t12-vertical.mjs (§7.4 file 5/5).
//
// This harness builds ONE document per world through `blueprintDoc(world, bpId)`
// and hands each to the production row (`:282 blueprintSource: BLUEPRINTS[world].doc`).
// The probe brace-matches that function out of the file, evaluates it, and runs the
// PRODUCTION parser over all three worlds. No host, no port, no home.
//
// Also certified here, because the DEFERRALS note for this path claimed the file
// "also emits a v2 document" and it does not: the file's only other version digit
// is the PROJECTION axis inside the V5 assertion label (`sv === 2`, the
// TeamProjectionDto stamp, a separate frozen namespace the Blueprint cutover does
// not touch). `documents` below is the complete set of documents this harness
// embeds; `projectionSite` records what the other occurrence actually is.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { read, loadParser, callDocumentFunction, parserControls, identity } from './lib.mjs'

const REL = 'packages/tools/harness/t12-vertical.mjs'
const source = process.argv[2] !== undefined ? readFileSync(process.argv[2], 'utf8') : read(REL)
const bp = await loadParser()

const worlds = [['a', 't12v-bp-a'], ['b', 't12v-bp-b'], ['c', 't12v-bp-c']]
const documents = worlds.map(([world, bpId]) => {
  const { doc, slicedFrom } = callDocumentFunction(source, 'blueprintDoc', [world, bpId])
  const parsed = bp.parseBlueprint(doc)
  return {
    world,
    builtBy: REL + ` :: blueprintDoc('${world}', '${bpId}')`,
    slicedFrom,
    documentVersionLine: /^schemaVersion:.*$/m.exec(doc)[0],
    documentSha256: createHash('sha256').update(doc).digest('hex'),
    parsed: identity(parsed),
    parserControls: parserControls(bp, doc),
  }
})

// The second measured site, L1844 in the pre-migration file: what is it?
const projectionLines = source
  .split('\n')
  .map((text, i) => ({ text, line: i + 1 }))
  .filter(({ text }) => /schemaVersion/.test(text) && !/^\s*'schemaVersion: \d',\s*$/.test(text))

console.log(JSON.stringify({
  file: REL,
  documentCount: documents.length,
  consumedAt: REL + ' :: blueprintSource: BLUEPRINTS[world].doc (row config, :282)',
  documents,
  nonDocumentVersionLines: projectionLines,
}, null, 2))
