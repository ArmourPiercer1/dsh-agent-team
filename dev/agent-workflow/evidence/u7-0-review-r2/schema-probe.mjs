// Reviewer probe: does the closed schema checker actually reject? (no test in the PR plants this)
import { readFileSync } from 'node:fs'
import { validateAgainstSchema } from '../../../../packages/testkit/census/schema-check.mjs'
const j = (p) => JSON.parse(readFileSync(p, 'utf8'))
const exp = j('dev/engineering/tool-obligations/expected-tool-obligations.v1.json')
const es = j('dev/engineering/tool-obligations/expected-tool-obligations.schema.json')
const inv = j('packages/testkit/census/fixtures/synthetic-non-team.inventory.json')
const is = j('packages/testkit/census/observed-runtime-inventory.schema.json')
const r = {}
r.clean_expected = validateAgainstSchema(exp, es).ok
const e1 = structuredClone(exp); e1.obligations[0].obligation = 'AUTHORIZED'; r.expected_bad_enum_rejected = !validateAgainstSchema(e1, es).ok
const e2 = structuredClone(exp); e2.obligations[0].extra = 1; r.expected_extra_key_rejected = !validateAgainstSchema(e2, es).ok
const e3 = structuredClone(exp); delete e3.obligations[0].name; r.expected_missing_required_rejected = !validateAgainstSchema(e3, es).ok
const i1 = structuredClone(inv); i1.scopes[0].tools[0].authorized = true; r.inventory_authorized_field_rejected = !validateAgainstSchema(i1, is).ok
const i2 = structuredClone(inv); i2.world.host_sha = 'abc'; r.inventory_bad_sha_rejected = !validateAgainstSchema(i2, is).ok
console.log(JSON.stringify(r, null, 1))
