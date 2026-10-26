# Golden corpus face history (v1 → v2 → v3), 2026-10-26

**Outcome first: the shipped corpus (v3) carries the ORIGINAL v1 face and the
ORIGINAL digest `0dabc187cae53bc0b22e7573b4c442f5dcdeb2f2f2f98aef79bfbd9a653e3de8`
(409 vectors, threw=97, clean=312, 414299 canonical bytes), re-recorded
byte-identically on master and on the moved lane.**

**v1 (original recording).** parse pinned via a static import of the a5p5
lane's `src/args.ts` from `packages/runtime/test/u6-pr5-search-golden-vectors.test.ts`.
Substance RIGHT (the a5p5 lane builds the placed rows — that grammar is what
the model meets), form WRONG (the text audit `a5p5-dormant-audit` flags any
outside-lane reference to the lane).

**v2 (the false fix — superseded, retained in git history of this branch).**
To silence the audit the import was switched to the npm package
`@deepseek-ai/dsh-tool-fs-search`. That face is the MECHANICS face the
backends import for argv/walk plumbing — NOT the model-facing grammar. The
live C2 run u6arca6 proved the difference on the real host: the placed rows
answered `a5p5-refused kind=refused-schema code=missing-field
$.output_mode` — `output_mode` is required by the ROW grammar
(`packages/tools/a5p5-tools/src/register.ts` PARAM_SCHEMA), which the package
face does not share. v2 (digest `b3aca96b…`) pinned the wrong contract and is
DISCLOSED as an interim misstep, not hidden.

**v3 (shipped).** The golden test now rides the audit's TEST_ONLY edge:
exactly one pinned dynamic import of the a5p5 BARREL
(`const { parseGrepArgs, parseGlobArgs } = await import('../../tools/a5p5-tools/src/index.js')`),
path- and form-pinned inside `a5p5-dormant-audit`'s
`TEST_ONLY_EDGE_EXCEPTIONS` (same shape as the existing A5-M1 edge; its
pinning leg holds it exactly as narrow). Both v3 recordings reproduce v1's
digest EXACTLY, master and family byte-identical — the move remains
byte-for-byte proven at the face the product actually serves.

Files: `golden-vectors-master.json` / `golden-vectors-family.json` (v3),
`digest-master.txt` / `digest-family.txt` (v3), `face-master.scratch.mts.txt`
/ `face-family.scratch.mts.txt` (v3 faces), recorder scratch source retained
as `golden-recorder.scratch.test.ts.txt`.
