/**
 * host-loader.mjs — put the rc.5 lane's ONE resolution hook in a BOOTED HOST.
 *
 * WHY THIS FILE EXISTS. `scripts/run-tests-hooks.mjs` redirects every bare
 * `@deepseek-ai/*` import made by TEAM code into the selected host tree when
 * `TEAM_TEST_HOST=next`. In-process lanes register it themselves
 * (`packages/runtime/test/*.test.mjs` call `module.register`). A LIVE driver is
 * different: the product runs inside a child `dsh web` process, whose own
 * resolver knows only the host tree. Without this registration the product
 * dist would resolve the repo's `node_modules/@deepseek-ai/*` (0.2.0-rc.2)
 * while the host runs 0.2.2-rc.5 — two host generations in one process, the
 * exact false green `tests/next-host/host-select.mjs` exists to prevent.
 *
 * HOW IT IS USED. `DshInstance` adds `--import <this file>` to the child's
 * `NODE_OPTIONS` ONLY when `TEAM_TEST_HOST=next` (the env travels with the
 * child). The module registers the SAME hook file — no second resolver, no
 * copied rewrite table.
 *
 * INERT BY DEFAULT: with the variable unset `DshInstance` never adds the flag,
 * so this file is not loaded and every legacy boot is byte-for-byte unchanged.
 *
 * @module tests/next-host/host-loader
 */
import { register } from 'node:module'

register('../../scripts/run-tests-hooks.mjs', import.meta.url)
