# CLI Command Contracts

**Feature**: 002-cli-ui-layer
**Date**: 2025-12-31
**Purpose**: Define the CLI command interface contracts

## Global Options

All commands support these global options:

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--data-path` | `-d` | string | `~/.claude/projects/` | Custom Claude Code data directory |
| `--json` | `-j` | boolean | false | Output in JSON format |
| `--full` | `-f` | boolean | false | Output full content (no pagination) |
| `--help` | `-h` | boolean | - | Show help for command |
| `--version` | `-V` | boolean | - | Show version number |

## Commands

### 1. `cch list`

List all available sessions.

```
cch list [options]
```

**Options**:

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--workspace` | `-w` | string | - | Filter by workspace/project path |
| `--limit` | `-l` | number | 50 | Maximum number of sessions to display |
| `--offset` | `-o` | number | 0 | Number of sessions to skip |

**Human Output**:
```
IDX  TIMESTAMP             PROJECT                     SUMMARY                    MSGS
───  ────────────────────  ──────────────────────────  ─────────────────────────  ────
  0  2025-12-31 14:30:00   /Users/dev/my-project       Implement user auth...       45
  1  2025-12-30 10:15:00   /Users/dev/other-project    Fix payment bug in ch...     23
  2  2025-12-29 09:00:00   /Users/dev/my-project       Add dark mode toggle...      67

Showing 1-3 of 156 sessions. Use --offset to see more.
```

**JSON Output** (`--json`):
```json
{
  "success": true,
  "data": [
    {
      "index": 0,
      "id": "abc123-...",
      "projectPath": "/Users/dev/my-project",
      "summary": "Implement user authentication",
      "timestamp": "2025-12-31T14:30:00.000Z",
      "lastActivityAt": "2025-12-31T15:45:00.000Z",
      "messageCount": 45,
      "agentIds": []
    }
  ],
  "pagination": {
    "total": 156,
    "offset": 0,
    "limit": 50,
    "hasMore": true
  }
}
```

**Exit Codes**:
- 0: Success
- 2: Invalid options
- 3: No sessions found (with `--workspace` filter)
- 4: Data directory not accessible

---

### 2. `cch view <session>`

View full contents of a session.

```
cch view <session> [options]
```

**Arguments**:

| Argument | Required | Description |
|----------|----------|-------------|
| `session` | Yes | Session index (0-based) or UUID |

**Human Output**:
```
Session: abc123-def456-...
Project: /Users/dev/my-project
Started: 2025-12-31 14:30:00
Messages: 45

────────────────────────────────────────────────────────────────────────────────

[14:30:00] USER
How do I implement user authentication in this project?

────────────────────────────────────────────────────────────────────────────────

[14:30:15] ASSISTANT (claude-3-sonnet) [1,234 tokens]
I'll help you implement user authentication. Let me first look at your project
structure...

[Tool: Read] src/index.ts
[Tool: Glob] src/**/*.ts

Based on what I see, here's my recommendation...

────────────────────────────────────────────────────────────────────────────────
```

**JSON Output** (`--json`):
```json
{
  "success": true,
  "data": {
    "id": "abc123-...",
    "projectPath": "/Users/dev/my-project",
    "summary": "Implement user authentication",
    "timestamp": "2025-12-31T14:30:00.000Z",
    "lastActivityAt": "2025-12-31T15:45:00.000Z",
    "messageCount": 45,
    "version": "1.0.0",
    "gitBranch": "main",
    "messages": [
      {
        "uuid": "msg-1",
        "type": "user",
        "timestamp": "2025-12-31T14:30:00.000Z",
        "content": "How do I implement user authentication?"
      },
      {
        "uuid": "msg-2",
        "type": "assistant",
        "timestamp": "2025-12-31T14:30:15.000Z",
        "model": "claude-3-sonnet",
        "content": [
          { "type": "text", "text": "I'll help you..." },
          { "type": "tool_use", "name": "Read", "input": { "path": "src/index.ts" } }
        ],
        "usage": { "inputTokens": 500, "outputTokens": 734 }
      }
    ]
  }
}
```

**Exit Codes**:
- 0: Success
- 2: Invalid session identifier format
- 3: Session not found
- 4: Data directory not accessible

---

### 3. `cch search <query>`

Search across all sessions.

```
cch search <query> [options]
```

**Arguments**:

| Argument | Required | Description |
|----------|----------|-------------|
| `query` | Yes | Search term (case-insensitive) |

**Options**:

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--session` | `-s` | string | - | Search within specific session only |
| `--context` | `-c` | number | 2 | Lines of context around matches |
| `--limit` | `-l` | number | 50 | Maximum results |
| `--offset` | `-o` | number | 0 | Results to skip |

**Human Output**:
```
Found 23 matches for "authentication"

───────────────────────────────────────────────────────────────────────────────
[0] /Users/dev/my-project - Implement user auth... (line 42)

  40 │ I'll help you implement user
  41 │ authentication. Let me first look at
> 42 │ your authentication requirements and
  43 │ suggest the best approach for your
  44 │ specific use case.

───────────────────────────────────────────────────────────────────────────────
[1] /Users/dev/other-project - Fix OAuth bug... (line 15)

  13 │ The authentication middleware
  14 │ is failing because the token
> 15 │ authentication logic doesn't handle
  16 │ expired tokens correctly.

Showing 1-2 of 23 matches. Use --offset to see more.
```

**JSON Output** (`--json`):
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "abc123-...",
      "sessionIndex": 0,
      "sessionSummary": "Implement user auth...",
      "projectPath": "/Users/dev/my-project",
      "messageUuid": "msg-2",
      "messageType": "assistant",
      "match": "your authentication requirements",
      "context": [
        "I'll help you implement user",
        "authentication. Let me first look at"
      ],
      "lineNumber": 42
    }
  ],
  "pagination": {
    "total": 23,
    "offset": 0,
    "limit": 50,
    "hasMore": false
  }
}
```

**Exit Codes**:
- 0: Success
- 2: Invalid options or empty query
- 3: No matches found
- 4: Data directory not accessible

---

### 4. `cch export <session>`

Export session to JSON or Markdown.

```
cch export <session> [options]
cch export --all [options]
```

**Arguments**:

| Argument | Required | Description |
|----------|----------|-------------|
| `session` | No* | Session index or UUID (*required unless `--all`) |

**Options**:

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--format` | `-F` | string | `json` | Output format: `json` or `markdown` |
| `--output` | `-o` | string | - | Output file path (stdout if omitted) |
| `--all` | `-a` | boolean | false | Export all sessions |

**Human Output** (to stdout):
- JSON format: Pretty-printed JSON
- Markdown format: Formatted conversation

**File Output** (`--output`):
- Writes to specified file
- Displays: `Exported session to /path/to/output.md`

**JSON Output** (`--json`):
```json
{
  "success": true,
  "data": {
    "format": "markdown",
    "outputPath": "/path/to/output.md",
    "sessionCount": 1,
    "bytesWritten": 15234
  }
}
```

**Exit Codes**:
- 0: Success
- 2: Invalid options or missing session
- 3: Session not found
- 4: Cannot write to output file

---

### 5. `cch migrate <sessions...>`

Copy or move sessions to a different workspace.

```
cch migrate <sessions...> --destination <path> [options]
```

**Arguments**:

| Argument | Required | Description |
|----------|----------|-------------|
| `sessions` | Yes | One or more session indices or UUIDs |

**Options**:

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--destination` | `-D` | string | **required** | Target workspace path |
| `--mode` | `-m` | string | `copy` | Migration mode: `copy` or `move` |

**Human Output**:
```
Migrating 3 sessions to /Users/dev/new-project...

✓ Session 0 (abc123-...) - copied
✓ Session 1 (def456-...) - copied
✗ Session 2 (ghi789-...) - failed: destination exists

Completed: 2 succeeded, 1 failed
```

**JSON Output** (`--json`):
```json
{
  "success": true,
  "data": {
    "successCount": 2,
    "failedCount": 1,
    "mode": "copy",
    "destination": "/Users/dev/new-project",
    "results": [
      { "sessionId": "abc123-...", "success": true },
      { "sessionId": "def456-...", "success": true },
      { "sessionId": "ghi789-...", "success": false, "error": "destination exists" }
    ]
  }
}
```

**Exit Codes**:
- 0: All migrations succeeded
- 1: Some migrations failed (partial success)
- 2: Invalid options or no sessions specified
- 3: No sessions found
- 4: Cannot access destination

---

## Error Output

All errors are written to stderr.

**Human Format**:
```
Error: Session not found: invalid-uuid

Try 'cch list' to see available sessions.
```

**JSON Format** (when `--json` is used):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Session not found: invalid-uuid",
    "details": "Use 'cch list' to see available sessions"
  }
}
```

## Help Output

```
$ cch --help

Claude Code History CLI

Browse, search, export, and manage your Claude Code conversation history.

Usage: cch <command> [options]

Commands:
  list              List all sessions
  view <session>    View a session's contents
  search <query>    Search across sessions
  export <session>  Export session to file
  migrate <sessions...>  Copy/move sessions between workspaces

Global Options:
  -d, --data-path <path>  Custom data directory (default: ~/.claude/projects/)
  -j, --json              Output in JSON format
  -f, --full              Output full content without pagination
  -h, --help              Show help
  -V, --version           Show version

Examples:
  cch list                          List all sessions
  cch list -w /my/project           List sessions for a specific project
  cch view 0                        View the most recent session
  cch search "authentication"       Search all sessions
  cch export 0 -F markdown -o out.md  Export session to Markdown file
  cch migrate 0 1 2 -D /new/project   Copy sessions to new workspace

Environment Variables:
  CCH_DATA_PATH   Default data directory (overridden by --data-path)
  NO_COLOR        Disable colored output
  PAGER           Custom pager program (default: less)
```
