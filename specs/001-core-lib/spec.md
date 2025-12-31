# Feature Specification: Core Library for Claude Code History

**Feature Branch**: `001-core-lib`
**Created**: 2025-12-31
**Status**: Draft
**Input**: User description: "Implement the core logics and lib part for Claude Code history management"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List Sessions with Pagination (Priority: P1)

As a developer or tool integrator, I need to list all Claude Code chat sessions with pagination support so that I can browse my conversation history efficiently.

**Why this priority**: This is the foundational capability that all other operations depend on. Without session listing, no other feature can work.

**Independent Test**: Can call `listSessions()` and receive paginated results with session metadata.

**Acceptance Scenarios**:

1. **Given** a standard Claude Code installation, **When** I call `listSessions()`, **Then** I receive a paginated result with `data` array and `pagination` object containing `total`, `limit`, `offset`.
2. **Given** 50 sessions exist, **When** I call `listSessions({ limit: 10, offset: 20 })`, **Then** I receive sessions 21-30 with correct pagination metadata.
3. **Given** sessions exist across multiple projects, **When** I call `listSessions({ workspace: '/path/to/project' })`, **Then** I receive only sessions from that project.
4. **Given** a session has linked agent sessions, **When** I list sessions, **Then** each session includes agent session references.

---

### User Story 2 - Get Full Session Details (Priority: P1)

As a developer or tool integrator, I need to retrieve the full content of a specific session so that I can display all messages, tool calls, and metadata.

**Why this priority**: Getting session details is essential for displaying conversations and is required by search and export features.

**Independent Test**: Can call `getSession(index)` or `getSession(uuid)` and receive complete session data with all messages.

**Acceptance Scenarios**:

1. **Given** sessions exist, **When** I call `getSession(0)`, **Then** I receive the full session object with all messages and metadata.
2. **Given** a session UUID, **When** I call `getSession('uuid-string')`, **Then** I receive the same session as if accessed by its index.
3. **Given** a session contains user messages, assistant messages, and tool calls, **When** I get the session, **Then** each message type is correctly typed and all fields are preserved.
4. **Given** a session has thinking blocks, **When** I get the session, **Then** thinking content is accessible in the message structure.
5. **Given** an invalid index or UUID, **When** I call `getSession(999)` or `getSession('invalid-uuid')`, **Then** an appropriate error is thrown that can be identified with `isSessionNotFoundError()`.

---

### User Story 3 - Search Sessions (Priority: P2)

As a developer, I need to search across all sessions by keyword so that I can find specific conversations or topics.

**Why this priority**: Search is a primary use case but depends on list and parse being complete.

**Independent Test**: Can call `searchSessions('keyword')` and receive matching results with context.

**Acceptance Scenarios**:

1. **Given** sessions with various content, **When** I call `searchSessions('authentication')`, **Then** I receive matches with the matched text and surrounding context.
2. **Given** a keyword appears in multiple sessions, **When** I search, **Then** all matching sessions are returned with match locations.
3. **Given** `context: 2` option, **When** I search, **Then** each match includes 2 lines before and after the matched text.
4. **Given** a case-insensitive search, **When** I search for "Error", **Then** I find matches for "error", "ERROR", and "Error".

---

### User Story 4 - Export Sessions (Priority: P2)

As a developer, I need to export sessions to Markdown and JSON formats so that I can archive, share, or analyze my conversations.

**Why this priority**: Export is a key value proposition but depends on session parsing being complete.

**Independent Test**: Can call `exportSessionToMarkdown(index)` and `exportSessionToJson(index)` to get formatted output.

**Acceptance Scenarios**:

1. **Given** a session index, **When** I call `exportSessionToMarkdown(0)`, **Then** I receive a formatted Markdown string with all messages, code blocks, and timestamps.
2. **Given** a session index, **When** I call `exportSessionToJson(0)`, **Then** I receive the full session data as a JSON string with preserved structure.
3. **Given** a session with tool calls, **When** I export to Markdown, **Then** tool calls are formatted readably with inputs and outputs.
4. **Given** multiple sessions, **When** I call `exportAllSessionsToMarkdown()`, **Then** all sessions are exported with proper separation.
5. **Given** export with custom config, **When** I pass `{ workspace: '/path' }`, **Then** only sessions from that workspace are exported.

---

### User Story 5 - Migrate Sessions (Priority: P3)

As a developer, I need to migrate or copy sessions between workspaces so that I can reorganize my conversation history.

**Why this priority**: Migration is useful but less frequently needed than browsing/searching/exporting.

**Independent Test**: Can call `migrateSession()` to copy sessions between workspace directories.

**Acceptance Scenarios**:

1. **Given** a session index and destination path, **When** I call `migrateSession({ sessions: 0, destination: '/new/path' })`, **Then** the session is copied to the new workspace.
2. **Given** multiple session indices, **When** I call `migrateSession({ sessions: [0, 2, 4], destination: '/path', mode: 'copy' })`, **Then** all specified sessions are copied (originals preserved).
3. **Given** source and destination workspaces, **When** I call `migrateWorkspace({ source: '/old', destination: '/new' })`, **Then** all sessions are migrated with a success count.
4. **Given** an invalid destination, **When** I migrate, **Then** an appropriate error is thrown.

---

### Edge Cases

- When a session file contains invalid JSON lines: skip invalid lines, continue parsing valid lines, track skipped count, and emit warnings to stderr
- How does the library handle very large sessions (10,000+ messages)?
- What happens when the Claude Code data directory doesn't exist?
- How are sessions with non-standard file encodings handled?
- What happens when a session file is being written by Claude Code while being read?
- What happens when migrating to a destination that already has sessions?

## Requirements *(mandatory)*

### Functional Requirements

#### Core Functions
- **FR-001**: `listSessions(config?)` MUST return paginated results with `data` array and `pagination` object containing `total`, `limit`, `offset`. Sessions MUST be sorted by most recent first (descending timestamp) by default
- **FR-002**: `getSession(indexOrId, config?)` MUST return full session details by zero-based index OR session UUID (auto-detect based on input type)
- **FR-003**: `searchSessions(query, config?)` MUST return matches with configurable context lines
- **FR-004**: `getDefaultDataPath()` MUST return platform-specific Claude Code data path

#### Export Functions
- **FR-005**: `exportSessionToJson(index, config?)` MUST export a single session to JSON format
- **FR-006**: `exportSessionToMarkdown(index, config?)` MUST export a single session to Markdown format
- **FR-007**: `exportAllSessionsToJson(config?)` MUST export all sessions to JSON format
- **FR-008**: `exportAllSessionsToMarkdown(config?)` MUST export all sessions to Markdown format

#### Migration Functions
- **FR-009**: `migrateSession(config)` MUST move or copy sessions to another workspace
- **FR-010**: `migrateWorkspace(config)` MUST move or copy all sessions between workspaces

#### Configuration
- **FR-011**: All functions MUST accept a `LibraryConfig` object with optional `dataPath`, `workspace`, `limit`, `offset`, `context` fields
- **FR-012**: Library MUST auto-detect Claude Code data directory (macOS/Linux: `~/.claude/`, Windows: `%USERPROFILE%\.claude\`)

#### Error Handling
- **FR-013**: Library MUST provide type guard functions: `isSessionNotFoundError()`, `isWorkspaceNotFoundError()`, `isDataNotFoundError()`
- **FR-014**: Library MUST handle file read errors gracefully by logging and continuing with valid files
- **FR-015**: Library MUST be usable programmatically without CLI dependencies

#### Data Processing
- **FR-016**: Library MUST parse JSONL session files and return typed objects for each entry type
- **FR-017**: Library MUST decode project paths from encoded format (e.g., `-Users-name-project` to `/Users/name/project`)
- **FR-018**: Library MUST link agent sessions to their parent sessions using the agentId field

### Key Entities

- **Session**: A conversation session with UUID, project path, timestamp, summary, message count, and messages array
- **Message**: A single entry (user, assistant, summary, or file-history-snapshot) with type, content, and metadata
- **SearchMatch**: A search result with session reference, matched text, and context lines
- **PaginatedResult**: A response wrapper with `data` array and `pagination` metadata
- **LibraryConfig**: Configuration options for dataPath, workspace, limit, offset, context
- **MigrateResult**: Migration outcome with success count and any errors

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `listSessions()` returns all sessions within 5 seconds for typical user history
- **SC-002**: `getSession(index)` parses sessions of up to 1000 messages within 1 second
- **SC-003**: `searchSessions(query)` returns results across 100 sessions within 3 seconds
- **SC-004**: Exported JSON can be parsed back with 100% data fidelity
- **SC-005**: Library handles corrupted files by logging errors and continuing (no crashes)
- **SC-006**: All library functions are independently importable and usable without CLI
- **SC-007**: Pagination with limit/offset works correctly for all list operations

### Assumptions

- Users have a standard Claude Code installation in the default location
- Session files follow the documented JSONL format from CLAUDE_CODE_DATA_STRUCTURE.md
- Read operations are non-destructive; migrate operations copy by default (never delete originals)
- Node.js 20+ is available as the runtime environment
- File system permissions allow reading the Claude Code data directory

## Clarifications

### Session 2025-12-31

- Q: What is the default sort order for listSessions()? → A: Most recent first (descending timestamp)
- Q: How to handle corrupted/invalid JSON lines in session files? → A: Skip invalid lines, continue parsing, track skipped count, show warnings
- Q: Should getSession() support UUID in addition to index? → A: Yes, support both index and UUID (auto-detect based on input type)
