import {
  GSI_STATUS_CREATED_AT,
  Message,
  MessageStatus,
} from '../../utils/models/message';
import {
  createItem as putItem,
  getItem as dbGetItem,
  query as dbQuery,
  updateItem as dbUpdateItem,
} from './dynamodb-service';

// Repository interface describing how the system interacts with DynamoDB layer
export interface MessageRepository {
  create(message: Message): Promise<void>;
  getById(id: string): Promise<Message | null>;
  // Must query GSI_StatusCreatedAt with status = 'PENDING', order by createdAt ASC, limit N
  getPending(limit: number): Promise<Message[]>;
  // Generic status query for read APIs (e.g., list sent messages)
  getByStatus(status: MessageStatus, limit?: number): Promise<Message[]>;
  // Should support adding messageId, sentAt, etc. via extraFields
  updateStatus(
    id: string,
    status: MessageStatus,
    extraFields?: Partial<Message>,
  ): Promise<void>;
  // Conditional status transition; returns true if updated, false if condition failed
  updateStatusIfCurrent(
    id: string,
    expectedCurrent: MessageStatus,
    nextStatus: MessageStatus,
    extraFields?: Partial<Message>,
  ): Promise<boolean>;
  // Increment retryCount atomically
  incrementRetryCount(id: string): Promise<void>;
}

export class MessageDynamoDbService implements MessageRepository {
  private readonly tableName: string;
  private readonly gsiStatusCreatedAt = GSI_STATUS_CREATED_AT;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async create(message: Message): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: message,
    } as const;
    await putItem(params as any);
  }

  async getById(id: string): Promise<Message | null> {
    const params = {
      TableName: this.tableName,
      Key: { id },
    } as const;
    const res = await dbGetItem(params as any);
    return (res?.Item as Message) ?? null;
  }

  async getPending(limit: number): Promise<Message[]> {
    const effectiveLimit = Math.max(0, Math.min(limit ?? 0, 100));
    if (effectiveLimit === 0) return [];
    const params = {
      TableName: this.tableName,
      IndexName: this.gsiStatusCreatedAt,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'PENDING',
      },
      KeyConditionExpression: '#status = :status',
      ScanIndexForward: true, // ASC by createdAt
      Limit: effectiveLimit,
    } as const;
    const items = await dbQuery(params as any);
    return (items as Message[]) ?? [];
  }

  async getByStatus(status: MessageStatus, limit?: number): Promise<Message[]> {
    const params = {
      TableName: this.tableName,
      IndexName: this.gsiStatusCreatedAt,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      KeyConditionExpression: '#status = :status',
      // For read APIs show most recent first
      ScanIndexForward: false, // DESC by createdAt
      ...(limit ? { Limit: Math.max(0, Math.min(limit, 1000)) } : {}),
    } as const;
    const items = await dbQuery(params as any);
    return (items as Message[]) ?? [];
  }

  async updateStatus(
    id: string,
    status: MessageStatus,
    extraFields?: Partial<Message>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const updates: Record<string, any> = { status, ...(extraFields ?? {}) };
    if (!('updatedAt' in updates)) {
      updates['updatedAt'] = now;
    }

    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    const sets: string[] = [];

    for (const [k, v] of Object.entries(updates)) {
      names[`#${k}`] = k;
      values[`:${k}`] = v;
      sets.push(`#${k} = :${k}`);
    }

    const params = {
      TableName: this.tableName,
      Key: { id },
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      UpdateExpression: 'SET ' + sets.join(', '),
    } as const;

    await dbUpdateItem(params as any);
  }

  async updateStatusIfCurrent(
    id: string,
    expectedCurrent: MessageStatus,
    nextStatus: MessageStatus,
    extraFields?: Partial<Message>,
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      status: nextStatus,
      ...(extraFields ?? {}),
    };
    if (!('updatedAt' in updates)) {
      updates['updatedAt'] = now;
    }

    const names: Record<string, string> = { '#status': 'status' };
    const values: Record<string, any> = { ':expected': expectedCurrent } as any;
    const sets: string[] = [];

    for (const [k, v] of Object.entries(updates)) {
      names[`#${k}`] = k;
      (values as any)[`:${k}`] = v;
      sets.push(`#${k} = :${k}`);
    }

    const params = {
      TableName: this.tableName,
      Key: { id },
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      UpdateExpression: 'SET ' + sets.join(', '),
      ConditionExpression: '#status = :expected',
    } as const;

    try {
      await dbUpdateItem(params as any);
      return true;
    } catch (e: any) {
      const code = e?.name || e?.code;
      if (code === 'ConditionalCheckFailedException') {
        return false;
      }
      throw e;
    }
  }

  async incrementRetryCount(id: string): Promise<void> {
    const now = new Date().toISOString();
    const params = {
      TableName: this.tableName,
      Key: { id },
      ExpressionAttributeNames: {
        '#retryCount': 'retryCount',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':zero': 0,
        ':now': now,
      },
      UpdateExpression:
        'SET #retryCount = if_not_exists(#retryCount, :zero) + :inc, #updatedAt = :now',
    } as const;

    await dbUpdateItem(params as any);
  }
}
