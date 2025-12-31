/**
 * Unit tests for migrate functions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { migrateSession, migrateWorkspace } from '../../src/lib/migrate.js';
import { WorkspaceNotFoundError } from '../../src/lib/errors.js';

describe('migrateSession', () => {
  const testDataPath = join(tmpdir(), `claude-migrate-test-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  // Session with paths that need rewriting
  const sessionWithPaths = [
    '{"type":"summary","summary":"Session with file operations","leafUuid":"msg-004"}',
    '{"type":"user","uuid":"msg-001","parentUuid":null,"timestamp":"2025-12-01T10:00:00.000Z","sessionId":"session-001","cwd":"/old/workspace/src","gitBranch":"main","version":"2.0.55","message":{"role":"user","content":"Read my file"}}',
    '{"type":"assistant","uuid":"msg-002","parentUuid":"msg-001","timestamp":"2025-12-01T10:00:15.000Z","sessionId":"session-001","cwd":"/old/workspace","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"tool_use","id":"toolu_001","name":"Read","input":{"file_path":"/old/workspace/src/file.ts"}}],"stop_reason":"tool_use"}}',
    '{"type":"user","uuid":"msg-003","parentUuid":"msg-002","timestamp":"2025-12-01T10:00:16.000Z","sessionId":"session-001","cwd":"/old/workspace","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_001","content":"file contents"}]}}',
    '{"type":"assistant","uuid":"msg-004","parentUuid":"msg-003","timestamp":"2025-12-01T10:00:30.000Z","sessionId":"session-001","message":{"model":"claude-opus-4-5-20251101","role":"assistant","content":[{"type":"text","text":"Done!"}],"stop_reason":"end_turn"}}',
    '{"type":"file-history-snapshot","messageId":"msg-002","snapshot":{"messageId":"msg-002","timestamp":"2025-12-01T10:00:15.000Z","trackedFileBackups":{"/old/workspace/src/file.ts":{"backupFileName":"abc123@v1","version":1,"backupTime":"2025-12-01T10:00:15.000Z"}}}}',
  ].join('\n');

  const sessionUuid = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    // Create source workspace
    const sourceDir = join(projectsPath, '-old-workspace');
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, `${sessionUuid}.jsonl`), sessionWithPaths);
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  describe('copy mode', () => {
    it('should copy session to new workspace', async () => {
      const result = await migrateSession(
        {
          sessions: sessionUuid,
          destination: '/new/workspace',
          mode: 'copy',
        },
        { dataPath: testDataPath }
      );

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Check destination file exists
      const destDir = join(projectsPath, '-new-workspace');
      const destFile = join(destDir, `${sessionUuid}.jsonl`);
      const content = await readFile(destFile, 'utf-8');

      expect(content).toBeDefined();
    });

    it('should preserve source file in copy mode', async () => {
      await migrateSession(
        {
          sessions: sessionUuid,
          destination: '/another/workspace',
          mode: 'copy',
        },
        { dataPath: testDataPath }
      );

      // Source should still exist
      const sourceDir = join(projectsPath, '-old-workspace');
      const sourceFile = join(sourceDir, `${sessionUuid}.jsonl`);
      const content = await readFile(sourceFile, 'utf-8');

      expect(content).toBeDefined();
    });

    it('should rewrite cwd paths', async () => {
      await migrateSession(
        {
          sessions: sessionUuid,
          destination: '/new/workspace',
          mode: 'copy',
        },
        { dataPath: testDataPath }
      );

      const destFile = join(projectsPath, '-new-workspace', `${sessionUuid}.jsonl`);
      const content = await readFile(destFile, 'utf-8');

      expect(content).toContain('/new/workspace/src');
      expect(content).toContain('/new/workspace');
      expect(content).not.toContain('"/old/workspace/src"');
    });

    it('should rewrite file_path in tool_use', async () => {
      await migrateSession(
        {
          sessions: sessionUuid,
          destination: '/new/workspace',
          mode: 'copy',
        },
        { dataPath: testDataPath }
      );

      const destFile = join(projectsPath, '-new-workspace', `${sessionUuid}.jsonl`);
      const content = await readFile(destFile, 'utf-8');

      expect(content).toContain('/new/workspace/src/file.ts');
      expect(content).not.toContain('"/old/workspace/src/file.ts"');
    });

    it('should rewrite trackedFileBackups paths', async () => {
      await migrateSession(
        {
          sessions: sessionUuid,
          destination: '/new/workspace',
          mode: 'copy',
        },
        { dataPath: testDataPath }
      );

      const destFile = join(projectsPath, '-new-workspace', `${sessionUuid}.jsonl`);
      const content = await readFile(destFile, 'utf-8');

      // The key in trackedFileBackups should be rewritten
      expect(content).toContain('"/new/workspace/src/file.ts"');
    });

    it('should preserve session UUID', async () => {
      await migrateSession(
        {
          sessions: sessionUuid,
          destination: '/preserve/uuid/workspace',
          mode: 'copy',
        },
        { dataPath: testDataPath }
      );

      // File should have same UUID name
      const destDir = join(projectsPath, '-preserve-uuid-workspace');
      const files = await readdir(destDir);

      expect(files).toContain(`${sessionUuid}.jsonl`);
    });
  });

  describe('move mode', () => {
    it('should move session and delete source', async () => {
      // Create a separate session for move test
      const moveUuid = '22222222-2222-2222-2222-222222222222';
      const moveSourceDir = join(projectsPath, '-move-source');
      await mkdir(moveSourceDir, { recursive: true });
      await writeFile(
        join(moveSourceDir, `${moveUuid}.jsonl`),
        '{"type":"summary","summary":"Move test","leafUuid":"msg-001"}\n{"type":"user","uuid":"msg-001","parentUuid":null,"timestamp":"2025-12-01T10:00:00.000Z","cwd":"/move/source","message":{"role":"user","content":"test"}}'
      );

      const result = await migrateSession(
        {
          sessions: moveUuid,
          destination: '/move/dest',
          mode: 'move',
        },
        { dataPath: testDataPath, workspace: '/move/source' }
      );

      expect(result.successCount).toBe(1);

      // Destination should exist
      const destFile = join(projectsPath, '-move-dest', `${moveUuid}.jsonl`);
      const destContent = await readFile(destFile, 'utf-8');
      expect(destContent).toBeDefined();

      // Source should be deleted
      const sourceFile = join(moveSourceDir, `${moveUuid}.jsonl`);
      await expect(readFile(sourceFile, 'utf-8')).rejects.toThrow();
    });
  });

  describe('multiple sessions', () => {
    it('should migrate multiple sessions', async () => {
      // Create multiple sessions
      const multiSourceDir = join(projectsPath, '-multi-source');
      await mkdir(multiSourceDir, { recursive: true });

      const uuid1 = '33333333-3333-3333-3333-333333333333';
      const uuid2 = '44444444-4444-4444-4444-444444444444';

      await writeFile(
        join(multiSourceDir, `${uuid1}.jsonl`),
        '{"type":"summary","summary":"Session 1","leafUuid":"msg-001"}\n{"type":"user","uuid":"msg-001","cwd":"/multi/source","message":{"role":"user","content":"test1"}}'
      );
      await writeFile(
        join(multiSourceDir, `${uuid2}.jsonl`),
        '{"type":"summary","summary":"Session 2","leafUuid":"msg-002"}\n{"type":"user","uuid":"msg-002","cwd":"/multi/source","message":{"role":"user","content":"test2"}}'
      );

      const result = await migrateSession(
        {
          sessions: [uuid1, uuid2],
          destination: '/multi/dest',
          mode: 'copy',
        },
        { dataPath: testDataPath, workspace: '/multi/source' }
      );

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should return error for non-existent session', async () => {
      const result = await migrateSession(
        {
          sessions: 'nonexistent-uuid',
          destination: '/some/path',
        },
        { dataPath: testDataPath }
      );

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors[0].sessionId).toBe('nonexistent-uuid');
    });

    it('should continue on partial failure', async () => {
      const result = await migrateSession(
        {
          sessions: [sessionUuid, 'nonexistent'],
          destination: '/partial/dest',
        },
        { dataPath: testDataPath }
      );

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });
});

describe('migrateWorkspace', () => {
  const testDataPath = join(tmpdir(), `claude-migrate-ws-${Date.now()}`);
  const projectsPath = join(testDataPath, 'projects');

  beforeAll(async () => {
    // Create source workspace with multiple sessions
    const sourceDir = join(projectsPath, '-workspace-source');
    await mkdir(sourceDir, { recursive: true });

    await writeFile(
      join(sourceDir, '55555555-5555-5555-5555-555555555555.jsonl'),
      '{"type":"summary","summary":"WS Session 1","leafUuid":"msg-001"}\n{"type":"user","uuid":"msg-001","cwd":"/workspace/source","message":{"role":"user","content":"test1"}}'
    );
    await writeFile(
      join(sourceDir, '66666666-6666-6666-6666-666666666666.jsonl'),
      '{"type":"summary","summary":"WS Session 2","leafUuid":"msg-002"}\n{"type":"user","uuid":"msg-002","cwd":"/workspace/source","message":{"role":"user","content":"test2"}}'
    );
    await writeFile(
      join(sourceDir, 'agent-abc123.jsonl'),
      '{"type":"summary","summary":"Agent session","leafUuid":"agent-001"}\n{"type":"user","uuid":"agent-001","cwd":"/workspace/source","agentId":"abc123","message":{"role":"user","content":"agent task"}}'
    );
  });

  afterAll(async () => {
    await rm(testDataPath, { recursive: true, force: true });
  });

  it('should migrate all sessions in workspace', async () => {
    const result = await migrateWorkspace(
      {
        source: '/workspace/source',
        destination: '/workspace/dest',
        mode: 'copy',
      },
      { dataPath: testDataPath }
    );

    // 2 main sessions + 1 agent session
    expect(result.successCount).toBe(3);
    expect(result.failedCount).toBe(0);

    // Check destination has all files
    const destDir = join(projectsPath, '-workspace-dest');
    const files = await readdir(destDir);

    expect(files).toHaveLength(3);
    expect(files).toContain('55555555-5555-5555-5555-555555555555.jsonl');
    expect(files).toContain('66666666-6666-6666-6666-666666666666.jsonl');
    expect(files).toContain('agent-abc123.jsonl');
  });

  it('should throw WorkspaceNotFoundError for non-existent source', async () => {
    await expect(
      migrateWorkspace(
        {
          source: '/nonexistent/workspace',
          destination: '/some/dest',
        },
        { dataPath: testDataPath }
      )
    ).rejects.toThrow(WorkspaceNotFoundError);
  });

  it('should rewrite paths in all migrated files', async () => {
    await migrateWorkspace(
      {
        source: '/workspace/source',
        destination: '/workspace/rewrite-dest',
        mode: 'copy',
      },
      { dataPath: testDataPath }
    );

    const destFile = join(
      projectsPath,
      '-workspace-rewrite-dest',
      '55555555-5555-5555-5555-555555555555.jsonl'
    );
    const content = await readFile(destFile, 'utf-8');

    expect(content).toContain('/workspace/rewrite-dest');
    expect(content).not.toContain('"/workspace/source"');
  });
});
