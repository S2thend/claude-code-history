/**
 * List command implementation
 *
 * Lists all available Claude Code sessions with summary information.
 */

import type { Command } from 'commander';
import { listSessions, isDataNotFoundError } from '../../lib/index.js';
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
import { formatSessionTable, formatSessionsForJson } from '../formatters/table.js';
import { outputWithPager } from '../formatters/pager.js';

/**
 * List command options
 */
interface ListOptions extends GlobalOptions {
  workspace?: string;
  limit: string;
  offset: string;
}

/**
 * Execute the list command
 */
async function executeList(options: ListOptions): Promise<void> {
  const config = resolveConfig(options);
  const limit = parseInt(options.limit, 10);
  const offset = parseInt(options.offset, 10);

  const libConfig = toLibraryConfig(config, {
    workspace: options.workspace,
    limit,
    offset,
  });

  try {
    const result = await listSessions(libConfig);

    if (options.json) {
      // JSON output
      const jsonData = formatSessionsForJson(result.data, offset);
      const commandResult = successResult(jsonData, result.pagination);
      output(commandResult, true);
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
      const fullOutput = tableOutput + paginationHint;

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
    .option('-l, --limit <number>', 'Maximum number of sessions to display', '50')
    .option('-o, --offset <number>', 'Number of sessions to skip', '0')
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
