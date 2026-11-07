import { parseBlueprint } from '../../../../packages/runtime/dist/packages/domain/blueprint/src/index.js'
import { deriveProductRealmPlanFromBlueprint, createProductRealmProvider } from '../../../../packages/runtime/dist/packages/runtime/team-services/src/product-assembly.js'
const ws = '/tmp/recon-plan-ws'
const binding = { owner: 'dsh.fs', name: 'grep', authorization: 'allow', io: { read: { mode: 'restricted', allow: [ws], ask: [], deny: [] }, write: { mode: 'all', deny: [] }, network: { mode: 'allow' } }, execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' } }
const doc = { schemaVersion: 4, blueprintId: 'team.a5sf.lm.main', revision: '1', leader: { templateId: 'leader', persona: 'x' }, members: [{ templateId: 'worker', persona: 'x' }], requirements: [], teamEnvelope: { allow: [], deny: [] }, memberEnvelopes: [], policyStates: [], permissionMutationEnvelope: { rules: [] }, teamHardEnvelope: { rules: [] }, metadata: {}, memberIoCeilings: [{ templateId: 'worker', io: { read: { mode: 'restricted', allow: [ws], ask: [], deny: [] }, write: { mode: 'restricted', allow: [ws], ask: [], deny: [] }, network: { mode: 'allow' } } }], toolBindings: [binding] }
const parsed = parseBlueprint(`---\n${JSON.stringify(doc)}\n---\n`)
const plan = deriveProductRealmPlanFromBlueprint({ blueprint: parsed.blueprint ?? parsed, authority: { revision: 'a4:overlay-generation:1', admitted: true }, instanceGenerations: { worker: 1 }, templateIds: ['worker'] })
console.log('plan keys', Object.keys(plan))
console.log('member keys', Object.keys(plan.members[0]))
console.log('member', JSON.stringify(plan.members[0]).slice(0, 900))
const provider = createProductRealmProvider(plan)
const answer = provider.compiledFor({ instanceId: 'inst-x', templateId: 'worker' })
console.log('answer keys', Object.keys(answer))
console.log('answer', JSON.stringify(answer).slice(0, 900))
