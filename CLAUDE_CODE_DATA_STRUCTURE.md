# Claude Code Data Structure Report

## Overview

Claude Code stores data in two main locations:
- **`~/.claude/`** - User-level configuration and session data
- **`~/.claude.json`** - Main configuration file with OAuth, project state, and caches

---

## Directory Structure

```
~/.claude/
├── projects/                    # Session histories (per-project)
│   └── -Users-name-path-to-project/
│       ├── <session-uuid>.jsonl      # Chat session
│       └── agent-<id>.jsonl          # Agent/subagent session
├── file-history/                # File backup versions (per-session)
│   └── <session-uuid>/
│       └── <file-hash>@v<N>          # Versioned file backups
├── todos/                       # Todo lists (per-session)
│   └── <session-uuid>-agent-*.json
├── history.jsonl                # Command/prompt history
├── settings.json                # User settings
├── stats-cache.json             # Usage statistics cache
├── shell-snapshots/             # Shell environment snapshots
├── plugins/                     # Plugin configuration
├── debug/                       # Debug logs
├── statsig/                     # Feature flags/analytics
└── telemetry/                   # Telemetry data
```

---

## 1. Session Files (`projects/<encoded-path>/*.jsonl`)

### File Naming
- **Chat sessions**: `<uuid>.jsonl` (e.g., `072ed9b5-2c60-486d-aa4f-20afd95ddd37.jsonl`)
- **Agent sessions**: `agent-<short-id>.jsonl` (e.g., `agent-a5591a2.jsonl`)
- **Project path encoding**: `/Users/borui/Devs/Project` → `-Users-borui-Devs-Project`

### Agent ↔ Main Session Relationship

When the main conversation spawns a subagent (via the `Task` tool), the relationship is:

```
Main Session (73bb7d55-052a-4c10-98ff-602d32708cf4.jsonl)
│
├── Tool Call: Task tool invoked
│   └── tool_use.input.prompt: "Research how Claude Code stores..."
│
├── Tool Result (in main session):
│   └── content: Agent's final response
│   └── toolUseResult.agentId: "a5591a2"  ← Links to agent file
│   └── toolUseResult.totalDurationMs: 170119
│   └── toolUseResult.totalTokens: 76496
│   └── toolUseResult.totalToolUseCount: 18
│
└── Agent Session (agent-a5591a2.jsonl)
    └── Separate JSONL with full agent conversation
```

**Key Fields in Agent Session:**
```json
{
  "sessionId": "73bb7d55-...",     // Same as parent session!
  "agentId": "a5591a2",            // Unique agent identifier
  "isSidechain": true,             // Marks as subagent conversation
  "parentUuid": null,              // First message has no parent
  ...
}
```

**Key Fields in Main Session's Tool Result:**
```json
{
  "toolUseResult": {
    "status": "completed",
    "agentId": "a5591a2",           // Links to agent-a5591a2.jsonl
    "prompt": "Original task prompt...",
    "content": [{"type": "text", "text": "Agent's response..."}],
    "totalDurationMs": 170119,
    "totalTokens": 76496,
    "totalToolUseCount": 18,
    "usage": {...}
  }
}
```

**Important Points:**
1. Agent sessions share the same `sessionId` as parent (for project association)
2. Agent sessions have `isSidechain: true` to mark them as branched conversations
3. The `agentId` in both files creates the link between them
4. Main session stores only the final result; agent file has full conversation
5. Agent uses potentially different model (e.g., `claude-haiku-4-5-20251001` vs parent's `claude-opus-4-5-20251101`)

### Entry Types

#### 1.1 Summary Entry
```json
{
  "type": "summary",
  "summary": "Human-readable title of the conversation",
  "leafUuid": "uuid-of-last-message"
}
```

#### 1.2 User Message Entry
```json
{
  "type": "user",
  "parentUuid": "uuid-of-parent-message",
  "uuid": "unique-message-id",
  "timestamp": "2025-12-03T11:02:44.764Z",
  "sessionId": "session-uuid",
  "cwd": "/current/working/directory",
  "gitBranch": "branch-name",
  "version": "2.0.55",
  "userType": "external",
  "isSidechain": false,
  "isMeta": false,
  "message": {
    "role": "user",
    "content": "User's message text"
  },
  "thinkingMetadata": {
    "level": "none",
    "disabled": true,
    "triggers": []
  }
}
```

**Content Formats:**
- **Plain text**: `"content": "user message"`
- **Tool results**:
```json
"content": [
  {
    "type": "tool_result",
    "tool_use_id": "toolu_01ABC...",
    "content": "result text or file contents"
  }
]
```

#### 1.3 Assistant Message Entry
```json
{
  "type": "assistant",
  "parentUuid": "uuid-of-parent-message",
  "uuid": "unique-message-id",
  "timestamp": "2025-12-03T11:02:54.072Z",
  "sessionId": "session-uuid",
  "cwd": "/current/working/directory",
  "gitBranch": "branch-name",
  "version": "2.0.55",
  "slug": "random-three-word-slug",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "id": "msg_01Y9u3CTgHFfkHGTmMX3ZAYW",
    "type": "message",
    "role": "assistant",
    "content": [...],
    "stop_reason": "tool_use" | "end_turn" | null,
    "stop_sequence": null,
    "usage": {
      "input_tokens": 3,
      "output_tokens": 119,
      "cache_creation_input_tokens": 38595,
      "cache_read_input_tokens": 0,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 38595,
        "ephemeral_1h_input_tokens": 0
      },
      "service_tier": "standard"
    },
    "context_management": {
      "applied_edits": []
    }
  }
}
```

**Content Types:**
- **Text response**:
```json
"content": [
  {
    "type": "text",
    "text": "Assistant's response text"
  }
]
```

- **Tool call**:
```json
"content": [
  {
    "type": "tool_use",
    "id": "toolu_01ABC...",
    "name": "Read",
    "input": {
      "file_path": "/path/to/file"
    }
  }
]
```

- **Thinking block** (when extended thinking enabled):
```json
"content": [
  {
    "type": "thinking",
    "thinking": "Internal reasoning..."
  },
  {
    "type": "text",
    "text": "Response..."
  }
]
```

#### 1.4 File History Snapshot Entry
```json
{
  "type": "file-history-snapshot",
  "messageId": "associated-message-uuid",
  "isSnapshotUpdate": false,
  "snapshot": {
    "messageId": "uuid",
    "timestamp": "2025-12-03T10:52:34.418Z",
    "trackedFileBackups": {
      "path/to/file.ts": {
        "backupFileName": "07c80eac0c9e08ee@v1",
        "version": 1,
        "backupTime": "2025-12-08T08:45:23.014Z"
      }
    }
  }
}
```

---

## 2. Main Config (`~/.claude.json`)

### Global Settings
| Field | Type | Description |
|-------|------|-------------|
| `numStartups` | int | Total number of times Claude Code started |
| `installMethod` | string | "global", "npm", etc. |
| `autoUpdates` | bool | Auto-update enabled |
| `autoCompactEnabled` | bool | Auto-compact conversations |
| `hasCompletedOnboarding` | bool | User completed onboarding |
| `firstStartTime` | ISO date | First launch timestamp |
| `userID` | string | Anonymized user identifier (SHA256) |
| `memoryUsageCount` | int | Times memory feature used |
| `promptQueueUseCount` | int | Times prompt queue used |
| `showExpandedTodos` | bool | Todo list UI state |

### Custom API Key Responses
```json
"customApiKeyResponses": {
  "approved": ["key-suffix-1", "key-suffix-2"],
  "rejected": []
}
```

### Tips History
Tracks which tips have been shown and how many times:
```json
"tipsHistory": {
  "shift-enter": 235,
  "double-esc": 33,
  "plan-mode-for-complex-tasks": 231,
  ...
}
```

### Cached Feature Flags
```json
"cachedStatsigGates": {
  "tengu_web_tasks": true,
  "tengu_prompt_suggestion": true,
  ...
},
"cachedGrowthBookFeatures": {...}
```

### Per-Project State
```json
"projects": {
  "/Users/borui/Devs/Project": {
    "allowedTools": [],
    "mcpServers": {},
    "mcpContextUris": [],
    "enabledMcpjsonServers": [],
    "disabledMcpjsonServers": [],
    "hasTrustDialogAccepted": true,
    "projectOnboardingSeenCount": 4,
    "hasClaudeMdExternalIncludesApproved": false,
    "lastSessionId": "uuid",
    "lastCost": 272.38,
    "lastAPIDuration": 4860315,
    "lastToolDuration": 151028,
    "lastDuration": 82022499,
    "lastLinesAdded": 350,
    "lastLinesRemoved": 115,
    "lastTotalInputTokens": 18201247,
    "lastTotalOutputTokens": 34129,
    "lastTotalCacheCreationInputTokens": 0,
    "lastTotalCacheReadInputTokens": 0,
    "lastTotalWebSearchRequests": 0
  }
}
```

---

## 3. Settings File (`~/.claude/settings.json`)

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  },
  "cleanupPeriodDays": 90,
  "model": "opus",
  "enabledPlugins": {
    "commit-commands@claude-plugins-official": true
  },
  "alwaysThinkingEnabled": false,
  "permissions": {
    "allow": ["Bash(npm run lint)"],
    "deny": ["Read(./.env)"]
  },
  "hooks": {...},
  "sandbox": {...}
}
```

---

## 4. History File (`~/.claude/history.jsonl`)

Command/prompt history for autocomplete:

```json
{
  "display": "user's typed prompt or command",
  "pastedContents": {},
  "timestamp": 1760429672198,
  "project": "/Users/borui/Devs/Project"
}
```

---

## 5. Stats Cache (`~/.claude/stats-cache.json`)

Aggregated usage statistics:

```json
{
  "version": 1,
  "lastComputedDate": "2025-12-29",
  "dailyActivity": [
    {
      "date": "2025-12-03",
      "messageCount": 1518,
      "sessionCount": 5,
      "toolCallCount": 489
    }
  ]
}
```

---

## 6. File History (`~/.claude/file-history/<session-uuid>/`)

Backup files for undo/rewind functionality:
- Filename format: `<file-content-hash>@v<version>`
- Example: `0139c4a6fe65b636@v1`, `0139c4a6fe65b636@v2`
- Contains raw file contents at each version

---

## 7. Todos (`~/.claude/todos/`)

Per-session todo lists:
- Filename: `<session-uuid>-agent-<session-uuid>.json`
- Content: JSON array of todo items (often `[]` if no active todos)

```json
[
  {
    "content": "Task description",
    "activeForm": "Doing task description",
    "status": "pending" | "in_progress" | "completed"
  }
]
```

---

## Key Field Reference

### Message Linking
| Field | Description |
|-------|-------------|
| `uuid` | Unique identifier for this message |
| `parentUuid` | Links to parent message (forms conversation tree) |
| `sessionId` | Session this message belongs to |
| `isSidechain` | True if message is on an alternate branch |

### Context Fields
| Field | Description |
|-------|-------------|
| `cwd` | Current working directory when message sent |
| `gitBranch` | Git branch at time of message |
| `version` | Claude Code version |
| `timestamp` | ISO 8601 timestamp |

### Usage Tracking
| Field | Description |
|-------|-------------|
| `input_tokens` | Tokens in the prompt |
| `output_tokens` | Tokens in the response |
| `cache_creation_input_tokens` | Tokens used to create cache |
| `cache_read_input_tokens` | Tokens read from cache |
| `service_tier` | "standard" or other tier |

### Tool Call Fields
| Field | Description |
|-------|-------------|
| `tool_use.id` | Unique ID for this tool invocation |
| `tool_use.name` | Tool name (Read, Write, Bash, etc.) |
| `tool_use.input` | Parameters passed to tool |
| `tool_result.tool_use_id` | Links result back to tool call |
| `tool_result.content` | Output from tool execution |

---

## Tool Types: Built-in, Skills, MCP, and Agents

All tools in Claude Code use the same underlying `tool_use`/`tool_result` message format, but with different naming conventions and storage patterns.

### Tool Type Comparison

| Type | Storage Format | Name Pattern | Example |
|------|----------------|--------------|---------|
| **Built-in tools** | `tool_use` | Simple name | `Read`, `Write`, `Bash`, `Glob`, `Grep` |
| **MCP tools** | `tool_use` | `server__tool` (double underscore) | `github__create_issue`, `slack__post_message` |
| **Skills** | User message with XML tags | `<command-name>` | `/commit`, `/speckit.tasks` |
| **Task (subagent)** | `tool_use` + separate file | `Task` | Creates `agent-*.jsonl` file |

### Built-in Tools

Standard tools provided by Claude Code:

```json
{
  "type": "tool_use",
  "id": "toolu_01ABC...",
  "name": "Read",
  "input": {
    "file_path": "/path/to/file.ts"
  }
}
```

Common built-in tools: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `LSP`

### MCP Tools (Model Context Protocol)

MCP tools from external servers use a namespaced naming convention:

```json
{
  "type": "tool_use",
  "id": "toolu_01XYZ...",
  "name": "github__create_issue",
  "input": {
    "repo": "owner/repo",
    "title": "Bug report",
    "body": "Description..."
  }
}
```

**Naming Pattern**: `<server_name>__<tool_name>` (double underscore separator)

MCP server configuration is stored in:
- User scope: `~/.claude.json` under `mcpServers`
- Project scope: `.mcp.json` in project root

### Skills (Slash Commands)

Skills are stored as **two linked user messages**: the command trigger and the expanded prompt.

**Message 1 - Skill Command (user input):**
```json
{
  "type": "user",
  "uuid": "58f69515-7c13-44b2-83c9-6d54e85ed67d",
  "parentUuid": "previous-message-uuid",
  "message": {
    "role": "user",
    "content": "<command-message>speckit.constitution</command-message>\n<command-name>/speckit.constitution</command-name>"
  }
}
```

**Message 2 - Expanded Prompt (system-injected):**
```json
{
  "type": "user",
  "uuid": "a3f2791c-b8cd-42e6-b56f-02eb336b3338",
  "parentUuid": "58f69515-7c13-44b2-83c9-6d54e85ed67d",  // ← Links to skill command!
  "isMeta": true,                                         // ← Marks as system content
  "timestamp": "2025-12-30T11:43:38.487Z",               // ← Same timestamp
  "message": {
    "role": "user",
    "content": [{"type": "text", "text": "## User Input\n\nYou are updating the project..."}]
  }
}
```

**How they connect for display:**
```
Skill Command (uuid: 58f69515...)
    │
    └── parentUuid ──→ Expanded Prompt (uuid: a3f2791c..., isMeta: true)
                           │
                           └── parentUuid ──→ Assistant Response
```

**Key fields for merging:**
- `parentUuid`: Links expanded prompt to skill command
- `isMeta: true`: Indicates system-injected content (not direct user input)
- **Same timestamp**: Both messages share identical timestamp

**Skill Sources:**
- Built-in: `/help`, `/clear`, `/config`, `/memory`
- Project-defined: `.claude/commands/*.md`
- User-defined: `~/.claude/commands/*.md`
- Plugins: `plugin-name:skill-name` (e.g., `commit-commands:commit`)

### Task Tool (Subagents)

The `Task` tool spawns subagents and creates separate session files:

**In main session:**
```json
{
  "type": "tool_use",
  "id": "toolu_01TH867z...",
  "name": "Task",
  "input": {
    "description": "Research Claude Code session storage",
    "prompt": "Research how Claude Code stores...",
    "subagent_type": "claude-code-guide"
  }
}
```

**Tool result contains agent metadata:**
```json
{
  "toolUseResult": {
    "status": "completed",
    "agentId": "a5591a2",
    "content": [{"type": "text", "text": "Agent's response..."}],
    "totalDurationMs": 170119,
    "totalTokens": 76496,
    "totalToolUseCount": 18
  }
}
```

**Separate agent file** (`agent-a5591a2.jsonl`) contains the full subagent conversation.

### Tool Result Formats

All tool types return results in the same format (as user messages):

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01ABC...",
        "content": "Result content here..."
      }
    ]
  },
  "toolUseResult": {
    "stdout": "...",
    "stderr": "...",
    "interrupted": false
  }
}
```

The `toolUseResult` field contains additional metadata depending on the tool type:
- **Bash**: `stdout`, `stderr`, `interrupted`
- **Read/Write**: `filePath`, `content`, `structuredPatch`
- **Task**: `agentId`, `totalDurationMs`, `totalTokens`, `totalToolUseCount`

---

## Data Lifecycle

1. **Session Creation**: New `<uuid>.jsonl` created in project folder
2. **Messages Appended**: Each message/event is a new line in JSONL
3. **File Backups**: Changed files saved to `file-history/<session>/`
4. **Summary Generated**: AI generates summary, saved as first entry
5. **Cleanup**: Sessions older than `cleanupPeriodDays` deleted on startup
