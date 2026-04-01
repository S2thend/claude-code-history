# CLI Interface Contract: Support Progress Messages

**Feature**: 007-support-progress-messages  
**Date**: 2026-04-01

## Overview

This contract defines the user-facing CLI behavior changes required to surface `progress` session entries in `cch search` and `cch view`.

## Command: `search`

### Existing Syntax

```bash
cch search <query> [options]
```

No new flags are introduced. The behavior change is additive: matches from `progress` messages are now included.

### Updated Result Semantics

- Global search MUST include matches from progress messages.
- Session-scoped search (`--session`) MUST include matches from progress messages.
- Human-readable output MUST label progress matches as `PROGRESS`.
- JSON output MUST preserve `messageType: "progress"` for progress matches.

### Human-Readable Example

```text
Found 1 matches for "AGENT_TASK_SCHEMA":

────────────────────────────────────────────────────────────────────────────────

[my-project] Progress repro
  Session: 99999999-9999-9999-9999-999999999999
  PROGRESS message, line 1

>    1 │ AGENT_TASK_SCHEMA found in tool progress output

────────────────────────────────────────────────────────────────────────────────
```

### JSON Example

```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "sessionId": "99999999-9999-9999-9999-999999999999",
        "sessionSummary": "Progress repro",
        "projectPath": "/tmp/project-progress",
        "messageUuid": "msg-progress",
        "messageType": "progress",
        "match": "AGENT_TASK_SCHEMA",
        "context": ["AGENT_TASK_SCHEMA found in tool progress output"],
        "lineNumber": 1
      }
    ],
    "pagination": {
      "total": 1,
      "offset": 0,
      "limit": 1,
      "hasMore": false
    }
  }
}
```

## Command: `view`

### Updated Option: `--only`

```text
-o, --only <types>    Filter by message type (user,assistant,tool,thinking,error,progress)
```

### Syntax

```bash
cch view <session> --only <type>[,<type>...]
```

### Valid Filter Values

- `user`
- `assistant`
- `tool`
- `thinking`
- `error`
- `progress`

### Examples

```bash
# Show the full transcript, including progress messages
cch view 0

# Show only progress messages
cch view 0 --only progress

# Show progress messages alongside tool invocations
cch view 0 --only tool,progress

# Include progress messages in JSON output
cch view 0 --only progress --json
```

## View Output Behavior

### Human-Readable Transcript

- Progress messages appear in chronological order with the rest of the transcript.
- Progress messages are visually distinct from `USER` and `ASSISTANT` blocks.
- Header message counts include progress messages when present in the displayed transcript.

### Human-Readable Example

```text
Session: 99999999-9999-9999-9999-999999999999
Project: /tmp/project-progress
Started: 2026-04-01 08:00:00
Messages: 3
Branch: main
Summary: Progress repro

────────────────────────────────────────────────────────────────────────────────

[08:00:00] USER
regular visible message

────────────────────────────────────────────────────────────────────────────────

[08:00:01] PROGRESS
Tool is scanning project files...

────────────────────────────────────────────────────────────────────────────────

[08:00:02] ASSISTANT (claude-test) [2 tokens]
final assistant message

────────────────────────────────────────────────────────────────────────────────
```

### JSON Output

- Progress messages appear in `messages[]` with `type: "progress"`.
- Filter metadata continues to reflect the requested filter list.
- `messageCount` reflects the number of messages returned in the output payload.

### JSON Example

```json
{
  "success": true,
  "data": {
    "id": "99999999-9999-9999-9999-999999999999",
    "messageCount": 1,
    "totalMessageCount": 3,
    "filter": ["progress"],
    "messages": [
      {
        "type": "progress",
        "uuid": "msg-progress",
        "timestamp": "2026-04-01T00:00:01.000Z",
        "content": [
          {
            "type": "text",
            "text": "Tool is scanning project files..."
          }
        ]
      }
    ]
  }
}
```

## Error and Empty-State Handling

### Invalid Filter Type

```bash
$ cch view 0 --only invalid
```

```text
Error: Invalid filter type 'invalid'
Valid types: user, assistant, tool, thinking, error, progress
```

Exit code: non-zero

### No Matching Progress Messages

```bash
$ cch view 0 --only progress
```

If the selected session contains no progress messages, the command succeeds and returns an informative empty-state message, consistent with existing filter behavior.

### Search With No Progress Matches

If the query does not match any searchable content, including progress messages, `cch search` continues to return the existing “No matches found” response.

## Option Interactions

| Option Combination | Behavior |
|--------------------|----------|
| `view --only progress` | Shows only progress messages |
| `view --only tool,progress` | Shows tool invocations and progress messages |
| `view --only progress --json` | Returns only progress messages in JSON |
| `search --session <session>` | Searches progress and existing searchable message types within the target session |
| `search --json` | Returns progress matches with `messageType: "progress"` |

## Help Text Impact

Help text for `cch view` MUST include `progress` in the filter value list. No new flags are required for `cch search`, but user-visible examples and documentation should reflect that progress content is now searchable.
