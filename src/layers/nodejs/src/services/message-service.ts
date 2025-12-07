import { CreateMessageInput, Message } from '../utils/models/message';
import { MessageRepository } from './dynamodb-services/message-dynamodb-service';
import { ClockLike, SystemClock } from './types';

function uuidv4(): string {
  // Lightweight UUID v4 generator without external deps
  // Falls back to Math.random based implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MessageService {
  constructor(
    private readonly repo: MessageRepository,
    private readonly clock: ClockLike = SystemClock,
    private readonly idFactory: () => string = uuidv4,
  ) {}

  async listSentMessages(): Promise<Message[]> {
    return this.repo.getByStatus('SENT');
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    const nowIso = this.clock.now().toISOString();
    const message: Message = {
      id: this.idFactory(),
      to: input.to,
      content: input.content,
      status: 'PENDING',
      retryCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.repo.create(message);
    return message;
  }
}
