/**
 * Map one plane event onto the job outcome closed set. Returns `undefined`
 * for events that carry no outcome fact (the gateway ignores those, it does
 * not guess). Unknown event names are IGNORED-LOUDLY by the caller (the
 * gateway raises its own alarm); this table never stretches.
 */
export function classifyDispatchEvent(event) {
    switch (event.event) {
        case 'dispatcher-call-cancelled-before-body':
            // Abort-before-exec form, lane-issued: the Body was never resolved.
            return {
                kind: 'not-started',
                sideEffectPossible: false,
                evidenceEvent: event.event,
                abortIssuedBy: event.abortIssuedBy ?? 'lane-definition-move',
            };
        case 'dispatcher-call-cancelled-by-others':
            // Same HOST face, different issuer: still "not started", but the
            // gateway must not attribute the cancellation to itself.
            return {
                kind: 'not-started',
                sideEffectPossible: false,
                evidenceEvent: event.event,
                abortIssuedBy: event.abortIssuedBy ?? 'other',
            };
        case 'dispatcher-call-terminated-after-body-start':
            // Terminate form: started ⇒ side effects possible/real, value kept.
            // `sideEffectPossible: true` is the plane's own attachment; the
            // boundary hard-codes it because a started Body CANNOT be reported
            // with sideEffectPossible false even if the event lost the field.
            return {
                kind: 'terminated-after-start',
                sideEffectPossible: true,
                evidenceEvent: event.event,
                abortIssuedBy: event.abortIssuedBy ?? 'unknown',
            };
        case 'dispatcher-call-completed-after-abort':
            // The abort lost the race: EXECUTED, said out loud.
            return {
                kind: 'executed-despite-cancel',
                sideEffectPossible: true,
                evidenceEvent: event.event,
                abortIssuedBy: event.abortIssuedBy ?? 'lane-definition-move',
            };
        case 'dispatcher-call-outcome-unreadable':
        case 'dispatcher-call-executed-unvalidated':
            // Nothing is known (or the fact is an integrity alarm, not an outcome):
            // the job stays unresolved rather than picking a shape.
            return {
                kind: 'unresolved',
                sideEffectPossible: true, // an unvalidated execution may have done anything
                evidenceEvent: event.event,
                abortIssuedBy: event.abortIssuedBy ?? 'unknown',
            };
        default:
            return undefined;
    }
}
//# sourceMappingURL=cancellation-boundary.js.map