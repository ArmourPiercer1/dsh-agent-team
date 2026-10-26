export type SchemaViolation = { path: string; code: string; detail: string }
export type SchemaVerdict = { ok: true } | { ok: false; errors: SchemaViolation[] }
export declare function validateAgainstSchema(value: unknown, schema: object, root?: object): SchemaVerdict
