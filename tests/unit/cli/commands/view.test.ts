/**
 * Unit tests for view command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerViewCommand } from '../../../../src/cli/commands/view.js';

// Mock the lib module with partial mocking
vi.mock('../../../../src/lib/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lib/index.js')>();
  return {
    ...actual,
    getSession: vi.fn(),
    isAmbiguousAgentSessionError: vi.fn(),
    isSessionNotFoundError: vi.fn(),
    isDataNotFoundError: vi.fn(),
    filterMessages: vi.fn(),
    computeTokenStats: vi.fn(),
  };
});

// Mock the pager to avoid TTY issues
vi.mock('../../../../src/cli/formatters/pager.js', () => ({
  outputWithPager: vi.fn(),
}));

import {
  getSession,
  isAmbiguousAgentSessionError,
  isSessionNotFoundError,
  isDataNotFoundError,
  filterMessages,
  computeTokenStats,
} from '../../../../src/lib/index.js';
import { outputWithPager } from '../../../../src/cli/formatters/pager.js';

describe('view command', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  const mockSession = {
    id: 'test-session-123',
    encodedPath: '-test-project',
    projectPath: '/test/project',
    summary: 'Test session',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    lastActivityAt: new Date('2024-01-15T10:00:05Z'),
    messageCount: 2,
    version: '2.0.55',
    gitBranch: 'main',
    agentIds: [],
    unresolvedAgentIds: [],
    messages: [
      {
        type: 'user',
        uuid: 'msg-1',
        parentUuid: null,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        content: 'Hello',
        cwd: '/test',
        gitBranch: 'main',
        isSidechain: false,
      },
      {
        type: 'assistant',
        uuid: 'msg-2',
        parentUuid: 'msg-1',
        timestamp: new Date('2024-01-15T10:00:05Z'),
        model: 'claude-3',
        content: [{ type: 'text', text: 'Hi there!' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 50, outputTokens: 25 },
      },
    ],
  };

  beforeEach(() => {
    program = new Command();
    program.option('-j, --json', 'Output as JSON');
    program.option('-f, --full', 'Full output');
    program.option('-d, --data-path <path>', 'Custom data path');
    registerViewCommand(program);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Reset mocks
    vi.mocked(getSession).mockReset();
    vi.mocked(isAmbiguousAgentSessionError).mockReset();
    vi.mocked(isSessionNotFoundError).mockReset();
    vi.mocked(isDataNotFoundError).mockReset();
    vi.mocked(filterMessages).mockReset();
    vi.mocked(computeTokenStats).mockReset();
    vi.mocked(outputWithPager).mockReset();

    vi.mocked(filterMessages).mockImplementation(
      (messages) => messages as typeof mockSession.messages
    );
    vi.mocked(computeTokenStats).mockReturnValue({
      inputTokens: 50,
      outputTokens: 25,
      totalTokens: 75,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      messageCount: 2,
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should view session by index', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'view', '0']);

    expect(getSession).toHaveBeenCalledWith(0, expect.any(Object));
    expect(outputWithPager).toHaveBeenCalled();
  });

  it('should view session by UUID', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'view', 'abc123-def456']);

    expect(getSession).toHaveBeenCalledWith('abc123-def456', expect.any(Object));
  });

  it('should output JSON when --json flag is set', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);

    await program.parseAsync(['node', 'test', 'view', '0', '--json']);

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0][0];
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should filter messages with --only flag', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(filterMessages).mockReturnValue([mockSession.messages[0]]);
    vi.mocked(computeTokenStats).mockReturnValue({
      inputTokens: 50,
      outputTokens: 25,
      totalTokens: 75,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      messageCount: 1,
    });
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'view', '0', '--only', 'user']);

    expect(filterMessages).toHaveBeenCalledWith(
      mockSession.messages,
      expect.objectContaining({ only: ['user'] })
    );
  });

  it('should handle SessionNotFoundError', async () => {
    const error = new Error('Session not found');
    vi.mocked(getSession).mockRejectedValue(error);
    vi.mocked(isAmbiguousAgentSessionError).mockReturnValue(false);
    vi.mocked(isSessionNotFoundError).mockReturnValue(true);
    vi.mocked(isDataNotFoundError).mockReturnValue(false);

    await program.parseAsync(['node', 'test', 'view', '999']);

    expect(processExitSpy).toHaveBeenCalledWith(3);
  });

  it('should handle DataNotFoundError', async () => {
    const error = new Error('Data not found');
    vi.mocked(getSession).mockRejectedValue(error);
    vi.mocked(isAmbiguousAgentSessionError).mockReturnValue(false);
    vi.mocked(isSessionNotFoundError).mockReturnValue(false);
    vi.mocked(isDataNotFoundError).mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'view', '0']);

    expect(processExitSpy).toHaveBeenCalledWith(4);
  });

  it('should reject invalid filter type', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);

    await program.parseAsync(['node', 'test', 'view', '0', '--only', 'invalid']);

    // Usage errors exit with code 2
    expect(processExitSpy).toHaveBeenCalledWith(2);
  });

  it('should handle multiple filter types', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(filterMessages).mockReturnValue(mockSession.messages);
    vi.mocked(computeTokenStats).mockReturnValue({
      inputTokens: 50,
      outputTokens: 25,
      totalTokens: 75,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      messageCount: 2,
    });
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'view', '0', '--only', 'user,assistant']);

    expect(filterMessages).toHaveBeenCalledWith(
      mockSession.messages,
      expect.objectContaining({ only: ['user', 'assistant'] })
    );
  });

  it('should accept progress as a valid filter type', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(filterMessages).mockReturnValue([]);
    vi.mocked(computeTokenStats).mockReturnValue({
      inputTokens: 50,
      outputTokens: 25,
      totalTokens: 75,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      messageCount: 2,
    });
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'view', '0', '--only', 'progress']);

    expect(filterMessages).toHaveBeenCalledWith(
      mockSession.messages,
      expect.objectContaining({ only: ['progress'] })
    );
  });

  it('should emit structured JSON for ambiguous direct agent lookups', async () => {
    const error = new Error('Agent ID is ambiguous: dupagent777');
    vi.mocked(getSession).mockRejectedValue(error);
    vi.mocked(isAmbiguousAgentSessionError).mockReturnValue(true);
    vi.mocked(isSessionNotFoundError).mockReturnValue(false);
    vi.mocked(isDataNotFoundError).mockReturnValue(false);

    await program.parseAsync(['node', 'test', 'view', 'dupagent777', '--json']);

    const output = String(stdoutSpy.mock.calls[0]?.[0] ?? '');
    const json = JSON.parse(output);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('ambiguous-agent-id');
    expect(json.error.agentId).toBe('dupagent777');
  });

  it('should emit structured JSON for missing direct agent lookups', async () => {
    const error = new Error('Session not found');
    vi.mocked(getSession).mockRejectedValue(error);
    vi.mocked(isAmbiguousAgentSessionError).mockReturnValue(false);
    vi.mocked(isSessionNotFoundError).mockReturnValue(true);
    vi.mocked(isDataNotFoundError).mockReturnValue(false);

    await program.parseAsync(['node', 'test', 'view', 'missing456', '--json']);

    const output = String(stdoutSpy.mock.calls[0]?.[0] ?? '');
    const json = JSON.parse(output);
    expect(json.success).toBe(false);
    expect(json.error.type).toBe('session-not-found');
    expect(json.error.agentId).toBe('missing456');
  });
});
