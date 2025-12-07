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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const PACE_MS = 2500; // ~2.5s between sends to achieve ~2 msgs per 5s

export const baseHandler = async (event: SQSEvent) => {
  const total = event?.Records?.length ?? 0;
  logger.info('message-send-worker started ', { total });

  const records = event.Records ?? [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    try {
      const payload: SendMessageJobPayload = JSON.parse(rec.body);
      logger.info('worker processing message', {
        index: i + 1,
        total: records.length,
        sqsMessageId: rec.messageId,
        payloadId: payload?.id,
      });
      await messageSendService.processSendJob(payload);
      logger.info('worker processed message', {
        index: i + 1,
        total: records.length,
        payloadId: payload?.id,
      });
      const isLast = i === records.length - 1;
      if (!isLast) {
        await sleep(PACE_MS);
      }
    } catch (e) {
      logger.error('worker processing failed', {
        index: i + 1,
        total: records.length,
        sqsMessageId: rec.messageId,
        body: rec.body,
        error: (e as Error).message,
      });
      throw e;
    }
  }

  const apiResponse = new ApiResponse();
  return apiResponse.createSuccessResponse(200, {
    message: 'Worker processed messages',
    data: { ok: true, processed: total },
  });
};

export const lambdaHandler = baseHandler;
