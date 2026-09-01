S5A node brief (base 24c4f18, S1A table)
|id|name|S1A status|owner|factory|duty|
|-|-|-|-|-|-|
|A01|plugin|MODULE_ONLY_NOT_WIRED|S5|R/src/plugin/host::apply|wire backend surfaces|
|A02|domain|HARNESS_ONLY|S5|S/repositories/team-domain::createTeamDomain|open over storage seam|
|A03|blueprint|HARNESS_ONLY|S5|D/blueprint/src/catalog::createBlueprintCatalog|build from blueprint|
|A04|intent|MODULE_ONLY_NOT_WIRED|S5|Rm/src/contracts/catalog::intent.probe|expose via intent.probe|
|A05|fresh-root|HARNESS_ONLY|S5|R/root-binding/fresh-root::bindFreshTeamRoot|record first, mint leader|
|A06|cold-root|HARNESS_ONLY|S5|R/root-binding/cold-root::rehydrateColdTeamRoot|rehydrate, zero writes|
|A07|leader|HARNESS_ONLY|S5|C/src/identity::leaderMemberIdentityOf|identity; root mints row|
|A08|new-member|HARNESS_ONLY|S5|R/member-residency/fresh-member::createFreshMember|create, record first|
|A09|cold-member|HARNESS_ONLY|S5|R/member-residency/cold-member::rehydrateColdMember|rehydrate, resume agent|
|A10|binder|HARNESS_ONLY|S5|R/agent-setup/binder/binder::TeamAgentBinder|mount 3 overlay slots|
|A11|persona|HARNESS_ONLY|S5|R/agent-setup/persona/adapter::createPersonaOverlaySlot|persona slot for binder|
|A12|model|HARNESS_ONLY|S5|R/agent-setup/model/overlay::TeamModelSelectionAdapter|wire durable source|
|A13|cap-slot|HARNESS_ONLY|S5|R/agent-setup/capability/slot::createCapabilityOverlaySlot|re-evaluate at boundary|
|A14|prober|MODULE_ONLY_NOT_WIRED|S5|R/compatibility/probe::createCompatibilityProber|prober into authority|
|A15|admission|HARNESS_ONLY|S5|R/admission/gate::enforceCompatibilityGate|gate per action|
|A16|activate|HARNESS_ONLY|S5|R/activation/provider::createActivationProvider|create/resume agents|
|A17|facade|HARNESS_ONLY|S5|R/action-router/router::createTeamRuntime|construct the facade|
|A18|input|HARNESS_ONLY|S5|R/messaging/types::SessionInputPort|deliver to live agents|
|A19|settle|MODULE_ONLY_NOT_WIRED|S5|D/lifecycle/src/transitions::applyLifecycleOperation|settle before archive|
|A20|lifecycle|MODULE_ONLY_NOT_WIRED|S5|R/lifecycle/index::createLifecycleService|run lifecycle ops live|
|A21|commit|MODULE_ONLY_NOT_WIRED|S5|R/lifecycle/resolve::commitDurable|single CAS commit|
|A22|mutation|MODULE_ONLY_NOT_WIRED|S5|R/mutation/service::MutationService|apply mutations live|
|A23|boundary|MODULE_ONLY_NOT_WIRED|S5|R/mutation/service::MutationService + R/policy-adapter::assembleEffectivePolicyInput|future boundary live|
|A24|messaging|HARNESS_ONLY|S5|R/messaging/coordinator::createMessagingCoordinator|route messages to agents|
|A25|control|HARNESS_ONLY|S5|R/control/service::createControlService|request/resolve control|
|A26|activity|HARNESS_ONLY|S5|R/activity/ledger::createActivityLedger|record fenced activity|
|A27|fork|MODULE_ONLY_NOT_WIRED|S5|R/fork-reconciliation/reconciler::reconcileForkSidecar|reconcile on rehydrate|
|A28|handoff|MODULE_ONLY_NOT_WIRED|S5|R/handoff/service::createHandoffService|run handoff live|
|A29|legacy|HARNESS_ONLY|S5|L/session-reader/inspect::inspectLegacyTeam|expose legacy reads|
|A30|project|MODULE_ONLY_NOT_WIRED|S6|R/projection/service::createProjectionService|EXPLICIT S6 seam (fail-closed)|
|A31|remote|MODULE_ONLY_NOT_WIRED|S6|Rm/src/handlers/register::registerRemoteHandlers|EXPLICIT S6 seam (fail-closed)|
|A32|push|MODULE_ONLY_NOT_WIRED|S6|Rm/src/push/index|EXPLICIT S6 seam (fail-closed)|
|A33|paging|MODULE_ONLY_NOT_WIRED|S6|Rm/src/push/ledger-page::createLedgerPageTracker|EXPLICIT S6 seam (fail-closed)|
|A34|principal|MISSING|S6|none; client Rm/src/contracts/params::parseRemoteCaller|EXPLICIT S6 seam (fail-closed)|
- paths: packages/ relative, no .ts; R=runtime Rm=remote S=storage D=domain C=contracts L=legacy
- S6 = A30-A34 (CR-4 principal, CR-12 projection/remote); rest S5 (CR-6); zero PRODUCTION.
- Settlement: unique owner D/lifecycle/src/transitions::applyLifecycleOperation; sole consumer R/lifecycle/archive.
- Compat: R/admission/gate + R/activation/provider consume createCompatibilityAuthority.