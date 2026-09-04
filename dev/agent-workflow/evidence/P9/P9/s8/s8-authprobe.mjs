// Auth-state probe for the live S8 instance (state.json driven).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EV = dirname(fileURLToPath(import.meta.url))
const state = JSON.parse(readFileSync(join(EV, 'state.json'), 'utf8'))
const origin = state.origin

const r1 = await fetch(`${origin}/`)
console.log('noauth:', r1.status)

const u2 = new URL(`${origin}/`)
u2.searchParams.set('token', state.token)
const r2 = await fetch(u2.href, { redirect: 'manual' })
console.log('token-exchange:', r2.status,
  'location=', r2.headers.get('location'),
  'set-cookie=', (r2.headers.get('set-cookie') ?? '').slice(0, 45))

const r3 = await fetch(`${origin}/`, { headers: { cookie: state.cookie } })
const body = await r3.text()
console.log('cookie:', r3.status, 'len=', body.length)
