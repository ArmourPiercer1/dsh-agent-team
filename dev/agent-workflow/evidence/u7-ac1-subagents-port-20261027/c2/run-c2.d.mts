export const LIVE_IO: Record<string, unknown>
export function resolveDriveIo(overrides?: Record<string, unknown>, liveDefaults?: Record<string, unknown>): Record<string, unknown>
export function judgeForkPositive(readBack: Array<{ isError?: boolean; text?: string }>, expectedToken: string): { isError?: boolean; text?: string } | null
export function drive(options: Record<string, unknown>): Promise<unknown>
