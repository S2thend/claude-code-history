/**
 * Unit tests for CLI output utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toPaginationInfo,
  successResult,
  errorResult,
  stdout,
  stderr,
  outputJson,
  output,
  handleError,
  formatPaginationHint,
  type PaginationInfo,
  type CommandResult,
} from '../../../../src/cli/utils/output.js';
import { CliError, ExitCode } from '../../../../src/cli/utils/errors.js';
import type { Pagination } from '../../../../src/lib/index.js';

describe('output utilities (T067)', () => {
  describe('toPaginationInfo', () => {
    it('should convert Pagination to PaginationInfo', () => {
      const pagination: Pagination = {
        total: 100,
        offset: 20,
        limit: 10,
        hasMore: true,
      };

      const result = toPaginationInfo(pagination);

      expect(result).toEqual({
        total: 100,
        offset: 20,
        limit: 10,
        hasMore: true,
      });
    });

    it('should handle edge case with zero values', () => {
      const pagination: Pagination = {
        total: 0,
        offset: 0,
        limit: 10,
        hasMore: false,
      };

      const result = toPaginationInfo(pagination);

      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('successResult', () => {
    it('should create successful result with data', () => {
      const data = { sessions: [{ id: '1' }, { id: '2' }] };

      const result = successResult(data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.error).toBeUndefined();
      expect(result.pagination).toBeUndefined();
    });

    it('should include pagination when provided', () => {
      const data = ['item1', 'item2'];
      const pagination: Pagination = {
        total: 100,
        offset: 0,
        limit: 2,
        hasMore: true,
      };

      const result = successResult(data, pagination);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.pagination).toEqual({
        total: 100,
        offset: 0,
        limit: 2,
        hasMore: true,
      });
    });

    it('should handle null data', () => {
      const result = successResult(null);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle primitive data', () => {
      const result = successResult(42);

      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });
  });

  describe('errorResult', () => {
    it('should create failed result from CliError', () => {
      const error = new CliError(
        'Test error',
        ExitCode.NOT_FOUND,
        'NOT_FOUND',
        'Some details'
      );

      const result = errorResult(error);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toEqual({
        code: 'NOT_FOUND',
        message: 'Test error',
        details: 'Some details',
      });
    });

    it('should create failed result without details', () => {
      const error = new CliError(
        'Simple error',
        ExitCode.GENERAL_ERROR,
        'INTERNAL_ERROR'
      );

      const result = errorResult(error);

      expect(result.error?.details).toBeUndefined();
    });
  });

  describe('stdout', () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      writeSpy.mockRestore();
    });

    it('should write content to stdout', () => {
      stdout('Hello, world!\n');

      expect(writeSpy).toHaveBeenCalledWith('Hello, world!\n');
    });

    it('should add newline if content does not end with one', () => {
      stdout('No newline');

      expect(writeSpy).toHaveBeenNthCalledWith(1, 'No newline');
      expect(writeSpy).toHaveBeenNthCalledWith(2, '\n');
    });

    it('should not add extra newline if content ends with one', () => {
      stdout('Has newline\n');

      expect(writeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('stderr', () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      writeSpy.mockRestore();
    });

    it('should write content to stderr', () => {
      stderr('Error message\n');

      expect(writeSpy).toHaveBeenCalledWith('Error message\n');
    });

    it('should add newline if content does not end with one', () => {
      stderr('No newline');

      expect(writeSpy).toHaveBeenNthCalledWith(1, 'No newline');
      expect(writeSpy).toHaveBeenNthCalledWith(2, '\n');
    });
  });

  describe('outputJson', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('should output JSON with pretty formatting', () => {
      const result: CommandResult<{ key: string }> = {
        success: true,
        data: { key: 'value' },
      };

      outputJson(result);

      const written = stdoutSpy.mock.calls[0][0] as string;
      expect(JSON.parse(written)).toEqual(result);
      expect(written).toContain('\n'); // Pretty printed
    });
  });

  describe('output', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('should output JSON when json=true', () => {
      const result = successResult({ test: 'data' });

      output(result, true, 'Human output');

      const written = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(written);
      expect(parsed.success).toBe(true);
      expect(parsed.data.test).toBe('data');
    });

    it('should output human text when json=false and humanOutput provided', () => {
      const result = successResult({ test: 'data' });

      output(result, false, 'Human readable text');

      const written = stdoutSpy.mock.calls[0][0] as string;
      expect(written).toBe('Human readable text');
    });

    it('should stringify data when json=false and no humanOutput', () => {
      const result = successResult({ fallback: true });

      output(result, false);

      const written = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(written);
      expect(parsed.fallback).toBe(true);
    });

    it('should not output anything when no data and no humanOutput', () => {
      const result: CommandResult<undefined> = {
        success: true,
        data: undefined,
      };

      output(result, false);

      expect(stdoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleError', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    it('should output JSON error result when json=true', () => {
      const error = new CliError('Test', ExitCode.NOT_FOUND, 'NOT_FOUND');

      handleError(error, true);

      const written = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(written);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe('NOT_FOUND');
    });

    it('should output human error to stderr when json=false', () => {
      const error = new CliError('Human error', ExitCode.IO_ERROR, 'IO_ERROR');

      handleError(error, false);

      const written = stderrSpy.mock.calls[0][0] as string;
      expect(written).toContain('Error: Human error');
    });

    it('should return exit code', () => {
      const error = new CliError('Test', ExitCode.USAGE_ERROR, 'USAGE_ERROR');

      const code = handleError(error, true);

      expect(code).toBe(ExitCode.USAGE_ERROR);
    });
  });

  describe('formatPaginationHint', () => {
    it('should return empty string when no more pages', () => {
      const pagination: PaginationInfo = {
        total: 10,
        offset: 0,
        limit: 20,
        hasMore: false,
      };

      const hint = formatPaginationHint(pagination, 'sessions');

      expect(hint).toBe('');
    });

    it('should return hint when there are more pages', () => {
      const pagination: PaginationInfo = {
        total: 100,
        offset: 0,
        limit: 10,
        hasMore: true,
      };

      const hint = formatPaginationHint(pagination, 'sessions');

      expect(hint).toContain('Showing 1-10 of 100 sessions');
      expect(hint).toContain('--offset');
    });

    it('should calculate correct range for middle page', () => {
      const pagination: PaginationInfo = {
        total: 100,
        offset: 20,
        limit: 10,
        hasMore: true,
      };

      const hint = formatPaginationHint(pagination, 'matches');

      expect(hint).toContain('Showing 21-30 of 100 matches');
    });

    it('should handle last page correctly', () => {
      const pagination: PaginationInfo = {
        total: 25,
        offset: 20,
        limit: 10,
        hasMore: true,
      };

      const hint = formatPaginationHint(pagination, 'items');

      expect(hint).toContain('Showing 21-25 of 25 items');
    });

    it('should use correct item name', () => {
      const pagination: PaginationInfo = {
        total: 50,
        offset: 0,
        limit: 10,
        hasMore: true,
      };

      expect(formatPaginationHint(pagination, 'results')).toContain('results');
      expect(formatPaginationHint(pagination, 'messages')).toContain('messages');
    });
  });
});
