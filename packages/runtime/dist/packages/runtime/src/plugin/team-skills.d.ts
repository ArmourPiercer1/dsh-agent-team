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
/** The provider name (and the `provider` field on every candidate). */
export declare const TEAM_SKILLS_PROVIDER = "dsh-agent-team";
/** The discovery source label (prompt-visible metadata, not precedence). */
export declare const TEAM_SKILLS_SOURCE = "dsh-agent-team";
/**
 * Candidate rank: above user roots (100/200/300/400/500), below the
 * DSH-bundled trusted root (600) — see the module doc.
 */
export declare const TEAM_SKILLS_RANK = 550;
/** Opaque provider-owned locator: one bundled SKILL.md under the skills dir. */
export interface TeamSkillsLocator {
    /** The skills root directory this provider serves. */
    readonly dir: string;
    /** The skill name (the frontmatter `name`, conventionally the dir name). */
    readonly name: string;
    /** The absolute SKILL.md path (fenced to the provider's own dir). */
    readonly file: string;
}
/** Invocation policy for one bundled skill (both surfaces by default). */
export interface TeamSkillsInvocation {
    readonly modelInvocable: boolean;
    readonly userInvocable: boolean;
}
/** Registry-facing summary for one bundled skill candidate. */
export interface TeamSkillsSummary {
    readonly name: string;
    readonly description: string;
    readonly whenToUse?: string;
    readonly invocation: TeamSkillsInvocation;
    readonly source: string;
    readonly provider: string;
}
/** Registry-facing candidate (summary + rank + opaque locator + path). */
export interface TeamSkillsCandidate extends TeamSkillsSummary {
    readonly rank: number;
    readonly locator: TeamSkillsLocator;
    readonly path: string;
}
/** Registry-facing complete definition (summary + full file content). */
export interface TeamSkillsDefinition extends TeamSkillsSummary {
    readonly content: string;
    readonly path: string;
    readonly resourceBase: {
        readonly kind: 'directory';
        readonly path: string;
    };
}
/** The provider shape the `skills` registry consumes (structural mirror). */
export interface TeamSkillsProvider {
    readonly name: string;
    readonly list: (options?: unknown) => Promise<readonly TeamSkillsCandidate[]>;
    readonly get: (candidate: TeamSkillsCandidate, options?: unknown) => Promise<TeamSkillsDefinition | undefined>;
}
/** The minimal context surface the wiring consumes (no Cordis types). */
export interface TeamSkillsContext {
    get(name: string): unknown;
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
export declare function resolveTeamSkillsDir(entryUrl: string): string | undefined;
/**
 * Create the bundled-skills provider over one directory.
 * @param dir - the absolute skills root (one subdirectory + SKILL.md each).
 * @returns the provider (list rescans per call; get is locator-fenced).
 */
export declare function createTeamSkillsProvider(dir: string): TeamSkillsProvider;
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
export declare function registerTeamSkills(ctx: TeamSkillsContext, entryUrl: string): Promise<boolean>;
//# sourceMappingURL=team-skills.d.ts.map