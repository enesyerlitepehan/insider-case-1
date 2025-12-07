import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { corsPolicies } from './cors-policies';
import { logger } from '../utils/logger';

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

// Middy v6 packages are ESM-only. Since this layer compiles to CommonJS,
// we must load @middy/http-cors via dynamic import at runtime.
type HttpCorsFactory = (
  opts: {
    origin?: string | boolean;
    credentials?: boolean;
    headers?: string;
    methods?: string;
  },
) => { after?: (req: any) => any; onError?: (req: any) => any };

let httpCorsFactory: HttpCorsFactory | null = null;
const getHttpCors = async (): Promise<HttpCorsFactory> => {
  if (!httpCorsFactory) {
    const mod: any = await import('@middy/http-cors');
    httpCorsFactory = mod.default ?? mod;
  }
  return httpCorsFactory!;
};

export const customCors = () => ({
  before: async (request: MiddlewareRequest) => {
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
    const httpCors = await getHttpCors();
    request.internal._cors = httpCors({
      origin: config.origin,
      credentials: config.credentials,
      headers: config.headers,
      methods: config.methods,
    });
  },
  after: async (request: MiddlewareRequest) => {
    await request.internal._cors?.after?.(request);
  },
  onError: async (request: MiddlewareRequest) => {
    await request.internal._cors?.onError?.(request);
  },
});
