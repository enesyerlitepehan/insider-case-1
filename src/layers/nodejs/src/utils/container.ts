import { MessageDynamoDbService, MessageRepository } from '../services/dynamodb-services/message-dynamodb-service';
import { MessageService } from '../services/message-service';
import { MessageDispatchService } from '../services/message-dispatch-service';
import { MessageSendService, MessageSendServiceConfig } from '../services/message-send-service';
import { HttpClientLike, SqsClientLike } from '../services/types';
import { logger } from './logger';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import axios from 'axios';

// Minimal declarations so this module can compile even if @types/node is not installed in CI
// (CI may run `npm run build` without installing devDependencies for the layer.)
// These declarations only affect typing; runtime behavior relies on actual Node globals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

// Build external clients lazily and keep them shared across invocations

// SQS client wrapper using AWS SDK v3 (if available at runtime) or a logging fallback
class AwsSqsClient implements SqsClientLike {
  private sqs: SQSClient | null = null;
  constructor() {
    try {
      this.sqs = new SQSClient({});
    } catch (_e) {
      logger.warn('SQS client unavailable; falling back to noop', {
        error: (_e as Error)?.message,
      });
      this.sqs = null;
    }
  }
  async sendMessage(params: { QueueUrl: string; MessageBody: string }): Promise<void> {
    if (!this.sqs) {
      logger.info('SQS.sendMessage (noop fallback)', { queueUrl: params.QueueUrl, bodyLen: params.MessageBody?.length });
      return;
    }
    try {
      const cmd = new SendMessageCommand({ QueueUrl: params.QueueUrl, MessageBody: params.MessageBody });
      const resp = await this.sqs.send(cmd);
      logger.info('SQS.sendMessage success', {
        queueUrl: params.QueueUrl,
        bodyLen: params.MessageBody?.length,
        messageId: resp?.MessageId,
      });
    } catch (e) {
      logger.error('SQS.sendMessage error', { queueUrl: params.QueueUrl, error: (e as Error).message });
      throw e;
    }
  }
}

// HTTP client implemented with axios
const axiosClient = axios.create({
  // Do not throw for non-2xx; let callers inspect status
  validateStatus: () => true,
  // Optional timeout from env, default 10s
  timeout: Number(process.env.HTTP_TIMEOUT_MS || 10000),
});

const httpClient: HttpClientLike = {
  async post(url, body, headers) {
    const resp = await axiosClient.post(url, body ?? {}, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(headers ?? {}),
      },
    });
    return { status: resp.status, data: resp.data };
  },
};

// No direct AWS SDK v2 DocumentClient usage for repository; we use AWS SDK v3 in the DynamoDB service

// Environment accessors
const env = {
  messagesTable: process.env.MESSAGES_TABLE || process.env.MESSAGES_TABLE_NAME || '',
  queueUrl: process.env.MESSAGE_SEND_QUEUE_URL || process.env.MainQueueUrl || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookAuthKey: process.env.WEBHOOK_AUTH_KEY,
  maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH || 200),
};

// Shared instances
const repository: MessageRepository = new MessageDynamoDbService(env.messagesTable);
const sqsClient: SqsClientLike = new AwsSqsClient();

const messageServiceInstance = new MessageService(repository);
const messageDispatchServiceInstance = new MessageDispatchService(
  repository,
  sqsClient,
  env.queueUrl,
  { now: () => new Date() },
);

const sendConfig: MessageSendServiceConfig = {
  webhookUrl: env.webhookUrl,
  authKey: env.webhookAuthKey,
  maxMessageLength: env.maxMessageLength,
};
const messageSendServiceInstance = new MessageSendService(repository, httpClient, sendConfig);

export const container = {
  repository,
  messageService: messageServiceInstance,
  messageDispatchService: messageDispatchServiceInstance,
  messageSendService: messageSendServiceInstance,
};

export const messageService = container.messageService;
export const messageDispatchService = container.messageDispatchService;
export const messageSendService = container.messageSendService;
