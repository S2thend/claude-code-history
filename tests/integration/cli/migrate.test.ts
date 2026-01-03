/**
 * Integration tests for migrate command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');
const TEST_DATA_DIR = resolve(process.cwd(), 'tests/fixtures/cli-migrate-test-data');
const TEST_PROJECTS_DIR = join(TEST_DATA_DIR, 'projects');

// Counter for generating unique UUIDs
let uuidCounter = 0;

/**
 * Generate a valid UUID for testing
 */
function generateTestUUID(): string {
  uuidCounter++;
  const hex = uuidCounter.toString(16).padStart(12, '0');
  return `aaaaaaaa-bbbb-cccc-dddd-${hex}`;
}

/**
 * Create a test session file
 */
function createTestSession(
  projectPath: string,
  messages: { type: string; content: string }[],
  options?: { summary?: string }
): string {
  const sessionId = generateTestUUID();
  const encodedPath = projectPath.replace(/\//g, '-');
  const sessionDir = join(TEST_PROJECTS_DIR, encodedPath);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }

  const baseTime = Date.now();
  const entries = messages.map((msg, i) => ({
    type: msg.type,
    uuid: `msg-${sessionId}-${i}`,
    parentUuid: i > 0 ? `msg-${sessionId}-${i - 1}` : null,
    timestamp: new Date(baseTime - (messages.length - i) * 60000).toISOString(),
    sessionId: sessionId,
    cwd: projectPath,
    version: '2.0.0',
    message: msg.type === 'user'
      ? {
          role: 'user',
          content: msg.content,
        }
      : {
          role: 'assistant',
          model: 'claude-3-sonnet',
          content: [{ type: 'text', text: msg.content }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 200 },
        },
  }));

  // Add summary entry
  entries.unshift({
    type: 'summary',
    uuid: `summary-${sessionId}`,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    summary: options?.summary ?? `Test session`,
    leafUuid: `msg-${sessionId}-${messages.length - 1}`,
  } as unknown as (typeof entries)[0]);

  const jsonlContent = entries.map((e) => JSON.stringify(e)).join('\n');
  writeFileSync(join(sessionDir, `${sessionId}.jsonl`), jsonlContent);

  return sessionId;
}

/**
 * Execute CLI command and return stdout/stderr
 */
function runCli(args: string, dataPath?: string): { stdout: string; stderr: string; exitCode: number } {
  const dataPathArg = dataPath ? `--data-path "${dataPath}"` : `--data-path "${TEST_DATA_DIR}"`;
  try {
    const stdout = execSync(`node ${CLI_PATH} ${dataPathArg} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const err = error as { stdout?: string; stderr?: string; status: number };
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        exitCode: err.status || 1,
      };
    }
    throw error;
  }
}

describe('cch migrate', () => {
  beforeAll(() => {
    // Build CLI
    try {
      execSync('npm run build', { encoding: 'utf-8', timeout: 60000 });
    } catch {
      // Build might already be done
    }

    // Create test data directory
    mkdirSync(TEST_PROJECTS_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up test data
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset UUID counter
    uuidCounter = 0;

    // Clean and recreate test data for each test
    if (existsSync(TEST_PROJECTS_DIR)) {
      rmSync(TEST_PROJECTS_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJECTS_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(TEST_PROJECTS_DIR)) {
      rmSync(TEST_PROJECTS_DIR, { recursive: true, force: true });
      mkdirSync(TEST_PROJECTS_DIR, { recursive: true });
    }
  });

  describe('migrate copy mode (T050)', () => {
    it('should copy session to destination by index', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [
        { type: 'user', content: 'Hello' },
        { type: 'assistant', content: 'Hi there!' },
      ], { summary: 'Session to copy' });

      const { stdout, exitCode } = runCli(`migrate 0 --destination "${destProject}"`);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/migrat|success|copied/i);

      // Verify session exists in destination
      const destEncodedPath = destProject.replace(/\//g, '-');
      const destDir = join(TEST_PROJECTS_DIR, destEncodedPath);
      expect(existsSync(destDir)).toBe(true);
      const files = readdirSync(destDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/\.jsonl$/);

      // Verify source still exists
      const sourceEncodedPath = sourceProject.replace(/\//g, '-');
      const sourceDir = join(TEST_PROJECTS_DIR, sourceEncodedPath);
      expect(existsSync(sourceDir)).toBe(true);
    });

    it('should copy session to destination by UUID', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      const sessionId = createTestSession(sourceProject, [
        { type: 'user', content: 'Test by UUID' },
      ]);

      const { stdout, exitCode } = runCli(`migrate ${sessionId} -D "${destProject}"`);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/migrat|success|copied/i);

      // Verify session exists in destination
      const destEncodedPath = destProject.replace(/\//g, '-');
      const destDir = join(TEST_PROJECTS_DIR, destEncodedPath);
      expect(existsSync(destDir)).toBe(true);
    });

    it('should default to copy mode', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [
        { type: 'user', content: 'Default mode test' },
      ]);

      const { exitCode } = runCli(`migrate 0 --destination "${destProject}"`);

      expect(exitCode).toBe(0);

      // Verify source still exists (copy mode)
      const sourceEncodedPath = sourceProject.replace(/\//g, '-');
      const sourceDir = join(TEST_PROJECTS_DIR, sourceEncodedPath);
      expect(existsSync(sourceDir)).toBe(true);
      const sourceFiles = readdirSync(sourceDir);
      expect(sourceFiles.length).toBe(1);
    });

    it('should show success message with session count', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [
        { type: 'user', content: 'Count test' },
      ]);

      const { stdout } = runCli(`migrate 0 --destination "${destProject}"`);

      expect(stdout).toMatch(/1/); // Should mention count
    });
  });

  describe('migrate move mode (T051)', () => {
    it('should move session to destination', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [
        { type: 'user', content: 'Session to move' },
      ]);

      const { stdout, exitCode } = runCli(`migrate 0 --destination "${destProject}" --mode move`);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/migrat|success|moved/i);

      // Verify session exists in destination
      const destEncodedPath = destProject.replace(/\//g, '-');
      const destDir = join(TEST_PROJECTS_DIR, destEncodedPath);
      expect(existsSync(destDir)).toBe(true);
      const destFiles = readdirSync(destDir);
      expect(destFiles.length).toBe(1);

      // Verify source is empty
      const sourceEncodedPath = sourceProject.replace(/\//g, '-');
      const sourceDir = join(TEST_PROJECTS_DIR, sourceEncodedPath);
      // Source dir may still exist but should be empty
      if (existsSync(sourceDir)) {
        const sourceFiles = readdirSync(sourceDir);
        expect(sourceFiles.length).toBe(0);
      }
    });

    it('should support -m shorthand for mode', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [
        { type: 'user', content: 'Mode shorthand test' },
      ]);

      const { exitCode } = runCli(`migrate 0 -D "${destProject}" -m move`);

      expect(exitCode).toBe(0);

      // Verify moved (source empty)
      const sourceEncodedPath = sourceProject.replace(/\//g, '-');
      const sourceDir = join(TEST_PROJECTS_DIR, sourceEncodedPath);
      if (existsSync(sourceDir)) {
        const sourceFiles = readdirSync(sourceDir);
        expect(sourceFiles.length).toBe(0);
      }
    });
  });

  describe('migrate multiple sessions (T052)', () => {
    it('should migrate multiple sessions by index', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      const sessionId1 = createTestSession(sourceProject, [{ type: 'user', content: 'First session' }]);
      const sessionId2 = createTestSession(sourceProject, [{ type: 'user', content: 'Second session' }]);

      // Migrate both sessions by UUID to be deterministic
      const { exitCode } = runCli(`migrate ${sessionId1},${sessionId2} --destination "${destProject}"`);

      expect(exitCode).toBe(0);

      // Verify sessions exist in destination
      const destEncodedPath = destProject.replace(/\//g, '-');
      const destDir = join(TEST_PROJECTS_DIR, destEncodedPath);
      expect(existsSync(destDir)).toBe(true);
      const destFiles = readdirSync(destDir);
      expect(destFiles.length).toBe(2);
    });

    it('should show progress output for multiple sessions', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      const sessionId1 = createTestSession(sourceProject, [{ type: 'user', content: 'First' }]);
      const sessionId2 = createTestSession(sourceProject, [{ type: 'user', content: 'Second' }]);

      const { stdout } = runCli(`migrate ${sessionId1},${sessionId2} -D "${destProject}"`);

      // Should show count
      expect(stdout).toMatch(/2/);
    });

    it('should migrate all sessions with --all flag', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [{ type: 'user', content: 'First' }]);
      createTestSession(sourceProject, [{ type: 'user', content: 'Second' }]);
      createTestSession(sourceProject, [{ type: 'user', content: 'Third' }]);

      const { exitCode } = runCli(`migrate --all --source "${sourceProject}" --destination "${destProject}"`);

      expect(exitCode).toBe(0);

      // Verify all sessions migrated
      const destEncodedPath = destProject.replace(/\//g, '-');
      const destDir = join(TEST_PROJECTS_DIR, destEncodedPath);
      expect(existsSync(destDir)).toBe(true);
      const destFiles = readdirSync(destDir);
      expect(destFiles.length).toBe(3);
    });
  });

  describe('error handling (T053)', () => {
    it('should error when no session and no --all flag', () => {
      const { exitCode, stdout, stderr } = runCli('migrate --destination /some/path');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/session|required|--all/i);
    });

    it('should error when no destination specified', () => {
      createTestSession('/Users/dev/source', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('migrate 0');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/destination|required/i);
    });

    it('should error for non-existent session', () => {
      createTestSession('/Users/dev/source', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('migrate 999 --destination /dest');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found/i);
    });

    it('should error for invalid mode', () => {
      createTestSession('/Users/dev/source', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('migrate 0 -D /dest --mode invalid');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/invalid|mode|copy|move/i);
    });

    it('should handle partial failures gracefully', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [{ type: 'user', content: 'Valid session' }]);

      // Try to migrate both valid and invalid sessions
      const { stdout } = runCli(`migrate 0,999 -D "${destProject}"`);

      // Should succeed partially
      expect(stdout).toMatch(/1/); // At least one succeeded
      // May show error for failed one
    });

    it('should return JSON result with --json flag', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';
      createTestSession(sourceProject, [{ type: 'user', content: 'JSON test' }]);

      const { stdout, exitCode } = runCli(`migrate 0 -D "${destProject}" --json`);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.success).toBe(true);
      expect(result.data.successCount).toBe(1);
    });

    it('should error for --all without --source', () => {
      createTestSession('/Users/dev/source', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('migrate --all --destination /dest');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/source|required/i);
    });
  });

  describe('path rewriting', () => {
    it('should rewrite paths in migrated sessions', () => {
      const sourceProject = '/Users/dev/source';
      const destProject = '/Users/dev/destination';

      // Create session with tool calls that include paths
      const sessionId = generateTestUUID();
      const encodedPath = sourceProject.replace(/\//g, '-');
      const sessionDir = join(TEST_PROJECTS_DIR, encodedPath);
      mkdirSync(sessionDir, { recursive: true });

      const entries = [
        {
          type: 'summary',
          uuid: `summary-${sessionId}`,
          parentUuid: null,
          timestamp: new Date().toISOString(),
          summary: 'Path rewrite test',
          leafUuid: `msg-${sessionId}-1`,
        },
        {
          type: 'user',
          uuid: `msg-${sessionId}-0`,
          parentUuid: null,
          timestamp: new Date().toISOString(),
          sessionId: sessionId,
          cwd: sourceProject,
          version: '2.0.0',
          message: { role: 'user', content: 'Read file' },
        },
        {
          type: 'assistant',
          uuid: `msg-${sessionId}-1`,
          parentUuid: `msg-${sessionId}-0`,
          timestamp: new Date().toISOString(),
          sessionId: sessionId,
          cwd: sourceProject,
          version: '2.0.0',
          message: {
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Read',
                input: { file_path: `${sourceProject}/src/index.ts` },
              },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 100, output_tokens: 200 },
          },
        },
      ];

      const jsonlContent = entries.map((e) => JSON.stringify(e)).join('\n');
      writeFileSync(join(sessionDir, `${sessionId}.jsonl`), jsonlContent);

      const { exitCode } = runCli(`migrate ${sessionId} -D "${destProject}"`);

      expect(exitCode).toBe(0);

      // Read migrated session and verify paths are rewritten
      const destEncodedPath = destProject.replace(/\//g, '-');
      const destDir = join(TEST_PROJECTS_DIR, destEncodedPath);
      const destFiles = readdirSync(destDir);
      const migratedContent = readFileSync(join(destDir, destFiles[0]), 'utf-8');

      expect(migratedContent).toContain(destProject);
      expect(migratedContent).toContain(`${destProject}/src/index.ts`);
    });
  });
});
