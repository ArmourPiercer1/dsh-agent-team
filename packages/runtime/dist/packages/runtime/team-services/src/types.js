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
import { HarnessError } from '@deepseek-ai/dsh-llm';
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
    /**
     * BL-18 (P2-05) — the confined `web` face's per-call network refusal.
     *
     * The SAME token the install vocabulary already carries (`NETWORK_UNCONFINED_REALM`,
     * introduced by product-assembly): a lane that requests `network: deny` while the
     * backend cannot PROVE it enforces the network dimension is a claim, not a
     * ceiling. Reusing the token is deliberate — a caller compares one concept
     * across the composition-time refusal (no web face installed) and the
     * per-call refusal (a web call under a deny claim this host cannot keep).
     * The two vocabularies stay separate LISTS (install vs per-call) because they
     * are raised at different stages, but the token names one fact.
     */
    'NETWORK_UNCONFINED_REALM',
    /**
     * PD-15 (2026-11-11) — the web face was offered a network-enforcement proof
     * minted for a DIFFERENT service face (today: the subprocess face's netns
     * proof). The proof is real; it is evidence about another boundary. The
     * in-process web transport cannot ride the launcher's per-child namespace, so
     * admitting the call on that proof would turn a measured subprocess fact into
     * a false web claim. A code of its own (rather than
     * `NETWORK_UNCONFINED_REALM`) because the facts differ: that one says "nothing
     * proved this face", this one says "a proof exists, for the wrong face", and
     * the audit trail must tell them apart.
     */
    'NETWORK_PROOF_FACE_MISMATCH',
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
     * BL-17 (2026-11-05) — 旧代 PTY 拒用: a module that CONSUMES `terminals` (the
     * native persistent-`bash` path: `inject: ["tools","terminals"]` →
     * `ctx.terminals.spawn(owner, …)`) was about to be mounted on a GOVERNED
     * Member realm. No realm installs a confined terminal face (P1-08's PTY port
     * is still a test double), so such a module would resolve the INHERITED,
     * legacy-generation host `terminals` service: a persistent shell created
     * outside the Member lane, whose policy is consumed only at spawn time and
     * whose domain could outlive the revision it was opened under. Refused at
     * composition time, before any fiber exists, instead of serving a governed
     * Member through the legacy PTY. A future confined terminal backend installs
     * a face on the realm's own isolated scope and the seam learns to report it;
     * until then this is a refusal, not a documented "unused" path.
     */
    'TERMINALS_LEGACY_PTY_REFUSED',
    /**
     * PD-13 (2026-11-11) — a TERMINAL face was declared on a realm that owns no
     * confined `subprocess` face, or whose declared shell class does not admit
     * the terminal's program. The confined terminal face executes each command
     * as a confined child of THAT face; without it the face would have to fall
     * back to the inherited shell, which is the governance hole PD-13 records.
     * Refused at install, before any Member scope exists.
     */
    'TERMINALS_UNCONFINED_REALM',
    /**
     * PD-13 (2026-11-11) — DOUBLE TERMINAL: the Member's preset already mounts a
     * legacy `terminals` service and the realm would install a confined terminal
     * face beside it. A Member never holds a governed and an ungoverned shell at
     * once (the answer to "what is the Member's shell" must not fork), so the
     * install is refused instead of shadowing one of the two. The composition
     * removes the preset's persistent-shell/`dsh-terminal` row for Members.
     */
    'TERMINALS_DOUBLE_TERMINAL_REFUSED',
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
    /**
     * PRODUCT ASSEMBLY policy-source fix (2026-11-05): a row declared
     * `a5sfMemberPolicies` but supplied no blueprint the declaration could be
     * reconciled against — `config.blueprintSource` is absent/blank, does not
     * parse, resolves to a DIFFERENT team or a DIFFERENT revision, or the
     * blueprint carries no `memberIoCeilings` family to derive from.
     *
     * The declaration is the EXCEPTION path: it may only narrow the Member
     * ceiling a blueprint already declares. Without a resolvable blueprint the
     * row would assemble Member permission facts from a second, independently
     * editable statement of the same truth, so it refuses rather than treating
     * "no blueprint" as "no constraints". Derivation (`a5sfMemberAuthority`) is
     * the product path that needs no declaration at all.
     */
    'MEMBER_POLICY_WITHOUT_BLUEPRINT',
];
/**
 * The per-call denial raised by an installed Provider method. Carries the
 * closed code, the member identity and the method so the tool layer and the
 * audit trail never depend on message text.
 */
export class TeamIoDenial extends HarnessError {
    code;
    memberIdentity;
    method;
    target;
    constructor(code, message, fields) {
        // PD-28 (2026-11-14): a HARNESS error, not a bare `Error`. The tool result
        // protocol only serializes a typed code for `HarnessError` (`toolErrorResult`
        // -> `errorInfo`), so before this a confined refusal reached the model as
        // `Error: <lane text>` with NO code, even though the guard fact carried
        // `IO_READ_DENIED`. The message is unchanged (the lane's own decision text);
        // the tool result now also carries `error.info = { name, code }`, so a
        // refusal and an absence are machine-distinguishable at the consumer — which
        // is exactly the property the native `skill`/`present` arms rely on.
        super(message, code);
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