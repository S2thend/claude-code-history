# Implementation Plan: Complete Token Statistics

**Branch**: `005-complete-token-stats` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-complete-token-stats/spec.md`

## Summary

Add complete token statistics display with all four token types (input, output, cache read, cache creation) at both per-message and session-aggregate levels. The core library already extracts all four fields; this feature adds aggregation functions to the lib layer and display formatting to the CLI layer.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled
**Primary Dependencies**: Commander.js (CLI), Node.js built-ins (fs, path, readline)
**Storage**: N/A (reads from Claude Code's `~/.claude/projects/` via existing lib layer)
**Testing**: Vitest for unit and integration tests
**Target Platform**: Node.js 20+ (macOS, Linux, Windows)
**Project Type**: Single project with lib/cli separation
**Performance Goals**: N/A (read-only aggregation of existing data)
**Constraints**: Linting (Prettier), type checking (strict mode), all tests must pass
**Scale/Scope**: Sessions with 1-1000+ messages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Adding `--stats` flag to list, token footer to view, JSON support |
| II. Non-Destructive Operations | ✅ Pass | Read-only aggregation, no data modification |
| III. Cross-Platform Compatibility | ✅ Pass | Uses existing platform-agnostic lib layer |
| IV. Library-First Architecture | ✅ Pass | Aggregation in lib, display in CLI |
| V. Data Fidelity | ✅ Pass | Preserves exact token counts from JSONL |

All gates pass. No complexity justification required.

## Project Structure

### Documentation (this feature)

```text
specs/005-complete-token-stats/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
├── lib/                      # Core library layer (token aggregation lives here)
│   ├── types.ts             # TokenUsage, SessionTokenStats types
│   ├── parser.ts            # transformTokenUsage() - already extracts 4 fields
│   ├── session.ts           # getSession(), listSessions() - add token stats
│   ├── stats.ts             # NEW: Token aggregation functions
│   └── index.ts             # Export new types and functions
│
└── cli/                      # CLI UI layer (display only)
    ├── commands/
    │   ├── list.ts          # Add --stats flag
    │   └── view.ts          # Token footer display
    └── formatters/
        ├── session.ts       # formatTokenSummary() for view footer
        └── table.ts         # Token columns for list --stats

tests/
├── unit/
│   ├── stats.test.ts        # NEW: Token aggregation unit tests
│   └── cli/formatters/
│       └── session.test.ts  # Update for token footer
└── integration/
    ├── get-session.test.ts  # Verify token data in session
    └── cli/
        ├── view.test.ts     # Token footer integration
        └── list.test.ts     # --stats flag integration
```

**Structure Decision**: Follows existing library-first architecture. New `stats.ts` module in lib for aggregation logic; CLI only formats and displays.

## Complexity Tracking

> No violations. All changes align with constitution principles.

