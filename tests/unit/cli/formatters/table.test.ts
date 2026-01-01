/**
 * Unit tests for table formatter
 */

import { describe, it, expect } from 'vitest';
import { formatSessionTable, formatSessionsForJson } from '../../../../src/cli/formatters/table.js';
import type { SessionSummary } from '../../../../src/lib/index.js';

function createMockSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'test-uuid-1234',
    projectPath: '/Users/dev/my-project',
    summary: 'Test session summary',
    timestamp: new Date('2025-01-15T10:30:00Z'),
    lastActivityAt: new Date('2025-01-15T11:00:00Z'),
    messageCount: 25,
    agentIds: [],
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
    expect(result).toContain('PROJECT');
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

  it('should truncate long project paths', () => {
    const longPath = '/Users/developer/very/deeply/nested/project/path/here';
    const sessions = [createMockSession({ projectPath: longPath })];
    const result = formatSessionTable(sessions);

    // Should only show the project name (last segment)
    expect(result).toContain('here');
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
});

describe('formatSessionsForJson', () => {
  it('should return empty array for no sessions', () => {
    const result = formatSessionsForJson([]);
    expect(result).toEqual([]);
  });

  it('should add index to each session', () => {
    const sessions = [
      createMockSession({ id: 'id-1' }),
      createMockSession({ id: 'id-2' }),
    ];
    const result = formatSessionsForJson(sessions);

    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
  });

  it('should use offset for index', () => {
    const sessions = [createMockSession({ id: 'id-1' })];
    const result = formatSessionsForJson(sessions, 5);

    expect(result[0].index).toBe(5);
  });

  it('should preserve all session properties', () => {
    const session = createMockSession({
      id: 'test-id',
      projectPath: '/test/path',
      summary: 'Test',
      messageCount: 10,
    });
    const result = formatSessionsForJson([session]);

    expect(result[0].id).toBe('test-id');
    expect(result[0].projectPath).toBe('/test/path');
    expect(result[0].summary).toBe('Test');
    expect(result[0].messageCount).toBe(10);
  });
});
