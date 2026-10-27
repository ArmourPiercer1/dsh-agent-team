# Call-chain diagnosis (EB4-B)

**State: `DELIVERED` for the static-attribution face; `NOT_VERIFIED` and structurally unavailable for
the live-correlation face — see [§5 What this cannot answer](#5-what-this-cannot-answer).**
Tool: [scripts/diag-call-chain.mjs](../scripts/diag-call-chain.mjs). Tests:
[tests/diag-call-chain/diag-call-chain.test.mjs](../tests/diag-call-chain/diag-call-chain.test.mjs).
Receipts: [dev/agent-workflow/evidence/u7-3-20261026/eb4b-receipts.txt](../dev/agent-workflow/evidence/u7-3-20261026/eb4b-receipts.txt).

A governed tool refusal is one line. The question a reader actually has is *which face said no, and
was the body ever entered*. This page answers the first question from source and says plainly why the
second one is not answerable from a refusal line at this tree.

## 1. What it is

Given a refusal — an `a5p5-refused kind=… code=… detail=…` line, a center shadow-ledger
`shadow-verdict` row, or a bare refusal code — the tool reports:

| Field | Meaning |
| --- | --- |
| `stage` | which pipeline step produces that refusal **kind** (`packages/tools/a5p5-tools/src/pipeline.ts` / `register.ts`, cited by file:line) |
| `face` | which admission / coverage / assurance / control / provider face **emits** that code (source-cited) |
| `code` | the refusal code, verbatim |
| `attribution` | `ATTRIBUTED` (exactly one face), `AMBIGUOUS` (several faces — all named), `UNKNOWN_CODE`, `UNKNOWN_KIND`, `NO_PRODUCTION_EMITTER` |
| `effectFingerprint` | printed only when it has the exact `sha256:<64 lowercase hex>` shape |
| `chain` | the EB4-B links: `invocationCorrelation`, `binding`, `paControl`, `provider`, `settlement` |

It is a **router over existing source vocabulary**, not a new framework: it carries no state, writes
nothing, boots nothing and reads no port. Two mechanical pieces make it checkable rather than
plausible:

* `--self-test` re-reads every cited emitter file and asserts each code literal (and each site
  token, e.g. `refusal: 'template-default-deny'`) is still there; it also asserts every §5 code in
  `packages/domain/tool-governance/src/errors.ts` has a row. A moved or renamed code turns the
  self-test red instead of silently attributing to a file that no longer emits it.
* the spill refusal set is read **out of** `packages/tools/a5p5-tools/src/spill.ts`, never matched
  by prefix, so an invented `spill-…` code stays `UNKNOWN_CODE`.
* family registration refusals (`PLANE_READ_/PROCESS_/SEARCH_REGISTRATION_REFUSED` at this tree)
  are **resolved, not listed**. Every module that `packages/tools/families/manifest.json` lists is
  scanned for its `refusalCode: 'PLANE_*_REFUSED'` literal, and each code found is attributed to
  `plane-mount` with that descriptor as its emitter. A descriptor on disk that the manifest does not
  list attributes nothing, because only a listed module mounts. A listed descriptor without the
  literal is a self-test red that names the file and the code. A new family is therefore attributed
  without editing the tool. The three codes were first a hardcoded `team-tool-plane.mjs` citation.
  #399/#400 moved the literals into the family descriptors, the citation drifted, and the self-test
  went red on master. Nothing caught it, because this suite was in no CI layer until #398.

## 2. Run it

Every command below was run in the `u7-3` worktree; the recorded output is in
[the EB4-B receipts](../dev/agent-workflow/evidence/u7-3-20261026/eb4b-receipts.txt) (header: base SHA
and time). Output shown here is quoted from that file; re-run the command for a current value.

```bash
node scripts/diag-call-chain.mjs --self-test
# diag-call-chain --self-test: OK 48 codes, 5 kinds, every citation holds at this tree   (exit 0)

node scripts/diag-call-chain.mjs --text 'a5p5-refused kind=refused-admission code=IO_POLICY_UNSUPPORTED detail=sha256:0e370…'
node scripts/diag-call-chain.mjs --file <transcript-or-jsonl> [--json]
node scripts/diag-call-chain.mjs --code GRANT_STALE [--kind refused-admission] [--json]
```

Real refusal, real output (transcript from the U6 PR5 C2 run, `dev/agent-workflow/evidence/u6-pr5-20261026/c2/run8-greper-tool-transcript.txt`):

```text
diag-call-chain: refusals=3 seen=3 truncated=false verdict=ATTRIBUTED_OR_NAMED_AMBIGUOUS
[1] source=a5p5-refusal-line kind=refused-admission code=IO_POLICY_UNSUPPORTED attribution=AMBIGUOUS
    stage: admission: lane decide verdict OR the PA (admission kernel / Control) edge — the line alone cannot say which (…pipeline.ts:106, …pipeline.ts:153, …register.ts:269)
    face: pa-default-deny-coverage [packages/runtime/tool-admission/admission-kernel.ts (refusal: 'template-default-deny')]
    face: assurance [packages/runtime/tool-admission/assurance-runtime.ts]
    face: admission-kernel [packages/runtime/tool-admission/admission-kernel.ts]
    face: closed-world-guard [packages/runtime/tool-dispatch/install.ts]
    effectFingerprint: present sha256:0e370d8e…
    chain: invocationCorrelation=NOT_OBSERVABLE_FROM_INPUT | binding=NOT_OBSERVABLE_FROM_INPUT | …
```

`AMBIGUOUS` is the honest answer there and it is not a bug: four faces raise
`IO_POLICY_UNSUPPORTED`. The U7-6 forensics resolved one of them by hand (`pa-default-deny-coverage`);
that resolution is a C1/C2 receipt, not something a static tool may claim.

## 3. Redaction and the negative control

Free-text fields (`detail`, `code`, shadow `name` / `scopeKey` / `callId`) pass through the **one**
redaction vocabulary of this repository, [scripts/redaction-patterns.mjs](../scripts/redaction-patterns.mjs),
which is the table moved verbatim out of [scripts/sanitize-evidence.mjs](../scripts/sanitize-evidence.mjs)
— so the sanitizer and the diagnostic cannot drift apart. Rendering then re-scans its own output and
**refuses the whole output** (exit 2, nothing printed) if any credential-shaped substring survives.

**Negative control (proof, not assertion)** — a credential-shaped value is present, redaction is the
thing that stops it, and the backstop is shown to be sensitive:

```text
$ node scripts/diag-call-chain.mjs --text 'a5p5-refused kind=refused-admission code=APPROVAL_STALE detail=token=sk-Live-9fK3xQz7VbN2mT8rWs4Yd'
[1] source=a5p5-refusal-line kind=refused-admission code=APPROVAL_STALE attribution=ATTRIBUTED
    effectFingerprint: ABSENT_OR_MALFORMED (refused-admission should carry sha256:<64 hex>; not printed)
# the refused-admission detail is withheld entirely unless it IS a digest — the secret never renders
```

Test `N4` in [the suite](../tests/diag-call-chain/diag-call-chain.test.mjs) goes further: it runs the
*un-redacted* form of the same string through the backstop and asserts the backstop names
`boot-token` **and** `bearer`, then asserts the redacted form passes with zero hits and differs from
the input. A no-op redactor is therefore detectable rather than invisible. `N1`–`N3` cover a token in
a `backend-failed` detail, a withheld non-digest `refused-admission` detail, and credentials inside a
shadow-ledger row (redacted, and the non-credential remainder kept so the evidence stays readable).

## 4. Bounds (declared and enforced)

| Bound | Value | Enforced by |
| --- | --- | --- |
| input size | ≤ 1 MiB | refuses before reading (`INPUT_OVER_BOUND`, exit 2) |
| refusals reported | ≤ 12 (rest counted, `truncated=true`) | `BOUNDS.maxRefusals`; worst case **fits** the cap below (byte counts in the receipts) |
| per free-text field | ≤ 160 chars, cut **after** redaction | `BOUNDS.detailCap` |
| total stdout | ≤ 24 KiB | refuses (`OUTPUT_OVER_BOUND`, exit 2) |
| input file kind | regular file only | symlink/directory refused |
| time | one read + string work (per-invocation cost in the receipts) | no spawn, no network |
| side effects | none: no child process, no network, no writes, no port | by construction (no imports beyond `node:fs`/`node:path`/the redaction table) |

Exit codes: `0` every refusal attributed (single face, or `AMBIGUOUS` with all candidates named) ·
`1` `UNKNOWN_CODE` / `UNKNOWN_KIND` / `NO_PRODUCTION_EMITTER` present, or a stale `--self-test`
citation · `2` REFUSED (usage, no refusal found, oversize input, unsafe output).

## 5. What this cannot answer

The EB4-B chain is `invocationCorrelation → Binding → PA/Control → Provider → settlement`. **The
refusal line at this tree carries none of those identifiers.** It has a kind, a code and (for
admission refusals) an effect fingerprint. So the tool prints `NOT_OBSERVABLE_FROM_INPUT` for each
link it cannot see, and it never fills the gap with a guess:

* `NOT_VERIFIED`: no live-correlation read is implemented, and none is claimed. Wiring the
  correlation id into the refusal text is a **product change** under `packages/**/src/**` and is out
  of this lane's write scope; it would also have to answer whether the correlation id itself is
  sensitive before it could be printed at all.
* **Not a proof of `body = 0`.** A refusal's wording never proves the effect body did not run; that
  is a C1/C2 question for the suite that owns the face. The tool prints this as a `LIMIT` line on
  every run so a green answer cannot be quoted as more.
* **Not an authority.** Output is never a Grant, a ControlDecision or an approval, and nothing is
  written: EB4-B's own rule is that a log通道 not carry a Grant or a new authorization.
* A `SHADOW` center row refused nothing at all — the shadow row always takes `next()`. The tool says
  so in the `stage` field instead of letting a `refuse` outcome read as a real refusal.

## 6. Related

* [INSTALL-COLD-START.md](./INSTALL-COLD-START.md) — bringing a checkout up before you diagnose.
* [RECOVERY.md](./RECOVERY.md) — when the answer is "this tree is not the thing you think it is".
* [README.md](../README.md) — repository positioning and the 9-package layout.
* [docs/TEST_METHODS.md](./TEST_METHODS.md) — the test-instance constraints any live diagnosis must obey.
* [docs/STATUS.md](./STATUS.md) — the living snapshot; remember it is not the authority.
* [dev/engineering/README.md](../dev/engineering/README.md) — the current-authority pointer this tool
  never reads and never writes.
