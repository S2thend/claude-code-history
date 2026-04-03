# CLI Interface Contract: Full Content Library Output

**Feature**: 009-full-content-lib  
**Date**: 2026-04-03

## Overview

This contract defines the human-readable `cch view` display behavior after making `--full/-f` disable formatter-level abbreviation in addition to pagination.

## Global Option: `--full/-f`

### Syntax

```bash
cch [--full|-f] view <session> [--only <types>]
```

### Updated Semantics

| Mode | Pager | Human-readable abbreviation |
|------|-------|-----------------------------|
| Default `cch view <session>` | May paginate when stdout is interactive | Long formatter fields may be abbreviated with visible omission markers |
| `cch view <session> --full` | Pager bypassed | No formatter-level truncation for any displayed session content |
| `cch view <session> --json` | Direct JSON output | No formatter truncation; JSON payload remains complete regardless of `--full` |

## Command: `view`

### Human-Readable Default Mode

```bash
cch view 0
```

**Behavioral Contract**:
- Session headers, metadata, and message ordering remain unchanged.
- Long tool inputs, long tool results, thinking text, and fallback tool-result previews may be abbreviated for readability using the preserved default caps of 300, 500, 100, and 200 characters respectively.
- Any abbreviated field must include the dedicated `[...truncated for display]` marker so display-added omission is distinguishable from source-authored `...` text.
- Abbreviation is display-only and must not mutate session data returned by the library.

### Human-Readable Full Mode

```bash
cch view 0 --full
```

**Behavioral Contract**:
- Displays complete user text, assistant text, tool inputs, tool results, and thinking blocks with no formatter-added truncation.
- Preserves the existing no-pager behavior of `--full/-f`.
- Keeps existing filter behavior such as `--only progress` while still disabling abbreviation for the displayed messages that remain.

### JSON Mode

```bash
cch view 0 --json
```

**Behavioral Contract**:
- JSON output returns complete session data and is unaffected by formatter display limits.
- `--full` is not required to obtain full JSON payloads.

## Formatter Option Contract

```typescript
export interface SessionFormatOptions {
  messages: Message[];
  filter: FilterableMessageType[];
  totalMessageCount: number;
  tokenStats?: AggregateTokenStats;
  full?: boolean;
}

export function formatSession(
  session: Session,
  options?: SessionFormatOptions
): string;
```

**Behavioral Contract**:
- `full: true` disables all formatter-side abbreviation branches.
- `full: false` or omitted preserves concise default rendering for long fields using the existing 300/500/100/200 caps for tool inputs, tool results, thinking blocks, and fallback tool-result previews.
- `formatSessionForJson(...)` remains a direct data formatter and does not add omission markers.

## Examples

### Default concise display

```text
[Tool: Edit]
  {
    "old_string": "very long text[...truncated for display]",
    "new_string": "very long text[...truncated for display]"
  }

  → Result:
    very long command output[...truncated for display]
```

### Full display

```text
[Tool: Edit]
  {
    "old_string": "full original value with no formatter truncation",
    "new_string": "full replacement value with no formatter truncation"
  }

  → Result:
    full tool output with no formatter truncation
```

## Test Obligations

- Unit tests must verify `formatSession(..., { full: true })` renders long tool inputs/results/thinking text without omission markers.
- Unit tests must verify default `formatSession(...)` still abbreviates long fields with `[...truncated for display]` and keeps source-authored `...` text distinguishable.
- CLI integration tests must verify `cch view --full` passes full mode into the formatter and preserves complete human-readable output.
- CLI integration tests must verify default `cch view` and `cch view --json` continue to work with existing session identifiers and filters.
- CLI integration tests must verify running default/full `cch view` does not mutate later `getSession()` retrieval or JSON/Markdown exports for the same session.
