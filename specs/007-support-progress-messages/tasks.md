# Tasks: Support Progress Messages

**Input**: Design documents from `/specs/007-support-progress-messages/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: The feature spec does not request TDD-style test-first implementation, so implementation can precede tests within a phase. Each user story phase still includes explicit validation tasks so every increment remains independently testable.

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

**Purpose**: Prepare a reusable progress-entry fixture for implementation and verification across the feature.

- [ ] T001 Create a reusable top-level progress-entry fixture in `tests/fixtures/progress-session.jsonl`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the typed progress-message model and core session plumbing required by all user stories.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T002 Add `ProgressMessage`, `ProgressContent`, widened `MessageType`, and widened `SearchMatch` definitions in `src/lib/types.ts`
- [ ] T003 Implement raw `type: "progress"` normalization and full-fidelity metadata preservation in `src/lib/parser.ts`
- [ ] T004 Update session retrieval counts and activity timestamps to treat progress as displayable transcript content in `src/lib/session.ts`
- [ ] T005 Re-export progress-related public types from `src/lib/index.ts`
- [ ] T006 Add foundational parser regression coverage for readable, empty, and non-readable progress entries in `tests/unit/parser.test.ts`

**Checkpoint**: The library can now preserve progress entries in parsed session data, with progress counted as displayable transcript content.

---

## Phase 3: User Story 1 - Search Progress Content (Priority: P1) 🎯 MVP

**Goal**: Make terms that appear only in progress messages discoverable through both global and session-scoped search.

**Independent Test**: Search for a unique term that exists only inside a progress message and confirm it is returned by both `cch search "<term>"` and `cch search "<term>" --session <session>`.

### Implementation for User Story 1

- [ ] T007 [US1] Extend searchable progress-text extraction and match typing in `src/lib/search.ts`
- [ ] T008 [US1] Surface `PROGRESS` search result labels in `src/cli/formatters/search.ts`
- [ ] T009 [US1] Validate progress-only search results, session-scoped search, empty/non-readable search handling, and the 100+ message performance target in `tests/integration/search-sessions.test.ts` and `tests/integration/cli/search.test.ts`

**Checkpoint**: User Story 1 is complete when progress-only terms become searchable through the existing CLI and library search flows.

---

## Phase 4: User Story 2 - View Progress Messages in Session History (Priority: P1)

**Goal**: Show progress messages in chronological transcript order in both human-readable and JSON session views.

**Independent Test**: View a session containing progress entries and confirm `cch view <session>` shows them in order and `cch view <session> --json` preserves them as `type: "progress"` messages.

### Implementation for User Story 2

- [ ] T010 [US2] Render progress transcript blocks distinctly while surfacing preserved progress metadata in `src/cli/formatters/session.ts`
- [ ] T011 [US2] Keep `cch view` message totals and JSON filtered counts aligned with progress displayability and fidelity in `src/cli/commands/view.ts`
- [ ] T012 [US2] Preserve full-fidelity progress entries in JSON and Markdown export rendering in `src/lib/export.ts`
- [ ] T013 [US2] Validate session retrieval, human-readable view rendering, JSON view output, export fidelity, and empty/non-readable progress handling in `tests/integration/get-session.test.ts`, `tests/unit/cli/formatters/session.test.ts`, `tests/integration/cli/view.test.ts`, and `tests/integration/export-sessions.test.ts`

**Checkpoint**: User Story 2 is complete when session views and transcript-style export no longer omit progress messages.

---

## Phase 5: User Story 3 - Filter Progress Activity During Review (Priority: P2)

**Goal**: Let users isolate progress activity with a dedicated `progress` filter value and combine it with other view filters.

**Independent Test**: Run `cch view <session> --only progress` on sessions with and without progress entries and confirm the filtered output and empty-state behavior are correct.

### Implementation for User Story 3

- [ ] T014 [US3] Add `progress` to filter type definitions and valid filter values in `src/lib/types.ts`
- [ ] T015 [US3] Classify and retain progress messages during filtered session views in `src/lib/session.ts`
- [ ] T016 [US3] Accept `progress` in view filter parsing and help text in `src/cli/commands/view.ts`
- [ ] T017 [US3] Show progress-only filtered states and empty-result messaging in `src/cli/formatters/session.ts`
- [ ] T018 [US3] Validate dedicated progress filtering, filtered counts, and empty/non-readable filtered output behavior in `tests/unit/cli/commands/view.test.ts` and `tests/integration/cli/view.test.ts`

**Checkpoint**: User Story 3 is complete when progress messages can be isolated or combined with other filter values without breaking transcript output.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Lock in shared regression coverage, update documentation, and validate the end-to-end feature.

- [ ] T019 [P] Add shared session-count and transcript-order regression coverage for progress messages in `tests/unit/session.test.ts`
- [ ] T020 [P] Update progress-aware command examples, fidelity guarantees, and performance expectations in `README.md`
- [ ] T021 Run the implementation verification steps documented in `specs/007-support-progress-messages/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all user stories
- **Phase 3: User Story 1**: Depends on Phase 2 only
- **Phase 4: User Story 2**: Depends on Phase 2 only
- **Phase 5: User Story 3**: Depends on Phase 2 and is best applied after Phase 4 when working sequentially, because it extends the same view surfaces
- **Phase 6: Polish**: Depends on completion of all desired user stories

### User Story Dependencies

- **US1**: Independent after Foundational; recommended MVP starting point
- **US2**: Independent after Foundational; can run in parallel with US1 if staffed carefully
- **US3**: Independent after Foundational from a product perspective, but shares `view`-related files with US2 and is safest after US2 in a single-developer flow

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

- `T019` and `T020` can run in parallel after story work is complete because they touch different validation and documentation files.
- After Phase 2, US1 and US2 can be implemented in parallel if different contributors coordinate around shared type changes already landed in Phase 2.
- Documentation update `T020` can be done while final shared regression coverage is being completed, once the final CLI behavior is stable.

## Parallel Example: User Story 1

```bash
# After foundational work is merged:
Task: "Extend searchable progress-text extraction and match typing in src/lib/search.ts"
Task: "Surface PROGRESS search result labels in src/cli/formatters/search.ts"
```

## Parallel Example: User Story 2

```bash
# After foundational work is merged:
Task: "Render progress transcript blocks distinctly in src/cli/formatters/session.ts"
Task: "Preserve full-fidelity progress entries in JSON and Markdown export rendering in src/lib/export.ts"
```

## Parallel Example: User Story 3

```bash
# After User Story 2 stabilizes the view surface:
Task: "Add progress to filter type definitions and valid filter values in src/lib/types.ts"
Task: "Accept progress in view filter parsing and help text in src/cli/commands/view.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (US1)
3. Validate progress-only search behavior end to end
4. Stop and demo the MVP if search is the only required increment

### Incremental Delivery

1. Land foundational parsing and session-model support
2. Deliver US1 so search stops missing progress content
3. Deliver US2 so session transcripts become complete
4. Deliver US3 so progress can be isolated during review
5. Finish with shared regression coverage, docs, and quickstart validation

### Suggested MVP Scope

- **MVP**: Phase 1, Phase 2, and Phase 3 (User Story 1)
- **Why**: It resolves the core bug reported by users: progress-only terms become searchable without raw-file inspection

---

## Notes

- Tasks marked `[P]` are safe parallel candidates because they target different files and do not depend on incomplete same-phase work.
- User story phases are intentionally scoped so each story can be validated independently after the shared foundational work lands.
- This feature package is renumbered to `007-support-progress-messages`; use that explicit path in follow-up Specify commands if needed.
