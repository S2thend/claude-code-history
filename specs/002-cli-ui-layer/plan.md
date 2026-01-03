# Implementation Plan: CLI UI Layer

**Branch**: `002-cli-ui-layer` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-cli-ui-layer/spec.md`

## Summary

Implement a command-line interface layer (`src/cli/`) that consumes the existing library (`src/lib/`) to provide user-facing commands for browsing, searching, exporting, and migrating Claude Code conversation history. The CLI follows the `cch <command> [options]` pattern with subcommands for list, view, search, export, and migrate operations.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode (matching lib layer)
**Primary Dependencies**: Commander.js (CLI framework), chalk (terminal colors - optional), existing `src/lib/` exports
**Storage**: N/A (reads from Claude Code's `~/.claude/projects/` via lib layer)
**Testing**: Vitest (matching lib layer), integration tests for CLI commands
**Target Platform**: macOS, Windows, Linux (Node.js 20+)
**Project Type**: Single project (adding `src/cli/` alongside existing `src/lib/`)
**Performance Goals**: 95% of commands complete within 2 seconds for <1000 sessions (SC-008)
**Constraints**: Non-destructive operations by default, paginated output by default with `--full` flag
**Scale/Scope**: Single-user CLI, typical session counts <1000

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ PASS | Commands follow `cch <command> [options]`; stdout/stderr separation; `--json` output planned; meaningful exit codes |
| II. Non-Destructive Operations | ✅ PASS | All read operations (list, view, search, export) are non-destructive; migrate uses copy by default per lib layer |
| III. Cross-Platform Compatibility | ✅ PASS | Uses lib layer's platform detection; no hardcoded paths in CLI |
| IV. Library-First Architecture | ✅ PASS | CLI layer consumes lib layer; all business logic remains in lib; CLI handles only parsing/formatting |
| V. Data Fidelity | ✅ PASS | Export uses lib layer's JSON/Markdown export which preserves all data |

**Gate Result**: PASS - No violations. Proceed to Phase 0.

### Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ PASS | Contract defines `cch <cmd>` pattern; global `--json` flag; exit codes 0-4; `--help` for all commands |
| II. Non-Destructive Operations | ✅ PASS | migrate defaults to `copy` mode; all other commands are read-only |
| III. Cross-Platform Compatibility | ✅ PASS | Uses system pager (less/more); respects PAGER env var; no hardcoded paths |
| IV. Library-First Architecture | ✅ PASS | CLI only handles parsing/formatting; all logic in lib layer |
| V. Data Fidelity | ✅ PASS | Export delegates to lib's export functions which preserve all data |

**Post-Design Gate Result**: PASS - Design artifacts align with constitution.

## Project Structure

### Documentation (this feature)

```text
specs/002-cli-ui-layer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (CLI contract - command specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── lib/                 # Existing library layer (unchanged)
│   ├── index.ts
│   ├── types.ts
│   ├── config.ts
│   ├── platform.ts
│   ├── parser.ts
│   ├── session.ts
│   ├── search.ts
│   ├── export.ts
│   ├── migrate.ts
│   └── errors.ts
└── cli/                 # NEW: CLI layer
    ├── index.ts         # Entry point, command registration
    ├── commands/        # Command implementations
    │   ├── list.ts
    │   ├── view.ts
    │   ├── search.ts
    │   ├── export.ts
    │   └── migrate.ts
    ├── formatters/      # Output formatting
    │   ├── table.ts     # Table formatting for list
    │   ├── session.ts   # Session view formatting
    │   ├── search.ts    # Search result formatting
    │   └── pager.ts     # Paginated output handling
    └── utils/           # CLI utilities
        ├── config.ts    # CLI config (env vars, global options)
        ├── errors.ts    # Error formatting
        └── output.ts    # stdout/stderr helpers

tests/
├── contract/            # Existing
├── integration/         # Existing + new CLI integration tests
│   └── cli/             # NEW: CLI-specific integration tests
│       ├── list.test.ts
│       ├── view.test.ts
│       ├── search.test.ts
│       ├── export.test.ts
│       └── migrate.test.ts
└── unit/                # Existing + new CLI unit tests
    └── cli/             # NEW: CLI-specific unit tests
        ├── formatters/
        └── utils/
```

**Structure Decision**: Extending the existing single-project structure by adding `src/cli/` as a peer to `src/lib/`, following the Library-First Architecture principle. The CLI depends on the lib, not vice versa.

## Complexity Tracking

> No constitution violations requiring justification.

N/A - All gates pass without violations.
