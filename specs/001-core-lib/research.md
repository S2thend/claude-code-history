# Research: Core Library for Claude Code History

**Feature**: 001-core-lib
**Date**: 2025-12-31
**Status**: Complete

## Overview

This document consolidates research findings for implementing the Claude Code history library. All technical decisions are informed by the existing `CLAUDE_CODE_DATA_STRUCTURE.md` documentation and cursor-history API patterns.

---

## 1. Claude Code Data Format

### Decision: Use existing JSONL format documentation

**Rationale**: The project already contains comprehensive documentation of Claude Code's data structure in `CLAUDE_CODE_DATA_STRUCTURE.md`. This is the authoritative reference for parsing.

**Key Findings**:

- **Location**: `~/.claude/` (macOS/Linux) or `%USERPROFILE%\.claude\` (Windows)
- **Session files**: `~/.claude/projects/<encoded-path>/<uuid>.jsonl`
- **Agent files**: `~/.claude/projects/<encoded-path>/agent-<id>.jsonl`
- **Path encoding**: `/Users/name/project` → `-Users-name-project`

**Entry Types**:
| Type | Description |
|------|-------------|
| `summary` | Human-readable title, links to last message |
| `user` | User messages and tool results |
| `assistant` | Claude responses with tool calls |
| `file-history-snapshot` | File backup version tracking |

**Alternatives Considered**:
- Reverse-engineering from scratch: Rejected (documentation already exists)
- Using cursor-history's SQLite approach: Rejected (Claude Code uses JSONL, not SQLite)

---

## 2. JSONL Parsing Strategy

### Decision: Stream-based line-by-line parsing with Node.js readline

**Rationale**: JSONL files can be large (1000+ messages). Streaming avoids loading entire files into memory and enables early termination for search operations.

**Implementation Approach**:
```typescript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function* parseJSONL(filePath: string) {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      yield JSON.parse(line);
    } catch (e) {
      // Skip invalid lines, track count, emit warning
    }
  }
}
```

**Alternatives Considered**:
- `fs.readFileSync` + split: Rejected (memory issues with large files)
- Third-party streaming JSON library: Rejected (unnecessary dependency)
- Worker threads: Deferred (premature optimization)

---

## 3. Session Indexing Strategy

### Decision: On-demand scanning with optional caching

**Rationale**: Most users have <500 sessions. Scanning project directories on each `listSessions()` call is fast enough (<5s target). Caching adds complexity without clear benefit for typical usage.

**Implementation Approach**:
1. Scan `~/.claude/projects/` for subdirectories
2. For each project directory, glob for `*.jsonl` files (exclude `agent-*.jsonl`)
3. Parse first line of each file to extract summary and timestamp
4. Sort by timestamp descending
5. Return paginated slice

**Alternatives Considered**:
- SQLite index database: Rejected (adds dependency, complexity, sync issues)
- In-memory cache with TTL: Deferred to future optimization
- File system watcher: Rejected (unnecessary for read-only operations)

---

## 4. Agent Session Linking

### Decision: Lazy linking via agentId field

**Rationale**: Agent sessions are linked to parent sessions via the `agentId` field in tool results. Parse this relationship on-demand rather than pre-computing.

**Key Fields**:
- Parent session tool result: `toolUseResult.agentId` = `"a5591a2"`
- Agent session file: `agent-a5591a2.jsonl`
- Agent session header: `agentId: "a5591a2"`, `sessionId: "<parent-uuid>"`

**Implementation**:
- When listing sessions, scan for `agent-*.jsonl` files
- Include agent IDs in session metadata
- `getSession()` optionally includes full agent conversations

---

## 5. Platform Detection

### Decision: Use Node.js `os` and `path` modules

**Rationale**: Node.js provides cross-platform APIs. No external dependencies needed.

**Implementation**:
```typescript
import { homedir, platform } from 'os';
import { join } from 'path';

export function getDefaultDataPath(): string {
  const home = homedir();
  // Claude Code uses same relative path on all platforms
  return join(home, '.claude');
}
```

**Platform Behaviors**:
| Platform | Home Directory | Data Path |
|----------|---------------|-----------|
| macOS | `/Users/<name>` | `/Users/<name>/.claude` |
| Linux | `/home/<name>` | `/home/<name>/.claude` |
| Windows | `C:\Users\<name>` | `C:\Users\<name>\.claude` |

---

## 6. Search Implementation

### Decision: Simple substring search with optional regex

**Rationale**: Most users search for keywords, not complex patterns. Substring search is fast and sufficient for MVP.

**Implementation Approach**:
1. Iterate through all sessions
2. For each message, check if content includes query (case-insensitive)
3. Extract context lines around matches
4. Return match objects with session reference

**Performance**:
- Target: <3s for 100 sessions
- Optimization: Stop early if result limit reached
- Future: Add regex support, field-specific search

**Alternatives Considered**:
- Full-text search engine (lunr.js): Deferred (adds complexity)
- Pre-built search index: Deferred (caching strategy TBD)

---

## 7. Export Format Design

### Decision: Markdown with collapsible sections, JSON with full fidelity

**Rationale**: Markdown is human-readable for sharing; JSON preserves all data for programmatic use.

**Markdown Format**:
```markdown
# Session: <summary>

**Project**: /path/to/project
**Date**: 2025-12-31T10:00:00Z
**Messages**: 42

---

## User (10:00:00)

<user message content>

## Assistant (10:00:15)

<assistant response>

<details>
<summary>Tool: Read /path/to/file.ts</summary>

```typescript
<file contents>
```

</details>
```

**JSON Format**: Full session object with all fields preserved.

---

## 8. Error Handling Strategy

### Decision: Custom error classes with type guards

**Rationale**: Enables consumers to handle specific errors appropriately. Matches cursor-history API pattern.

**Error Types**:
```typescript
export class SessionNotFoundError extends Error { name = 'SessionNotFoundError'; }
export class WorkspaceNotFoundError extends Error { name = 'WorkspaceNotFoundError'; }
export class DataNotFoundError extends Error { name = 'DataNotFoundError'; }

export function isSessionNotFoundError(e: unknown): e is SessionNotFoundError {
  return e instanceof SessionNotFoundError;
}
```

---

## 9. Dependencies

### Decision: Minimize external dependencies

**Rationale**: Constitution requires justification for dependencies. Node.js built-ins are sufficient.

**Required Dependencies**:
| Package | Purpose | Justification |
|---------|---------|---------------|
| (none) | - | Node.js built-ins sufficient for MVP |

**Dev Dependencies**:
| Package | Purpose |
|---------|---------|
| typescript | Language |
| vitest | Testing |
| eslint | Linting |
| prettier | Formatting |
| @types/node | Type definitions |

---

## 10. Open Questions (Deferred)

These items are noted but not blocking for MVP:

1. **Large session handling**: Sessions with 10,000+ messages may need streaming export
2. **Concurrent access**: File locking when Claude Code is actively writing
3. **Incremental search**: Search-as-you-type optimization
4. **Compression**: Backup file compression format (gzip vs zip)

---

## Summary

All critical technical decisions are resolved. The implementation can proceed with:
- Node.js built-in modules only (no external dependencies)
- Stream-based JSONL parsing
- On-demand session scanning
- Simple substring search
- Markdown/JSON export formats
- Custom error types with guards
