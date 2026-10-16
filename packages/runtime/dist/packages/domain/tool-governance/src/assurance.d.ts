/**
 * `AssuranceContract` — one of THREE independent dimensions (design §2.1,
 * S0 matrix §3): `implementationOrigin` (DSH native / Team trusted extension
 * / standalone runner / remote Provider), `executionBoundary` (trusted Host /
 * confined subprocess / delegated remote), and the per-dimension `assurance`
 * record. The retired `native/custom/shadow-run` "safety level" triple is a
 * FORBIDDEN old usage (matrix §3); this file cannot express it.
 *
 * THE DERIVATION LAW (design §1.4, verbatim): "Assurance 从有效 Policy 推导
 * 所需执行能力，不是可放宽权限的第二组开关。Provider 必须完整兑现其声称支持
 * 的维度." This module therefore answers CAPABILITY questions
 * ({@link assuranceSatisfies}) and never grants anything:
 *
 *  - `hard`          — the guarantee must be OS/Provider-ENFORCED → only
 *                      `enforced` satisfies it;
 *  - `authoritative` — an enforced guarantee or an honest author-trusted one
 *                      (same-process trusted mediation, design §3.6) counts;
 *  - `partial`, `unsupported`, `untested` NEVER satisfy either — the
 *                      no-overclaim law (design §5: never infer "strict
 *                      Profile green" from "Landlock READ_FILE blocks").
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/assurance
 */
import { type ParseResult } from './parse-util.js';
/** `implementationOrigin` values (design §2.1, verbatim). */
export declare const IMPLEMENTATION_ORIGINS: readonly ["dsh-native", "team-trusted-extension", "standalone-runner", "remote-provider"];
/** One implementation origin. */
export type ImplementationOrigin = (typeof IMPLEMENTATION_ORIGINS)[number];
/** `executionBoundary` values (design §2.1, verbatim three). */
export declare const EXECUTION_BOUNDARIES: readonly ["trusted-host", "confined-subprocess", "delegated-remote"];
/** One execution boundary. */
export type ExecutionBoundary = (typeof EXECUTION_BOUNDARIES)[number];
/** The per-dimension assurance levels (design §2.1, verbatim five). */
export declare const ASSURANCE_LEVELS: readonly ["enforced", "author-trusted", "partial", "unsupported", "untested"];
/** One assurance level. */
export type AssuranceLevel = (typeof ASSURANCE_LEVELS)[number];
/** The dimensions the assurance record must state (design §2.1 list). */
export declare const ASSURANCE_DIMENSIONS: readonly ["content-read", "directory-metadata", "write", "alias", "network-destination", "inherit-cancel"];
/** One assurance dimension. */
export type AssuranceDimension = (typeof ASSURANCE_DIMENSIONS)[number];
/** How much a consumer demands of one dimension. */
export type AssuranceRequirement = 'hard' | 'authoritative';
/** The three-dimension contract of one bound tool/provider. */
export interface AssuranceContract {
    readonly implementationOrigin: ImplementationOrigin;
    readonly executionBoundary: ExecutionBoundary;
    readonly assurance: Readonly<Record<AssuranceDimension, AssuranceLevel>>;
}
/**
 * Strict parse: the record must state EVERY dimension (a missing one is a
 * refusal, never an implicit `untested`), each from the closed five, and the
 * two origin/boundary fields from their closed sets.
 */
export declare function parseAssuranceContract(raw: unknown): ParseResult<AssuranceContract>;
/**
 * Does the contract actually carry the demanded capability per dimension?
 * Reports every failing dimension (collected, never the first).
 */
export declare function assuranceSatisfies(contract: AssuranceContract, required: Readonly<Partial<Record<AssuranceDimension, AssuranceRequirement>>>): {
    readonly ok: boolean;
    readonly failing: readonly AssuranceDimension[];
};
//# sourceMappingURL=assurance.d.ts.map