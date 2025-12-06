/*
Test plan (using your preferred test runner):

MessageService
- createMessage():
  - generates id, sets status=PENDING, retryCount=0, timestamps now
  - calls repo.create with constructed Message
  - returns created message

- listSentMessages():
  - calls repo.getByStatus('SENT') and returns its result

Mock: MessageRepository with spies; inject fixed clock and id factory for determinism.
*/

export {};
