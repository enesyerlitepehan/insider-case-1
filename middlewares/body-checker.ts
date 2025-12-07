import { APIGatewayProxyEvent } from 'aws-lambda';

export const bodyChecker = () => {
  return {
    before: async (request: { event: APIGatewayProxyEvent }) => {
      if (
        !request.event.body ||
        (!request.event.headers['Content-Type']?.includes('application/json') &&
          !request.event.headers['content-type']?.includes('application/json'))
      ) {
        //return apiResponse.createErrorResponse(400, "Request body is required and must be JSON", ApiError.VALIDATION_ERROR);
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: true,
            message: 'Request body is required and must be JSON',
            code: 'VALIDATION_ERROR',
          }),
        };
      }
    },
  };
};
