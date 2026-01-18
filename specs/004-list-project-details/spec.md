# Feature Specification: Enhanced List Command with Project Details

**Feature Branch**: `004-list-project-details`
**Created**: 2025-01-18
**Status**: Draft
**Input**: User description: "the cch list command now shows project name only, we need it to also show project dir path(MUST) and branch name if possible"

## Clarifications

### Session 2025-01-18

- Q: Table column layout strategy for adding path and branch? → A: Replace PROJECT column with PATH column; add BRANCH column (existing columns: IDX, TIMESTAMP, SUMMARY, MSGS retained)
- Q: What placeholder value for missing branch information? → A: Show `-` (single dash)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Full Project Path in Session List (Priority: P1)

As a developer working across multiple projects, I want to see the full project directory path for each session so that I can quickly identify which project a session belongs to, especially when multiple projects have similar names (e.g., multiple repos named "api" or "backend" in different directories).

**Why this priority**: This is the core requirement and addresses the primary user need. Without the full path, users cannot distinguish between sessions from different projects with the same folder name.

**Independent Test**: Can be fully tested by running `cch list` and verifying the output includes the full project path for each session. Delivers immediate value by disambiguating sessions from similarly-named projects.

**Acceptance Scenarios**:

1. **Given** a session exists for project `/home/user/work/client-a/backend`, **When** I run `cch list`, **Then** I see the full path `/home/user/work/client-a/backend` (or a clearly identifiable portion of it) in the output.
2. **Given** sessions exist for `/home/user/project-a/api` and `/home/user/project-b/api`, **When** I run `cch list`, **Then** I can distinguish between the two sessions by their different path prefixes.
3. **Given** the terminal width is limited, **When** I run `cch list`, **Then** the path is intelligently truncated (showing meaningful prefix and project name) rather than cut off arbitrarily.

---

### User Story 2 - View Git Branch Name in Session List (Priority: P2)

As a developer working on multiple feature branches, I want to see the git branch name associated with each session so that I can quickly find sessions related to specific features or bug fixes.

**Why this priority**: Branch information provides valuable context for identifying sessions but is secondary to the path requirement. Some sessions may not have branch information available.

**Independent Test**: Can be tested by running `cch list` on sessions that have git branch information recorded and verifying the branch name appears in the output.

**Acceptance Scenarios**:

1. **Given** a session was started on git branch `feature/user-auth`, **When** I run `cch list`, **Then** I see `feature/user-auth` displayed for that session.
2. **Given** a session has no recorded branch information, **When** I run `cch list`, **Then** the branch column shows `-` rather than causing an error.
3. **Given** a branch name is very long (e.g., `feature/JIRA-12345-implement-complex-authentication-flow`), **When** I run `cch list`, **Then** the branch name is truncated appropriately to fit the display.

---

### User Story 3 - JSON Output Includes New Fields (Priority: P2)

As a developer using `cch list --json` for scripting and automation, I want the JSON output to include project path and branch information so that I can programmatically filter and process sessions.

**Why this priority**: Supports automation and integration workflows. Equal priority to branch display since both extend existing functionality.

**Independent Test**: Can be tested by running `cch list --json` and verifying the JSON output includes `projectPath` and optionally `gitBranch` fields for each session.

**Acceptance Scenarios**:

1. **Given** sessions exist with project paths and branches, **When** I run `cch list --json`, **Then** the JSON output includes `projectPath` (string) for each session.
2. **Given** sessions exist with git branch information, **When** I run `cch list --json`, **Then** the JSON output includes `gitBranch` (string or null) for each session.

---

### Edge Cases

- What happens when the project path is extremely long (>100 characters)?
  - Path should be intelligently truncated, preserving the project name and showing enough context to distinguish paths.
- How does the system handle sessions from non-git directories?
  - Branch column shows `-` for sessions without git information.
- How does the system handle sessions where branch information was not recorded?
  - Branch column shows `-`.
- What happens with paths containing special characters or spaces?
  - Special characters should be displayed correctly without escaping or corruption.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace the existing PROJECT column with a PATH column displaying the full project directory path for each session.
- **FR-002**: System MUST intelligently truncate long paths to fit within the PATH column width while preserving the project name and distinguishing prefix.
- **FR-003**: System MUST add a new BRANCH column displaying the git branch name for each session when available.
- **FR-004**: System MUST display `-` (single dash) in the BRANCH column when branch information is unavailable.
- **FR-005**: System MUST include `projectPath` in JSON output (`cch list --json`).
- **FR-006**: System SHOULD include `gitBranch` in JSON output when available.
- **FR-007**: System MUST maintain backward compatibility with existing list command options (`--workspace`, `--limit`, `--offset`).
- **FR-008**: System MUST ensure the table output remains readable and properly aligned with columns: IDX, TIMESTAMP, PATH, BRANCH, SUMMARY, MSGS.

### Key Entities

- **SessionSummary**: The session metadata displayed in the list. Currently includes: id, projectPath, summary, timestamp, lastActivityAt, messageCount, agentIds. May need to be extended to include gitBranch for list display.
- **Table Formatter**: Component responsible for rendering the session list as a human-readable table. Must be updated to replace PROJECT with PATH and add BRANCH column.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can distinguish between sessions from different projects with the same folder name by viewing the list output.
- **SC-002**: Users can identify the git branch associated with a session directly from the list output (when branch info is available).
- **SC-003**: The list command renders correctly on standard terminal widths (80-120 columns) without breaking layout or causing horizontal scroll.
- **SC-004**: JSON output includes all new fields and can be parsed by standard JSON tools without errors.
- **SC-005**: Existing workflows using `cch list` continue to work without modification (backward compatibility).

## Assumptions

- **A-001**: Git branch information is available from the session metadata or first user message. If not available in SessionSummary, it can be extracted during metadata parsing without significant performance impact.
- **A-002**: Terminal width of 80-120 columns is the primary target. Wider terminals can show more path information.
- **A-003**: Path truncation strategy: Show as much of the path as fits, prioritizing the project name (last segment) and enough prefix to distinguish paths.
- **A-004**: The branch displayed will be the branch at session start (from the first recorded user message), not tracking branch changes during the session.
