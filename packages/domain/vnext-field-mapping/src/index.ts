/**
 * `@dsh-agent-team/domain/vnext-field-mapping` — the Alpha.5 PR7 lane
 * (Lane F) C-VNEXT consumption surface: a default-deny, no-implicit-default
 * field-map projector. DORMANT: zero production consumers; the v3
 * production document format is NOT modified here (C-VNEXT), this lane only
 * pins how a CONSUMER must treat fields it was not told about.
 *
 * @module @dsh-agent-team/domain/vnext-field-mapping
 */
export { declareFieldMapping, projectThroughMap } from './field-mapping.js'
export type { FieldMap, MappingResult, MappingRejection } from './field-mapping.js'
