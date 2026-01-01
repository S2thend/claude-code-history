/**
 * Migrate command implementation
 *
 * Copies or moves sessions between workspaces.
 */

import type { Command } from 'commander';
import {
  migrateSession,
  migrateWorkspace,
  isSessionNotFoundError,
  isWorkspaceNotFoundError,
  isDataNotFoundError,
  type MigrateResult,
} from '../../lib/index.js';
import {
  type GlobalOptions,
  resolveConfig,
  toLibraryConfig,
  parseSessionRef,
} from '../utils/config.js';
import { ioError, notFoundError } from '../utils/errors.js';
import { successResult, output, handleError } from '../utils/output.js';

/**
 * Migrate command options
 */
interface MigrateOptions extends GlobalOptions {
  destination?: string;
  source?: string;
  mode: string;
  all: boolean;
}

/**
 * Validate and normalize mode option
 */
function normalizeMode(mode: string): 'copy' | 'move' {
  const normalized = mode.toLowerCase();
  if (normalized === 'copy' || normalized === 'move') {
    return normalized;
  }
  throw new Error(`Invalid mode: ${mode}. Use 'copy' or 'move'.`);
}

/**
 * Format migration result for display
 */
function formatMigrateResult(result: MigrateResult, mode: 'copy' | 'move'): string {
  const action = mode === 'copy' ? 'Copied' : 'Moved';
  const lines: string[] = [];

  if (result.successCount > 0) {
    lines.push(`${action} ${result.successCount} session${result.successCount !== 1 ? 's' : ''} successfully.`);
  }

  if (result.failedCount > 0) {
    lines.push(`Failed to migrate ${result.failedCount} session${result.failedCount !== 1 ? 's' : ''}:`);
    for (const error of result.errors) {
      lines.push(`  - ${error.sessionId}: ${error.error}`);
    }
  }

  return lines.join('\n');
}

/**
 * Execute the migrate command
 */
async function executeMigrate(
  sessionArg: string | undefined,
  options: MigrateOptions
): Promise<void> {
  const config = resolveConfig(options);
  const libConfig = toLibraryConfig(config);

  // Validate mode
  let mode: 'copy' | 'move';
  try {
    mode = normalizeMode(options.mode);
  } catch (error) {
    const exitCode = handleError(error, options.json);
    process.exit(exitCode);
  }

  // Validate destination is provided
  if (!options.destination) {
    const exitCode = handleError(
      new Error(
        "Destination required. Use --destination or -D to specify the target workspace.\n\nUsage: cch migrate <session> --destination <path>\n       cch migrate --all --source <path> --destination <path>"
      ),
      options.json
    );
    process.exit(exitCode);
  }

  try {
    let result: MigrateResult;

    if (options.all) {
      // Migrate all sessions from source workspace
      if (!options.source) {
        const exitCode = handleError(
          new Error(
            "Source workspace required when using --all.\n\nUsage: cch migrate --all --source <path> --destination <path>"
          ),
          options.json
        );
        process.exit(exitCode);
      }

      result = await migrateWorkspace(
        {
          source: options.source,
          destination: options.destination,
          mode,
        },
        libConfig
      );
    } else if (sessionArg) {
      // Migrate specific session(s)
      const sessionParts = sessionArg.split(',').map((s) => s.trim());
      const sessions = sessionParts.map((s) => parseSessionRef(s));

      result = await migrateSession(
        {
          sessions,
          destination: options.destination,
          mode,
        },
        libConfig
      );
    } else {
      // No session specified and --all not set
      const exitCode = handleError(
        new Error(
          "Session identifier required. Provide a session index/UUID or use --all.\n\nUsage: cch migrate <session> --destination <path>\n       cch migrate --all --source <path> --destination <path>"
        ),
        options.json
      );
      process.exit(exitCode);
    }

    // Output result
    if (options.json) {
      const commandResult = successResult({
        successCount: result.successCount,
        failedCount: result.failedCount,
        mode,
        destination: options.destination,
        errors: result.errors,
      });
      output(commandResult, true);
    } else {
      console.log(formatMigrateResult(result, mode));
    }

    // Exit with error if there were failures
    if (result.failedCount > 0 && result.successCount === 0) {
      process.exit(1);
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

    if (isWorkspaceNotFoundError(error)) {
      const exitCode = handleError(
        notFoundError(
          `Workspace not found: ${options.source}`,
          "Make sure the source workspace path exists and contains sessions."
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
 * Register the migrate command
 */
export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate [session]')
    .description('Copy or move session(s) to a different workspace')
    .option('-D, --destination <path>', 'Destination workspace path (required)')
    .option('-S, --source <path>', 'Source workspace path (required with --all)')
    .option('-m, --mode <mode>', 'Migration mode: copy or move', 'copy')
    .option('-a, --all', 'Migrate all sessions from source workspace', false)
    .action(async (sessionArg: string | undefined, cmdOptions: Omit<MigrateOptions, keyof GlobalOptions>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: MigrateOptions = { ...globalOptions, ...cmdOptions };

      try {
        await executeMigrate(sessionArg, options);
      } catch (error) {
        const exitCode = handleError(error, options.json);
        process.exit(exitCode);
      }
    });
}
