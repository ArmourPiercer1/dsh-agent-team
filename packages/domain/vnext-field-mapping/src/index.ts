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
// VNEXT-SCHEMA reversible half (ADR M-2): the SHIPPING v4 authoring→internal
// tables, composed from the frozen engine above — still DORMANT (SUPPORTED
// stays [3]); the four mapping laws are machine-checked by domain test a5sr3.
export { declareV4AuthoringMaps, projectV4ToolBindingAuthoring } from './v4-authoring-map.js'
export type { V4AuthoringMaps, V4ResourceDeclaration } from './v4-authoring-map.js'
