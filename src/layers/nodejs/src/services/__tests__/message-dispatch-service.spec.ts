import test from 'node:test';
import assert from 'node:assert/strict';

import { MessageDispatchService } from '../message-dispatch-service';
import type { Message } from '../../utils/models/message';
import type { MessageRepository } from '../dynamodb-services/message-dynamodb-service';
import type { ClockLike, SqsClientLike } from '../types';

function fixedClock(iso = '2024-04-04T04:04:04.000Z'): ClockLike {
  const d = new Date(iso);
  return { now: () => d };
}

function makeMessages(ids: string[]): Message[] {
  return ids.map((id, i) => ({
    id,
    to: `+1${(5550000 + i).toString()}`,
    content: `msg-${id}`,
    status: 'PENDING',
    retryCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }));
}

function makeRepo(pending: Message[], shouldTake: Record<string, boolean>) {
  const calls: any[] = [];
  const repo: MessageRepository = {
    async create(): Promise<void> {
      calls.push(['create']);
    },
    async getById(): Promise<Message | null> {
      calls.push(['getById']);
      return null;
    },
    async getPending(limit: number): Promise<Message[]> {
      calls.push(['getPending', limit]);
      return pending.slice(0, limit);
    },
    async getByStatus(): Promise<Message[]> {
      calls.push(['getByStatus']);
      return [];
    },
    async updateStatus(): Promise<void> {
      calls.push(['updateStatus']);
    },
    async updateStatusIfCurrent(id, expected, next, extra): Promise<boolean> {
      calls.push(['updateStatusIfCurrent', id, expected, next, extra]);
      return !!shouldTake[id];
    },
    async incrementRetryCount(): Promise<void> {
      calls.push(['incrementRetryCount']);
    },
  };
  return { repo, calls };
}

function makeSqs() {
  const sent: any[] = [];
  const sqs: SqsClientLike = {
    async sendMessage(params) {
      sent.push(params);
    },
  };
  return { sqs, sent };
}

test('dispatchPendingMessages enqueues only items successfully transitioned to IN_PROGRESS', async () => {
  const msgs = makeMessages(['a', 'b', 'c']);
  const { repo, calls } = makeRepo(msgs, { a: true, b: false, c: true });
  const { sqs, sent } = makeSqs();
  const svc = new MessageDispatchService(
    repo,
    sqs,
    'https://sqs.queue/url',
    fixedClock('2024-05-05T05:05:05.000Z'),
  );
  const count = await svc.dispatchPendingMessages(3);

  assert.equal(count, 2);
  // getPending called with limit=3
  assert.deepEqual(
    calls.find((c) => c[0] === 'getPending'),
    ['getPending', 3],
  );

  // updateStatusIfCurrent called for each id with expected values
  const upds = calls.filter((c) => c[0] === 'updateStatusIfCurrent');
  assert.equal(upds.length, 3);
  for (const [_, id, expected, next, extra] of upds) {
    assert.equal(expected, 'PENDING');
    assert.equal(next, 'IN_PROGRESS');
    assert.equal(extra.updatedAt, '2024-05-05T05:05:05.000Z');
  }

  // SQS sendMessage called only for a and c
  assert.equal(sent.length, 2);
  assert.equal(sent[0].QueueUrl, 'https://sqs.queue/url');
  assert.equal(JSON.parse(sent[0].MessageBody).id, 'a');
  assert.equal(JSON.parse(sent[1].MessageBody).id, 'c');
});

test('dispatchPendingMessages with limit 0 short-circuits without work', async () => {
  const { repo, calls } = makeRepo(makeMessages(['x']), { x: true });
  const { sqs, sent } = makeSqs();
  const svc = new MessageDispatchService(repo, sqs, 'q', fixedClock());
  const count = await svc.dispatchPendingMessages(0);
  assert.equal(count, 0);
  assert.equal(calls.find((c) => c[0] === 'getPending') ?? null, null);
  assert.equal(sent.length, 0);
});
