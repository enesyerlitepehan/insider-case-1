/*
Test plan for MessageDispatchService:

- dispatchPendingMessages(limit):
  - queries repo.getPending(limit) and not more
  - for each candidate, calls repo.updateStatusIfCurrent(id, 'PENDING', 'IN_PROGRESS', ...)
  - only enqueues to SQS when conditional update returns true
  - returns the number of successfully enqueued messages
  - idempotency: when updateStatusIfCurrent returns false for a message (status changed), it is skipped

Mocks: MessageRepository, SqsClientLike, ClockLike
*/

export {};
