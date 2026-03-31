# Feature Specification: Optional API Limit for listSessions()

**Feature Branch**: `006-optional-api-limit`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "listSessions() library API should return all sessions when no limit is passed"

## Clarifications

### Session 2026-03-31

- Q: When no limit is applied, what should `pagination.limit` contain? → A: Set `limit` to the count of items actually returned (e.g., `limit: 84` when 84 sessions are returned). The `Pagination` type stays `number` — no type change needed.
- Q: Should `listSessions({ limit: undefined })` be treated differently from omitting `limit`? → A: No. Both mean "no numeric limit" and return all sessions; this is a clarification of the same requirement, not a separate requirement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Library Consumer Retrieves All Sessions (Priority: P1)

A downstream library consumer (e.g., a sync engine) calls `listSessions()` without specifying a `limit` parameter and expects to receive every available session on the machine. Currently, the library silently caps results to 50 due to a default configuration value applied at the library layer, causing the consumer to miss sessions beyond the first 50.

After this change, calling `listSessions()` with no \`limit\` returns all sessions on the machine, enabling complete data retrieval for sync, backup, and aggregation use cases.

**Why this priority**: This is the core bug. Library consumers who omit `limit` have a reasonable expectation of receiving all results. The silent cap to 50 causes data loss in downstream integrations without any warning.

**Independent Test**: Can be fully tested by calling `listSessions()` with no config on a data set containing more than 50 sessions and verifying that all sessions on the machine are returned.

**Acceptance Scenarios**:

1. **Given** a data directory containing 94 sessions, **When** a library consumer calls `listSessions()` with no config, **Then** the result contains all 94 sessions and pagination indicates no more results remain.
2. **Given** a data directory containing 94 sessions, **When** a library consumer calls `listSessions({})` with an empty config object, **Then** the result contains all 94 sessions.
3. **Given** a data directory containing 94 sessions, **When** a library consumer calls `listSessions({ offset: 10 })` with only an offset, **Then** the result contains 84 sessions (all sessions from offset 10 onward) and pagination indicates no more results remain.

---

### User Story 2 - Library Consumer Requests Explicit Limit (Priority: P1)

A library consumer calls `listSessions({ limit: 20 })` with an explicit limit and receives exactly the requested number of results. This existing behavior must continue to work identically after the change. Related session-enumerating helpers such as search and export-all must also honor the new no-limit default when no numeric `limit` is passed.

**Why this priority**: Preserving backward compatibility for consumers who explicitly pass a limit is equally critical. No existing integrations should break.

**Independent Test**: Can be fully tested by calling `listSessions({ limit: 20 })` on a data set with more than 20 sessions and verifying exactly 20 are returned with correct pagination metadata. Separately, call `searchSessions()`, `exportAllSessionsToJson()`, and `exportAllSessionsToMarkdown()` without a numeric `limit` on a data set containing more than 50 sessions and verify each considers all available sessions.

**Acceptance Scenarios**:

1. **Given** a data directory containing 94 sessions, **When** a library consumer calls `listSessions({ limit: 20 })`, **Then** the result contains exactly 20 sessions and pagination indicates `hasMore: true`.
2. **Given** a data directory containing 94 sessions, **When** a library consumer calls `listSessions({ limit: 20, offset: 80 })`, **Then** the result contains 14 sessions and pagination indicates `hasMore: false`.
3. **Given** a data directory containing 94 sessions and search matches that occur in sessions beyond the first 50, **When** a library consumer calls `searchSessions()` without a numeric `limit`, **Then** the result includes matches from all qualifying sessions rather than stopping at session 50.
4. **Given** a data directory containing 94 sessions, **When** a library consumer calls `exportAllSessionsToJson()` without a numeric `limit`, **Then** the exported JSON contains all 94 sessions.
5. **Given** a data directory containing 94 sessions, **When** a library consumer calls `exportAllSessionsToMarkdown()` without a numeric `limit`, **Then** the exported Markdown contains all 94 sessions.

---

### User Story 3 - CLI User Sees Paginated Output by Default (Priority: P2)

A CLI user runs `cch list` without flags and sees a paginated list of up to 50 sessions, maintaining the current user experience. The CLI layer continues to apply its own display default of 50 sessions, separate from the library layer.

**Why this priority**: The CLI display experience should remain unchanged. Users interacting via the terminal expect a manageable default page size.

**Independent Test**: Can be fully tested by running the `cch list` CLI command and verifying the output displays at most 50 sessions with pagination hints.

**Acceptance Scenarios**:

1. **Given** a data directory containing 94 sessions, **When** a user runs `cch list` with no flags, **Then** the CLI displays at most 50 sessions with a pagination hint showing more are available.
2. **Given** a data directory containing 94 sessions, **When** a user runs `cch list --limit 10`, **Then** the CLI displays exactly 10 sessions.

---

### Edge Cases

- What happens when `listSessions()` is called with `limit: 0`? The system should return zero sessions (existing validation behavior: limit must be non-negative).
- What happens when the data directory contains zero sessions and no limit is specified? The system should return an empty result set with pagination total of 0.
- What happens when `offset` exceeds the total number of sessions and no limit is specified? The system should return an empty result set with correct pagination metadata.
- What happens when `limit` is explicitly set to `undefined` in the config object? The system should treat it the same as omitting it (return all sessions on the machine).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The library MUST return all sessions on the machine when `listSessions()` is called without a numeric `limit` in the configuration, including when the `limit` property is omitted or explicitly set to `undefined`.
- Clarification: Explicit `limit: undefined` is treated the same as omitting `limit`; both invoke the same no-limit behavior.
- **FR-003**: The library MUST continue to respect an explicitly provided numeric `limit` and return at most that many sessions.
- **FR-004**: The library MUST correctly apply `offset` when no `limit` is provided, returning all sessions from the offset position onward.
- **FR-005**: The pagination metadata MUST accurately reflect the actual result set: when no limit is applied, `hasMore` MUST be `false` (since all remaining items are returned).
- **FR-006**: The pagination metadata `limit` field MUST be set to the count of items actually returned when no explicit limit is provided. The `Pagination` type remains `number` with no type change.
- **FR-007**: The CLI `list` command MUST continue to default to displaying 50 sessions when no `--limit` flag is provided by the user.
- **FR-008**: Session-enumerating library functions that rely on the shared configuration resolution, including `searchSessions()`, `exportAllSessionsToJson()`, and `exportAllSessionsToMarkdown()`, MUST honor the "no numeric limit means all sessions" behavior consistently.
- **FR-009**: The library MUST continue to reject negative `limit` values with a validation error.

### Key Entities

- **LibraryConfig**: User-facing configuration object; the `limit` field becomes truly optional with `undefined` meaning "no limit" rather than "use default of 50".
- **ResolvedConfig**: Internal configuration after merging defaults; `limit` changes from always-required `number` to `number | undefined`, where `undefined` signals "return all sessions on the machine".
- **Pagination**: Result metadata describing the page of results returned. The `limit` field type remains `number`; when no limit is applied, it reflects the count of items actually returned.

## Assumptions

- The default limit of 50 in the CLI layer (`--limit` option default value of `'50'`) is the correct display default for terminal users and should not change.
- Downstream library consumers who omit `limit` expect all sessions on the machine, following the common convention that omitting a pagination parameter means "give me everything."
- Performance is acceptable when returning all sessions without a limit, as the session list is metadata-only (no full message parsing occurs during listing).
- The `offset` parameter default of `0` remains unchanged and is appropriate at both the library and CLI layers.
- The no-limit default applies to library functions that enumerate session collections; single-session retrieval and other non-paginated helpers remain unaffected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Library consumers calling `listSessions()` without a limit receive 100% of available sessions on the machine in the result set, regardless of total session count.
- **SC-002**: Library consumers calling `listSessions({ limit: N })` with an explicit limit continue to receive at most N sessions, preserving backward compatibility for 100% of existing explicit-limit call sites.
- **SC-003**: CLI users running `cch list` without flags see at most 50 sessions displayed, maintaining the existing terminal user experience.
- **SC-004**: Pagination metadata (`total`, `limit`, `hasMore`, `offset`) is accurate in all scenarios: with explicit limit, without limit, and with offset-only configurations.
- **SC-005**: Session-enumerating library helpers that omit `limit` consider 100% of available sessions rather than stopping at the first 50.
