# Tasks: CLI UI Layer

**Input**: Design documents from `/specs/002-cli-ui-layer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as the lib layer has established testing patterns with Vitest.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## User Story Mapping

| Story | Priority | Title | Commands |
|-------|----------|-------|----------|
| US1 | P1 | List Sessions | `cch list` |
| US2 | P1 | View Session Details | `cch view` |
| US3 | P2 | Search Across Sessions | `cch search` |
| US4 | P2 | Export Sessions | `cch export` |
| US5 | P3 | Migrate Sessions | `cch migrate` |
| US6 | P3 | Configure Custom Data Path | Global `--data-path` option |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and CLI directory structure

- [x] T001 Install commander dependency: `npm install commander`
- [x] T002 [P] Create CLI directory structure: `mkdir -p src/cli/commands src/cli/formatters src/cli/utils`
- [x] T003 [P] Create test directory structure: `mkdir -p tests/integration/cli tests/unit/cli/formatters tests/unit/cli/utils`
- [x] T004 Update package.json with bin entry pointing to `./dist/cli/index.js`
- [x] T005 [P] Add shebang and create CLI entry point skeleton in `src/cli/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core CLI utilities that ALL commands depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Implement GlobalOptions interface and resolveConfig() in `src/cli/utils/config.ts`
- [x] T007 [P] Implement ExitCode enum and error formatting in `src/cli/utils/errors.ts`
- [x] T008 [P] Implement CommandResult interface and JSON output helper in `src/cli/utils/output.ts`
- [x] T009 Implement pager utility with --full flag support in `src/cli/formatters/pager.ts`
- [x] T010 Register global options (--data-path, --json, --full, --help, --version) in `src/cli/index.ts`
- [x] T011 Add integration test for --help and --version in `tests/integration/cli/global.test.ts`

**Checkpoint**: Foundation ready - all global options work, config resolution complete

---

## Phase 3: User Story 1 - List Sessions (Priority: P1) MVP

**Goal**: Users can list all sessions with summary information, pagination, and workspace filtering

**Independent Test**: Run `cch list` and verify session table displays with index, timestamp, project, summary, message count

### Tests for User Story 1

- [x] T012 [P] [US1] Integration test for list command basic output in `tests/integration/cli/list.test.ts`
- [x] T013 [P] [US1] Integration test for list --json output in `tests/integration/cli/list.test.ts`
- [x] T014 [P] [US1] Integration test for list --workspace filter in `tests/integration/cli/list.test.ts`
- [x] T015 [P] [US1] Integration test for list --limit and --offset pagination in `tests/integration/cli/list.test.ts`

### Implementation for User Story 1

- [x] T016 [P] [US1] Implement table formatter for SessionSummary[] in `src/cli/formatters/table.ts`
- [x] T017 [P] [US1] Unit test for table formatter in `tests/unit/cli/formatters/table.test.ts`
- [x] T018 [US1] Implement list command with options (--workspace, --limit, --offset) in `src/cli/commands/list.ts`
- [x] T019 [US1] Register list command in `src/cli/index.ts`
- [x] T020 [US1] Handle empty results with user-friendly message in list command
- [x] T021 [US1] Handle corrupted files with warning message (skip and continue)

**Checkpoint**: `cch list` fully functional - can list, filter, paginate sessions

---

## Phase 4: User Story 2 - View Session Details (Priority: P1)

**Goal**: Users can view full session content with formatted messages showing role, timestamp, content, and tool usage

**Independent Test**: Run `cch view 0` and verify conversation displays with user/assistant labels and tool call formatting

### Tests for User Story 2

- [x] T022 [P] [US2] Integration test for view command by index in `tests/integration/cli/view.test.ts`
- [x] T023 [P] [US2] Integration test for view command by UUID in `tests/integration/cli/view.test.ts`
- [x] T024 [P] [US2] Integration test for view --json output in `tests/integration/cli/view.test.ts`
- [x] T025 [P] [US2] Integration test for view with invalid session (error handling) in `tests/integration/cli/view.test.ts`

### Implementation for User Story 2

- [x] T026 [P] [US2] Implement parseSessionRef() utility for index/UUID parsing in `src/cli/utils/config.ts`
- [x] T027 [P] [US2] Implement session formatter for full conversation display in `src/cli/formatters/session.ts`
- [x] T028 [P] [US2] Implement tool call/result formatting within session formatter in `src/cli/formatters/session.ts`
- [x] T029 [P] [US2] Unit test for session formatter in `tests/unit/cli/formatters/session.test.ts`
- [x] T030 [US2] Implement view command with session argument in `src/cli/commands/view.ts`
- [x] T031 [US2] Register view command in `src/cli/index.ts`
- [x] T032 [US2] Handle session not found error with helpful message

**Checkpoint**: `cch view` fully functional - can view any session by index or UUID

---

## Phase 5: User Story 3 - Search Across Sessions (Priority: P2)

**Goal**: Users can search for text across all sessions with context lines and pagination

**Independent Test**: Run `cch search "keyword"` and verify matches display with session info, context, and line numbers

### Tests for User Story 3

- [x] T033 [P] [US3] Integration test for search command basic output in `tests/integration/cli/search.test.ts`
- [x] T034 [P] [US3] Integration test for search --session filter in `tests/integration/cli/search.test.ts`
- [x] T035 [P] [US3] Integration test for search --context option in `tests/integration/cli/search.test.ts`
- [x] T036 [P] [US3] Integration test for search --json output in `tests/integration/cli/search.test.ts`

### Implementation for User Story 3

- [x] T037 [P] [US3] Implement search result formatter in `src/cli/formatters/search.ts`
- [x] T038 [P] [US3] Unit test for search formatter in `tests/unit/cli/formatters/search.test.ts`
- [x] T039 [US3] Implement search command with options (--session, --context, --limit, --offset) in `src/cli/commands/search.ts`
- [x] T040 [US3] Register search command in `src/cli/index.ts`
- [x] T041 [US3] Handle no matches with user-friendly message

**Checkpoint**: `cch search` fully functional - can search across or within sessions

---

## Phase 6: User Story 4 - Export Sessions (Priority: P2)

**Goal**: Users can export sessions to JSON or Markdown format, to stdout or file

**Independent Test**: Run `cch export 0 -F markdown -o out.md` and verify file contains valid Markdown

### Tests for User Story 4

- [x] T042 [P] [US4] Integration test for export to stdout (JSON format) in `tests/integration/cli/export.test.ts`
- [x] T043 [P] [US4] Integration test for export to stdout (Markdown format) in `tests/integration/cli/export.test.ts`
- [x] T044 [P] [US4] Integration test for export to file with --output in `tests/integration/cli/export.test.ts`
- [x] T045 [P] [US4] Integration test for export --all option in `tests/integration/cli/export.test.ts`

### Implementation for User Story 4

- [x] T046 [US4] Implement export command with options (--format, --output, --all) in `src/cli/commands/export.ts`
- [x] T047 [US4] Implement file writing with output path validation in `src/cli/commands/export.ts`
- [x] T048 [US4] Register export command in `src/cli/index.ts`
- [x] T049 [US4] Handle file write errors with user-friendly message

**Checkpoint**: `cch export` fully functional - can export single or all sessions to JSON/Markdown

---

## Phase 7: User Story 5 - Migrate Sessions (Priority: P3)

**Goal**: Users can copy or move sessions between workspaces

**Independent Test**: Run `cch migrate 0 -D /new/path` and verify session appears in destination

### Tests for User Story 5

- [x] T050 [P] [US5] Integration test for migrate copy mode in `tests/integration/cli/migrate.test.ts`
- [x] T051 [P] [US5] Integration test for migrate move mode in `tests/integration/cli/migrate.test.ts`
- [x] T052 [P] [US5] Integration test for migrate multiple sessions in `tests/integration/cli/migrate.test.ts`
- [x] T053 [P] [US5] Integration test for migrate error handling in `tests/integration/cli/migrate.test.ts`

### Implementation for User Story 5

- [x] T054 [US5] Implement migrate command with options (--destination, --mode) in `src/cli/commands/migrate.ts`
- [x] T055 [US5] Implement progress output for multi-session migration in `src/cli/commands/migrate.ts`
- [x] T056 [US5] Register migrate command in `src/cli/index.ts`
- [x] T057 [US5] Handle partial failures (some succeed, some fail) with summary output

**Checkpoint**: `cch migrate` fully functional - can copy/move sessions between workspaces

---

## Phase 8: User Story 6 - Configure Custom Data Path (Priority: P3)

**Goal**: Users can specify custom data directory via --data-path or CCH_DATA_PATH environment variable

**Independent Test**: Run `cch list --data-path /custom/path` and verify it reads from that location

### Tests for User Story 6

- [x] T058 [P] [US6] Integration test for --data-path option in `tests/integration/cli/config.test.ts`
- [x] T059 [P] [US6] Integration test for CCH_DATA_PATH environment variable in `tests/integration/cli/config.test.ts`
- [x] T060 [P] [US6] Integration test for invalid path error handling in `tests/integration/cli/config.test.ts`

### Implementation for User Story 6

- [x] T061 [US6] Implement environment variable fallback in resolveConfig() in `src/cli/utils/config.ts`
- [x] T062 [US6] Implement path validation for custom data path in `src/cli/utils/config.ts`
- [x] T063 [US6] Unit test for config resolution priority in `tests/unit/cli/utils/config.test.ts`

**Checkpoint**: Custom data path fully functional - --data-path and CCH_DATA_PATH work correctly

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T064 [P] Add comprehensive --help examples for all commands in `src/cli/index.ts`
- [ ] T065 [P] Optional: Install chalk and add color support with NO_COLOR fallback in `src/cli/utils/colors.ts`
- [x] T066 [P] Unit tests for error formatting in `tests/unit/cli/utils/errors.test.ts`
- [x] T067 [P] Unit tests for output utilities in `tests/unit/cli/utils/output.test.ts`
- [x] T068 Ensure all commands respect --full flag for pagination bypass
- [x] T069 Run full test suite and fix any failures
- [x] T070 Validate quickstart.md steps work end-to-end
- [x] T071 Update CLAUDE.md with CLI usage examples

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ────────────────────────────┐
                                           │
Phase 2: Foundational ◄────────────────────┘
         │
         ▼
         ┌──────────────────────────────────────────────────────────┐
         │                                                          │
         ▼                                                          ▼
Phase 3: US1 (List) ──────► Phase 4: US2 (View)                    │
         │                          │                               │
         │    ┌─────────────────────┘                               │
         ▼    ▼                                                     │
Phase 5: US3 (Search)     Phase 6: US4 (Export)    Phase 7: US5 (Migrate)
         │                          │                       │
         └──────────────────────────┼───────────────────────┘
                                    │
                                    ▼
                            Phase 8: US6 (Config)
                                    │
                                    ▼
                            Phase 9: Polish
```

### User Story Dependencies

- **US1 (List)**: Can start after Foundational - No dependencies on other stories
- **US2 (View)**: Can start after Foundational - Shares parseSessionRef with US1 but independently testable
- **US3 (Search)**: Can start after Foundational - Independent of other stories
- **US4 (Export)**: Can start after Foundational - Independent of other stories
- **US5 (Migrate)**: Can start after Foundational - Independent of other stories
- **US6 (Config)**: Partially implemented in Foundational; completion can be deferred

### Within Each User Story

1. Tests written FIRST (fail before implementation)
2. Formatters before commands (output formatting is a dependency)
3. Commands before registration
4. Error handling after happy path

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T002 (create dirs) ║ T003 (test dirs) ║ T005 (entry point)
```

**Phase 2 (Foundational)**:
```
T007 (errors) ║ T008 (output)
```

**Phase 3 (US1 - List)**:
```
T012 ║ T013 ║ T014 ║ T015  (all tests)
T016 ║ T017                 (formatter + unit test)
```

**Phase 4 (US2 - View)**:
```
T022 ║ T023 ║ T024 ║ T025  (all tests)
T026 ║ T027 ║ T028 ║ T029  (utilities + formatters)
```

**User Stories in Parallel** (with multiple developers):
```
Developer A: US1 (List) → US3 (Search)
Developer B: US2 (View) → US4 (Export)
Developer C: US5 (Migrate) → US6 (Config)
```

---

## Parallel Example: User Story 1

```bash
# Launch all integration tests together:
Task: "Integration test for list command basic output in tests/integration/cli/list.test.ts"
Task: "Integration test for list --json output in tests/integration/cli/list.test.ts"
Task: "Integration test for list --workspace filter in tests/integration/cli/list.test.ts"
Task: "Integration test for list --limit and --offset pagination in tests/integration/cli/list.test.ts"

# Launch formatter + unit test together:
Task: "Implement table formatter for SessionSummary[] in src/cli/formatters/table.ts"
Task: "Unit test for table formatter in tests/unit/cli/formatters/table.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T011)
3. Complete Phase 3: US1 - List (T012-T021)
4. **STOP and VALIDATE**: Test `cch list` independently
5. Complete Phase 4: US2 - View (T022-T032)
6. **STOP and VALIDATE**: Test `cch view` independently
7. Deploy/demo MVP with list + view commands

### Incremental Delivery

1. Setup + Foundational → CLI framework ready
2. Add US1 (List) → `cch list` works → Demo
3. Add US2 (View) → `cch view` works → Demo (MVP complete!)
4. Add US3 (Search) → `cch search` works → Demo
5. Add US4 (Export) → `cch export` works → Demo
6. Add US5 (Migrate) → `cch migrate` works → Demo
7. Add US6 (Config) + Polish → Feature complete

### Suggested Execution Order

For a single developer working sequentially:

```
T001 → T002-T005 (parallel) →
T006 → T007-T008 (parallel) → T009 → T010 → T011 →
T012-T015 (parallel) → T016-T017 (parallel) → T018 → T019-T021 →
T022-T025 (parallel) → T026-T029 (parallel) → T030 → T031-T032 →
[Continue with remaining stories...]
```

---

## Summary

| Phase | Story | Tasks | Parallel Tasks |
|-------|-------|-------|----------------|
| 1 | Setup | 5 | 3 |
| 2 | Foundational | 6 | 2 |
| 3 | US1 - List | 10 | 6 |
| 4 | US2 - View | 11 | 8 |
| 5 | US3 - Search | 9 | 6 |
| 6 | US4 - Export | 8 | 4 |
| 7 | US5 - Migrate | 8 | 4 |
| 8 | US6 - Config | 6 | 3 |
| 9 | Polish | 8 | 4 |
| **Total** | | **71** | **40** |

**MVP Scope**: Phases 1-4 (US1 + US2) = 32 tasks
**Full Feature**: All phases = 71 tasks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
