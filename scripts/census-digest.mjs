/**
 * The ONE definition of "this string is an identity digest", shared by the census planner and the
 * census aggregator so the two cannot disagree about what a recorded identity may look like.
 *
 * Why a shape check at all (M4 review, blocking finding 1): refusing only `=== null` let
 * `--build-digest null` record the four-character string `"null"`, and two shards echoing it
 * aggregated to `PASS expected=22 observed=22` with exit 0. A sentinel string is not an identity, and
 * "two shards agree with the plan" must never be enough when the shared value is not a digest.
 *
 * Accepted shapes are exactly what the real producers emit:
 *   `sha256:<64 lowercase hex>`  — `test-catalog.mjs`'s catalog_digest and `planDigest()`;
 *   `<40 lowercase hex>`         — `git rev-parse HEAD^{tree}` in a sha1 repo, and the
 *                                  `TEST_USE_BASELINE_SHA` host pin;
 *   `<64 lowercase hex>`         — a BARE sha256 git object id, i.e. `git rev-parse HEAD^{tree}`
 *                                  in a sha256-object-format repo. The previous header claimed this
 *                                  shape was accepted ("any sha256 git object id") while `DIGEST_RE`
 *                                  rejected it: a repo created with `--object-format=sha256` could
 *                                  not record its own tree id. The header and the regex now agree,
 *                                  and the shape is listed here so they cannot drift again (M6).
 * Everything else — `null`, `"null"`, `"undefined"`, `""`, `" "`, uppercase hex, a 39-hex or 65-hex
 * value, `sha256:` without a digest, `sha1:<40hex>`, a bare `sha256:<40hex>` — is refused by name.
 */

export const DIGEST_RE = /^(?:sha256:[0-9a-f]{64}|[0-9a-f]{40}|[0-9a-f]{64})$/

export const DIGEST_SHAPE =
  'sha256:<64 lowercase hex>, <40 lowercase hex>, or a bare <64 lowercase hex> (a sha256 git object id)'

/** Identity fields a plan records. `plan_digest` is derived from them, not read from a file. */
export const IDENTITY_FIELDS = ['merge_tree_sha', 'host_sha', 'catalog_digest', 'build_digest']

export function isValidDigest(value) {
  return typeof value === 'string' && DIGEST_RE.test(value)
}

/** The sentence every refusal uses, so a reader does not have to guess the accepted shape. */
export function digestProblem(value) {
  if (value === null || value === undefined) return 'is unrecorded (null/absent)'
  if (typeof value !== 'string') return `is ${typeof value}, not a string`
  return `is ${JSON.stringify(value)}, which is not a digest (${DIGEST_SHAPE})`
}

/**
 * Validate a whole identity block. Returns named problems; an empty array means every field is a
 * real digest EXCEPT `build_digest`, which may be null only when `allowUnrecordedBuild` is set.
 *
 * @param {object} identity
 * @param {{scope?: 'plan'|'shard', allowUnrecordedBuild?: boolean}} [opts]
 *   scope='plan'  -> a null field is `PLAN_IDENTITY_UNRECORDED` (a plan may not record "unknown"),
 *                    except build_digest -> `IDENTITY_BUILD_UNRECORDED` (its own, older code);
 *   scope='shard' -> a null field is left to the caller's equality check (so a null shard field
 *                    reports `IDENTITY_MISMATCH_<FIELD>`), but a malformed non-null value is
 *                    `DIGEST_INVALID` here, before any equality can "agree" on a sentinel.
 * @returns {Array<{code: string, detail: string}>}
 */
export function identityProblems(identity, { scope = 'plan', allowUnrecordedBuild = false } = {}) {
  const problems = []
  const block = identity !== null && typeof identity === 'object' ? identity : {}
  for (const field of IDENTITY_FIELDS) {
    const value = block[field]
    const absent = value === null || value === undefined
    if (absent) {
      if (scope === 'shard') continue
      if (field === 'build_digest') {
        if (allowUnrecordedBuild) continue
        problems.push({
          code: 'IDENTITY_BUILD_UNRECORDED',
          detail: 'build_digest is null: equality of two unrecorded values is not a build identity — ' +
            're-plan with --build-digest and have the shards report it',
        })
        continue
      }
      problems.push({ code: 'PLAN_IDENTITY_UNRECORDED', detail: `plan.identity.${field} ${digestProblem(value)}` })
      continue
    }
    if (!isValidDigest(value)) {
      problems.push({ code: 'DIGEST_INVALID', detail: `${scope === 'shard' ? 'shard' : 'plan'} identity.${field} ${digestProblem(value)}` })
    }
  }
  return problems
}
