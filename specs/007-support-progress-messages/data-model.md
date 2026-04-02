# Data Model: Support Progress Messages

**Feature**: 007-support-progress-messages  
**Date**: 2026-04-01

## Overview

This feature extends the existing session message model with a new displayable and searchable message category: `progress`. The goal is to preserve progress entries as typed session data rather than dropping them during parsing.

## New and Updated Types

### MessageType

Extend the top-level session message discriminator to include progress:

```typescript
type MessageType =
  | 'user'
  | 'assistant'
  | 'progress'
  | 'summary'
  | 'file-history-snapshot';
```

**Validation Rules**:
- `progress` is a first-class typed message, not an alias for `assistant` or `tool`.
- `summary` and `file-history-snapshot` remain non-displayable metadata entries.

### ProgressMessage

A normalized session message representing user-visible tool or task progress.

```typescript
interface ProgressMessage extends BaseMessage {
  type: 'progress';
  content: ProgressContent[];
  cwd: string;
  gitBranch: string | null;
  isSidechain: boolean;
}
```

**Field Notes**:
- `uuid`, `parentUuid`, and `timestamp` preserve timeline ordering and message identity.
- `content` stores only readable progress blocks that should participate in search and display.
- `cwd`, `gitBranch`, and `isSidechain` follow the existing session-envelope metadata pattern when present.

### ProgressContent

Normalized readable content extracted from raw progress payloads.

```typescript
interface ProgressTextContent {
  type: 'text';
  text: string;
}

type ProgressContent = ProgressTextContent;
```

**Validation Rules**:
- Empty or non-readable raw blocks are ignored safely.
- Progress content is ordered and preserved as it appeared in the raw entry.
- Only normalized readable text blocks are required for search and human-readable transcript output.

### SearchMatch

Extend search results to identify progress matches explicitly.

```typescript
interface SearchMatch {
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

### FilterableMessageType

Extend view filtering to include progress.

```typescript
type FilterableMessageType =
  | 'user'
  | 'assistant'
  | 'tool'
  | 'thinking'
  | 'error'
  | 'progress';
```

## Type Relationships

```text
Message (union)
├── UserMessage
├── AssistantMessage
├── ProgressMessage
├── SummaryMessage
└── FileHistorySnapshotMessage

ProgressMessage
├── appears in Session.messages
├── is searchable through searchSessions/searchInSession
├── is displayable in cch view output
├── is exportable in JSON and Markdown outputs
└── classifies as FilterableMessageType 'progress'
```

## Classification Rules

| Source Type | Displayable | Searchable | Filter Classification |
|-------------|-------------|------------|-----------------------|
| `user` | Yes | Yes | `user` or `error` |
| `assistant` | Yes | Yes | `assistant`, `tool`, `thinking` |
| `progress` | Yes | Yes | `progress` |
| `summary` | No | No | None |
| `file-history-snapshot` | No | No | None |

## Count Semantics

### Session Message Counts

- `Session.messageCount` counts all displayable transcript messages.
- After this feature, displayable transcript messages are `user`, `assistant`, and `progress`.
- `summary` and `file-history-snapshot` remain excluded from message totals.

### Filtered Message Counts

- Filtered counts include progress entries when they are part of the filtered result.
- Progress-only views count only `progress` messages.

## Data Flow

```text
Raw JSONL Entry
  └── type: "progress"
        ↓
Parser normalization
  └── ProgressMessage { content: ProgressContent[] }
        ↓
Session model
  ├── getSession()
  ├── listSessions() metadata counts
  └── exportSessionToJson()
        ↓
Consumer surfaces
  ├── searchSessions() / searchInSession()
  ├── filterMessages(..., { only: ['progress'] })
  ├── cch view
  └── exportSessionToMarkdown()
```

## Lifecycle / State Transitions

This feature does not introduce mutable state. Progress entries move through a read-only lifecycle:

1. Raw progress entry is read from JSONL.
2. Parser normalizes readable content into `ProgressMessage`.
3. Library functions include it in session/search/filter/export flows.
4. CLI formatters render it as transcript or search output.

## Validation Requirements

1. Unknown top-level entry types other than `progress` continue to be ignored defensively.
2. Progress messages with readable text produce searchable text blocks.
3. Progress messages with no readable text still parse safely and do not crash search/view/export.
4. Progress messages preserve ordering relative to user and assistant messages.
5. View filtering recognizes `progress` as a dedicated filter value.
