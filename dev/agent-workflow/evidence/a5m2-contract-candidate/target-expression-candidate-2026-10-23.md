# MINIMAL STRICT TARGET-EXPRESSION CANDIDATE (center, per root 18:07)

Technical implementation completion. Adds NO permission, NO scope, NO relaxed denial.
No any/object escape. Every value stays INSIDE targetManifest/fingerprint (no move-out).
No unknown-variant fallback (the round-4 signed own-key law already denies unknown values).
Scope note per root 18:11: unblocking this grammar gate does NOT equal wiring —
production-reachable assembly in agent-bindings/team-tool-plane is separate, owned by
the two wire owners in their isolated trees (root direct-dispatched).

## 1) M0-required fields and REAL legal values (measured, not designed)

B-SCHEDULE (records 31/32; measured by d675792d RUNNING the rev-2 adapter classify):
shared closed 11-leaf key set; 10/11 leaves are non-empty strings exactly as today.
ONLY taskId carries two real legal shapes:
  - null — schedule-list always; schedule-delete when the id-law refuses the id
  - the exact validated id string — admitted delete only
Never empty string, never whitespace, never object/array.

B-SESSION-QUERY (rev-4; measured by 00270f41 through classify AND the production
lossless gate at pa-control-bridge.ts:459/:467):
  - callerWorkspaceCwd = string | null (null iff caller cwd absent — verified via classify)
  - disclosures = possibly-EMPTY ARRAY OF STRINGS (law sentences)
  - maxSearchResults = nonNegativeInt PRESENT ONLY on search-class rows; the
    always-present member is undefined on the three always-mount rows, and undefined
    CANNOT PASS THE LOSSLESS WALK AT ALL — so no kind can, and none should, express it.
    Grammar fix is NOT the mint fix (see 4).

## 2) CURRENT PARSER GAP (exact sites, packages/runtime/control/types.ts)

  :1178-1179  union = 'string' | 'boolean' | 'nonNegativeInt' | 'countsTriple' | 'obligations'
  :1375-1376  case 'string': typeof value === 'string' && value.length > 0

=> null has NO kind (B-SCHEDULE taskId; also G6 callerWorkspaceCwd).
=> string[] has NO kind (G6 disclosures).
=> per-row-group key-set difference is NOT expressible under one closed key set —
   the ALREADY-SIGNED round-4 variant grammar IS that expression
   (variant{leaf, by{adds, binds}}, own-key lookup, module-load guard); nothing new.
=> undefined members are NOT a grammar problem: the mint must OMIT the key
   (JSON-legal absence). Owner-side 1-line mint adjustment, routed to adapter owner
   8e6e7788 for approval — not a kind, not a rule.

## 3) MINIMAL STRICT VALIDATION DIFF (the whole of it: two union members + two cases)

Union (:1178-1179) becomes:

  export type PaFamilyTargetFieldKind =
    | 'string' | 'boolean' | 'nonNegativeInt' | 'countsTriple' | 'obligations'
    | 'nullableString' | 'stringArray'

Inside isPaFamilyTargetField (:1175) switch, add exactly:

    case 'nullableString': return value === null || (typeof value === 'string' && value.length > 0)
    case 'stringArray':    return Array.isArray(value) && value.every((item) => typeof item === 'string')

Strictness:
  - nullableString admits ONLY null or non-empty string (empty string still denies).
  - stringArray admits ONLY arrays whose every element is typeof string
    (empty array legal = the measured legal empty disclosures; any non-string element denies).
  - Both are scalar/array-of-scalar primitives. NO object escape, NO any,
    NO recursion into unbounded structures.

## 4) RESULTING RULES (all leaves ALREADY PRE-MINTED by the lanes; zero lane-side rework)

B-SCHEDULE: required { contract:'string', ownerKind:'string', ownerSessionId:'string',
  action:'string', taskId:'nullableString', revision:'string', timerNamespace:'string',
  timerEffect:'string', destinationSessionId:'string', destinationPath:'string',
  destinationWake:'string' }; currentFields ['ownerSessionId','destinationSessionId'].

B-SESSION-QUERY: required base { toolName:'string' (variant LEAF), operation:'string',
  portFamily:'string', portMethod:'string', effectiveTargetSessionId:'string',
  callerWorkspaceCwd:'nullableString', disclosures:'stringArray' };
  currentFields = pure-data subset (toolName, operation, portFamily, portMethod).
  Variant groups keyed by toolName value carry per-row adds — e.g. the search group
  adds maxSearchResults:'nonNegativeInt'; the own-key closed law makes every
  cross-group key an EXTRA KEY denial. The mint OMITS undefined members (owner-side
  1-line adjustment, routed to 8e6e7788; NOT this diff).

## 5) DENIAL-SURFACE CHECK (nothing weakens)

Closed key-set law, extra-key denial, absent-field denial, binds (exact roundtrip /
list-law literals), module-load guard: ALL unchanged. The two kinds widen VALUE
admission ONLY for values M0 already freezes as legal. A claim still needs:
registered family + exact key set + kind-valid values + full target+args fingerprint
+ PA walk. No approval path is weakened; no scope or effect is added.
