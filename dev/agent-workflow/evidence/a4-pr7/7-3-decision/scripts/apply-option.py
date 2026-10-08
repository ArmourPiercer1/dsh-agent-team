#!/usr/bin/env python3
"""Deterministic probe applier. ALWAYS starts from the pinned base commit, so a
probe can never half-apply on top of a previous probe (that happened once:
`git checkout <file>` restores HEAD, and HEAD contained the previous option).

usage: apply-option.py <base-sha> <flip|A|B|C|D>
"""
import subprocess, sys

BASE, OPTION = sys.argv[1], sys.argv[2]
subprocess.run(["git", "checkout", BASE, "--", "packages"], check=True)

def patch(path, pairs, required=True):
    s = open(path).read()
    for old, new in pairs:
        if old not in s:
            if required:
                raise SystemExit(f"ANCHOR MISSING in {path}: {old!r}")
            continue
        s = s.replace(old, new, 1)
    open(path, "w").write(s)

GATES = {
    "compat": ("packages/runtime/compatibility/blueprint.ts",
               "  if (blueprint.schemaVersion === 2 && blueprint.teamRequirements !== undefined) {"),
    "scope":  ("packages/runtime/requirements/scope-requirements.ts",
               "  if (blueprint.schemaVersion === 2) {"),
    "pre":    ("packages/runtime/requirements/creation-preflight.ts",
               "  if (blueprint.schemaVersion === 2) {"),
    "gate":   ("packages/runtime/admission/requirement-gate.ts",
               "  if (blueprint.schemaVersion === 2) {"),
    "act":    ("packages/runtime/activation/provider.ts",
               "        blueprint.schemaVersion === 2 ? scopeInputs.templates[createTemplateId] : undefined"),
}

# --- the settled mechanical flip (both options need it) ------------------------
patch("packages/domain/blueprint/src/schema.ts",
      [("export const SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS: readonly number[] = [1, 2, 3]",
        "export const SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS: readonly number[] = [3]")])
patch("packages/domain/blueprint/src/types.ts",
      [("  readonly schemaVersion: 1 | 2 | 3", "  readonly schemaVersion: 3")])

if OPTION == "flip":
    pass
elif OPTION == "A":  # Relax: version-agnostic
    patch(GATES["compat"][0], [(GATES["compat"][1], "  if (blueprint.teamRequirements !== undefined) {")])
    for k in ("scope", "pre", "gate"):
        patch(GATES[k][0], [(GATES[k][1], "  {")])
    patch(GATES["act"][0], [(GATES["act"][1], "        scopeInputs.templates[createTemplateId]")])
elif OPTION == "B":  # Retire: branches die, parser still ACCEPTS the grammar
    patch(GATES["compat"][0], [(GATES["compat"][1], "  if (false && blueprint.teamRequirements !== undefined) {")])
    for k in ("scope", "pre", "gate"):
        patch(GATES[k][0], [(GATES[k][1], "  if (false) {")])
    patch(GATES["act"][0], [(GATES["act"][1], "        undefined")])
elif OPTION == "C":  # Forbid: parser accepts, validation refuses at v3
    v = "packages/domain/blueprint/src/validate.ts"
    s = open(v).read()
    anchor = "  if (schemaVersion === 3) {"
    if anchor not in s:
        raise SystemExit("C anchor missing: the v3 required-field block moved")
    guard = """  if (schemaVersion === 3) {
    const forbidden = ['teamRequirements', ...[]]
    for (const key of forbidden) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `field $.${key} is a schemaVersion 2 construct: the §E.2 structured requirement grammar is not part of v3; move it to the flat requirements list or keep the document at schemaVersion 2`,
        )
      }
    }
  }
  if (schemaVersion === 3) {"""
    s = s.replace(anchor, guard, 1)
    open(v, "w").write(s)
elif OPTION == "D":  # Un-nameable: the v3 closed field set drops the grammar
    sc = "packages/domain/blueprint/src/schema.ts"
    patch(sc, [
        ("export const BLUEPRINT_TOP_LEVEL_FIELDS_V3: readonly string[] = [\n  ...BLUEPRINT_TOP_LEVEL_FIELDS_V2,\n  'teamHardEnvelope',\n]",
         "export const BLUEPRINT_TOP_LEVEL_FIELDS_V3: readonly string[] = [\n  ...BLUEPRINT_TOP_LEVEL_FIELDS,\n  'teamHardEnvelope',\n]"),
        ("export const BLUEPRINT_TEMPLATE_FIELDS_V2: readonly string[] = [...BLUEPRINT_TEMPLATE_FIELDS, 'requirements']",
         "export const BLUEPRINT_TEMPLATE_FIELDS_V2: readonly string[] = [...BLUEPRINT_TEMPLATE_FIELDS, 'requirements']\nconst BLUEPRINT_TEMPLATE_FIELDS_V3: readonly string[] = BLUEPRINT_TEMPLATE_FIELDS"),
    ])
    v = "packages/domain/blueprint/src/validate.ts"
    s = open(v).read()
    old = "    schemaVersion === 1 ? BLUEPRINT_TEMPLATE_FIELDS : BLUEPRINT_TEMPLATE_FIELDS_V2"
    if old not in s:
        raise SystemExit("D template-fields anchor moved")
    s = s.replace(old, "    schemaVersion === 1 || schemaVersion === 3\n      ? BLUEPRINT_TEMPLATE_FIELDS\n      : BLUEPRINT_TEMPLATE_FIELDS_V2", 1)
    old2 = "    schemaVersion >= 2 ? takeArray(record, 'requirements', path) : undefined"
    if old2 not in s:
        raise SystemExit("D per-template takeArray anchor moved")
    s = s.replace(old2, "    schemaVersion === 2 ? takeArray(record, 'requirements', path) : undefined", 1)
    old3 = "    schemaVersion >= 2 ? takeArray(record, 'teamRequirements', '$')"
    if old3 in s:
        s = s.replace(old3, "    schemaVersion === 2 ? takeArray(record, 'teamRequirements', '$')", 1)
    open(v, "w").write(s)
    # the BLUEPRINT_TEMPLATE_FIELDS_V3 symbol is declared to document intent
    s = open(v).read()
    if "schemaVersion === 1 || schemaVersion === 3\n      ? BLUEPRINT_TEMPLATE_FIELDS" in s:
        open(v, "w").write(s)
else:
    raise SystemExit(f"unknown option {OPTION}")

print(f"applied {OPTION} from base {BASE}")
