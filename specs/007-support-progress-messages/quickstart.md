# Quickstart: Support Progress Messages

**Feature**: 007-support-progress-messages  
**Date**: 2026-04-01

## Overview

This guide maps the progress-message feature onto the existing Claude Code History codebase so implementation can proceed with minimal rediscovery.

## What We’re Building

Support for top-level session entries with `type: "progress"` so they:

- survive parsing into the typed session model,
- appear in `getSession()` results and exported session data,
- are searchable via `cch search`,
- render in `cch view`,
- and can be isolated with `cch view --only progress`.

## Key Files To Modify

| File | Purpose | Planned Change |
|------|---------|----------------|
| `src/lib/types.ts` | Canonical type model | Add `ProgressMessage`, widen `MessageType`, `Message`, `SearchMatch`, and filter unions |
| `src/lib/parser.ts` | Raw JSONL normalization | Parse `type: "progress"` entries and include them in metadata counts |
| `src/lib/session.ts` | Session retrieval/filtering | Count progress as displayable, classify it for filters, and keep activity timestamps accurate |
| `src/lib/search.ts` | Search extraction | Include progress text and emit `messageType: "progress"` |
| `src/lib/export.ts` | Export fidelity | Render progress messages in Markdown export; JSON export inherits typed session data |
| `src/lib/index.ts` | Public API surface | Re-export new types |
| `src/cli/commands/view.ts` | View command | Accept `progress` in `--only` validation and filtered counts |
| `src/cli/formatters/session.ts` | Transcript formatting | Add a distinct progress renderer |
| `src/cli/formatters/search.ts` | Search output labels | Show `PROGRESS` for progress matches |
| `tests/unit/parser.test.ts` | Parser regression | Add progress transformation coverage |
| `tests/unit/session.test.ts` | Filter/count logic | Add progress classification and displayable-count tests |
| `tests/integration/search-sessions.test.ts` | Library search | Verify progress-only terms become searchable |
| `tests/integration/cli/view.test.ts` | CLI transcript | Verify progress rendering and `--only progress` |
| `tests/integration/export-sessions.test.ts` | Export fidelity | Verify progress survives JSON and Markdown export |

## Suggested Implementation Order

### Step 1: Extend the Core Message Model

- Add `ProgressMessage` and supporting content types.
- Widen the message unions and filter/search type unions.
- Re-export the new public types.

### Step 2: Parse and Count Progress Messages

- Add a `progress` branch in `transformEntry()`.
- Reuse existing readable-content extraction patterns where possible.
- Update metadata helpers so displayable counts and activity timestamps include progress.

### Step 3: Make Progress Searchable

- Add progress text extraction to the library search path.
- Widen search result typing and human-readable labels.
- Verify both all-session and session-scoped search paths.

### Step 4: Surface Progress In View and Filtering

- Add a dedicated `progress` filter value.
- Update displayable-message logic so progress survives default transcript rendering.
- Add a distinct transcript label for progress output.

### Step 5: Preserve Progress In Exports

- Ensure JSON export includes progress automatically through the session object.
- Add Markdown rendering so progress entries are not skipped.

### Step 6: Lock In Behavior With Tests

- Add synthetic fixtures or inline sessions containing a top-level `progress` entry.
- Cover parser, search, filtering, view, and export regressions.
- Re-run typecheck, unit tests, and CLI integration tests.

## Example Synthetic Fixture Shape

Use a minimal session with one progress entry between a user and assistant message:

```json
{"type":"summary","summary":"Progress repro","leafUuid":"msg-assistant"}
{"type":"user","uuid":"msg-user","parentUuid":null,"timestamp":"2026-04-01T00:00:00.000Z","sessionId":"session-1","cwd":"/tmp/project","gitBranch":"main","version":"2.0.0","message":{"role":"user","content":"regular visible message"}}
{"type":"progress","uuid":"msg-progress","parentUuid":"msg-user","timestamp":"2026-04-01T00:00:01.000Z","sessionId":"session-1","cwd":"/tmp/project","gitBranch":"main","version":"2.0.0","message":{"role":"assistant","content":[{"type":"text","text":"PROGRESS_ONLY_TOKEN"}]}}
{"type":"assistant","uuid":"msg-assistant","parentUuid":"msg-progress","timestamp":"2026-04-01T00:00:02.000Z","sessionId":"session-1","message":{"role":"assistant","model":"claude-test","content":[{"type":"text","text":"final assistant message"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
```

## Verification Commands

```bash
npm run typecheck
npm test
node dist/cli/index.js --data-path <test-data-dir> search "PROGRESS_ONLY_TOKEN" --full
node dist/cli/index.js --data-path <test-data-dir> view 0 --only progress --full
```

## Expected Outcomes

- Progress-only search terms are returned by both library and CLI search flows.
- `cch view` shows progress entries in chronological order.
- `cch view --only progress` works as a dedicated filtered transcript.
- Session counts shown to users align with displayed progress entries.
- Exported sessions no longer omit progress from the typed session model.
