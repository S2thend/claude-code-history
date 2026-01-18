# Implementation Plan: Enhanced List Command with Project Details

**Branch**: `004-list-project-details` | **Date**: 2025-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-list-project-details/spec.md`

## Summary

Enhance the `cch list` command to display full project directory paths (replacing the current project-name-only column) and add a git branch column. The parser already extracts `gitBranch` from session metadata; this feature extends `SessionSummary` to include it and updates the table formatter to display both new columns.

## Technical Context

**Language/Version**: TypeScript 5.3+ with strict mode (ES2022 target)
**Primary Dependencies**: Commander.js (CLI), Node.js built-ins (fs, path, readline)
**Storage**: Reads Claude Code JSONL session files from `~/.claude/projects/`
**Testing**: Vitest for unit and integration tests
**Target Platform**: Cross-platform CLI (macOS, Windows, Linux)
**Project Type**: Single project with library-first architecture (src/lib/, src/cli/)
**Performance Goals**: List command should handle 1000+ sessions without noticeable delay
**Constraints**: Table output must fit 80-120 column terminals
**Scale/Scope**: Extends existing list command; 4 files modified, ~50-100 lines changed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ PASS | Enhances existing CLI command; JSON output supported |
| II. Non-Destructive Operations | ✅ PASS | Read-only operation; no data modification |
| III. Cross-Platform Compatibility | ✅ PASS | Path handling uses existing platform-agnostic functions |
| IV. Library-First Architecture | ✅ PASS | Type change in lib layer; display logic in cli layer |
| V. Data Fidelity | ✅ PASS | Exposes existing data; no transformation loss |

**Gate Result**: PASS - All principles satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-list-project-details/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── types.ts         # SessionSummary type (add gitBranch field)
│   └── session.ts       # buildSessionSummary function (include gitBranch)
└── cli/
    └── formatters/
        └── table.ts     # formatSessionTable (replace PROJECT with PATH, add BRANCH)

tests/
├── unit/
│   └── cli/
│       └── formatters/
│           └── table.test.ts  # Update tests for new columns
└── integration/
    └── cli/
        └── list.test.ts       # Integration tests for list command
```

**Structure Decision**: Existing single-project structure preserved. Changes confined to 4 source files with corresponding test updates.

## Complexity Tracking

> No violations to justify - all changes align with constitution principles.

N/A
