// Throwaway derivation (lane C-testkit, §7.4): re-derive the contentHash the
// host pipeline computes for the byte-exact V1_ANCHOR_SOURCE that pr-e/pr-f
// pin next to V1_ANCHOR_HASH_PRE_PR_E, using the tree's own parse pipeline
// (same dist entry the kits import at line 298 of pr-e). If the derived hash
// equals the pinned literal, the pair is coherent and my migration (which
// leaves this historical source untouched) keeps it coherent.
import { parseBlueprint } from '../../../../../../packages/runtime/dist/packages/domain/blueprint/src/validate.js'

const V1_ANCHOR_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.mpr-anchor',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the boot anchor leader of the model-preference-routing smoke row."',
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

const PINNED = 'sha256:6a7fba9ffce952639cf85b01714b1ca61a7d4816efe32607f3d7061da0c15a37'
const parsed = parseBlueprint(V1_ANCHOR_SOURCE)
console.log('source sha256 (raw bytes):', 'sha256:' + (await import('node:crypto')).createHash('sha256').update(V1_ANCHOR_SOURCE, 'utf8').digest('hex'))
console.log('parseBlueprint().contentHash:', parsed.contentHash)
console.log('pinned V1_ANCHOR_HASH_PRE_PR_E :', PINNED)
console.log('MATCH:', parsed.contentHash === PINNED)
