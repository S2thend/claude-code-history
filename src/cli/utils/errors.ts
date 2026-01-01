/**
 * CLI Error handling utilities
 *
 * Provides exit codes, error formatting, and error type guards.
 */

/**
 * CLI exit codes following Unix conventions
 */
export enum ExitCode {
  /** Command completed successfully */
  SUCCESS = 0,
  /** General/unexpected error */
  GENERAL_ERROR = 1,
  /** Invalid arguments or usage error */
  USAGE_ERROR = 2,
  /** Requested resource not found (session, workspace) */
  NOT_FOUND = 3,
  /** I/O error (file system, permissions) */
  IO_ERROR = 4,
}

/**
 * Error codes for structured error responses
 */
export type ErrorCode =
  | 'USAGE_ERROR'
  | 'NOT_FOUND'
  | 'IO_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Structured command error for JSON output
 */
export interface CommandError {
  code: ErrorCode;
  message: string;
  details?: string;
}

/**
 * CLI-specific error class with exit code
 */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode,
    public readonly errorCode: ErrorCode,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'CliError';
  }

  /**
   * Convert to CommandError for JSON output
   */
  toCommandError(): CommandError {
    return {
      code: this.errorCode,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Create a usage error (invalid arguments)
 */
export function usageError(message: string, details?: string): CliError {
  return new CliError(message, ExitCode.USAGE_ERROR, 'USAGE_ERROR', details);
}

/**
 * Create a not found error (session, workspace not found)
 */
export function notFoundError(message: string, details?: string): CliError {
  return new CliError(message, ExitCode.NOT_FOUND, 'NOT_FOUND', details);
}

/**
 * Create an I/O error (file system issues)
 */
export function ioError(message: string, details?: string): CliError {
  return new CliError(message, ExitCode.IO_ERROR, 'IO_ERROR', details);
}

/**
 * Create an internal error (unexpected issues)
 */
export function internalError(message: string, details?: string): CliError {
  return new CliError(
    message,
    ExitCode.GENERAL_ERROR,
    'INTERNAL_ERROR',
    details
  );
}

/**
 * Type guard for CliError
 */
export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError;
}

/**
 * Format error for human-readable output
 */
export function formatErrorHuman(error: CliError): string {
  let output = `Error: ${error.message}`;
  if (error.details) {
    output += `\n\n${error.details}`;
  }
  return output;
}

/**
 * Get exit code from an error, defaulting to GENERAL_ERROR for unknown errors
 */
export function getExitCode(error: unknown): ExitCode {
  if (isCliError(error)) {
    return error.exitCode;
  }
  return ExitCode.GENERAL_ERROR;
}

/**
 * Convert any error to a CliError
 */
export function toCliError(error: unknown): CliError {
  if (isCliError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return internalError(error.message);
  }

  return internalError(String(error));
}

/**
 * Handle command error with appropriate output format
 *
 * @param error - The error that occurred
 * @param json - Whether to output as JSON
 * @returns Exit code for the error
 */
export function handleError(error: unknown, json: boolean): ExitCode {
  const cliError = toCliError(error);

  if (json) {
    const result = {
      success: false,
      error: cliError.toCommandError(),
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stderr.write(formatErrorHuman(cliError) + '\n');
  }

  return cliError.exitCode;
}
