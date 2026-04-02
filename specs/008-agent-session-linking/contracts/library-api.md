# Library API Contract: Agent Session Linking

**Feature**: 008-agent-session-linking  
**Date**: 2026-04-02

## Overview

This contract defines the additive library API changes required so `claude-code-history` can discover nested agent transcripts, expose accurate main-session links, surface unresolved references separately, and resolve direct agent lookups safely.

## Updated Public Types

### SessionSummary

```typescript
export interface SessionSummary {
  id: string;
  projectPath: string;
  gitBranch: string | null;
  summary: string | null;
  timestamp: Date;
  lastActivityAt: Date;
  messageCount: number;
  agentIds: string[];
  unresolvedAgentIds: string[];
}
```

**Behavioral Contract**:
- `agentIds` contains only discoverable child-agent identifiers for that main session.
- `unresolvedAgentIds` contains referenced child-agent identifiers whose transcripts are not discoverable.
- Both arrays are scoped to the requested main session only.

### Session

```typescript
export interface Session extends SessionSummary {
  encodedPath: string;
  version: string;
  messages: Message[];
}
```

### AmbiguousAgentSessionError

```typescript
export class AmbiguousAgentSessionError extends Error {
  readonly name: 'AmbiguousAgentSessionError';
  readonly agentId: string;
  readonly matchingSessionPaths: string[];
}
```

```typescript
export function isAmbiguousAgentSessionError(
  error: unknown
): error is AmbiguousAgentSessionError;
```

**Behavioral Contract**:
- Raised when direct agent lookup by agent identifier matches more than one discoverable transcript.
- Distinct from `SessionNotFoundError`, which still represents zero matches.

## Updated Functions and Behaviors

### listSessions

```typescript
export async function listSessions(
  config?: LibraryConfig
): Promise<PaginatedResult<SessionSummary>>;
```

**Behavioral Contract**:
- Top-level list results continue to include only main sessions.
- Nested `subagents/agent-*.jsonl` transcripts participate in link resolution even though they do not appear as top-level list rows.
- `agentIds` are resolved from explicit main-session evidence first, then from nested path fallback only when explicit evidence is missing or incomplete.
- `unresolvedAgentIds` surface referenced child-agent identifiers that cannot be resolved to a retrievable transcript.

### getSession

```typescript
export async function getSession(
  identifier: number | string,
  config?: LibraryConfig
): Promise<Session>;
```

**Accepted Identifier Forms**:
- Numeric session index
- Full main-session UUID
- Partial main-session UUID prefix
- Bare agent identifier from `agentIds`
- `agent-<id>` form of an agent identifier

**Behavioral Contract**:
- Main-session retrieval returns accurate `agentIds` and `unresolvedAgentIds` for that session only.
- Bare or prefixed agent identifiers resolve the matching agent transcript when exactly one discoverable transcript matches.
- When a bare or prefixed agent identifier matches more than one transcript, `getSession()` throws `AmbiguousAgentSessionError`.
- When an identifier matches no session, `getSession()` throws `SessionNotFoundError`.

### getAgentSession

```typescript
export async function getAgentSession(
  agentId: string,
  config?: LibraryConfig
): Promise<Session>;
```

**Behavioral Contract**:
- Accepts both bare agent identifiers and `agent-<id>` form.
- Discovers and returns nested and flat agent transcripts.
- Throws `AmbiguousAgentSessionError` when more than one discoverable transcript matches the requested agent identifier.
- Throws `SessionNotFoundError` when no transcript matches the requested agent identifier.

### exportSessionToJson / exportSessionToMarkdown

```typescript
export async function exportSessionToJson(
  sessionId: string | number,
  config?: LibraryConfig
): Promise<string>;

export async function exportSessionToMarkdown(
  sessionId: string | number,
  config?: LibraryConfig
): Promise<string>;
```

**Behavioral Contract**:
- JSON export preserves both `agentIds` and `unresolvedAgentIds` through the serialized session object.
- Markdown export surfaces both discoverable linked agents and unresolved referenced agent IDs in session metadata.

## Public Re-Exports

The library index MUST re-export:

- Updated `SessionSummary`
- Updated `Session`
- `AmbiguousAgentSessionError`
- `isAmbiguousAgentSessionError`

## Backward Compatibility

- Flat project-level `agent-*.jsonl` transcripts remain discoverable and retrievable.
- Main-session listing behavior remains unchanged at the top level; agent sessions still do not appear as list rows.
- Existing exact main-session UUID and partial-UUID lookup behavior remains intact.
- The new `unresolvedAgentIds` field is additive.

## Defensive Behavior

- Explicit main-session reference evidence remains authoritative when it conflicts with nested path evidence.
- Nested path ownership is used only when explicit reference data is missing or incomplete.
- Project co-location alone is never enough to link an agent transcript to a main session.
