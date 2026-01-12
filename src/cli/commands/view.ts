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
  filterMessages,
  VALID_FILTER_TYPES,
  type FilterableMessageType,
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
interface ViewOptions extends GlobalOptions {
  only?: string;
}

/**
 * Parse and validate filter types from comma-separated string.
 * @throws Error if any filter type is invalid
 */
function parseFilterTypes(input: string): FilterableMessageType[] {
  const types = input.split(',').map((t) => t.trim().toLowerCase());

  // Validate each type
  for (const type of types) {
    if (!type) {
      continue; // Skip empty strings from trailing commas
    }
    if (!VALID_FILTER_TYPES.includes(type as FilterableMessageType)) {
      throw new Error(
        `Invalid filter type '${type}'. Valid types: ${VALID_FILTER_TYPES.join(', ')}`
      );
    }
  }

  // Filter out empty strings and return
  return types.filter((t) => t !== '') as FilterableMessageType[];
}

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
    // Parse filter types if provided
    let filterTypes: FilterableMessageType[] | undefined;
    if (options.only) {
      try {
        filterTypes = parseFilterTypes(options.only);
      } catch (filterError) {
        const exitCode = handleError(
          usageError(
            (filterError as Error).message,
            `Usage: cch view <session> --only <types>\n\nFilter types: ${VALID_FILTER_TYPES.join(', ')}`
          ),
          options.json
        );
        process.exit(exitCode);
      }
    }

    const session = await getSession(sessionRef, libConfig);
    const totalMessageCount = session.messages.filter(
      (m) => m.type === 'user' || m.type === 'assistant'
    ).length;

    // Apply filter if specified
    const filteredMessages = filterTypes
      ? filterMessages(session.messages, { only: filterTypes })
      : session.messages;

    // Check for empty results with filter
    if (filterTypes && filteredMessages.length === 0) {
      if (options.json) {
        // JSON output for empty results
        const jsonData = formatSessionForJson(session, {
          messages: filteredMessages,
          filter: filterTypes,
          totalMessageCount,
        });
        const commandResult = successResult(jsonData);
        output(commandResult, true);
      } else {
        // Human-readable output for empty results
        const formattedSession = formatSession(session, {
          messages: filteredMessages,
          filter: filterTypes,
          totalMessageCount,
        });
        await outputWithPager(formattedSession, options.full);
      }
      return;
    }

    if (options.json) {
      // JSON output
      const jsonData = formatSessionForJson(session, filterTypes ? {
        messages: filteredMessages,
        filter: filterTypes,
        totalMessageCount,
      } : undefined);
      const commandResult = successResult(jsonData);
      output(commandResult, true);
    } else {
      // Human-readable output
      const formattedSession = formatSession(session, filterTypes ? {
        messages: filteredMessages,
        filter: filterTypes,
        totalMessageCount,
      } : undefined);
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
    .option(
      '-o, --only <types>',
      'Filter by message type (user,assistant,tool,thinking,error)'
    )
    .action(async (sessionArg: string, cmdOptions: { only?: string }) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: ViewOptions = { ...globalOptions, ...cmdOptions };

      try {
        await executeView(sessionArg, options);
      } catch (error) {
        const exitCode = handleError(error, options.json);
        process.exit(exitCode);
      }
    });
}
