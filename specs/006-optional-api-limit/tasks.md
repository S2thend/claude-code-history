# Tasks: Optional API Limit for listSessions()

**Input**: Design documents from `/specs/006-optional-api-limit/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included. The constitution mandates 80% coverage for library code, and the spec provides detailed acceptance scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or independent test cases, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify baseline before making changes

- [ ] T001 Verify all existing tests pass by running `npm test` from repository root
- [ ] T002 Verify TypeScript compiles cleanly by running `npm run typecheck` from repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type and config changes that MUST be complete before ANY user story can be tested

**Warning**: No user story work can begin until this phase is complete

- [ ] T003 Update JSDoc for `LibraryConfig.limit` field in src/lib/types.ts — change comment from "Default: 50" to "When omitted or undefined, all results are returned"
- [ ] T004 Update `ResolvedConfig` interface in src/lib/config.ts — change `limit` field type from `number` to `number | undefined`
- [ ] T005 Update `DEFAULT_CONFIG` in src/lib/config.ts — remove `limit: 50` entry and update the type annotation to omit `limit`
- [ ] T006 Update `resolveConfig()` in src/lib/config.ts — change limit resolution from `config?.limit ?? DEFAULT_CONFIG.limit` to `config?.limit`, and guard validation with `resolved.limit !== undefined &&` before the `< 0` check
- [ ] T007 Update `paginate()` in src/lib/config.ts — when `config.limit` is `undefined`, return `items.slice(config.offset)` instead of `items.slice(config.offset, config.offset + config.limit)`
- [ ] T008 Update `createPagination()` in src/lib/config.ts — when `config.limit` is `undefined`, return `{ total, limit: Math.max(0, total - config.offset), offset: config.offset, hasMore: false }`
- [ ] T009 Run `npm run typecheck` to verify all type changes compile. Fix any downstream type errors in the following files that consume `ResolvedConfig.limit`: src/lib/session.ts, src/lib/search.ts

**Checkpoint**: Foundation ready — library now returns all results when no limit is provided. User story testing can begin.

---

## Phase 3: User Story 1 — Library Consumer Retrieves All Sessions (Priority: P1) MVP

**Goal**: `listSessions()` with no `limit` returns all sessions on the machine instead of silently capping at 50.

**Independent Test**: Call `listSessions()` with no config on a data set containing more than 50 sessions and verify all sessions are returned.

### Tests for User Story 1

- [ ] T010 [P] [US1] Add unit test in tests/unit/config.test.ts — `resolveConfig()` with no argument returns `limit: undefined`
- [ ] T011 [P] [US1] Add unit test in tests/unit/config.test.ts — `resolveConfig({})` with empty object returns `limit: undefined`
- [ ] T012 [P] [US1] Add unit test in tests/unit/config.test.ts — `resolveConfig({ limit: undefined })` with explicit undefined returns `limit: undefined`
- [ ] T013 [P] [US1] Add unit test in tests/unit/config.test.ts — `paginate()` with `limit: undefined` returns all items from offset onward
- [ ] T014 [P] [US1] Add unit test in tests/unit/config.test.ts — `createPagination()` with `limit: undefined` returns `hasMore: false` and `limit` equal to items returned count
- [ ] T015 [US1] Add integration test in tests/integration/list-sessions.test.ts — `listSessions()` with no config on 94+ sessions returns all sessions with `pagination.hasMore === false`
- [ ] T016 [US1] Add integration test in tests/integration/list-sessions.test.ts — `listSessions({})` with empty config on 94+ sessions returns all sessions
- [ ] T017 [US1] Add integration test in tests/integration/list-sessions.test.ts — `listSessions({ limit: undefined })` with explicit undefined on 94+ sessions returns all sessions (verifies explicit undefined matches omitted limit / Edge Case 4)
- [ ] T018 [US1] Add integration test in tests/integration/list-sessions.test.ts — `listSessions({ offset: 10 })` with only offset returns all sessions from offset 10 onward with correct pagination metadata

### Verification for User Story 1

- [ ] T019 [US1] Run `npm test` and verify all US1 tests pass with correct unlimited behavior

**Checkpoint**: User Story 1 is fully functional and tested. Library consumers calling `listSessions()` without a limit receive all sessions.

---

## Phase 4: User Story 2 — Library Consumer Requests Explicit Limit (Priority: P1)

**Goal**: `listSessions({ limit: N })` with an explicit numeric limit continues to return exactly N results. Backward compatibility is preserved. Additionally, other session-enumerating library functions (`searchSessions()` and the export-all helpers) honor the new no-limit default (FR-007).

**Independent Test**: Call `listSessions({ limit: 20 })` on a data set with more than 20 sessions and verify exactly 20 are returned with correct pagination. Separately, call `searchSessions()` and the export-all helpers without a limit on a data set containing more than 50 sessions and verify they consider all sessions.

### Tests for User Story 2

- [ ] T020 [P] [US2] Add unit test in tests/unit/config.test.ts — `resolveConfig({ limit: 20 })` returns `limit: 20`
- [ ] T021 [P] [US2] Add unit test in tests/unit/config.test.ts — `paginate()` with `limit: 20` on 94 items returns exactly 20 items
- [ ] T022 [P] [US2] Add unit test in tests/unit/config.test.ts — `createPagination()` with `limit: 20`, `total: 94` returns `hasMore: true`
- [ ] T023 [P] [US2] Add unit test in tests/unit/config.test.ts — `resolveConfig({ limit: -1 })` throws "limit must be non-negative" error
- [ ] T024 [US2] Add integration test in tests/integration/list-sessions.test.ts — `listSessions({ limit: 20 })` on 94+ sessions returns exactly 20 sessions with `pagination.hasMore === true`
- [ ] T025 [US2] Add integration test in tests/integration/list-sessions.test.ts — `listSessions({ limit: 20, offset: 80 })` on 94 sessions returns 14 sessions with `pagination.hasMore === false`

### FR-007: Shared No-Limit Consistency

- [ ] T026 [US2] Simplify `searchSessions()` in src/lib/search.ts — remove `limit: Number.MAX_SAFE_INTEGER` and `offset: 0` workaround when calling `listSessions()` internally, relying on the new default "no limit" behavior
- [ ] T027 [US2] Add integration test in tests/integration/search-sessions.test.ts — call `searchSessions()` without a limit on a dataset with 94+ sessions and verify matches are found in sessions beyond the former 50-session cap
- [ ] T028 [US2] Simplify `exportAllSessionsToJson()` and `exportAllSessionsToMarkdown()` in src/lib/export.ts — remove `limit: Number.MAX_SAFE_INTEGER` and `offset: 0` workaround when calling `listSessions()` internally, relying on the new default "no limit" behavior
- [ ] T029 [US2] Add integration test in tests/integration/export-sessions.test.ts — `exportAllSessionsToJson()` without a limit on a dataset with 94+ sessions exports all sessions beyond the former 50-session cap
- [ ] T030 [US2] Add integration test in tests/integration/export-sessions.test.ts — `exportAllSessionsToMarkdown()` without a limit on a dataset with 94+ sessions exports all sessions beyond the former 50-session cap

### Verification for User Story 2

- [ ] T031 [US2] Run `npm test` and verify all US2 tests pass confirming backward compatibility and shared no-limit consistency

**Checkpoint**: User Story 2 is verified. Explicit limit behavior is unchanged. `searchSessions()` and the export-all helpers honor the new no-limit default.

---

## Phase 5: User Story 3 — CLI User Sees CLI Defaults Align with the Library (Priority: P2)

**Goal**: Session-enumerating CLI commands align with the library when `--limit` is omitted. `cch list`, cross-session `cch search`, and `cch search --session` return all in-scope results by default, while explicit `--limit` values continue to support paging.

**Independent Test**: Run `cch list`, cross-session `cch search`, and `cch search --session` on data sets with more than 50 sessions or more than 20 matching results and verify omitted `--limit` values do not truncate results, while explicit `--limit` values still work.

### Tests for User Story 3

- [ ] T032 [US3] Update `registerListCommand()` and `executeList()` in src/cli/commands/list.ts — remove the implicit `'50'` default for `--limit`, make omitted `limit` optional, and only pass `limit` to the library when explicitly provided
- [ ] T033 [US3] Add or update unit test in tests/unit/cli/commands/list.test.ts — `cch list` without `--limit` calls `listSessions()` without injecting a numeric `limit`
- [ ] T034 [US3] Update `registerSearchCommand()` and `executeSearch()` in src/cli/commands/search.ts — remove the implicit `'20'` default for `--limit` in both cross-session and `--session` flows, make omitted `limit` optional, only pass `limit` to the library when explicitly provided, and update single-session manual pagination for the unlimited case
- [ ] T035 [US3] Create unit test file tests/unit/cli/commands/search.test.ts — verify `cch search` without `--limit` calls `searchSessions()` without injecting a numeric `limit`, and `cch search --session` without `--limit` does not force the former 20-result cap
- [ ] T036 [US3] Add or verify CLI integration test in tests/integration/cli/list.test.ts — `cch list` with no flags on 94+ sessions displays all sessions with no truncation at 50
- [ ] T037 [US3] Add or verify CLI integration test in tests/integration/cli/list.test.ts — `cch list --limit 10` displays exactly 10 sessions
- [ ] T038 [US3] Add or verify CLI integration test in tests/integration/cli/search.test.ts — `cch search "<query>"` with no `--limit` returns matches beyond the former 20-result cap
- [ ] T039 [US3] Add or verify CLI integration test in tests/integration/cli/search.test.ts — `cch search "<query>" --limit 10` displays exactly 10 matches
- [ ] T040 [US3] Add or verify CLI integration test in tests/integration/cli/search.test.ts — `cch search "<query>" --session <id>` with no `--limit` returns all matching results beyond the former 20-result cap

### Verification for User Story 3

- [ ] T041 [US3] Run `npm test` and verify all US3 tests pass confirming CLI defaults align with the library

**Checkpoint**: All three user stories are independently functional and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and final validation across all stories

- [ ] T042 [P] Add edge case unit test in tests/unit/config.test.ts — `resolveConfig({ limit: 0 })` returns `limit: 0` (zero sessions)
- [ ] T043 [P] Add edge case integration test in tests/integration/list-sessions.test.ts — `listSessions()` on empty data directory with no limit returns empty result with `pagination.total === 0`
- [ ] T044 [P] Add edge case integration test in tests/integration/list-sessions.test.ts — `listSessions({ offset: 200 })` on 94 sessions returns empty result with `pagination.hasMore === false`
- [ ] T045 Run full validation: `npm run typecheck && npm run test:coverage && npm run lint` — all must pass, including library coverage thresholds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US2 can proceed sequentially or as different test cases within the same files (no logical dependencies between them)
  - US3 can proceed independently (its CLI changes live in separate CLI files, including tests/integration/cli/list.test.ts, tests/integration/cli/search.test.ts, tests/unit/cli/commands/list.test.ts, and tests/unit/cli/commands/search.test.ts)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories (tests backward compat + FR-007 search/export consistency)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — No dependencies on other stories (CLI session-enumerating commands, including both search branches, now align with the library's omitted-limit behavior)

### Within Each User Story

- Unit tests before integration tests
- All [P] tests within a story can run in parallel
- Story verification task runs after all story tests

### Parallel Opportunities

- T001 and T002 can run in parallel (Setup phase)
- T003, T004, T005 can be done as a single logical edit to src/lib/config.ts + src/lib/types.ts
- T010-T014 can all run in parallel (different test cases, same file but independent)
- T020-T023 can all run in parallel (different test cases, same file but independent)
- T042-T044 can all run in parallel (different edge case tests)
- US3 can run in parallel with US1/US2 (different CLI files: tests/integration/cli/list.test.ts, tests/integration/cli/search.test.ts, tests/unit/cli/commands/list.test.ts, tests/unit/cli/commands/search.test.ts)

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for US1 together (they test different functions):
Task: T010 "resolveConfig() no arg returns limit: undefined"
Task: T011 "resolveConfig({}) returns limit: undefined"
Task: T012 "resolveConfig({ limit: undefined }) returns limit: undefined"
Task: T013 "paginate() with undefined limit returns all items"
Task: T014 "createPagination() with undefined limit returns correct metadata"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify baseline)
2. Complete Phase 2: Foundational (core config changes)
3. Complete Phase 3: User Story 1 (unlimited behavior)
4. **STOP and VALIDATE**: Run `npm test` — US1 acceptance scenarios all pass
5. Library consumers can immediately benefit from the fix

### Incremental Delivery

1. Complete Setup + Foundational -> Config changes in place
2. Add User Story 1 tests -> Verify unlimited behavior works (MVP!)
3. Add User Story 2 tests + search/export cleanup -> Verify backward compat + FR-007
4. Add User Story 3 CLI changes + tests -> Verify CLI defaults align with library in `list`, cross-session `search`, and `search --session`
5. Polish -> Edge cases, coverage validation, final lint

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (small changeset, ~30min)
2. Once Foundational is done:
   - Developer A: User Story 1 (unlimited tests)
   - Developer B: User Story 2 (backward compat + search/export consistency)
   - Developer C: User Story 3 (CLI list/search default alignment, including `search --session`, plus tests — separate CLI files)
3. Stories complete and validate independently

---

## Notes

- [P] tasks = different files or independent test cases, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after Foundational phase
- The core code change is still moderate (~90 lines across 6-7 files) — most effort is in testing
- `searchInSession()` also calls `resolveConfig()` but is unaffected — it does not enumerate sessions or use `limit` for its return value (it returns all matches within a single session)
- Commit after each phase or logical group
- Stop at any checkpoint to validate independently
