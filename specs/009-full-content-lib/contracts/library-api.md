# Library API Contract: Full Content Library Output

**Feature**: 009-full-content-lib  
**Date**: 2026-04-03

## Overview

This contract documents the full-fidelity guarantees that library/session retrieval and parser warnings must provide after removing all `src/lib/` truncation logic.

## Session Retrieval Functions

### getSession

```typescript
export async function getSession(
  identifier: number | string,
  config?: LibraryConfig
): Promise<Session>;
```

**Behavioral Contract**:
- Returns the complete `Session.messages` transcript for the requested main or agent session.
- Does not shorten `UserMessage.content` string values.
- Does not shorten `AssistantMessage.content[].text`, `AssistantMessage.content[].thinking`, `ToolUseContent.input`, or `ToolResultContent.content`.
- Preserves message order, tool-result pairing data, line breaks, empty strings, and non-ASCII text exactly as parsed.
- Returned data is independent of any previous or future CLI display mode.

### getAgentSession

```typescript
export async function getAgentSession(
  agentId: string,
  config?: LibraryConfig
): Promise<Session>;
```

**Behavioral Contract**:
- Same full-fidelity payload guarantees as `getSession()`.
- Existing lookup success, not-found, and ambiguity semantics are unchanged.

## Parser Warning Behavior

### parseJsonLine

```typescript
export function parseJsonLine(
  line: string,
  lineNumber: number
): { entry: RawSessionEntry; warning: null } | { entry: null; warning: ParseWarning };
```

### parseJsonlFile

```typescript
export async function parseJsonlFile(
  filePath: string
): Promise<ParseResult<RawSessionEntry[]>>;
```

**Behavioral Contract**:
- Invalid JSON lines produce `ParseWarning.content` containing the full trimmed invalid line, not a shortened preview.
- Empty-line warnings remain suppressible at file-parse level as they are today.
- `ParseWarning.line` and `ParseWarning.error` semantics remain unchanged.

## ParseWarning Data Shape

```typescript
export interface ParseWarning {
  line: number;
  error: string;
  content?: string;
}
```

**Behavioral Contract**:
- `content` is exact caller-visible diagnostic data, not display-shortened text.
- Existing optionality is preserved; no schema expansion is required.

## Export Functions

```typescript
export async function exportSessionToJson(
  sessionId: string | number,
  config?: LibraryConfig
): Promise<string>;

export async function exportSessionToMarkdown(
  sessionId: string | number,
  config?: LibraryConfig
): Promise<string>;
```

**Behavioral Contract**:
- Exports continue to serialize full-fidelity session data from library retrieval.
- No formatter-only abbreviation logic may affect exported JSON/Markdown payload content.

## Compatibility Notes

- No public library function signatures need to change for this feature.
- `ParseWarning.content` becomes longer for invalid lines above the old 100-character preview threshold.
- Full-fidelity behavior is additive and should not change lookup, filtering, pagination, or error-class semantics.

## Test Obligations

- Integration tests must prove long tool/message payloads are preserved through `getSession()`.
- Parser unit tests must prove invalid JSON lines above 100 characters are returned in full in `ParseWarning.content`.
- Export or JSON-format tests must prove no abbreviation markers are introduced by library data paths.
