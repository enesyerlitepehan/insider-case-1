import { Message } from '../utils/models/message';

// Job payload enqueued to SQS by dispatcher
export interface SendMessageJobPayload {
  id: string;
}

// Abstractions for external clients to make services testable
export interface SqsClientLike {
  sendMessage(params: { QueueUrl: string; MessageBody: string }): Promise<void>;
}

export interface HttpClientLike {
  post<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<{ status: number; data: T }>;
}

export interface RedisClientLike {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export interface ClockLike {
  now(): Date;
}

export const SystemClock: ClockLike = {
  now: () => new Date(),
};

export type WebhookSuccessResponse = {
  messageId?: string;
  [k: string]: unknown;
};

export type MessageList = Message[];
