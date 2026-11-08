/**
 * a5sf-skill-provider.mjs — the Member-scoped `skills` PROVIDER the governed
 * realm mounts, so the NATIVE `skill` tool loads bodies through the Member's
 * CONFINED `fs` face.
 *
 * WHY THIS MODULE EXISTS (PD-29, 2026-11-14; the row PD-26 opened).
 *
 * PD-23 measured the preset's `skill-filesystem` provider returning an
 * out-of-lane `SKILL.md` body through the inherited BASE `fs` and removed the
 * rows (a capability regression: no skills at all). PD-26 restored the two
 * NAMES by writing a Team-owned `skill` TOOL that re-implemented the host
 * package's definition and read the body itself. That was the wrong half: the
 * native `@deepseek-ai/dsh-tool-skill` only ever calls `ctx.skills.list()` /
 * `ctx.skills.get()` — it is a CONSUMER of the `skills` service and has no
 * filesystem capability of its own. The missing piece was never a tool; it was
 * a SERVICE: a provider whose body read goes through the Member's confined
 * `fs` provider (PD-17's face) instead of the base one.
 *
 * So this module registers a provider on `ctx.skills` — exactly what the host
 * `skill-filesystem` package does — and the preset keeps the UNMODIFIED host
 * `tool-skill` row. The realm's route-C attach mounts this module INSIDE the
 * Member's isolated scope (after the capability deny lane), so the `fs` it
 * resolves is the confined Provider; the registry layer it registers into is
 * keyed by the AGENT's DSH scope (Cordis' Service tracker binds the call to the
 * calling context), which is the scope the preset's `tool-skill` reads with.
 *
 * WHY A DECLARED CATALOG AND NOT A SCAN. `skill-filesystem` discovers by
 * scanning roots, and its `list()` aborts/skips on the first denied root — so a
 * declared-but-out-of-lane skill and an in-lane one cannot coexist in one scan
 * without one hiding the other, and the out-of-lane entry would never be
 * attempted (it would simply be absent, which is an existence answer by
 * omission: "no such skill" instead of "refused"). The row already carries the
 * declaration (`a5sfSkillCatalog`, `{name, description, path}`), which is DATA,
 * not policy: `list()` serves the declared summaries without touching the
 * filesystem, and `get()` resolves+stats+reads the declared path through the
 * confined `fs`. An out-of-lane declared path therefore reaches the guard and
 * is refused there with the typed `IO_READ_DENIED`, 0 bytes and one deny fact —
 * the same shape a native `read` has.
 *
 * DISCLOSED SEMANTICS (one, deliberate): the declared catalog entry is the
 * metadata authority (name/description/invocation). A per-file frontmatter flag
 * such as `disable-model-invocation` is NOT re-read at `list()` time — reading
 * it would require opening every declared body before the lane decision, which
 * is exactly the leak this provider exists to avoid. The catalog is authored by
 * the World/profile owner (trusted row config), so a skill that must stay
 * user-only is expressed by not declaring it.
 *
 * WHAT THIS DOES NOT DO: it registers NO tool and no prompt section (the host
 * `tool-skill` row owns the name, the schema, the catalog section and the
 * render); it evaluates no lane; it imports no upstream private API; it does
 * not touch upstream code (CORE PATCH BUDGET = 0).
 *
 * @module @dsh-agent-team/runtime/plugin/live/a5sf-skill-provider
 */
import { dirname } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { isSkillName } from '@deepseek-ai/dsh-skill'

/** Stable plugin identity. */
export const name = 'a5sf-skill-provider'

/**
 * Services used: the registry this provider registers on (the host `skills`
 * service) and the Member's confined `fs` face.
 */
export const inject = ['skills', 'fs']

/** The provider name the summaries carry (the registry requires it to match). */
const PROVIDER_NAME = 'a5sf-confined'

/** Rank within one layer (the host filesystem provider's CUSTOM_RANK). */
const DECLARED_RANK = 300

/**
 * Normalize the declared catalog. A malformed entry is a CONFIGURATION fault
 * (refused at mount time, never skipped): a skill the operator declared but
 * this provider silently dropped would look like "unknown skill" at call time.
 * @param {unknown} raw - the row's `a5sfSkillCatalog` value.
 * @returns {readonly {name: string, description: string, path: string}[]}
 */
export function skillCatalogOf(raw) {
  if (raw === undefined || raw === null) return Object.freeze([])
  if (!Array.isArray(raw)) throw new TypeError('a5sf-skill-provider: config.skills must be an array when present')
  const seen = new Set()
  return Object.freeze(raw.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`a5sf-skill-provider: config.skills[${String(index)}] must be an object { name, description, path }`)
    }
    const { name: skillName, description, path } = entry
    if (typeof skillName !== 'string' || !isSkillName(skillName)) {
      throw new TypeError(`a5sf-skill-provider: config.skills[${String(index)}].name must be a valid skill name (got ${JSON.stringify(skillName)})`)
    }
    if (seen.has(skillName)) {
      throw new TypeError(`a5sf-skill-provider: config.skills declares the skill name ${JSON.stringify(skillName)} twice`)
    }
    seen.add(skillName)
    if (typeof description !== 'string' || description.trim() === '') {
      throw new TypeError(`a5sf-skill-provider: config.skills[${String(index)}].description must be a non-blank string`)
    }
    if (typeof path !== 'string' || path.trim() === '') {
      throw new TypeError(`a5sf-skill-provider: config.skills[${String(index)}].path must be a non-blank string`)
    }
    return Object.freeze({ name: skillName, description, path })
  }))
}

/**
 * The body served to the model: a leading YAML frontmatter block is stripped,
 * exactly as the host filesystem provider's `content` is (the host `skill`
 * tool embeds `content` verbatim inside `<skill_instructions>`).
 * @param {string} text - the raw `SKILL.md` bytes.
 * @returns {string} the instruction body.
 */
function bodyOf(text) {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/u.exec(text)
  return match === null ? text : text.slice(match[0].length)
}

/**
 * A confined-face refusal raised through the `skills` service. Public shape:
 * `HarnessError` (`code` + `name`) so it survives the tool-result protocol.
 */
export class SkillBodyRefused extends HarnessError {}

/**
 * Re-raise a confined-face refusal carrying its typed code. The registry does
 * not catch provider errors, so this error reaches the native `skill` tool's
 * result; `code` keeps the refusal machine-readable ("refused" vs "absent")
 * while `message` stays the compiled lane's own decision text.
 * @param {unknown} error - the thrown value.
 * @returns {Error} the error to throw.
 */
function typedReadFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : undefined
  if (code === undefined || !code.startsWith('IO_')) return error instanceof Error ? error : new Error(String(error))
  const detail = error instanceof Error ? error.message : String(error)
  // The code is IN the model-visible text as well as on the error object: the
  // native `skill` tool renders `Error: <message>`, and PD-26's deny arm pinned
  // `IO_READ_DENIED: <lane decision>` as the shape the model sees. Prefixing
  // keeps the refusal typed at EVERY layer (guard fact, `error.info.code`, the
  // tool text) without re-deciding anything: the detail is the compiled lane's
  // own words. A `HarnessError` (not a bare `Error`) because that is the ONE
  // shape the tool-result protocol serializes a code for.
  return new SkillBodyRefused(
    detail.startsWith(`${code}: `) ? detail : `${code}: ${detail}`,
    code,
    { cause: error },
  )
}

/**
 * The provider registered on `ctx.skills`.
 *
 * `list()` is filesystem-free by construction: it answers the DECLARED catalog
 * so a declared-out-of-lane entry is still offered to the model and is refused
 * at its read, not hidden as "unknown".
 */
export class CatalogSkillProvider {
  /**
   * @param {object} ctx - the realm-scoped context (its `fs` is the confined face).
   * @param {{ name: string, description: string, path: string }[]} catalog - normalized declaration.
   * @param {string} [providerName] - the registered provider name.
   */
  constructor(ctx, catalog, providerName = PROVIDER_NAME) {
    this.ctx = ctx
    this.catalog = catalog
    this.name = providerName
  }

  /**
   * @param {{ cwd?: string }} _options - lookup options (unused: the catalog is declared).
   * @returns {Promise<readonly object[]>} one candidate per declared entry.
   */
  async list(_options) {
    return this.catalog.map((entry) => Object.freeze({
      name: entry.name,
      description: entry.description,
      invocation: Object.freeze({ modelInvocable: true, userInvocable: true }),
      source: 'declared',
      provider: this.name,
      rank: DECLARED_RANK,
      locator: Object.freeze({ path: entry.path, directory: dirname(entry.path) }),
      resourceBase: Object.freeze({ kind: 'directory', path: dirname(entry.path) }),
    }))
  }

  /**
   * Load one declared skill through the CONFINED `fs` face.
   *
   * `resolve` is resolution-only and unguarded (the host provider's own call
   * order); `readText` is the ONE target-bearing call, and the confined
   * provider consults the compiled lane there before a single byte is read. A
   * refusal therefore arrives before any existence answer reaches the model,
   * and a declared out-of-lane body costs EXACTLY ONE lane consult (the same
   * shape a native `read` and PD-26's deny arm have). No `stat`: the extra
   * consult would add nothing to safety (the read is guarded either way) and
   * would make the deny arm's fact count incomparable with the native read's.
   *
   * @param {{ name: string, description: string, invocation: object, locator: { path: string, directory: string } }} candidate
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object|undefined>} the loaded definition, or `undefined` when the file is absent.
   */
  async get(candidate, options = {}) {
    const declared = this.catalog.find((entry) => entry.name === candidate.name)
    if (declared === undefined) return undefined
    let content
    try {
      const target = await this.ctx.fs.resolve(declared.path, { signal: options.signal })
      content = await this.ctx.fs.readText(target, options.signal)
    } catch (error) {
      throw typedReadFailure(error)
    }
    return {
      name: declared.name,
      description: declared.description,
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'declared',
      provider: this.name,
      resourceBase: { kind: 'directory', path: dirname(declared.path) },
      path: declared.path,
      content: bodyOf(content),
    }
  }
}

/**
 * Register the catalog provider on the calling context's `skills` service.
 * @param {object} ctx - the Member realm's routed context.
 * @param {{ skills?: readonly object[] }} [config] - the row's declared catalog.
 */
export function apply(ctx, config = {}) {
  const catalog = skillCatalogOf(config?.skills)
  ctx.skills.registerProvider((control) => {
    void control
    return new CatalogSkillProvider(ctx, catalog)
  })
}
