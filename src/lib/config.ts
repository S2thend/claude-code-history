/**
 * Configuration handling for claude-code-history library.
 */

import type { LibraryConfig } from './types.js';
import { getDefaultDataPath } from './platform.js';

/** Default configuration values */
export const DEFAULT_CONFIG: {
  dataPath: string;
  workspace: undefined;
  offset: number;
  context: number;
} = {
  dataPath: getDefaultDataPath(),
  workspace: undefined,
  offset: 0,
  context: 2,
};

/**
 * Internal resolved configuration with all fields required.
 */
export interface ResolvedConfig {
  dataPath: string;
  workspace: string | undefined;
  limit: number | undefined;
  offset: number;
  context: number;
}

/**
 * Merge user config with defaults and validate.
 * @param config - User-provided configuration
 * @returns Resolved configuration with all fields
 */
export function resolveConfig(config?: LibraryConfig): ResolvedConfig {
  const resolved: ResolvedConfig = {
    dataPath: config?.dataPath ?? DEFAULT_CONFIG.dataPath,
    workspace: config?.workspace,
    limit: config?.limit,
    offset: config?.offset ?? DEFAULT_CONFIG.offset,
    context: config?.context ?? DEFAULT_CONFIG.context,
  };

  // Validate numeric values
  if (resolved.limit !== undefined && resolved.limit < 0) {
    throw new Error('limit must be non-negative');
  }
  if (resolved.offset < 0) {
    throw new Error('offset must be non-negative');
  }
  if (resolved.context < 0) {
    throw new Error('context must be non-negative');
  }

  return resolved;
}

/**
 * Apply pagination to an array of items.
 * @param items - Full array of items
 * @param config - Configuration with limit and offset
 * @returns Paginated slice of items
 */
export function paginate<T>(items: T[], config: ResolvedConfig): T[] {
  if (config.limit === undefined) {
    return items.slice(config.offset);
  }
  return items.slice(config.offset, config.offset + config.limit);
}

/**
 * Create pagination metadata.
 * @param total - Total number of items
 * @param config - Configuration with limit and offset
 */
export function createPagination(
  total: number,
  config: ResolvedConfig
): { total: number; limit: number; offset: number; hasMore: boolean } {
  if (config.limit === undefined) {
    return {
      total,
      limit: Math.max(0, total - config.offset),
      offset: config.offset,
      hasMore: false,
    };
  }

  return {
    total,
    limit: config.limit,
    offset: config.offset,
    hasMore: config.offset + config.limit < total,
  };
}
