/**
 * Unit tests for search formatter
 */

import { describe, it, expect } from 'vitest';
import {
  formatSearchResults,
  formatSearchResultsForJson,
} from '../../../../src/cli/formatters/search.js';
import type { SearchMatch } from '../../../../src/lib/index.js';

/**
 * Create a minimal test search match
 */
function createTestMatch(overrides?: Partial<SearchMatch>): SearchMatch {
  return {
    sessionId: 'test-session-123',
    sessionSummary: 'Test session summary',
    projectPath: '/Users/dev/test-project',
    messageUuid: 'msg-001',
    messageType: 'user',
    match: 'test',
    context: ['Line before', 'test match line', 'Line after'],
    lineNumber: 2,
    ...overrides,
  };
}

describe('formatSearchResults', () => {
  const defaultPagination = {
    total: 1,
    offset: 0,
    limit: 20,
    hasMore: false,
  };

  it('should show "no matches" message when empty', () => {
    const output = formatSearchResults([], 'query', 2, defaultPagination);

    expect(output).toContain('No matches found');
    expect(output).toContain('query');
  });

  it('should show match count in header', () => {
    const matches = [createTestMatch()];
    const output = formatSearchResults(matches, 'test', 2, {
      total: 5,
      offset: 0,
      limit: 20,
      hasMore: false,
    });

    expect(output).toContain('5');
    expect(output).toContain('matches for');
    expect(output).toContain('test');
  });

  it('should show "Showing X-Y of Z" for paginated results', () => {
    const matches = [createTestMatch()];
    const output = formatSearchResults(matches, 'test', 2, {
      total: 100,
      offset: 0,
      limit: 20,
      hasMore: true,
    });

    expect(output).toContain('Showing 1-1 of 100');
  });

  it('should include project name for each match', () => {
    const matches = [
      createTestMatch({ projectPath: '/Users/dev/my-awesome-project' }),
    ];
    const output = formatSearchResults(matches, 'test', 2, defaultPagination);

    expect(output).toContain('my-awesome-project');
  });

  it('should include session summary', () => {
    const matches = [
      createTestMatch({ sessionSummary: 'Discussion about TypeScript' }),
    ];
    const output = formatSearchResults(matches, 'test', 2, defaultPagination);

    expect(output).toContain('Discussion about TypeScript');
  });

  it('should show "(no summary)" when summary is null', () => {
    const matches = [createTestMatch({ sessionSummary: null })];
    const output = formatSearchResults(matches, 'test', 2, defaultPagination);

    expect(output).toContain('(no summary)');
  });

  it('should include session ID', () => {
    const matches = [createTestMatch({ sessionId: 'abc-123-def' })];
    const output = formatSearchResults(matches, 'test', 2, defaultPagination);

    expect(output).toContain('abc-123-def');
  });

  it('should include message type', () => {
    const matches = [createTestMatch({ messageType: 'assistant' })];
    const output = formatSearchResults(matches, 'test', 2, defaultPagination);

    expect(output).toContain('ASSISTANT');
  });

  it('should include line number', () => {
    const matches = [createTestMatch({ lineNumber: 42 })];
    const output = formatSearchResults(matches, 'test', 2, defaultPagination);

    expect(output).toContain('line 42');
  });

  it('should show context lines with line numbers', () => {
    const matches = [
      createTestMatch({
        context: ['First line', 'Second line', 'Third line'],
        lineNumber: 2,
      }),
    ];
    const output = formatSearchResults(matches, 'test', 1, defaultPagination);

    expect(output).toContain('First line');
    expect(output).toContain('Second line');
    expect(output).toContain('Third line');
  });

  it('should mark the match line with ">"', () => {
    const matches = [
      createTestMatch({
        context: ['Before', 'Match line here', 'After'],
        lineNumber: 2,
      }),
    ];
    const output = formatSearchResults(matches, 'test', 1, defaultPagination);

    // The match line should have > prefix
    expect(output).toMatch(/>\s+2\s+│\s+Match line here/);
  });

  it('should include separator lines between matches', () => {
    const matches = [createTestMatch(), createTestMatch()];
    const output = formatSearchResults(matches, 'test', 2, {
      ...defaultPagination,
      total: 2,
    });

    // Should have separator character (─)
    expect(output).toContain('─'.repeat(80));
  });

  it('should show pagination hint when hasMore is true', () => {
    const matches = [createTestMatch()];
    const output = formatSearchResults(matches, 'test', 2, {
      total: 100,
      offset: 0,
      limit: 20,
      hasMore: true,
    });

    expect(output).toContain('--offset 20');
  });

  it('should not show pagination hint when hasMore is false', () => {
    const matches = [createTestMatch()];
    const output = formatSearchResults(matches, 'test', 2, {
      ...defaultPagination,
      hasMore: false,
    });

    expect(output).not.toContain('--offset');
  });

  it('should truncate long session summaries', () => {
    const longSummary = 'A'.repeat(100);
    const matches = [createTestMatch({ sessionSummary: longSummary })];
    const output = formatSearchResults(matches, 'test', 2, defaultPagination);

    expect(output).toContain('...');
    expect(output.length).toBeLessThan(longSummary.length + 500);
  });

  it('should truncate long context lines', () => {
    const longLine = 'X'.repeat(200);
    const matches = [
      createTestMatch({
        context: [longLine],
        lineNumber: 1,
      }),
    ];
    const output = formatSearchResults(matches, 'test', 0, defaultPagination);

    expect(output).toContain('...');
  });
});

describe('formatSearchResultsForJson', () => {
  it('should return matches and pagination', () => {
    const matches = [createTestMatch()];
    const pagination = {
      total: 1,
      offset: 0,
      limit: 20,
      hasMore: false,
    };

    const result = formatSearchResultsForJson(matches, pagination);

    expect(result.matches).toBe(matches);
    expect(result.pagination).toBe(pagination);
  });

  it('should preserve all match properties', () => {
    const matches = [
      createTestMatch({
        sessionId: 'session-123',
        projectPath: '/test/path',
        messageType: 'assistant',
        lineNumber: 42,
      }),
    ];
    const pagination = { total: 1, offset: 0, limit: 20, hasMore: false };

    const result = formatSearchResultsForJson(matches, pagination);

    expect(result.matches[0].sessionId).toBe('session-123');
    expect(result.matches[0].projectPath).toBe('/test/path');
    expect(result.matches[0].messageType).toBe('assistant');
    expect(result.matches[0].lineNumber).toBe(42);
  });

  it('should handle empty matches array', () => {
    const pagination = { total: 0, offset: 0, limit: 20, hasMore: false };

    const result = formatSearchResultsForJson([], pagination);

    expect(result.matches).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });
});
