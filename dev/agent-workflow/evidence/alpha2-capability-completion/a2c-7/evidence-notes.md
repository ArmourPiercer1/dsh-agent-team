# A2C-7 — evidence notes (subtree PermissionResource)

Companion to `seam-recon.md` (upstream seam table) and `red-run.log` (RED
captures). Test pointers below are into
`packages/runtime/test/a2c7-subtree-matcher.test.ts` (1769 lines, 31 tests,
module-level async driver + pure-sync `it` assertions, shim-compatible:
`toBe`/`toEqual` only, no `toContain`/`toBeUndefined`).

## 1. Failure-lane matrix (plan §9.8, P1-3 lane asymmetry)

For each undeterminable-containment cause, the lane behavior is pinned:

| cause | deny lane (STATIC rule) | allow lane | ask lane |
|---|---|---|---|
| root path not canonicalizable (seam rejects / malformed result) | **FAIL CLOSED → deny** before A3, frozen P1-3 reason, stage `deny-canonicalization-failure`, `paths` + additive `causes` | non-match (no grant) → priority/default | non-match → priority/default; ask lane NEVER reported (no `deny-canonicalization-failure` observation) |
| root canonicalizable but containment UNDETERMINABLE (no opaque handle on either side — pre-A2C-7 seam shape) | **FAIL CLOSED → deny** (the rule cannot be dropped), `causes[].cause = 'containment-undeterminable'` | non-match → priority/default | non-match → priority/default; never reported |
| containment seam ABSENT (`containsTargets` not wired — pre-A2C-7 installer) | **FAIL CLOSED → deny** (same as undeterminable) | non-match → priority/default | non-match → priority/default; never reported |
| containment seam FAULTS (throws on the contains call) | **FAIL CLOSED → deny** (`causes[].cause = 'containment-undeterminable'`) | non-match (no escalation, no grant minted) | non-match → priority/default; never reported |

Test pointers:

- deny × unresolvable → `A2C-7 G15 … unresolvable root` flow
  `FLOWS.g15DenyUnresolvable` (default `deny`), reason fragment
  `a static deny rule could not be canonicalized (src)`, observe row
  `paths === ['src']` + `causes[0] = { path: 'src', kind: 'subtree', cause:
  'root-not-canonicalizable' }`.
- deny × undeterminable (no handle) → `FLOWS.g15DenyUndeterminable` (the
  `noHandles` fake: `resolveTarget` returns only `{key, display}` — the
  pre-A2C-7 seam shape), `causes[0].cause === 'containment-undeterminable'`.
- deny × seam fault → `FLOWS.g15DenyContainsFault` (the `containsThrow`
  fake), same undeterminable cause.
- allow × unresolvable → `FLOWS.g15AllowUnresolvableDefaultAsk` (default
  `ask` → the ask flow RAISES a control request — proving the failed allow
  rule minted NO grant) and `FLOWS.g15AllowUnresolvableDefaultDeny`
  (default `deny` → deny).
- ask × unresolvable → `FLOWS.g15AskUnresolvable` (default `deny` → deny;
  the ask-lane failure is NOT reported — zero
  `deny-canonicalization-failure` observations).
- allow × seam fault → `FLOWS.g15AllowContainsFault` (non-match, no
  escalation).

Documented residual (also in the adapter doc): the ask-lane
non-match-on-failure means a failed ask rule can fall through to a matching
allow rule — the SAME frozen behavior as an exact ask-rule failure (P1-3
option A); the ask lane is still never reported as a deny failure.

## 2. Prefix-trap negative-fixture record (plan §9.4)

The ONLY place a string-authority appears in the suite is the explicitly
labeled NEGATIVE fixture `startsWithAuthority(rootKey, operationKey)`
(`operationKey.startsWith(rootKey)`) — used exactly twice:

- R2 ("the negative fixture is a STRING authority — the module never
  calls it"): asserts the fake's real `containsTargets` (segment-wise
  `relative()` semantics) DIFFERS from `startsWithAuthority` for the
  sibling-prefix pair (`src` vs `src2/…`) — i.e. the fixture exists to prove
  the trap, and the module is never wired to it.
- G5 real backend: `cases.prefixTrap = { backendVerdict, stringAuthorityVerdict }`
  records the DIVERGENCE on the pinned `LocalFileSystem`: real
  `contains(root('src'), op('src2/f.txt')) === false` while
  `startsWithAuthority` would say `true`. The pinned backend's
  `relative()` + `startsWith('..')`/`isAbsolute` check (fs-local
  L125-131) handles the trap natively; the module code contains no
  `startsWith` (verified by grep — see the A3-purity + module grep in
  `report.md`).

G5 test flow: `FLOWS2(REAL).g5TrapDefault` — a DENY rule rooted at `src`
does NOT deny `src2/f.txt` (the default `deny` does, with the DEFAULT
provenance reason), while `FLOWS2(REAL).g5ChildDenied` — the true child
`src/a.txt` IS denied by the RULE (rule provenance, zero request rows).

## 3. Symlink/junction retarget — fresh-decision proof (H4, plan §9.5)

Real backend (`LocalFileSystem`, temp dir, real `fs.resolve()` minting both
handles, real `contains()`):

- G9 alias identity: `alias` is a real `symlink(dirA)`.
  `FLOWS2(REAL).g9ViaTargetPath` (op via `dirA/f.txt`) and
  `FLOWS2(REAL).g9ViaAliasPath` (op via `alias/f.txt`) BOTH match the
  subtree rule `alias` (and vice-versa) — one canonical identity, both
  spellings resolve to the same target identity through the SAME live
  provider.
- G10 retarget (the H4 core): T0 —
  `FLOWS2(REAL).g10T0TargetMatches`: rule `subtree alias`, op `dirA/f.txt`
  → allow. Then the topology mutates ON THE LIVE PROVIDER:
  `rmSync(alias); symlinkSync(dirB, alias, 'dir')`. T1 —
  `FLOWS2(REAL).g10T1OldTargetNoMatch`: the SAME op `dirA/f.txt` on the
  NEXT decision → NON-MATCH (old target now outside the retargeted
  subtree; the decision followed dirB, never a stale snapshot).
  `FLOWS2(REAL).g10T1NewTargetMatches`: op `dirB/f.txt` → allow.
  There is no install-time freeze and no cache: the per-decision
  `targetHandles` map is created in `enforce` and dropped at decision end;
  every decision re-resolves the rule root through the live seam.
- G16 (fake backend, cold-resume variant): `FLOWS.g16T0ViaTarget` (allow),
  alias retargeted to a different segment tree,
  `FLOWS.g16StaleTargetNoMatch` (deny/default),
  `FLOWS.g16NewTargetMatches` (allow) — the same fresh-decision property
  without an fs dependency.
- G1 real root-itself: `FLOWS2(REAL).g1RealRootItself` — a subtree rule
  rooted at the FILE `root-file.txt` matches an op on that same file:
  real `contains(self) === true` (recorded in `cases.rootItself.containsSelf`).

Windows delta (recorded deviation, see report.md): on Linux the retarget is
a symlink `unlink` + `symlink`; on Windows the equivalent is a junction
repoint. The pinned backend's `resolve()`/`contains()` own the platform
semantics; the module never branches on platform.

## 4. Real pinned-backend test pointers (plan §9.9 mandate)

`A2C-7 REAL — the pinned upstream LocalFileSystem (real fs.resolve() + real
contains())` section: the prebuilt
`tests/deepseek-harness-test-use/packages/fs/fs-local/lib/index.js` (upstream
pristine @ a66e470204) is imported by absolute URL with the minimal ctx
double (`{ reflect: { provide() {} } }`) — the same recipe as the pre-existing
`packages/runtime/test/a2-canonical-operation-realfs.mjs` (A2C-1), extended
here with the `contains()` seam. One real `LocalFileSystem` instance on one
temp dir; every op and rule target in the section is minted by REAL
`fs.resolve()`; every containment verdict is a REAL `contains()` call. The
section degrades to `{ available: false, reason }` (never a crash) when the
prebuilt lib is absent, and the first `it` of the section pins
`REAL.available === true` so a silent skip is impossible on this host.
The fake backend is used ONLY where a fault is injected (G15 fault lanes,
G16 topology, R2 negative fixture) — never as the containment authority.

## 5. Windows-casing deviation record (plan §9.4, G8)

`FLOWS2(REAL).g8CaseVariantNoMatch`: rule `subtree src`, op `SRC/a.txt`
(casing variant) → NON-MATCH on the Linux host. The pinned local backend is
case-sensitive: `src/a.txt` and `SRC/a.txt` are DIFFERENT canonical
identities, so real `contains(root, op) === false`. On a case-INSENSITIVE
NTFS volume the same spelling WOULD resolve to the same identity and match.
This is the recorded backend-semantic delta: case semantics belong to the
backend's `contains()` (the sole authority); the module never case-folds
(any consumer-side folding would be exactly the string-authority class of
bug plan §9.4 forbids). No module code change across platforms.

## 6. Backward-compatibility evidence (no regression)

- `PathTargetResolver` gains an OPTIONAL `handle?` field;
  `InstallParameterPermissionListenerParams` gains an OPTIONAL
  `containsTargets?`. All pre-A2C-7 installers (a5a, h4, a2c1, a2c2, a2c4,
  a2c5, a2, a3 suites) inject `{key, display}`-only resolvers and NO
  `containsTargets` — all pass unchanged (186/186 in the focused battery).
- The frozen P1-3 deny reason text and the
  `deny-canonicalization-failure` stage are byte-identical (h4 L671 / a5a
  L1403 `.includes` pins pass); the observe row only GAINS the additive
  `causes` field.
- The A1 schema: `exact`/`any` behavior byte-identical (G14
  `exactUnchanged`/`anyUnchanged`/`anyExtraField`; the A2C-1 shell message
  texts are byte-identical — G14 asserts the verbatim fragments
  `does not accept an 'exact' resource in any lane` and `grants no positive
  whole-tool permission for bash`); the unknown-kind fixture renamed
  subtree→glob keeps the "glob is not A1" test meaningful.
- A2 canonicalizer untouched: `resolveResource` destructures only
  `{key, display}` — the additive `handle` is transparent (verified in
  seam-recon.md).
