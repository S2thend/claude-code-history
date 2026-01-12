# Tasks: Message Type Filter

**Input**: Design documents from `/specs/003-message-type-filter/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec. Tasks focus on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Due to shared infrastructure, stories US1-US6 are grouped by implementation layer rather than individual filters.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Using existing structure from plan.md

---

## Phase 1: Setup

**Purpose**: No new setup required - this feature extends existing infrastructure

- [x] T001 Verify existing project structure matches plan.md expectations in src/lib/ and src/cli/

**Checkpoint**: Structure verified - proceed to foundational work

---

## Phase 2: Foundational (Library Types & Core Functions)

**Purpose**: Core library infrastructure that enables ALL filter types (US1-US6)

**⚠️ CRITICAL**: All user story filter implementations depend on these types and functions

### Types Definition

- [x] T002 [P] Add `FilterableMessageType` type alias in src/lib/types.ts
- [x] T003 [P] Add `MessageFilterOptions` interface in src/lib/types.ts
- [x] T004 [P] Add `VALID_FILTER_TYPES` constant array in src/lib/types.ts

### Core Classification Logic

- [x] T005 Implement `classifyMessage(message: Message): FilterableMessageType[]` function in src/lib/session.ts
  - Handle UserMessage → 'user' (when content is string)
  - Handle UserMessage → 'error' (when content has ToolResultContent with is_error=true)
  - Handle AssistantMessage → 'assistant' (when has TextContent)
  - Handle AssistantMessage → 'tool' (when has ToolUseContent)
  - Handle AssistantMessage → 'thinking' (when has ThinkingContent)
  - Exclude SummaryMessage and FileHistorySnapshot
  - Return deduplicated array of types

### Core Filter Logic

- [x] T006 Implement `filterMessages(messages: Message[], options?: MessageFilterOptions): Message[]` function in src/lib/session.ts
  - Return all displayable messages when options.only is empty/undefined
  - Filter using classifyMessage to check if ANY content block matches
  - Preserve message ordering

### Library Exports

- [x] T007 Export new types and functions from src/lib/index.ts
  - Export `FilterableMessageType`
  - Export `MessageFilterOptions`
  - Export `VALID_FILTER_TYPES`
  - Export `filterMessages`
  - Export `classifyMessage`

**Checkpoint**: Foundation ready - library API complete and exported

---

## Phase 3: User Story 1 & 2 - Filter to User/Tool Messages (Priority: P1) 🎯 MVP

**Goal**: Enable `--only user` and `--only tool` filters on the view command

**Independent Test**:
- Run `cch view 0 --only user` and verify only user messages appear
- Run `cch view 0 --only tool` and verify only tool call messages appear

### CLI Option Implementation

- [x] T008 Add `--only <types>` option to view command in src/cli/commands/view.ts
  - Add `.option('-o, --only <types>', 'Filter by message type (user,assistant,tool,thinking,error)')`
  - Update ViewOptions type to include `only?: string`

### CLI Validation

- [x] T009 Implement filter type validation in src/cli/commands/view.ts
  - Parse comma-separated values
  - Trim whitespace from each value
  - Validate against VALID_FILTER_TYPES
  - Show error with valid options list for invalid types

### CLI Integration

- [x] T010 [US1] [US2] Integrate filterMessages into view command execution in src/cli/commands/view.ts
  - Import filterMessages and VALID_FILTER_TYPES from lib
  - Call filterMessages after getSession when --only is provided
  - Pass filtered messages to formatter

### Formatter Updates

- [x] T011 [US1] [US2] Update formatSession to show filtered message count in src/cli/formatters/session.ts
  - Accept optional totalCount parameter
  - Display "Messages: X (filtered from Y)" when filter is active

### JSON Output Support

- [x] T012 [US1] [US2] Update formatSessionForJson to include filter metadata in src/cli/formatters/session.ts
  - Add totalMessageCount field when filtering
  - Add filter field showing applied filter types

### Empty Result Handling

- [x] T013 [US1] [US2] Add informative message for zero matching results in src/cli/commands/view.ts
  - Display "No messages match filter: <types>" instead of empty output
  - Exit code 0 (operation succeeded, just no matches)

**Checkpoint**: User Story 1 & 2 complete - `--only user` and `--only tool` work independently

---

## Phase 4: User Story 3 & 4 - Filter to Assistant/Multiple Types (Priority: P2)

**Goal**: Enable `--only assistant` filter and comma-separated multiple type filters

**Independent Test**:
- Run `cch view 0 --only assistant` and verify only assistant text responses appear (no tool calls)
- Run `cch view 0 --only user,tool` and verify both types appear but not assistant

### Implementation

- [x] T014 [US3] Verify assistant filter excludes tool_use and thinking content in classifyMessage
  - Assistant type should only match messages with TextContent blocks
  - Verify mixed-content messages work correctly (e.g., text + tool_use includes entire message)

- [x] T015 [US4] Verify multiple filter types work with comma-separated values
  - Test parsing of "user,tool" → ['user', 'tool']
  - Test that specifying all 5 types is equivalent to no filter
  - Test whitespace trimming: " user , tool " → ['user', 'tool']

**Checkpoint**: User Stories 3 & 4 complete - assistant filter and multi-type filters work

---

## Phase 5: User Story 5 & 6 - Filter to Thinking/Error Messages (Priority: P3)

**Goal**: Enable `--only thinking` and `--only error` filters

**Independent Test**:
- Run `cch view 0 --only thinking` and verify only thinking blocks appear
- Run `cch view 0 --only error` and verify only error tool results appear

### Implementation

- [x] T016 [US5] Verify thinking filter works for ThinkingContent blocks
  - Thinking blocks should be extracted from assistant messages with type: 'thinking'

- [x] T017 [US6] Verify error filter works for ToolResultContent with is_error flag
  - Error messages are user messages containing tool results with is_error: true

**Checkpoint**: All user stories complete - all 5 filter types functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalization and validation

- [x] T018 Add JSDoc documentation for all new public functions in src/lib/session.ts
- [x] T019 [P] Run existing test suite to verify no regressions
- [x] T020 [P] Run linting and fix any issues
- [x] T021 Validate feature works end-to-end with quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verification only
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories 1&2 (Phase 3)**: Depends on Foundational completion
- **User Stories 3&4 (Phase 4)**: Depends on Phase 3 (same codebase, sequential refinement)
- **User Stories 5&6 (Phase 5)**: Depends on Phase 4 (same codebase, sequential refinement)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 & US2 (P1)**: Core filter implementation - establishes pattern for all others
- **US3 & US4 (P2)**: Builds on US1/US2 infrastructure - verifies edge cases
- **US5 & US6 (P3)**: Final filter types - minimal additional code

### Within Each Phase

- Types before functions (T002-T004 before T005-T006)
- Library before CLI (T005-T007 before T008-T013)
- Core functionality before polish

### Parallel Opportunities

**Phase 2 (Foundational)**:
```bash
# Can run in parallel (different types in same file section):
T002, T003, T004  # All type definitions
```

**Phase 6 (Polish)**:
```bash
# Can run in parallel (independent tasks):
T019, T020  # Tests and linting
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Foundational types and functions
3. Complete Phase 3: User Stories 1 & 2
4. **STOP and VALIDATE**: Test `--only user` and `--only tool` independently
5. Deploy/demo if ready - core filtering works

### Incremental Delivery

1. Complete Setup + Foundational → Library API ready
2. Add US1 & US2 → Test independently → User/Tool filters work (MVP!)
3. Add US3 & US4 → Test independently → Assistant/Multi-type filters work
4. Add US5 & US6 → Test independently → Thinking/Error filters work
5. Complete Polish → Full feature ready

### Single Developer Strategy

Recommended order:
1. T001 → T002-T004 → T005 → T006 → T007 (Library complete)
2. T008 → T009 → T010 → T011 → T012 → T013 (CLI complete, MVP ready)
3. T014 → T015 (P2 stories)
4. T016 → T017 (P3 stories)
5. T018-T021 (Polish)

---

## Notes

- [P] tasks = different files or independent sections, no dependencies
- [Story] label maps task to specific user story for traceability
- All filter types share the same infrastructure - stories grouped by priority
- US1/US2 (P1) are MVP - stop here for minimum viable feature
- US3-US6 extend the same codebase incrementally
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
