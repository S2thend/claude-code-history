/**
 * Unit tests for search command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerSearchCommand } from '../../../../src/cli/commands/search.js';

vi.mock('../../../../src/lib/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/lib/index.js')>();
  return {
    ...actual,
    searchSessions: vi.fn(),
    searchInSession: vi.fn(),
    isDataNotFoundError: vi.fn(),
  };
});

vi.mock('../../../../src/cli/formatters/pager.js', () => ({
  outputWithPager: vi.fn(),
}));

import {
  searchSessions,
  searchInSession,
  isDataNotFoundError,
} from '../../../../src/lib/index.js';
import { outputWithPager } from '../../../../src/cli/formatters/pager.js';

function createMatch(index: number): {
  sessionId: string;
  sessionSummary: string;
  projectPath: string;
  messageUuid: string;
  messageType: 'user';
  match: string;
  context: string[];
  lineNumber: number;
} {
  return {
    sessionId: `session-${index}`,
    sessionSummary: `Session ${index}`,
    projectPath: '/test/project',
    messageUuid: `message-${index}`,
    messageType: 'user',
    match: 'needle',
    context: [`Context ${index}`],
    lineNumber: index + 1,
  };
}

describe('search command', () => {
  let program: Command;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('-j, --json', 'Output as JSON');
    program.option('-f, --full', 'Full output');
    program.option('-d, --data-path <path>', 'Custom data path');
    registerSearchCommand(program);

    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    vi.mocked(searchSessions).mockReset();
    vi.mocked(searchInSession).mockReset();
    vi.mocked(isDataNotFoundError).mockReset();
    vi.mocked(outputWithPager).mockReset();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should not inject a numeric limit when searching across sessions without --limit', async () => {
    vi.mocked(searchSessions).mockResolvedValue({
      data: [createMatch(1)],
      pagination: { total: 1, limit: 1, offset: 0, hasMore: false },
    });
    vi.mocked(outputWithPager).mockResolvedValue();

    await program.parseAsync(['node', 'test', 'search', 'needle']);

    expect(searchSessions).toHaveBeenCalledWith(
      'needle',
      expect.objectContaining({
        context: 2,
        offset: 0,
      })
    );
    const config = vi.mocked(searchSessions).mock.calls[0]?.[1];
    expect(Object.prototype.hasOwnProperty.call(config, 'limit')).toBe(false);
  });

  it('should not force the former 20-result cap for --session searches without --limit', async () => {
    vi.mocked(searchInSession).mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => createMatch(index))
    );

    await program.parseAsync(['node', 'test', 'search', 'needle', '--session', '0', '--json']);

    const output = stdoutSpy.mock.calls.map((call) => call[0]).join('');
    const json = JSON.parse(output) as {
      data: {
        matches: unknown[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
      };
    };

    expect(searchInSession).toHaveBeenCalledWith(
      0,
      'needle',
      expect.objectContaining({
        context: 2,
        offset: 0,
      })
    );
    const config = vi.mocked(searchInSession).mock.calls[0]?.[2];
    expect(Object.prototype.hasOwnProperty.call(config, 'limit')).toBe(false);
    expect(json.data.matches).toHaveLength(25);
    expect(json.data.pagination.total).toBe(25);
    expect(json.data.pagination.limit).toBe(25);
    expect(json.data.pagination.offset).toBe(0);
    expect(json.data.pagination.hasMore).toBe(false);
  });
});
