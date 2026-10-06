/**
 * Ambient declarations for `tests/kits/rc2-real-host-smoke/wire-shape.mjs`.
 * The rc2 kit is plain ESM JavaScript; the TypeScript test that verifies its
 * decoder needs the same strict-mode treatment as `tests/paths.mjs` (TS7016),
 * so the API is declared here and kept in sync with the runtime module.
 */

export const WIRE_CLASSIC: 'classic'
export const WIRE_PARTS: 'parts'
export const WIRE_NONE: 'none'
export const WIRE_MIXED: 'mixed'
export const WIRE_UNKNOWN: 'unknown'

export const PURPOSE_AGENT: 'agent'
export const PURPOSE_TITLE: 'title'
export const PURPOSE_COMPACTION: 'compaction'
export const PURPOSE_UNKNOWN: 'unknown'

export declare class WireShapeError extends Error {
  readonly info: Record<string, unknown>
  constructor(message: string, info?: Record<string, unknown>)
}

export interface ToolResultEntry {
  readonly toolUseId: string | null
  readonly item: Record<string, unknown>
  readonly via: string
}

export interface ToolUseEntry {
  readonly id: string | null
  readonly name: string | null
  readonly item: Record<string, unknown>
}

export interface WireClassification {
  readonly shape: string
  readonly agentTurn: boolean
  readonly toolResults: ToolResultEntry[]
  readonly toolUses: ToolUseEntry[]
  readonly unknownRoles: string[]
  readonly unknownPartTypes: string[]
  readonly notes: string[]
  readonly messageShapes: string[]
  readonly bodyKeys: string[]
}

export interface PurposeClassification {
  readonly purpose: string
  readonly markers: string[]
  readonly agentTurn: boolean
}

export interface ToolResultsView {
  readonly shape: string
  readonly items: Array<Record<string, unknown>>
  readonly count: number
}

export declare function bodyOf(requestOrBody: unknown): Record<string, unknown> | null
export declare function messageShapes(body: unknown): string[]
export declare function classifyRequest(body: unknown): WireClassification
export declare function assertWireShape(body: unknown, context?: { label?: string; expectToolResult?: boolean }): WireClassification
export declare function classifyPurpose(body: unknown): PurposeClassification
export declare function assertPurpose(body: unknown, context?: { label?: string }): PurposeClassification
export declare function isChainTurn(body: unknown): boolean
export declare function isTitleDispatch(body: unknown): boolean
export interface ToolResultEntryView {
  readonly toolUseId: string | null
  readonly text: string
  readonly isError: boolean
  readonly item: Record<string, unknown>
}

export declare function toolResultsOf(body: unknown, context?: { label?: string }): ToolResultsView
export declare function toolResultEntries(body: unknown, context?: { label?: string }): ToolResultEntryView[]
export declare function flattenContent(content: unknown, depth?: number): string
export declare function isErrorResult(result: unknown): boolean
export declare function extractInstanceId(source: unknown, context?: { label?: string }): string
export declare function toolResultText(result: unknown): string
export declare function userText(body: unknown): string
export declare function systemText(body: unknown): string
export declare function replySig(reply: unknown): string
