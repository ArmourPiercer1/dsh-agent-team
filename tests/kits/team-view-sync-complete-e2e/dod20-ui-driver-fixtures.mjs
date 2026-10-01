/**
 * dod20-ui-driver-fixtures.mjs — static DOM fixtures for the DDoD20 UI driver's
 * offline locator/verdict tests (node --test, zero deps, no browser).
 *
 * GROUND TRUTH (read-only env evidence, dev/agent-workflow/evidence/
 * dod20-browser-20261001/2026-10-01T15-13-44/ — NOT copied, hand-modeled from):
 *  - probe-ui3-out.json 'rail-after-notice'  → collapsed Ungrouped group:
 *    group header span.W0d-vW_title 'Ungrouped', ZERO session rows rendered.
 *  - probe-ui3-out.json 'rail-after-ungrouped' → after the group-header click:
 *    five session rows (span.W0d-vW_title + span.W0d-vW_time siblings) and
 *    button.HVH6QW_sessionOverflowButton 'Show 4 more sessions' — the overflow
 *    button EXISTS ONLY AFTER the group is expanded (dod20-driver3.mjs had zero
 *    'Ungrouped' hits and clicked only the never-visible overflow: the v3
 *    regression that made all four legs NOT_RUN; probe-ui3.mjs:50 and
 *    dod20-driver2.mjs:67 carry the proven expand click).
 *  - probe3-after-rowclick.png → the selected-session header shows the RAW
 *    canonical session id; the hover tooltip REPEATS the row title next to the
 *    rail (duplicate-title hazard).
 *  - shot-E2-ordinary-v3.png → 'New Session' opens the 'Select Workspace
 *    Directory' modal (folders bin / deepseek-harness / workspace + Cancel /
 *    Open); the English bundle renders tabs as Chat / Trajectory / Team.
 *  - tests/homes/<world>/storages/session_projcache/sessions/<id>.json →
 *    record.rows.title.val: the canonical title source (the boot row's title
 *    is null — the parser must treat a null/absent title as fatal, never as a
 *    matchable row).
 *
 * The HTML is HAND-MODELED on those observations (tag + class + text only; no
 * live file content was copied), so no credential-shaped evidence can enter
 * this repo through the fixtures.
 */

export const ROOT_ID = 'session-mpr-t1-mpr-2026-10-01T13-21-34'
export const ROOT_TITLE = 'ack:role-leader:mpr-2026-10-01T13-21-34'
export const MEMBER_ID = 'session-team-child-52860b5a204e428e1cb00690a10eb02f'
export const MEMBER_TITLE = 'ack:role-worker:deleg:mpr-2026-10-01T13-21-34'
export const MEMBER_INSTANCE = 'inst-0iin89s0dvix'

/** Rail chrome labels that are never session rows (probe-ui3-out.json). */
export const CHROME_LABELS = Object.freeze(['New Session', 'Plugins', 'Workspaces', 'Ungrouped', 'New Team', 'Settings', 'DSH Local Build'])

/** One rail row exactly as the shell renders it: title span + time span. */
function rowHtml (title, time = '1h') {
  return `<div class="W0d-vW_row"><span class="W0d-vW_title">${title}</span><span class="W0d-vW_time">${time}</span></div>`
}

/** Rail WITHOUT the notice — the probe3 'rail-after-notice' state: the
 *  Ungrouped group is collapsed, so NOT A SINGLE session row is in the DOM. */
export const RAIL_COLLAPSED = `
<nav class="rail">
  <span class="_25B0JG_localBuildTitle">DSH Local Build</span>
  <span class="_25B0JG_newSessionLabel">New Session</span>
  <span class="_25B0JG_panelTitle">Plugins</span>
  <span class="HVH6QW_sectionLabel">Workspaces</span>
  <div class="W0d-vW_group"><span class="W0d-vW_title">Ungrouped</span></div>
  <span class="label">New Team</span>
  <span class="SNkpza_triggerLabel">Settings</span>
</nav>`

/** Rail after the proven group-header click (probe3 'rail-after-ungrouped'):
 *  five rows render and the overflow button appears behind them. The canonical
 *  member/root targets are NOT among the first five — they hide behind
 *  'Show 4 more sessions'. */
export const RAIL_EXPANDED = `
<nav class="rail">
  <span class="_25B0JG_localBuildTitle">DSH Local Build</span>
  <span class="_25B0JG_newSessionLabel">New Session</span>
  <span class="_25B0JG_panelTitle">Plugins</span>
  <span class="HVH6QW_sectionLabel">Workspaces</span>
  <div class="W0d-vW_group"><span class="W0d-vW_title">Ungrouped</span></div>
  ${rowHtml('ack:role-expert:pre:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-b:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-b-leader:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-a:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-a-leader:mpr-2026-10-01T13-21-34')}
  <button class="HVH6QW_sessionOverflowButton">Show 4 more sessions</button>
  <span class="label">New Team</span>
  <span class="SNkpza_triggerLabel">Settings</span>
</nav>`

/** Full list after the overflow click — all nine canonical rows, the hidden
 *  four (including member and root) now rendered. */
export const RAIL_EXPANDED_ALL = `
<nav class="rail">
  <span class="_25B0JG_localBuildTitle">DSH Local Build</span>
  <span class="_25B0JG_newSessionLabel">New Session</span>
  <span class="_25B0JG_panelTitle">Plugins</span>
  <span class="HVH6QW_sectionLabel">Workspaces</span>
  <div class="W0d-vW_group"><span class="W0d-vW_title">Ungrouped</span></div>
  ${rowHtml('ack:role-expert:pre:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-b:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-b-leader:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-a:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-a-leader:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:global-default:mpr-2026-10-01T13-21-34')}
  ${rowHtml(MEMBER_TITLE)}
  ${rowHtml('ack:role-worker:create:mpr-2026-10-01T13-21-34')}
  ${rowHtml(ROOT_TITLE)}
  <button class="HVH6QW_sessionOverflowButton">Show less</button>
  <span class="label">New Team</span>
  <span class="SNkpza_triggerLabel">Settings</span>
</nav>`

/** Same nine rows in a DIFFERENT order (recency reorder between the title
 *  derivation and the click). Locate must remain title-exact — never by
 *  index, never by "first row that looks like a session". */
export const RAIL_REORDERED = `
<nav class="rail">
  <div class="W0d-vW_group"><span class="W0d-vW_title">Ungrouped</span></div>
  ${rowHtml(ROOT_TITLE)}
  ${rowHtml('ack:role-a:mpr-2026-10-01T13-21-34')}
  ${rowHtml(MEMBER_TITLE)}
  ${rowHtml('ack:global-default:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-expert:pre:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-b:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-b-leader:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-a-leader:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-worker:create:mpr-2026-10-01T13-21-34')}
  <span class="label">New Team</span>
</nav>`

/** Duplicate-title hazard: the hover tooltip repeats the row title next to the
 *  rail (probe3-after-rowclick.png). Two exact matches => AMBIGUOUS fail-closed,
 *  never "pick the first". */
export const RAIL_DUPLICATE_TITLE = `
<nav class="rail">
  <div class="W0d-vW_group"><span class="W0d-vW_title">Ungrouped</span></div>
  ${rowHtml(MEMBER_TITLE)}
  ${rowHtml(ROOT_TITLE)}
  <div class="railTooltip"><span>${MEMBER_TITLE}</span><span>1h ago</span><span>Idle</span></div>
</nav>`

/** Target absent from the rail (e.g. the group was never expanded, or the
 *  session genuinely does not exist): NOT_RUN fail-closed — never a neighbor. */
export const RAIL_TARGET_MISSING = `
<nav class="rail">
  <div class="W0d-vW_group"><span class="W0d-vW_title">Ungrouped</span></div>
  ${rowHtml('ack:role-expert:pre:mpr-2026-10-01T13-21-34')}
  ${rowHtml('ack:role-a:mpr-2026-10-01T13-21-34')}
  <span class="label">New Team</span>
</nav>`

/** Internal Testing Notice overlay (driver-out.json first-load body text;
 *  probe3 proved the real button click via getByRole('button', Continue)). */
export const NOTICE_OVERLAY = `
<div class="noticeModal">
  <h2>Internal Testing Notice</h2>
  <p>DeepSeek Harness 0.1 remains in testing for Harness developers.</p>
  <button type="button">Continue</button>
</div>`

/** Stray blocking modal: the workspace directory picker that 'New Session'
 *  opens (shot-E2-ordinary-v3.png). While it is open the rail sits behind a
 *  scrim — the driver must see it as a BLOCKER, not click through it. */
export const MODAL_WORKSPACE_PICKER = `
<div class="dialog" role="dialog">
  <h2>Select Workspace Directory</h2>
  <span class="crumb">Home</span>
  <ul>
    <li><span class="folderName">bin</span></li>
    <li><span class="folderName">deepseek-harness</span></li>
    <li><span class="folderName">workspace</span></li>
  </ul>
  <button type="button">New folder</button>
  <button type="button">Cancel</button>
  <button type="button">Open</button>
</div>`

/** The picker at the Home root WITH the approved fixture root offered —
 *  the nested-workspace shape (authorized `/home/user/testhome/...` under the
 *  explicit authorized root; review P6 level-by-level plan input). */
export const MODAL_WORKSPACE_PICKER_NESTED = `
<div class="dialog" role="dialog">
  <h2>Select Workspace Directory</h2>
  <span class="crumb">Home</span>
  <ul>
    <li><span class="folderName">bin</span></li>
    <li><span class="folderName">testhome</span></li>
    <li><span class="folderName">workspace</span></li>
  </ul>
  <button type="button">New folder</button>
  <button type="button">Cancel</button>
  <button type="button">Open</button>
</div>`

/** The picker WITHOUT the expected folder (e.g. a different host layout):
 *  E2 must fail closed, never pick a neighbor folder. */
export const MODAL_WORKSPACE_PICKER_NO_FOLDER = `
<div class="dialog" role="dialog">
  <h2>Select Workspace Directory</h2>
  <span class="crumb">Home</span>
  <ul>
    <li><span class="folderName">bin</span></li>
    <li><span class="folderName">deepseek-harness</span></li>
  </ul>
  <button type="button">Cancel</button>
  <button type="button">Open</button>
</div>`

/** Near-miss hazard: only same-prefix / suffix lookalikes of the authorized
 *  folder are offered. Exact-name match must REJECT every one of them. */
export const MODAL_WORKSPACE_PICKER_NEAR_MISS = `
<div class="dialog" role="dialog">
  <h2>Select Workspace Directory</h2>
  <span class="crumb">Home</span>
  <ul>
    <li><span class="folderName">workspace-old</span></li>
    <li><span class="folderName">team-workspace</span></li>
    <li><span class="folderName">workspace copy</span></li>
  </ul>
  <button type="button">Cancel</button>
  <button type="button">Open</button>
</div>`

/** The picker browsed to an UNAUTHORIZED root (the authorized workspace lives
 *  under 'Home' only): exact-path discipline rejects a foreign root. */
export const MODAL_WORKSPACE_PICKER_FOREIGN_ROOT = `
<div class="dialog" role="dialog">
  <h2>Select Workspace Directory</h2>
  <span class="crumb">Documents</span>
  <ul>
    <li><span class="folderName">workspace</span></li>
  </ul>
  <button type="button">Cancel</button>
  <button type="button">Open</button>
</div>`

/** Main pane header of a SELECTED session — probe3-after-rowclick.png proves
 *  it renders the RAW canonical session id (not the title). */
export function sessionHeaderHtml (sessionId) {
  return `<header class="sessionHeader"><h1>${sessionId}</h1><div role="tab">Chat</div><div role="tab">Trajectory</div><div role="tab">Team</div></header>`
}

/** Team face with the manual-refresh control (English bundle; the frozen
 *  Chinese label 刷新团队视图 is the second allowlist entry). */
export function teamFaceHtml (refreshLabel = 'Refresh team view') {
  return `<section class="teamFace"><div role="tab">Team</div><button type="button">${refreshLabel}</button></section>`
}

/** Zero hits and multi hits on the exact-name allowlist (fail-closed shapes). */
export const TEAM_FACE_AMBIGUOUS_REFRESH = `
<section class="teamFace">
  <button type="button">Refresh team view</button>
  <button type="button">刷新团队视图</button>
</section>`

/** A fake projcache record for the E2 post-action cwd assertion. Signal
 *  source verified read-only against the retained world
 *  (tvs-smoke-2026-10-01T15-30-21): storages/session_projcache/sessions/
 *  <sessionId>.json → record.identity.cwd carries the session workspace. */
export function fakeSessionProjcacheRecord (cwd) {
  return JSON.stringify({ version: 1, record: { identity: { sessionId: 'ses-new-ordinary-1', cwd }, rows: { title: { val: 'ping' } } } })
}

/** A fake canonical title map exactly as read from the world's projcache
 *  records (id -> record.rows.title.val). `boot` mirrors the real boot row
 *  whose title is null. */
export function fakeProjcacheTitles ({ rootTitle = ROOT_TITLE, memberTitle = MEMBER_TITLE, rootId = ROOT_ID, memberId = MEMBER_ID } = {}) {
  return {
    boot: null,
    [rootId]: rootTitle,
    [memberId]: memberTitle,
    'session-team-child-259520eccdc5502ef43ef3f0762921e6': 'ack:role-expert:pre:mpr-2026-10-01T13-21-34',
    'session-team-child-99f55d74e63446f6137197e7eda0160c': 'ack:role-b:mpr-2026-10-01T13-21-34',
  }
}

/** A fake access record (the shape of the world's 0600 browser-access.json).
 *  The token value below is a NON-SECRET TEST STRING used to prove the
 *  scrubber never lets a launch URL into output — it is not a real credential.
 *  It is deliberately a legal wire shape at 19 alnum chars (< 20) so strict
 *  repo-wide scans (`?token=[A-Za-z0-9]{20,}`) stay unambiguous (PR54
 *  precedent); the paired test assertions track this exact value. */
export function fakeAccessRecord () {
  return JSON.stringify({
    note: 'PRIVATE operational record',
    world: 'tests/homes/tvs-smoke-FAKE',
    origin: 'http://127.0.0.1:3181',
    launchUrl: 'http://127.0.0.1:3181/?token=FAKEt0kenValue4Test',
    memberSession: MEMBER_ID,
    memberInstance: MEMBER_INSTANCE,
  })
}

/** A fake smoke-host.json (canonical ids only — the real file holds no secret). */
export function fakeSmokeHost () {
  return JSON.stringify({
    origin: 'http://127.0.0.1:3181',
    t1: ROOT_ID,
    t1MemberSession: MEMBER_ID,
    t1MemberInstance: MEMBER_INSTANCE,
  })
}
