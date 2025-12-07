import middy from '@middy/core';
import { customCors } from '/opt/nodejs/middlewares/custom-cors';
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
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
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

export const lambdaHandler = middy(baseHandler)
  .use(
    customCors(),
  )
  .use(basicAuth({ headers: baseHeaders }));
