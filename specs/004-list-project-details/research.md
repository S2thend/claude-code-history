# Research: Enhanced List Command with Project Details

**Branch**: `004-list-project-details` | **Date**: 2025-01-18

## Executive Summary

No significant research was required for this feature. The codebase already contains all necessary infrastructure:
- Git branch extraction exists in `parseSessionMetadata()` (`src/lib/parser.ts:327`)
- Path handling is already platform-agnostic
- Table formatting patterns are established

## Research Findings

### 1. Git Branch Availability

**Decision**: Use existing `gitBranch` field from session metadata

**Rationale**:
- The `parseSessionMetadata()` function already extracts `gitBranch` from JSONL entries (parser.ts:360-361)
- The `SessionMetadata` interface includes `gitBranch: string | null`
- Branch comes from the first user message's `gitBranch` field in the session

**Alternatives considered**:
- Parse full session to find branch: Rejected (slower, unnecessary)
- Query git directly: Rejected (session may be from different machine/time)

### 2. Column Width Strategy for 80-120 Terminal

**Decision**: Allocate widths as follows:
- IDX: 4 (unchanged)
- TIMESTAMP: 20 (unchanged)
- PATH: 30 (was PROJECT: 28)
- BRANCH: 15 (new)
- SUMMARY: 30 (was 40, reduced)
- MSGS: 5 (unchanged)

**Rationale**:
- Total: 4+20+30+15+30+5 = 104 + separators (~10) = ~114 chars
- Fits in 120-column terminal comfortably
- 80-column: PATH and BRANCH will truncate but remain usable
- Summary reduced because path/branch provide more context for session identification

**Alternatives considered**:
- Dynamic column widths based on terminal: Rejected (complexity, inconsistent output)
- Omit SUMMARY column: Rejected (still useful context)
- Two-line output per session: Rejected (breaks table scanning workflow)

### 3. Path Truncation Strategy

**Decision**: Truncate from the left (start of path), preserving the end (project name)

**Rationale**:
- Project name (last segment) is the most identifying part
- Example: `/home/user/very/long/path/to/project` → `…/path/to/project`
- Uses `…` (ellipsis character) as truncation indicator

**Alternatives considered**:
- Middle truncation (`/home/…/project`): More complex, less predictable
- Right truncation: Loses project name, defeats the purpose

### 4. SessionSummary Extension

**Decision**: Add `gitBranch: string | null` to `SessionSummary` interface

**Rationale**:
- Minimal change to existing type
- Nullable matches the source data (some sessions have no branch)
- JSON output automatically includes it via spread operator

**Alternatives considered**:
- Create new `SessionListItem` type: Rejected (unnecessary abstraction)
- Keep separate from SessionSummary: Rejected (would require parallel data structures)

## Dependencies

No new dependencies required. Uses existing Node.js built-ins and project infrastructure.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing tests | Medium | Low | Update test fixtures to include new fields |
| Performance impact | Low | Low | gitBranch already parsed; no additional I/O |
| Wide terminals look sparse | Low | Low | Acceptable trade-off for narrow terminal support |
