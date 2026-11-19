# KNOWN-SEMANTIC-DIFFERENCE — old path vs G1-FS prototype

This sibling file to `old-path.tsv` is the **reviewed record** of every semantic
difference between the legacy governed path and the prototype that the golden
corpus deliberately tolerates. It is not prose: each entry is also declared in
`../lib/semantic-differences.mjs`, **printed by `run-prototype.mjs` on every run**
(`SEMANTIC-DIFF …` lines) and **asserted by `../lane-suite.test.mjs`**. A
difference that the harness cannot print is not recorded here.

Field meanings: `class` = the semantic surface; `cause` = the concrete mechanism
(a `file:line` when it is an upstream assumption); `reason` = why the prototype
does not paper over it; `retirement-blocking` = must a future equivalence /
retirement decision treat this explicitly (i.e. it is not a formatting detail).

---

## KNOWN-SEMANTIC-DIFFERENCE 1 — the lane refusal code

```
class                 refusal-code
old path              FS_SANDBOX_DENIED
new path              FS_PERMISSION_DENIED
cause                 upstream-deref:packages/fs/tool-fs/src/sandbox.ts:139-143
reason                not-a-patch
retirement-blocking   YES
```

rc.5 `tool-fs` assumes an `FsError` with code `FS_SANDBOX_DENIED` can only come
from an `fs-sandbox` backend that resolved a sandbox policy, and dereferences
`policy.mode` when it sees one:

```ts
// packages/fs/tool-fs/src/sandbox.ts (rc.5, 9c2670d3)
mapError(error, policy) {
  if (!(error instanceof FsError) || error.code !== 'FS_SANDBOX_DENIED') return error
  const mode = (policy as SandboxExecutionPolicy).mode   // <- policy is undefined here
  return new FsError(`${sandboxDenialMarker(mode)}\n…`, 'FS_SANDBOX_DENIED', { cause: error })
}
```

Measured on the prototype: a lane-only provider that raises `FS_SANDBOX_DENIED`
turns the `write` tool into `Cannot read properties of undefined (reading
'mode')` — the refusal becomes a crash, which is worse than a refusal. The
prototype therefore raises `FS_PERMISSION_DENIED` and the corpus's class mapping
(`lane-deny`) stays green.

**Honest note on the `old` column.** On the *measured* legacy route-C path the
refusal is **prose**, not `FS_SANDBOX_DENIED`:

```
authored locator '<abs path>' is outside every allow subtree of the lane
```

`FS_SANDBOX_DENIED` is the *host code* the next-path provider would have used if
the upstream assumption allowed it — i.e. it is the code the two paths would
share if the upstream sharp edge did not exist. Both facts are recorded: the
class line prints `old=FS_SANDBOX_DENIED`, and entry 2 records the
prose-vs-typed difference that the golden file actually measured.

**Retirement consequence.** A future "same behaviour, swap the path" decision
must either (a) adopt the fs-sandbox protocol (declare `sandboxMode`, mount
`sandbox-policy`, let the host map the denial into its `[sandbox: …]` marker), or
(b) keep a non-sandbox code and accept that model-facing refusal text differs.
It is not a decision that can be made by remembering a memo.

---

## KNOWN-SEMANTIC-DIFFERENCE 2 — how a refusal is observed

```
class                 refusal-observation
old path              prose
new path              typed-FsError-code
cause                 host-generation
reason                the corpus compares refusal classes, not spellings
retirement-blocking   YES
```

The legacy governed path refuses with human messages:

| request | legacy message |
|---|---|
| out-of-lane path | `authored locator '…' is outside every allow subtree of the lane` |
| write an unread file | `cannot modify "…": file has not been read — read the file, then retry` |
| edit a file changed since read | `cannot edit "…": file changed since it was read — re-read the file, then retry` |

The next host answers with typed `FsError` codes (`FS_PERMISSION_DENIED`,
`FS_NOT_OBSERVED`, …). The corpus maps both onto one closed class vocabulary
(`lane-deny`, `write-requires-read`, `stale-version`, `other`); the typed codes
are recorded verbatim in every row's `codes` cell but are **not** a pass
condition.

**Retirement consequence.** An equivalence oracle that compares codes directly
would go red on this difference for reasons that are not behaviour changes. The
class vocabulary is the contract; a retirement decision that wants code-level
equality must first make the old path emit codes.

---

## Not a semantic difference (checked, deliberately not listed)

* **Effects** — existence, bytes, sha256, mode are compared exactly and agree on
  all 10 vectors (created files are `0o600` on both paths; existing modes are
  preserved).
* **Lane model** — both paths refuse the same five out-of-lane shapes; only the
  reason's *spelling* differs (entry 2).
* **Observation contract** — the write-before-read and stale-edit refusals occur
  at the same point on both paths (before any bytes are written).
