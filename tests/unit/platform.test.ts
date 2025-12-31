/**
 * Unit tests for platform detection and path utilities.
 */

import { describe, it, expect } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import {
  getDefaultDataPath,
  getProjectsPath,
  encodeProjectPath,
  decodeProjectPath,
  isUUID,
  extractSessionId,
  isAgentSessionFile,
  extractAgentId,
} from '../../src/lib/platform.js';

describe('getDefaultDataPath', () => {
  it('should return path to ~/.claude', () => {
    const result = getDefaultDataPath();
    expect(result).toBe(join(homedir(), '.claude'));
  });
});

describe('getProjectsPath', () => {
  it('should return projects subdirectory', () => {
    const dataPath = '/Users/test/.claude';
    const result = getProjectsPath(dataPath);
    expect(result).toBe('/Users/test/.claude/projects');
  });
});

describe('encodeProjectPath', () => {
  it('should encode Unix path by replacing slashes with hyphens', () => {
    expect(encodeProjectPath('/Users/name/project')).toBe('-Users-name-project');
  });

  it('should handle trailing slashes', () => {
    expect(encodeProjectPath('/Users/name/project/')).toBe('-Users-name-project');
    expect(encodeProjectPath('/Users/name/project//')).toBe('-Users-name-project');
  });

  it('should handle root path', () => {
    expect(encodeProjectPath('/')).toBe('');
  });

  it('should handle path without leading slash', () => {
    expect(encodeProjectPath('Users/name/project')).toBe('Users-name-project');
  });
});

describe('decodeProjectPath', () => {
  it('should decode encoded Unix path', () => {
    expect(decodeProjectPath('-Users-name-project')).toBe('/Users/name/project');
  });

  it('should handle Windows-style paths (no leading slash)', () => {
    expect(decodeProjectPath('C-Users-name-project')).toBe('C/Users/name/project');
  });

  it('should round-trip encode/decode for paths without hyphens', () => {
    // Note: Round-trip is only perfect for paths without hyphens
    // Paths with hyphens will have them converted to slashes on decode
    const original = '/Users/test/project';
    const encoded = encodeProjectPath(original);
    const decoded = decodeProjectPath(encoded);
    expect(decoded).toBe(original);
  });

  it('should note that paths with hyphens lose information in round-trip', () => {
    // This documents expected behavior: hyphens in paths become slashes
    const original = '/Users/test/my-project';
    const encoded = encodeProjectPath(original);
    expect(encoded).toBe('-Users-test-my-project');
    // Decoding treats all hyphens as path separators
    const decoded = decodeProjectPath(encoded);
    expect(decoded).toBe('/Users/test/my/project');
  });
});

describe('isUUID', () => {
  it('should return true for valid UUIDs', () => {
    expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isUUID('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true);
    expect(isUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  it('should return false for invalid UUIDs', () => {
    expect(isUUID('')).toBe(false);
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('123e4567-e89b-12d3-a456')).toBe(false); // too short
    expect(isUUID('123e4567-e89b-12d3-a456-4266141740001')).toBe(false); // too long
    expect(isUUID('123e4567e89b12d3a456426614174000')).toBe(false); // no hyphens
    expect(isUUID('agent-abc1234')).toBe(false); // agent ID format
  });
});

describe('extractSessionId', () => {
  it('should extract UUID from .jsonl filename', () => {
    expect(extractSessionId('123e4567-e89b-12d3-a456-426614174000.jsonl')).toBe(
      '123e4567-e89b-12d3-a456-426614174000'
    );
  });

  it('should extract agent session ID', () => {
    expect(extractSessionId('agent-abc1234.jsonl')).toBe('agent-abc1234');
    expect(extractSessionId('agent-xyz.jsonl')).toBe('agent-xyz');
  });

  it('should return null for non-jsonl files', () => {
    expect(extractSessionId('123e4567-e89b-12d3-a456-426614174000.json')).toBe(null);
    expect(extractSessionId('session.txt')).toBe(null);
    expect(extractSessionId('README.md')).toBe(null);
  });

  it('should return null for invalid session files', () => {
    expect(extractSessionId('random-file.jsonl')).toBe(null);
    expect(extractSessionId('not-uuid-format.jsonl')).toBe(null);
  });
});

describe('isAgentSessionFile', () => {
  it('should return true for agent session files', () => {
    expect(isAgentSessionFile('agent-abc1234.jsonl')).toBe(true);
    expect(isAgentSessionFile('agent-xyz789.jsonl')).toBe(true);
  });

  it('should return false for non-agent session files', () => {
    expect(isAgentSessionFile('123e4567-e89b-12d3-a456-426614174000.jsonl')).toBe(false);
    expect(isAgentSessionFile('agent-abc1234.json')).toBe(false); // wrong extension
    expect(isAgentSessionFile('not-agent-abc.jsonl')).toBe(false);
  });
});

describe('extractAgentId', () => {
  it('should extract agent ID from filename', () => {
    expect(extractAgentId('agent-abc1234.jsonl')).toBe('abc1234');
    expect(extractAgentId('agent-xyz789.jsonl')).toBe('xyz789');
  });

  it('should return null for non-agent files', () => {
    expect(extractAgentId('123e4567-e89b-12d3-a456-426614174000.jsonl')).toBe(null);
    expect(extractAgentId('agent-abc1234.json')).toBe(null);
    expect(extractAgentId('random.jsonl')).toBe(null);
  });
});
