# Library API Contract: Message Type Filter

**Feature**: 003-message-type-filter
**Date**: 2026-01-12

## Overview

This document defines the public API additions to the `claude-code-history` library for message type filtering.

## New Types

### FilterableMessageType

```typescript
/**
 * Message types that can be filtered in session views.
 *
 * @remarks
 * - `user`: User-authored messages (questions, prompts)
 * - `assistant`: AI text responses (excludes tool calls and thinking)
 * - `tool`: Tool invocations (Read, Write, Bash, etc.)
 * - `thinking`: AI reasoning/thinking blocks
 * - `error`: Tool results with errors
 */
export type FilterableMessageType = 'user' | 'assistant' | 'tool' | 'thinking' | 'error';
```

### MessageFilterOptions

```typescript
/**
 * Options for filtering messages in a session.
 */
export interface MessageFilterOptions {
  /**
   * Message types to include.
   * Empty array or undefined means include all types.
   */
  only?: FilterableMessageType[];
}
```

## New Functions

### filterMessages

```typescript
/**
 * Filter messages by type.
 *
 * @param messages - Array of messages to filter
 * @param options - Filter options specifying which types to include
 * @returns Filtered array of messages
 *
 * @remarks
 * - If `options.only` is empty or undefined, returns all messages
 * - Messages with mixed content (e.g., text + tool_use) are included
 *   if ANY content block matches the filter
 * - Order and timestamps are preserved
 * - Summary and file-history-snapshot messages are always excluded
 *
 * @example
 * ```typescript
 * import { filterMessages } from 'claude-code-history';
 *
 * // Filter to only user messages
 * const userMessages = filterMessages(session.messages, { only: ['user'] });
 *
 * // Filter to tools and errors
 * const toolsAndErrors = filterMessages(session.messages, { only: ['tool', 'error'] });
 *
 * // No filter (returns all displayable messages)
 * const allMessages = filterMessages(session.messages, {});
 * ```
 */
export function filterMessages(
  messages: Message[],
  options?: MessageFilterOptions
): Message[];
```

### classifyMessage

```typescript
/**
 * Classify a message into filterable types.
 *
 * @param message - Message to classify
 * @returns Array of applicable filter types for this message
 *
 * @remarks
 * A message can have multiple classifications (e.g., an assistant message
 * with both text and tool_use content will return ['assistant', 'tool']).
 *
 * Returns empty array for non-displayable messages (summary, file-history-snapshot).
 *
 * @example
 * ```typescript
 * import { classifyMessage } from 'claude-code-history';
 *
 * const types = classifyMessage(message);
 * // For user message: ['user']
 * // For assistant with text + tool: ['assistant', 'tool']
 * // For user with error result: ['error']
 * ```
 */
export function classifyMessage(message: Message): FilterableMessageType[];
```

### VALID_FILTER_TYPES

```typescript
/**
 * Array of valid filter type strings for validation.
 */
export const VALID_FILTER_TYPES: readonly FilterableMessageType[] = [
  'user',
  'assistant',
  'tool',
  'thinking',
  'error'
] as const;
```

## Extended Types (Optional)

### LibraryConfig Extension

If filter functionality is exposed at the `getSession` level (optional enhancement):

```typescript
export interface LibraryConfig {
  // ... existing fields ...

  /**
   * Filter messages by type when retrieving session.
   * If not specified, all messages are included.
   */
  messageFilter?: MessageFilterOptions;
}
```

## Error Handling

No new error types. Invalid filter values should be caught at the CLI validation layer before reaching library functions.

Library functions handle edge cases gracefully:
- Empty messages array → returns empty array
- Empty/undefined filter → returns all displayable messages
- Unknown message types → excluded from results (defensive)

## Backward Compatibility

All additions are purely additive:
- New types don't conflict with existing types
- New functions don't modify existing function signatures
- Existing code continues to work unchanged
- New `messageFilter` in LibraryConfig is optional

## Usage in CLI

The CLI layer will use these APIs as follows:

```typescript
// In src/cli/commands/view.ts
import { getSession, filterMessages, VALID_FILTER_TYPES } from '../../lib/index.js';

// Validate filter types
function validateFilterTypes(input: string): FilterableMessageType[] {
  const types = input.split(',').map(t => t.trim().toLowerCase());
  for (const type of types) {
    if (!VALID_FILTER_TYPES.includes(type as FilterableMessageType)) {
      throw new Error(`Invalid filter type '${type}'. Valid types: ${VALID_FILTER_TYPES.join(', ')}`);
    }
  }
  return types as FilterableMessageType[];
}

// In command execution
const session = await getSession(sessionRef, libConfig);
const filteredMessages = options.only
  ? filterMessages(session.messages, { only: validateFilterTypes(options.only) })
  : session.messages;
```
