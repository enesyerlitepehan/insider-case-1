import { messageService } from 'insider-case-layer/utils/container';

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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

// Keep default export name expected by SAM Globals.Handler
export const lambdaHandler = handler;
