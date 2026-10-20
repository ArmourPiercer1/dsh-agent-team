// a5rp hooks: (1) rewrite relative './*.js' specifiers to './*.ts' so the
// pinned pilot tree (repo law: .js specifiers) runs under node type-stripping;
// (2) count EVERY resolution that touches the NATIVE read implementation
// (tool-fs / read-render) — the "original native body = 0" witness mechanism.
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const HITS = process.env.A5RP_HOOKS ?? '/tmp/a5rp-hooks.log'
const NATIVE_RE = /tool-fs|read-render/
mkdirSync(dirname(HITS), { recursive: true })
appendFileSync(HITS, `# hooks loaded pid=${String(process.pid)}\n`)

export async function resolve (specifier, context, next) {
  // CLAIM SURFACE (8ae ①): specifier-substring match, ESM resolve path, THIS pid only.
  if (NATIVE_RE.test(specifier)) appendFileSync(HITS, `NATIVE-HIT pid=${String(process.pid)} specifier=${specifier}\n`)
  const hit = (specifier.startsWith('./') || specifier.startsWith('../')) && specifier.endsWith('.js')
    ? await next(specifier.slice(0, -3) + '.ts', context).catch(() => null)
    : null
  const resolved = hit ?? await next(specifier, context)
  // additionally match the RESOLVED URL (post-resolution surface), same substring law
  const url = String(resolved?.url ?? '')
  if (NATIVE_RE.test(url) && !url.includes('/governed-fs/')) appendFileSync(HITS, `NATIVE-HIT pid=${String(process.pid)} resolved=${url}\n`)
  return resolved
}
