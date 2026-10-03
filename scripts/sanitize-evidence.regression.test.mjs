/** Synthetic filesystem regressions: no host, private logs, or dependencies.
 * SANITIZE_EVIDENCE_TOOL runs the same assertions against the baseline for RED.
 * Dropping alias preflight, quote handling, or format coverage breaks these tests.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { after, test } from 'node:test'
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const tool = process.env.SANITIZE_EVIDENCE_TOOL ?? fileURLToPath(new URL('./sanitize-evidence.mjs', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'rc2-sanitizer-regression-'))
const secret = 'SyntheticCredential1234567890'
const payload = `dsh web: http://127.0.0.1:3492/?token=${secret}\n`
let sequence = 0
const run = (args) => spawnSync(process.execPath, [tool, ...args], { cwd: scratch, encoding: 'utf8', timeout: 15_000 })
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
function fixture(filename = 'host.log', content = payload) {
  const base = join(scratch, String(++sequence))
  const raw = join(base, 'raw'), to = join(base, 'to'), store = join(base, 'store')
  for (const p of [raw, to, store]) mkdirSync(p, { recursive: true })
  const file = join(raw, filename)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
  return { raw, to, store, file, filename, content }
}
after(() => rmSync(scratch, { recursive: true, force: true }))
for (const alias of ['symlink', 'hardlink']) {
  for (const role of ['destination', 'default-manifest', 'explicit-manifest', 'store']) {
    test(`refuses ${role} ${alias} before altering raw or another destination`, () => {
      const f = fixture(), before = hash(f.file)
      const target = role === 'destination' ? join(f.to, f.filename) : role === 'store' ? join(f.store, f.filename) : join(f.to, 'SANITIZATION.json')
      ;(alias === 'symlink' ? symlinkSync : linkSync)(f.file, target)
      const args = ['--from', f.raw, '--to', f.to, '--force']
      if (role === 'store') args.push('--store', f.store)
      if (role === 'explicit-manifest') args.push('--manifest', target)
      const result = run(args)
      assert.equal(hash(f.file), before, 'raw file must remain byte-identical')
      assert.equal(result.status, 2, 'unsafe aliases must fail before writing')
      if (role !== 'destination') assert.equal(existsSync(join(f.to, f.filename)), false, 'preflight must precede every output write')
    })
  }
}
for (const role of ['destination', 'store']) {
  test(`refuses a nested ${role} directory symlink before writing`, () => {
    const f = fixture('nested/host.log'), root = role === 'destination' ? f.to : f.store
    symlinkSync(join(f.raw, 'nested'), join(root, 'nested'), 'dir')
    const before = hash(f.file)
    const result = run(['--from', f.raw, '--to', f.to, '--store', f.store, '--force'])
    assert.equal(hash(f.file), before)
    assert.equal(result.status, 2)
  })
}
for (const kind of ['file', 'directory']) {
  test(`refuses source ${kind} symlinks before writes`, () => {
    const f = fixture(), external = join(dirname(f.raw), 'external')
    mkdirSync(external)
    writeFileSync(join(external, 'outside.log'), payload)
    symlinkSync(kind === 'file' ? join(external, 'outside.log') : external, join(f.raw, 'alias'), kind === 'file' ? 'file' : 'dir')
    const result = run(['--from', f.raw, '--to', f.to])
    assert.equal(result.status, 2)
    assert.equal(existsSync(join(f.to, 'host.log')), false)
    assert.equal(readFileSync(join(external, 'outside.log'), 'utf8'), payload)
  })
}
test('rejects a manifest path that collides with a captured file', () => {
  const f = fixture()
  const result = run(['--from', f.raw, '--to', f.to, '--manifest', join(f.to, f.filename)])
  assert.equal(result.status, 2)
  assert.equal(existsSync(join(f.to, f.filename)), false)
})
const structured = [
  ['double-quoted YAML', 'capture.yaml', `x-api-key: "${secret}"\n`],
  ['single-quoted YAML', 'capture.yml', `x-api-key: '${secret}'\n`],
  ['escaped double-quoted YAML', 'capture.yaml', `password: "prefix\\\"${secret}"\n`],
  ['escaped single-quoted YAML', 'capture.yml', `secret: 'prefix''${secret}'\n`],
  ['YAML list entry', 'capture.yaml', `- token: '${secret}'\n`],
  ['escaped JSON', 'capture.json', JSON.stringify({ token: `prefix"${secret}`, note: 'keep me' })],
  ['pretty JSON', 'capture.json', JSON.stringify({ token: secret, note: 'keep me' }, null, 2)],
  ['JSONL', 'capture.jsonl', JSON.stringify({ token: secret }) + '\n'],
  ['NDJSON', 'capture.ndjson', JSON.stringify({ token: secret }) + '\n'],
  ['extensionless', 'wire-capture', JSON.stringify({ token: secret }) + '\n'],
]
for (const [label, filename, content] of structured) {
  test(`redacts ${label}, verifies dirty input and clean output, preserves raw`, () => {
    const f = fixture(filename, content)
    assert.equal(run(['--verify', f.raw]).status, 1, 'verification must detect the unsanitized sentinel')
    assert.equal(run(['--from', f.raw, '--to', f.to]).status, 0)
    const output = readFileSync(join(f.to, filename), 'utf8')
    assert.equal(output.includes(secret), false, 'credential must not survive sanitization')
    assert.equal(readFileSync(f.file, 'utf8'), content)
    assert.equal(run(['--verify', f.to]).status, 0)
    if (filename.endsWith('.json')) {
      const parsed = JSON.parse(output)
      assert.equal(parsed.token, '<REDACTED>')
      assert.equal(parsed.note, 'keep me')
    }
  })
}
test('does not bless an unredacted value merely containing the marker word', () => {
  const f = fixture('capture.json', JSON.stringify({ token: `prefixREDACTED${secret}` }))
  assert.equal(run(['--verify', f.raw]).status, 1)
})
test('forced replacement preserves raw and backup hashes, including extensionless', () => {
  const f = fixture('wire-capture', JSON.stringify({ token: secret }) + '\n')
  writeFileSync(join(f.to, f.filename), 'old output')
  const before = hash(f.file)
  assert.equal(run(['--from', f.raw, '--to', f.to, '--store', f.store, '--force']).status, 0)
  const manifest = JSON.parse(readFileSync(join(f.to, 'SANITIZATION.json'), 'utf8'))
  assert.equal(hash(f.file), before)
  assert.equal(hash(join(f.store, f.filename)), before)
  assert.equal(manifest.rawBytesUnchanged, true)
  assert.equal(manifest.files[0].sha256Raw, before)
  assert.equal(manifest.files[0].sha256Sanitized, hash(join(f.to, f.filename)))
  assert.equal(run(['--verify', f.to]).status, 0)
})
