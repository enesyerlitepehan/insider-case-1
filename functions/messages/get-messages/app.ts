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

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const messages = await messageService.listSentMessages();
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify(messages),
    };
  } catch (error) {
    console.error('Error in GET /messages', error);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

// Keep default export name expected by SAM Globals.Handler
export const lambdaHandler = handler;
