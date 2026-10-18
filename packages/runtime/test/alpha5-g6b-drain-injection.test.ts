/**
 * g6b ② — the stderr/settlement race, driven by INJECTED stream timing.
 *
 * The previous hand's fake child reached the row's `internal-error` arm, so it proved
 * nothing. This one is built to the shape the row actually consumes: a handle
 * `{ ok: true, value: child }` where `child` exposes REAL streams (PassThrough, so
 * 'data'/'end' behave like pipes), an `exited` promise the test resolves by hand, and an
 * async `terminate()` — exactly the surface glob-backend.mjs touches
 * (spawnStreaming → handle.ok → child.stdout/stderr .on('data') → child.exited →
 * child.terminate()). No real rg, no sleeping and hoping: the ordering IS the stimulus.
 *
 * Shapes:
 *  (a) exited first, the walker's words arrive only after the drain bound → TYPED, never
 *      an empty success.  [RED on the landed tree: the fail-closed arm is NOT landed, see
 *      evidence/alpha5/g6b-flake/round-3-drain.md — the shapes are skipped, not deleted]
 *  (b) words delivered but the stream never closes → TYPED, never an empty success. [RED]
 *  (c) streams closed before exited → the normal path answers with the real list. [GREEN]
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { PassThrough } from 'node:stream'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const h = vi.hoisted(() => ({ next: null }))
vi.mock('../sandbox-provider/index.js', () => ({
  createConfinedProcessProvider: () => ({
    spawnStreaming: async () => ({ ok: true, value: h.next }),
  }),
}))

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `g6b-inj-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')

function fakeChild() {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  let settle = () => {}
  const child = {
    pid: 4242,
    stdout,
    stderr,
    exited: new Promise((r) => { settle = r }),
    terminate: async () => { stdout.end(); stderr.end() },
  }
  return {
    child,
    exit: (code) => settle({ code }),
    speak: (text) => stderr.write(text),
    files: (text) => stdout.write(text),
    closeBoth: () => { stdout.end(); stderr.end() },
    freeze: () => { child.terminate = async () => {} }, // streams never close
  }
}

let backend = null
beforeAll(async () => {
  mkdirSync(ROOT_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'a.txt'), 'x\n')
  const be = await import('../src/plugin/live/glob-backend.mjs')
  backend = be.createAnchoredGlobBackend({
    realmId: 'g6b-inj',
    rootDir: ROOT_DIR,
    confined: {
      trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 },
    },
    observe: () => {},
  })
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const io = { sink: { write: () => {} } }
const call = (callId) => ({
  callId,
  parsedArgs: { tool: 'glob', pattern: '*.txt', target: { placement: 'relative', locator: '.' } },
})
const within = async (p, ms = 20000) =>
  Promise.race([p, new Promise((r) => setTimeout(() => r('HUNG'), ms).unref?.())])

describe('g6b ② — injected stream timing over the settlement decision', () => {
  it('(a) exited first, the words arrive after the drain bound: typed, never an empty success', async () => {
    const f = fakeChild()
    h.next = f.child
    const resP = backend.run(call('a'), io)
    f.exit(0) // the streaming arm reports exit 0 for a hard walker error
    setTimeout(() => f.speak('error parsing glob\n'), 400).unref?.()
    const res = await within(resP)
    expect(res, 'the walk must settle').not.toBe('HUNG')
    expect(res.ok, `late words judged quiet: ${JSON.stringify(res)}`).toBe(false)
  })

  it('(b) words delivered but the stream never closes: typed, never an empty success', async () => {
    const f = fakeChild()
    h.next = f.child
    f.freeze()
    const resP = backend.run(call('b'), io)
    f.speak('error parsing glob\n')
    f.files('a.txt\n')
    f.exit(0)
    const res = await within(resP)
    expect(res, 'the walk must settle').not.toBe('HUNG')
    expect(res.ok, `unclosed stream judged quiet: ${JSON.stringify(res)}`).toBe(false)
  })

  it('(c) streams closed before exited: the normal path answers with the real list', async () => {
    const f = fakeChild()
    h.next = f.child
    const resP = backend.run(call('c'), io)
    f.files('a.txt\n')
    f.closeBoth()
    f.exit(0)
    const res = await within(resP)
    expect(res, 'the walk must settle').not.toBe('HUNG')
    // The fake's stdout is not a full --json walk transcript, so this shape asserts what
    // it can honestly assert: the normal path SETTLES and is not judged by the drain arm
    // (no walker-error/DRAIN verdict on a walk whose streams closed cleanly).
    const code = String(res.ok === true ? 'ok' : res.failure?.code)
    expect(code, `normal path judged by the drain arm: ${JSON.stringify(res)}`).not.toBe('walker-error')
  })
})
