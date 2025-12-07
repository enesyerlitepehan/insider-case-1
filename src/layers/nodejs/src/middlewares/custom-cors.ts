import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { corsPolicies } from './cors-policies';
import { logger } from '../utils/logger';

// Middy http-cors is ESM-only; load lazily via dynamic import to avoid require() issues in CJS build output
let httpCorsFactory: any | null = null;
const getHttpCors = async () => {
  if (httpCorsFactory) return httpCorsFactory;
  const mod = await import('@middy/http-cors');
  httpCorsFactory = mod.default ?? mod;
  return httpCorsFactory;
};

type MiddlewareRequest = {
  event: APIGatewayProxyEvent;
  context: Context;
  response?: {
    statusCode: number;
    headers?: Record<string, any>;
    body?: string;
  };
  internal: Record<string, any>;
};

export const customCors = () => ({
  before: async (request: MiddlewareRequest) => {
    const httpCors = await getHttpCors();
    const resource = (request.event as any).resource as string | undefined;
    const path = (request.event.path || '') as string;

    const target = resource || path;

    const matched = Object.entries(corsPolicies)
      .sort(([a], [b]) => b.length - a.length)
      .find(([key]) => target.startsWith(key) || path.includes(key));

    if (!matched) {
      logger.error(
        `[CORS] No policy matched → resource: ${resource || 'N/A'}, path: ${path}, origin: ${request.event.headers?.origin || request.event.headers?.Origin || 'N/A'}`,
      );
    }

    const config = matched?.[1] ?? { origin: '*' };

    // store httpCors middleware to run after/onError
    request.internal._cors = httpCors({
      origin: config.origin,
      credentials: config.credentials,
      headers: config.headers,
      methods: config.methods,
    });
  },
  after: async (request: MiddlewareRequest) => {
    const httpCors = await getHttpCors();
    await request.internal._cors?.after?.(request);
  },
  onError: async (request: MiddlewareRequest) => {
    const httpCors = await getHttpCors();
    await request.internal._cors?.onError?.(request);
  },
});
