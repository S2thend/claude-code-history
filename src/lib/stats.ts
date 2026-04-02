/**
 * Token statistics aggregation for claude-code-history library.
 *
 * Provides functions to compute and combine token usage statistics
 * from session messages.
 */

import type { Message, AssistantMessage, AggregateTokenStats } from './types.js';

/**
 * Create empty/zero token statistics.
 * Useful for initialization and edge cases (no messages).
 *
 * @returns Zero-initialized AggregateTokenStats object
 *
 * @example
 * ```typescript
 * const stats = createEmptyStats();
 * // stats.totalTokens === 0
 * ```
 */
export function createEmptyStats(): AggregateTokenStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalTokens: 0,
  };
}

/**
 * Compute aggregate token statistics from messages.
 *
 * @param messages - Array of messages (filters to assistant messages internally)
 * @returns Aggregate token statistics with total
 *
 * @remarks
 * Only assistant messages have token usage data. User messages and other
 * message types are skipped automatically. Missing or undefined usage data
 * is treated as zero.
 *
 * @example
 * ```typescript
 * const session = await getSession(0);
 * const stats = computeTokenStats(session.messages);
 * console.log(`Total tokens: ${stats.totalTokens}`);
 * ```
 */
export function computeTokenStats(messages: Message[]): AggregateTokenStats {
  const stats = createEmptyStats();

  for (const msg of messages) {
    if (msg.type === 'assistant') {
      const assistant = msg as AssistantMessage;
      const usage = assistant.usage;

      stats.inputTokens += usage.inputTokens;
      stats.outputTokens += usage.outputTokens;
      stats.cacheCreationInputTokens += usage.cacheCreationInputTokens;
      stats.cacheReadInputTokens += usage.cacheReadInputTokens;
    }
  }

  // Compute total
  stats.totalTokens =
    stats.inputTokens +
    stats.outputTokens +
    stats.cacheCreationInputTokens +
    stats.cacheReadInputTokens;

  return stats;
}

/**
 * Add two token statistics together.
 *
 * @param a - First stats object
 * @param b - Second stats object
 * @returns Combined statistics with recalculated total
 *
 * @example
 * ```typescript
 * const session1Stats = computeTokenStats(session1.messages);
 * const session2Stats = computeTokenStats(session2.messages);
 * const combined = addStats(session1Stats, session2Stats);
 * ```
 */
export function addStats(a: AggregateTokenStats, b: AggregateTokenStats): AggregateTokenStats {
  const inputTokens = a.inputTokens + b.inputTokens;
  const outputTokens = a.outputTokens + b.outputTokens;
  const cacheCreationInputTokens = a.cacheCreationInputTokens + b.cacheCreationInputTokens;
  const cacheReadInputTokens = a.cacheReadInputTokens + b.cacheReadInputTokens;

  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens,
  };
}
