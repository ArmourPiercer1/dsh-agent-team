/**
 * Alpha.5 P1-05 — Service-realm vocabulary for per-Member I/O Providers.
 *
 * A Member's I/O policy is only real if the PROVIDER that serves its tools is
 * that Member's provider. This module names the closed vocabulary of the
 * install/denial receipts shared by `fs.ts` and `install.ts`; it holds no I/O.
 *
 * Two separate concerns, deliberately not merged:
 *  - `TEAM_IO_DENIAL_CODES` — the per-call refusal an installed Provider raises
 *    when the compiled policy does not cover the target. Raised INSIDE the
 *    provider method, so the native tool sees a typed failure and never a
 *    silent success.
 *  - `TEAM_SERVICE_INSTALL_CODES` — the install-time refusal: the whole Member
 *    service realm is not installed (and the Team refuses) rather than a
 *    partially-installed scope that would run tools against the host provider.
 *
 * @module @dsh-agent-team/runtime/team-services/types
 */
/** Closed per-call denial vocabulary of an installed Provider. */
export const TEAM_IO_DENIAL_CODES = [
    'IO_READ_DENIED',
    'IO_WRITE_DENIED',
    'IO_WRITE_REQUIRES_READ',
    'IO_POLICY_UNSUPPORTED',
    /**
     * A5-DUAL-PLANE-01 (2026-11-05): the compiled lane's effective disposition
     * for the target is `ask`, and this admission plane cannot CONSUME an ask —
     * the designed consumption seam (`resolveAskClassCall`) has no production
     * caller, and one-shot approval plus its drain/cancel semantics belong to
     * BL-30. Refusing is the honest interim state: the alternative is silent
     * auto-approval of a call whose declared disposition is "requires approval".
     *
     * A code of its own (rather than `IO_POLICY_UNSUPPORTED`) because the two
     * refusals are different facts: `IO_POLICY_UNSUPPORTED` means admission
     * could not be PROVEN (resolver fault / unsupported provider), while this
     * one means admission was proven and the answer is `ask`. Observability maps
     * both to the `ask` lane, but the tool layer, the fact and the audit trail
     * must be able to tell them apart.
     */
    'IO_ASK_REQUIRES_APPROVAL',
];
/** Closed install-time refusal vocabulary. */
export const TEAM_SERVICE_INSTALL_CODES = [
    'MEMBER_POLICY_UNAVAILABLE',
    'MEMBER_POLICY_STALE',
    'MEMBER_IDENTITY_INVALID',
    'MEMBER_DUPLICATE',
    'PROVIDER_UNAVAILABLE',
    'PROVIDER_INCOMPATIBLE',
    'SERVICE_ALREADY_INSTALLED',
    'SERVICE_MOUNT_FAILED',
    /**
     * BL-17 (2026-11-04): a module that CONSUMES `subprocess` was about to be
     * mounted on a realm that owns no confined `subprocess` face. Refused at
     * composition time, before any tool exists — never resolved against the
     * inherited base service.
     */
    'SUBPROCESS_UNCONFINED_REALM',
    /**
     * PRODUCT ASSEMBLY (2026-11-05): a product declaration narrows the NETWORK
     * axis (a ceiling/restriction `network: deny`, or a `delegated-remote`
     * execution boundary) and this realm installs NO web face. Refused at
     * composition time — a network narrowing with no enforcing provider would be
     * a claim, not a ceiling — instead of silently mounting the fs half alone.
     * Symmetric with the `subprocess` code above and in the SAME closed
     * vocabulary, so callers compare a token, never a message.
     */
    'NETWORK_UNCONFINED_REALM',
    /**
     * PRODUCT ASSEMBLY (2026-11-05): the `a5sfMemberPolicies` declaration is
     * malformed, ambiguous or outside the closed shape this assembler accepts
     * (wrong schema, unknown/missing field, duplicate template, reserved id, a
     * ceiling the shipped v4 validator refuses, ...). A declaration that cannot
     * be read is refused before any Member is set up; it is never treated as
     * "no declaration" (that would silently unmanage the Member).
     */
    'REALM_DECLARATION_INVALID',
    /**
     * PRODUCT ASSEMBLY review B2 (2026-11-05, coordinator ruling): the
     * `a5sfMemberPolicies` declaration is reconciled with the row's OWN bound
     * blueprint (`config.blueprintSource`, when it parses to the same team), and
     * a declared Member ceiling is NOT a narrowing of the blueprint's
     * `memberIoCeilings[template]` on some axis — or names a template the
     * blueprint declares no ceiling for. Refused at assembly, so a row-config
     * edit can never widen a ceiling without a new blueprint/authority revision.
     * A typed code of its own (rather than `REALM_DECLARATION_INVALID`) because
     * the declaration can be perfectly well-formed and still disagree with the
     * authority-bearing blueprint: callers must be able to tell "unreadable"
     * from "wider than the bound authority".
     */
    'REALM_DECLARATION_EXCEEDS_BLUEPRINT',
];
/**
 * The per-call denial raised by an installed Provider method. Carries the
 * closed code, the member identity and the method so the tool layer and the
 * audit trail never depend on message text.
 */
export class TeamIoDenial extends Error {
    code;
    memberIdentity;
    method;
    target;
    constructor(code, message, fields) {
        super(message);
        this.name = 'TeamIoDenial';
        this.code = code;
        this.memberIdentity = fields.memberIdentity;
        this.method = fields.method;
        this.target = fields.target;
    }
}
/** The install-time refusal. `reveal` is a JSON-ish path for diagnostics. */
export class TeamServiceInstallError extends Error {
    code;
    reveal;
    detail;
    constructor(code, detail, reveal = 'members') {
        super(`${code}: ${detail}`);
        this.name = 'TeamServiceInstallError';
        this.code = code;
        this.reveal = reveal;
        this.detail = detail;
    }
}
//# sourceMappingURL=types.js.map