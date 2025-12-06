import { DynamoDbMessageRepository, MessageRepository } from './repositories/message-repository';
import { MessageService } from './services/message-service';
import { MessageDispatchService } from './services/message-dispatch-service';
import { MessageSendService, MessageSendServiceConfig } from './services/message-send-service';
import { HttpClientLike, SqsClientLike } from './services/types';
import { logger } from './logger';

// Build external clients lazily and keep them shared across invocations

// SQS client wrapper using AWS SDK v2 (if available at runtime) or a logging fallback
class AwsSqsClient implements SqsClientLike {
  private sqs: any | null = null;
  constructor() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AWS = require('aws-sdk');
      this.sqs = new AWS.SQS();
    } catch (_e) {
      this.sqs = null;
    }
  }
  async sendMessage(params: { QueueUrl: string; MessageBody: string }): Promise<void> {
    if (!this.sqs) {
      logger.info('SQS.sendMessage (noop fallback)', { queueUrl: params.QueueUrl, bodyLen: params.MessageBody?.length });
      return;
    }
    await this.sqs.sendMessage({ QueueUrl: params.QueueUrl, MessageBody: params.MessageBody }).promise();
  }
}

// Minimal HTTP client using global fetch (Node 18+)
const httpClient: HttpClientLike = {
  async post(url, body, headers) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(headers ?? {}) },
      body: JSON.stringify(body ?? {}),
    });
    let data: any = null;
    try {
      data = await resp.json();
    } catch (_) {
      // ignore non-JSON bodies
    }
    return { status: resp.status, data };
  },
};

// DynamoDB DocumentClient (optional, handlers should not use directly)
function buildDocClient(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AWS = require('aws-sdk');
    return new AWS.DynamoDB.DocumentClient();
  } catch (_e) {
    return null;
  }
}

// Environment accessors
const env = {
  messagesTable: process.env.MESSAGES_TABLE || process.env.MESSAGES_TABLE_NAME || '',
  queueUrl: process.env.MESSAGE_SEND_QUEUE_URL || process.env.MainQueueUrl || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookAuthKey: process.env.WEBHOOK_AUTH_KEY,
  maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH || 200),
};

// Shared instances
const docClient = buildDocClient();
const repository: MessageRepository = new DynamoDbMessageRepository(docClient, env.messagesTable);
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
