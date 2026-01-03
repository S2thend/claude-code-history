/**
 * Integration tests for global CLI options
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve(process.cwd(), 'dist/cli/index.js');

/**
 * Execute CLI command and return stdout
 */
function runCli(args: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch (error: unknown) {
    // Return stdout even on non-zero exit
    if (
      error &&
      typeof error === 'object' &&
      'stdout' in error &&
      typeof error.stdout === 'string'
    ) {
      return error.stdout;
    }
    throw error;
  }
}

describe('CLI Global Options', () => {
  beforeAll(() => {
    // Ensure CLI is built before running tests
    try {
      execSync('npm run build', { encoding: 'utf-8', timeout: 30000 });
    } catch {
      // Build might already be done or fail for other reasons
    }
  });

  describe('--help', () => {
    it('should display help text with cch name', () => {
      const output = runCli('--help');

      expect(output).toContain('cch');
      expect(output).toContain('Claude Code History CLI');
    });

    it('should list global options', () => {
      const output = runCli('--help');

      expect(output).toContain('--data-path');
      expect(output).toContain('--json');
      expect(output).toContain('--full');
      expect(output).toContain('--help');
      expect(output).toContain('--version');
    });
  });

  describe('--version', () => {
    it('should display version number', () => {
      const output = runCli('--version');

      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should match package.json version', () => {
      const output = runCli('--version');
      // The version should be 0.1.0 as defined in the CLI
      expect(output.trim()).toBe('0.1.0');
    });
  });

  describe('-V shorthand', () => {
    it('should work as --version shorthand', () => {
      const output = runCli('-V');

      expect(output.trim()).toBe('0.1.0');
    });
  });

  describe('-h shorthand', () => {
    it('should work as --help shorthand', () => {
      const output = runCli('-h');

      expect(output).toContain('Claude Code History CLI');
    });
  });

  describe('option shorthands', () => {
    it('should support -d for --data-path', () => {
      const output = runCli('--help');

      expect(output).toContain('-d, --data-path');
    });

    it('should support -j for --json', () => {
      const output = runCli('--help');

      expect(output).toContain('-j, --json');
    });

    it('should support -f for --full', () => {
      const output = runCli('--help');

      expect(output).toContain('-f, --full');
    });
  });
});
