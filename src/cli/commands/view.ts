/**
 * View command implementation
 *
 * Views the full content of a specific session.
 */

import type { Command } from 'commander';
import {
  getSession,
  isAmbiguousAgentSessionError,
  isSessionNotFoundError,
  isDataNotFoundError,
  filterMessages,
  computeTokenStats,
  VALID_FILTER_TYPES,
  type FilterableMessageType,
} from '../../lib/index.js';
import {
  type GlobalOptions,
  resolveConfig,
  toLibraryConfig,
  parseSessionRef,
  createJsonLookupErrorResult,
  isDirectAgentLookupInput,
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

function outputLookupJsonError(
  type: 'ambiguous-agent-id' | 'session-not-found',
  sessionArg: string
): void {
  process.stdout.write(
    JSON.stringify(
      {
        success: false,
        error: createJsonLookupErrorResult(type, sessionArg),
      },
      null,
      2
    ) + '\n'
  );
}

/**
 * Execute the view command
 */
async function executeView(sessionArg: string, options: ViewOptions): Promise<void> {
  if (!sessionArg) {
    const exitCode = handleError(
      usageError(
        'Session identifier required',
        'Usage: cch view <session>\n\nProvide a session index, session UUID, or agent ID.'
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
    const defaultMessages = filterMessages(session.messages);
    const totalMessageCount = defaultMessages.length;

    // Compute token statistics for the session
    const tokenStats = computeTokenStats(session.messages);

    // Apply filter if specified
    const filteredMessages = filterTypes
      ? filterMessages(session.messages, { only: filterTypes })
      : defaultMessages;

    // Check for empty results with filter
    if (filterTypes && filteredMessages.length === 0) {
      if (options.json) {
        // JSON output for empty results
        const jsonData = formatSessionForJson(session, {
          messages: filteredMessages,
          filter: filterTypes,
          totalMessageCount,
          tokenStats,
        });
        const commandResult = successResult(jsonData);
        output(commandResult, true);
      } else {
        // Human-readable output for empty results
        const formattedSession = formatSession(session, {
          messages: filteredMessages,
          filter: filterTypes,
          totalMessageCount,
          tokenStats,
          full: options.full,
        });
        await outputWithPager(formattedSession, options.full);
      }
      return;
    }

    if (options.json) {
      // JSON output
      const jsonData = formatSessionForJson(session, {
        messages: filteredMessages,
        filter: filterTypes ?? [],
        totalMessageCount,
        tokenStats,
      });
      const commandResult = successResult(jsonData);
      output(commandResult, true);
    } else {
      // Human-readable output
      const formattedSession = formatSession(session, {
        messages: filteredMessages,
        filter: filterTypes ?? [],
        totalMessageCount,
        tokenStats,
        full: options.full,
      });
      await outputWithPager(formattedSession, options.full);
    }
  } catch (error) {
    if (isAmbiguousAgentSessionError(error)) {
      if (options.json) {
        outputLookupJsonError('ambiguous-agent-id', sessionArg);
      } else {
        const exitCode = handleError(
          usageError(
            `Agent ID is ambiguous: ${error.agentId}`,
            'Multiple matching agent transcripts were found. Use a more specific session identifier.'
          ),
          false
        );
        process.exit(exitCode);
      }
      process.exit(2);
    }

    if (isSessionNotFoundError(error)) {
      if (options.json && isDirectAgentLookupInput(sessionArg)) {
        outputLookupJsonError('session-not-found', sessionArg);
        process.exit(3);
      }

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
    .description('View a session by index, UUID, or agent ID')
    .option(
      '-o, --only <types>',
      'Filter by message type (user,assistant,tool,thinking,error,progress)'
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
