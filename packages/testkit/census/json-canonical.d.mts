export declare function canonicalJson(value: unknown): string
export declare function canonicalDigest(value: unknown): string
export declare function bytesDigest(bytes: string | Uint8Array): string
export declare function definitionShapeDigest(face: {
  name?: unknown
  description?: unknown
  parameters?: unknown
  outputSchema?: unknown
  timeoutMsPresent?: unknown
}): string
