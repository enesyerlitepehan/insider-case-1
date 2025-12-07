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

type APIGatewayProxyEvent = {
  body: any;
};

const baseHandler = async (
  event: APIGatewayProxyEvent,
): Promise<HTTPResponse> => {
  const apiResponse = new ApiResponse();
  try {
    const payload = event.body as { to: string; content: string };

    const created = await messageService.createMessage({
      to: payload.to,
      content: payload.content,
    });

    return apiResponse.createSuccessResponse(201, {
      message: 'Message created',
      data: created,
    });
  } catch (error) {
    console.error('Error in POST /messages', error);
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
