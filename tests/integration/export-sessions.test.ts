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

  const sessionUuid1 = '11111111-1111-1111-1111-111111111111';
  const sessionUuid2 = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-project');
    await mkdir(projectDir, { recursive: true });

    await writeFile(join(projectDir, `${sessionUuid1}.jsonl`), session1);
    await writeFile(join(projectDir, `${sessionUuid2}.jsonl`), session2);
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
  });

  describe('exportAllSessionsToJson', () => {
    it('should export all sessions as JSON array', async () => {
      const json = await exportAllSessionsToJson({ dataPath: testDataPath });
      const sessions = JSON.parse(json);

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(2);
    });

    it('should include both sessions', async () => {
      const json = await exportAllSessionsToJson({ dataPath: testDataPath });
      const sessions = JSON.parse(json);

      const ids = sessions.map((s: { id: string }) => s.id);
      expect(ids).toContain(sessionUuid1);
      expect(ids).toContain(sessionUuid2);
    });
  });

  describe('exportAllSessionsToMarkdown', () => {
    it('should export all sessions with separators', async () => {
      const markdown = await exportAllSessionsToMarkdown({ dataPath: testDataPath });

      expect(markdown).toContain('# TypeScript discussion');
      expect(markdown).toContain('# Thinking example');
      expect(markdown).toContain('---'); // Separator
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
