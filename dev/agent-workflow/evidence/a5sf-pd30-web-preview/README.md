# PD-30 — the governed web face on the SHIPPED assembly (Preview closing round)

**Verdict (one line): the shipped opt-in preset now constructs the governed Member
with no driver rewrite, and on that assembly allow (1 connection / 1 allow fact /
body byte-for-byte) and deny (0 connections / 1 deny fact) both hold, `web_search`
has a real backend and issues a real request, and SSRF / malformed input / missing
provider are refused before any transport entry — while `web_search`'s DEFAULT
install (no key, no endpoint) is a typed `WEB_PROVIDER_UNAVAILABLE`, not a search.**

Second, and more important than any web result below: **the instrument this repo
used to produce every live web evidence row was blind.** A preset row whose
specifier cannot resolve in the *host* module graph loads as `never started` and
takes the whole governed Member down — every confined face, not just the pair — and
the PD-27 driver hid it by rewriting that row to an absolute `file:` URL. The
driver now boots the shipped bytes, links the repo's own bundle into the World's
module resolution the way a packaged install provides it, and REFUSES to run a
single arm if the preset audit reports `never started` (§0).

Everything here is DEV-LIVE (`9c730c3d7` + this branch), not candidate evidence.

---

## 0. The defect that was found, and who owned it

**Observation (sibling lane, reproduced by the owner on pristine `9c730c3d7`).**
The shipped governed preset could not construct a Member at all:

```
RemoteError: tool-web (dsh-agent-team/web-tool): never started
surfaceACount 0 — no governed Member created, 2/2 agreeing boots
```

**Localization, then the corrected reading.** Replacing the row's `name` with an
absolute `file:` URL made the same tree pass (2/2, surface 33); a *relative* path
failed like the bare name; `disabled: true` booted green with **surface 31** (the
pair silently gone). That spread proves *where* the name is resolved, not that a
packaged install is broken.

The loader resolves **every** row — profile or preset, top-level or nested inside
an `EntryGroup` — through one base: `lib/index.js` of `@deepseek-ai/cordis-plugin-loader`

```js
import(name, getOuterStack) {
  ...
  if (this.ctx.loader.internal) return await this.ctx.loader.internal.import(name, this.ctx.baseUrl, {})
  ...
}
```

`this.ctx.baseUrl` is the **composition's** base URL (the profile), and a preset's
`plugins:` list is mounted as an `EntryGroup` on that same tree — so a preset row
does **not** resolve differently from a profile row. What differs is whether the
**bundle package is installed in that base**. A production `dsh` profile installs
the bundle (that is how `dsh-agent-team/host` itself resolves); this repo's test
World builds `profiles/web/` from an empty directory, so nothing was installed and
the bare names had no graph to resolve against.

Therefore:

* **the product row is right**; the **harness** booted a tree whose bundle was
  never installed. That is the same class of defect as "the artefact was not the
  one measured" — *the assembly was not the one shipped*.
* the **absolute `file:` URL is not a product form**. It was the diagnostic that
  localised the shape and is gone from the product path.

**The fix, and it is test-only** (`tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs`):
`installGraph()` creates `profiles/web/node_modules/dsh-agent-team -> <repo root>`
(the sanctioned link-farm shape already used by `tests/mock/scripts/copy-profile.mjs`)
and then *verifies* the three subpath exports the composition names
(`./host`, `./web-tool`, `./web-transport`) resolve to real files. Zero product
bytes are rewritten: `preset-effective.json` records `"rewrites": []` and the
shipped row `{"id":"tool-web","name":"dsh-agent-team/web-tool"}`.

### The owner's ruling, and exactly where the link lives

The owner reproduced both halves on a pristine `master` worktree (`9c730c3d7`, no lane
changes): with nothing linked the shipped composition boots `surfaceACount 0` +
`never started`; after `ln -s <repo> tests/deepseek-harness-test-use/node_modules/dsh-agent-team`,
`node -e "import('dsh-agent-team/web-tool')"` **loads** and exports `isConfinedWebFace`. Ruling:
**the product row is correct, the harness is broken** — do not change the specifier (not to
`file:`, not to the host `tool-web` package, not by disabling it: the disable experiment silently
drops the pair, 31 not 33).

This lane had already reached that conclusion from the loader source, and it provisions the link
**in the World's own module graph** (`<home>/profiles/web/node_modules/dsh-agent-team`) rather
than in the shared pinned host tree. Both resolve from the same base (`ctx.baseUrl` = the
profile), and the World-local choice has one extra property the ruling asks for and gets for
free: **nothing is ever written into the pinned host tree**, so there is nothing to remove
symmetrically on teardown — the host checkout is byte-identical before and after every boot
(`host-tree-porcelain-*.txt` = `empty`, and `git status --porcelain` in
`tests/deepseek-harness-test-use` is `0` lines). The link is per-World and dies with the World's
home.

**The reusable sentence** (the reason this is written down, in the owner's wording):
a preset row's specifier must resolve in the host's module graph; a bundle-subpath name only
resolves where the bundle is installed — so a harness that never installs the bundle cannot tell
*missing module* from *dead preset*, and **a dead preset takes every confined face down with it,
not just one name**.

> A preset row's specifier must resolve in the host's module graph; a
> bundle-subpath name only resolves at the profile layer — so a row that is
> correct for a packaged install is invisible to a harness that never installed
> the package.

**The guard that was missing (now a hard precondition, before any arm):**

* `precondition.json` — the host log carries **no** `never started`, the Team
  created its Member(s), read *before the first probe*; a failure THROWS and the
  boot produces no verdict at all.
* `precondition-member.json` — the `worker` Member exists, its model-visible
  surface is non-empty (**33** names) and carries `web_fetch` + `web_search`,
  written *before any verdict is computed*.
* Negative control: `A5SF_PD30_NO_INSTALL_GRAPH=1` runs the same driver with no
  link. Measured: the Host answers on its port but the harness route never comes
  up (`p6t6 health=false`), i.e. the World cannot resolve the shipped profile rows
  at all — recorded here so the dependency is a measurement, not a claim.

---

## 1. What PD-30 added (product)

1. **A shipped transport row** `a5sf-web-transport` (`dsh-agent-team/web-transport`,
   profile layer) providing the optional service `teamA5sfWebTransport`. It loads
   the pinned host providers by name — `HttpFetchProvider`
   (`@deepseek-ai/dsh-web-fetch-http`) and `ExaSearchProvider`
   (`@deepseek-ai/dsh-web-search-exa`) — and answers
   `{ createProvider, describe }`. A search module that fails to load is a
   **reported gap** (`searchGap`), never a crash.
2. **Assembly without rewriting**: the host row reads the service **lazily**
   (`webTransport: () => ctx.get('teamA5sfWebTransport')`) and passes it into
   `createGovernedRealmProvider`, which supplies `availableFaces: {web:true}` and
   the `web` face (`provider: liveTransport.createProvider(...)`) only when a live
   transport exists. Absent service = no `web` face = the pre-PD-30 behaviour,
   per deployment.
3. **One network guard, three new typed refusals** in
   `packages/runtime/team-services/src/web.ts` +
   `TEAM_IO_DENIAL_CODES`: `WEB_DESTINATION_FORBIDDEN` (SSRF),
   `WEB_REQUEST_MALFORMED` (bad declared URL/query), `WEB_PROVIDER_UNAVAILABLE`
   (no/unusable search backend). Order is fixed: parse → destination →
   provider-availability → lane/probe. The provider is entered only after all of
   them.
4. **Model-visible typed refusals**: the face prefixes `<code>: ` onto the
   `TeamIoDenial` message (same object, same code, same fact), so the Member sees
   `WEB_DESTINATION_FORBIDDEN: …` instead of an untyped `Error: …`.
5. **The search cap** lives in the face (`capSearchSources`), mirroring
   `WebRuntime.search` — the host runner exports no helper, and without it a
   4-answer fixture reached the Member as 3 sources (measured).

## 2. The three agreeing pairs (DEV-LIVE, `--boots 2`)

`agreement-*.txt` are the raw tables; every counter below is identical in both
boots of each pair.

| arm | verdicts | fixture conns / hits | search conns | web facts | host-web calls | surface |
| --- | --- | --- | --- | --- | --- | --- |
| allow | allow PROVEN, search PROVEN, ssrf PROVEN, malformed PROVEN, regression PROVEN, closed PROVEN | **1** / `{"/known":1}` | **1** | 4 (`allow` 2, `deny` 2) | **0** | 33 |
| deny | deny PROVEN, closed PROVEN (allow/search/ssrf/malformed REFUTED) | **0** / `{}` | **0** | 1 (`deny` 1) | **0** | 33 |
| nosearch | allow PROVEN, noBackend PROVEN, closed PROVEN | 1 / `{"/known":1}` | **0** | 2 (`allow` 1, `deny` 1) | **0** | 33 |

Allow arm, from `guard-facts.json` (one fact per consultation, in call order):

```
web_fetch  web:fetch  allow  ALLOW                     http://127.0.0.1:44817/known
web_fetch  web:fetch  deny   WEB_DESTINATION_FORBIDDEN  http://169.254.169.254/latest/meta-data/
web_fetch  web:fetch  deny   WEB_REQUEST_MALFORMED      file:///etc/passwd
web_search web:search allow  ALLOW                     query:a5sf pd30 governed search
```

* allow: the Member's `web_fetch` returned the fixture body **byte-for-byte**
  (`A5SF_PD30_KNOWN_BODY_BYTES`), the local server counted exactly **one**
  connection on `/known`, and the pair stayed on the confined face.
* deny: the blueprint ceiling `memberIoCeilings.io.network.mode='deny'` refuses the
  *same* fetch with `NETWORK_UNCONFINED_REALM` **before** transport — the fixture
  counted **0** connections and the face recorded **1** deny fact.
* nosearch: with no API key the shipped row still answers `web_fetch` (1 connection)
  and `web_search` is refused `WEB_PROVIDER_UNAVAILABLE` with **1** fact and **0**
  POSTs — a typed gap, not an empty answer.

## 3. `web_search`: real backend, and its real limit

Proven end-to-end on the nosearch pair's sibling (allow arm): `ExaSearchProvider`
with `baseURL` pointed at a **local Exa-compatible endpoint** issued a real
`POST /search` (Bearer key, one request), the answer was parsed into **2** sources
(the fixture returns 4; the seam's `maxResults: 2` cap applies and
`truncated: true`), and the Member received the parsed sources.

**Classification, precisely:**

* **delivered — real backend**: when a search endpoint + key are configured (the
  shipped row reads `search.baseURL` / `search.apiKey`, defaulting to
  `https://api.exa.ai` and `A5SF_WEB_SEARCH_API_KEY | EXA_API_KEY`), `web_search`
  performs a real request and returns parsed sources. Proven with a real HTTP
  round trip and a real parse, not a recorded query.
* **default install = dispatch/governed only**: with no key the same path refuses
  `WEB_PROVIDER_UNAVAILABLE` (typed, one fact, zero POSTs). That is the honest
  Preview shape: **the seam and the backend are real; the credential is not part of
  the repo.** We do **not** claim a working public search on a default install.
* **minimal fix to close it**: put an Exa key (or another search provider's
  module) into the deployment's environment/profile — product code needs no
  change; the seam already loads the provider by name and reports the gap.

## 4. Negative paths (all typed, all before transport)

| control | target(s) | result | side effects |
| --- | --- | --- | --- |
| SSRF | `127.0.0.1`, `127.1.1.1`, `10.0.0.1`, `172.16.0.1`, `192.168.1.1`, `169.254.169.254` (+`/latest/meta-data/`), `100.64.0.1`, `0.0.0.0`, `198.18.0.1`, `224.0.0.1`, `255.255.255.255`, `[::1]`, `[fd00::1]`, `[fe80::1]`, `metadata.google.internal` | `WEB_DESTINATION_FORBIDDEN` | 0 connections, 1 deny fact each |
| exact-origin exemption | the composition-declared fixture origin only | admitted (SSRF arm's positive control) | 1 connection |
| malformed | `file:`, `gopher:`, `javascript:` schemes; empty host `http://:80/no-host`; relative `not-a-url`; over-long (>8192) URL; search with no query | `WEB_REQUEST_MALFORMED` | 0 connections, 1 deny fact each |
| missing / unusable provider | composition with no `search`; provider whose key is empty | `WEB_PROVIDER_UNAVAILABLE` | 0 provider entries, 1 deny fact |
| base-web fallback | every refusal above | inherited host `ctx.web` **never called** (`hostWebCalls = 0` in all three arms, tripwire row counting `web.fetch`/`web.search`) | — |

**How the local fixture is distinguished from a forbidden target**: the exemption
is an **exact origin** (`scheme://host:port`) match against the origins the
composition row itself declares (`testEndpoints`, from
`A5SF_WEB_TEST_ENDPOINTS` in production, concrete values in the World). It is not a
host suffix, not a port range, not a loopback wildcard — `http://127.0.0.1:44817`
is admitted only because that exact origin is declared, and the same literal on any
other port is refused. Behind the guard, the host `HttpFetchProvider`'s own
public-only resolver remains the second layer.

## 5. Mutation controls (≥2, `mutation-controls.log`)

| control | change | result |
| --- | --- | --- |
| CLEAN | none | green |
| M1 | remove the SSRF destination leg from `web.ts` | `PD30-SSRF` (and the three arms that use an SSRF refusal as their zero-entry control) RED — the forbidden target was **actually admitted** (`was ADMITTED (transport entries: 1)`) |
| M2 | make the shipped transport delegate to the inherited base `web` | only `PD30-NO-BASE-FALLBACK` RED |
| M3 | drop the search credential from the row's config | `PD30-E2E-SEARCH` RED with `WEB_PROVIDER_UNAVAILABLE` (plus the two arms that assert the backend is reported) |

## 6. Deployment difference that must NOT be read as "equivalent"

The World's install graph is a **symlink to the worktree**, not a package install:
no `npm pack`, no `node_modules` copy, no `exports` rewriting. It reproduces the
*resolution* a packaged install provides (`dsh-agent-team` reachable from the
profile base) and the driver verifies the three subpath exports resolve, but it is
not the packaged artefact. The pinned test tree cannot install this repo's package
(a `file:`/workspace install would mutate the read-only host checkout), so:

* the shipped **row bytes** are exercised unchanged (`rewrites: []`);
* the **install transport** (symlink vs package) differs and is recorded in every
  `preset-effective.json`;
* the negative control above shows what the same bytes do with **no** graph, which
  is the only claim this evidence makes about a missing install.

## 7. Regression in the same boot

One Member turn did, in order: `web_fetch` (allow) → SSRF → malformed →
`web_search` → `read` → `write` → `edit` → `grep` → `glob` → `present` → `skill`
→ `workflow` (typed unknown) → `run_code` (typed unknown) → `bash`. All fourteen
settled; the IO tools produced facts (`read` 2, `write` 1, `edit` 1, `grep` 1,
`glob` 1, `present` 2, `bash` 2 — spawn + spawn:write); `skill` returned the bundled
`team-leader-operations` body (it owns no IO guard, so it has no fact by design).
`workflow`/`run_code` remain closed names.

A note for anyone re-running this: **"mock quiet" is not "turn settled."** A slow
confined child issues no model request, so the driver waits for the durable session
to pair every call with a result and the Member's closing text before reading the
transcript — the first version of this driver truncated the turn at `bash`
(measured: 5 of 14 calls).

## 8. Not proven here

* The **packaged** install path (an actual `dsh` profile with the bundle installed
  from a tarball) — only the resolution shape is reproduced (§6). The row is
  unchanged, so the residual risk is the installer, not the composition.
* A **public** search provider on a default install (no credential) — §3.
* Windows/junction behaviour of the install graph (POSIX symlink only).
* Any claim about `web_fetch`'s *content* governance (size/type limits) beyond the
  pinned host provider's own.

## 9. How to reproduce

```bash
# the shipped assembly, the pair that agrees, and the two negative arms
node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --plan
node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm allow    --boots 2
node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm deny     --boots 2
node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm nosearch --boots 2
# the instrument control (must NOT reach a usable Host)
A5SF_PD30_NO_INSTALL_GRAPH=1 node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm allow --boots 1

# host-free seam + mutation controls
node --test tests/world-factory/a5sf-pd30-web-preview.test.mjs
node tests/world-factory/a5sf-pd30-mutation-controls.mjs
```

## 10. Record hygiene (read this before citing a number)

* **The three pairs were re-run on the FINAL built dist.** The first pair was booted before the
  guard's order was corrected to SHAPE → LANE → DESTINATION → AVAILABILITY (a denied lane must
  answer its own code for *any* target, which PD-18's suite pins). The re-run's counters are
  **identical** to the table in §2 — the correction changes *which typed code* a denied lane
  answers with an undeclared target, not any counter in this evidence.
* **The register row is `PD-28` on this base, not `PD-30`.** The window allocates PD-30 for this
  lane (two sibling lanes hold PD-28/PD-29), but the register's gate-enforced contiguity
  (`PD-1…PD-n`) only admits the next free id on this tree. The row carries that note and
  renumbers at merge if the siblings land first (the PD-25-from-PD-24 precedent).
* **Five older register anchors re-resolved** (`web.ts#L676` for PD-10, `host.ts#L3246/L3255` for
  PD-11, `types.ts#L265/L286` for PD-12/PD-13, `web.ts#L183` for PD-15, `cordis.patch.yml#L339/L291`
  for PD-18/PD-22/PD-23): this lane moved code inside those same files rather than editing the
  claims. Pointer corrections only — no row's text, grade or status changed.
* The `PD18-WEB-*` and `PD27-E2E-*` arms keep their loopback fixtures by **declaring that exact
  origin** (`testEndpoints`), which is the same exemption the product uses; nothing in those
  arms was weakened — an undeclared loopback literal is still refused.
