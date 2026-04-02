# Implementation Plan: Support Progress Messages

**Branch**: `007-support-progress-messages` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-support-progress-messages/spec.md`

## Summary

Add first-class support for `progress` session entries so they survive parsing, appear in session data returned by the library, are searchable through `cch search`, are viewable through `cch view`, and can be isolated with a dedicated `--only progress` filter. The implementation follows the existing library-first split: normalize progress entries in the lib layer, then extend CLI rendering and result labeling to surface them consistently while preserving full progress-entry fidelity across every supported output that surfaces them.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled  
**Primary Dependencies**: Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`)  
**Storage**: Local Claude Code JSONL session files under `~/.claude/projects/`  
**Testing**: Vitest unit and integration tests  
**Target Platform**: Node.js 20+ on macOS, Linux, and Windows  
**Project Type**: Single project with library and CLI layers  
**Performance Goals**: Search, view, and filtering operations on 100+ message sessions complete in under 1 second during acceptance validation, with no user-visible regression from adding one additional message type  
**Constraints**: Non-destructive read operations only; no new runtime dependencies; preserve existing JSON and human-readable behavior for already-supported content except where progress support is additive; preserve full progress-entry fields, metadata, and relationships in every supported output that surfaces progress messages  
**Scale/Scope**: Single message-type expansion across parser, message model, search, session filtering, CLI formatting, export fidelity, and regression tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Feature expands existing `cch search` and `cch view` behavior and keeps JSON output support. |
| II. Non-Destructive Operations | ✅ Pass | Reads existing JSONL data only; no source mutation. |
| III. Cross-Platform Compatibility | ✅ Pass | Uses existing path handling and local file parsing abstractions. |
| IV. Library-First Architecture | ✅ Pass | Parsing, search, filtering, and message typing remain in `src/lib/`; CLI only consumes them. |
| V. Data Fidelity | ✅ Pass | The design requires progress-entry fields, metadata, and relationships to remain available in session models and every supported output that surfaces them, with explicit regression coverage. |

**Technical Standards Compliance**:
- TypeScript strict mode remains in effect ✅
- No new external runtime dependencies required ✅
- Vitest unit and integration coverage will be extended for fidelity, empty/non-readable progress content, and 100+ message performance validation ✅
- Public library API changes remain documented and additive ✅

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Design adds progress labeling to search/view and a dedicated `progress` filter value. |
| II. Non-Destructive Operations | ✅ Pass | Design is read-only across parser, search, view, and export surfaces. |
| III. Cross-Platform Compatibility | ✅ Pass | Design uses existing Node/filepath abstractions only. |
| IV. Library-First Architecture | ✅ Pass | New message type, filtering, and search extraction live in lib; CLI formatters/commands only render and validate. |
| V. Data Fidelity | ✅ Pass | In-memory session models and every supported output that surfaces progress messages retain progress-entry fields, metadata, and relationships instead of silently discarding them. |

No constitution violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/007-support-progress-messages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cli-interface.md
│   └── library-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── types.ts         # Add progress message types and filter/search type updates
│   ├── parser.ts        # Parse raw progress entries and preserve full progress fidelity
│   ├── session.ts       # Session counts, filtering, and displayable-message logic
│   ├── search.ts        # Search extraction and match typing for progress messages
│   ├── export.ts        # Preserve progress messages and metadata in export formatting
│   └── index.ts         # Export new public types
└── cli/
    ├── commands/
    │   └── view.ts      # Dedicated progress filter validation and counts
    └── formatters/
        ├── session.ts   # Human-readable rendering for progress messages
        └── search.ts    # Search result labels for progress matches

tests/
├── unit/
│   ├── parser.test.ts
│   ├── session.test.ts
│   ├── cli/commands/view.test.ts
│   └── cli/formatters/session.test.ts
└── integration/
    ├── get-session.test.ts
    ├── search-sessions.test.ts
    ├── export-sessions.test.ts
    └── cli/
        ├── search.test.ts
        └── view.test.ts
```

**Structure Decision**: Keep the existing single-project structure. Extend the library’s canonical message model first, then update CLI formatting/validation and regression tests around the existing search/view/export surfaces. Explicitly validate full fidelity in session objects, CLI-visible outputs, and export surfaces, including empty or non-readable progress entries.

## Complexity Tracking

No constitutional or architectural exceptions required. This feature is additive and fits the existing lib/cli split without new packages or new subsystems.
