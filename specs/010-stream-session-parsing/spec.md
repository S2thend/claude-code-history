# Feature Specification: Memory-Safe Session Listing and Detail Loading

**Feature Branch**: `010-stream-session-parsing`  
**Created**: 2026-04-03  
**Status**: Draft  
**Input**: User description: "Avoid full-session materialization during summary listing and duplicate full-file parses during getSession(); large Claude transcripts can cause OOM when listing or syncing sessions, especially when downstream consumers fetch every untitled session just to derive fallback preview text."

## Clarifications

### Session 2026-04-03

- Q: What peak-memory ceiling should large-fixture session-listing regression tests enforce? → A: 512 MiB peak during large-fixture listSessions().
- Q: Should this feature include downstream vibe-history code changes, or only claude-code-history parser/API changes? → A: CCH library changes only; no vibe-history code changes in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List large session histories without memory failures (Priority: P1)

A developer or downstream product user can list session history for a project that contains many large conversations, including transcripts with long tool outputs, and receive stable summaries without the command terminating from memory exhaustion.

**Why this priority**: Session listing and sync are the first entry point into the history experience; if they fail on large projects, users cannot discover or navigate any conversations.

**Independent Test**: Run session listing against a fixture with many large conversations and verify that summaries are returned, peak memory stays at or below 512 MiB, and no full conversation content is required for sessions that are only being summarized.

**Acceptance Scenarios**:

1. **Given** a project containing many large session transcripts, **When** the user lists sessions, **Then** the user receives one summary per discoverable session without a memory-exhaustion failure.
2. **Given** a session that has no explicit title but does contain user-authored messages, **When** the user lists sessions, **Then** the summary includes a preview derived from the earliest user-authored message so the session can be recognized without opening the full transcript.
3. **Given** a session with linked agent activity, **When** the user lists sessions, **Then** the summary includes the agent-link information needed to represent that relationship.

---

### User Story 2 - Open a large session without duplicate transcript processing (Priority: P2)

A developer can open a single large session and inspect the full conversation plus its metadata without the system redundantly reprocessing the same transcript in a way that spikes peak memory usage.

**Why this priority**: Users need full message content for investigation and review, but a single detail request should not become unreliable or excessively memory-intensive.

**Independent Test**: Open one synthetic session with very large assistant and tool output payloads and verify that the full transcript and metadata are returned while the session source is processed at most once for that request.

**Acceptance Scenarios**:

1. **Given** a large session transcript with many messages and metadata fields, **When** the user opens that session, **Then** the user receives the complete normalized conversation and session metadata from one request without a memory-exhaustion failure.
2. **Given** instrumentation that records transcript processing passes for one session-detail request, **When** the user opens that session, **Then** the same transcript is not processed more than once for that request.

---

### User Story 3 - Render previews in downstream listings without fetching every full session (Priority: P3)

A downstream consumer that displays Claude history can build useful fallback titles/previews directly from listing results instead of opening every untitled session, reducing memory pressure and unnecessary detail reads. This feature must provide that summary data from `claude-code-history`, but downstream application code changes are out of scope for this branch.

**Why this priority**: This removes an integration-layer trigger for OOM and makes listing-based experiences faster and safer at scale.

**Independent Test**: For a mixed set of titled and untitled sessions, request only summaries and verify that a downstream listing view can render previews for untitled sessions without issuing per-session detail reads.

**Acceptance Scenarios**:

1. **Given** a collection of untitled sessions where each session has at least one user message, **When** a consumer renders a listing from summary data only, **Then** the consumer can display fallback preview text for each such session without opening the full session details.
2. **Given** a session with no usable title and no extractable user preview text, **When** a consumer renders a listing from summary data only, **Then** the consumer still receives a safe fallback label and the rest of the listing remains usable.

---

### Edge Cases

- A transcript contains malformed or partially written records mixed with valid records.
- A transcript contains extremely large tool output or assistant message payloads.
- A session has no title, no user-authored messages, or only system/tool records.
- A linked agent transcript is missing, unreadable, or references a session that is no longer present.
- Multiple large sessions are listed in one request while another consumer simultaneously opens individual session details.
- Session timestamps, branch metadata, or agent-link metadata are missing or inconsistent across records.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Session listing MUST return summary rows for all discoverable sessions without requiring the full message history of each listed session to be retained in memory at the same time.
- **FR-002**: Session summaries MUST include, when available, the session title, a fallback preview derived from the earliest user-authored message, first and last activity timestamps, message count, branch name, and linked agent-session relationships.
- **FR-003**: Session-detail retrieval MUST return the full normalized conversation and summary metadata for the requested session while ensuring that each underlying transcript source is processed no more than once per request.
- **FR-004**: Summary-only workflows MUST be able to compute titles, preview text, timestamps, message counts, branch metadata, and agent links incrementally without retaining a full raw transcript representation for every listed session.
- **FR-005**: When a transcript record is malformed, incomplete, or missing nonessential metadata, the system MUST continue processing the rest of the session or listing, expose a safe fallback value where possible, and avoid failing the entire request unless the session source itself is unreadable.
- **FR-006**: Existing consumers of session summaries and session details MUST continue to receive all previously exposed user-visible session information, with preview text added to summaries as a non-breaking extension.
- **FR-007**: Session listing MUST provide enough preview information for downstream consumers to generate fallback labels for untitled sessions without fetching each full session detail individually.
- **FR-008**: Regression coverage MUST include large synthetic sessions with oversized assistant/tool-result content and verify both successful completion with session-listing peak memory at or below 512 MiB and the absence of duplicate processing passes for one session-detail request.
- **FR-009**: This feature MUST deliver the parser, summary, and detail-loading changes in `claude-code-history` only; modifying downstream `vibe-history` consumer code is explicitly out of scope.

### Key Entities

- **Session Summary**: A compact representation of one conversation for listing views, including title or fallback preview, activity timestamps, message count, branch metadata, and agent-link references.
- **Session Detail**: The full ordered conversation for one session plus the metadata needed to display and relate that session in history views.
- **Session Transcript**: The source record sequence for one conversation, which may contain user messages, assistant messages, tool outputs, metadata, and malformed or partial records.
- **Agent Link**: A relationship between a main session and a child agent session, including the identifiers and display metadata needed for navigation.

## Assumptions

- Preview text for untitled sessions should use the earliest user-authored message after trimming whitespace and applying a reasonable display-length limit; if no such message exists, the existing generic fallback label remains acceptable.
- The feature should preserve current session discovery and detail semantics while reducing peak memory usage and redundant transcript processing.
- Memory validation can use large synthetic transcript fixtures that reflect the size and shape of real conversations with very large tool outputs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Listing a fixture with at least 1,000 sessions, including at least 25 very large transcripts, completes successfully with no memory-exhaustion failure and with peak memory at or below 512 MiB.
- **SC-002**: Opening one very large session returns the complete conversation and metadata successfully, and validation shows that the session source was processed no more than once for that request.
- **SC-003**: For at least 95% of untitled sessions that contain a user-authored message, listing results alone provide enough preview text for a consumer to render a meaningful fallback label without a detail fetch.
- **SC-004**: Compared with the current behavior on the same large-session fixture, the number of full session-detail fetches needed solely for fallback previews in downstream listings is reduced by at least 90%.
- **SC-005**: In repeated runs over large synthetic fixtures, session listing and single-session detail retrieval both complete with zero unhandled failures caused by malformed individual transcript records.
