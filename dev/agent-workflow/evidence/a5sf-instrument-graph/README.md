# a5sf-instrument-graph — PD-31 (window allocation PD-32): the World factory provisions the module graph

**Lane** `pd32-instrument-graph` · **branch** `task/pd32-instrument-graph` ·
**boot-time HEAD** `da6cc7ba2` (the two boots below ran with the working-tree files, and the
run records bind `teamSha = da6cc7ba2`) · **rebased onto** `0c2a8f422` (`PD29-GOAL-STOP` #679,
which also carries #677/#678); the rebase changed only the register row's id and the docs, so
the measured files are byte-identical and the records' `teamSha` remains an ancestor ·
**class** DEV-LIVE for the two boots below, host-free for the unit pins.

**Row id, both disclosed**: the window allocates **PD-32** to this lane; **#679 merged PD-30**
before this row, so the register's `PD-1…PD-n` contiguity law makes the id on this base
**PD-31** (PD-30 → PD-31 is the only renaming; the defect and the evidence are unchanged).

## 0. Why this exists: the instrument substituted the subject — twice

A Cordis row's specifier must resolve in the composition's module graph. The loader resolves
**every** row through one base (`loader.internal.import(name, this.ctx.baseUrl)`, `baseUrl` = the
profile), so a preset row and a profile row resolve identically; what differs is whether the
bundle is **installed in that graph**. Our Worlds built `profiles/web/` empty, so the shipped
rows had nothing to resolve against, and the failure is not "one tool is missing":

* the row is `never started`, or (when it is the host row itself) `failed to import`;
* the Agent is never constructed, so **every** confined face goes down with it —
  `fs`, `shell`, `skill`, `present`, all of it;
* and the symptom a lane then reports is never the cause: one lane reported "no goal", another
  "0 Members" + every `team_delegate` rejected `TEAM_RUNTIME_DURABLE_WRITE_FAILED`.

This is the **second** time this phase paid for the same thing. The first time, the driver
"fixed" it by rewriting the row to an absolute `file:` URL — i.e. the instrument measured a tree
that was not the shipped one and reported six green arms against a dead preset. The second time,
the fix (in `a5sf-pd30-web-preview`) worked where it was written and nowhere else, so two sibling
lanes re-implemented it inside their own drivers. **The fix was never the link. The fix is that
the link is not a lane's business.**

## 1. What changed (test-only; no product row, no product byte)

`tests/world-factory/lib/profile-module-graph.mjs` (new) + one call in
`WorldFactory#createWorld`:

1. **Provision** — read the tree's OWN `package.json` `name` + `exports`, link `<repoRoot>` into
   `<home>/profiles/web/node_modules/<name>`. One link serves **every** declared subpath (Node
   walks the linked package's `exports`), so this is not a hardcoded `./web-tool`: `.`,
   `./host`, `./spill-local`, `./web-tool`, `./client`, `./package.json`, `./web-transport` all
   resolve, and a lane that adds an export adds nothing here.
2. **Verify at creation** — each declared subpath is resolved *from a file inside the profile*;
   a subpath that does not resolve throws `A5SF_PROFILE_GRAPH_UNRESOLVED` naming it, at World
   creation, instead of becoming `never started` three minutes later.
3. **Refuse to overwrite** — an existing non-symlink `node_modules/<name>` is never written over.
4. **Negative control** — `A5SF_WF_NO_INSTALL_GRAPH=1` (older alias `A5SF_PD30_NO_INSTALL_GRAPH=1`
   honoured) skips provisioning, so the dependency stays a measurement.
5. **The precondition travels with it** — `assertShippedPresetMounted()` throws a NAMED
   `ShippedPresetAuditError` with three distinct codes: `A5SF_PRESET_NEVER_STARTED` (a row did not
   mount — matches **both** `never started` and `failed to import`, because the second is what a
   missing HOST row logs), `A5SF_PRESET_NO_MEMBER`, `A5SF_PRESET_NO_SURFACE`.

Nothing about a real install changed: the World links the tree the way an install would provide
it, and the shipped bytes are measured byte-for-byte. The pinned host checkout is never touched
(the link lives in the World's own home; porcelain empty before and after).

## 2. Proof: a World that does NOT provision, served by the shared graph

The PD-30 driver carries its own local `installGraph()` — the very duplication this PR removes.
`A5SF_PD30_DRIVER_NO_GRAPH=1` makes that local copy refuse to act and fail unless the **World**
already provisioned the link. So this boot proves the shared step, using a driver that does not
provision:

```
A5SF_PD30_DRIVER_NO_GRAPH=1 run-boot.mjs --arm allow --boots 1
→ RESULT PASS;  precondition.json: installGraph.source = "world-factory", no rewrite
   surface 33 (web_fetch, web_search present); fixture 1 connection {"/known":1};
   search 1 real POST /search; hostWebCalls 0; member-surface tools 33
   host log: 0 lines matching `never started|failed to import`
```

Files: `positive/precondition.json`, `positive/precondition-member.json`,
`positive/member-surface.json`, `positive/counters.json`, `positive/preset-effective.json`
(`rewrites: []`), `positive/run-record.json`, `positive/agreement-allow.txt`.

## 3. Negative control: the same World, no graph, fails CLOSED with the cause

```
A5SF_PD30_NO_INSTALL_GRAPH=1 run-boot.mjs --arm allow --boots 1
→ exit 1, FAILED at composition:
   ShippedPresetAuditError: A5SF_PRESET_NEVER_STARTED: a preset row is `never started` ...
     dsh-agent-team (dsh-agent-team/host): failed to import
     a5sf-web-transport (dsh-agent-team/web-transport): failed to import
```

Note what the shared precondition bought here: without it the same boot reports
`the p6t6 harness route never answered: the World did not reach a usable Host` — true, useless,
and exactly the symptom two lanes chased. The precondition asks the host log *why* before it
reports *that*.

Files: `negative-control/driver.log`, `negative-control/host-log-rows.txt`.

## 4. Host-free pins

`tests/world-factory/a5sf-instrument-graph.test.mjs` — 7/7, no Host, no port:

* `PD32-GRAPH`: `createWorld` provisions, and every declared subpath is recorded resolved
  (`./web-tool` → `confined-web-tool.mjs`, `./web-transport` → `a5sf-web-transport.mjs`, …);
* `PD32-GRAPH` verification is per-subpath: a fixture package whose `exports` promises a missing
  file throws `A5SF_PROFILE_GRAPH_UNRESOLVED` naming `./missing` and not `./good`;
* the negative control disables provisioning (both spellings), and nothing else does;
* an installed directory is never overwritten;
* `PD32-PRECONDITION`: `never started` throws with the audit line; a healthy boot passes; no
  Member and no surface are **different** codes;
* the preconditions appear in the driver **before** the first arm (order is the contract).

## 5. What this does NOT claim

* It does not change the product: no row, no code, no exported name, no install shape.
* It does not make the *packaged* install path proven — it makes the harness faithful to it. The
  packaged installer still has to be exercised by its own lane.
* It does not fix the two sibling lanes' local copies; they should delete them and inherit this
  one (the owner is telling them to).
* `web_search`'s default-install gap and every product residual belong to PD-28's row, unchanged.

## 6. The falsification test: factory graph == manually provisioned graph

A claim that the instrument is faithful is worth nothing unless it names what
would falsify it. **The claim**: provisioning is a graph, not a behaviour — so
the same tree must measure the same surface either way. **The falsifier**: if a
World booted with the factory's graph ever measures a *different* surface than
the same tree measures with a manually provisioned graph, the provisioning is
wrong.

Measured on the rebased tree (`0c2a8f422`), one arm each, same driver, same
fixtures, only the provisioning path differing:

| arm | how the graph exists | surface | fixture conns | search conns | host-web calls |
| --- | --- | --- | --- | --- | --- |
| factory | `createWorld` (this PR) | **36** | 1 `{"/known":1}` | 1 | 0 |
| manual | `A5SF_WF_NO_INSTALL_GRAPH=1` + the driver's own `installGraph()` | **36** | 1 `{"/known":1}` | 1 | 0 |

Identical. Files: `equivalence/factory-arm.json` (+ the four boot artifacts);
the manual arm is recorded here because the driver reuses one boot directory.

Note the absolute number moved 33 → 36 between `da6cc7ba2` and `0c2a8f422`
(master added the goal tools and the read_image tool), which is exactly why the
comparison must be same-tree: a cross-tree comparison would have "proven" a
provisioning defect that was base drift.
