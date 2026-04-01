/**
 * Integration tests for listSessions function.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { listSessions } from '../../src/lib/session.js';
import { DEFAULT_CONFIG } from '../../src/lib/config.js';
import { DataNotFoundError } from '../../src/lib/errors.js';

function createBulkSessionJson(
  sessionId: string,
  projectPath: string,
  summary: string,
  timestamp: string
): string {
  return [
    JSON.stringify({
      type: 'summary',
      summary,
      leafUuid: `${sessionId}-assistant`,
    }),
    JSON.stringify({
      type: 'user',
      uuid: `${sessionId}-user`,
      parentUuid: null,
      timestamp,
      sessionId,
      cwd: projectPath,
      gitBranch: 'main',
      version: '2.0.55',
      message: {
        role: 'user',
        content: `Prompt for ${summary}`,
      },
    }),
    JSON.stringify({
      type: 'assistant',
      uuid: `${sessionId}-assistant`,
      parentUuid: `${sessionId}-user`,
      timestamp,
      sessionId,
      message: {
        role: 'assistant',
        model: 'claude-opus-4-5-20251101',
        content: [{ type: 'text', text: `Response for ${summary}` }],
      },
    }),
  ].join('\n');
}

function createBulkSessionId(index: number): string {
  return `aaaaaaaa-bbbb-cccc-dddd-${(index + 1).toString(16).padStart(12, '0')}`;
}

describe('listSessions', () => {
  const testDataPath = join(tmpdir(), `claude-test-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  // Sample session data
  const session1 = [
    '{"type":"summary","summary":"First test session","leafUuid":"msg-002"}',
    '{"type":"user","uuid":"msg-001","parentUuid":null,"timestamp":"2025-12-01T10:00:00.000Z","sessionId":"session-001","cwd":"/test/project1","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Hello"}}',
    '{"type":"assistant","uuid":"msg-002","parentUuid":"msg-001","timestamp":"2025-12-01T10:01:00.000Z","sessionId":"session-001","message":{"role":"assistant","model":"claude-opus-4-5-20251101","content":[{"type":"text","text":"Hi!"}]}}',
  ].join('\n');

  const session2 = [
    '{"type":"summary","summary":"Second test session","leafUuid":"msg-004"}',
    '{"type":"user","uuid":"msg-003","parentUuid":null,"timestamp":"2025-12-02T10:00:00.000Z","sessionId":"session-002","cwd":"/test/project1","gitBranch":"feature","version":"2.0.55","message":{"role":"user","content":"Question"}}',
    '{"type":"assistant","uuid":"msg-004","parentUuid":"msg-003","timestamp":"2025-12-02T10:01:00.000Z","sessionId":"session-002","message":{"role":"assistant","model":"claude-opus-4-5-20251101","content":[{"type":"text","text":"Answer"}]}}',
  ].join('\n');

  const session3 = [
    '{"type":"summary","summary":"Third session in different project","leafUuid":"msg-006"}',
    '{"type":"user","uuid":"msg-005","parentUuid":null,"timestamp":"2025-12-03T10:00:00.000Z","sessionId":"session-003","cwd":"/test/project2","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Other project"}}',
    '{"type":"assistant","uuid":"msg-006","parentUuid":"msg-005","timestamp":"2025-12-03T10:01:00.000Z","sessionId":"session-003","message":{"role":"assistant","model":"claude-opus-4-5-20251101","content":[{"type":"text","text":"Response"}]}}',
  ].join('\n');

  const agentSession = [
    '{"type":"summary","summary":"Agent task","leafUuid":"agent-msg-002"}',
    '{"type":"user","uuid":"agent-msg-001","parentUuid":null,"timestamp":"2025-12-02T10:05:00.000Z","sessionId":"session-002","agentId":"abc123","cwd":"/test/project1","isSidechain":true,"message":{"role":"user","content":"Research task"}}',
    '{"type":"assistant","uuid":"agent-msg-002","parentUuid":"agent-msg-001","timestamp":"2025-12-02T10:05:30.000Z","sessionId":"session-002","agentId":"abc123","message":{"role":"assistant","model":"claude-haiku-4-5-20251001","content":[{"type":"text","text":"Results"}]}}',
  ].join('\n');

  beforeAll(async () => {
    // Create test directory structure
    const project1Dir = join(projectsPath, '-test-project1');
    const project2Dir = join(projectsPath, '-test-project2');

    await mkdir(project1Dir, { recursive: true });
    await mkdir(project2Dir, { recursive: true });

    // Create session files
    await writeFile(join(project1Dir, '11111111-1111-1111-1111-111111111111.jsonl'), session1);
    await writeFile(join(project1Dir, '22222222-2222-2222-2222-222222222222.jsonl'), session2);
    await writeFile(join(project1Dir, 'agent-abc123.jsonl'), agentSession);
    await writeFile(join(project2Dir, '33333333-3333-3333-3333-333333333333.jsonl'), session3);
  });

  afterAll(async () => {
    // Cleanup test directory
    await rm(testDataPath, { recursive: true, force: true });
  });

  it('should list all sessions', async () => {
    const result = await listSessions({ dataPath: testDataPath });

    expect(result.data.length).toBe(3);
    expect(result.pagination.total).toBe(3);

    // All sessions should be returned
    const ids = result.data.map((s) => s.id);
    expect(ids).toContain('11111111-1111-1111-1111-111111111111');
    expect(ids).toContain('22222222-2222-2222-2222-222222222222');
    expect(ids).toContain('33333333-3333-3333-3333-333333333333');
  });

  it('should exclude agent sessions from main list', async () => {
    const result = await listSessions({ dataPath: testDataPath });

    // Should not include agent sessions
    const hasAgentSession = result.data.some((s) => s.id.startsWith('agent-'));
    expect(hasAgentSession).toBe(false);
  });

  it('should include session summaries', async () => {
    const result = await listSessions({ dataPath: testDataPath });

    const summaries = result.data.map((s) => s.summary);
    expect(summaries).toContain('First test session');
    expect(summaries).toContain('Second test session');
    expect(summaries).toContain('Third session in different project');
  });

  it('should filter by workspace', async () => {
    const result = await listSessions({
      dataPath: testDataPath,
      workspace: '/test/project1',
    });

    expect(result.data.length).toBe(2);
    expect(result.pagination.total).toBe(2);

    // All sessions should be from project1
    for (const session of result.data) {
      expect(session.projectPath).toBe('/test/project1');
    }
  });

  it('should apply pagination limit', async () => {
    const result = await listSessions({ dataPath: testDataPath, limit: 2 });

    expect(result.data.length).toBe(2);
    expect(result.pagination.total).toBe(3);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.hasMore).toBe(true);
  });

  it('should apply pagination offset', async () => {
    const allResult = await listSessions({ dataPath: testDataPath });
    const offsetResult = await listSessions({
      dataPath: testDataPath,
      limit: 2,
      offset: 1,
    });

    expect(offsetResult.data.length).toBe(2);
    expect(offsetResult.data[0].id).toBe(allResult.data[1].id);
  });

  it('should include message count', async () => {
    const result = await listSessions({ dataPath: testDataPath });

    for (const session of result.data) {
      expect(session.messageCount).toBeGreaterThan(0);
    }
  });

  it('should throw DataNotFoundError for non-existent data path', async () => {
    await expect(listSessions({ dataPath: '/non/existent/path' })).rejects.toThrow(
      DataNotFoundError
    );
  });

  it('should return empty list when no sessions exist', async () => {
    const emptyPath = join(tmpdir(), `claude-empty-${Date.now()}`);
    await mkdir(emptyPath, { recursive: true });

    const result = await listSessions({ dataPath: emptyPath });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);

    await rm(emptyPath, { recursive: true, force: true });
  });
});

describe('listSessions unlimited behavior', () => {
  const originalDefaultDataPath = DEFAULT_CONFIG.dataPath;
  const testDataPath = join(tmpdir(), `claude-list-unlimited-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');
  const totalSessions = 94;

  beforeAll(async () => {
    DEFAULT_CONFIG.dataPath = testDataPath;

    const projectDir = join(projectsPath, '-test-large-project');
    await mkdir(projectDir, { recursive: true });

    const writes: Promise<void>[] = [];
    for (let i = 0; i < totalSessions; i++) {
      const sessionId = createBulkSessionId(i);
      const timestamp = new Date(Date.UTC(2025, 0, 1, 0, i, 0)).toISOString();
      writes.push(
        writeFile(
          join(projectDir, `${sessionId}.jsonl`),
          createBulkSessionJson(sessionId, '/test/large-project', `Bulk session ${i}`, timestamp)
        )
      );
    }

    await Promise.all(writes);
  });

  afterAll(async () => {
    DEFAULT_CONFIG.dataPath = originalDefaultDataPath;
    await rm(testDataPath, { recursive: true, force: true });
  });

  it('should return all sessions when no config is provided on a 94-session fixture', async () => {
    const result = await listSessions();

    expect(result.data).toHaveLength(totalSessions);
    expect(result.pagination.total).toBe(totalSessions);
    expect(result.pagination.limit).toBe(totalSessions);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('should return all sessions when an empty config object is provided on a 94-session fixture', async () => {
    const result = await listSessions({});

    expect(result.data).toHaveLength(totalSessions);
    expect(result.pagination.total).toBe(totalSessions);
    expect(result.pagination.limit).toBe(totalSessions);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('should treat explicit undefined limit the same as omitted limit on a 94-session fixture', async () => {
    const result = await listSessions({ limit: undefined });

    expect(result.data).toHaveLength(totalSessions);
    expect(result.pagination.total).toBe(totalSessions);
    expect(result.pagination.limit).toBe(totalSessions);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('should return all sessions from the offset onward when only offset is provided', async () => {
    const allSessions = await listSessions();
    const result = await listSessions({ offset: 10 });

    expect(result.data).toHaveLength(totalSessions - 10);
    expect(result.pagination.total).toBe(totalSessions);
    expect(result.pagination.limit).toBe(totalSessions - 10);
    expect(result.pagination.offset).toBe(10);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.data[0]?.id).toBe(allSessions.data[10]?.id);
  });

  it('should continue to respect an explicit limit on a 94-session fixture', async () => {
    const result = await listSessions({ limit: 20 });

    expect(result.data).toHaveLength(20);
    expect(result.pagination.total).toBe(totalSessions);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.hasMore).toBe(true);
  });

  it('should continue to respect an explicit limit with offset near the end of a 94-session fixture', async () => {
    const result = await listSessions({ limit: 20, offset: 80 });

    expect(result.data).toHaveLength(14);
    expect(result.pagination.total).toBe(totalSessions);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.offset).toBe(80);
    expect(result.pagination.hasMore).toBe(false);
  });

  it('should return an empty result when offset exceeds total and no limit is provided', async () => {
    const result = await listSessions({ offset: 200 });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(totalSessions);
    expect(result.pagination.limit).toBe(0);
    expect(result.pagination.offset).toBe(200);
    expect(result.pagination.hasMore).toBe(false);
  });
});
