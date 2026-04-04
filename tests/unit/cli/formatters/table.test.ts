/**
 * Unit tests for table formatter
 */

import { describe, it, expect } from 'vitest';
import {
  formatSessionTable,
  formatSessionsForJson,
  formatAggregateStats,
} from '../../../../src/cli/formatters/table.js';
import type { SessionSummary, AggregateTokenStats } from '../../../../src/lib/index.js';

function createMockSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'test-uuid-1234',
    projectPath: '/Users/dev/my-project',
    gitBranch: 'main',
    summary: 'Test session summary',
    preview: null,
    timestamp: new Date('2025-01-15T10:30:00Z'),
    lastActivityAt: new Date('2025-01-15T11:00:00Z'),
    messageCount: 25,
    agentIds: [],
    unresolvedAgentIds: [],
    ...overrides,
  };
}

describe('formatSessionTable', () => {
  it('should return empty message for no sessions', () => {
    const result = formatSessionTable([]);
    expect(result).toBe('No sessions found.');
  });

  it('should format single session with header and separator', () => {
    const sessions = [createMockSession()];
    const result = formatSessionTable(sessions);

    expect(result).toContain('IDX');
    expect(result).toContain('TIMESTAMP');
    expect(result).toContain('PATH');
    expect(result).toContain('BRANCH');
    expect(result).toContain('SUMMARY');
    expect(result).toContain('MSGS');
    expect(result).toContain('─');
  });

  it('should display session index starting from 0', () => {
    const sessions = [createMockSession()];
    const result = formatSessionTable(sessions);

    // Should contain index 0
    const lines = result.split('\n');
    expect(lines[2]).toContain('0');
  });

  it('should use offset for display index', () => {
    const sessions = [createMockSession()];
    const result = formatSessionTable(sessions, 10);

    const lines = result.split('\n');
    expect(lines[2]).toContain('10');
  });

  it('should format multiple sessions', () => {
    const sessions = [
      createMockSession({ id: 'id-1', summary: 'First session' }),
      createMockSession({ id: 'id-2', summary: 'Second session' }),
      createMockSession({ id: 'id-3', summary: 'Third session' }),
    ];
    const result = formatSessionTable(sessions);

    const lines = result.split('\n');
    // Header + separator + 3 rows
    expect(lines.length).toBe(5);
  });

  it('should truncate long summaries', () => {
    const longSummary =
      'This is a very long summary that should be truncated because it exceeds the column width';
    const sessions = [createMockSession({ summary: longSummary })];
    const result = formatSessionTable(sessions);

    expect(result).toContain('...');
    expect(result).not.toContain(longSummary);
  });

  it('should truncate long project paths from the left', () => {
    const longPath = '/Users/developer/very/deeply/nested/project/path/here';
    const sessions = [createMockSession({ projectPath: longPath })];
    const result = formatSessionTable(sessions);

    // Should show truncated path with ellipsis at start, preserving the end
    expect(result).toContain('…');
    expect(result).toContain('here');
  });

  it('should display git branch in BRANCH column', () => {
    const sessions = [createMockSession({ gitBranch: 'feature/test' })];
    const result = formatSessionTable(sessions);

    expect(result).toContain('feature/test');
  });

  it('should display dash for null git branch', () => {
    const sessions = [createMockSession({ gitBranch: null })];
    const result = formatSessionTable(sessions);

    // The row should contain a dash for the branch
    const lines = result.split('\n');
    const dataRow = lines[2];
    expect(dataRow).toContain('-');
  });

  it('should show message count', () => {
    const sessions = [createMockSession({ messageCount: 42 })];
    const result = formatSessionTable(sessions);

    expect(result).toContain('42');
  });

  it('should handle session with no summary', () => {
    const sessions = [createMockSession({ summary: null })];
    const result = formatSessionTable(sessions);

    expect(result).toContain('(No summary)');
  });

  it('should use preview when summary is absent', () => {
    const sessions = [
      createMockSession({
        summary: null,
        preview: 'Fallback preview text for an untitled session',
      }),
    ];
    const result = formatSessionTable(sessions);

    expect(result).toContain('Fallback preview text');
    expect(result).not.toContain('(No summary)');
  });

  it('should prefer summary over preview when both are present', () => {
    const sessions = [
      createMockSession({
        summary: 'Explicit title',
        preview: 'Fallback preview text',
      }),
    ];
    const result = formatSessionTable(sessions);

    expect(result).toContain('Explicit title');
    expect(result).not.toContain('Fallback preview text');
  });

  it('should truncate long preview fallback text for display only', () => {
    const longPreview = 'x'.repeat(200);
    const sessions = [
      createMockSession({
        summary: null,
        preview: longPreview,
      }),
    ];
    const result = formatSessionTable(sessions);

    expect(result).toContain(`${'x'.repeat(27)}...`);
    expect(result).not.toContain(longPreview);
    expect(sessions[0]?.preview).toHaveLength(200);
  });
});

describe('formatSessionsForJson', () => {
  it('should return empty array for no sessions', () => {
    const result = formatSessionsForJson([]);
    expect(result).toEqual([]);
  });

  it('should add index to each session', () => {
    const sessions = [createMockSession({ id: 'id-1' }), createMockSession({ id: 'id-2' })];
    const result = formatSessionsForJson(sessions);

    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
  });

  it('should use offset for index', () => {
    const sessions = [createMockSession({ id: 'id-1' })];
    const result = formatSessionsForJson(sessions, 5);

    expect(result[0].index).toBe(5);
  });

  it('should preserve all session properties including gitBranch', () => {
    const session = createMockSession({
      id: 'test-id',
      projectPath: '/test/path',
      gitBranch: 'develop',
      summary: 'Test',
      messageCount: 10,
    });
    const result = formatSessionsForJson([session]);

    expect(result[0].id).toBe('test-id');
    expect(result[0].projectPath).toBe('/test/path');
    expect(result[0].gitBranch).toBe('develop');
    expect(result[0].summary).toBe('Test');
    expect(result[0].messageCount).toBe(10);
  });

  it('should include null gitBranch in JSON output', () => {
    const session = createMockSession({ gitBranch: null });
    const result = formatSessionsForJson([session]);

    expect(result[0].gitBranch).toBeNull();
  });
});

describe('formatAggregateStats', () => {
  it('should include all four token types', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 1000,
      outputTokens: 2000,
      cacheCreationInputTokens: 5000,
      cacheReadInputTokens: 50000,
      totalTokens: 58000,
    };

    const result = formatAggregateStats(stats);

    expect(result).toContain('Input tokens:');
    expect(result).toContain('Output tokens:');
    expect(result).toContain('Cache read tokens:');
    expect(result).toContain('Cache creation tokens:');
    expect(result).toContain('Total tokens:');
  });

  it('should format numbers with locale separators', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 1000,
      outputTokens: 2000,
      cacheCreationInputTokens: 5000,
      cacheReadInputTokens: 50000,
      totalTokens: 58000,
    };

    const result = formatAggregateStats(stats);

    // toLocaleString() formats with separators
    expect(result).toContain('1,000');
    expect(result).toContain('2,000');
    expect(result).toContain('5,000');
    expect(result).toContain('50,000');
    expect(result).toContain('58,000');
  });

  it('should include header and separator lines', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationInputTokens: 300,
      cacheReadInputTokens: 400,
      totalTokens: 1000,
    };

    const result = formatAggregateStats(stats);

    expect(result).toContain('Aggregate Token Statistics');
    expect(result).toContain('─'.repeat(80));
  });

  it('should handle zero values', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 0,
    };

    const result = formatAggregateStats(stats);

    expect(result).toContain('Input tokens:');
    expect(result).toContain('Total tokens:');
    // Should show 0 values
    expect(result.match(/0/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
