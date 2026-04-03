# Tasks: Full Content Library Output

**Input**: Design documents from `/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/009-full-content-lib/`
**Prerequisites**: [plan.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/009-full-content-lib/plan.md), [spec.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/009-full-content-lib/spec.md), [research.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/009-full-content-lib/research.md), [data-model.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/009-full-content-lib/data-model.md), [contracts/](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/009-full-content-lib/contracts)

**Tests**: Regression tests are included because the spec, contracts, and quickstart all define independently testable behavior for each story. Add the story-specific tests first and verify they fail before implementing each story.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared foundational phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with sibling tasks because it touches different files and does not depend on unfinished work
- **[Story]**: User-story label for story phases only (`[US1]`, `[US2]`, `[US3]`)
- Every task below includes one or more absolute file paths

## Path Conventions

- Repository root: `/Users/borui/Devs/vibe-coding-history/claude-code-history`
- Library code: `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/`
- CLI code: `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/`
- Tests: `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare reusable long-content fixture scaffolding for library, parser, and CLI regression tests.

- [ ] T001 [P] Add long-message and long-tool-payload fixture builders for session retrieval tests in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/get-session.test.ts`
- [ ] T002 [P] Add long-tool-output fixture setup for default/full CLI view rendering tests in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/view.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared formatter option contract that the CLI display stories will use.

**⚠️ CRITICAL**: Complete this phase before implementing `US2` or `US3`.

- [ ] T003 Add `full?: boolean` to `SessionFormatOptions` and thread the option through the private formatter call chain in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/formatters/session.ts`

**Checkpoint**: Formatter option plumbing exists and story work can layer behavior and tests onto it.

---

## Phase 3: User Story 1 - Retrieve Complete Session Content Programmatically (Priority: P1) 🎯 MVP

**Goal**: Programmatic callers receive complete message, tool input, tool result, thinking, and parser-warning content with no library-side truncation.

**Independent Test**: Load a session with >1,000-character user text, assistant text, tool input, and tool result payloads through `getSession()`, and parse a long invalid JSONL line through `parseJsonLine()`, then verify every field is returned in full with no omission markers.

### Tests for User Story 1

- [ ] T004 [P] [US1] Add parser warning assertions proving long invalid JSONL lines are returned in full in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/parser.test.ts`
- [ ] T005 [P] [US1] Add `getSession()` and `getAgentSession()` assertions for long user text, assistant text, tool input, tool result, empty-string, multiline, and non-ASCII payloads in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/get-session.test.ts`

### Implementation for User Story 1

- [ ] T006 [US1] Remove parser warning content truncation and return the full trimmed invalid-line text from `parseJsonLine()` in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts`

**Checkpoint**: `US1` is complete when long parser warnings and long session payloads are preserved exactly for programmatic callers.

---

## Phase 4: User Story 2 - View Complete Session Content On Demand (Priority: P1)

**Goal**: `cch view --full` displays all message and tool content without formatter truncation while preserving the existing no-pager behavior.

**Independent Test**: Open a session with long tool inputs/results/thinking blocks using `cch view --full` and verify the full human-readable output contains all characters and no formatter-added `...` markers.

### Tests for User Story 2

- [ ] T007 [P] [US2] Add formatter unit tests proving `formatSession(..., { full: true })` renders complete tool input, tool result, thinking, and fallback tool-result content in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/cli/formatters/session.test.ts`
- [ ] T008 [P] [US2] Add CLI integration tests proving `cch view --full` renders complete long content and still bypasses pagination in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/view.test.ts`

### Implementation for User Story 2

- [ ] T009 [US2] Forward `options.full` into every human-readable `formatSession(...)` call in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/commands/view.ts`
- [ ] T010 [US2] Disable all formatter-side abbreviation branches when `full` is true for tool inputs, tool results, thinking blocks, and fallback tool-result previews in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/formatters/session.ts`

**Checkpoint**: `US2` is complete when `cch view --full` provides a complete human-readable transcript with no field-level abbreviation.

---

## Phase 5: User Story 3 - Keep Default Session Viewing Concise (Priority: P2)

**Goal**: Default `cch view` remains readable by abbreviating long fields only in the formatter and visibly marking omitted display content, while `--json` remains full-fidelity.

**Independent Test**: Open the same long-content session with default `cch view`, `cch view --full`, and `cch view --json`; verify default human-readable output abbreviates visibly, `--full` shows complete text, and JSON output is complete without requiring `--full`.

### Tests for User Story 3

- [ ] T011 [P] [US3] Add default-mode formatter unit tests proving long tool input, tool result, thinking, and fallback tool-result content are abbreviated with visible omission markers in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/cli/formatters/session.test.ts`
- [ ] T012 [P] [US3] Add default `cch view` concise-output and `cch view --json` full-payload regression tests in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/view.test.ts`

### Implementation for User Story 3

- [ ] T013 [US3] Centralize default formatter-only abbreviation in one helper and apply visible omission markers for long tool input, tool result, thinking, and fallback tool-result content in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/formatters/session.ts`

**Checkpoint**: `US3` is complete when default human-readable output is concise and visibly abbreviated, but JSON and `--full` output remain complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize docs, verify the no-truncation boundary, and run the full regression suite.

- [ ] T014 [P] Update implementation notes and command examples if behavior or helper names changed in `/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/009-full-content-lib/quickstart.md`
- [ ] T015 [P] Scan for residual display-style shortening under `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/` and remove or rewrite any remaining caller-visible truncation logic in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts`
- [ ] T016 Run `npm run typecheck`, `npm test`, and `npm run lint` using `/Users/borui/Devs/vibe-coding-history/claude-code-history/package.json` and fix any failures in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/` or `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies
- **Phase 2: Foundational**: Depends on Phase 1
- **Phase 3: US1**: Can start after Phase 1 because `US1` is library/parser-focused and independent of formatter option plumbing
- **Phase 4: US2**: Depends on Phase 2
- **Phase 5: US3**: Depends on Phase 2 and should follow Phase 4 to avoid conflicting edits in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/formatters/session.ts`
- **Phase 6: Polish**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: Independent after setup; recommended MVP scope
- **US2 (P1)**: Depends on the formatter option contract from Phase 2; otherwise independent of `US1`
- **US3 (P2)**: Depends on the same formatter option contract and should be implemented after `US2` because both stories modify the same formatter file

### Dependency Graph

```text
Phase 1 Setup
   ├── Phase 3 US1 ──────────────┐
   └── Phase 2 Foundational      │
           └── Phase 4 US2       │
                 └── Phase 5 US3 ┤
                                 ↓
                           Phase 6 Polish
```

---

## Parallel Opportunities

- `T001` and `T002` can run in parallel because they modify different integration-test files.
- `T004` and `T005` can run in parallel for `US1` because parser-unit and session-integration tests are in different files.
- `T007` and `T008` can run in parallel for `US2` because formatter-unit and CLI-integration tests are in different files.
- `T011` and `T012` can run in parallel for `US3` because formatter-unit and CLI-integration tests are in different files.
- `T014` and `T015` can run in parallel during polish because docs and library cleanup touch different paths.

## Parallel Example: User Story 1

```bash
Task: "Add parser warning assertions proving long invalid JSONL lines are returned in full in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/parser.test.ts"
Task: "Add getSession() and getAgentSession() assertions for long payloads in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/get-session.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add formatter unit tests proving formatSession(..., { full: true }) renders complete content in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/cli/formatters/session.test.ts"
Task: "Add CLI integration tests proving cch view --full renders complete long content in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/view.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add default-mode formatter tests for visible omission markers in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/cli/formatters/session.test.ts"
Task: "Add default cch view concise-output and cch view --json full-payload tests in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/view.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 3 `US1` parser/library tests and implementation.
3. Validate `US1` independently by running the parser and get-session regression tests.
4. Stop and demo once programmatic full-fidelity retrieval is guaranteed.

### Incremental Delivery

1. Deliver `US1` to remove the library-side data-loss risk for programmatic callers.
2. Deliver Phase 2 + `US2` to make `cch view --full` the complete human-readable display mode.
3. Deliver `US3` to preserve concise default output and visible omission markers without affecting JSON/full mode.
4. Finish with polish and full regression verification.

### Suggested MVP Scope

- **MVP**: Phase 1 and Phase 3 (`US1`)
- **Why**: This immediately satisfies the highest-risk requirement that library consumers receive 100% of message/tool content with no truncation.

---

## Independent Test Criteria by User Story

- **US1**: `getSession()` and `getAgentSession()` return exact long payloads, and `parseJsonLine()` returns complete long invalid-line warnings.
- **US2**: `cch view --full` and `formatSession(..., { full: true })` render complete long content with no formatter-added omission markers.
- **US3**: Default `cch view` and `formatSession(...)` abbreviate long fields visibly, while `cch view --json` remains complete without `--full`.

## Notes

- `[P]` marks only tasks that can be implemented in parallel with sibling tasks in the same phase without same-file conflicts.
- Story implementation tasks intentionally avoid parallel markers when they touch shared formatter or command files.
- Every task uses the required checklist format and includes absolute file paths for direct execution.
