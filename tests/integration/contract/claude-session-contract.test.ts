/**
 * Contract tests for anonymized Claude JSONL session structures.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAgentSession, getSession, listSessions } from '../../../src/lib/session.js';
import {
  cleanupTempClaudeData,
  createTempClaudeData,
  readFixture,
  writeProjectSessionFile,
} from '../../helpers/agent-linking.js';

describe('anonymized Claude contract fixtures', () => {
  let testDataPath = '';

  beforeAll(async () => {
    const tempData = await createTempClaudeData('claude-contract-');
    testDataPath = tempData.dataPath;

    await writeProjectSessionFile(
      tempData.projectsPath,
      '-tmp-claude-contract',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl',
      await readFixture('contracts/claude-main-session.jsonl')
    );
    await writeProjectSessionFile(
      tempData.projectsPath,
      '-tmp-claude-contract',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/subagents/agent-contract123.jsonl',
      await readFixture('contracts/claude-main-session/subagents/agent-linked.jsonl')
    );
  });

  afterAll(async () => {
    await cleanupTempClaudeData(testDataPath);
  });

  it('should discover nested contract fixtures and link the main session to its child agent', async () => {
    const result = await listSessions({ dataPath: testDataPath });
    const mainSession = result.data.find(
      (session) => session.id === 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    );
    const agentSession = result.data.find((session) => session.id === 'agent-contract123');

    expect(result.data).toHaveLength(2);
    expect(mainSession?.agentIds).toEqual(['contract123']);
    expect(mainSession?.unresolvedAgentIds).toEqual([]);
    expect(agentSession).toBeDefined();
    expect(agentSession?.agentIds).toEqual([]);
    expect(agentSession?.unresolvedAgentIds).toEqual([]);
  });

  it('should retrieve the main session with linked agent metadata from the contract fixture', async () => {
    const session = await getSession('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', {
      dataPath: testDataPath,
    });

    expect(session.summary).toContain('Anonymized Claude nested agent contract fixture');
    expect(session.agentIds).toEqual(['contract123']);
  });

  it('should retrieve the linked agent transcript from the anonymized contract fixture', async () => {
    const session = await getAgentSession('contract123', { dataPath: testDataPath });

    expect(session.id).toBe('agent-contract123');
    expect(session.messages.some((message) => message.type === 'assistant')).toBe(true);
    const firstUserMessage = session.messages.find((message) => message.type === 'user');
    expect(firstUserMessage?.type).toBe('user');
    if (firstUserMessage?.type === 'user') {
      expect(firstUserMessage.isSidechain).toBe(true);
    }
  });
});
