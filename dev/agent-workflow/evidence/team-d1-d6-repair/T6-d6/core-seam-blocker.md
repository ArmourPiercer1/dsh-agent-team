# T6 D6 CORE_SEAM_BLOCKER Evidence

- task: T6 D6 dynamic Team root restart/reopen
- branch: task/team-d6-restart-reopen
- base: 6b81a4743de6ea08ed476287fc414622340633bd
- model_route: qiyuan-self/qwen3.8-27b
- host_sha: 76fda729799fe9b3848dbe2c211d4b231032b81e
- host_status: clean

## Seam characterization

1. Team-owned dynamic-root discovery is available through the existing TeamDomain repository seam: `domain.repositories.teamSessions.list()` returns persisted TeamSession rows. The current live glue already uses this public Team-owned repository to resolve ownership in `teamRootOfSession`, but `boot()` resumes only `config.rootSessionId` and enumerates members of that one root.
2. Team glue has a public Team-owned `agentSetup()` callback and can call the upstream public `agents.resume({ resumeSessionId, setup })` when it owns the resume operation.
3. Ordinary Web reopen is owned by upstream `SessionController` (`packages/api/session-controller/src/agent.ts`, host SHA above). `resumeObserved()` and `createOrAdopt()` call `composeAgent()` and then directly invoke `ctx.agents.resume({ resumeSessionId, setup: composition.setup })`. The upstream public contract exposes the setup callback only to the caller; there is no Team-owned public session-resume interception/ownership registration seam.
4. Therefore a persisted dynamic Team root may be enumerated by Team code, but an arbitrary Web reopen cannot be forced through Team `agentSetup()` from the downstream plugin without either changing upstream SessionController or using an upstream/private API.

## Fixed blocker format

CORE_SEAM_BLOCKER: ordinary Web reopen Team setup interception
- Seam name: public session-resume ownership/interception
- Host SHA: 76fda729799fe9b3848dbe2c211d4b231032b81e
- Required behavior: when Web reopens any persisted dynamic Team root, the resume must use Team glue `agentSetup()` so all `team_*` tools are re-registered.
- Observed public behavior: upstream SessionController composes the ordinary preset and directly calls `ctx.agents.resume({ resumeSessionId, setup: composition.setup })`; setup is caller-selected and no downstream Team callback is consulted.
- Minimal reproduction: persist a Team root, stop host, restart with same DSH_HOME, invoke ordinary Web session open for the root; the controller path above resumes with ordinary composition and Team glue is not called.
- Affected invariant: restart/reopen of every persisted Team root preserves Team setup and complete Team tool registration.
- Possible upstream generic seam proposal: public session-resume setup middleware/ownership resolver (e.g. a registered `SessionResumeSetupResolver` consulted by SessionController before `ctx.agents.resume`), or a public session-to-composition ownership registry. This proposal is not implemented here.

## Scope decision

Per the task instruction and CORE PATCH BUDGET = 0, implementation and real restart/reopen regression test are stopped. No upstream source was modified; no private API was imported; no workaround or manual re-setup is claimed.
