/**
 * inspect-family/src/skill-mechanics.mjs — the governed skill loader's PURE law.
 *
 * WHAT THIS MODULE OWNS (and owns ONLY): the name grammar, the sanctioned-
 * root config law, and the SKILL.md frontmatter/body parsing. It touches no
 * filesystem, never admits, never decides — the executor composes those
 * edges. The file READ itself rides the fs family's anchor law by reference
 * (`resolveAnchoredPath` / `lexicalAnchor` — the sibling-family public face,
 * "referenced, never copied" precedent), so a governed skill load escapes
 * nothing the governed `read` row already refuses: no `..`, no URI scheme,
 * no symlink that lands outside the sanctioned root.
 *
 * THE SANCTIONED ROOTS ARE HOST-DEFINED: they arrive as trusted mount config
 * (`planeCfg.skillRoots`, the host composition's own plugin config — never
 * model input). Absent = the skill row does not mount at all (the closed
 * world invents no root — the same stronger-shut law the no-fs-root fs world
 * lives under). A PRESENT but malformed root list is a config defect: the
 * family build refuses the whole mount rather than mounting half a law.
 *
 * The name grammar mirrors the host pin's `isSkillName`
 * (`packages/skill/skill/src/index.ts:21 @639ed01539`): kebab-case only, so
 * path separators and `..` are refused at the GRAMMAR boundary before any
 * resolution is even attempted. The frontmatter law mirrors the host
 * filesystem provider (name/description required; `disable-model-invocation`
 * the one canonical invocation key; the legacy spellings unsupported), and
 * the content a load returns is the frontmatter-stripped body, exactly the
 * native `content` field's shape.
 *
 * @module inspect-family/skill-mechanics
 */

/** Mirror of the host pin's skill-name grammar (kebab-case), with a length
 *  cap so a hostile name cannot grow a locator without bound. */
const SKILL_NAME_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const SKILL_NAME_MAX_LENGTH = 128

/** The instruction file's fixed spelling inside one skill directory (the
 *  host filesystem provider's layout: <root>/<name>/SKILL.md). */
export const SKILL_FILE_NAME = 'SKILL.md'

/** Bounded read (disclosed stricter than the native loader, which is bounded
 *  only by the provider): a SKILL.md beyond this size is a refusal, never a
 *  memory event. */
export const SKILL_MAX_BYTES = 256 * 1024

export function isSkillNameGrammar(name) {
  return typeof name === 'string'
    && name.length > 0
    && name.length <= SKILL_NAME_MAX_LENGTH
    && SKILL_NAME_RX.test(name)
}

/**
 * Validate the TRUSTED skill-root list (pure). Returns the frozen valid list
 * (possibly empty = "this mount sanctions no skill root"), or a typed
 * problem for a malformed list (config defect → the family refuses).
 */
export function validateSkillRoots(raw) {
  if (raw === undefined || raw === null) return { ok: true, roots: Object.freeze([]) }
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, detail: 'planeCfg.skillRoots must be a non-empty array of absolute directory paths when present' }
  }
  const roots = []
  for (const entry of raw) {
    if (typeof entry !== 'string' || entry.length === 0 || entry.includes('://')) {
      return { ok: false, detail: `a planeCfg.skillRoots entry is not a plain path: ${JSON.stringify(entry)?.slice(0, 120) ?? String(entry)}` }
    }
    if (!entry.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(entry)) {
      return { ok: false, detail: `a planeCfg.skillRoots entry is not absolute: ${entry.slice(0, 120)}` }
    }
    if (entry.split(/[\\/]+/).includes('..')) {
      return { ok: false, detail: `a planeCfg.skillRoots entry carries a parent segment: ${entry.slice(0, 120)}` }
    }
    roots.push(entry)
  }
  return { ok: true, roots: Object.freeze(roots) }
}

/** XML-ish escapes mirrored from the host skill package's presentation law
 *  (attribute form also escapes the quote; text form does not need to). */
export function escapeSkillText(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
export function escapeSkillAttr(value) {
  return escapeSkillText(value).replaceAll('"', '&quot;')
}

/**
 * Minimal frontmatter law (mirror of the host filesystem provider's rules
 * that this row needs, on the flat `key: value` subset — no YAML engine
 * rides here, and the row refuses what it cannot read instead of guessing):
 *  - a leading `---` fence block is REQUIRED;
 *  - `name` and `description` are REQUIRED non-empty scalars;
 *  - `disable-model-invocation` is the ONLY canonical invocation key and
 *    must be a boolean when present; the legacy `disableModelInvocation` /
 *    `modelInvocable` spellings are unsupported (host law, skill-filesystem
 *    index.ts:1001-1014 @639ed01539);
 *  - the returned content is the body after the fence, trimmed (the native
 *    provider's `content` shape, index.ts:838).
 */
export function parseSkillMarkdown(text) {
  if (typeof text !== 'string') return { ok: false, code: 'skill-unreadable', detail: 'the skill file is not text' }
  const fence = text.startsWith('---\n') || text.startsWith('---\r\n')
  if (!fence) return { ok: false, code: 'skill-invalid-frontmatter', detail: 'the skill file carries no leading frontmatter fence' }
  const lines = text.split(/\r?\n/)
  const fields = new Map()
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line === '---') { end = i; break }
    const match = /^([A-Za-z][A-Za-z0-9-]*):(?:\s*(.*))?$/.exec(line)
    if (match !== null) fields.set(match[1], (match[2] ?? '').trim())
  }
  if (end === -1) return { ok: false, code: 'skill-invalid-frontmatter', detail: 'the frontmatter fence never closes' }
  for (const legacy of ['disableModelInvocation', 'modelInvocable']) {
    if (fields.has(legacy)) {
      return { ok: false, code: 'skill-invalid-frontmatter', detail: `frontmatter field "${legacy}" is unsupported; use "disable-model-invocation"` }
    }
  }
  const name = fields.get('name') ?? ''
  const description = fields.get('description') ?? ''
  if (name.length === 0 || description.length === 0) {
    return { ok: false, code: 'skill-invalid-frontmatter', detail: 'frontmatter requires name and description' }
  }
  let modelInvocable = true
  const disable = fields.get('disable-model-invocation')
  if (disable !== undefined && disable !== '') {
    if (disable !== 'true' && disable !== 'false') {
      return { ok: false, code: 'skill-invalid-frontmatter', detail: 'frontmatter field "disable-model-invocation" must be a boolean' }
    }
    modelInvocable = disable !== 'true'
  }
  const body = lines.slice(end + 1).join('\n').trim()
  return { ok: true, name, description, modelInvocable, content: body }
}
