#!/usr/bin/env node
/**
 * probe-semantic-differences.mjs — measure and PRINT the differences between the
 * legacy governed WEB family and the product route-C composition. The lane suite
 * asserts the same measurements; this script exists so the evidence file is a
 * measurement an operator can read, not a table in a test.
 *
 * Evidence: dev/agent-workflow/evidence/ute3-web-b1-20261120/semantic-differences.txt
 *
 * @module tests/ute-g1-web/probe-semantic-differences
 */
import { measureAll } from './lib/semantic-differences.mjs'

const differences = await measureAll()
for (const difference of differences) {
  console.log(`SD id=${difference.id} blocking=${String(difference.blocking)} approval=${difference.approval === null ? 'null(none-found)' : 'PRESENT(!!)'}`)
  console.log(`SD id=${difference.id} title=${JSON.stringify(difference.title)}`)
  console.log(`SD id=${difference.id} legacy=${JSON.stringify(difference.legacy)}`)
  console.log(`SD id=${difference.id} route-c=${JSON.stringify(difference.routeC)}`)
  console.log(`SD id=${difference.id} impact=${JSON.stringify(difference.impact)}`)
}
console.log(`SD-VERDICT differences=${differences.length} blocking=${differences.filter((difference) => difference.blocking).length} approved=0 resolved=0`)
