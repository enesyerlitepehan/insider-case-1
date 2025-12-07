import test from 'node:test';
import assert from 'node:assert/strict';

import { MessageService } from '../message-service';
import type { CreateMessageInput, Message } from '../../utils/models/message';
import type { MessageRepository } from '../dynamodb-services/message-dynamodb-service';
import type { ClockLike } from '../types';

function fixedClock(dateIso = '2020-01-01T00:00:00.000Z'): ClockLike {
  const d = new Date(dateIso);
  return { now: () => d };
}

function makeRepoMock() {
  const created: Message[] = [];
  let getByStatusArgs: any[] | null = null;
  let getByStatusResult: Message[] = [];

  const repo: MessageRepository = {
    async create(m: Message): Promise<void> {
      created.push(m);
    },
    async getById(): Promise<Message | null> {
      return null;
    },
    async getPending(): Promise<Message[]> {
      return [];
    },
    async getByStatus(status, _limit): Promise<Message[]> {
      getByStatusArgs = [status, _limit];
      return getByStatusResult;
    },
    async updateStatus(): Promise<void> {},
    async updateStatusIfCurrent(): Promise<boolean> {
      return false;
    },
    async incrementRetryCount(): Promise<void> {},
  };

  return {
    repo,
    created,
    setGetByStatusResult(list: Message[]) {
      getByStatusResult = list;
    },
    get getByStatusArgs() {
      return getByStatusArgs;
    },
  };
}

test('MessageService.createMessage constructs and persists a new PENDING message', async () => {
  const clock = fixedClock('2024-06-15T12:34:56.000Z');
  const idFactory = () => 'fixed-uuid-1234';
  const { repo, created } = makeRepoMock();

  const svc = new MessageService(repo, clock, idFactory);
  const input: CreateMessageInput = { to: '+15551234567', content: 'hello' };

  const result = await svc.createMessage(input);

  const expected: Message = {
    id: 'fixed-uuid-1234',
    to: '+15551234567',
    content: 'hello',
    status: 'PENDING',
    retryCount: 0,
    createdAt: '2024-06-15T12:34:56.000Z',
    updatedAt: '2024-06-15T12:34:56.000Z',
  };

  assert.deepEqual(result, expected);
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], expected);
});

test('MessageService.listSentMessages delegates to repo.getByStatus("SENT")', async () => {
  const fixtureArgs: any[] = [];
  const base = makeRepoMock();
  const repo = new Proxy(base.repo, {
    get(target, prop, receiver) {
      const v = (target as any)[prop];
      if (prop === 'getByStatus') {
        return (status: any, limit?: any) => {
          fixtureArgs.push([status, limit]);
          return v.call(target, status, limit);
        };
      }
      return typeof v === 'function' ? v.bind(target) : v;
    }
  }) as unknown as typeof base.repo;

  const { setGetByStatusResult } = base;
  const svc = new MessageService(repo);
  const sample: Message[] = [
    {
      id: '1',
      to: 'A',
      content: 'x',
      status: 'SENT',
      retryCount: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      sentAt: '2024-01-01T00:00:00.000Z',
      messageId: 'm-1'
    },
  ];
  setGetByStatusResult(sample);

  const res = await svc.listSentMessages();
  assert.deepEqual(res, sample);

  assert.ok(fixtureArgs.length >= 1, 'getByStatus should have been called');
  assert.equal(fixtureArgs[0][0], 'SENT');
});
