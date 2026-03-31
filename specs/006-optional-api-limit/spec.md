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

### User Story 3 - CLI User Sees CLI Defaults Align with the Library (Priority: P2)

A CLI user runs session-enumerating CLI commands without explicit `--limit` flags and sees behavior that matches the library's no-limit semantics. Commands like `cch list` and both `cch search` modes (across sessions and `--session`) should no longer diverge from the library on the meaning of an omitted `limit`.

**Why this priority**: Aligning the CLI with the library removes a surprising behavioral split between the two public entry points. Users who omit `--limit` should not get incomplete results from CLI commands when the library would return everything in scope.

**Independent Test**: Can be fully tested by running `cch list`, `cch search`, and `cch search --session` on data sets containing more than 50 qualifying sessions or more than 20 matching results and verifying that omitted `--limit` values do not truncate results.

**Acceptance Scenarios**:

1. **Given** a data directory containing 94 sessions, **When** a user runs `cch list` with no flags, **Then** the CLI displays all 94 sessions rather than truncating at 50.
2. **Given** a data directory containing 94 sessions and search matches that occur in sessions beyond the first 20 results, **When** a user runs `cch search "<query>"` with no `--limit`, **Then** the CLI displays matches from all qualifying sessions rather than truncating at the prior default of 20.
3. **Given** a data directory containing 94 sessions, **When** a user runs `cch list --limit 10`, **Then** the CLI displays exactly 10 sessions.
4. **Given** a data directory containing more than 20 matching search results, **When** a user runs `cch search "<query>" --limit 10`, **Then** the CLI displays exactly 10 matching results.
5. **Given** a specific session containing more than 20 matching results, **When** a user runs `cch search "<query>" --session <id>` with no `--limit`, **Then** the CLI displays all qualifying matches from that session rather than truncating at the prior default of 20.

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
- **FR-002**: The library MUST continue to respect an explicitly provided numeric `limit` and return at most that many sessions.
- **FR-003**: The library MUST correctly apply `offset` when no `limit` is provided, returning all sessions from the offset position onward.
- **FR-004**: The pagination metadata MUST accurately reflect the actual result set: when no limit is applied, `hasMore` MUST be `false` (since all remaining items are returned).
- **FR-005**: The pagination metadata `limit` field MUST be set to the count of items actually returned when no explicit limit is provided. The `Pagination` type remains `number` with no type change.
- **FR-006**: Session-enumerating CLI commands, including `cch list` and both `cch search` modes (across sessions and `--session`), MUST default to the same omitted-limit behavior as the library when no `--limit` flag is provided by the user.
- **FR-007**: Session-enumerating library functions that rely on the shared configuration resolution, including `searchSessions()`, `exportAllSessionsToJson()`, and `exportAllSessionsToMarkdown()`, MUST honor the "no numeric limit means all sessions" behavior consistently.
- **FR-008**: The library MUST continue to reject negative `limit` values with a validation error.

### Key Entities

- **LibraryConfig**: User-facing configuration object; the `limit` field becomes truly optional with `undefined` meaning "no limit" rather than "use default of 50".
- **ResolvedConfig**: Internal configuration after merging defaults; `limit` changes from always-required `number` to `number | undefined`, where `undefined` signals "return all sessions on the machine".
- **Pagination**: Result metadata describing the page of results returned. The `limit` field type remains `number`; when no limit is applied, it reflects the count of items actually returned.

## Assumptions

- The CLI `list` command and both `search` branches should align with the library semantics: omitting `--limit` means no numeric limit is applied.
- Downstream library consumers who omit `limit` expect all sessions on the machine, following the common convention that omitting a pagination parameter means "give me everything."
- Performance is acceptable when returning all sessions without a limit for metadata-only listing paths such as `listSessions()` and plain `cch list`. CLI paths that compute aggregate statistics, such as `cch list --stats`, are heavier because they load each returned session, but this is an intentional consequence of applying the same omitted-limit semantics to the CLI.
- The `offset` parameter default of `0` remains unchanged and is appropriate at both the library and CLI layers.
- The no-limit default applies to library functions that enumerate session collections; single-session retrieval and other non-paginated helpers remain unaffected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Library consumers calling `listSessions()` without a limit receive 100% of available sessions on the machine in the result set, regardless of total session count.
- **SC-002**: Library consumers calling `listSessions({ limit: N })` with an explicit limit continue to receive at most N sessions, preserving backward compatibility for 100% of existing explicit-limit call sites.
- **SC-003**: CLI users running session-enumerating commands without `--limit`, including `cch list`, cross-session `cch search`, and `cch search --session`, see 100% of available results in scope, matching the library's no-limit default behavior.
- **SC-004**: Pagination metadata (`total`, `limit`, `hasMore`, `offset`) is accurate in all scenarios: with explicit limit, without limit, and with offset-only configurations.
- **SC-005**: Session-enumerating library helpers that omit `limit` consider 100% of available sessions rather than stopping at the first 50.
