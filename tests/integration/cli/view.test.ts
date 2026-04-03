/**
 * Integration tests for view command
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { exportSessionToJson, exportSessionToMarkdown } from '../../../src/lib/export.js';
import { getSession } from '../../../src/lib/session.js';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');
const TEST_DATA_DIR = resolve(process.cwd(), 'tests/fixtures/cli-view-test-data');
const TEST_PROJECTS_DIR = join(TEST_DATA_DIR, 'projects');

// Store session IDs for reference in tests
let testSessionIds: string[] = [];

// Counter for generating unique UUIDs
let uuidCounter = 0;

const LONG_VIEW_TOOL_INPUT = {
  file_path: '/Users/dev/project-long/example.txt',
  old_string: `old-value ${'a'.repeat(1200)}...source`,
  new_string: `new-value ${'b'.repeat(1200)} 终`,
};
const LONG_VIEW_TOOL_RESULT = [
  'result-line-1',
  `tool-output ${'c'.repeat(1200)}`,
  'result-line-3',
].join('\n');
const LONG_VIEW_THINKING = `thinking ${'d'.repeat(1200)}`;
const LONG_VIEW_TEXT = `assistant-text ${'e'.repeat(1200)}`;

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
    message:
      msg.type === 'user'
        ? {
            role: 'user',
            content: msg.content,
          }
        : msg.type === 'progress'
          ? {
              role: 'assistant',
              content: [{ type: 'text', text: msg.content }],
            }
          : {
              role: 'assistant',
              model: 'claude-3-sonnet',
              content: [{ type: 'text', text: msg.content }],
              stop_reason: 'end_turn',
              usage: {
                input_tokens: 100,
                output_tokens: 200,
                cache_creation_input_tokens: 500,
                cache_read_input_tokens: 5000,
              },
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

function createRawSession(
  projectPath: string,
  sessionLabel: string,
  entries: Record<string, unknown>[]
): string {
  const sessionId = generateTestUUID();
  const encodedPath = projectPath.replace(/\//g, '-');
  const sessionDir = join(TEST_PROJECTS_DIR, encodedPath);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }

  const resolvedEntries = entries.map((entry) => ({ ...entry, sessionId }));
  const leafUuid = String(resolvedEntries.at(-1)?.uuid ?? '');
  resolvedEntries.unshift({
    type: 'summary',
    uuid: `summary-${sessionId}`,
    parentUuid: null,
    timestamp: new Date().toISOString(),
    summary: `Test session: ${sessionLabel}`,
    leafUuid,
  });

  const jsonlContent = resolvedEntries.map((entry) => JSON.stringify(entry)).join('\n');
  writeFileSync(join(sessionDir, `${sessionId}.jsonl`), jsonlContent);

  testSessionIds.push(sessionId);
  return sessionId;
}

function createNestedAgentSession(
  projectPath: string,
  ownerSessionId: string,
  agentId: string,
  contentText: string
): void {
  const encodedPath = projectPath.replace(/\//g, '-');
  const subagentsDir = join(TEST_PROJECTS_DIR, encodedPath, ownerSessionId, 'subagents');
  mkdirSync(subagentsDir, { recursive: true });

  const entries = [
    {
      type: 'summary',
      uuid: `summary-agent-${agentId}`,
      parentUuid: null,
      timestamp: new Date().toISOString(),
      summary: `Agent session: ${agentId}`,
      leafUuid: `agent-${agentId}-assistant`,
    },
    {
      type: 'user',
      uuid: `agent-${agentId}-user`,
      parentUuid: null,
      timestamp: new Date().toISOString(),
      sessionId: ownerSessionId,
      agentId,
      cwd: projectPath,
      gitBranch: 'main',
      version: '2.0.0',
      isSidechain: true,
      message: {
        role: 'user',
        content: `Prompt for ${agentId}`,
      },
    },
    {
      type: 'assistant',
      uuid: `agent-${agentId}-assistant`,
      parentUuid: `agent-${agentId}-user`,
      timestamp: new Date().toISOString(),
      sessionId: ownerSessionId,
      agentId,
      message: {
        role: 'assistant',
        model: 'claude-3-haiku',
        content: [{ type: 'text', text: contentText }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    },
  ];

  writeFileSync(
    join(subagentsDir, `agent-${agentId}.jsonl`),
    entries.map(JSON.stringify).join('\n')
  );
}

function createLongToolSession(projectPath: string, sessionLabel: string): string {
  return createRawSession(projectPath, sessionLabel, [
    {
      type: 'user',
      uuid: `msg-${sessionLabel}-0`,
      parentUuid: null,
      timestamp: new Date(Date.now() - 3000).toISOString(),
      cwd: projectPath,
      gitBranch: 'main',
      version: '2.0.0',
      message: {
        role: 'user',
        content: `Prompt with source ellipsis ... ${'u'.repeat(64)}`,
      },
    },
    {
      type: 'assistant',
      uuid: `msg-${sessionLabel}-1`,
      parentUuid: `msg-${sessionLabel}-0`,
      timestamp: new Date(Date.now() - 2000).toISOString(),
      message: {
        role: 'assistant',
        model: 'claude-3-sonnet',
        content: [
          { type: 'thinking', thinking: LONG_VIEW_THINKING },
          { type: 'text', text: LONG_VIEW_TEXT },
          {
            type: 'tool_use',
            id: `tool-${sessionLabel}`,
            name: 'Edit',
            input: LONG_VIEW_TOOL_INPUT,
          },
        ],
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 5000,
        },
      },
    },
    {
      type: 'user',
      uuid: `msg-${sessionLabel}-2`,
      parentUuid: `msg-${sessionLabel}-1`,
      timestamp: new Date(Date.now() - 1000).toISOString(),
      cwd: projectPath,
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: `tool-${sessionLabel}`,
            content: LONG_VIEW_TOOL_RESULT,
          },
        ],
      },
    },
    {
      type: 'user',
      uuid: `msg-${sessionLabel}-3`,
      parentUuid: `msg-${sessionLabel}-2`,
      timestamp: new Date().toISOString(),
      cwd: projectPath,
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: `fallback-${sessionLabel}`,
            content: `fallback ${'f'.repeat(1200)}`,
          },
        ],
      },
    },
  ]);
}

/**
 * Execute CLI command and return stdout/stderr
 */
function runCli(
  args: string,
  dataPath?: string
): { stdout: string; stderr: string; exitCode: number } {
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
      createTestSession(
        '/Users/dev/myproject',
        'session-xyz',
        [{ type: 'user', content: 'Test' }],
        { summary: 'Test session summary' }
      );

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
      createTestSession(
        '/Users/dev/myproject',
        'session-json-meta',
        [{ type: 'user', content: 'Test' }],
        { summary: 'JSON test summary' }
      );

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

    it('should preserve progress messages in JSON output', () => {
      createTestSession('/Users/dev/project1', 'progress-json', [
        { type: 'user', content: 'Start scan' },
        { type: 'progress', content: 'Tool is scanning project files...' },
        { type: 'assistant', content: 'Done' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --json');
      const json = JSON.parse(stdout);

      expect(exitCode).toBe(0);
      expect(
        json.data.messages.some((message: { type: string }) => message.type === 'progress')
      ).toBe(true);
    });
  });

  describe('full-detail mode rendering', () => {
    it('should render complete long tool and thinking content with --full while preserving no-pager output', () => {
      const sessionId = createLongToolSession('/Users/dev/project-long', 'long-full-mode');

      const { stdout, exitCode } = runCli(`view ${sessionId} --full`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(LONG_VIEW_TEXT);
      expect(stdout).toContain(LONG_VIEW_THINKING);
      expect(stdout).toContain(`"file_path": "${LONG_VIEW_TOOL_INPUT.file_path}"`);
      expect(stdout).toContain(`"old_string": "${LONG_VIEW_TOOL_INPUT.old_string}"`);
      expect(stdout).toContain(`"new_string": "${LONG_VIEW_TOOL_INPUT.new_string}"`);
      expect(stdout).toContain('result-line-1');
      expect(stdout).toContain(`tool-output ${'c'.repeat(1200)}`);
      expect(stdout).toContain('result-line-3');
      expect(stdout).not.toContain('[...truncated for display]');
    });
  });

  describe('default concise rendering and full-fidelity data invariants', () => {
    it('should visibly abbreviate default output while preserving source ellipses, metadata, order, and tool pairing', () => {
      const sessionId = createLongToolSession('/Users/dev/project-long', 'long-default-mode');

      const { stdout, exitCode } = runCli(`view ${sessionId}`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Session:');
      expect(stdout).toContain('Project: /Users/dev/project/long');
      expect(stdout).toContain('Summary: Test session: long-default-mode');
      expect(stdout).toContain('Prompt with source ellipsis ...');
      expect(stdout).toContain('[...truncated for display]');
      expect(stdout.indexOf('USER')).toBeLessThan(stdout.indexOf('ASSISTANT'));
      expect(stdout.indexOf('[Tool: Edit]')).toBeLessThan(stdout.indexOf('→ Result:'));
      expect(stdout).toContain(`tool-output ${'c'.repeat(300)}`);
      expect(stdout).not.toContain(`tool-output ${'c'.repeat(1200)}`);
    });

    it('should keep JSON output and later library/export retrieval unchanged after default and full human-readable viewing', async () => {
      const sessionId = createLongToolSession('/Users/dev/project-long', 'long-json-invariance');

      const defaultView = runCli(`view ${sessionId}`);
      const fullView = runCli(`view ${sessionId} --full`);
      const jsonView = runCli(`view ${sessionId} --json`);

      expect(defaultView.exitCode).toBe(0);
      expect(fullView.exitCode).toBe(0);
      expect(jsonView.exitCode).toBe(0);

      const json = JSON.parse(jsonView.stdout) as {
        success: boolean;
        data: {
          messages: {
            uuid: string;
            parentUuid: string | null;
            type: string;
            content:
              | string
              | (
                  | { type: 'thinking'; thinking: string }
                  | { type: 'text'; text: string }
                  | { type: 'tool_use'; id: string; input: Record<string, unknown> }
                  | { type: 'tool_result'; tool_use_id: string; content: string }
                )[];
          }[];
        };
      };

      expect(json.success).toBe(true);
      expect(jsonView.stdout).not.toContain('[...truncated for display]');

      const session = await getSession(sessionId, { dataPath: TEST_DATA_DIR });
      const exportedJson = JSON.parse(
        await exportSessionToJson(sessionId, { dataPath: TEST_DATA_DIR })
      ) as {
        messages: typeof session.messages;
      };
      const exportedMarkdown = await exportSessionToMarkdown(sessionId, {
        dataPath: TEST_DATA_DIR,
      });

      expect(session.messages.map((message) => message.uuid)).toEqual([
        'summary-aaaaaaaa-bbbb-cccc-dddd-000000000001',
        'msg-long-json-invariance-0',
        'msg-long-json-invariance-1',
        'msg-long-json-invariance-2',
        'msg-long-json-invariance-3',
      ]);
      expect(session.messages[1].parentUuid).toBe(null);
      expect(session.messages[2].parentUuid).toBe('msg-long-json-invariance-0');

      const assistantMessage = session.messages[2];
      expect(assistantMessage.type).toBe('assistant');
      if (assistantMessage.type === 'assistant') {
        expect(assistantMessage.content[0]).toEqual({
          type: 'thinking',
          thinking: LONG_VIEW_THINKING,
        });
        expect(assistantMessage.content[1]).toEqual({
          type: 'text',
          text: LONG_VIEW_TEXT,
        });
        expect(assistantMessage.content[2]).toEqual({
          type: 'tool_use',
          id: 'tool-long-json-invariance',
          name: 'Edit',
          input: LONG_VIEW_TOOL_INPUT,
        });
      }

      const toolResultMessage = session.messages[3];
      expect(toolResultMessage.type).toBe('user');
      if (toolResultMessage.type === 'user') {
        expect(toolResultMessage.parentUuid).toBe('msg-long-json-invariance-1');
        expect(toolResultMessage.content).toEqual([
          {
            type: 'tool_result',
            tool_use_id: 'tool-long-json-invariance',
            content: LONG_VIEW_TOOL_RESULT,
          },
        ]);
      }

      const jsonUserMessage = json.data.messages.find(
        (message) => message.uuid === 'msg-long-json-invariance-0'
      );
      const jsonAssistantMessage = json.data.messages.find(
        (message) => message.uuid === 'msg-long-json-invariance-1'
      );

      expect(jsonUserMessage?.content).toBe('Prompt with source ellipsis ... ' + 'u'.repeat(64));
      expect(jsonAssistantMessage?.content).toEqual(
        session.messages[2].type === 'assistant' ? session.messages[2].content : []
      );
      expect(exportedJson.messages).toEqual(JSON.parse(JSON.stringify(session.messages)));
      expect(exportedMarkdown).toContain(LONG_VIEW_THINKING);
      expect(exportedMarkdown).toContain(LONG_VIEW_TEXT);
      expect(exportedMarkdown).toContain(LONG_VIEW_TOOL_INPUT.old_string);
      expect(exportedMarkdown).toContain(LONG_VIEW_TOOL_INPUT.new_string);
      expect(exportedMarkdown).toContain(LONG_VIEW_TOOL_RESULT);
      expect(exportedMarkdown).not.toContain('[...truncated for display]');
    });
  });

  describe('progress rendering and filtering', () => {
    it('should show progress messages in the transcript order', () => {
      createTestSession('/Users/dev/project1', 'progress-view', [
        { type: 'user', content: 'Start scan' },
        { type: 'progress', content: 'Tool is scanning project files...' },
        { type: 'assistant', content: 'Done' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('PROGRESS');
      expect(stdout).toContain('Tool is scanning project files...');
      expect(stdout.indexOf('USER')).toBeLessThan(stdout.indexOf('PROGRESS'));
      expect(stdout.indexOf('PROGRESS')).toBeLessThan(stdout.indexOf('ASSISTANT'));
    });

    it('should support the dedicated --only progress filter', () => {
      createTestSession('/Users/dev/project1', 'progress-only', [
        { type: 'user', content: 'Start scan' },
        { type: 'progress', content: 'Tool is scanning project files...' },
        { type: 'assistant', content: 'Done' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --only progress --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('PROGRESS');
      expect(stdout).toContain('Tool is scanning project files...');
      expect(stdout).not.toContain('ASSISTANT');
      expect(stdout).not.toContain('USER');
    });

    it('should render readable text from nested real-style agent progress entries', () => {
      createRawSession('/Users/dev/project1', 'progress-real-schema', [
        {
          type: 'user',
          uuid: 'msg-user',
          parentUuid: null,
          timestamp: new Date(Date.now() - 120000).toISOString(),
          cwd: '/Users/dev/project1',
          gitBranch: 'main',
          version: '2.1.9',
          message: {
            role: 'user',
            content: 'Start scan',
          },
        },
        {
          type: 'progress',
          uuid: 'msg-progress',
          parentUuid: 'msg-user',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          cwd: '/Users/dev/project1',
          gitBranch: 'main',
          version: '2.1.9',
          data: {
            type: 'agent_progress',
            message: {
              type: 'assistant',
              message: {
                role: 'assistant',
                content: [{ type: 'tool_use', id: 'toolu_123', name: 'Glob', input: {} }],
              },
            },
            normalizedMessages: [
              {
                type: 'assistant',
                message: {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'I will scan the project files now.' }],
                },
              },
              {
                type: 'assistant',
                message: {
                  role: 'assistant',
                  content: [{ type: 'tool_use', id: 'toolu_123', name: 'Glob', input: {} }],
                },
              },
            ],
          },
        },
        {
          type: 'assistant',
          uuid: 'msg-assistant',
          parentUuid: 'msg-progress',
          timestamp: new Date().toISOString(),
          message: {
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [{ type: 'text', text: 'Done' }],
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 100,
              output_tokens: 200,
              cache_creation_input_tokens: 500,
              cache_read_input_tokens: 5000,
            },
          },
        },
      ]);

      const { stdout, exitCode } = runCli('view 0 --only progress --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('PROGRESS');
      expect(stdout).toContain('I will scan the project files now.');
      expect(stdout).not.toContain('No human-readable progress text captured');
    });

    it('should return an informative empty state when no progress messages exist', () => {
      createTestSession('/Users/dev/project1', 'no-progress', [
        { type: 'user', content: 'Start scan' },
        { type: 'assistant', content: 'Done' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --only progress --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('No messages match filter: progress');
    });
  });

  describe('direct agent lookup', () => {
    it('should open a linked nested agent transcript by bare agent ID', () => {
      const ownerSessionId = createRawSession('/Users/dev/agent-project', 'agent-parent', [
        {
          type: 'assistant',
          uuid: 'msg-agent-parent-001',
          parentUuid: null,
          timestamp: new Date().toISOString(),
          message: {
            role: 'assistant',
            model: 'claude-3-sonnet',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_agent_001',
                name: 'Agent',
                input: {
                  description: 'Inspect nested agents',
                  prompt: 'Inspect nested agents',
                  subagent_type: 'Explore',
                },
              },
            ],
            stop_reason: 'tool_use',
            usage: {
              input_tokens: 1,
              output_tokens: 1,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          },
        },
        {
          type: 'user',
          uuid: 'msg-agent-parent-002',
          parentUuid: 'msg-agent-parent-001',
          timestamp: new Date().toISOString(),
          cwd: '/Users/dev/agent-project',
          gitBranch: 'main',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'toolu_agent_001', content: 'Done' }],
          },
          toolUseResult: {
            status: 'completed',
            agentId: 'agentlookup123',
          },
        },
      ]);
      createNestedAgentSession(
        '/Users/dev/agent-project',
        ownerSessionId,
        'agentlookup123',
        'Nested agent transcript content'
      );

      const { stdout, exitCode } = runCli('view agentlookup123 --full');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Nested agent transcript content');
    });

    it('should return structured JSON ambiguity errors for duplicate agent IDs', () => {
      const firstOwner = createTestSession('/Users/dev/duplicate-a', 'duplicate-a', [
        { type: 'user', content: 'First duplicate parent' },
      ]);
      const secondOwner = createTestSession('/Users/dev/duplicate-b', 'duplicate-b', [
        { type: 'user', content: 'Second duplicate parent' },
      ]);
      createNestedAgentSession('/Users/dev/duplicate-a', firstOwner, 'dupagent777', 'First dup');
      createNestedAgentSession('/Users/dev/duplicate-b', secondOwner, 'dupagent777', 'Second dup');

      const { stdout, exitCode } = runCli('view dupagent777 --json');
      const json = JSON.parse(stdout);

      expect(exitCode).not.toBe(0);
      expect(json.success).toBe(false);
      expect(json.error.type).toBe('ambiguous-agent-id');
      expect(json.error.agentId).toBe('dupagent777');
    });

    it('should return structured JSON not-found errors for missing agent IDs', () => {
      createTestSession('/Users/dev/project1', 'session-1', [{ type: 'user', content: 'Test' }]);

      const { stdout, exitCode } = runCli('view missing456 --json');
      const json = JSON.parse(stdout);

      expect(exitCode).not.toBe(0);
      expect(json.success).toBe(false);
      expect(json.error.type).toBe('session-not-found');
      expect(json.error.agentId).toBe('missing456');
    });
  });

  describe('error handling for invalid session (T025)', () => {
    it('should return error for non-existent index', () => {
      createTestSession('/Users/dev/project1', 'session-1', [{ type: 'user', content: 'Test' }]);

      const { exitCode, stdout, stderr } = runCli('view 999 --json');

      expect(exitCode).not.toBe(0);
      // Error could be in stdout (JSON) or stderr
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found|error/i);
    });

    it('should return error for non-existent UUID', () => {
      createTestSession('/Users/dev/project1', 'session-1', [{ type: 'user', content: 'Test' }]);

      const { exitCode, stdout, stderr } = runCli('view nonexistent-uuid-12345 --json');

      expect(exitCode).not.toBe(0);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/not found|error/i);
    });

    it('should provide helpful suggestion when session not found', () => {
      createTestSession('/Users/dev/project1', 'session-1', [{ type: 'user', content: 'Test' }]);

      const { stdout, stderr } = runCli('view 999');

      // Should suggest running list command
      const output = stdout + stderr;
      expect(output.toLowerCase()).toMatch(/list|available/i);
    });

    it('should return JSON error format with --json flag', () => {
      createTestSession('/Users/dev/project1', 'session-1', [{ type: 'user', content: 'Test' }]);

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

    it('should display token usage summary footer with all four token types', () => {
      createTestSession('/Users/dev/project1', 'session-token-footer', [
        { type: 'user', content: 'Test message' },
        { type: 'assistant', content: 'Assistant response' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --full');

      expect(exitCode).toBe(0);
      // Check for token summary footer
      expect(stdout).toContain('Token Usage Summary');
      expect(stdout).toContain('Input tokens:');
      expect(stdout).toContain('Output tokens:');
      expect(stdout).toContain('Cache read tokens:');
      expect(stdout).toContain('Cache creation tokens:');
      expect(stdout).toContain('Total tokens:');
    });

    it('should include tokenStats in JSON output', () => {
      createTestSession('/Users/dev/project1', 'session-json-tokens', [
        { type: 'user', content: 'Test' },
        { type: 'assistant', content: 'Response' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --json');

      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      expect(json.data.tokenStats).toBeDefined();
      expect(json.data.tokenStats.inputTokens).toBe(100);
      expect(json.data.tokenStats.outputTokens).toBe(200);
      expect(json.data.tokenStats.cacheCreationInputTokens).toBe(500);
      expect(json.data.tokenStats.cacheReadInputTokens).toBe(5000);
      expect(json.data.tokenStats.totalTokens).toBe(5800);
    });

    it('should correctly aggregate tokens across multiple assistant messages', () => {
      createTestSession('/Users/dev/project1', 'session-multi-tokens', [
        { type: 'user', content: 'First question' },
        { type: 'assistant', content: 'First response' },
        { type: 'user', content: 'Second question' },
        { type: 'assistant', content: 'Second response' },
      ]);

      const { stdout, exitCode } = runCli('view 0 --json');

      expect(exitCode).toBe(0);
      const json = JSON.parse(stdout);
      // 2 assistant messages × (100 input + 200 output + 500 cache_create + 5000 cache_read)
      expect(json.data.tokenStats.inputTokens).toBe(200);
      expect(json.data.tokenStats.outputTokens).toBe(400);
      expect(json.data.tokenStats.cacheCreationInputTokens).toBe(1000);
      expect(json.data.tokenStats.cacheReadInputTokens).toBe(10000);
      expect(json.data.tokenStats.totalTokens).toBe(11600);
    });
  });
});
