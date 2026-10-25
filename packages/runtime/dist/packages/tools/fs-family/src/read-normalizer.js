/**
 * fs-family/src/read-normalizer — the Family PURE normalizer for the
 * governed `read` operation projection (U6 PR2; U6-SLICE-PLAN PR2: "the
 * canonical-operation.ts `case 'read'` projection moves to the family's pure
 * normalizer slot, the KERNEL computes the fingerprint from the returned
 * projection").
 *
 * CONDITION 7 (u4-g1f-sup-a §5): the Family's part is PURE — it turns the
 * call arguments into the security projection and nothing else. It mints no
 * fingerprint (the authority computes `sha256:` over the projection via the
 * ONE fingerprint law), it resolves no path (the injected resolver seam owns
 * path semantics), it refuses no call (a refusal is an authority verdict;
 * this function only reports, as data, that the arguments carry no
 * well-formed projection — the caller maps that to the typed fail-closed
 * error). ZERO imports by design: nothing in this file can reach authority.
 *
 * THE FINGERPRINT GOLDEN LAW (this PR's mandatory gate): the projection
 * produced here, fed through `buildFingerprint` (operation-permission's
 * `sha256:` + sha256 over the canonical key-sorted JSON), reproduces master's
 * `canonicalizeOperation('read', …)` fingerprint BYTE-IDENTICALLY over the
 * pinned corpus — durable grants and rules are keyed by that fingerprint and
 * must survive the move unchanged. The gate is
 * `packages/runtime/test/u6-pr2-read-golden-vectors.test.ts` (877-vector
 * corpus, digest `7fbb3ab9ae48451fc8ab41489491dfcf4d0420bfaa0f596dd09c949124a7987c`,
 * recorded from master @ 2db321f63 BEFORE the move).
 *
 * The semantics below are the A2C-5 conservative window identity (the moved
 * `effectiveReadWindow`, canonical-operation.ts:321-356 @ master): `offset` =
 * the tool's own FIXED defaulting (omitted → 1, one-based — the
 * pinned-upstream `parseReadArgs` default); `limit` = the EXPLICIT value only
 * (omitted → **null**, the projection carries the ABSENCE, never a
 * substituted deployment constant — `read(file)` and `read(file, limit:
 * 2000)` are DISTINCT identities); a present-but-invalid window value means
 * the TOOL would reject the call, so there is no effective window to
 * authorize: `{ ok: false, reason }` with the closed reason strings master
 * uses (`read-offset-invalid` / `read-limit-invalid`) and the raw value as
 * data (the authority maps it through its own detail sanitizer).
 *
 * @module fs-family/read-normalizer
 */
/** Positive-integer check — verbatim mirror of the authority's (the upstream
 *  tools' `oneBased`/`parsePositiveInteger`). */
function isPositiveInteger(value) {
    return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}
/** The one-based `read` offset default at the pin (the authority's
 *  `READ_OFFSET_DEFAULT`; mirrored as data because the family stays pure). */
const READ_OFFSET_DEFAULT = 1;
/**
 * Project one `read` call's window arguments into the security projection.
 * `resourceKey` is left EMPTY: the authority fills it from the injected
 * resolver seam (path semantics are never the Family's), exactly as master's
 * `case 'read'` did (`projection['resourceKey'] = target.key` after the
 * switch).
 *
 * @param tool - the exact tool name (carried into the projection verbatim;
 *   the type pins this normalizer to 'read' — every other tool's projection
 *   law stays the authority's own).
 * @param args - the losslessly-parsed arguments record.
 * @returns the projection, or the closed failure (reason + raw value).
 */
export function normalizeReadProjection(tool, args) {
    const offset = args['offset'];
    const limit = args['limit'];
    if (offset !== undefined && !isPositiveInteger(offset)) {
        return { ok: false, reason: 'read-offset-invalid', value: offset };
    }
    if (limit !== undefined && !isPositiveInteger(limit)) {
        return { ok: false, reason: 'read-limit-invalid', value: limit };
    }
    return {
        ok: true,
        projection: {
            tool,
            resourceKey: '',
            offset: offset ?? READ_OFFSET_DEFAULT,
            // A2C-5: the omission is an IDENTITY — null, never a deployment constant.
            limit: limit ?? null,
        },
    };
}
//# sourceMappingURL=read-normalizer.js.map