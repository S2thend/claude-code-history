# Implementation Plan: Full Content Library Output

**Branch**: `009-full-content-lib` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-full-content-lib/spec.md`

## Summary

Guarantee that library/session retrieval returns complete message and tool payloads without shortening, remove parser warning truncation from `src/lib/`, and make all human-readable abbreviation a CLI formatter concern controlled by the existing `--full/-f` flag. Default `cch view` remains concise for long tool payloads, while `cch view --full` becomes the single "show everything" mode for both no-pager output and zero formatter truncation.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode enabled, running on Node.js 20+  
**Primary Dependencies**: Commander.js (CLI framework), Node.js built-ins (`fs`, `path`, `readline`)  
**Storage**: Local Claude Code JSONL session files under `~/.claude/projects/`  
**Testing**: Vitest unit and integration tests for library/session retrieval, parser warnings, CLI formatter output, and `cch view --full` behavior  
**Target Platform**: Node.js 20+ on macOS, Linux, and Windows  
**Project Type**: Single TypeScript project with library and CLI layers  
**Performance Goals**: Preserve complete content for fields longer than 1,000 characters in library retrieval and full-detail CLI output, while keeping default `cch view` readable through formatter-only abbreviation  
**Constraints**: No truncation logic in `src/lib/`; parser warnings must preserve full invalid-line content; no new runtime dependencies; `--json` and exports must remain full-fidelity regardless of `--full`; default human-readable `cch view` may still abbreviate display output only using the existing 300/500/100/200 caps for tool inputs, tool results, thinking blocks, and fallback tool-result previews; `--full/-f` must keep its current no-pager behavior
**Scale/Scope**: One data-fidelity and display-boundary refactor spanning parser warning handling, session formatter options, `cch view` option propagation, and regression tests for long user text, tool inputs, tool results, thinking blocks, parse warnings, and post-view retrieval/export invariance

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Existing `cch view` remains the user-facing entrypoint; no new command is needed, and `--full/-f` semantics become clearer. |
| II. Non-Destructive Operations | ✅ Pass | Session parsing, retrieval, and display remain read-only and do not alter Claude source files. |
| III. Cross-Platform Compatibility | ✅ Pass | Changes are limited to parser/formatter behavior and use existing Node path/data access abstractions across macOS, Linux, and Windows. |
| IV. Library-First Architecture | ✅ Pass | Full-fidelity retrieval is enforced in `src/lib/`; CLI owns display-only abbreviation and `--full` rendering behavior. |
| V. Data Fidelity | ✅ Pass | Removes library/parser shortening and verifies full tool/message content and parser warnings are preserved end-to-end. |

**Technical Standards Compliance**:
- TypeScript strict mode and the existing single-package Node.js 20+ setup remain unchanged ✅
- No new runtime dependencies are introduced ✅
- Vitest coverage will be expanded for parser warnings, session retrieval fidelity, formatter default/full-mode output, and CLI `--full` behavior ✅
- Any formatter option changes will be documented in contracts and covered by tests ✅

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. CLI-First Design | ✅ Pass | Design extends `cch view --full` as the single user control for unpaginated and untruncated output, while default `cch view` remains concise. |
| II. Non-Destructive Operations | ✅ Pass | All planned code paths parse and render existing transcripts without mutating source data. |
| III. Cross-Platform Compatibility | ✅ Pass | No platform-specific formatter or parser assumptions are introduced beyond existing Node.js abstractions. |
| IV. Library-First Architecture | ✅ Pass | Library APIs and parser warnings become full-fidelity; CLI formatter alone decides whether to abbreviate human-readable output. |
| V. Data Fidelity | ✅ Pass | Design removes parser-side warning truncation, keeps JSON/export payloads complete, and gates display shortening behind formatter options only. |

No constitution violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/009-full-content-lib/
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
│   ├── parser.ts              # Stop truncating parse warning content
│   ├── session.ts             # Validate retrieved message/tool payloads remain untouched
│   └── types.ts               # ParseWarning contract remains full-fidelity
├── cli/
│   ├── commands/
│   │   └── view.ts            # Pass --full into formatter options
│   └── formatters/
│       └── session.ts         # Apply formatter-only abbreviation and disable it in full mode

tests/
├── integration/
│   ├── get-session.test.ts    # Long content remains complete in library retrieval
│   └── cli/
│       └── view.test.ts       # Default vs --full human-readable rendering
└── unit/
    ├── parser.test.ts         # Parse warnings preserve full invalid lines
    └── cli/
        └── formatters/
            └── session.test.ts # Formatter truncation is controlled by full mode
```

**Structure Decision**: Keep the current single-project `src/lib` + `src/cli` split. Library changes stay in parser/session retrieval paths, and all display-shortening logic stays in the CLI formatter with `view` forwarding `--full`.

## Complexity Tracking

No constitutional or architectural exceptions are required. This is a boundary correction inside the existing library-first architecture with no new subsystems or dependencies.
