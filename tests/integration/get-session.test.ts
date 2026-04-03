/**
 * Integration tests for getSession function.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getSession, getAgentSession } from '../../src/lib/session.js';
import {
  AmbiguousAgentSessionError,
  SessionNotFoundError,
  DataNotFoundError,
} from '../../src/lib/errors.js';
import {
  createTempClaudeData,
  cleanupTempClaudeData,
  readFixture,
  writeProjectSessionFile,
} from '../helpers/agent-linking.js';

const LONG_TEXT = `Long plain text ${'x'.repeat(1200)} 终`;
const LONG_TOOL_RESULT = ['line-1', `tool-result ${'y'.repeat(1200)}...source`, 'line-3'].join(
  '\n'
);
const LONG_THINKING_TEXT = `reasoning ${'z'.repeat(1200)}`;
const LONG_TOOL_INPUT = {
  file_path: '/test/project/long-file.txt',
  old_string: `old ${'a'.repeat(1200)}\n下一行`,
  new_string: `new ${'b'.repeat(1200)}...source`,
};

function createLongContentSessionJson(sessionId: string): string {
  return [
    JSON.stringify({
      type: 'summary',
      summary: 'Long content fixture',
      leafUuid: `${sessionId}-tool-result`,
    }),
    JSON.stringify({
      type: 'user',
      uuid: `${sessionId}-user`,
      parentUuid: null,
      timestamp: '2026-04-03T10:00:00.000Z',
      sessionId,
      cwd: '/test/project',
      gitBranch: 'main',
      version: '2.0.55',
      message: {
        role: 'user',
        content: LONG_TEXT,
      },
    }),
    JSON.stringify({
      type: 'assistant',
      uuid: `${sessionId}-assistant`,
      parentUuid: `${sessionId}-user`,
      timestamp: '2026-04-03T10:00:01.000Z',
      sessionId,
      message: {
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: LONG_THINKING_TEXT },
          { type: 'text', text: LONG_TEXT },
          {
            type: 'tool_use',
            id: `${sessionId}-tool`,
            name: 'Edit',
            input: LONG_TOOL_INPUT,
          },
        ],
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    }),
    JSON.stringify({
      type: 'user',
      uuid: `${sessionId}-tool-result`,
      parentUuid: `${sessionId}-assistant`,
      timestamp: '2026-04-03T10:00:02.000Z',
      sessionId,
      cwd: '/test/project',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: `${sessionId}-tool`,
            content: LONG_TOOL_RESULT,
          },
        ],
      },
    }),
  ].join('\n');
}

describe('getSession', () => {
  const testDataPath = join(tmpdir(), `claude-get-test-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  const session1 = [
    '{"type":"summary","summary":"Test session with tool calls","leafUuid":"msg-004"}',
    '{"type":"user","uuid":"msg-001","parentUuid":null,"timestamp":"2025-12-01T10:00:00.000Z","sessionId":"session-001","cwd":"/test/project","gitBranch":"main","version":"2.0.55","userType":"external","isSidechain":false,"message":{"role":"user","content":"Read my file"}}',
    '{"type":"assistant","uuid":"msg-002","parentUuid":"msg-001","timestamp":"2025-12-01T10:00:15.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"tool_use","id":"toolu_001","name":"Read","input":{"file_path":"/test/project/file.ts"}}],"stop_reason":"tool_use","usage":{"input_tokens":50,"output_tokens":25,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    '{"type":"user","uuid":"msg-003","parentUuid":"msg-002","timestamp":"2025-12-01T10:00:16.000Z","sessionId":"session-001","cwd":"/test/project","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_001","content":"file contents here"}]}}',
    '{"type":"assistant","uuid":"msg-004","parentUuid":"msg-003","timestamp":"2025-12-01T10:00:30.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"I can see your file contains..."}],"stop_reason":"end_turn","usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
  ].join('\n');

  const session2 = [
    '{"type":"summary","summary":"Second session","leafUuid":"msg-006"}',
    '{"type":"user","uuid":"msg-005","parentUuid":null,"timestamp":"2025-12-02T10:00:00.000Z","sessionId":"session-002","cwd":"/test/project","gitBranch":"feature","version":"2.0.55","message":{"role":"user","content":"Hello"}}',
    '{"type":"assistant","uuid":"msg-006","parentUuid":"msg-005","timestamp":"2025-12-02T10:00:15.000Z","sessionId":"session-002","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Hi there!"}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const agentSession = [
    '{"type":"summary","summary":"Agent research task","leafUuid":"agent-msg-002"}',
    '{"type":"user","uuid":"agent-msg-001","parentUuid":null,"timestamp":"2025-12-01T10:05:00.000Z","sessionId":"session-001","agentId":"xyz789","cwd":"/test/project","isSidechain":true,"message":{"role":"user","content":"Research this topic"}}',
    '{"type":"assistant","uuid":"agent-msg-002","parentUuid":"agent-msg-001","timestamp":"2025-12-01T10:05:30.000Z","sessionId":"session-001","agentId":"xyz789","message":{"model":"claude-haiku-4-5-20251001","role":"assistant","content":[{"type":"thinking","thinking":"Let me research..."},{"type":"text","text":"Here are my findings..."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const progressSession = [
    '{"type":"summary","summary":"Progress session","leafUuid":"msg-progress-003"}',
    '{"type":"user","uuid":"msg-progress-001","parentUuid":null,"timestamp":"2026-04-01T00:00:00.000Z","sessionId":"session-004","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Start scanning"}}',
    '{"type":"progress","uuid":"msg-progress-002","parentUuid":"msg-progress-001","timestamp":"2026-04-01T00:00:01.000Z","sessionId":"session-004","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"assistant","content":[{"type":"text","text":"PROGRESS_ONLY_TOKEN found while scanning"}]}}',
    '{"type":"assistant","uuid":"msg-progress-003","parentUuid":"msg-progress-002","timestamp":"2026-04-01T00:00:02.000Z","sessionId":"session-004","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Scan complete"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
  ].join('\n');

  const sessionUuid1 = '11111111-1111-1111-1111-111111111111';
  const sessionUuid2 = '22222222-2222-2222-2222-222222222222';
  const sessionUuid3 = '33333333-3333-3333-3333-333333333333';
  const sessionUuid4 = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-project');
    await mkdir(projectDir, { recursive: true });

    await writeFile(join(projectDir, `${sessionUuid1}.jsonl`), session1);
    await writeFile(join(projectDir, `${sessionUuid2}.jsonl`), session2);
    await writeFile(join(projectDir, `${sessionUuid3}.jsonl`), progressSession);
    await writeFile(
      join(projectDir, `${sessionUuid4}.jsonl`),
      createLongContentSessionJson(sessionUuid4)
    );
    await writeFile(join(projectDir, 'agent-xyz789.jsonl'), agentSession);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  describe('by index', () => {
    it('should get a session with index 0', async () => {
      const session = await getSession(0, { dataPath: testDataPath });

      // Should return one of the sessions (order depends on file mtime)
      expect([sessionUuid1, sessionUuid2, sessionUuid3, sessionUuid4]).toContain(session.id);
      expect(session.summary).toBeDefined();
    });

    it('should get a different session with index 1', async () => {
      const session0 = await getSession(0, { dataPath: testDataPath });
      const session1 = await getSession(1, { dataPath: testDataPath });

      // Should return different sessions
      expect(session0.id).not.toBe(session1.id);
      expect([sessionUuid1, sessionUuid2, sessionUuid3, sessionUuid4]).toContain(session1.id);
    });

    it('should throw SessionNotFoundError for out-of-bounds index', async () => {
      await expect(getSession(99, { dataPath: testDataPath })).rejects.toThrow(
        SessionNotFoundError
      );
    });

    it('should throw SessionNotFoundError for negative index', async () => {
      await expect(getSession(-1, { dataPath: testDataPath })).rejects.toThrow(
        SessionNotFoundError
      );
    });
  });

  describe('by UUID', () => {
    it('should get session by full UUID', async () => {
      const session = await getSession(sessionUuid1, { dataPath: testDataPath });

      expect(session.id).toBe(sessionUuid1);
      expect(session.summary).toBe('Test session with tool calls');
    });

    it('should get session by partial UUID prefix', async () => {
      const session = await getSession('11111111', { dataPath: testDataPath });

      expect(session.id).toBe(sessionUuid1);
    });

    it('should throw SessionNotFoundError for non-existent UUID', async () => {
      await expect(
        getSession('99999999-9999-9999-9999-999999999999', { dataPath: testDataPath })
      ).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('session content', () => {
    it('should include all messages', async () => {
      const session = await getSession(sessionUuid1, { dataPath: testDataPath });

      expect(session.messages.length).toBeGreaterThan(0);

      // Should have summary, user, and assistant messages
      const types = session.messages.map((m) => m.type);
      expect(types).toContain('summary');
      expect(types).toContain('user');
      expect(types).toContain('assistant');
    });

    it('should include message count', async () => {
      const session = await getSession(sessionUuid1, { dataPath: testDataPath });

      // messageCount should only count user/assistant, not summary
      expect(session.messageCount).toBe(4); // 2 user + 2 assistant
    });

    it('should preserve progress messages in the session transcript and counts', async () => {
      const session = await getSession(sessionUuid3, { dataPath: testDataPath });

      const progressMessages = session.messages.filter((message) => message.type === 'progress');
      expect(progressMessages).toHaveLength(1);
      expect(session.messageCount).toBe(3);
      expect(session.lastActivityAt).toEqual(new Date('2026-04-01T00:00:02.000Z'));
      if (progressMessages[0]?.type === 'progress') {
        expect(progressMessages[0].cwd).toBe('/test/project');
        expect(progressMessages[0].gitBranch).toBe('main');
        expect(progressMessages[0].parentUuid).toBe('msg-progress-001');
      }
    });

    it('should include project path', async () => {
      const session = await getSession(0, { dataPath: testDataPath });

      expect(session.projectPath).toBe('/test/project');
    });

    it('should include encoded path', async () => {
      const session = await getSession(0, { dataPath: testDataPath });

      expect(session.encodedPath).toBe('-test-project');
    });

    it('should parse tool use content', async () => {
      const session = await getSession(sessionUuid1, { dataPath: testDataPath });

      const assistantMessages = session.messages.filter((m) => m.type === 'assistant');
      const toolUseMessage = assistantMessages.find(
        (m) => m.type === 'assistant' && m.content.some((c) => c.type === 'tool_use')
      );

      expect(toolUseMessage).toBeDefined();
      if (toolUseMessage && toolUseMessage.type === 'assistant') {
        const toolUse = toolUseMessage.content.find((c) => c.type === 'tool_use');
        expect(toolUse).toBeDefined();
        if (toolUse && toolUse.type === 'tool_use') {
          expect(toolUse.name).toBe('Read');
          expect(toolUse.input).toHaveProperty('file_path');
        }
      }
    });

    it('should parse tool result content', async () => {
      const session = await getSession(sessionUuid1, { dataPath: testDataPath });

      const userMessages = session.messages.filter((m) => m.type === 'user');
      const toolResultMessage = userMessages.find(
        (m) => m.type === 'user' && Array.isArray(m.content)
      );

      expect(toolResultMessage).toBeDefined();
      if (toolResultMessage && toolResultMessage.type === 'user') {
        expect(Array.isArray(toolResultMessage.content)).toBe(true);
        const content = toolResultMessage.content as { type: string }[];
        expect(content[0].type).toBe('tool_result');
      }
    });

    it('should preserve long user text, assistant text, thinking, tool input, tool results, and edge-case values', async () => {
      const session = await getSession(sessionUuid4, { dataPath: testDataPath });

      expect(session.summary).toBe('Long content fixture');
      expect(session.messages).toHaveLength(4);
      expect(session.messageCount).toBe(3);

      const userMessage = session.messages.find(
        (message) => message.uuid === `${sessionUuid4}-user`
      );
      expect(userMessage?.type).toBe('user');
      if (userMessage?.type === 'user') {
        expect(userMessage.content).toBe(LONG_TEXT);
      }

      const assistantMessage = session.messages.find(
        (message) => message.uuid === `${sessionUuid4}-assistant`
      );
      expect(assistantMessage?.type).toBe('assistant');
      if (assistantMessage?.type === 'assistant') {
        expect(assistantMessage.content).toHaveLength(3);
        expect(assistantMessage.content[0]).toEqual({
          type: 'thinking',
          thinking: LONG_THINKING_TEXT,
        });
        expect(assistantMessage.content[1]).toEqual({
          type: 'text',
          text: LONG_TEXT,
        });
        expect(assistantMessage.content[2]).toEqual({
          type: 'tool_use',
          id: `${sessionUuid4}-tool`,
          name: 'Edit',
          input: LONG_TOOL_INPUT,
        });
      }

      const toolResultMessage = session.messages.find(
        (message) => message.uuid === `${sessionUuid4}-tool-result`
      );
      expect(toolResultMessage?.type).toBe('user');
      if (toolResultMessage?.type === 'user') {
        expect(toolResultMessage.content).toEqual([
          {
            type: 'tool_result',
            tool_use_id: `${sessionUuid4}-tool`,
            content: LONG_TOOL_RESULT,
          },
        ]);
      }
    });
  });

  describe('error handling', () => {
    it('should throw DataNotFoundError for non-existent data path', async () => {
      await expect(getSession(0, { dataPath: '/non/existent/path' })).rejects.toThrow(
        DataNotFoundError
      );
    });
  });
});

describe('getAgentSession', () => {
  const testDataPath = join(tmpdir(), `claude-agent-test-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  const longAgentSessionId = 'long789';

  const agentSession = [
    '{"type":"summary","summary":"Agent research task","leafUuid":"agent-msg-002"}',
    '{"type":"user","uuid":"agent-msg-001","parentUuid":null,"timestamp":"2025-12-01T10:05:00.000Z","sessionId":"session-001","agentId":"abc123","cwd":"/test/project","isSidechain":true,"message":{"role":"user","content":"Research this topic"}}',
    '{"type":"assistant","uuid":"agent-msg-002","parentUuid":"agent-msg-001","timestamp":"2025-12-01T10:05:30.000Z","sessionId":"session-001","agentId":"abc123","message":{"model":"claude-haiku-4-5-20251001","role":"assistant","content":[{"type":"thinking","thinking":"Let me research..."},{"type":"text","text":"Here are my findings..."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const longAgentSession = [
    '{"type":"summary","summary":"Long agent task","leafUuid":"long-agent-msg-003"}',
    JSON.stringify({
      type: 'user',
      uuid: 'long-agent-msg-001',
      parentUuid: null,
      timestamp: '2026-04-03T10:05:00.000Z',
      sessionId: 'session-long-agent',
      agentId: longAgentSessionId,
      cwd: '/test/project',
      isSidechain: true,
      message: {
        role: 'user',
        content: LONG_TEXT,
      },
    }),
    JSON.stringify({
      type: 'assistant',
      uuid: 'long-agent-msg-002',
      parentUuid: 'long-agent-msg-001',
      timestamp: '2026-04-03T10:05:30.000Z',
      sessionId: 'session-long-agent',
      agentId: longAgentSessionId,
      message: {
        model: 'claude-haiku-4-5-20251001',
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: LONG_THINKING_TEXT },
          { type: 'text', text: LONG_TEXT },
          {
            type: 'tool_use',
            id: 'tool-long-agent',
            name: 'Edit',
            input: LONG_TOOL_INPUT,
          },
        ],
        stop_reason: 'tool_use',
      },
    }),
    JSON.stringify({
      type: 'user',
      uuid: 'long-agent-msg-003',
      parentUuid: 'long-agent-msg-002',
      timestamp: '2026-04-03T10:05:45.000Z',
      sessionId: 'session-long-agent',
      agentId: longAgentSessionId,
      cwd: '/test/project',
      isSidechain: true,
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-long-agent',
            content: LONG_TOOL_RESULT,
          },
        ],
      },
    }),
  ].join('\n');

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-project');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'agent-abc123.jsonl'), agentSession);
    await writeFile(join(projectDir, `agent-${longAgentSessionId}.jsonl`), longAgentSession);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  it('should get agent session by ID', async () => {
    const session = await getAgentSession('abc123', { dataPath: testDataPath });

    expect(session.id).toBe('agent-abc123');
    expect(session.summary).toBe('Agent research task');
  });

  it('should get agent session with agent- prefix', async () => {
    const session = await getAgentSession('agent-abc123', { dataPath: testDataPath });

    expect(session.id).toBe('agent-abc123');
  });

  it('should include thinking content', async () => {
    const session = await getAgentSession('abc123', { dataPath: testDataPath });

    const assistantMessages = session.messages.filter((m) => m.type === 'assistant');
    const hasThinking = assistantMessages.some(
      (m) => m.type === 'assistant' && m.content.some((c) => c.type === 'thinking')
    );

    expect(hasThinking).toBe(true);
  });

  it('should preserve long agent message text, thinking, tool input, and tool result content', async () => {
    const session = await getAgentSession(longAgentSessionId, { dataPath: testDataPath });

    expect(session.summary).toBe('Long agent task');
    expect(session.messages).toHaveLength(4);

    const userMessage = session.messages.find((message) => message.uuid === 'long-agent-msg-001');
    expect(userMessage?.type).toBe('user');
    if (userMessage?.type === 'user') {
      expect(userMessage.content).toBe(LONG_TEXT);
    }

    const assistantMessage = session.messages.find(
      (message) => message.uuid === 'long-agent-msg-002'
    );
    expect(assistantMessage?.type).toBe('assistant');
    if (assistantMessage?.type === 'assistant') {
      expect(assistantMessage.content[0]).toEqual({
        type: 'thinking',
        thinking: LONG_THINKING_TEXT,
      });
      expect(assistantMessage.content[1]).toEqual({
        type: 'text',
        text: LONG_TEXT,
      });
      expect(assistantMessage.content[2]).toEqual({
        type: 'tool_use',
        id: 'tool-long-agent',
        name: 'Edit',
        input: LONG_TOOL_INPUT,
      });
    }

    const toolResultMessage = session.messages.find(
      (message) => message.uuid === 'long-agent-msg-003'
    );
    expect(toolResultMessage?.type).toBe('user');
    if (toolResultMessage?.type === 'user') {
      expect(toolResultMessage.content).toEqual([
        {
          type: 'tool_result',
          tool_use_id: 'tool-long-agent',
          content: LONG_TOOL_RESULT,
        },
      ]);
    }
  });

  it('should throw SessionNotFoundError for non-existent agent', async () => {
    await expect(getAgentSession('nonexistent', { dataPath: testDataPath })).rejects.toThrow(
      SessionNotFoundError
    );
  });
});

describe('nested agent linking scenarios', () => {
  let testDataPath = '';
  const encodedProjectPath = '-tmp-agent-linking';

  beforeAll(async () => {
    const tempData = await createTempClaudeData('claude-agent-linking-');
    testDataPath = tempData.dataPath;

    const nestedMain = await readFixture('nested-main-session.jsonl');
    const nestedAgent = await readFixture('nested-agent-session.jsonl');
    const nestedConflictAgent = await readFixture('nested-agent-conflict-session.jsonl');

    await writeProjectSessionFile(
      tempData.projectsPath,
      encodedProjectPath,
      '11111111-1111-1111-1111-111111111111.jsonl',
      nestedMain
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      encodedProjectPath,
      '11111111-1111-1111-1111-111111111111/subagents/agent-linked123.jsonl',
      nestedAgent
    );

    const fallbackMain = [
      '{"type":"summary","summary":"Fallback-only parent","leafUuid":"fallback-msg-002"}',
      '{"type":"user","uuid":"fallback-msg-001","parentUuid":null,"timestamp":"2026-04-02T12:00:00.000Z","sessionId":"22222222-2222-2222-2222-222222222222","cwd":"/tmp/agent-linking","gitBranch":"main","version":"2.0.55","isSidechain":false,"message":{"role":"user","content":"Fallback-only session"}}',
      '{"type":"assistant","uuid":"fallback-msg-002","parentUuid":"fallback-msg-001","timestamp":"2026-04-02T12:00:10.000Z","sessionId":"22222222-2222-2222-2222-222222222222","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"No explicit agent reference here."}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":12,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    ].join('\n');

    const fallbackAgent = [
      '{"type":"summary","summary":"Fallback nested agent","leafUuid":"fallback-agent-002"}',
      '{"type":"user","uuid":"fallback-agent-001","parentUuid":null,"timestamp":"2026-04-02T12:00:11.000Z","sessionId":"22222222-2222-2222-2222-222222222222","agentId":"fallback789","cwd":"/tmp/agent-linking","gitBranch":"main","version":"2.0.55","isSidechain":true,"message":{"role":"user","content":"Fallback nested agent"}}',
      '{"type":"assistant","uuid":"fallback-agent-002","parentUuid":"fallback-agent-001","timestamp":"2026-04-02T12:00:20.000Z","sessionId":"22222222-2222-2222-2222-222222222222","agentId":"fallback789","message":{"model":"claude-haiku-4-5-20251001","role":"assistant","content":[{"type":"text","text":"Fallback linked agent."}],"stop_reason":"end_turn","usage":{"input_tokens":5,"output_tokens":6,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    ].join('\n');

    const explicitConflictMain = [
      '{"type":"summary","summary":"Explicit conflict parent","leafUuid":"conflict-main-002"}',
      '{"type":"assistant","uuid":"conflict-main-001","parentUuid":null,"timestamp":"2026-04-02T13:00:00.000Z","sessionId":"33333333-3333-3333-3333-333333333333","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"tool_use","id":"toolu_conflict","name":"Agent","input":{"description":"Conflict agent","prompt":"Conflict agent","subagent_type":"Explore"}}],"stop_reason":"tool_use","usage":{"input_tokens":20,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
      '{"type":"user","uuid":"conflict-main-002","parentUuid":"conflict-main-001","timestamp":"2026-04-02T13:00:05.000Z","sessionId":"33333333-3333-3333-3333-333333333333","cwd":"/tmp/agent-linking","gitBranch":"main","isSidechain":false,"message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_conflict","content":"Explicit conflict agent."}]},"toolUseResult":{"status":"completed","agentId":"conflict999","content":[{"type":"text","text":"Explicit conflict agent."}]}}',
    ].join('\n');

    const conflictingNestedOwnerMain = [
      '{"type":"summary","summary":"Nested owner without explicit reference","leafUuid":"conflict-owner-002"}',
      '{"type":"user","uuid":"conflict-owner-001","parentUuid":null,"timestamp":"2026-04-02T13:00:10.000Z","sessionId":"44444444-4444-4444-4444-444444444444","cwd":"/tmp/agent-linking","gitBranch":"main","version":"2.0.55","isSidechain":false,"message":{"role":"user","content":"Owner by path only"}}',
      '{"type":"assistant","uuid":"conflict-owner-002","parentUuid":"conflict-owner-001","timestamp":"2026-04-02T13:00:20.000Z","sessionId":"44444444-4444-4444-4444-444444444444","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Path-only owner."}],"stop_reason":"end_turn","usage":{"input_tokens":8,"output_tokens":10,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    ].join('\n');

    await writeProjectSessionFile(
      tempData.projectsPath,
      encodedProjectPath,
      '22222222-2222-2222-2222-222222222222.jsonl',
      fallbackMain
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      encodedProjectPath,
      '22222222-2222-2222-2222-222222222222/subagents/agent-fallback789.jsonl',
      fallbackAgent
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      encodedProjectPath,
      '33333333-3333-3333-3333-333333333333.jsonl',
      explicitConflictMain
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      encodedProjectPath,
      '44444444-4444-4444-4444-444444444444.jsonl',
      conflictingNestedOwnerMain
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      encodedProjectPath,
      '44444444-4444-4444-4444-444444444444/subagents/agent-conflict999.jsonl',
      nestedConflictAgent.replaceAll(
        '22222222-2222-2222-2222-222222222222',
        '44444444-4444-4444-4444-444444444444'
      )
    );

    const duplicateProjectA = '-tmp-duplicate-a';
    const duplicateProjectB = '-tmp-duplicate-b';
    const duplicateMainA = [
      '{"type":"summary","summary":"Duplicate parent A","leafUuid":"dup-a-002"}',
      '{"type":"user","uuid":"dup-a-001","parentUuid":null,"timestamp":"2026-04-02T14:00:00.000Z","sessionId":"55555555-5555-5555-5555-555555555555","cwd":"/tmp/duplicate-a","gitBranch":"main","version":"2.0.55","isSidechain":false,"message":{"role":"user","content":"Duplicate A"}}',
      '{"type":"assistant","uuid":"dup-a-002","parentUuid":"dup-a-001","timestamp":"2026-04-02T14:00:05.000Z","sessionId":"55555555-5555-5555-5555-555555555555","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Duplicate A done."}],"stop_reason":"end_turn","usage":{"input_tokens":4,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    ].join('\n');
    const duplicateMainB = duplicateMainA
      .replaceAll('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666')
      .replaceAll('/tmp/duplicate-a', '/tmp/duplicate-b')
      .replaceAll('Duplicate A', 'Duplicate B');
    const duplicateAgent = (sessionId: string, projectPath: string): string =>
      [
        '{"type":"summary","summary":"Duplicate agent session","leafUuid":"dup-agent-002"}',
        `{"type":"user","uuid":"dup-agent-001","parentUuid":null,"timestamp":"2026-04-02T14:00:06.000Z","sessionId":"${sessionId}","agentId":"duplicate777","cwd":"${projectPath}","gitBranch":"main","version":"2.0.55","isSidechain":true,"message":{"role":"user","content":"Duplicate agent"}}`,
        `{"type":"assistant","uuid":"dup-agent-002","parentUuid":"dup-agent-001","timestamp":"2026-04-02T14:00:10.000Z","sessionId":"${sessionId}","agentId":"duplicate777","message":{"model":"claude-haiku-4-5-20251001","role":"assistant","content":[{"type":"text","text":"Duplicate agent response"}],"stop_reason":"end_turn","usage":{"input_tokens":2,"output_tokens":3,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}`,
      ].join('\n');

    await writeProjectSessionFile(
      tempData.projectsPath,
      duplicateProjectA,
      '55555555-5555-5555-5555-555555555555.jsonl',
      duplicateMainA
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      duplicateProjectA,
      '55555555-5555-5555-5555-555555555555/subagents/agent-duplicate777.jsonl',
      duplicateAgent('55555555-5555-5555-5555-555555555555', '/tmp/duplicate-a')
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      duplicateProjectB,
      '66666666-6666-6666-6666-666666666666.jsonl',
      duplicateMainB
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      duplicateProjectB,
      '66666666-6666-6666-6666-666666666666/subagents/agent-duplicate777.jsonl',
      duplicateAgent('66666666-6666-6666-6666-666666666666', '/tmp/duplicate-b')
    );
  });

  afterAll(async () => {
    await cleanupTempClaudeData(testDataPath);
  });

  it('should return discoverable and unresolved agent IDs separately', async () => {
    const session = await getSession('11111111-1111-1111-1111-111111111111', {
      dataPath: testDataPath,
    });

    expect(session.agentIds).toEqual(['linked123']);
    expect(session.unresolvedAgentIds).toEqual(['missing456']);
  });

  it('should fall back to nested ownership when explicit agent references are missing', async () => {
    const session = await getSession('22222222-2222-2222-2222-222222222222', {
      dataPath: testDataPath,
    });

    expect(session.agentIds).toEqual(['fallback789']);
    expect(session.unresolvedAgentIds).toEqual([]);
  });

  it('should prefer explicit references over conflicting nested ownership', async () => {
    const explicitSession = await getSession('33333333-3333-3333-3333-333333333333', {
      dataPath: testDataPath,
    });
    const nestedOwnerSession = await getSession('44444444-4444-4444-4444-444444444444', {
      dataPath: testDataPath,
    });

    expect(explicitSession.agentIds).toContain('conflict999');
    expect(nestedOwnerSession.agentIds).not.toContain('conflict999');
  });

  it('should resolve direct agent lookup from bare and prefixed IDs', async () => {
    const bareLookup = await getSession('linked123', { dataPath: testDataPath });
    const prefixedLookup = await getAgentSession('agent-linked123', { dataPath: testDataPath });

    expect(bareLookup.id).toBe('agent-linked123');
    expect(prefixedLookup.id).toBe('agent-linked123');
  });

  it('should report missing direct agent lookups as not found', async () => {
    await expect(getSession('missing456', { dataPath: testDataPath })).rejects.toThrow(
      SessionNotFoundError
    );
  });

  it('should report duplicate bare agent lookups as ambiguous', async () => {
    await expect(getSession('duplicate777', { dataPath: testDataPath })).rejects.toThrow(
      AmbiguousAgentSessionError
    );
  });
});
