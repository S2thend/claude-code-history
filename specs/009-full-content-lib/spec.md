# Feature Specification: Full Content Library Output

**Feature Branch**: `009-full-content-lib`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Library/session data consumers must always receive complete, untruncated message and tool content; any shortening is a display-only concern in the command-line viewer, and full-detail mode should disable that shortening entirely."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retrieve Complete Session Content Programmatically (Priority: P1)

As a developer consuming session history outside the interactive viewer, I want every message, tool input, tool result, and parser warning content field returned in full so that exports, analysis, and downstream tooling never lose data because of presentation shortcuts.

**Why this priority**: Data loss in non-interactive consumption is the core defect this feature fixes and directly breaks programmatic users who need exact transcript content.

**Independent Test**: Load a session containing long user messages, long assistant messages, long file-edit inputs, and long tool outputs through the session retrieval interface, parse a malformed JSONL line with long warning content, and verify that every caller-visible field is returned exactly as recorded with no omission markers or length cuts.

**Acceptance Scenarios**:

1. **Given** a session contains tool inputs and tool results longer than the viewer's default display limit, **When** a programmatic consumer retrieves that session, **Then** all tool input and tool result content is returned in full with no truncation.
2. **Given** a session contains long user or assistant text messages, **When** a programmatic consumer retrieves that session, **Then** the complete message text is returned exactly as recorded.
3. **Given** a user views the same session in either concise display mode or full-detail display mode, **When** a programmatic consumer later retrieves the session, **Then** the retrieved content is identical in both cases and is unaffected by viewer settings.
4. **Given** a session contains multi-line diffs, command output, search results, empty strings, and non-ASCII text, **When** a programmatic consumer retrieves that session, **Then** all content, ordering, and line breaks are preserved.
5. **Given** a malformed JSONL line contains warning content longer than the old preview threshold, **When** a programmatic parser consumer reads that warning, **Then** the complete parser-warning content is returned in full after existing trim normalization.

---

### User Story 2 - View Complete Session Content On Demand (Priority: P1)

As a command-line user inspecting a session, I want a full-detail viewing mode that shows the entire transcript without abbreviation so that I can inspect complete file diffs, file contents, and command output when needed.

**Why this priority**: Users need a reliable "show everything" mode to verify exact content, debug issues, and compare CLI output against programmatic retrieval.

**Independent Test**: Open a session with long tool inputs, tool results, and thinking blocks in full-detail mode and verify that all content appears with no omission markers and no shortened fields.

**Acceptance Scenarios**:

1. **Given** a session contains long tool inputs such as file edit diffs, **When** the user opens the session in full-detail mode, **Then** the full tool input is displayed with no abbreviation.
2. **Given** a session contains long tool results such as file reads or command output, **When** the user opens the session in full-detail mode, **Then** the full tool result is displayed with no abbreviation.
3. **Given** full-detail mode is enabled, **When** the viewer renders long text messages, thinking blocks, and tool content, **Then** no display-layer truncation or omission markers are applied to any message field.
4. **Given** full-detail mode is enabled, **When** the viewer writes output, **Then** the same single user choice that requests full detail also preserves the existing no-pager behavior for that mode.

---

### User Story 3 - Keep Default Session Viewing Concise (Priority: P2)

As a command-line user quickly scanning a session, I want long tool inputs and outputs to remain concise by default so that routine viewing stays readable, while still preserving an obvious path to the complete content.

**Why this priority**: Concise default output preserves terminal readability and remains useful as long as users can opt into full detail without losing access to the underlying data.

**Independent Test**: Open a session with long tool inputs/results in default viewing mode and verify that the output stays readable, any abbreviations are clearly indicated, rerunning the same view in full-detail mode reveals the complete content, and later programmatic retrieval/export still returns the original full payloads.

**Acceptance Scenarios**:

1. **Given** a session contains very long tool inputs, tool results, thinking blocks, or fallback tool-result previews, **When** the user opens the session in default viewing mode, **Then** the viewer may abbreviate those long fields for readability using the existing caps of 500 characters for tool results, 300 for tool inputs, 100 for thinking blocks, and 200 for fallback tool-result previews.
2. **Given** a field is abbreviated in default viewing mode, **When** the viewer renders that field, **Then** the user can clearly tell that content was omitted from display because the viewer uses a dedicated `[...truncated for display]` marker rather than source-authored `...` text.
3. **Given** a field is abbreviated in default viewing mode, **When** the same session is opened in full-detail mode, **Then** the complete field content is displayed.
4. **Given** the default viewer abbreviates long tool content, **When** the user inspects surrounding messages and metadata, **Then** message ordering and visible metadata remain consistent with the full-detail view.

### Edge Cases

- What happens when a single message or tool payload is extremely large and contains no natural line breaks? Default viewing may abbreviate the display, but full-detail viewing and programmatic retrieval still provide the complete content.
- What happens when source content already contains text that looks like an omission marker? Programmatic retrieval preserves the source text exactly, and default viewing uses the dedicated `[...truncated for display]` marker so source-authored `...` text remains distinguishable from display-added abbreviations.
- What happens when a tool input or result is empty, missing, or structurally nested? Empty values remain empty, missing values remain distinguishable from empty strings, and nested content is preserved without display decisions leaking into retrieved data.
- What happens when content contains non-ASCII characters, multi-line text, or leading/trailing whitespace? Programmatic retrieval and full-detail viewing preserve the content exactly as recorded.
- What happens when a user switches between default viewing and full-detail viewing for the same session? Only display abbreviation changes; the underlying retrieved content and message ordering do not.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Session retrieval and parser warning workflows for programmatic consumers MUST return the full, untruncated content of every user message, assistant message, tool input, tool result, and parser-warning content field.
- **FR-002**: Data-returning session workflows MUST NOT shorten content, replace content with omission markers, or otherwise alter field length as a presentation shortcut before returning data to callers.
- **FR-003**: Programmatic session retrieval MUST preserve complete file-read output, command output, search results, file-edit diffs, and any other tool payload content exactly as recorded.
- **FR-004**: Default command-line session viewing MAY abbreviate long tool inputs, tool results, thinking blocks, and fallback tool-result previews for readability, but any abbreviation MUST be applied only while rendering display output and MUST preserve the existing default caps of 300, 500, 100, and 200 characters respectively.
- **FR-005**: Any abbreviation shown in default command-line session viewing MUST use the dedicated `[...truncated for display]` marker so users can distinguish display-added omission from source-authored `...` text.
- **FR-006**: Full-detail command-line viewing MUST display the complete content of all message text, thinking blocks, tool inputs, and tool results with no field-level abbreviation.
- **FR-007**: The same full-detail user control MUST disable display abbreviation and preserve that mode's existing no-pager behavior so users have a single "show everything" switch.
- **FR-008**: Switching between default and full-detail command-line viewing MUST NOT change the content returned by programmatic session retrieval or exports.
- **FR-009**: Message order, message metadata, and tool-result association MUST remain unchanged by any display-only abbreviation behavior.

### Key Entities

- **Session Transcript**: The ordered set of user messages, assistant messages, tool requests, and tool results that represents one conversation history.
- **Message Text Content**: The human-readable body of a user or assistant message that must be preserved exactly for retrieval and full-detail viewing.
- **Tool Input Content**: The arguments supplied to a tool action, including file paths, file-edit diffs, and other structured or multi-line input data.
- **Tool Result Content**: The output produced by a tool action, including file contents, command output, search results, and other structured or free-form result data.
- **Display Mode**: The viewer choice that determines whether long content is shown concisely by default or shown in full detail without abbreviation.

## Assumptions

- Existing session records already contain the complete source content needed for retrieval and full-detail viewing; this feature is about preserving and presenting that content correctly, not reconstructing missing data.
- Default command-line viewing may keep the existing concise abbreviation thresholds of 300 characters for tool inputs, 500 for tool results, 100 for thinking blocks, and 200 for fallback tool-result previews as long as those abbreviations are display-only and clearly marked.
- Full-detail mode is intended to be the single user-facing choice for "show everything," including the existing no-pager behavior already associated with that mode.
- This feature does not change session discovery, session ordering, or message parsing semantics except where necessary to prevent data truncation before retrieval.

## Dependencies

- Users rely on both programmatic session retrieval and command-line session viewing as valid ways to inspect the same underlying transcript data.
- Long tool inputs and tool results are common enough that concise default display and complete full-detail display both remain valuable user experiences.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing with sessions containing fields longer than 1,000 characters, 100% of programmatic retrieval and export checks return every character of each message and tool-content field with no truncation.
- **SC-002**: In acceptance testing with long file diffs, file reads, command output, and text messages, 100% of full-detail session-view checks display the complete content with no omission markers added by the viewer.
- **SC-003**: In acceptance testing with long tool payloads, 100% of default session-view checks that abbreviate content show the dedicated `[...truncated for display]` marker and preserve source-authored `...` text distinctly.
- **SC-004**: For the same session, 100% of programmatic retrieval comparisons return identical full content regardless of whether the user previously viewed that session in default mode or full-detail mode.
- **SC-005**: In regression testing across representative sessions with long messages, long tool inputs, long tool results, empty values, and non-ASCII text, 0 cases show data loss in programmatic retrieval or full-detail viewing due to display-layer abbreviation.
