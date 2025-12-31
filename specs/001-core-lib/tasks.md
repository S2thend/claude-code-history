# Tasks: Core Library for Claude Code History

**Input**: Design documents from `/specs/001-core-lib/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/

**Tests**: Tests are included as the constitution requires 80% code coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize TypeScript project with required tooling

- [x] T001 Create project directory structure per plan.md (`src/lib/`, `tests/fixtures/`, `tests/unit/`, `tests/integration/`)
- [x] T002 Initialize npm project with `package.json` (name: `claude-code-history`, type: module, engines: node >=20)
- [x] T003 [P] Configure TypeScript with `tsconfig.json` (strict: true, ES modules, Node 20 target)
- [x] T004 [P] Configure ESLint with TypeScript rules in `eslint.config.js`
- [x] T005 [P] Configure Prettier in `.prettierrc`
- [x] T006 [P] Configure Vitest in `vitest.config.ts` with coverage thresholds (80%)
- [x] T007 Create test fixtures from anonymized session data in `tests/fixtures/sample-session.jsonl`
- [x] T008 [P] Create agent session fixture in `tests/fixtures/agent-session.jsonl`
- [x] T009 [P] Create corrupted session fixture in `tests/fixtures/corrupted-session.jsonl`

**Checkpoint**: Project builds with `npm run build`, tests run with `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Implement TypeScript types in `src/lib/types.ts` (copy from contracts/types.ts, adapt for implementation)
- [ ] T011 [P] Implement custom error classes in `src/lib/errors.ts` (SessionNotFoundError, WorkspaceNotFoundError, DataNotFoundError)
- [ ] T012 [P] Implement error type guards in `src/lib/errors.ts` (isSessionNotFoundError, isWorkspaceNotFoundError, isDataNotFoundError)
- [ ] T013 Implement platform detection in `src/lib/platform.ts` (getDefaultDataPath using os.homedir)
- [ ] T014 [P] Implement LibraryConfig handling in `src/lib/config.ts` (defaults, merging, validation)
- [ ] T015 Implement JSONL parser in `src/lib/parser.ts` (stream-based with readline, skip invalid lines, track warnings)
- [ ] T016 [P] Implement path encoding/decoding utilities in `src/lib/platform.ts` (encodeProjectPath, decodeProjectPath)
- [ ] T017 Unit test for errors in `tests/unit/errors.test.ts`
- [ ] T018 [P] Unit test for platform in `tests/unit/platform.test.ts`
- [ ] T019 [P] Unit test for parser in `tests/unit/parser.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - List Sessions with Pagination (Priority: P1) 🎯 MVP

**Goal**: Enable listing all sessions with pagination, sorted by most recent first

**Independent Test**: `listSessions()` returns paginated SessionSummary array with correct metadata

### Implementation for User Story 1

- [ ] T020 [US1] Implement session discovery in `src/lib/session.ts` (scan ~/.claude/projects/, glob for *.jsonl)
- [ ] T021 [US1] Implement session summary extraction in `src/lib/session.ts` (parse first line for summary entry)
- [ ] T022 [US1] Implement agent session linking in `src/lib/session.ts` (scan for agent-*.jsonl, extract agentIds)
- [ ] T023 [US1] Implement `listSessions()` function in `src/lib/session.ts` (pagination, sorting by timestamp desc)
- [ ] T024 [US1] Implement workspace filtering in `src/lib/session.ts` (filter by projectPath when workspace provided)
- [ ] T025 [US1] Unit test for session discovery in `tests/unit/session.test.ts`
- [ ] T026 [US1] Integration test for listSessions in `tests/integration/list-sessions.test.ts`

**Checkpoint**: User Story 1 complete - can list sessions with pagination

---

## Phase 4: User Story 2 - Get Full Session Details (Priority: P1) 🎯 MVP

**Goal**: Retrieve complete session with all messages by index or UUID

**Independent Test**: `getSession(0)` and `getSession('uuid')` return full Session object with messages

### Implementation for User Story 2

- [ ] T027 [US2] Implement full session parsing in `src/lib/session.ts` (parse all JSONL lines into Message objects)
- [ ] T028 [US2] Implement message type discrimination in `src/lib/parser.ts` (UserMessage, AssistantMessage, SummaryMessage, FileHistorySnapshot)
- [ ] T029 [US2] Implement index-to-session resolution in `src/lib/session.ts` (get session by zero-based index)
- [ ] T030 [US2] Implement UUID-to-session resolution in `src/lib/session.ts` (get session by UUID string)
- [ ] T031 [US2] Implement `getSession()` function in `src/lib/session.ts` (auto-detect index vs UUID input)
- [ ] T032 [US2] Implement SessionNotFoundError throwing in `src/lib/session.ts` (invalid index or UUID)
- [ ] T033 [US2] Unit test for getSession in `tests/unit/session.test.ts`
- [ ] T034 [US2] Integration test for getSession in `tests/integration/get-session.test.ts`

**Checkpoint**: User Stories 1 AND 2 complete - can list and retrieve sessions (MVP)

---

## Phase 5: User Story 3 - Search Sessions (Priority: P2)

**Goal**: Search across all sessions by keyword with context

**Independent Test**: `searchSessions('keyword')` returns SearchMatch array with context lines

### Implementation for User Story 3

- [ ] T035 [US3] Implement text extraction from messages in `src/lib/search.ts` (extract searchable text from all message types)
- [ ] T036 [US3] Implement case-insensitive search in `src/lib/search.ts` (substring matching)
- [ ] T037 [US3] Implement context extraction in `src/lib/search.ts` (N lines before/after match)
- [ ] T038 [US3] Implement `searchSessions()` function in `src/lib/search.ts` (iterate sessions, find matches, return SearchMatch[])
- [ ] T039 [US3] Unit test for search in `tests/unit/search.test.ts`
- [ ] T040 [US3] Integration test for searchSessions in `tests/integration/search-sessions.test.ts`

**Checkpoint**: User Story 3 complete - can search sessions

---

## Phase 6: User Story 4 - Export Sessions (Priority: P2)

**Goal**: Export sessions to Markdown and JSON formats

**Independent Test**: `exportSessionToMarkdown(0)` and `exportSessionToJson(0)` return formatted strings

### Implementation for User Story 4

- [ ] T041 [US4] Implement JSON export in `src/lib/export.ts` (serialize Session to JSON string with formatting)
- [ ] T042 [US4] Implement Markdown message formatting in `src/lib/export.ts` (format user/assistant messages)
- [ ] T043 [US4] Implement Markdown tool call formatting in `src/lib/export.ts` (collapsible details for tool inputs/outputs)
- [ ] T044 [US4] Implement Markdown code block formatting in `src/lib/export.ts` (syntax highlighting hints)
- [ ] T045 [US4] Implement `exportSessionToJson()` in `src/lib/export.ts`
- [ ] T046 [US4] Implement `exportSessionToMarkdown()` in `src/lib/export.ts`
- [ ] T047 [US4] Implement `exportAllSessionsToJson()` in `src/lib/export.ts` (batch export with workspace filter)
- [ ] T048 [US4] Implement `exportAllSessionsToMarkdown()` in `src/lib/export.ts` (batch export with separation)
- [ ] T049 [US4] Unit test for export in `tests/unit/export.test.ts`
- [ ] T050 [US4] Integration test for export in `tests/integration/export-sessions.test.ts`

**Checkpoint**: User Story 4 complete - can export sessions

---

## Phase 7: User Story 5 - Migrate Sessions (Priority: P3)

**Goal**: Copy/move sessions between workspaces while preserving rollback functionality

**Independent Test**: `migrateSession({ sessions: 0, destination: '/path' })` copies session files with file-history

### Rollback Preservation Requirements

Claude Code's rollback/undo functionality depends on the following data relationships:

```
~/.claude/
├── projects/<encoded-path>/<session-uuid>.jsonl    # Session file
└── file-history/<session-uuid>/                    # File backups (SAME UUID!)
    └── <hash>@v<N>                                 # Versioned backup files
```

**Critical Relationships to Preserve**:
1. **Session UUID** - The UUID in the session filename MUST match the file-history directory name
2. **File-history-snapshot entries** - Messages contain `messageId` → `backupFileName` mappings
3. **Backup files** - Actual file contents stored as `<hash>@v<version>` in file-history directory
4. **trackedFileBackups paths** - File paths in snapshot entries must be rewritten to new workspace

**Migration Strategy**:
- Session UUID must NOT change during migration
- File-history directory stays in place (keyed by UUID, not workspace)
- Only the encoded workspace path changes (session moves to new project folder)
- Internal messageId references remain valid (they reference UUIDs, not paths)
- **Path rewriting required** in JSONL content (see below)

### Implementation for User Story 5

- [ ] T051 [US5] Implement workspace path validation in `src/lib/migrate.ts` (check destination exists or create)
- [ ] T052 [US5] Implement session file copy in `src/lib/migrate.ts` (copy JSONL file to new encoded-path location)
- [ ] T052b [US5] Implement path rewriting in `src/lib/migrate.ts` - rewrite absolute paths in JSONL content:
  - `cwd` field in user/assistant messages
  - `file_path` in tool_use inputs (Read, Write, Edit, Glob, Grep tools)
  - `trackedFileBackups` keys in file-history-snapshot entries
  - Tool result content containing file paths
- [ ] T053 [US5] Implement path re-encoding in `src/lib/migrate.ts` (compute new encoded path for destination workspace)
- [ ] T054 [US5] Implement `migrateSession()` function in `src/lib/migrate.ts` (single or batch copy/move with path rewriting)
- [ ] T055 [US5] Implement `migrateWorkspace()` function in `src/lib/migrate.ts` (copy all sessions between workspaces)
- [ ] T056 [US5] Unit test for migrate in `tests/unit/migrate.test.ts` (verify paths are rewritten correctly)

### Implementation Notes

**File operations required per session migration**:
```
SOURCE:
  ~/.claude/projects/<src-encoded>/<uuid>.jsonl

DESTINATION:
  ~/.claude/projects/<dst-encoded>/<uuid>.jsonl   (same UUID!)
```

**Note**: File-history directory does NOT need to be moved because it's keyed by session UUID, not workspace path. The file-history stays in `~/.claude/file-history/<uuid>/` regardless of which workspace the session belongs to.

**Path Rewriting Requirements**:

When migrating from `/old/workspace` to `/new/workspace`, the following paths in the JSONL must be rewritten:

1. **Message `cwd` field** (all user/assistant messages):
   ```json
   { "cwd": "/old/workspace/src" } → { "cwd": "/new/workspace/src" }
   ```

2. **Tool use `file_path` inputs** (Read, Write, Edit, Glob, Grep, etc.):
   ```json
   { "name": "Read", "input": { "file_path": "/old/workspace/file.ts" } }
   → { "name": "Read", "input": { "file_path": "/new/workspace/file.ts" } }
   ```

3. **File-history-snapshot `trackedFileBackups` keys**:
   ```json
   { "trackedFileBackups": { "/old/workspace/file.ts": { "backupFileName": "hash@v1" } } }
   → { "trackedFileBackups": { "/new/workspace/file.ts": { "backupFileName": "hash@v1" } } }
   ```

4. **Tool results containing file paths** (optional - these are display-only):
   - File contents in Read results may contain the old path in error messages
   - This is cosmetic and doesn't affect functionality

**Path Rewriting Algorithm**:
```
function rewritePath(path, sourceWorkspace, destWorkspace):
  if path.startsWith(sourceWorkspace):
    return destWorkspace + path.slice(sourceWorkspace.length)
  return path  # Leave non-workspace paths unchanged
```

**For 'move' mode**:
1. Read session file, rewrite paths, write to new encoded-path directory
2. Delete original session file
3. File-history stays in place (no change needed)

**For 'copy' mode**:
1. Read session file, rewrite paths, write to new encoded-path directory
2. Original session file remains unchanged
3. Both sessions share the same file-history (acceptable - backups are immutable)

**Checkpoint**: User Story 5 complete - can migrate sessions with rollback preserved

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, documentation, and quality assurance

- [ ] T057 [P] Create public API exports in `src/lib/index.ts` (export all functions, types, error guards)
- [ ] T058 [P] Add JSDoc documentation to all public functions in `src/lib/index.ts`
- [ ] T059 Verify 80% code coverage threshold with `npm run test:coverage`
- [ ] T060 [P] Run ESLint and fix any issues with `npm run lint`
- [ ] T061 [P] Run Prettier and format all files with `npm run format`
- [ ] T062 Validate quickstart.md examples work against implementation
- [ ] T063 Update package.json with correct exports field for ES modules

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 can run in parallel (both P1)
  - US3 depends on US1+US2 (needs session listing and parsing)
  - US4 depends on US2 (needs getSession)
  - US5 depends on US1 (needs session discovery)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (types, errors, platform, parser)
    ↓
┌───────────────────────────────────────┐
│  Phase 3: US1 (List)  ←──┐           │
│  Phase 4: US2 (Get)   ←──┤ Parallel  │
└───────────────────────────┼───────────┘
                            ↓
            ┌───────────────┴───────────────┐
            │  Phase 5: US3 (Search)        │
            │  Phase 6: US4 (Export)        │
            │  Phase 7: US5 (Migrate)       │
            └───────────────────────────────┘
                            ↓
                    Phase 8: Polish
```

### Parallel Opportunities

Within each phase, tasks marked [P] can run in parallel:

**Setup Phase**:
```
T003, T004, T005, T006 can run in parallel (config files)
T007, T008, T009 can run in parallel (test fixtures)
```

**Foundational Phase**:
```
T011, T012 in parallel (error classes and guards)
T014, T016, T017, T018, T019 in parallel (config, path utils, unit tests)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (List Sessions)
4. Complete Phase 4: User Story 2 (Get Session)
5. **STOP and VALIDATE**: Can list and retrieve sessions
6. Deploy/demo if ready - this is a working MVP!

### Incremental Delivery

| Milestone | User Stories | Capabilities |
|-----------|--------------|--------------|
| MVP | US1 + US2 | List, Get sessions |
| v0.2 | +US3 | Search |
| v0.3 | +US4 | Export (Markdown, JSON) |
| v1.0 | +US5 | Migrate |

### Task Counts by Story

| Phase | Story | Tasks | Parallel |
|-------|-------|-------|----------|
| Setup | - | 9 | 6 |
| Foundational | - | 10 | 7 |
| US1 | P1 | 7 | 0 |
| US2 | P1 | 8 | 0 |
| US3 | P2 | 6 | 0 |
| US4 | P2 | 10 | 0 |
| US5 | P3 | 6 | 0 |
| Polish | - | 7 | 4 |
| **Total** | | **63** | **17** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Test fixtures use anonymized real Claude Code session data
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
