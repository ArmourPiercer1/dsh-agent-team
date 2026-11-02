# `tests/kits/a5sf-golden` — schema and comparator contract

R5 / BL-13 (Alpha.5 Sandbox-First). This kit converts **retired** Alpha.5
tool-family golden output vectors into a **regression comparison corpus** for the
new Provider / Service / OS-runner lanes.

> **It is not acceptance evidence.** The old vectors were recorded under the old
> execution architecture (family bodies + `canonicalizeOperation` projections).
> Reclamation registry rule (class C): *historical green ≠ new acceptance*. A
> converted vector may only pin what the new lane must **not silently change**;
> a `MATCH` never advances a Gate or a matrix row.

## Files

| File | Role |
|---|---|
| `vectors.json` | the converted corpus (10 effect claims) |
| `compare.mjs` | pure comparator + CLI (`MATCH` / `DIVERGED(reason)` / `NOT_APPLICABLE(basis)`) |
| `observations.mjs` | new-lane side: calls the shipping P1 path algebra to make an observation |
| `compare.test.mjs` | host-free `node:test` suite (RED/GREEN logs in `dev/agent-workflow/evidence/a5sf-r5/`) |

## Corpus schema (`a5sf-golden-corpus/1`)

Top level:

```json
{
  "schema": "a5sf-golden-corpus/1",
  "task": "BL-13 (R5) — conversion of retired Alpha.5 tool-family golden vectors",
  "note": "regression comparison input only",
  "generatedAt": "YYYY-MM-DD",
  "vectorCount": 10,
  "dispositionCounts": { "REPLAY_AS_REGRESSION": 4, "RETIRE_AS_OLD_SEMANTICS": 4, "UNUSABLE": 2 },
  "vectors": []
}
```

Each vector:

| field | required | meaning |
|---|---|---|
| `id` | always | stable kebab-case id |
| `disposition` | always | `REPLAY_AS_REGRESSION` \| `RETIRE_AS_OLD_SEMANTICS` \| `UNUSABLE` |
| `regressionOnly` | always, **must be `true`** | the comparator refuses any fixture without it |
| `source.path` / `source.line` | always | the tracked old vector or assertion (`file:line`); the test asserts the file is readable in the checkout |
| `source.vectorIndex` / `recordedVectorCount` / `recordedDigest` | optional | traceability into the recorded corpus |
| `effectClaim` | always | **what the old vector asserted**, in the old vocabulary |
| `derivation` | REPLAY only | how the old observation was converted into a new-lane effect claim (never a copied fingerprint) |
| `oldSemantics` | RETIRE/UNUSABLE only | which invariant changed / why there is no equivalent |
| `newLane.owner` / `entry` / `module` | always | `member-io-policy` \| `team-services` \| `sandbox-provider-os-runner`, the function, and its module |
| `input` | REPLAY only | the parsed input the old vector fed (e.g. locator, lane) |
| `compare.kind` | REPLAY only | `equal` \| `subset` \| `lane-decision` \| `argv` |
| `compare.expected` | REPLAY only | the expected new-lane observation |

### Observation shapes

| `compare.kind` | expected | observation |
|---|---|---|
| `equal` | any JSON value | deep-equal JSON value |
| `subset` | object | object; every expected key must be present and deep-equal (extra keys allowed) |
| `lane-decision` | `"allow"` \| `"ask"` \| `"deny"` | one of those strings from `member-io-policy#matchLocator` |
| `argv` | `string[]` | `string[]` as handed to the OS runner |

## Comparator contract

```js
compareObservation(vector, observation)
// → { status: 'MATCH' | 'DIVERGED' | 'NOT_APPLICABLE',
//     comparison: 'regression comparison',
//     disclaimer: 'regression comparison only — a MATCH is not acceptance evidence',
//     reason?, disposition?, basis? }
```

Laws, all pinned by `compare.test.mjs`:

1. **Validation first.** A fixture without `regressionOnly: true` throws
   `FIXTURE_NOT_REGRESSION_ONLY`. A fixture carrying an uppercase
   acceptance-shaped token (`PASS`, `GO`, `ACCEPTED`, `ACCEPTANCE`, `APPROVED`,
   `LIVE-CONFIRMED`) anywhere in a key or string throws
   `FIXTURE_ACCEPTANCE_TOKEN`. Corpus-level token scan throws
   `CORPUS_ACCEPTANCE_TOKEN`.
2. **Disposition wins over observation.** For `RETIRE_AS_OLD_SEMANTICS` and
   `UNUSABLE`, `compareObservation` returns `NOT_APPLICABLE` **before it looks
   at the observation**. Even a byte-identical observation cannot yield `MATCH`.
   `describeResult` renders `NOT_APPLICABLE(old-semantics)` /
   `NOT_APPLICABLE(no-equivalent)` and carries `oldSemantics` as `reason`.
3. **Closed vocabulary.** `RESULT` has exactly three members, none of which is a
   verdict. The module never returns an acceptance token; the token list above
   is a *refusal* list only.
4. **Divergence names the field.** `DIVERGED` always carries a `reason` naming
   the first differing path (`observation.segments[0]: expected … observed …`,
   `argv[3]: …`, `<locator>: expected lane decision 'deny', observed 'allow'`).

### CLI

```bash
node tests/kits/a5sf-golden/compare.mjs \
  --vector read-path-unicode-nfc-locator \
  --observation '{"absolute":false,"segments":["café.txt"]}'
# MATCH   (exit 0)
# DIVERGED(...) (exit 1)
# NOT_APPLICABLE(old-semantics|no-equivalent) (exit 0)
# REFUSED(<code>) (exit 2)
```

## Why only 10 vectors out of 5,041 recorded ones

The old evidence dirs hold four recorded corpora (`2893` read, `299` shell,
`409` search, `1440` mutation = **5,041** vectors). Those digests still run in
`packages/runtime/test/u6-*` / `u7-9a-*` inside the legacy world and keep
pinning old canonicalization there. BL-13 deliberately converts a **small,
explainable sample** into new-lane effect claims instead of importing 5,041
old fingerprints the new lanes do not compute. See
`dev/agent-workflow/evidence/a5sf-r5/VECTOR-INVENTORY.md` for the full
inventory, the disposition of each corpus, and the effects that have **no old
vector at all**.
