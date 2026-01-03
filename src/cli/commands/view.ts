/**
 * View command implementation
 *
 * Views the full content of a specific session.
 */

import type { Command } from 'commander';
import {
  getSession,
  isSessionNotFoundError,
  isDataNotFoundError,
} from '../../lib/index.js';
import {
  type GlobalOptions,
  resolveConfig,
  toLibraryConfig,
  parseSessionRef,
} from '../utils/config.js';
import { notFoundError, ioError, usageError } from '../utils/errors.js';
import { successResult, output, handleError } from '../utils/output.js';
import { formatSession, formatSessionForJson } from '../formatters/session.js';
import { outputWithPager } from '../formatters/pager.js';

/**
 * View command options
 */
type ViewOptions = GlobalOptions;

/**
 * Execute the view command
 */
async function executeView(
  sessionArg: string,
  options: ViewOptions
): Promise<void> {
  if (!sessionArg) {
    const exitCode = handleError(
      usageError(
        'Session identifier required',
        "Usage: cch view <session>\n\nProvide a session index (e.g., '0') or UUID."
      ),
      options.json
    );
    process.exit(exitCode);
  }

  const config = resolveConfig(options);
  const sessionRef = parseSessionRef(sessionArg);
  const libConfig = toLibraryConfig(config);

  try {
    const session = await getSession(sessionRef, libConfig);

    if (options.json) {
      // JSON output
      const jsonData = formatSessionForJson(session);
      const commandResult = successResult(jsonData);
      output(commandResult, true);
    } else {
      // Human-readable output
      const formattedSession = formatSession(session);
      await outputWithPager(formattedSession, options.full);
    }
  } catch (error) {
    if (isSessionNotFoundError(error)) {
      const exitCode = handleError(
        notFoundError(
          `Session not found: ${sessionArg}`,
          "Try 'cch list' to see available sessions."
        ),
        options.json
      );
      process.exit(exitCode);
    }

    if (isDataNotFoundError(error)) {
      const exitCode = handleError(
        ioError(
          'Claude Code data directory not found',
          'Make sure Claude Code is installed and has been used at least once.'
        ),
        options.json
      );
      process.exit(exitCode);
    }

    throw error;
  }
}

/**
 * Register the view command
 */
export function registerViewCommand(program: Command): void {
  program
    .command('view <session>')
    .description("View a session's contents")
    .action(async (sessionArg: string) => {
      const globalOptions = program.opts() as GlobalOptions;

      try {
        await executeView(sessionArg, globalOptions);
      } catch (error) {
        const exitCode = handleError(error, globalOptions.json);
        process.exit(exitCode);
      }
    });
}
