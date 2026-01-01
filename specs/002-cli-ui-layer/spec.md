# Feature Specification: CLI UI Layer

**Feature Branch**: `002-cli-ui-layer`
**Created**: 2025-12-31
**Status**: Draft
**Input**: User description: "now use the lib and core to implement the cli ui layer"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List Sessions (Priority: P1)

As a developer, I want to list all my Claude Code conversation sessions so that I can see what sessions are available and find the one I need.

**Why this priority**: This is the most fundamental operation - users need to discover what sessions exist before they can do anything else with them. Without listing, users cannot navigate their conversation history.

**Independent Test**: Can be fully tested by running the list command and verifying it displays session summaries in a readable format. Delivers immediate value by showing users their conversation history.

**Acceptance Scenarios**:

1. **Given** the user has Claude Code sessions in their default data directory, **When** they run the list command, **Then** they see a table/list of sessions showing session index, summary/title, project path, timestamp, and message count
2. **Given** the user has many sessions, **When** they run the list command with pagination options, **Then** they see only the requested page of results with navigation hints
3. **Given** the user wants to filter by project, **When** they run the list command with a workspace filter, **Then** they see only sessions from that workspace/project
4. **Given** no sessions exist, **When** they run the list command, **Then** they see a helpful message indicating no sessions were found

---

### User Story 2 - View Session Details (Priority: P1)

As a developer, I want to view the full contents of a specific session so that I can read through my past conversations with Claude.

**Why this priority**: After listing sessions, viewing is the core read operation. Users need to access their conversation content to recall context, learn from past solutions, or reference previous work.

**Independent Test**: Can be fully tested by specifying a session identifier and verifying the full conversation is displayed with proper formatting. Delivers value by making conversation history accessible.

**Acceptance Scenarios**:

1. **Given** a valid session exists, **When** the user runs the view command with a session index (e.g., `0`), **Then** they see the full conversation with messages clearly labeled by role (user/assistant)
2. **Given** a valid session exists, **When** the user runs the view command with a session UUID, **Then** they see the same session content
3. **Given** a session has tool usage, **When** the user views it, **Then** tool calls and results are displayed in a readable format
4. **Given** an invalid session identifier, **When** the user runs the view command, **Then** they see a clear error message indicating the session was not found

---

### User Story 3 - Search Across Sessions (Priority: P2)

As a developer, I want to search for specific text across all my sessions so that I can quickly find relevant conversations without manually browsing each one.

**Why this priority**: Search is a power-user feature that significantly improves productivity when users have many sessions. It depends on having sessions to search but is critical for effective navigation of large histories.

**Independent Test**: Can be fully tested by searching for a known term and verifying matches are returned with context. Delivers value by enabling quick discovery of relevant content.

**Acceptance Scenarios**:

1. **Given** sessions contain the search term, **When** the user searches for a term, **Then** they see matching results with session info, matched text, and surrounding context
2. **Given** the user wants to search within a specific session, **When** they provide both a session ID and search term, **Then** they see only matches from that session
3. **Given** no matches exist, **When** the user searches, **Then** they see a message indicating no results were found
4. **Given** many matches exist, **When** the user searches with pagination options, **Then** results are paginated appropriately

---

### User Story 4 - Export Sessions (Priority: P2)

As a developer, I want to export my sessions to JSON or Markdown format so that I can archive them, share them, or use them in other tools.

**Why this priority**: Export enables data portability and archival. It's important for users who want to backup their history, share conversations, or integrate with other workflows.

**Independent Test**: Can be fully tested by exporting a session and verifying the output file is valid JSON or properly formatted Markdown. Delivers value by enabling data portability.

**Acceptance Scenarios**:

1. **Given** a valid session, **When** the user exports to JSON, **Then** they receive valid JSON output preserving all session data
2. **Given** a valid session, **When** the user exports to Markdown, **Then** they receive human-readable Markdown with proper formatting
3. **Given** the user specifies an output file, **When** they export, **Then** the content is written to that file
4. **Given** the user wants to export all sessions, **When** they use the export-all option, **Then** all sessions are exported to the specified format

---

### User Story 5 - Migrate Sessions (Priority: P3)

As a developer, I want to copy or move sessions between workspaces so that I can reorganize my conversation history or consolidate sessions from multiple projects.

**Why this priority**: Migration is an advanced operation for power users managing their session organization. While valuable, it's less frequently needed than browsing and searching.

**Independent Test**: Can be fully tested by migrating a session to a new workspace and verifying it appears in the destination with correct path references. Delivers value by enabling session organization.

**Acceptance Scenarios**:

1. **Given** a valid session, **When** the user copies it to a new workspace, **Then** the session exists in both locations with updated path references
2. **Given** a valid session, **When** the user moves it to a new workspace, **Then** the session exists only in the new location
3. **Given** multiple session identifiers, **When** the user migrates in batch, **Then** all specified sessions are migrated
4. **Given** an invalid destination, **When** the user attempts to migrate, **Then** they see a clear error message

---

### User Story 6 - Configure Custom Data Path (Priority: P3)

As a developer, I want to specify a custom Claude Code data directory so that I can work with sessions stored in non-default locations.

**Why this priority**: This is a configuration feature that enables advanced use cases like working with backed-up data or multiple Claude Code installations.

**Independent Test**: Can be fully tested by pointing to a custom data directory and verifying all commands work correctly with that path. Delivers value for advanced configuration scenarios.

**Acceptance Scenarios**:

1. **Given** a custom data path, **When** the user provides it via command-line option, **Then** all commands operate on that directory
2. **Given** an environment variable is set, **When** the user runs commands without explicit path, **Then** the environment variable path is used
3. **Given** an invalid path, **When** the user specifies it, **Then** they see a clear error message

---

### Edge Cases

- What happens when the data directory doesn't exist or is empty?
- How does the system handle corrupted session files? → Skip corrupted files with warning, continue with valid sessions
- What happens when a session has no summary/title? → Show truncated first user message (50 chars); timestamp and project path always displayed
- How are very long messages or conversations displayed? → Default to paginated output; `--full` flag for complete output suitable for piping
- What happens when exporting a session with binary/image content?
- How does pagination behave at boundary conditions (first page, last page, beyond range)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a command to list all available sessions with summary information
- **FR-002**: System MUST support pagination for list and search results via limit and offset options
- **FR-003**: System MUST provide a command to view full session content by index or UUID
- **FR-004**: System MUST display messages with clear role labels (user, assistant) and timestamps
- **FR-005**: System MUST format tool calls and tool results in a readable manner
- **FR-006**: System MUST provide a command to search across all sessions with configurable context lines
- **FR-007**: System MUST provide a command to search within a specific session
- **FR-008**: System MUST provide export commands for JSON and Markdown formats
- **FR-009**: System MUST support exporting to stdout or to a specified file path
- **FR-010**: System MUST provide commands to copy or move sessions between workspaces
- **FR-011**: System MUST accept custom data path via command-line option
- **FR-012**: System MUST accept custom data path via environment variable as fallback
- **FR-013**: System MUST provide clear, actionable error messages for all failure cases
- **FR-014**: System MUST provide a help command showing all available commands and options
- **FR-015**: System MUST support workspace filtering for list and search commands
- **FR-016**: System MUST paginate long output by default (interactive scrolling like `less`) and provide a `--full` flag to output complete content for piping to external tools
- **FR-017**: System MUST skip corrupted session files with a warning message and continue processing valid sessions
- **FR-018**: System MUST always display timestamp and project path for each session in list view; when no summary exists, show truncated first user message (50 chars) as fallback

### Key Entities

- **Command**: A CLI subcommand (list, view, search, export, migrate) with its options and arguments
- **Session Reference**: Either a numeric index (0-based) or a UUID string that identifies a session
- **Output Format**: The display format for results (table, detailed view, JSON, Markdown)
- **Workspace Filter**: A project path used to filter sessions to a specific project

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can list all sessions and identify the one they need within 5 seconds of running the command
- **SC-002**: Users can view any session's full content with clear formatting that distinguishes user and assistant messages
- **SC-003**: Search results return relevant matches with enough context (configurable) to understand the match without viewing the full session
- **SC-004**: Exported JSON files are valid and can be parsed by standard JSON tools
- **SC-005**: Exported Markdown files render correctly in standard Markdown viewers
- **SC-006**: All error scenarios produce user-friendly messages that explain what went wrong and how to fix it
- **SC-007**: Command help text is comprehensive enough for users to use all features without external documentation
- **SC-008**: 95% of commands complete within 2 seconds for typical session counts (under 1000 sessions)

## Clarifications

### Session 2025-12-31

- Q: How should long output be handled? → A: Default to paginated output (like `less`) for interactive scrolling; provide `--full` flag to output everything at once for piping to external tools (`| grep`, `| less`, etc.)
- Q: How should corrupted session files be handled? → A: Skip and warn - skip corrupted files, show warning message, continue displaying valid sessions
- Q: What should be shown when a session has no summary? → A: Show truncated first user message (first 50 chars) as fallback; timestamp and project path are always displayed regardless of summary presence

## Assumptions

- The lib layer API (listSessions, getSession, searchSessions, exportSession, migrateSession) is stable and tested
- Users have Node.js runtime available to execute the CLI
- The default Claude Code data directory follows the standard location (~/.claude/projects/)
- Session files are in JSONL format as defined in the existing lib layer
- Users are comfortable with command-line interfaces and standard CLI conventions (--help, subcommands, options)
- Terminal output supports basic text formatting (no assumption about color support needed for MVP)

## Scope Boundaries

### In Scope

- All read operations on session data (list, view, search)
- Export operations (JSON, Markdown)
- Migration operations (copy, move between workspaces)
- Help and usage documentation via --help
- Error handling with user-friendly messages

### Out of Scope

- Interactive/TUI mode (beyond basic stdin/stdout)
- Session editing or modification
- Real-time session monitoring
- Integration with Claude Code directly
- Web-based interface
- Authentication or multi-user support
