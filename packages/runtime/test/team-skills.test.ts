/**
 * team-skills — the bundled (plugin-attached) team skill provider.
 *
 * Pinned (team-skills-provider task, 2026-09-13):
 *   S1 · unit — `createTeamSkillsProvider` over a fixture directory:
 *     frontmatter parsing (name/description/whenToUse/invocation flags,
 *     CRLF-normalized), the full candidate shape (rank 550,
 *     source/provider 'dsh-agent-team', opaque locator, absolute path),
 *     sorted output, the per-file skip rules (missing description /
 *     malformed name / no SKILL.md / flat file), `get()` body +
 *     resourceBase + locator fence, missing directory = empty (total).
 *   S2 · layout — `resolveTeamSkillsDir` candidate math: the source
 *     layout (repo root from `packages/runtime/src/plugin/host.ts`) and
 *     the installed dist layout (package root six levels above
 *     `packages/runtime/dist/packages/runtime/src/plugin/host.js`), and
 *     neither present -> undefined.
 *   S3 · real registry — the REAL `@deepseek-ai/dsh-skill` SkillRegistry
 *     service: `registerTeamSkills` serves the repository's own
 *     `.agents/skills` (the two committed skills) through the public
 *     service surface (list + get).
 *   S4 · lifecycle + degradation — fiber disposal removes the provider
 *     (HMR safety); absent skills service and unresolvable directory both
 *     degrade to `false` + a loud warn, never a throw.
 *
 * Constraints (repo test protocol): every async scenario runs at MODULE
 * level (top-level await) and captures its results; the `it` bodies are
 * pure synchronous assertions over the captured results; matchers are the
 * audited shim surface (toBe/toEqual here).
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import {
  TEAM_SKILLS_PROVIDER,
  TEAM_SKILLS_RANK,
  TEAM_SKILLS_SOURCE,
  createTeamSkillsProvider,
  registerTeamSkills,
  resolveTeamSkillsDir,
} from '../src/plugin/team-skills.js'

const here = dirname(fileURLToPath(import.meta.url))
/** The repository root's skills directory (the real install-surface content). */
const repoSkillsDir = join(here, '..', '..', '..', '.agents', 'skills')
/** The host entry in the source layout (candidate 2 of the resolution). */
const sourceEntryUrl = pathToFileURL(join(here, '..', 'src', 'plugin', 'host.ts')).href
/** A unique-per-process run id for the temp fixture roots (no shim `pid`). */
const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Build one fixture skills root: 3 valid + 3 invalid/ignored shapes. */
function makeFixtureRoot(tag: string): string {
  const dir = join(tmpdir(), `team-skills-test-${tag}-${runId}`)
  const write = (rel: string, text: string): void => {
    const file = join(dir, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
  write(
    'good-alpha/SKILL.md',
    '---\nname: good-alpha\ndescription: First fixture skill.\nwhenToUse: When fixture-alpha applies.\n---\nAlpha body.\n',
  )
  write('good-beta/SKILL.md', '---\nname: good-beta\ndescription: Second fixture skill.\n---\nBeta body.\n')
  write(
    'flagged/SKILL.md',
    '---\r\nname: flagged\r\ndescription: CRLF fixture with invocation flags.\r\ndisable-model-invocation: true\r\nuser-invocable: false\r\n---\r\nFlagged body.\r\n',
  )
  write('missing-description/SKILL.md', '---\nname: missing-description\n---\nNo description.\n')
  write('bad-name/SKILL.md', '---\nname: Bad_Name\ndescription: Grammar violation.\n---\nBad body.\n')
  write('empty-dir/readme.txt', 'no SKILL.md here.\n')
  write('stray.txt', 'flat file — not a skill directory.\n')
  return dir
}

// ===========================================================================
// MODULE-LEVEL SCENARIO DRIVER (top-level await — the shim constraint).
// Every scenario is TOTAL (never throws at module level).
// ===========================================================================

const R: Record<string, unknown> = await (async () => {
  const out: Record<string, unknown> = {}
  const fixtureDir = makeFixtureRoot('fixture')
  const distRoot = join(tmpdir(), `team-skills-test-distroot-${runId}`)
  const noneRoot = join(tmpdir(), `team-skills-test-none-${runId}`, 'a', 'b')
  try {
    // ------------------------------------------------------------------
    // S1 · unit — the provider over a fixture directory.
    // ------------------------------------------------------------------
    const provider = createTeamSkillsProvider(fixtureDir)
    out['s1-provider-name'] = provider.name
    const listed = await provider.list()
    out['s1-names'] = listed.map((c) => c.name)
    const alpha = listed.find((c) => c.name === 'good-alpha')
    out['s1-alpha'] =
      alpha === undefined
        ? undefined
        : {
            description: alpha.description,
            whenToUse: alpha.whenToUse,
            invocation: alpha.invocation,
            source: alpha.source,
            provider: alpha.provider,
            rank: alpha.rank,
            path: alpha.path,
            locator: alpha.locator,
          }
    const flagged = listed.find((c) => c.name === 'flagged')
    out['s1-flagged-invocation'] = flagged === undefined ? undefined : flagged.invocation
    const alphaDef = alpha !== undefined ? await provider.get(alpha) : undefined
    out['s1-alpha-def'] =
      alphaDef === undefined
        ? undefined
        : {
            contentHead: alphaDef.content.slice(0, 20),
            contentEnds: alphaDef.content.endsWith('Alpha body.\n'),
            path: alphaDef.path,
            resourceBase: alphaDef.resourceBase,
            provider: alphaDef.provider,
            source: alphaDef.source,
          }
    out['s1-foreign-undefined'] =
      alpha !== undefined
        ? (await provider.get({ ...alpha, locator: { dir: '/foreign', name: 'good-alpha', file: '/foreign/SKILL.md' } })) === undefined
        : undefined
    out['s1-missing-dir'] = await createTeamSkillsProvider(join(tmpdir(), `team-skills-test-absent-${runId}`)).list()

    // ------------------------------------------------------------------
    // S2 · layout — the candidate math of resolveTeamSkillsDir.
    // ------------------------------------------------------------------
    out['s2-source'] = resolveTeamSkillsDir(sourceEntryUrl)
    mkdirSync(join(distRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin'), { recursive: true })
    writeFileSync(
      join(distRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
      '// fake installed entry\n',
    )
    mkdirSync(join(distRoot, '.agents', 'skills'), { recursive: true })
    const distEntryUrl = pathToFileURL(
      join(distRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
    ).href
    out['s2-dist'] = resolveTeamSkillsDir(distEntryUrl)
    mkdirSync(noneRoot, { recursive: true })
    const noneEntryUrl = pathToFileURL(join(noneRoot, 'x.js')).href
    out['s2-none'] = resolveTeamSkillsDir(noneEntryUrl)

    // ------------------------------------------------------------------
    // S3 · the REAL SkillRegistry — registerTeamSkills over the repo's
    // own .agents/skills (the two committed skills).
    // ------------------------------------------------------------------
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    let skillsSvc:
      | {
          readonly list: (options?: unknown) => Promise<
            readonly { readonly name: string; readonly provider: string; readonly source: string }[]
          >
          readonly get: (name: string) => Promise<{
            readonly name: string
            readonly provider: string
            readonly content: string
            readonly resourceBase?: { readonly kind: string; readonly path: string }
          } | undefined>
        }
      | undefined
    await ctx.plugin((inner: Context) => {
      skillsSvc = inner.get('skills') as typeof skillsSvc
    })
    const regFiber = await ctx.plugin((inner: Context) => {
      void registerTeamSkills(inner, sourceEntryUrl)
    })
    const listed3 = await skillsSvc?.list()
    out['s3-names'] = listed3 === undefined ? undefined : listed3.map((s) => s.name)
    out['s3-provider-fields'] =
      listed3 === undefined ? undefined : listed3.map((s) => ({ provider: s.provider, source: s.source }))
    const def3 = await skillsSvc?.get('team-leader-operations')
    out['s3-get'] =
      def3 === undefined
        ? undefined
        : {
            name: def3.name,
            provider: def3.provider,
            contentHead: def3.content.slice(0, 20),
            resourceBase: def3.resourceBase,
          }
    out['s3-repo-dir-served'] =
      def3 === undefined ? undefined : def3.resourceBase?.path === repoSkillsDir ? true : false

    // ------------------------------------------------------------------
    // S4 · lifecycle (fiber disposal removes the provider) + degradation
    // legs (absent service / unresolvable directory -> false, total).
    // ------------------------------------------------------------------
    await regFiber.dispose()
    const listed4 = await skillsSvc?.list()
    out['s4-names-after-dispose'] = listed4 === undefined ? undefined : listed4.map((s) => s.name)
    out['s4-team-skills-gone'] =
      listed4 === undefined ? undefined : !listed4.some((s) => s.provider === TEAM_SKILLS_PROVIDER)

    const bareCtx = new Context()
    out['s4-no-service'] = await registerTeamSkills(bareCtx, sourceEntryUrl)
    const ctx3 = new Context()
    await ctx3.plugin(SkillRegistry)
    out['s4-no-dir'] = await registerTeamSkills(ctx3, noneEntryUrl)
    void ctx3
    void bareCtx
  } finally {
    for (const dir of [fixtureDir, distRoot, join(tmpdir(), `team-skills-test-none-${runId}`)]) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  return out
})()

describe('team-skills — bundled team skill provider (real SkillRegistry)', () => {
  it('S0 · the frozen provider constants', () => {
    expect(TEAM_SKILLS_PROVIDER).toBe('dsh-agent-team')
    expect(TEAM_SKILLS_SOURCE).toBe('dsh-agent-team')
    expect(TEAM_SKILLS_RANK).toBe(550)
    expect(R['s1-provider-name']).toBe('dsh-agent-team')
  })

  it('S1a · lists exactly the valid fixture skills (sorted; the three invalid shapes skipped)', () => {
    expect(R['s1-names']).toEqual(['flagged', 'good-alpha', 'good-beta'])
  })

  it('S1b · the candidate shape (summary + rank + opaque locator + absolute path)', () => {
    const fixtureDir = join(tmpdir(), `team-skills-test-fixture-${runId}`)
    const alpha = R['s1-alpha'] as Record<string, unknown> | undefined
    expect(alpha !== undefined).toBe(true)
    if (alpha === undefined) return
    expect(alpha.description).toBe('First fixture skill.')
    expect(alpha.whenToUse).toBe('When fixture-alpha applies.')
    expect(alpha.invocation).toEqual({ modelInvocable: true, userInvocable: true })
    expect(alpha.source).toBe(TEAM_SKILLS_SOURCE)
    expect(alpha.provider).toBe(TEAM_SKILLS_PROVIDER)
    expect(alpha.rank).toBe(TEAM_SKILLS_RANK)
    expect(alpha.path).toBe(join(fixtureDir, 'good-alpha', 'SKILL.md'))
    expect(alpha.locator).toEqual({
      dir: fixtureDir,
      name: 'good-alpha',
      file: join(fixtureDir, 'good-alpha', 'SKILL.md'),
    })
  })

  it('S1c · the invocation flags parse (CRLF frontmatter, both surfaces controllable)', () => {
    expect(R['s1-flagged-invocation']).toEqual({ modelInvocable: false, userInvocable: false })
  })

  it('S1d · get() serves the full file as content + the directory resourceBase, and fences foreign locators', () => {
    const fixtureDir = join(tmpdir(), `team-skills-test-fixture-${runId}`)
    const def = R['s1-alpha-def'] as Record<string, unknown> | undefined
    expect(def !== undefined).toBe(true)
    if (def === undefined) return
    expect(def.contentHead).toBe('---\nname: good-alpha')
    expect(def.contentEnds).toBe(true)
    expect(def.path).toBe(join(fixtureDir, 'good-alpha', 'SKILL.md'))
    expect(def.resourceBase).toEqual({ kind: 'directory', path: fixtureDir })
    expect(def.provider).toBe(TEAM_SKILLS_PROVIDER)
    expect(def.source).toBe(TEAM_SKILLS_SOURCE)
    expect(R['s1-foreign-undefined']).toBe(true)
  })

  it('S1e · a missing directory is the empty state (total, never throws)', () => {
    expect(R['s1-missing-dir']).toEqual([])
  })

  it('S2 · the layout candidate math (source layout, installed dist layout, neither)', () => {
    const distRoot = join(tmpdir(), `team-skills-test-distroot-${runId}`)
    expect(R['s2-source']).toBe(repoSkillsDir)
    expect(R['s2-dist']).toBe(join(distRoot, '.agents', 'skills'))
    expect(R['s2-none']).toBe(undefined)
  })

  it('S3 · the REAL registry serves the two committed skills through the public surface', () => {
    expect(existsSync(repoSkillsDir)).toBe(true)
    expect(R['s3-names']).toEqual(['team-blueprint-authoring', 'team-leader-operations'])
    expect(R['s3-provider-fields']).toEqual([
      { provider: TEAM_SKILLS_PROVIDER, source: TEAM_SKILLS_SOURCE },
      { provider: TEAM_SKILLS_PROVIDER, source: TEAM_SKILLS_SOURCE },
    ])
    const def = R['s3-get'] as Record<string, unknown> | undefined
    expect(def !== undefined).toBe(true)
    if (def === undefined) return
    expect(def.name).toBe('team-leader-operations')
    expect(def.provider).toBe(TEAM_SKILLS_PROVIDER)
    expect(def.contentHead).toBe('---\nname: team-leade')
    expect(def.resourceBase).toEqual({ kind: 'directory', path: repoSkillsDir })
    expect(R['s3-repo-dir-served']).toBe(true)
  })

  it('S4 · fiber disposal removes the provider (HMR safety); degradation legs are total', () => {
    expect(R['s4-names-after-dispose']).toEqual([])
    expect(R['s4-team-skills-gone']).toBe(true)
    expect(R['s4-no-service']).toBe(false)
    expect(R['s4-no-dir']).toBe(false)
  })
})
