/**
 * Export command implementation
 *
 * Exports sessions to JSON or Markdown format, to stdout or file.
 */

import { writeFile } from 'fs/promises';
import type { Command } from 'commander';
import {
  exportSession,
  exportAllSessions,
  isDataNotFoundError,
  isSessionNotFoundError,
  type ExportFormat,
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
 * Export command options
 */
interface ExportOptions extends GlobalOptions {
  format: string;
  output?: string;
  all: boolean;
}

/**
 * Validate and normalize format option
 */
function normalizeFormat(format: string): ExportFormat {
  const normalized = format.toLowerCase();
  if (normalized === 'json' || normalized === 'markdown' || normalized === 'md') {
    return normalized === 'md' ? 'markdown' : (normalized as ExportFormat);
  }
  throw new Error(`Invalid format: ${format}. Use 'json' or 'markdown'.`);
}

/**
 * Execute the export command
 */
async function executeExport(
  sessionArg: string | undefined,
  options: ExportOptions
): Promise<void> {
  const config = resolveConfig(options);
  const libConfig = toLibraryConfig(config);

  let format: ExportFormat;
  try {
    format = normalizeFormat(options.format);
  } catch (error) {
    const exitCode = handleError(error, options.json);
    process.exit(exitCode);
  }

  try {
    let content: string;

    if (options.all) {
      // Export all sessions
      content = await exportAllSessions(format, libConfig);
    } else if (sessionArg) {
      // Export single session
      const sessionRef = parseSessionRef(sessionArg);
      content = await exportSession(sessionRef, format, libConfig);
    } else {
      // No session specified and --all not set
      const exitCode = handleError(
        new Error(
          "Session identifier required. Provide a session index/UUID or use --all.\n\nUsage: cch export <session> [options]\n       cch export --all [options]"
        ),
        options.json
      );
      process.exit(exitCode);
    }

    // Output to file or stdout
    if (options.output) {
      try {
        await writeFile(options.output, content, 'utf-8');
        if (options.json) {
          const commandResult = successResult({
            file: options.output,
            format,
            size: content.length,
          });
          output(commandResult, true);
        } else {
          console.log(`Exported to ${options.output} (${content.length} bytes)`);
        }
      } catch (error) {
        const exitCode = handleError(
          ioError(
            `Failed to write to ${options.output}`,
            error instanceof Error ? error.message : 'Unknown error'
          ),
          options.json
        );
        process.exit(exitCode);
      }
    } else {
      // Output to stdout
      if (options.json && format === 'json') {
        // For JSON format with --json flag, wrap in command result
        const commandResult = successResult(JSON.parse(content));
        output(commandResult, true);
      } else {
        // For markdown or raw output, just print the content
        console.log(content);
      }
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
 * Register the export command
 */
export function registerExportCommand(program: Command): void {
  program
    .command('export [session]')
    .description('Export session(s) to JSON or Markdown format')
    .option('-F, --format <format>', 'Export format: json or markdown', 'json')
    .option('-o, --output <file>', 'Output file path (stdout if not specified)')
    .option('-a, --all', 'Export all sessions', false)
    .action(async (sessionArg: string | undefined, cmdOptions: Omit<ExportOptions, keyof GlobalOptions>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: ExportOptions = { ...globalOptions, ...cmdOptions };

      try {
        await executeExport(sessionArg, options);
      } catch (error) {
        const exitCode = handleError(error, options.json);
        process.exit(exitCode);
      }
    });
}
