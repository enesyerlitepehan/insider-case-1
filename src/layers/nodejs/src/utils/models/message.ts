// Message domain types for DynamoDB storage

export type MessageStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SENT'
  | 'FAILED';

// Canonical DynamoDB item shape stored in the Messages table
export interface Message {
  // PK
  id: string;

  // recipient phone number (E.164 or local as provided)
  to: string;

  // body to be sent
  content: string;

  // lifecycle state
  status: MessageStatus;

  // external provider message identifier (set after successful send)
  messageId?: string;

  // timestamps (ISO-8601)
  createdAt: string;
  updatedAt: string;
  sentAt?: string;

  // retry metadata
  retryCount: number; // default 0

  // optional TTL epoch seconds if enabled at the table level
  expiresAt?: number;
}

// Input for creating a message (system will supply id/status/timestamps)
export interface CreateMessageInput {
  to: string;
  content: string;
}

// GSI name constants
export const MESSAGES_TABLE_NAME_ENV = 'MESSAGES_TABLE_NAME';
export const GSI_STATUS_CREATED_AT = 'GSI_StatusCreatedAt';
