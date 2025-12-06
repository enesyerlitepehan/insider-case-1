import { createItem, getItem, query, queryWithMeta, scan, updateItem } from './dynamodb-service';
import { DynamoDBItem, DynamoDbUpdateInput } from '../../interfaces/dynamo-db.interface';

export default class GenericDbService<T extends DynamoDBItem, U extends DynamoDbUpdateInput> {
  tableName: string;
  partitionKey: string;

  constructor(tableName: string, partitionKey: string) {
    this.tableName = tableName;
    this.partitionKey = partitionKey;
  }

  async getItem(partitionKeyData: string, fields?: string[]): Promise<T | undefined> {
    const expressionAttributeNames: Record<string, string> = {};

    let ProjectionExpression: string | undefined = undefined;
    if (fields && fields.length > 0) {
      for (const field of fields) {
        expressionAttributeNames[`#${field}`] = field;
      }
      ProjectionExpression = fields.map(f => `#${f}`).join(', ');
    }

    const params = {
      TableName: this.tableName,
      Key: {
        [this.partitionKey]: partitionKeyData,
      },
      ...(fields && {
        ProjectionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
      }),
    };

    const result = await getItem(params);
    return result.Item as T | undefined;
  }

  async getItemsByGSI(gsiIndexName: string, gsiIndexKey: string, gsiValue: string): Promise<T[]> {
    const params = {
      TableName: this.tableName,
      IndexName: gsiIndexName,
      ExpressionAttributeNames: {
        '#gsi_field': gsiIndexKey,
      },
      KeyConditionExpression: '#gsi_field = :gsi_value',
      ExpressionAttributeValues: {
        ':gsi_value': gsiValue,
      },
    };
    return (await query(params)) as T[];
  }
  async createItem(item: Omit<T, keyof DynamoDBItem>) {
    const now = new Date().toISOString();
    const params = {
      TableName: this.tableName,
      Item: {
        ...(item as T),
        createdAt: now,
        updatedAt: now,
      },
    };
    await createItem(params);
  }
  async updateItem(partitionKeyData: string, updateInput: Partial<U>) {
    const now = new Date().toISOString();
    const updateItems: Partial<U> = {
      ...updateInput,
      updatedAt: now,
    };
    const params = {
      TableName: this.tableName,
      Key: {
        [this.partitionKey]: partitionKeyData,
      },
      ExpressionAttributeNames: {} as Record<string, string>,
      ExpressionAttributeValues: {} as Record<string, any>,
      UpdateExpression: '',
    };
    let updatedExpression: string[] = [];
    const keys = Object.keys(updateItems) as (keyof U)[];
    keys.forEach(key => {
      const val = updateItems[key];
      params.ExpressionAttributeNames[`#${String(key)}`] = String(key);
      params.ExpressionAttributeValues[`:${String(key)}`] = val;
      updatedExpression.push(`#${String(key)} = :${String(key)}`);
    });
    params.UpdateExpression = 'set ' + updatedExpression.join(',');
    await updateItem(params);
  }

  async scanByContains(
    attributeName: string,
    attributeValue: string,
    fields?: string[],
  ): Promise<T[]> {
    const expressionAttributeNames: Record<string, string> = {
      '#attribute_name': attributeName,
    };

    let ProjectionExpression: string | undefined = undefined;
    if (fields && fields.length > 0) {
      for (const field of fields) {
        expressionAttributeNames[`#${field}`] = field;
      }
      ProjectionExpression = fields.map(f => `#${f}`).join(', ');
    }

    const params = {
      TableName: this.tableName,
      FilterExpression: 'contains(#attribute_name, :attribute_value)',
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: {
        ':attribute_value': attributeValue,
      },
      ...(ProjectionExpression && { ProjectionExpression }),
    };

    return (await scan(params)) as T[];
  }

  /**
   * Queries a DynamoDB Global Secondary Index (GSI) with pagination support,
   * optional projection (field selection), optional date range filtering on the sort key,
   * and optional control over the sort order (ascending or descending).
   *
   * @param options - Query options
   * @param options.tableName - The name of the DynamoDB table to query
   * @param options.indexName - The name of the Global Secondary Index (GSI) to use.
   * @param options.partitionKey - The name of the partition key attribute in the GSI.
   * @param options.partitionKeyValue - The value of the partition key to query by.
   * @param options.sortKey - (Optional) The name of the sort key attribute.
   * @param options.sortKeyFrom - (Optional) Start value for the sort key range (inclusive).
   * @param options.sortKeyTo - (Optional) End value for the sort key range (inclusive).
   * @param options.sortDescending - (Optional) If true, results will be returned in descending order. Defaults to ascending.
   * @param options.limit - (Optional) The maximum number of items to return.
   * @param options.lastEvaluatedKey - (Optional) The pagination key to continue from the last query.
   * @param options.projectionFields - (Optional) A list of fields to return (ProjectionExpression). Returns all fields if omitted.
   *
   * @returns A Promise resolving to an object with:
   * - items: the list of results
   * - lastEvaluatedKey: key for the next page (if more items are available)
   * - totalCount: total number of matching items (without pagination)
   */
  async findByGSIWithPagination(options: {
    tableName: string;
    indexName: string;
    partitionKey: string;
    partitionKeyValue: any;
    sortKey?: string;
    sortKeyFrom?: string;
    sortKeyTo?: string;
    sortDescending?: boolean;
    limit: number;
    lastEvaluatedKey?: Record<string, any>;
    projectionFields?: string[];
    pageNumber?: number;
  }) {
    const {
      tableName,
      indexName,
      partitionKey,
      partitionKeyValue,
      sortKey,
      sortKeyFrom,
      sortKeyTo,
      sortDescending = true,
      limit,
      lastEvaluatedKey,
      projectionFields,
      pageNumber,
    } = options;

    // Limit being recalculated because DynamoDB does not support offset pagination
    let itemsToFetch: number = limit;
    let sliceFlag = false;
    if (!lastEvaluatedKey && pageNumber && pageNumber > 1) {
      itemsToFetch = limit * pageNumber;
      sliceFlag = true;
    }

    const expressionAttributeNames: Record<string, string> = {
      '#pk': partitionKey,
    };

    const expressionAttributeValues: Record<string, any> = {
      ':pk': partitionKeyValue,
    };

    let keyCondition = '#pk = :pk';

    if (sortKey && sortKeyFrom && sortKeyTo) {
      expressionAttributeNames['#sk'] = sortKey;
      expressionAttributeValues[':start'] = sortKeyFrom;
      expressionAttributeValues[':end'] = sortKeyTo;
      keyCondition += ' AND #sk BETWEEN :start AND :end';
    }

    let ProjectionExpression: string | undefined = undefined;
    if (projectionFields && projectionFields.length > 0) {
      for (const field of projectionFields) {
        expressionAttributeNames[`#${field}`] = field;
      }
      ProjectionExpression = projectionFields.map(f => `#${f}`).join(', ');
    }

    const fullParams = {
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ProjectionExpression,
      ScanIndexForward: !sortDescending,
    };

    const { ProjectionExpression: _omitProjection, ...countParamsBase } = fullParams;

    if (countParamsBase.ExpressionAttributeNames) {
      const usedInKeyCondition = new Set<string>();
      if (countParamsBase.KeyConditionExpression) {
        for (const key in countParamsBase.ExpressionAttributeNames) {
          if (countParamsBase.KeyConditionExpression.includes(key)) {
            usedInKeyCondition.add(key);
          }
        }
      }

      countParamsBase.ExpressionAttributeNames = Object.fromEntries(
        Object.entries(countParamsBase.ExpressionAttributeNames).filter(([key]) =>
          usedInKeyCondition.has(key),
        ),
      );
    }

    const countResult = await queryWithMeta(
      {
        ...countParamsBase,
        Select: 'COUNT',
        Limit: undefined,
        ExclusiveStartKey: undefined,
      },
      undefined,
      undefined,
    );

    let dataResult = await queryWithMeta(fullParams, itemsToFetch, lastEvaluatedKey);

    // Instead of directly assigning the sliced array to dataResult
    if (sliceFlag) {
      const slicedItems = dataResult.items.slice(itemsToFetch - limit, itemsToFetch);
      return {
        items: slicedItems,
        lastEvaluatedKey: dataResult.lastEvaluatedKey,
        totalCount: countResult ? countResult.totalCount : 0,
      };
    }

    return {
      ...dataResult,
      ...(countResult ? { totalCount: countResult.totalCount } : {}),
    };
  }
}
