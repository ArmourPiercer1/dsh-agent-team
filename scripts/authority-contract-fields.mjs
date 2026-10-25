#!/usr/bin/env node
// The six current_contract fields of the legacy authority block — the single list,
// shared read-only by consumers and the candidate source helper.
//
// Extracted verbatim out of gen-current-state.mjs so scripts/authority-candidate-source.mjs
// can share it WITHOUT importing the consumer module (no reverse dependency, no ESM
// cycle, no second list). gen-current-state.mjs re-exports the same binding under its
// original name, so every existing importer keeps working unchanged.
export const LEGACY_MIRROR_KEYS = ['phase_id', 'active_plan', 'backlog', 'matrix', 'baseline', 'baseline_collected'];
