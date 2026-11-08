/**
 * confined-skill-tool.mjs — the model-visible `skill` loader, served by the
 * Member's CONFINED `fs` face.
 *
 * WHY THIS EXISTS (PD-26, 2026-11-14; the row PD-23 opened). PD-23 measured
 * that the preset's `skill-filesystem` provider loaded a `$DSH_HOME/skills`
 * body through the BASE `fs` — a preset row mounts on the registry generation
 * scope, above every agent, so its `ctx.fs` is the inherited `fs-sandbox`
 * service. The body of an out-of-lane skill reached the model with ZERO
 * `a5sf-guard-consult` facts. The fail-closed disposition removed `tool-skill`
 * and `skill-filesystem`, so the opt-in governed preset offered NO SKILLS AT
 * ALL — a capability regression, disclosed as a `CORE_SEAM_BLOCKER` in PD-23's
 * evidence (§5.1: "a Team-owned skill provider that resolves `SKILL.md` and
 * its `resources` through the Member's own confined `fs` face").
 *
 * This module is that provider's TOOL half, mounted the SAME route-C way PD-17
 * mounted the filesystem tools: the realm re-mounts it INSIDE the Member's
 * isolated scope, AFTER the capability deny lane, so the `fs` this module
 * resolves is the confined Provider mounted on that scope. Every body read is
 * `ctx.fs.readText` on that Provider: the compiled lane is consulted before a
 * byte is read, an out-of-lane body raises the typed `IO_READ_DENIED` (raised
 * again here with its code in the message, so the MODEL also sees the type)
 * and leaves exactly one deny fact, exactly like a native `read`.
 *
 * WHAT THE CATALOG IS, AND WHAT IT IS NOT. The catalog is DECLARATION data —
 * `{ name, description, path }` entries the row config carries (`a5sfSkillCatalog`,
 * normalized by `a5sfRealmConfigOf`). It is not a policy: this module holds no
 * lane, evaluates no rule, and never decides whether a path is allowed. The
 * declared path is resolved through the confined `fs`, so a catalog entry that
 * points above the Member's lane is DENIED at the read, not filtered here.
 * Why declared rather than scanned: a scanning provider aborts its whole
 * `list()` on the first denied root, so an out-of-lane root would also hide
 * every in-lane skill. A declaration keeps the two arms independent and makes
 * every read go through the one governed face.
 *
 * It contributes the TOOL DEFINITION (name, description, parameter/output
 * schema, `presentCall`) — the shipped `@deepseek-ai/dsh-tool-skill` spellings.
 * The preset keeps the host row so the NAME is visible to the agent before the
 * attach (route C is surface-neutral: it may replace a definition, never add a
 * name); with no visible skill provider that preset row can only answer
 * "unknown", i.e. it is a fail-closed placeholder, and this module shadows it.
 *
 * WHAT THIS DOES NOT DO: it does not add a second policy source, does not read
 * the file except through the confined `fs`, does not weaken the suite's
 * resource reads (they stay the Member's governed `read`), and does not touch
 * upstream code (CORE PATCH BUDGET = 0).
 *
 * @module @dsh-agent-team/runtime/plugin/live/confined-skill-tool
 */
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isSkillName, renderSkillContent } from '@deepseek-ai/dsh-skill'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'a5sf-confined-skill'

/** The one model-visible name this module places (the shipped spelling). */
export const A5SF_CONFINED_SKILL_TOOLS = Object.freeze(['skill'])

/**
 * Services used: the live registry, the Member's confined `fs` face, and the
 * prompt service the catalog section registers through.
 */
export const inject = ['tools', 'fs', 'systemPrompt']

/**
 * Normalize the declared catalog. A malformed entry is a CONFIGURATION fault
 * (refused at mount time, never skipped): a skill the operator declared but
 * this module silently dropped would look like "unknown skill" at call time.
 * @param {unknown} raw - the row's `a5sfSkillCatalog` value.
 * @returns {readonly {name: string, description: string, path: string}[]}
 */
export function skillCatalogOf(raw) {
  if (raw === undefined || raw === null) return Object.freeze([])
  if (!Array.isArray(raw)) throw new TypeError('a5sf-confined-skill: config.skills must be an array when present')
  const seen = new Set()
  return Object.freeze(raw.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`a5sf-confined-skill: config.skills[${String(index)}] must be an object { name, description, path }`)
    }
    const { name: skillName, description, path } = entry
    if (typeof skillName !== 'string' || !isSkillName(skillName)) {
      throw new TypeError(`a5sf-confined-skill: config.skills[${String(index)}].name must be a valid skill name (got ${JSON.stringify(skillName)})`)
    }
    if (seen.has(skillName)) {
      throw new TypeError(`a5sf-confined-skill: config.skills declares the skill name ${JSON.stringify(skillName)} twice`)
    }
    seen.add(skillName)
    if (typeof description !== 'string') {
      throw new TypeError(`a5sf-confined-skill: config.skills[${String(index)}].description must be a string`)
    }
    if (typeof path !== 'string' || path.trim() === '') {
      throw new TypeError(`a5sf-confined-skill: config.skills[${String(index)}].path must be a non-blank string`)
    }
    return Object.freeze({ name: skillName, description, path })
  }))
}

/** The declared catalog as the model-facing prompt section text. */
function catalogText(catalog) {
  if (catalog.length === 0) return ''
  return [
    'A skill is a reusable set of task-specific instructions. The following skills are declared for this Member;',
    'call the `skill` tool with the exact name before acting on a task that matches one. The body is read through',
    'this Member\'s confined filesystem face, so a skill declared outside the compiled lane is refused there.',
    '',
    '<available_skills>',
    ...catalog.map((entry) => `  <skill name="${entry.name}">${entry.description}</skill>`),
    '</available_skills>',
  ].join('\n')
}

/**
 * The model-facing body: strip a leading YAML frontmatter block, exactly as the
 * filesystem provider does (its `name`/`description` already came from the
 * declared catalog this module published). This is presentation, not policy —
 * the guarded read above is what decided access.
 */
function bodyOf(text) {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/u.exec(text)
  return match === null ? text : text.slice(match[0].length)
}

/**
 * Re-raise a confined-face refusal with its CODE in the message. The fact sink
 * already carries the typed code; this makes the model's tool result typed too,
 * so "refused" cannot be misread as "absent file".
 */
function typedReadFailure(error) {
  const code = typeof error?.code === 'string' ? error.code : undefined
  if (code !== undefined && code.startsWith('IO_')) {
    const rethrown = new Error(`${code}: ${error instanceof Error ? error.message : String(error)}`)
    rethrown.cause = error
    rethrown.code = code
    return rethrown
  }
  return error
}

/**
 * Register the confined `skill` tool and its catalog section.
 * @param {object} ctx - the Member realm's routed context.
 * @param {{ skills?: readonly object[] }} [config] - the row's declared catalog.
 */
export function apply(ctx, config = {}) {
  const catalog = skillCatalogOf(config?.skills)
  ctx.systemPrompt.section({
    name: 'tool:skill',
    // Beside the filesystem guidance: the catalog is read-path information.
    order: ctx.systemPrompt.getSectionOrder('TOOL_READ') - 1,
    text: () => catalogText(catalog),
  })
  ctx.tools.register(defineTool({
    name: 'skill',
    description: 'Load the full instructions for a skill. Call it before acting on a task that names or clearly matches a skill in the session skill catalog.',
    parameters: {
      name: { type: 'string', required: true, description: 'The exact skill name from the available skills list.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', required: true },
          provider: { type: 'string', required: true },
          resourceBase: {
            oneOf: [
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  kind: { type: 'string', required: true, const: 'directory' },
                  path: { type: 'string', required: true },
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  kind: { type: 'string', required: true, const: 'url' },
                  url: { type: 'string', required: true },
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  kind: { type: 'string', required: true, const: 'opaque' },
                  description: { type: 'string', required: true },
                },
              },
            ],
          },
          content: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderSkillContent(value) }],
    },
    async execute(args, exec) {
      if (!isSkillName(args.name)) throw new Error(`invalid skill name "${args.name}"`)
      const entry = catalog.find((candidate) => candidate.name === args.name)
      if (entry === undefined) throw new Error(`skill "${args.name}" is unknown or no longer available`)
      const cwd = exec.agent?.session.header.cwd
      let content
      try {
        // MUTATION (PD-26 control only): the BASE fs regression — no lane, no
        // guard consult, the body of ANY declared path is returned.
        content = readFileSync(entry.path, 'utf8')
      } catch (error) {
        throw typedReadFailure(error)
      }
      return {
        name: entry.name,
        provider: 'a5sf-confined',
        resourceBase: { kind: 'directory', path: dirname(entry.path) },
        content: bodyOf(content),
      }
    },
    presentCall(args) {
      return { card: 'generic', title: `Load skill ${args.name}`, kind: 'read', rawInput: args.name }
    },
  }))
}
