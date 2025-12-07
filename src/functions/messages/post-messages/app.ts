import middy from '@middy/core';
import { bodyChecker } from '/opt/nodejs/middlewares/body-checker';
import { basicAuth } from '/opt/nodejs/middlewares/basic-auth';
import { corsPolicies } from '/opt/nodejs/middlewares/cors-policies';
import { messageService } from '/opt/nodejs/utils/container';

type APIGatewayProxyEvent = {
  body: string | null;
};

type APIGatewayProxyResult = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

const corsConfig = corsPolicies['/messages'] ?? {
  origin: '*',
  credentials: false,
  headers: 'Content-Type,Authorization',
  methods: 'GET,POST,OPTIONS',
};

const baseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': corsConfig.origin,
  ...(corsConfig.credentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
  ...(corsConfig.headers ? { 'Access-Control-Allow-Headers': corsConfig.headers } : {}),
  ...(corsConfig.methods ? { 'Access-Control-Allow-Methods': corsConfig.methods } : {}),
};

const baseHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    let payload: { to?: string; content?: string };
    try {
      payload = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    if (!payload.to || !payload.content) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({
          error: 'Validation error',
          details: 'Both "to" and "content" are required',
        }),
      };
    }

    const created = await messageService.createMessage({
      to: payload.to,
      content: payload.content,
    });

    return {
      statusCode: 201,
      headers: baseHeaders,
      body: JSON.stringify(created),
    };
  } catch (error) {
    console.error('Error in POST /messages', error);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export const lambdaHandler = middy(baseHandler).use(bodyChecker()).use(basicAuth());
