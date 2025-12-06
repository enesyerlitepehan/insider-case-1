import { messageDispatchService } from 'insider-case-layer/utils/container';
import { logger } from 'insider-case-layer/utils/logger';

export const schedulerHandler = async () => {
  const startedAt = new Date().toISOString();
  const pendingLimitRaw = process.env.PENDING_LIMIT;
  const pendingLimit = Number.isFinite(Number(pendingLimitRaw)) ? Number(pendingLimitRaw) : 2;

  logger.info('message-dispatcher start', { startedAt, pendingLimit });
  try {
    const enqueued = await messageDispatchService.dispatchPendingMessages(pendingLimit);
    logger.info('message-dispatcher done', { enqueued });
    return { statusCode: 200, body: JSON.stringify({ ok: true, enqueued }) } as any;
  } catch (e) {
    logger.error('message-dispatcher error', { error: (e as Error).message });
    throw e; // allow failure for monitoring/alarms
  }
};

// Keep default export name expected by SAM Globals.Handler
export const lambdaHandler = schedulerHandler;
