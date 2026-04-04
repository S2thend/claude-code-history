# Implementation Plan: Memory-Safe Session Listing and Detail Loading

**Branch**: `010-stream-session-parsing` | **Date**: 2026-04-03 | **Spec**: [spec.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/spec.md)
**Input**: Feature specification from `/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refactor session parsing so summary listing and detail retrieval scan transcript files once and retain only the derived state they actually need. `listSessions()` gets a lightweight one-pass summary/link parser with bounded first-user preview text and top-level rows for both main and agent sessions, `getSession()` builds messages and metadata in one pass instead of parsing the same transcript twice, and `SessionSummary` gains an additive preview field so `cch list` and downstream consumers can show fallback labels without opening every untitled session.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled, running on Node.js 20+  
**Primary Dependencies**: Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`)  
**Storage**: Local Claude Code JSONL session files under `~/.claude/projects/`, including flat `agent-*.jsonl` files and nested `<main-session>/subagents/agent-*.jsonl` files  
**Testing**: Vitest unit, integration, and performance regression tests for parser/session APIs, CLI list fallback display, large-transcript memory ceilings, and one-pass parse verification  
**Target Platform**: Node.js 20+ on macOS, Linux, and Windows
**Project Type**: Single TypeScript project with library and CLI layers  
**Performance Goals**: `listSessions()` returns top-level main-session and agent-session rows, completes a fixture with at least 1,000 sessions and at least 25 very large transcripts at or below 512 MiB peak memory, each `getSession()` request processes its target transcript source no more than once, at least 95% of untitled sessions with a user-authored message expose fallback preview text from summary listing alone, and baseline-vs-new tests show at least 90% fewer fallback detail-fetches on the same fixture
**Constraints**: No source transcript mutation; preserve full-fidelity `Session.messages` and metadata in detail retrieval; do not retain a full raw transcript array alongside derived outputs; keep preview support additive and non-breaking; do not modify downstream `vibe-history` consumer code in this branch; avoid new runtime dependencies  
**Scale/Scope**: One parser/session/library refactor plus CLI list fallback display and regression tests, covering thousands of session files, very large assistant/tool payloads, malformed lines, flat/nested agent links, and untitled-session previews

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | `cch list` and `cch view` remain the user-facing workflows; summary fallback display is improved with no new command surface. |
| II. Non-Destructive Operations | ✅ Pass | All planned parser/session changes are read-only over existing transcript files. |
| III. Cross-Platform Compatibility | ✅ Pass | Design keeps Node.js built-ins and existing platform/path discovery abstractions for macOS, Linux, and Windows. |
| IV. Library-First Architecture | ✅ Pass | Memory-safe parsing and preview extraction are implemented in `src/lib/`; the CLI consumes the additive summary field. |
| V. Data Fidelity | ✅ Pass | Full session retrieval still returns complete messages/tool payloads; summary previews are additive and do not replace stored transcript data. |

**Governance Exception**:
- The feature branch remains `010-stream-session-parsing` as an explicit one-off exception to the constitution's `<type>/<short-description>` branch naming convention so the generated Spec Kit branch and `specs/010-stream-session-parsing/` directory stay aligned.

**Technical Standards Compliance**:
- TypeScript strict mode and the existing Node.js 20+ single-package setup remain unchanged ✅
- No new runtime dependencies are required ✅
- Vitest coverage will be expanded for parser internals, session summaries, one-pass detail retrieval, malformed-line recovery, and large-fixture memory regressions ✅
- Public API and CLI behavior changes are documented in contracts and remain backward-compatible ✅

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Contracts preserve `cch list`/`cch view` workflows and improve untitled-session labels in list output without new flags. |
| II. Non-Destructive Operations | ✅ Pass | One-pass scanners only read transcript lines and accumulate derived state; no file writes touch Claude history. |
| III. Cross-Platform Compatibility | ✅ Pass | Design does not add platform-specific filesystem assumptions beyond existing project/session discovery helpers. |
| IV. Library-First Architecture | ✅ Pass | `SessionSummary.preview` and parser/session changes are library features first; CLI table rendering only formats those outputs. |
| V. Data Fidelity | ✅ Pass | Detail parsing remains full-fidelity, and summary parsing extracts bounded previews without mutating the underlying transcript or redefining `summary`. |

The only constitution-related exception is the branch naming convention deviation documented above and in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-stream-session-parsing/
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
│   ├── parser.ts          # Add one-pass scan helpers, summary preview extraction, and combined detail parse
│   ├── session.ts         # Use summary scan for listing/link analysis and one-pass detail parse for getSession()
│   ├── types.ts           # Add preview field to SessionSummary / Session
│   └── index.ts           # Re-export any new public types/helpers if needed
└── cli/
    ├── commands/
    │   └── list.ts        # Keep command behavior stable; consume improved summaries
    └── formatters/
        └── table.ts       # Use summary preview as fallback when explicit title is absent

tests/
├── integration/
│   ├── list-sessions.test.ts              # Preview fallback and summary-only listing behavior
│   ├── get-session.test.ts                # One-pass detail retrieval and full-fidelity message output
│   └── performance/
│       └── session-lookup.test.ts         # Large-fixture memory ceiling and duplicate-pass regression coverage
└── unit/
    ├── parser.test.ts                     # Streaming summary/detail scan helpers and malformed-line recovery
    ├── session.test.ts                    # Listing/detail orchestration and link resolution with preview summaries
    └── cli/
        └── formatters/
            └── table.test.ts              # Summary/preview/(No summary) fallback rendering
```

**Structure Decision**: Keep the existing single-project `src/lib` + `src/cli` split. Parser/session logic and the additive summary preview field live in the library layer, while CLI table formatting only uses those values for display fallback. Tests stay under the current `tests/unit`, `tests/integration`, and `tests/integration/performance` layout.

## Complexity Tracking

No architectural exceptions are required. The only documented governance exception is the generated branch name `010-stream-session-parsing`, which intentionally keeps the Spec Kit numeric branch format instead of `<type>/<short-description>` for this one branch.
