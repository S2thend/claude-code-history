/**
 * Integration tests for export functions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  exportSessionToJson,
  exportSessionToMarkdown,
  exportAllSessionsToJson,
  exportAllSessionsToMarkdown,
  exportSession,
  exportAllSessions,
} from '../../src/lib/export.js';

function createLargeExportSessionId(index: number): string {
  return `cccccccc-dddd-eeee-ffff-${(index + 1).toString(16).padStart(12, '0')}`;
}

function createLargeExportSessionJson(
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
        model: 'claude-opus-4-5-20251101',
        role: 'assistant',
        content: [{ type: 'text', text: `Response for ${summary}` }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    }),
  ].join('\n');
}

describe('export functions', () => {
  const testDataPath = join(tmpdir(), `claude-export-test-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  const session1 = [
    '{"type":"summary","summary":"TypeScript discussion","leafUuid":"msg-004"}',
    '{"type":"user","uuid":"msg-001","parentUuid":null,"timestamp":"2025-12-01T10:00:00.000Z","sessionId":"session-001","cwd":"/test/project","gitBranch":"main","version":"2.0.55","userType":"external","isSidechain":false,"message":{"role":"user","content":"How do I use generics?"}}',
    '{"type":"assistant","uuid":"msg-002","parentUuid":"msg-001","timestamp":"2025-12-01T10:00:15.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Generics allow reusable components.\\n\\nExample:\\n```typescript\\nfunction identity<T>(arg: T): T {\\n  return arg;\\n}\\n```"}],"stop_reason":"end_turn","usage":{"input_tokens":50,"output_tokens":30,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
    '{"type":"user","uuid":"msg-003","parentUuid":"msg-002","timestamp":"2025-12-01T10:01:00.000Z","sessionId":"session-001","cwd":"/test/project","message":{"role":"user","content":"Can you read my file?"}}',
    '{"type":"assistant","uuid":"msg-004","parentUuid":"msg-003","timestamp":"2025-12-01T10:01:15.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"tool_use","id":"toolu_001","name":"Read","input":{"file_path":"/test/project/file.ts"}}],"stop_reason":"tool_use"}}',
  ].join('\n');

  const session2 = [
    '{"type":"summary","summary":"Thinking example","leafUuid":"msg-006"}',
    '{"type":"user","uuid":"msg-005","parentUuid":null,"timestamp":"2025-12-02T10:00:00.000Z","sessionId":"session-002","cwd":"/test/project","gitBranch":"feature","version":"2.0.55","message":{"role":"user","content":"Complex question"}}',
    '{"type":"assistant","uuid":"msg-006","parentUuid":"msg-005","timestamp":"2025-12-02T10:00:15.000Z","sessionId":"session-002","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"thinking","thinking":"Let me think about this carefully..."},{"type":"text","text":"Here is my answer."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const sessionWithAgent = [
    '{"type":"summary","summary":"Session with agent","leafUuid":"msg-008"}',
    '{"type":"user","uuid":"msg-007","parentUuid":null,"timestamp":"2025-12-03T10:00:00.000Z","sessionId":"session-003","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Use an agent"}}',
    '{"type":"assistant","uuid":"msg-008","parentUuid":"msg-007","timestamp":"2025-12-03T10:00:15.000Z","sessionId":"session-003","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Launching agent..."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const agentSession = [
    '{"type":"summary","summary":"Agent task","leafUuid":"agent-msg-002"}',
    '{"type":"user","uuid":"agent-msg-001","parentUuid":null,"timestamp":"2025-12-03T10:00:30.000Z","sessionId":"session-003","agentId":"abc123","cwd":"/test/project","isSidechain":true,"message":{"role":"user","content":"Agent prompt"}}',
    '{"type":"assistant","uuid":"agent-msg-002","parentUuid":"agent-msg-001","timestamp":"2025-12-03T10:00:45.000Z","sessionId":"session-003","agentId":"abc123","message":{"model":"claude-haiku-4-5-20251001","role":"assistant","content":[{"type":"text","text":"Agent response"}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const progressSession = [
    '{"type":"summary","summary":"Progress export example","leafUuid":"msg-010"}',
    '{"type":"user","uuid":"msg-009","parentUuid":null,"timestamp":"2026-04-01T00:00:00.000Z","sessionId":"session-004","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Start scan"}}',
    '{"type":"progress","uuid":"msg-010","parentUuid":"msg-009","timestamp":"2026-04-01T00:00:01.000Z","sessionId":"session-004","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"assistant","content":[{"type":"text","text":"Tool is scanning project files..."}]}}',
    '{"type":"assistant","uuid":"msg-011","parentUuid":"msg-010","timestamp":"2026-04-01T00:00:02.000Z","sessionId":"session-004","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Done"}],"stop_reason":"end_turn","usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}',
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
    await writeFile(join(projectDir, `${sessionUuid3}.jsonl`), sessionWithAgent);
    await writeFile(join(projectDir, `${sessionUuid4}.jsonl`), progressSession);
    await writeFile(join(projectDir, 'agent-abc123.jsonl'), agentSession);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  describe('exportSessionToJson', () => {
    it('should export session as valid JSON', async () => {
      const json = await exportSessionToJson(0, { dataPath: testDataPath });

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include session metadata', async () => {
      const json = await exportSessionToJson(sessionUuid1, { dataPath: testDataPath });
      const session = JSON.parse(json);

      expect(session.id).toBe(sessionUuid1);
      expect(session.summary).toBe('TypeScript discussion');
      expect(session.projectPath).toBe('/test/project');
    });

    it('should include all messages', async () => {
      const json = await exportSessionToJson(sessionUuid1, { dataPath: testDataPath });
      const session = JSON.parse(json);

      expect(session.messages.length).toBeGreaterThan(0);
    });

    it('should be formatted with indentation', async () => {
      const json = await exportSessionToJson(0, { dataPath: testDataPath });

      // Formatted JSON has newlines
      expect(json).toContain('\n');
      expect(json).toContain('  '); // 2-space indent
    });

    it('should preserve progress messages in exported JSON', async () => {
      const json = await exportSessionToJson(sessionUuid4, { dataPath: testDataPath });
      const session = JSON.parse(json);

      expect(
        session.messages.some((message: { type: string }) => message.type === 'progress')
      ).toBe(true);
    });
  });

  describe('exportSessionToMarkdown', () => {
    it('should export session with header', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid1, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('# TypeScript discussion');
    });

    it('should include metadata table', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid1, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('| Session ID |');
      expect(markdown).toContain('| Project |');
      expect(markdown).toContain(sessionUuid1);
    });

    it('should format user messages', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid1, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('## 👤 User');
      expect(markdown).toContain('How do I use generics?');
    });

    it('should format assistant messages', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid1, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('## 🤖 Assistant');
      expect(markdown).toContain('Generics allow reusable components');
    });

    it('should include model name for assistant', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid1, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('claude-opus-4-5-20251101');
    });

    it('should format tool use as collapsible', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid1, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('<details>');
      expect(markdown).toContain('🔧 Tool: Read');
      expect(markdown).toContain('file_path');
    });

    it('should format thinking as collapsible', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid2, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('<details>');
      expect(markdown).toContain('💭 Thinking');
      expect(markdown).toContain('Let me think about this carefully');
    });

    it('should preserve code blocks', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid1, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('```typescript');
      expect(markdown).toContain('function identity');
    });

    it('should include agent sessions if available', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid3, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('| Agent Sessions |');
      expect(markdown).toContain('abc123');
    });

    it('should render progress messages and metadata in markdown export', async () => {
      const markdown = await exportSessionToMarkdown(sessionUuid4, {
        dataPath: testDataPath,
      });

      expect(markdown).toContain('## ⏳ Progress');
      expect(markdown).toContain('Tool is scanning project files...');
      expect(markdown).toContain('UUID');
      expect(markdown).toContain('CWD');
    });
  });

  describe('exportAllSessionsToJson', () => {
    it('should export all sessions as JSON array', async () => {
      const json = await exportAllSessionsToJson({ dataPath: testDataPath });
      const sessions = JSON.parse(json);

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(4);
    });

    it('should include all sessions', async () => {
      const json = await exportAllSessionsToJson({ dataPath: testDataPath });
      const sessions = JSON.parse(json);

      const ids = sessions.map((s: { id: string }) => s.id);
      expect(ids).toContain(sessionUuid1);
      expect(ids).toContain(sessionUuid2);
      expect(ids).toContain(sessionUuid3);
      expect(ids).toContain(sessionUuid4);
    });
  });

  describe('exportAllSessionsToMarkdown', () => {
    it('should export all sessions with separators', async () => {
      const markdown = await exportAllSessionsToMarkdown({ dataPath: testDataPath });

      expect(markdown).toContain('# TypeScript discussion');
      expect(markdown).toContain('# Thinking example');
      expect(markdown).toContain('---'); // Separator
    });

    it('should skip sessions that fail to export', async () => {
      // Create a corrupted session file
      const projectDir = join(projectsPath, '-test-project');
      const corruptedUuid = '99999999-9999-9999-9999-999999999999';
      await writeFile(join(projectDir, `${corruptedUuid}.jsonl`), 'invalid json content');

      const markdown = await exportAllSessionsToMarkdown({ dataPath: testDataPath });

      // Should still export the valid sessions
      expect(markdown).toContain('# TypeScript discussion');
      expect(markdown).toContain('# Thinking example');

      // Clean up corrupted file
      await rm(join(projectDir, `${corruptedUuid}.jsonl`), { force: true });
    });
  });

  describe('exportSession (convenience function)', () => {
    it('should export to JSON format', async () => {
      const result = await exportSession(0, 'json', { dataPath: testDataPath });

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should export to Markdown format', async () => {
      const result = await exportSession(0, 'markdown', { dataPath: testDataPath });

      expect(result).toContain('## 👤 User');
    });
  });

  describe('exportAllSessions (convenience function)', () => {
    it('should export all to JSON format', async () => {
      const result = await exportAllSessions('json', { dataPath: testDataPath });
      const sessions = JSON.parse(result);

      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should export all to Markdown format', async () => {
      const result = await exportAllSessions('markdown', { dataPath: testDataPath });

      expect(result).toContain('---');
    });
  });
});

describe('export all unlimited behavior', () => {
  const testDataPath = join(tmpdir(), `claude-export-unlimited-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');
  const totalSessions = 94;
  const finalSummary = `Bulk export session ${totalSessions - 1}`;

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-large-export-project');
    await mkdir(projectDir, { recursive: true });

    const writes: Promise<void>[] = [];
    for (let i = 0; i < totalSessions; i++) {
      const sessionId = createLargeExportSessionId(i);
      const timestamp = new Date(Date.UTC(2025, 0, 1, 0, i, 0)).toISOString();
      writes.push(
        writeFile(
          join(projectDir, `${sessionId}.jsonl`),
          createLargeExportSessionJson(
            sessionId,
            '/test/large-export-project',
            `Bulk export session ${i}`,
            timestamp
          )
        )
      );
    }

    await Promise.all(writes);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  it('should export all sessions to JSON when limit is omitted on a 94-session fixture', async () => {
    const json = await exportAllSessionsToJson({ dataPath: testDataPath });
    const sessions = JSON.parse(json) as { id: string; summary: string | null }[];

    expect(sessions).toHaveLength(totalSessions);
    expect(sessions.some((session) => session.summary === finalSummary)).toBe(true);
    expect(
      sessions.some((session) => session.id === createLargeExportSessionId(totalSessions - 1))
    ).toBe(true);
  });

  it('should export all sessions to Markdown when limit is omitted on a 94-session fixture', async () => {
    const markdown = await exportAllSessionsToMarkdown({ dataPath: testDataPath });

    expect(markdown).toContain(`# ${finalSummary}`);
    expect(markdown.match(/^# Bulk export session /gm)).toHaveLength(totalSessions);
  });
});
