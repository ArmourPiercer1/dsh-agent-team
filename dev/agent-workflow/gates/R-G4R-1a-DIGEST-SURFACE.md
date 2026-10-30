# R-G4R-1a — plane TrustSources digest surface (DESIGN)

<!-- lane: R-G4R-1a (offline, no boot) · seat: qwen3.8-flash-next · written 2026-10-30 (real UTC, `date -u` at authoring; ROUTER_RULES §8.5.8) -->
<!-- scope source: dev/agent-workflow/evidence/review-routing-20261028/REVIEW-REMEDIATION-20261028.md row R-G4R-1a; G4-PROMOTION-REVIEW-R2.md F1 (glm) / M1+MEDIUM-1 (v4-pro); GATE-LEDGER.md G4-PASS row (carried residual) -->

## 0. What this PR is and is NOT

- **IS**: the digest *surface* (plane code that computes a trusted-sources digest from bytes),
  the RUN-record *schema cells* (canary runners + arc-b c-suite so FUTURE records emit them),
  and unit tests. No boot, no host change, CORE PATCH BUDGET untouched (0 host edits).
- **IS NOT**: the live rebind. The rebind is a NEW RUN record produced by a FUTURE boot lane
  (pool C) running these runners; only that record can carry a non-null digest bound to a live
  verdict. The four canary records and the arc-b record are NEVER rewritten (they bind older
  trees; `u5-run-record/1` bindings are additive so no record-schema bump is needed — the new
  cell is versioned by its own `trustedSources.schema = 'u7r3-g4r1a/plane-trusted-sources/1'`).
- **NOT taken here**: the option-(b) ruling "the census inventory *substitutes* for the plane's
  runtime admission document, close R-G4R-1a without it". That is a user/lead decision. This cell
  records `substituteAdoption: 'none'` and keeps the runtime-admission-document unavailability
  disclosure VERBATIM inside itself, so neither laundering nor silent preemption is possible.

## 1. Name collision, resolved once

`scripts/eb3-trusted-sources.mjs` is the **MCP tool-name ledger** check (CI admission bookkeeping
for `mcp__<server>__<tool>` spellings). It is a different concept with a similar name; R-G4R-1a
does not touch it. This note's "TrustSources" = the plane's **source documents whose bytes the
run's judgments are computed against**.

## 2. What plane TrustSources ARE (named, cited — not invented)

At the plane level (this repository's acceptance plane — the code that produces RUN verdicts), a
run's answer depends on exactly three source families. Each already has (or now gets) an
honest cell; the digest surface binds the union:

1. **BL pins / reviewed tool-obligations family** — `dev/engineering/tool-obligations/`:
   `manifest.json` (the digest ledger pinning both artifacts, both schemas, the generator, and
   the reviewed inputs **including** `TOOL-CAPABILITY-MATRIX-9b2.md` and
   `ALPHA5-EFFECTIVE-BACKLOG.md` — the BL pins), `authoritative-tool-sources.v1.json` (static
   registration census), `expected-tool-obligations.v1.json` (the reviewed expected set).
   This is the plane's reviewed *admission inventory*: `packages/testkit/census/expected-obligations.mjs:38`
   already computes `digest: bytesDigest(bytes)` per artifact and `loadExpectedPair`
   (`:47-53`) hands the reconciler `__digest` for both — **the plane already digests these bytes**
   (canonical-JSON law, `packages/testkit/census/json-canonical.mjs:20`); the RUN record surface
   simply never carried it. A runtime observation with no entry there "is UNKNOWN, never
   authorized" (`dev/engineering/tool-obligations/README.md`, law 2).
2. **Composed profile** — the exact patch bytes each World launches. Already computed-from-bytes:
   `tests/world-factory/lib/binding-digests.mjs:389` (`captureProfileBinding`), fired from
   `tests/world-factory/lib/world-factory.mjs:704-705` pre-spawn and re-proved post-spawn at
   `:727`. Cell: `composedProfileDigest` (per-world map) + `profileArtifacts`.
3. **Oracle asset set** — the suite's executable expected-answer closure. Already
   computed-from-bytes: `binding-digests.mjs:241` (`captureOracleBinding`) under the recorded
   `ORACLE_HASH_LAW`. Cell: `worldOracleDigest` + `worldOracle` + cited artifact.

Separate rows, separate scopes — NOT folded in:

- **R-ORACLE-1**: `tests/world-factory/lib/host-sandbox-assets.mjs:223` (@candidate
  `5d0c8ff58`; same edge now at `:228` on `origin/master` tip) — the dynamic-import
  `await import(pathToFileURL(entryModulePath).href)` makes the closure disclosure
  `worldOracle.complete=false` on ARC-D/Jobs. That is an **oracle-closure completeness** fact;
  it lives in the `worldOracle` cell and its remediation row. The trusted-sources digest does not
  consume `worldOracle.complete` and this lane does not touch that file.
- **Authority binding** (`dev/engineering/current-authority.json` → snapshot, via
  `readAuthorityBinding`): its own `authority` cell, its own machinery (`scripts/current-authority.mjs`,
  fail-closed). Not duplicated into the trusted-sources set; the union digest names only the
  three families above so each ledger row keeps one home.
- **Runtime admission document**: the *running* World's public World/HTTP surface exposes no
  TrustedSources/admission-source document or digest. That limitation is TRUE, remains TRUE
  (CORE PATCH BUDGET = 0: no new host endpoint may be added), and is carried VERBATIM inside the
  new cell as `admissionDocument: { available: false, reason: … }`.

## 3. What this surface is, honestly

`trustedSourcesUnavailable()` (`binding-digests.mjs:433`) established the honest two-step
pattern for this cell: *compute-from-bytes or null-with-reason, never null-filled-retroactively*.
R-G4R-1 keeps `trustedSourcesDigest=null` because the cell was interpreted as demanding the
RUNTIME admission document. What is computable WITHOUT any new host surface is the digest of the
three plane-side families above — they are tracked repo bytes the runners already consume. So:

- The cell digest = union digest over the family entries (1), plus the oracle entry (3, sha256 =
  `worldOracleDigest`), plus one profile entry (2, sha256 = `composedProfileDigest`) per launched
  World as they bind. Every entry's sha256 is computed from bytes by plane code at capture time;
  the profile/oracle entry values ARE their cells' digests, verifiable by their own
  recomputation laws (`recomputeWorldOracle`, launched-profile re-hash).
- This is **not** a claim that the census inventory is the runtime admission document: the cell
  says `substituteAdoption: 'none'` and repeats the admission-document refusal. Whether the
  union digest closes R-G4R-1a (substitution) is a lead/user ruling; whether it merely closes
  "the runner surface exposes a plane TrustSources digest" (surface) is settled by this PR.
- **No CORE_SEAM_BLOCKER**: nothing here needs host surface. The runtime-admission-document
  variant WOULD need one (host endpoint) — it stays disclosed-unavailable, which is the status
  quo, not a new blocker introduced by this lane.

## 4. Digest law and cell shape (implemented in plane code)

Home: `tests/world-factory/lib/binding-digests.mjs` — trusted plane code, already a
`HELPER_EXCLUSIONS` member of its own oracle closure law (`:41-45`), so editing it cannot move
any suite's `worldOracleDigest`. No new scannable runtime file is created (eb3 scan roots are
`packages|tests|scripts`; the file exists there already; tests go to the existing
`tests/world-factory/binding-digests.test.mjs`).

```
role      identifies the source (unique in a set): 'tool-obligations-manifest' |
          'authoritative-tool-sources' | 'expected-tool-obligations' | 'world-oracle' |
          'composed-profile/<worldId>'
path      repo-relative posix path of the source bytes (family files, oracle artifact when
          citable; '' for per-world profile entries — their bytes are bound by the
          composedProfileDigest cell and re-hashed from the launched file)
sha256    per-source digest hex, computed from the EXACT bytes at capture (family files), or the
          authoritative cell digest (oracle/profile)

TRUSTED_SOURCES_ORDER     sources sorted lexically ascending by role + 0x00 + path (JS string
                          order); insertion order never affects the digest (order-independence).
TRUSTED_SOURCES_HASH_LAW  sha256 over, for each entry in that order:
                          utf8(role) + 0x00 + utf8(path) + 0x00 + utf8(sha256hex) + 0x00
```

Bindings block (additive; versioned by the cell's own `schema`):

```jsonc
"trustedSourcesDigest": "<hex>" | null,
"trustedSourcesUnavailableReason": "<present ONLY when the digest is null>",
"trustedSources": {
  "schema": "u7r3-g4r1a/plane-trusted-sources/1",
  "digest": "<hex>" | null,
  "hashLaw": "…", "order": "…",
  "sources": [ { "role": "…", "path": "…", "sha256": "…" } ],
  "missingSources": [ … ],                      // any missing family file forces digest null
  "admissionDocument": { "available": false, "reason": "<the R-G4R-1 verbatim disclosure>" },
  "substituteAdoption": "none",
  "recompute": "recomputeTrustedSources(record, repoRoot) — family sha256 re-hashed from bytes; full digest re-derived from the entry list"
}
```

Null-with-reason remains LEGAL and is fail-closed:
- empty declared set → `digest: null` + reason (an empty set binds nothing — saying so is honest);
- any declared family file unreadable → `digest: null` + `missingSources` named (a PARTIAL union
  digest would misrepresent what is bound, so no digest is emitted at all);
- runtime admission document → permanently `available: false` absent a host seam, disclosed.

Surface API (exported from `binding-digests.mjs`): `computeTrustedSourcesDigest(entries)` (pure),
`captureTrustedSourcesBinding({repoRoot, family?, extraEntries?})` (runner-side, spreadable),
`refreshTrustedSourcesDigest(bindings)` + `bindWorldProfile` refresh (per-world profile entries),
`recomputeTrustedSources(record, repoRoot)` (cold-reader verification; mutation-RED).

## 5. Consumers and non-effects

- `scripts/eb3-run-manifest.mjs` / `eb3-tool-acceptance.mjs` consume only
  `teamSha/hostSha/authority/provider` from bindings — additive cells validate unchanged (unit
  coverage proves the new cell passes `validateRunRecord` with `findings=[]`).
- Existing records: bytes untouched; their `trustedSourcesUnavailableReason` stays the truthful
  description of records made before this surface.
- Runners wired (future records only): `tests/world-factory/u5-canary-runner.mjs`
  (ARC-A/ARC-D/crash-A shapes), `tests/world-factory/u7-4a-jobs-suite.mjs` (Jobs shape),
  `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs` (arc-b c-suite — gains
  `composedProfileDigest`/`profileArtifacts`, oracle cells + cited evidence, trusted-sources
  cells, and the `sandboxPreflight` registration via `factory.bindRunRecord`; in-place driver
  fixes with dated disclosure are the established practice for this file, per
  `dev/agent-workflow/evidence/u7-tbash-l4-20261027/README.md` F-1/F-2 addenda).

## 6. Honest residuals (do NOT claim closed)

- **Live rebind**: open — a future boot-lane (pool C) record must carry the non-null digest;
  R-G4R-1a closes only per its chosen closure law once such a record binds a live verdict.
- **Option-(b) substitution ruling** (census inventory as substitute): user/lead-owned; this
  lane implements the surface only.
- **R-ORACLE-1**: untouched by design (separate row; §2).
- **Runtime admission document on World/HTTP**: still absent by host design; disclosed in-cell.
