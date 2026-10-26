/**
 * process-family/src/bash-row.mjs — the governed SHELL takeover ROW
 * Definition (U6 PR3; mirrors the PR2 `fs-family/src/read-row.mjs` role).
 *
 * OWNER ROLE (family lane, §4 Definition & Arguments boundary): the Family
 * owns the Definition PLACEMENT — the native takeover spelling, the
 * description, the parameter schema, and the execute transport CONTRACT.
 * The transport implementation is INJECTED by the trusted plane assembly
 * (`rowFactory`): it is the a5p5 lane's one reviewed shell-row registration
 * face (`createGovernedShellRowDefinition` — same replay ledger, same
 * correlation law, same M1 PA edge, same B3 signal carry; no second execute
 * body exists). The injection is the DORMANCY LAW (a5p5-dormant-audit):
 * the plane is that lane's only reviewed consumer, so this lane imports
 * NOTHING from it; the plane passes the factory through its form-pinned
 * barrel edge. The plane PLACES this definition and the governance Kernel
 * owns the name (§ CI-04: dispatch resolves THIS placement; a row placed
 * under a different name is not the governed shell).
 *
 * @module process-family/bash-row
 */

/**
 * Build the governed shell row Definition for one mount.
 *
 * @param {object} input - the a5p5 assembly face, with `names.bash` set to
 *   the mount spelling validated by the Kernel at Gate 0b BEFORE this call
 *   (the Family trusts the assembly's validation exactly as the center file
 *   did — the row is only ever placed by the trusted assembly).
 * @param {function(object): object} rowFactory - the shell-row registration
 *   face the trusted assembly injects (see owner role; fail-closed: a
 *   placement without its transport is refused, never a silent half-row).
 * @returns the row Definition object (placed verbatim by the plane).
 */
export function buildBashRowDefinition(input, rowFactory) {
  if (typeof rowFactory !== 'function') {
    throw new TypeError('BASH_ROW_FACTORY_REQUIRED: the governed shell row places through the assembly-injected registration face')
  }
  return rowFactory(input)
}
