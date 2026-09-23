import { afterEach, describe, expect, it } from 'vitest';
import {
  computeTokenStats,
  exportSessionToJson,
  exportSessionToMarkdown,
  getSession,
  listSessions,
  searchSessions,
} from '../../src/lib/index.js';
import {
  buildSimpleSessionJson,
  cleanupTempClaudeData,
  createTempClaudeData,
  writeProjectSessionFile,
} from '../helpers/agent-linking.js';

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(cleanupTempClaudeData));
});

describe('deduplicated session consumers', () => {
  it('uses unique messages for listing, details, search, exports, stats, and agent links', async () => {
    const { dataPath, projectsPath } = await createTempClaudeData('cch-dedup-consumers-');
    tempDirs.push(dataPath);
    const sessionId = '11111111-1111-1111-1111-111111111111';
    const agentId = 'linked123';
    const timestamp = '2026-09-01T00:00:00.000Z';
    const entries = buildSimpleSessionJson(sessionId, '/test/project', 'UniqueToken', timestamp)
      .split('\n')
      .map((line) => JSON.parse(line));
    entries[0].timestamp = timestamp;
    entries[1].toolUseResult = { agentId };
    const repeated = [
      entries[0],
      entries[1],
      entries[2],
      entries[1],
      { ...entries[2], origin: 'replay' },
    ];
    await writeProjectSessionFile(
      projectsPath,
      '-test-project',
      `${sessionId}.jsonl`,
      repeated.map((entry) => JSON.stringify(entry)).join('\n')
    );
    const agentLines = buildSimpleSessionJson(
      sessionId,
      '/test/project',
      'Agent reply',
      timestamp
    ).split('\n');
    await writeProjectSessionFile(
      projectsPath,
      '-test-project',
      `${sessionId}/subagents/agent-${agentId}.jsonl`,
      [...agentLines, ...agentLines.slice(1)].join('\n')
    );
    const config = { dataPath };
    const listed = await listSessions(config);
    expect(listed.data).toHaveLength(2);
    expect(listed.data.map((session) => session.messageCount)).toEqual([2, 2]);
    const session = await getSession(sessionId, config);
    expect(session.messageCount).toBe(2);
    expect(session.messages.filter((message) => message.type !== 'summary')).toHaveLength(2);
    expect(session.agentIds).toEqual([agentId]);
    expect(await getSession(sessionId, config)).toEqual(session);
    const agent = await getSession(`agent-${agentId}`, config);
    expect(agent.messageCount).toBe(2);
    expect(agent.messages).toHaveLength(3);
    const results = await searchSessions('UniqueToken', config);
    expect(results.pagination.total).toBe(2);
    expect(results.data).toHaveLength(2);
    const exported = JSON.parse(await exportSessionToJson(sessionId, config));
    expect(exported.messageCount).toBe(2);
    expect(exported.messages).toHaveLength(3);
    const markdown = await exportSessionToMarkdown(sessionId, config);
    expect(markdown.match(/Prompt for UniqueToken/g)).toHaveLength(1);
    expect(markdown.match(/Response for UniqueToken/g)).toHaveLength(1);
    expect(computeTokenStats(session.messages)).toEqual({
      inputTokens: 1,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 2,
    });
  });
});
