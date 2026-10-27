# `packages/tools/process-family` — the Process/Shell Family lane (U6 PR3)

Owner of the governed shell row's FAMILY-owned halves, moved VERBATIM out of
the center files at master `cd54f3b7c` (U6 slice plan PR3: "extend … with the
confined-shell contribution (move `plane-effect-backends.mjs:678–1073` + the
shell decide class tables into the contribution)"; center-assembly-architecture
§4 six boundaries; §10.2 ARC-B).

| File | Boundary owned |
| --- | --- |
| `src/shell-mechanics.mjs` | the settle/cancel/drain law (`raceShellSettle` closed tie law `exited > timedOut > aborted`; `shellCancelled` closed `AgentCancelCause` face; `drainShellStdio` completeness law) — re-exported by the center for pinned consumers |
| `src/confined-shell-executor.mjs` | the Execution boundary body: `createConfinedShellBackend`, the adapter over the NAMED, REVIEWED confined process provider (`packages/runtime/sandbox-provider/`, CI-07 — never a family self-attestation; the Gate 0c trustRoot⇄launcher pairing stays the trusted mount's law) |
| `src/bash-normalizer.ts` | the Definition/normalization PURE half: the shell-class operation projection the center's canonicalizer consumes (`normalizeShellProjection`, zero imports); the Kernel computes the fingerprint from what it returns (condition 7) |
| `src/bash-row.mjs` | the row Definition the trusted assembly places under the Gate-0b-validated mount spelling (§ CI-04); the execute transport is the a5p5 lane's ONE `makeExecute` (no second execute body) |
| `src/bash-contribution.mjs` | the §4/§10.3 contribution descriptor (`dsh.process-family`; `admission`/`grantMint`/`grantConsume` declared `kernel` — § CI-06; the source digest binds the placed row + executor + mechanics + the mount's launcher pin) |
| `src/index.mjs` | lane barrel (a lane barrel, NOT the shared one — mounting is the trusted assembly's reviewed move) |

## Owner role (and the protected set)

The Family owns the Definition, the argument contract, the effect BODY and
the result SHAPE. It owns NO authority: it never admits, never mints a grant,
never consumes one, never decides — the contribution's `obligations` block
states that as data and the Kernel's closed schema refuses any other value.
Authority forces are injected at the trusted assembly point
(`packages/runtime/src/plugin/live/*` plane). Nothing under this directory may
import the plane, the governance-center lane, or Host internals; the outward
edges are repo lanes only (`contracts`, `sandbox-provider`, `controlled-fs`
through the fs-family anchor face, the a5p5 registration face, and — U7-F,
the pwsh row's PA edge — the frozen effect-vocabulary and fingerprint face
`../../../domain/tool-governance/src/index.js` (`parseRequestedEffectSet`,
`canonicalJsonFingerprint` — registered consumer:
`scripts/audit-a5-tool-governance-imports.mjs` + the pinned set in
`packages/domain/test/a5p0-layer-audit.test.ts`), read-only, never an
authority).

## ONE kernel, ONE ledger (ARC-B)

The bash row is owned by the SAME Governance Kernel instance as the read row
(one approval table per mount, `(scopeKey, nativeName)` entries, the same
`consumeOnce` edge, the same refusal codes for revoke / scope drift / grant
replay). There is no bash-specific decision path and no dual ledger at any
slice: `packages/runtime/test/u6-pr3-arc-b.test.ts` proves both families
produce the SAME state-transition trace shape through the one kernel.

## THE FINGERPRINT GOLDEN LAW

`bash-normalizer` + the center's fingerprint computation reproduce master's
`canonicalizeOperation('bash' | 'pwsh', …)` output BYTE-IDENTICALLY — the
pinned-corpus gate `packages/runtime/test/u6-pr3-shell-golden-vectors.test.ts`
(299 vectors: quoting, unicode, env-assignment prefixes, pipes/redirects,
very long commands, newlines, cwd variants, every closed reason and detail
shape; master recording under
`dev/agent-workflow/evidence/u6-pr3-20261026/golden-vectors-master.json`).
Durable grants/rules keyed by that fingerprint survive the move unchanged.

## DIST MIRROR

The `.mjs` files here are tracked as BYTE COPIES under
`packages/runtime/dist/packages/tools/process-family/src/` via the PLACEMENTS
list in `scripts/place-dist-glue.mjs` (tsc never emits .mjs);
`bash-normalizer.ts` rides the runtime build include and lands beside them.
The relative import depths resolve identically from `src` and from the mirror.
