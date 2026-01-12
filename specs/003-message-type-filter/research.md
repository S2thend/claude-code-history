# Research: Message Type Filter

**Feature**: 003-message-type-filter
**Date**: 2026-01-12

## Overview

This document captures research findings for implementing the message type filter feature. No NEEDS CLARIFICATION items were identified in the technical context - the existing codebase provides all necessary patterns and structures.

## Research Areas

### 1. Existing Type System Analysis

**Decision**: Use existing structured types for message classification

**Rationale**: The codebase already has well-defined types in `src/lib/types.ts` that exactly match the filter requirements:

- `MessageType`: `'user' | 'assistant' | 'summary' | 'file-history-snapshot'`
- `AssistantContent`: `TextContent | ToolUseContent | ThinkingContent`
- `ToolResultContent`: Has `is_error?: boolean` flag for error detection

**Alternatives Considered**:
- Text-based pattern matching (e.g., `[Tool:` prefix): Rejected - fragile, already have structured types
- Adding new message types: Rejected - existing types are sufficient

### 2. Filter Implementation Location

**Decision**: Implement filter function in `src/lib/session.ts`, apply in `src/cli/formatters/session.ts`

**Rationale**:
- Library-first architecture (Constitution Principle IV)
- Existing `formatSession` function already iterates messages - natural integration point
- Filter logic reusable for JSON output mode

**Alternatives Considered**:
- Filter in CLI layer only: Rejected - violates library-first principle
- Filter during session loading: Rejected - adds complexity, better to filter at display time

### 3. CLI Option Pattern

**Decision**: Use `--only <type>` with comma-separated values

**Rationale**:
- Follows existing CLI patterns in the codebase
- Commander.js supports custom option parsing easily
- `--only` is intuitive and common in CLI tools (e.g., `npm audit --only=prod`)

**Alternatives Considered**:
- `--filter <type>`: More generic but less clear intent
- `--type <type>`: Ambiguous with existing `type` fields in data
- `--show <type>`: Conflicts with potential future "show" subcommand

### 4. Content Block Classification Logic

**Decision**: Classify messages based on content block types present

**Rationale**: Based on analysis of `src/lib/types.ts` and `src/cli/formatters/session.ts`:

| Filter | Classification Rule |
|--------|---------------------|
| `user` | `message.type === 'user'` AND NOT purely tool results |
| `assistant` | `message.type === 'assistant'` AND has `TextContent` blocks |
| `tool` | `message.type === 'assistant'` AND has `ToolUseContent` blocks |
| `thinking` | `message.type === 'assistant'` AND has `ThinkingContent` blocks |
| `error` | `message.type === 'user'` AND has `ToolResultContent` with `is_error: true` |

**Key Insight**: An assistant message can have multiple content block types. Per spec clarification (FR-010), include entire message if ANY block matches.

**Alternatives Considered**:
- Separate error from tool results: Current approach - errors are tool results with `is_error` flag
- Include all user messages for `error` filter: Rejected - only messages containing actual errors should match

### 5. Empty Result Handling

**Decision**: Display informative message instead of empty output

**Rationale**:
- Better UX than silent empty output
- Consistent with CLI best practices
- Helps users understand their filter matched nothing

**Message Format**: `No messages match filter: <filter-types>`

### 6. Invalid Filter Handling

**Decision**: Display error with valid options list

**Rationale**:
- Immediate feedback on user error
- Educational - shows available options
- Exit code indicates error (non-zero)

**Error Format**: `Invalid filter type '<invalid>'. Valid types: user, assistant, tool, thinking, error`

## Integration Points

### Files to Modify

1. **src/lib/types.ts**
   - Add `MessageTypeFilter` type alias
   - Add `FilterableMessageType` union type

2. **src/lib/session.ts**
   - Add `filterMessages(messages: Message[], filter: MessageTypeFilter[]): Message[]`
   - Add `classifyMessage(message: Message): FilterableMessageType[]`

3. **src/lib/index.ts**
   - Export new types and functions

4. **src/cli/commands/view.ts**
   - Add `--only <types>` option
   - Parse comma-separated values
   - Validate filter types
   - Pass filter to formatter

5. **src/cli/formatters/session.ts**
   - Modify `formatSession` to accept optional filter
   - Apply filter before message iteration

6. **src/cli/utils/config.ts** (optional)
   - Add filter validation utility

### Existing Patterns to Follow

From `src/cli/commands/view.ts`:
```typescript
// Option pattern (existing)
.option('-j, --json', 'Output as JSON')
.option('-f, --full', 'Disable paging')

// New option follows same pattern
.option('-o, --only <types>', 'Filter by message type (user,assistant,tool,thinking,error)')
```

From `src/cli/formatters/session.ts`:
```typescript
// Existing message classification (to reuse)
function isToolResultMessage(msg: UserMessage): boolean
// Existing content type checks (to extend)
if (item.type === 'text') { ... }
if (item.type === 'tool_use') { ... }
if (item.type === 'thinking') { ... }
```

## Performance Considerations

- Filter applied at display time (O(n) where n = message count)
- No additional file I/O or parsing required
- Expected performance: <100ms for 1000 messages
- Meets SC-001: Filter 100+ message session in under 1 second

## Test Strategy

### Unit Tests
- `filterMessages` with each filter type
- `filterMessages` with multiple filter types
- `classifyMessage` for each message/content type
- Edge cases: empty messages, mixed content

### Integration Tests
- `cch view 0 --only user` produces expected output
- `cch view 0 --only tool,thinking` combines filters
- `cch view 0 --only invalid` shows error
- `cch view 0 --only user --json` works with JSON output
