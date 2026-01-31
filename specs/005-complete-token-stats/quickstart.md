# Quickstart: Token Statistics API

**Feature**: 005-complete-token-stats
**Date**: 2026-01-30

## Overview

This document describes how CLI and other consumers should use the token statistics interfaces exported from the core library (`src/lib/`).

## Importing

```typescript
import {
  // Types
  TokenUsage,
  AggregateTokenStats,
  Session,
  Message,

  // Functions
  getSession,
  computeTokenStats,
  createEmptyStats,
  addStats,
} from 'claude-code-history';
// or from '../lib/index.js' for internal CLI use
```

## Basic Usage

### Get Token Stats for a Single Session

```typescript
import { getSession, computeTokenStats } from '../lib/index.js';

async function displaySessionTokens(sessionId: number | string): Promise<void> {
  // 1. Get the full session (includes all messages with token data)
  const session = await getSession(sessionId);

  // 2. Compute aggregate token statistics
  const stats = computeTokenStats(session.messages);

  // 3. Display the results
  console.log(`Session: ${session.id}`);
  console.log(`Input tokens:          ${stats.inputTokens.toLocaleString()}`);
  console.log(`Output tokens:         ${stats.outputTokens.toLocaleString()}`);
  console.log(`Cache read tokens:     ${stats.cacheReadInputTokens.toLocaleString()}`);
  console.log(`Cache creation tokens: ${stats.cacheCreationInputTokens.toLocaleString()}`);
  console.log(`Total tokens:          ${stats.totalTokens.toLocaleString()}`);
}
```

### Aggregate Stats Across Multiple Sessions

```typescript
import { listSessions, getSession, computeTokenStats, createEmptyStats, addStats } from '../lib/index.js';

async function computeWorkspaceStats(workspace?: string): Promise<AggregateTokenStats> {
  // 1. List all sessions (optionally filtered by workspace)
  const { data: summaries } = await listSessions({ workspace });

  // 2. Start with empty stats
  let aggregate = createEmptyStats();

  // 3. Load each session and add its stats
  for (const summary of summaries) {
    const session = await getSession(summary.id);
    const sessionStats = computeTokenStats(session.messages);
    aggregate = addStats(aggregate, sessionStats);
  }

  return aggregate;
}
```

### Access Per-Message Token Data

```typescript
import { getSession, AssistantMessage } from '../lib/index.js';

async function listMessageTokens(sessionId: number | string): Promise<void> {
  const session = await getSession(sessionId);

  for (const msg of session.messages) {
    if (msg.type === 'assistant') {
      const assistant = msg as AssistantMessage;
      console.log(`Message ${msg.uuid}:`);
      console.log(`  Input: ${assistant.usage.inputTokens}`);
      console.log(`  Output: ${assistant.usage.outputTokens}`);
      console.log(`  Cache read: ${assistant.usage.cacheReadInputTokens}`);
      console.log(`  Cache create: ${assistant.usage.cacheCreationInputTokens}`);
    }
  }
}
```

## Type Definitions

### TokenUsage (existing)

Per-message token usage from Claude API response.

```typescript
interface TokenUsage {
  inputTokens: number;        // Non-cached input tokens
  outputTokens: number;       // Generated output tokens
  cacheCreationInputTokens: number;  // Tokens written to prompt cache
  cacheReadInputTokens: number;      // Tokens read from prompt cache
}
```

### AggregateTokenStats (new)

Aggregated statistics with computed total.

```typescript
interface AggregateTokenStats extends TokenUsage {
  totalTokens: number;  // Sum of all four token types
}
```

## Edge Cases

### Empty Session (no messages)

```typescript
const session = await getSession(id);
const stats = computeTokenStats(session.messages);
// stats.totalTokens === 0 (all fields are 0)
```

### Session with Only User Messages

```typescript
// computeTokenStats only counts assistant messages (which have usage data)
// User messages don't have token usage, so they're skipped
const stats = computeTokenStats(session.messages);
// stats will be all zeros if no assistant messages
```

### Missing Usage Data

The parser handles missing/undefined usage by defaulting to zeros. No special handling needed in consumers.

## CLI Integration Pattern

For CLI commands, the pattern is:

1. **Command layer** (`src/cli/commands/`): Parse arguments, call lib functions
2. **Lib layer** (`src/lib/`): Compute token statistics
3. **Formatter layer** (`src/cli/formatters/`): Format stats for terminal display

Example for `view` command:

```typescript
// src/cli/commands/view.ts
import { getSession } from '../../lib/index.js';
import { computeTokenStats } from '../../lib/stats.js';
import { formatSession, formatTokenSummary } from '../formatters/session.js';

async function executeView(sessionArg: string): Promise<void> {
  const session = await getSession(sessionArg);
  const stats = computeTokenStats(session.messages);

  // Format session content
  const formattedSession = formatSession(session);

  // Format token summary footer
  const tokenFooter = formatTokenSummary(stats);

  // Output both
  console.log(formattedSession);
  console.log(tokenFooter);
}
```

## JSON Output

When `--json` flag is used, include stats in the output object:

```typescript
interface SessionJsonOutput extends Session {
  tokenStats: AggregateTokenStats;
}

// Usage
const output: SessionJsonOutput = {
  ...session,
  tokenStats: computeTokenStats(session.messages),
};
console.log(JSON.stringify(output, null, 2));
```

## Performance Notes

- `computeTokenStats()` is O(n) where n = number of messages
- For large sessions (1000+ messages), computation is still fast (<10ms)
- Stats are computed on-demand, not cached
- For `list --stats`, sessions are loaded sequentially (could be parallelized if needed)
