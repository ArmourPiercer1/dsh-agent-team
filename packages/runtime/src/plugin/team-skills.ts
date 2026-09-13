/**
 * TeamSkillsProvider — the dsh-agent-team plugin's BUNDLED skills (plugin-
 * attached skills, installed with the plugin, no separate copy step).
 *
 * Mechanism (public seams only, CORE PATCH BUDGET = 0): the host entry calls
 * {@link registerTeamSkills} at the top of `apply()`. It registers a
 * same-process provider on the DSH `skills` public service (the
 * `SkillRegistry` provider registry — `registerProvider`, the same seam the
 * stock `skill-filesystem` provider uses) and serves the two team skills
 * that ship inside the installed package under `.agents/skills/` (the root
 * `package.json` `files` whitelist keeps that directory on the git-install
 * surface). The registration is an effect of the row's fiber: when the row
 * stops or the plugin is removed, the provider (and its skills) disappear
 * with it.
 *
 * Degradation is loud and never blocks the team core:
 *
 *   - the `skills` service absent or malformed at apply time (a composition
 *     without the skill row) -> one console.warn, the core proceeds;
 *   - no bundled skills directory resolvable from the host entry's own
 *     location (install-surface anomaly) -> one console.warn, the core
 *     proceeds;
 *   - an individual SKILL.md with unusable frontmatter -> one console.warn
 *     per file, the rest of the directory still serves.
 *
 * Precedence: candidates carry rank 550 — above every user-controlled
 * filesystem root (project 100/200, custom 300, user 400/500) and below the
 * DSH-bundled trusted root (600): a same-named skill in any user root wins
 * over the plugin's copy, and the stock bundled skills win over ours.
 *
 * Directory contract: one subdirectory per skill, each carrying a
 * `SKILL.md` whose YAML frontmatter carries a kebab-case `name` and a
 * non-empty `description` (optional `whenToUse`, `disable-model-invocation`,
 * `user-invocable`). The directory is RESCANNED on every `list()` call —
 * the same stateless convention as the blueprint saved-source index (no
 * watcher, no cache); a directory absent at scan time is the documented
 * "empty" state.
 *
 * @module @dsh-agent-team/runtime/src/plugin/team-skills
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { sep } from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'

/** The provider name (and the `provider` field on every candidate). */
export const TEAM_SKILLS_PROVIDER = 'dsh-agent-team'
/** The discovery source label (prompt-visible metadata, not precedence). */
export const TEAM_SKILLS_SOURCE = 'dsh-agent-team'
/**
 * Candidate rank: above user roots (100/200/300/400/500), below the
 * DSH-bundled trusted root (600) — see the module doc.
 */
export const TEAM_SKILLS_RANK = 550

/** The public skill-name grammar (kebab-case, as enforced by the registry). */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Opaque provider-owned locator: one bundled SKILL.md under the skills dir. */
export interface TeamSkillsLocator {
  /** The skills root directory this provider serves. */
  readonly dir: string
  /** The skill name (the frontmatter `name`, conventionally the dir name). */
  readonly name: string
  /** The absolute SKILL.md path (fenced to the provider's own dir). */
  readonly file: string
}

/** Invocation policy for one bundled skill (both surfaces by default). */
export interface TeamSkillsInvocation {
  readonly modelInvocable: boolean
  readonly userInvocable: boolean
}

/** Registry-facing summary for one bundled skill candidate. */
export interface TeamSkillsSummary {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly invocation: TeamSkillsInvocation
  readonly source: string
  readonly provider: string
}

/** Registry-facing candidate (summary + rank + opaque locator + path). */
export interface TeamSkillsCandidate extends TeamSkillsSummary {
  readonly rank: number
  readonly locator: TeamSkillsLocator
  readonly path: string
}

/** Registry-facing complete definition (summary + full file content). */
export interface TeamSkillsDefinition extends TeamSkillsSummary {
  readonly content: string
  readonly path: string
  readonly resourceBase: { readonly kind: 'directory'; readonly path: string }
}

/** The provider shape the `skills` registry consumes (structural mirror). */
export interface TeamSkillsProvider {
  readonly name: string
  readonly list: (options?: unknown) => Promise<readonly TeamSkillsCandidate[]>
  readonly get: (candidate: TeamSkillsCandidate, options?: unknown) => Promise<TeamSkillsDefinition | undefined>
}

/** The minimal context surface the wiring consumes (no Cordis types). */
export interface TeamSkillsContext {
  get(name: string): unknown
}

/** The directory-entry subset the provider consumes (stable Node fs surface). */
interface SkillsDirent {
  readonly name: string
  isDirectory(): boolean
}

/** Parsed, validated frontmatter of one bundled SKILL.md (or undefined). */
interface ParsedFrontmatter {
  readonly name?: string
  readonly description?: string
  readonly whenToUse?: string
  readonly invocation: TeamSkillsInvocation
}

/**
 * Resolve the bundled skills directory from the host entry's own module
 * URL (layout-agnostic candidate search, production layout FIRST — the
 * same convention as the glue/seam/upstream-resolver URL derivation):
 *
 *   1. installed/production layout — the built entry at
 *      `<root>/packages/runtime/dist/packages/runtime/src/plugin/host.js`:
 *      seven levels up is the installed package root;
 *   2. source layout — the entry at `<root>/packages/runtime/src/plugin/host.ts`
 *      (test worlds): four levels up is the repository root.
 *
 * The first candidate that exists as a directory wins; `undefined` when
 * none exists (the caller warns loudly).
 * @param entryUrl - the host entry's `import.meta.url`.
 * @returns the resolved skills directory, or undefined.
 */
export function resolveTeamSkillsDir(entryUrl: string): string | undefined {
  const candidates = [
    new URL('../../../../../../../.agents/skills', entryUrl).href,
    new URL('../../../../.agents/skills', entryUrl).href,
  ]
  for (const href of candidates) {
    try {
      const dir = fileURLToPath(href)
      if (existsSync(dir) && statSync(dir).isDirectory()) {
        return dir
      }
    } catch {
      // An undecodable candidate URL (non-file scheme in a synthetic test
      // world) simply loses to the next candidate.
    }
  }
  return undefined
}

/**
 * Split and parse the leading YAML frontmatter of one SKILL.md.
 * Total over content: any structural or type violation yields `undefined`
 * (the caller warns and skips the file — one broken bundled skill must not
 * take the rest of the directory down).
 * @param text - the full file text.
 * @returns the parsed frontmatter, or undefined when unusable.
 */
function parseSkillFrontmatter(text: string): ParsedFrontmatter | undefined {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return undefined
  let close = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      close = i
      break
    }
  }
  if (close === -1) return undefined
  let data: unknown
  try {
    data = parseYaml(lines.slice(1, close).join('\n'))
  } catch {
    return undefined
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined
  const record = data as Record<string, unknown>
  const stringField = (key: string): string | undefined =>
    typeof record[key] === 'string' && (record[key] as string).length > 0 ? (record[key] as string) : undefined
  const booleanField = (key: string): boolean | undefined =>
    typeof record[key] === 'boolean' ? (record[key] as boolean) : undefined
  return {
    name: stringField('name'),
    description: stringField('description'),
    whenToUse: stringField('whenToUse'),
    invocation: {
      modelInvocable: booleanField('disable-model-invocation') === true ? false : true,
      userInvocable: booleanField('user-invocable') === false ? false : true,
    },
  }
}

/** Build the summary from a parsed frontmatter (name/description set). */
function summaryOf(fm: ParsedFrontmatter, name: string, description: string): TeamSkillsSummary {
  const summary: TeamSkillsSummary = {
    name,
    description,
    invocation: fm.invocation,
    source: TEAM_SKILLS_SOURCE,
    provider: TEAM_SKILLS_PROVIDER,
  }
  if (fm.whenToUse !== undefined) {
    ;(summary as { whenToUse?: string }).whenToUse = fm.whenToUse
  }
  return summary
}

/**
 * Create the bundled-skills provider over one directory.
 * @param dir - the absolute skills root (one subdirectory + SKILL.md each).
 * @returns the provider (list rescans per call; get is locator-fenced).
 */
export function createTeamSkillsProvider(dir: string): TeamSkillsProvider {
  const fence = dir.endsWith(sep) ? dir : dir + sep
  return {
    name: TEAM_SKILLS_PROVIDER,
    async list(): Promise<readonly TeamSkillsCandidate[]> {
      let entries: SkillsDirent[]
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        // The directory is absent at scan time: the documented "empty"
        // state (a deleted install surface degrades, it never throws).
        return []
      }
      const out: TeamSkillsCandidate[] = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const file = dir + sep + entry.name + sep + 'SKILL.md'
        let text: string
        try {
          if (!existsSync(file)) continue
          text = readFileSync(file, 'utf8')
        } catch {
          continue
        }
        const fm = parseSkillFrontmatter(text)
        if (fm === undefined || fm.name === undefined || fm.description === undefined) {
          console.warn(
            `[dsh-agent-team] bundled team skill "${entry.name}" skipped: SKILL.md frontmatter must carry a kebab-case "name" and a non-empty "description"`,
          )
          continue
        }
        if (!SKILL_NAME_PATTERN.test(fm.name)) {
          console.warn(
            `[dsh-agent-team] bundled team skill "${entry.name}" skipped: the frontmatter name ${JSON.stringify(fm.name)} is not a valid kebab-case skill name`,
          )
          continue
        }
        out.push({
          ...summaryOf(fm, fm.name, fm.description),
          rank: TEAM_SKILLS_RANK,
          locator: { dir, name: fm.name, file },
          path: file,
        })
      }
      out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      return out
    },
    async get(candidate: TeamSkillsCandidate): Promise<TeamSkillsDefinition | undefined> {
      // Locator fence: only this provider's own directory may be served.
      if (candidate.locator.dir !== dir || !candidate.locator.file.startsWith(fence)) {
        return undefined
      }
      let text: string
      try {
        text = readFileSync(candidate.locator.file, 'utf8')
      } catch {
        return undefined // no longer loadable (deleted between list and get)
      }
      const fm = parseSkillFrontmatter(text)
      if (fm === undefined || fm.name === undefined || fm.description === undefined) {
        return undefined
      }
      return {
        ...summaryOf(fm, fm.name, fm.description),
        content: text,
        path: candidate.locator.file,
        resourceBase: { kind: 'directory', path: dir },
      }
    },
  }
}

/**
 * Register the bundled team skills on the `skills` public service. Called
 * exactly once from the host entry's `apply()` (the row's fiber) — the
 * provider registration is an effect of that fiber, so a row stop or plugin
 * removal disposes it.
 *
 * Absent/malformed service or unresolvable directory -> a loud console.warn
 * and a clean return (the team core never blocks on the skills add-on). The
 * function is TOTAL: it never rejects (the caller fires it and forgets it
 * from the sync apply body), degrading through console output instead.
 *
 * Note: the `registerProvider` call itself runs synchronously in the first
 * microtask before the body's only await (the count read), so the provider
 * is live on the row's fiber the moment apply reaches the call.
 * @param ctx - the plugin context (structural `get` surface).
 * @param entryUrl - the host entry's `import.meta.url`.
 * @returns true when the provider was registered.
 */
export async function registerTeamSkills(ctx: TeamSkillsContext, entryUrl: string): Promise<boolean> {
  try {
    const skills = ctx.get('skills') as
      | { readonly registerProvider?: (create: () => TeamSkillsProvider) => void }
      | null
      | undefined
    if (skills === undefined || skills === null || typeof skills.registerProvider !== 'function') {
      console.warn(
        '[dsh-agent-team] the "skills" public service is absent (or malformed) at apply time — the bundled team skills are NOT registered (composition without the skill row); the team core proceeds',
      )
      return false
    }
    const dir = resolveTeamSkillsDir(entryUrl)
    if (dir === undefined) {
      console.warn(
        '[dsh-agent-team] no bundled skills directory is resolvable from the host entry location — the bundled team skills are NOT registered (install-surface anomaly); the team core proceeds',
      )
      return false
    }
    const provider = createTeamSkillsProvider(dir)
    skills.registerProvider(() => provider)
    let count: number | undefined
    try {
      count = (await provider.list()).length
    } catch {
      // A list failure at registration time does not un-register the
      // provider (the registry surfaces it per lookup); keep the count
      // unknown in the observation line.
    }
    console.info(
      `[dsh-agent-team] registered ${count ?? '?'} bundled team skill(s) from ${dir} (source "${TEAM_SKILLS_SOURCE}", provider "${TEAM_SKILLS_PROVIDER}", rank ${TEAM_SKILLS_RANK})`,
    )
    return true
  } catch (error: unknown) {
    console.warn(
      `[dsh-agent-team] bundled team skills registration failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return false
  }
}
