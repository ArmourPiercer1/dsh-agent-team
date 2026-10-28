# R429 Retro — Independent Review (dimension: ENV_BLOCK judgement fidelity)

- Reviewer: cross-model independent (og), risk R2, PR #429 (merged)
- Worktree: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rr-429`
- HEAD verified: `c2b03fc341937a6b7dfc65035ae36f8e1d66fa1c` (detached, `git status --porcelain` = 0 lines) — no checkout performed
- Method: read-only code reading + one in-memory node import matrix. **No Host started, :3080 / ~/.dsh untouched, no test suite executed, no writes to the repo.**
- Time: 2026-10-28 (single-turn completion)

## Self-check (mandatory, completed before evidence)

- [x] HEAD = `c2b03fc34`, detached, porcelain empty (re-checked before finishing: command evidence, not assumption)
- [x] Target files exist: `tests/world-factory/provision-host-sandbox.mjs` (4412 B), `tests/world-factory/lib/host-sandbox-assets.mjs` (36175 B)
- [x] Evidence is command-level (file:line quotes + executable probe) — not inference from PR text
- [x] Every claim below either quoted from source or produced by the in-memory probe
- [x] Negative findings state severity honestly; known residual NEW-1 explicitly re-verified
- [x] Repo read-only: only `.artifacts/reviews/` written

## Check 1 — Where ENV_BLOCK is assigned; can it be recorded with partial/full probe or without a typed refusal?

**Single gate** — `tests/world-factory/lib/host-sandbox-assets.mjs:661-676`:

```js
export function nativeConfinementEnvBlock({ observedText = '', observedSignal = null, preflight = null } = {}) {
  const signal = ... : sandboxUnavailableSignal(observedText)
  if (signal.present !== true) return null          // typed refusal REQUIRED
  if (!isSandboxPreflightRecord(preflight)) return null  // branded record REQUIRED
  if (preflight.backend !== 'unusable') return null      // probe verdict REQUIRED = unusable
  return { typedSignal: signal, sandboxPreflight: {...}, note: '... recorded as ENV_BLOCK (never PASS, never a product FAIL)' }
}
```

`isSandboxPreflightRecord` (line 640-647) is identity-first: `PREFLIGHT_RECORDS.has(value)` (module-private `WeakSet`, line 139) **and** `schema === 'u7-sbx-sandbox-preflight/1'` **and** `probed === true` **and** `typeof backend === 'string'`.

**Callers** (both only after the leg already failed its functional assertions, so ENV_BLOCK can never soften a PASS):
- `tests/world-factory/lib/u74a-jobs-assembly.mjs:849` — `const nativeEnvBlock = ctlOk ? null : nativeConfinementEnvBlock({ observedText: ctl, preflight: opts.sandboxPreflight ?? null })`
- `tests/world-factory/lib/u6-arc-d-assembly.mjs:553` — `const envBlock = couldNotRunAtAll ? nativeConfinementEnvBlock({ observedSignal: nativeLaneSignal, preflight: sandboxPreflight }) : null`

**Executable negative matrix** (in-memory import, no I/O side effects) — every row returns `null` ⇒ leg stays FAIL:

| case | result |
|---|---|
| no pre-flight record at all, typed text present | `null` |
| forged `{schema, probed:true, backend:'unusable'}` + typed text | `null` |
| JSON round-trip of that forged object | `null` |
| spread clone of it | `null` |
| forged record, text = "tool completed fine" (no refusal) | `null` |
| empty `observedSignal` object | `null` |
| `sandboxUnavailableSignal('bash failed: no sandbox backend is usable on this host')` | `{"present":true,"markers":["typed-message"]}` |

Answers: **probe=partial/full + no typed refusal → refused (null → FAIL).** `backend !== 'unusable'` is an explicit third conjunct, so a *usable* probe can never yield ENV_BLOCK. **Typed refusal + no pre-flight record → refused (null → FAIL)**, including a perfect-shape forged record: only an object minted by `preflightHostSandbox()` in this process passes (`WeakSet` brand, `host-sandbox-assets.mjs:581`). No ENV_BLOCK can be produced by JSON-deserialising a run record — deliberate, and disclosed in `docs/TEST_METHODS.md:136`.

**Scope finding (P2)** — the conjunction is enforced only on the native (non-governed) legs. `tests/world-factory/suites/070-u7-f-web.mjs` still records ENV_BLOCK with *neither* a pre-flight record *nor* a typed host refusal, on unrelated grounds: line 309 `add('web:fetch-positive', 'ENV_BLOCK', { reason: 'no durable ask row reached the ledger face ...' })`, line 322 `web:approval-chain-live`, line 331 `web:deny-leg-zero-wire`, line 338 `web:search-no-provider`. Read literally, "ENV_BLOCK may only be recorded when probe record AND typed refusal both hold" is violated by those four assignments. Read as scoped (TEST_METHODS §9 scopes it to the native constraint legs), they are out of scope. The reviewed code makes the *native* rule airtight but does not make the invariant global; the rule text and the code agree only under the narrow reading.

## Check 2 — Pre-flight embedding: field name and mandatory-ness

- Field: **`bindings.sandboxPreflight`**, plus `bindings.nativeConfinementBackend` and, whenever backend !== 'full', `bindings.nativeConfinementDisclosure`. All three set in one place, `tests/world-factory/lib/run-record.mjs:156-165`:

```js
export function bindSandboxPreflight(bindings, preflight) {
  if (bindings === null || typeof bindings !== 'object') return bindings
  if (preflight === null || preflight === undefined) return bindings
  bindings.sandboxPreflight = preflight
  bindings.nativeConfinementBackend = String(preflight.backend ?? 'unknown')
  if (bindings.nativeConfinementBackend !== 'full') { bindings.nativeConfinementDisclosure = `... never as a product PASS ...` }
```

- Fan-out: `lib/world-factory.mjs:280-286` (`preflightHostSandbox`) caches the record and re-binds it into **every** registered record (`for (const r of this.runRecords) bindSandboxPreflight(...)`), and line 260 binds at registration time, so a record registered *before* the probe is still stamped.
- **Mandatory?** The *measurement* is mandatory before the first Host start: `world-factory.mjs:596` `await this.factory.preflightHostSandbox({})` sits inside a `try` that rethrows as `HostBaseError('sandbox pre-flight refused before the first host start: ...')`. The *persisted field* is not: it exists only if a run record is registered **and** `--run-record <path>` is supplied (`u5-canary-runner.mjs:24-30, 137, 982/1051`: `if (runRecordPath !== null) record.write(...)`).
- Fidelity consequence: the verdict does not depend on the persisted field — the judge consumes the live branded object, and a replayed record cannot open ENV_BLOCK (Check 1). So a record missing `bindings.sandboxPreflight` cannot hide an ENV_BLOCK, and cannot fabricate one. The persisted field is evidence/documentation, not the gate (P3 note: an auditor holding only the JSON can confirm the disclosure but cannot re-derive the verdict — by design).

## Check 3 — Fail-closed paths of provisioning (incl. known residual NEW-1)

- **SOURCE_IS_DESTINATION** — `host-sandbox-assets.mjs:418`: `if (src.tree === layout.runtimeTree) throw new HostSandboxAssetError('SOURCE_IS_DESTINATION', 'the provisioning source resolves to the destination tree ... name a source tree with `--source-tree` or ${SOURCE_TREE_ENV}')`. Correct and fail-closed; note it is evaluated *after* `assertTrustedSourceTree` (line 417) import-validates the source — bounded, because when source==destination the imported module is the destination's own code, and it fires before any read/copy.
- **Manifest path traversal** — string-level, pre-join (`F6`, line 176-190): rejects NUL, absolute, drive-letter/UNC, and any `'' | '.' | '..'` segment, requires `segments[0] === 'bin'`, then re-checks containment of the normalised join inside `bin`. Second, resolved-layout check at line 378-381: `if (!abs.startsWith(layout.binDir + sep)) throw MANIFEST_PATH_UNSAFE ... nothing was written`. Two independent layers, string first — correct.
- **Mode validation** — `parseManifestMode` (line 165-168) enforces `/^0o[0-7]{3}$/` at manifest load (`MANIFEST_MODE_INVALID`); publish path re-reads the on-disk mode and deletes the file on drift (`PUBLISHED_MODE_MISMATCH`, line 462-468): `unlinkSync(f.path); throw ... 'the file was removed again rather than left un-/over-executable'`. Digest is verified three times on the copy path (source → staged → published), each throwing and cleaning up.
- **NEW-1 residual — REAL, confirmed.** The `present` path verifies bytes only (line 394-399): `if (f.present && f.sha256 !== f.expectedSha256) throw DESTINATION_DIGEST_MISMATCH`, then, when nothing is missing, returns `action: 'present'` with `files: destination.map((f) => ({ ...f, state: 'present', mode: modeString(f.path), bytesWritten: 0 }))` (line 399-404). `f.modeBits` is computed (line 392) but **never compared on this path**; the `PUBLISHED_MODE_MISMATCH` guard lives only in the copy loop (`destination.filter((d) => !d.present)`, line 446). So a pre-existing launcher with the pinned bytes but an unpinned mode (e.g. `0o666`, or non-executable) is accepted as provisioned.
  - Severity: **P3, bounded, no false green.** The record carries the *actual* mode (`modeString`), so nothing claims the pin was met; a non-executable launcher fails the subsequent probe with a typed error, which surfaces as `provisionError`/unusable rather than a PASS. The genuine exposure is integrity: an over-permissive (world-writable) pre-existing launcher is accepted and later executed. Fix shape would be one `modeOf(f.path) !== f.modeBits → PUBLISHED_MODE_MISMATCH`-style refusal (or explicit "present but unpinned mode" state) in the `present` branch, mirroring line 462.

## Verdict: PASS-WITH-FINDINGS

The core judgement rule is faithfully implemented: ENV_BLOCK requires the **conjunction** (branded real probe record + `backend === 'unusable'` + typed refusal actually observed) and is unreachable by forgery, JSON replay, clone, partial/full probe, or refusal-less text; all six adversarial cases tested return `null` → FAIL. The pre-flight record is embedded as `bindings.sandboxPreflight` and is measurement-mandatory before the first host start.

| ID | Sev | Finding |
|---|---|---|
| R429-OG-1 | P2 | The "ENV_BLOCK only on conjunction" rule is enforced only on the two native legs; `070-u7-f-web.mjs` assigns ENV_BLOCK at four sites (309/322/331/338) with no pre-flight record and no typed refusal. Rule text and code agree only under the narrowly-scoped reading. |
| R429-OG-2 | P3 | NEW-1 confirmed: `present` path validates digest but never compares against the pinned mode; only freshly published files get `PUBLISHED_MODE_MISMATCH`. No false green (record shows actual mode), exposure is an over-permissive pre-existing launcher being accepted then executed. |
| R429-OG-3 | P3 | `bindings.sandboxPreflight` is persisted only when `--run-record` is supplied (u5-canary-runner 982/1051); the probe itself is mandatory and the verdict consumes the live branded object, so this is evidence-completeness, not verdict risk — but record-only audits cannot re-derive ENV_BLOCK (by design). |
| R429-OG-4 | P3 | `SOURCE_IS_DESTINATION` is raised after `assertTrustedSourceTree` has import-validated the source tree; bounded (same tree ⇒ same code) but the equality check could precede the trust check for strict ordering. |

No P1. No HOLD condition. Repo left unmodified (`git status --porcelain` 0 before and after; only `.artifacts/` written).
