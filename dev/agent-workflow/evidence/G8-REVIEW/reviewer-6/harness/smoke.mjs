// Smoke: prove the ts-loader hook chain resolves the remote package
// closure from the driver side (same imports run.mjs performs at top level).
import { register } from 'node:module'
register(new URL('./ts-loader.mjs', import.meta.url), import.meta.url)

const remoteMod = await import('../../../../../../packages/remote/src/index.js')
const clientMod = await import('../../../../../../packages/remote/test/p8t4-test-client.js')

console.log('remote-index exports (' + Object.keys(remoteMod).length + '):',
  Object.keys(remoteMod).join(', '))
console.log('PushTransportLossError name:',
  new remoteMod.PushTransportLossError('x').name)
console.log('p8t4-test-client exports:', Object.keys(clientMod).join(', '))
console.log('SMOKE-OK')
