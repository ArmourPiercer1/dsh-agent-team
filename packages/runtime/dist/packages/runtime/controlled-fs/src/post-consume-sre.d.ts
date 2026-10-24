/**
 * A5-M2 B-SRE family — THE str_replace_editor execution closure (root
 * FS-EDIT card 2026-10-25: "FOUR branches view/create/replace/insert per
 * the fixed-639 public schema — each branch governed (the create/insert
 * branches interact with your just-landed create law; view/replace are
 * edits - read effect required)").
 *
 * Branch law, each clause carried from the shipped family law it reuses
 * (the reviewed write/create/edit closures; the native bodies at
 * tool-str-replace-editor/src/index.ts @639ed01539):
 *  - construction is pure validation, single flight (P3), zero arguments
 *    at the call (P1); ANCHOR before anything; the frozen-real + relative
 *    MAPPING; the parent path law;
 *  - `view` (effects I + R(exact file)): existence required; a DIRECTORY
 *    answers the native 2-level listing (hidden / node_modules /
 *    __pycache__ filtered, codepoint-sorted, view_range forbidden there);
 *    a FILE answers the native numbered view (`formatFileView`: prompt
 *    line, 6-wide line numbers, view_range validation messages, truncation
 *    at maxOutputChars default 16000 with the surrogate-safe cut and the
 *    host TRUNCATED_MESSAGE suffix). Read through ONE bound O_RDONLY|
 *    O_NOFOLLOW fd verified inside the anchor — the governed read leg, no
 *    weak read face; ZERO mutation is structural here;
 *  - `create` (I + F(create exact file)): DELEGATES to the shipped
 *    post-consume-create law verbatim (final-parent fd-bound O_EXCL
 *    create, EEXIST loses with zero bytes, NO directory creation);
 *    a present target answers the native "File already exists" law;
 *  - `str_replace` (I + R + F): the shipped post-consume-edit law carried
 *    item for item on this branch — the native unique law (0 refuses
 *    "did not appear verbatim", >1 refuses with the line list) and the
 *    first-occurrence replacement; `new_str: null` is the native typed
 *    refusal (enforced at construction);
 *  - `insert` (I + R + F): the native line law (insert_line an INTEGER in
 *    [0, lineCount] — the exact bounds message; lines spliced at the
 *    index), the same bound-fd verify-before-truncate + write-loop law;
 *  - cancellation: before the branch runs (zero, never a mutation),
 *    before the truncate (zero), and per write chunk (post-truncate =
 *    write-side-effect-unconfirmed + sideEffectPossible true). The view
 *    branch mutates nothing by construction.
 *
 * The receipt carries {canonicalLocator, rendered} plus the branch's
 * truth fields; the before/after echo rides ONLY on branches whose
 * approval carried the paired READ effect (view/str_replace/insert —
 * M-02's pre-booked "edit/replace 另需 read effect" line).
 *
 * @module packages/runtime/controlled-fs/src/post-consume-sre
 */
export type SreCommand = 'view' | 'create' | 'str_replace' | 'insert';
export interface PostConsumeSrePlan {
    readonly approvedRootLexical: string;
    readonly approvedRootReal: string;
    readonly approvedLocator: string;
    readonly command: SreCommand;
    readonly fileText: string | null;
    readonly oldStr: string | null;
    readonly newStr: string | null;
    readonly insertLine: number | null;
    readonly viewRange: readonly number[] | null;
    readonly planFingerprint: string;
}
export interface PostConsumeSreCallContext {
    readonly parametersFingerprint?: string;
    readonly signal?: {
        readonly aborted?: boolean;
    };
}
export interface PostConsumeSreConfig {
    readonly instanceRootDir: string;
    readonly maxOutputChars?: number;
}
export interface FsSreReceipt {
    readonly canonicalLocator: string;
    readonly rendered: string;
    readonly before?: string;
    readonly after?: string;
    readonly writtenFingerprint?: string;
    readonly createdNew?: true;
    readonly directory?: true;
}
export interface PostConsumeSreClosure {
    readonly claimed: () => boolean;
    readonly write: () => Promise<{
        readonly ok: true;
        readonly value: FsSreReceipt;
    } | {
        readonly ok: false;
        readonly error: {
            readonly code: string;
            readonly message: string;
            readonly details?: Record<string, unknown>;
        };
    }>;
}
export declare function createPostConsumeSreClosure(plan: PostConsumeSrePlan, ctx?: PostConsumeSreCallContext, cfg?: PostConsumeSreConfig): PostConsumeSreClosure;
//# sourceMappingURL=post-consume-sre.d.ts.map