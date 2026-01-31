# Tasks: Complete Token Statistics

**Input**: Design documents from `/specs/005-complete-token-stats/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Tests are included per spec constraint requiring all tests to pass.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/lib/` for core library, `src/cli/` for CLI layer, `tests/` for tests
- Per constitution: CLI depends on lib, never the reverse

---

## Phase 1: Setup

**Purpose**: Verify existing core functionality before adding new features

- [x] T001 Verify existing token parsing works by running `npm test` and confirming all tests pass
- [x] T002 [P] Create test fixture with cache tokens by adding non-zero `cache_creation_input_tokens` and `cache_read_input_tokens` values to `tests/fixtures/sample-session.jsonl`

---

## Phase 2: Foundational (Core Library Types & Functions)

**Purpose**: Add token aggregation types and functions to core library. MUST complete before CLI work.

**⚠️ CRITICAL**: No CLI work (US1, US2) can begin until this phase is complete

### Types (src/lib/types.ts)

- [x] T003 Add `AggregateTokenStats` interface extending `TokenUsage` with `totalTokens` field in `src/lib/types.ts`
- [x] T004 [P] Add `SessionWithStats` interface extending `Session` with `tokenStats` field in `src/lib/types.ts`
- [x] T005 [P] Add `ListStatsResult` interface with sessions, aggregateStats, and pagination fields in `src/lib/types.ts`

### Stats Module (src/lib/stats.ts) - NEW FILE

- [x] T006 Create `src/lib/stats.ts` with `createEmptyStats()` function returning zero-initialized `AggregateTokenStats`
- [x] T007 Add `computeTokenStats(messages: Message[]): AggregateTokenStats` function to `src/lib/stats.ts`
- [x] T008 Add `addStats(a: AggregateTokenStats, b: AggregateTokenStats): AggregateTokenStats` function to `src/lib/stats.ts`

### Exports (src/lib/index.ts)

- [x] T009 Export new types (`AggregateTokenStats`, `SessionWithStats`, `ListStatsResult`) from `src/lib/index.ts`
- [x] T010 Export new functions (`computeTokenStats`, `createEmptyStats`, `addStats`) from `src/lib/index.ts`

### Unit Tests for Stats Module

- [x] T011 [P] Create `tests/unit/stats.test.ts` with tests for `createEmptyStats()` returning all zeros
- [x] T012 [P] Add tests for `computeTokenStats()` with empty messages array in `tests/unit/stats.test.ts`
- [x] T013 [P] Add tests for `computeTokenStats()` with assistant messages containing token data in `tests/unit/stats.test.ts`
- [x] T014 [P] Add tests for `computeTokenStats()` verifying only assistant messages are counted in `tests/unit/stats.test.ts`
- [x] T015 [P] Add tests for `addStats()` combining two stats objects in `tests/unit/stats.test.ts`
- [x] T016 Run `npm test` and `npm run typecheck` to verify all foundational work passes

**Checkpoint**: Foundation ready - Core library exports token aggregation functions. CLI implementation can begin.

---

## Phase 3: User Story 1 - View Complete Token Usage Per Session (Priority: P1) 🎯 MVP

**Goal**: Display complete token breakdown (all 4 types) as footer when viewing a session with `cch view`

**Independent Test**: Run `cch view 0` and verify footer shows input, output, cache read, cache creation, and total tokens

### Implementation for User Story 1

- [x] T017 [US1] Add `formatTokenSummary(stats: AggregateTokenStats): string` function to `src/cli/formatters/session.ts` (use `toLocaleString()` for number formatting per FR-005)
- [x] T018 [US1] Update `formatSession()` in `src/cli/formatters/session.ts` to accept optional `tokenStats` parameter and append footer
- [x] T019 [US1] Update `src/cli/commands/view.ts` to import `computeTokenStats` from lib and pass stats to formatter
- [x] T020 [US1] Update `formatSessionForJson()` in `src/cli/formatters/session.ts` to include `tokenStats` in JSON output
- [x] T021 [US1] Update `tests/unit/cli/formatters/session.test.ts` with tests for `formatTokenSummary()` output format
- [x] T022 [US1] Add integration test in `tests/integration/cli/view.test.ts` verifying token footer appears in output
- [x] T023 [US1] Run `npm test && npm run lint && npm run typecheck` to verify US1 passes all checks

**Checkpoint**: User Story 1 complete - `cch view <session>` shows token breakdown footer

---

## Phase 4: User Story 2 - View Aggregated Token Statistics Across Sessions (Priority: P2)

**Goal**: Display aggregated token statistics when listing sessions with `cch list --stats`

**Independent Test**: Run `cch list --stats` and verify aggregate totals appear after session table

### Implementation for User Story 2

- [x] T024 [US2] Add `--stats` option to list command in `src/cli/commands/list.ts`
- [x] T025 [US2] Add `formatAggregateStats(stats: AggregateTokenStats): string` function to `src/cli/formatters/table.ts` (use `toLocaleString()` for number formatting per FR-005)
- [x] T026 [US2] Update `executeList()` in `src/cli/commands/list.ts` to compute aggregate stats when `--stats` flag is set
- [x] T027 [US2] Update list command JSON output to include `statistics` object when `--stats` and `--json` are both set
- [x] T028 [US2] Add unit test for `formatAggregateStats()` in `tests/unit/cli/formatters/table.test.ts`
- [x] T029 [US2] Add integration test in `tests/integration/cli/list.test.ts` verifying `--stats` flag output
- [x] T030 [US2] Run `npm test && npm run lint && npm run typecheck` to verify US2 passes all checks

**Checkpoint**: User Story 2 complete - `cch list --stats` shows aggregate token statistics

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T031 [P] Verify locale-appropriate number formatting (thousands separators) in token display
- [x] T032 [P] Test edge cases: empty session, session with no assistant messages, very large token counts
- [x] T033 Run full test suite with `npm test && npm run lint && npm run typecheck`
- [x] T034 Manual validation: test `cch view 0` and `cch list --stats` against real Claude Code session data

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verify existing functionality
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all CLI work
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion (can run parallel to US1 if desired)
- **Polish (Phase 5)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Only depends on Foundational (Phase 2) - no dependency on US2
- **User Story 2 (P2)**: Only depends on Foundational (Phase 2) - no dependency on US1

### Within Each Phase

- Types before functions (T003-T005 before T006-T008)
- Functions before exports (T006-T008 before T009-T010)
- Implementation before tests
- Lib layer before CLI layer

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T004, T005 can run in parallel (different interface definitions)
- T011-T015 can all run in parallel (different test cases in same file)

**Phase 3 (US1) & Phase 4 (US2)**:
- US1 and US2 can run in parallel after Foundational completes (different files)

---

## Parallel Example: Foundational Phase

```bash
# Launch type definitions together:
Task: "Add SessionWithStats interface in src/lib/types.ts"      # T004
Task: "Add ListStatsResult interface in src/lib/types.ts"       # T005

# Launch unit tests together:
Task: "Test createEmptyStats() in tests/unit/stats.test.ts"     # T011
Task: "Test computeTokenStats() empty in tests/unit/stats.test.ts"  # T012
Task: "Test computeTokenStats() with data in tests/unit/stats.test.ts" # T013
Task: "Test computeTokenStats() assistant-only in tests/unit/stats.test.ts" # T014
Task: "Test addStats() in tests/unit/stats.test.ts"             # T015
```

## Parallel Example: User Stories

```bash
# After Foundational completes, both stories can start:
Task: "[US1] Add formatTokenSummary() in src/cli/formatters/session.ts"  # T017
Task: "[US2] Add --stats option in src/cli/commands/list.ts"             # T024
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T016) - CRITICAL
3. Complete Phase 3: User Story 1 (T017-T023)
4. **STOP and VALIDATE**: Test `cch view 0` shows token footer
5. Deploy/demo if ready - this alone solves the core problem

### Incremental Delivery

1. Complete Setup + Foundational → Core lib ready
2. Add User Story 1 → `cch view` shows tokens → MVP!
3. Add User Story 2 → `cch list --stats` shows aggregates
4. Polish → Edge cases, formatting, final validation

### Single Developer Strategy

1. T001 → T002 → T003 → T004 → T005 (types done)
2. T006 → T007 → T008 → T009 → T010 (functions + exports done)
3. T011-T015 in parallel, then T016 (tests pass)
4. T017 → T018 → T019 → T020 → T021 → T022 → T023 (US1 complete)
5. T024 → T025 → T026 → T027 → T028 → T029 → T030 (US2 complete)
6. T031-T034 (polish)

---

## Notes

- [P] tasks = different files or independent test cases, no dependencies
- [US1], [US2] labels map tasks to user stories for traceability
- Spec requires: linting (Prettier), type checking (strict mode), tests must pass
- Spec constraint: CLI only contains UI code; all aggregation logic in lib layer
- Token footer appears after messages per clarification decision
- Stop after US1 for valid MVP that solves the core "missing cache tokens" problem
