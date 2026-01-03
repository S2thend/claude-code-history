/**
 * Search command implementation
 *
 * Searches for text across all sessions or within a specific session.
 */

import type { Command } from 'commander';
import {
  searchSessions,
  searchInSession,
  isDataNotFoundError,
} from '../../lib/index.js';
import {
  type GlobalOptions,
  resolveConfig,
  toLibraryConfig,
  parseSessionRef,
} from '../utils/config.js';
import { ioError } from '../utils/errors.js';
import { successResult, output, handleError } from '../utils/output.js';
import {
  formatSearchResults,
  formatSearchResultsForJson,
} from '../formatters/search.js';
import { outputWithPager } from '../formatters/pager.js';

/**
 * Search command options
 */
interface SearchOptions extends GlobalOptions {
  session?: string;
  context: string;
  limit: string;
  offset: string;
}

/**
 * Execute the search command
 */
async function executeSearch(
  query: string,
  options: SearchOptions
): Promise<void> {
  const config = resolveConfig(options);
  const contextLines = parseInt(options.context, 10) || 2;
  const limit = parseInt(options.limit, 10) || 20;
  const offset = parseInt(options.offset, 10) || 0;

  const libConfig = toLibraryConfig(config, {
    context: contextLines,
    limit,
    offset,
  });

  try {
    if (options.session) {
      // Search within a specific session
      const sessionRef = parseSessionRef(options.session);
      const matches = await searchInSession(sessionRef, query, libConfig);

      // Manual pagination for single session search
      const total = matches.length;
      const paginatedMatches = matches.slice(offset, offset + limit);
      const pagination = {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      };

      if (options.json) {
        const jsonData = formatSearchResultsForJson(paginatedMatches, pagination);
        const commandResult = successResult(jsonData);
        output(commandResult, true);
      } else {
        const formatted = formatSearchResults(
          paginatedMatches,
          query,
          contextLines,
          pagination
        );
        await outputWithPager(formatted, options.full);
      }
    } else {
      // Search across all sessions
      const result = await searchSessions(query, libConfig);

      if (options.json) {
        const jsonData = formatSearchResultsForJson(result.data, result.pagination);
        const commandResult = successResult(jsonData);
        output(commandResult, true);
      } else {
        const formatted = formatSearchResults(
          result.data,
          query,
          contextLines,
          result.pagination
        );
        await outputWithPager(formatted, options.full);
      }
    }
  } catch (error) {
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
 * Register the search command
 */
export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search for text across sessions')
    .option('-s, --session <session>', 'Search within a specific session (index or UUID)')
    .option('-c, --context <lines>', 'Number of context lines around matches', '2')
    .option('-l, --limit <count>', 'Maximum number of results', '20')
    .option('-o, --offset <count>', 'Skip first N results', '0')
    .action(async (query: string, cmdOptions: Omit<SearchOptions, keyof GlobalOptions>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: SearchOptions = { ...globalOptions, ...cmdOptions };

      try {
        await executeSearch(query, options);
      } catch (error) {
        const exitCode = handleError(error, options.json);
        process.exit(exitCode);
      }
    });
}
