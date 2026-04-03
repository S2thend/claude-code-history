import { execFileSync, execSync } from 'child_process';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSession, listSessions } from '../../../src/lib/session.js';
import {
  buildSimpleSessionJson,
  cleanupTempClaudeData,
  createTempClaudeData,
  readFixture,
  writeProjectSessionFile,
} from '../../helpers/agent-linking.js';

const CLI_PATH = join(process.cwd(), 'dist', 'cli', 'index.js');
const PERFORMANCE_PROJECT = '-tmp-performance-project';
const PERFORMANCE_WORKSPACE = '/tmp/performance-project';
const TOTAL_MAIN_SESSIONS = 101;

function buildPerformanceSessionId(index: number): string {
  return `bbbbbbbb-cccc-dddd-eeee-${index.toString().padStart(12, '0')}`;
}

function buildPerformanceSummary(index: number): string {
  return `Performance session ${index.toString().padStart(3, '0')}`;
}

function buildPerformanceTimestamp(index: number): string {
  return new Date(Date.UTC(2026, 3, 2, 0, Math.floor(index / 60), index % 60)).toISOString();
}

function measure<T>(fn: () => T): { result: T; elapsedMs: number } {
  const startedAt = performance.now();
  const result = fn();
  return { result, elapsedMs: performance.now() - startedAt };
}

async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const startedAt = performance.now();
  const result = await fn();
  return { result, elapsedMs: performance.now() - startedAt };
}

describe('session lookup performance', () => {
  let testDataPath = '';

  beforeAll(async () => {
    execSync('npm run build', { encoding: 'utf-8', timeout: 60000 });

    const tempData = await createTempClaudeData('claude-performance-');
    testDataPath = tempData.dataPath;

    const firstFixture = await readFixture('performance/perf-main-session-001.jsonl');
    const lastFixture = await readFixture('performance/perf-main-session-101.jsonl');

    await writeProjectSessionFile(
      tempData.projectsPath,
      PERFORMANCE_PROJECT,
      `${buildPerformanceSessionId(1)}.jsonl`,
      firstFixture
    );

    for (let index = 2; index < TOTAL_MAIN_SESSIONS; index++) {
      await writeProjectSessionFile(
        tempData.projectsPath,
        PERFORMANCE_PROJECT,
        `${buildPerformanceSessionId(index)}.jsonl`,
        buildSimpleSessionJson(
          buildPerformanceSessionId(index),
          PERFORMANCE_WORKSPACE,
          buildPerformanceSummary(index),
          buildPerformanceTimestamp(index)
        )
      );
    }

    await writeProjectSessionFile(
      tempData.projectsPath,
      PERFORMANCE_PROJECT,
      `${buildPerformanceSessionId(TOTAL_MAIN_SESSIONS)}.jsonl`,
      lastFixture
    );

    await writeProjectSessionFile(
      tempData.projectsPath,
      '-tmp-agent-linking',
      '11111111-1111-1111-1111-111111111111.jsonl',
      await readFixture('nested-main-session.jsonl')
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      '-tmp-agent-linking',
      '11111111-1111-1111-1111-111111111111/subagents/agent-linked123.jsonl',
      await readFixture('nested-agent-session.jsonl')
    );
  });

  afterAll(async () => {
    await cleanupTempClaudeData(testDataPath);
  });

  it('should list 100+ main sessions within the acceptance budget', async () => {
    const { result: sessions, elapsedMs } = await measureAsync(() =>
      listSessions({ dataPath: testDataPath })
    );

    expect(sessions.pagination.total).toBe(TOTAL_MAIN_SESSIONS + 1);
    expect(sessions.data.length).toBe(TOTAL_MAIN_SESSIONS + 1);
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('should resolve main and direct agent lookups within the acceptance budget', async () => {
    const mainLookup = await measureAsync(() =>
      getSession(buildPerformanceSessionId(TOTAL_MAIN_SESSIONS), { dataPath: testDataPath })
    );
    const mainSession = mainLookup.result;

    expect(mainSession.id).toBe(buildPerformanceSessionId(TOTAL_MAIN_SESSIONS));
    expect(mainLookup.elapsedMs).toBeLessThan(1000);

    const agentLookup = await measureAsync(() =>
      getSession('linked123', { dataPath: testDataPath })
    );
    const agentSession = agentLookup.result;

    expect(agentSession.id).toBe('agent-linked123');
    expect(agentLookup.elapsedMs).toBeLessThan(1000);
  });

  it('should keep direct CLI agent lookup under one second on a 100+ session fixture', () => {
    const { result, elapsedMs } = measure(() =>
      execFileSync('node', [CLI_PATH, '--data-path', testDataPath, 'view', 'linked123', '--json'], {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    );
    const parsed = JSON.parse(result) as {
      success: boolean;
      data?: {
        id: string;
      };
    };

    expect(parsed.success).toBe(true);
    expect(parsed.data?.id).toBe('agent-linked123');
    expect(elapsedMs).toBeLessThan(1000);
  });
});
