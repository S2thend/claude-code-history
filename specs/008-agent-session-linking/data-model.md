# Data Model: Agent Session Linking

**Feature**: 008-agent-session-linking  
**Date**: 2026-04-02

## Overview

This feature extends the session discovery and retrieval model so Claude main sessions can expose accurate child-agent relationships, unresolved agent references, and safe direct lookup behavior for nested and flat agent transcripts.

## New and Updated Types

### SessionSummary

Extend session summaries with separately surfaced unresolved agent references.

```typescript
interface SessionSummary {
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

**Validation Rules**:
- `agentIds` contains only discoverable child agent identifiers that are directly usable in a follow-up lookup.
- `unresolvedAgentIds` contains referenced child agent identifiers whose transcripts are not discoverable.
- `agentIds` and `unresolvedAgentIds` are unique within a summary and must not overlap.
- Top-level session listings still exclude agent sessions as rows, even when summaries contain linked-agent metadata.

### Session

Full session payloads inherit the same linked-agent metadata split.

```typescript
interface Session extends SessionSummary {
  encodedPath: string;
  version: string;
  messages: Message[];
}
```

**Validation Rules**:
- Main-session retrieval returns `agentIds` and `unresolvedAgentIds` scoped only to that main session.
- Agent-session retrieval returns empty linked-agent metadata arrays.

### Internal SessionInfo

Discovery records need enough context to distinguish flat and nested agent storage.

```typescript
interface SessionInfo {
  id: string;
  filePath: string;
  projectPath: string;
  encodedPath: string;
  isAgent: boolean;
  agentId: string | null;
  storageLayout: 'flat' | 'nested';
  nestedOwnerSessionId: string | null;
  modifiedTime: Date;
}
```

**Validation Rules**:
- Flat project-level files use `storageLayout: 'flat'` and `nestedOwnerSessionId: null`.
- Nested `subagents/agent-*.jsonl` files use `storageLayout: 'nested'` and record the owning main-session identifier from the path.
- Workspace filtering continues to apply at the project directory level.

### AgentLinkResolution

Derived link state for a single main session.

```typescript
interface AgentLinkResolution {
  agentIds: string[];
  unresolvedAgentIds: string[];
  source: 'explicit' | 'fallback-path' | 'mixed';
}
```

**Validation Rules**:
- Explicit main-session reference data is authoritative whenever available and internally consistent.
- Fallback path ownership is used only when explicit reference data is missing or incomplete.
- Conflicting path evidence never overrides a valid explicit reference.

### AmbiguousAgentSessionError

Direct lookup must distinguish duplicate matches from not-found results.

```typescript
class AmbiguousAgentSessionError extends Error {
  name: 'AmbiguousAgentSessionError';
  agentId: string;
  matchingSessionPaths: string[];
}
```

**Validation Rules**:
- Raised when a direct lookup by bare or prefixed agent identifier matches more than one discoverable transcript.
- Not used for missing agent transcripts; missing lookups remain not-found failures.

## Type Relationships

```text
Main Session
├── has many Agent Link References
├── resolves to many discoverable Agent Sessions via agentIds
└── may retain many Unresolved Agent References via unresolvedAgentIds

Agent Session
├── belongs to zero or one Main Session via explicit reference evidence
└── may be recoverably linked by nested fallback path ownership when explicit evidence is missing/incomplete

Direct Agent Lookup
├── returns Agent Session when exactly one match exists
├── returns not found when zero matches exist
└── returns AmbiguousAgentSessionError when multiple matches exist
```

## Linkage Source Precedence

| Evidence Source | Usage | Priority |
|-----------------|-------|----------|
| Explicit main-session agent reference | Primary parent-child linkage | 1 |
| Nested `subagents/` path ownership | Fallback when explicit reference is missing/incomplete | 2 |
| Project co-location only | Never sufficient on its own | Not allowed |

## Identifier Semantics

### Linked Agent Identifier

- Exported `agentIds` remain the direct navigation target for follow-up lookup.
- Lookup accepts both bare agent IDs and `agent-<id>` forms.
- Duplicate matches across discovered transcripts become ambiguous rather than silently selecting one.

### Unresolved Agent Identifier

- Exported through `unresolvedAgentIds`.
- Visible for fidelity and debugging.
- Not guaranteed to resolve to a retrievable transcript.

## Lifecycle / State Transitions

1. Discover session files recursively under each Claude project directory.
2. Normalize each discovered file into `SessionInfo`, including storage-layout context.
3. Parse main-session evidence to collect explicit agent references.
4. Resolve links for each main session:
   - use explicit references first,
   - add unresolved references for missing transcripts,
   - use nested path ownership only when explicit evidence is missing/incomplete.
5. Surface resolved links in `agentIds` and unresolved references in `unresolvedAgentIds`.
6. Perform direct agent lookup:
   - unique match → return agent session,
   - zero matches → not found,
   - multiple matches → ambiguity error.

## Validation Requirements

1. Nested `subagents/agent-*.jsonl` transcripts are discoverable.
2. Flat `agent-*.jsonl` transcripts remain discoverable.
3. Linked child agents for one main session never include agents from another main session in the same project.
4. `agentIds` never include unresolved or missing child references.
5. `unresolvedAgentIds` never include discoverable linked child agents.
6. Explicit reference evidence overrides conflicting nested path evidence.
7. Duplicate direct agent lookups never return an arbitrary transcript.
