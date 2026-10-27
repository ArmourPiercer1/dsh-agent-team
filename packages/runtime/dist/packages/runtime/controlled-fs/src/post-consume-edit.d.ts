/**
 * A5-M2 B-EDIT family — THE edit execution closure (root FS-EDIT card
 * 2026-10-25: the M-02 pre-booked law "`edit`/`replace` 另需 read effect"
 * is the approval this closure answers; the arm ships the read effect).
 *
 * THE EDIT LAW (the reviewed write family's law class, item for item):
 *  - construction is pure validation (typed plan frozen at classify; a
 *    violation is a TypeError, zero FS); single flight (P3): in-flight AND
 *    settled repeats are refused with zero FS; the closure is called with
 *    NO arguments (P1 — nothing post-approval crosses into it);
 *  - ANCHOR before anything: the instance root must still resolve at the
 *    FROZEN approved real identity; the working spelling is the reviewed
 *    MAPPING (rel = relative(rootLexical, locator) onto the frozen real
 *    root, post-consume-write.ts:213-221 — a stable trusted root symlink
 *    answers normally; child-path symlinks stay STRICT);
 *  - the parent rides the reviewed path law (lstat symlink refuses
 *    `symlink-alias`, absent answers `not-a-directory`);
 *  - THE EDIT NEVER CREATES: an absent target refuses `not-a-file` with
 *    zero creation (the native `edit` has no create face — the create
 *    spelling belongs to `write`/`str_replace_editor.create`, and the
 *    existence-honest law-facts say so in the approval);
 *  - BEFORE any byte-changing step the target is opened `O_RDWR |
 *    O_NOFOLLOW` and verified INSIDE the anchor (`verifyOpenedHandle`,
 *    snapshot null — the opened fd is its own identity; drift/undeterminable
 *    refuses with sideEffectPossible FALSE because nothing has changed),
 *    must be a regular file, and is READ THROUGH THAT FD with strict UTF-8
 *    (the READ half of the approved `I + R(read exact file) + F(write exact
 *    file)` set — no new effect kind, matrix M-02 wording);
 *  - the replacement is the native literal law: `old_string` must appear
 *    (0 occurrences refuses "did not appear verbatim"), and unless
 *    `replace_all` it must appear EXACTLY ONCE (multiple occurrences
 *    refuse with the 1-based line numbers — the native FS_AMBIGUOUS_EDIT
 *    face); `replace_all` replaces every occurrence;
 *  - cancellation is checked BEFORE the open (zero), AFTER the read and
 *    BEFORE the truncate (zero — nothing has changed yet), and BEFORE every
 *    write chunk; after the truncate any failure or stall is
 *    `write-side-effect-unconfirmed` with sideEffectPossible true (the r16
 *    loop law verbatim) — never a success report, never "zero side effect";
 *  - the receipt {canonicalLocator, before, after}: the before/after echo
 *    rides ONLY here — under the paired READ effect on this exact locator
 *    (M-02 pre-booked law, verbatim: "`edit`/`replace` 另需 read effect";
 *    D-C2-1's no-echo rule governs WRITE receipts and the host before/after
 *    face was ruled lawful ONLY as the paired-read increment). A write-only
 *    grant never carries these bytes.
 *
 * @module packages/runtime/controlled-fs/src/post-consume-edit
 */
/** The frozen edit plan the B-EDIT arm freezes at classify. */
export interface PostConsumeEditPlan {
    readonly approvedRootLexical: string;
    readonly approvedRootReal: string;
    readonly approvedLocator: string;
    readonly oldString: string;
    readonly newString: string;
    readonly replaceAll: boolean;
    readonly planFingerprint: string;
}
export interface PostConsumeEditCallContext {
    readonly parametersFingerprint?: string;
    readonly signal?: {
        readonly aborted?: boolean;
    };
    /** LANE-INTERNAL PROBE SEAM ONLY (mirrors the PoC3
     *  `onAfterPreCheckBeforeOpen` hook of controlled-fs.ts): fires AFTER the
     *  read half and BEFORE the first byte-changing step (truncate), so the
     *  verify→truncate window is observable without a real-time race. The
     *  sanctioned wiring (fs-family executors) NEVER passes it — pinned by
     *  u7-r4091 S-1; its presence changes no law. */
    readonly onBeforeFirstByteChange?: () => void | Promise<void>;
}
export interface PostConsumeEditConfig {
    readonly instanceRootDir: string;
}
/** The edit receipt: the paired-read-covered echo pair + the canonical
 *  locator (the native `edit` output face {path,before,after}). */
export interface FsEditReceipt {
    readonly canonicalLocator: string;
    readonly before: string;
    readonly after: string;
}
export interface PostConsumeEditClosure {
    readonly claimed: () => boolean;
    readonly write: () => Promise<{
        readonly ok: true;
        readonly value: FsEditReceipt;
    } | {
        readonly ok: false;
        readonly error: {
            readonly code: string;
            readonly message: string;
            readonly details?: Record<string, unknown>;
        };
    }>;
}
/**
 * Build the ONE-SHOT edit closure for one frozen, already-approved plan.
 * Same law class as the reviewed write/create closures: the closure is the
 * private executor minted from frozen facts; zero arguments at the call.
 */
export declare function createPostConsumeEditClosure(plan: PostConsumeEditPlan, ctx?: PostConsumeEditCallContext, cfg?: PostConsumeEditConfig): PostConsumeEditClosure;
//# sourceMappingURL=post-consume-edit.d.ts.map