import { Message } from '../utils/models/message';
import { MessageRepository } from './dynamodb-services/message-dynamodb-service';
import { logger } from '../utils/logger';
import {
  ClockLike,
  HttpClientLike,
  RedisClientLike,
  SystemClock,
  WebhookSuccessResponse,
  SendMessageJobPayload,
} from './types';

export interface MessageSendServiceConfig {
  webhookUrl: string;
  authKey?: string; // for x-ins-auth-key
  maxMessageLength: number; // e.g., 160
  cacheTtlSeconds?: number; // optional Redis TTL
}

export class MessageSendService {
  constructor(
    private readonly repo: MessageRepository,
    private readonly http: HttpClientLike,
    private readonly config: MessageSendServiceConfig,
    private readonly clock: ClockLike = SystemClock,
    private readonly redis?: RedisClientLike,
  ) {}

  async processSendJob(job: SendMessageJobPayload): Promise<void> {
    const { id } = job;
    const msg = await this.repo.getById(id);
    if (!msg) {
      logger.info('SendJob: message not found; skipping', { id });
      return;
    }

    // Idempotency guard
    if (msg.status === 'SENT') {
      logger.info('SendJob: already sent, skipping', { id });
      return;
    }
    if (msg.status === 'FAILED') {
      logger.info('SendJob: already marked FAILED; skipping', { id });
      return;
    }

    // Validate character limit (hard stop)
    const maxLen = this.config.maxMessageLength;
    if (msg.content.length > maxLen) {
      logger.error('SendJob: content exceeds max length, marking FAILED', {
        id,
        len: msg.content.length,
        maxLen,
      });
      await this.repo.updateStatus(id, 'FAILED', {
        updatedAt: this.clock.now().toISOString(),
      } as Partial<Message>);
      return;
    }

    // Prepare webhook request
    const url = this.config.webhookUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.authKey) {
      headers['x-ins-auth-key'] = this.config.authKey;
    }
    const body = {
      content: msg.content,
      to: msg.to,
    };

    try {
      const resp = await this.http.post<WebhookSuccessResponse>(url, body, headers);
      if (resp.status < 200 || resp.status >= 300) {
        await this.repo.incrementRetryCount(id);
        const err = new Error(`Webhook non-2xx status: ${resp.status}`);
        (err as any).status = resp.status;
        throw err;
      }

      const externalId = resp.data?.messageId;
      if (!externalId) {
        await this.repo.incrementRetryCount(id);
        throw new Error('Webhook response missing messageId');
      }

      // Append a random suffix to ensure uniqueness for messageId
      const randomUid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const messageId = `${externalId}-${randomUid}`;

      const nowIso = this.clock.now().toISOString();
      await this.repo.updateStatus(id, 'SENT', {
        messageId,
        sentAt: nowIso,
        updatedAt: nowIso,
      } as Partial<Message>);

      if (this.redis) {
        try {
          const key = `message:${id}`;
          const value = JSON.stringify({ messageId, sentAt: nowIso });
          await this.redis.set(key, value, this.config.cacheTtlSeconds);
        } catch (e) {
          // Cache failures should not break main flow
          logger.error('SendJob: redis cache error', { id, error: (e as Error).message });
        }
      }
    } catch (e) {
      // Let SQS retry by throwing; retryCount already incremented above on known cases.
      // For network or other unexpected errors, also increment retry count.
      if ((e as any)?.status === undefined) {
        try { await this.repo.incrementRetryCount(id); } catch {}
      }
      logger.error('SendJob: webhook send failed', { id, status: (e as any)?.status, error: (e as Error).message });
      throw e;
    }
  }
}
