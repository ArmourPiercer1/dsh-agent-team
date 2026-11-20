#!/usr/bin/env node
/**
 * probe-semantic-differences.mjs — measure (not assert) what the governed row
 * and the product route select differently for the SAME `grep` call.
 *
 * The governed argv comes from the governed lane's OWN exported builder
 * (`searchArgv`, packages/tools/search-family/src/search-backend.mjs); the
 * route-C argv is the argv the confined provider actually RECEIVED. Both are
 * executed against one fixture, and their selected sets are compared.
 *
 * Evidence: dev/agent-workflow/evidence/ute3-search-b1-20261120/semantic-differences.txt
 *
 * @module tests/ute-g1-search/probe-semantic-differences
 */
import { measureArgvDifferences, SEMANTIC_DIFFERENCES, semanticDifferenceLines } from './lib/semantic-differences.mjs'

const measured = await measureArgvDifferences()

console.log(`SD-ROUTE-C argv=${JSON.stringify(measured.routeC.argv.map((token, index) => (index === 0 ? '<rg>' : token)))}`)
console.log(`SD-ROUTE-C selected=${JSON.stringify(measured.routeC.selected)}`)
console.log(`SD-GOVERNED additions=${JSON.stringify(measured.governed.additions)}`)
console.log(`SD-GOVERNED argv=${JSON.stringify(measured.governed.argv.map((token, index) => (index === 0 ? '<rg>' : token)))}`)
console.log(`SD-GOVERNED selected=${JSON.stringify(measured.governed.selected)}`)
const onlyRouteC = measured.routeC.selected.filter((key) => !measured.governed.selected.includes(key))
const onlyGoverned = measured.governed.selected.filter((key) => !measured.routeC.selected.includes(key))
console.log(`SD-IGNORE only-route-c=${JSON.stringify(onlyRouteC)} only-governed=${JSON.stringify(onlyGoverned)}`)
console.log(`SD-PATHLESS route-c matches=${String(measured.pathless.routeC.matches)} argv=${JSON.stringify(measured.pathless.routeC.argv?.map((token, index) => (index === 0 ? '<rg>' : token)) ?? [])}`)
console.log(`SD-PATHLESS governed matches=${measured.pathless.governed.selected.length} selected=${JSON.stringify(measured.pathless.governed.selected)}`)
for (const line of semanticDifferenceLines()) console.log(line)
console.log(`SD-TOTAL declared=${SEMANTIC_DIFFERENCES.length} blocking=${SEMANTIC_DIFFERENCES.filter((difference) => difference.blocking).length} approved=${SEMANTIC_DIFFERENCES.filter((difference) => difference.approval !== null).length}`)
