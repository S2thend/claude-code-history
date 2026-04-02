# Feature Specification: Agent Session Linking

**Feature Branch**: `008-agent-session-linking`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "Recursively discover nested subagents/agent-*.jsonl files, link them to each main session by parsing real toolUseResult.agentId references instead of guessing, and make view/lib lookups resolve those agent IDs directly."

## Clarifications

### Session 2026-04-02

- Q: When a main session references agent IDs whose transcript files are missing, should those references still be surfaced to users? → A: Return discoverable agent IDs and separately flag unresolved referenced agent IDs.
- Q: If the same agent ID appears in more than one transcript, how should direct agent lookup behave? → A: Resolve by agent ID alone, but fail with an ambiguity result if duplicate agent IDs are found.
- Q: When explicit agent references are missing or incomplete, should nested subagent paths be allowed as a fallback source of linkage? → A: Use explicit agent references first, then use the nested subagent path as a fallback when needed.
- Q: If explicit agent references and nested subagent path evidence conflict, which source should win? → A: Trust the explicit agent reference and ignore the conflicting nested path evidence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Show Correct Linked Agent Sessions (Priority: P1)

As a developer reviewing a Claude Code session, I want each main session to expose only the agent sessions that were actually spawned from that conversation so I can trust the linked agent IDs without manually inspecting raw history files.

**Why this priority**: Incorrect agent linking makes the product unreliable for one of the core Claude session relationships and can send users to unrelated agent transcripts from the same project.

**Independent Test**: Can be fully tested by listing or retrieving a main session from fixture data that contains multiple main sessions and nested agent histories, then verifying that only the truly linked agent IDs are returned.

**Acceptance Scenarios**:

1. **Given** a main session with one or more nested agent histories that were actually spawned from that conversation, **When** the user lists sessions or retrieves that main session, **Then** the returned linked agent IDs include every true child agent session for that main session.
2. **Given** multiple main sessions in the same project, each with different agent histories, **When** the user retrieves one main session, **Then** the linked agent IDs exclude agent sessions that belong to the other main sessions.
3. **Given** a main session with no linked agent histories, **When** the user lists sessions or retrieves that session, **Then** the session is returned successfully with no linked agent IDs rather than guessed or unrelated ones.
4. **Given** a main session references both discoverable and missing child agent transcripts, **When** the user lists sessions or retrieves that session, **Then** the discoverable linked agent IDs are returned and the unresolved referenced agent IDs are surfaced separately.
5. **Given** a child agent transcript is stored under a main session's nested subagent location but the explicit reference data is missing or incomplete, **When** the user lists sessions or retrieves that main session, **Then** the child agent transcript can still be linked through the fallback path-based relationship.
6. **Given** explicit agent reference data conflicts with the nested storage path for a child transcript, **When** the user lists sessions or retrieves the main session, **Then** the explicit reference determines the link and the conflicting path evidence does not override it.

---

### User Story 2 - Open Agent Transcript From Exported ID (Priority: P1)

As a developer navigating from a main session to an agent session, I want an exported linked agent ID to be directly retrievable through the library and CLI so I can inspect the child transcript without manually locating the underlying file.

**Why this priority**: Linked agent IDs are only useful if they can immediately resolve to the corresponding agent transcript in a second step.

**Independent Test**: Can be fully tested by retrieving a main session, taking one of its linked agent IDs, and using both library and CLI session lookup paths to open the corresponding agent transcript.

**Acceptance Scenarios**:

1. **Given** a main session that exposes a linked agent ID, **When** the user requests that agent transcript through the library, **Then** the full agent session is returned successfully.
2. **Given** a main session that exposes a linked agent ID, **When** the user requests that agent transcript through the session-viewing workflow, **Then** the transcript opens successfully without requiring manual file-path discovery.
3. **Given** a linked agent ID is provided in either a bare or display-ready form, **When** the user performs a lookup, **Then** the lookup resolves to the same agent transcript.
4. **Given** the same agent ID appears in more than one transcript, **When** the user performs a direct lookup by that agent ID, **Then** the system reports an ambiguity result instead of returning one of the matching transcripts arbitrarily.

---

### User Story 3 - Keep Session Lists Focused on Main Conversations (Priority: P2)

As a developer scanning available history, I want session lists to remain focused on main conversations while still preserving navigable links to child agent sessions so that list output stays readable without hiding agent details from follow-up inspection.

**Why this priority**: Agent sessions should remain discoverable through their parent conversation without overwhelming the primary session list.

**Independent Test**: Can be fully tested by listing sessions from fixture data containing both main sessions and nested agent sessions and verifying that only main sessions appear as top-level list results while linked agent IDs remain available on relevant sessions.

**Acceptance Scenarios**:

1. **Given** history data that contains both main sessions and linked agent sessions, **When** the user lists sessions, **Then** only main sessions appear as list entries.
2. **Given** a listed main session that has linked agent sessions, **When** the user inspects its metadata or exported representation, **Then** the linked agent IDs are present and correspond only to that session's actual child agents.
3. **Given** a project with unrelated agent sessions that are not linked to a listed main session, **When** the user views that main session's exported metadata, **Then** those unrelated agent sessions are not surfaced as links.

### Edge Cases

- What happens when a main session references an agent session whose transcript file is missing? The system reports the lookup failure for that agent ID without substituting an unrelated agent transcript.
- What happens when nested agent session files exist in the project but are not referenced by a main session? The system does not attach those agent sessions to unrelated main sessions.
- What happens when a project contains a mix of nested agent session storage and older flat agent session storage? Users can still retrieve valid linked agent transcripts from either format without changing the list behavior for main sessions.
- What happens when a user attempts to open a linked agent session using either the raw linked ID or its display-ready agent session form? Both inputs resolve to the same agent transcript.
- What happens when a main session references an agent ID whose transcript cannot be discovered? Discoverable child agents remain navigable and the unresolved reference is surfaced separately so users can see the incomplete linkage.
- What happens when the same agent ID exists in more than one transcript? The system reports an ambiguity result and requires disambiguation instead of guessing which transcript the user intended.
- What happens when explicit child-agent references are missing or incomplete but the nested storage path still implies the parent-child relationship? The system can recover the link from the nested path, but only as a fallback after checking for explicit references.
- What happens when explicit child-agent references disagree with nested path evidence? The system trusts the explicit reference and does not let the conflicting path evidence override that link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST discover agent session histories stored inside nested subagent locations as part of session discovery.
- **FR-002**: The system MUST determine linked agent sessions for each main session from agent references recorded by that main session, rather than by assuming all agent sessions in the same project are related.
- **FR-002a**: When explicit agent references for a child transcript are missing or incomplete, the system MUST be able to use the nested subagent storage relationship as a fallback source of linkage.
- **FR-002b**: When explicit agent references conflict with nested subagent storage evidence, the system MUST treat the explicit reference as authoritative for linkage.
- **FR-003**: The session-listing workflow MUST return only main sessions as top-level list results.
- **FR-004**: Each main-session summary returned by the session-listing workflow MUST include only the linked agent IDs that actually belong to that main session.
- **FR-005**: Main-session retrieval MUST return only the linked agent IDs that actually belong to the requested main session.
- **FR-005a**: When a main session references child agent IDs whose transcripts cannot be discovered, the system MUST surface those unresolved referenced agent IDs separately from the discoverable linked agent IDs.
- **FR-006**: Direct agent-session retrieval by agent identifier MUST retrieve agent transcripts that were discovered from nested subagent storage.
- **FR-006a**: When the same agent identifier matches more than one discoverable agent transcript, direct agent-session retrieval MUST return an ambiguity result instead of selecting one transcript arbitrarily.
- **FR-007**: Session lookup workflows used by the CLI and library MUST resolve a linked agent ID directly, without requiring the caller to discover the underlying storage path manually.
- **FR-008**: The system MUST treat different main sessions in the same project as separate agent-linking scopes so that one main session cannot inherit another session's child agents.
- **FR-009**: When a requested linked agent transcript cannot be found, the system MUST fail with a session-not-found result for that requested agent ID rather than returning unrelated transcript data.
- **FR-010**: Exported session metadata that surfaces linked agent IDs MUST use values that are directly usable in a follow-up agent lookup.
- **FR-011**: Existing retrieval behavior for already supported agent session layouts MUST remain available after nested agent discovery is added.

### Key Entities *(include if feature involves data)*

- **Main Session**: The primary Claude Code conversation that users list and inspect as the top-level unit of history.
- **Agent Session**: A child conversation spawned from a main session that has its own transcript and can be opened independently.
- **Agent Link Reference**: The recorded relationship in a main session that identifies which child agent sessions belong to that conversation.
- **Fallback Path Relationship**: A recoverable parent-child relationship inferred from nested subagent storage when explicit agent reference data is missing or incomplete.
- **Unresolved Agent Reference**: A child agent identifier recorded by a main session for which no retrievable agent transcript is currently discoverable.
- **Ambiguous Agent Match**: A direct agent lookup outcome in which more than one discoverable transcript matches the requested agent identifier.
- **Session Identifier**: The user-facing value used to retrieve either a main session or an agent session in a later lookup.

## Assumptions

- Agent session transcripts remain separate from the main session transcript and are accessed through linking rather than by merging child messages into the parent message flow.
- Users want linked agent IDs to serve as immediate navigation targets for a second lookup step in either the library or CLI.
- Session lists should stay focused on main conversations even when agent transcripts are available.
- When a main session references a missing child transcript, users still benefit from seeing that unresolved reference as separate metadata rather than having it silently dropped.
- Explicit agent references are the preferred source of truth for linkage, with nested path relationships used only when that reference evidence is missing or incomplete.
- If explicit reference evidence and nested path evidence disagree, the explicit reference remains authoritative.

## Dependencies

- Claude session history continues to record child-agent relationships in the main session history.
- Users rely on session listing, session viewing, and direct session retrieval workflows as the primary ways to navigate session history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing with fixture data that contains nested child-agent histories, 100% of main sessions return all of their true linked agent IDs and 0 unrelated agent IDs.
- **SC-001a**: In acceptance testing, child agent transcripts that lack complete explicit reference data but have a valid nested parent-child storage relationship are still linked to the correct main session.
- **SC-001b**: In acceptance testing, 100% of cases where explicit reference data conflicts with nested path evidence follow the explicit reference and 0 are reassigned based on the conflicting path alone.
- **SC-002**: In acceptance testing, 100% of linked agent IDs returned from a main session can be used to retrieve the correct child transcript through both library lookup and session-viewing workflows.
- **SC-002a**: In acceptance testing, 100% of direct lookups involving duplicate agent IDs return an ambiguity result and 0 return an arbitrary transcript.
- **SC-003**: In acceptance testing, session-list output continues to show only main sessions as top-level results even when nested child-agent histories are present.
- **SC-004**: In regression testing, 100% of pre-existing supported agent-session retrieval scenarios continue to pass after nested child-agent discovery is added.
