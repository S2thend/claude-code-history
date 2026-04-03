# Data Model: Full Content Library Output

**Feature**: 009-full-content-lib  
**Date**: 2026-04-03

## Overview

This feature does not introduce new persisted entities. It tightens the fidelity guarantees of existing session/message/tool/parser data and adds one display-mode option to the CLI formatter contract.

## Updated Data Shapes

### Session

Existing full-session payload returned by `getSession()` and `getAgentSession()`.

```typescript
interface Session extends SessionSummary {
  encodedPath: string;
  version: string;
  messages: Message[];
}
```

**Validation Rules**:
- `messages` preserves the complete ordered transcript as parsed from the source session file.
- Message text, tool input objects, tool result strings, thinking text, line breaks, and non-ASCII characters are not shortened or rewritten by library retrieval.
- CLI display mode does not mutate `Session` instances or alter later programmatic retrieval results.

### AssistantMessage / UserMessage Content

Existing message content objects whose payload fields must remain complete in the library layer.

```typescript
interface UserMessage {
  type: 'user';
  content: string | ToolResultContent[];
}

interface AssistantMessage {
  type: 'assistant';
  content: AssistantContent[];
}

interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}
```

**Validation Rules**:
- `ToolUseContent.input` retains complete structured arguments, including long `old_string`, `new_string`, file content, and command parameters.
- `ToolResultContent.content` retains complete tool output, including long file reads, shell output, and search results.
- User/assistant text and thinking strings are preserved exactly by parser/session retrieval.
- Empty strings remain empty strings; missing optional fields remain missing/null according to existing types.

### ParseWarning

Existing parser warning payload for invalid JSONL lines.

```typescript
interface ParseWarning {
  line: number;
  error: string;
  content?: string;
}
```

**Validation Rules**:
- `content` contains the full invalid line text after existing line-trim normalization, not a shortened preview.
- `line` and `error` semantics remain unchanged.
- Empty-line warnings continue to omit caller-visible `content` when no content exists.

### SessionFormatOptions

CLI formatter options used by human-readable session rendering.

```typescript
interface SessionFormatOptions {
  messages: Message[];
  filter: FilterableMessageType[];
  totalMessageCount: number;
  tokenStats?: AggregateTokenStats;
  full?: boolean;
}
```

**Validation Rules**:
- `full: true` disables all formatter-level abbreviation for tool inputs, tool results, thinking text, and fallback tool-result previews.
- `full: false` or omitted may abbreviate long human-readable display fields, but only in formatter output strings.
- `formatSessionForJson()` remains full-fidelity and does not use `full` to remove or shorten payload data.

## Type Relationships

```text
Session
└── messages: Message[]
    ├── UserMessage.content
    │   ├── full user text
    │   └── full ToolResultContent[]
    └── AssistantMessage.content
        ├── full TextContent
        ├── full ToolUseContent.input
        └── full ThinkingContent

parseJsonLine / parseJsonlFile
└── ParseWarning.content contains full invalid-line text

formatSession
└── SessionFormatOptions.full controls display-only abbreviation
```

## State / Mode Transitions

1. Parse source JSONL lines into raw entries and warnings without truncating warning content.
2. Transform raw entries into full-fidelity `Message` objects.
3. Return `Session` objects from `getSession()`/`getAgentSession()` without shortening payload fields.
4. Render human-readable CLI output:
   - default mode may abbreviate long fields,
   - full mode displays all fields untruncated.
5. Emit JSON output/export payloads directly from full-fidelity session data.

## Validation Requirements

1. Library session retrieval returns all characters for long user text, assistant text, tool inputs, tool results, and thinking blocks.
2. Parser warnings return full invalid-line content.
3. Default human-readable `cch view` may abbreviate long formatter output and must make abbreviation visible.
4. `cch view --full` displays complete human-readable content and still bypasses the pager.
5. JSON session output and exports remain complete regardless of `--full`.
6. Switching between default and full display modes never changes the underlying session data.
