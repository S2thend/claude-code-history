/**
 * Integration tests for view command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');
const TEST_DATA_DIR = resolve(process.cwd(), 'tests/fixtures/cli-view-test-data');
const TEST_PROJECTS_DIR = join(TEST_DATA_DIR, 'projects');

// Store session IDs for reference in tests
let testSessionIds: string[] = [];

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
 * Create a test session file and return the session UUID
 */
function createTestSession(
  projectPath: string,
  sessionLabel: string,
  messages: { type: string; content: string }[],
  options?: { summary?: string }
): string {
  const sessionId = generateTestUUID();
  const encodedPath = projectPath.replace(/\//g, '-');
  const sessionDir = join(TEST_PROJECTS_DIR, encodedPath);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }

  const entries = messages.map((msg, i) => ({
    type: msg.type,
    uuid: `msg-${sessionId}-${i}`,
    parentUuid: i > 0 ? `msg-${sessionId}-${i - 1}` : null,
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
    uuid: `summary-${sessionId}`,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    summary: options?.summary ?? `Test session: ${sessionLabel}`,
    leafUuid: `msg-${sessionId}-${messages.length - 1}`,
  } as unknown as (typeof entries)[0]);

  const jsonlContent = entries.map((e) => JSON.stringify(e)).join('\n');
  writeFileSync(join(sessionDir, `${sessionId}.jsonl`), jsonlContent);

  testSessionIds.push(sessionId);
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

describe('cch view', () => {
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
    // Reset session tracking and UUID counter
    testSessionIds = [];
    uuidCounter = 0;

    // Clean and recreate test data for each test
    if (existsSync(TEST_PROJECTS_DIR)) {
      rmSync(TEST_PROJECTS_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJECTS_DIR, { recursive: true });
  });

  describe('view by index (T022)', () => {
    it('should display session content when using index 0', () => {
      createTestSession('/Users/dev/project1', 'session-abc-123', [
        { type: 'user', content: 'Hello Claude!' },
        { type: 'assistant', content: 'Hello! How can I help you today?' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --full');

      expect(exitCode).toBe(0);
      // Session ID is a UUID, check for UUID pattern
      expect(stdout).toMatch(/aaaaaaaa-bbbb-cccc-dddd-[0-9a-f]{12}/);
      expect(stdout).toContain('Hello Claude!');
      expect(stdout).toContain('Hello! How can I help you today?');
    });

    it('should display user and assistant labels', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'User message here' },
        { type: 'assistant', content: 'Assistant response here' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('USER');
      expect(stdout).toContain('ASSISTANT');
    });

    it('should display message timestamps', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
        { type: 'assistant', content: 'Response' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --full');

      expect(exitCode).toBe(0);
      // Timestamp format: HH:MM:SS
      expect(stdout).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('should display session metadata header', () => {
      createTestSession('/Users/dev/myproject', 'session-xyz', [
        { type: 'user', content: 'Test' },
      ], { summary: 'Test session summary' });

      const { stdout, exitCode } = runCli('view 0 --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Session:');
      expect(stdout).toContain('Project:');
      expect(stdout).toContain('myproject');
      expect(stdout).toContain('Summary:');
      expect(stdout).toContain('Test session summary');
    });

    it('should handle viewing session at index other than 0', () => {
      createTestSession('/Users/dev/project1', 'session-first', [
        { type: 'user', content: 'First session' },
      ]);
      createTestSession('/Users/dev/project2', 'session-second', [
        { type: 'user', content: 'Second session' },
      ]);

      const { stdout, exitCode } = runCli('view 1 --full');

      // Should show one of the sessions (order may vary)
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/session-(first|second)/);
    });
  });

  describe('view by UUID (T023)', () => {
    it('should display session content when using full UUID', () => {
      const sessionId = createTestSession('/Users/dev/project1', 'session-uuid-test-123', [
        { type: 'user', content: 'UUID test message' },
        { type: 'assistant', content: 'UUID test response' },
      ]);

      const { stdout, exitCode } = runCli(`view ${sessionId} --full`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('UUID test message');
      expect(stdout).toContain('UUID test response');
    });

    it('should display correct session when multiple sessions exist', () => {
      createTestSession('/Users/dev/project1', 'session-aaa', [
        { type: 'user', content: 'First session content' },
      ]);
      const targetSession = createTestSession('/Users/dev/project2', 'session-bbb', [
        { type: 'user', content: 'Target session content' },
      ]);
      createTestSession('/Users/dev/project3', 'session-ccc', [
        { type: 'user', content: 'Third session content' },
      ]);

      const { stdout, exitCode } = runCli(`view ${targetSession} --full`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Target session content');
      expect(stdout).not.toContain('First session content');
      expect(stdout).not.toContain('Third session content');
    });
  });

  describe('--json output (T024)', () => {
    it('should output valid JSON with success flag', () => {
      createTestSession('/Users/dev/project1', 'session-json-1', [
        { type: 'user', content: 'Hello' },
        { type: 'assistant', content: 'Hi' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --json');

      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('should include session metadata in JSON output', () => {
      createTestSession('/Users/dev/myproject', 'session-json-meta', [
        { type: 'user', content: 'Test' },
      ], { summary: 'JSON test summary' });

      const { stdout } = runCli('view 0 --json');
      const json = JSON.parse(stdout);

      // Session ID is a UUID
      expect(json.data.id).toMatch(/aaaaaaaa-bbbb-cccc-dddd-[0-9a-f]{12}/);
      expect(json.data.projectPath).toContain('myproject');
      expect(json.data.summary).toBe('JSON test summary');
    });

    it('should include messages array in JSON output', () => {
      createTestSession('/Users/dev/project1', 'session-json-msgs', [
        { type: 'user', content: 'User message' },
        { type: 'assistant', content: 'Assistant response' },
      ]);

      const { stdout } = runCli('view 0 --json');
      const json = JSON.parse(stdout);

      expect(Array.isArray(json.data.messages)).toBe(true);
      expect(json.data.messages.length).toBeGreaterThan(0);
    });

    it('should include message count in JSON output', () => {
      createTestSession('/Users/dev/project1', 'session-json-count', [
        { type: 'user', content: 'One' },
        { type: 'assistant', content: 'Two' },
        { type: 'user', content: 'Three' },
      ]);

      const { stdout } = runCli('view 0 --json');
      const json = JSON.parse(stdout);

      expect(json.data.messageCount).toBeDefined();
      expect(typeof json.data.messageCount).toBe('number');
    });
  });

  describe('error handling for invalid session (T025)', () => {
    it('should return error for non-existent index', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('view 999 --json');

      expect(exitCode).not.toBe(0);
      // Error could be in stdout (JSON) or stderr
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found|error/i);
    });

    it('should return error for non-existent UUID', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('view nonexistent-uuid-12345 --json');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found|error/i);
    });

    it('should provide helpful suggestion when session not found', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { stdout, stderr } = runCli('view 999');

      // Should suggest running list command
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/list|available/i);
    });

    it('should return JSON error format with --json flag', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { stdout, exitCode } = runCli('view 999 --json');

      expect(exitCode).not.toBe(0);
      const json = JSON.parse(stdout);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should handle missing session argument', () => {
      const { exitCode, stdout, stderr } = runCli('view');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/required|missing|argument/i);
    });
  });

  describe('token usage display', () => {
    it('should display token count for assistant messages', () => {
      createTestSession('/Users/dev/project1', 'session-tokens', [
        { type: 'user', content: 'Test' },
        { type: 'assistant', content: 'Response with tokens' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --full');

      expect(exitCode).toBe(0);
      // Token count should appear: inputTokens (100) + outputTokens (200) = 300
      expect(stdout).toContain('tokens');
    });
  });
});
