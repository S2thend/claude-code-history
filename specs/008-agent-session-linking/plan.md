# Implementation Plan: Agent Session Linking

**Branch**: `008-agent-session-linking` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-agent-session-linking/spec.md`

## Summary

Add accurate Claude agent-session discovery and lookup support by recursively discovering nested subagent transcripts, deriving parent-to-agent links from main-session evidence with a path-based fallback, surfacing unresolved references separately, and making direct agent lookup explicit and safe when duplicate agent IDs exist. The implementation stays library-first: session discovery, link resolution, and ambiguity handling live in `src/lib/`, while CLI surfaces only update user-facing lookup messaging and detail rendering.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled, running on Node.js 20+  
**Primary Dependencies**: Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`)  
**Storage**: Local Claude Code JSONL session files under `~/.claude/projects/`, including both flat `agent-*.jsonl` files and nested `<main-session>/subagents/agent-*.jsonl` files  
**Testing**: Vitest unit and integration tests, plus CLI integration coverage against generated fixture trees  
**Target Platform**: Node.js 20+ on macOS, Linux, and Windows  
**Project Type**: Single TypeScript project with library and CLI layers  
**Performance Goals**: Session listing and direct session lookup over 100+ fixture sessions complete in under 1 second during acceptance validation, with no user-visible slowdown from recursive nested-agent discovery  
**Constraints**: Non-destructive read operations only; no new runtime dependencies; preserve existing flat agent-session support; keep main-session list results free of agent rows; explicit main-session references remain authoritative over fallback path evidence; duplicate direct agent lookups must fail as ambiguous rather than guessing  
**Scale/Scope**: One session-discovery and lookup enhancement spanning recursive file discovery, per-session agent-link resolution, additive summary/session metadata, direct lookup behavior, CLI view messaging, export fidelity, and regression fixtures for nested, missing, conflicting, and duplicate agent scenarios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Feature improves existing `cch list` and `cch view` navigation and keeps human-readable and JSON workflows aligned. |
| II. Non-Destructive Operations | ✅ Pass | Reads existing JSONL history only; no mutation of source Claude data. |
| III. Cross-Platform Compatibility | ✅ Pass | Uses Node path/file abstractions and must support nested discovery on macOS, Linux, and Windows path layouts. |
| IV. Library-First Architecture | ✅ Pass | Discovery, link resolution, lookup, and error handling live in `src/lib/`; CLI only adjusts command/help/output behavior. |
| V. Data Fidelity | ✅ Pass | Preserves agent/subagent relationships more accurately than the current project-wide guess while surfacing unresolved references instead of silently dropping them. |

**Technical Standards Compliance**:
- TypeScript strict mode remains in force ✅
- No new external runtime dependencies are required ✅
- Vitest unit and integration coverage will be expanded for nested discovery, direct lookup, unresolved references, ambiguity handling, and legacy compatibility ✅
- Public library API additions and new error behavior will be documented in contracts and re-exported through the library entrypoint ✅

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Design keeps top-level list behavior stable and clarifies accepted session identifiers for `view`, including ambiguity handling. |
| II. Non-Destructive Operations | ✅ Pass | Design remains entirely read-only across discovery, lookup, export, and CLI rendering flows. |
| III. Cross-Platform Compatibility | ✅ Pass | Recursive discovery is scoped to existing Claude project directories and continues to rely on platform-neutral path helpers. |
| IV. Library-First Architecture | ✅ Pass | Recursive discovery, link resolution, unresolved-reference tracking, and ambiguity errors remain library concerns consumed by CLI formatters/commands. |
| V. Data Fidelity | ✅ Pass | Design distinguishes discoverable child agents from unresolved references, preserves both flat and nested storage layouts, and refuses to invent links when duplicate agent IDs are ambiguous. |

No constitution violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/008-agent-session-linking/
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
│   ├── types.ts         # Add unresolved linked-reference metadata to session types
│   ├── errors.ts        # Add ambiguity error for duplicate direct agent lookups
│   ├── parser.ts        # Extract explicit agent-link reference data from raw main-session entries
│   ├── platform.ts      # Add recursive/nested session path helpers
│   ├── session.ts       # Recursive discovery, precise agent linking, unresolved references, direct lookup
│   ├── export.ts        # Surface linked and unresolved agent metadata in exports
│   └── index.ts         # Re-export new metadata/error types
└── cli/
    ├── commands/
    │   └── view.ts      # Accept/document direct agent identifiers and ambiguity errors
    └── formatters/
        └── session.ts   # Surface linked and unresolved agent metadata in session detail output

tests/
├── unit/
│   ├── platform.test.ts
│   ├── parser.test.ts
│   ├── session.test.ts
│   └── cli/
│       └── commands/
│           └── view.test.ts
└── integration/
    ├── get-session.test.ts
    ├── list-sessions.test.ts
    ├── export-sessions.test.ts
    └── cli/
        └── view.test.ts
```

**Structure Decision**: Keep the existing single-project structure. The core change belongs in library discovery and lookup code, with CLI updates limited to clearer identifier handling and user-facing metadata. Tests will extend the existing fixture-based library/CLI split instead of introducing new subsystems.

## Complexity Tracking

No constitutional or architectural exceptions required. The feature is an additive refinement of the existing discovery and lookup model and fits the current lib/cli split without new packages or new storage layers.
