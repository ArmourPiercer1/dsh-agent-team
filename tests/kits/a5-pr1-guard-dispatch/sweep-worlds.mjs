#!/usr/bin/env node
/**
 * sweep-worlds.mjs — one-shot cleaner for abandoned Alpha.5 PR1 kit worlds.
 *
 * WHY THIS EXISTS: the kit removes its own world on every exit route (see
 * `sweepWorld()` in `a5p1-kit.mjs`), but a kit that is SIGKILLed mid-run, or a
 * revision that crashed before the teardown existed, leaves a `tests/homes/a5p1-*`
 * world behind. Seven of those existed at the time this file was written. A
 * runner-side sweep is what keeps "worlds are deleted after use" true as a fact
 * about the directory rather than a promise about the code path.
 *
 * Usage:
 *   node tests/kits/a5-pr1-guard-dispatch/sweep-worlds.mjs --dry   # list only
 *   node tests/kits/a5-pr1-guard-dispatch/sweep-worlds.mjs         # delete
 *   node tests/kits/a5-pr1-guard-dispatch/sweep-worlds.mjs --scrub-raw [--dry]  # redact leftover raw Host logs
 *
 * It deletes ONLY directories directly under `tests/homes/` whose name starts
 * with `a5p1-` (the kit's own prefix, `homeDir(root, 'a5p1-<stamp>')`), and
 * refuses to touch anything else — no glob widening, no other prefix.
 *
 * @module tests/kits/a5-pr1-guard-dispatch/sweep-worlds
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve } from 'node:path'
import { homeRoot } from '../../paths.mjs'

const REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..', '..', '..')
const HOMES = homeRoot(REPO_ROOT)
const PREFIX = 'a5p1-'
const DRY = process.argv.includes('--dry')

if (!existsSync(HOMES)) {
  console.log(`no homes directory at ${HOMES} — nothing to do`)
  process.exit(0)
}

const victims = readdirSync(HOMES)
  .filter((name) => name.startsWith(PREFIX))
  .map((name) => join(HOMES, name))
  .filter((path) => {
    try {
      return statSync(path).isDirectory()
    } catch {
      return false
    }
  })

for (const path of victims) {
  if (DRY) {
    console.log(`would remove: ${path}`)
    continue
  }
  rmSync(path, { recursive: true, force: true })
  console.log(`removed: ${path}`)
}
console.log(`${DRY ? 'found' : 'removed'} ${String(victims.length)} ${PREFIX}* world(s) under ${HOMES}`)

/**
 * `--scrub-raw` — the second half of the same hygiene promise. The kit captures
 * the Host's stdout raw and redacts it before finalising `instance.log`
 * (piping the child's stdout does not deliver the boot marker on this Host, so
 * the raw file exists for the duration of a run). A run killed mid-flight can
 * leave `host-stdout.raw` behind WITH a live launch token in it. This rewrites
 * every leftover through the same redaction table and promotes it to
 * `instance.log`, so no credential can reach a commit by accident.
 * The table is duplicated here on purpose: a runner-side repair tool must not
 * depend on loading the kit that produced the mess.
 */
const hex8 = (value) => createHash('sha256').update(value).digest('hex').slice(0, 8)
const REDACT = [
  [/(https?:\/\/[^\s"'`]+?\?token=)[A-Za-z0-9_-]{8,}/g, (m, head, tok) => `${head}<REDACTED-${hex8(tok)}>`],
  [/(dsh-auth-[A-Za-z0-9_-]{6,}=)([A-Za-z0-9._%\-=]{6,})/g, (m, head, tok) => `dsh-auth-<REDACTED>=<REDACTED-${hex8(tok)}>`],
  [/(Bearer\s+)([A-Za-z0-9._-]{6,})/gi, (m, head, tok) => `Bearer <REDACTED-${hex8(tok)}>`],
]
function redactAll(text) {
  let out = text
  for (const [re, repl] of REDACT) out = out.replace(re, (m, head, tok) => repl(m, head, tok ?? ''))
  return out
}
if (process.argv.includes('--scrub-raw')) {
  const evidenceRoot = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence')
  const found = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { walk(path); continue }
      if (entry.name === 'host-stdout.raw') found.push(path)
    }
  }
  walk(evidenceRoot)
  for (const path of found) {
    const text = readFileSync(path, 'utf8')
    const clean = redactAll(text)
    const target = join(dirname(path), 'instance.log')
    if (DRY) { console.log(`would scrub: ${relative(REPO_ROOT, path)} -> ${relative(REPO_ROOT, target)}`); continue }
    writeFileSync(target, clean)
    rmSync(path, { force: true })
    console.log(`scrubbed: ${relative(REPO_ROOT, path)} -> ${relative(REPO_ROOT, target)}`)
  }
  console.log(`${DRY ? 'found' : 'scrubbed'} ${String(found.length)} raw host capture(s) under ${relative(REPO_ROOT, evidenceRoot)}`)
}
