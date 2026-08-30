/**
 * P7-T6 — Legacy `.dsh/teammates` one-time Blueprint import adapter.
 *
 * Authority (frozen docs, in precedence order):
 * - Development Plan §20.6: `.dsh/teammates` is a LEGACY INPUT ADAPTER ONLY.
 *   The adapter parses the directory once, validates it, and produces a
 *   snapshot (a new TeamBlueprint). The directory is never observed again:
 *   no watcher, no re-read, no live runtime authority of any kind. The
 *   imported blueprint controls nothing that already exists; legacy team
 *   state stays read-only (invariant 65) and is never auto-migrated.
 * - Development Plan §4.3: parser mechanics are MIGRATE/REFACTOR, the old
 *   member schema is REPLACE, and the live cwd watcher is DELETE.
 * - Development Plan §9.8: the legacy package maps `.dsh/teammates` to a
 *   legacy workspace team blueprint and carries no live runtime.
 *
 * Semantics ported from the frozen legacy team-local parser (references/,
 * read-only evidence): one `.md` file is one member definition (YAML
 * frontmatter + persona body); files are processed in sorted file-name
 * order; duplicate ids are last-wins; when several leaders survive dedup,
 * the last discovered leader is kept and the others are dropped.
 *
 * vNext hardening (deviations from legacy leniency, all fail-loud):
 * - an empty persona body is an error (vNext templates require a
 *   non-empty persona; legacy only warned);
 * - the whole import is all-or-nothing: any legacy error condition aborts
 *   the entire import, whereas legacy skipped the broken file and kept the
 *   rest;
 * - a legacy id that is not a valid vNext template slug fails with the
 *   vNext `INVALID_TEMPLATE_ID` code at document validation.
 *
 * The importer supplies the vNext identity that legacy files do not carry:
 * `blueprintId` + `revision` (the snapshot is identified by blueprintId +
 * revision + contentHash, Architecture §5.2). Unmapped legacy fields are
 * preserved losslessly as inert `legacy.*` metadata (JSON strings); the
 * vNext metadata value bound (4096 chars) is enforced by the blueprint
 * validator, so an oversized extras blob fails loudly instead of being
 * truncated.
 *
 * Dependencies: contracts v1 + the P3-T2 blueprint public surface
 * (filesystem access lives in the separate `teammates-adapter-fs.mjs`
 * seam; this module is pure).
 *
 * @module @dsh-agent-team/legacy/teammates-adapter
 */

import { teamContractError } from '../contracts/src/index.js'
import {
  decodeYamlFrontmatter,
  deriveContentHash,
  toHashableBlueprint,
  validateBlueprintDocument,
} from '../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../domain/blueprint/src/index.js'

const BOM = '\uFEFF'
const FRONTMATTER_DELIMITER = '---'
const SUPPORTED_LEGACY_SCHEMA_VERSION = 1
const LEGACY_ROLES: readonly string[] = ['leader', 'teammate']
const LEGACY_CONTEXT_POLICIES: readonly string[] = ['persistent', 'fresh_per_delegation']
const LEGACY_PERMISSION_MODES: readonly string[] = ['enforce', 'default']
const LEGACY_PERMISSION_KINDS: readonly string[] = ['deny', 'ask', 'allow']

/** One raw legacy teammate file (the import input unit). */
export interface LegacyTeammateEntry {
  /** Base name of the `.md` file: the sort key and diagnostic attribution. */
  readonly fileName: string
  /** Raw UTF-8 file content. */
  readonly content: string
}

/** Importer-supplied vNext identity for the produced blueprint. */
export interface LegacyTeammateOptions {
  /** Stable vNext logical identity (the importer owns this choice). */
  readonly blueprintId: string
  /** Human-readable revision (the importer owns this choice). */
  readonly revision: string
  /** Optional display name for the produced blueprint. */
  readonly displayName?: string
  /** Optional description for the produced blueprint. */
  readonly description?: string
}

/** A ported lenient diagnostic (never aborts the import). */
export interface LegacyTeammateWarning {
  readonly severity: 'warning'
  /** The file the warning is attributed to. */
  readonly fileName: string
  readonly message: string
}

/** The one-time import result: a fresh snapshot plus its warnings. */
export interface LegacyTeammateImport {
  /**
   * The freshly produced, deeply-frozen blueprint. It is a brand-new object
   * with the importer's identity; no pre-existing team state is read,
   * written, or referenced.
   */
  readonly blueprint: TeamBlueprint
  /** Ported lenient diagnostics (duplicate ids, extra leaders, unknown contextPolicy). */
  readonly warnings: readonly LegacyTeammateWarning[]
}

/** One parsed legacy teammate definition (pre-vNext-mapping schema). */
export interface LegacyTeammateDefinition {
  readonly fileName: string
  readonly id: string
  readonly role: 'leader' | 'teammate'
  readonly name: string
  readonly description: string
  readonly persona: string
  readonly provider?: string
  readonly model?: string
  readonly maxTokens?: number
  readonly tools?: { readonly allow?: readonly string[]; readonly deny?: readonly string[] }
  readonly requiresApproval?: readonly string[]
  readonly skills?: readonly string[]
  readonly mcpServers?: { readonly servers: readonly string[] }
  readonly permissions?: {
    readonly deny?: readonly string[]
    readonly ask?: readonly string[]
    readonly allow?: readonly string[]
  }
  readonly permissionMode?: 'enforce' | 'default'
  readonly contextPolicy?: 'persistent' | 'fresh_per_delegation'
}

/** Split frontmatter (validated, ported) plus the dropped unknown value. */
interface ParsedLegacyTeammate {
  readonly definition: LegacyTeammateDefinition
  /** Set when `contextPolicy` was present but not a known token (dropped). */
  readonly droppedContextPolicy?: string
}

interface LegacyFrontmatterSplit {
  readonly frontmatterText: string
  readonly body: string
}

function fail(fileName: string, reason: string, message: string): never {
  throw teamContractError('MALFORMED_DTO', message, { reason, file: fileName })
}

/**
 * Split one legacy teammate file into its YAML frontmatter text and persona
 * body. Mechanism ported from the frozen legacy parser, hardened with the
 * vNext frontmatter rules (BOM strip, CRLF normalization, exact `---`
 * delimiter lines).
 */
function splitLegacyFrontmatter(content: string, fileName: string): LegacyFrontmatterSplit {
  if (typeof content !== 'string') {
    return fail(fileName, 'source-not-string', `legacy teammate file '${fileName}' must be a string`)
  }
  let text = content
  if (text.startsWith(BOM)) text = text.slice(BOM.length)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const lines = text.split('\n')
  if ((lines[0] ?? '').trim() !== FRONTMATTER_DELIMITER) {
    return fail(
      fileName,
      'frontmatter-missing',
      `legacy teammate file '${fileName}' does not start with a --- frontmatter delimiter line`,
    )
  }
  let closingIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trimEnd() === FRONTMATTER_DELIMITER) {
      closingIndex = i
      break
    }
  }
  if (closingIndex < 0) {
    return fail(
      fileName,
      'frontmatter-unclosed',
      `legacy teammate file '${fileName}' frontmatter is not closed by a --- delimiter line`,
    )
  }
  return {
    frontmatterText: lines.slice(1, closingIndex).join('\n'),
    body: lines.slice(closingIndex + 1).join('\n').trim(),
  }
}

/**
 * Parse and validate one legacy teammate file. Every legacy error condition
 * throws `MALFORMED_DTO` with a `reason` detail and the source file name.
 * An unknown `contextPolicy` is dropped (ported leniency) and surfaced via
 * `droppedContextPolicy` so the importer can warn.
 */
function parseLegacyTeammateFile(content: string, fileName: string): ParsedLegacyTeammate {
  const { frontmatterText, body } = splitLegacyFrontmatter(content, fileName)
  const raw = decodeYamlFrontmatter(frontmatterText) // throws MALFORMED_DTO 'yaml-invalid'
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail(
      fileName,
      'frontmatter-not-mapping',
      `legacy teammate file '${fileName}' frontmatter must be a YAML mapping`,
    )
  }
  const fm = raw as Record<string, unknown>

  const schemaVersion = fm['schemaVersion']
  if (schemaVersion !== SUPPORTED_LEGACY_SCHEMA_VERSION) {
    return fail(
      fileName,
      'schema-version',
      `legacy teammate file '${fileName}' has unsupported schemaVersion ${String(schemaVersion)} (expected ${SUPPORTED_LEGACY_SCHEMA_VERSION})`,
    )
  }

  const id = fm['id']
  if (typeof id !== 'string' || id.length === 0) {
    return fail(fileName, 'missing-id', `legacy teammate file '${fileName}' is missing a non-empty string id`)
  }

  const role = fm['role']
  if (typeof role !== 'string' || !LEGACY_ROLES.includes(role)) {
    return fail(
      fileName,
      'invalid-role',
      `legacy teammate file '${fileName}' has invalid or missing role ${String(role)} (expected 'leader' | 'teammate')`,
    )
  }

  const name = fm['name']
  if (typeof name !== 'string' || name.length === 0) {
    return fail(fileName, 'missing-name', `legacy teammate file '${fileName}' is missing a non-empty string name`)
  }

  const description = fm['description']
  if (typeof description !== 'string' || description.length === 0) {
    return fail(
      fileName,
      'missing-description',
      `legacy teammate file '${fileName}' is missing a non-empty string description`,
    )
  }

  const persona = body
  if (persona.length === 0) {
    return fail(
      fileName,
      'empty-persona',
      `legacy teammate file '${fileName}' has an empty persona body (vNext templates require a non-empty persona)`,
    )
  }

  // Optional fields (ported legacy semantics).
  const provider = typeof fm['provider'] === 'string' ? (fm['provider'] as string) : undefined
  const model = typeof fm['model'] === 'string' ? (fm['model'] as string) : undefined
  const maxTokens = typeof fm['maxTokens'] === 'number' ? (fm['maxTokens'] as number) : undefined

  let tools: { allow?: readonly string[]; deny?: readonly string[] } | undefined
  const rawTools = fm['tools']
  if (rawTools != null && typeof rawTools === 'object' && !Array.isArray(rawTools)) {
    const t = rawTools as Record<string, unknown>
    tools = {
      ...(Array.isArray(t['allow']) ? { allow: (t['allow'] as unknown[]).map(String) } : {}),
      ...(Array.isArray(t['deny']) ? { deny: (t['deny'] as unknown[]).map(String) } : {}),
    }
  }

  let requiresApproval: readonly string[] | undefined
  const rawApproval = fm['requiresApproval']
  if (Array.isArray(rawApproval)) {
    requiresApproval = (rawApproval as unknown[]).map(String)
  }

  let skills: readonly string[] | undefined
  const rawSkills = fm['skills']
  if (rawSkills !== undefined) {
    if (!Array.isArray(rawSkills) || !rawSkills.every((s) => typeof s === 'string' && s.length > 0)) {
      return fail(
        fileName,
        'invalid-skills',
        `legacy teammate file '${fileName}' skills must be an array of non-empty strings`,
      )
    }
    skills = rawSkills as readonly string[]
  }

  let mcpServers: { servers: readonly string[] } | undefined
  const rawMcp = fm['mcpServers']
  if (rawMcp != null && typeof rawMcp === 'object' && !Array.isArray(rawMcp)) {
    const m = rawMcp as Record<string, unknown>
    if (Array.isArray(m['servers'])) {
      mcpServers = { servers: (m['servers'] as unknown[]).map(String) }
    }
  }

  let permissions: { deny?: readonly string[]; ask?: readonly string[]; allow?: readonly string[] } | undefined
  const rawPermissions = fm['permissions']
  if (rawPermissions !== undefined) {
    if (typeof rawPermissions !== 'object' || rawPermissions === null || Array.isArray(rawPermissions)) {
      return fail(
        fileName,
        'invalid-permissions',
        `legacy teammate file '${fileName}' permissions must be an object with deny, ask, and allow string arrays`,
      )
    }
    const p = rawPermissions as Record<string, unknown>
    const parsed: { deny?: readonly string[]; ask?: readonly string[]; allow?: readonly string[] } = {}
    for (const kind of LEGACY_PERMISSION_KINDS) {
      const list = p[kind]
      if (list === undefined) continue
      if (!Array.isArray(list) || list.some((item) => typeof item !== 'string' || item.length === 0)) {
        return fail(
          fileName,
          'invalid-permissions',
          `legacy teammate file '${fileName}' permissions.${kind} must be an array of non-empty strings`,
        )
      }
      if (list.length > 0) parsed[kind] = list as readonly string[]
    }
    if (parsed.deny !== undefined || parsed.ask !== undefined || parsed.allow !== undefined) {
      permissions = parsed
    }
  }

  let permissionMode: 'enforce' | 'default' | undefined
  const rawPermissionMode = fm['permissionMode']
  if (rawPermissionMode !== undefined) {
    if (typeof rawPermissionMode !== 'string' || !LEGACY_PERMISSION_MODES.includes(rawPermissionMode)) {
      return fail(
        fileName,
        'invalid-permission-mode',
        `legacy teammate file '${fileName}' permissionMode must be 'enforce' or 'default' (got ${String(rawPermissionMode)})`,
      )
    }
    permissionMode = rawPermissionMode as 'enforce' | 'default'
  }

  const rawCtxPolicy = fm['contextPolicy']
  let contextPolicy: 'persistent' | 'fresh_per_delegation' | undefined
  let droppedContextPolicy: string | undefined
  if (typeof rawCtxPolicy === 'string') {
    if (LEGACY_CONTEXT_POLICIES.includes(rawCtxPolicy)) {
      contextPolicy = rawCtxPolicy as 'persistent' | 'fresh_per_delegation'
    } else {
      droppedContextPolicy = rawCtxPolicy
    }
  }

  const definition: LegacyTeammateDefinition = {
    fileName,
    id,
    role: role as 'leader' | 'teammate',
    name,
    description,
    persona,
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(tools !== undefined ? { tools } : {}),
    ...(requiresApproval !== undefined ? { requiresApproval } : {}),
    ...(skills !== undefined ? { skills } : {}),
    ...(mcpServers !== undefined ? { mcpServers } : {}),
    ...(permissions !== undefined ? { permissions } : {}),
    ...(permissionMode !== undefined ? { permissionMode } : {}),
    ...(contextPolicy !== undefined ? { contextPolicy } : {}),
  }
  return droppedContextPolicy !== undefined
    ? { definition, droppedContextPolicy }
    : { definition }
}

/** The unmapped legacy optional fields, in fixed key order (deterministic JSON). */
function collectExtras(def: LegacyTeammateDefinition): Record<string, unknown> {
  const extras: Record<string, unknown> = {}
  if (def.provider !== undefined) extras.provider = def.provider
  if (def.maxTokens !== undefined) extras.maxTokens = def.maxTokens
  if (def.tools !== undefined) extras.tools = def.tools
  if (def.requiresApproval !== undefined) extras.requiresApproval = def.requiresApproval
  if (def.skills !== undefined) extras.skills = def.skills
  if (def.mcpServers !== undefined) extras.mcpServers = def.mcpServers
  if (def.permissions !== undefined) extras.permissions = def.permissions
  if (def.permissionMode !== undefined) extras.permissionMode = def.permissionMode
  return extras
}

/** Map one surviving legacy definition to a vNext blueprint template. */
function toTemplate(def: LegacyTeammateDefinition): Record<string, unknown> {
  const template: Record<string, unknown> = {
    templateId: def.id, // the vNext validator enforces the slug pattern
    displayName: def.name,
    description: def.description,
    persona: def.persona,
  }
  if (def.model !== undefined) template.modelPreference = def.model
  if (def.contextPolicy !== undefined) template.contextPolicy = def.contextPolicy
  return template
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key]
      if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
        deepFreeze(child)
      }
    }
    Object.freeze(value)
  }
  return value
}

/**
 * One-time import of a legacy `.dsh/teammates` directory into a NEW
 * vNext TeamBlueprint snapshot.
 *
 * Flow (Development Plan §20.6 "parse once → validate → snapshot"):
 * 1. parse + validate every entry (sorted by file name, legacy discovery
 *    order); any error aborts the whole import (all-or-nothing);
 * 2. deduplicate by legacy id (last wins) and resolve the leader (the last
 *    discovered leader survives; exactly one leader is required);
 * 3. map the survivors to vNext templates, preserving every unmapped legacy
 *    field in inert `legacy.*` metadata;
 * 4. validate the assembled document with the P3-T2 blueprint public
 *    surface, derive the content hash, and deep-freeze the snapshot.
 *
 * The produced blueprint is a fresh object; this function never reads or
 * writes pre-existing team state and holds no runtime authority.
 *
 * @param entries - the raw files of one legacy teammates directory.
 * @param options - the importer-supplied vNext identity (blueprintId + revision).
 * @returns the frozen blueprint snapshot plus the ported warnings.
 * @throws `TeamContractError` (closed codes) for every violation.
 */
export function importLegacyTeammates(
  entries: readonly LegacyTeammateEntry[],
  options: LegacyTeammateOptions,
): LegacyTeammateImport {
  const warnings: LegacyTeammateWarning[] = []

  if (!Array.isArray(entries) || entries.length === 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      'importLegacyTeammates received no teammate entries: a legacy teammates directory must contain at least one .md definition',
      { reason: 'no-entries' },
    )
  }

  const sorted = [...entries].sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0))

  const definitions: LegacyTeammateDefinition[] = []
  for (const entry of sorted) {
    const parsed = parseLegacyTeammateFile(entry.content, entry.fileName)
    if (parsed.droppedContextPolicy !== undefined) {
      warnings.push({
        severity: 'warning',
        fileName: entry.fileName,
        message: `unknown contextPolicy '${parsed.droppedContextPolicy}' dropped (expected 'persistent' or 'fresh_per_delegation')`,
      })
    }
    definitions.push(parsed.definition)
  }

  // Legacy dedup: last wins per id (ported from the frozen legacy
  // deduplicateDefinitions; Map keeps first-seen position, updates value).
  const byId = new Map<string, LegacyTeammateDefinition>()
  for (const def of definitions) {
    const previous = byId.get(def.id)
    if (previous !== undefined) {
      warnings.push({
        severity: 'warning',
        fileName: def.fileName,
        message: `duplicate legacy teammate id '${def.id}' in '${def.fileName}' shadows '${previous.fileName}' (last wins)`,
      })
    }
    byId.set(def.id, def)
  }
  const deduped = [...byId.values()]

  const leaders = deduped.filter((d) => d.role === 'leader')
  if (leaders.length === 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      `no leader role declared among ${deduped.length} legacy teammate definition(s): a vNext blueprint requires exactly one leader`,
      { reason: 'no-leader' },
    )
  }

  let surviving: readonly LegacyTeammateDefinition[]
  if (leaders.length > 1) {
    const survivingLeaderId = leaders[leaders.length - 1]?.id
    surviving = deduped.filter((d) => d.role !== 'leader' || d.id === survivingLeaderId)
    const droppedCount = leaders.length - 1
    const survivingLeader = surviving.find((d) => d.role === 'leader')
    warnings.push({
      severity: 'warning',
      fileName: survivingLeader !== undefined ? survivingLeader.fileName : '',
      message: `multiple leaders declared; leader '${survivingLeaderId}' (${
        survivingLeader !== undefined ? survivingLeader.fileName : '?'
      }) survives, ${droppedCount} other leader${droppedCount === 1 ? '' : 's'} dropped`,
    })
  } else {
    surviving = deduped
  }

  const leader = surviving.find((d) => d.role === 'leader')
  if (leader === undefined) {
    throw teamContractError('MALFORMED_DTO', 'legacy import resolved no surviving leader', { reason: 'no-leader' })
  }
  const memberDefs = surviving.filter((d) => d.role !== 'leader')

  // Inert provenance + lossless extras (never legacy schema keys).
  const sourceFiles = surviving.map((d) => ({ id: d.id, file: d.fileName }))
  const extrasByTemplate: Record<string, unknown> = {}
  for (const def of surviving) {
    const extras = collectExtras(def)
    if (Object.keys(extras).length > 0) extrasByTemplate[def.id] = extras
  }
  const metadata: Record<string, string> = {
    'legacy.provenance': 'dsh-teammates',
    'legacy.sourceFiles': JSON.stringify(sourceFiles),
  }
  if (Object.keys(extrasByTemplate).length > 0) {
    metadata['legacy.extras'] = JSON.stringify(extrasByTemplate)
  }

  const draft: Record<string, unknown> = {
    schemaVersion: 1,
    blueprintId: options.blueprintId,
    revision: options.revision,
    leader: toTemplate(leader),
    members: memberDefs.map(toTemplate),
    metadata,
  }
  if (options.displayName !== undefined) draft.displayName = options.displayName
  if (options.description !== undefined) draft.description = options.description

  const core = validateBlueprintDocument(draft)
  const contentHash = deriveContentHash(toHashableBlueprint(core))
  const blueprint = deepFreeze({ ...core, contentHash })
  return { blueprint, warnings: deepFreeze(warnings) }
}
