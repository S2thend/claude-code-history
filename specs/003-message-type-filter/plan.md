# Implementation Plan: Message Type Filter

**Branch**: `003-message-type-filter` | **Date**: 2026-01-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-message-type-filter/spec.md`

## Summary

Add a `--only <type>` option to the `cch view` command that filters displayed messages by type (user, assistant, tool, thinking, error). The filter leverages the existing structured type system in the library layer and integrates with the CLI's view command and session formatter.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled
**Primary Dependencies**: Commander.js (CLI framework), Node.js built-ins
**Storage**: N/A (reads from Claude Code's `~/.claude/projects/` via lib layer)
**Testing**: Vitest for unit and integration testing
**Target Platform**: Cross-platform (macOS, Windows, Linux)
**Project Type**: Single project (library + CLI)
**Performance Goals**: Filter 100+ message session in under 1 second
**Constraints**: Non-destructive read operations only
**Scale/Scope**: Single command enhancement, ~5 filter types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | `--only <type>` follows existing option patterns; supports JSON output |
| II. Non-Destructive Operations | ✅ Pass | Read-only filtering at display time |
| III. Cross-Platform Compatibility | ✅ Pass | No platform-specific code required |
| IV. Library-First Architecture | ✅ Pass | Filter logic in lib, CLI consumes it |
| V. Data Fidelity | ✅ Pass | Filtering doesn't modify source data |

**Technical Standards Compliance**:
- ESLint/Prettier enforced ✅
- JSDoc for public APIs ✅
- Vitest testing ✅
- Minimal dependencies (no new deps needed) ✅

## Project Structure

### Documentation (this feature)

```text
specs/003-message-type-filter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── cli/
│   ├── commands/
│   │   └── view.ts      # Add --only option here
│   ├── formatters/
│   │   └── session.ts   # Add filter application here
│   └── utils/
│       └── config.ts    # Add filter type validation
└── lib/
    ├── types.ts         # Add MessageTypeFilter type
    ├── session.ts       # Add filterMessages function
    └── index.ts         # Export new types/functions

tests/
├── integration/
│   └── cli/
│       └── view.test.ts # CLI integration tests for --only
└── unit/
    ├── cli/
    │   └── formatters/
    │       └── session.test.ts  # Filter formatting tests
    └── lib/
        └── session.test.ts      # filterMessages unit tests
```

**Structure Decision**: Single project structure following existing patterns. Filter logic added to lib layer (`filterMessages` function), consumed by CLI layer (`view` command with `--only` option).

## Complexity Tracking

No violations. Feature adds minimal complexity:
- One new CLI option
- One new library function
- One new type definition
