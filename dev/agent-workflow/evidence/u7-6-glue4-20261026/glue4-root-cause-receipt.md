# U7-6 root-cause receipt — why governed search rows are refused on the live plane

All offline (zero Host boots). Faces driven are the compiled `packages/runtime/dist`
copies the live mount loads; the effect/fingerprint law is the frozen algebra.

## 1. Wire facts (run8, `../u6-pr5-20261026/c2/run8-greper-tool-transcript.txt`)

Three governed search calls, all refused at the PA edge with
`a5p5-refused kind=refused-admission code=IO_POLICY_UNSUPPORTED detail=sha256:<fp>`;
the native `grep` on the ctl lane returned the claim (PASS) in the same session.

| call (exact wire args) | wire detail (= effectFingerprint) |
| --- | --- |
| `team_grep` pattern `U6ARCA_G1_CLAIM_u5u6arca8-20261026t06-59-02z` path `<home>/workspace` | `sha256:0e370d8e024f9e6009806ec78db2b900d0519df26cc81ebbe286350c0eccc69f` |
| `team_glob` pattern `**/*.txt` path `<home>/workspace` | `sha256:174c3d74954afd2a4bc7629830c37a251df9870bf6e5e93d4267f454c9d02ebe` |
| `team_grep` pattern `U6ARCA_G4_CLAIM_…` path `/etc` | `sha256:c2cd070f03719f4dbc3aedc76d18c8aacdf0bcd588941b7dc8c123706d15b457` |

## 2. Byte-exact fingerprint attribution (offline recompute, `glue4-offline-repro.mjs` inputs)

Using the run8 realm `u6arca-realm-u5u6arca8-20261026t06-59-02z` (from the
run8 evidence.json) and the EXACT wire argument strings, the frozen
`deriveToolEffectSet` reproduces all three fingerprints **byte-for-byte**
(verified 2026-10-26; the argument strings were extracted from the transcript
with a byte-level tool — the human-eye rendering of the dash positions in the
claim/home spellings differs from the raw bytes, which is what an early
recompute attempt tripped on).

**Conclusion:** the refused calls carried exactly the derived effect sets

- grep → `list(directory@target)` + `read(<placement>@target)` + `tool-invoke(grep)`
- glob → `list(directory@target)` + `tool-invoke(glob)`

and the refusal `detail` is the fingerprint of that set. The refusal is about
the derived demand of the search rows, made at the coverage face below.

## 3. Which face refuses (leg attribution — corrects the PR5 hypothesis)

- **Live site:** `admission-kernel.ts` `admitCall` **template-default-deny coverage
  gate** (`details.refusal='template-default-deny'`, `details.effectIndex` = first
  uncovered arm) → `{kind:'denied', code:'IO_POLICY_UNSUPPORTED'}` → wire
  `kind=refused-admission code=IO_POLICY_UNSUPPORTED`. Probe R1–R4/R7 reproduce it
  for every template shape tried (empty / run8 read-any / least-privilege read-subtree):
  the FIRST uncovered arm is always the **`list`** arm.
- **NOT the assurance face:** `assurance-runtime.ts:139-142` shares the code
  `IO_POLICY_UNSUPPORTED` (which is why PR5 attributed there — the nearest named
  site + the plane header's GLUE-4 note), but it can NEVER fire on the production
  plane: the plane mounts `createProductionAdmissionAssembly` WITHOUT
  `requiredAssurance`/`assuranceProbe` (team-tool-plane.mjs:792-815), so the level
  demand is the empty default (admission-kernel.ts:1063 `?? () => ({})`) and the
  gate is vacuous — and moreover it sits INSIDE `kernel.admit`, downstream of the
  coverage gate that already refused.
- **Lane vs PA disagreement (the coherence gap):** the plane's own lane law
  (`createLaneDecide`) adjudicates the search class under file-class rules
  (fast path (b): `fileNames` ⇒ any read/read_image/write/edit rule); offline it
  ANSWERS ALLOW for grep/glob under read-any and read-subtree templates. The
  deeper PA coverage gate answers DENY for the same calls — the two faces of ONE
  policy answer the same question differently, and the deeper face always wins.

## 4. The unmet dimensions (record fields vs derived demand)

For a rule in the closed grammar to cover a derived arm, the projection
(`deriveTeamPolicyAuthority`) must be able to PROJECT that arm. It cannot, for
two structural reasons — neither is network, metadata, spawn, or assurance level:

1. **`list` (directory-listing)** — `RESOURCE_EFFECT_KINDS` gives the file-class
   rules companions `read+meta` / `write+meta` only. NO rule tool ever projects
   effect kind `list`, so the walk arm of every search call is uncoverable by any
   expressible policy ⇒ guaranteed `IO_POLICY_UNSUPPORTED` under `default: deny`.
2. **`tool-invoke(grep|glob)`** — the rule grammar's tool enum
   (`PERMISSION_TOOL_NAMES` = read/read_image/write/edit/lsp/bash/pwsh, closed,
   PR5 law L2 forbids growing it) cannot NAME the search classes, so the invoke
   arm's matcher `<realm>|tool:grep|tool:glob` is unprojectable too.

The rows themselves are honest: the anchored-rg/glob backends DO enumerate
directories and read contents (inside the governed root), and the call IS a
search-class invocation. The demand derivation is right about reality and wrong
about the grammar — the effect face the plane header names as the GLUE-4
follow-up. Why read/bash work: their arms (`tool-invoke(read|bash)`,
`read`, `meta`) are all projectable.

## 5. The /etc leg shape

Today the `/etc` grep is refused at the SAME coverage gate (`list(/etc)` etc.
uncovered) — an ADMISSION refusal, which the post-run8 judge explicitly rejects
(`admissionRefused`). The anchored law the leg claims to see is
`resolveAnchored` → `target-outside-governed-root` (fs-mechanics.mjs:152), which
runs in the backend AFTER admission. For the row's own containment law to ever
answer an outside-root target, the derived demand of an ANCHORED row must be
claimed on its governed walk surface (the managed root), not on the raw target
the row's law refuses to touch — see the PR body for the fix law.
