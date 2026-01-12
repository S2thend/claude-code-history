# Quickstart: Message Type Filter

**Feature**: 003-message-type-filter
**Date**: 2026-01-12

## Overview

This guide helps developers quickly understand and implement the message type filter feature.

## What We're Building

A `--only` option for the `cch view` command that filters displayed messages by type:

```bash
# Before: Shows all 50 messages
cch view 0

# After: Shows only your 8 questions
cch view 0 --only user
```

## Key Files to Modify

| File | Purpose | Changes |
|------|---------|---------|
| `src/lib/types.ts` | Type definitions | Add `FilterableMessageType`, `MessageFilterOptions` |
| `src/lib/session.ts` | Core logic | Add `filterMessages()`, `classifyMessage()` |
| `src/lib/index.ts` | Exports | Export new types and functions |
| `src/cli/commands/view.ts` | CLI command | Add `--only` option, validation, integration |
| `src/cli/formatters/session.ts` | Output formatting | Update header to show filtered count |

## Implementation Steps

### Step 1: Add Types (src/lib/types.ts)

```typescript
// Add near other type definitions
export type FilterableMessageType = 'user' | 'assistant' | 'tool' | 'thinking' | 'error';

export interface MessageFilterOptions {
  only?: FilterableMessageType[];
}

export const VALID_FILTER_TYPES: readonly FilterableMessageType[] = [
  'user', 'assistant', 'tool', 'thinking', 'error'
] as const;
```

### Step 2: Add Filter Logic (src/lib/session.ts)

```typescript
import type { Message, FilterableMessageType, MessageFilterOptions } from './types.js';

export function classifyMessage(message: Message): FilterableMessageType[] {
  const types: FilterableMessageType[] = [];

  if (message.type === 'user') {
    // Check for error results
    if (Array.isArray(message.content)) {
      const hasError = message.content.some(
        item => item.type === 'tool_result' && item.is_error
      );
      if (hasError) types.push('error');
      // Pure tool results are excluded (shown inline with tool calls)
      if (!message.content.every(item => item.type === 'tool_result')) {
        types.push('user');
      }
    } else {
      types.push('user');
    }
  }

  if (message.type === 'assistant') {
    for (const item of message.content) {
      if (item.type === 'text') types.push('assistant');
      if (item.type === 'tool_use') types.push('tool');
      if (item.type === 'thinking') types.push('thinking');
    }
  }

  return [...new Set(types)]; // Deduplicate
}

export function filterMessages(
  messages: Message[],
  options?: MessageFilterOptions
): Message[] {
  // No filter = return all displayable messages
  if (!options?.only || options.only.length === 0) {
    return messages.filter(m => m.type === 'user' || m.type === 'assistant');
  }

  return messages.filter(message => {
    const types = classifyMessage(message);
    return types.some(t => options.only!.includes(t));
  });
}
```

### Step 3: Export from Library (src/lib/index.ts)

```typescript
// Add to existing exports
export type { FilterableMessageType, MessageFilterOptions } from './types.js';
export { VALID_FILTER_TYPES } from './types.js';
export { filterMessages, classifyMessage } from './session.js';
```

### Step 4: Add CLI Option (src/cli/commands/view.ts)

```typescript
import { VALID_FILTER_TYPES, filterMessages } from '../../lib/index.js';
import type { FilterableMessageType } from '../../lib/index.js';

// Add to ViewOptions type
type ViewOptions = GlobalOptions & {
  only?: string;
};

// Add validation function
function parseFilterTypes(input: string): FilterableMessageType[] {
  const types = input.split(',').map(t => t.trim().toLowerCase());
  for (const type of types) {
    if (!VALID_FILTER_TYPES.includes(type as FilterableMessageType)) {
      throw new Error(
        `Invalid filter type '${type}'. Valid types: ${VALID_FILTER_TYPES.join(', ')}`
      );
    }
  }
  return types as FilterableMessageType[];
}

// In registerViewCommand, add option
program
  .command('view <session>')
  .description("View a session's contents")
  .option('-o, --only <types>', 'Filter by message type (user,assistant,tool,thinking,error)')
  .action(...)

// In executeView, apply filter
const session = await getSession(sessionRef, libConfig);
const filteredMessages = options.only
  ? filterMessages(session.messages, { only: parseFilterTypes(options.only) })
  : session.messages;
```

### Step 5: Update Formatter (src/cli/formatters/session.ts)

```typescript
// Update formatSession signature
export function formatSession(
  session: Session,
  options?: { filteredCount?: number }
): string {
  // In header, show filtered count if applicable
  if (options?.filteredCount !== undefined) {
    lines.push(`Messages: ${options.filteredCount} (filtered from ${session.messageCount})`);
  } else {
    lines.push(`Messages: ${session.messageCount}`);
  }
  // ... rest of formatting
}
```

## Testing

### Unit Tests

```typescript
// tests/unit/lib/session.test.ts
describe('classifyMessage', () => {
  it('classifies user messages', () => {
    const msg = { type: 'user', content: 'Hello' };
    expect(classifyMessage(msg)).toEqual(['user']);
  });

  it('classifies assistant with tool_use', () => {
    const msg = {
      type: 'assistant',
      content: [{ type: 'tool_use', name: 'Read', input: {} }]
    };
    expect(classifyMessage(msg)).toContain('tool');
  });
});

describe('filterMessages', () => {
  it('filters to user messages only', () => {
    const messages = [userMsg, assistantMsg, toolMsg];
    const filtered = filterMessages(messages, { only: ['user'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('user');
  });
});
```

### Integration Tests

```typescript
// tests/integration/cli/view.test.ts
describe('view --only', () => {
  it('filters to user messages', async () => {
    const result = await runCli(['view', '0', '--only', 'user']);
    expect(result.stdout).toContain('USER');
    expect(result.stdout).not.toContain('ASSISTANT');
  });

  it('shows error for invalid filter', async () => {
    const result = await runCli(['view', '0', '--only', 'invalid']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid filter type');
  });
});
```

## Checklist

- [ ] Types added to `src/lib/types.ts`
- [ ] `classifyMessage()` implemented in `src/lib/session.ts`
- [ ] `filterMessages()` implemented in `src/lib/session.ts`
- [ ] New exports added to `src/lib/index.ts`
- [ ] `--only` option added to view command
- [ ] Filter validation implemented
- [ ] Formatter updated to show filtered count
- [ ] Unit tests for classification logic
- [ ] Unit tests for filter function
- [ ] Integration tests for CLI
- [ ] Help text updated
- [ ] All existing tests still pass
