import { messageSendService } from '/opt/utils/container';
import { logger } from '/opt/utils/logger';
import type { SendMessageJobPayload } from '/opt/services/types';

type SQSEventRecord = {
  messageId: string;
  body: string;
  attributes?: Record<string, string>;
};

type SQSEvent = {
  Records: SQSEventRecord[];
};

export const workerHandler = async (event: SQSEvent) => {
  logger.info('message-send-worker invoked', { count: event?.Records?.length ?? 0 });

  for (const rec of event.Records ?? []) {
    try {
      const payload: SendMessageJobPayload = JSON.parse(rec.body);
      logger.info('worker processing', { messageId: rec.messageId, payloadId: payload?.id });
      await messageSendService.processSendJob(payload);
      logger.info('worker processed', { payloadId: payload?.id });
    } catch (e) {
      logger.error('worker error', {
        sqsMessageId: rec.messageId,
        body: rec.body,
        error: (e as Error).message,
      });
      // Re-throw to signal failure and allow SQS/Lambda to retry
      throw e;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, processed: event.Records?.length ?? 0 }),
  } as any;
};

// Keep default export name expected by SAM Globals.Handler
export const lambdaHandler = workerHandler;
