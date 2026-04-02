# Tasks: Agent Session Linking

**Input**: Design documents from `/specs/008-agent-session-linking/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: The feature specification requires independent validation for each user story, and the plan/constitution require regression coverage. Tests are included in each story phase, but this is not a TDD-only plan, so implementation may precede the validation tasks within a phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation of each increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path

## Path Conventions

- Single project layout at repository root: `src/`, `tests/`, `specs/`
- Library-first implementation in `src/lib/`
- CLI consumption and formatting in `src/cli/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare reusable nested-agent fixture inputs that all stories can share.

- [ ] T001 Create reusable nested-agent and conflict JSONL fixtures in `tests/fixtures/nested-main-session.jsonl`, `tests/fixtures/nested-agent-session.jsonl`, and `tests/fixtures/nested-agent-conflict-session.jsonl`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared discovery, metadata, and error model required by every user story.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T002 [P] Add `unresolvedAgentIds` summary/session metadata definitions in `src/lib/types.ts`
- [ ] T003 [P] Add `AmbiguousAgentSessionError` and `isAmbiguousAgentSessionError` in `src/lib/errors.ts`
- [ ] T004 [P] Add recursive session-file discovery helpers and nested-owner path parsing in `src/lib/platform.ts`
- [ ] T005 [P] Add explicit agent-reference extraction helpers for raw main-session entries in `src/lib/parser.ts`
- [ ] T006 Implement shared `SessionInfo` discovery context and link-resolution scaffolding in `src/lib/session.ts`
- [ ] T007 Re-export unresolved-link metadata and ambiguity helpers in `src/lib/index.ts`
- [ ] T008 Add foundational nested-path coverage in `tests/unit/platform.test.ts`
- [ ] T009 Add foundational raw-reference and shared-resolution coverage in `tests/unit/parser.test.ts` and `tests/unit/session.test.ts`

**Checkpoint**: Recursive discovery inputs, additive metadata, and ambiguity primitives are ready for story work.

---

## Phase 3: User Story 1 - Show Correct Linked Agent Sessions (Priority: P1) 🎯 MVP

**Goal**: Ensure each main session exposes only its true child agent sessions, with unresolved references surfaced separately.

**Independent Test**: Retrieve or list a main session from fixture data containing multiple main sessions, nested agents, missing agents, fallback-only links, and path conflicts, then verify that only true child agent IDs appear in `agentIds` and missing references appear only in `unresolvedAgentIds`.

### Implementation for User Story 1

- [ ] T010 [US1] Replace project-wide agent guessing with explicit-reference-first per-session link resolution in `src/lib/session.ts`
- [ ] T011 [P] [US1] Add main-session retrieval coverage for nested, unresolved, fallback, and conflicting links in `tests/integration/get-session.test.ts`
- [ ] T012 [P] [US1] Add list-session coverage for true-child-only linking and unresolved references in `tests/integration/list-sessions.test.ts`

**Checkpoint**: User Story 1 is complete when main-session metadata is accurate and independently testable through library list/retrieval flows.

---

## Phase 4: User Story 2 - Open Agent Transcript From Exported ID (Priority: P1)

**Goal**: Allow linked agent IDs to open the correct child transcript through both library and CLI lookup flows.

**Independent Test**: Retrieve a main session, take one of its exported linked agent IDs, and verify that library and CLI lookups open the correct child transcript; verify duplicate agent IDs fail as ambiguous and missing IDs fail as not found.

### Implementation for User Story 2

- [ ] T013 [US2] Extend `getSession()` and `getAgentSession()` to resolve bare and prefixed agent IDs with ambiguity detection in `src/lib/session.ts`
- [ ] T014 [P] [US2] Surface accepted agent identifier forms and ambiguity-specific errors in `src/cli/commands/view.ts` and `src/cli/utils/config.ts`
- [ ] T015 [P] [US2] Add library lookup coverage for unique, missing, and duplicate agent IDs in `tests/integration/get-session.test.ts`
- [ ] T016 [P] [US2] Add CLI view coverage for direct agent lookup and ambiguity messaging in `tests/integration/cli/view.test.ts` and `tests/unit/cli/commands/view.test.ts`

**Checkpoint**: User Story 2 is complete when exported linked agent IDs are directly usable in follow-up library and CLI lookups.

---

## Phase 5: User Story 3 - Keep Session Lists Focused on Main Conversations (Priority: P2)

**Goal**: Preserve main-session-only list output while surfacing navigable linked-agent metadata and unresolved references in the right places.

**Independent Test**: Run `cch list` and `cch list --json` against mixed main-session and nested-agent fixtures, then confirm only main sessions appear as top-level rows while linked and unresolved agent metadata remain available in JSON, exports, and session detail output.

### Implementation for User Story 3

- [ ] T017 [P] [US3] Surface linked and unresolved agent metadata in human-readable session detail output in `src/cli/formatters/session.ts`
- [ ] T018 [P] [US3] Preserve linked and unresolved agent metadata in JSON and Markdown export headers in `src/lib/export.ts`
- [ ] T019 [US3] Keep `cch list` human-readable rows main-session-only while exposing additive summary fields in `src/cli/formatters/table.ts`
- [ ] T020 [P] [US3] Add formatter and integration coverage for main-session-only list output and linked/unresolved metadata in `tests/unit/cli/formatters/session.test.ts`, `tests/integration/cli/list.test.ts`, and `tests/integration/export-sessions.test.ts`

**Checkpoint**: User Story 3 is complete when navigation metadata is visible without promoting agent transcripts to top-level list rows.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Lock in backward compatibility, documentation, and end-to-end verification.

- [ ] T021 [P] Add legacy flat-agent regression coverage across `tests/unit/session.test.ts`, `tests/integration/get-session.test.ts`, and `tests/integration/list-sessions.test.ts`
- [ ] T022 [P] Update linked-agent lookup and unresolved-reference examples in `README.md`
- [ ] T023 Run the verification steps documented in `specs/008-agent-session-linking/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all user stories
- **Phase 3: User Story 1**: Depends on Phase 2 only
- **Phase 4: User Story 2**: Depends on Phase 2 only
- **Phase 5: User Story 3**: Depends on Phase 2 and is safest after User Story 1 in a single-developer flow because it surfaces the metadata that User Story 1 makes accurate
- **Phase 6: Polish**: Depends on completion of all desired user stories

### User Story Dependencies

- **US1**: Independent after Foundational; recommended MVP starting point
- **US2**: Independent after Foundational from a product perspective, but shares `src/lib/session.ts` with US1 and needs coordination if worked in parallel
- **US3**: Depends on accurate linked-agent metadata from US1, while remaining independently testable once that metadata exists

### Dependency Graph

```text
Phase 1 Setup
   ↓
Phase 2 Foundational
   ├── Phase 3 US1
   └── Phase 4 US2
         ↓
      Phase 5 US3
         ↓
    Phase 6 Polish
```

---

## Parallel Opportunities

- `T002`, `T003`, `T004`, and `T005` can run in parallel during Phase 2 because they target different foundational files.
- After foundational work lands, `T011` and `T012` can run in parallel for US1 validation.
- In US2, `T014`, `T015`, and `T016` can run in parallel once `T013` establishes the lookup semantics.
- In US3, `T017` and `T018` can run in parallel because session detail rendering and export metadata touch different files.
- `T021` and `T022` can run in parallel during polish while final quickstart validation is prepared.

## Parallel Example: User Story 1

```bash
# After T010 is complete:
Task: "Add main-session retrieval coverage for nested, unresolved, fallback, and conflicting links in tests/integration/get-session.test.ts"
Task: "Add list-session coverage for true-child-only linking and unresolved references in tests/integration/list-sessions.test.ts"
```

## Parallel Example: User Story 2

```bash
# After T013 is complete:
Task: "Surface accepted agent identifier forms and ambiguity-specific errors in src/cli/commands/view.ts and src/cli/utils/config.ts"
Task: "Add CLI view coverage for direct agent lookup and ambiguity messaging in tests/integration/cli/view.test.ts and tests/unit/cli/commands/view.test.ts"
```

## Parallel Example: User Story 3

```bash
# After US1 metadata is stable:
Task: "Surface linked and unresolved agent metadata in human-readable session detail output in src/cli/formatters/session.ts"
Task: "Preserve linked and unresolved agent metadata in JSON and Markdown export headers in src/lib/export.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (US1)
3. Validate main-session linking accuracy against nested, missing, fallback, and conflicting fixtures
4. Stop and demo the MVP if correct main-session linkage is the immediate need

### Incremental Delivery

1. Land recursive discovery, additive metadata, and ambiguity primitives
2. Deliver US1 so main-session linking becomes accurate
3. Deliver US2 so linked agent IDs become directly navigable
4. Deliver US3 so CLI/detail/export surfaces present the richer metadata without changing top-level list scope
5. Finish with flat-layout regression coverage, docs, and quickstart validation

### Suggested MVP Scope

- **MVP**: Phase 1, Phase 2, and Phase 3 (User Story 1)
- **Why**: It removes the core correctness bug by replacing guessed project-wide agent links with per-session child-agent resolution

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
3. After User Story 1 stabilizes shared metadata:
   - Developer C: User Story 3
4. Finish with shared regression/documentation polish

---

## Notes

- Tasks marked `[P]` are safe parallel candidates because they target different files and do not depend on incomplete same-phase work.
- User story phases are intentionally scoped so each story can be validated independently after shared foundational work lands.
- Exact file paths are included in every task so the list can be executed without re-discovering the plan documents.
