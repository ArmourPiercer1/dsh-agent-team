# WEB retirement unit — member coverage (UTE-3 stage B1, old path)

The Web family is ONE retirement unit of two model-visible members
(`web_fetch`, `web_search`), derived from
`dev/agent-workflow/ledgers/arc-a-family-census.json` (`dsh.web-family`,
`nativeNames: ["web_fetch", "web_search"]` — the only census family whose names
carry no `(bound-definition) ` prefix). This file maps each member to the
baseline vectors that exercise it and to its own negative control, so the
coverage claim can be checked without reading the corpus source.

Machine gate: `node scripts/ute-retirement-gate.mjs --all` parses the `id` and
`entry` columns of [`old-path.tsv`](./old-path.tsv) and greps the committed
control transcript for `NC-MEMBER <member>`. The unit is DERIVED from the
census, so this table cannot shrink it.

Both members are reachable on the product route-C composition, so **every**
vector here is old-path evidence on the shipped composition — no member needs a
disclosed substitute composition.

## Members

| member (`entry`) | baseline vectors (`old-path.tsv`) | negative control (committed transcript) |
|---|---|---|
| `web_fetch` | `WB-F1-inline-text`, `WB-F2-inline-html`, `WB-F3-redirect-chain`, `WB-F4-redirect-cap`, `WB-F5-status-404`, `WB-F6-content-type-refused`, `WB-F7-body-byte-cap`, `WB-F8-body-char-cap`, `WB-F9-timeout`, `WB-F10-abort-before-dispatch`, `WB-F11-destination-forbidden`, `WB-F12-url-malformed` | `NC-MEMBER web_fetch` — widen ONLY the DECLARED destination set around `WB-F11` (`extraTestEndpoints: http://localhost:3182`); the same call is then admitted, reaches the provider (1 fetch) and is served over a loopback socket |
| `web_search` | `WB-S1-search-single`, `WB-S2-search-multi`, `WB-S3-search-unavailable` | `NC-MEMBER web_search` — widen ONLY the declared composition capability around `WB-S3` (`searchMode: present`); the availability refusal disappears because the provider's own `available()` is the decision |

Each `NC-MEMBER` is paired with `NC-MEMBER-POSITIVE <member>`, which re-runs the
UNMODIFIED vectors and shows they still reproduce their golden rows. A control
whose mutant looks like the baseline goes RED; that is what makes the positive
line load-bearing rather than decorative.

Six further controls prove the harness and the seam are the authority:

| control | what turns RED |
|---|---|
| `NC-GOLDEN-MUTATION` | flip one golden status (`200`→`201`) and invent one request hop → the comparator MUST report the `effects` diff |
| `NC-CATEGORY-TOTAL` | an invented refusal code MUST raise `REFUSAL_VOCABULARY_INCOMPLETE`; `unknown` and the residual `other` MUST be unreachable |
| `NC-SHADOW-LOAD-BEARING` | dispose the PD-27 web shadow → the call reaches the INHERITED host `ctx.web` and trips `BL18_TRIPWIRE` with ZERO fixture arrivals (the shadow is the confinement, not decoration) |
| `NC-NET-SHIM-LOAD-BEARING` | remove the socket witness → the world REFUSES to report a clean zero (`NET_WITNESS_MISSING`); "no egress" can never be claimed unmeasured |
| `NC-NET-COUNTER-POSITIVE` | drive one non-loopback connect through the patched prototype → `external` MUST move to 1 while the REAL connect runs ZERO times (`forwarded=0`, `EGRESS_REFUSED`) |
| `NC-CONCURRENT-NORMALIZATION` | the one concurrent vector's request witness MUST declare itself `sorted` |
| `NC-GOLDEN-DESIGN-CLAIMS` | all 15 golden rows MUST satisfy the corpus's own design claim (a fixture that only records what happened is not a baseline) |

## What the coverage does NOT claim

* **No new path.** `newPathVerified` is false; zero `NEW-PATH-VECTOR` `PASS`
  lines exist for any of the 15 ids.
* **No network confinement proof.** The zero in `net.external` is measured per
  run, by a shim proven load-bearing; it is not a statement about a public
  destination, and the pinned provider still follows same-origin redirects and
  still honours a proxy for public names (both disclosed on every allow fact).
* **`capSearchSources`** is not exercised (the shadow mounts the host default
  and the composition exposes no key to lower it) — an explicit UNKNOWN in
  [`old-path.meta.txt`](./old-path.meta.txt) and in `../README.md` §7.
