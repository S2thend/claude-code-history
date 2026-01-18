# Tasks: Enhanced List Command with Project Details

**Input**: Design documents from `/specs/004-list-project-details/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md

**Tests**: Not explicitly requested in specification. Update existing tests as needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root (as per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new infrastructure needed - this feature extends an existing, fully-structured project

- [x] T001 Review existing table formatter implementation in src/cli/formatters/table.ts
- [x] T002 Review existing SessionSummary type in src/lib/types.ts

**Checkpoint**: Codebase reviewed, ready for foundational changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type changes that MUST be complete before ANY user story display work

**⚠️ CRITICAL**: Type changes block all formatter updates

- [x] T003 Add `gitBranch: string | null` field to SessionSummary interface in src/lib/types.ts
- [x] T004 Update buildSessionSummary() to include gitBranch from metadata in src/lib/session.ts
- [x] T005 Update lib exports if needed in src/lib/index.ts

**Checkpoint**: SessionSummary now includes gitBranch - display work can begin

---

## Phase 3: User Story 1 - View Full Project Path (Priority: P1) 🎯 MVP

**Goal**: Replace PROJECT column with PATH column showing full project directory path

**Independent Test**: Run `cch list` and verify PATH column shows full paths (truncated intelligently for long paths)

### Implementation for User Story 1

- [x] T006 [US1] Update COLUMN_WIDTHS constant: change project→path (30 chars), add branch (15 chars), reduce summary (30 chars) in src/cli/formatters/table.ts
- [x] T007 [US1] Add truncatePath() helper function for left-truncation (preserving project name at end) in src/cli/formatters/table.ts
- [x] T008 [US1] Remove getProjectName() helper function (no longer needed) in src/cli/formatters/table.ts
- [x] T009 [US1] Update table header: rename PROJECT to PATH in formatSessionTable() in src/cli/formatters/table.ts
- [x] T010 [US1] Update table row: display projectPath with truncatePath() instead of getProjectName() in src/cli/formatters/table.ts
- [x] T011 [US1] Update table separator row for new column widths in src/cli/formatters/table.ts
- [x] T012 [US1] Verify path truncation works correctly for paths >30 chars (manual test)

**Checkpoint**: `cch list` shows PATH column with full paths. User Story 1 is independently testable.

---

## Phase 4: User Story 2 - View Git Branch Name (Priority: P2)

**Goal**: Add BRANCH column showing git branch (or `-` if unavailable)

**Independent Test**: Run `cch list` and verify BRANCH column appears with branch names or `-`

### Implementation for User Story 2

- [x] T013 [US2] Add BRANCH column header in formatSessionTable() in src/cli/formatters/table.ts
- [x] T014 [US2] Add BRANCH column data: display session.gitBranch or `-` for null in src/cli/formatters/table.ts
- [x] T015 [US2] Add BRANCH separator in table separator row in src/cli/formatters/table.ts
- [x] T016 [US2] Verify branch truncation works for long branch names (manual test)

**Checkpoint**: `cch list` shows PATH and BRANCH columns. User Stories 1 AND 2 are independently testable.

---

## Phase 5: User Story 3 - JSON Output Includes New Fields (Priority: P2)

**Goal**: Ensure `cch list --json` includes projectPath and gitBranch fields

**Independent Test**: Run `cch list --json | jq '.'` and verify gitBranch field is present

### Implementation for User Story 3

- [x] T017 [US3] Verify formatSessionsForJson() includes gitBranch via spread operator in src/cli/formatters/table.ts
- [x] T018 [US3] Confirm projectPath was already included in JSON output (no change needed)
- [x] T019 [US3] Test JSON output with `cch list --json | jq '.data[0]'` to verify fields

**Checkpoint**: JSON output includes all new fields. All user stories complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Test updates and validation

- [x] T020 [P] Update table formatter unit tests to expect new column layout in tests/unit/cli/formatters/table.test.ts
- [x] T021 [P] Update mock SessionSummary fixtures to include gitBranch field in tests/
- [x] T022 Run full test suite: `npm test`
- [x] T023 Run linter: `npm run lint`
- [x] T024 Build project: `npm run build`
- [x] T025 Manual end-to-end verification per quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (PATH column): Can start immediately after Phase 2
  - US2 (BRANCH column): Depends on US1 column layout changes
  - US3 (JSON): Can start immediately after Phase 2 (independent of display changes)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Logically depends on US1 (column layout established) - same file, sequential
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2

### Within Each User Story

- Column width changes before header/data changes
- Helper functions before usage
- Manual verification after each story

### Parallel Opportunities

- T001, T002 (Setup review tasks) - different files, parallel
- T020, T021 (test updates) - different concerns, parallel
- US3 can run in parallel with US1/US2 if different developer

---

## Parallel Example: Foundational Phase

```bash
# These can run sequentially (same dependency chain):
T003: Add gitBranch to SessionSummary type
T004: Update buildSessionSummary to include gitBranch
T005: Update lib exports
```

## Parallel Example: Polish Phase

```bash
# These can run in parallel (different files):
T020: Update table formatter tests
T021: Update mock fixtures
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (review)
2. Complete Phase 2: Foundational (type changes)
3. Complete Phase 3: User Story 1 (PATH column)
4. **STOP and VALIDATE**: Test `cch list` shows full paths
5. Deploy if ready - users can now distinguish same-named projects

### Incremental Delivery

1. Complete Setup + Foundational → Types ready
2. Add User Story 1 (PATH) → Test → Users see full paths (MVP!)
3. Add User Story 2 (BRANCH) → Test → Users see branch info
4. Add User Story 3 (JSON) → Test → Automation users get new fields
5. Each story adds value without breaking previous stories

### Single Developer Strategy (Recommended)

1. Complete all phases sequentially: Setup → Foundational → US1 → US2 → US3 → Polish
2. Since US1 and US2 modify the same file (table.ts), sequential is natural
3. Total estimated tasks: 25 (including verification)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Most tasks modify src/cli/formatters/table.ts - natural sequential flow
- Type changes (Phase 2) are the critical path
- Existing tests will need updates for new SessionSummary field
- No new dependencies required
