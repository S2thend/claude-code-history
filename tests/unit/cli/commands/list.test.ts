/**
 * Unit tests for list command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerListCommand } from '../../../../src/cli/commands/list.js';

// Mock the lib module with partial mocking
vi.mock('../../../../src/lib/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lib/index.js')>();
  return {
    ...actual,
    listSessions: vi.fn(),
    getSession: vi.fn(),
    isDataNotFoundError: vi.fn(),
    computeTokenStats: vi.fn(),
    createEmptyStats: vi.fn(),
    addStats: vi.fn(),
  };
});

// Mock the pager to avoid TTY issues
vi.mock('../../../../src/cli/formatters/pager.js', () => ({
  outputWithPager: vi.fn(),
}));

import { listSessions, getSession, isDataNotFoundError, createEmptyStats, computeTokenStats, addStats } from '../../../../src/lib/index.js';
import { outputWithPager } from '../../../../src/cli/formatters/pager.js';

describe('list command', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('-j, --json', 'Output as JSON');
    program.option('-f, --full', 'Full output');
    program.option('-d, --data-path <path>', 'Custom data path');
    registerListCommand(program);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Reset mocks
    vi.mocked(listSessions).mockReset();
    vi.mocked(getSession).mockReset();
    vi.mocked(isDataNotFoundError).mockReset();
    vi.mocked(outputWithPager).mockReset();
    vi.mocked(createEmptyStats).mockReset();
    vi.mocked(computeTokenStats).mockReset();
    vi.mocked(addStats).mockReset();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should list sessions in table format', async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: [
        {
          id: 'session-1',
          projectPath: '/test/project',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          messageCount: 5,
          summary: 'Test session',
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
    });
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'list']);

    expect(listSessions).toHaveBeenCalled();
    expect(outputWithPager).toHaveBeenCalled();
  });

  it('should output JSON when --json flag is set', async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: [
        {
          id: 'session-1',
          projectPath: '/test/project',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          messageCount: 5,
          summary: 'Test session',
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
    });

    await program.parseAsync(['node', 'test', 'list', '--json']);

    expect(listSessions).toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalled();
    // JSON output should be valid JSON
    const output = stdoutSpy.mock.calls[0][0];
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should show message when no sessions found', async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
    });

    await program.parseAsync(['node', 'test', 'list']);

    expect(consoleSpy).toHaveBeenCalledWith('No sessions found.');
  });

  it('should show workspace-specific message when filtering', async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
    });

    await program.parseAsync(['node', 'test', 'list', '--workspace', '/my/project']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/my/project'));
  });

  it('should handle DataNotFoundError', async () => {
    const error = new Error('Data not found');
    vi.mocked(listSessions).mockRejectedValue(error);
    vi.mocked(isDataNotFoundError).mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'list']);

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should compute aggregate stats when --stats flag is set', async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: [
        {
          id: 'session-1',
          projectPath: '/test/project',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          messageCount: 5,
          summary: 'Test session',
        },
      ],
      pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
    });
    vi.mocked(getSession).mockResolvedValue({
      id: 'session-1',
      projectPath: '/test/project',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      messageCount: 5,
      messages: [],
    } as any);
    vi.mocked(createEmptyStats).mockReturnValue({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      messageCount: 0,
    });
    vi.mocked(computeTokenStats).mockReturnValue({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      messageCount: 5,
    });
    vi.mocked(addStats).mockReturnValue({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      messageCount: 5,
    });
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'list', '--stats']);

    expect(createEmptyStats).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalled();
    expect(computeTokenStats).toHaveBeenCalled();
    expect(addStats).toHaveBeenCalled();
  });

  it('should pass limit and offset to listSessions', async () => {
    vi.mocked(listSessions).mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 10, offset: 5, hasMore: false },
    });

    await program.parseAsync(['node', 'test', 'list', '--limit', '10', '--offset', '5']);

    expect(listSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 5,
      })
    );
  });
});
