# CLI Interface Contract: Memory-Safe Session Listing and Detail Loading

**Feature**: 010-stream-session-parsing  
**Date**: 2026-04-03

## Overview

This contract documents the user-visible `cch list` behavior after summary rows gain fallback preview text from memory-safe library parsing.

## Command: `list`

### Syntax

```bash
cch list [options]
```

No new flags are introduced.

### Human-Readable Output

```bash
cch list
```

**Behavioral Contract**:
- Main-session rows, sorting, workspace filtering, and pagination semantics remain unchanged.
- Agent sessions also appear as top-level rows in `cch list`.
- The `SUMMARY` column displays:
  - explicit `summary` when present,
  - otherwise derived `preview`,
  - otherwise `(No summary)`.
- Table column truncation remains a display concern only; the library still exposes the full bounded `preview` value in summary objects.
- Session listing must not fail with memory exhaustion on the planned large-fixture workload at or below the 512 MiB ceiling, and summary-only preview rendering must reduce fallback detail fetches by at least 90% versus the old untitled-session fallback flow on the same fixture.

### JSON Output

```bash
cch list --json
```

**Behavioral Contract**:
- Each row includes the additive `preview` field from `SessionSummary`.
- Existing fields, pagination shape, and index assignment remain unchanged.

### Example JSON Row

```json
{
  "success": true,
  "data": [
    {
      "index": 0,
      "id": "11111111-1111-1111-1111-111111111111",
      "projectPath": "/tmp/project",
      "gitBranch": "main",
      "summary": null,
      "preview": "Investigate the parser memory spike in large Claude transcripts...",
      "timestamp": "2026-04-03T10:00:00.000Z",
      "lastActivityAt": "2026-04-03T10:05:00.000Z",
      "messageCount": 42,
      "agentIds": ["abc123"],
      "unresolvedAgentIds": []
    }
  ]
}
```

## Command: `view`

### Syntax

```bash
cch view <session> [options]
```

### Behavior

- User-visible output and JSON payload shape remain unchanged except for the additive inherited `preview` field on session objects returned by the library and serialized by existing JSON helpers.
- A single `cch view <session>` request must not perform duplicate full-file parsing of the same target transcript.
- Full message rendering remains complete and non-destructive.

## Option Interactions

| Command | Behavior |
|---------|----------|
| `cch list` | Shows both main and agent sessions as top-level rows; uses `summary`, then `preview`, then `(No summary)` for the SUMMARY column |
| `cch list --json` | Includes additive `preview` per row |
| `cch view <session>` | Retrieves full messages and metadata from one transcript pass |
| `cch view <agent-id>` | Keeps existing agent lookup semantics and one-pass detail parsing |

## Out of Scope

- No `vibe-history` consumer code changes are included in this feature.
- No new CLI flags or subcommands are added.
