/**
 * Pager utility for paginated output
 *
 * Handles interactive output pagination using system pager (less/more)
 * or direct stdout when --full flag is used or stdout is not a TTY.
 */

import { spawn, type ChildProcess } from 'child_process';
import { ENV_VARS } from '../utils/config.js';

/**
 * Get the system pager command
 *
 * Priority:
 * 1. PAGER environment variable
 * 2. 'less' on Unix-like systems
 * 3. 'more' on Windows
 */
function getSystemPager(): string {
  const envPager = process.env[ENV_VARS.PAGER];
  if (envPager) {
    return envPager;
  }

  return process.platform === 'win32' ? 'more' : 'less';
}

/**
 * Check if stdout is interactive (TTY)
 */
function isInteractive(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Output content with optional pagination
 *
 * Behavior:
 * - If full=true: Output directly to stdout (for piping)
 * - If stdout is not a TTY: Output directly (for piping)
 * - Otherwise: Use system pager for interactive scrolling
 *
 * @param content - Content to output
 * @param full - Whether to bypass pagination (--full flag)
 * @returns Promise that resolves when output is complete
 */
export async function outputWithPager(
  content: string,
  full: boolean
): Promise<void> {
  // Direct output if --full flag or not interactive
  if (full || !isInteractive()) {
    process.stdout.write(content);
    if (!content.endsWith('\n')) {
      process.stdout.write('\n');
    }
    return;
  }

  // Use system pager for interactive output
  return new Promise<void>((resolve, _reject) => {
    const pager = getSystemPager();
    let child: ChildProcess;

    try {
      child = spawn(pager, [], {
        stdio: ['pipe', 'inherit', 'inherit'],
        shell: process.platform === 'win32', // Use shell on Windows for 'more'
      });
    } catch (error) {
      // Fallback to direct output if pager fails to spawn
      process.stdout.write(content);
      if (!content.endsWith('\n')) {
        process.stdout.write('\n');
      }
      resolve();
      return;
    }

    child.on('error', () => {
      // Fallback to direct output if pager errors
      process.stdout.write(content);
      if (!content.endsWith('\n')) {
        process.stdout.write('\n');
      }
      resolve();
    });

    child.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        // Pager exited with error, but content was likely displayed
        resolve();
      }
    });

    if (child.stdin) {
      child.stdin.on('error', () => {
        // Ignore broken pipe errors (user quit pager early)
        resolve();
      });

      child.stdin.write(content);
      child.stdin.end();
    } else {
      // No stdin available, fall back to direct output
      process.stdout.write(content);
      if (!content.endsWith('\n')) {
        process.stdout.write('\n');
      }
      resolve();
    }
  });
}

/**
 * Simple synchronous output without pager
 * Used for JSON output or when async pager is not appropriate
 */
export function outputDirect(content: string): void {
  process.stdout.write(content);
  if (!content.endsWith('\n')) {
    process.stdout.write('\n');
  }
}
