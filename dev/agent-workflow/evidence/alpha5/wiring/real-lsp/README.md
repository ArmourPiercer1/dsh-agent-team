# alpha5 / wiring / real-lsp — REAL language servers over the P-LSP production surface (最小交互验收)

Tasking (root agent, 2026-10-17): the `prod-lsp` lane shipped R-1 `spawnStreaming` +
R-2 `createLspRealmAssembly` with a **fixture** payload, so
`dev/agent-workflow/evidence/alpha5/ALPHA5-ACCEPTANCE-STATUS.md` carries the row
「LSP 生产装配 = PENDING-ACCEPTANCE（真实语言服务器最小交互未做…行未闭合前 LSP 面禁族级 GO 宣称）」.
This lane answers exactly that: **real language servers, no fixture, no self-written
stub**, driven through the *emitted production artifacts* on the confined Landlock plane.

- Branch `alpha5-real-lsp` @ `.worktrees/a5-real-lsp`, base = `alpha5-prod-lsp`
  `7962022e` (ff-able, evidence-only diff — **no source, no dist, no shared file touched**;
  CORE PATCH BUDGET 0 respected, the lane needs zero product change).
- Worlds `tests/homes/a5reallsp-*` (self-removed; the kit deletes its own world unless `--keep`).
- Port **3182** declared for this lane: connect-probed **IDLE**, and **never bound** by
  anything here (this kit binds nothing at all). 3183 belongs to another lane (untouched).
- **:3080**: read-only HTTP probe only (`401`), never written, never restarted.

## Verdict

**REAL-LSP = GREEN** — 30/30 checks, twice on this host (`runs/2026-10-17T10-48-19-580Z` and
the reproducibility rerun `runs/2026-10-17T10-50-20-653Z`, both exit 0). Real servers used:

| server | version | face | carries |
|---|---|---|---|
| `/usr/bin/clangd` | Ubuntu clangd **18.1.3** (1ubuntu1) linux+grpc | real **LSP** (JSON-RPC + `Content-Length`) | C1 handshake, C2 semantic, C3 policy effect, C4 rebuild, C6 shutdown/exit |
| typescript **tsserver** | **6.0.3** (`node_modules/typescript/lib/tsserver.js`) | Microsoft's official **TS stdio JSON** face (not LSP — see below) | C5 cross-member second server + its own real definition/completion |

Both spawn through `createLspRealmAssembly` → `createConfinedProcessProvider().spawnStreaming()`
→ the trusted launcher's `--confined-exec-stream` (fd-3 handshake, self-restrict before
`execve`), i.e. the same double-gated (path + sha256 byte-pin + ABI floor) plane P-LSP shipped.
Landlock **ABI v4** on this host; launcher sha `e66a8cf77fb74701…`.

## Minimum-criteria ledger (the five the tasking asked for)

| # | criterion | how it is proven (all values are the server's own bytes) | evidence |
|---|---|---|---|
| ① | `initialize` answers with the **server's real capabilities JSON**, not a stub | clangd replies `serverInfo={name:"clangd",version:"Ubuntu clangd version 18.1.3 …"}` + **31 capability keys** incl. `definitionProvider:true`, `declarationProvider`, `completionProvider`, `documentSymbolProvider`, and clangd-only `executeCommandProvider.commands=["clangd.applyFix","clangd.applyTweak"]`, `clangdInlayHintsProvider`, `astProvider` | `runs/*/clangd-initialize-result.json`, `verdict.json.handshakes` |
| ② | one **real semantic request** on a project symbol returns the server's **real result** | `textDocument/definition` on `compute_answer()` at the call site → `{"start":{"line":3,"character":4},"end":{"line":3,"character":18}}` in the right file; `textDocument/documentSymbol` → the file's real symbol table `["compute_answer","main"]`. tsserver leg: `definition` → `main.ts` line 1 offsets 17–30 with context range; `completionInfo` → **1042 real entries** incl. `computeAnswer` | `clangd-definition-same-file.json`, `clangd-document-symbol.json`, `tsserver-definition.json`, `tsserver-completion.json` |
| ③ | `shutdown`/`exit` really go through the **LSP protocol** and the OS confirms the exit | `shutdown` → `result:null`; `exit` notification → the process exits by itself `{"code":0,"signal":""}`, then `/proc/<pid>` is gone, `dispose()` confirms (`lastPid` recorded) and the provider lease reads **`terminated`** | `clangd-shutdown.json`, leg L6.1–L6.5 |
| ④ | after `policyChange` the **new instance really handshakes** | `strict → open`: new pid (41→69 class), old pid OS-gone inside the bounded window, journal `policy-change-begin → realm-disposed{lastPid} → realm-assembled{pid} → policy-change-complete`, and the NEW process completes a full `initialize` (its own 31-key capabilities) **and** answers a request the old generation could not (see ⑤-adjacent leg) | transcript legs L4.1–L4.6, `clangd-initialize-result-open.json` |
| ⑤ | cross-**member**: two servers, two pids, isolated | `clangd-member` and `ts-member` live simultaneously (`assembly.size()==2`, distinct pids, each answering in its own project); rebuilding the clangd member leaves the tsserver member's pid **and liveness** untouched (it still answers afterwards) | legs L5.1–L5.6 |

Bonus leg the real server made possible (impossible with a fixture): **OS mediation is
visible through the server's own answers.** The generated project `#include`s
`../../secret/hidden.h`, which exists on disk but is outside the grant:

- strict generation → clangd's own diagnostic:
  `Cannot open file '…/ws/clangd-member-strict/../../secret/hidden.h': Permission denied`
  (= EACCES from Landlock, *not* ENOENT) + `Call to undeclared function 'hidden_answer'`,
  and a `definition` on that symbol never lands in `hidden.h`;
- after `policyChange` to the generation that grants the header dir → same request,
  same bytes on disk: resolves to `…/secret/hidden.h:{start:{line:3,character:4}}` and the
  diagnostic disappears.

`clangd-diagnostics-strict-vs-open.json` holds both diagnostic sets verbatim.

## Candidate enumeration (honest, no network, nothing installed)

`runs/candidate-scan.txt` is the raw scan. Summary:

1. **typescript tsserver 6.0.3** (the tasking's first candidate) — present, runs confined,
   but it has **no LSP mode**: `grep -c '"--lsp"' lib/_tsserver.js` = 0, and its live face
   answers `initialize` / `shutdown` with `Unrecognized JSON command`. It therefore cannot
   carry criteria ①/③; it is used as the **second real server** on its own documented face.
2. **clangd 18.1.3** (`/usr/bin/clangd`, also `clangd-18`) — a real LLVM LSP server, already
   installed; chosen as the primary server. Chosen flags keep it read-only:
   `--background-index=false --pch-storage=memory --enable-config=false --limit-results=20 --log=error`.
3. `typescript-language-server@5.3.0` + `vscode-languageserver-protocol@3.18.2` exist only in
   the **foreign** tree `/srv/workspace/deepseek-harness/node_modules/.pnpm` (another project's
   install) → recorded, deliberately not used.
4. Absent on this host (so not usable without a download, which is forbidden):
   `rust-analyzer`, `gopls`, `pyright`, `pylsp`, `bash-language-server`, `docker-langserver`,
   `yamlls`, `vscode-langservers-extracted`, `jdtls`, `ccls`, `solc`; python side:
   `pygls`/`pylsp`/`lsprotocol`/`jedi`/`parso` all `ModuleNotFoundError`.

So: **not ENV-BLOCKED** — a real LSP server was available locally and the whole kit ran on it.

`runs/` also keeps the iteration trail (four earlier run dirs) — two of them are the
measurement that shaped the kit: the first real-clangd run stalled on
`textDocument/completion` until the client started answering clangd's server→client
requests, and an intermediate run proved the header-include path had to be relative to the
generation root (otherwise the deny-leg would have proven nothing but a typo). Kept, not
hidden.

## Reproduce

```
node dev/agent-workflow/evidence/alpha5/wiring/real-lsp/real-lsp-kit.mjs        # ~45 s, prints PASS/FAIL ledger, exit 0
node dev/agent-workflow/evidence/alpha5/wiring/real-lsp/probe-clangd-confined.mjs      # feasibility probe: real clangd through the provider stream arm
node dev/agent-workflow/evidence/alpha5/wiring/real-lsp/probe-tsserver-confined.mjs    # feasibility probe: real tsserver through the same arm
```
The kit runs against `packages/runtime/dist/.../sandbox-provider/index.js` (committed emit at
this HEAD), so it exercises the shipped artifacts, not the TS sources.

## Honest disclosures

- **Only two real servers were reachable here**, and only clangd speaks LSP; the "LSP
  protocol" criteria (①③) therefore rest on one LSP implementation (clangd 18.1.3), not on
  a fleet. Nothing here claims conformance beyond what the recorded replies show.
- clangd **did not answer `textDocument/hover` within 10 s** and answered
  `textDocument/completion` with an **empty list** in this environment; both are recorded
  verbatim (`clangd-hover-observed.json`, `clangd-completion-observed.json`) and are **not**
  counted as criteria. The semantic legs that are counted (`definition`, `documentSymbol`)
  answered normally. Client-side, `initialize` must answer clangd's server→client requests
  (`workspace/configuration`, progress registration) or clangd stalls features — the kit
  replies to them; that is a client duty, not a provider/lane defect.
- The kit injects its own `ready` hook, replacing the production default line-JSON ping.
  That hook is exactly the shipped seam (`LspAssemblyOptions.ready`), so no product code
  changed; the handshake it performs is the real server's protocol, not a private protocol.
- Grant shape: clangd's own image lives under `/usr` (launcher `runtime_base` already grants
  `/usr` EXECUTE|READ_FILE|READ_DIR; it is additionally named in `allowPaths` so the policy
  record is explicit), its project subtree read-only, and **no write grant at all** — a real
  clangd works under that. `/proc` visibility is namespace-local (this harness runs each
  command in a bwrap PID namespace); the pid-alive checks the kit and the provider make are
  `/proc` probes **inside the same namespace as the spawn**, which is the R-1 law's own
  assumption — same-namespace consistency, not host-global visibility, is what is claimed.
- Isolation claim stays **realm granularity** (per member × generation: own provider instance,
  own confined OS process, own cwd/allow-set). No policy-granularity eviction claim is made.
- `NoNewPrivs` reads `1` for every process in this harness environment, so it is **not** used
  as evidence here; the confinement facts are the launcher's self-restrict + the observed
  EACCES differential above.
- This row's *acceptance* flip belongs to the router/Gate: what this lane delivers is the
  missing measurement. With it, the row's stated blocking condition (真实语言服务器最小交互未做)
  is discharged; per the row's own clause, no family-level GO is claimed by this lane.

## 收口三件套

1. **Worlds: 0 residue** — the kit `rmSync`s its own `tests/homes/a5reallsp-kit-*`; the three
   probe worlds were removed too; `ls tests/homes` shows no `a5reallsp-*` left, and the kit's
   own `/proc` scan for any cmdline containing the world path returned `[]` (L7.3).
2. **Ports: released** — this lane never bound a socket; 3182 was connect-probed IDLE before
   and after (`census.json.ports`), 3183 (another lane) untouched.
3. **:3080** — read-only probe only (HTTP 401), no write/restart/config touch.
