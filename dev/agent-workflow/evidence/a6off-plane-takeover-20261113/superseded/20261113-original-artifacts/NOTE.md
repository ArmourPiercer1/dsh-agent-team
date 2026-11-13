# Superseded — the artifacts committed by PR #745

**Dated: 2026-11-13** (session calendar; the evidence lineage date). **Retained,
not deleted.** These files are the artifacts committed by PR #745
(`0d31f9121`); they are **not** current evidence and must not be cited.

An independent C2-B adjudicator re-measured the *claims* with the frozen kit
and found them true, but refused the *artifacts* because they were not what the
instrument in the tree emits. The specific defects:

1. `composition-a6-on/a1-composition.json` and
   `composition-a6-off/a1-composition.json` carried
   `blueprint: {sha256: null, text: ""}` — a schema the frozen
   `a1-bash-governance.mjs` no longer emits (it emits
   `blueprint: {rawSha256, normalizedSha256, text}`). The README therefore
   cited `blueprint.normalizedSha256 = 8478f088…`, which was absent from those
   files.
2. `composition-a6-{on,off}/a1-composition.patch.yml` exist here but the frozen
   kit never writes a `.patch.yml`; those files came from an uncommitted
   instrument revision, so they are phantom artifacts.
3. The committed ledgers carry `reviewAuthority: "leader"` on **6** requests
   and **no `reviewAuthority` field** on the other **5** (the second,
   `team-tool-execute` leg of each allow pair). The README claimed "every
   request's `reviewAuthority` is `leader`", which its own ledgers contradict.
   All 11 *decisions* are nonetheless made by the Leader
   (`decider.role = "leader"`), which is the fact the claim was reaching for.

The current evidence was re-run from the tree with the frozen kit (fresh
`DSH_HOME` per run, sanctioned ports, pinned host `0.2.0-rc.2 @ 639ed01539`)
and lives one directory up; see the parent `README.md` for the current run
dirs and the exact command sequence.
