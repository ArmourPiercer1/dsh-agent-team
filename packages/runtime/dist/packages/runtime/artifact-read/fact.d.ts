/**
 * Strict-read + Core-spill — the `artifact-read-granted` fact family
 * (D4): the durable-entry builder (writer side) and the strict parser
 * (reader side) for the EXISTING TeamLedger (no new store, no schema
 * bump — a new factType string is the sanctioned family mechanism).
 *
 * Both directions are PURE and DETERMINISTIC (the activity-fact
 * convention): the builder always emits the closed payload shape, and
 * the parser re-validates every field against the SAME bounds the
 * writer enforced, so a corrupted or foreign row can never poison the
 * cold-restart rebuild — it is simply skipped.
 *
 * The payload never carries a raw fs token or a raw path in any
 * decision-relevant position: the identity travels as the two
 * domain-separated digests, the model-visible locator as an exact
 * string (the grant's own binding, re-checked verbatim at use).
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/runtime/artifact-read/fact
 */
import type { ArtifactLedgerEntry, ArtifactReadGrant, ArtifactSource } from './types.js';
/** The closed factType of the grant family. */
export declare const ARTIFACT_READ_GRANTED_FACT_TYPE = "artifact-read-granted";
/** The fact-family payload version (self-describing; writer + reader agree). */
export declare const ARTIFACT_READ_PAYLOAD_VERSION = 1;
/** Max length of the producing instanceId (contract: `inst-` + 32 = 37; headroom). */
export declare const ARTIFACT_INSTANCE_ID_MAX_LENGTH = 64;
/** Max length of the model-visible locator (spilled paths are long; 2 KiB ceiling). */
export declare const ARTIFACT_LOCATOR_MAX_LENGTH = 2048;
/** Max length of a structured source field (tool name / call id / label). */
export declare const ARTIFACT_SOURCE_FIELD_MAX_LENGTH = 256;
/** Max length of a structured source session id. */
export declare const ARTIFACT_SOURCE_SESSION_ID_MAX_LENGTH = 255;
/** The closed stream values of a shell-source grant. */
export declare const ARTIFACT_SHELL_STREAMS: readonly ["stdout", "stderr"];
/** The closed builder input (the authority has already validated + resolved). */
export interface ArtifactReadGrantedBuildInput {
    readonly instanceId: string;
    readonly locator: string;
    readonly targetKeyDigest: string;
    readonly versionDigest: string;
    readonly source: ArtifactSource;
}
/** Encode the closed `ArtifactSource` into its lossless-JSON payload shape. */
export declare function encodeArtifactSource(source: ArtifactSource): Record<string, unknown>;
/**
 * Build the closed payload of one `artifact-read-granted` fact.
 *
 * @param input - the validated build input.
 * @returns the lossless-JSON payload ready to wrap in a `LedgerEntry`.
 */
export declare function buildArtifactReadGrantedPayload(input: ArtifactReadGrantedBuildInput): Record<string, unknown>;
/**
 * Type guard: the entry's factType is the grant family.
 * @param factType - the entry's factType discriminator.
 */
export declare function isArtifactReadGrantedFact(factType: string): boolean;
/**
 * Parse ONE durable ledger entry into a grant (or `undefined` when the
 * entry is not a well-formed grant fact).
 *
 * Fail-safe: every field is re-validated (closed shapes, exact bounds,
 * digest format, payload version). A corrupted or foreign row is
 * skipped, never guessed. `rootSessionId` comes from the ENTRY (the
 * ledger owns it), not the payload.
 *
 * @param entry - the durable ledger entry (the repository's row shape).
 * @returns the parsed grant, or `undefined` for non-grant/corrupt rows.
 */
export declare function parseArtifactReadGranted(entry: ArtifactLedgerEntry): ArtifactReadGrant | undefined;
//# sourceMappingURL=fact.d.ts.map