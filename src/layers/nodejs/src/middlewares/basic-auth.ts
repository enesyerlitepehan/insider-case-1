import { APIGatewayProxyEvent } from 'aws-lambda';
import { corsPolicies } from './cors-policies';

type MiddyRequest = { event: APIGatewayProxyEvent };

type BasicAuthOptions = {
  headers?: Record<string, string>;
};

// Default CORS headers for messages endpoints to avoid duplication in handlers
const corsConfig = {
  credentials: false,
  headers: 'Content-Type,Authorization',
  methods: 'GET,POST,OPTIONS',
  ...corsPolicies['/messages'],
};

const baseHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': corsConfig.origin,
  'Access-Control-Allow-Credentials': corsConfig.credentials ? 'true' : 'false',
  'Access-Control-Allow-Headers': corsConfig.headers,
  'Access-Control-Allow-Methods': corsConfig.methods,
};

const unauthorized = (headers?: Record<string, string>) => ({
  statusCode: 401,
  headers: { 'WWW-Authenticate': 'Basic', ...(headers ?? baseHeaders) },
  body: JSON.stringify({ error: true, message: 'Unauthorized' }),
});

export const basicAuth = (options: BasicAuthOptions = {}) => {
  return {
    before: async (request: MiddyRequest) => {
      // If credentials are not provided, auth is effectively disabled
      if (!process.env.AUTH_USER || !process.env.AUTH_PASS) {
        return;
      }

      const header =
        request.event.headers?.authorization || request.event.headers?.Authorization;
      if (!header?.startsWith('Basic ')) {
        return unauthorized(options.headers);
      }

      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const [user, pass] = decoded.split(':');
      if (!user || pass === undefined) {
        return unauthorized(options.headers);
      }

      if (user !== process.env.AUTH_USER || pass !== process.env.AUTH_PASS) {
        return unauthorized(options.headers);
      }
    },
  };
};
