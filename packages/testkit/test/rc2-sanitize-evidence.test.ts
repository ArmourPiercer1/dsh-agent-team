/**
 * rc2-sanitize-evidence.test.ts — the evidence sanitizer's path separation and
 * credential coverage, on synthetic trees only.
 *
 * THE DEFECT (independent review of PR #62, 2026-10-03). The first version of
 * `scripts/sanitize-evidence.mjs` had NO path separation:
 *   - `--from X --to X`, a `--to` that reached `--from` through a symlink alias,
 *     and a bare no-argument invocation all exited 0 — and the same-tree run
 *     REWROTE THE RAW EVIDENCE in place, destroying the byte-identical originals
 *     the review process depends on;
 *   - `--store` (the "keep a raw copy" directory) inside `--to` copied raw
 *     secrets back INTO the sanitized output while the manifest still claimed
 *     the files had been replaced;
 *   - the pattern set missed a YAML `x-api-key:` value and a JSON `"token"`
 *     field, so `--verify` reported a clean tree that was not clean.
 *
 * The tool now refuses overlapping trees after realpath resolution, requires
 * `--force` for a non-empty `--to`, snapshots the raw SHA-256 BEFORE rewriting
 * and re-verifies it AFTER (any raw change = exit 1, no manifest), and `--verify`
 * exits non-zero on any credential-shaped hit. These tests are the regression:
 * synthetic fixtures only, scratch under `tests/homes/` (gitignored, inside the
 * workspace), subprocesses so the real exit codes are what we assert.
 *
 * RUNNER CONSTRAINTS: synchronous bodies (`spawnSync`), shim-safe matchers.
 *
 * @module @dsh-agent-team/testkit/test/rc2-sanitize-evidence
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')
const TOOL = join(REPO, 'scripts/sanitize-evidence.mjs')
const RUN_ID = `${Date.now()}-${process.pid}`
const SCRATCH = join(REPO, 'tests/homes', `rc2-sanitize-${RUN_ID}`)

/** A secret that is not lowercase hex (so a git SHA can never look like one). */
const SECRET = 'sk-Live-9fK3xQz7VbN2mT8rWs4Yd'
const SECRET_B = 'Bearer-Live-A7Qm2XzRt9Kd4Vn6Pb8Wy'

const run = (args: string[]) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', timeout: 60_000 })
const out = (r: { stdout: string; stderr: string }) => `${r.stdout}${r.stderr}`
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

/** One raw tree: a log, a YAML with an api-key, JSON with token/authorization. */
function makeRaw(name: string): { raw: string; files: Record<string, string> } {
  const raw = join(SCRATCH, name, 'raw')
  mkdirSync(join(raw, 'logs'), { recursive: true })
  const files: Record<string, string> = {
    'logs/boot.log': [
      `boot url http://127.0.0.1:3492/?token=${SECRET}`,
      `authorization: Bearer ${SECRET_B}`,
      `cookie: dsh_session=${SECRET}; Path=/`,
      `reading ${join(REPO, 'packages', 'tools', 'src', 'tools.ts')}`,
      'plain line, nothing secret here',
    ].join('\n'),
    'logs/config.yaml': [`provider:`, `  x-api-key: ${SECRET}`, `  model: rc2-smoke-model`].join('\n'),
    'logs/envelope.json': JSON.stringify({ headers: { authorization: `Bearer ${SECRET_B}`, token: SECRET }, note: 'keep me' }, null, 2),
    'notes.txt': 'no credentials in this one\n',
  }
  for (const [rel, text] of Object.entries(files)) writeFileSync(join(raw, rel), text)
  return { raw, files }
}

function treeShas(root: string): Record<string, string> {
  const walk = (dir: string, acc: Record<string, string> = {}) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) walk(p, acc)
      else acc[p.slice(root.length + 1)] = sha(p)
    }
    return acc
  }
  return walk(root)
}

beforeAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true })
  mkdirSync(SCRATCH, { recursive: true })
})

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true })
})

describe('evidence sanitizer — path separation', () => {
  it('S1 a bare invocation is a usage error, not a rewrite', () => {
    const r = run([])
    expect(r.status).toBe(2)
    expect(out(r)).toContain('usage')
  })

  it('S2 --verify without a directory is a usage error too', () => {
    const r = run(['--verify'])
    expect(r.status).toBe(2)
    expect(out(r)).toContain('usage')
  })

  it('S3 --from == --to is refused and the raw bytes stay put', () => {
    const { raw } = makeRaw('same')
    const before = treeShas(raw)
    const r = run(['--from', raw, '--to', raw])
    expect(r.status).not.toBe(0)
    expect(out(r)).toContain('REFUSED')
    expect(treeShas(raw)).toEqual(before)
  })

  it('S4 --to reaching --from through a symlink alias is refused', () => {
    const { raw } = makeRaw('alias')
    const alias = join(SCRATCH, 'alias-link')
    symlinkSync(raw, alias, 'dir')
    const before = treeShas(raw)
    const r = run(['--from', raw, '--to', alias, '--force'])
    expect(r.status).not.toBe(0)
    expect(out(r)).toContain('REFUSED')
    expect(treeShas(raw)).toEqual(before)
  })

  it('S5 a nested --to inside --from is refused (recursion into the raw tree)', () => {
    const { raw } = makeRaw('nested')
    const nested = join(raw, 'sanitized')
    const r = run(['--from', raw, '--to', nested, '--force'])
    expect(r.status).not.toBe(0)
    expect(out(r)).toContain('REFUSED')
  })

  it('S6 --store inside --to is refused (that is how secrets got back in)', () => {
    const { raw } = makeRaw('store')
    const to = join(SCRATCH, 'store', 'to')
    mkdirSync(to, { recursive: true })
    const store = join(to, 'raw-keep')
    const r = run(['--from', raw, '--to', to, '--store', store, '--manifest', join(to, 'MANIFEST.json'), '--force'])
    expect(r.status).not.toBe(0)
    expect(out(r)).toContain('REFUSED')
  })

  it('S7 a non-empty --to needs --force, and --manifest must live in --to', () => {
    const { raw } = makeRaw('force')
    const to = join(SCRATCH, 'force', 'to')
    mkdirSync(to, { recursive: true })
    writeFileSync(join(to, 'keep.txt'), 'x\n')
    const first = run(['--from', raw, '--to', to])
    expect(first.status).toBe(2)
    expect(out(first)).toContain('--force')
    const second = run(['--from', raw, '--to', to, '--manifest', join(SCRATCH, 'elsewhere', 'M.json'), '--force'])
    expect(second.status).toBe(2)
    expect(out(second)).toContain('manifest')
  })
})

describe('evidence sanitizer — credential coverage and raw preservation', () => {
  const to = join(SCRATCH, 'happy', 'to')
  const store = join(SCRATCH, 'happy', 'keep')
  const manifest = join(to, 'SANITIZATION.json')
  // Built inside the hook: collection-time writes would be wiped by the outer
  // beforeAll's scratch reset.
  let raw = ''
  let rawBefore: Record<string, string> = {}
  let status: number | null = null

  beforeAll(() => {
    raw = makeRaw('happy').raw
    rawBefore = treeShas(raw)
    const r = run(['--from', raw, '--to', to, '--store', store, '--manifest', manifest])
    status = r.status
  })

  it('S8 the run succeeds and the manifest records rawBytesUnchanged', () => {
    expect(status).toBe(0)
    expect(existsSync(manifest)).toBe(true)
    const m = JSON.parse(readFileSync(manifest, 'utf8')) as { files: unknown[]; rawBytesUnchanged?: boolean }
    expect(m.files.length).toBe(4)
    expect(m.rawBytesUnchanged).toBe(true)
  })

  it('S9 every raw file is byte-identical after the run', () => {
    expect(treeShas(raw)).toEqual(rawBefore)
    // And the kept raw copies are identical to the originals too.
    const kept = treeShas(store)
    for (const [rel, digest] of Object.entries(rawBefore)) expect(kept[rel]).toBe(digest)
  })

  it('S10 the YAML api-key and JSON token/authorization values are redacted', () => {
    const yaml = readFileSync(join(to, 'logs/config.yaml'), 'utf8')
    expect(yaml.includes(SECRET)).toBe(false)
    expect(yaml).toContain('REDACTED')
    // The key survives so the evidence is still readable; only the value goes.
    expect(yaml).toContain('x-api-key')
    const json = readFileSync(join(to, 'logs/envelope.json'), 'utf8')
    expect(json.includes(SECRET)).toBe(false)
    expect(json.includes(SECRET_B)).toBe(false)
    expect(json).toContain('keep me')
    const log = readFileSync(join(to, 'logs/boot.log'), 'utf8')
    expect(log.includes(SECRET)).toBe(false)
    expect(log.includes(SECRET_B)).toBe(false)
    expect(log).toContain('plain line, nothing secret here')
  })

  it('S11 --verify accepts the sanitized tree and rejects a planted secret', () => {
    const clean = run(['--verify', to])
    expect(clean.status).toBe(0)
    expect(out(clean)).toContain('VERIFY OK')
    // Plant one, in a file the tool has never seen, and check it notices.
    const plantedDir = join(to, 'planted')
    mkdirSync(plantedDir, { recursive: true })
    writeFileSync(join(plantedDir, 'leak.json'), JSON.stringify({ token: SECRET }) + '\n')
    const dirty = run(['--verify', to])
    expect(dirty.status).not.toBe(0)
    expect(out(dirty)).toContain('VERIFY FAIL')
    rmSync(plantedDir, { recursive: true, force: true })
    expect(run(['--verify', to]).status).toBe(0)
  })

  it('S12 --verify notices the raw tree (the check is not vacuous)', () => {
    const r = run(['--verify', raw])
    expect(r.status).not.toBe(0)
    expect(out(r)).toContain('VERIFY FAIL')
  })
})
