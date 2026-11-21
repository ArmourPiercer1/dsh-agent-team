# 02 — Serving census (who serves each booked name today)

> Measured 2026-11-21 against `tests/deepseek-harness-next` = `dsh-v0.2.2-rc.5`
> `9c2670d3bce5275e0d1610272958121af87787bb` (the pinned next host tree), and against
> the Team tree at `origin/master@40041ce26`. Every claim below is a grep you can re-run;
> the command is printed with the claim.

## 1. The question this census asks (and the one it refuses to ask)

The G1 round asked *"is the governed body behaviourally equivalent to a new body?"*. That
question has no answer the owner can sign, because the target architecture never proposed a
second body: it proposed **the host's own tool, with Team's provider in front of it**.

This census asks the only question that decides deletion:

> **Does the retained path (host native row + provider service) already serve this exact
> name, and if so, is this module the enforcement or a duplicate declaration?**

Reproduce the core measurement:

```
cd tests/deepseek-harness-next/packages
for p in fs/tool-fs fs/tool-fs-search web/tool-web shell/tool-bash shell/tool-pwsh \
         shell/tool-bash-persistent interaction/tool-ask-user deliverables/tool-present \
         todo/tool-todo goal/tool-goal subagent/tool-subagent; do
  echo "$p => $(grep -rhoE "name: *'[a-z_]+'" $p/src | sort -u | tr '\n' ' ')"
done
```

## 2. Name-by-name result

`ctx.*` counts are the provider calls measured in that package's `src` (the face the Team
provider must serve).

| booked name | host native row (package) | provider face(s) | verdict |
| --- | --- | --- | --- |
| `read` | `fs/tool-fs` | `ctx.fs` ×37 | served |
| `write` | `fs/tool-fs` | `ctx.fs` | served |
| `edit` | `fs/tool-fs` | `ctx.fs` | served |
| `read_image` | `fs/tool-fs` | `ctx.fs` | served |
| `grep` | `fs/tool-fs-search` | `ctx.fs`, `ctx.subprocess`, `ctx.shell` | served |
| `glob` | `fs/tool-fs-search` | `ctx.fs`, `ctx.subprocess`, `ctx.shell` | served |
| `web_fetch` | `web/tool-web` | `ctx.web` ×14 | served |
| `web_search` | `web/tool-web` | `ctx.web` ×14 | served |
| `bash` | `shell/tool-bash` (+ `tool-bash-persistent`) | `ctx.shell` ×7, `ctx.terminals` ×9 | served |
| `pwsh` | `shell/tool-pwsh` | `ctx.shell` ×8 | served, **not wired by the preset** |
| `ask_user_question` | `interaction/tool-ask-user` | `ctx.userQuestions` | served on the host, **removed from the shipping preset by PD-25** |
| `present` | `deliverables/tool-present` | `ctx.fs`, `ctx.agents`, `ctx.workingDirectory` | served |
| `todo_write` | `todo/tool-todo` | `ctx.sessionProjections` | served |
| `get_goal` | `goal/tool-goal` | `ctx.goals` | served |
| `create_goal` | `goal/tool-goal` | `ctx.goals` | served |
| `update_goal` | `goal/tool-goal` | `ctx.goals` | served |
| `subagent` | `subagent/tool-subagent` (`toolName` default `subagent`) | `ctx.subagents` | served |
| `send_message` | `subagent/tool-subagent-control` | `ctx.subagents` | served |
| `interrupt_agent` | `subagent/tool-subagent-control` | `ctx.subagents` | served |
| `list_agents` | `subagent/tool-subagent-control` | `ctx.subagents` | served |
| `list_subagent_models` | `subagent/tool-subagent` | `ctx.subagents` | served |
| `workflow` | `workflow/tool-workflow` | `ctx.workflowEngine`, `ctx.jobs` | served |
| `subagent_fork` | **none** (the host ships `subagent/subagent-fork-in-process` as a *provider*, not a tool) | — | **not served** |
| `exit_plan_mode` | **none** (only a `claude-code-mods` name mapping) | — | **not served** |
| `team_skill` | **none** | — | **not served** |
| `team_cordis_inspect_list` | `extensions/tool-cordis` as **`cordis_inspect_list`** | `ctx.cordisInspect` | served under a **different spelling** |
| `team_cordis_inspect_query` | `extensions/tool-cordis` as **`cordis_inspect_query`** | `ctx.cordisInspect` | served under a **different spelling** |

**27 booked members** (4 fs + 2 search + 2 web + 2 process + 3 inspect + 7 agent-control +
2 ui + 5 agent-state). **24 served, 3 not served, 2 served only under another spelling.**

The three unserved names are the entire reason the "delete everything" version of the plan
is not available:

| name | why it has no home | what a home would be |
| --- | --- | --- |
| `team_skill` | Team-specific: it exposes the *Team's* skill catalog, which the host does not have | a Team provider (`ctx.teamSkills`) served into a host-shaped row, or an owner ruling that the capability is dropped |
| `subagent_fork` | the host implements forking as a **provider** (`subagent-fork-in-process`), not a tool; nothing exposes it to the model | an owner ruling: expose the provider as a row, or drop the capability |
| `exit_plan_mode` | plan mode exists in the host as a client/mod concept (`claude-code-mods` maps the *name*), not as a native tool | an owner ruling: is plan mode a Team capability at all? |

## 3. Why the two "different spelling" cases are not deletable by accident

`team_cordis_inspect_list` → `cordis_inspect_list` looks like a rename, and a rename looks
cheap. It is not free: a rename is a **model-visible name change**, so it belongs to the
owner (that is `alias-to-native-name-change` from the G1 ledger, and it is still
unanswered). Under whole-module rules the inspect family is therefore **C**, not B: we do
not delete three rows and hand-write one alias.

## 4. The finding that changes the retirement order

The `confined-*` shadows exist because of a measured bug: the governed preset mounts
`@deepseek-ai/dsh-tool-fs` **on the preset scope**, which resolves the *inherited, base*
`fs-sandbox` service rather than the Member realm's confined provider (PD-17, recon
`a5sf-recon-fs`). The team's answer was to declare `read/write/edit/read_image` a second
time on the agent scope.

That is a correct diagnosis and the wrong mechanism, and it is the same mistake as the
family bodies one level up: **the bug is "ctx.fs resolves the wrong provider", and the fix
is "make the Member realm the place ctx.fs resolves"** — not "declare the name again".

This is why the five shadows are bucket **B**, wave 1, paired with the provider lane: they
disappear in the same PR that makes the provider resolve correctly, and after that PR the
realm has exactly **one** declarant per name.

## 5. Bucket roll-up

| bucket | modules | what it means |
| --- | --- | --- |
| B (delete wave 1, paired) | 5 family bodies + 5 shadows + 5 rows | name served by the host; module is the only enforcement today |
| C (not deletable) | inspect / agent-control / agent-state bodies + their 3 rows; plane, seam, rows-barrel, native-bash shadow | a booked name has no home, or the module is blocked by one that does |
| A (delete, changes nothing) | `a5p5-tools` (dormant barrel) | no runtime effect at all — labelled so nobody counts it as progress |
| KEEP | `packages/tools/src` (admission: guard, deny, selector), `native-tool-admission` | what the new route builds on |

Totals are in [`01-ASSET-INVENTORY.md`](./01-ASSET-INVENTORY.md) and are generated, never
typed: **28 modules / 140 files / 30,624 lines / 97 delete / 43 keep.**
