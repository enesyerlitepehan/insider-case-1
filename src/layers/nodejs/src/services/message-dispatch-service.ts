import { MessageRepository } from './dynamodb-services/message-dynamodb-service';
import { ClockLike, SqsClientLike } from './types';

export class MessageDispatchService {
  constructor(
    private readonly repo: MessageRepository,
    private readonly sqs: SqsClientLike,
    private readonly queueUrl: string,
    private readonly clock: ClockLike,
  ) {}

  // Dispatch up to `limit` pending messages into SQS; returns enqueued count
  async dispatchPendingMessages(limit: number = 2): Promise<number> {
    const effectiveLimit = Math.max(0, Math.min(limit, 100)); // basic guard
    if (effectiveLimit === 0) return 0;

    const candidates = await this.repo.getPending(effectiveLimit);
    let enqueued = 0;
    for (const m of candidates) {
      // Idempotent transition PENDING -> IN_PROGRESS
      const ok = await this.repo.updateStatusIfCurrent(
        m.id,
        'PENDING',
        'IN_PROGRESS',
        { updatedAt: this.clock.now().toISOString() },
      );
      if (!ok) {
        continue; // skip if someone else took it
      }

      // Enqueue minimal payload
      const payload = { id: m.id };
      await this.sqs.sendMessage({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(payload),
      });
      enqueued += 1;
    }
    return enqueued;
  }
}
