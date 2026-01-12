# CLI Interface Contract: Message Type Filter

**Feature**: 003-message-type-filter
**Date**: 2026-01-12

## Overview

This document defines the CLI interface additions for the message type filter feature.

## Command: `view`

### New Option: `--only`

```
-o, --only <types>    Filter messages by type (user,assistant,tool,thinking,error)
```

**Syntax**:
```bash
cch view <session> --only <type>[,<type>...]
```

**Parameters**:
- `<types>`: Comma-separated list of message types to include
- Valid types: `user`, `assistant`, `tool`, `thinking`, `error`

### Examples

```bash
# Show only user messages
cch view 0 --only user

# Show only tool calls
cch view 0 --only tool

# Show user messages and tool calls
cch view 0 --only user,tool

# Show everything except assistant explanations
cch view 0 --only user,tool,thinking,error

# Combined with JSON output
cch view 0 --only tool --json

# Combined with full output (no paging)
cch view 0 --only user --full
```

### Option Interactions

| Option Combination | Behavior |
|--------------------|----------|
| `--only` alone | Filter applied, human-readable output |
| `--only --json` | Filter applied, JSON output with filtered messages |
| `--only --full` | Filter applied, no paging |
| `--only --json --full` | Filter + JSON (--full has no effect on JSON) |

### Output Formats

#### Human-Readable (default)

```
Session: abc123-def456-...
Project: /path/to/project
Started: 2026-01-12 10:30:45
Messages: 5 (filtered from 50)
Branch: main

────────────────────────────────────────────────────────────────────────────────

[10:30:45] USER
How do I fix this bug?

────────────────────────────────────────────────────────────────────────────────

[10:31:02] USER
Can you show me the file?

────────────────────────────────────────────────────────────────────────────────
```

**Note**: Header shows `Messages: X (filtered from Y)` when filter is active.

#### JSON Output

```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-...",
    "projectPath": "/path/to/project",
    "timestamp": "2026-01-12T10:30:45.000Z",
    "messageCount": 5,
    "totalMessageCount": 50,
    "filter": ["user"],
    "messages": [
      {
        "type": "user",
        "uuid": "...",
        "timestamp": "2026-01-12T10:30:45.000Z",
        "content": "How do I fix this bug?"
      }
    ]
  }
}
```

**Note**: JSON includes `totalMessageCount` and `filter` fields when filtering is active.

### Error Handling

#### Invalid Filter Type

```bash
$ cch view 0 --only invalid
```

**Output** (stderr):
```
Error: Invalid filter type 'invalid'
Valid types: user, assistant, tool, thinking, error
```

**Exit code**: 1

#### No Matching Messages

```bash
$ cch view 0 --only thinking
```

**Output** (stdout):
```
Session: abc123-def456-...
Project: /path/to/project
Started: 2026-01-12 10:30:45

No messages match filter: thinking
```

**Exit code**: 0 (success - the operation completed, just no results)

#### JSON with No Matches

```bash
$ cch view 0 --only thinking --json
```

**Output**:
```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-...",
    "messageCount": 0,
    "totalMessageCount": 50,
    "filter": ["thinking"],
    "messages": []
  }
}
```

### Help Text

```
Usage: cch view [options] <session>

View a session's contents

Arguments:
  session               Session index (0 = most recent) or UUID

Options:
  -o, --only <types>    Filter messages by type (user,assistant,tool,thinking,error)
  -j, --json            Output as JSON
  -f, --full            Disable paging (show all output at once)
  -h, --help            display help for command

Filter Types:
  user       - Your messages (questions, prompts)
  assistant  - AI text responses (excludes tool calls)
  tool       - Tool invocations (Read, Write, Bash, etc.)
  thinking   - AI reasoning/thinking blocks
  error      - Tool results that returned errors

Examples:
  cch view 0 --only user           Show only your messages
  cch view 0 --only tool           Show only tool calls
  cch view 0 --only user,tool      Show your messages and tool calls
```

## Validation Rules

1. **Case Sensitivity**: Types must be lowercase
   - `--only User` → Error
   - `--only USER` → Error
   - `--only user` → Valid

2. **Whitespace Handling**: Spaces around commas are trimmed
   - `--only "user, tool"` → Valid (parsed as `['user', 'tool']`)
   - `--only " user , tool "` → Valid

3. **Duplicates**: Allowed but have no additional effect
   - `--only user,user,user` → Same as `--only user`

4. **Empty Value**: Shows error
   - `--only ""` → Error: "Filter type required"

5. **All Types**: Equivalent to no filter
   - `--only user,assistant,tool,thinking,error` → Shows all messages
