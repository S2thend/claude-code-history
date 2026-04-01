/**
 * List command implementation
 *
 * Lists all available Claude Code sessions with summary information.
 */

import type { Command } from 'commander';
import {
  listSessions,
  getSession,
  isDataNotFoundError,
  computeTokenStats,
  createEmptyStats,
  addStats,
  type AggregateTokenStats,
} from '../../lib/index.js';
import {
  type GlobalOptions,
  resolveConfig,
  toLibraryConfig,
} from '../utils/config.js';
import { ioError } from '../utils/errors.js';
import {
  successResult,
  output,
  handleError,
  formatPaginationHint,
  toPaginationInfo,
} from '../utils/output.js';
import {
  formatSessionTable,
  formatSessionsForJson,
  formatAggregateStats,
} from '../formatters/table.js';
import { outputWithPager } from '../formatters/pager.js';

/**
 * List command options
 */
interface ListOptions extends GlobalOptions {
  workspace?: string;
  limit?: string;
  offset: string;
  stats?: boolean;
}

/**
 * Execute the list command
 */
async function executeList(options: ListOptions): Promise<void> {
  const config = resolveConfig(options);
  const limit = options.limit !== undefined ? parseInt(options.limit, 10) : undefined;
  const offset = parseInt(options.offset, 10);

  const libConfig = toLibraryConfig(config, {
    workspace: options.workspace,
    offset,
    ...(limit !== undefined ? { limit } : {}),
  });

  try {
    const result = await listSessions(libConfig);

    // Compute aggregate token stats if --stats flag is set
    let aggregateStats: AggregateTokenStats | undefined;
    if (options.stats) {
      aggregateStats = createEmptyStats();
      for (const summary of result.data) {
        const session = await getSession(summary.id, libConfig);
        const sessionStats = computeTokenStats(session.messages);
        aggregateStats = addStats(aggregateStats, sessionStats);
      }
    }

    if (options.json) {
      // JSON output
      const jsonData = formatSessionsForJson(result.data, offset);
      const commandResult = successResult(jsonData, result.pagination);
      // Add statistics as sibling to data if --stats flag is set
      const jsonOutput = aggregateStats
        ? { ...commandResult, statistics: aggregateStats }
        : commandResult;
      output(jsonOutput, true);
    } else {
      // Human-readable output
      if (result.data.length === 0) {
        if (options.workspace) {
          console.log(`No sessions found for workspace: ${options.workspace}`);
        } else {
          console.log('No sessions found.');
        }
        return;
      }

      const tableOutput = formatSessionTable(result.data, offset);
      const paginationHint = formatPaginationHint(
        toPaginationInfo(result.pagination),
        'sessions'
      );

      // Add stats summary if --stats flag is set
      const statsOutput = aggregateStats ? '\n' + formatAggregateStats(aggregateStats) : '';
      const fullOutput = tableOutput + paginationHint + statsOutput;

      await outputWithPager(fullOutput, options.full);
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
 * Register the list command
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all sessions')
    .option('-w, --workspace <path>', 'Filter by workspace/project path')
    .option('-l, --limit <number>', 'Maximum number of sessions to display')
    .option('-o, --offset <number>', 'Number of sessions to skip', '0')
    .option('-s, --stats', 'Show aggregate token statistics')
    .action(async (cmdOptions: Omit<ListOptions, keyof GlobalOptions>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: ListOptions = { ...globalOptions, ...cmdOptions };

      try {
        await executeList(options);
      } catch (error) {
        const exitCode = handleError(error, options.json);
        process.exit(exitCode);
      }
    });
}
