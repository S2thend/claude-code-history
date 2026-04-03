/**
 * Unit tests for session formatter
 */

import { describe, it, expect } from 'vitest';
import {
  formatSession,
  formatSessionForJson,
  formatTokenSummary,
} from '../../../../src/cli/formatters/session.js';
import type {
  Session,
  UserMessage,
  AssistantMessage,
  ProgressMessage,
  AggregateTokenStats,
} from '../../../../src/lib/index.js';

/**
 * Create a minimal test session
 */
function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-123',
    projectPath: '/Users/dev/test-project',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    messageCount: 2,
    agentIds: [],
    unresolvedAgentIds: [],
    messages: [
      {
        type: 'user',
        uuid: 'msg-1',
        parentUuid: null,
        timestamp: new Date('2024-01-15T10:30:00Z'),
        content: 'Hello, Claude!',
        cwd: '/Users/dev/test-project',
      } as UserMessage,
      {
        type: 'assistant',
        uuid: 'msg-2',
        parentUuid: 'msg-1',
        timestamp: new Date('2024-01-15T10:30:05Z'),
        model: 'claude-3-sonnet',
        content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 50, outputTokens: 100 },
      } as AssistantMessage,
    ],
    ...overrides,
  };
}

describe('formatSession', () => {
  it('should include session header with ID', () => {
    const session = createTestSession();
    const output = formatSession(session);

    expect(output).toContain('Session:');
    expect(output).toContain('test-session-123');
  });

  it('should include project path', () => {
    const session = createTestSession({ projectPath: '/Users/dev/my-awesome-project' });
    const output = formatSession(session);

    expect(output).toContain('Project:');
    expect(output).toContain('/Users/dev/my-awesome-project');
  });

  it('should include formatted timestamp', () => {
    const session = createTestSession({
      timestamp: new Date('2024-06-20T14:30:00Z'),
    });
    const output = formatSession(session);

    expect(output).toContain('Started:');
    // Should have date in format YYYY-MM-DD HH:MM:SS
    expect(output).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it('should include message count', () => {
    const session = createTestSession({ messageCount: 5 });
    const output = formatSession(session);

    expect(output).toContain('Messages:');
    expect(output).toContain('5');
  });

  it('should show the displayable message count without filtered wording when no filter is applied', () => {
    const session = createTestSession({ messageCount: 2 });
    const output = formatSession(session, {
      messages: session.messages,
      filter: [],
      totalMessageCount: 2,
    });

    expect(output).toContain('Messages: 2');
    expect(output).not.toContain('filtered from');
  });

  it('should include summary when present', () => {
    const session = createTestSession({ summary: 'Discussion about TypeScript generics' });
    const output = formatSession(session);

    expect(output).toContain('Summary:');
    expect(output).toContain('Discussion about TypeScript generics');
  });

  it('should include git branch when present', () => {
    const session = createTestSession({ gitBranch: 'feature/new-feature' });
    const output = formatSession(session);

    expect(output).toContain('Branch:');
    expect(output).toContain('feature/new-feature');
  });

  it('should include linked agent IDs when present', () => {
    const session = createTestSession({ agentIds: ['linked123'] });
    const output = formatSession(session);

    expect(output).toContain('Linked Agent Sessions: linked123');
  });

  it('should include unresolved agent references when present', () => {
    const session = createTestSession({ unresolvedAgentIds: ['missing456'] });
    const output = formatSession(session);

    expect(output).toContain('Unresolved Agent References: missing456');
  });

  it('should format user messages with USER label', () => {
    const session = createTestSession();
    const output = formatSession(session);

    expect(output).toContain('USER');
    expect(output).toContain('Hello, Claude!');
  });

  it('should format assistant messages with ASSISTANT label', () => {
    const session = createTestSession();
    const output = formatSession(session);

    expect(output).toContain('ASSISTANT');
    expect(output).toContain('Hello! How can I help you today?');
  });

  it('should include model name in assistant messages', () => {
    const session = createTestSession();
    const output = formatSession(session);

    expect(output).toContain('claude-3-sonnet');
  });

  it('should include token count in assistant messages', () => {
    const session = createTestSession();
    const output = formatSession(session);

    // 50 input + 100 output = 150 total
    expect(output).toContain('150');
    expect(output).toContain('tokens');
  });

  it('should include message timestamps in HH:MM:SS format', () => {
    const session = createTestSession();
    const output = formatSession(session);

    // Should have time format
    expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
  });

  it('should include separator lines between messages', () => {
    const session = createTestSession();
    const output = formatSession(session);

    // Should have separator character (─)
    expect(output).toContain('─'.repeat(80));
  });

  it('should render progress messages distinctly', () => {
    const session = createTestSession({
      messageCount: 3,
      messages: [
        {
          type: 'user',
          uuid: 'msg-1',
          parentUuid: null,
          timestamp: new Date('2024-01-15T10:30:00Z'),
          content: 'Start scanning',
          cwd: '/Users/dev/test-project',
        } as UserMessage,
        {
          type: 'progress',
          uuid: 'msg-2',
          parentUuid: 'msg-1',
          timestamp: new Date('2024-01-15T10:30:03Z'),
          content: [{ type: 'text', text: 'Scanning src/lib/types.ts' }],
          cwd: '/Users/dev/test-project',
          gitBranch: 'main',
          isSidechain: false,
        } as ProgressMessage,
        {
          type: 'assistant',
          uuid: 'msg-3',
          parentUuid: 'msg-2',
          timestamp: new Date('2024-01-15T10:30:05Z'),
          model: 'claude-3-sonnet',
          content: [{ type: 'text', text: 'Scan complete.' }],
          stopReason: 'end_turn',
          usage: { inputTokens: 50, outputTokens: 100 },
        } as AssistantMessage,
      ],
    });

    const output = formatSession(session);

    expect(output).toContain('PROGRESS');
    expect(output).toContain('Scanning src/lib/types.ts');
    expect(output).toContain('CWD: /Users/dev/test-project');
  });

  it('should show a placeholder for progress messages without readable text', () => {
    const session = createTestSession({
      messageCount: 1,
      messages: [
        {
          type: 'progress',
          uuid: 'msg-progress',
          parentUuid: null,
          timestamp: new Date('2024-01-15T10:30:03Z'),
          content: [],
          cwd: '/Users/dev/test-project',
          gitBranch: 'main',
          isSidechain: false,
        } as ProgressMessage,
      ],
    });

    const output = formatSession(session);

    expect(output).toContain('PROGRESS');
    expect(output).toContain('No human-readable progress text captured');
  });

  it('should handle empty messages array', () => {
    const session = createTestSession({ messages: [], messageCount: 0 });
    const output = formatSession(session);

    expect(output).toContain('Session:');
    expect(output).toContain('Messages: 0');
  });

  describe('tool use formatting', () => {
    it('should format tool use content with tool name', () => {
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'read_file',
                input: { path: '/test/file.txt' },
              },
            ],
            stopReason: 'tool_use',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
        ],
      });
      const output = formatSession(session);

      expect(output).toContain('[Tool: read_file]');
    });

    it('should include tool input in output', () => {
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'write_file',
                input: { path: '/test/output.txt', content: 'test content' },
              },
            ],
            stopReason: 'tool_use',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
        ],
      });
      const output = formatSession(session);

      expect(output).toContain('path');
      expect(output).toContain('/test/output.txt');
    });

    it('should truncate long tool input', () => {
      const longContent = 'x'.repeat(500);
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'write_file',
                input: { content: longContent },
              },
            ],
            stopReason: 'tool_use',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
        ],
      });
      const output = formatSession(session);

      // Should be truncated with ellipsis
      expect(output).toContain('...');
      expect(output.length).toBeLessThan(longContent.length + 500);
    });
  });

  describe('thinking content formatting', () => {
    it('should format thinking content with preview', () => {
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'thinking',
                thinking: 'Let me analyze this step by step...',
              },
              { type: 'text', text: 'Here is my response.' },
            ],
            stopReason: 'end_turn',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
        ],
      });
      const output = formatSession(session);

      expect(output).toContain('[Thinking]');
      expect(output).toContain('Let me analyze');
    });

    it('should truncate long thinking content', () => {
      const longThinking = 'thinking '.repeat(50);
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'thinking',
                thinking: longThinking,
              },
            ],
            stopReason: 'end_turn',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
        ],
      });
      const output = formatSession(session);

      expect(output).toContain('[Thinking]');
      expect(output).toContain('...');
    });
  });

  describe('tool result formatting', () => {
    it('should format tool results inline with tool calls', () => {
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: '/test/file.txt' },
              },
            ],
            stopReason: 'tool_use',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
          {
            type: 'user',
            uuid: 'msg-2',
            parentUuid: 'msg-1',
            timestamp: new Date('2024-01-15T10:30:01Z'),
            cwd: '/test',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'File content here',
              },
            ],
          } as unknown as UserMessage,
        ],
      });
      const output = formatSession(session);

      // Tool call should be present
      expect(output).toContain('[Tool: Read]');
      // Result should be shown inline with the tool call
      expect(output).toContain('→ Result:');
      expect(output).toContain('File content here');
    });

    it('should truncate long tool results', () => {
      const longResult = 'result '.repeat(100);
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: '/test/file.txt' },
              },
            ],
            stopReason: 'tool_use',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
          {
            type: 'user',
            uuid: 'msg-2',
            parentUuid: 'msg-1',
            timestamp: new Date('2024-01-15T10:30:01Z'),
            cwd: '/test',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: longResult,
              },
            ],
          } as unknown as UserMessage,
        ],
      });
      const output = formatSession(session);

      // Long results should be truncated
      expect(output).toContain('...');
    });

    it('should show error indicator for failed tool results', () => {
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Bash',
                input: { command: 'exit 1' },
              },
            ],
            stopReason: 'tool_use',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
          {
            type: 'user',
            uuid: 'msg-2',
            parentUuid: 'msg-1',
            timestamp: new Date('2024-01-15T10:30:01Z'),
            cwd: '/test',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'Command failed with exit code 1',
                is_error: true,
              },
            ],
          } as unknown as UserMessage,
        ],
      });
      const output = formatSession(session);

      // Should show error indicator
      expect(output).toContain('⚠ ERROR:');
      expect(output).toContain('Command failed');
    });

    it('should skip standalone tool result messages', () => {
      const session = createTestSession({
        messages: [
          {
            type: 'assistant',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: '/test/file.txt' },
              },
            ],
            stopReason: 'tool_use',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
          {
            type: 'user',
            uuid: 'msg-2',
            parentUuid: 'msg-1',
            timestamp: new Date('2024-01-15T10:30:01Z'),
            cwd: '/test',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: 'File content',
              },
            ],
          } as unknown as UserMessage,
        ],
      });
      const output = formatSession(session);

      // The [Tool Result] label should NOT appear as a standalone message
      // The result content should be inline with the tool call
      const toolResultCount = (output.match(/\[Tool Result\]/g) || []).length;
      expect(toolResultCount).toBe(0);

      // But the result content should still be present (inline)
      expect(output).toContain('File content');
    });
  });

  describe('non-message entries', () => {
    it('should skip summary messages in output', () => {
      const session = createTestSession({
        messages: [
          {
            type: 'summary',
            uuid: 'summary-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            summary: 'This is the session summary',
            leafUuid: 'msg-2',
          } as unknown as UserMessage,
          {
            type: 'user',
            uuid: 'msg-1',
            parentUuid: null,
            timestamp: new Date('2024-01-15T10:30:00Z'),
            content: 'Hello!',
            cwd: '/test',
          } as UserMessage,
          {
            type: 'assistant',
            uuid: 'msg-2',
            parentUuid: 'msg-1',
            timestamp: new Date('2024-01-15T10:30:05Z'),
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'Hi there!' }],
            stopReason: 'end_turn',
            usage: { inputTokens: 50, outputTokens: 100 },
          } as AssistantMessage,
        ],
      });
      const output = formatSession(session);

      // Summary should not appear as a message in the output
      // The summary text "This is the session summary" should not be in the messages section
      expect(output).not.toContain('[Summary]');
      // But user and assistant messages should be present
      expect(output).toContain('Hello!');
      expect(output).toContain('Hi there!');
    });
  });

  describe('token stats', () => {
    it('should include token statistics footer when tokenStats option is provided', () => {
      const session = createTestSession();
      const tokenStats: AggregateTokenStats = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 200,
        messageCount: 10,
      };
      const output = formatSession(session, {
        tokenStats,
        messages: session.messages,
      });

      expect(output).toContain('Token Usage Summary');
      expect(output).toContain('1,000');
      expect(output).toContain('500');
    });
  });

  describe('filtered results', () => {
    it('should show message when no messages match filter', () => {
      const session = createTestSession();
      const output = formatSession(session, {
        messages: [], // Empty filtered result
        filter: ['thinking'],
      });

      expect(output).toContain('No messages match filter');
      expect(output).toContain('thinking');
    });
  });
});

describe('formatSessionForJson', () => {
  it('should return the session object as-is', () => {
    const session = createTestSession();
    const result = formatSessionForJson(session);

    expect(result).toBe(session);
    expect(result.id).toBe('test-session-123');
  });

  it('should preserve all session properties', () => {
    const session = createTestSession({
      summary: 'Test summary',
      gitBranch: 'main',
    });
    const result = formatSessionForJson(session);

    expect(result.id).toBe(session.id);
    expect(result.projectPath).toBe(session.projectPath);
    expect(result.timestamp).toBe(session.timestamp);
    expect(result.messageCount).toBe(session.messageCount);
    expect(result.messages).toBe(session.messages);
    expect(result.summary).toBe('Test summary');
    expect(result.gitBranch).toBe('main');
  });

  it('should include tokenStats when provided in options', () => {
    const session = createTestSession();
    const tokenStats: AggregateTokenStats = {
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 5000,
      totalTokens: 6300,
    };

    const result = formatSessionForJson(session, {
      messages: session.messages,
      filter: [],
      totalMessageCount: 2,
      tokenStats,
    });

    expect('tokenStats' in result).toBe(true);
    if ('tokenStats' in result) {
      expect(result.tokenStats).toEqual(tokenStats);
    }
  });
});

describe('formatTokenSummary', () => {
  it('should include all four token types', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 5000,
      totalTokens: 6300,
    };

    const output = formatTokenSummary(stats);

    expect(output).toContain('Input tokens:');
    expect(output).toContain('Output tokens:');
    expect(output).toContain('Cache read tokens:');
    expect(output).toContain('Cache creation tokens:');
    expect(output).toContain('Total tokens:');
  });

  it('should format numbers with locale separators', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 1000,
      outputTokens: 2000,
      cacheCreationInputTokens: 10000,
      cacheReadInputTokens: 50000,
      totalTokens: 63000,
    };

    const output = formatTokenSummary(stats);

    // toLocaleString() formats numbers with separators
    // The exact format depends on locale, but should include separators
    expect(output).toContain('1,000'); // Input
    expect(output).toContain('2,000'); // Output
    expect(output).toContain('10,000'); // Cache creation
    expect(output).toContain('50,000'); // Cache read
    expect(output).toContain('63,000'); // Total
  });

  it('should include header and separator lines', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 100,
      outputTokens: 200,
      cacheCreationInputTokens: 300,
      cacheReadInputTokens: 400,
      totalTokens: 1000,
    };

    const output = formatTokenSummary(stats);

    expect(output).toContain('Token Usage Summary');
    expect(output).toContain('─'.repeat(80));
  });

  it('should handle zero values', () => {
    const stats: AggregateTokenStats = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 0,
    };

    const output = formatTokenSummary(stats);

    expect(output).toContain('Input tokens:');
    expect(output).toContain('Total tokens:');
    // Should show 0 for all fields
    expect(output.match(/0/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
