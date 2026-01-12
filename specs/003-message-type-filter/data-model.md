# Data Model: Message Type Filter

**Feature**: 003-message-type-filter
**Date**: 2026-01-12

## Overview

This feature introduces filtering capability to the message display system. The data model extends existing types rather than introducing new entities.

## New Types

### FilterableMessageType

A union type representing the five filterable message categories.

```typescript
/**
 * Message types that can be filtered in the view command.
 */
export type FilterableMessageType = 'user' | 'assistant' | 'tool' | 'thinking' | 'error';
```

**Validation Rules**:
- Must be one of the five defined values
- Case-sensitive (lowercase only)

### MessageTypeFilter

Configuration for filtering messages.

```typescript
/**
 * Filter configuration for message display.
 */
export interface MessageTypeFilter {
  /** Message types to include (empty = all types) */
  types: FilterableMessageType[];
}
```

**Validation Rules**:
- Empty array means no filtering (show all)
- Duplicate types are allowed but have no additional effect
- Invalid types should be rejected at parse time

## Type Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     Existing Types (read-only)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Message (union)                                                 │
│  ├── UserMessage          → maps to: 'user', 'error'            │
│  │   └── content: string | ToolResultContent[]                  │
│  │       └── ToolResultContent.is_error → 'error'               │
│  │                                                               │
│  ├── AssistantMessage     → maps to: 'assistant', 'tool',       │
│  │   │                               'thinking'                  │
│  │   └── content: AssistantContent[]                            │
│  │       ├── TextContent (type: 'text')     → 'assistant'       │
│  │       ├── ToolUseContent (type: 'tool_use') → 'tool'         │
│  │       └── ThinkingContent (type: 'thinking') → 'thinking'    │
│  │                                                               │
│  ├── SummaryMessage       → excluded from filtering              │
│  └── FileHistorySnapshot  → excluded from filtering              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      New Types (this feature)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FilterableMessageType = 'user' | 'assistant' | 'tool' |        │
│                          'thinking' | 'error'                    │
│                                                                  │
│  MessageTypeFilter {                                             │
│    types: FilterableMessageType[]                                │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Classification Logic

### Message → FilterableMessageType Mapping

| Source Type | Condition | Maps To |
|-------------|-----------|---------|
| UserMessage | content is string | `'user'` |
| UserMessage | content has ToolResultContent with is_error=true | `'error'` |
| UserMessage | content has ToolResultContent (no errors) | (excluded - tool results shown inline) |
| AssistantMessage | has TextContent block | `'assistant'` |
| AssistantMessage | has ToolUseContent block | `'tool'` |
| AssistantMessage | has ThinkingContent block | `'thinking'` |
| SummaryMessage | always | (excluded from view) |
| FileHistorySnapshot | always | (excluded from view) |

### Mixed Content Handling

An AssistantMessage can contain multiple content block types. Per FR-010:

**Rule**: Message is included if ANY content block matches the filter.

Example:
```typescript
// AssistantMessage with both text and tool_use
{
  type: 'assistant',
  content: [
    { type: 'text', text: 'Let me read the file...' },
    { type: 'tool_use', name: 'Read', input: { file_path: '/foo' } }
  ]
}

// With --only tool: INCLUDED (has tool_use block)
// With --only assistant: INCLUDED (has text block)
// With --only thinking: EXCLUDED (no thinking block)
```

## State Transitions

N/A - This feature is stateless. Filtering is applied at display time without modifying source data.

## Validation Requirements

### CLI Input Validation

1. **Parse comma-separated values**: `"user,tool"` → `['user', 'tool']`
2. **Trim whitespace**: `" user , tool "` → `['user', 'tool']`
3. **Reject invalid types**: Show error with valid options list
4. **Case sensitivity**: `"User"` or `"USER"` → error (must be lowercase)

### Filter Application Validation

1. **Empty filter array**: Show all messages (no filtering)
2. **All types specified**: Equivalent to no filter
3. **No matching messages**: Display informative message, not empty output

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CLI Args   │────▶│  Validator   │────▶│   Filter     │
│  --only user │     │  (config.ts) │     │  Object      │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Session    │────▶│  filterMsgs  │◀────│   Filter     │
│   Messages   │     │ (session.ts) │     │   Object     │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Filtered    │
                     │  Messages    │
                     └──────────────┘
                            │
                            ▼
┌──────────────┐     ┌──────────────┐
│  Formatter   │────▶│   Output     │
│ (session.ts) │     │  (stdout)    │
└──────────────┘     └──────────────┘
```
