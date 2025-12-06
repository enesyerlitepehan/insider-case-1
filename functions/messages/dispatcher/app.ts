export const lambdaHandler = async () => {
  const now = new Date().toISOString();
  const env = {
    MESSAGES_TABLE: process.env.MESSAGES_TABLE,
    PENDING_LIMIT: process.env.PENDING_LIMIT,
  };

  console.log("message-dispatcher invoked", { now, env });

  // Stub: real dispatch logic will be implemented later
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, now }),
  } as any;
};
