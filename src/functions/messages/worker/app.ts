import { messageSendService } from '/opt/nodejs/utils/container';
import { logger } from '/opt/nodejs/utils/logger';
import type { SendMessageJobPayload } from '/opt/nodejs/services/types';
import { ApiResponse } from '/opt/nodejs/utils/api-response';

type SQSEventRecord = {
  messageId: string;
  body: string;
  attributes?: Record<string, string>;
};

type SQSEvent = {
  Records: SQSEventRecord[];
};

export const baseHandler = async (event: SQSEvent) => {
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

  const apiResponse = new ApiResponse();
  return apiResponse.createSuccessResponse(200, {
    message: 'Worker processed messages',
    data: { ok: true, processed: event.Records?.length ?? 0 },
  });
};

// Keep default export name expected by SAM Globals.Handler
export const lambdaHandler = baseHandler;
