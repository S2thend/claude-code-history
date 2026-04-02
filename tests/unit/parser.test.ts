/**
 * Unit tests for JSONL parser.
 */

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import {
  parseJsonLine,
  parseJsonlFile,
  transformEntry,
  parseSessionFile,
  parseSessionMetadata,
  extractMetadata,
} from '../../src/lib/parser.js';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures');

describe('parseJsonLine', () => {
  it('should parse valid JSON line', () => {
    const line = '{"type":"user","uuid":"test-001"}';
    const result = parseJsonLine(line, 1);

    expect(result.entry).toEqual({ type: 'user', uuid: 'test-001' });
    expect(result.warning).toBe(null);
  });

  it('should return warning for invalid JSON', () => {
    const line = 'this is not valid json';
    const result = parseJsonLine(line, 5);

    expect(result.entry).toBe(null);
    expect(result.warning).not.toBe(null);
    expect(result.warning?.line).toBe(5);
    expect(result.warning?.error).toContain('Invalid JSON');
    expect(result.warning?.content).toBe('this is not valid json');
  });

  it('should return warning for empty line', () => {
    const result = parseJsonLine('', 1);
    expect(result.entry).toBe(null);
    expect(result.warning?.error).toBe('Empty line');
  });

  it('should handle whitespace-only lines', () => {
    const result = parseJsonLine('   ', 1);
    expect(result.entry).toBe(null);
    expect(result.warning?.error).toBe('Empty line');
  });

  it('should truncate long error content', () => {
    const longInvalidLine = 'x'.repeat(200);
    const result = parseJsonLine(longInvalidLine, 1);

    expect(result.warning?.content).toHaveLength(103); // 100 + '...'
    expect(result.warning?.content).toContain('...');
  });
});

describe('parseJsonlFile', () => {
  it('should parse sample session file', async () => {
    const filePath = join(FIXTURES_DIR, 'sample-session.jsonl');
    const result = await parseJsonlFile(filePath);

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);

    // Check first entry is summary
    expect(result.data[0].type).toBe('summary');
  });

  it('should parse corrupted session with warnings', async () => {
    const filePath = join(FIXTURES_DIR, 'corrupted-session.jsonl');
    const result = await parseJsonlFile(filePath);

    // Should have valid entries despite corruption
    expect(result.data.length).toBeGreaterThan(0);

    // Should have warnings for invalid lines
    expect(result.warnings.length).toBeGreaterThan(0);

    // Check that warnings have correct structure
    for (const warning of result.warnings) {
      expect(warning).toHaveProperty('line');
      expect(warning).toHaveProperty('error');
    }
  });

  it('should parse agent session file', async () => {
    const filePath = join(FIXTURES_DIR, 'agent-session.jsonl');
    const result = await parseJsonlFile(filePath);

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);

    // Should have agentId in entries
    const hasAgentId = result.data.some((entry) => entry.agentId);
    expect(hasAgentId).toBe(true);
  });
});

describe('transformEntry', () => {
  it('should transform user message entry', () => {
    const entry = {
      type: 'user',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      cwd: '/Users/test/project',
      gitBranch: 'main',
      isSidechain: false,
      message: {
        role: 'user',
        content: 'Hello, world!',
      },
    };

    const result = transformEntry(entry);

    expect(result).not.toBe(null);
    expect(result?.type).toBe('user');
    expect(result?.uuid).toBe('msg-001');
    if (result?.type === 'user') {
      expect(result.content).toBe('Hello, world!');
      expect(result.cwd).toBe('/Users/test/project');
      expect(result.gitBranch).toBe('main');
    }
  });

  it('should transform assistant message entry', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-002',
      parentUuid: 'msg-001',
      timestamp: '2025-12-01T10:00:15.000Z',
      message: {
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 50,
          output_tokens: 25,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    };

    const result = transformEntry(entry);

    expect(result).not.toBe(null);
    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      expect(result.model).toBe('claude-opus-4-5-20251101');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.usage.inputTokens).toBe(50);
      expect(result.usage.outputTokens).toBe(25);
    }
  });

  it('should handle assistant message with missing optional fields', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-002',
      parentUuid: 'msg-001',
      timestamp: '2025-12-01T10:00:15.000Z',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        // No model, stop_reason, or usage
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      expect(result.model).toBe('');
      expect(result.stopReason).toBe(null);
      expect(result.usage.inputTokens).toBe(0);
    }
  });

  it('should transform summary entry', () => {
    const entry = {
      type: 'summary',
      uuid: '',
      parentUuid: null,
      summary: 'Test session summary',
      leafUuid: 'msg-003',
    };

    const result = transformEntry(entry);

    expect(result).not.toBe(null);
    expect(result?.type).toBe('summary');
    if (result?.type === 'summary') {
      expect(result.summary).toBe('Test session summary');
      expect(result.leafUuid).toBe('msg-003');
    }
  });

  it('should handle summary entry with missing fields', () => {
    const entry = {
      type: 'summary',
      uuid: '',
      parentUuid: null,
      // No summary or leafUuid
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('summary');
    if (result?.type === 'summary') {
      expect(result.summary).toBe('');
      expect(result.leafUuid).toBe('');
    }
  });

  it('should transform tool use content', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-003',
      parentUuid: 'msg-002',
      timestamp: '2025-12-01T10:00:30.000Z',
      message: {
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_001',
            name: 'Read',
            input: { file_path: '/test/file.txt' },
          },
        ],
        stop_reason: 'tool_use',
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      expect(result.content[0].type).toBe('tool_use');
      const toolUse = result.content[0] as { type: 'tool_use'; id: string; name: string };
      expect(toolUse.id).toBe('toolu_001');
      expect(toolUse.name).toBe('Read');
    }
  });

  it('should transform tool result content', () => {
    const entry = {
      type: 'user',
      uuid: 'msg-004',
      parentUuid: 'msg-003',
      timestamp: '2025-12-01T10:00:31.000Z',
      cwd: '/test',
      isSidechain: false,
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_001',
            content: 'File contents here',
          },
        ],
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('user');
    if (result?.type === 'user') {
      expect(Array.isArray(result.content)).toBe(true);
      const content = result.content as { type: string; tool_use_id: string }[];
      expect(content[0].type).toBe('tool_result');
      expect(content[0].tool_use_id).toBe('toolu_001');
    }
  });

  it('should transform thinking content', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-005',
      parentUuid: 'msg-004',
      timestamp: '2025-12-01T10:00:45.000Z',
      message: {
        model: 'claude-haiku-4-5-20251001',
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Let me think about this...' },
          { type: 'text', text: 'Here is my response.' },
        ],
        stop_reason: 'end_turn',
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('thinking');
      expect(result.content[1].type).toBe('text');
    }
  });

  it('should handle assistant content as string (rare case)', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      message: {
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: 'Just a string response',
        stop_reason: 'end_turn',
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      if (result.content[0].type === 'text') {
        expect(result.content[0].text).toBe('Just a string response');
      }
    }
  });

  it('should handle assistant content with non-object array items', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      message: {
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: ['string item', null, { type: 'text', text: 'valid' }],
        stop_reason: 'end_turn',
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      // Only the valid text item should be included
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    }
  });

  it('should handle assistant content with unknown type', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      message: {
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: [
          { type: 'unknown_type', data: 'some data' },
          { type: 'text', text: 'valid text' },
        ],
        stop_reason: 'end_turn',
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      // Only the valid text item should be included
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    }
  });

  it('should handle assistant with no content', () => {
    const entry = {
      type: 'assistant',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      message: {
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: null,
        stop_reason: 'end_turn',
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('assistant');
    if (result?.type === 'assistant') {
      expect(result.content).toEqual([]);
    }
  });

  it('should return null for unknown entry type', () => {
    const entry = {
      type: 'unknown-type',
      uuid: 'test',
    };

    const result = transformEntry(entry);
    expect(result).toBe(null);
  });

  it('should handle user content with non-object array items', () => {
    const entry = {
      type: 'user',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      cwd: '/test',
      message: {
        role: 'user',
        content: ['string item', null, 123],
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('user');
    if (result?.type === 'user') {
      // Non-object items should be filtered out
      expect(result.content).toEqual([]);
    }
  });

  it('should handle user content with array items that are not tool_result type', () => {
    const entry = {
      type: 'user',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      cwd: '/test',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: 'not a tool result' },
          { type: 'tool_result', tool_use_id: 'toolu_001', content: 'result' },
        ],
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('user');
    if (result?.type === 'user') {
      // Only tool_result items should be included
      const content = result.content as { type: string }[];
      expect(content.length).toBe(1);
      expect(content[0].type).toBe('tool_result');
    }
  });

  it('should handle user content that is neither string nor array', () => {
    const entry = {
      type: 'user',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      cwd: '/test',
      message: {
        role: 'user',
        content: { unexpected: 'object' },
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('user');
    if (result?.type === 'user') {
      // Should return empty string for unexpected content type
      expect(result.content).toBe('');
    }
  });

  it('should return null for file-history-snapshot without snapshot', () => {
    const entry = {
      type: 'file-history-snapshot',
      uuid: 'snapshot-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      messageId: 'msg-001',
      // No snapshot field
    };

    const result = transformEntry(entry);
    expect(result).toBe(null);
  });

  it('should transform file-history-snapshot with valid snapshot', () => {
    const entry = {
      type: 'file-history-snapshot',
      uuid: 'snapshot-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      messageId: 'msg-001',
      snapshot: {
        messageId: 'msg-001',
        timestamp: '2025-12-01T10:00:00.000Z',
        trackedFileBackups: {
          '/test/file.ts': {
            backupFileName: 'file.ts.backup',
            version: 1,
            backupTime: '2025-12-01T10:00:00.000Z',
          },
        },
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('file-history-snapshot');
    if (result?.type === 'file-history-snapshot') {
      expect(result.messageId).toBe('msg-001');
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.trackedFileBackups).toHaveProperty('/test/file.ts');
    }
  });

  it('should handle file-history-snapshot with missing messageId', () => {
    const entry = {
      type: 'file-history-snapshot',
      uuid: 'snapshot-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      // No messageId
      snapshot: {
        messageId: 'msg-001',
        timestamp: '2025-12-01T10:00:00.000Z',
        trackedFileBackups: {},
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('file-history-snapshot');
    if (result?.type === 'file-history-snapshot') {
      expect(result.messageId).toBe('');
    }
  });

  it('should handle tool result with is_error flag', () => {
    const entry = {
      type: 'user',
      uuid: 'msg-001',
      parentUuid: null,
      timestamp: '2025-12-01T10:00:00.000Z',
      cwd: '/test',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_001',
            content: 'Error occurred',
            is_error: true,
          },
        ],
      },
    };

    const result = transformEntry(entry);
    expect(result?.type).toBe('user');
    if (result?.type === 'user') {
      const content = result.content as { type: string; is_error?: boolean }[];
      expect(content[0].is_error).toBe(true);
    }
  });

  it('should transform progress entries with readable text', () => {
    const entry = {
      type: 'progress',
      uuid: 'msg-progress',
      parentUuid: 'msg-001',
      timestamp: '2026-04-01T00:00:01.000Z',
      cwd: '/tmp/project-progress',
      gitBranch: 'main',
      isSidechain: false,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Scanning src/lib/types.ts' }],
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('progress');
    if (result?.type === 'progress') {
      expect(result.content).toEqual([{ type: 'text', text: 'Scanning src/lib/types.ts' }]);
      expect(result.cwd).toBe('/tmp/project-progress');
      expect(result.gitBranch).toBe('main');
      expect(result.isSidechain).toBe(false);
    }
  });

  it('should transform progress entries with unreadable content safely', () => {
    const entry = {
      type: 'progress',
      uuid: 'msg-progress',
      parentUuid: 'msg-001',
      timestamp: '2026-04-01T00:00:01.000Z',
      cwd: '/tmp/project-progress',
      gitBranch: 'main',
      isSidechain: false,
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'toolu_123', name: 'Glob', input: { pattern: 'src/**/*.ts' } },
        ],
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('progress');
    if (result?.type === 'progress') {
      expect(result.content).toEqual([]);
    }
  });

  it('should transform agent progress entries using normalizedMessages text', () => {
    const entry = {
      type: 'progress',
      uuid: 'msg-progress-agent',
      parentUuid: 'msg-001',
      timestamp: '2026-04-01T00:00:01.000Z',
      cwd: '/tmp/project-progress',
      gitBranch: 'main',
      isSidechain: false,
      data: {
        type: 'agent_progress',
        message: {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'toolu_123', name: 'Glob', input: {} }],
          },
        },
        normalizedMessages: [
          {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Scanning memory-related files now.' }],
            },
          },
          {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'tool_use', id: 'toolu_123', name: 'Glob', input: {} }],
            },
          },
        ],
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('progress');
    if (result?.type === 'progress') {
      expect(result.content).toEqual([
        { type: 'text', text: 'Scanning memory-related files now.' },
      ]);
    }
  });

  it('should preserve unreadable hook progress entries as empty content', () => {
    const entry = {
      type: 'progress',
      uuid: 'msg-progress-hook',
      parentUuid: 'msg-001',
      timestamp: '2026-04-01T00:00:01.000Z',
      cwd: '/tmp/project-progress',
      gitBranch: 'main',
      isSidechain: false,
      data: {
        type: 'hook_progress',
        hookEvent: 'PostToolUse',
        hookName: 'PostToolUse:Read',
        command: 'callback',
      },
    };

    const result = transformEntry(entry);

    expect(result?.type).toBe('progress');
    if (result?.type === 'progress') {
      expect(result.content).toEqual([]);
    }
  });
});

describe('parseSessionFile', () => {
  it('should parse sample session into typed messages', async () => {
    const filePath = join(FIXTURES_DIR, 'sample-session.jsonl');
    const result = await parseSessionFile(filePath);

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.warnings).toHaveLength(0);

    // Should have summary message
    const summaryMessages = result.data.filter((m) => m.type === 'summary');
    expect(summaryMessages.length).toBeGreaterThan(0);

    // Should have user and assistant messages
    const userMessages = result.data.filter((m) => m.type === 'user');
    const assistantMessages = result.data.filter((m) => m.type === 'assistant');
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  it('should handle corrupted session gracefully', async () => {
    const filePath = join(FIXTURES_DIR, 'corrupted-session.jsonl');
    const result = await parseSessionFile(filePath);

    // Should still parse valid messages
    expect(result.data.length).toBeGreaterThan(0);

    // Should have warnings for invalid lines
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should preserve progress entries from the progress fixture', async () => {
    const filePath = join(FIXTURES_DIR, 'progress-session.jsonl');
    const result = await parseSessionFile(filePath);

    expect(result.warnings).toHaveLength(0);
    const progressMessages = result.data.filter((message) => message.type === 'progress');
    expect(progressMessages).toHaveLength(2);

    const readableProgress = progressMessages.find(
      (message) => message.uuid === 'msg-progress-readable'
    );
    expect(readableProgress?.type).toBe('progress');
    if (readableProgress?.type === 'progress') {
      expect(readableProgress.content[0]?.text).toContain('PROGRESS_ONLY_TOKEN');
      expect(readableProgress.parentUuid).toBe('msg-user');
    }

    const emptyProgress = progressMessages.find((message) => message.uuid === 'msg-progress-empty');
    expect(emptyProgress?.type).toBe('progress');
    if (emptyProgress?.type === 'progress') {
      expect(emptyProgress.content).toEqual([]);
    }
  });
});

describe('extractMetadata', () => {
  it('should extract metadata from entries', () => {
    const entries = [
      { type: 'summary', summary: 'Test session', leafUuid: 'msg-002' },
      {
        type: 'user',
        uuid: 'msg-001',
        timestamp: '2025-12-01T10:00:00.000Z',
        version: '2.0.55',
        gitBranch: 'main',
        sessionId: 'session-001',
      },
      {
        type: 'assistant',
        uuid: 'msg-002',
        timestamp: '2025-12-01T10:01:00.000Z',
      },
    ];

    const metadata = extractMetadata(entries);

    expect(metadata.summary).toBe('Test session');
    expect(metadata.version).toBe('2.0.55');
    expect(metadata.gitBranch).toBe('main');
    expect(metadata.sessionId).toBe('session-001');
    expect(metadata.messageCount).toBe(2);
    expect(metadata.firstTimestamp).toEqual(new Date('2025-12-01T10:00:00.000Z'));
    expect(metadata.lastTimestamp).toEqual(new Date('2025-12-01T10:01:00.000Z'));
  });

  it('should extract agentId from agent entries', () => {
    const entries = [
      {
        type: 'user',
        uuid: 'msg-001',
        timestamp: '2025-12-01T10:00:00.000Z',
        agentId: 'abc1234',
      },
    ];

    const metadata = extractMetadata(entries);
    expect(metadata.agentId).toBe('abc1234');
  });

  it('should count progress entries as displayable transcript messages', () => {
    const entries = [
      { type: 'summary', summary: 'Progress session', leafUuid: 'msg-003' },
      {
        type: 'user',
        uuid: 'msg-001',
        timestamp: '2026-04-01T00:00:00.000Z',
      },
      {
        type: 'progress',
        uuid: 'msg-002',
        timestamp: '2026-04-01T00:00:01.000Z',
      },
      {
        type: 'assistant',
        uuid: 'msg-003',
        timestamp: '2026-04-01T00:00:02.000Z',
      },
    ];

    const metadata = extractMetadata(entries);
    expect(metadata.messageCount).toBe(3);
    expect(metadata.firstTimestamp).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(metadata.lastTimestamp).toEqual(new Date('2026-04-01T00:00:02.000Z'));
  });
});

describe('parseSessionMetadata', () => {
  it('should extract metadata from session file', async () => {
    const filePath = join(FIXTURES_DIR, 'sample-session.jsonl');
    const result = await parseSessionMetadata(filePath);

    expect(result.data.summary).toBe('Test Session: Sample conversation for testing');
    expect(result.data.version).toBe('2.0.55');
    expect(result.data.gitBranch).toBe('main');
    expect(result.data.messageCount).toBeGreaterThan(0);
    expect(result.data.firstTimestamp).not.toBe(null);
    expect(result.data.lastTimestamp).not.toBe(null);
    expect(result.warnings).toHaveLength(0);
  });

  it('should extract metadata from agent session', async () => {
    const filePath = join(FIXTURES_DIR, 'agent-session.jsonl');
    const result = await parseSessionMetadata(filePath);

    expect(result.data.agentId).toBe('abc1234');
    expect(result.data.summary).toContain('Agent');
  });

  it('should extract progress-aware metadata from the progress fixture', async () => {
    const filePath = join(FIXTURES_DIR, 'progress-session.jsonl');
    const result = await parseSessionMetadata(filePath);

    expect(result.warnings).toHaveLength(0);
    expect(result.data.summary).toBe('Progress repro');
    expect(result.data.messageCount).toBe(4);
  });
});
