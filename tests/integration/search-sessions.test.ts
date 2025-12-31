/**
 * Integration tests for searchSessions function.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { searchSessions, searchInSession } from '../../src/lib/search.js';

describe('searchSessions', () => {
  const testDataPath = join(tmpdir(), `claude-search-test-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  const session1 = [
    '{"type":"summary","summary":"TypeScript generics discussion","leafUuid":"msg-002"}',
    '{"type":"user","uuid":"msg-001","parentUuid":null,"timestamp":"2025-12-01T10:00:00.000Z","sessionId":"session-001","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"How do I use TypeScript generics?"}}',
    '{"type":"assistant","uuid":"msg-002","parentUuid":"msg-001","timestamp":"2025-12-01T10:00:15.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"TypeScript generics allow you to create reusable components.\\n\\nHere is an example:\\n```typescript\\nfunction identity<T>(arg: T): T {\\n  return arg;\\n}\\n```\\n\\nThis preserves type information."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const session2 = [
    '{"type":"summary","summary":"React hooks tutorial","leafUuid":"msg-004"}',
    '{"type":"user","uuid":"msg-003","parentUuid":null,"timestamp":"2025-12-02T10:00:00.000Z","sessionId":"session-002","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Explain React useState hook"}}',
    '{"type":"assistant","uuid":"msg-004","parentUuid":"msg-003","timestamp":"2025-12-02T10:00:15.000Z","sessionId":"session-002","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"The useState hook is a fundamental React hook.\\n\\nIt allows functional components to have state.\\n\\nExample:\\n```javascript\\nconst [count, setCount] = useState(0);\\n```"}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const session3 = [
    '{"type":"summary","summary":"Tool use example","leafUuid":"msg-008"}',
    '{"type":"user","uuid":"msg-005","parentUuid":null,"timestamp":"2025-12-03T10:00:00.000Z","sessionId":"session-003","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Read my TypeScript file"}}',
    '{"type":"assistant","uuid":"msg-006","parentUuid":"msg-005","timestamp":"2025-12-03T10:00:15.000Z","sessionId":"session-003","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"tool_use","id":"toolu_001","name":"Read","input":{"file_path":"/test/project/types.ts"}}],"stop_reason":"tool_use"}}',
    '{"type":"user","uuid":"msg-007","parentUuid":"msg-006","timestamp":"2025-12-03T10:00:16.000Z","sessionId":"session-003","cwd":"/test/project","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_001","content":"export interface User { name: string; }"}]}}',
    '{"type":"assistant","uuid":"msg-008","parentUuid":"msg-007","timestamp":"2025-12-03T10:00:30.000Z","sessionId":"session-003","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"I can see your TypeScript file defines a User interface."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const sessionUuid1 = '11111111-1111-1111-1111-111111111111';
  const sessionUuid2 = '22222222-2222-2222-2222-222222222222';
  const sessionUuid3 = '33333333-3333-3333-3333-333333333333';

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-project');
    await mkdir(projectDir, { recursive: true });

    await writeFile(join(projectDir, `${sessionUuid1}.jsonl`), session1);
    await writeFile(join(projectDir, `${sessionUuid2}.jsonl`), session2);
    await writeFile(join(projectDir, `${sessionUuid3}.jsonl`), session3);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  describe('basic search', () => {
    it('should find matches across sessions', async () => {
      const result = await searchSessions('TypeScript', { dataPath: testDataPath });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.total).toBeGreaterThan(0);
    });

    it('should be case-insensitive', async () => {
      const lowerResult = await searchSessions('typescript', { dataPath: testDataPath });
      const upperResult = await searchSessions('TYPESCRIPT', { dataPath: testDataPath });

      expect(lowerResult.pagination.total).toBe(upperResult.pagination.total);
    });

    it('should return empty results for non-matching query', async () => {
      const result = await searchSessions('xyznonexistent123', { dataPath: testDataPath });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should return empty results for empty query', async () => {
      const result = await searchSessions('', { dataPath: testDataPath });

      expect(result.data).toEqual([]);
    });
  });

  describe('match content', () => {
    it('should include session ID in matches', async () => {
      const result = await searchSessions('generics', { dataPath: testDataPath });

      for (const match of result.data) {
        expect(match.sessionId).toBeDefined();
        expect(typeof match.sessionId).toBe('string');
      }
    });

    it('should include session summary in matches', async () => {
      const result = await searchSessions('generics', { dataPath: testDataPath });

      const match = result.data.find((m) => m.sessionId === sessionUuid1);
      expect(match?.sessionSummary).toBe('TypeScript generics discussion');
    });

    it('should include message UUID', async () => {
      const result = await searchSessions('useState', { dataPath: testDataPath });

      for (const match of result.data) {
        expect(match.messageUuid).toBeDefined();
      }
    });

    it('should include message type', async () => {
      const result = await searchSessions('generics', { dataPath: testDataPath });

      for (const match of result.data) {
        expect(['user', 'assistant']).toContain(match.messageType);
      }
    });

    it('should include matched text', async () => {
      const result = await searchSessions('TypeScript', { dataPath: testDataPath });

      for (const match of result.data) {
        expect(match.match.toLowerCase()).toBe('typescript');
      }
    });

    it('should preserve original case in matched text', async () => {
      const result = await searchSessions('typescript', { dataPath: testDataPath });

      // Should find "TypeScript" with original casing
      const hasCapitalized = result.data.some((m) => m.match === 'TypeScript');
      expect(hasCapitalized).toBe(true);
    });
  });

  describe('context lines', () => {
    it('should include context lines around match', async () => {
      const result = await searchSessions('identity', { dataPath: testDataPath, context: 2 });

      expect(result.data.length).toBeGreaterThan(0);

      const match = result.data[0];
      expect(match.context).toBeDefined();
      expect(Array.isArray(match.context)).toBe(true);
      expect(match.context.length).toBeGreaterThan(0);
    });

    it('should include line number', async () => {
      const result = await searchSessions('identity', { dataPath: testDataPath });

      for (const match of result.data) {
        expect(match.lineNumber).toBeGreaterThan(0);
      }
    });
  });

  describe('search in tool content', () => {
    it('should search in tool use inputs', async () => {
      const result = await searchSessions('types.ts', { dataPath: testDataPath });

      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should search in tool results', async () => {
      const result = await searchSessions('interface User', { dataPath: testDataPath });

      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('pagination', () => {
    it('should apply limit to results', async () => {
      const result = await searchSessions('TypeScript', {
        dataPath: testDataPath,
        limit: 1,
      });

      expect(result.data.length).toBeLessThanOrEqual(1);
      expect(result.pagination.limit).toBe(1);
    });

    it('should apply offset to results', async () => {
      const allResult = await searchSessions('TypeScript', { dataPath: testDataPath });
      const offsetResult = await searchSessions('TypeScript', {
        dataPath: testDataPath,
        limit: 1,
        offset: 1,
      });

      if (allResult.data.length > 1) {
        expect(offsetResult.data[0]).not.toEqual(allResult.data[0]);
      }
    });

    it('should report correct total regardless of pagination', async () => {
      const allResult = await searchSessions('TypeScript', { dataPath: testDataPath });
      const limitedResult = await searchSessions('TypeScript', {
        dataPath: testDataPath,
        limit: 1,
      });

      expect(limitedResult.pagination.total).toBe(allResult.pagination.total);
    });
  });
});

describe('searchInSession', () => {
  const testDataPath = join(tmpdir(), `claude-search-single-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  const session = [
    '{"type":"summary","summary":"Multi-topic discussion","leafUuid":"msg-004"}',
    '{"type":"user","uuid":"msg-001","parentUuid":null,"timestamp":"2025-12-01T10:00:00.000Z","sessionId":"session-001","cwd":"/test/project","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Tell me about JavaScript and TypeScript"}}',
    '{"type":"assistant","uuid":"msg-002","parentUuid":"msg-001","timestamp":"2025-12-01T10:00:15.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"JavaScript is a dynamic language.\\nTypeScript adds static typing to JavaScript."}],"stop_reason":"end_turn"}}',
    '{"type":"user","uuid":"msg-003","parentUuid":"msg-002","timestamp":"2025-12-01T10:01:00.000Z","sessionId":"session-001","cwd":"/test/project","message":{"role":"user","content":"What about Python?"}}',
    '{"type":"assistant","uuid":"msg-004","parentUuid":"msg-003","timestamp":"2025-12-01T10:01:15.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Python is also a great language for scripting."}],"stop_reason":"end_turn"}}',
  ].join('\n');

  const sessionUuid = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    const projectDir = join(projectsPath, '-test-project');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, `${sessionUuid}.jsonl`), session);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  it('should search within a specific session by UUID', async () => {
    const matches = await searchInSession(sessionUuid, 'JavaScript', {
      dataPath: testDataPath,
    });

    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.sessionId).toBe(sessionUuid);
    }
  });

  it('should search within a specific session by index', async () => {
    const matches = await searchInSession(0, 'Python', { dataPath: testDataPath });

    expect(matches.length).toBeGreaterThan(0);
  });

  it('should find multiple matches in same session', async () => {
    // "JavaScript" appears multiple times
    const matches = await searchInSession(sessionUuid, 'JavaScript', {
      dataPath: testDataPath,
    });

    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty array for non-matching query', async () => {
    const matches = await searchInSession(sessionUuid, 'Rust', {
      dataPath: testDataPath,
    });

    expect(matches).toEqual([]);
  });
});
