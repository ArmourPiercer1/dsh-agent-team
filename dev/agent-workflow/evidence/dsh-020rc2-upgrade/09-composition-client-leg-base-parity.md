# The composition-smoke client leg fails at the exact base too — and the cause is upstream packaging, not this upgrade

Question for this round: is the red `pnpm smoke:composition` client leg ours, or pre-existing?
Method: run the same script in the exact-base control worktree
(`.worktrees/base-6b2f401b-control`, plugin `6b2f401b`, own host tree at `46a7f68b09`
= 0.1.7-rc.1, `dist` already built) and here; then read the published package
metadata and sweep the import graph. No host process, no network, nothing weakened.

## Result

| leg | exact base (`6b2f401b` + 0.1.7-rc.1) | this head (rc2 migration) |
| --- | --- | --- |
| host plugin (`packages/runtime`) | **FAIL** — `apply subscribed to listeners before failing: agent/created, agent/disposed, internal/get` | **PASS** — `apply fails loud on degenerate context (ready code=TEAM_PLUGIN_CONFIG_INVALID)` |
| client plugin (`packages/client`) | **FAIL** — `Cannot find package 'clsx' imported from …/@deepseek-ai+dsh-client-ui-primitives@0.1.7-rc.1…/lib/index.js` | **FAIL** — identical message against `@deepseek-ai+dsh-client-ui-primitives@0.2.0-rc.2` |

The client leg is therefore **pre-existing at the base with the same signature**, and it
is not host-generation dependent: the two generations differ only in the version string
inside the same error.

*The host-leg difference is observed, not attributed.* This run cannot separate "our
migration commits changed the activation order" from "the 0.2 host behaves differently",
because both variables moved between the two trees. Attributing it needs one variable at
a time (current plugin source against the 0.1.7 host tree, or base plugin source against
rc2), which is a separate measurement.

## Root cause of the client leg: the published UI primitives import packages they do not declare

`@deepseek-ai/dsh-client-ui-primitives` is a dependency of the built client entry, and its
published `lib/index.js` begins:

```js
import clsx from "clsx"
```

But the package ships **no runtime dependencies**. Measured in both trees:

| | published `dependencies` | published `peerDependencies` |
| --- | --- | --- |
| `dsh-client-ui-primitives@0.2.0-rc.2` (our install) | `{}` | `@deepseek-ai/cordis ~4.0.4` |
| `dsh-client-ui-primitives@0.1.7-rc.1` (base install) | `None` | (same) |

In the pinned source tree the same package declares `clsx ^2.0.0` — under
**`devDependencies`** (`packages/client/ui-primitives/package.json`), together with `react`,
`react-dom`, `anser`, `katex`, `shiki`, `@shikijs/langs`, `diff`, `micromark-*`,
`mdast-*`, `simple-icons`. Inside the upstream monorepo those resolve, because the
workspace installs devDependencies (the pristine test-use tree does have `clsx`; our
install does not — `clsx@` count 0 in our `.pnpm`). A downstream consumer gets an
artifact whose imports cannot be satisfied.

The gap is not one package. Sweeping every bare specifier the published `lib/index.js`
imports and resolving it from this install: **28 specifiers, 7 resolve, 21 missing** —

```
@shikijs/langs/json, @shikijs/langs/shellscript, @shikijs/langs/typescript, anser, clsx,
katex, katex/dist/katex.min.css, mdast-util-from-markdown, mdast-util-gfm, mdast-util-math,
micromark-core-commonmark, micromark-extension-gfm, micromark-extension-math,
micromark-factory-space, micromark-util-character, micromark-util-classify-character,
micromark-util-sanitize-uri, micromark-util-symbol, shiki/core, shiki/engine/javascript,
simple-icons
```

So "add clsx" would only promote the next failure.

## Why this stays red here, and what would actually close it

Every plugin-side route is one this repository forbids or refuses:

- patching or vendoring the host package (`CORE PATCH BUDGET = 0`, no `pnpm patch`, no
  modified upstream copies);
- adding those 21 UI/markdown/highlighting packages to the plugin manifest — that would
  mask an upstream metadata bug and pull a UI dependency set into a plugin that does not
  own it;
- making the smoke stub the client import or drop the client target — that changes what the
  test proves (it exists to verify the **built production entries** load and fail loudly),
  and silencing a criterion to obtain green is out of bounds.

What would close it honestly: the host publishing the runtime dependencies of
`dsh-client-ui-primitives` (or shipping a client-UI artifact whose externals are declared),
after which this script passes unchanged.

Scope note: `smoke:composition` is a package script, not a CI step (`grep` over
`.github/workflows/*.yml` finds no reference), and `verify-zero-core.mjs` does not invoke
it despite the header's "fixture basis" wording. This is also not a new complaint:
`docs/repairs/team-projection-recovery-20260927.md:181` already recorded both legs failing
as "base-existing" — what this round adds is the identified cause and the proof that the
base fails the client leg identically.

Status: **open, classified as an upstream packaging defect at both pinned host versions.**
Not counted as our debt, not skipped, not weakened.
