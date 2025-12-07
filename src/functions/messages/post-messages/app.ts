import middy from '@middy/core';
import { bodyChecker } from '/opt/nodejs/middlewares/body-checker';
import { basicAuth } from '/opt/nodejs/middlewares/basic-auth';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import { messageService } from '/opt/nodejs/utils/container';
import { ApiResponse } from '/opt/nodejs/utils/api-response';
import { ApiError } from '/opt/nodejs/enums/api.enum';
import type { HTTPResponse } from '/opt/nodejs/utils/common';
import { validator } from '/opt/nodejs/middlewares/validator';
import { postMessageSchema } from '/opt/nodejs/middlewares/schemas/messages/post-message-schema';
import { logger } from '/opt/nodejs/utils/logger';

type APIGatewayProxyEvent = {
  body: any;
};

const baseHandler = async (
  event: APIGatewayProxyEvent,
): Promise<HTTPResponse> => {
  const apiResponse = new ApiResponse();
  try {
    const payload = event.body as { messages: { to: string; content: string }[] };

    const created = await Promise.all(
      (payload.messages ?? []).map(msg =>
        messageService.createMessage({
          to: msg.to,
          content: msg.content,
        }),
      ),
    );

    return apiResponse.createSuccessResponse(201, {
      message: 'Messages created',
      data: { count: created.length, messages: created },
    });
  } catch (error) {
    logger.error('POST /messages failed', { error: (error as Error)?.message });
    return apiResponse.createErrorResponse(
      500,
      'Internal server error',
      ApiError.INTERNAL_SERVER_ERROR,
    );
  }
};

export const lambdaHandler = middy(baseHandler)
  .use(bodyChecker())
  .use(httpJsonBodyParser())
  .use(validator(postMessageSchema))
  .use(basicAuth());
