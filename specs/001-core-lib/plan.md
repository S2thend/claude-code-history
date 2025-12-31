# Implementation Plan: Core Library for Claude Code History

**Branch**: `001-core-lib` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-core-lib/spec.md`

## Summary

Implement the core library (`claude-code-history`) that provides programmatic access to Claude Code conversation history. The library exposes functions for listing, searching, exporting, and migrating sessions stored in JSONL format. This is the foundation layer that future CLI commands will consume.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled
**Primary Dependencies**: Node.js built-ins (fs, path, os, readline); minimal external deps
**Storage**: Read-only access to `~/.claude/` JSONL files (no database)
**Testing**: Vitest for unit and integration testing
**Target Platform**: Node.js 20+ on macOS, Windows, Linux
**Project Type**: Single project (library-first architecture)
**Performance Goals**: List 100+ sessions in <5s, parse 1000-message session in <1s, search 100 sessions in <3s
**Constraints**: Non-destructive operations, 80% code coverage, zero `any` types
**Scale/Scope**: Typical user has 10-500 sessions, 100-5000 messages per session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. CLI-First Design | ✅ N/A | This feature is library-only; CLI will be separate feature |
| II. Non-Destructive Operations | ✅ PASS | All read operations; migrate copies by default |
| III. Cross-Platform Compatibility | ✅ PASS | Platform detection in FR-012; path handling required |
| IV. Library-First Architecture | ✅ PASS | This IS the library; `src/lib/` structure planned |
| V. Data Fidelity | ✅ PASS | SC-004 requires 100% round-trip fidelity |

**Technical Standards Compliance**:
- TypeScript 5.x strict mode ✅
- Node.js 20+ ✅
- Vitest for testing ✅
- ESLint + Prettier ✅
- Minimize dependencies ✅
- JSDoc for public APIs ✅

## Project Structure

### Documentation (this feature)

```text
specs/001-core-lib/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (TypeScript interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── index.ts              # Public API exports
│   ├── types.ts              # TypeScript interfaces/types
│   ├── config.ts             # LibraryConfig handling
│   ├── platform.ts           # Platform detection (getDefaultDataPath)
│   ├── parser.ts             # JSONL parsing logic
│   ├── session.ts            # Session discovery & retrieval
│   ├── search.ts             # Search implementation
│   ├── export.ts             # Markdown/JSON export
│   ├── migrate.ts            # Session migration
│   └── errors.ts             # Custom error types & guards
└── cli/                      # (Future feature - not this iteration)

tests/
├── fixtures/                 # Anonymized test session files
│   ├── sample-session.jsonl
│   ├── agent-session.jsonl
│   └── corrupted-session.jsonl
├── unit/
│   ├── parser.test.ts
│   ├── platform.test.ts
│   ├── session.test.ts
│   ├── search.test.ts
│   ├── export.test.ts
│   └── migrate.test.ts
└── integration/
    ├── list-sessions.test.ts
    ├── get-session.test.ts
    ├── search-sessions.test.ts
    └── export-sessions.test.ts
```

**Structure Decision**: Single project with library-first architecture. All business logic in `src/lib/`, no CLI in this iteration. Test fixtures use anonymized real session data to validate JSONL parsing against actual Claude Code format.

## Complexity Tracking

> No constitution violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
