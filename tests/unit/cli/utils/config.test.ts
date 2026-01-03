/**
 * Unit tests for CLI configuration utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveConfig,
  toLibraryConfig,
  parseSessionRef,
  ENV_VARS,
  type GlobalOptions,
} from '../../../../src/cli/utils/config.js';

describe('config utilities', () => {
  describe('resolveConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv };
      process.env[ENV_VARS.DATA_PATH] = undefined;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    describe('data path resolution priority (T063)', () => {
      it('should use --data-path option when provided', () => {
        const opts: GlobalOptions = {
          dataPath: '/custom/path',
          json: false,
          full: false,
        };

        const config = resolveConfig(opts);

        expect(config.dataPath).toBe('/custom/path');
      });

      it('should use environment variable when --data-path not provided', () => {
        process.env[ENV_VARS.DATA_PATH] = '/env/path';

        const opts: GlobalOptions = {
          json: false,
          full: false,
        };

        const config = resolveConfig(opts);

        expect(config.dataPath).toBe('/env/path');
      });

      it('should prefer --data-path over environment variable', () => {
        process.env[ENV_VARS.DATA_PATH] = '/env/path';

        const opts: GlobalOptions = {
          dataPath: '/cli/path',
          json: false,
          full: false,
        };

        const config = resolveConfig(opts);

        expect(config.dataPath).toBe('/cli/path');
      });

      it('should use platform default when neither option nor env var provided', () => {
        const opts: GlobalOptions = {
          json: false,
          full: false,
        };

        const config = resolveConfig(opts);

        // Should use platform default (contains .claude in path)
        expect(config.dataPath).toContain('.claude');
      });
    });

    describe('output format resolution', () => {
      it('should set outputFormat to json when --json flag is true', () => {
        const opts: GlobalOptions = {
          json: true,
          full: false,
        };

        const config = resolveConfig(opts);

        expect(config.outputFormat).toBe('json');
      });

      it('should set outputFormat to human when --json flag is false', () => {
        const opts: GlobalOptions = {
          json: false,
          full: false,
        };

        const config = resolveConfig(opts);

        expect(config.outputFormat).toBe('human');
      });
    });

    describe('pagination resolution', () => {
      it('should disable pagination when --full flag is true', () => {
        const opts: GlobalOptions = {
          json: false,
          full: true,
        };

        const config = resolveConfig(opts);

        expect(config.paginate).toBe(false);
      });

      it('should enable pagination when --full flag is false', () => {
        const opts: GlobalOptions = {
          json: false,
          full: false,
        };

        const config = resolveConfig(opts);

        expect(config.paginate).toBe(true);
      });
    });
  });

  describe('toLibraryConfig', () => {
    it('should convert ResolvedCliConfig to LibraryConfig', () => {
      const resolvedConfig = {
        dataPath: '/custom/path',
        outputFormat: 'human' as const,
        paginate: true,
      };

      const libConfig = toLibraryConfig(resolvedConfig);

      expect(libConfig.dataPath).toBe('/custom/path');
    });

    it('should allow overrides', () => {
      const resolvedConfig = {
        dataPath: '/custom/path',
        outputFormat: 'human' as const,
        paginate: true,
      };

      const libConfig = toLibraryConfig(resolvedConfig, {
        workspace: '/specific/workspace',
      });

      expect(libConfig.dataPath).toBe('/custom/path');
      expect(libConfig.workspace).toBe('/specific/workspace');
    });

    it('should override dataPath when specified in overrides', () => {
      const resolvedConfig = {
        dataPath: '/custom/path',
        outputFormat: 'human' as const,
        paginate: true,
      };

      const libConfig = toLibraryConfig(resolvedConfig, {
        dataPath: '/override/path',
      });

      expect(libConfig.dataPath).toBe('/override/path');
    });
  });

  describe('parseSessionRef', () => {
    describe('numeric indices', () => {
      it('should parse zero as numeric index', () => {
        const result = parseSessionRef('0');
        expect(result).toBe(0);
      });

      it('should parse positive integers as numeric index', () => {
        expect(parseSessionRef('1')).toBe(1);
        expect(parseSessionRef('42')).toBe(42);
        expect(parseSessionRef('999')).toBe(999);
      });

      it('should handle leading/trailing whitespace', () => {
        expect(parseSessionRef('  5  ')).toBe(5);
        expect(parseSessionRef('\t10\n')).toBe(10);
      });
    });

    describe('UUID strings', () => {
      it('should return full UUID as string', () => {
        const uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const result = parseSessionRef(uuid);
        expect(result).toBe(uuid);
      });

      it('should return partial UUID as string', () => {
        const partial = 'aaaaaaaa';
        const result = parseSessionRef(partial);
        expect(result).toBe(partial);
      });

      it('should return alphanumeric strings as string (treated as UUID)', () => {
        const result = parseSessionRef('abc123');
        expect(result).toBe('abc123');
      });

      it('should handle mixed numeric-alpha as string', () => {
        const result = parseSessionRef('123abc');
        expect(result).toBe('123abc');
      });
    });

    describe('edge cases', () => {
      it('should treat negative numbers as string', () => {
        const result = parseSessionRef('-1');
        expect(result).toBe('-1');
      });

      it('should treat decimals as string', () => {
        const result = parseSessionRef('1.5');
        expect(result).toBe('1.5');
      });

      it('should handle empty string', () => {
        const result = parseSessionRef('');
        expect(result).toBe('');
      });

      it('should preserve whitespace-only after trim', () => {
        const result = parseSessionRef('   ');
        expect(result).toBe('');
      });
    });
  });

  describe('ENV_VARS', () => {
    it('should export DATA_PATH env var name', () => {
      expect(ENV_VARS.DATA_PATH).toBe('CCH_DATA_PATH');
    });

    it('should export NO_COLOR env var name', () => {
      expect(ENV_VARS.NO_COLOR).toBe('NO_COLOR');
    });

    it('should export PAGER env var name', () => {
      expect(ENV_VARS.PAGER).toBe('PAGER');
    });
  });
});
