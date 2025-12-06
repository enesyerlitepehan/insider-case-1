import { Message, MessageStatus, GSI_STATUS_CREATED_AT } from '../models/message';

// Repository interface describing how the system interacts with DynamoDB layer
export interface MessageRepository {
  create(message: Message): Promise<void>;
  getById(id: string): Promise<Message | null>;
  // Must query GSI_StatusCreatedAt with status = 'PENDING', order by createdAt ASC, limit N
  getPending(limit: number): Promise<Message[]>;
  // Should support adding messageId, sentAt, etc. via extraFields
  updateStatus(
    id: string,
    status: MessageStatus,
    extraFields?: Partial<Message>
  ): Promise<void>;
  // Increment retryCount atomically
  incrementRetryCount(id: string): Promise<void>;
}

// Optional skeleton implementation (no business logic, no external SDK dependency enforced here)
export class DynamoDbMessageRepository implements MessageRepository {
  private tableName: string;
  private gsiName = GSI_STATUS_CREATED_AT;
  // Using any type for the client to avoid adding SDK deps in this step
  constructor(private readonly docClient: any, tableName: string) {
    this.tableName = tableName;
  }

  async create(_message: Message): Promise<void> {
    throw new Error('Not implemented');
  }

  async getById(_id: string): Promise<Message | null> {
    throw new Error('Not implemented');
  }

  async getPending(_limit: number): Promise<Message[]> {
    // Query GSI where status = 'PENDING' ordered by createdAt ASC (KeyConditionExpression)
    throw new Error('Not implemented');
  }

  async updateStatus(
    _id: string,
    _status: MessageStatus,
    _extraFields?: Partial<Message>
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async incrementRetryCount(_id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
