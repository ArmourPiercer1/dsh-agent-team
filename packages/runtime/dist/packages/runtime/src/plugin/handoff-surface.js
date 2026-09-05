/**
 * P8-S7-R4 A28 wiring — the two pure halves of the handoff production
 * ports (Architecture §34.2 stage 1 + §34.4):
 *
 * - {@link readCanonicalSourceSurface} — the EXACTLY-ONE freeze read of
 *   the source session's canonical surface, through the DSH public
 *   `sessionQuery` service (the public session-read authority — no
 *   private upstream import; the service arrives through an injected
 *   port).
 * - {@link summarizeSourceSurface} — the one-shot NON-MODEL
 *   deterministic digest of a frozen surface (no model call, no I/O,
 *   no clock read: the digest is a pure function of the frozen input).
 *
 * Both return lossless-JSON (remote-safe) values, so the results cross
 * into the frozen handoff context as pure data — never as a live handle
 * (Architecture §34.3: after creation B cannot reread A; the surface
 * read happens exactly once, at handoff start).
 *
 * Pure module: no `node:` builtins, no DSH imports (the DSH side
 * arrives exclusively through the injected {@link SessionQueryPort}).
 * @module @dsh-agent-team/runtime/plugin/handoff-surface
 */
// --- stage 1: the one-shot canonical surface freeze ---------------------------
/** Extract the model-visible text of one surface event ('' when none). */
function surfaceEventText(event) {
    const data = event.data;
    if (typeof data !== 'object' || data === null)
        return '';
    if (event.type === 'user/message') {
        const message = data;
        return contentText(message.content);
    }
    if (event.type === 'assistant/message') {
        const wrapper = data;
        return contentText(wrapper.message?.content);
    }
    // `tool/result` (the only remaining SurfaceEventType) carries no
    // model-visible prose for a handoff digest.
    return '';
}
/** Join the text blocks of one message (merge-extensible block vocabulary: unknown blocks are skipped). */
function contentText(content) {
    if (content === undefined)
        return '';
    const texts = [];
    for (const block of content) {
        if (block !== undefined && block.type === 'text' && typeof block.text === 'string' && block.text !== '') {
            texts.push(block.text);
        }
    }
    return texts.join('\n');
}
/**
 * Freeze the source session's canonical surface (Architecture §34.2,
 * first stage) — the handoff operation's EXACTLY-ONE read of the source:
 *
 * - `readSurface` is called exactly once (the surface fold is the
 *   authority for what B may know about A);
 * - the title is a best-effort navigation aid (a per-session title
 *   rejection or a titleless log yields `null` and never fails the
 *   handoff);
 * - the result is a lossless-JSON value (messages keep their model-
 *   visible text only; no live handles cross).
 *
 * @param query - the public session-read authority (DSH `sessionQuery`).
 * @param sourceSessionId - the ordinary source DSH session id.
 * @returns the frozen canonical surface.
 * @throws when the surface read itself fails (the handoff operation
 *   then reports its creation-failure triad per Architecture §34.4).
 */
export async function readCanonicalSourceSurface(query, sourceSessionId) {
    const snapshot = await query.readSurface(sourceSessionId);
    let title = null;
    try {
        const [observation] = await query.readTitleSnapshots([sourceSessionId]);
        if (observation !== undefined && observation.status === 'fulfilled') {
            const candidate = observation.value.title?.title;
            if (typeof candidate === 'string' && candidate !== '')
                title = candidate;
        }
    }
    catch {
        // A title-read failure is NOT a surface-read failure: the canonical
        // surface is already frozen above; the handoff proceeds with a null
        // title (the title is a navigation aid, never the handoff content).
    }
    const messages = [];
    for (const event of snapshot.events) {
        const text = surfaceEventText(event);
        if (text === '')
            continue;
        messages.push(event.type === 'assistant/message' ? { role: 'assistant', text } : { role: 'user', text });
    }
    const metadata = {
        capturedThroughSeq: snapshot.capturedThroughSeq,
    };
    return {
        sessionId: snapshot.session.id,
        title,
        createdAt: new Date(snapshot.session.createdAt).toISOString(),
        messages,
        metadata,
    };
}
// --- stage 2: the one-shot deterministic digest -------------------------------
/** Bound one line of the digest to `max` chars (single-char ellipsis). */
function truncate(line, max) {
    return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}
/**
 * Produce the one-shot handoff summary (Architecture §34.2 stage 2,
 * §34.4) — a PURE deterministic function of the frozen surface: no
 * model call, no I/O, no clock read, no randomness. The same frozen
 * surface always yields the same summary (idempotent re-runs of the
 * handoff operation therefore never observe a drifting digest).
 *
 * @param surface - the frozen canonical source surface.
 * @returns the one-line title plus the bounded context bullets.
 */
export function summarizeSourceSurface(surface) {
    const userMessages = surface.messages.filter((message) => message.role === 'user');
    const assistantMessages = surface.messages.filter((message) => message.role === 'assistant');
    const firstUser = userMessages[0];
    const title = surface.title !== null && surface.title !== ''
        ? surface.title
        : firstUser !== undefined
            ? truncate(firstUser.text, 60)
            : `Handoff from session ${surface.sessionId}`;
    const bullets = [];
    const capturedThroughSeq = surface.metadata['capturedThroughSeq'];
    const seqNote = typeof capturedThroughSeq === 'number' ? ` through log seq ${capturedThroughSeq}` : '';
    bullets.push(`Captured ${surface.messages.length} message(s) — ${userMessages.length} user, ` +
        `${assistantMessages.length} assistant — at ${surface.createdAt}${seqNote}.`);
    const firstUserBullet = userMessages[0];
    if (firstUserBullet !== undefined) {
        bullets.push(`First request: "${truncate(firstUserBullet.text, 160)}"`);
    }
    const lastAssistant = assistantMessages[assistantMessages.length - 1];
    if (lastAssistant !== undefined) {
        const last = lastAssistant.text;
        bullets.push(`Last response: "${truncate(last, 160)}"`);
    }
    if (surface.messages.length === 0) {
        bullets.push('The source session carries no model-visible messages at capture time.');
    }
    return { title, bullets };
}
//# sourceMappingURL=handoff-surface.js.map