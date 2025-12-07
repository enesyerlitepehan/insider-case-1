import middy from '@middy/core';

type ApiGatewayEvent = {
  requestContext?: {
    requestId?: string;
  };
};

const baseHandler = async (event: ApiGatewayEvent) => {
  const requestId = event?.requestContext?.requestId ?? "unknown";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "ok",
      requestId,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const lambdaHandler = middy(baseHandler)