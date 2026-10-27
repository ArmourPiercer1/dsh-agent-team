/**
 * inspect-family/src/skill-row.mjs — the governed `team_skill` row
 * Definition (plain Definition transport, the fs fixed-native precedent:
 * this row does NOT ride the a5p5 trio face).
 *
 * The same-meaning law: the value shape and the rendered envelope mirror
 * the native loader (tool-skill/src/index.ts @639ed01539 — {name, provider,
 * resourceBase?, content} rendered through the <skill_content> frame), so a
 * caller reading the governed row reads the same KIND of fact; the governed
 * row differs where the lane law says it must (sanctioned roots only, typed
 * refusals, PA admission before the read). Disclosed deviations:
 * `provider:'filesystem'` (the governed loader reads files; the layered
 * runtime-registered providers are the host service's world), the 256 KiB
 * file bound, and the flat frontmatter subset.
 *
 * @module inspect-family/skill-row
 */
import { escapeSkillAttr, escapeSkillText } from './skill-mechanics.mjs'
import { SKILL_ROW_NAME } from './row-names.mjs'

export const SKILL_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      name: Object.freeze({ type: 'string' }),
      provider: Object.freeze({ type: 'string' }),
      resourceBase: Object.freeze({
        oneOf: Object.freeze([
          Object.freeze({
            type: 'object',
            properties: Object.freeze({
              kind: Object.freeze({ type: 'string', const: 'directory' }),
              path: Object.freeze({ type: 'string' }),
            }),
            required: Object.freeze(['kind', 'path']),
            additionalProperties: false,
          }),
        ]),
      }),
      content: Object.freeze({ type: 'string' }),
    }),
    required: Object.freeze(['name', 'provider', 'content']),
    additionalProperties: false,
  }),
  /** Mirror of the native renderSkillContent envelope (skill/src/index.ts
   *  :170-183 @639ed01539) for the directory resource-base form this row
   *  answers with. */
  render: (_args, value) => [{
    type: 'text',
    text: [
      `<skill_content name="${escapeSkillAttr(value?.name ?? '')}">`,
      '<skill_resources>',
      `Base directory for this skill: ${escapeSkillText(value?.resourceBase?.path ?? '')}`,
      'Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.',
      '</skill_resources>',
      '',
      '<skill_instructions>',
      String(value?.content ?? ''),
      '</skill_instructions>',
      '</skill_content>',
    ].join('\n'),
  }],
})

export function buildSkillRowDefinition({ skillExecutor, skillName = SKILL_ROW_NAME }) {
  return Object.freeze({
    name: skillName,
    description: 'Load the full instructions for a skill, governed: reads only the host-sanctioned skill root(s) this mount configures, resolves the name through the anchor law (no parent segments, no symlink escape), and refuses unknown skills. Call it before acting on a task that names or clearly matches a skill in the session skill catalog.',
    parameters: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        name: Object.freeze({ type: 'string', description: 'The exact skill name from the available skills list.' }),
      }),
      required: Object.freeze(['name']),
      additionalProperties: false,
    }),
    // Transport law (the write row's): SUCCESS returns the value; a
    // CANCELLED invocation is a presented row-form fact; a refusal becomes
    // a THROW of its verbatim refusal text.
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        ...(exec?.agent === undefined ? {} : { agent: exec.agent }),
      }
      const outcome = await skillExecutor(raw ?? {}, corr)
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') return outcome.value
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'team_skill · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed skill executor produced no outcome'
      throw new Error(text)
    },
    output: SKILL_ROW_PRESENTATION_FACE,
  })
}
