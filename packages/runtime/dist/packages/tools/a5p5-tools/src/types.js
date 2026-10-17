/**
 * `a5p5-tools` Phase 1 — closed shapes for the Team-owned Search/Shell tool
 * surface (Alpha.5 PR5, implementation plan §8; design pipeline
 * post-poc-technical-design.md §4: `parse args → canonical target/resource
 * scope → … → render/presentationMeta`).
 *
 * DORMANT BY CONTRACT: nothing outside `packages/tools/a5p5-tools/` imports
 * this lane (pinned by `a5p5-dormant-audit`); the lane registers NOTHING into
 * any barrel, registry, tsconfig solution or scanner — wiring is a reviewed
 * integration move, exactly like the PR0 lane's `a5p0-layer-audit` precedent.
 *
 * WHAT LIVES HERE: only the CLOSED data shapes shared by the argument parser
 * (`args.ts`), the effect-schema derivation (`effects-schema.ts`) and the
 * renderer (`render.ts`). Security semantics deliberately do NOT live here:
 * the effect algebra is consumed READ-TIME from
 * `domain/tool-governance` (`effects.ts` / `resource.ts` / `parse-util.ts`),
 * never re-declared — this lane adds no second authorization fact (the
 * `INTERFACES-v1.md` C-ADM rule "接口面只读消费；禁第二授权库").
 *
 * THE THREE LAWS ENCODED BY THESE SHAPES:
 *
 *  1. NO REALM IN MODEL ARGS. `realmId` never appears in any `*Args` shape —
 *     the realm is injected by the caller (the admission context), so a model
 *     can never self-claim a Realm (design §1 realm non-confusion). An
 *     argument record that carries `realmId` is an `unknown-field` refusal.
 *  2. NO SIDE-EFFECT TEXTUAL PREDICTION. `ParsedShellArgs` keeps `command`
 *     opaque; the effect derivation for `bash` claims ONLY the tool-invoke
 *     effect (S0 matrix M-07: 禁命令文本网页级正则预测副作用). File/network
 *     reality is enforced by the confined-execution provider (PR4), never by
 *     regex-guessing the command string into claimed effects.
 *  3. UNTRUSTED RESULT CONTENT IS DATA. Every search path/match text and every
 *     shell stdout/stderr byte arrives only inside an `*Outcome` shape and is
 *     sanitized at render time (render.ts) — the renderer's structural lines
 *     are the only unindented lines of a presentation.
 *
 * Purity: no `node:*`, no I/O, no clock (mirrors the PR0 lane's law).
 *
 * @module @dsh-agent-team/tools/a5p5-tools/types
 */
/** The Team tool names of this slice (closed set; wiring may alias, not extend, it). */
export const A5P5_TOOL_NAMES = ['grep', 'glob', 'bash'];
/** The closed grep output modes (native-parity vocabulary, R3 route). */
export const GREP_OUTPUT_MODES = ['content', 'files_with_matches', 'count'];
/**
 * The placements a tool target may carry: exactly the three filesystem
 * `ResourceKind`s whose locator syntax a model can spell (design §3.1 —
 * relative anchors at the immutable workspace; `~/` is Realm Home; absolute
 * paths are intentional out-of-workspace expressions). `directory`/`metadata`/
 * `network-destination` placements are NOT spellable from args: the effect
 * schema manufactures the `directory` arm itself when a `list` effect needs
 * one (the EFFECT↔RESOURCE coupling law in `effects.ts`).
 */
export const TARGET_PLACEMENTS = ['workspace', 'realm-home', 'absolute-path'];
//# sourceMappingURL=types.js.map