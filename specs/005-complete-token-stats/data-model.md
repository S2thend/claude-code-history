# Data Model: Complete Token Statistics

**Feature**: 005-complete-token-stats
**Date**: 2026-01-30

## Existing Types (No Changes)

### TokenUsage

Already defined in `src/lib/types.ts:228-233`. No modifications needed.

```typescript
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}
```

### AssistantMessage

Already includes `usage: TokenUsage` field. No modifications needed.

```typescript
export interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  role: 'assistant';
  model: string;
  content: AssistantContent[];
  stopReason: string | null;
  usage: TokenUsage;  // ← Already present
}
```

## New Types

### AggregateTokenStats (add to types.ts)

Aggregate statistics with computed total field for convenience.

```typescript
/**
 * Aggregated token statistics across multiple messages or sessions.
 */
export interface AggregateTokenStats extends TokenUsage {
  /** Total tokens (sum of all four categories) */
  totalTokens: number;
}
```

### SessionWithStats (add to types.ts)

Extended session type that includes computed token statistics.

```typescript
/**
 * Session with computed token statistics.
 * Used when token aggregation is requested.
 */
export interface SessionWithStats extends Session {
  /** Aggregated token usage across all assistant messages */
  tokenStats: AggregateTokenStats;
}
```

### ListStatsResult (add to types.ts)

Result type for `listSessions` with `--stats` flag.

```typescript
/**
 * Result of listing sessions with aggregate statistics.
 */
export interface ListStatsResult {
  /** Session summaries */
  sessions: SessionSummary[];
  /** Aggregate token stats across all listed sessions */
  aggregateStats: AggregateTokenStats;
  /** Pagination info */
  pagination: Pagination;
}
```

## New Functions (add to stats.ts)

### computeTokenStats

Compute aggregate token statistics from a session's messages.

```typescript
/**
 * Compute aggregate token statistics from messages.
 *
 * @param messages - Array of messages (filters to assistant messages internally)
 * @returns Aggregate token statistics with total
 *
 * @example
 * ```typescript
 * const session = await getSession(0);
 * const stats = computeTokenStats(session.messages);
 * console.log(`Total tokens: ${stats.totalTokens}`);
 * ```
 */
export function computeTokenStats(messages: Message[]): AggregateTokenStats;
```

### createEmptyStats

Create a zero-initialized stats object.

```typescript
/**
 * Create empty/zero token statistics.
 * Useful for initialization and edge cases (no messages).
 */
export function createEmptyStats(): AggregateTokenStats;
```

### addStats

Combine two stats objects (for aggregation across sessions).

```typescript
/**
 * Add two token statistics together.
 *
 * @param a - First stats object
 * @param b - Second stats object
 * @returns Combined statistics
 */
export function addStats(a: AggregateTokenStats, b: AggregateTokenStats): AggregateTokenStats;
```

## Type Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                         TokenUsage                               │
│  (existing - 4 fields: input, output, cacheRead, cacheCreate)   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ extends
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AggregateTokenStats                          │
│  (new - adds totalTokens computed field)                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ used by
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│    SessionWithStats       │  │    ListStatsResult        │
│    (Session + tokenStats) │  │    (summaries + aggregate)│
└───────────────────────────┘  └───────────────────────────┘
```

## Validation Rules

1. All token counts MUST be non-negative integers (≥ 0)
2. `totalTokens` MUST equal sum of all four token fields
3. Missing or undefined usage data defaults to zeros (handled in parser)
4. No NaN or Infinity values allowed

## State Transitions

N/A - Token statistics are computed values, not mutable state.

## Export Updates (index.ts)

Add to public exports:

```typescript
// Types
export type { AggregateTokenStats, SessionWithStats, ListStatsResult } from './types.js';

// Functions
export { computeTokenStats, createEmptyStats, addStats } from './stats.js';
```
