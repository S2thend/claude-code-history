# Library API Contract: Support Progress Messages

**Feature**: 001-support-progress-messages  
**Date**: 2026-04-01

## Overview

This contract defines the additive library API changes required so the `claude-code-history` package can preserve, search, filter, and export `progress` messages.

## Updated Public Types

### MessageType

```typescript
export type MessageType =
  | 'user'
  | 'assistant'
  | 'progress'
  | 'summary'
  | 'file-history-snapshot';
```

### ProgressMessage

```typescript
export interface ProgressMessage extends BaseMessage {
  type: 'progress';
  content: ProgressContent[];
  cwd: string;
  gitBranch: string | null;
  isSidechain: boolean;
}
```

### ProgressContent

```typescript
export interface ProgressTextContent {
  type: 'text';
  text: string;
}

export type ProgressContent = ProgressTextContent;
```

### Message

```typescript
export type Message =
  | UserMessage
  | AssistantMessage
  | ProgressMessage
  | SummaryMessage
  | FileHistorySnapshotMessage;
```

### FilterableMessageType

```typescript
export type FilterableMessageType =
  | 'user'
  | 'assistant'
  | 'tool'
  | 'thinking'
  | 'error'
  | 'progress';
```

### SearchMatch

```typescript
export interface SearchMatch {
  sessionId: string;
  sessionSummary: string | null;
  projectPath: string;
  messageUuid: string;
  messageType: 'user' | 'assistant' | 'progress';
  match: string;
  context: string[];
  lineNumber: number;
}
```

## Updated Functions and Behaviors

### parseSessionFile

```typescript
export async function parseSessionFile(filePath: string): Promise<ParseResult<Message[]>>;
```

**Behavioral Contract**:
- Raw session entries with `type: "progress"` are preserved as `ProgressMessage`.
- Unknown top-level message types other than supported ones remain ignored defensively.
- Progress entries with non-readable or missing text do not throw and do not corrupt the parse result.

### getSession / getAgentSession

```typescript
export async function getSession(identifier: number | string, config?: LibraryConfig): Promise<Session>;
export async function getAgentSession(agentId: string, config?: LibraryConfig): Promise<Session>;
```

**Behavioral Contract**:
- Returned `session.messages` may include `ProgressMessage` entries.
- `session.messageCount` counts displayable transcript messages, including progress messages.
- `timestamp` and `lastActivityAt` reflect progress entries when they are the earliest/latest displayable transcript messages.

### searchSessions / searchInSession

```typescript
export async function searchSessions(
  query: string,
  config?: LibraryConfig
): Promise<PaginatedResult<SearchMatch>>;

export async function searchInSession(
  sessionId: string | number,
  query: string,
  config?: LibraryConfig
): Promise<SearchMatch[]>;
```

**Behavioral Contract**:
- Search includes readable text from `ProgressMessage`.
- Matches produced from progress content set `messageType: "progress"`.
- Context extraction and match metadata behave the same as existing user and assistant matches.

### classifyMessage / filterMessages

```typescript
export function classifyMessage(message: Message): FilterableMessageType[];

export function filterMessages(
  messages: Message[],
  options?: MessageFilterOptions
): Message[];
```

**Behavioral Contract**:
- `classifyMessage(progressMessage)` returns `['progress']`.
- `filterMessages(..., { only: ['progress'] })` returns only progress messages.
- When no filter is provided, displayable messages include `user`, `assistant`, and `progress`.

### exportSessionToJson / exportSessionToMarkdown

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
- JSON export preserves progress messages through the serialized session model.
- Markdown export renders progress messages explicitly instead of skipping them.

## Public Re-Exports

The library index MUST re-export:

- `ProgressMessage`
- `ProgressContent`
- Updated `MessageType`
- Updated `SearchMatch`
- Updated `FilterableMessageType`

## Backward Compatibility

- All changes are additive from the public API perspective.
- Existing consumers that already switch exhaustively on `MessageType` or `SearchMatch.messageType` will need to handle the new `progress` case.
- Existing search and session APIs keep their function signatures unchanged.

## Defensive Behavior

- If a progress entry contains no readable content, it remains safe to parse and serialize.
- Unsupported future top-level message types remain excluded until explicitly modeled.
