import { ApiResponse } from '/opt/nodejs/utils/api-response';
import { ApiError } from '/opt/nodejs/enums/api.enum';

type ApiGatewayEvent = {
  requestContext?: {
    requestId?: string;
  };
};

const baseHandler = async (event: ApiGatewayEvent) => {
  const apiResponse = new ApiResponse();
  try {
    const requestId = event?.requestContext?.requestId ?? 'unknown';
    return apiResponse.createSuccessResponse(200, {
      message: 'Healthcheck OK',
      data: {
        status: 'ok',
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    return apiResponse.createErrorResponse(
      500,
      'Healthcheck failed',
      ApiError.INTERNAL_SERVER_ERROR,
    );
  }
};

export const lambdaHandler = baseHandler
