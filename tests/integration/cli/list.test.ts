/**
 * Integration tests for list command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');
const TEST_DATA_DIR = resolve(process.cwd(), 'tests/fixtures/cli-test-data');
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
  sessionLabel: string,
  messages: Array<{ type: string; content: string }>
): void {
  const sessionId = generateTestUUID();
  const encodedPath = projectPath.replace(/\//g, '-');
  const sessionDir = join(TEST_PROJECTS_DIR, encodedPath);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }

  const entries = messages.map((msg, i) => ({
    type: msg.type,
    uuid: `msg-${i}`,
    parentUuid: i > 0 ? `msg-${i - 1}` : null,
    timestamp: new Date(Date.now() - (messages.length - i) * 60000).toISOString(),
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
    uuid: 'summary-1',
    parentUuid: null,
    timestamp: new Date().toISOString(),
    summary: `Test session: ${sessionLabel}`,
    leafUuid: `msg-${messages.length - 1}`,
  } as unknown as (typeof entries)[0]);

  const jsonlContent = entries.map((e) => JSON.stringify(e)).join('\n');
  writeFileSync(join(sessionDir, `${sessionId}.jsonl`), jsonlContent);
}

/**
 * Execute CLI command and return stdout
 */
function runCli(args: string, dataPath?: string): { stdout: string; exitCode: number } {
  const dataPathArg = dataPath ? `--data-path "${dataPath}"` : `--data-path "${TEST_DATA_DIR}"`;
  try {
    const stdout = execSync(`node ${CLI_PATH} ${dataPathArg} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { stdout, exitCode: 0 };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      return {
        stdout: (error as { stdout?: string }).stdout || '',
        exitCode: (error as { status: number }).status || 1,
      };
    }
    throw error;
  }
}

describe('cch list', () => {
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

  describe('basic output (T012)', () => {
    it('should display session table with headers', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Hello' },
        { type: 'assistant', content: 'Hi there!' },
      ]);

      const { stdout, exitCode } = runCli('list');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('IDX');
      expect(stdout).toContain('TIMESTAMP');
      expect(stdout).toContain('PROJECT');
      expect(stdout).toContain('SUMMARY');
      expect(stdout).toContain('MSGS');
    });

    it('should show session index, timestamp, project, summary, and message count', () => {
      createTestSession('/Users/dev/myproject', 'session-1', [
        { type: 'user', content: 'Test message' },
        { type: 'assistant', content: 'Response' },
      ]);

      const { stdout, exitCode } = runCli('list');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('0'); // Index
      expect(stdout).toContain('myproject'); // Project name
      expect(stdout).toContain('Test session'); // Summary
    });

    it('should show empty message when no sessions exist', () => {
      const { stdout, exitCode } = runCli('list');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('No sessions found');
    });
  });

  describe('--json output (T013)', () => {
    it('should output valid JSON with success flag', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Hello' },
        { type: 'assistant', content: 'Hi' },
      ]);

      const { stdout, exitCode } = runCli('list --json');

      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should include pagination info in JSON output', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Hello' },
      ]);

      const { stdout } = runCli('list --json');
      const json = JSON.parse(stdout);

      expect(json.pagination).toBeDefined();
      expect(typeof json.pagination.total).toBe('number');
      expect(typeof json.pagination.offset).toBe('number');
      expect(typeof json.pagination.limit).toBe('number');
      expect(typeof json.pagination.hasMore).toBe('boolean');
    });

    it('should include session index in each data item', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Hello' },
      ]);

      const { stdout } = runCli('list --json');
      const json = JSON.parse(stdout);

      expect(json.data[0].index).toBe(0);
    });
  });

  describe('--workspace filter (T014)', () => {
    it('should filter sessions by workspace path', () => {
      createTestSession('/Users/dev/project-a', 'session-1', [
        { type: 'user', content: 'Project A' },
      ]);
      createTestSession('/Users/dev/project-b', 'session-2', [
        { type: 'user', content: 'Project B' },
      ]);

      const { stdout, exitCode } = runCli('list --workspace /Users/dev/project-a');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('project-a');
      expect(stdout).not.toContain('project-b');
    });

    it('should show message when no sessions match workspace filter', () => {
      createTestSession('/Users/dev/project-a', 'session-1', [
        { type: 'user', content: 'Hello' },
      ]);

      const { stdout } = runCli('list --workspace /nonexistent/path');

      expect(stdout).toContain('No sessions found');
    });
  });

  describe('--limit and --offset pagination (T015)', () => {
    it('should respect --limit option', () => {
      // Create multiple sessions
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First' },
      ]);
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Second' },
      ]);
      createTestSession('/Users/dev/project3', 'session-3', [
        { type: 'user', content: 'Third' },
      ]);

      const { stdout } = runCli('list --limit 2 --json');
      const json = JSON.parse(stdout);

      expect(json.data.length).toBeLessThanOrEqual(2);
    });

    it('should respect --offset option', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First' },
      ]);
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Second' },
      ]);

      const { stdout } = runCli('list --offset 1 --json');
      const json = JSON.parse(stdout);

      // Offset 1 should start from index 1
      if (json.data.length > 0) {
        expect(json.data[0].index).toBe(1);
      }
    });

    it('should show pagination hint when more results available', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First' },
      ]);
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Second' },
      ]);
      createTestSession('/Users/dev/project3', 'session-3', [
        { type: 'user', content: 'Third' },
      ]);

      const { stdout } = runCli('list --limit 1 --full');

      expect(stdout).toContain('--offset');
    });
  });

  describe('error handling', () => {
    it('should handle invalid data path gracefully', () => {
      const { exitCode } = runCli('list', '/nonexistent/path');

      expect(exitCode).not.toBe(0);
    });
  });
});
