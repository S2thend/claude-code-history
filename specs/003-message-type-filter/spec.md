# Feature Specification: Message Type Filter

**Feature Branch**: `003-message-type-filter`
**Created**: 2026-01-12
**Status**: Draft
**Input**: User description: "Add message type filter to show command - filter by tool calls, user messages, or assistant responses"

## Clarifications

### Session 2026-01-11

- Q: Should thinking blocks and error messages be separate filter types or grouped with assistant/tool? → A: Add `thinking` and `error` as additional filter types (5 types total: user, assistant, tool, thinking, error)

### Session 2026-01-12

- Q: How are message types detected - text markers or structured data? → A: Use structured data types from existing type system (MessageType, AssistantContent subtypes, is_error flag)
- Q: When filtering, how should mixed-content messages (e.g., text + tool_use) be handled? → A: Include entire message if ANY content block matches the filter

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter to User Messages Only (Priority: P1)

As a user reviewing a long chat session, I want to see only my own messages so I can quickly review what questions I asked without scrolling through lengthy AI responses and tool outputs.

**Why this priority**: This is the most common use case - users often want to see just their prompts to understand the conversation flow or copy their questions for reuse.

**Independent Test**: Can be tested by running `cch view 1 --only user` and verifying only user messages appear in output.

**Acceptance Scenarios**:

1. **Given** a session with mixed user, assistant, and tool messages, **When** I run `view <index> --only user`, **Then** I see only messages from role "user" with their timestamps
2. **Given** a session with no user messages (edge case), **When** I run `view <index> --only user`, **Then** I see an informative message indicating no matching messages

---

### User Story 2 - Filter to Tool Calls Only (Priority: P1)

As a developer debugging a session, I want to see only the tool calls (file reads, writes, terminal commands) so I can understand what actions the AI took without reading through explanations.

**Why this priority**: Equally important as user filter - developers frequently need to audit what operations were performed.

**Independent Test**: Can be tested by running `cch view 1 --only tool` and verifying only tool call messages appear.

**Acceptance Scenarios**:

1. **Given** a session with tool calls, **When** I run `view <index> --only tool`, **Then** I see only messages containing tool operations with file paths and parameters
2. **Given** a session with no tool calls, **When** I run `view <index> --only tool`, **Then** I see an informative message indicating no matching messages

---

### User Story 3 - Filter to Assistant Responses Only (Priority: P2)

As a user, I want to see only the AI assistant's explanatory responses (excluding tool calls and thinking) so I can review the actual answers and guidance provided.

**Why this priority**: Useful for reviewing AI explanations without the noise of tool outputs, but slightly less common than filtering to user prompts or tool calls.

**Independent Test**: Can be tested by running `cch view 1 --only assistant` and verifying only assistant text responses appear.

**Acceptance Scenarios**:

1. **Given** a session with assistant responses, **When** I run `view <index> --only assistant`, **Then** I see only assistant explanatory text (not tool calls, not thinking blocks)
2. **Given** a session where all assistant messages are tool calls, **When** I run `view <index> --only assistant`, **Then** I see an informative message indicating no matching messages

---

### User Story 4 - Filter with Multiple Types (Priority: P2)

As a user, I want to combine multiple filters so I can see exactly the message types relevant to my review (e.g., user messages and tool calls together, excluding verbose assistant explanations).

**Why this priority**: Provides flexibility for advanced users who need specific combinations.

**Independent Test**: Can be tested by running `cch view 1 --only user,tool` and verifying both user and tool messages appear but assistant responses are excluded.

**Acceptance Scenarios**:

1. **Given** a session with all message types, **When** I run `view <index> --only user,tool`, **Then** I see user messages and tool calls but not assistant text responses
2. **Given** I specify all five types `--only user,assistant,tool,thinking,error`, **When** the command runs, **Then** behavior is equivalent to no filter (all messages shown)

---

### User Story 5 - Filter to Thinking Blocks (Priority: P3)

As a developer, I want to see only thinking blocks so I can understand the AI's reasoning process separately from its responses.

**Why this priority**: Lower priority as thinking blocks are less frequently reviewed in isolation.

**Independent Test**: Can be tested by running `cch view 1 --only thinking` and verifying only thinking block messages appear.

**Acceptance Scenarios**:

1. **Given** a session with thinking blocks, **When** I run `view <index> --only thinking`, **Then** I see only thinking block content
2. **Given** a session with no thinking blocks, **When** I run `view <index> --only thinking`, **Then** I see an informative message indicating no matching messages

---

### User Story 6 - Filter to Error Messages (Priority: P3)

As a developer debugging issues, I want to see only error messages so I can quickly identify what went wrong during a session.

**Why this priority**: Lower priority but valuable for troubleshooting sessions.

**Independent Test**: Can be tested by running `cch view 1 --only error` and verifying only error messages appear.

**Acceptance Scenarios**:

1. **Given** a session with error messages, **When** I run `view <index> --only error`, **Then** I see only error message content
2. **Given** a session with no errors, **When** I run `view <index> --only error`, **Then** I see an informative message indicating no matching messages

---

### Edge Cases

- What happens when filter value is invalid (e.g., `--only invalid`)? Display error message listing valid options.
- What happens when filter results in zero messages? Display informative message rather than empty output.
- How does filter interact with existing display options (`--json`)? Filters apply first, then display options format the filtered results.
- How does filter work with `--json` output? JSON output includes only filtered messages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support `--only <type>` option on the `view` command to filter displayed messages
- **FR-002**: System MUST accept the following filter values: `user`, `assistant`, `tool`, `thinking`, `error`
- **FR-003**: System MUST support comma-separated multiple values (e.g., `--only user,tool`)
- **FR-004**: System MUST display an error with valid options when an invalid filter value is provided
- **FR-005**: System MUST display an informative message when filter results in zero messages
- **FR-006**: System MUST apply filters before existing display formatting options
- **FR-007**: System MUST support the `--only` filter in JSON output mode
- **FR-008**: System MUST preserve message ordering and timestamps in filtered output
- **FR-009**: The library API MUST expose filter functionality through the session retrieval options
- **FR-010**: System MUST include entire message when ANY content block matches the filter (mixed-content messages show all blocks)

### Message Type Classification

- **User messages** (`user`): Messages with `type: 'user'` in the data structure
- **Tool calls** (`tool`): Assistant messages containing `content` blocks with `type: 'tool_use'`
- **Assistant responses** (`assistant`): Assistant messages with `type: 'text'` content blocks (excluding tool_use and thinking blocks)
- **Thinking blocks** (`thinking`): Assistant messages containing `content` blocks with `type: 'thinking'`
- **Error messages** (`error`): User messages containing tool results with `is_error: true` flag

### Key Entities

- **MessageFilter**: The filter criteria specifying which message types to include (user, assistant, tool, thinking, error)
- **FilteredSession**: A session where messages have been filtered according to the specified criteria

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can filter a 100+ message session to show only their messages in under 1 second
- **SC-002**: Filter output correctly excludes 100% of non-matching message types
- **SC-003**: All existing tests continue to pass after adding filter functionality
- **SC-004**: Library API users can filter messages programmatically with the same options as CLI

## Assumptions

- Message type classification uses the existing structured type system (MessageType, AssistantContent, ToolResultContent)
- Mixed-content filtering: when an assistant message contains multiple content block types (e.g., text + tool_use), the entire message is included if any block matches the filter
- The filter is applied at display time, not at the database query level (simpler implementation, adequate performance)
- The command name is `view` (not `show`) based on the existing CLI structure in CLAUDE.md
