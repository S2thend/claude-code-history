/**
 * Integration tests for search command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');
const TEST_DATA_DIR = resolve(process.cwd(), 'tests/fixtures/cli-search-test-data');
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

describe('cch search', () => {
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

  describe('basic search (T033)', () => {
    it('should find matches across sessions', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'How do I use TypeScript generics?' },
        { type: 'assistant', content: 'TypeScript generics allow you to write reusable code.' },
      ]);

      const { stdout, exitCode } = runCli('search "TypeScript" --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('TypeScript');
      expect(stdout).toContain('matches for');
    });

    it('should show session info for each match', () => {
      createTestSession('/Users/dev/myproject', 'session-1', [
        { type: 'user', content: 'Search test keyword here' },
      ], { summary: 'Test summary for search' });

      const { stdout, exitCode } = runCli('search "keyword" --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('myproject');
      expect(stdout).toContain('Session:');
    });

    it('should show context lines around matches', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Line 1\nLine 2\nSearch target here\nLine 4\nLine 5' },
      ]);

      const { stdout, exitCode } = runCli('search "target" --context 2 --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('target');
      // Should show surrounding lines
      expect(stdout).toContain('Line 2');
      expect(stdout).toContain('Line 4');
    });

    it('should show message when no matches found', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Hello world' },
      ]);

      const { stdout, exitCode } = runCli('search "nonexistent12345" --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('No matches found');
    });

    it('should be case-insensitive', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'TypeScript is great' },
      ]);

      const { stdout, exitCode } = runCli('search "typescript" --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('TypeScript');
    });
  });

  describe('--session filter (T034)', () => {
    it('should search only within specified session by index', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First session with keyword' },
      ]);
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Second session with keyword' },
      ]);

      const { stdout, exitCode } = runCli('search "keyword" --session 0 --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('keyword');
      // Should only show matches from one session
    });

    it('should search within specified session by UUID', () => {
      const sessionId = createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Session with unique content xyz123' },
      ]);

      const { stdout, exitCode } = runCli(`search "xyz123" --session ${sessionId} --full`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('xyz123');
    });
  });

  describe('--context option (T035)', () => {
    it('should respect context line count', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Line A\nLine B\nLine C\nTarget line\nLine E\nLine F\nLine G' },
      ]);

      // With context 1, should show 1 line before and after
      const { stdout: stdout1 } = runCli('search "Target" --context 1 --full');
      expect(stdout1).toContain('Line C');
      expect(stdout1).toContain('Line E');

      // With context 0, should show only the match line
      const { stdout: stdout0 } = runCli('search "Target" --context 0 --full');
      expect(stdout0).toContain('Target');
    });

    it('should default to 2 context lines', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'L1\nL2\nL3\nMatch here\nL5\nL6\nL7' },
      ]);

      const { stdout } = runCli('search "Match" --full');

      // Default context is 2
      expect(stdout).toContain('L2');
      expect(stdout).toContain('L6');
    });
  });

  describe('--json output (T036)', () => {
    it('should output valid JSON with success flag', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Searchable content here' },
      ]);

      const { stdout, exitCode } = runCli('search "Searchable" --json');

      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('should include matches array in JSON output', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Find this text' },
      ]);

      const { stdout } = runCli('search "Find" --json');
      const json = JSON.parse(stdout);

      expect(json.data.matches).toBeDefined();
      expect(Array.isArray(json.data.matches)).toBe(true);
    });

    it('should include pagination info in JSON output', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Search term' },
      ]);

      const { stdout } = runCli('search "Search" --json');
      const json = JSON.parse(stdout);

      expect(json.data.pagination).toBeDefined();
      expect(typeof json.data.pagination.total).toBe('number');
      expect(typeof json.data.pagination.offset).toBe('number');
      expect(typeof json.data.pagination.limit).toBe('number');
    });

    it('should include match details in JSON output', () => {
      createTestSession('/Users/dev/myproject', 'session-1', [
        { type: 'user', content: 'Unique search term 12345' },
      ]);

      const { stdout } = runCli('search "12345" --json');
      const json = JSON.parse(stdout);

      expect(json.data.matches.length).toBeGreaterThan(0);
      const match = json.data.matches[0];
      expect(match.sessionId).toBeDefined();
      expect(match.projectPath).toContain('myproject');
      expect(match.messageType).toBeDefined();
      expect(match.context).toBeDefined();
    });
  });

  describe('pagination', () => {
    it('should respect --limit option', () => {
      // Create multiple matches
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'Match1 keyword here' },
        { type: 'assistant', content: 'Match2 keyword response' },
      ]);
      createTestSession('/Users/dev/project2', 'session-2', [
        { type: 'user', content: 'Match3 keyword again' },
      ]);

      const { stdout } = runCli('search "keyword" --limit 2 --json');
      const json = JSON.parse(stdout);

      expect(json.data.matches.length).toBeLessThanOrEqual(2);
    });

    it('should respect --offset option', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'First keyword match' },
        { type: 'assistant', content: 'Second keyword match' },
      ]);

      const { stdout } = runCli('search "keyword" --offset 1 --limit 1 --json');
      const json = JSON.parse(stdout);

      expect(json.data.pagination.offset).toBe(1);
    });

    it('should show pagination hint when more results available', () => {
      createTestSession('/Users/dev/project1', 'session-1', [
        { type: 'user', content: 'word1 word2 word3' },
        { type: 'assistant', content: 'word4 word5 word6' },
      ]);

      const { stdout } = runCli('search "word" --limit 1 --full');

      expect(stdout).toContain('--offset');
    });
  });

  describe('error handling', () => {
    it('should handle invalid data path gracefully', () => {
      const { exitCode } = runCli('search "test"', '/nonexistent/path');

      expect(exitCode).not.toBe(0);
    });
  });
});
