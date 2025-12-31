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

  it('should return null for unknown entry type', () => {
    const entry = {
      type: 'unknown-type',
      uuid: 'test',
    };

    const result = transformEntry(entry);
    expect(result).toBe(null);
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
});
