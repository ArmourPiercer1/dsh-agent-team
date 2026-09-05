/**
 * Type-level branding helper for contract identity values.
 *
 * `Brand<Name>` marks a string with a compile-time-only tag so distinct
 * identity kinds (RootSessionId, InstanceId, ...) are not interchangeable.
 * The brand carries NO runtime representation: every branded value is a
 * plain string at runtime, which keeps every DTO lossless-JSON safe.
 *
 * Erasable-TS only (no enum, no namespace, no runtime value).
 * @module @dsh-agent-team/contracts/ids/brand
 */
declare const __brand: unique symbol;
/** Compile-time brand marker for one identity kind. */
export type Brand<Name extends string> = {
    readonly [__brand]: Name;
};
export {};
//# sourceMappingURL=brand.d.ts.map