#!/usr/bin/env node
/**
 * Claude Code History CLI
 *
 * Browse, search, export, and manage your Claude Code conversation history.
 *
 * @packageDocumentation
 */

import { Command } from 'commander';
import { handleError } from './utils/errors.js';
import type { GlobalOptions } from './utils/config.js';
import { registerListCommand } from './commands/list.js';
import { registerViewCommand } from './commands/view.js';

const program = new Command();

program
  .name('cch')
  .description(
    'Claude Code History CLI - Browse, search, export, and manage your Claude Code conversation history'
  )
  .version('0.1.0')
  .option('-d, --data-path <path>', 'Custom Claude Code data directory')
  .option('-j, --json', 'Output in JSON format', false)
  .option('-f, --full', 'Output full content without pagination', false);

// Register commands
registerListCommand(program);
registerViewCommand(program);
// - search (T040)
// - export (T048)
// - migrate (T056)

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  const globalOpts = program.opts() as GlobalOptions;
  const exitCode = handleError(error, globalOpts.json);
  process.exit(exitCode);
});

process.on('unhandledRejection', (reason) => {
  const globalOpts = program.opts() as GlobalOptions;
  const error = reason instanceof Error ? reason : new Error(String(reason));
  const exitCode = handleError(error, globalOpts.json);
  process.exit(exitCode);
});

// Parse and execute
program.parse();

// If no command was provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export { program };
export type { GlobalOptions };
