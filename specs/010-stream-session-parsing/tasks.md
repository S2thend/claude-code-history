# Tasks: Memory-Safe Session Listing and Detail Loading

**Input**: Design documents from `/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/`
**Prerequisites**: [plan.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/plan.md), [spec.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/spec.md), [research.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/research.md), [data-model.md](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/data-model.md), [contracts/](/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/contracts)

**Tests**: Regression tests are required by `FR-008`, `SC-001`, `SC-002`, and the library/CLI contracts. Add tests first in each story phase and verify they fail before implementing the story code.

**Organization**: Tasks are grouped by user story in spec priority order (`US1`, `US2`, `US3`) so the memory-safe listing MVP can land first and later stories can be validated independently. This branch intentionally keeps the generated name `010-stream-session-parsing` as a documented exception to the constitution's `<type>/<short-description>` convention.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Task can run in parallel with sibling tasks because it touches a different file and has no dependency on unfinished tasks
- **[Story]**: User-story label for story phases only (`[US1]`, `[US2]`, `[US3]`)
- Every task below includes one or more absolute file paths

## Path Conventions

- Repository root: `/Users/borui/Devs/vibe-coding-history/claude-code-history`
- Library code: `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/`
- CLI code: `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/`
- Tests: `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare large-transcript fixture and parser-scan instrumentation helpers used by all story tests.

- [X] T001 [P] Create large synthetic JSONL fixture builders for long user/tool payloads and untitled sessions in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/helpers/large-session-fixtures.ts`
- [X] T002 [P] Create parser scan-count and heap-sampling test helpers for one-pass and 512 MiB regression checks in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/helpers/parser-performance.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared parser/type primitives that all user stories depend on.

**CRITICAL**: Do not start story implementation until this phase is complete.

- [X] T003 [P] Add failing parser unit tests for one-pass line scanning, bounded preview normalization, and malformed-line recovery in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/parser.test.ts`
- [X] T004 [P] Add failing session orchestration unit tests for summary preview propagation and one-pass detail parser usage in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/session.test.ts`
- [X] T005 [P] Add additive `preview: string | null` to `SessionSummary` and inherited `Session` docs in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/types.ts`
- [X] T006 Implement a reusable one-pass JSONL scan helper that forwards each valid `RawSessionEntry` to an accumulator callback and drops the raw entry immediately in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts`
- [X] T007 Extend `SessionMetadata` and parser accumulator helpers with first-user `preview` extraction, first/last timestamps, message counts, and version/branch/session IDs in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts`

**Checkpoint**: Foundation ready when parser and type primitives compile and the new foundational tests fail only on unimplemented story behavior.

---

## Phase 3: User Story 1 - List large session histories without memory failures (Priority: P1) MVP

**Goal**: `listSessions()` returns compact top-level summaries for both main and agent sessions, preview fallback text, timestamps, message counts, and main-session agent links without OOM or whole-session raw-entry retention.

**Independent Test**: Run `listSessions()` on a fixture with many large main and agent transcripts and verify one top-level summary per discoverable session, preview values for untitled sessions, preserved main-session agent links, and peak memory at or below 512 MiB.

### Tests for User Story 1

- [X] T008 [P] [US1] Add failing `listSessions()` integration tests for top-level agent-session rows, untitled-session `preview`, agent link metadata, malformed-line recovery, and title/preview precedence in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/list-sessions.test.ts`
- [X] T009 [P] [US1] Add a failing 1,000-session performance regression test that asserts `listSessions()` peak memory stays at or below 512 MiB while preserving summary rows in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/performance/session-lookup.test.ts`

### Implementation for User Story 1

- [X] T010 [US1] Implement one-pass summary/link parsing that derives `summary`, bounded `preview`, timestamps, message counts, branch/version metadata, and explicit agent IDs without `RawSessionEntry[]` accumulation in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts`
- [X] T011 [US1] Rewire `analyzeMainSessions()`, `buildSessionSummary()`, and `listSessions()` to consume the one-pass summary parser, return top-level rows for both main and agent sessions, and populate `SessionSummary.preview` while preserving pagination, sorting, workspace filtering, and main-session agent-link resolution in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/session.ts`

**Checkpoint**: `US1` is complete when summary listing includes main and agent rows, remains read-only, is preview-aware, and stays under the 512 MiB large-fixture ceiling.

---

## Phase 4: User Story 2 - Open a large session without duplicate transcript processing (Priority: P2)

**Goal**: `getSession()` and `getAgentSession()` return full-fidelity messages and metadata while parsing each target transcript at most once per request.

**Independent Test**: Open one large main session and one large agent session, verify exact message/tool/thinking content plus metadata and preview, and assert one scan per target file for each request.

### Tests for User Story 2

- [X] T012 [P] [US2] Add failing instrumentation tests proving one `getSession()` or `getAgentSession()` request does not parse the same target transcript more than once in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/session.test.ts`
- [X] T013 [P] [US2] Add failing large-payload integration tests verifying full-fidelity `messages`, metadata, and inherited `preview` for `getSession()` and `getAgentSession()` in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/get-session.test.ts`

### Implementation for User Story 2

- [X] T014 [US2] Implement a one-pass full-detail parser that transforms `messages[]` and derives `SessionMetadata` plus `preview` in the same scan without retaining a full raw-entry array in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts`
- [X] T015 [US2] Replace `loadSessionRecord()` duplicate `Promise.all([parseSessionFile, parseSessionMetadata])` parsing with the one-pass detail parser for both main and agent sessions in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/session.ts`

**Checkpoint**: `US2` is complete when every detail lookup preserves full transcript fidelity and one parser pass per target file.

---

## Phase 5: User Story 3 - Render previews in downstream listings without fetching every full session (Priority: P3)

**Goal**: Summary rows expose enough fallback text for listing UIs and JSON consumers to render untitled sessions without opening every full session.

**Independent Test**: Render a mixed titled/untitled main+agent listing from summary data only and verify untitled rows use `preview` capped at 200 characters, titled rows still prefer `summary`, no-title/no-preview rows show `(No summary)`, and JSON rows include `preview`.

### Tests for User Story 3

- [X] T016 [P] [US3] Add failing formatter unit tests for `summary ?? preview ?? '(No summary)'` fallback behavior and 200-character preview display truncation in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/cli/formatters/table.test.ts`
- [X] T017 [P] [US3] Add failing `cch list --json` and human-readable CLI integration tests proving `preview` is present, `(No summary)` is used when no title/preview exists, top-level agent rows are listed, and untitled rows do not require fallback `getSession()` reads when `--stats` is not used in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/list.test.ts`
- [X] T018 [US3] Add a failing baseline-vs-new regression test that compares fallback detail-fetch counts on the same untitled-session fixture and asserts at least 90% reduction in `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/list.test.ts`

### Implementation for User Story 3

- [X] T019 [US3] Render `summary`, then `preview`, then `(No summary)` in `getDisplaySummary()` while keeping table truncation display-only in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/formatters/table.ts`
- [X] T020 [US3] Preserve summary-only `cch list` execution when `--stats` is absent, include top-level agent rows from the library response, and avoid introducing any untitled-session fallback `getSession()` reads in `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/cli/commands/list.ts`

**Checkpoint**: `US3` is complete when listing output and JSON summaries provide fallback preview text without per-row detail fetches.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize docs, audit for leftover full-array parsing, and run the full validation suite.

- [X] T021 [P] Update `/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/quickstart.md`, `/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/contracts/library-api.md`, and `/Users/borui/Devs/vibe-coding-history/claude-code-history/specs/010-stream-session-parsing/contracts/cli-interface.md` if parser/helper names or observable behavior changed during implementation
- [X] T022 Audit `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts` and `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/session.ts` for leftover whole-file `RawSessionEntry[]` retention or duplicate target-file parses and remove any remaining hot paths
- [X] T023 Run `npm run typecheck`, `npm test`, and `npm run lint` using `/Users/borui/Devs/vibe-coding-history/claude-code-history/package.json` and fix any failures under `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/` or `/Users/borui/Devs/vibe-coding-history/claude-code-history/tests/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories
- **Phase 3 US1**: Depends on Phase 2
- **Phase 4 US2**: Depends on Phase 2, and should run after US1 if parser/session file conflicts are not split across branches
- **Phase 5 US3**: Depends on Phase 2, and practically follows US1 because it consumes `SessionSummary.preview`
- **Phase 6 Polish**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 and is the MVP
- **US2 (P2)**: Starts after Phase 2, but `src/lib/parser.ts` and `src/lib/session.ts` edits overlap with US1 implementation tasks
- **US3 (P3)**: Starts after Phase 2, but `preview` display and JSON assertions depend on the summary field populated by US1

### Dependency Graph

```text
Phase 1 Setup
      ↓
Phase 2 Foundational
      ├── Phase 3 US1 ──┬── Phase 5 US3 ──┐
      └── Phase 4 US2 ──┴─────────────────┤
                                           ↓
                                   Phase 6 Polish
```

### Within Each User Story

- Write the story tests first and verify they fail for the expected reason
- Implement parser/type changes before session orchestration or CLI formatting changes
- Validate each story at its checkpoint before moving to the next priority story

---

## Parallel Opportunities

- `T001` and `T002` can run in parallel because they create different helper files.
- `T003`, `T004`, and `T005` can run in parallel because parser tests, session tests, and type changes are in different files.
- `T008` and `T009` can run in parallel for `US1` because list integration and performance tests are in different files.
- `T012` and `T013` can run in parallel for `US2` because session unit tests and get-session integration tests are in different files.
- `T016` can run in parallel with `T017` for `US3` because formatter unit tests and CLI integration tests are in different files, while `T018` should be sequenced with `T017` because they modify the same CLI test file.
- `T021` can run in parallel with `T022` if docs and code-audit ownership are split.

## Parallel Example: User Story 1

```bash
Task: "Add failing listSessions() integration tests for preview, agent links, and malformed-line recovery in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/list-sessions.test.ts"
Task: "Add a failing 1,000-session performance regression test for <=512 MiB listSessions() memory in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/performance/session-lookup.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add failing one-pass instrumentation tests for getSession() and getAgentSession() in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/session.test.ts"
Task: "Add failing large-payload integration tests for full-fidelity details and preview metadata in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/get-session.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add failing formatSessionTable() fallback tests for summary/preview/(No summary) in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/unit/cli/formatters/table.test.ts"
Task: "Add failing cch list --json and human-readable preview fallback tests, top-level agent-row coverage, and >=90% fallback-fetch reduction checks in /Users/borui/Devs/vibe-coding-history/claude-code-history/tests/integration/cli/list.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Implement Phase 3 `US1` summary-listing tasks.
3. Stop and validate `US1` with list integration tests plus the 512 MiB performance regression.
4. Demo memory-safe listing and preview-aware summary rows before moving to detail-path and CLI fallback refinements.

### Incremental Delivery

1. Deliver `US1` to remove the summary-listing OOM path and expose preview metadata.
2. Deliver `US2` to remove duplicate full-file parsing during detail retrieval.
3. Deliver `US3` to make CLI listing and summary JSON consume preview text, show top-level agent rows, and verify at least 90% fewer fallback detail-fetches.
4. Finish with docs updates, parser/session hot-path audits, and the full validation suite.

### Suggested MVP Scope

- **MVP**: Phase 1, Phase 2, and Phase 3 (`US1`)
- **Why**: This directly fixes the highest-impact `listSessions()` OOM path and provides preview metadata needed for summary-only consumers.

---

## Independent Test Criteria by User Story

- **US1**: `listSessions()` returns one top-level summary per discoverable main or agent session with stable main-session agent links and untitled-session `preview` values, recovers from malformed lines, and stays at or below 512 MiB peak memory on the large fixture.
- **US2**: `getSession()` and `getAgentSession()` return complete messages, metadata, and inherited `preview` while scanning each target transcript no more than once.
- **US3**: `formatSessionTable()` and `cch list --json` render or expose 200-character `preview` values for untitled sessions, preserve explicit `summary` precedence, show `(No summary)` when both fields are absent, include top-level agent rows, and reduce fallback detail fetches by at least 90% when `--stats` is absent.

## Task Count Summary

- **Total tasks**: 23
- **US1 tasks**: 4
- **US2 tasks**: 4
- **US3 tasks**: 5
- **Setup tasks**: 2
- **Foundational tasks**: 5
- **Polish tasks**: 3

## Notes

- `[P]` marks only same-phase sibling tasks in different files with no dependency on unfinished tasks.
- Tasks touching `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/parser.ts` or `/Users/borui/Devs/vibe-coding-history/claude-code-history/src/lib/session.ts` are intentionally serialized because those files carry the one-pass parser and orchestration changes.
- Every task uses the required checklist format and includes absolute file paths.
