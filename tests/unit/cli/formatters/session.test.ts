/**
 * Unit tests for session formatter
 */

import { describe, it, expect } from 'vitest';
import { formatSession, formatSessionForJson } from '../../../../src/cli/formatters/session.js';
import type { Session, UserMessage, AssistantMessage } from '../../../../src/lib/index.js';

/**
 * Create a minimal test session
 */
function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-123',
    projectPath: '/Users/dev/test-project',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    messageCount: 2,
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
});
