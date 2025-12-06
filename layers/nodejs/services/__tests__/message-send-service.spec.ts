/*
Test plan for MessageSendService:

- processSendJob({ id }):
  - loads message by id; if not found, returns without error
  - if status=SENT, returns without calling webhook
  - if status=FAILED, returns without calling webhook
  - validates content length; if > max, marks FAILED and returns
  - performs POST to webhook with headers and payload
  - on 2xx with response.data.messageId, updates message to SENT with messageId and sentAt
  - on non-2xx, increments retryCount and throws (so SQS can retry)
  - on network error/exception, increments retryCount and throws
  - if Redis configured, caches {messageId, sentAt} under key message:<id>

Mocks: MessageRepository, HttpClientLike, RedisClientLike, fixed ClockLike
*/

export {};
