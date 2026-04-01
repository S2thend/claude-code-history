# Feature Specification: Support Progress Messages

**Feature Branch**: `001-support-progress-messages`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "cch currently drops type: progress entries during parsing, so their content never reaches search or view, which is why the bug is real. Add first-class support for progress messages in the parser and message model, then include them in text extraction and display/filter logic so cch search and cch view can surface their content."

## Clarifications

### Session 2026-04-01

- Q: How should progress filtering work in `cch view`? → A: Add a dedicated `progress` filter value for `cch view --only progress`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Progress Content (Priority: P1)

As a developer searching past Claude Code sessions, I want `cch search` to return matches that appear only in progress messages so I can find all relevant session content without falling back to raw file inspection.

**Why this priority**: The current gap breaks the core promise of search and forces users to bypass the product when the missing content only appears in progress updates.

**Independent Test**: Can be fully tested by searching for a unique term that appears only inside a progress message and verifying the term is returned in both all-session search and single-session search.

**Acceptance Scenarios**:

1. **Given** a session where a search term appears only in a progress message, **When** the user runs `cch search "<term>"`, **Then** the command returns that session as a match with readable context from the progress message.
2. **Given** a session where a search term appears only in a progress message, **When** the user runs `cch search "<term>" --session <session>`, **Then** the command returns the match from that session instead of reporting no results.
3. **Given** a search term appears in both progress messages and other message types, **When** the user runs a search, **Then** the output includes matches from all relevant message types.

---

### User Story 2 - View Progress Messages in Session History (Priority: P1)

As a developer reviewing a session transcript, I want `cch view` to show progress messages in the conversation timeline so I can understand what happened during tool execution without opening the raw session file.

**Why this priority**: Session review is incomplete if visible session activity is omitted from the main transcript, especially when progress updates contain file names, status text, or intermediate tool output.

**Independent Test**: Can be fully tested by viewing a session containing progress messages and verifying that those messages appear in order in both the human-readable transcript and JSON output.

**Acceptance Scenarios**:

1. **Given** a session with progress messages between user and assistant messages, **When** the user runs `cch view <session>`, **Then** the progress messages appear in chronological order at the correct point in the transcript.
2. **Given** a session with progress messages, **When** the user runs `cch view <session> --json`, **Then** the returned message list includes the progress messages with their type preserved.
3. **Given** a session where the only content between two conversational turns is a progress message, **When** the session is viewed, **Then** the progress message is still shown rather than silently skipped.

---

### User Story 3 - Filter Progress Activity During Review (Priority: P2)

As a developer troubleshooting a session, I want progress messages to participate in session filtering so I can isolate progress activity or keep it included when narrowing the transcript.

**Why this priority**: Once progress messages are visible, users need the same control over them that they already expect for other visible message categories.

**Independent Test**: Can be tested by filtering a session that contains progress messages and verifying that progress messages can be included in filtered views and isolated on their own.

**Acceptance Scenarios**:

1. **Given** a session with progress messages and other message types, **When** the user runs `cch view <session> --only progress`, **Then** only progress messages are shown.
2. **Given** a session with progress messages and other message types, **When** the user applies a filter that includes progress messages alongside other types, **Then** progress messages remain present in the filtered output.
3. **Given** a session with no progress messages, **When** the user runs `cch view <session> --only progress`, **Then** the command returns an informative empty result rather than failing.

### Edge Cases

- What happens when a progress message contains no human-readable text? The system omits non-readable content from search results and displays an understandable placeholder or empty-safe output rather than failing.
- What happens when a search term exists only in progress messages across all matching sessions? The search still returns those sessions instead of reporting zero matches.
- What happens when progress messages are interleaved with user, assistant, or tool-related messages? The view preserves original session order so the transcript remains accurate.
- What happens when `--only progress` is requested for a session with no progress messages? The user receives the same kind of informative empty-state response used for other filters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST preserve progress messages when reading session history instead of discarding them.
- **FR-002**: The system MUST treat progress messages as first-class session messages with their own identifiable message type.
- **FR-003**: `cch search` MUST include searchable text from progress messages when searching across all sessions.
- **FR-004**: `cch search --session <session>` MUST include searchable text from progress messages when searching within a single session.
- **FR-005**: Search results sourced from progress messages MUST identify the originating session, message, and context in the same way other searchable messages do.
- **FR-006**: `cch view <session>` MUST display progress messages in the correct chronological position within the session transcript.
- **FR-007**: Human-readable session output MUST visually distinguish progress messages from user messages and assistant responses.
- **FR-008**: `cch view <session> --json` MUST include progress messages in the returned message list with their message type preserved.
- **FR-009**: Session filtering MUST support a dedicated `progress` filter value.
- **FR-010**: Session filtering MUST support including progress messages in filtered output when the `progress` filter value is requested alone or alongside other filter values.
- **FR-011**: Session-level message counts and filtered message counts presented to users MUST include progress messages when those messages are part of the displayed result set.
- **FR-012**: The system MUST handle progress messages with missing or non-searchable text without crashing or corrupting output.
- **FR-013**: Existing visible search and view behavior for already-supported session content MUST remain unchanged except for the addition of progress-message support.

### Key Entities *(include if feature involves data)*

- **Progress Message**: A time-stamped session entry representing intermediate tool or task progress that contains user-visible status or output text and belongs in the session transcript.
- **Search Match**: A searchable result that links a matched term to its source session, source message, message type, and surrounding context.
- **Session Transcript**: The ordered set of viewable session messages that users inspect through `cch view`, including conversational and progress activity.

## Assumptions

- Progress messages are part of the user-visible history and should be included by default in both search and session viewing.
- Users benefit from being able to identify progress messages explicitly rather than having them merged into another message category.
- Progress-only filtering should follow the same empty-state behavior already used for other filtered views.
- Only human-readable portions of progress messages need to be searchable and displayed as transcript content.

## Dependencies

- Session histories already contain progress entries that users need to inspect through existing `cch search` and `cch view` workflows.
- Search results and session views remain the primary product surfaces for discovering and reviewing session content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of terms that appear only in progress messages are returned by both global search and session-scoped search.
- **SC-002**: In acceptance testing, 100% of progress messages present in a session appear in `cch view` output and in JSON session output in their original order.
- **SC-003**: Users can isolate progress activity from a 100+ message session in a single filtered view without needing to inspect the raw session file.
- **SC-004**: Standard search and view behavior for sessions that do not contain progress messages remains unchanged in user-facing acceptance tests.
