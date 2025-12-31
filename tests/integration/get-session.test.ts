/**
 * Integration tests for getSession function.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getSession, getAgentSession } from '../../src/lib/session.js';
import { SessionNotFoundError, DataNotFoundError } from '../../src/lib/errors.js';

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

  const sessionUuid1 = '11111111-1111-1111-1111-111111111111';
  const sessionUuid2 = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-project');
    await mkdir(projectDir, { recursive: true });

    await writeFile(join(projectDir, `${sessionUuid1}.jsonl`), session1);
    await writeFile(join(projectDir, `${sessionUuid2}.jsonl`), session2);
    await writeFile(join(projectDir, 'agent-xyz789.jsonl'), agentSession);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  describe('by index', () => {
    it('should get a session with index 0', async () => {
      const session = await getSession(0, { dataPath: testDataPath });

      // Should return one of the sessions (order depends on file mtime)
      expect([sessionUuid1, sessionUuid2]).toContain(session.id);
      expect(session.summary).toBeDefined();
    });

    it('should get a different session with index 1', async () => {
      const session0 = await getSession(0, { dataPath: testDataPath });
      const session1 = await getSession(1, { dataPath: testDataPath });

      // Should return different sessions
      expect(session0.id).not.toBe(session1.id);
      expect([sessionUuid1, sessionUuid2]).toContain(session1.id);
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

  const agentSession = [
    '{"type":"summary","summary":"Agent research task","leafUuid":"agent-msg-002"}',
    '{"type":"user","uuid":"agent-msg-001","parentUuid":null,"timestamp":"2025-12-01T10:05:00.000Z","sessionId":"session-001","agentId":"abc123","cwd":"/test/project","isSidechain":true,"message":{"role":"user","content":"Research this topic"}}',
    '{"type":"assistant","uuid":"agent-msg-002","parentUuid":"agent-msg-001","timestamp":"2025-12-01T10:05:30.000Z","sessionId":"session-001","agentId":"abc123","message":{"model":"claude-haiku-4-5-20251001","role":"assistant","content":[{"type":"thinking","thinking":"Let me research..."},{"type":"text","text":"Here are my findings..."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-project');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'agent-abc123.jsonl'), agentSession);
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

  it('should throw SessionNotFoundError for non-existent agent', async () => {
    await expect(getAgentSession('nonexistent', { dataPath: testDataPath })).rejects.toThrow(
      SessionNotFoundError
    );
  });
});
