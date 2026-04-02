# CLI Interface Contract: Agent Session Linking

**Feature**: 008-agent-session-linking  
**Date**: 2026-04-02

## Overview

This contract defines the user-facing CLI behavior changes needed so `cch` can navigate directly from main-session metadata to nested or flat agent transcripts without polluting top-level session lists.

## Command: `list`

### Syntax

```bash
cch list [options]
```

No new flags are introduced.

### Updated Result Semantics

- Human-readable list output continues to show only main sessions as top-level rows.
- JSON list output includes both `agentIds` and `unresolvedAgentIds` for each main-session summary.
- Linked agent IDs are derived from explicit main-session evidence first and nested fallback path ownership second.

### JSON Example

```json
{
  "success": true,
  "data": [
    {
      "index": 0,
      "id": "11111111-1111-1111-1111-111111111111",
      "projectPath": "/tmp/project",
      "summary": "Nested agent example",
      "agentIds": ["abc123"],
      "unresolvedAgentIds": ["missing456"]
    }
  ]
}
```

## Command: `view`

### Updated Syntax

```bash
cch view <session>
```

### Accepted Identifier Forms

- Numeric session index
- Main-session UUID
- Partial main-session UUID prefix
- Bare linked agent identifier
- `agent-<id>` form of a linked agent identifier

### Updated Usage Text

```text
Usage: cch view <session>

Provide a session index, session UUID, or agent ID.
```

## View Output Behavior

### Main Session Detail

- Human-readable output may show:
  - linked agent IDs that are directly usable in follow-up lookup
  - unresolved referenced agent IDs that are not currently retrievable
- JSON output includes both `agentIds` and `unresolvedAgentIds`.

### Direct Agent Transcript View

- `cch view abc123` opens the matching agent transcript when exactly one discoverable transcript matches.
- `cch view agent-abc123` behaves the same as the bare form.
- The agent transcript remains a separate session view rather than being merged into the parent main-session transcript.

### Ambiguity Handling

```bash
$ cch view abc123
```

```text
Error: Agent ID is ambiguous: abc123
Multiple matching agent transcripts were found. Use a more specific session identifier.
```

Exit code: non-zero

### Missing Agent Handling

```bash
$ cch view missing456
```

```text
Error: Session not found: missing456
Try 'cch list --json' or inspect the parent session's unresolved agent references.
```

Exit code: non-zero

## Option Interactions

| Command | Behavior |
|---------|----------|
| `cch list` | Shows only main-session rows |
| `cch list --json` | Includes `agentIds` and `unresolvedAgentIds` in each summary |
| `cch view <uuid>` | Shows main-session detail with linked and unresolved agent metadata |
| `cch view <agent-id>` | Opens matching child-agent transcript when unique |
| `cch view agent-<id>` | Same lookup behavior as bare agent ID |

## Help Text Impact

- `cch view --help` MUST describe accepted identifier forms beyond index/UUID only.
- User-facing ambiguity errors MUST be distinct from not-found errors.
- No new flags are required for `list` or `view`.
