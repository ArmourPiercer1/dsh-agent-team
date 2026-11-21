# FINDING — on a Member Scope the native `read` is served by the BASE provider (round 60, live host)

This is the owner's named risk, measured on a real host instead of argued about: *"Member Scope 上原生工具是否
解析到该 Agent 的受控 Provider（无 Shadow Definition）"*. The answer today is **NO**.

## The measurement

Two agreeing boots (`--boots 2`, `agreeing=true`), one governed Member, three model requests, remote mount
`SKIPPED` (C-remote), and:

| judge | result |
| --- | --- |
| `d:centre-facts` | PASS — the member's durable ledger holds `allow` + `deny/LANE_DENY` + 2 execution facts |
| `d:member-read-admitted` | PASS — in-lane bytes arrive in the native `<path>/<type>/<content>` envelope (but the judge cannot witness WHICH provider served them) |
| `d:guard-facts` | **REFUTED — ZERO guard consults**; the sink file does not exist |
| `d:member-read-denied` | REFUTED — the refusal is the centre's `LANE_DENY`, not the provider's typed `IO_READ_DENIED` |
| `d:native-read-surface` | REFUTED — judge instrument defect (see below) |

Zero `a5sf-guard-consult/1` facts means the call never went through the confined provider: it was admitted by
the centre and then executed by the **base `fs`**.

## Why (product source, not conjecture)

The preset `tool-fs` row resolves the preset standing scope's **base** `fs`. Only `a5sfNativeToolModules`
re-mounts a native module into the Member's isolated scope (`team-services/src/mount.ts:70-96`), and this row
declares none. So confinement of native tools is **opt-in per row**, not a property of being governed.

That is the gap: a governed Member gets the centre's decision (correct) and the base provider's I/O (wrong).
Governance without the provider boundary is exactly the "second half" the A1 law means by *Provider-OS
Boundary*.

## Two lawful fixes, both Team-side (no DSH patch)

| # | shape | notes |
| --- | --- | --- |
| **A** | MOUNT BY DEFAULT: for a governed Member, mount the host's native tool modules into the member realm unless the row explicitly narrows the set | recovers confinement for every governed member; must preserve the "ONE definition" law (no shadow), and must fail closed if a native module cannot be resolved |
| **B** | REFUSE an undeclared set: a governed row without `a5sfNativeToolModules` is refused at bind (`MEMBER_NATIVE_UNCONFINED`) | fail-closed and small, but changes behaviour for every existing governed world (including the migrated suite's fixtures) |

Recommendation: **A**, with B as the safety net for a module that cannot be mounted. A is the only shape that
makes "governed" mean "confined" rather than "adjudicated but unconfined".

## Also found: one judge is measuring the wrong field

`d:native-read-surface` requires the top-level tool description to contain `resolved by the filesystem
backend`; in the pinned host that phrase is the **`file_path` PARAMETER** description
(`tests/deepseek-harness-test-use/packages/fs/tool-fs/src/read.ts:79-81`), while the top-level description is
`Read a UTF-8 text file and return line-numbered content.` The judge must be re-anchored to the field it means
(a tool whose schema matches the host's, and no shadow module), NOT deleted — the "no shadow definition" claim
is still exactly the right claim.

## What must not happen

- Do not report "native tools are confined" from `d:member-read-admitted`: it passes on the base provider.
- Do not relax `d:guard-facts` to "facts may be absent": zero guard consults IS the finding.
- Do not fix this by writing a Team tool that shadows `read` — that is the shadow definition A1 forbids.
