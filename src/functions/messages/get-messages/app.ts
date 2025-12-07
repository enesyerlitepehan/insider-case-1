import middy from '@middy/core';
import { basicAuth } from '/opt/nodejs/middlewares/basic-auth';
import { messageService } from '/opt/nodejs/utils/container';
import { ApiResponse } from '/opt/nodejs/utils/api-response';
import { ApiError } from '/opt/nodejs/enums/api.enum';
import type { HTTPResponse } from '/opt/nodejs/utils/common';
import { logger } from '/opt/nodejs/utils/logger';

type APIGatewayProxyEvent = {
  body: string | null;
};

const baseHandler = async (
  _event: APIGatewayProxyEvent,
): Promise<HTTPResponse> => {
  const apiResponse = new ApiResponse();
  try {
    const messages = await messageService.listSentMessages();
    return apiResponse.createSuccessResponse(200, {
      message: 'Messages fetched successfully',
      data: messages,
    });
  } catch (error) {
    logger.error('GET /messages failed', { error: (error as Error)?.message });
    return apiResponse.createErrorResponse(
      500,
      'Internal server error',
      ApiError.INTERNAL_SERVER_ERROR,
    );
  }
};

export const lambdaHandler = middy(baseHandler).use(basicAuth());
