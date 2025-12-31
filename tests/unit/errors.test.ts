/**
 * Unit tests for error classes and type guards.
 */

import { describe, it, expect } from 'vitest';
import {
  SessionNotFoundError,
  WorkspaceNotFoundError,
  DataNotFoundError,
  isSessionNotFoundError,
  isWorkspaceNotFoundError,
  isDataNotFoundError,
} from '../../src/lib/errors.js';

describe('SessionNotFoundError', () => {
  it('should create error with numeric session ID', () => {
    const error = new SessionNotFoundError(5);
    expect(error.message).toBe('Session not found: 5');
    expect(error.sessionId).toBe(5);
    expect(error.name).toBe('SessionNotFoundError');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof SessionNotFoundError).toBe(true);
  });

  it('should create error with string session ID (UUID)', () => {
    const uuid = 'abc123-def456';
    const error = new SessionNotFoundError(uuid);
    expect(error.message).toBe(`Session not found: ${uuid}`);
    expect(error.sessionId).toBe(uuid);
  });
});

describe('WorkspaceNotFoundError', () => {
  it('should create error with workspace path', () => {
    const workspace = '/Users/test/project';
    const error = new WorkspaceNotFoundError(workspace);
    expect(error.message).toBe(`Workspace not found: ${workspace}`);
    expect(error.workspace).toBe(workspace);
    expect(error.name).toBe('WorkspaceNotFoundError');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof WorkspaceNotFoundError).toBe(true);
  });
});

describe('DataNotFoundError', () => {
  it('should create error with data path', () => {
    const dataPath = '/Users/test/.claude';
    const error = new DataNotFoundError(dataPath);
    expect(error.message).toBe(`Claude Code data directory not found: ${dataPath}`);
    expect(error.dataPath).toBe(dataPath);
    expect(error.name).toBe('DataNotFoundError');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof DataNotFoundError).toBe(true);
  });
});

describe('isSessionNotFoundError', () => {
  it('should return true for SessionNotFoundError', () => {
    const error = new SessionNotFoundError(1);
    expect(isSessionNotFoundError(error)).toBe(true);
  });

  it('should return false for other errors', () => {
    expect(isSessionNotFoundError(new Error('test'))).toBe(false);
    expect(isSessionNotFoundError(new WorkspaceNotFoundError('/test'))).toBe(false);
    expect(isSessionNotFoundError(new DataNotFoundError('/test'))).toBe(false);
    expect(isSessionNotFoundError(null)).toBe(false);
    expect(isSessionNotFoundError(undefined)).toBe(false);
    expect(isSessionNotFoundError('error string')).toBe(false);
  });
});

describe('isWorkspaceNotFoundError', () => {
  it('should return true for WorkspaceNotFoundError', () => {
    const error = new WorkspaceNotFoundError('/test');
    expect(isWorkspaceNotFoundError(error)).toBe(true);
  });

  it('should return false for other errors', () => {
    expect(isWorkspaceNotFoundError(new Error('test'))).toBe(false);
    expect(isWorkspaceNotFoundError(new SessionNotFoundError(1))).toBe(false);
    expect(isWorkspaceNotFoundError(new DataNotFoundError('/test'))).toBe(false);
    expect(isWorkspaceNotFoundError(null)).toBe(false);
    expect(isWorkspaceNotFoundError(undefined)).toBe(false);
  });
});

describe('isDataNotFoundError', () => {
  it('should return true for DataNotFoundError', () => {
    const error = new DataNotFoundError('/test/.claude');
    expect(isDataNotFoundError(error)).toBe(true);
  });

  it('should return false for other errors', () => {
    expect(isDataNotFoundError(new Error('test'))).toBe(false);
    expect(isDataNotFoundError(new SessionNotFoundError(1))).toBe(false);
    expect(isDataNotFoundError(new WorkspaceNotFoundError('/test'))).toBe(false);
    expect(isDataNotFoundError(null)).toBe(false);
    expect(isDataNotFoundError(undefined)).toBe(false);
  });
});
