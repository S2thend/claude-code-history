# Quickstart: Full Content Library Output

**Feature**: 009-full-content-lib  
**Date**: 2026-04-03

## Overview

This guide maps the display/data-fidelity boundary fix onto the current codebase so implementation can proceed without re-investigating the parser, formatter, and CLI option plumbing.

## What We’re Building

- Library and parser functions return complete message, tool, and warning content with no truncation.
- Default human-readable `cch view` may still abbreviate long display fields for readability.
- `cch view --full` disables formatter truncation and keeps the existing no-pager behavior.
- JSON output and exports remain full-fidelity regardless of `--full`.

## Key Files To Modify

| File | Purpose | Planned Change |
|------|---------|----------------|
| `src/lib/parser.ts` | Parse warnings for invalid JSONL lines | Remove `100`-character warning-content truncation |
| `src/cli/formatters/session.ts` | Human-readable session rendering | Add `full` formatter option and gate all formatter abbreviation behind it |
| `src/cli/commands/view.ts` | CLI view command | Pass global `options.full` into `formatSession(...)` |
| `tests/unit/parser.test.ts` | Parser warnings | Assert long invalid-line warnings are returned in full |
| `tests/unit/cli/formatters/session.test.ts` | Formatter behavior | Split default abbreviation tests from `full: true` untruncated tests |
| `tests/integration/get-session.test.ts` | Library retrieval fidelity | Add long user/tool payload coverage and assert exact content |
| `tests/integration/cli/view.test.ts` | End-to-end CLI view behavior | Verify default concise rendering vs `--full` complete rendering |

## Suggested Implementation Order

### Step 1: Remove Library-Side Truncation

- Update `parseJsonLine()` so invalid-line warning content is returned in full.
- Update parser tests that currently expect `100 + "..."` warning previews.
- Add `getSession()` integration coverage with long text, tool input, and tool result payloads to prove session retrieval is already full-fidelity and stays that way.

### Step 2: Add Formatter-Level Full Mode

- Extend `SessionFormatOptions` with `full?: boolean`.
- Introduce a formatter helper that returns the original string in full mode and applies default abbreviation only when full mode is off.
- Apply that helper to tool input rendering, tool result rendering, thinking previews, and fallback tool-result previews.

### Step 3: Wire `--full/-f` Into `cch view`

- Pass `options.full` from `executeView()` into `formatSession(...)` for every human-readable output path, including empty-filter results.
- Keep `outputWithPager(formattedSession, options.full)` unchanged so full mode still bypasses pagination.
- Leave `formatSessionForJson(...)` full-fidelity and independent of display truncation limits.

### Step 4: Lock Behavior With Tests

- Add formatter unit tests for:
  - default mode abbreviates long tool input/output/thinking content with a visible marker,
  - full mode displays the complete same values with no omission marker.
- Add CLI integration tests for:
  - `cch view <session>` default concise rendering,
  - `cch view <session> --full` complete rendering,
  - `cch view <session> --json` full payloads without requiring `--full`.

## Example Test Payloads

Use generated long strings rather than large fixture files where possible:

```typescript
const longText = 'x'.repeat(1200);
const longToolResult = ['line-1', 'x'.repeat(1200), 'line-3'].join('\n');
```

For parser warning coverage:

```typescript
const longInvalidLine = `{"broken": "${'x'.repeat(1200)}`;
```

## Verification Commands

```bash
npm run typecheck
npm test
npm run lint
node dist/cli/index.js view 0
node dist/cli/index.js view 0 --full
node dist/cli/index.js view 0 --json
```

## Expected Outcomes

- No `slice(...)+ "..."`-style data shortening remains in `src/lib/`.
- `getSession()` returns complete long message/tool payloads for programmatic callers.
- Parser warnings expose full invalid-line text in `ParseWarning.content`.
- Default `cch view` remains concise and visibly marks display-only omission.
- `cch view --full` shows all session content with no formatter truncation and no pager.
- `cch view --json` remains complete without needing `--full`.
