/**
 * Strict-read + Core-spill — the artifact-read-grant core (public module
 * surface for the runtime).
 *
 * The pure decision core (types / digest / fact / registry / authority)
 * of the `artifact-read-granted` durable fact family: positive read
 * capability (D1) for a Team agent to read back its OWN spill artifacts
 * outside the session workspace, without weakening ordinary
 * out-of-workspace read isolation.
 *
 * See the module docs for the invariant set (architecture §17):
 * locator + targetKeyDigest + versionDigest identity, fresh resolve+stat
 * at issue AND use, `read`-only consumption, composite identity
 * (invariant 18), durable-first issuance, no fs parsing, no revoke.
 * @module @dsh-agent-team/runtime/artifact-read
 */
export { ARTIFACT_READ_GRANTED_FACT_TYPE, ARTIFACT_READ_PAYLOAD_VERSION, buildArtifactReadGrantedPayload, encodeArtifactSource, isArtifactReadGrantedFact, parseArtifactReadGranted, } from './fact.js';
export { TARGET_KEY_DIGEST_DOMAIN, VERSION_DIGEST_DOMAIN, isDigest, targetKeyDigest, versionDigest, } from './digest.js';
export { ArtifactGrantRegistry } from './registry.js';
export { PendingShellGrantTable, pendingGrantKey, } from './pending.js';
export { SHELL_OBSERVER_DEFAULT_TOOLS, installShellResultObserver, } from './shell-result-observer.js';
export { ArtifactRecordError, TeamArtifactAuthority, } from './authority.js';
//# sourceMappingURL=index.js.map