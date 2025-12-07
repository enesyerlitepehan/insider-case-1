import middy from '@middy/core';
import { customCors } from '/opt/nodejs/middlewares/custom-cors';
import { bodyChecker } from '/opt/nodejs/middlewares/body-checker';
import { basicAuth } from '/opt/nodejs/middlewares/basic-auth';
import { messageService } from '/opt/nodejs/utils/container';

type APIGatewayProxyEvent = {
  body: string | null;
};

type APIGatewayProxyResult = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

const baseHeaders = {
  'Content-Type': 'application/json',
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

export const lambdaHandler = middy(baseHandler)
  .use(customCors())
  .use(bodyChecker())
  .use(basicAuth());
