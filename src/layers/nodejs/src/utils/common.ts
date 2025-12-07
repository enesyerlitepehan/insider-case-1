export interface HTTPResponse {
  statusCode: number;
  body?: any;
  headers: any;
  allowOnlyOptionsHeaders?: boolean;
}

const ROOT_DOMAINS = ['natera.com', 'nateralab.com'];

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return false; // service-to-service → no CORS needed
  try {
    const url = new URL(origin);
    return ROOT_DOMAINS.some(root => {
      return (
        url.hostname === root || // exact match
        url.hostname.endsWith('.' + root) // any subdomain match
      );
    });
  } catch {
    return false;
  }
}

// Generate http response
export class httpResponse {
  response: HTTPResponse;

  constructor(requestOrigin?: string, requestMethod?: string) {
    const originAllowed = requestOrigin ? isAllowedOrigin(requestOrigin) : true;

    this.response = {
      headers: {
        ...(originAllowed ? { 'Access-Control-Allow-Origin': requestOrigin } : {}),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': true,
      },
      statusCode: requestMethod === 'OPTIONS' ? 204 : 200,
    };

    if (requestMethod === 'OPTIONS') {
      this.response.allowOnlyOptionsHeaders = true;
    }
  }

  statusCode(statusCode: number) {
    this.response.statusCode = statusCode;
    return this;
  }

  allowOnlyOptionsHeaders() {
    this.response.headers['Access-Control-Allow-Headers'] = 'GET,OPTIONS';
    this.response.headers['Content-Security-Policy'] =
      "default-src 'self'; script-src 'self'; object-src 'none';";
    this.response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    return this;
  }

  body(data: any) {
    this.response.body = JSON.stringify(data);
    return this;
  }

  end() {
    return this.response;
  }
}
