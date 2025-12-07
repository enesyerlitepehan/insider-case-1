import { APIGatewayProxyEvent } from 'aws-lambda';

type MiddyRequest = { event: APIGatewayProxyEvent } & {
  response?: { statusCode: number; headers?: Record<string, string>; body?: string };
};

export const bodyChecker = () => {
  return {
    before: async (request: MiddyRequest) => {
      const contentType =
        request.event.headers?.['Content-Type'] ||
        request.event.headers?.['content-type'] ||
        '';

      const isJson = typeof contentType === 'string' && contentType.includes('application/json');

      if (!request.event.body || !isJson) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
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
