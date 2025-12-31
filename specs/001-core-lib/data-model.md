# Data Model: Core Library for Claude Code History

**Feature**: 001-core-lib
**Date**: 2025-12-31
**Source**: CLAUDE_CODE_DATA_STRUCTURE.md, spec.md

---

## Core Entities

### Session

Represents a single conversation session with Claude Code.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID of the session (from filename) |
| `projectPath` | `string` | Decoded project path (e.g., `/Users/name/project`) |
| `encodedPath` | `string` | Encoded directory name (e.g., `-Users-name-project`) |
| `summary` | `string \| null` | Human-readable title from summary entry |
| `timestamp` | `Date` | Session start time (from first message) |
| `lastActivityAt` | `Date` | Most recent message timestamp |
| `messageCount` | `number` | Total number of messages |
| `messages` | `Message[]` | Array of messages (populated in getSession) |
| `agentIds` | `string[]` | IDs of linked agent sessions |
| `version` | `string` | Claude Code version that created session |
| `gitBranch` | `string \| null` | Git branch at session start |

**Uniqueness**: `id` (UUID) is globally unique
**State**: Sessions are immutable (read-only access)

---

### SessionSummary

Lightweight session metadata for listing (without full messages).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Session UUID |
| `projectPath` | `string` | Decoded project path |
| `summary` | `string \| null` | Session title |
| `timestamp` | `Date` | Session start time |
| `lastActivityAt` | `Date` | Most recent activity |
| `messageCount` | `number` | Total messages |
| `agentIds` | `string[]` | Linked agent IDs |

---

### Message

A single entry in a session conversation.

| Field | Type | Description |
|-------|------|-------------|
| `uuid` | `string` | Unique message identifier |
| `parentUuid` | `string \| null` | Parent message (for threading) |
| `type` | `MessageType` | Entry type discriminator |
| `timestamp` | `Date` | When message was created |
| `content` | `MessageContent` | Type-specific content |

**MessageType enum**:
- `'user'` - User input or tool results
- `'assistant'` - Claude response
- `'summary'` - Session summary entry
- `'file-history-snapshot'` - File version tracking

---

### UserMessage

User-originated message (extends Message base).

| Field | Type | Description |
|-------|------|-------------|
| `role` | `'user'` | Always "user" |
| `content` | `string \| ToolResult[]` | Text or tool results |
| `cwd` | `string` | Working directory |
| `gitBranch` | `string \| null` | Git branch |
| `isSidechain` | `boolean` | If on alternate branch |

---

### AssistantMessage

Claude response (extends Message base).

| Field | Type | Description |
|-------|------|-------------|
| `role` | `'assistant'` | Always "assistant" |
| `model` | `string` | Model used (e.g., `claude-opus-4-5-20251101`) |
| `content` | `AssistantContent[]` | Text, tool calls, thinking |
| `stopReason` | `string \| null` | Why response ended |
| `usage` | `TokenUsage` | Token counts |

**AssistantContent** union type:
- `TextContent`: `{ type: 'text', text: string }`
- `ToolUseContent`: `{ type: 'tool_use', id: string, name: string, input: object }`
- `ThinkingContent`: `{ type: 'thinking', thinking: string }`

---

### ToolResult

Result of a tool invocation.

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'tool_result'` | Discriminator |
| `toolUseId` | `string` | Links to tool_use.id |
| `content` | `string` | Tool output |
| `isError` | `boolean` | If tool failed |

---

### ToolCall

Extracted tool call with result.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Tool invocation ID |
| `name` | `string` | Tool name (Read, Write, Bash, etc.) |
| `input` | `object` | Tool parameters |
| `result` | `string \| null` | Tool output (from subsequent tool_result) |
| `isError` | `boolean` | If tool failed |

---

### AgentSession

Subagent conversation linked to parent session.

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | `string` | Short agent identifier |
| `parentSessionId` | `string` | Parent session UUID |
| `prompt` | `string` | Task prompt from parent |
| `model` | `string` | Model used for agent |
| `messages` | `Message[]` | Agent's conversation |
| `totalDurationMs` | `number` | Execution time |
| `totalTokens` | `number` | Tokens consumed |
| `totalToolUseCount` | `number` | Tools invoked |

---

### TokenUsage

Token consumption metrics.

| Field | Type | Description |
|-------|------|-------------|
| `inputTokens` | `number` | Prompt tokens |
| `outputTokens` | `number` | Response tokens |
| `cacheCreationInputTokens` | `number` | Cache creation |
| `cacheReadInputTokens` | `number` | Cache hits |

---

## API Types

### LibraryConfig

Configuration for all library functions.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dataPath` | `string?` | Auto-detect | Custom Claude data directory |
| `workspace` | `string?` | All | Filter by project path |
| `limit` | `number?` | 50 | Max results per page |
| `offset` | `number?` | 0 | Skip N results |
| `context` | `number?` | 2 | Search context lines |

---

### PaginatedResult<T>

Wrapper for paginated responses.

| Field | Type | Description |
|-------|------|-------------|
| `data` | `T[]` | Result items |
| `pagination` | `Pagination` | Pagination metadata |

### Pagination

| Field | Type | Description |
|-------|------|-------------|
| `total` | `number` | Total matching items |
| `limit` | `number` | Items per page |
| `offset` | `number` | Current offset |
| `hasMore` | `boolean` | More results available |

---

### SearchMatch

A search result with context.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | Session containing match |
| `messageUuid` | `string` | Message containing match |
| `messageType` | `MessageType` | user/assistant |
| `match` | `string` | Matched text |
| `context` | `string[]` | Surrounding lines |
| `lineNumber` | `number` | Line in message content |

---

### MigrateConfig

Configuration for migration operations.

| Field | Type | Description |
|-------|------|-------------|
| `sessions` | `number \| string \| (number \| string)[]` | Session(s) to migrate |
| `destination` | `string` | Target workspace path |
| `mode` | `'copy' \| 'move'` | Copy (default) or move |

### MigrateWorkspaceConfig

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Source workspace path |
| `destination` | `string` | Target workspace path |
| `mode` | `'copy' \| 'move'` | Copy (default) or move |

### MigrateResult

| Field | Type | Description |
|-------|------|-------------|
| `successCount` | `number` | Sessions migrated |
| `failedCount` | `number` | Sessions failed |
| `errors` | `MigrateError[]` | Error details |

---

## Error Types

### SessionNotFoundError

Thrown when session index/UUID doesn't exist.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `'SessionNotFoundError'` | Error name |
| `sessionId` | `string \| number` | Requested ID |

### WorkspaceNotFoundError

Thrown when workspace path doesn't exist.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `'WorkspaceNotFoundError'` | Error name |
| `workspace` | `string` | Requested path |

### DataNotFoundError

Thrown when Claude Code data directory not found.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `'DataNotFoundError'` | Error name |
| `dataPath` | `string` | Attempted path |

---

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                         Session                              │
│  id, projectPath, summary, timestamp, messageCount          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    messages[]                         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │   │
│  │  │ UserMessage │  │ Assistant  │  │ FileHistory    │  │   │
│  │  │ content     │  │ content[]  │  │ Snapshot       │  │   │
│  │  │ toolResults │  │ toolCalls  │  │ trackedFiles   │  │   │
│  │  └────────────┘  └────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  agentIds[] ─────────┐                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     AgentSession                             │
│  agentId, parentSessionId, prompt, messages[]               │
└─────────────────────────────────────────────────────────────┘
```

---

## File Mapping

| Entity | Source File Pattern |
|--------|-------------------|
| Session | `~/.claude/projects/<encoded>/<uuid>.jsonl` |
| AgentSession | `~/.claude/projects/<encoded>/agent-<id>.jsonl` |
| SessionSummary | First line of session file (type: summary) |
