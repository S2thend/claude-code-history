/**
 * Unit tests for configuration handling.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, resolveConfig, paginate, createPagination } from '../../src/lib/config.js';

describe('DEFAULT_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONFIG.limit).toBe(50);
    expect(DEFAULT_CONFIG.offset).toBe(0);
    expect(DEFAULT_CONFIG.context).toBe(2);
    expect(DEFAULT_CONFIG.workspace).toBe(undefined);
    expect(DEFAULT_CONFIG.dataPath).toContain('.claude');
  });
});

describe('resolveConfig', () => {
  it('should return defaults when no config provided', () => {
    const resolved = resolveConfig();

    expect(resolved.limit).toBe(50);
    expect(resolved.offset).toBe(0);
    expect(resolved.context).toBe(2);
    expect(resolved.workspace).toBe(undefined);
  });

  it('should merge user config with defaults', () => {
    const resolved = resolveConfig({ limit: 10, workspace: '/test' });

    expect(resolved.limit).toBe(10);
    expect(resolved.workspace).toBe('/test');
    expect(resolved.offset).toBe(0); // default
    expect(resolved.context).toBe(2); // default
  });

  it('should allow overriding all options', () => {
    const resolved = resolveConfig({
      dataPath: '/custom/.claude',
      workspace: '/my/project',
      limit: 100,
      offset: 20,
      context: 5,
    });

    expect(resolved.dataPath).toBe('/custom/.claude');
    expect(resolved.workspace).toBe('/my/project');
    expect(resolved.limit).toBe(100);
    expect(resolved.offset).toBe(20);
    expect(resolved.context).toBe(5);
  });

  it('should throw error for negative limit', () => {
    expect(() => resolveConfig({ limit: -1 })).toThrow('limit must be non-negative');
  });

  it('should throw error for negative offset', () => {
    expect(() => resolveConfig({ offset: -5 })).toThrow('offset must be non-negative');
  });

  it('should throw error for negative context', () => {
    expect(() => resolveConfig({ context: -2 })).toThrow('context must be non-negative');
  });

  it('should allow zero values', () => {
    const resolved = resolveConfig({ limit: 0, offset: 0, context: 0 });

    expect(resolved.limit).toBe(0);
    expect(resolved.offset).toBe(0);
    expect(resolved.context).toBe(0);
  });
});

describe('paginate', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  it('should return first N items with default offset', () => {
    const config = resolveConfig({ limit: 3 });
    const result = paginate(items, config);

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should skip items based on offset', () => {
    const config = resolveConfig({ limit: 3, offset: 2 });
    const result = paginate(items, config);

    expect(result).toEqual(['c', 'd', 'e']);
  });

  it('should return remaining items if limit exceeds available', () => {
    const config = resolveConfig({ limit: 20, offset: 8 });
    const result = paginate(items, config);

    expect(result).toEqual(['i', 'j']);
  });

  it('should return empty array if offset exceeds length', () => {
    const config = resolveConfig({ limit: 5, offset: 100 });
    const result = paginate(items, config);

    expect(result).toEqual([]);
  });

  it('should return empty array for zero limit', () => {
    const config = resolveConfig({ limit: 0 });
    const result = paginate(items, config);

    expect(result).toEqual([]);
  });

  it('should return all items if limit equals total', () => {
    const config = resolveConfig({ limit: 10 });
    const result = paginate(items, config);

    expect(result).toEqual(items);
  });
});

describe('createPagination', () => {
  it('should create pagination metadata', () => {
    const config = resolveConfig({ limit: 10, offset: 0 });
    const pagination = createPagination(100, config);

    expect(pagination.total).toBe(100);
    expect(pagination.limit).toBe(10);
    expect(pagination.offset).toBe(0);
    expect(pagination.hasMore).toBe(true);
  });

  it('should set hasMore to false when at end', () => {
    const config = resolveConfig({ limit: 10, offset: 90 });
    const pagination = createPagination(100, config);

    expect(pagination.hasMore).toBe(false);
  });

  it('should set hasMore to false when offset exceeds total', () => {
    const config = resolveConfig({ limit: 10, offset: 150 });
    const pagination = createPagination(100, config);

    expect(pagination.hasMore).toBe(false);
  });

  it('should handle zero total', () => {
    const config = resolveConfig({ limit: 10, offset: 0 });
    const pagination = createPagination(0, config);

    expect(pagination.total).toBe(0);
    expect(pagination.hasMore).toBe(false);
  });

  it('should handle exactly matching limit', () => {
    const config = resolveConfig({ limit: 10, offset: 0 });
    const pagination = createPagination(10, config);

    expect(pagination.hasMore).toBe(false);
  });
});
