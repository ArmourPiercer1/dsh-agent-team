# `@dsh-agent-team/runtime` — member-residency (P5-T6)

The member create/resume residency module (DevPlan §18.5; TaskDoc §11.5 P5-T6
card). It is the last P5 task: with the P5-T1 binder, P5-T2 persona/preset,
P5-T3 root binding and P5-T4 capability adapter integrated, this module makes a
**MemberInstance** a first-class resident of a bound Team — created fresh,
resumed cold, and evicted once settled — through the P5-T1 `TeamAgentBinder`
cold/fresh paths, with the member identity derived once and reused everywhere.

## Residency model (DevPlan §18.5)

```text
MemberInstance durable      (MemberInstancesRepository, table member_instances)
Session durable             (one durable child Session per MemberInstance — invariant 23)
Agent residency ephemeral   (the live agent handle; may be absent when SETTLED)
```

- The durable identity of a member is `(rootSessionId, instanceId)`
  (invariant 18); the derived `childSessionId` is the durable child Session
  (invariant 19/24: the binding is never re-pointed).
- A member in the `SETTLED` lifecycle state may have NO live agent handle
  (DevPlan §18.5). New work for a settled member is a COLD RESUME, never a
  fresh create.
- A member is NOT a continuable subagent: `subagents.followup(parent,
  memberChildId, …)` must be rejected (no resident activation exists for it —
  proven by the M5 negative probe in the real-instance harness).

## Entry points (`index.ts`)

| Export | Path | Behavior |
| --- | --- | --- |
| `deriveMemberIdentity(spec)` | `./identity.js` | Pure derivation of the durable `(instanceId, childSessionId)` from a `MemberCreateSpec` (validated fail-closed; FNV token + hash, cross-verified against the contracts assertion). |
| `createFreshMember(ports, spec)` | `./fresh-member.js` | Fresh create: identity derivation → root pre-check (READ ONLY: `team-root` binding + durable TeamSession) → the child-Session durability barrier (`ports.sessionDurability.ensureDurable(childSessionId)`, the "Session durable" postcondition — awaited BEFORE the first durable write on every path, fail-closed with zero writes) → convergent durable commit (record + `team-member` binding; a re-run after the crash window repairs only the lost side) → the P5-T1 binder **fresh-member** path (three overlay slots installed + admission decided). |
| `rehydrateColdMember(ports, identity)` | `./cold-member.js` | Cold resume: binding pre-check with full identity equality → the P5-T1 binder **cold-member** path (`restoreScope` + `scope-restored` + admission re-decision). Zero durable writes; zero fresh side effects. |
| `evictSettledMember(ports, identity)` | `./evict.js` | Evict a SETTLED member: requires the durable record to be `SETTLED`; drops the ephemeral residency only (the live handle is disposed when present, and absence is ALLOWED — DevPlan §18.5); the durable record and binding are NOT deleted; no surface events. |
| `createMemberDomainWritePort(repositories)` | `./write-port.js` | The write port over the TeamDomain repositories (`putMemberInstance` / `putSessionBinding`). |

Re-admission of an evicted member is `rehydrateColdMember` again (idempotent —
the M4 real-instance scenario drives it twice in one boot).

## The "四槽位全装" of the fresh create (ruling R34 interpretation)

The ruling's "四槽位全装" (all four slots installed) for a fresh member is
implemented as the COMPLETE overlay set plus the admission decision point:

1. `persona` overlay slot — the member persona preset (the text resolves from
   the bound Team's substrate through the P5-T2 persona source
   `getMemberPersona(root, templateId)` — templateId read from the durable
   MemberInstance record, so the record must be written before the binder
   runs).
2. `model` overlay slot — the blueprint model selection
   (`installModelSelection` over the child session).
3. `capability` overlay slot — tools / skills / MCP / listener facets from the
   blueprint capability.
4. The admission GUARD decision — `admission-decided` with the guard's
   verdict (open → admitted). The guard is the fourth "slot": the admission
   checkpoint itself, not an overlay.

DevPlan §18.2 substrate wiring lives in the injected slot implementations;
this module only orchestrates the installs through the injected
`MemberResidencyPorts.slots`. The binder's fresh path records
`overlay-installed` ×3 + `admission-decided` ×1 (four agent-setup events),
and the real-instance harness asserts exactly that set.

## Ports (`types.ts`)

`MemberResidencyPorts` is the full injection surface: `teamDomain` (read
handle), `writes` (durable write port), `surface` (the P5-T1
`TeamAgentSetupSurface`), `residency` (the ephemeral handle map for evict),
optional `slots` (fresh path only), `admissionGuard`, and `now`. The module is
pure: no global services, no timers, no I/O — every effect flows through the
injected ports, which is what the unit suites (37 tests) drive with fakes and
what the real-instance harness drives with the real services.

## Real-instance harness

`harness/` — a real-DSH-instance driver (six boots, ports 3180/3181, fresh
`DSH_HOME` per run) that re-verifies the T5 root binding (boots 1–2, the T5
row) and then drives M1–M5 + the I-1 hard group (I1a crash in the
durable-write window, I1b schema-version-mismatch fail-loud, I1c
record-loss replay) through public surfaces only. See
`dev/agent-workflow/evidence/P5-T6/` for the run evidence and
`public-surfaces.md` for the seam inventory.
