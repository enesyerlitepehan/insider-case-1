import { APIGatewayProxyEvent } from 'aws-lambda';
import * as yup from 'yup';

type MiddyRequest = {
  event: APIGatewayProxyEvent;
  internal?: {
    eventSchema?: yup.ObjectSchema<any>;
  };
};

// Lightweight yup-based validator middleware similar to unified-payment-service
export const validator = (schema?: yup.ObjectSchema<any>) => ({
  before: async (request: MiddyRequest) => {
    const activeSchema = schema ?? request.internal?.eventSchema;
    if (!activeSchema) {
      throw new Error('No validation schema provided');
    }

    try {
      const parsed = await activeSchema.validate(request.event, {
        abortEarly: false,
        stripUnknown: false,
      });
      request.event = {
        ...request.event,
        ...activeSchema.cast(parsed, { stripUnknown: false }),
      };
    } catch (err: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: true,
          message: err.errors?.join(', ') ?? 'Validation error',
          code: 'VALIDATION_ERROR',
        }),
      };
    }
  },
});
