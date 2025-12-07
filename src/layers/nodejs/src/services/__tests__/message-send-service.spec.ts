import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MessageSendService,
  type MessageSendServiceConfig,
} from '../message-send-service';
import type { MessageRepository } from '../dynamodb-services/message-dynamodb-service';
import type { ClockLike, HttpClientLike } from '../types';
import type { Message } from '../../utils/models/message';

function fixedClock(iso = '2024-01-01T00:00:00.000Z'): ClockLike {
  const d = new Date(iso);
  return { now: () => d };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    to: '+15551234567',
    content: 'hello',
    status: 'PENDING',
    retryCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepo(initialMsg: Message | null) {
  const calls: any[] = [];
  let storedMsg: Message | null = initialMsg;
  const repo: MessageRepository = {
    async create(): Promise<void> {
      calls.push(['create']);
    },
    async getById(id: string): Promise<Message | null> {
      calls.push(['getById', id]);
      return storedMsg;
    },
    async getPending(): Promise<Message[]> {
      calls.push(['getPending']);
      return [];
    },
    async getByStatus(): Promise<Message[]> {
      calls.push(['getByStatus']);
      return [];
    },
    async updateStatus(id, status, extra?: Partial<Message>): Promise<void> {
      calls.push(['updateStatus', id, status, extra]);
      if (storedMsg) {
        storedMsg = { ...storedMsg, status, ...(extra ?? {}) } as Message;
      }
    },
    async updateStatusIfCurrent(): Promise<boolean> {
      calls.push(['updateStatusIfCurrent']);
      return false;
    },
    async incrementRetryCount(id: string): Promise<void> {
      calls.push(['incrementRetryCount', id]);
    },
  };
  return {
    repo,
    calls,
    get stored() {
      return storedMsg;
    },
  };
}

function makeHttp(response: { status: number; data?: any } | Error) {
  const calls: any[] = [];
  const http: HttpClientLike = {
    async post(url, body, headers) {
      calls.push(['post', url, body, headers]);
      if (response instanceof Error) throw response;
      return response as any;
    },
  };
  return { http, calls };
}

const baseConfig: MessageSendServiceConfig = {
  webhookUrl: 'https://example.test/webhook',
  authKey: 'secret',
  maxMessageLength: 160,
};

test('processSendJob: returns if message not found', async () => {
  const { repo, calls } = makeRepo(null);
  const { http } = makeHttp({ status: 200, data: { messageId: 'x' } });
  const svc = new MessageSendService(repo, http, baseConfig, fixedClock());
  await svc.processSendJob({ id: 'nope' });
  assert.equal(calls[0][0], 'getById');
  // no updateStatus / incrementRetryCount / http.post
  assert.equal(calls.find((c) => c[0] === 'updateStatus') ?? null, null);
  assert.equal(calls.find((c) => c[0] === 'incrementRetryCount') ?? null, null);
});

test('processSendJob: skip when already SENT', async () => {
  const { repo, calls } = makeRepo(makeMessage({ status: 'SENT' }));
  const { http } = makeHttp({ status: 200, data: { messageId: 'ok' } });
  const svc = new MessageSendService(repo, http, baseConfig, fixedClock());
  await svc.processSendJob({ id: 'msg-1' });
  assert.equal(calls[0][0], 'getById');
  assert.equal(calls.find((c) => c[0] === 'updateStatus') ?? null, null);
});

test('processSendJob: skip when already FAILED', async () => {
  const { repo, calls } = makeRepo(makeMessage({ status: 'FAILED' }));
  const { http } = makeHttp({ status: 200, data: { messageId: 'ok' } });
  const svc = new MessageSendService(repo, http, baseConfig, fixedClock());
  await svc.processSendJob({ id: 'msg-1' });
  assert.equal(calls[0][0], 'getById');
  assert.equal(calls.find((c) => c[0] === 'updateStatus') ?? null, null);
});

test('processSendJob: content exceeds max => mark FAILED and return', async () => {
  const { repo, calls, stored } = makeRepo(
    makeMessage({ content: 'x'.repeat(200) }),
  );
  const { http } = makeHttp({ status: 200, data: { messageId: 'ok' } });
  const svc = new MessageSendService(
    repo,
    http,
    { ...baseConfig, maxMessageLength: 10 },
    fixedClock('2024-02-02T02:02:02.000Z'),
  );
  await svc.processSendJob({ id: 'msg-1' });
  const upd = calls.filter((c) => c[0] === 'updateStatus');
  assert.ok(upd.length >= 1, 'updateStatus should be called');
  const lastUpd = upd[upd.length - 1];
  const extra = lastUpd[3] as Partial<Message>;
  assert.equal(extra.updatedAt, '2024-02-02T02:02:02.000Z');
  assert.equal(calls.find((c) => c[0] === 'incrementRetryCount') ?? null, null);
  assert.equal(calls.find((c) => c[0] === 'post') ?? null, null);
});

test('processSendJob: success 2xx with messageId updates to SENT', async () => {
  const { repo, calls } = makeRepo(makeMessage());
  const { http } = makeHttp({ status: 200, data: { messageId: 'ext-123' } });
  const clock = fixedClock('2024-03-03T03:03:03.000Z');
  const svc = new MessageSendService(repo, http, baseConfig, clock);
  await svc.processSendJob({ id: 'msg-1' });

  const upd = calls.find((c) => c[0] === 'updateStatus');
  assert.ok(upd);
  const extra = upd[3] as Partial<Message>;
  assert.equal(upd[1], 'msg-1');
  assert.equal(upd[2], 'SENT');
  assert.equal(extra.sentAt, '2024-03-03T03:03:03.000Z');
  assert.equal(extra.updatedAt, '2024-03-03T03:03:03.000Z');
  assert.ok(typeof extra.messageId === 'string');
  assert.ok((extra.messageId as string).startsWith('ext-123-'));
});

test('processSendJob: non-2xx increments retry and throws', async () => {
  const { repo, calls } = makeRepo(makeMessage());
  const { http } = makeHttp({ status: 503, data: {} });
  const svc = new MessageSendService(repo, http, baseConfig, fixedClock());
  await assert.rejects(
    () => svc.processSendJob({ id: 'msg-1' }),
    (e: any) => e && e.status === 503,
  );
  const inc = calls.find((c) => c[0] === 'incrementRetryCount');
  assert.ok(inc);
  const upd = calls.find((c) => c[0] === 'updateStatus');
  assert.equal(upd ?? null, null);
});

test('processSendJob: 2xx but missing messageId increments retry and throws', async () => {
  const { repo, calls } = makeRepo(makeMessage());
  const { http } = makeHttp({ status: 200, data: {} });
  const svc = new MessageSendService(repo, http, baseConfig, fixedClock());
  await assert.rejects(() => svc.processSendJob({ id: 'msg-1' }));
  const inc = calls.find((c) => c[0] === 'incrementRetryCount');
  assert.ok(inc);
});

test('processSendJob: network error increments retry and rethrows', async () => {
  const { repo, calls } = makeRepo(makeMessage());
  const networkErr = new Error('network');
  const { http } = makeHttp(networkErr);
  const svc = new MessageSendService(repo, http, baseConfig, fixedClock());
  await assert.rejects(() => svc.processSendJob({ id: 'msg-1' }), /network/);
  const inc = calls.find((c) => c[0] === 'incrementRetryCount');
  assert.ok(inc);
});
