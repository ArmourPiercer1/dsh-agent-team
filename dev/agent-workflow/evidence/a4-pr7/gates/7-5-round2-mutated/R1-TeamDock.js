import '@deepseek-ai/dsh-client-store/src/rr-nope.js'
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The resident team dock bar above the input (D11–D13): the thin collapsed
 * readout `团队 · N 运行中 · M 待裁决` (zero-count segments omitted, D12/D23)
 * plus the expandable compact member status rows (name + state dot) and
 * current-work activity rows, all read straight from the team projection
 * (D20). The entry renders only for a team session — the frozen
 * resolveTeamProjection test, the tab's same criterion — and cold-fills a
 * projection-mirror gap through `ensureProjection` like the tab. The jump
 * entry activates the "团队" view tab (D13) and the chevron toggles the
 * expansion.
 *
 * P9-T5 (S3-C) mechanical adaptation (plan §8.6): the dock reads the vNext
 * projection mirror + normalized snapshot instead of the leader-keyed view
 * mirror; N comes from the projection lifecycle (never the session log), M
 * from the frozen team-wide ledger summary (never a per-row sum), and the
 * compact task rows become the snapshot's current-work activity rows.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { resolveTeamProjection, sameTeamProjectionResolution, } from '../state/team-session-resolution.js';
import { adaptTeamProjection } from '../model/projection-adapter.js';
import { IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, StateDot, } from '@deepseek-ai/dsh-client-ui-primitives';
import { deriveTeamDockContent, deriveTeamDockCounts, } from '../model/team-dock-model.js';
import styles from './TeamDock.module.css';
const MEMBER_STATUS_KEYS = {
    created: 'view.members.created',
    running: 'view.members.running',
    settled: 'view.members.settled',
    archived: 'view.members.archived',
    disposed: 'view.members.disposed',
};
/**
 * The activity status reuses the Activity section's progress vocabulary
 * keys (the values are the same frozen ProgressValues the Activity rows
 * render; the hyphenated wire value maps onto the underscore key).
 */
const ACTIVITY_STATUS_KEYS = {
    'in-progress': 'view.activity.in_progress',
    completed: 'view.activity.completed',
    blocked: 'view.activity.blocked',
};
/**
 * Map a member display status onto the StateDot states.
 * Provisional T5 mapping (T6 may refine lifecycle colors): created: amber,
 * running: blue, settled/archived/disposed: green (terminal states).
 * @param status - the member row's display status.
 * @returns the dot state.
 */
function memberDot(status) {
    switch (status) {
        case 'created': return 'warning';
        case 'running': return 'ongoing';
        case 'settled': return 'done';
        case 'archived': return 'done';
        case 'disposed': return 'done';
    }
}
/**
 * Map an activity status onto the StateDot states.
 * @param status - the activity row's progress status.
 * @returns the dot state (in progress: blue, completed: green, blocked: red).
 */
function activityDot(status) {
    switch (status) {
        case 'in-progress': return 'ongoing';
        case 'completed': return 'done';
        case 'blocked': return 'error';
    }
}
/**
 * The presentational dock bar (D11/D12): the collapsed one-line readout
 * (zero-count segments omitted) and the expandable compact member status and
 * activity rows. The jump entry activates the team tab (D13); the chevron
 * toggles the expansion.
 * @param props - the normalized snapshot, the tab-jump callback, and the team dictionary.
 * @returns the dock bar.
 */
export function TeamDockPanel({ snapshot, openTeamTab, t }) {
    const [collapsed, setCollapsed] = useState(true);
    const bodyId = useId();
    const counts = deriveTeamDockCounts(snapshot);
    const content = deriveTeamDockContent(snapshot);
    // En spaces (U+2002): HTML collapses runs of ASCII spaces, so widening the
    // separator breathing room needs a literal wide space (the todo strip's
    // same pattern). D12 format `团队 · N 运行中 · M 待裁决`: zero-count
    // segments are omitted with the separator that would dangle; the leading
    // separator after the title renders only while some segment remains.
    const readout = [
        ...counts.runningSessions > 0 ? [t('dock.running', { count: counts.runningSessions })] : [],
        ...counts.pendingControls > 0 ? [t('dock.pending', { count: counts.pendingControls })] : [],
    ].join('\u2002·\u2002');
    return (_jsxs("section", { className: styles.root, "data-team-dock": true, "aria-label": t('dock.title'), children: [_jsxs("div", { className: styles.row, children: [_jsxs("button", { type: "button", className: styles.jump, "data-team-dock-jump": true, title: t('dock.jump'), onClick: () => { openTeamTab(); }, children: [_jsx("span", { className: styles.title, "data-dock-title": true, children: t('dock.title') }), readout !== '' && (_jsxs(_Fragment, { children: [_jsx("span", { className: styles.sep, "data-dock-sep": true, "aria-hidden": "true", children: '\u2002·\u2002' }), _jsx("span", { className: styles.readout, "data-dock-readout": true, children: readout })] }))] }), _jsx("button", { type: "button", className: styles.chevron, "data-team-dock-toggle": true, "aria-expanded": !collapsed, "aria-controls": collapsed ? undefined : bodyId, "aria-label": collapsed ? t('dock.expand') : t('dock.collapse'), onClick: () => { setCollapsed(value => !value); }, children: collapsed ? _jsx(IconChevronUpOutlineRegular, {}) : _jsx(IconChevronDownOutlineRegular, {}) })] }), !collapsed && (_jsxs("div", { id: bodyId, className: styles.expanded, "data-team-dock-expanded": true, children: [_jsx("ul", { className: styles.members, children: content.members.length === 0
                            ? _jsx("li", { className: styles.empty, "data-dock-members-empty": true, children: t('dock.members.empty') })
                            : content.members.map(member => (_jsxs("li", { className: styles.member, "data-dock-member": true, "data-member-status": member.status, "aria-label": `${member.name} ${t(MEMBER_STATUS_KEYS[member.status])}`, children: [_jsx("span", { className: styles.dotSlot, "aria-hidden": "true", children: _jsx(StateDot, { state: memberDot(member.status) }) }), _jsx("span", { className: styles.name, children: member.name })] }, member.key))) }), _jsx("ul", { className: styles.tasks, children: content.activities.length === 0
                            ? _jsx("li", { className: styles.empty, "data-dock-activities-empty": true, children: t('dock.activities.empty') })
                            : content.activities.map(activity => (_jsxs("li", { className: styles.task, "data-dock-activity": true, "data-activity-status": activity.status ?? 'none', "aria-label": `${activity.label}${activity.status !== undefined ? ` ${t(ACTIVITY_STATUS_KEYS[activity.status])}` : ''}`, children: [activity.status !== undefined && (_jsx("span", { className: styles.dotSlot, "aria-hidden": "true", children: _jsx(StateDot, { state: activityDot(activity.status) }) })), activity.subject !== undefined && _jsx("span", { className: styles.subject, children: activity.subject }), activity.status !== undefined && (_jsx("span", { className: styles.taskStatus, children: t(ACTIVITY_STATUS_KEYS[activity.status]) }))] }, activity.key))) })] }))] }));
}
/**
 * The dock entry adapter: resolves the current session's team projection
 * through the frozen team-ness test (the tab's same criterion — the
 * mirror's presence), cold-fills a mirror gap through `ensureProjection`,
 * renders nothing for a non-team session, and hands the normalized
 * snapshot to the presentational panel.
 * @param props - the framework session kit, the injected mirror hook and
 *   cold-pull/jump callbacks, and the team dictionary.
 * @returns the dock bar, or nothing for a non-team session.
 */
export function TeamDock({ sessionId, useProjectionMirror, ensureProjection, openTeamTab, t, }) {
    const resolution = useProjectionMirror(mirror => resolveTeamProjection(mirror, sessionId), sameTeamProjectionResolution);
    useEffect(() => {
        // The dock mounts with every session, so a resolution gap means the
        // team projection is still unknown for this session: fill it once,
        // then let frames win.
        if (resolution === undefined)
            void ensureProjection(sessionId);
    }, [sessionId, resolution, ensureProjection]);
    const snapshot = useMemo(() => (resolution === undefined ? null : adaptTeamProjection(resolution.team, resolution.perspective)), [resolution]);
    if (snapshot === null)
        return null;
    return _jsx(TeamDockPanel, { snapshot: snapshot, openTeamTab: openTeamTab, t: t });
}
//# sourceMappingURL=TeamDock.js.map