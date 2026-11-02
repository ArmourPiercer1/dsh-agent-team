/**
 * P-BP prototype — the MINIMAL additive `reviewRouting` authoring face.
 *
 * THROWAWAY PoC CODE. It is NOT production code, NOT imported by any package,
 * and NOT a proposal for a final schema. It exists to answer one question
 * (PR #536 §4 P-BP): can a deterministic Template × Tool route be resolved
 * from a frozen Blueprint without touching the v3/v4 grammar or hashes?
 *
 * Shape under test (the PR #536 §3.3 illustrative face, tightened here):
 *   reviewRouting:
 *     enabled: true
 *     officerTemplateId: approval-officer
 *     ordinaryToolApprovals:
 *       default: officer                 # the only legal default
 *       leaderExceptions:
 *         - memberTemplateId: researcher
 *           tool: { owner: dsh.shell, name: bash }
 *     whenOfficerUnavailable: hold       # hold | leader
 *
 * The validator is deliberately closed-world: unknown keys, instance
 * selectors, duplicate exceptions, and unknown template ids all refuse.
 */

const ROUTING_FIELDS = ['enabled', 'officerTemplateId', 'ordinaryToolApprovals', 'whenOfficerUnavailable']
const ORDINARY_FIELDS = ['default', 'leaderExceptions']
const EXCEPTION_FIELDS = ['memberTemplateId', 'tool']
const TOOL_FIELDS = ['owner', 'name']
const UNAVAILABLE = ['hold', 'leader']

class RoutingRefusal extends Error {
  constructor(code, path, detail) {
    super(`${code} at ${path}: ${detail}`)
    this.code = code
    this.path = path
    this.detail = detail
  }
}

const refused = (code, path, detail) => {
  throw new RoutingRefusal(code, path, detail)
}
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0

/** Validate one raw `reviewRouting` document (already YAML-decoded). */
export function parseReviewRouting(raw) {
  if (!isRecord(raw)) refused('reviewRouting/not-a-record', '$', 'reviewRouting must be a mapping')
  for (const key of Object.keys(raw)) {
    if (!ROUTING_FIELDS.includes(key)) {
      refused('reviewRouting/unknown-field', `$.${key}`, `'${key}' is outside the closed reviewRouting face`)
    }
  }
  if (raw.enabled !== true) {
    refused('reviewRouting/not-enabled', '$.enabled', 'only `enabled: true` is a usable mode in this prototype')
  }
  if (!nonEmpty(raw.officerTemplateId)) {
    refused('reviewRouting/officer-template', '$.officerTemplateId', 'a non-empty templateId is required')
  }
  const ordinary = raw.ordinaryToolApprovals
  if (!isRecord(ordinary)) {
    refused('reviewRouting/ordinary-missing', '$.ordinaryToolApprovals', 'ordinaryToolApprovals must be a mapping')
  }
  for (const key of Object.keys(ordinary)) {
    if (!ORDINARY_FIELDS.includes(key)) {
      refused('reviewRouting/unknown-field', `$.ordinaryToolApprovals.${key}`, `'${key}' is outside the closed ordinary face`)
    }
  }
  if (ordinary.default !== 'officer') {
    refused('reviewRouting/default', '$.ordinaryToolApprovals.default', "the only legal default is 'officer'")
  }
  const exceptionsRaw = ordinary.leaderExceptions ?? []
  if (!Array.isArray(exceptionsRaw)) {
    refused('reviewRouting/exceptions', '$.ordinaryToolApprovals.leaderExceptions', 'leaderExceptions must be a list')
  }
  const leaderExceptions = exceptionsRaw.map((entry, i) => {
    const path = `$.ordinaryToolApprovals.leaderExceptions[${i}]`
    if (!isRecord(entry)) refused('reviewRouting/exception-shape', path, 'an exception must be a mapping')
    for (const key of Object.keys(entry)) {
      if (!EXCEPTION_FIELDS.includes(key)) {
        // The instance-selector refusal is the point of this branch: the
        // Blueprint may not key routing by instance id / label.
        refused('reviewRouting/instance-selector', `${path}.${key}`, `'${key}' is not a Template × Tool selector`)
      }
    }
    if (!nonEmpty(entry.memberTemplateId)) {
      refused('reviewRouting/exception-template', `${path}.memberTemplateId`, 'a non-empty memberTemplateId is required')
    }
    const tool = entry.tool
    if (!isRecord(tool)) refused('reviewRouting/exception-tool', `${path}.tool`, 'tool must be a mapping')
    for (const key of Object.keys(tool)) {
      if (!TOOL_FIELDS.includes(key)) {
        refused('reviewRouting/unknown-field', `${path}.tool.${key}`, `'${key}' is outside the closed tool coordinate`)
      }
    }
    if (!nonEmpty(tool.owner) || !nonEmpty(tool.name)) {
      refused('reviewRouting/exception-tool', `${path}.tool`, 'a trusted owner AND name are both required')
    }
    return Object.freeze({
      memberTemplateId: entry.memberTemplateId,
      tool: Object.freeze({ owner: tool.owner, name: tool.name }),
    })
  })
  const seen = new Set()
  for (const e of leaderExceptions) {
    const key = `${e.memberTemplateId}\u0000${e.tool.owner}\u0000${e.tool.name}`
    if (seen.has(key)) refused('reviewRouting/duplicate-exception', '$.ordinaryToolApprovals.leaderExceptions', `duplicate selector ${e.memberTemplateId} × ${e.tool.owner}/${e.tool.name}`)
    seen.add(key)
  }
  const whenOfficerUnavailable = raw.whenOfficerUnavailable ?? 'hold'
  if (!UNAVAILABLE.includes(whenOfficerUnavailable)) {
    refused('reviewRouting/unavailable-policy', '$.whenOfficerUnavailable', `closed set is [${UNAVAILABLE.join(', ')}]`)
  }
  return Object.freeze({
    enabled: true,
    officerTemplateId: raw.officerTemplateId,
    defaultRecipient: 'officer',
    leaderExceptions: Object.freeze(leaderExceptions),
    whenOfficerUnavailable,
  })
}

/**
 * Resolve the authoring face against the frozen blueprint's template set.
 * Returns a Map keyed by `templateId\0owner\0name`.
 */
export function buildRouteTable(blueprint, routing) {
  const templateIds = new Set([String(blueprint.leader.templateId), ...blueprint.members.map((m) => String(m.templateId))])
  if (!templateIds.has(routing.officerTemplateId)) {
    refused('reviewRouting/unknown-officer-template', '$.officerTemplateId', `template '${routing.officerTemplateId}' is not in the frozen blueprint`)
  }
  const table = new Map()
  for (const e of routing.leaderExceptions) {
    if (!templateIds.has(e.memberTemplateId)) {
      refused('reviewRouting/unknown-exception-template', '$.ordinaryToolApprovals.leaderExceptions', `template '${e.memberTemplateId}' is not in the frozen blueprint`)
    }
    table.set(`${e.memberTemplateId}\u0000${e.tool.owner}\u0000${e.tool.name}`, 'leader')
  }
  return table
}

/** The route for one REAL MemberTemplate × trusted tool coordinate. */
export function routeFor(blueprint, routing, table, { templateId, tool }) {
  const templateIds = new Set([String(blueprint.leader.templateId), ...blueprint.members.map((m) => String(m.templateId))])
  if (!templateIds.has(templateId)) refused('reviewRouting/unknown-instance-template', '$', `template '${templateId}' is not in the frozen blueprint`)
  if (!isRecord(tool) || !nonEmpty(tool.owner) || !nonEmpty(tool.name)) {
    refused('reviewRouting/trusted-tool', '$', 'routing needs a trusted owner/name coordinate')
  }
  const hit = table.get(`${templateId}\u0000${tool.owner}\u0000${tool.name}`)
  return Object.freeze({
    kind: 'recipient',
    target: hit ?? routing.defaultRecipient,
    reason: hit === 'leader' ? 'blueprint-leader-exception' : 'blueprint-default-officer',
  })
}

export { RoutingRefusal }
