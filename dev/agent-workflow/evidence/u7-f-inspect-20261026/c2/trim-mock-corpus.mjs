/**
 * dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/trim-mock-corpus.mjs
 *
 * The evidence guard (#408, scripts/eb3-evidence-guard.mjs) refuses blobs over
 * 1 MiB that a PR ADDS, and the main agent's ruling for #404 (round-2 merge
 * prep, 2026-10-27) is that a full mock transcript does NOT earn an allowlist
 * exemption — the corpus must shrink to what the C2 verdicts actually cite.
 * This script rewrites `mock-corpus.json` into a declared EXCERPT: it keeps
 * only entries the verdicts cite (selected by STRUCTURAL predicate, so a
 * future boot trims under the same law) and drops the rest. Kept entries are
 * byte-identical to the capture; nothing is rewritten or sanitized.
 *
 * Witness predicate (see witnessEntryIndexes): the final entry, plus any
 * entry whose REPLY issues team_skill / team_resolve_control /
 * team_cordis_inspect_list, plus any entry whose tail carries a durable
 * Control-row id (`ctrl-`), plus any entry carrying the loaded
 * `<skill_content` result. On the boot-5 capture that is entries 4, 6, 12,
 * 19, 43 (ask-row listing with the real ctrl- id; the governed team_skill
 * call; the leader issuing team_resolve_control; the post-approval skill
 * content + the cited inspect_list tool_use; final leader state). The full
 * original is recoverable from git history by the header digest.
 *
 * Run:   node dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/trim-mock-corpus.mjs [path]
 * Import: witnessEntryIndexes(entries) -> number[] (the runner uses it to
 * write an excerpt-shaped corpus at the end of every future boot).
 *
 * Refuses to re-trim: an already-excerpt input (non-array) is rejected — the
 * original lives in git, keyed by the sha256 this tool writes.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Boot-independent witness selector — exported for the C2 runner. */
export function witnessEntryIndexes(entries) {
  const keep = new Set([entries.length - 1])
  entries.forEach((entry, i) => {
    const s = JSON.stringify(entry)
    const reply = JSON.stringify(entry?.reply ?? '')
    if (s.slice(-6000).includes('ctrl-')) keep.add(i)
    if (reply.includes('team_resolve_control') || reply.includes('team_skill') || reply.includes('team_cordis_inspect_list')) keep.add(i)
    if (s.includes('<skill_content')) keep.add(i)
  })
  return [...keep].filter((i) => i >= 0).sort((a, b) => a - b)
}

/** Wrap a raw captured array in the declared-excerpt envelope + digest header. */
export function buildExcerpt(originalRaw) {
  const doc = JSON.parse(originalRaw)
  if (!Array.isArray(doc)) {
    throw new Error('trim-mock-corpus: input is not the raw captured array — refusing to re-trim an excerpt (the original is in git, keyed by the header digest)')
  }
  const keep = witnessEntryIndexes(doc)
  return {
    excerpt: true,
    note: 'Declared EXCERPT of the boot-5 mock corpus: only entries the C2 verdicts cite (structural witness predicate — see c2/trim-mock-corpus.mjs). Kept entries are byte-identical to the capture; the rest were dropped per the #404 round-2 evidence-size ruling (no allowlist exemption for a full transcript). Original recoverable from git by the digest below.',
    original: {
      bytes: Buffer.byteLength(originalRaw),
      sha256: createHash('sha256').update(originalRaw).digest('hex'),
      entries: doc.length,
    },
    kept: keep.map((index) => ({ index })),
    entries: keep.map((index) => ({ index, entry: doc[index] })),
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const PATH = process.argv[2] ?? join(HERE, 'mock-corpus.json')
  const raw = readFileSync(PATH)
  const excerpt = buildExcerpt(raw)
  writeFileSync(PATH, JSON.stringify(excerpt, null, 1))
  console.log(`trim-mock-corpus: ${String(excerpt.original.bytes)} B / ${String(excerpt.original.entries)} entries -> ${String(statSync(PATH).size)} B / ${String(excerpt.entries.length)} kept (original sha256 ${excerpt.original.sha256})`)
}
