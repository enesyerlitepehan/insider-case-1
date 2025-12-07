import { messageDispatchService } from '/opt/nodejs/utils/container';
import { logger } from '/opt/nodejs/utils/logger';
import { ApiResponse } from '/opt/nodejs/utils/api-response';

export const baseHandler = async () => {
  const pendingLimitRaw = process.env.PENDING_LIMIT;
  const pendingLimit = Number.isFinite(Number(pendingLimitRaw)) ? Number(pendingLimitRaw) : 2;

  logger.info('message-dispatcher started');
  try {
    const enqueued = await messageDispatchService.dispatchPendingMessages(pendingLimit);
    logger.info('message-dispatcher completed');
    const apiResponse = new ApiResponse();
    return apiResponse.createSuccessResponse(200, {
      message: 'Dispatch completed',
      data: { ok: true, enqueued },
    });
  } catch (e) {
    logger.error('message-dispatcher failed', { error: (e as Error).message });
    throw e; // allow failure for monitoring/alarms
  }
};

export const lambdaHandler = baseHandler;
