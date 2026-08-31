// G8-R4 §5 dry test: import the exact graph row.mjs + client-e2e.mjs use,
// through the same ts-loader, in a standalone node process (no host boot).
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

let root = HERE
for (let i = 0; i < 12; i++) {
  if (existsSync(join(root, 'packages', 'remote', 'src', 'index.ts'))) break
  root = join(root, '..')
}
if (!existsSync(join(root, 'packages', 'remote', 'src', 'index.ts'))) {
  console.error('DRYFAIL worktree root not found from', HERE)
  process.exit(2)
}
const pkg = (rel) => pathToFileURL(join(root, rel)).href
console.log('DRYTEST root', root)

const C = await import(pkg('packages/contracts/src/index.js'))
const BP = await import(pkg('packages/domain/blueprint/src/index.js'))
const CD = await import(pkg('packages/domain/compatibility/src/index.js'))
const SS = await import(pkg('packages/storage/schema/index.js'))
const SR = await import(pkg('packages/storage/repositories/index.js'))
const RB = await import(pkg('packages/runtime/root-binding/index.js'))
const BD = await import(pkg('packages/runtime/agent-setup/binder/index.js'))
const PJ = await import(pkg('packages/runtime/projection/index.js'))
const CR = await import(pkg('packages/runtime/compatibility/index.js'))
const RM = await import(pkg('packages/remote/src/index.js'))
const P8T4 = await import(pkg('packages/remote/test/p8t4-test-client.ts'))

let failures = 0
const check = (label, actual, expect) => {
  const pass = expect === undefined ? actual !== undefined : actual === expect
  if (!pass) failures += 1
  console.log(`${pass ? 'OK      ' : 'MISMATCH'} ${label} = ${actual === undefined ? String(actual) : typeof actual === 'object' ? JSON.stringify(actual).slice(0, 80) : String(actual)}`)
}
const fn = (v) => (typeof v === 'function' ? 'function' : typeof v)

check('C.parseTeamProjection', fn(C.parseTeamProjection), 'function')
check('C.createMemberInstanceRecord', fn(C.createMemberInstanceRecord), 'function')
check('C.createTeamSessionRecord', fn(C.createTeamSessionRecord), 'function')
check('C.parseSessionBinding', fn(C.parseSessionBinding), 'function')
check('C.parseTeamSessionId', fn(C.parseTeamSessionId), 'function')
check('C.parseRootSessionId', fn(C.parseRootSessionId), 'function')
check('C.LEADER_INSTANCE_ID', C.LEADER_INSTANCE_ID, 'inst-leader')
check('BP.createBlueprintCatalogFromSource', fn(BP.createBlueprintCatalogFromSource), 'function')
check('BP.toBlueprintSnapshotRef', fn(BP.toBlueprintSnapshotRef), 'function')
check('CD.parseEnvironmentFact', fn(CD.parseEnvironmentFact), 'function')
check('CD.parseRequirements', fn(CD.parseRequirements), 'function')
check('CD.evaluateCompatibility', fn(CD.evaluateCompatibility), 'function')
check('SS.TEAM_DOMAIN_SCHEMA_VERSION', typeof SS.TEAM_DOMAIN_SCHEMA_VERSION, 'number')
check('SS.LEDGER_SEQUENCE_COUNTER_KEY', typeof SS.LEDGER_SEQUENCE_COUNTER_KEY, 'string')
check('SS.LEDGER_SEQUENCE_COUNTER_KIND', typeof SS.LEDGER_SEQUENCE_COUNTER_KIND, 'string')
check('SS.serializeLedgerSequenceCounter', fn(SS.serializeLedgerSequenceCounter), 'function')
check('SS.deserializeLedgerSequenceCounter', fn(SS.deserializeLedgerSequenceCounter), 'function')
check('SS.parseGovernanceOverride', fn(SS.parseGovernanceOverride), 'function')
check('SS.parseOperationRecord', fn(SS.parseOperationRecord), 'function')
check('SR.createTeamDomain', fn(SR.createTeamDomain), 'function')
check('SR.openTeamDomain', fn(SR.openTeamDomain), 'function')
check('RB.bindFreshTeamRoot', fn(RB.bindFreshTeamRoot), 'function')
check('RB.createTeamDomainWritePort', fn(RB.createTeamDomainWritePort), 'function')
check('BD.createTeamDomainReadHandle', fn(BD.createTeamDomainReadHandle), 'function')
check('BD.TeamAgentBinder', fn(BD.TeamAgentBinder), 'function')
check('PJ.createProjectionService', fn(PJ.createProjectionService), 'function')
check('CR.compatibilityRequirementsOf', fn(CR.compatibilityRequirementsOf), 'function')
check('CR.CompatibilityError', fn(CR.CompatibilityError), 'function')
check('CR.COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING', typeof CR.COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING, 'string')
check('CR.COMPATIBILITY_ERROR_CODES.FATAL_NOT_ACKNOWLEDGABLE', typeof CR.COMPATIBILITY_ERROR_CODES.FATAL_NOT_ACKNOWLEDGABLE, 'string')
check('RM.REMOTE_CONTRACT_VERSION', RM.REMOTE_CONTRACT_VERSION, 1)
check('RM.registerRemoteHandlers', fn(RM.registerRemoteHandlers), 'function')
check('RM.PushTransportLossError', fn(RM.PushTransportLossError), 'function')
check('P8T4.createP8T4TestClient', fn(P8T4.createP8T4TestClient), 'function')

// Functional smoke: the bare-yaml path + blueprint bridge + counter codec
try {
  const yamlSource = readFileSync(join(HERE, 'blueprints', 'team.g8research.yaml'), 'utf8')
  const catalog = BP.createBlueprintCatalogFromSource({
    listSources: () => ['team.g8research'],
    readSource: (sourceName) => (sourceName === 'team.g8research' ? yamlSource : ''),
  })
  const bp = catalog.resolve('team.g8research', '1')
  const ref = BP.toBlueprintSnapshotRef(bp)
  const reqs = CD.parseRequirements(CR.compatibilityRequirementsOf(bp))
  check('smoke blueprint requirements', reqs.length, 2)
  check('smoke blueprint ref id', ref.blueprintId, 'team.g8research')
  const counterRaw = SS.serializeLedgerSequenceCounter({
    schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
    kind: SS.LEDGER_SEQUENCE_COUNTER_KIND,
    value: 41,
  })
  check('smoke counter round-trip', SS.deserializeLedgerSequenceCounter(counterRaw).value, 41)
} catch (err) {
  failures += 1
  console.log('MISMATCH smoke threw:', err && err.stack ? err.stack.split('\n').slice(0, 6).join(' | ') : String(err))
}

console.log(failures === 0 ? 'DRYTEST-PASS' : `DRYTEST-FAIL failures=${failures}`)
process.exit(failures === 0 ? 0 : 1)
