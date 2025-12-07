import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  BatchWriteCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
export async function createItem(params: PutCommandInput) {
  const result = await client.send(new PutCommand(params));
  return result;
}

export async function getItem(params: GetCommandInput) {
  const result = await docClient.send(new GetCommand(params));
  return result;
}

export async function updateItem(params: UpdateCommandInput) {
  const result = await client.send(new UpdateCommand(params));
  return result;
}

export async function query(params: QueryCommandInput) {
  let lastEvaluatedKey: any;
  let results: any[] = [];
  while (true) {
    params.ExclusiveStartKey = lastEvaluatedKey;
    const queryResult = await client.send(new QueryCommand(params));
    results = results.concat(queryResult.Items);

    if (!queryResult.LastEvaluatedKey) {
      break;
    }
    lastEvaluatedKey = queryResult.LastEvaluatedKey;
  }
  return results;
}

export async function scan(params: ScanCommandInput) {
  let lastEvaluatedKey: any;
  let results: any[] = [];
  while (true) {
    params.ExclusiveStartKey = lastEvaluatedKey;
    const scanResult = await client.send(new ScanCommand(params));
    results = results.concat(scanResult.Items);
    if (!scanResult.LastEvaluatedKey) {
      break;
    }
    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  }
  return results;
}

export async function batchWrite(params: BatchWriteCommandInput) {
  const result = await client.send(new BatchWriteCommand(params));
  return result;
}

export async function queryWithMeta(
  params: QueryCommandInput,
  limit?: number,
  lastEvaluatedKey?: Record<string, any>,
): Promise<{
  items: Record<string, any>[];
  lastEvaluatedKey?: Record<string, any>;
  totalCount: number;
}> {
  const dataParams: QueryCommandInput = {
    ...params,
    Limit: limit,
    ExclusiveStartKey: lastEvaluatedKey,
  };

  const dataResult = await docClient.send(new QueryCommand(dataParams));

  return {
    items: dataResult.Items ?? [],
    lastEvaluatedKey: dataResult.LastEvaluatedKey,
    totalCount: dataResult.Count ?? 0,
  };
}
