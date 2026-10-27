/**
 * `packages/tools/ui-family` — the UI Family lane (u7-f; center-assembly
 * §4 six boundaries owned by a Family).
 *
 * WHAT LIVES HERE: the governed `ask_user_question` + `present` rows —
 *   - `ui-mechanics.mjs`            the closed argument contracts, the
 *                                   timed variant's timeout law + verbatim
 *                                   pending notice, the native spellings
 *                                   and the two Domain Authority ids
 *                                   (one home: declared == requested);
 *   - `ui-interaction-port.mjs`     the INJECTED interaction port contract
 *                                   and the host `userQuestions` adapter
 *                                   (the family holds NO UI face itself);
 *   - `ask-executor.mjs`            the question effect body (pure parse →
 *                                   port gate → lane → default-deny → PA
 *                                   one-shot → ONLY THEN the port; the
 *                                   pending outcome is never an answer);
 *   - `present-executor.mjs`        the publication effect body (the fs
 *                                   family's anchor law reused; O_NOFOLLOW
 *                                   probe pays the declared read effects;
 *                                   zero file bytes ever enter memory,
 *                                   the result, or an observation line);
 *   - `ask-row.mjs` / `present-row.mjs` the row Definitions + host-mirror
 *                                   presentation faces;
 *   - `ui-family-contribution.mjs`  the §4/§10.3 contribution descriptor
 *                                   (admission/grantMint/grantConsume
 *                                   declared `kernel` — § CI-06).
 *
 * OWNER ROLE: the Family owns the Definition, the argument contract, the
 * effect BODY and the result SHAPE. It owns NO authority: it never admits,
 * mints, consumes, or decides; it owns no UI face either — every human
 * interaction lands only through the port the TRUSTED MOUNT injects
 * (`input.backends.ui`), and an absent port is a typed refusal with zero
 * effect. Authority forces are injected at the trusted assembly point.
 *
 * DIST MIRROR: every file here is a plain .mjs tracked as a BYTE COPY under
 * `packages/runtime/dist/packages/tools/ui-family/src/` (the 070-ui-family
 * placement); the relative import depths resolve identically from `src` and
 * from the dist mirror.
 *
 * @module ui-family
 */
export {
  ASK_USER_QUESTION_NATIVE_NAME,
  DEFAULT_ASK_TIMEOUT_SECONDS,
  MAX_ASK_TIMEOUT_SECONDS,
  MAX_PRESENT_FILES,
  PENDING_NOTICE,
  PRESENT_NATIVE_NAME,
  REALM_FILE_ROOT_TARGET,
  TIMED_WAIT_PARAMETER,
  UI_PRESENTATION_DOMAIN_AUTHORITY,
  USER_INTERACTION_DOMAIN_AUTHORITY,
  parseAskArgs,
  parsePresentArgs,
  toModelAnswers,
  toServiceQuestions,
  validateAskTimeout,
} from './ui-mechanics.mjs'
export {
  createUserQuestionsPort,
  hasUiPortFace,
  uiPortFacesOf,
  UI_PORT_FACES,
} from './ui-interaction-port.mjs'
export { createGovernedAskExecutor } from './ask-executor.mjs'
export { createGovernedPresentExecutor } from './present-executor.mjs'
export { buildAskRowDefinition, ASK_ROW_DESCRIPTION, ASK_ROW_TIMED_DESCRIPTION } from './ask-row.mjs'
export { buildPresentRowDefinition, PRESENT_ROW_DESCRIPTION, PRESENT_ROW_PRESENTATION_FACE } from './present-row.mjs'
export { buildUiFamilyContribution } from './ui-family-contribution.mjs'
