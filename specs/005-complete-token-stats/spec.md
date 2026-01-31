# Feature Specification: Complete Token Statistics

**Feature Branch**: `005-complete-token-stats`
**Created**: 2026-01-30
**Status**: Draft
**Input**: User description: "Add complete token statistics including cache tokens (cache_read_input_tokens, cache_creation_input_tokens) and cost estimation with model pricing table. Currently only inputTokens + outputTokens are displayed, missing the cache-related tokens that make up a large proportion in Claude Code scenarios."

## Clarifications

### Session 2026-01-30

- Q: Where should the session-level token summary appear when viewing a session? → A: Footer summary after all messages (total tokens breakdown at bottom of session output).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Complete Token Usage Per Session (Priority: P1)

As a developer, I want to see the complete token breakdown for a session including all four token types (input, output, cache read, cache creation) so I can accurately understand my Claude Code usage.

**Why this priority**: This is the core problem identified—users currently see incomplete token counts that severely undercount actual usage because cache tokens are omitted from display and aggregation.

**Independent Test**: Can be fully tested by viewing any session and verifying all four token categories are displayed with correct totals.

**Acceptance Scenarios**:

1. **Given** a session with messages containing cache token usage, **When** the user runs `cch view <session>`, **Then** the session summary displays total input tokens, output tokens, cache read tokens, and cache creation tokens separately.

2. **Given** a session with multiple assistant messages, **When** viewing the session, **Then** the displayed token totals match the sum of all individual message token counts across all four categories.

3. **Given** a session where cache_read_input_tokens is 50,000 and input_tokens is 100, **When** viewing the session, **Then** both values are displayed showing the true scope of token usage (not just "100 tokens").

---

### User Story 2 - View Aggregated Token Statistics Across Sessions (Priority: P2)

As a developer, I want to see aggregated token statistics when listing sessions so I can understand my overall Claude Code usage patterns without viewing each session individually.

**Why this priority**: Once individual session stats work correctly, users need aggregate views to understand usage across their project or workspace.

**Independent Test**: Can be tested by running `cch list` with a stats flag and verifying aggregated totals match the sum of individual sessions.

**Acceptance Scenarios**:

1. **Given** multiple sessions in a workspace, **When** the user runs `cch list --stats`, **Then** the output includes aggregate token counts summed across all listed sessions.

2. **Given** sessions filtered by workspace, **When** listing with stats enabled, **Then** aggregates reflect only the filtered sessions, not all sessions.

3. **Given** the `--json` output format, **When** listing with stats, **Then** the JSON includes a `statistics` object with all four token type totals.

---

### Edge Cases

- What happens when a message has no usage data (undefined/null)? System treats as zero tokens, not error.
- What happens when token values are missing individual fields? System defaults missing fields to zero.
- What happens when a session has zero assistant messages? Token totals display as zero.
- How does the system handle very large token counts (millions)? Numbers are formatted with locale-appropriate separators.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST aggregate all four token types (input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens) when calculating session totals.
- **FR-002**: System MUST display token breakdown showing each of the four token categories separately, not just a combined total.
- **FR-003**: System MUST display a session-level token totals summary as a footer after all messages when viewing a session.
- **FR-004**: System MUST support a `--stats` flag on the `list` command to show aggregated token statistics across listed sessions.
- **FR-005**: System MUST format large token numbers with locale-appropriate thousand separators for readability.
- **FR-006**: System MUST include token statistics in JSON output when `--json` flag is used.
- **FR-007**: System MUST gracefully handle missing or malformed token usage data by defaulting to zero.

### Key Entities

- **TokenUsage**: Represents token consumption for a single API call with four components: inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens (already exists in codebase).
- **AggregateTokenStats**: Aggregated token statistics for an entire session (or across sessions), summing all message-level TokenUsage. Extends TokenUsage with a computed `totalTokens` field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can see all four token categories (input, output, cache read, cache creation) when viewing any session, with values matching the raw JSONL data.
- **SC-002**: Session-level token totals accurately reflect the sum of all assistant message token counts within that session.
- **SC-003**: Aggregate statistics across sessions sum correctly when verified against individual session totals.
- **SC-004**: Token statistics display correctly for sessions of all sizes, from single-message to 1000+ message sessions.

## Constraints

- All changes MUST pass linting (Prettier), type checking (TypeScript strict mode), and existing tests before merge.
- No regressions in existing functionality.
- CLI layer (`src/cli/`) MUST only contain terminal UI code (formatting, output, command parsing). All token aggregation and history file processing logic MUST live in the core library (`src/lib/`). CLI depends on lib, never the reverse.

## Implementation Order

1. **Verify core first**: Write tests against the existing core library to confirm `TokenUsage` (including `cacheCreationInputTokens` and `cacheReadInputTokens`) is correctly returned from parsed sessions. If core does not return cache tokens correctly, fix the core before proceeding.
2. **Add aggregation to core**: Implement session-level token aggregation in `src/lib/`, export the interface.
3. **Document core interface**: Document how CLI consumers should use the exported token statistics interfaces.
4. **Build CLI display**: Only then implement CLI formatting and command options that consume the core exports.

## Assumptions

- The existing `TokenUsage` type and `transformTokenUsage()` function correctly extract all four token fields from JSONL (verified in codebase exploration — needs runtime verification).
- Token counts in JSONL are integers and do not require special handling for floating-point precision.
- Users prefer seeing detailed token breakdowns over simplified totals, given the significant difference cache tokens can make.
- Cost estimation is explicitly out of scope for this feature; pricing models change frequently and can be considered in a future iteration.
