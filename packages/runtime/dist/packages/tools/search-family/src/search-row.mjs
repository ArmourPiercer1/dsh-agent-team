/**
 * search-family/src/search-row.mjs — the governed SEARCH (grep + glob) ROW
 * Definitions (U6 PR5; mirrors the PR2 `read-row.mjs` / PR3 `bash-row.mjs`
 * roles).
 *
 * OWNER ROLE (family lane, §4 Definition & Arguments boundary): the Family
 * owns the Definition PLACEMENT — the mount spellings, the descriptions,
 * the parameter schemas, and the execute transport CONTRACT. The transport
 * implementation is INJECTED by the trusted plane assembly (`rowFactory`):
 * it is the a5p5 lane's reviewed trio registration face
 * (`createGovernedToolDefinitions` — the ONE grep/glob execution ledger per
 * assembly, the same replay/correlation law, the same M1 PA edge). The
 * injection is the DORMANCY LAW (a5p5-dormant-audit): the plane is that
 * lane's only reviewed consumer, so this lane imports NOTHING from it; the
 * plane passes the factory through its form-pinned barrel edge. The third
 * (shell) arm of the trio face this call builds is NOT the search family's
 * to place — the plane discards it and places the PROCESS family's bash row
 * instead (U6 PR3); this face selects exactly the two arms whose names
 * match the Gate 0b-validated grep/glob mount spellings and refuses any
 * other shape (fail closed — a half-row never places).
 *
 * The Result-boundary ENVELOPE (`output:` the host registration face) is
 * attached by the trusted assembly, byte-identical to master's post-build
 * map — the contribution declares it as data (`result.envelope: 'host'`).
 *
 * @module search-family/search-row
 */

/**
 * Build the two governed search row Definitions (grep, glob) for one mount.
 *
 * @param {object} input - the a5p5 assembly face, with `names.grep` and
 *   `names.glob` set to the mount spellings validated by Gate 0b BEFORE
 *   this call (the Family trusts the assembly's validation exactly as the
 *   center file did — the rows are only ever placed by the trusted
 *   assembly). `shellBackend` rides the injected face's own contract; the
 *   shell ARM this builds is discarded by this face, never placed from it.
 * @param {function(object): readonly object[]} rowFactory - the trio
 *   registration face the trusted assembly injects (see owner role;
 *   fail-closed: a placement without its transport is refused, never a
 *   silent half-row).
 * @returns a frozen array of the two row Definitions in the trio's fixed
 *   order (grep, glob), placed verbatim by the plane.
 */
export function buildSearchRowDefinitions(input, rowFactory) {
  if (typeof rowFactory !== 'function') {
    throw new TypeError('SEARCH_ROW_FACTORY_REQUIRED: the governed search rows place through the assembly-injected registration face')
  }
  const built = rowFactory(input)
  if (!Array.isArray(built)) {
    throw new TypeError('SEARCH_ROW_FACTORY_SHAPE: the injected registration face must answer the lane-order definition array')
  }
  const grepName = input?.names?.grep
  const globName = input?.names?.glob
  if (typeof grepName !== 'string' || typeof globName !== 'string' || grepName === globName) {
    throw new TypeError('SEARCH_ROW_NAMES_INVALID: the assembly must hand the Gate 0b-validated DISTINCT grep/glob mount spellings')
  }
  const grepDefs = built.filter((d) => d?.name === grepName)
  const globDefs = built.filter((d) => d?.name === globName)
  if (grepDefs.length !== 1 || globDefs.length !== 1) {
    throw new TypeError(`SEARCH_ROW_ARMS_MISSING: the injected face must answer exactly one grep and one glob arm — got grep=${String(grepDefs.length)} glob=${String(globDefs.length)}`)
  }
  return Object.freeze([grepDefs[0], globDefs[0]])
}
