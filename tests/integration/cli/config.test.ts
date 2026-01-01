/**
 * Integration tests for custom data path configuration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');
const TEST_DATA_DIR = resolve(process.cwd(), 'tests/fixtures/cli-config-test-data');
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
  messages: Array<{ type: string; content: string }>,
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
 * Execute CLI command with custom environment
 */
function runCliWithEnv(
  args: string,
  env: Record<string, string> = {}
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
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

/**
 * Execute CLI command with --data-path option
 */
function runCli(args: string, dataPath?: string): { stdout: string; stderr: string; exitCode: number } {
  const dataPathArg = dataPath ? `--data-path "${dataPath}"` : '';
  return runCliWithEnv(`${dataPathArg} ${args}`);
}

describe('custom data path configuration (T058-T060)', () => {
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
  });

  describe('--data-path option (T058)', () => {
    it('should use custom data path from --data-path option', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'Custom path test' },
      ], { summary: 'Session from custom path' });

      const { stdout, exitCode } = runCli('list', TEST_DATA_DIR);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Session from custom path');
    });

    it('should work with list command', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'List test' },
      ]);

      const { stdout, exitCode } = runCli('list', TEST_DATA_DIR);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/project1|session/i);
    });

    it('should work with view command', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'View test content' },
      ]);

      const { stdout, exitCode } = runCli('view 0', TEST_DATA_DIR);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('View test content');
    });

    it('should work with search command', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'Searchable content here' },
      ]);

      const { stdout, exitCode } = runCli('search "Searchable content"', TEST_DATA_DIR);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Searchable');
    });

    it('should work with export command', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'Export test' },
      ], { summary: 'Export session' });

      const { stdout, exitCode } = runCli('export 0', TEST_DATA_DIR);

      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.summary).toBe('Export session');
    });

    it('should support -d shorthand for --data-path', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'Shorthand test' },
      ]);

      const { stdout, exitCode } = runCliWithEnv(`-d "${TEST_DATA_DIR}" list`);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/project1|session/i);
    });
  });

  describe('CCH_DATA_PATH environment variable (T059)', () => {
    it('should use custom data path from environment variable', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'Env var test' },
      ], { summary: 'Session from env path' });

      const { stdout, exitCode } = runCliWithEnv('list', {
        CCH_DATA_PATH: TEST_DATA_DIR,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Session from env path');
    });

    it('should work with all commands via env var', () => {
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'Env var content' },
      ]);

      // List command
      const listResult = runCliWithEnv('list', { CCH_DATA_PATH: TEST_DATA_DIR });
      expect(listResult.exitCode).toBe(0);

      // View command
      const viewResult = runCliWithEnv('view 0', { CCH_DATA_PATH: TEST_DATA_DIR });
      expect(viewResult.exitCode).toBe(0);
      expect(viewResult.stdout).toContain('Env var content');
    });

    it('should prefer --data-path over environment variable', () => {
      // Create session in test data dir
      createTestSession('/Users/dev/project1', [
        { type: 'user', content: 'Data path priority test' },
      ], { summary: 'CLI option session' });

      // Set env var to non-existent path
      const { stdout, exitCode } = runCliWithEnv(`--data-path "${TEST_DATA_DIR}" list`, {
        CCH_DATA_PATH: '/nonexistent/should/be/ignored',
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('CLI option session');
    });
  });

  describe('invalid path error handling (T060)', () => {
    it('should error gracefully for non-existent data path', () => {
      const { exitCode, stdout, stderr } = runCli('list', '/nonexistent/path');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found|does not exist|no such/i);
    });

    it('should error gracefully when data path is a file not directory', () => {
      // Create a file where a directory is expected
      const filePath = join(TEST_DATA_DIR, 'not-a-directory');
      writeFileSync(filePath, 'this is a file');

      const { exitCode, stdout, stderr } = runCli('list', filePath);

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      // Should error (can't find sessions in a file)
      expect(exitCode).not.toBe(0);
    });

    it('should show JSON error with --json flag for invalid path', () => {
      const { stdout, exitCode } = runCli('list --json', '/nonexistent/path');

      expect(exitCode).not.toBe(0);
      const result = JSON.parse(stdout);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide helpful message for invalid path', () => {
      const { stdout, stderr } = runCli('list', '/nonexistent/path');

      const output = stdout + stderr;
      // Should mention Claude Code or data directory
      expect(output.toLowerCase()).toMatch(/claude|data|directory|installed/i);
    });

    it('should error with helpful message when env var path is invalid', () => {
      const { exitCode, stdout, stderr } = runCliWithEnv('list', {
        CCH_DATA_PATH: '/nonexistent/env/path',
      });

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found|does not exist|no such/i);
    });
  });

  describe('empty data directory', () => {
    it('should handle empty projects directory gracefully', () => {
      // Projects dir exists but is empty
      const { stdout, exitCode } = runCli('list', TEST_DATA_DIR);

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toMatch(/no sessions/i);
    });

    it('should show JSON empty array for empty directory with --json', () => {
      const { stdout, exitCode } = runCli('list --json', TEST_DATA_DIR);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
