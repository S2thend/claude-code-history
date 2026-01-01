/**
 * Unit tests for CLI error handling utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ExitCode,
  CliError,
  usageError,
  notFoundError,
  ioError,
  internalError,
  isCliError,
  formatErrorHuman,
  getExitCode,
  toCliError,
  handleError,
} from '../../../../src/cli/utils/errors.js';

describe('error utilities (T066)', () => {
  describe('ExitCode enum', () => {
    it('should have SUCCESS as 0', () => {
      expect(ExitCode.SUCCESS).toBe(0);
    });

    it('should have GENERAL_ERROR as 1', () => {
      expect(ExitCode.GENERAL_ERROR).toBe(1);
    });

    it('should have USAGE_ERROR as 2', () => {
      expect(ExitCode.USAGE_ERROR).toBe(2);
    });

    it('should have NOT_FOUND as 3', () => {
      expect(ExitCode.NOT_FOUND).toBe(3);
    });

    it('should have IO_ERROR as 4', () => {
      expect(ExitCode.IO_ERROR).toBe(4);
    });
  });

  describe('CliError class', () => {
    it('should create error with all properties', () => {
      const error = new CliError(
        'Test message',
        ExitCode.USAGE_ERROR,
        'USAGE_ERROR',
        'Test details'
      );

      expect(error.message).toBe('Test message');
      expect(error.exitCode).toBe(ExitCode.USAGE_ERROR);
      expect(error.errorCode).toBe('USAGE_ERROR');
      expect(error.details).toBe('Test details');
      expect(error.name).toBe('CliError');
    });

    it('should create error without details', () => {
      const error = new CliError(
        'No details',
        ExitCode.GENERAL_ERROR,
        'INTERNAL_ERROR'
      );

      expect(error.details).toBeUndefined();
    });

    it('should extend Error class', () => {
      const error = new CliError('Test', ExitCode.GENERAL_ERROR, 'INTERNAL_ERROR');
      expect(error).toBeInstanceOf(Error);
    });

    describe('toCommandError', () => {
      it('should convert to CommandError with details', () => {
        const error = new CliError(
          'Test message',
          ExitCode.NOT_FOUND,
          'NOT_FOUND',
          'Some details'
        );

        const commandError = error.toCommandError();

        expect(commandError).toEqual({
          code: 'NOT_FOUND',
          message: 'Test message',
          details: 'Some details',
        });
      });

      it('should convert to CommandError without details', () => {
        const error = new CliError(
          'Test message',
          ExitCode.IO_ERROR,
          'IO_ERROR'
        );

        const commandError = error.toCommandError();

        expect(commandError).toEqual({
          code: 'IO_ERROR',
          message: 'Test message',
        });
        expect('details' in commandError).toBe(false);
      });
    });
  });

  describe('error factory functions', () => {
    describe('usageError', () => {
      it('should create usage error with correct exit code', () => {
        const error = usageError('Invalid argument');

        expect(error.exitCode).toBe(ExitCode.USAGE_ERROR);
        expect(error.errorCode).toBe('USAGE_ERROR');
        expect(error.message).toBe('Invalid argument');
      });

      it('should include details when provided', () => {
        const error = usageError('Invalid argument', 'Use --help for usage');

        expect(error.details).toBe('Use --help for usage');
      });
    });

    describe('notFoundError', () => {
      it('should create not found error with correct exit code', () => {
        const error = notFoundError('Session not found');

        expect(error.exitCode).toBe(ExitCode.NOT_FOUND);
        expect(error.errorCode).toBe('NOT_FOUND');
        expect(error.message).toBe('Session not found');
      });
    });

    describe('ioError', () => {
      it('should create I/O error with correct exit code', () => {
        const error = ioError('Cannot read file');

        expect(error.exitCode).toBe(ExitCode.IO_ERROR);
        expect(error.errorCode).toBe('IO_ERROR');
        expect(error.message).toBe('Cannot read file');
      });
    });

    describe('internalError', () => {
      it('should create internal error with correct exit code', () => {
        const error = internalError('Unexpected condition');

        expect(error.exitCode).toBe(ExitCode.GENERAL_ERROR);
        expect(error.errorCode).toBe('INTERNAL_ERROR');
        expect(error.message).toBe('Unexpected condition');
      });
    });
  });

  describe('isCliError', () => {
    it('should return true for CliError instances', () => {
      const error = new CliError('Test', ExitCode.GENERAL_ERROR, 'INTERNAL_ERROR');
      expect(isCliError(error)).toBe(true);
    });

    it('should return true for factory-created errors', () => {
      expect(isCliError(usageError('test'))).toBe(true);
      expect(isCliError(notFoundError('test'))).toBe(true);
      expect(isCliError(ioError('test'))).toBe(true);
      expect(isCliError(internalError('test'))).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isCliError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isCliError({ message: 'fake error' })).toBe(false);
      expect(isCliError('string error')).toBe(false);
      expect(isCliError(null)).toBe(false);
      expect(isCliError(undefined)).toBe(false);
    });
  });

  describe('formatErrorHuman', () => {
    it('should format error without details', () => {
      const error = usageError('Invalid command');
      const formatted = formatErrorHuman(error);

      expect(formatted).toBe('Error: Invalid command');
    });

    it('should format error with details', () => {
      const error = notFoundError('Session not found', "Try 'cch list' to see available sessions.");
      const formatted = formatErrorHuman(error);

      expect(formatted).toBe("Error: Session not found\n\nTry 'cch list' to see available sessions.");
    });
  });

  describe('getExitCode', () => {
    it('should return exit code from CliError', () => {
      const error = notFoundError('Not found');
      expect(getExitCode(error)).toBe(ExitCode.NOT_FOUND);
    });

    it('should return GENERAL_ERROR for regular Error', () => {
      const error = new Error('Regular error');
      expect(getExitCode(error)).toBe(ExitCode.GENERAL_ERROR);
    });

    it('should return GENERAL_ERROR for non-Error', () => {
      expect(getExitCode('string')).toBe(ExitCode.GENERAL_ERROR);
      expect(getExitCode(null)).toBe(ExitCode.GENERAL_ERROR);
      expect(getExitCode({ code: 'ERROR' })).toBe(ExitCode.GENERAL_ERROR);
    });
  });

  describe('toCliError', () => {
    it('should return CliError unchanged', () => {
      const original = usageError('Original');
      const result = toCliError(original);

      expect(result).toBe(original);
    });

    it('should convert Error to CliError', () => {
      const error = new Error('Standard error');
      const result = toCliError(error);

      expect(result).toBeInstanceOf(CliError);
      expect(result.message).toBe('Standard error');
      expect(result.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should convert string to CliError', () => {
      const result = toCliError('String error');

      expect(result).toBeInstanceOf(CliError);
      expect(result.message).toBe('String error');
      expect(result.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should convert other values to CliError', () => {
      const result = toCliError({ custom: 'object' });

      expect(result).toBeInstanceOf(CliError);
      expect(result.message).toBe('[object Object]');
    });
  });

  describe('handleError', () => {
    let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
    let stderrWriteSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutWriteSpy.mockRestore();
      stderrWriteSpy.mockRestore();
    });

    it('should output JSON error to stdout when json=true', () => {
      const error = notFoundError('Not found', 'Details');

      handleError(error, true);

      expect(stdoutWriteSpy).toHaveBeenCalled();
      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe('NOT_FOUND');
    });

    it('should output human error to stderr when json=false', () => {
      const error = ioError('I/O problem');

      handleError(error, false);

      expect(stderrWriteSpy).toHaveBeenCalled();
      const output = stderrWriteSpy.mock.calls[0][0] as string;
      expect(output).toContain('Error: I/O problem');
    });

    it('should return exit code', () => {
      const error = usageError('Bad usage');

      const code = handleError(error, false);

      expect(code).toBe(ExitCode.USAGE_ERROR);
    });

    it('should handle non-CliError errors', () => {
      const error = new Error('Generic');

      const code = handleError(error, true);

      expect(code).toBe(ExitCode.GENERAL_ERROR);
      const output = stdoutWriteSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
