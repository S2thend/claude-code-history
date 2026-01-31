/**
 * Unit tests for pager formatter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { outputWithPager } from '../../../../src/cli/formatters/pager.js';

describe('outputWithPager', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  it('should output directly when full=true', async () => {
    await outputWithPager('test content', true);

    expect(stdoutWriteSpy).toHaveBeenCalledWith('test content');
  });

  it('should add newline if content does not end with one', async () => {
    await outputWithPager('no newline', true);

    expect(stdoutWriteSpy).toHaveBeenCalledWith('no newline');
    expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
  });

  it('should not add extra newline if content ends with one', async () => {
    await outputWithPager('has newline\n', true);

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    expect(stdoutWriteSpy).toHaveBeenCalledWith('has newline\n');
  });

  it('should output directly when stdout is not a TTY', async () => {
    // In test environment, stdout is typically not a TTY
    await outputWithPager('test content', false);

    expect(stdoutWriteSpy).toHaveBeenCalledWith('test content');
  });
});
