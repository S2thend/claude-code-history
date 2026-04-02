/**
 * Unit tests for token statistics functions.
 */

import { describe, it, expect } from 'vitest';
import { createEmptyStats, computeTokenStats, addStats } from '../../src/lib/stats.js';
import type { Message, AssistantMessage, UserMessage } from '../../src/lib/types.js';

describe('createEmptyStats', () => {
  it('should return all zeros', () => {
    const stats = createEmptyStats();

    expect(stats.inputTokens).toBe(0);
    expect(stats.outputTokens).toBe(0);
    expect(stats.cacheCreationInputTokens).toBe(0);
    expect(stats.cacheReadInputTokens).toBe(0);
    expect(stats.totalTokens).toBe(0);
  });

  it('should return a new object each call', () => {
    const stats1 = createEmptyStats();
    const stats2 = createEmptyStats();

    expect(stats1).not.toBe(stats2);
    expect(stats1).toEqual(stats2);
  });
});

describe('computeTokenStats', () => {
  it('should return zeros for empty messages array', () => {
    const stats = computeTokenStats([]);

    expect(stats.inputTokens).toBe(0);
    expect(stats.outputTokens).toBe(0);
    expect(stats.cacheCreationInputTokens).toBe(0);
    expect(stats.cacheReadInputTokens).toBe(0);
    expect(stats.totalTokens).toBe(0);
  });

  it('should aggregate token usage from assistant messages', () => {
    const messages: Message[] = [
      createAssistantMessage({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 1000,
        cacheReadInputTokens: 5000,
      }),
      createAssistantMessage({
        inputTokens: 200,
        outputTokens: 75,
        cacheCreationInputTokens: 500,
        cacheReadInputTokens: 8000,
      }),
    ];

    const stats = computeTokenStats(messages);

    expect(stats.inputTokens).toBe(300);
    expect(stats.outputTokens).toBe(125);
    expect(stats.cacheCreationInputTokens).toBe(1500);
    expect(stats.cacheReadInputTokens).toBe(13000);
    expect(stats.totalTokens).toBe(14925);
  });

  it('should only count assistant messages, ignoring user messages', () => {
    const messages: Message[] = [
      createUserMessage('Hello'),
      createAssistantMessage({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 1000,
        cacheReadInputTokens: 5000,
      }),
      createUserMessage('Another question'),
    ];

    const stats = computeTokenStats(messages);

    expect(stats.inputTokens).toBe(100);
    expect(stats.outputTokens).toBe(50);
    expect(stats.cacheCreationInputTokens).toBe(1000);
    expect(stats.cacheReadInputTokens).toBe(5000);
    expect(stats.totalTokens).toBe(6150);
  });

  it('should return zeros when only user messages exist', () => {
    const messages: Message[] = [createUserMessage('Hello'), createUserMessage('Another message')];

    const stats = computeTokenStats(messages);

    expect(stats.inputTokens).toBe(0);
    expect(stats.outputTokens).toBe(0);
    expect(stats.cacheCreationInputTokens).toBe(0);
    expect(stats.cacheReadInputTokens).toBe(0);
    expect(stats.totalTokens).toBe(0);
  });

  it('should handle messages with zero cache tokens', () => {
    const messages: Message[] = [
      createAssistantMessage({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      }),
    ];

    const stats = computeTokenStats(messages);

    expect(stats.inputTokens).toBe(100);
    expect(stats.outputTokens).toBe(50);
    expect(stats.cacheCreationInputTokens).toBe(0);
    expect(stats.cacheReadInputTokens).toBe(0);
    expect(stats.totalTokens).toBe(150);
  });

  it('should calculate total as sum of all four token types', () => {
    const messages: Message[] = [
      createAssistantMessage({
        inputTokens: 10,
        outputTokens: 20,
        cacheCreationInputTokens: 30,
        cacheReadInputTokens: 40,
      }),
    ];

    const stats = computeTokenStats(messages);

    expect(stats.totalTokens).toBe(10 + 20 + 30 + 40);
    expect(stats.totalTokens).toBe(100);
  });
});

describe('addStats', () => {
  it('should add two stats objects together', () => {
    const a = {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 5000,
      totalTokens: 6150,
    };

    const b = {
      inputTokens: 200,
      outputTokens: 75,
      cacheCreationInputTokens: 500,
      cacheReadInputTokens: 8000,
      totalTokens: 8775,
    };

    const result = addStats(a, b);

    expect(result.inputTokens).toBe(300);
    expect(result.outputTokens).toBe(125);
    expect(result.cacheCreationInputTokens).toBe(1500);
    expect(result.cacheReadInputTokens).toBe(13000);
    expect(result.totalTokens).toBe(14925);
  });

  it('should recalculate total correctly', () => {
    const a = {
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationInputTokens: 30,
      cacheReadInputTokens: 40,
      totalTokens: 100,
    };

    const b = {
      inputTokens: 5,
      outputTokens: 10,
      cacheCreationInputTokens: 15,
      cacheReadInputTokens: 20,
      totalTokens: 50,
    };

    const result = addStats(a, b);

    expect(result.totalTokens).toBe(15 + 30 + 45 + 60);
    expect(result.totalTokens).toBe(150);
  });

  it('should handle adding empty stats', () => {
    const stats = {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 5000,
      totalTokens: 6150,
    };

    const empty = createEmptyStats();
    const result = addStats(stats, empty);

    expect(result).toEqual(stats);
  });

  it('should return a new object (not mutate inputs)', () => {
    const a = {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 5000,
      totalTokens: 6150,
    };

    const b = createEmptyStats();
    const result = addStats(a, b);

    expect(result).not.toBe(a);
    expect(result).not.toBe(b);
  });
});

// =============================================================================
// Test Helpers
// =============================================================================

function createAssistantMessage(usage: {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}): AssistantMessage {
  return {
    type: 'assistant',
    uuid: `msg-${Math.random().toString(36).slice(2)}`,
    parentUuid: null,
    timestamp: new Date(),
    role: 'assistant',
    model: 'claude-opus-4-5-20251101',
    content: [{ type: 'text', text: 'Test response' }],
    stopReason: 'end_turn',
    usage,
  };
}

function createUserMessage(content: string): UserMessage {
  return {
    type: 'user',
    uuid: `msg-${Math.random().toString(36).slice(2)}`,
    parentUuid: null,
    timestamp: new Date(),
    role: 'user',
    content,
    cwd: '/test',
    gitBranch: 'main',
    isSidechain: false,
  };
}
