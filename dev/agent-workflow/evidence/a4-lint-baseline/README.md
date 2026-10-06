# Alpha.4 lint baseline

**Baseline commit: `11e1609c`** · identities: **162** = **130 errors** + **32 warnings**
File: [`lint-identities-11e1609c.txt`](lint-identities-11e1609c.txt) · sha256 `da48f12ff413ca7d6e365a53…`

One identity per line, formatted `<severity> <ruleId> <repo-relative-path>`, sorted. **Line and column numbers are deliberately excluded**: they move on every edit, and a baseline that changes when unrelated code shifts cannot answer the only question the gate asks — *did this PR introduce a diagnostic identity that was not there before?*

## Why a baseline exists at all

`pnpm lint` is **red at master and is expected to stay red until PR7**. 130 errors is not an accident of this round; the top rules are:

| rule | count |
| --- | --- |
| `@typescript-eslint/no-unused-vars` | 74 |
| `@typescript-eslint/no-explicit-any` | 40 |
| `(parse-fatal)` | 32 |
| `prefer-const` | 9 |
| `no-undef` | 4 |

Distribution is concentrated in test code (`packages/runtime/test` accounts for 44 of the flagged files), which is why this phase's rule is **"no new diagnostic identities relative to the recorded baseline"** rather than "lint clean": requiring a clean lint would mean a drive-by cleanup across 44 test files inside a governance PR, which is exactly how a permission change acquires an unreviewed diff. The cleanup is PR7's inventory, not a per-PR side quest.

## Regenerate

```bash
export CI=true XDG_CACHE_HOME=… XDG_DATA_HOME=… XDG_CONFIG_HOME=…   # see docs/TEST_METHODS.md
npx eslint . --format json > /tmp/lint.json
node -e '
const r=require("/tmp/lint.json");const ids=[];
for(const f of r){const p=f.filePath.replace(process.cwd()+"/","");
 for(const m of f.messages) ids.push((m.severity===2?"error":"warning")+" "+(m.ruleId||"(parse-fatal)")+" "+p);}
ids.sort();require("fs").writeFileSync(process.argv[1],ids.join("\n")+"\n");' <output-file>
```

## Compare

```bash
diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-11e1609c.txt <( regenerated file )
```

**Closure criterion: no line present on the right that is absent on the left.** Lines disappearing is good and may be noted. The count (`162`) is a convenience, never the criterion — `scripts/fail-set.mjs` applies the same identity-diff discipline to test failures, and a count-based check is what X10 just showed goes stale.

## Known gap, stated rather than papered over

`scripts/fail-set.mjs` has **no lint mode** (measured: zero matches for `lint` in the script). Test identities get a real capture/diff tool; lint identities get this file plus a `diff`. That is acceptable for Alpha.4 and is listed for PR7, which owns the cleanup that should reduce these numbers rather than compare them.

## What this round fixed to make the gate runnable at all

`pnpm lint` was **non-deterministically crashing** before this baseline could be taken. ESLint 9 does not read `.gitignore`, and 13 scratch directories live inside this repo root (`.pnpm-store`, `.pnpm-store-testuse`, `.tmp-pnpm-store`, `.tmp-npm-cache`, `.tmp-xdg`, evidence backups, `.agents`, `.dsh-vision-toolkit`). `.pnpm-store/v11/tmp/_tmp_*` files are deleted between the directory scan and the read, so `eslint .` died with `ENOENT` (exit 2) instead of reporting — measured, and intermittent: a repeat run completed. `eslint.config.mjs` now ignores `.tmp-*/**` (a pattern, so a *new* scratch directory cannot re-break the gate) plus the four named paths.

Verified that this changes **no product diagnostics**: before/after on the same tree produced an **identical 162-identity set** (`diff` of the file lists empty). The scratch tree holds no product code; the change only stops lint from wandering into it.
