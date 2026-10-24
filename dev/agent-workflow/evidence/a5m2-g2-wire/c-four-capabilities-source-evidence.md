# A5M2 C-item: the four MUST-DELIVER capabilities — real faces / source evidence (2026-10-26)

Verdict: all four (outputSchema / depthLimit / toolFilter / persona) are REALIZED NATIVELY
**inside the child creation window**, and the governed consumer chain reaches the child ONLY
through the deliver consumer, which carries none of those faces. Evidence (pristine
tests/deepseek-harness-test-use, baseline 639ed01539; and this lane):

1. GATE + REQUEST LAW (why false is currently load-bearing):
   - packages/subagent/subagent/src/index.ts :556-563 (start request: label/prompt/parent/
     signal + optional capability fields; assertSubagentMaxDepth :562, assertObjectJsonSchema
     on outputSchema :563); :644-660 assertCapabilities — a request touching a capability the
     provider lacks throws UNSUPPORTED_CAPABILITY BEFORE the provider runs.
2. THE NATIVE REALIZATION FACES (what "real" means):
   - packages/subagent/subagent-spawn-in-process/src/index.ts :36-39: outputSchema = "the
     scoped structured runtime"; toolFilter/persona = "scoped restrict() and a scoped shadowing
     persona section, APPLIED IN THE CHILD'S CREATION WINDOW"; depth :36 "(the provider
     constructs the child, so it can enforce a recursion cap)"; capabilities all true :44-47.
   - same file :196/:202/:247: maxDepth is the CONSTRUCTING provider's volatile config read at
     spawn — enforcement point = construction.
3. WHAT OUR CHAIN ACTUALLY CARRIES (no such faces):
   - workDelivery.deliver args (this lane, agent-bindings workDelivery consumer): {rootSessionId,
     instanceId, childSessionId, requestToken, prompt, attachedContext?, signal?, recovery?} —
     no schema/restrict/persona/depth field; settlement = the frozen WorkDeliveryResult body.
   - childFactory.createChildSession accepted request: {rootSessionId, instanceId, templateId,
     workspace?} only (agent-bindings childFactory; the interface card pinned extras as
     P_B_ORCH_CHAIN_FIELD_UNSUPPORTED).
   - ralph's requireFreshProvider: packages/workflow/tool-ralph/src/index.ts :219 (name-only
     fresh-provider check) at :443 — checks presence, then the ENGINE gate (2) rejects any
     schema-carrying agent() against an outputSchema:false provider: honest early refusal.
4. CONCLUSION (not an idle stop; typed refusal = tourniquet, explicitly NOT delivery):
   the four faces belong to the child creation/setup window; per the 2026-10-26 A ruling that
   window + the internal identity binding are the root-owned shared identity contract. When it
   exposes (a) a structured-runtime or schema-constrained output face, (b) a construction-time
   depth cap, (c) a scoped restrict face, (d) a persona-section face, the provider flips each
   capability TRUE TOGETHER with its implementation in the same commit — never before
   (capability=true without the face is the forbidden fake-open).
