/**
 * Integration tests for export command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');
const TEST_DATA_DIR = resolve(process.cwd(), 'tests/fixtures/cli-export-test-data');
const TEST_PROJECTS_DIR = join(TEST_DATA_DIR, 'projects');
const TEST_OUTPUT_DIR = resolve(process.cwd(), 'tests/fixtures/cli-export-output');

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
    summary: options?.summary ?? `Test session: ${sessionLabel}`,
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

describe('cch export', () => {
  beforeAll(() => {
    // Build CLI
    try {
      execSync('npm run build', { encoding: 'utf-8', timeout: 60000 });
    } catch {
      // Build might already be done
    }

    // Create test data directory
    mkdirSync(TEST_PROJECTS_DIR, { recursive: true });
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up test data
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
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
    // Clean up output files
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
      mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe('export to stdout JSON (T042)', () => {
    it('should export session to JSON format by default', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Hello' },
        { type: 'assistant', content: 'Hi there!' },
      ], { summary: 'Test export session' });

      const { stdout, exitCode } = runCli('export 0');

      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.id).toBeDefined();
      expect(json.messages).toBeDefined();
      expect(json.summary).toBe('Test export session');
    });

    it('should include session metadata in JSON', () => {
      createTestSession('/Users/dev/myproject', 'session-1', [
        { type: 'user', content: 'Test' },
      ], { summary: 'Metadata test' });

      const { stdout } = runCli('export 0 --format json');
      const json = JSON.parse(stdout);

      expect(json.id).toMatch(/aaaaaaaa-bbbb-cccc-dddd/);
      expect(json.projectPath).toContain('myproject');
      expect(json.summary).toBe('Metadata test');
      expect(json.messageCount).toBeDefined();
    });

    it('should include messages array in JSON', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'User message' },
        { type: 'assistant', content: 'Assistant response' },
      ]);

      const { stdout } = runCli('export 0');
      const json = JSON.parse(stdout);

      expect(Array.isArray(json.messages)).toBe(true);
      expect(json.messages.length).toBeGreaterThan(0);
    });
  });

  describe('export to stdout Markdown (T043)', () => {
    it('should export session to Markdown format', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Hello Markdown' },
        { type: 'assistant', content: 'Markdown response' },
      ], { summary: 'Markdown Test Session' });

      const { stdout, exitCode } = runCli('export 0 --format markdown');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('# Markdown Test Session');
      expect(stdout).toContain('## 👤 User');
      expect(stdout).toContain('## 🤖 Assistant');
    });

    it('should include metadata table in Markdown', () => {
      createTestSession('/Users/dev/myproject', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { stdout } = runCli('export 0 -F markdown');

      expect(stdout).toContain('| Property | Value |');
      expect(stdout).toContain('Session ID');
      expect(stdout).toContain('Project');
      expect(stdout).toContain('Messages');
    });

    it('should include message content in Markdown', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Specific user content here' },
        { type: 'assistant', content: 'Specific assistant response' },
      ]);

      const { stdout } = runCli('export 0 --format markdown');

      expect(stdout).toContain('Specific user content here');
      expect(stdout).toContain('Specific assistant response');
    });

    it('should accept "md" as format shorthand', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { stdout, exitCode } = runCli('export 0 --format md');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('#'); // Markdown heading
    });
  });

  describe('export to file with --output (T044)', () => {
    it('should write JSON to file', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'File export test' },
      ], { summary: 'File export' });

      const outputFile = join(TEST_OUTPUT_DIR, 'export.json');
      const { stdout, exitCode } = runCli(`export 0 --output "${outputFile}"`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Exported to');
      expect(existsSync(outputFile)).toBe(true);

      const content = readFileSync(outputFile, 'utf-8');
      const json = JSON.parse(content);
      expect(json.summary).toBe('File export');
    });

    it('should write Markdown to file', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Markdown file test' },
      ], { summary: 'MD File Test' });

      const outputFile = join(TEST_OUTPUT_DIR, 'export.md');
      const { exitCode } = runCli(`export 0 --format markdown --output "${outputFile}"`);

      expect(exitCode).toBe(0);
      expect(existsSync(outputFile)).toBe(true);

      const content = readFileSync(outputFile, 'utf-8');
      expect(content).toContain('# MD File Test');
      expect(content).toContain('Markdown file test');
    });

    it('should show file size in output message', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Size test' },
      ]);

      const outputFile = join(TEST_OUTPUT_DIR, 'size-test.json');
      const { stdout } = runCli(`export 0 --output "${outputFile}"`);

      expect(stdout).toMatch(/\d+ bytes/);
    });

    it('should return JSON result with --json flag when writing to file', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'JSON flag test' },
      ]);

      const outputFile = join(TEST_OUTPUT_DIR, 'json-flag.json');
      const { stdout } = runCli(`export 0 --output "${outputFile}" --json`);

      const result = JSON.parse(stdout);
      expect(result.success).toBe(true);
      expect(result.data.file).toBe(outputFile);
      expect(result.data.format).toBe('json');
    });
  });

  describe('export --all option (T045)', () => {
    it('should export all sessions to JSON', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First session' },
      ], { summary: 'First' });
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Second session' },
      ], { summary: 'Second' });

      const { stdout, exitCode } = runCli('export --all --format json');

      expect(exitCode).toBe(0);
      const sessions = JSON.parse(stdout);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(2);
    });

    it('should export all sessions to Markdown', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First markdown' },
      ], { summary: 'First MD' });
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Second markdown' },
      ], { summary: 'Second MD' });

      const { stdout, exitCode } = runCli('export --all --format markdown');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('First MD');
      expect(stdout).toContain('Second MD');
      expect(stdout).toContain('---'); // Session separator
    });

    it('should write all sessions to file', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First' },
      ]);
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Second' },
      ]);

      const outputFile = join(TEST_OUTPUT_DIR, 'all-sessions.json');
      const { exitCode } = runCli(`export --all --output "${outputFile}"`);

      expect(exitCode).toBe(0);
      expect(existsSync(outputFile)).toBe(true);

      const content = readFileSync(outputFile, 'utf-8');
      const sessions = JSON.parse(content);
      expect(sessions.length).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should error when no session specified and no --all flag', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('export');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/session|required|--all/i);
    });

    it('should error for invalid format', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('export 0 --format invalid');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/invalid|format/i);
    });

    it('should error for non-existent session', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Test' },
      ]);

      const { exitCode, stdout, stderr } = runCli('export 999');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found/i);
    });

    it('should handle invalid data path gracefully', () => {
      const { exitCode } = runCli('export 0', '/nonexistent/path');

      expect(exitCode).not.toBe(0);
    });
  });
});
