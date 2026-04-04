# Library API Contract: Memory-Safe Session Listing and Detail Loading

**Feature**: 010-stream-session-parsing  
**Date**: 2026-04-03

## Overview

This contract defines the additive library-facing behavior needed to expose fallback preview text in summary listing, preserve full-fidelity session details, and remove duplicate full-file parsing from one `getSession()` request.

## Updated Public Types

### SessionSummary

```typescript
export interface SessionSummary {
  id: string;
  projectPath: string;
  gitBranch: string | null;
  summary: string | null;
  preview: string | null;
  timestamp: Date;
  lastActivityAt: Date;
  messageCount: number;
  agentIds: string[];
  unresolvedAgentIds: string[];
}
```

**Behavioral Contract**:
- `summary` remains the explicit transcript summary/title when present.
- `preview` is a derived fallback string from the earliest user-authored string message, capped at 200 visible characters after trimming and whitespace normalization, or `null` when no such message exists.
- `preview` is additive and must not remove or redefine `summary`.
- Agent link arrays remain scoped to the session represented by the summary and must stay unique and sorted.

### Session

```typescript
export interface Session extends SessionSummary {
  encodedPath: string;
  version: string;
  messages: Message[];
}
```

**Behavioral Contract**:
- Full session retrieval preserves all existing `messages`, `encodedPath`, `version`, and metadata semantics.
- `preview` is available on detail results as inherited summary metadata and does not affect message fidelity.

## Updated Functions and Behaviors

### listSessions

```typescript
export async function listSessions(
  config?: LibraryConfig
): Promise<PaginatedResult<SessionSummary>>;
```

**Behavioral Contract**:
- Returns one `SessionSummary` per discoverable main session and agent session as top-level rows.
- Populates `preview` directly from summary parsing so consumers can render fallback labels for untitled sessions without calling `getSession()` per row.
- Uses one-pass summary scans for compact metadata, preview, and explicit agent-link extraction, and must not retain full raw transcript arrays for every listed session.
- Preserves existing pagination, workspace filtering, sorting, and linked/unresolved agent ID semantics on main-session rows; agent-session rows may return empty link arrays.
- Malformed non-empty JSON lines in one transcript must not abort listing of unrelated sessions; recoverable parse warnings remain internal unless surfaced by an existing caller.

### getSession

```typescript
export async function getSession(
  identifier: number | string,
  config?: LibraryConfig
): Promise<Session>;
```

**Behavioral Contract**:
- Accepted identifiers and not-found/agent fallback behavior remain unchanged.
- Returns the complete full-fidelity `messages` array and all summary metadata, including additive `preview`.
- Must process the target transcript source no more than once for one request while deriving both messages and metadata.
- Must not retain a full raw `RawSessionEntry[]` copy alongside the final `messages[]` array.

### getAgentSession

```typescript
export async function getAgentSession(
  agentId: string,
  config?: LibraryConfig
): Promise<Session>;
```

**Behavioral Contract**:
- Existing agent lookup, not-found, and ambiguity semantics remain unchanged.
- Returns additive `preview` metadata for agent transcripts as well.
- Uses the same one-pass full-detail parser guarantees as `getSession()`.

## Backward Compatibility

- No function signatures change.
- `SessionSummary.preview` is an additive field and should not break existing consumers that ignore unknown properties.
- `summary` keeps its current meaning and must not be replaced by derived fallback text.
- Downstream `vibe-history` code changes are out of scope for this feature, but the new summary field is designed to let that consumer remove full-detail fallback reads in a follow-up change.

## Test Obligations

- Integration tests must prove `listSessions()` returns `preview` for untitled sessions with user-authored text and `null` when no user string message exists.
- Integration or unit tests must prove `cch list` can display fallback labels from `summary ?? preview ?? '(No summary)'`.
- Instrumentation tests must prove one `getSession()` or `getAgentSession()` request does not parse the same transcript file more than once.
- Large-fixture regression tests must prove `listSessions()` stays at or below 512 MiB peak memory while preserving summary rows and agent-link metadata.
- Regression tests must compare baseline-vs-new fallback detail-fetch counts on the same untitled-session fixture and assert at least 90% fewer full detail fetches.
- Parser tests must prove malformed lines remain recoverable and do not block valid later entries.
